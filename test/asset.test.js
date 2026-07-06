// HTLC atomic-delivery proof for the Terrace tokenized fan-pass.
//
// Proves the four atomicity properties the review demanded:
//   (A) the buyer cannot obtain/decrypt the pass BEFORE the preimage is revealed;
//   (B) a settlement carrying a WRONG/MISSING preimage is REJECTED by apply();
//   (C) a settlement with the CORRECT preimage reveals S and unlocks the pass;
//   (D) the seller cannot mark settled+paid WITHOUT revealing the unlocking secret.
//
// Part 1 runs at the raw-ledger level over two piped Corestores (deterministic,
// offline) to isolate apply()'s hashlock enforcement. Part 2 runs the full
// TerraceCore over a REAL Hyperswarm testnet, proving the encrypted pass
// actually replicates peer-to-peer and unlocks only post-settlement.
//
// Run: node test/asset.test.js

import Corestore from 'corestore'
import createTestnet from 'hyperdht/testnet.js'
import fs from 'fs'
import os from 'os'
import path from 'path'
import assert from 'assert'
import b4a from 'b4a'

import { createLedger, getTrade } from '../src/core/ledger.js'
import { TerraceCore } from '../src/core/terrace.js'
import { passHashlock, preimageHexOf, verifyPreimage, PassVault } from '../src/core/asset.js'

function tmpDir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `terrace-asset-${label}-`))
}
function sleep (ms) { return new Promise((r) => setTimeout(r, ms)) }

async function settle (base) { await base.update() }

async function waitFor (bases, predicate, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const b of bases) await b.update()
    if (await predicate()) return
    await sleep(100)
  }
  throw new Error('timed out waiting for: ' + label)
}

async function waitCond (predicate, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await sleep(200)
  }
  throw new Error('timed out waiting for: ' + label)
}

// ---------------------------------------------------------------------------
// Part 0 — pure crypto sanity for the hashlock predicate apply() relies on.
// ---------------------------------------------------------------------------
function testHashlockPrimitive () {
  const S = 'FIFA-TRANSFER-CODE-7Q2X-DEMO'
  const H = passHashlock(S)
  assert.ok(/^[0-9a-f]{64}$/.test(H), 'hashlock is 32-byte hex')
  assert.strictEqual(verifyPreimage(preimageHexOf(S), H), true, 'correct preimage verifies')
  assert.strictEqual(verifyPreimage(preimageHexOf('WRONG-CODE'), H), false, 'wrong preimage rejected')
  assert.strictEqual(verifyPreimage(null, H), false, 'missing preimage rejected')
  // Domain separation: knowing H must not equal the pass key material.
  assert.notStrictEqual(passHashlock(S), b4a.toString(b4a.from(preimageHexOf(S), 'hex'), 'hex'))
  console.log('✓ hashlock primitive: correct preimage verifies; wrong/missing rejected')
}

