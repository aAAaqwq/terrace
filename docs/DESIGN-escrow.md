# Terrace — Escrow, Trust Model & USDt Settlement Design

**Project:** Terrace — serverless P2P World Cup fan-ticket exchange on Holepunch's Pears stack (Hyperswarm + Autobase co-signed ledger), settled in USD₮.
**Audience for this doc:** the build team, and by extension a Bitcoin-savvy judge (Guy Swann) who will benchmark Terrace against Bisq / RoboSats / HodlHodl multisig-escrow P2P trading and ask: **"Who holds the USD₮, and how is a dishonest counterparty stopped?"**

Terrace answers this in **two paths, and the honest headline is that the strongest one is already shipped:**

> **Path 1 — tokenized fan-pass (SHIPPED, tested, `npm test` green).** For an asset Terrace itself issues — a tokenized fan-pass — there is **no escrow, no arbitrator, and no oracle, because the swap is atomic.** The ledger refuses to record a fan-pass settlement unless it reveals a preimage `S` whose `generichash(S)` equals the hashlock `H` published on the listing, and that same `S` is the only key that decrypts the peer-to-peer-replicated pass ciphertext — so the seller cannot reach the paid/settled state without simultaneously handing the buyer the secret that unlocks the pass, and the buyer cannot obtain the pass until that reveal happens. **Nobody holds funds and nothing can be taken, because delivery and payment are one indivisible act.**
>
> **Path 2 — externally-issued ticket (v2 roadmap).** For an asset Terrace does *not* control (a real FIFA/Ticketmaster e-ticket, which cannot be made preimage-gated), atomicity is impossible, so USD₮ sits in a **2-of-3 escrow** that neither Terrace nor either party can drain unilaterally, and the Autobase co-signed ledger is the tamper-evident record every dispute is adjudicated against.

**Honest boundary that runs through this whole doc:** what is now real and provable is the **atomicity of delivery-vs-reveal** for the tokenized pass. The **payment rail itself is still a clearly-labeled mock** — there is no real USD₮ moving on-chain yet. The atomic-swap *structure* is exactly what makes wiring the mock payment leg to real testnet USD₮ / WDK safe in v2. We claim the atomicity, not the settlement. Overclaiming "trustless ticket delivery" or "real USD₮ settlement" in front of Guy Swann is the fastest way to lose.

---

## 1. Threat model

A P2P ticket-for-USD₮ trade has **two legs that must both complete**: the *money leg* (buyer → seller in USD₮) and the *delivery leg* (seller → buyer, the pass/ticket). Whether these legs can be made naturally atomic depends entirely on **who issues the asset**:

- **Terrace-issued tokenized fan-pass (the shipped v1 asset):** the pass *is* a preimage-gated secret. Terrace encrypts the pass payload under a secret `S`, publishes only the hashlock `H = generichash(S)` and a ciphertext reference on the ledger, and delivers the ciphertext peer-to-peer over a dedicated Hypercore blob (a 2nd Holepunch primitive) replicated across the same swarm. Because `S` is the only key that decrypts the pass **and** the ledger will not record settlement without `S`, the delivery leg and the reveal leg are the *same event*. The gap between the two legs is closed structurally — there is nothing to exploit.
- **Externally-issued e-ticket (v2):** a World Cup e-ticket is an off-chain fact (a transfer code, a FIFA/Ticketmaster account transfer, a barcode) we cannot cryptographically escrow or make preimage-gated. Here the legs are *not* atomic and every cheat exploits the gap — this is the case 2-of-3 escrow + arbitration exists to handle.

The cheats below (A, B) describe the **externally-issued** case. **For the tokenized fan-pass, cheats A and B do not exist:** the seller cannot take payment without revealing `S`, and revealing `S` is exactly what hands the buyer the pass.

### Cheat A — Seller takes the USD₮ and never delivers the ticket
Buyer pays; seller disappears (or hands over an already-used / fake ticket). This is the dominant fraud in fan-ticket resale.

### Cheat B — Buyer receives the ticket but reverses / claims non-receipt
Buyer gets a valid transfer code, then claims "nothing arrived" to get the money back, or (on a chargeback-capable rail) reverses the payment. USD₮ on-chain has **no chargeback**, which already kills the pure-reversal version of this — but the "claims non-receipt" dispute version survives and must be adjudicated.

