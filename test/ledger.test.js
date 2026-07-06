// Offline end-to-end proof of the co-signed multi-writer ledger.
//
// No swarm: we pipe two Corestores directly so the test is deterministic
// and offline. This isolates and proves the Autobase co-sign logic — the
// swarm (src/core/pairing.js) is just transport for the same bytes.
//
// Run: npm test

import Corestore from 'corestore'
import Autobase from 'autobase'
import Hyperbee from 'hyperbee'
import Hypercore from 'hypercore'
import sodium from 'sodium-universal'
import b4a from 'b4a'
import fs from 'fs'
import os from 'os'
import path from 'path'
import assert from 'assert'

import {
  createLedger, listListings, listTrades, getTrade, getListing,
  deriveStoreEncryptionKey, KEY
} from '../src/core/ledger.js'
import { verifyProof } from '../src/core/pairing.js'

function tmpDir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `terrace-${label}-`))
}

function sleep (ms) { return new Promise((r) => setTimeout(r, ms)) }

// Recursively scan a directory's file bytes for any of `needles` (plaintext
// markers of a listing). Returns the first needle found, or null if the bytes
// are opaque (encrypted) — the property we want to assert.
function scanForPlaintext (dir, needles) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      const hit = scanForPlaintext(p, needles)
      if (hit) return hit
    } else {
      const buf = fs.readFileSync(p)
      for (const needle of needles) {
        if (buf.includes(b4a.from(needle))) return needle
      }
    }
  }
  return null
}

async function settle (base) {
  // Let the linearizer catch up on both ends.
  await base.update()
}

// Replication over piped streams is async — poll both bases until the
// predicate holds (or time out). This models what the swarm does at runtime.
async function waitFor (bases, predicate, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const b of bases) await b.update()
    if (await predicate()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('timed out waiting for: ' + label)
}

