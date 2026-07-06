// Full-stack two-peer proof over a REAL Hyperswarm transport (local DHT
// testnet, so it's hermetic + offline). Exercises TerraceCore end-to-end:
// discovery -> protomux writer-key pairing -> co-writer authorization ->
// listing -> offer -> co-signed trade -> settlement -> receipt.
//
// Run: node test/swarm.test.js

import createTestnet from 'hyperdht/testnet.js'
import fs from 'fs'
import os from 'os'
import path from 'path'
import assert from 'assert'

import { TerraceCore } from '../src/core/terrace.js'

function tmpDir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `terrace-swarm-${label}-`))
}

async function waitFor (predicate, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('timed out waiting for: ' + label)
}

async function main () {
  const testnet = await createTestnet(3)
  const bootstrap = testnet.bootstrap

  const hostDir = tmpDir('host')
  const joinDir = tmpDir('join')

  // Seller: Argentina fan, hosts the ledger.
  const host = new TerraceCore({ storageDir: hostDir, nation: 'ARG', swarmBootstrap: bootstrap })
  const hostInfo = await host.start()
  console.log('✓ host up · nation ARG · ledger', hostInfo.bootstrap.slice(0, 12) + '…')

  // Buyer: France fan, joins the same ledger.
  const join = new TerraceCore({ storageDir: joinDir, nation: 'FRA', bootstrap: hostInfo.bootstrap, swarmBootstrap: bootstrap })
  const joinInfo = await join.start()
  console.log('✓ joiner up · nation FRA')

  // 1) They discover + connect over the swarm.
  await waitFor(() => host.peers.size > 0 && join.peers.size > 0, 'peers connected')
  console.log('✓ peers connected over Hyperswarm (no server)')

  // 2) Protomux pairing authorizes the joiner as a co-writer.
  await waitFor(() => join.base.writable, 'joiner authorized as co-writer')
  console.log('✓ joiner authorized as co-writer via protomux pairing')

  // 3) Seller lists a Final ticket.
  const listing = await host.publishListing({
    match: 'Final · ARG vs FRA', section: 'North Stand', seat: 'N12-R7-S21', priceUsdt: 850
  })
  console.log('✓ seller published listing', listing.id.slice(0, 8))

  // 4) Buyer sees it replicate in and offers.
  await waitFor(async () => (await join.getListings()).some((l) => l.id === listing.id), 'listing replicated to buyer')
  const offer = await join.makeOffer(listing.id)
  console.log('✓ buyer made offer', offer.id.slice(0, 8))

  // 5) Seller sees the offer and co-signs -> trade.
  await waitFor(async () => !!(await host._readOffer(offer.id)), 'offer replicated to seller')
  const trade = await host.acceptOffer(offer.id)
  console.log('✓ seller co-signed -> trade', trade.id.slice(0, 8))

  // 6) Both converge on the co-signed trade.
  await waitFor(async () => {
    const t = (await join.getTrades()).find((x) => x.id === trade.id)
    return t && t.state === 'cosigned'
  }, 'trade co-signed on both peers')
  console.log('✓ co-signed trade replicated to both fans')

  // 7) Settlement leg (mock proof for v1) -> settled receipt on both sides.
  await join.settleTrade(trade.id)
  await waitFor(async () => {
    const r = await host.getReceipt(trade.id)
    return r && r.state === 'settled'
  }, 'settlement replicated to seller')

  const receipt = await host.getReceipt(trade.id)
  assert.strictEqual(receipt.state, 'settled')
  assert.strictEqual(receipt.priceUsdt, 850)
  assert.strictEqual(receipt.buyerNation, 'FRA')
  assert.strictEqual(receipt.sellerNation, 'ARG')
  assert.ok(receipt.hash && receipt.hash.length === 64, 'receipt has a verifiable hash')
  console.log('✓ verifiable receipt:', {
    match: receipt.match, seat: receipt.seat, usdt: receipt.priceUsdt,
    fans: receipt.sellerNation + ' -> ' + receipt.buyerNation,
    ledgerHeight: receipt.ledgerHeight, hash: receipt.hash.slice(0, 16) + '…'
  })

  console.log('\nALL SWARM TESTS PASSED ✅  (two fans traded a ticket P2P with no server)')

  await host.destroy()
  await join.destroy()
  await testnet.destroy()
  fs.rmSync(hostDir, { recursive: true, force: true })
  fs.rmSync(joinDir, { recursive: true, force: true })
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ SWARM TEST FAILED:', err)
  process.exit(1)
})
