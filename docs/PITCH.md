# Terrace — Pitch Narrative
### Tether Developers Cup, Pears Track — Live Pitch + DoraHacks Blurb

---

## 1. One-Liner + Elevator Pitch

**One-liner (13 words):**
> Two fans, no platform, one Final ticket — settled peer-to-peer in USDt.

**30-second elevator pitch:**
Terrace is a serverless ticket and fan-asset exchange for the World Cup, built on Holepunch's Pears stack. Two fans — different nations, no shared trust, no middleman — connect directly over Hyperswarm, pair through a protomux handshake, and co-sign a trade onto a shared multi-writer Autobase ledger. The linearized log itself is the signature. And for a Terrace-issued fan-pass, delivery is **atomic**: the pass is encrypted and delivered peer-to-peer, and the ledger won't record settlement unless it reveals the one secret that decrypts it — so the seller can't get paid without handing the buyer the pass, no escrow agent required. Every trade produces a verifiable receipt with a content hash and ledger height. Settlement is in USDt: today the atomicity is real and tested while the payment rail is a labeled mock, with a v2 path to real WDK USDt and, for externally-issued tickets, 2-of-3 non-custodial escrow on Sepolia. No scalper. No platform fee. No server to hack.

---

## 2. The Story — The Emotional Hook

It's the night before the Final. Diego, in Buenos Aires, has a ticket he can't use — a friend's visa fell through. Camille, in Lyon, has been trying to get to this match for four years. Right now, the only paths between them are: a scalping site that will 3x the price and might sell her a fake, or a resale platform that takes a cut, holds both their money in escrow they don't control, and can freeze the trade for "review" at 11pm the night before kickoff.

There is no reason a ticket between two fans should ever need a company in the middle. Diego and Camille don't need FIFA's server, a resale platform's database, or a bank's blessing. They need each other, and a way to prove — cryptographically, permanently — that the trade happened, was fair, and can't be denied by either side later.

Terrace is that path. Diego opens the app. Camille opens the app. Hyperswarm finds them directly — no server between Buenos Aires and Lyon. They shake hands over protomux. They agree on terms. Both of them **write** the trade into the same ledger. Neither one is trusting the other's word — the ledger *is* the agreement, and it exists because both of them put their name on it.

That's the moment this whole pitch lives in: an ARG seller and a FRA buyer, watching a receipt appear with a hash and a ledger height, knowing no company ever saw the trade, held the ticket, or touched the money.

---

## 3. Problem → Why Now → Why Pears → Why USDt

**Problem.** World Cup ticket resale today runs through three failure modes: scalping (price gouging with zero recourse), fraud (no cryptographic proof of transfer, just a screenshot and hope), and platform friction (fees, holds, and custody risk baked into every centralized secondary market). Layer in cross-border payment friction — a fan in Argentina and a fan in France settling in two different currencies, through two different banking systems, with FX spread eating the trade — and the "simple" act of one fan selling a spare ticket to another becomes a multi-day, multi-fee, multi-trust-assumption ordeal.

**Why now.** The 2026 World Cup is the first tournament-scale, high-stakes consumer event where P2P infrastructure (Hyperswarm/Autobase) and P2P dollar settlement (USDt) are both mature enough to combine into a real product, not a proof of concept. Ticket demand is global, cross-border, and time-boxed — exactly the shape of problem serverless P2P was built for.

**Why Pears.** Pears gives us exactly what a ticket trade needs and nothing it doesn't: direct peer discovery (Hyperswarm), a negotiated connection (protomux), and — critically — a **multi-writer ledger (Autobase)** where the append itself is the proof of mutual agreement. We're not using Pears as a chat transport with a value layer bolted on. The trade *is* the Autobase write. That's real depth, not a wrapper.

**Why USDt.** A ticket trade between an Argentine peso wallet and a euro account is an FX problem before it's a trust problem. USDt removes the currency question so the only remaining question is "did both parties agree" — which Autobase already answers. USDt is also the asset Tether's own WDK is built to move non-custodially, which is exactly the settlement primitive Terrace's v2 needs.

---

## 4. The "No Server" Reveal — The Signature Moment

This is the beat we build the live demo around, and it should land like a magic trick with the trick shown:

> "There is no backend running right now. There is no database. If I killed my Wi-Fi router, this laptop and that laptop —" *(point at two machines, ARG and FRA)* "— would still find each other. Watch."

