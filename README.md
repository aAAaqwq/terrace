# OTC Terminal

**Serverless peer-to-peer USDt OTC / escrow desk, built on the Pears stack.**

No server. No custodian. No counterparty trust. Two peers connect directly, negotiate a trade, and co-sign it on a shared append-only ledger — with a verifiable receipt on both sides.

> Submission for the **Tether Developers Cup** — Pears track.

## Why

USDt commerce today routes through servers, exchanges, and custodians. OTC Terminal shows a different path: peer-to-peer USDt settlement coordinated over [Holepunch's Pears stack](https://docs.pears.com), where the "matching engine" is just two laptops and a co-signed [Autobase](https://docs.pears.com/building-blocks/autobase) ledger. Kill any relay — the trade still stands, because there is no relay.

## Stack

- **Hyperswarm / HyperDHT** — serverless peer discovery + connection
- **Autobase** — multiwriter, co-signed trade ledger (both parties write)
- **Hyperbee** — trade history / order index
- **Hyperdrive** — P2P contract-file transfer
- **Bare + Pear runtime** — one core, desktop UI

## Quick start

```bash
# Requires Node 20+ and the Pear runtime (npm i -g pear)
git clone <repo-url>
cd otc-terminal
npm install
pear run --dev .
```

Run it in two terminals (or two machines) to connect two peers and place a trade. See [docs/STRATEGY.md](docs/STRATEGY.md) for the demo flow.

## Status

Active development for the Tether Developers Cup (2026-07). See [docs/DECISIONS.md](docs/DECISIONS.md).

## License

MIT — see [LICENSE](LICENSE).
