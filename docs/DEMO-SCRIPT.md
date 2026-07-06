# Terrace — Demo Video Script & Live-Demo Runbook
**Tether Developers Cup · Pears Track**

This doc drives two deliverables:
1. The **≤3:00 unlisted YouTube demo video** (required with the 7/8 first submission, and re-cut for later cuts).
2. The **live pitch** for finalists (7/15–18), a compressed 90-second variant plus recovery script.

Judges to expect: David Mark Clements (Holepunch/Pears core) and Guy Swann (Bitcoin educator, will probe the trust model). Keep every on-camera claim inside what's actually built — see the "honest labeling" callouts throughout.

---

## 1. The 3-Minute Video Script (0:00–3:00)

Structure: hook → human setup → live P2P connect ("no server") → list → offer → co-sign on the Autobase ledger → receipt hero → kill-the-relay reveal → close. Open on a working shot — never a title card.

| Time | On-Screen Action | Narration (word-for-word) | On-Screen Text / Callout |
|---|---|---|---|
| **0:00–0:12** | Cold open, tight on the receipt card's "Verified" stamp animating in on one laptop; hard cut to the other laptop where a "new listing" toast slides in. (Both clips are pulled from the *same* live take — edited together in post, not staged separately.) | *"Two strangers. Two laptops. No company in between. This is a World Cup ticket changing hands, peer to peer, for USDt."* | `TERRACE — no server, no scalper` |
| **0:12–0:27** | Pull back to both full windows side by side. Left = onboarding screen → click the Argentina flag card → click **"Enter the swarm →"**. Right = onboarding screen → click the France flag card → click **"Enter the swarm →"**. | *"Meet our two fans. One backs Argentina. One backs France. Each picks a nation — that's their identity on the exchange."* | `🇦🇷 Seller` · `🇫🇷 Buyer` |
| **0:27–0:50** | Both windows land on the Marketplace tab. Status pill flips from "Connecting to swarm…" to **"Connected · 1 fan online"**; toast fires on the Argentina window: *"🇫🇷 France fan joined the terrace · peer connected · direct"*. Quick insert: a terminal running `ps aux \| grep -i node` — exactly two processes, no backend row. | *"They just found each other over Hyperswarm — a public peer-discovery network. Look at that process list: two peers, zero servers. Nobody is running Terrace's backend, because there isn't one."* | `Hyperswarm DHT · direct connection` / `processes: 2 peers · 0 servers` |
| **0:50–1:10** | Argentina window → **"＋ List a ticket"** tab. Fixture "ARG vs BRA", section "North Stand", seat "Row 14, Seat 7", price **850**. Click **"Publish to the swarm →"**. Toast: *"📡 Live on the swarm · ARG vs BRA · 850 USD₮ · peers can offer now"*. | *"The seller lists a Final ticket — Row 14, Seat 7 — for 850 USDt. Publishing doesn't hit a database. It broadcasts straight into the swarm."* | `ARG vs BRA · Final (demo fixture) · 850 USD₮` |
| **1:10–1:30** | Cut to France window — the same listing card appears live in the marketplace grid, un-refreshed. Click **"Make offer →"**. Toast: *"🤝 Offer signed on ARG vs BRA · 850 USD₮ · awaiting seller co-sign"*. | *"The buyer sees the same listing arrive — live, from a peer, not a page refresh — and signs an offer at 850 USDt."* | `offer signed · awaiting seller co-sign` |
| **1:30–1:50** | Cut to Argentina window — incoming trade card reads **"Accept & co-sign →"**; click it. Both windows toast: *"✍️ Trade co-signed on the ledger · 850 USD₮ · both sides signed"*. | *"The seller accepts. Both signatures land on a shared Autobase ledger — a multi-writer log neither peer can rewrite alone. That's what makes this a trade, not just a chat message."* | `Autobase co-signed ledger — both signatures recorded` |
| **1:50–2:15** | Trades & receipts tab. The receipt hero card fills the frame: "Verified" stamp, `ARG vs BRA`, faceoff `FRA (buyer)` vs `ARG (seller)`, `850 USD₮`, seat `Row 14, Seat 7`, ledger height `#____`, Autobase hash, tagline. | *"And here's the proof both of them keep — a ticket-stub receipt: nation versus nation, seat, the USDt amount, and the exact ledger height and hash it was recorded at. Either peer can show this to anyone, and it can't be forged. The USDt settlement leg itself is mocked in this build — the listing, the offer, the co-sign, and this ledger are all real."* | `Ledger height #____ · hash 0x____…` / `settlement leg: mocked in v1` |
| **2:15–2:45** | Cut to a terminal/Activity Monitor: circle the two peer processes again — no third "server" row. Optionally quit one Pear window entirely; the other peer's receipt and trade history stay intact and readable locally. | *"Kill this window. Kill that one. There's still nothing to take down, because there never was a server. The receipt already lives on both machines — co-signed, not hosted."* | `NO SERVER — this pair, this trade, no third machine` |
| **2:45–3:00** | Wide shot of both windows; wordmark overlay. | *"Terrace: a serverless fan-to-fan ticket exchange, settled in USDt, built on Holepunch's Pears — Hyperswarm and Autobase. This is what peer-to-peer commerce with Tether looks like."* | `TERRACE · Pears · USD₮ · Tether Developers Cup` |