Kill the mock server if one is even running (there shouldn't be one). Trigger discovery. Watch the two peers connect over Hyperswarm live, pair via protomux, and append the trade to Autobase — visibly, on screen, with both parties' writer keys shown before the log ever finalizes. Then surface the receipt: content hash + ledger height, generated with nobody's permission.

The reveal isn't "look, no server" as a slogan — it's the judges watching two machines find each other with literally nothing between them, and a cryptographic receipt appearing that neither peer could have produced alone.

---

## 5. Positioning

**vs. Bisq / RoboSats / HodlHodl (P2P multisig trading):**
Honest comparison, not a dodge — these are the right benchmark, and they've proven the P2P trading model works at scale for years. Terrace's difference is the primitive, not the ambition: Bisq/HodlHodl use Bitcoin multisig scripts as the trust anchor; Terrace uses an Autobase multi-writer ledger as the trust anchor, with the ticket itself as the traded asset, not a currency pair. That means the "co-signature" is native to the transport layer — the same swarm connection that finds your counterparty is the one you sign the trade over, no separate coordination server, no order book host, no arbitrator infrastructure to bootstrap. Where those systems solved "get two strangers to trust a Bitcoin trade," Terrace is solving "get two strangers to trust a *ticket* trade, settled in dollars, over infrastructure built specifically for P2P apps." v2's 2-of-3 escrow borrows the same non-custodial discipline Bisq pioneered — we're not claiming a better dispute model yet, we're claiming a better transport and a purpose-built asset class.

**vs. Ticketmaster / scalpers:**
Ticketmaster and secondary scalping markets share one structural flaw: a company sits in the middle of every trade, sets the fee, holds the funds or the inventory record, and can be a single point of failure, censorship, or breach. Terrace has no company in the middle. There's no platform to hack because there's no platform. There's no fee to a middleman because there's no middleman. The tradeoff we're honest about: Ticketmaster has ticket-authenticity infrastructure Terrace v1 doesn't — see objection #2 below.

---

## 6. Objection Handling — The 5 Hardest Questions

**Q1: Who holds the USDt?**
Nobody — and for our shipped path, nobody *needs* to. For a **Terrace-issued tokenized fan-pass, the swap is atomic** (shipped and tested, `npm test` green): the ledger refuses to record a settlement unless it reveals a preimage `S` whose `generichash(S)` equals the hashlock `H` published on the listing, and that same `S` is the only key that decrypts the pass ciphertext we replicated peer-to-peer. The seller can't reach "paid" without simultaneously handing the buyer the secret that unlocks the pass — so there is no window in which anyone is holding funds against an undelivered asset. No escrow agent, no arbitrator, no custody, because delivery and payment are one indivisible act. Honest boundary: the **atomicity is real and tested; the USDt payment leg itself is still a clearly-labeled mock** — no real USDt moves on-chain yet. Wiring that leg to real testnet USDt via Tether's WDK is v2, and the atomic-swap structure is exactly what makes that drop-in safe. For **externally-issued** tickets that we can't tokenize (a real FIFA e-ticket), atomicity is impossible, so the v2 answer there is 2-of-3 non-custodial escrow on Sepolia via WDK — buyer, seller, and a neutral third key, never Terrace. Either way Terrace never custodies funds.

**Q2: What about ticket authenticity — who's the oracle for "this ticket is real and this seller actually owns it"?**
This is the hardest open problem in the whole category, and we don't have a fully decentralized answer yet — nobody honestly does. Our answer today: the receipt proves the *trade* happened with cryptographic certainty (both parties signed, hash + ledger height are immutable) — it does not yet prove the underlying ticket was authentic before the trade. v2 direction: anchor to whatever verifiable ticket credential the issuer (FIFA/partner) can provide — a signed ticket ID, QR hash, or transferable NFT-style credential — and have the Autobase entry reference that credential's hash, so authenticity checking becomes "does this credential validate," a separate and solvable problem from "did these two parties agree to trade it."

**Q3: Why not just a smart contract?**
A smart contract solves settlement finality on a single chain, but it doesn't solve *discovery* — how do an ARG seller and a FRA buyer with no shared chain identity, no shared exchange, and no prior relationship find each other and negotiate terms in the first place? That's a P2P transport problem, and it's exactly what Hyperswarm/protomux solve. Our architecture separates concerns deliberately: Pears handles peer discovery, negotiation, and mutual agreement (Autobase); a chain-based escrow (v2) handles the actual dollar movement once both sides have already agreed. A pure smart-contract approach either requires a centralized order-book/matching service in front of it, or assumes both parties already found each other some other way — we're building the "already found each other" layer, which is the actual hard part for this use case.

**Q4: Is the Autobase use real depth, or dressed-up WebRTC?**
It's real, and it's checkable: the trade doesn't exist as a record until *both* peers, as independent Autobase writers, have appended to the shared log — the linearization of two writers' entries is the co-signature, not a signature scheme layered on top of a chat message. Delete either writer's key and the trade cannot be reconstructed or forged by the other party alone. That's the property we'd invite any judge to try to break in the demo: try to fabricate a receipt as only the buyer, without the seller's writer ever appending. You can't, because the log linearization requires both.

**Q5: What stops a dishonest counterparty — Diego takes Camille's USDt and never delivers proof of ticket transfer?**
For the shipped tokenized-pass path, **the atomic swap stops it structurally — there's nothing to adjudicate.** The ledger refuses to record a fan-pass settlement unless it reveals a preimage `S` whose `generichash(S)` equals the hashlock `H` published on the listing (and `H` is read from the *listing*, not the settling op, so a cheat can't pick their own lock — wrong/missing preimages are rejected, and there's a test that proves it). That same `S` is the only key that decrypts the peer-to-peer-replicated pass ciphertext. So Diego cannot reach the paid/settled state without simultaneously handing Camille the secret that unlocks the pass, and Camille cannot obtain the pass until that reveal happens. "Take the money and never deliver" isn't a risk we mitigate — it's a state the ledger won't enter. (Honest line: the atomicity is real and tested; the USDt payment leg is still a labeled mock, so this is proof of *delivery-vs-reveal* atomicity, not of real on-chain settlement yet.) For **externally-issued** tickets that can't be tokenized, this is exactly why v2 settlement is a 2-of-3 escrow rather than a direct handoff: funds release only when 2 of 3 keys (buyer, seller, neutral arbiter) sign off, adjudicated against the immutable Autobase record. But that arbitration only exists for the case the atomic swap can't reach — Terrace-issued assets need no arbiter at all.

---

## 7. Tether-Thesis Alignment

Terrace is what happens when you take Pear Credit's precedent — that Tether and Holepunch have already shown P2P credit and value coordination can work without a server — and push it into a consumer-legible, emotionally real product category. Self-custody isn't a footnote here; it's the entire reason two fans in different countries can trade without either one needing to trust a platform, a bank, or each other's word. "No server to hack" isn't a security slogan, it's a literal architectural fact visible in the demo. Privacy is a natural outcome, not a bolted-on feature: there's no central database logging who bought what from whom. And USDt is doing the one job only a P2P dollar-equivalent can do here — letting an ARG seller and a FRA buyer settle a real-world trade without either currency, or a bank, ever entering the conversation. Terrace is Pear Credit's thesis wearing a jersey.

---

## 8. The Ask / Vision Close

Today, Terrace proves the hardest part: two strangers, two nations, no server, one shared ledger they both had to sign. That's the foundation every P2P value-transfer product needs and almost nobody in this track is building. What we're asking for isn't just a prize — it's a signal that this direction is worth the next six months: wiring up the real WDK escrow, plugging in a ticket-issuer credential so authenticity closes the loop, and making Terrace the reference implementation for what a Pears-native, USDt-settled marketplace looks like. Every World Cup, every concert, every event with a scalping problem is the same shape of trade Diego and Camille just made. We built the hard 20% first — the trustless handshake — because that's the part that can't be faked, mocked, or added later.

---

## 9. 90-Second Live Pitch Script (word-for-word)

> "It's the night before the World Cup Final. Diego, in Buenos Aires, has a spare ticket. Camille, in Lyon, has been trying to get to this match for four years. Right now, the only way to connect them is a scalping site that triples the price, or a resale platform that holds both their money and can freeze the trade at 11pm the night before kickoff.
>
> Terrace removes the platform entirely.
>
> Here's Diego's laptop. Here's Camille's. There is no server running between them right now — no backend, no database. Watch: Hyperswarm finds them directly. They shake hands over protomux. And now — both of them, independently, write this trade into the same ledger. Autobase. Neither one is trusting the other's word. The ledger itself is the signature, because both of their keys had to append to it for this trade to exist at all.
>
> There's the receipt. Content hash. Ledger height. Generated with nobody's permission, held by no company.
>
> Settlement is in USDt, because an Argentine peso and a euro shouldn't need a bank to talk to each other. Today that's a labeled test rail so we could prove the handshake was real. Our v2 is 2-of-3 non-custodial escrow on Sepolia, using Tether's WDK — buyer, seller, and a neutral key, never Terrace, holding any funds.
>
> This is Pear Credit's precedent, made tangible: self-custody, no server to hack, and a real dollar-equivalent moving peer to peer between two people who never had to trust anything but math.
>
> Diego sold his ticket. Camille is going to the Final. Nobody in the middle took a cut, held their money, or could have stopped them.
>
> That's Terrace."

---

## DoraHacks Written Blurb (~120 words)

**Terrace** is a serverless, peer-to-peer World Cup ticket and fan-asset exchange settled in USDt, built on Holepunch's Pears stack. Two fans — different nations, no shared platform — connect directly over Hyperswarm, pair through a protomux handshake, and co-sign a ticket trade onto a shared multi-writer Autobase ledger. The linearized log itself is the co-signature: neither party can forge or fake a trade the other didn't independently append. Every trade produces a verifiable receipt with a content hash and ledger height. v1 demonstrates the full trustless handshake with labeled mock settlement; v2 moves to 2-of-3 non-custodial escrow on Sepolia via Tether's WDK. No scalpers, no platform fees, no server to breach — just two fans, one ticket, one ledger.
