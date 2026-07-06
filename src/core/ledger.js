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
export function createLedger (store, bootstrap) {
  const boot = bootstrap ? (b4a.isBuffer(bootstrap) ? bootstrap : b4a.from(bootstrap, 'hex')) : null

  return new Autobase(store, boot, {
    valueEncoding: 'json',
    open (viewStore) {
      return new Hyperbee(viewStore.get('terrace-view'), {
        keyEncoding: 'utf-8',
        valueEncoding: 'json',
        extension: false
      })
    },
    async apply (nodes, view, host) {
      for (const node of nodes) {
        const op = node.value
        if (!op || typeof op !== 'object') continue

        // Membership op: authorize a co-writer (the counterparty).
        if (op.type === 'add-writer') {
          await host.addWriter(b4a.from(op.key, 'hex'), { indexer: true })
          continue
        }

        await applyDomainOp(view, op)
      }
    }
  })
}

async function applyDomainOp (view, op) {
  switch (op.type) {
    case 'listing':
      await view.put(KEY.listing(op.id), { ...op })
      break
    case 'offer':
      await view.put(KEY.offer(op.id), { ...op })
      break
    case 'trade': {
      // Trades are keyed by id; later states (cosigned -> settled) overwrite.
      await view.put(KEY.trade(op.id), { ...op })
      // Reflect settlement onto the underlying listing.
      const listing = await safeGet(view, KEY.listing(op.listingId))
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
