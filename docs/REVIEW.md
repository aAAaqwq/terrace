# REVIEW — 5-dimension audit of Terrace (2026-07-06)

Five parallel expert reviews across the axes the Cup is judged on. Each verdict, the top findings, and what we did about them. Status legend: ✅ done · 🔜 planned · 💤 deferred.

---

## Scorecard

| Dimension | Verdict | Headline finding | Action |
|-----------|---------|------------------|--------|
| **Genuine Pears usage** (elimination filter) | **PASS** | Real Pears, not a wrapper; protomux-over-replication is the idiomatic pattern | ✅ deps declared, LICENSE fixed, `npm test` runs swarm proof |
| **Technical depth** | mid → **now strong** | "Co-signed" was NOT enforced in code — trust-all last-write-wins | ✅ author-enforced state machine in `apply()` + forgery test |
| **Creativity** | novel for the track | "No server" is commodity here; the un-copyable claim is *forgery-proof* | 🔜 "Forge it & fail" interactive proof as the signature moment |
| **UX** | strong core, one gap | No in-app invite flow; joiner can hang 20s silently | 🔜 in-app invite share/paste + writable-state UI |
| **Real-world** | architecture holds, use case cracks | Real FIFA tickets are non-transferable → hero trade is void at the gate | ✅ reframed to fan-value rail + honest transferability note |

---

## 1. Genuine Pears usage — PASS ✅ (the elimination filter)
All networking is genuinely Hyperswarm/HyperDHT + Corestore replication + protomux; no WebRTC, no websocket, no hidden server. Sharing one encrypted stream between Corestore replication and the `terrace/pairing/1` protomux channel is the correct Holepunch pattern. Autobase multi-writer + Hyperbee view are substantive.
- ✅ **Done:** declared `sodium-universal` (runtime crypto path) + `hyperdht` (dev) in package.json so a fresh clone can't `Cannot find module`; `npm test` now runs the real-transport swarm proof; LICENSE name fixed to Terrace.
- Note kept for judges: writer-authorization is host-only (market has a liveness dependency on the creator) — this is the Autobase model working as intended; belongs in the escrow/trust discussion.

## 2. Technical depth — was mid-pack, now strong ✅
**The critical finding:** the "co-signed ledger" the whole pitch rests on was *nominal* — `apply()` was a trust-all last-write-wins reducer; any authorized writer could append a `settled` trade with a forged `sellerId` and overwrite the real record.
- ✅ **Done (highest-leverage fix in the whole review):** `apply()` now reads `node.from.key` (the authoring writer) and enforces a real state machine — listing⇐seller, offer⇐buyer, `cosigned`⇐listing's seller only, `settled`⇐a party only; `add-writer`⇐host only. Forged ops are dropped. A new test proves a buyer-forged co-sign is rejected. Co-writers are now non-indexer (host = sole indexer) to avoid partition stall.
- 🔜 **Next best depth (P1):** a per-trade **Hyperdrive** carrying the encrypted ticket/transfer-code, unlocked to the buyer on cosign — introduces a 2nd Holepunch primitive and makes the demo show "the ticket physically moved P2P" (answers the plumbing-vs-outcome critique).
- 🔜 encrypt the Corestore off the invite (privacy flex); proof-of-possession nonce in the pairing handshake.
- 💤 dispute-as-third-writer (arbitrator path) — v2.

## 3. Creativity — novel, but spend the novelty on the right beat
Terrace is structurally novel for the Pears track (financial settlement is white space vs chat/game/whiteboard clones). But "no server to hack" is the single most commoditized claim here (PearPass/Keet/Pear Credit all say it).
- **The one thing that would make it stick:** the un-copyable claim is *forgery-proof* — the two-writer log means neither party can forge a receipt alone. Now that this is enforced in code (dimension 2), turn it into a live **"Forge it. Go ahead."** moment: let a judge edit a settled receipt's price/seat/hash and hit re-verify → visibly rejected.
- 🔜 **Planned:** tamper/re-verify affordance on the receipt hero; shareable re-verifiable receipt artifact; demote the "no server" reveal from climax to setup, land the climax on forge-and-fail.
- 🔜 near-free: name the nations loudly (Diego/ARG ↔ Camille/FRA); live P2P topology viz (P1).

