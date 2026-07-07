# Terrace — Demo Video Script & Live-Demo Runbook
**Tether Developers Cup · Pears Track**

Terrace is a **serverless P2P fan-value exchange** on Holepunch's Pears stack: Hyperswarm discovery,
a protomux **proof-of-possession** pairing handshake, an **encrypted multi-writer Autobase co-signed ledger**
with **author-enforced co-signature**, and **HTLC atomic delivery** of a tokenized fan-pass over a Hypercore
blob — settled in **USDt**. Every trade emits a verifiable receipt.

**The one honesty gate (never cut it):** the USDt **payment leg is a labeled mock** — no chain yet. *Everything
else* — the transport, the PoP pairing, the encryption, the enforced co-signature, and the delivery-vs-reveal
**atomicity** — is **real and tested**. Say this out loud (and/or on-screen) at least once, every time.

This doc drives two deliverables:
1. The **≤3:00 unlisted YouTube** demo video (§1–§3).
2. The **90-second live pitch** for finalists, 7/15–18 (§4).

Judges to expect: David Mark Clements (Holepunch/Pears core) and Guy Swann (Bitcoin educator — will probe the
trust model). Keep every on-camera claim inside what's built. The peak of this video is the **two un-copyable
climaxes** — *the co-signature can't be forged* and *payment and delivery are one atomic act*. "No server" is
commodity in this track; it's the **setup**, not the finale.

The runbook you follow at the keyboard is [HOW-TO-DEMO.md](HOW-TO-DEMO.md). This is the shot-list / narration.

---

## 1. The ≤3-Minute Video Script (0:00–3:00)

