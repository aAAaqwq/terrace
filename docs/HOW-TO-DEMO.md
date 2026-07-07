# How to Demo & Verify Terrace

**Operator / judge runbook.** This is the practical "how do I actually run this and confirm it works" guide.
It complements [DEMO-SCRIPT.md](DEMO-SCRIPT.md) (the video shot-list / narration), which you should use for the
recorded ≤3-min video and the live pitch. This doc is what you follow at the keyboard.

Terrace is a **serverless P2P fan-value exchange** on Holepunch's Pears stack: Hyperswarm/HyperDHT transport,
a protomux proof-of-possession pairing handshake, an **encrypted multi-writer Autobase co-signed ledger**, and
**HTLC atomic delivery** of a tokenized fan-pass over a Hypercore blob — settled in USDt (the payment leg is a
clearly-labeled mock; the atomicity is real and tested).

---

## 1. Prerequisites

- **Node 20+** (the repo is developed/tested on Node **v24**). macOS or Linux.
- Install dependencies once, from the repo root:

```bash
npm install
```

That's everything you need for the three most reliable demo paths (§2A–C).

- **For the desktop GUI only (§2D):** the Pear runtime.

```bash
npm i -g pear     # first time only
pear               # run once, bare, to let it bootstrap/self-heal (~60s the first time)
```

> The very first `pear run` does a one-time runtime heal that can take ~60 seconds. **Pre-warm it before you
> demo** so it never happens on camera. Subsequent launches are fast.

---

## 2. Four ways to run, ordered by reliability

### (A) `npm test` — the correctness proof (most bulletproof)

```bash
npm test
```

Runs the three suites in sequence; each ends with a green `ALL … TESTS PASSED ✅`. Run this any time you need to
prove the system is correct — it is deterministic and has no camera-facing moving parts.

| Suite | Command | What it proves |
|-------|---------|----------------|
| Ledger | `node test/ledger.test.js` | Co-writer authorization; a co-signed trade replicates to both peers; **a buyer-forged co-sign is REJECTED** (author-enforced state machine); the store is **encrypted at rest** (no plaintext listing bytes on disk); a peer **without the invite key cannot read** the ledger; **proof-of-possession** crypto — honest proof accepted, writer-key spoof & replayed nonce rejected. Runs offline over two piped Corestores (no swarm) so the co-sign logic is isolated. |
| Swarm | `node test/swarm.test.js` | The **full two-peer trade over a real Hyperswarm** (a local hermetic DHT testnet): discovery → protomux writer-key pairing → co-writer authorization → listing → offer → co-signed trade → settlement → verifiable receipt. |
| Asset (HTLC) | `node test/asset.test.js` | The **atomic tokenized fan-pass**: the hashlock primitive; a settlement with a **wrong or missing preimage is REJECTED** by `apply()`; the correct preimage settles and reveals `S`; and over a real swarm the encrypted pass replicates P2P but stays **LOCKED** until settlement, then the buyer decrypts the exact transfer code. The buyer (no secret) cannot settle; a direct decrypt with a guessed secret fails. |

You can also run them individually via `npm run test:ledger`, `npm run test:swarm`, `npm run test:asset`.

---

### (B) `npm run scenario` — the narrated end-to-end story (best single-command demo)

```bash
npm run scenario
```

Runs two real `TerraceCore` peers (a 🇦🇷 seller and a 🇫🇷 buyer) over a **real Hyperswarm on a private local DHT
testnet** (hermetic + offline), and narrates the full HTLC fan-pass story to the terminal with labeled scene
beats. It is a proof, a rehearsal reference, and a regression test at once — it asserts throughout and exits `0`.

The eight printed beats:

1. **Scene 1** — Two fans of different nations come online and connect directly over Hyperswarm (no server).
2. **Scene 2** — The buyer is authorized to co-write the ledger via the PoP pairing handshake.
3. **Scene 3** — The seller lists the ticket as a tokenized fan-pass; only the hashlock `H` (not the secret `S`) hits the ledger.
4. **Scene 4** — The listing replicates to the buyer but stays **sealed**; the buyer offers on it.
5. **Scene 5** — The seller co-signs → a trade enters the shared log; the buyer's pass is present but **LOCKED**.
6. **Scene 6** — **Adversarial:** the buyer forges a co-sign it doesn't own (**REJECTED**) and forges a settlement with a wrong preimage (**REJECTED**); a bad-secret settle is refused before it ever hits the log.
7. **Scene 7** — Settlement (labeled mock USDt) reveals `S`, which unlocks the pass; the verifiable receipt is printed.
8. **Curtain** — The atomic guarantee restated: the seller could not be paid without revealing the secret that unlocked the buyer's pass.

This is the best "just run one thing and let it tell the whole story" command. It takes tens of seconds
(DHT warmup + deliberate ~700ms beats between scenes so a viewer can follow).

---

### (C) CLI two-peer — the recommended live demo

Two terminals, two real peers, no GUI. This is the most dependable way to drive a **live**, interactive trade —
including the tokenized fan-pass and the adversarial "forge & fail" beat.

