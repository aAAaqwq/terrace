// Terrace — end-to-end demo scenario over a REAL Hyperswarm transport.
//
// Two real TerraceCore peers (a 🇦🇷 seller and a 🇫🇷 buyer) meet on a local
// DHT testnet (hermetic + offline), pair as co-writers, and drive the full
// tokenized-fan-pass HTLC narrative: list → replicate → offer → co-sign →
// (adversarial forge + wrong-preimage, both REJECTED) → settle → unlock.
//
// It is three things at once:
//   1) proof the integrated system works end-to-end,
//   2) a rehearsal reference for the demo video (a story a viewer follows),
//   3) a regression scenario (asserts + clean exit 0).
//
// It uses only the real public TerraceCore API and the same waitFor-polling
// style as test/swarm.test.js. No src/ files are touched.
//
// Run: node test/scenario.js   (or: npm run scenario)

import createTestnet from 'hyperdht/testnet.js'
import fs from 'fs'
import os from 'os'
import path from 'path'
import assert from 'assert'

import { TerraceCore } from '../src/core/terrace.js'
import { passHashlock, preimageHexOf } from '../src/core/asset.js'

// --- the story's fixed props (deterministic where it matters) --------------
const MATCH = 'Final · ARG vs FRA'
const SECTION = 'North Stand'
const SEAT = 'N12-R7-S21'
const PRICE_USDT = 850
const PASS_SECRET = 'FIFA26-FINAL-QR-7K4D9'

// --- tiny narration helpers ------------------------------------------------
function tmpDir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `terrace-scenario-${label}-`))
}

function sleep (ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// A short, labelled beat between scenes so a viewer can follow the story.
async function beat (label) {
  console.log(`\n\x1b[2m— ${label} —\x1b[0m`)
  await sleep(700)
}

function ok (msg) {
  console.log('  \x1b[32m✓\x1b[0m ' + msg)
}

function note (msg) {
  console.log('  \x1b[2m' + msg + '\x1b[0m')
}

function rule () {
  console.log('\x1b[2m' + '─'.repeat(64) + '\x1b[0m')
}

// Same polling shape as swarm.test.js: poll until the predicate holds.
async function waitFor (predicate, label, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await sleep(200)
  }
  throw new Error('timed out waiting for: ' + label)
}

