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
//   sell <match> | <seat> | <price>   publish a ticket (USDt price)
//   offer <listingId>                 make an offer on a listing
//   accept <offerId>                  co-sign an offer -> trade
//   trades                            show trades you're in
//   receipt <tradeId>                 print the verifiable receipt
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
          const [match, seat, price] = rest.split('|').map((s) => s.trim())
          if (!match || !price) { console.log('usage: sell <match> | <seat> | <price>'); break }
          const l = await core.publishListing({ match, section: 'GA', seat: seat || 'GA', priceUsdt: Number(price) })
          console.log(`listed ${short(l.id)} · ${l.match} · ${l.priceUsdt} USDt`)
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
        case 'me':
          console.log(`peer ${short(core.peerId, 12)}… · nation ${core.nation} · host=${core.isHost} · writable=${core.base.writable} · peers=${core.peers.size}`)
          break
        case 'quit': case 'exit':
          await core.destroy(); rl.close(); process.exit(0); break
        default:
          console.log('commands: list | sell a|b|c | offer <id> | accept <id> | trades | receipt <id> | me | quit')
      }
    } catch (err) {
      console.log('error:', err.message)
    }
    rl.prompt()
  })
}

main().catch((err) => { console.error(err); process.exit(1) })