**Terminal 1 — seller (Argentina), hosts the market:**

```bash
node test/node-peer.js host --nation ARG
```

It prints a **MARKET INVITE** block containing a 64-hex key:

```text
==================== MARKET INVITE ====================
<64-hex invite key>
  share this with the buyer:  node test/node-peer.js join <invite> --nation FRA
======================================================
```

**Terminal 2 — buyer (France), joins with that invite:**

```bash
node test/node-peer.js join <INVITE> --nation FRA
```

Wait a few seconds for the `[status] peers=1 connected=true writable=true` line on both sides (the buyer shows
`joined market, waiting to be authorized as co-writer…` until the PoP handshake authorizes it).

Then drive the full trade. Each command below is typed into the terminal indicated:

```text
# seller (Terminal 1) — publish a ticket AS a tokenized fan-pass (the 4th field issues the pass):
sell ARG vs BRA | N12-R7 | 850 | FIFA26-QR-7K4D9
#   -> listed <id> · ARG vs BRA · 850 USDt · 🔒 tokenized pass · hashlock <…>…

# buyer (Terminal 2) — the listing replicated in; see it and offer on it:
list
#   -> <id> · ARG vs BRA · seat N12-R7 · 850 USDt · ARG · open
offer <listingId>
#   -> offered on <listingId> · offer <offerId>

# seller (Terminal 1) — co-sign the offer into a trade:
accept <offerId>
#   -> co-signed -> trade <tradeId> (ARG->FRA, 850 USDt)

# buyer (Terminal 2) — the pass is here but sealed:
pass <tradeId>
#   -> 🔒 LOCKED · hashlock <…>… · encrypted, delivered P2P, awaiting settlement

# either side — printing the receipt SETTLES the trade (reveals S):
receipt <tradeId>
#   -> ----------------- RECEIPT -----------------
#        ARG vs BRA
#        seat N12-R7 · 850 USDt
#        ARG -> FRA
#        state: settled · ledger height <n>
#        hash: <64-hex>
#        No server. No scalper. Co-signed peer-to-peer.

# buyer (Terminal 2) — now the pass unlocks, revealing the transfer code:
pass <tradeId>
#   -> 🔓 UNLOCKED · transferCode = FIFA26-QR-7K4D9

# buyer (Terminal 2) — the adversarial beat: try to forge a co-sign you don't own:
forge <listingId>
#   -> ❌ forgery REJECTED by the ledger — you are not the seller-writer. The co-signature can't be faked.
```

One-line meaning of each beat: **sell** issues the hashlocked tokenized pass · **list** proves the listing
replicated P2P · **offer** is the buyer's signed intent · **accept** is the seller's co-signature landing on the
shared log · **pass (LOCKED)** shows the ticket is present but encrypted · **receipt** settles it and reveals `S`
· **pass (UNLOCKED)** shows atomic delivery — settlement is what handed over the code · **forge** proves the
co-signature is enforced in code, not just claimed.

> `<listingId>`, `<offerId>`, `<tradeId>` accept the short prefix shown in the output — you can paste the first
> several hex characters. Other commands: `trades` (list your trades), `me` (your peer id/status), `quit`.

---

### (D) GUI two-window — the visual demo (Pear runtime)

Two desktop windows. Use this for visual polish; keep §2B/§2C as your reliable fallback.

**Pre-warm Pear first** (see §1) so the one-time ~60s heal never happens on camera.

```bash
# Window 1 — host a fresh market (logs an invite to the terminal):
pear run --dev .

# Window 2 — join that market with the host's invite:
pear run --dev . <invite-hex>
```

The host also surfaces a copyable invite inside the app, so you don't strictly need the terminal invite.

Click flow:

1. **Pick your nation** on the onboarding screen (e.g. Argentina on window 1, France on window 2).
2. Choose **Host a new market** (window 1) or **Join with an invite** (window 2, paste the invite), then click **Host the market →** / **Join the market →**.
3. **Host copies** its invite from the app / terminal; **joiner pastes** it into the invite field. The joiner
   waits until it's authorized as a co-writer (the publish button unlocks the moment the host adds its key).
4. On the host's **List a ticket** tab, fill the fixture / seat / price. Optionally flip **"🔒 Attach a
   tokenized fan-pass"** and enter a transfer code / QR string. **Publish to the swarm →**.
5. The listing appears live in the joiner's marketplace (no refresh). Joiner clicks **Make offer →**.
6. Host gets the incoming trade card and clicks **Accept & co-sign →**. Both windows confirm the co-sign.
7. On the receipt view, the hero card fills in. For a pass listing it plays the **LOCKED → UNLOCKED** reveal
   (encrypted, delivered P2P, hashlock shown → unlocks the instant settlement co-signs).
8. The receipt carries the **"Forge it. Go ahead."** panel — click **✎ Tamper this receipt**, change any field,
   and the co-signed fingerprint no longer matches: *"Forgery rejected."* This is the on-screen tamper proof.

---

## 3. Proving "there is no server" on camera

