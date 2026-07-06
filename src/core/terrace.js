// TerraceCore — the P2P engine behind the UI.
//
// Wires a Corestore + Hyperswarm to a multi-writer Autobase co-signed
// ledger (src/core/ledger.js) and a Protomux writer-key handshake
// (src/core/pairing.js). Exposes the exact async API the UI expects:
//   start, getListings, publishListing, makeOffer, acceptOffer,
//   settleTrade, getReceipt, on(event, cb)
//
// Runs on Node (for tests / CLI peers) and on the Pear/Bare runtime
// (for the desktop app) — no Node-only APIs are used.

import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import sodium from 'sodium-universal'

import { createLedger, listListings, listTrades, listOffers, getTrade, getListing } from './ledger.js'
import { attachPairing } from './pairing.js'
import { PassVault, passHashlock, preimageHexOf, verifyPreimage } from './asset.js'

const TOPIC_CONTEXT = 'terrace:room:1'

export class TerraceCore {
  constructor ({ storageDir, bootstrap = null, nation = 'INT', swarmBootstrap = null }) {
    this.store = new Corestore(storageDir)
    // swarmBootstrap lets tests point at a local DHT testnet; production uses
    // the public Hyperswarm DHT.
    this.swarm = new Hyperswarm(swarmBootstrap ? { bootstrap: swarmBootstrap } : undefined)
    this.bootstrap = bootstrap
    this.isHost = !bootstrap
    this.nation = nation
    this.base = null
    this.peers = new Set()
    this._addedWriters = new Set()
    this._listeners = new Map()
    this._seenListings = new Set()
    this._seenOffers = new Set()
    this._seenTrades = new Map() // id -> state, to emit on state change
    // Tokenized fan-pass (HTLC) delivery. The vault holds the encrypted-pass
    // Hypercore that replicates over the same swarm; _passSecrets keeps the
    // seller's plaintext secret S in memory ONLY (never on the ledger) so this
    // peer can reveal it at settlement to unlock the pass for the buyer.
    this._passVault = new PassVault(this.store)
    this._passSecrets = new Map() // listingId -> secret S (seller-local only)
  }