### What Terrace CAN guarantee
0. **Atomic delivery-vs-reveal for the tokenized fan-pass (SHIPPED, tested).** For a Terrace-issued pass, the ledger's `apply()` accepts a fan-pass settlement **only if it reveals a preimage `S` that hashes to the listing's published `H`** — and `H` is read from the *listing*, not from the settling op, so a settler cannot pick their own lock. Wrong or missing preimages are **rejected** (there is a test that proves it). Since that same `S` is the only key that decrypts the P2P-replicated pass, the seller literally cannot reach "settled/paid" without publishing the one secret that unlocks the pass for the buyer. No party holds funds; the cheat is removed *structurally*, not adjudicated after the fact. This is the honest answer to "who holds the USD₮ / what stops a cheat" for the tokenized-pass path — and the payment leg it sits on remains a labeled mock (v2 wires it to real WDK USD₮; the atomic structure is what makes that safe).
1. **Custody safety (external-ticket path, v2).** Terrace holds no keys and no funds. Escrowed USD₮ can only move by a 2-of-3 signature quorum. A compromise of Terrace's code, a shut-down laptop, or a malicious operator cannot steal funds. (Answers "who holds the USD₮" for externally-issued tickets: a contract, governed by keys the two traders and an arbitrator hold — not us.)
2. **No unilateral theft of locked funds.** Once buyer funds escrow, the seller cannot pull the USD₮ without buyer's release **or** an arbitrator ruling. This defeats the naive version of Cheat A (take-money-and-run) because there is nothing to take until release.
3. **Tamper-evident, non-repudiable record.** Every state transition (listing → offer → accept → fund → deliver-claim → release/dispute) is written to a co-signed Autobase ledger. Neither party can later forge, delete, or reorder what was agreed. Disputes are adjudicated against an append-only shared history, not "he-said-she-said."
4. **No payment reversal.** USD₮ settlement is final; the chargeback flavour of Cheat B is structurally impossible.
5. **Reputation continuity.** Stable peer identities (public keys) accrue signed, ledger-anchored trade history and stake. A scammer cannot cheaply reset identity if we require staking.

### What Terrace CANNOT guarantee (and must not pretend to)
1. **Ticket authenticity / validity.** No cryptographic primitive can prove an off-chain FIFA ticket is genuine, un-duplicated, and will scan at the gate. This is an **oracle problem**. Escrow moves the trust from "trust the counterparty" to "trust the dispute-resolution evidence + arbitrator" — it does not eliminate it.
2. **Delivery atomicity for a non-tokenized ticket.** Unless the ticket is itself a hashlockable secret or an on-chain asset (it is not, for FIFA/Ticketmaster e-tickets in 2026), money and ticket cannot swap atomically. There is an irreducible ordering: someone acts first. Escrow + arbitration is how the mature P2P systems (Bisq, HodlHodl) handle exactly this — and so do we.
3. **A perfectly neutral arbitrator with no trust.** 2-of-3 with a single designated arbitrator reintroduces a *bounded* trust assumption: the arbitrator can collude with one party (2-of-3). We minimize, disclose, and roadmap this (bonded arbitrators, arbitrator selection, N-of-M) rather than hide it. This is the same honest position HodlHodl/Bisq take.

**Framing for the judge:** Terrace is a *custody-safe, evidence-generating* exchange. Escrow removes the "run with the money" attack; the co-signed ledger removes the "lie about what happened" attack; reputation+stake raises the cost of the residual attacks. The ticket-is-real problem is explicitly an arbitration problem, and we say so.

---

## 2. Trust-minimized escrow options, compared

Scoring axes: **1-week feasibility** (can a 2–3 person team ship + demo it), **credibility** (does it survive a Bisq/RoboSats comparison), **honesty** (can we describe it without overclaiming custody).

### (a) On-chain 2-of-3 multisig / smart-contract escrow with a P2P arbitrator — the v2 path for *externally-issued* tickets
This is the right answer for the case atomicity can't reach: an asset Terrace does **not** issue (a real FIFA/Ticketmaster e-ticket), which cannot be preimage-gated. Buyer deposits USD₮ into an escrow contract keyed to `{buyer, seller, arbitrator}`. Release requires **any 2 of 3** signatures. Happy path: buyer + seller co-sign release. Dispute path: arbitrator + the honest party co-sign release-or-refund.