**Order:** hook → two fans connect, no server (setup, ~20s, don't linger) → seller lists a tokenized fan-pass →
buyer offers → seller co-signs on the Autobase ledger → **CLIMAX 1: "Forge it. Go ahead."** (forgery REJECTED) →
**CLIMAX 2: the atomic pass unlock** (settlement reveals the secret and the pass unlocks in the same instant) →
verifiable receipt hero → close naming the stack. Open on a **live working shot** — never a title card.

**Capture routing (see §2):** shoot the story beats in the **GUI** (visual, emotional); cut to the **CLI**
(`node test/node-peer.js`) for the two climaxes, because in the terminal *command order = screen order*, which
lets you land forgery-first, then the atomic unlock — and raw terminal P2P reads as un-staged to a technical
judge. Cut back to the GUI for the receipt hero. `npm run scenario` is the zero-fumble fallback for the whole run.

| Time | On-Screen Action (exact) | Narration (word-for-word) | On-Screen Text / Callout |
|---|---|---|---|
| **0:00–0:10** | **Cold open, live.** Tight on the GUI **Atomic fan-pass** card animating **🔒 Sealed → 🔓 Unlocked** and the transfer code appearing; hard cut to the receipt's **"Verified"** stamp on the other window. (Both are real footage pulled from later in the same take — edit them to the front in post.) | *"Two fans. Two countries. No company in between. Watch a World Cup ticket get paid for and handed over — in the very same instant."* | `TERRACE — paid + delivered, atomically` |
| **0:10–0:30** | **Setup — connect, no server (~20s, brisk).** Both windows side by side. Left: click **🇦🇷 Argentina** → **Host the market →**. Right: click **🇫🇷 France** → **Join with an invite** → paste the pre-copied invite → **Join the market →**. Status pill flips **"Connecting to swarm…" → "Connected · 1 fan online"**; toast on the ARG window: *"France fan joined the terrace · peer connected · direct"*. Quick PiP insert: `ps aux \| grep -i node` — two peer rows, no backend. | *"They find each other over Hyperswarm — peer discovery with no server in the middle. Two peers, zero backends. A protomux handshake proves France owns her key, and only then is she authorized to co-write the ledger."* | `Hyperswarm · protomux PoP pairing · no server` |
| **0:30–0:45** | ARG window → **＋ List a ticket** tab. Fixture **ARG vs BRA**, Section **North Stand**, Seat **Row 14, Seat 7**, Ask price **850**. Flip on **"🔒 Attach a tokenized fan-pass"**; in the transfer-code field type **`FIFA26-FINAL-QR-7K4D9`**. Click **Publish to the swarm →**. Toast: *"Sealed & live · ARG vs BRA · 850 USD₮ · pass unlocks atomically on settle"*. | *"The seller lists a Final ticket for 850 USDt — and attaches a tokenized fan-pass. The real transfer code is sealed under a hashlock and shipped encrypted, straight to the buyer, peer to peer."* | `🔒 tokenized fan-pass · sealed under hashlock H` |
| **0:45–0:58** | Cut to FRA window. The listing card is already there, unrefreshed, with a **🔒 Tokenized pass** badge. Click **Make offer →**. Toast: *"Offer signed on ARG vs BRA · 850 USD₮ · awaiting seller co-sign"*. | *"It lands on the buyer's side live — no page refresh, straight from a peer — and she signs an offer at 850."* | `offer signed · awaiting seller co-sign` |
| **0:58–1:12** | Cut to ARG window. Incoming trade card reads *"France wants your ticket"* → click **Accept & co-sign →**. Both windows toast: *"Trade co-signed on the ledger · 850 USD₮ · both sides signed"*. | *"The seller accepts. Both signatures land on one Autobase ledger — a multi-writer log neither peer can rewrite alone. This isn't a chat message; it's a co-signed record that exists only because both keys appended to it."* | `Autobase co-signed ledger — both keys appended` |
| **1:12–1:38** | **CLIMAX 1 — "Forge it. Go ahead."** Cut to the **CLI** (buyer terminal). Type `forge <listingId>`. Output: *"attempting to forge a co-signed trade … (you are NOT the seller)"* then **"❌ forgery REJECTED by the ledger — you are not the seller-writer. The co-signature can't be faked."** *(Optional garnish: flash the GUI receipt's **"Forge it. Go ahead."** panel — click **✎ Tamper this receipt**, change the price, **Re-verify** → stamp flips to **Invalid**, "Forgery rejected.")* | *"Now try to cheat. As the buyer, forge a co-signature you don't own and append it straight to the ledger. The ledger's own apply-rule checks who actually signed — and drops it. You cannot fake the other fan's signature."* | `forge co-sign → REJECTED by apply() (tested)` |
| **1:38–2:05** | **CLIMAX 2 — the atomic unlock.** Stay in the CLI. Buyer: `pass <tradeId>` → **"🔒 LOCKED · hashlock … · encrypted, delivered P2P, awaiting settlement"**. Seller terminal: `receipt <tradeId>` (this settles + reveals the secret). Buyer: `pass <tradeId>` → **"🔓 UNLOCKED · transferCode = FIFA26-FINAL-QR-7K4D9"**. *(For the beauty shot you may cut to the GUI 🔒→🔓 card here instead.)* | *"The pass is already on her machine — but locked. The seller settles, and settling forces him to reveal the one secret that both records the payment and decrypts the pass. There it is. Paid, and handed over, in one indivisible act — no escrow, no arbitrator."* | `settle reveals S → pass UNLOCKED · atomic (tested)` |
| **2:05–2:32** | Cut to the GUI **Trades & receipts** tab. The **receipt hero** fills the frame: **Verified** stamp, faceoff **🇫🇷 France (buyer)** vs **🇦🇷 Argentina (seller)**, **850 USD₮**, seat, **Ledger height #N**, **Autobase hash**, tagline *"No server. No scalper. Co-signed peer-to-peer."* Hold ≥5s so it's legible on a pause. | *"Both fans keep the same proof — a verifiable receipt: the two nations, the seat, the USDt amount, and the exact ledger height and Autobase hash it was recorded at. Honest line: the USDt payment leg here is a labeled mock — no chain yet. Everything else — the transport, the pairing, the encrypted ledger, the enforced co-signature, and that atomic delivery — is real, and tested."* | `Verifiable receipt · ledger #N · hash 0x…` · `USDt leg = labeled mock — the rest is real + tested` |
| **2:32–3:00** | Wide shot of both windows; wordmark overlay. Optional 1–2s insert of `npm test` (three green suites) or the repo tree for genuine-progress credibility. | *"Terrace: a serverless fan-to-fan exchange, settled in USDt, on Holepunch's Pears — Hyperswarm discovery, a protomux handshake, an Autobase co-signed ledger, and HTLC atomic delivery. Pear Credit's thesis, wearing a jersey. Two fans, one ticket, one ledger — and nobody in the middle."* | `TERRACE · Pears · Hyperswarm · Autobase · USD₮ · Tether Developers Cup` |

**Notes on honesty & fidelity**
- The publish **Fixture** dropdown literally renders `ARG vs BRA` (no "Final" baked in) — the "Final" flavor is
  narration only. Keep on-screen labels honest to what's rendered.
- The 0:00 cold-open is **reused footage** from later in the same take (the 🔒→🔓 unlock ~1:45, the stamp
  ~2:10). Record the full run once, then edit these to the front — don't fake them live.
- **"USDt leg = labeled mock; the rest is real + tested"** must appear on screen at least once (recommended at
  2:05–2:32). This is the one gate the script cannot skip.
- **The GUI "Forge it. Go ahead." tamper is tamper-*evidence*, not a live ledger round-trip** — it recomputes a
  content fingerprint (FNV-1a over the receipt fields) and compares it to the fingerprint captured at render, so
  any edit is caught. The **real, author-enforced ledger rejection** is the CLI `forge` (and `npm run scenario` /
  `npm test`). Use the **CLI `forge`** as the substantive Climax-1 proof; if you show the GUI tamper, narrate it
  as "you can't alter the receipt and have it still verify," not "the ledger rejected it."

---

## 2. Two Capture Setups (and the recommendation)

### Setup A — GUI, two Pear windows (visual, emotional)
- `pear run --dev .` (host / Argentina) and `pear run --dev . <invite>` (join / France), side by side, native
  **1180×760** — don't stretch. Screen-record both (OBS/QuickTime split-screen).
- Best for: the hook, nation-picking, live listing/offer/co-sign toasts, the **receipt hero**, and the gorgeous
  **🔒 Sealed → 🔓 Unlocked** fan-pass card.
- **Pre-warm Pear** — the first-ever `pear run` does a one-time ~60s runtime heal. Never record a cold first boot.

### Setup B — CLI, two terminals (bulletproof, judge-convincing raw P2P)
Two panes running `node test/node-peer.js`. Technical judges *prefer* raw terminal P2P — it reads as un-staged,
and **command order = screen order**, which is exactly what lets you land Climax 1 (forgery) before Climax 2
(atomic unlock).

**Terminal 1 — seller / Argentina (hosts the market):**
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

**Terminal 2 — buyer / France (joins with the invite):**
```
node test/node-peer.js join <INVITE> --nation FRA
```
Wait for **`[status] peers=1 connected=true writable=true`** on both (the buyer shows *"joined market, waiting to
be authorized as co-writer…"* until the PoP handshake authorizes it).

Then drive the trade (each line typed into the terminal noted):
```
# seller (T1) — list the ticket AS a tokenized fan-pass (4th field issues the pass):
sell ARG vs BRA · Final | Row 14, Seat 7 | 850 | FIFA26-FINAL-QR-7K4D9
#   -> listed <id> · ARG vs BRA · Final · 850 USDt · 🔒 tokenized pass · hashlock <…>…

# buyer (T2) — it replicated in; see it and offer:
list
offer <listingId>
#   -> offered on <listingId> · offer <offerId>

# seller (T1) — co-sign the offer into a trade:
accept <offerId>
#   -> co-signed -> trade <tradeId> (ARG->FRA, 850 USDt)

# --- CLIMAX 1: buyer (T2) tries to forge a co-sign it doesn't own ---
forge <listingId>
#   -> ❌ forgery REJECTED by the ledger — you are not the seller-writer. The co-signature can't be faked.

# --- CLIMAX 2: the atomic unlock ---
# buyer (T2) — the pass is here but sealed:
pass <tradeId>
#   -> 🔒 LOCKED · hashlock <…>… · encrypted, delivered P2P, awaiting settlement

# seller (T1) — printing the receipt SETTLES the trade and reveals S:
receipt <tradeId>
#   -> ----------------- RECEIPT -----------------
#        ARG vs BRA · Final
#        seat Row 14, Seat 7 · 850 USDt
#        ARG -> FRA
#        state: settled · ledger height <N>
#        hash: <hash>
#        No server. No scalper. Co-signed peer-to-peer.
#      -------------------------------------------

# buyer (T2) — now it unlocks, revealing the transfer code:
pass <tradeId>
#   -> 🔓 UNLOCKED · transferCode = FIFA26-FINAL-QR-7K4D9
```
> IDs accept the short prefix shown in the output — paste the first several hex chars. Other commands: `trades`,
> `me`, `quit`. **Only the seller can settle a hashlocked pass** (he alone holds the secret) — run `receipt` in
> **Terminal 1**.

### Setup B′ — `npm run scenario` (zero-fumble fallback)
```
npm run scenario
```
One command runs two real `TerraceCore` peers over a real Hyperswarm on a private local DHT testnet and narrates
the whole HTLC story in labeled beats — connect → PoP authorize → list (sealed) → offer → co-sign → **forge
REJECTED** → **wrong-preimage settle REJECTED** → settle reveals `S` → **pass UNLOCKED** → verifiable receipt →
"Atomic" curtain. It asserts throughout and **exits 0**. This is the single most bulletproof take: if live capture
is flaky, screen-record this instead — it can't fumble.

### Recommendation
**Lead with Setup A (GUI)** for the story beats (hook through co-sign) and the receipt hero + the 🔒→🔓 card.
**Cut to Setup B (CLI)** for the two climaxes (forgery REJECTED, then the atomic unlock) — that's where "it's
really P2P **and** really atomic" lands hardest, in the exact order you want. The CLI receipt tagline —
*"No server. No scalper. Co-signed peer-to-peer."* — is **identical wording** to the GUI receipt card, so the cut
feels intentional. Keep **Setup B′ (`npm run scenario`)** ready as the zero-fumble fallback for the entire run.

---

## 3. Exact Operator Runbook

### 3.1 Pre-flight (T-minus 15 min)
1. **Pre-warm Pear on both windows.** Run `pear run --dev .` once, let it fully boot (one-time ~60s heal on the
   first-ever boot), quit, relaunch — the second boot is fast. Never record a cold first boot.
2. **Seed one throwaway listing off-camera** from a spare peer so the marketplace already looks alive, distinct
   from the marquee `ARG vs BRA · 850 USDt` fan-pass you publish live.
3. **Pre-copy the invite** into the clipboard (the host also surfaces a **Copy invite** button in-app) so pasting
   into the join field/command is instant — never type 64 hex chars on camera.
4. **Decide the transfer code up front:** `FIFA26-FINAL-QR-7K4D9` (matches `npm run scenario`, so all surfaces
   read consistently).
5. **CLI terminals ready:** two panes, correct size/font, scrollback cleared, `cd`'d into the repo root, history
   cleared of prior invite strings.
6. **Silence everything:** Do Not Disturb on; quit Slack/email/anything that can pop a banner.
7. **Dry-run once, off-camera, immediately before the real take** — either the full GUI+CLI flow, or just
   `npm run scenario` — to confirm pairing, publish, offer, accept, forge-reject, settle, and unlock all work.

### 3.2 GUI take — click-by-click
1. Start recording both windows.
2. **Window A (host):** onboarding → click **🇦🇷 Argentina** → leave mode on **Host a new market** → click
   **Host the market →**.
3. **Window B (join):** onboarding → click **🇫🇷 France** → click **Join with an invite** → paste the invite →
   click **Join the market →**.
4. Wait for both status pills to read **Connected · 1 fan online** (seconds if pre-warmed). Window B's auth banner
   *"Getting authorized as a co-writer…"* clears to *"Authorized — you're a co-signer on the ledger"* on its own.
5. Insert the `ps aux | grep -i node` shot (PiP overlay is fine — no need to live-type it).
6. **Window A → ＋ List a ticket:** Fixture `ARG vs BRA`, Section `North Stand`, Seat `Row 14, Seat 7`, price
   `850`; **flip on "🔒 Attach a tokenized fan-pass"**; transfer code `FIFA26-FINAL-QR-7K4D9`; click
   **Publish to the swarm →**.
7. **Window B → Marketplace:** the new card (with the **🔒 Tokenized pass** badge) is visible → click
   **Make offer →**.
8. **Window A:** the incoming trade card appears (or the *"France wants your ticket"* toast) → go to
   **Trades & receipts** → click **Accept & co-sign →**.
9. **Settlement is automatic** — the seller's side auto-settles the moment it's co-signed (there is **no manual
   "settle" button**). Within ~1.5–2s both windows toast *"Trade co-signed…"* then *"Fan-pass unlocked"* and
   *"Settled · receipt verified"*.
10. **Be on the Trades tab as it settles** so you capture the **🔒 Sealed → 🔓 Unlocked** card playing (it
    auto-plays **once** per trade and can't be replayed without a fresh trade). Below it, the **receipt hero**
    fills in; hold ≥5s.
11. (Optional visual) On the receipt's **"Forge it. Go ahead."** panel, click **✎ Tamper this receipt**, change a
    field, **Re-verify against ledger →** → stamp flips to **Invalid** / *"Forgery rejected."*
12. Cut to the CLI climax beats (below), then a wide shot + close.

### 3.3 CLI take — command-by-command
Run the exact commands in **§2 Setup B**, in order, on the two pre-opened terminals. Type at a deliberate,
readable pace — judges will pause here. Route the two climaxes through the CLI so forgery lands **before** the
atomic unlock.

### 3.4 Proving "no server" on camera (setup beat — don't linger)
- **Primary (always do):** `ps aux | grep -i node` (or Activity Monitor filtered to "node") showing only your
  peer processes — no `server.js`, no `api`, no listening HTTP backend. This is true of the codebase: there is no
  server file anywhere in `src/`.
- **Kill a peer (safe variant, only *after* settlement):** quit one window / Ctrl-C one CLI peer; the settled
  receipt persists in the survivor's on-disk store (`store/…`) — re-run `receipt <tradeId>` and it still prints.
  Frame it precisely: *"There's no server to kill — only this pair's own connection; the co-signed receipt already
  lives on both machines."*
- **Do NOT** yank Wi-Fi mid-trade as a "gotcha." Hyperswarm's DHT needs connectivity to *discover* peers; killing
  the network just pauses sync. Offline reconnect/re-pairing is **not** a tested path — don't claim it. A visibly
  broken gotcha costs more than the process-list proof gains.

---

## 4. Live-Pitch Variant (90 seconds, for 7/15–18)

### 4.1 Pre-load before you're called up
- **Both GUI windows already onboarded and connected** (do nation-picking and pairing in the green room).
- The **publish form pre-filled** — `ARG vs BRA` / `North Stand` / `Row 14, Seat 7` / `850`, **fan-pass toggle
  on**, transfer code `FIFA26-FINAL-QR-7K4D9` — one click from publishing.
- **A second, already-connected pair** open in a background space as an instant fallback.
- **CLI terminals standing by:** host running with the invite already pasted into the join command (one Enter from
  a connection), and — critically — a fresh listing already `sell`-published and `offer`+`accept`'d so you can go
  straight to `forge`, `pass`, `receipt`, `pass` on stage.
- `npm run scenario` primed in a spare pane as the ultimate safety net.

### 4.2 Word-for-word (≈90s)
> *"It's the night before the Final. Diego, in Buenos Aires, has a spare ticket. Camille, in Lyon, has been trying
> to get to this match for four years. Their only options today: a scalper who triples the price, or a platform
> that holds both their money and can freeze the trade at 11pm the night before kickoff. Terrace removes the
> platform entirely."*
>
> *(gesture at the two connected windows)* *"Here's Diego's laptop, here's Camille's. No server between them — they
> found each other over Hyperswarm and shook hands over protomux."*
>
> *(click Publish, then Make offer, then Accept & co-sign)* *"Diego lists the ticket as a tokenized fan-pass —
> sealed under a hashlock, shipped encrypted. Camille offers. Diego co-signs. Both their keys just appended to one
> Autobase ledger — that linearized log **is** the co-signature."*
>
> *(cut to the CLI; run `forge`)* *"Now watch someone try to cheat — forge a co-signature you don't own. The
> ledger checks who signed and rejects it. You can't fake the other fan's signature."*
>
> *(run `pass` → LOCKED, `receipt` → settles, `pass` → UNLOCKED)* *"And here's the part with no escrow agent: the
> pass is on Camille's machine, but locked. The instant Diego settles, he's forced to reveal the one secret that
> decrypts it. Paid and delivered in a single, indivisible act."*
>
> *(point at the receipt hero)* *"There's the proof both of them keep — nations, seat, USDt amount, ledger height,
> Autobase hash. Honest line: the USDt payment leg is a labeled mock today; everything else — the pairing, the
> encrypted ledger, the enforced co-signature, the atomic delivery — is real and tested. v2 wires the real
> settlement through Tether's WDK."*
>
> *"That's Terrace — Pear Credit's thesis, wearing a jersey. Two fans, one ticket, one ledger, nobody in the
> middle."*

### 4.3 Failure recovery
- **Live pair doesn't connect within ~5s of any step:** don't wait it out — switch to the pre-connected fallback
  pair and keep narrating; don't acknowledge the swap unless asked.
- **GUI hangs/crashes:** pivot straight to the CLI terminals — the same beats via `sell` / `offer` / `accept` /
  `forge` / `pass` / `receipt` / `pass`. The CLI is the more reliable path; treat it as the safety net, not a
  downgrade. If even that stalls, run `npm run scenario` and narrate over it — it always completes and exits 0.
- **Asked "what if a peer disappears mid-trade?"** Answer from the design: today Terrace makes cheating provable
  via the tamper-evident co-signed ledger, and for a tokenized pass the atomic swap means *"take the money and
  never deliver" is a state the ledger won't enter*. True 2-of-3 non-custodial escrow (Tether WDK on Sepolia, for
  externally-issued tickets) is the explicit next milestone — not yet shipped. Don't claim escrow is live.

---

## 5. Do's & Don'ts (winning judge trust)

**Do**
- Open on a real, running shot — never a title card.
- Name the SDKs out loud: **Pears**, **Hyperswarm**, **protomux** (PoP pairing), **Autobase**, and **USDt/Tether**
  at the close. Name them; don't gesture around them.
- Label the **USDt payment leg as a mock** every time settlement is shown — and pair it with "everything else is
  real and tested."
- **Hold the receipt hero and the 🔒→🔓 unlock long enough to read** (≥5s each) — judges pause here.
- Route the two climaxes so **forgery-REJECTED comes before the atomic unlock** (use the CLI, where command order
  is screen order).
- Flash a 1–2s insert of `npm test` (three green suites) or the repo tree for genuine-progress credibility.
- Keep the video **at or under 3:00** — cut ruthlessly if over.

**Don't**
- Don't say "trustless" or "escrowed" for anything beyond what's built — there's no on-chain 2-of-3 escrow yet.
- Don't present the USDt leg as a real on-chain transfer — it's a labeled mock.
- Don't narrate the **GUI receipt tamper** as "the ledger rejected it" — it's a tamper-evident **content
  fingerprint** check. The real author-enforced ledger rejection is the **CLI `forge`** / `scenario` / `npm test`.
- Don't claim offline reconnect / re-pairing or "works with the network unplugged" — untested; DHT discovery needs
  connectivity.
- Don't use generic CTAs ("Learn more", "click here") as callouts — every on-screen line should name what's
  happening (ledger height, hash, hashlock, peer count).
- Don't let the video run past **3:00** — that's elimination-tier, not a suggestion.

---

## 6. Where the ideal shot meets the build (gaps & fidelity notes)

- **Onboarding button label:** the code renders **"Host the market →" / "Join the market →"** (not "Enter the
  swarm →"). Corrected throughout this script and in HOW-TO-DEMO.md.
- **GUI climax ordering:** the pass-reveal card renders **above** the receipt hero, which is above the "Forge it"
  panel — natural top-to-bottom scroll is *unlock → receipt → forge* (i.e. Climax 2 before Climax 1). To honor the
  required **forge-first** order, the script routes both climaxes through the **CLI**. An all-GUI take is possible
  but reverses climax order — noted, not recommended.
- **GUI forgery proof is tamper-evidence, not a ledger round-trip** (FNV-1a content fingerprint vs. the value
  captured at render). Substantive Climax-1 proof = **CLI `forge`** (real `apply()` rejection). Fully supported;
  just don't overclaim the GUI variant.
- **GUI auto-settles on co-sign** (the seller side triggers settlement automatically; no manual settle button) and
  the **🔒→🔓 animation plays once per trade** (`state.passUnlockedUI`). Capture it on the first landing; a re-take
  needs a fresh trade. Supported — capture note only.
- **CLI hashlocked settle is seller-only** — only the seller holds the secret `S`, so `receipt` must be run in
  **Terminal 1**. *(HOW-TO-DEMO's "either side prints the receipt" is imprecise for a pass trade.)*
- **Everything else verified accurate** against `test/node-peer.js`, `test/scenario.js`, `src/app/ui.js`,
  `src/app/bridge.js`, `src/app/index.html`, and `package.json`: all commands, output strings, toasts, on-screen
  labels ("🔒 Attach a tokenized fan-pass", "🔒 Tokenized pass", "Forge it. Go ahead.", the LOCKED→UNLOCKED
  reveal, the receipt tagline), and the `npm run scenario` beat list are as written.
