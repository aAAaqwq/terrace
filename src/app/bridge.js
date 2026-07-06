// Bridge: provides the REAL window.TerraceCore (P2P engine) to the UI.
//
// Loaded before ui.js, so ui.js's `if (!window.TerraceCore)` mock guard is
// skipped and the interface drives the live Hyperswarm + Autobase core.
//
// Host / join is decided by the Pear deep-link argument:
//   pear run --dev .                 -> hosts a new market (prints an invite)
//   pear run --dev . <invite-hex>    -> joins that market
//
// The invite is the ledger's bootstrap key. Sharing it peer-to-peer (chat,
// QR, etc.) is the only "coordination" — there is no server.

import { TerraceCore } from '../core/terrace.js'

const pearGlobal = typeof Pear !== 'undefined' ? Pear : (globalThis.Pear || null)
const args = pearGlobal?.config?.args ?? []
const invite = args.find((a) => /^[0-9a-f]{64}$/i.test(a)) || null
const storageDir = pearGlobal?.config?.storage
  ? pearGlobal.config.storage + '/terrace'
  : './store/app-' + (invite ? 'join' : 'host')

let core = null
const pending = [] // listeners registered before start()

function ensureListeners () {
  for (const { event, cb } of pending) core.on(event, cb)
  pending.length = 0
}

const api = {
  async start ({ nation }) {
    core = new TerraceCore({ storageDir, nation, bootstrap: invite })
    ensureListeners()
    const info = await core.start()
    if (core.isHost) {
      // Surface the invite so the host can share it peer-to-peer.
      console.log('%c[Terrace] Market invite (share P2P):', 'font-weight:bold', info.bootstrap)
      api.invite = info.bootstrap
      window.__TERRACE_INVITE__ = info.bootstrap
    }
    return { peerId: info.peerId, nation: info.nation, bootstrap: info.bootstrap, writable: info.writable }
  },

  on (event, cb) {
    if (core) core.on(event, cb)
    else pending.push({ event, cb })
  },

  getListings: (...a) => core.getListings(...a),
  publishListing: (...a) => core.publishListing(...a),
  makeOffer: (...a) => core.makeOffer(...a),
  acceptOffer: (...a) => core.acceptOffer(...a),
  settleTrade: (...a) => core.settleTrade(...a),

  // The UI fetches a receipt after co-sign; auto-run the (mock) settlement
  // leg once so the receipt card shows a settled trade in the demo.
  async getReceipt (tradeId) {
    let r = await core.getReceipt(tradeId)
    if (r && r.state !== 'settled') {
      try { await core.settleTrade(tradeId); r = await core.getReceipt(tradeId) } catch { /* keep cosigned receipt */ }
    }
    return r
  }
}

window.TerraceCore = api