- **Feasibility (1wk):** Medium-high. A minimal escrow is ~120 lines of Solidity on Sepolia, or a 2-of-3 policy on a WDK ERC-4337 smart account (`@tetherto/wdk-wallet-evm-erc-4337`). Well-trodden; audited references abound (Bisq/HodlHodl are exactly this pattern). Main cost is arbitrator UX + on-chain demo choreography.
- **Credibility:** **Highest for externally-issued tickets.** This *is* the Bisq/HodlHodl model. "Who holds the USD₮ for a real ticket resale?" → "A 2-of-3 escrow contract. Not us, not either party alone."
- **Honesty:** Clean. We only claim what 2-of-3 gives (no unilateral theft; bounded arbitrator trust). No overclaim.
- **Weakness:** Reintroduces an arbitrator trust assumption + a ticket-delivery oracle — precisely the trust that the **shipped tokenized-pass HTLC (b) eliminates** when Terrace issues the asset. Escrow is the fallback for assets we don't control, not the headline.

### (b) HTLC / hash-locked settlement for a Terrace-tokenized fan-pass — ✅ SHIPPED v1
Lock the settlement behind a hashlock `H`; the trade only reaches settled when the preimage `S` is revealed, where `generichash(S) == H`. Genuinely atomic **iff the thing being bought is itself the secret `S`** — and for a **Terrace-issued fan-pass, it is**, because Terrace controls the asset and mints it *as* a preimage-gated secret. This is exactly what we built.

**How the shipped version works (matches the code):**
- The seller issues a pass via `publishListing({ ..., passSecret })`. Terrace generates `S`, secretbox-encrypts the pass payload under `S`, and delivers the ciphertext peer-to-peer over a **dedicated Hypercore blob** (2nd Holepunch primitive) replicated across the same swarm. **Only `H = generichash(S)` and the ciphertext reference go on the ledger — never `S`.**
- `apply()` accepts a fan-pass settlement **only if the settling op reveals an `S` such that `generichash(S)` equals the listing's `H`.** `H` is read from the *listing*, not the settling op, so the settler cannot substitute their own lock. Wrong/missing-preimage settlements are **REJECTED** (tested).
- `S` is the ONLY key that decrypts the replicated ciphertext. So the seller cannot reach settled without revealing `S`, and revealing `S` is exactly what unlocks the pass for the buyer.
- New API surface: `getPass(tradeId) → { hasPass, locked, revealed, pass }`; `getReceipt` now carries `hashlock`, `revealed`, and `passUnlocked`.

- **Feasibility:** Shipped and green under `npm test`. No arbitrator infra, no Solidity, no oracle — because Terrace issues the asset, "is this pass real" is not an external question.
- **Credibility:** **High and now demonstrable** (RoboSats/Lightning lineage, but running). "Who holds the USD₮?" → "Nobody — for a tokenized pass the swap is atomic; the seller can't get paid without handing over the secret that unlocks the pass."
- **Honesty boundary (must state every time):** the **atomicity of delivery-vs-reveal is real and tested; the payment rail is still a labeled mock.** We do NOT claim real on-chain USD₮ settlement yet. Only claim: the structure is atomic, so wiring the mock payment leg to real testnet USD₮ / WDK (v2) is safe.
- **Verdict:** **This is the shipped v1 answer** for Terrace-issued assets — no arbitrator, no oracle. Externally-issued tickets, which can't be preimage-gated, fall back to option (a) 2-of-3 escrow (v2).

### (c) Co-signed Autobase ledger + external USD₮ settlement leg
The Autobase ledger is the tamper-evident record of intent/offer/accept/dispute; settlement is a **real USD₮ testnet transfer** peer-to-peer (WDK self-custodial), with the tx hash written back as settlement proof.

- **Feasibility (1wk):** **Highest.** No Solidity, no arbitrator infra. Pure JS: Pears app + WDK transfer + ledger append. Ships comfortably.
- **Credibility:** **Lowest of the four as a standalone escrow** — because it *is not escrow*. Funds go directly A→B; whoever acts second is exposed. Against Bisq/HodlHodl this loses on "who stops the cheater?" The ledger makes cheating *provable*, not *prevented*.
- **Honesty:** Fine **only if** we call it what it is: "trust-scored settlement with a tamper-evident audit trail," not "trustless escrow." Presented as escrow, it's a lie.
- **Verdict:** This is the **coordination + record layer** for every option, and the honest **fallback** if the escrow contract slips. On its own it is not the headline.

