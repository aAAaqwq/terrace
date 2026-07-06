// Terrace CLI peer — run a REAL P2P fan-exchange peer from the terminal.
// Zero GUI, pure Node: the most dependable way for a judge to verify the
// live Hyperswarm + Autobase co-signed ledger.
//
//   Terminal 1 (seller, hosts the market):
//     node test/node-peer.js host --nation ARG
//     -> prints an INVITE code; share it with the other peer
//
//   Terminal 2 (buyer, joins the market):
//     node test/node-peer.js join <INVITE> --nation FRA
//
// Interactive commands (type into either terminal):
//   list                              show open listings
//   sell <match> | <seat> | <price> [ | <passSecret> ]
//                                     publish a ticket; a 4th field issues a
//                                     tokenized fan-pass (HTLC atomic delivery)
//   offer <listingId>                 make an offer on a listing
//   accept <offerId>                  co-sign an offer -> trade
//   trades                            show trades you're in
//   receipt <tradeId>                 print the verifiable receipt (settles it)
//   pass <tradeId>                    show the fan-pass: LOCKED before settle,
//                                     UNLOCKED (transfer code) after
//   forge <listingId>                 TRY to fake a co-sign you're not the seller of
//                                     (the ledger rejects it — the "forge & fail" proof)
//   me                                show your peer id / status
//   quit

import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import { TerraceCore } from '../src/core/terrace.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs (argv) {
  const mode = argv[0]
  let invite = null
  let nation = 'INT'
  const rest = argv.slice(1)
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--nation') { nation = rest[++i]; continue }
    if (/^[0-9a-f]{64}$/i.test(rest[i])) invite = rest[i]
  }
  return { mode, invite, nation }
}

function short (s, n = 8) { return s ? s.slice(0, n) : s }