## 4. UX — strong core, one demo-critical gap
- **Biggest demo risk (P0):** no in-app invite flow. Host/join is decided by a CLI hex arg; the invite is only in devtools console. A joiner can't join from inside the running GUI. On a ≤3-min video this happens off-screen in a terminal.
- 🔜 **Planned:** host renders a copyable invite (+QR); onboarding gets a "paste invite" field; surface `writable`/authorization state and disable publish/offer/accept until authorized (else a joiner who clicks early hits a 20s silent block).
- Note: the **CLI peer already surfaces the invite cleanly** and is the recommended, bulletproof demo path — the GUI gap does not block a submittable demo, but closing it makes the GUI video far stronger.
- 💤 a11y polish: tab roles/arrow-keys, faint-label contrast (~3.9:1 < AA), focus management.

## 5. Real-world viability — architecture holds, the specific use case cracks
**The gap the other docs missed:** real FIFA 2026 tickets are personalized, mobile-only, and **non-transferable outside FIFA's official resale** — a ticket sold peer-to-peer is voided at the gate. So "resell a Final ticket P2P" is contractually dead on arrival, independent of the authenticity oracle.
- ✅ **Done:** reframed the thesis to a **P2P fan-value settlement rail** (asset-agnostic: Autobase co-sign + escrow + USDt), with **transferable / self-issued fan-passes** as the demo asset and real ticket resale as an explicit **v2 vision contingent on issuer-credential integration**. Transferability is now named openly in DECISIONS/README rather than glossed.
- 🔜 **Strongest honest upgrade (P0 for semis):** make the *demoed* asset a Terrace-issued tokenized fan-pass so the **HTLC atomic swap becomes honest today** (money↔asset atomic, no arbitrator, no oracle) — this is the cleanest answer to "who holds the USDt / what stops a cheat".
- **Regulatory posture for a Tether audience:** emphasize self-custody + disintermediation; do **not** lean into "untraceable / no KYC / cross-border with no bank" — that delights a Bitcoiner but reads as AML risk to Tether engineers. Anti-scalping law (BOTS Act, 2026 host-country resale caps) targets exactly "no price cap, no middleman" — frame as fan-fair-value, not scalping.
- **Wedge ranking** (same architecture): 1) Terrace/partner-issued tokenized fan assets (oracle-clean, atomic-swap-honest) — hero; 2) watch-party / group-cost splitting (no asset ⇒ no oracle; Owe-No is a Pears precedent) — "and it generalizes" beat; 3) prediction pools — architecturally perfect, **regulatorily radioactive for Tether, do not demo**.

---

## Consolidated action plan (priority order)
1. ✅ Enforce co-signature in `apply()` + forgery test — **done** (turns the central claim into running code).
2. ✅ Dependency/LICENSE/test hygiene — **done** (bulletproofs the elimination filter).
3. ✅ Honest use-case reframe (fan-value rail; transferability named) — **done in docs**.
4. ✅ In-app invite flow + writable-state UI (UX P0) — **done** (host copyable invite panel, join paste field, auth gating; 31/31 Chromium assertions).
5. ✅ "Forge it & fail" interactive receipt proof (creativity P0) — **done** (tamper→reject in the GUI; also a CLI `forge` command; backed by the enforced ledger).
6. ✅ Encrypted ledger at rest + proof-of-possession pairing handshake — **done** (privacy flex + anti-spoof/replay; new tests green).
7. 🔜 Hyperdrive ticket-handoff (tech P1) + tokenized fan-pass so HTLC atomic swap is honest (real-world P0 for semis) — next wave.
8. 💤 dispute-as-third-writer, a11y polish — semifinal polish.

## Status after optimization wave (2026-07-06)
Every P0/P1 from this review except the semifinal-scoped Hyperdrive/tokenized-asset work is **shipped and tested**. `npm test` runs both suites green, now covering: author-enforced co-sign, forgery rejection, encrypted-at-rest, no-invite-can't-read, and proof-of-possession. The GUI has a real invite flow, authorization gating, and the forge-and-fail proof. This is a materially stronger submission than the v1 baseline that already passed the genuine-Pears elimination filter.