// ---------------------------------------------------------------------------
// Part 1 — ledger-level HTLC enforcement (offline, deterministic).
// ---------------------------------------------------------------------------
async function testLedgerEnforcement () {
  const hostDir = tmpDir('l-host')
  const joinDir = tmpDir('l-join')
  const hostStore = new Corestore(hostDir)
  const joinStore = new Corestore(joinDir)

  const host = createLedger(hostStore, null)
  await host.ready()
  const join = createLedger(joinStore, host.key)
  await join.ready()

  const hostKey = b4a.toString(host.local.key, 'hex')
  const joinKey = b4a.toString(join.local.key, 'hex')

  const s1 = hostStore.replicate(true)
  const s2 = joinStore.replicate(false)
  s1.pipe(s2).pipe(s1)

  await host.append({ type: 'add-writer', key: joinKey })
  await settle(host)
  const dl = Date.now() + 15000
  while (!join.writable) {
    if (Date.now() > dl) throw new Error('joiner never became writable')
    await join.update(); await sleep(100)
  }

  // Seller issues a TOKENIZED pass: publish only H, never S.
  const S = 'SEAT-N12-R7-S21-UNLOCK-9F3A'
  const H = passHashlock(S)
  await host.append({
    type: 'listing', id: 'LP', match: 'Final · ARG vs FRA', section: 'North Stand',
    seat: 'N12-R7-S21', priceUsdt: 850, nation: 'ARG', sellerId: hostKey, ts: 1,
    status: 'open', hashlock: H
  })
  await settle(host)

  await join.append({ type: 'offer', id: 'OP', listingId: 'LP', buyerId: joinKey, buyerNation: 'FRA', ts: 2 })
  await settle(join); await settle(host)

  await host.append({
    type: 'trade', id: 'TP', listingId: 'LP', offerId: 'OP', buyerId: joinKey, sellerId: hostKey,
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 850, state: 'cosigned', cosignedBy: hostKey, ts: 3, hashlock: H
  })
  await waitFor([host, join], async () => {
    const t = await getTrade(join, 'TP'); return t && t.state === 'cosigned'
  }, 'hashlocked trade co-signed')

  // (B/D) Settlement with a WRONG preimage — apply() must REJECT it, so the
  // trade never reaches settled. The seller cannot fake being paid.
  await join.append({
    type: 'trade', id: 'TP', listingId: 'LP', offerId: 'OP', buyerId: joinKey, sellerId: hostKey,
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 850, state: 'settled', settlement: { kind: 'mock', paid: true },
    preimage: preimageHexOf('NOT-THE-REAL-SECRET'), ts: 4
  })
  await waitFor([host, join], async () => true, 'flush', 1500).catch(() => {})
  let t = await getTrade(host, 'TP')
  assert.strictEqual(t.state, 'cosigned', 'settlement with WRONG preimage is REJECTED (trade stays cosigned)')
  assert.ok(!t.revealed, 'no secret revealed by a rejected settlement')
  console.log('✓ settle with WRONG preimage REJECTED by apply() — seller cannot fake payment')

  // A settled op with NO preimage at all is likewise rejected.
  await host.append({
    type: 'trade', id: 'TP', listingId: 'LP', offerId: 'OP', buyerId: joinKey, sellerId: hostKey,
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 850, state: 'settled', settlement: { kind: 'mock', paid: true }, ts: 5
  })
  await waitFor([host, join], async () => true, 'flush', 1500).catch(() => {})
  t = await getTrade(host, 'TP')
  assert.strictEqual(t.state, 'cosigned', 'settlement with NO preimage is REJECTED')
  console.log('✓ settle with MISSING preimage REJECTED by apply()')

  // (C) Settlement with the CORRECT preimage — accepted, and S is now revealed
  // on the shared ledger (the unlock the buyer needs).
  await host.append({
    type: 'trade', id: 'TP', listingId: 'LP', offerId: 'OP', buyerId: joinKey, sellerId: hostKey,
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 850, state: 'settled', settlement: { kind: 'mock', paid: true },
    preimage: preimageHexOf(S), ts: 6
  })
  await waitFor([host, join], async () => {
    const tt = await getTrade(join, 'TP'); return tt && tt.state === 'settled'
  }, 'correct-preimage settlement accepted + replicated')
  t = await getTrade(join, 'TP')
  assert.strictEqual(t.state, 'settled', 'correct preimage settles the trade')
  assert.strictEqual(t.revealed, true, 'apply() marks the trade revealed')
  assert.strictEqual(verifyPreimage(t.preimage, H), true, 'revealed preimage matches the hashlock')
  console.log('✓ settle with CORRECT preimage ACCEPTED — S revealed on the shared ledger')

  s1.destroy(); s2.destroy()
  await host.close(); await join.close()
  await hostStore.close(); await joinStore.close()
  fs.rmSync(hostDir, { recursive: true, force: true })
  fs.rmSync(joinDir, { recursive: true, force: true })
}

