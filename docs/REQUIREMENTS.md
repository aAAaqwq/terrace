# REQUIREMENTS — Tether Developers Cup (rules & submission checklist)

> Verified from the DoraHacks hackathon page + press coverage on 2026-07-06. The detail page is a SPA (blocks direct fetch), so re-confirm the exact wording at https://dorahacks.io/hackathon/tether-developers-cup/detail before final submission.

## What we're entering
- **Event**: Tether Developers Cup
- **Our track**: **Pears** (P2P)
- **Prize pool**: 8,000 USDt — 3× 1,000 (track winners) + 5,000 (Cup Champion, best overall)

## Hard rules (the elimination filters)
1. **Pears-track technical rule**: ALL networking MUST use the **Pears Stack** (Hyperswarm + building blocks: Hypercore/Hyperbee/Hyperdrive/Autobase/HyperDHT/Corestore). **Plain WebRTC does NOT count.**
2. **"Build something real"**: a Tether logo slapped on an unrelated app does not count. Genuine, substantive use of the stack.
3. **Open source**: public GitHub repo with **MIT or Apache-2.0** license. Keep it public during the event and for a while after.
4. **Runnable by judges**: clear setup steps so a judge can clone + run it easily. (Judges also watch public commit history to see the project grow — commit early and often.)
5. **Demo video**: **≤ 3 minutes**, uploaded to YouTube as **Unlisted**, link included in the submission. Required from the FIRST submission (7/8).

## Timeline (GMT-7)
| Date | Milestone | Cut |
|------|-----------|-----|
| 7/6 | Registration locks | — |
| **7/8** | First submission (repo + demo video) | → **Top 16** |
| 7/12 | Semifinals | 16 → **4** |
| 7/14 23:59 | Final deadline | — |
| 7/15–18 | Finalists pitch live to Tether team | — |
| 7/19 | Winners announced | — |

## Judging signals (what scores)
From prior Pears hackathon (criteria: *creativity, usability, effective P2P integration*) and Tether's product messaging:
1. **Self-custody / no custodian**
2. **"No servers to hack" / zero infrastructure**
3. **Privacy as a first-class outcome** (WhereFam won 1st on this alone)
4. **Real, substantive P2P depth** — not a thin transport wrapper (core Pears engineers judge)
5. **USDt relevance / on-thesis P2P value transfer** (Pear Credit is the precedent Tether wants extended)
6. **Usability + a runnable, legible demo**; finalists must pitch live

Known judges from the prior Pears hackathon panel: **David Mark Clements** (Holepunch/Pears core), **Guy Swann** (Bitcoin educator). Expect deep technical scrutiny of the escrow/trust model.

## Submission checklist (tick before each cut)
- [ ] Public GitHub repo, MIT license present
- [ ] README with copy-paste setup steps that actually run
- [ ] App genuinely uses Hyperswarm + Autobase (verifiable in code)
- [ ] No plain-WebRTC networking
- [ ] ≤3-min unlisted YouTube demo, link in submission
- [ ] Commit history shows real progress (not one big dump)
- [ ] Project submitted on DoraHacks BUIDL before the cut time
- [ ] One-sentence pitch nailed: *"USDt commerce with no server, no custodian — two peers and a co-signed ledger."*

## The one thing that can sink us
**The escrow trust model.** Bitcoin judges will ask: *"Who holds the USDt, and how is a dishonest counterparty stopped?"* We must either (a) implement a credible non-custodial escrow (multisig / threshold / co-sign + on-chain settlement), or (b) explicitly scope it and show the co-sign/dispute flow convincingly. This is decided in [docs/DESIGN-escrow.md](DESIGN-escrow.md).