### (d) Reputation / staking over the Autobase ledger
Peers post a refundable USD₮ bond; trade outcomes (signed, ledger-anchored) build a reputation score; misbehavior slashes stake and tanks reputation.

- **Feasibility (1wk):** Medium. Bond escrow + score computation are straightforward; sybil-resistance and slashing rules need care.
- **Credibility:** A **layer, not an escrow.** Complements (a); cannot replace it. On its own it's "eBay feedback," which Guy Swann will not accept as counterparty protection for a $2k ticket.
- **Honesty:** Fine as a stated layer.
- **Verdict:** Ship a *minimal* version (peer bond + trade-count + slash-on-arbitrated-fault) as the moat that makes residual attacks costly. Do not present it as the primary safety mechanism.

### Recommendation

**v1 (SHIPPED and demoed): (b) HTLC atomic swap for a Terrace-issued tokenized fan-pass** — no arbitrator, no oracle, no funds held by anyone — **coordinated and audit-trailed by the (c) Autobase co-signed ledger, with a minimal (d) reputation/stake layer.** The tokenized-pass path is the headline because Terrace issues the asset, so the swap is genuinely atomic and there is nothing to adjudicate.

This is the honest, credible, *already-running* combination:
- **(b)** gives the strongest possible answer to "who holds the USD₮ / what stops a cheat" for a Terrace-issued asset: **nobody holds it, and the atomic swap stops the cheat structurally** — the seller can't get paid without revealing the secret that unlocks the pass. Real and tested; the payment leg it rides on is still a labeled mock.
- **(c)** is the serverless, Pears-native differentiator — the tamper-evident shared record that no centralized exchange has, and the layer that binds `H` to the listing so a settler can't pick their own lock.
- **(d)** raises the cost of residual attacks on the external-ticket path.

