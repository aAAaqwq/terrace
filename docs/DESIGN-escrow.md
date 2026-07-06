# Terrace — Escrow, Trust Model & USDt Settlement Design

**Project:** Terrace — serverless P2P World Cup fan-ticket exchange on Holepunch's Pears stack (Hyperswarm + Autobase co-signed ledger), settled in USD₮.
**Audience for this doc:** the build team, and by extension a Bitcoin-savvy judge (Guy Swann) who will benchmark Terrace against Bisq / RoboSats / HodlHodl multisig-escrow P2P trading and ask: **"Who holds the USD₮, and how is a dishonest counterparty stopped?"**

The one-sentence answer we must be able to say on camera and defend:

> **Terrace never holds user funds. USD₮ sits in a 2-of-3 escrow smart contract that neither Terrace nor either party can drain unilaterally. The Autobase co-signed ledger is the tamper-evident record of every listing, offer, acceptance, settlement proof and dispute — so cheating is provable, and reputation-costly, even in the cases escrow alone cannot prevent.**

This document is deliberately honest about what escrow *does* and *does not* solve. Overclaiming "trustless ticket delivery" in front of Guy Swann is the fastest way to lose. We claim exactly what multisig escrow gives us — no more.

---

## 1. Threat model

A P2P ticket-for-USD₮ trade has **two legs that must both complete**: the *money leg* (buyer → seller in USD₮) and the *delivery leg* (seller → buyer, the ticket). The whole problem is that these legs are not naturally atomic: money is an on-chain asset we can lock; a World Cup e-ticket is an off-chain fact (a transfer code, a FIFA/Ticketmaster account transfer, a barcode) we cannot cryptographically escrow. Every cheat exploits the gap between the two legs.

### Cheat A — Seller takes the USD₮ and never delivers the ticket
Buyer pays; seller disappears (or hands over an already-used / fake ticket). This is the dominant fraud in fan-ticket resale.

### Cheat B — Buyer receives the ticket but reverses / claims non-receipt
Buyer gets a valid transfer code, then claims "nothing arrived" to get the money back, or (on a chargeback-capable rail) reverses the payment. USD₮ on-chain has **no chargeback**, which already kills the pure-reversal version of this — but the "claims non-receipt" dispute version survives and must be adjudicated.

### What Terrace CAN guarantee
1. **Custody safety.** Terrace holds no keys and no funds. Escrowed USD₮ can only move by a 2-of-3 signature quorum. A compromise of Terrace's code, a shut-down laptop, or a malicious operator cannot steal funds. (Directly answers "who holds the USD₮": a contract, governed by keys the two traders and an arbitrator hold — not us.)
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

### (a) On-chain 2-of-3 multisig / smart-contract escrow with a P2P arbitrator
Buyer deposits USD₮ into an escrow contract keyed to `{buyer, seller, arbitrator}`. Release requires **any 2 of 3** signatures. Happy path: buyer + seller co-sign release. Dispute path: arbitrator + the honest party co-sign release-or-refund.

- **Feasibility (1wk):** Medium-high. A minimal escrow is ~120 lines of Solidity on Sepolia, or a 2-of-3 policy on a WDK ERC-4337 smart account (`@tetherto/wdk-wallet-evm-erc-4337`). Well-trodden; audited references abound (Bisq/HodlHodl are exactly this pattern). Main cost is arbitrator UX + on-chain demo choreography.
- **Credibility:** **Highest.** This *is* the Bisq/HodlHodl model. It's the answer Guy Swann is fishing for. "Who holds the USD₮?" → "A 2-of-3 escrow contract. Not us, not either party alone."
- **Honesty:** Clean. We only claim what 2-of-3 gives (no unilateral theft; bounded arbitrator trust). No overclaim.
- **Weakness:** Reintroduces an arbitrator trust assumption; needs the ticket-delivery oracle handled off-chain via evidence.

### (b) HTLC / hash-locked settlement
Lock USD₮ behind a hash `H`; funds release only when the preimage `S` is revealed on-chain, with a timelock refund. Genuinely atomic **iff the thing being bought is itself the secret `S`** — i.e. the ticket redemption requires exactly `S` and `S` is obtainable no other way (atomic-swap / Lightning-style).

