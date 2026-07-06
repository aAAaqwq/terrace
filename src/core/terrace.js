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

import { createLedger, listListings, listTrades, getTrade, getListing } from './ledger.js'
import { attachPairing } from './pairing.js'

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
    this._seenTrades = new Map() // id -> state, to emit on state change
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

    this.base.on('update', () => this._syncView())

    const localWriterKey = b4a.toString(this.base.local.key, 'hex')

    this.swarm.on('connection', (conn) => {
      this.peers.add(conn)
      conn.on('close', () => {
        this.peers.delete(conn)
        this._emitStatus()
      })
      attachPairing(conn, this.store, localWriterKey, (remoteKey) => this._onRemoteWriterKey(remoteKey))
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
  async publishListing ({ match, section, seat, priceUsdt, nation }) {
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
      id: randomId(),
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
    await this.base.append(trade)
    await this.base.update()
    return stripType(trade)
  }

  // Settlement leg. v1 records a settlement proof (a real USDt testnet tx
  // hash when wired; a clearly-labelled mock otherwise) onto the trade.
  async settleTrade (tradeId, proof = null) {
    await this._whenWritable()
    const trade = await getTrade(this.base, tradeId)
    if (!trade) throw new Error('trade not found: ' + tradeId)
    const settled = {
      ...trade,
      type: 'trade',
      state: 'settled',
      settlement: proof || { kind: 'mock', note: 'demo settlement — no real funds moved', ts: nowTs() },
      settledBy: this.peerId,
      ts: nowTs()
    }
    await this.base.append(settled)
    await this.base.update()
    return stripType(settled)
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