  // ---- events -----------------------------------------------------------
  on (event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event).add(cb)
    return () => this._listeners.get(event)?.delete(cb)
  }

  _emit (event, payload) {
    const set = this._listeners.get(event)
    if (!set) return
    for (const cb of set) {
      try { cb(payload) } catch { /* listener errors never break the core */ }
    }
  }

  // ---- lifecycle --------------------------------------------------------
  async start () {
    this.base = createLedger(this.store, this.bootstrap)
    await this.base.ready()

    // Emit a status update whenever the joiner's writable state flips (it
    // becomes a co-writer via replication, not a local call) so the UI can
    // clear its "getting authorized…" gate and enable writes.
    this._lastWritable = this.base.writable
    this.base.on('update', () => {
      this._syncView()
      if (this.base.writable !== this._lastWritable) {
        this._lastWritable = this.base.writable
        this._emitStatus()
      }
    })

    // Identity used for the proof-of-possession pairing handshake: the writer
    // key, its signing keyPair (to sign challenge nonces) and the manifest
    // version needed to bind a signer key to its writer key.
    const pairingIdentity = {
      writerKey: this.base.local.key,
      signer: this.base.local.keyPair,
      manifestVersion: this.store.manifestVersion
    }

    this.swarm.on('connection', (conn) => {
      this.peers.add(conn)
      conn.on('close', () => {
        this.peers.delete(conn)
        this._emitStatus()
      })
      attachPairing(conn, this.store, pairingIdentity, (remoteKey) => this._onRemoteWriterKey(remoteKey))
      this._emit('peer', { peerId: this.peerId, nation: this.nation, count: this.peers.size })
      this._emitStatus()
    })

    // Both host and joiner meet on a topic derived from the ledger key.
    const topic = roomTopic(this.base.key)
    const discovery = this.swarm.join(topic, { server: true, client: true })
    await discovery.flushed()

    await this.base.update()
    this._syncView()
    this._emitStatus()

    return {
      peerId: this.peerId,
      nation: this.nation,
      bootstrap: b4a.toString(this.base.key, 'hex'),
      writable: this.base.writable
    }
  }

  get peerId () {
    return this.base ? b4a.toString(this.base.local.key, 'hex') : null
  }

  async _onRemoteWriterKey (remoteKeyHex) {
    // Only the host authorizes co-writers; the joiner just waits to become writable.
    if (!this.isHost) return
    if (this._addedWriters.has(remoteKeyHex)) return
    if (remoteKeyHex === b4a.toString(this.base.local.key, 'hex')) return
    this._addedWriters.add(remoteKeyHex)
    await this.base.append({ type: 'add-writer', key: remoteKeyHex })
    await this.base.update()
    this._emitStatus()
  }

  async _whenWritable (timeoutMs = 20000) {
    if (this.base.writable) return true
    const start = Date.now()
    while (!this.base.writable) {
      if (Date.now() - start > timeoutMs) throw new Error('timed out waiting to be authorized as a co-writer')
      await this.base.update()
      if (this.base.writable) break
      await sleep(150)
    }
    return true
  }

  // ---- writes -----------------------------------------------------------
  // `passSecret` is OPTIONAL and fully backward compatible: omit it for the
  // classic listing. Provide it (a transfer code / QR payload) to issue a
  // tokenized fan-pass delivered via hashlock — the seller attaches an
  // encrypted pass payload and publishes only H = hashlock(S), plus the pass
  // core reference, on the ledger. Revealing S is deferred to settlement.
  async publishListing ({ match, section, seat, priceUsdt, nation, passSecret = null, passPayload = null }) {
    await this._whenWritable()
    const listing = {
      type: 'listing',
      id: randomId(),
      match,
      section,
      seat,
      priceUsdt: Number(priceUsdt),
      nation: nation || this.nation,
      sellerId: this.peerId,
      ts: nowTs(),
      status: 'open'
    }

    if (passSecret != null) {
      // Default the delivered payload to the trade coordinates + the secret
      // transfer code itself, so decrypting the pass yields the redeemable pass.
      const payload = passPayload ?? {
        kind: 'terrace-fan-pass',
        match,
        section,
        seat,
        transferCode: String(passSecret),
        note: 'Tokenized fan-pass — present transferCode to redeem'
      }
      const ref = await this._passVault.seal(passSecret, payload)
      listing.hashlock = ref.hashlock
      listing.pass = { coreKey: ref.coreKey, block: ref.block, nonce: ref.nonce }
      // Seller-local only: needed to reveal S at settlement. Never appended.
      this._passSecrets.set(listing.id, String(passSecret))
    }

    await this.base.append(listing)
    await this.base.update()
    return stripType(listing)
  }

  async makeOffer (listingId) {
    await this._whenWritable()
    const offer = {
      type: 'offer',
      id: randomId(),
      listingId,
      buyerId: this.peerId,
      buyerNation: this.nation,
      ts: nowTs()
    }
    await this.base.append(offer)
    await this.base.update()
    return stripType(offer)
  }

  // Seller co-signs the offer -> a trade record enters the shared log,
  // signed by the acceptor over a log that already carries the buyer's
  // offer and the seller's listing. That IS the co-signature.
  async acceptOffer (offerId) {
    await this._whenWritable()
    const offer = await this._readOffer(offerId)
    if (!offer) throw new Error('offer not found: ' + offerId)
    const listing = await getListing(this.base, offer.listingId)
    if (!listing) throw new Error('listing not found: ' + offer.listingId)

    const trade = {
      type: 'trade',
      // Deterministic id shared with the 'offered' event so the UI can
      // transition one card offered -> cosigned -> settled.
      id: 't_' + offerId,
      listingId: listing.id,
      offerId,
      buyerId: offer.buyerId,
      sellerId: listing.sellerId,
      buyerNation: offer.buyerNation,
      sellerNation: listing.nation,
      match: listing.match,
      seat: listing.seat,
      priceUsdt: listing.priceUsdt,
      state: 'cosigned',
      cosignedBy: this.peerId,
      ts: nowTs()
    }
    // Inherit the tokenized-pass hashlock so the trade carries the atomic-swap
    // lock forward to settlement and getPass (additive; absent for classic trades).
    if (listing.hashlock) {
      trade.hashlock = listing.hashlock
      if (listing.pass) trade.pass = listing.pass
    }
    await this.base.append(trade)
    await this.base.update()
    return stripType(trade)
  }

  // Settlement leg. The payment stays a clearly-labelled mock/testnet USDt
  // transfer (no real funds move). What is REAL here is the atomic delivery:
  // if the trade issued a tokenized fan-pass (a hashlock H is present), this
  // settlement MUST reveal the preimage S — hashlock(S) === H — or the ledger's
  // apply() drops it. Revealing S is exactly what unlocks the buyer's pass, so
  // the seller cannot reach "settled/paid" without handing over the key. The
  // seller supplies S automatically (held in memory since publishListing);
  // opts.passSecret can override it.
  async settleTrade (tradeId, proof = null, opts = {}) {
    await this._whenWritable()
    const trade = await getTrade(this.base, tradeId)
    if (!trade) throw new Error('trade not found: ' + tradeId)

    const settled = {
      ...trade,
      type: 'trade',
      state: 'settled',
      settlement: proof || { kind: 'mock', paid: true, note: 'demo settlement — no real funds moved', ts: nowTs() },
      settledBy: this.peerId,
      ts: nowTs()
    }

    const listing = await getListing(this.base, trade.listingId)
    const hashlock = trade.hashlock || listing?.hashlock || null
    if (hashlock) {
      // Reveal the unlocking preimage. Prefer an explicit override, else the
      // seller-local secret captured at publish time.
      const secret = opts.passSecret != null
        ? String(opts.passSecret)
        : this._passSecrets.get(trade.listingId)
      if (secret == null) {
        throw new Error('cannot settle a tokenized-pass trade without the unlocking secret (only the seller can reveal it)')
      }
      if (passHashlock(secret) !== hashlock) {
        throw new Error('provided pass secret does not match the listing hashlock')
      }
      settled.preimage = preimageHexOf(secret) // this is the on-ledger reveal of S
      settled.revealed = true
    }

    await this.base.append(settled)
    await this.base.update()
    return stripType(settled)
  }

  // Buyer-facing pass retrieval. Before the seller reveals S at settlement this
  // returns a LOCKED indicator; after reveal it decrypts and returns the pass.
  // The buyer can never obtain the plaintext pass until S is on the ledger.
  async getPass (tradeId) {
    const trade = await getTrade(this.base, tradeId)
    if (!trade) return null
    const listing = await getListing(this.base, trade.listingId)
    const ref = trade.pass || listing?.pass || null
    const hashlock = trade.hashlock || listing?.hashlock || null

    if (!ref || !hashlock) {
      // Classic listing with no tokenized pass.
      return { hasPass: false, locked: false, revealed: false, hashlock: null, pass: null }
    }

    const preimage = (trade.state === 'settled' && trade.revealed && trade.preimage) ? trade.preimage : null
    if (!preimage || !verifyPreimage(preimage, hashlock)) {
      return { hasPass: true, locked: true, revealed: false, hashlock, pass: null }
    }

    const pass = await this._passVault.open({ ...ref, hashlock }, preimage)
    return { hasPass: true, locked: false, revealed: true, hashlock, pass }
  }

  // ---- reads ------------------------------------------------------------
  async getListings () {
    const rows = await listListings(this.base)
    return rows.map(stripType)
  }

  async getTrades () {
    const rows = await listTrades(this.base)
    return rows.map(stripType)
  }

  async getReceipt (tradeId) {
    const trade = await getTrade(this.base, tradeId)
    if (!trade) return null
    return {
      tradeId: trade.id,
      match: trade.match,
      seat: trade.seat,
      priceUsdt: trade.priceUsdt,
      buyerNation: trade.buyerNation,
      sellerNation: trade.sellerNation,
      state: trade.state,
      settlement: trade.settlement || null,
      // Tokenized-pass / HTLC fields (null for classic trades).
      hashlock: trade.hashlock || null,
      revealed: !!trade.revealed,
      passUnlocked: !!(trade.revealed && trade.preimage),
      ledgerHeight: this.base.view?.version ?? this.base.length ?? 0,
      hash: receiptHash(trade),
      ts: trade.ts
    }
  }

  async _readOffer (offerId) {
    const node = await this.base.view.get(`offer/${offerId}`)
    return node ? node.value : null
  }

  // ---- view sync / event emission --------------------------------------
  async _syncView () {
    if (!this.base?.view) return
    try {
      const listings = await listListings(this.base)
      for (const l of listings) {
        if (!this._seenListings.has(l.id)) {
          this._seenListings.add(l.id)
          this._emit('listing', stripType(l))
        }
      }
      // Surface incoming offers as an 'offered'-state trade so the seller can
      // accept (carrying offerId). Stable id ties it to the eventual trade.
      const offers = await listOffers(this.base)
      for (const o of offers) {
        if (this._seenOffers.has(o.id)) continue
        const listing = await getListing(this.base, o.listingId)
        if (!listing) continue // listing not replicated yet; retry next update
        this._seenOffers.add(o.id)
        const tid = 't_' + o.id
        if (!this._seenTrades.has(tid)) {
          this._seenTrades.set(tid, 'offered')
          this._emit('trade', {
            id: tid,
            offerId: o.id,
            listingId: listing.id,
            buyerId: o.buyerId,
            sellerId: listing.sellerId,
            buyerNation: o.buyerNation,
            sellerNation: listing.nation,
            match: listing.match,
            seat: listing.seat,
            priceUsdt: listing.priceUsdt,
            state: 'offered',
            ts: o.ts
          })
        }
      }
      const trades = await listTrades(this.base)
      for (const t of trades) {
        if (this._seenTrades.get(t.id) !== t.state) {
          this._seenTrades.set(t.id, t.state)
          this._emit('trade', stripType(t))
        }
      }
    } catch { /* view mid-update; next 'update' will catch up */ }
  }

  _emitStatus () {
    this._emit('status', {
      connected: this.peers.size > 0,
      peers: this.peers.size,
      writable: !!this.base?.writable
    })
  }

  async destroy () {
    await this.swarm.destroy()
    await this._passVault?.close()
    await this.base?.close()
    await this.store.close()
  }
}

// ---- helpers ------------------------------------------------------------
function roomTopic (ledgerKey) {
  const out = b4a.alloc(32)
  const input = b4a.concat([b4a.from(TOPIC_CONTEXT), ledgerKey])
  sodium.crypto_generichash(out, input)
  return out
}

function receiptHash (trade) {
  const out = b4a.alloc(32)
  const input = b4a.from(JSON.stringify({
    id: trade.id,
    listingId: trade.listingId,
    buyerId: trade.buyerId,
    sellerId: trade.sellerId,
    priceUsdt: trade.priceUsdt,
    state: trade.state
  }))
  sodium.crypto_generichash(out, input)
  return b4a.toString(out, 'hex')
}

function randomId () {
  const buf = b4a.alloc(8)
  sodium.randombytes_buf(buf)
  return b4a.toString(buf, 'hex')
}

function stripType (op) {
  const { type, ...rest } = op
  return rest
}

function nowTs () {
  // Injected by callers/tests when determinism is needed; Date is fine at runtime.
  return Date.now()
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