**Notes**
- The publish form's fixture dropdown literally shows `ARG vs BRA` (no "Final" text baked into the app) — the "Final" framing is a post-production callout only, not a UI claim. Keep the on-screen label honest to what's rendered; let narration carry the flavor.
- The 0:00 cold-open clips are re-used footage from later in the same take (the stamp animation from ~1:55, the toast from ~0:35) — edit them in after recording the full run once, don't try to fake them live.
- "Settlement leg: mocked in v1" must appear on screen at least once (recommended at 1:30–1:50 or 1:50–2:15). Do not remove this callout to save time — it's the one honesty gate this script cannot skip.

---

## 2. Two Recording Setups

### Setup A — Polished GUI (two Pear windows, side by side)
- Two `pear run --dev .` windows: one hosting (Argentina), one joining via invite (France).
- Screen-record both windows simultaneously (OBS/QuickTime, split-screen or picture-in-picture), 1180×760 native app size — don't stretch.
- Best for: the hook, the receipt hero shot, the emotional beats (toasts, nation picking).

### Setup B — Bulletproof CLI fallback (two terminals)
- Two terminal panes running `node test/node-peer.js`. Judges (especially the Pears-technical ones) *like* seeing raw terminal P2P — it reads as less "staged" than a polished GUI.
- Exact commands:

  **Terminal 1 (host / seller, Argentina):**
  ```
  node test/node-peer.js host --nation ARG
  ```
  Prints:
  ```
  Terrace CLI peer starting · mode=host · nation=ARG …
  peer id: <peerId>…

  ==================== MARKET INVITE ====================
  <64-char hex invite>
    share this with the buyer:  node test/node-peer.js join <invite> --nation FRA
  ======================================================
  ```

  **Terminal 2 (join / buyer, France):**
  ```
  node test/node-peer.js join <INVITE> --nation FRA
  ```
  Then, once connected, both terminals print live status:
  ```
  [status] peers=1 connected=true writable=true
  ```

  **Terminal 1 — list the ticket:**
  ```
  sell ARG vs BRA · Final | Row 14, Seat 7 | 850
  ```
  → `listed <id> · ARG vs BRA · Final · 850 USDt`

  **Terminal 2 — see it and offer:**
  ```
  list
  offer <listingId>
  ```
  → `offered on <id> · offer <offerId>`

  **Terminal 1 — accept and co-sign:**
  ```
  trades
  accept <offerId>
  ```
  → `co-signed -> trade <id> (ARG->FRA, 850 USDt)`

  **Either terminal — pull the receipt:**
  ```
  receipt <tradeId>
  ```
  → prints:
  ```
  ----------------- RECEIPT -----------------
    ARG vs BRA · Final
    seat Row 14, Seat 7 · 850 USDt
    ARG -> FRA
    state: settled · ledger height <N>
    hash: <hash>
    No server. No scalper. Co-signed peer-to-peer.
  -------------------------------------------
  ```

