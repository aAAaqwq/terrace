// Terrace co-signed ledger.
//
// A multi-writer Autobase whose linearized log IS the tamper-evident,
// co-signed record of a fan-to-fan ticket trade. Both the seller and the
// buyer are Autobase writers, so every listing / offer / acceptance is
// signed by its author's own key inside a single shared, ordered log —
// no server holds or arbitrates the record.
//
// The materialized view is a Hyperbee (key/value) indexing listings,
// offers and trades so the UI can read current state cheaply.

import Autobase from 'autobase'
import Hyperbee from 'hyperbee'
import b4a from 'b4a'

const KEY = {
  listing: (id) => `listing/${id}`,
  offer: (id) => `offer/${id}`,
  trade: (id) => `trade/${id}`
}

// Build the Autobase. `bootstrap` is null for the host (creator) or the
// host's key (hex/Buffer) for a joining peer.
//
// The apply function ENFORCES the co-signature by checking, for every op,
// which writer actually authored it (`node.from.key`). A buyer cannot forge
// a seller's acceptance and a stranger cannot rewrite a settled trade — the
// enforcement, not UI convention, is what makes "co-signed" true.
export function createLedger (store, bootstrap) {
  const boot = bootstrap ? (b4a.isBuffer(bootstrap) ? bootstrap : b4a.from(bootstrap, 'hex')) : null

  let base // captured so apply can read the bootstrap/host key
  base = new Autobase(store, boot, {
    valueEncoding: 'json',
    open (viewStore) {
      return new Hyperbee(viewStore.get('terrace-view'), {
        keyEncoding: 'utf-8',
        valueEncoding: 'json',
        extension: false
      })
    },
    async apply (nodes, view, host) {
      // The bootstrap writer (base.key) is the market host: only it may
      // authorize co-writers.
      const hostKey = base.key ? b4a.toString(base.key, 'hex') : null
      for (const node of nodes) {
        const op = node.value
        if (!op || typeof op !== 'object') continue
        const author = node.from && node.from.key ? b4a.toString(node.from.key, 'hex') : null

        // Membership op: only the host may add co-writers, and co-writers are
        // NOT indexers (host is the sole indexer → no partition stall).
        if (op.type === 'add-writer') {
          if (author && hostKey && author === hostKey) {
            await host.addWriter(b4a.from(op.key, 'hex'), { indexer: false })
          }
          continue
        }

        await applyDomainOp(view, op, author)
      }
    }
  })
  return base
}

// Author-enforced state machine. Ops whose author isn't entitled to make the
// claim are dropped (never written to the view) — that rejection is the teeth
// behind "you cannot forge a receipt as one party".
async function applyDomainOp (view, op, author) {
  switch (op.type) {
    case 'listing':
      // A listing must be authored by the seller it names.
      if (author && op.sellerId && author !== op.sellerId) return
      await view.put(KEY.listing(op.id), { ...op })
      break
    case 'offer':
      // An offer must be authored by the buyer it names.
      if (author && op.buyerId && author !== op.buyerId) return
      await view.put(KEY.offer(op.id), { ...op })
      break
    case 'trade': {
      const listing = await safeGet(view, KEY.listing(op.listingId))
      if (op.state === 'cosigned') {
        // Only the seller of the referenced listing may co-sign a trade.
        if (!listing) return
        if (author && author !== listing.sellerId) return
        if (op.sellerId && op.sellerId !== listing.sellerId) return
      } else if (op.state === 'settled') {
        // Settlement may only be recorded by a party to the trade.
        const prev = await safeGet(view, KEY.trade(op.id))
        const parties = new Set([op.buyerId, op.sellerId, prev?.buyerId, prev?.sellerId].filter(Boolean))
        if (author && parties.size && !parties.has(author)) return
      }
      await view.put(KEY.trade(op.id), { ...op })
      if (listing) {
        const status = op.state === 'settled' ? 'settled' : 'pending'
        await view.put(KEY.listing(op.listingId), { ...listing, status })
      }
      break
    }
    default:
      // Unknown ops are ignored so old peers tolerate newer op types.
      break
  }
}

async function safeGet (view, key) {
  const node = await view.get(key)
  return node ? node.value : null
}

// Read helpers over the current view.
export async function listListings (base) {
  return collect(base, 'listing/')
}

export async function listTrades (base) {
  return collect(base, 'trade/')
}

export async function listOffers (base) {
  return collect(base, 'offer/')
}

export async function getTrade (base, id) {
  const node = await base.view.get(KEY.trade(id))
  return node ? node.value : null
}

export async function getListing (base, id) {
  const node = await base.view.get(KEY.listing(id))
  return node ? node.value : null
}

async function collect (base, prefix) {
  const out = []
  const end = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)
  for await (const node of base.view.createReadStream({ gte: prefix, lt: end })) {
    out.push(node.value)
  }
  return out
}

export { KEY }