async function main () {
  const { mode, invite, nation } = parseArgs(process.argv.slice(2))
  if (mode !== 'host' && mode !== 'join') {
    console.error('usage: node test/node-peer.js host|join [<invite>] --nation XXX')
    process.exit(1)
  }
  if (mode === 'join' && !invite) {
    console.error('join mode needs an <invite> code (the host printed one)')
    process.exit(1)
  }

  const storageDir = path.join(__dirname, '..', 'store', `cli-${mode}-${nation}-${process.pid}`)
  const core = new TerraceCore({ storageDir, nation, bootstrap: invite })

  core.on('status', ({ connected, peers, writable }) => {
    process.stdout.write(`\r[status] peers=${peers} connected=${connected} writable=${writable}          \n> `)
  })
  core.on('listing', (l) => {
    process.stdout.write(`\n[new listing] ${short(l.id)} · ${l.match} · seat ${l.seat} · ${l.priceUsdt} USDt · ${l.nation}\n> `)
  })
  core.on('trade', (t) => {
    process.stdout.write(`\n[trade ${t.state}] ${short(t.id)} · ${t.match} · ${t.priceUsdt} USDt · ${t.sellerNation}->${t.buyerNation}\n> `)
  })

  console.log(`\nTerrace CLI peer starting · mode=${mode} · nation=${nation} …`)
  const info = await core.start()
  console.log(`peer id: ${short(info.peerId, 12)}…`)
  if (core.isHost) {
    console.log('\n==================== MARKET INVITE ====================')
    console.log(info.bootstrap)
    console.log('  share this with the buyer:  node test/node-peer.js join ' + info.bootstrap + ' --nation FRA')
    console.log('======================================================\n')
  } else {
    console.log('joined market, waiting to be authorized as co-writer…')
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
  rl.prompt()

  rl.on('line', async (line) => {
    const raw = line.trim()
    if (!raw) { rl.prompt(); return }
    const [cmd, ...restParts] = raw.split(' ')
    const rest = restParts.join(' ')
    try {
      switch (cmd) {
        case 'list': {
          const rows = await core.getListings()
          if (!rows.length) console.log('(no listings yet)')
          for (const l of rows) console.log(`  ${short(l.id)} · ${l.match} · seat ${l.seat} · ${l.priceUsdt} USDt · ${l.nation} · ${l.status}`)
          break
        }
        case 'sell': {
          // sell <match> | <seat> | <price> [ | <passSecret> ]
          // A 4th field issues a tokenized fan-pass (HTLC): the pass ships
          // encrypted P2P and unlocks only when settlement reveals the secret.
          const [match, seat, price, passSecret] = rest.split('|').map((s) => s.trim())
          if (!match || !price) { console.log('usage: sell <match> | <seat> | <price> [ | <passSecret> ]'); break }
          const l = await core.publishListing({
            match, section: 'GA', seat: seat || 'GA', priceUsdt: Number(price),
            passSecret: passSecret || null
          })
          const passNote = l.hashlock ? ` · 🔒 tokenized pass · hashlock ${short(l.hashlock, 12)}…` : ''
          console.log(`listed ${short(l.id)} · ${l.match} · ${l.priceUsdt} USDt${passNote}`)
          break
        }
        case 'offer': {
          if (!rest) { console.log('usage: offer <listingId>'); break }
          const full = (await core.getListings()).find((l) => l.id.startsWith(rest))
          const o = await core.makeOffer(full ? full.id : rest)
          console.log(`offered on ${short(full ? full.id : rest)} · offer ${short(o.id)}`)
          break
        }
        case 'accept': {
          if (!rest) { console.log('usage: accept <offerId>'); break }
          const t = await core.acceptOffer(rest)
          console.log(`co-signed -> trade ${short(t.id)} (${t.sellerNation}->${t.buyerNation}, ${t.priceUsdt} USDt)`)
          break
        }
        case 'trades': {
          const rows = await core.getTrades()
          if (!rows.length) console.log('(no trades yet)')
          for (const t of rows) console.log(`  ${short(t.id)} · ${t.match} · ${t.priceUsdt} USDt · ${t.state}`)
          break
        }
        case 'receipt': {
          const full = (await core.getTrades()).find((t) => t.id.startsWith(rest))
          const r = await core.getReceipt(full ? full.id : rest)
          if (!r) { console.log('no such trade'); break }
          if (r.state !== 'settled') await core.settleTrade(full ? full.id : rest)
          const fr = await core.getReceipt(full ? full.id : rest)
          console.log('\n----------------- RECEIPT -----------------')
          console.log(`  ${fr.match}`)
          console.log(`  seat ${fr.seat} · ${fr.priceUsdt} USDt`)
          console.log(`  ${fr.sellerNation} -> ${fr.buyerNation}`)
          console.log(`  state: ${fr.state} · ledger height ${fr.ledgerHeight}`)
          console.log(`  hash: ${fr.hash}`)
          console.log('  No server. No scalper. Co-signed peer-to-peer.')
          console.log('-------------------------------------------\n')
          break
        }
        case 'pass': {
          // Show the tokenized fan-pass for a trade: LOCKED before settlement,
          // UNLOCKED (revealing the transfer code) after the atomic reveal.
          if (!rest) { console.log('usage: pass <tradeId>'); break }
          const full = (await core.getTrades()).find((t) => t.id.startsWith(rest))
          const id = full ? full.id : rest
          let p = await core.getPass(id)
          if (!p || !p.hasPass) { console.log('(this trade has no tokenized pass)'); break }
          if (p.locked) {
            console.log(`🔒 LOCKED · hashlock ${short(p.hashlock, 16)}… · encrypted, delivered P2P, awaiting settlement`)
            console.log('   (run: receipt ' + short(id) + '  — settling reveals the secret and unlocks it)')
          } else if (p.revealed) {
            console.log(`🔓 UNLOCKED · transferCode = ${p.pass.transferCode}`)
            console.log('   the seller could not be paid without revealing the secret that unlocked this pass')
          }
          break
        }
        case 'forge': {
          // Adversarial proof: append a co-signed trade for a listing you
          // don't own. The ledger's apply() checks the authoring writer key
          // and drops it — you cannot fake the seller's signature.
          if (!rest) { console.log('usage: forge <listingId>'); break }
          const full = (await core.getListings()).find((l) => l.id.startsWith(rest)) || { id: rest, sellerId: 'someone-else' }
          const forgedId = 'FORGE_' + short(full.id)
          console.log(`attempting to forge a co-signed trade on ${short(full.id)} as ${short(core.peerId)}… (you are NOT the seller)`)
          await core.base.append({
            type: 'trade', id: forgedId, listingId: full.id, buyerId: core.peerId, sellerId: full.sellerId,
            buyerNation: core.nation, sellerNation: '??', match: full.match || '?', seat: full.seat || '?',
            priceUsdt: 1, state: 'cosigned', cosignedBy: core.peerId, ts: Date.now()
          })
          await core.base.update()
          await new Promise((r) => setTimeout(r, 600))
          const landed = (await core.getTrades()).find((t) => t.id === forgedId)
          if (landed) console.log('⚠️  forgery LANDED — enforcement is broken!')
          else console.log('❌ forgery REJECTED by the ledger — you are not the seller-writer. The co-signature can\'t be faked.')
          break
        }
        case 'me':
          console.log(`peer ${short(core.peerId, 12)}… · nation ${core.nation} · host=${core.isHost} · writable=${core.base.writable} · peers=${core.peers.size}`)
          break
        case 'quit': case 'exit':
          await core.destroy(); rl.close(); process.exit(0); break
        default:
          console.log('commands: list | sell match|seat|price[|passSecret] | offer <id> | accept <id> | trades | receipt <id> | pass <id> | forge <id> | me | quit')
      }
    } catch (err) {
      console.log('error:', err.message)
    }
    rl.prompt()
  })
}

main().catch((err) => { console.error(err); process.exit(1) })
