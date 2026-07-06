// Terrace tokenized fan-pass + HTLC (hashlock) atomic delivery.
//
// This is the honest fix from docs/REVIEW.md + docs/DESIGN-escrow.md §2b:
// the demoed asset is a *Terrace-issued tokenized fan-pass*, delivered by a
// hashlock so the swap is genuinely atomic. The seller cannot record
// settlement (get "paid") without revealing a preimage S, and revealing S is
// exactly what lets the buyer decrypt the pass — one action does both.
//
// Primitives, all already in the stack:
//   • sodium-universal — generichash for the hashlock, secretbox for the pass
//     ciphertext (a symmetric key derived from S).
//   • Hypercore (the SECOND Holepunch primitive introduced here, alongside the
//     Autobase/Hyperbee ledger) — the encrypted pass payload is appended as a
//     block to a dedicated core, obtained from the SAME Corestore and therefore
//     replicated peer-to-peer over the SAME Hyperswarm connection (pairing.js
//     already calls store.replicate). Only H (the hashlock), the core key, the
//     block index and the secretbox nonce are ever published — never S.
//
// The payment leg stays a clearly-labelled mock/testnet USDt transfer. What is
// real and provable here is the ATOMICITY of the delivery: the ledger's apply()
// (src/core/ledger.js) refuses a hashlocked settlement whose preimage does not
// hash to H, and a settlement that IS accepted has, by construction, published
// the one secret that unlocks the pass.

import sodium from 'sodium-universal'
import b4a from 'b4a'

// Domain-separation contexts so the hashlock and the pass-encryption key are
// independent one-way derivations of the same secret S (learning H never
// leaks the decryption key, and vice-versa).
const HASHLOCK_CONTEXT = b4a.from('terrace:htlc:hashlock:1')
const PASSKEY_CONTEXT = b4a.from('terrace:htlc:passkey:1')

// The dedicated Hypercore that carries encrypted pass payloads. One per peer's
// Corestore; its public key is published on the listing so any invited peer can
// replicate and (once S is revealed) decrypt.
const PASS_CORE_NAME = 'terrace-pass-blobs'

// Normalize a caller-supplied secret (a transfer code / QR payload string, or
// raw bytes) into the canonical byte form every derivation agrees on.
function toBytes (secret) {
  if (b4a.isBuffer(secret)) return secret
  return b4a.from(String(secret))
}

// H = generichash(S, HASHLOCK_CONTEXT) — the public hashlock. Returned as hex
// because that is what travels on the JSON ledger.
export function passHashlock (secret) {
  const out = b4a.alloc(sodium.crypto_generichash_BYTES) // 32
  sodium.crypto_generichash(out, toBytes(secret), HASHLOCK_CONTEXT)
  return b4a.toString(out, 'hex')
}

// The 32-byte secretbox key that seals/opens the pass, derived from S.
export function passEncKey (secret) {
  const out = b4a.alloc(sodium.crypto_secretbox_KEYBYTES) // 32
  sodium.crypto_generichash(out, toBytes(secret), PASSKEY_CONTEXT)
  return out
}

// Constant-time check that a revealed preimage (hex S) hashes to a published
// hashlock (hex H). This is the exact predicate ledger.js apply() enforces
// before accepting a hashlocked settlement — a wrong/missing preimage ⇒ false.
export function verifyPreimage (preimageHex, hashlockHex) {
  if (!preimageHex || !hashlockHex) return false
  let secret
  let expected
  try {
    secret = b4a.from(preimageHex, 'hex')
    expected = b4a.from(hashlockHex, 'hex')
  } catch {
    return false
  }
  if (expected.length !== sodium.crypto_generichash_BYTES) return false
  const got = b4a.alloc(sodium.crypto_generichash_BYTES)
  sodium.crypto_generichash(got, secret, HASHLOCK_CONTEXT)
  return sodium.sodium_memcmp(got, expected)
}

// Wraps the pass-blob Hypercore over an existing Corestore. Seal on the seller
// side; open on the buyer side once the ledger has revealed S.
export class PassVault {
  constructor (store) {
    this.store = store
    this._core = null
  }

  async _passCore () {
    if (this._core) return this._core
    // A named core is deterministically keyed off THIS corestore, so it is the
    // seller's own core; the buyer opens it read-only by its published key.
    const core = this.store.get({ name: PASS_CORE_NAME })
    await core.ready()
    this._core = core
    return core
  }

  // Seal a pass payload behind secret S. Appends the ciphertext as a Hypercore
  // block and returns ONLY ledger-safe references (H, core key, block, nonce).
  // S itself never leaves the seller until settlement reveals it.
  async seal (secret, payload) {
    const core = await this._passCore()
    const key = passEncKey(secret)
    const nonce = b4a.alloc(sodium.crypto_secretbox_NONCEBYTES) // 24
    sodium.randombytes_buf(nonce)

    const plain = b4a.from(JSON.stringify(payload ?? null))
    const cipher = b4a.alloc(plain.length + sodium.crypto_secretbox_MACBYTES)
    sodium.crypto_secretbox_easy(cipher, plain, nonce, key)

    const block = core.length
    await core.append(cipher)

    return {
      hashlock: passHashlock(secret),
      coreKey: b4a.toString(core.key, 'hex'),
      block,
      nonce: b4a.toString(nonce, 'hex')
    }
  }

  // Open a sealed pass IFF the revealed preimage (hex S) matches H. Replicates
  // the ciphertext block from the seller's core (over the shared swarm stream)
  // and decrypts it. Throws if the preimage does not unlock the hashlock.
  async open (ref, preimageHex, { timeout = 15000 } = {}) {
    if (!ref || !ref.hashlock) throw new Error('pass reference missing hashlock')
    if (!verifyPreimage(preimageHex, ref.hashlock)) {
      throw new Error('preimage does not match hashlock — pass stays locked')
    }
    const key = passEncKey(b4a.from(preimageHex, 'hex'))

    const core = this.store.get({ key: b4a.from(ref.coreKey, 'hex') })
    await core.ready()
    const cipher = await core.get(ref.block, { wait: true, timeout })
    if (!cipher) throw new Error('pass ciphertext not replicated yet')

    const nonce = b4a.from(ref.nonce, 'hex')
    const plain = b4a.alloc(cipher.length - sodium.crypto_secretbox_MACBYTES)
    if (!sodium.crypto_secretbox_open_easy(plain, cipher, nonce, key)) {
      throw new Error('pass decryption failed')
    }
    return JSON.parse(b4a.toString(plain))
  }

  async close () {
    try { await this._core?.close() } catch { /* best-effort */ }
  }
}

// The preimage that settlement must reveal, as the hex string the ledger op
// carries. Kept here so the seller derives it identically to how the buyer
// (and apply()) will re-hash it.
export function preimageHexOf (secret) {
  return b4a.toString(toBytes(secret), 'hex')
}
