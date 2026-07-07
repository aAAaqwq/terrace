# Terrace 🎟️⚽

**Serverless peer-to-peer World Cup fan ticket & asset exchange, settled in USDt. Built on the Pears stack.**

Two fans of different nations connect directly — no server, no scalper platform, no custodian — negotiate a ticket trade, and **co-sign it on a shared append-only ledger**, producing a verifiable receipt on both sides. Kill any relay: the trade still stands, because there is no relay.

> Submission for the **Tether Developers Cup** — Pears track. Theme: football / 2026 World Cup.

## Why

Fan-to-fan value — a spare ticket, a fan-pass, a shared travel package — routes through scalpers, servers, and platforms that take a cut, leak data, and let fraud through. Between two strangers from different countries there's no neutral, trustworthy rail. Terrace is that rail: peer-to-peer USDt settlement coordinated over [Holepunch's Pears stack](https://docs.pears.com), where the "matching engine" is just two laptops and a co-signed [Autobase](https://docs.pears.com/building-blocks/autobase) ledger — and the co-signature is **enforced in code**, so neither party can forge a trade the other didn't independently sign.

**On the asset (honest scope).** Terrace is a general P2P fan-value settlement rail; the flagship asset is match tickets, but real FIFA tournament tickets are personalized and non-transferable outside official resale, so the demo settles **transferable / self-issued fan-passes**. Anchoring to an issuer-provided ticket credential is the v2 path that makes real ticket resale valid — see [docs/DESIGN-escrow.md](docs/DESIGN-escrow.md) and [docs/REVIEW.md](docs/REVIEW.md).

## How it works

- **Hyperswarm / HyperDHT** — serverless peer discovery + connection over the DHT.
- **Protomux pairing** — the two peers swap Autobase writer keys over the same encrypted stream that carries replication.
- **Multi-writer Autobase** — buyer *and* seller are cryptographic writers on one shared, ordered log. The linearized log **is** the co-signature: every listing, offer, and acceptance is signed by its author. A **Hyperbee** view indexes listings/offers/trades for the UI.
- **Verifiable receipt** — each settled trade yields a content hash + ledger height, shown as a ticket-stub receipt (nation vs nation, seat, USDt amount).
- **Atomic fan-pass delivery (HTLC)** — a seller can issue a Terrace-tokenized fan-pass: the pass is secretbox-encrypted and delivered peer-to-peer over a dedicated **Hypercore** blob, published to the ledger only as a hashlock `H = generichash(S)`. The ledger accepts settlement **only if it reveals a preimage `S` that hashes to `H`**, and that same `S` is the only key that decrypts the pass — so the seller *cannot get paid without simultaneously handing the buyer the pass*. Delivery-vs-reveal atomicity is real and tested; the USDt payment leg is a labeled mock. Wrong/missing preimages are rejected. See [test/asset.test.js](test/asset.test.js).
- **Settlement leg** — v1 records a clearly-labeled mock/testnet proof; for externally-issued tickets (which can't be tokenized) v2 is a **2-of-3 non-custodial escrow on Ethereum Sepolia via Tether's WDK** with real test USDt (never Terrace custody). See [docs/DESIGN-escrow.md](docs/DESIGN-escrow.md).

## Quick start

Requires **Node 20+**. Install once:

```bash
npm install
```

### Run it the reliable way — two CLI peers (no GUI)

```bash
# Terminal 1 — seller (Argentina), hosts the market:
node test/node-peer.js host --nation ARG
#   -> prints a MARKET INVITE (a hex code). Copy it.

# Terminal 2 — buyer (France), joins with the invite:
node test/node-peer.js join <INVITE> --nation FRA
```

Then, in the two terminals:

```text
# seller:
sell Final · ARG vs FRA | N12-R7-S21 | 850     # publish a ticket for 850 USDt
list                                            # (buyer sees it appear)
# buyer:
list
offer <listingId>                              # make an offer
# seller:
accept <offerId>                               # co-sign -> trade
# either:
trades
receipt <tradeId>                              # print the verifiable receipt
```

### Run the desktop app (Pear runtime)

```bash
npm i -g pear                    # first time only; then run `pear` once to bootstrap
pear run --dev .                 # window 1: hosts a market, logs an invite to the console
pear run --dev . <invite-hex>    # window 2: joins that market
```

> First `pear run` does a one-time ~60s runtime heal; subsequent launches are fast.

## Verify it actually works

```bash
npm test                   # runs all three suites below
node test/ledger.test.js   # offline proof: co-signed ledger, forgery rejected, encryption, PoP
node test/swarm.test.js    # full two-peer trade over a real Hyperswarm (local DHT testnet)
node test/asset.test.js    # HTLC atomic fan-pass: wrong preimage rejected, atomic unlock
npm run scenario           # narrated end-to-end demo run over a real swarm
```

Each prints a green `ALL … TESTS PASSED ✅`.

## Docs

- [docs/PITCH.md](docs/PITCH.md) — the story & pitch
- [docs/SUBMISSION.md](docs/SUBMISSION.md) — paste-ready DoraHacks BUIDL copy + 90s pitch + checklist
- [docs/HOW-TO-DEMO.md](docs/HOW-TO-DEMO.md) — operator/judge runbook: how to run, demo & verify it live
- [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) — 3-min video script + demo runbook
- [docs/DESIGN-escrow.md](docs/DESIGN-escrow.md) — escrow trust model + USDt settlement
- [docs/REVIEW.md](docs/REVIEW.md) — 5-dimension audit + action plan
- [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/STRATEGY.md](docs/STRATEGY.md) · [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) · [docs/COMPETITORS.md](docs/COMPETITORS.md)

## License

MIT — see [LICENSE](LICENSE).