**v2 (for the case atomicity can't reach — *externally-issued* tickets): (a) 2-of-3 escrow on Sepolia holding test USD₮.** A real FIFA/Ticketmaster e-ticket can't be preimage-gated, so it can't ride the atomic swap; there, escrow + arbitration is the honest model (the Bisq/HodlHodl bar). This is the natural next milestone, not the v1 headline.

**Honest boundary that never moves:** the **atomicity** of the tokenized-pass swap is real and tested; the **USD₮ payment rail is a labeled mock** in both v1 and until the WDK leg lands. Never imply real on-chain USD₮ settlement, and never demo direct A→B settlement while *saying* "escrow." The whole submission's integrity rides on those two distinctions.

**v2 roadmap (say this out loud as the vision):**
1. **Wire the mock payment leg to real testnet USD₮ / WDK** — the atomic-swap structure is exactly what makes moving from mock to real settlement safe: the reveal already gates delivery, so binding it to an on-chain USD₮ release is a drop-in.
2. **2-of-3 escrow for externally-issued tickets (a)**, with **bonded, selectable, slashable arbitrators** — for inventory Terrace does not control, where the atomic swap is impossible.
3. **N-of-M / threshold escrow** and cross-chain USD₮ via **USDT0** so settlement can ride Plasma's zero-fee USD₮ transfers or other chains.
4. **Ticketing-oracle integrations** (FIFA/Ticketmaster transfer-confirmation webhooks) to shrink the "did the ticket really arrive" arbitration surface on the external-ticket path.

---

## 3. USD₮ testnet settlement leg — concrete integration

Goal: a demoable "move X test USD₮ from A to B and produce a verifiable tx proof," from a JS/Node app, with the **least friction**. We evaluated four rails.

### Options surveyed

| Rail | What it is | Friction for JS/Node demo | Verdict |
|---|---|---|---|
| **Tether WDK on Ethereum Sepolia** | Tether's own self-custodial multi-chain Wallet Development Kit; EVM module transfers ERC-20 USD₮ | **Lowest.** `npm i`, seed phrase, one `transfer()` call, real Sepolia tx hash. It's *Tether's own SDK* — maximal narrative fit for a Tether Developers Cup | ✅ **Chosen** |
| **USDT0 / Plasma testnet** | Plasma L1 (chainId 9746, `https://testnet-rpc.plasma.to`, gas token XPL) with zero-fee USD₮ transfers; USDT0 = omnichain USD₮ | Low-medium. Great "gasless USD₮" story, but adds a second network + XPL faucet + relayer concepts. Strong **v2** | ➡️ v2 |
| **Sepolia raw ERC-20 (ethers.js/viem)** | Hand-rolled `Contract.transfer()` against a test USDT token | Low, but we re-implement what WDK gives us and lose the Tether-SDK narrative | Fallback |
| **Lightning (Pear Credit precedent)** | Holepunch's own P2P-payments direction (Keet tipping / Pear Credit), Lightning-rail | Medium-high for a 1-week USD₮ demo; excellent *thematic* precedent to cite (P2P + Holepunch) but not the fastest USD₮ path | Cite as precedent |

**Decision: Tether WDK → Ethereum Sepolia test USD₮.** It is the lowest-friction JS/Node path, it produces a real on-chain tx hash for proof, and it is *Tether's own toolkit* — the strongest possible fit for this competition. Plasma/USDT0 is the natural v2 upgrade for gasless/omnichain USD₮.

### WDK — exact integration

**Packages** (npm, `@tetherto` scope):
```bash
npm install @tetherto/wdk @tetherto/wdk-wallet-evm
# for the v1 escrow smart-account path (2-of-3), also:
# npm install @tetherto/wdk-wallet-evm-erc-4337
```

**Ethereum Sepolia config** (chainId `11155111`). Use a real Sepolia RPC (e.g. `https://eth-sepolia.public.blastapi.io`, `https://rpc.sepolia.org`, or an Alchemy/Infura Sepolia key). WDK's own quickstart points at `https://eth.drpc.org` for mainnet — swap in a Sepolia RPC for the demo.

**Faucets for test ETH + test USD₮ on Sepolia:**
- Test USD₮ (WDK-recommended): **Pimlico test-ERC20 faucet** — `https://dashboard.pimlico.io/test-erc20-faucet`, and **Candide** — `https://dashboard.candide.dev/faucet`. WDK's docs explicitly say to use these to "get some Sepolia USD₮."
- Sepolia gas ETH: **Alchemy** `https://www.alchemy.com/faucets/ethereum-sepolia`, **Chainlink** `https://faucets.chain.link/sepolia`.
- A commonly-referenced Sepolia test-USDT ERC-20 token address seen on Etherscan is `0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0` — **verify on `sepolia.etherscan.io` before wiring it in**, and prefer whatever token address the Pimlico/Candide faucet actually dispenses so balances show up. Do not hardcode an unverified address into the demo.

**Minimal "send X test USD₮ from A → B and get a tx proof" (WDK EVM):**
```javascript
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

// --- Sender (peer A) ---
// In Terrace, the seed phrase is generated per-peer and stored in the peer's
// own encrypted local store — Terrace/servers never see it (self-custodial).
const seedPhrase = process.env.WDK_SEED ?? WDK.getRandomSeedPhrase()

const wdk = new WDK(seedPhrase).registerWallet('ethereum', WalletManagerEvm, {
  provider: 'https://rpc.sepolia.org' // Sepolia RPC (chainId 11155111)
})

const account = await wdk.getAccount('ethereum', 0)
console.log('A address:', await account.getAddress())

// Sepolia test USD₮ token address (VERIFY against the faucet you used):
const TEST_USDT = '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0'

// Optional: estimate fee first
const quote = await account.quoteTransfer({
  token: TEST_USDT,
  recipient: '0xBUYER_OR_ESCROW_ADDRESS',
  amount: 25_000_000n // 25 USD₮ if token has 6 decimals -> 25 * 10^6
})
console.log('Estimated fee (wei):', quote.fee)

// --- The transfer ---
const result = await account.transfer({
  token: TEST_USDT,
  recipient: '0xBUYER_OR_ESCROW_ADDRESS',
  amount: 25_000_000n
})

// tx proof: the settlement hash we write back to the Autobase ledger
console.log('USD₮ transfer hash:', result.hash)   // -> verifiable on sepolia.etherscan.io
console.log('Fee paid (wei):', result.fee)
```

**Notes for the build:**
- `amount` is in the token's **base units**. Sepolia test USD₮ is typically 6 decimals → 1 USD₮ = `1_000_000n`. Confirm decimals via `getTokenBalance`/the token contract before demoing amounts.
- The **tx proof** for the ledger is `result.hash`. In the demo, opening `https://sepolia.etherscan.io/tx/<hash>` on screen is the "here is the real on-chain USD₮ movement" moment.
- For the **v1 escrow path**, `recipient` is the **escrow contract / 2-of-3 smart account address**, not the seller directly. Release from escrow is a second, quorum-signed transaction (see §2a). If the 2-of-3 escrow contract is not ready by demo day, `recipient` is the counterparty directly — that is the honest (c) fallback and must be labeled as such.
- Keep a funded "arbitrator/demo" wallet handy so the dispute path can be shown live.

### Why not the others for v1
- **Plasma/USDT0:** compelling gasless-USD₮ narrative but a second chain + XPL gas faucet (`gas.zip/faucet/plasma`, Chainstack, QuickNode) + relayer concepts = more moving parts than a week wants. Perfect v2.
- **Lightning / Pear Credit:** thematically ideal (Holepunch's own P2P-payments lineage) and worth citing as precedent that "P2P + Holepunch + stablecoin payments" is a real, endorsed direction — but standing up a Lightning USD₮ leg in a week is more friction than WDK-on-Sepolia. Cite it, don't build it for v1.

---

## 4. How the Autobase co-signed ledger works here

Autobase is a multi-writer append-only log built on Hypercore/Hyperbits: each peer has its own signed writer feed, and Autobase **deterministically linearizes** the set of writer feeds into one shared, causally-ordered view. For a trade, the two traders (and, for disputes, the arbitrator) are the **co-signing writers**. Because every entry is signed by its author's key and the linearization is deterministic and content-addressed, the shared trade history is **tamper-evident and non-repudiable**: no party can forge another's entry, silently delete history, or present a divergent order without it being detectable.

### One Autobase per trade (or per listing→trade)
Each trade is a small Autobase whose writers are `{sellerKey, buyerKey}` (+ `arbitratorKey` added on dispute). Peers replicate it over Hyperswarm. The linearized view is a **state machine** advanced by signed entries.

### What each peer writes (entry types)
Every entry: `{ type, tradeId, author (pubkey), timestamp, payload, prevHash }`, signed by `author`.

| Entry | Author | Payload (concrete) | Advances state to |
|---|---|---|---|
| `LISTING` | seller | matchId/section/seat, price in USD₮ (base units), delivery method, seller escrow signer pubkey | `LISTED` |
| `OFFER` | buyer | tradeId, offered price, buyer escrow signer pubkey, buyer payout address | `OFFERED` |
| `ACCEPT` | seller | agreed price, **escrow contract address / 2-of-3 signer set**, agreed arbitrator pubkey | `ACCEPTED` |
| `FUND` | buyer | on-chain **funding tx hash** (buyer→escrow), amount | `FUNDED` (verified against chain) |
| `DELIVER` | seller | ticket transfer proof: encrypted transfer code / platform-transfer receipt / handoff attestation | `DELIVERED` |
| `RELEASE` | buyer (+seller co-sign) | signature authorizing 2-of-3 release to seller; resulting **release tx hash** | `SETTLED` |
| `DISPUTE` | buyer or seller | reason code + evidence refs (hashes of screenshots/receipts already in the log) | `DISPUTED` |
| `RULING` | arbitrator | decision (release-to-seller / refund-to-buyer), the 2-of-3 signature it co-signs, resulting tx hash | `SETTLED` / `REFUNDED` |

### How co-signing + ordering gives tamper-evidence
- **Authorship is cryptographic:** each entry is signed by its writer's key; peers reject unsigned/mis-signed entries. A seller cannot fabricate a buyer `RELEASE`.
- **Order is deterministic:** Autobase's linearization + each entry's `prevHash` chain means the agreed sequence (`LISTED→OFFERED→ACCEPTED→FUNDED→…`) is reproducible by any replica. You cannot slip a `DELIVER` *before* `FUND` without it being visible.
- **On-chain anchors close the gap between record and reality:** `FUND`/`RELEASE`/`RULING` carry **real tx hashes**. Any peer independently re-verifies them against Sepolia (`getTransactionReceipt`) — the ledger says "buyer funded," the chain proves it. This binds the tamper-evident *record* to the tamper-proof *settlement*.
- **State transitions are validated, not trusted:** the linearized view only advances if the entry is a legal transition from the current state authored by the allowed party (e.g. only `buyer`+`seller` sigs, or `arbitrator`+one party, can produce `SETTLED`). Illegal entries are ignored by every replica identically.

### How a dispute is represented
A `DISPUTE` entry flips the trade to `DISPUTED` and (per the `ACCEPT` terms) admits `arbitratorKey` as a third writer. **All evidence already lives in the append-only log** — the `DELIVER` payload, timestamps, prior messages — so the arbitrator adjudicates against an immutable shared history rather than forwarded screenshots. The arbitrator emits a `RULING` that co-signs the 2-of-3 escrow release or refund; the resulting tx hash is written back, and the outcome (fault attribution) feeds the reputation/stake layer (§2d): the at-fault party's bond is slashed and their signed loss is permanently anchored in a record they cannot repudiate.

**Implementation note:** keep the escrow *funds* on-chain (Sepolia) and the *coordination/evidence* in Autobase. The ledger is the brain and the audit trail; the chain is the vault. This split is what makes Terrace serverless (no backend holds state or funds) while still answering "who holds the USD₮" with "a 2-of-3 contract, and here's the immutable record of everything that led to each release."

---

## 5. Demo-safe scope — what v1 claims on camera vs. roadmap

The escrow story survives judge scrutiny **only if the on-camera claims are exactly true.** Script the claims.

### ✅ Say on camera (true for v1)
- "For a **Terrace-issued fan-pass, the swap is atomic**: the ledger won't record settlement unless it reveals a secret `S` that hashes to the lock `H` on the listing, and that same `S` is the only key that decrypts the pass we replicated peer-to-peer. **The seller can't get paid without handing over the secret that unlocks the pass** — no escrow, no arbitrator, no oracle. This is shipped and there's a test that rejects a wrong preimage." *(Then add the honesty gate below.)*
- "The **atomicity is real and tested. The payment leg is still a labeled mock** — no real USD₮ moves on-chain yet. Wiring it to real WDK USD₮ is v2, and the atomic structure is exactly what makes that safe."
- "Terrace is **serverless** — Hyperswarm for peer discovery, an Autobase co-signed ledger for shared state, and a Hypercore blob that carries the encrypted pass peer-to-peer. No backend, no database, no operator custody."
- "**Terrace never holds funds or keys.** For the tokenized pass, nobody holds funds at all — the atomic swap means there's nothing to custody."
- "Every step — listing, offer, accept, and the settlement that reveals the preimage — is a **signed, tamper-evident entry** in the shared ledger. The receipt shows the pass going **LOCKED → UNLOCKED** the instant the secret is revealed."

### 🔜 Say as roadmap (v2 — do NOT present as shipped)
- "For **externally-issued** tickets we can't tokenize, v2 is the **Bisq/HodlHodl 2-of-3 escrow model** on Sepolia via **Tether's WDK**, settled in real test USD₮ with an Etherscan-verifiable tx hash. That's the immediate next milestone; the atomic swap we shipped is what proves the delivery-vs-reveal structure that escrow will settle against."

### ⚠️ Explicitly frame as bounded (say the honest limit before the judge does)
- "The atomic swap works because **Terrace issues the pass**, so 'is this asset real' isn't an external question. For a **real, externally-issued** FIFA ticket that we can't tokenize, atomicity is impossible — that's the **oracle problem**, and the v2 answer is 2-of-3 escrow + arbitration (the Bisq/HodlHodl position), not the atomic swap."
- "The v1 **payment leg is a labeled mock** — atomicity of delivery-vs-reveal is what's proven, not on-chain USD₮ movement. Real WDK USD₮ is the immediate next milestone."

### 🚫 Do NOT claim (would be a lie / overclaim)
- ❌ **Real on-chain USD₮ settlement.** The payment rail is a labeled mock in v1. The atomic swap makes *delivery-vs-reveal* atomic; it does **not** move real USD₮ yet. Claim the atomicity, never the settlement.
- ❌ Atomic money↔ticket swap for a **real, non-tokenized FIFA ticket.** The atomic swap is honest **only for a Terrace-issued fan-pass** (which we shipped). Externally-issued tickets can't be preimage-gated and fall back to v2 2-of-3 escrow.
- ❌ "No trust required anywhere" on the external-ticket path. (There the arbitrator is a bounded trust assumption. Say so. The tokenized-pass path genuinely needs no arbitrator.)
- ❌ Any implication that Terrace guarantees a real ticket scans at the gate.
- ❌ Presenting direct A→B settlement (the external-ticket fallback) using the word **"escrow."**

### The one honesty script you must say (payment leg is mock, atomicity is real)
Because the atomic swap is the headline, the seam a Bitcoin-savvy judge will probe is the payment rail — so name it first, truthfully:
> "The **atomic swap is real and tested**: for a Terrace-issued pass, the ledger won't record settlement without revealing the secret that decrypts the pass, so delivery and payment are one indivisible act — no escrow, no arbitrator, no oracle. The **payment leg itself is a labeled mock** right now; no real USD₮ moves on-chain yet. Wiring it to real testnet USD₮ via Tether's WDK is v2, and the atomic structure is exactly what makes that drop-in safe. For a **real, externally-issued FIFA ticket** — which we can't tokenize — the answer is 2-of-3 escrow, also v2; here's the design." *(Then show §2a.)*

The difference between "the swap is atomic" (true, tested) and "we settle real USD₮" (not yet) is exactly the seam to keep crisp. Claim the atomicity; never imply the settlement.

### v1 build checklist
- [x] Pears app skeleton: Hyperswarm discovery + per-trade Autobase with `{buyer, seller}` writers.
- [x] Ledger entry types + author-enforced state-machine validation (§4 table).
- [x] **HTLC atomic swap for a Terrace-issued tokenized fan-pass (headline):** `publishListing({...,passSecret})` mints `S`, secretbox-encrypts the pass, publishes only `H = generichash(S)` + ciphertext ref, replicates the ciphertext over a dedicated Hypercore blob; `apply()` rejects any settlement whose preimage doesn't hash to the listing's `H` (tested); `getPass(tradeId)` returns `{hasPass, locked, revealed, pass}`; `getReceipt` adds `hashlock`/`revealed`/`passUnlocked`.
- [x] Labeled **mock** payment leg (atomicity real; on-chain USD₮ not yet).
- [ ] **v2:** WDK EVM wallet per peer on Sepolia; real test-USD₮ leg wired into the reveal so settlement moves real USD₮ atomically (§3).
- [ ] **v2 (external tickets):** minimal 2-of-3 escrow contract (Solidity on Sepolia *or* WDK ERC-4337 smart account); fund → 2-of-3 release; arbitrator dispute path.
- [ ] **v2:** minimal reputation/stake: peer bond + trade count + slash-on-arbitrated-fault.

---

## Sources
- Tether WDK docs — overview, Node.js quickstart, EVM wallet module & ERC-20 transfer guide: [docs.wdk.tether.io](https://docs.wdk.tether.io/), [Node.js & Bare Quickstart](https://docs.wdk.tether.io/start-building/nodejs-bare-quickstart), [wallet-evm usage](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/usage), [wallet-evm-erc-4337 configuration](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/configuration), [bridge-usdt0-evm](https://docs.wdk.tether.io/sdk/bridge-modules/bridge-usdt0-evm)
- WDK GitHub: [github.com/tetherto/wdk](https://github.com/tetherto/wdk)
- Test USD₮ / gas faucets (Sepolia): [Pimlico test-ERC20 faucet](https://dashboard.pimlico.io/test-erc20-faucet), [Candide faucet](https://dashboard.candide.dev/faucet), [Alchemy Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia), [Chainlink Sepolia faucet](https://faucets.chain.link/sepolia)
- Sepolia test-USDT token reference (verify before use): [sepolia.etherscan.io/token/0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0](https://sepolia.etherscan.io/token/0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0)
- USDT0 / Plasma testnet (v2): [Plasma zero-fee USD₮ transfers](https://www.plasma.to/docs/plasma-chain/stablecoin-native-contracts/zero-fee-usdt-transfers), [USDT0 transfer tutorial](https://docs.usdt0.to/tutorial/how-to-transfer), Plasma testnet: chainId `9746`, RPC `https://testnet-rpc.plasma.to`, gas `XPL`; faucets [Chainlink](https://faucets.chain.link/plasma-testnet), [QuickNode](https://faucet.quicknode.com/plasma/testnet)
- Benchmark P2P escrow models: Bisq, RoboSats, HodlHodl (2-of-3 multisig escrow with arbitration) — prior art the design deliberately mirrors.
