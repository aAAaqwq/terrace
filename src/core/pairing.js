// Writer-key exchange + proof-of-possession over a Hyperswarm connection.
//
// Corestore replication and our pairing handshake share ONE encrypted
// stream via Protomux: corestore opens its own channels, we open a
// `terrace/pairing/1` channel to swap Autobase writer keys. The host
// (ledger creator) authorizes a counterparty by appending an `add-writer`
// op to the shared log.
//
// SECURITY: authorization is NOT blind. A peer's Autobase writer key is the
// hash of a single-signer manifest, so the key alone proves nothing. Before
// `onRemoteWriterKey` fires we run a nonce challenge:
//
//   1. hello     — each peer announces { writerKey, signerPublicKey }
//   2. challenge — on hearing a hello, a peer sends a fresh random nonce
//   3. proof     — the peer signs OUR nonce with its writer signing key
//
// We authorize only when (a) the signature over our nonce verifies against
// the announced signer key AND (b) that signer key is the sole manifest
// signer that hashes to the announced writer key. That binds "controls the
// private key" to "is the writer key it's asking to be added as" — a peer
// cannot get someone else's key authorized, or replay a stale proof.

import Protomux from 'protomux'
import c from 'compact-encoding'
import Hypercore from 'hypercore'
import sodium from 'sodium-universal'
import b4a from 'b4a'

const PROTOCOL = 'terrace/pairing/1'
const NONCE_BYTES = 32

// Attach replication + PoP pairing to a fresh connection.
//
// identity: {
//   writerKey: Buffer,   // base.local.key — the Autobase writer key
//   signer:    { publicKey: Buffer, secretKey: Buffer }, // base.local.keyPair
//   manifestVersion: number // store.manifestVersion, for the binding check
// }
// onRemoteWriterKey(hexKey) fires ONLY after the peer proves possession.
export function attachPairing (conn, store, identity, onRemoteWriterKey) {
  // Replicate the corestore over this connection (reuses the stream's muxer).
  store.replicate(conn)

  const mux = Protomux.from(conn)
  const channel = mux.createChannel({ protocol: PROTOCOL })
  if (!channel) return // already open on this mux

  const localWriterKeyHex = b4a.toString(identity.writerKey, 'hex')
  const localSignerHex = b4a.toString(identity.signer.publicKey, 'hex')

  let issuedNonce = null // the nonce WE challenged the remote with
  let remote = null // the remote's announced { writerKey, signerPublicKey }
  let authorized = false

  const hello = channel.addMessage({
    encoding: c.json,
    onmessage (m) {
      if (!m || !m.writerKey || !m.signerPublicKey || remote) return
      remote = m
      // Challenge the remote to prove it controls the writer key it claims.
      issuedNonce = b4a.alloc(NONCE_BYTES)
      sodium.randombytes_buf(issuedNonce)
      challenge.send({ nonce: b4a.toString(issuedNonce, 'hex') })
    }
  })

  const challenge = channel.addMessage({
    encoding: c.json,
    onmessage (m) {
      if (!m || !m.nonce) return
      const nonce = b4a.from(m.nonce, 'hex')
      if (nonce.length !== NONCE_BYTES) return
      const sig = b4a.alloc(sodium.crypto_sign_BYTES)
      sodium.crypto_sign_detached(sig, nonce, identity.signer.secretKey)
      proof.send({ signature: b4a.toString(sig, 'hex') })
    }
  })

  const proof = channel.addMessage({
    encoding: c.json,
    onmessage (m) {
      if (authorized || !m || !m.signature || !remote || !issuedNonce) return
      if (!verifyProof(b4a.from(m.signature, 'hex'), issuedNonce, remote, identity.manifestVersion)) return
      authorized = true
      onRemoteWriterKey(remote.writerKey) // already a hex string over the wire
    }
  })

  channel.open()
  hello.send({ writerKey: localWriterKeyHex, signerPublicKey: localSignerHex })
}

// (1) signature over our nonce is valid for the announced signer key, and
// (2) that signer key is the sole manifest signer hashing to the writer key.
// Exported so the proof-of-possession logic can be unit-tested directly.
export function verifyProof (signature, nonce, remote, manifestVersion) {
  if (signature.length !== sodium.crypto_sign_BYTES) return false
  let signerPub
  let writerKey
  try {
    signerPub = b4a.from(remote.signerPublicKey, 'hex')
    writerKey = b4a.from(remote.writerKey, 'hex')
  } catch {
    return false
  }
  if (signerPub.length !== sodium.crypto_sign_PUBLICKEYBYTES) return false
  if (!sodium.crypto_sign_verify_detached(signature, nonce, signerPub)) return false
  const bound = Hypercore.key({ version: manifestVersion, signers: [{ publicKey: signerPub }] })
  return b4a.equals(bound, writerKey)
}