// ---------------------------------------------------------------------------
// Part 2 — full TerraceCore over a REAL Hyperswarm: the encrypted pass
// replicates peer-to-peer and unlocks ONLY after settlement reveals S.
// ---------------------------------------------------------------------------
async function testSwarmAtomicDelivery () {
  const testnet = await createTestnet(3)
  const bootstrap = testnet.bootstrap
  const hostDir = tmpDir('s-host')
  const joinDir = tmpDir('s-join')

  const host = new TerraceCore({ storageDir: hostDir, nation: 'ARG', swarmBootstrap: bootstrap })
  const hostInfo = await host.start()
  const join = new TerraceCore({ storageDir: joinDir, nation: 'FRA', bootstrap: hostInfo.bootstrap, swarmBootstrap: bootstrap })
  await join.start()

  await waitCond(() => host.peers.size > 0 && join.peers.size > 0, 'peers connected')
  await waitCond(() => join.base.writable, 'joiner authorized')
  console.log('✓ peers connected + joiner authorized (real swarm)')

  // Seller issues a tokenized fan-pass with a secret transfer code.
  const SECRET = 'TERRACE-PASS-QR::ARGFRA-N12-R7-S21::a1b2c3d4'
  const listing = await host.publishListing({
    match: 'Final · ARG vs FRA', section: 'North Stand', seat: 'N12-R7-S21',
    priceUsdt: 850, passSecret: SECRET
  })
  assert.ok(listing.hashlock && /^[0-9a-f]{64}$/.test(listing.hashlock), 'listing carries a hashlock')
  assert.ok(listing.pass && listing.pass.coreKey, 'listing carries an encrypted-pass reference')
  assert.ok(!('transferCode' in listing) || listing.transferCode === undefined, 'secret code is NOT on the listing')
  console.log('✓ seller issued tokenized fan-pass · hashlock', listing.hashlock.slice(0, 12) + '…')

  await waitCond(async () => (await join.getListings()).some((l) => l.id === listing.id), 'listing replicated')
  const offer = await join.makeOffer(listing.id)
  await waitCond(async () => !!(await host._readOffer(offer.id)), 'offer replicated')
  const trade = await host.acceptOffer(offer.id)
  await waitCond(async () => {
    const t = (await join.getTrades()).find((x) => x.id === trade.id)
    return t && t.state === 'cosigned'
  }, 'trade co-signed')
  console.log('✓ tokenized-pass trade co-signed', trade.id.slice(0, 10))

  // (A) BEFORE settlement, the buyer CANNOT get the pass. The ciphertext may
  // even have replicated, but with no revealed S it stays locked.
  const lockedView = await join.getPass(trade.id)
  assert.strictEqual(lockedView.hasPass, true, 'buyer sees a pass exists')
  assert.strictEqual(lockedView.locked, true, 'buyer view is LOCKED pre-settlement')
  assert.strictEqual(lockedView.revealed, false, 'no reveal yet')
  assert.strictEqual(lockedView.pass, null, 'no plaintext pass before reveal')
  // And a direct decrypt attempt with a guessed/absent secret must fail.
  const buyerVault = new PassVault(join.store)
  let directOpenFailed = false
  try {
    await buyerVault.open({ ...listing.pass, hashlock: listing.hashlock }, preimageHexOf('GUESSED-WRONG'), { timeout: 3000 })
  } catch { directOpenFailed = true }
  assert.strictEqual(directOpenFailed, true, 'buyer cannot decrypt the pass without the real preimage')
  console.log('✓ (A) buyer CANNOT obtain/decrypt the pass before reveal')

  // (D) The buyer cannot settle a hashlocked trade — they do not hold S.
  let buyerSettleFailed = false
  try { await join.settleTrade(trade.id) } catch { buyerSettleFailed = true }
  assert.strictEqual(buyerSettleFailed, true, 'buyer (no secret) cannot mark settled/paid')
  console.log('✓ (D) buyer cannot settle+pay without the unlocking secret')

  // The SELLER settles: the mock payment leg is accompanied by the reveal of S.
  const settled = await host.settleTrade(trade.id)
  assert.strictEqual(settled.settlement.paid, true, 'payment leg (mock) marked paid')
  assert.ok(settled.preimage, 'settlement reveals the preimage S')
  await waitCond(async () => {
    const r = await join.getReceipt(trade.id)
    return r && r.state === 'settled' && r.revealed
  }, 'settlement + reveal replicated to buyer')
  console.log('✓ seller settled+paid — and thereby revealed S on the ledger')

  // (C) POST-settlement, the buyer decrypts the pass from the P2P-replicated
  // ciphertext. This proves the encrypted pass rode the SAME swarm and that the
  // reveal is exactly what unlocks it.
  await waitCond(async () => {
    const v = await join.getPass(trade.id)
    return v && v.locked === false && v.pass
  }, 'buyer unlocks the pass post-settlement')
  const unlocked = await join.getPass(trade.id)
  assert.strictEqual(unlocked.locked, false, 'pass unlocked after reveal')
  assert.strictEqual(unlocked.pass.transferCode, SECRET, 'buyer decrypts the exact fan-pass transfer code')
  assert.strictEqual(unlocked.pass.kind, 'terrace-fan-pass', 'decrypted payload is the fan-pass')
  console.log('✓ (C) buyer decrypted the P2P-replicated pass AFTER reveal · code', unlocked.pass.transferCode.slice(0, 18) + '…')

  const receipt = await host.getReceipt(trade.id)
  assert.strictEqual(receipt.state, 'settled')
  assert.strictEqual(receipt.passUnlocked, true, 'receipt records the pass as unlocked')
  assert.strictEqual(verifyPreimage(settled.preimage, listing.hashlock), true, 'receipt-anchored reveal matches the published hashlock')
  console.log('✓ receipt surfaces hashlock/revealed/passUnlocked state')

  await buyerVault.close()
  await host.destroy(); await join.destroy(); await testnet.destroy()
  fs.rmSync(hostDir, { recursive: true, force: true })
  fs.rmSync(joinDir, { recursive: true, force: true })
}

async function main () {
  testHashlockPrimitive()
  await testLedgerEnforcement()
  await testSwarmAtomicDelivery()
  console.log('\nALL ASSET/HTLC TESTS PASSED ✅  (tokenized fan-pass delivered atomically via hashlock)')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ ASSET TEST FAILED:', err)
  process.exit(1)
})