**Recommendation:** Lead with Setup A (GUI) for the emotional/visual beats — nation picking, toasts, the receipt hero card. Cut to Setup B (CLI) specifically for the 2:15–2:45 "there is no server" proof beat: raw terminal text reading `peers=1 connected=true` next to a `ps aux` output is more convincing to a technical judge than a styled status pill. The CLI's own receipt tagline — *"No server. No scalper. Co-signed peer-to-peer."* — is identical wording to the GUI's receipt card, so the cut feels intentional, not improvised.

---

## 3. Exact Operator Runbook

### Pre-flight (T-minus 15 minutes)
1. **Pre-warm Pear.** Run `pear run --dev .` once and let it fully boot (the first-ever boot does a one-time ~60s "heal"). Quit it, then relaunch — the second boot should be fast. Do this on *both* machines/windows before recording. Never record a cold first boot.
2. **Seed one throwaway listing.** Off-camera, publish a low-stakes listing (e.g., a group-stage seat) from one peer so the marketplace already looks alive with peer-originated content, distinct from the marquee `ARG vs BRA · 850 USDt` listing you'll publish live on camera.
3. **Pre-copy the invite.** Get the host's invite hex into your clipboard (or a sticky note visible off-frame) so pasting into the join command/window is instant — don't type a 64-char hex string on camera.
4. **CLI terminals ready.** Two terminal windows/tabs open, correct size and font, scrollback cleared, `cd` already into the project root, history cleared of prior invite strings.
5. **Silence everything else.** Do Not Disturb on, close Slack/email/other app notifications, quit anything that could pop a banner over the recording.
6. **Dry-run the whole flow once, start to finish**, off-camera, immediately before the real take — confirms invite pairing, publish, offer, accept, and receipt all still work end to end.

