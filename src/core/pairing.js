// Writer-key exchange over a Hyperswarm connection.
//
// Corestore replication and our pairing handshake share ONE encrypted
// stream via Protomux: corestore opens its own channels, we open a
// `terrace/pairing/1` channel to swap Autobase writer keys. The host
// (ledger creator) authorizes any counterparty it hears from by
// appending an `add-writer` op to the shared log.

import Protomux from 'protomux'
import c from 'compact-encoding'
import b4a from 'b4a'

const PROTOCOL = 'terrace/pairing/1'

// Attach replication + pairing to a fresh connection.
// onRemoteWriterKey(hexKey) fires once we learn the peer's writer key.
export function attachPairing (conn, store, localWriterKey, onRemoteWriterKey) {
  // Replicate the corestore over this connection (reuses the stream's muxer).
  store.replicate(conn)

  const mux = Protomux.from(conn)
  const channel = mux.createChannel({ protocol: PROTOCOL })
  if (!channel) return // already open on this mux

  const message = channel.addMessage({
    encoding: c.json,
    onmessage (m) {
      if (m && m.writerKey) onRemoteWriterKey(m.writerKey)
    }
  })

  channel.open()

  const hex = b4a.isBuffer(localWriterKey) ? b4a.toString(localWriterKey, 'hex') : localWriterKey
  message.send({ writerKey: hex })
}