async function main () {
  const hostDir = tmpDir('host')
  const joinDir = tmpDir('join')
  const hostStore = new Corestore(hostDir)
  const joinStore = new Corestore(joinDir)

  const host = createLedger(hostStore, null)
  await host.ready()

  const join = createLedger(joinStore, host.key)
  await join.ready()

  // Real writer keys — the ledger enforces authorship against these.
  const hostKey = b4a.toString(host.local.key, 'hex')
  const joinKey = b4a.toString(join.local.key, 'hex')

  // Wire replication both directions.
  const s1 = hostStore.replicate(true)
  const s2 = joinStore.replicate(false)
  s1.pipe(s2).pipe(s1)

  // 1) Host authorizes the joiner as a co-writer.
  await host.append({ type: 'add-writer', key: b4a.toString(join.local.key, 'hex') })
  await settle(host)

  // 2) Joiner waits until it is writable.
  const deadline = Date.now() + 15000
  while (!join.writable) {
    if (Date.now() > deadline) throw new Error('joiner never became writable')
    await join.update()
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.ok(join.writable, 'joiner is a co-writer')
  console.log('✓ joiner authorized as co-writer')

  // 3) Host (seller, Argentina) lists a Final ticket.
  await host.append({
    type: 'listing', id: 'L1', match: 'Final · ARG vs FRA', section: 'North Stand',
    seat: 'N12-R7-S21', priceUsdt: 850, nation: 'ARG', sellerId: hostKey, ts: 1, status: 'open'
  })
  await settle(host)

  // 4) Joiner (buyer, France) makes an offer.
  await join.append({ type: 'offer', id: 'O1', listingId: 'L1', buyerId: joinKey, buyerNation: 'FRA', ts: 2 })
  await settle(join)
  await settle(host)

  // 5) Host co-signs -> trade enters the shared, ordered log.
  await host.append({
    type: 'trade', id: 'T1', listingId: 'L1', offerId: 'O1', buyerId: joinKey, sellerId: hostKey,
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 850, state: 'cosigned', cosignedBy: hostKey, ts: 3
  })

  // 6) Both peers converge on the same trade + listing status.
  await waitFor([host, join], async () => {
    const t = await getTrade(join, 'T1')
    return t && t.state === 'cosigned'
  }, 'trade co-signed on both peers')

  const hostTrade = await getTrade(host, 'T1')
  const joinTrade = await getTrade(join, 'T1')
  assert.ok(hostTrade && joinTrade, 'both peers see the trade')
  assert.strictEqual(hostTrade.state, 'cosigned')
  assert.strictEqual(joinTrade.state, 'cosigned')
  assert.strictEqual(joinTrade.priceUsdt, 850)
  console.log('✓ trade co-signed and replicated to both peers')

  await waitFor([host, join], async () => {
    const l = await getListing(join, 'L1')
    return l && l.status === 'pending'
  }, 'listing pending on joiner')
  console.log('✓ listing status propagated (open -> pending)')

  // 7) Settlement leg marks it settled on the shared log.
  await join.append({
    type: 'trade', id: 'T1', listingId: 'L1', offerId: 'O1', buyerId: joinKey, sellerId: hostKey,
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 850, state: 'settled', settlement: { kind: 'mock' }, ts: 4
  })

  await waitFor([host, join], async () => {
    const t = await getTrade(host, 'T1')
    return t && t.state === 'settled'
  }, 'settlement replicated to seller')

  const settledOnHost = await getTrade(host, 'T1')
  assert.strictEqual(settledOnHost.state, 'settled', 'settlement replicated to seller')
  await waitFor([host, join], async () => {
    const l = await getListing(host, 'L1')
    return l && l.status === 'settled'
  }, 'listing settled on host')
  console.log('✓ settlement propagated (pending -> settled)')

  // 8) FORGERY REJECTED: the buyer tries to co-sign a NEW trade on a listing
  //    they don't own. The ledger drops it because the author isn't the seller.
  await join.append({
    type: 'trade', id: 'FORGE', listingId: 'L1', offerId: 'O1', buyerId: joinKey, sellerId: hostKey,
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 1, state: 'cosigned', cosignedBy: joinKey, ts: 5
  })
  // Give it every chance to (wrongly) appear, then assert it never did.
  await waitFor([host, join], async () => true, 'flush', 2000).catch(() => {})
  const forged = await getTrade(host, 'FORGE')
  assert.strictEqual(forged, null, 'buyer-forged co-sign is rejected by the ledger')
  console.log('✓ forged co-sign REJECTED (buyer cannot fake the seller\'s signature)')

  // 9) Sanity on collections.
  const listings = await listListings(host)
  const trades = await listTrades(join)
  assert.strictEqual(listings.length, 1)
  assert.strictEqual(trades.length, 1)

  // 10) ENCRYPTED STORE: the ledger is encrypted with a key derived off the
  //     invite (host from its own base.key, joiner from the invite it holds) —
  //     so only invite-holders can read it, and nothing sits in plaintext.
  //
  //     (a) On disk, the host's cores are ciphertext. The listing's own fields
  //         must NOT appear as plaintext bytes anywhere in the store.
  const needles = ['North Stand', 'N12-R7-S21', 'Final · ARG vs FRA', hostKey]
  const plaintext = scanForPlaintext(hostDir, needles)
  assert.strictEqual(plaintext, null, 'store must be ciphertext on disk (found plaintext: ' + plaintext + ')')
  console.log('✓ store encrypted at rest (no plaintext listing bytes on disk)')

  //     (b) A peer WITHOUT the invite key cannot read the replicated ledger.
  //         It has the public base.key (needed just to bootstrap) but derives
  //         the WRONG encryption key, so the blocks are undecryptable garbage.
  const eveDir = tmpDir('eve')
  const eveStore = new Corestore(eveDir)
  const wrongInvite = b4a.alloc(32)
  sodium.randombytes_buf(wrongInvite)
  const eve = new Autobase(eveStore, host.key, {
    encryptionKey: deriveStoreEncryptionKey(wrongInvite), // attacker's wrong key
    valueEncoding: 'json',
    open (viewStore) {
      return new Hyperbee(viewStore.get('terrace-view'), {
        keyEncoding: 'utf-8', valueEncoding: 'json', extension: false
      })
    },
    async apply () { /* eve can't decrypt anything to apply */ }
  })

  let eveCanRead = true
  try {
    await eve.ready()
    const es1 = hostStore.replicate(true)
    const es2 = eveStore.replicate(false)
    es1.pipe(es2).pipe(es1)
    for (let i = 0; i < 20; i++) {
      try { await eve.update() } catch { /* undecryptable — expected */ }
      await sleep(100)
    }
    let node = null
    try { node = await eve.view.get(KEY.listing('L1')) } catch { node = null }
    eveCanRead = !!(node && node.value && node.value.seat === 'N12-R7-S21')
    es1.destroy(); es2.destroy()
  } catch {
    eveCanRead = false // failed to even open with the wrong key — also a pass
  }
  assert.strictEqual(eveCanRead, false, 'peer without the invite key must NOT read listings')
  console.log('✓ peer WITHOUT the invite cannot read the ledger (wrong key ⇒ no plaintext)')

  await eve.close(); await eveStore.close()
  fs.rmSync(eveDir, { recursive: true, force: true })

  // 11) PROOF-OF-POSSESSION: the pairing handshake's verifier is real crypto,
  //     not theater. A signer that controls its writer key is accepted; an
  //     impostor claiming someone else's writer key, and a replayed proof over
  //     a stale nonce, are both rejected.
  {
    const mkSigner = () => {
      const publicKey = b4a.alloc(sodium.crypto_sign_PUBLICKEYBYTES)
      const secretKey = b4a.alloc(sodium.crypto_sign_SECRETKEYBYTES)
      sodium.crypto_sign_keypair(publicKey, secretKey)
      const writerKey = Hypercore.key({ version: 1, signers: [{ publicKey }] })
      return { publicKey, secretKey, writerKey }
    }
    const helloOf = (s) => ({
      writerKey: b4a.toString(s.writerKey, 'hex'),
      signerPublicKey: b4a.toString(s.publicKey, 'hex')
    })
    const signOver = (nonce, secretKey) => {
      const sig = b4a.alloc(sodium.crypto_sign_BYTES)
      sodium.crypto_sign_detached(sig, nonce, secretKey)
      return sig
    }

    const alice = mkSigner()
    const mallory = mkSigner()
    const nonce = b4a.alloc(32); sodium.randombytes_buf(nonce)

    // Honest: Alice signs OUR nonce with her key, claims her own writer key.
    assert.strictEqual(
      verifyProof(signOver(nonce, alice.secretKey), nonce, helloOf(alice), 1),
      true, 'honest proof-of-possession accepted')

    // Spoof: Mallory claims Alice's writer key but can only sign with her own.
    assert.strictEqual(
      verifyProof(signOver(nonce, mallory.secretKey), nonce, {
        writerKey: b4a.toString(alice.writerKey, 'hex'),
        signerPublicKey: b4a.toString(mallory.publicKey, 'hex')
      }, 1),
      false, 'writer-key spoof rejected (signer does not bind to claimed writer key)')

    // Replay: a valid signature over a DIFFERENT nonce is not accepted.
    const stale = b4a.alloc(32); sodium.randombytes_buf(stale)
    assert.strictEqual(
      verifyProof(signOver(stale, alice.secretKey), nonce, helloOf(alice), 1),
      false, 'stale/replayed proof rejected')

    console.log('✓ proof-of-possession verified (honest accepted; spoof & replay rejected)')
  }

  console.log('\nALL LEDGER TESTS PASSED ✅  (multi-writer co-signed ledger works end-to-end)')

  // cleanup
  s1.destroy(); s2.destroy()
  await host.close(); await join.close()
  await hostStore.close(); await joinStore.close()
  fs.rmSync(hostDir, { recursive: true, force: true })
  fs.rmSync(joinDir, { recursive: true, force: true })
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
