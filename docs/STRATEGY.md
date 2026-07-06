# STRATEGY — OTC Terminal (Pears track)

North star: **Be the project that best embodies Tether's world — self-custody + privacy + USDt P2P payments + no server.** That is what wins the 5,000 Champion, because Holepunch/Pears is Tether's own creation.

## Winning thesis
1. **One track only.** Pears. No splitting focus.
2. **Real Pears depth.** Use Autobase (multiwriter co-signed ledger) + Hyperbee + Hyperdrive — not just Hyperswarm. Depth beats surface.
3. **Narrow & sharp use case.** One clean problem, one jaw-drop moment in the 3-min video.
4. **"There is no server" is the hook.** Make serverlessness *visible* (kill switch demo, topology view).

## Milestone plan (aligned to checkpoints)
### 7/6 (today) — Setup
- [x] Register on DoraHacks
- [x] Lock concept: OTC Terminal
- [ ] Pear CLI installed + `pear run --dev` smoke test (two peers connect)
- [ ] Public GitHub repo, MIT license, scaffold pushed

### 7/6 night – 7/8 AM — MVP for Top 16 cut (CRITICAL)
- [ ] Hyperswarm: two peers discover + connect on a shared topic
- [ ] Autobase: both peers co-write a shared ordered trade ledger
- [ ] One end-to-end flow: propose trade → counterparty accepts → both co-sign → receipt generated
- [ ] Minimal but clean UI
- [ ] README with dead-simple setup steps a judge can run
- [ ] Record 3-min unlisted YouTube demo
- [ ] **Submit 7/8**

### 7/9 – 7/12 — Semifinal (16 → 4)
- [ ] Deepen Pears usage: Hyperbee trade history, Hyperdrive contract-file transfer, reconnect-on-drop
- [ ] USDt settlement leg on testnet (Plasma / USDT0 / Lightning — research first)
- [ ] Serverless visualization (live P2P topology / connection map)
- [ ] Polish UI + narrative
- [ ] **Submit 7/12**

### 7/13 – 7/14 — Final sprint
- [ ] Stability, edge cases, one-command setup
- [ ] Re-record champion-grade demo video
- [ ] Prep live pitch script for 7/15–18

## Risk register
| Risk | Mitigation |
|------|------------|
| Real USDt settlement too hard in 2 days | MVP = mock/testnet receipt; real testnet only after Top 16 |
| Pear CLI / Bare runtime install friction | Smoke test TODAY before building |
| Someone else builds P2P payments too | Differentiate on Autobase co-signed ledger + escrow UX + serverless demo |
| Autobase learning curve | Start from official example, adapt incrementally |
| 3-min video too shallow | Script the "no server" reveal as the climax |

## Demo video script (draft — 3 min)
1. (0:00) Hook: "This is a USDt OTC desk. No server. No custodian. Watch." 
2. (0:20) Peer A proposes: sell 1,000 USDt for X. Peer B (other laptop) accepts.
3. (1:00) Both co-sign on the Autobase ledger → verifiable receipt appears on both.
4. (1:40) Settlement leg (testnet USDt) fires; receipt updates.
5. (2:10) The reveal: show `netstat`/topology — no central server; kill any relay, trade still stands.
6. (2:40) Close: "USDt commerce, peer-to-peer, trust-minimized. Built on Pears."
