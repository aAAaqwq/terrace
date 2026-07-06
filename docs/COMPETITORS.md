# COMPETITORS — Tether Developers Cup landscape

> Compiled 2026-07-06 from 3 parallel research passes. DoraHacks BUIDL pages are SPAs (block automated fetch), so live 2026 submissions aren't visible until 7/8 — scout them manually in-browser at https://dorahacks.io/hackathon/tether-developers-cup/buidl from 7/8 onward. Everything below is inferred from prior Tether/Pears hackathons + the ecosystem.

## Field size & mechanics
- **~114 hackers registered** (as of 7/6). Solo or teams up to 4, 18+. Likely **~40–90 real submissions** at the 7/8 cut (typical 40–60% of registrants submit).
- **Top 16** survive 7/8 → **4** finalists on 7/12 → live pitch to Tether 7/15–18 → winners 7/19.
- Judging: **panel of Tether engineers + community experts, score 1–5.** No named judges published. Prior Pears panel included **David Mark Clements** (Holepunch core) and **Guy Swann** (Bitcoin educator) — expect deep technical scrutiny.
- **Mandatory theme: football / global tournament (2026 World Cup).** Most competitors will underweight theme fit — it's a scoring lever.

## Champion difficulty ranking (hardest track to beat for the 5,000 USDt)
| Rank | Track | Champion threat | Why |
|------|-------|-----------------|-----|
| 1 (hardest) | **WDK** | Highest | Most entrants, most mature SDK, prior submissions were production-flavored (deployed agents, live dashboards, real testnet txns), and it's Tether's core payments narrative. Champion most likely comes from here. |
| 2 | **QVAC** | Medium–High wildcard | Fewer/less-mature entries + real on-device demo risk, but highest novelty ceiling + Tether's flagship-AI halo. One breakout demo could steal it. |
| 3 (easiest) | **Pears (ours)** | Lowest for track win, hardest to yield champion | Smallest field, steepest learning curve → best odds at the 1,000 track prize. But raw P2P demos read as "plumbing" at a live pitch. **Our counter: Terrace wraps P2P in a visible fan outcome + USDt value flow.** |

## Track A — Pears (OUR track)
**Prior Global Pears Hackathon winners** (criteria: creativity, usability, effective P2P integration):
- 🥇 **WhereFam** — private P2P location sharing. Won on a pure *privacy/sovereignty narrative*, not tech depth.
- 🥈 **Peer-to-Peer Chess** — real-time, server-eliminated multiplayer.
- 🥉 **Hypersketch** — real-time collaborative whiteboard.
- Finalists: P2P Investigations (censorship-resistant journalism), Ekya (decentralized docs), Owe-No (private P2P expense splitting), PearGame.

**Flagship quality bar** (what judges compare against): **Keet** (P2P calling/messaging), **PearPass** (P2P password manager — "no servers to hack"), **Pear Credit** (Tether+Holepunch+Synonym P2P credit — *the direct precedent for P2P value transfer on Pears*).

**Crowded vs underserved:**
- ❌ Crowded: chat/messaging, file-share/drive/clipboard, real-time games, collab whiteboard/docs, location sharing.
- ✅ **Underserved (our white space): payments / value transfer / settlement / marketplace / escrow.** Essentially absent from the Pears app catalog. Autobase used for anything financial = a differentiated technical flex.

**Differentiation for Terrace:** Within Pears, almost nobody builds P2P financial settlement → instant contrast vs chat/game clones. Adjacent precedents judges know (**Bisq, RoboSats, HodlHodl** multisig escrow) mean **Guy Swann will benchmark our escrow trust model** — that's our #1 scrutiny point. Extends Pear Credit's thesis into a tangible product = flattering to Tether's roadmap.

**What Pears judges reward:** (1) self-custody/no custodian, (2) "no servers to hack"/zero infra, (3) privacy as an outcome, (4) *real* Pears depth not a transport wrapper, (5) USDt-relevant P2P value transfer, (6) usability + runnable demo.

## Track B — QVAC (on-device AI) — not ours, but champion competition
- SDK: on-device AI (llama.cpp fork "Fabric", whisper.cpp, Bergamot translation, P2P model distribution). Young (v0.12.x). Demo risk: models must run on the *judge's* hardware.
- Prior **QVAC Alpha (~46 projects)** winners: 🥇 QVAC Home Assistant, 🥈 Assist (on-device vision for visually impaired), 🥉 QMesh (distributed P2P inference).
- Quality bar: MEDIUM, high-variance; high novelty ceiling; Tether's marketing darling.

## Track C — WDK (self-custodial wallets) — not ours, biggest champion threat
- SDK: self-custodial multi-chain wallet kit (BTC, Lightning via Lightspark, USD₮, XAU₮; EVM + TON/Solana). Built for humans *and* AI agents ("Agent Skills"). Mature docs.
- Prior **Galactica WDK Edition 1 (~206 → 86 projects, $30k)**. Representative high-polish entries: **Atlas** (self-custodial autonomous bounty-hunter agent, deployed on Railway, Sepolia testnet, live dashboard), **TipStream** (autonomous creator tipping). Meta: "AI agent that autonomously earns and spends money."
- Quality bar: **HIGH** — most entrants, most polish, tightest fit with Tether's stablecoin/payments mission.

## Community edge
- Tether/Holepunch devs (our likely judges) gather in a **QVAC "Keet Room"** inside the Keet app — install Keet, join the room.
- Docs: docs.pears.com, docs.qvac.tether.io, docs.wdk.tether.io. GitHub: github.com/holepunchto, github.com/tetherto.
- No dedicated Discord/Telegram/office-hours found for this Cup — updates flow via the DoraHacks page + Keet room + @Tether_dev on X. Verify in-browser.

## Actionable takeaways for Terrace
1. **Theme hard**: two peers = fans of two nations swapping World Cup tickets. Name the nations in the demo.
2. **Win the escrow-trust argument on camera** — show the co-sign/dispute flow; have a credible non-custodial settlement story (see DESIGN-escrow.md). This is where Bitcoin judges attack.
3. **Real Pears depth**: Autobase co-signed ledger is the proof; make it central and visible.
4. **Visible outcome, not plumbing**: the demo must show a *fan getting a ticket + USDt moving*, not a connection log.
5. **Commit early & often in public**; ship a one-command runnable README.
6. **Scout the Top 16 on 7/8** to adjust for semis.
