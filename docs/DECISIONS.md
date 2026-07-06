# DECISIONS — Tether Developers Cup

> Single source of truth for locked decisions. Append-only; never rewrite history — add a dated update below.

## Event facts (verified 2026-07-06)
- **Hackathon**: Tether Developers Cup — https://dorahacks.io/hackathon/tether-developers-cup
- **Prize pool**: 8,000 USDt total
  - Track winner (each of 3 tracks): **1,000 USDt**
  - **Cup Champion** (best overall): **5,000 USDt**
- **Tracks**: Pears (P2P), QVAC (on-device AI), WDK (self-custody wallet)
- **Timeline**
  - 7/6 — registration locks
  - 7/8 — first submission → judges cut to **Top 16**
  - 7/12 — semifinals, 16 → 4
  - 7/14 23:59 GMT-7 — final deadline
  - 7/15–18 — 4 finalists pitch live to Tether
  - 7/19 — winners announced
- **Submission requirements**: public GitHub repo (MIT/Apache-2.0), clear setup steps, ≤3-min unlisted YouTube demo video

## Locked decisions
| # | Decision | Value | Date |
|---|----------|-------|------|
| 1 | Track | **Pears (P2P)** — coldest track, highest odds | 2026-07-06 |
| 2 | Intensity | Full-time (8h+/day), aiming for Champion | 2026-07-06 |
| 3 | Registration | **DONE** — registered on DoraHacks | 2026-07-06 |
| 4 | Concept | **OTC Terminal** — serverless P2P USDt escrow/OTC desk | 2026-07-06 |
| 5 | Runtime env | Node v24.13.0 (Pears needs 20+ ✓), macOS | 2026-07-06 |

## Concept: OTC Terminal
Serverless peer-to-peer USDt over-the-counter trading / escrow desk.

- **Two peers connect directly** via Hyperswarm (no server, no matching backend).
- **Trade terms co-signed** on an **Autobase** (both parties write to a shared, ordered ledger → proves multiwriter mastery, not just WebRTC).
- **USDt settlement leg**: MVP = mock/testnet receipt; later = testnet USDt (Plasma/USDT0 or Lightning).
- **Killer demo moment**: two laptops complete an escrowed trade with a verifiable receipt, then reveal there is *no server anywhere*.

### Why this wins
- Hits Tether's own north star: **self-custody + privacy + USDt P2P payments + no server**.
- Holepunch/Pears was built by Tether/Bitfinex; flagship apps are Keet, PearPass, Pear Credit (USDt P2P credit) — OTC Terminal is squarely in that lineage.
- One-sentence pitch judges remember: *"USDt commerce with no server, no custodian, no counterparty trust — just two peers and a co-signed ledger."*

## UPDATE 2026-07-06 — CONCEPT EVOLVED (mandatory theme discovered)
**Verified**: the Cup requires *"Projects must fit a **football and global tournament theme**"* (2026 FIFA World Cup tie-in; teams represent a nation). A generic OTC desk is non-compliant. Also confirmed: Pears demos read as "infra plumbing" to judges — to contend for Champion we need a concrete, emotionally-legible outcome, not a networking demo.

**Concept re-themed (tech spine 100% preserved):**
> **Terrace** — serverless peer-to-peer World Cup **fan ticket & fan-asset exchange**, settled in USDt.
> Fans of different nations resell/swap match tickets (and collectibles/travel) directly, escrowed on an Autobase co-signed ledger. No server, no scalper platform, no platform fee.

- Runtime confirmed: Pear v2.6.5 / bare 1.24.3 installed. `pear init` is REMOVED; `pear run` is deprecated-but-works. Modern path = build with `hyperswarm`/`autobase`/`hyperbee` npm modules (Node-testable) + `pear-runtime` for the desktop shell.
- Locked decision #4 amended: concept is **Terrace** (fan ticket/asset exchange), not generic OTC.

## Open items
- [ ] Frontend stack — going plain HTML/JS (Pear desktop, no build step) unless changed
- [x] Pear CLI install + runtime smoke test — DONE (v2.6.5)
- [ ] Escrow/trust model + USDt testnet settlement path → docs/DESIGN-escrow.md
- [ ] v1: two fan-peers connect (Hyperswarm) + co-sign ticket trade (Autobase) + receipt + football UI
- [ ] 3-min demo video