- **Process list.** In a spare terminal:

  ```bash
  ps aux | grep -i node
  ```

  You'll see only your peer processes (two CLI peers, or the Pear windows) — **no backend row**. Terrace has no
  server process to find.
- **No server in the code.** There is no server file in the repository — the "matching engine" is two laptops
  and a co-signed Autobase ledger. All networking is genuinely Hyperswarm/HyperDHT + Corestore replication +
  protomux (confirmed in [REVIEW.md](REVIEW.md), dimension 1).
- **Kill a peer (safe variant).** Do this **after** settlement: quit one window / Ctrl-C one CLI peer. The
  settled receipt persists locally in the surviving peer's on-disk store (under `store/…`) — co-signed, not
  hosted. Re-running `receipt <tradeId>` on the survivor still prints it.

> **Honest caveat — do not overclaim.** Hyperswarm's DHT discovery needs network connectivity for two peers to
> *find* each other. "No server" means no central backend or custodian, not "works with the network cable
> unplugged." Offline reconnect / re-pairing after a kill is **not** part of the tested paths — don't claim it on
> camera. What *is* proven is that the settled receipt survives locally when a peer goes away.

---

## 4. What's real vs mock (honesty table for judges)

Be precise here — nobody should feel misled.

| Component | Status | Notes |
|-----------|--------|-------|
| P2P transport (Hyperswarm / HyperDHT) | **Real, tested** | `swarm.test.js`, `asset.test.js` (real DHT testnet), `scenario.js`. |
| Protomux proof-of-possession pairing | **Real, tested** | `ledger.test.js` PoP block: honest proof accepted; writer-key spoof & replay rejected. |
| Encrypted multi-writer Autobase ledger | **Real, tested** | `ledger.test.js`: encrypted at rest; a peer without the invite key can't read it. |
| Author-enforced co-signature | **Real, tested** | `apply()` checks the authoring writer key; forged co-signs are dropped. `forge` (CLI) and the ledger/scenario tests prove rejection. |
| HTLC fan-pass delivery atomicity | **Real, tested** | `asset.test.js`: wrong/missing preimage rejected; correct preimage reveals `S` and unlocks; buyer can't get the pass before reveal. |
| USDt **payment rail** | **Mock / labeled** | The settlement leg records a clearly-labeled mock proof (`settlement.kind: 'mock'`). There is **no on-chain USDt movement** in this build. Atomicity of *delivery-vs-reveal* is real; the *payment* is mocked. The v2 path is a 2-of-3 non-custodial escrow on Ethereum Sepolia via Tether's WDK — see [DESIGN-escrow.md](DESIGN-escrow.md). |
| Plain-browser standalone UI | **Mock core** | Opening `src/app` in a plain browser (no Pear/Node runtime) runs a **built-in mock core** for visual/demo purposes. The **real** core needs the Pear or Node runtime (§2C/§2D). |

The flagship asset is match tickets, but real FIFA tickets are personalized and non-transferable outside official
resale, so the demo settles **transferable / self-issued fan-passes** — an honest scope choice, see the README
and [REVIEW.md](REVIEW.md).

---

## 5. Troubleshooting

- **Pear first-boot heal (~60s).** The first `pear run` ever does a one-time runtime heal. **Pre-warm it** before
  demoing (§1) so it never blocks you on camera.
- **Two peers don't connect in a few seconds.** That's DHT warmup, not a failure — wait a bit longer or retry the
  join. The CLI shows `[status] peers=… connected=…`; wait for `peers=1`. The joiner stays "waiting to be
  authorized" until the PoP handshake completes.
- **Ports / leftover processes.** If a previous run is still holding storage or a connection, quit it (`quit` in
  the CLI, or Ctrl-C) and check `ps aux | grep -i node` for stragglers before restarting.
- **Plain-browser console shows one import error.** Opening `src/app` directly in a browser logs **one expected
  error** — `bridge.js` tries to `import` the real Node-dependent core, which fails in a plain browser. That
  failure is exactly what triggers the built-in mock core (`window.__TERRACE_MOCK__ = true`, and an info line:
  *"Running with built-in MOCK core"*). It's harmless — but **do not screen-share that console while making a
  "real P2P" claim**, since that path is running the mock, not the live core. For a real demo use §2C or §2D.

---

## 6. Recommended demo path for judges

1. **Lead with reliability.** Run `npm run scenario` (§2B) or the CLI two-peer (§2C) — these are the most
   dependable live stories and they show the full HTLC narrative including the adversarial "forge & fail" beat.
2. **Add visual polish.** Bring up the GUI two-window flow (§2D) for the receipt hero and the LOCKED → UNLOCKED
   reveal — but only after pre-warming Pear.
3. **Always prove correctness.** Run `npm test` (§2A) — three green suites are the strongest evidence the ledger,
   swarm, and atomic delivery actually work.
4. **Prove there's no server** (§3) at least once on camera, honestly.

For the timed cuts — the ≤3-min video and the 90-second live variant with recovery script — follow
[DEMO-SCRIPT.md](DEMO-SCRIPT.md); this runbook is the hands-on companion to it.