- **Feasibility (1wk):** Medium for the contract; **the blocker is the ticket.** A FIFA/Ticketmaster e-ticket is not a preimage-gated asset — you cannot make ticket redemption require an arbitrary `S`. HTLC only becomes atomic if we *tokenize the ticket* (mint the transfer code as an NFT / redeemable secret we control), which we do not control for real World Cup inventory.
- **Credibility:** High *in theory* and rhetorically strong (RoboSats/Lightning lineage). But a judge will immediately ask "how does revealing the preimage deliver a real FIFA ticket?" and we'd have no honest answer for real inventory.
- **Honesty risk:** **High.** Demoing HTLC on two on-chain assets and implying it makes *real ticket delivery* atomic would be misleading. Only honest if we clearly scope it to "tokenized/self-issued tickets."
- **Verdict:** Excellent **v2** story for a *Terrace-native tokenized ticket* (see roadmap). Not an honest v1 for real fan tickets.

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

**v1 (what we build and demo): (a) 2-of-3 escrow contract on Sepolia holding test USD₮, coordinated and audit-trailed by the (c) Autobase co-signed ledger, with a minimal (d) reputation/stake layer.**

This is the honest, credible, buildable-in-a-week combination:
- **(a)** gives the real answer to "who holds the USD₮" and directly matches the Bisq/HodlHodl bar.
- **(c)** is the serverless, Pears-native differentiator — the tamper-evident shared record that no centralized exchange has and that makes arbitration evidence-based.
- **(d)** raises the cost of the residual (arbitrated) attacks.

**Honest fallback if the escrow contract or arbitrator UX slips before demo day:** ship **(c)+(d)** and *relabel truthfully* — "Terrace v1 is a self-custodial P2P settlement layer with a tamper-evident co-signed ledger and reputation staking; on-chain 2-of-3 escrow is the next milestone." Never demo (c) while *saying* "escrow." The whole submission's integrity rides on that distinction.

