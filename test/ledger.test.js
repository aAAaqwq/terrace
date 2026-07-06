// Offline end-to-end proof of the co-signed multi-writer ledger.
//
// No swarm: we pipe two Corestores directly so the test is deterministic
// and offline. This isolates and proves the Autobase co-sign logic — the
// swarm (src/core/pairing.js) is just transport for the same bytes.
//
// Run: npm test

import Corestore from 'corestore'
import b4a from 'b4a'
import fs from 'fs'
import os from 'os'
import path from 'path'
import assert from 'assert'

import {
  createLedger, listListings, listTrades, getTrade, getListing
} from '../src/core/ledger.js'

function tmpDir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `terrace-${label}-`))
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
    seat: 'N12-R7-S21', priceUsdt: 850, nation: 'ARG', sellerId: 'host', ts: 1, status: 'open'
  })
  await settle(host)

  // 4) Joiner (buyer, France) makes an offer.
  await join.append({ type: 'offer', id: 'O1', listingId: 'L1', buyerId: 'join', buyerNation: 'FRA', ts: 2 })
  await settle(join)
  await settle(host)

  // 5) Host co-signs -> trade enters the shared, ordered log.
  await host.append({
    type: 'trade', id: 'T1', listingId: 'L1', offerId: 'O1', buyerId: 'join', sellerId: 'host',
    buyerNation: 'FRA', sellerNation: 'ARG', match: 'Final · ARG vs FRA', seat: 'N12-R7-S21',
    priceUsdt: 850, state: 'cosigned', cosignedBy: 'host', ts: 3
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
    type: 'trade', id: 'T1', listingId: 'L1', offerId: 'O1', buyerId: 'join', sellerId: 'host',
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

  // 8) Sanity on collections.
  const listings = await listListings(host)
  const trades = await listTrades(join)
  assert.strictEqual(listings.length, 1)
  assert.strictEqual(trades.length, 1)

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