async function main () {
  console.log('')
  rule()
  console.log('  \x1b[1mTERRACE\x1b[0m — two fans, one ticket, no server')
  console.log('  \x1b[2mA World Cup Final ticket changes hands, peer-to-peer.\x1b[0m')
  rule()

  // --- hermetic transport: a private 3-node DHT testnet -------------------
  const testnet = await createTestnet(3)
  const swarmBootstrap = testnet.bootstrap
  const hostDir = tmpDir('host')
  const joinDir = tmpDir('join')

  // ========================================================================
  await beat('Scene 1 · Two fans of different nations come online')
  // ========================================================================
  // Seller: Argentina fan. Hosts the co-signed ledger (no central server).
  const seller = new TerraceCore({ storageDir: hostDir, nation: 'ARG', swarmBootstrap })
  const sellerInfo = await seller.start()
  ok(`🇦🇷 seller online · ledger ${sellerInfo.bootstrap.slice(0, 12)}…`)

  // Buyer: France fan. Joins the SAME ledger using the seller's invite key.
  const buyer = new TerraceCore({
    storageDir: joinDir, nation: 'FRA', bootstrap: sellerInfo.bootstrap, swarmBootstrap
  })
  await buyer.start()
  ok('🇫🇷 buyer online · holds the seller\'s invite, nothing else')

  // They find each other on the Hyperswarm DHT — no rendezvous server.
  await waitFor(() => seller.peers.size > 0 && buyer.peers.size > 0, 'peers connected')
  ok('the two fans connected directly over Hyperswarm')
  note('no server, peer-to-peer — the connection is fan ↔ fan')

  // ========================================================================
  await beat('Scene 2 · The buyer is authorized to co-write the ledger')
  // ========================================================================
  // The PoP (proof-of-possession) protomux handshake proves the joiner owns
  // its writer key; only then does the host add it as a co-writer.
  await waitFor(() => buyer.base.writable, 'buyer authorized as co-writer')
  ok('buyer authorized as co-writer via the PoP pairing handshake')
  note('both fans can now sign into one shared, ordered, co-signed log')

  // ========================================================================
  await beat('Scene 3 · The seller lists the ticket as a tokenized fan-pass')
  // ========================================================================
  // The listing carries a hashlock H = hashlock(S). The secret S (the real
  // QR transfer code) NEVER touches the ledger — only H and the encrypted
  // pass reference travel.
  const listing = await seller.publishListing({
    match: MATCH, section: SECTION, seat: SEAT, priceUsdt: PRICE_USDT, passSecret: PASS_SECRET
  })
  const H = passHashlock(PASS_SECRET)
  ok(`seller published listing ${listing.id.slice(0, 8)} · ${PRICE_USDT} USDt · seat ${SEAT}`)
  ok('the ticket is a tokenized fan-pass sealed behind a hashlock')
  note(`hashlock  H = ${H}`)
  assert.strictEqual(listing.hashlock, H, 'listing carries the published hashlock H')
  assert.ok(listing.pass && listing.pass.coreKey, 'listing carries an encrypted-pass reference')
  assert.ok(!('transferCode' in listing), 'the secret transfer code is NOT on the listing')
  note('S (the redeemable QR code) stays with the seller — off the ledger')

  // ========================================================================
  await beat('Scene 4 · The listing replicates to the buyer — but stays SEALED')
  // ========================================================================
  await waitFor(async () => (await buyer.getListings()).some((l) => l.id === listing.id),
    'listing replicated to buyer')
  ok('listing replicated peer-to-peer into the buyer\'s view')

  // The buyer offers on the listing, the seller co-signs it into a trade.
  const offer = await buyer.makeOffer(listing.id)
  ok(`buyer made an offer ${offer.id.slice(0, 8)}`)
  await waitFor(async () => !!(await seller._readOffer(offer.id)), 'offer replicated to seller')

  // ========================================================================
  await beat('Scene 5 · The seller co-signs → a trade enters the shared log')
  // ========================================================================
  const trade = await seller.acceptOffer(offer.id)
  await waitFor(async () => {
    const t = (await buyer.getTrades()).find((x) => x.id === trade.id)
    return t && t.state === 'cosigned'
  }, 'trade co-signed on both peers')
  ok(`co-signed trade ${trade.id.slice(0, 10)} replicated to both fans`)

  // The ciphertext may already have replicated over the same swarm, yet the
  // buyer's pass is LOCKED — no revealed secret means no plaintext.
  const lockedView = await buyer.getPass(trade.id)
  assert.strictEqual(lockedView.hasPass, true, 'buyer sees a pass exists')
  assert.strictEqual(lockedView.locked, true, 'pass is LOCKED pre-settlement')
  assert.strictEqual(lockedView.revealed, false, 'nothing revealed yet')
  assert.strictEqual(lockedView.pass, null, 'no plaintext pass before reveal')
  ok('buyer\'s pass shows: locked=true · transferCode=(none)')
  note('the ticket is here, encrypted, but sealed — you can hold it, not read it')

  // ========================================================================
  await beat('Scene 6 · ADVERSARIAL — the buyer tries to cheat. The ledger says no.')
  // ========================================================================
  // (6a) Forge a co-signature: the buyer appends a co-signed trade for a
  // listing they do NOT own (like the CLI `forge` command / ledger.test.js).
  // apply() checks the authoring writer key and drops it.
  const forgedId = 'FORGE_' + trade.id.slice(0, 8)
  note('buyer forges a co-signed trade it is NOT the seller of…')
  await buyer.base.append({
    type: 'trade', id: forgedId, listingId: listing.id, buyerId: buyer.peerId,
    sellerId: listing.sellerId, buyerNation: 'FRA', sellerNation: '??',
    match: MATCH, seat: SEAT, priceUsdt: 1, state: 'cosigned',
    cosignedBy: buyer.peerId, ts: Date.now()
  })
  await buyer.base.update()
  // Give the forgery every chance to (wrongly) appear, then prove it never did.
  await sleep(2500)
  const forgedOnSeller = (await seller.getTrades()).find((t) => t.id === forgedId)
  const forgedOnBuyer = (await buyer.getTrades()).find((t) => t.id === forgedId)
  assert.strictEqual(forgedOnSeller, undefined, 'forged co-sign never lands on the seller')
  assert.strictEqual(forgedOnBuyer, undefined, 'forged co-sign never lands on the buyer')
  ok('forged co-sign REJECTED — the buyer is not the seller-writer, the signature can\'t be faked')

  // (6b) Forge a settlement with a WRONG preimage on the REAL trade. apply()
  // recomputes hashlock(S') and, since it ≠ H, drops the op — the trade stays
  // cosigned. The seller cannot be faked into "paid".
  note('buyer forges a settlement carrying a WRONG secret…')
  await buyer.base.append({
    type: 'trade', ...stripId(trade), id: trade.id, state: 'settled',
    settlement: { kind: 'mock', paid: true }, preimage: preimageHexOf('NOT-THE-REAL-SECRET'),
    ts: Date.now()
  })
  await buyer.base.update()
  await sleep(2500)
  const stillCosigned = (await seller.getTrades()).find((t) => t.id === trade.id)
  assert.ok(stillCosigned && stillCosigned.state === 'cosigned',
    'wrong-preimage settlement is dropped — trade stays cosigned')
  assert.ok(!stillCosigned.revealed, 'no secret was revealed by the rejected settlement')
  ok('wrong-preimage settlement REJECTED — hashlock(S\') ≠ H, the ledger drops it')

  // And the seller-side guard refuses to even build a settlement with a bad secret.
  let badSettleThrew = false
  try {
    await seller.settleTrade(trade.id, null, { passSecret: 'WRONG-SECRET' })
  } catch { badSettleThrew = true }
  assert.strictEqual(badSettleThrew, true, 'settleTrade with a wrong secret is refused')
  ok('a settle attempt with the wrong secret is refused before it ever hits the log')

  // ========================================================================
  await beat('Scene 7 · Settlement — paying reveals S, and S unlocks the pass')
  // ========================================================================
  // The seller settles: a clearly-labelled MOCK payment leg, accompanied by
  // the on-ledger reveal of the true secret S. One action does both.
  const settled = await seller.settleTrade(trade.id)
  assert.strictEqual(settled.settlement.paid, true, 'mock payment leg marked paid')
  assert.ok(settled.preimage, 'settlement reveals the preimage S on the ledger')
  ok('seller settled (mock USDt) — and thereby revealed S on the shared ledger')

  // The buyer decrypts the P2P-replicated pass now that S is on the ledger.
  await waitFor(async () => {
    const v = await buyer.getPass(trade.id)
    return v && v.locked === false && v.pass
  }, 'buyer unlocks the pass post-settlement')
  const unlocked = await buyer.getPass(trade.id)
  assert.strictEqual(unlocked.revealed, true, 'pass is revealed after settlement')
  assert.strictEqual(unlocked.locked, false, 'pass is unlocked after reveal')
  assert.strictEqual(unlocked.pass.transferCode, PASS_SECRET, 'buyer decrypts the exact fan-pass code')
  ok('buyer\'s pass shows: revealed=true · locked=false')
  console.log(`  \x1b[32m✓\x1b[0m decrypted transferCode = \x1b[1m${unlocked.pass.transferCode}\x1b[0m`)
  note('the sealed ticket just opened — for the buyer, and only now')

  // The verifiable receipt anchors the whole story.
  const receipt = await seller.getReceipt(trade.id)
  assert.strictEqual(receipt.state, 'settled')
  assert.strictEqual(receipt.passUnlocked, true, 'receipt records the pass as unlocked')
  console.log('')
  console.log('  \x1b[1mVerifiable receipt\x1b[0m')
  console.log(`    match         ${receipt.match}`)
  console.log(`    seat          ${receipt.seat} · ${receipt.priceUsdt} USDt`)
  console.log(`    fans          ${receipt.sellerNation} → ${receipt.buyerNation}`)
  console.log(`    hashlock      ${receipt.hashlock}`)
  console.log(`    revealed      ${receipt.revealed}`)
  console.log(`    passUnlocked  ${receipt.passUnlocked}`)
  console.log(`    ledgerHeight  ${receipt.ledgerHeight}`)
  console.log(`    hash          ${receipt.hash}`)

  // ========================================================================
  await beat('Curtain')
  // ========================================================================
  rule()
  console.log('  \x1b[1mAtomic:\x1b[0m the seller could not be paid without revealing the')
  console.log('  secret that unlocked the buyer\'s pass. No server. No custodian.')
  rule()
  console.log('')

  // --- teardown: destroy peers + testnet, remove temp storage -------------
  await seller.destroy()
  await buyer.destroy()
  await testnet.destroy()
  fs.rmSync(hostDir, { recursive: true, force: true })
  fs.rmSync(joinDir, { recursive: true, force: true })
  process.exit(0)
}

// The returned trade is already stripped of `type`; drop `id` too so we can
// re-set the fields we want on the forged settlement without duplication.
function stripId (trade) {
  const { id, ...rest } = trade
  return rest
}

main().catch((err) => {
  console.error('\n\x1b[31m❌ SCENARIO FAILED:\x1b[0m', err)
  process.exit(1)
})