### GUI take — click-by-click
1. Start recording both windows.
2. Window A (host): onboarding screen → click 🇦🇷 Argentina card → click **Enter the swarm →**.
3. Window B (join): onboarding screen → click 🇫🇷 France card → click **Enter the swarm →**.
4. Wait for status pill on both to read **Connected · 1 fan online** (should be seconds if pre-warmed).
5. Insert the `ps aux | grep -i node` terminal shot (can be a picture-in-picture overlay, doesn't need to be live-typed).
6. Window A → **＋ List a ticket** tab → select fixture `ARG vs BRA`, section `North Stand`, seat `Row 14, Seat 7`, price `850` → click **Publish to the swarm →**.
7. Window B → Marketplace tab → new listing card visible → click **Make offer →** on it.
8. Window A → trade toast appears → switch to **Trades & receipts** tab (or click the toast) → click **Accept & co-sign →**.
9. Wait for the "Trade co-signed on the ledger" toast on both windows (~1.5–2s in the mock/live core).
10. Either window → Trades & receipts tab → the receipt hero card is now on top → hold the shot for at least 5 seconds so the "Verified" stamp, ledger height, and hash are all legible on a re-watch/pause.
11. Cut to the CLI or process-list proof beat (see below).
12. Wide shot, close.

### CLI take — command-by-command
Run the exact commands listed in Section 2 Setup B, in order, on the two pre-opened terminals. Type at a deliberate, readable pace — judges will pause the video on this section.

### Proving serverlessness on camera
- **Primary (always do this):** `ps aux | grep -i node` (or Activity Monitor filtered to "node") showing exactly the app/peer processes — no `server.js`, no `api`, no listening HTTP backend. This is verifiably true of the codebase: there is no server file anywhere in `src/`.
- **Optional, higher-risk — turning off Wi-Fi mid-trade:** only do this if you've rehearsed it and confirmed the behavior beforehand. Hyperswarm's DHT needs network connectivity for peer discovery, so killing a machine's network will pause that peer's sync, not "prove" anything extra beyond what the process-list shot already proves. If you use it, frame it precisely: *"If we killed our server, every trade on Terrace would stop. There's no server to kill — only this pair's own connection, which resumes when the network comes back."* Do not claim untested reconnect/resync behavior. If rehearsal shows it's flaky, cut it and rely on the process-list proof alone — a broken "gotcha" moment reads worse than not attempting it.

---

## 4. Live-Pitch Demo Variant (90 seconds, for 7/15–18)

### What to have pre-loaded before you're called up
- Both windows already onboarded and connected (skip nation-picking and the "Connecting to swarm…" wait entirely — do it in the green room, not live).
- The publish form pre-filled with `ARG vs BRA` / `North Stand` / `Row 14, Seat 7` / `850` — one click to submit.
- A **second, already-connected pair of windows** open in a background tab/space as an instant fallback if the live pair drops.
- CLI terminals standing by, host already running with the invite already generated and already pasted into the join command (not yet submitted) — one Enter key from a working connection.

### Compressed script (90s)
| Time | Beat | Action |
|---|---|---|
| 0:00–0:10 | Hook | Say the one-sentence pitch live: *"USDt commerce with no server, no custodian — two peers and a co-signed ledger."* Gesture at the two already-open, already-connected windows. |
| 0:10–0:25 | Publish | Click submit on the pre-filled listing form. Toast fires. |
| 0:25–0:45 | Offer + co-sign | Switch to the buyer window, click **Make offer →**; switch to seller, click **Accept & co-sign →**. |
| 0:45–1:05 | Receipt | Land on the receipt hero card, point out ledger height + hash live. State out loud: *"the settlement leg is mocked here — everything else, the listing, the offer, the co-sign, the ledger, is real."* |
| 1:05–1:20 | No-server proof | Flash the pre-opened terminal with `ps aux` already run (don't type live under time pressure) — point at it. |
| 1:20–1:30 | Close | *"Built on Pears — Hyperswarm and Autobase — settled in USDt. That's Terrace."* |

### Failure recovery
- **If the live peer connection doesn't establish within ~5 seconds of any step**, don't wait it out on stage — immediately alt-tab / switch scene to the pre-warmed, already-connected fallback pair and continue narrating from there without acknowledging the swap unless directly asked.
- **If the GUI hangs or crashes**, pivot straight to the CLI terminals (Section 2 Setup B) — narrate the same beats via `list` / `offer` / `accept` / `receipt` commands. The CLI path is the more reliable of the two; treat it as the safety net, not a downgrade.
- **If asked live "what happens if a peer just disappears mid-trade?"** — answer honestly from the escrow design doc's framing: today, Terrace makes cheating provable via the tamper-evident co-signed ledger; true non-custodial 2-of-3 escrow (Tether WDK on Sepolia) is the explicit next milestone, not yet shipped. Do not claim escrow is live if it isn't.

---

## 5. Do's and Don'ts (winning judge trust)

**Do**
- Open the video on a real, running shot — not a title card or a slide.
- Say "Hyperswarm," "Autobase," and "Pears" out loud at least once each — name the SDK, don't gesture around it.
- Show a brief flash of real commit history or the repo's file tree at some point (even a 2-second insert) — judges explicitly watch for genuine incremental progress, not a single dump.
- Label the settlement leg as mocked, every time it's shown, in the video and live.
- Keep the video at or under 3:00 — pad nothing, cut ruthlessly if you're over.
- Match every ad-lib or live-pitch claim to what's actually in the GUI/CLI on screen at that moment.

**Don't**
- Don't say or imply "trustless" or "escrowed" for anything beyond what's built — the current build has no on-chain 2-of-3 escrow; don't let excitement on stage claim one.
- Don't fake the settlement leg as a real USDt transfer — it's a labeled mock, say so.
- Don't use "Learn more," "click here," or any generic CTA as on-screen text — every callout should name what's actually happening (ledger height, hash, peer count).
- Don't hide the "no server" proof behind a quick cutaway — hold it long enough to read.
- Don't attempt the Wi-Fi-toggle reveal live/on-camera unless it's been rehearsed and confirmed — a visibly broken "gotcha" costs more credibility than the process-list proof gains.
- Don't let the video run past 3:00 — that's an elimination-tier rule, not a suggestion.