**v2 roadmap (say this out loud as the vision):**
1. **Bonded, selectable arbitrators** — arbitrators post stake, are chosen per-trade, and are slashable for provable collusion (moves us from "trust our arbitrator" toward HodlHodl's marketplace of arbitrators).
2. **HTLC atomic settlement for Terrace-native tokenized tickets (b)** — for inventory Terrace itself issues/controls (season-pass style, or partner integrations), make money↔ticket a true atomic swap. This is the only path to *actually* atomic delivery and it's an honest, bounded claim.
3. **N-of-M / threshold escrow** and cross-chain USD₮ via **USDT0** so settlement can ride Plasma's zero-fee USD₮ transfers or other chains.
4. **Ticketing-oracle integrations** (FIFA/Ticketmaster transfer-confirmation webhooks) to shrink the "did the ticket really arrive" arbitration surface.

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
- "Terrace is **serverless** — Hyperswarm for peer discovery, an Autobase co-signed ledger for shared state. No backend, no database, no operator custody."
- "**Terrace never holds funds or keys.** Every peer has a self-custodial wallet built on **Tether's own WDK**."
- "USD₮ is escrowed in a **2-of-3 contract** keyed to buyer, seller, and an arbitrator. **Release needs 2 of 3 signatures** — neither party, nor Terrace, can move it alone." *(Only if the contract ships. If not, see fallback.)*
- "Here is a **real USD₮ transfer on Ethereum Sepolia** — this tx hash, verifiable on Etherscan — recorded back into the ledger as settlement proof." *(Show the Etherscan tab.)*
- "Every step — listing, offer, accept, funding, delivery, dispute — is a **signed, tamper-evident entry** in the shared ledger. Disputes are judged against an **immutable shared history**, not screenshots."
- "This is the **Bisq/HodlHodl escrow model**, made serverless on Holepunch and settled in USD₮."

### ⚠️ Explicitly frame as bounded (say the honest limit before the judge does)
- "Escrow stops the *take-the-money-and-run* attack. It does **not** prove a ticket is genuine — that's an **oracle problem**, resolved by the arbitrator using the ledger's evidence trail. Same honest position Bisq and HodlHodl take."
- "v1 uses **one designated arbitrator** — a bounded 2-of-3 trust assumption. **Bonded, selectable, slashable arbitrators are on the roadmap.**"

### 🚫 Do NOT claim (would be a lie / overclaim)
- ❌ "Trustless" *ticket delivery* or fully *atomic* money↔ticket swap. (Not true for real, non-tokenized FIFA tickets — only for the v2 tokenized-ticket HTLC path.)
- ❌ "No trust required anywhere." (The arbitrator is a bounded trust assumption. Say so.)
- ❌ Any implication that Terrace guarantees the ticket scans at the gate.
- ❌ Presenting direct A→B settlement (the honest fallback) using the word **"escrow."**

### Fallback script (if the 2-of-3 contract isn't ready by demo day)
Ship (c)+(d) and say, truthfully:
> "v1 demonstrates **self-custodial P2P USD₮ settlement** with a **tamper-evident co-signed ledger** and **reputation staking** — cheating is provable and reputation-costly. **On-chain 2-of-3 escrow is the immediate next milestone**; here is the contract design and interface." *(Then show the escrow design from §2a as the plan.)*

This keeps the submission honest either way. The difference between "we built escrow" and "we designed escrow and built the settlement + ledger" is exactly the difference between a claim we can defend and one we cannot — and a Bitcoin-savvy judge will find the seam if we blur it.

### v1 build checklist (1 week)
- [ ] Pears app skeleton: Hyperswarm discovery + per-trade Autobase with `{buyer, seller}` writers.
- [ ] Ledger entry types + state-machine validation (§4 table).
- [ ] WDK EVM wallet per peer on Sepolia; test-USD₮ + gas from faucets (§3).
- [ ] Settlement leg: `account.transfer()` → write `hash` back as `FUND`/`RELEASE` proof; independent on-chain re-verification.
- [ ] **Stretch (headline):** minimal 2-of-3 escrow contract (Solidity on Sepolia *or* WDK ERC-4337 smart account); fund → 2-of-3 release; arbitrator dispute path.
- [ ] Minimal reputation/stake: peer bond + trade count + slash-on-arbitrated-fault.
- [ ] Demo choreography: happy path + one dispute path, both showing Etherscan proofs.

---

## Sources
- Tether WDK docs — overview, Node.js quickstart, EVM wallet module & ERC-20 transfer guide: [docs.wdk.tether.io](https://docs.wdk.tether.io/), [Node.js & Bare Quickstart](https://docs.wdk.tether.io/start-building/nodejs-bare-quickstart), [wallet-evm usage](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/usage), [wallet-evm-erc-4337 configuration](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/configuration), [bridge-usdt0-evm](https://docs.wdk.tether.io/sdk/bridge-modules/bridge-usdt0-evm)
- WDK GitHub: [github.com/tetherto/wdk](https://github.com/tetherto/wdk)
- Test USD₮ / gas faucets (Sepolia): [Pimlico test-ERC20 faucet](https://dashboard.pimlico.io/test-erc20-faucet), [Candide faucet](https://dashboard.candide.dev/faucet), [Alchemy Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia), [Chainlink Sepolia faucet](https://faucets.chain.link/sepolia)
- Sepolia test-USDT token reference (verify before use): [sepolia.etherscan.io/token/0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0](https://sepolia.etherscan.io/token/0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0)
- USDT0 / Plasma testnet (v2): [Plasma zero-fee USD₮ transfers](https://www.plasma.to/docs/plasma-chain/stablecoin-native-contracts/zero-fee-usdt-transfers), [USDT0 transfer tutorial](https://docs.usdt0.to/tutorial/how-to-transfer), Plasma testnet: chainId `9746`, RPC `https://testnet-rpc.plasma.to`, gas `XPL`; faucets [Chainlink](https://faucets.chain.link/plasma-testnet), [QuickNode](https://faucet.quicknode.com/plasma/testnet)
- Benchmark P2P escrow models: Bisq, RoboSats, HodlHodl (2-of-3 multisig escrow with arbitration) — prior art the design deliberately mirrors.
