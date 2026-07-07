# DoraHacks BUIDL — submission copy (paste-ready)

Everything you need to fill the DoraHacks BUIDL form for the **Tether Developers Cup · Pears track**. Copy the blocks as-is; swap in the demo-video link once recorded.

---

## Form fields (quick copy)

| Field | Value |
|-------|-------|
| **Name** | Terrace |
| **Track** | Pears (P2P) |
| **Tagline** | Serverless P2P World Cup fan‑value exchange, settled in USD₮ — built on Holepunch's Pears stack. |
| **Source code** | https://github.com/aAAaqwq/terrace |
| **Demo video** | ⟨paste the unlisted YouTube link here⟩ |
| **Tags** | Pears, Holepunch, Hyperswarm, Autobase, Hypercore, P2P, USDt, self-custody, HTLC, atomic-swap, privacy, serverless, World-Cup, tickets |
| **License** | MIT |

**One-liner (≤15 words):** Two fans, no platform, one Final ticket — paid and delivered peer‑to‑peer, atomically.

---

## Short description (~120 words — for the BUIDL summary)

**Terrace** is a serverless, peer‑to‑peer World Cup fan‑value exchange settled in USD₮, built on Holepunch's Pears stack. Two fans of different nations connect directly over Hyperswarm, pair through a proof‑of‑possession protomux handshake, and co‑sign a trade onto an **encrypted multi‑writer Autobase ledger** — the linearized log *is* the co‑signature, so neither party can forge a trade the other didn't independently sign. For a Terrace‑issued fan‑pass, delivery is **atomic (HTLC)**: the pass ships encrypted over a Hypercore blob and the ledger won't record settlement unless it reveals the one secret that decrypts it — the seller can't get paid without handing over the pass. No server, no scalper, no custodian. The atomicity is real and tested; the USD₮ payment leg is a labeled mock (v2: real testnet USD₮ via WDK).

---

## Full description (markdown — for the BUIDL body)

### The problem
World Cup ticket and fan‑value resale runs through scalpers, servers, and platforms that take a cut, leak data, and let fraud through. Between two strangers from different countries — an Argentina fan with a spare ticket, a France fan who wants it — there's no neutral, trustworthy rail, and cross‑border payment friction makes it worse.

### What Terrace is
A serverless P2P exchange where the "matching engine" is just two laptops and a co‑signed ledger. It's a **general fan‑value settlement rail**; the flagship asset is match tickets, demonstrated with transferable / self‑issued **fan‑passes** (real FIFA tickets are non‑transferable outside official resale — anchoring to an issuer credential is the v2 path).

### How it works (genuine Pears depth — six primitives)
- **Hyperswarm / HyperDHT** — serverless peer discovery + connection.
- **Protomux proof‑of‑possession pairing** — peers swap Autobase writer keys over the same encrypted stream that carries replication; a nonce challenge proves key ownership (anti‑spoof/replay).
- **Encrypted multi‑writer Autobase** — buyer and seller are both cryptographic writers on one shared, ordered log. The store is encrypted at rest with a key derived from the invite; only invite‑holders can read it.
- **Author‑enforced co‑signature** — `apply()` checks who actually authored each op: a listing must be signed by its seller, an acceptance by the seller, settlement by a party. A buyer **cannot forge** the seller's signature (tested).
- **HTLC atomic fan‑pass delivery** — the pass is secretbox‑encrypted, shipped over a dedicated **Hypercore** blob, and locked behind `H = generichash(S)`. Settlement is accepted only if it reveals `S` (hash‑matched to the listing's `H`), and `S` is the only key that decrypts the pass. Paid and delivered in one indivisible act; wrong/missing preimages are rejected (tested).
- **Hyperbee** view indexes listings/offers/trades; every trade yields a **verifiable receipt** (content hash + ledger height).

### What's real vs. mock (honest scope)
Real & tested: the P2P transport, PoP pairing, encrypted ledger, enforced co‑signature, and delivery‑vs‑reveal **atomicity**. Labeled mock: the USD₮ **payment leg** (no chain yet) — v2 wires it to real testnet USD₮ via Tether's WDK, and for externally‑issued tickets, 2‑of‑3 non‑custodial escrow on Sepolia.

### Try it (a judge can run it in a minute)
```bash
npm install
npm test            # 3 suites: co-sign + forgery-rejected + encryption + PoP; real two-peer swarm; HTLC atomicity
npm run scenario    # narrated end-to-end run over a real swarm
```
Live P2P in two terminals: `node test/node-peer.js host --nation ARG` (prints an invite) and `node test/node-peer.js join <INVITE> --nation FRA`. Desktop app: `pear run --dev .`. Full guide: [docs/HOW-TO-DEMO.md](HOW-TO-DEMO.md).

### Why it fits the Cup
Football/World Cup theme (two nations, a Final ticket); Pears‑track hard rule satisfied (all networking is Hyperswarm/Corestore/protomux/Autobase — no WebRTC, no server); and it extends **Pear Credit's** thesis (Tether + Holepunch P2P value transfer) into a tangible, self‑custodial, privacy‑preserving product.

---

## 90‑second live‑pitch spoken script (7/15–18 finalist round)

> "It's the night before the World Cup Final. Diego, in Buenos Aires, has a spare ticket. Camille, in Lyon, has been trying to get to this match for four years. Their only options today are a scalping site that triples the price, or a platform that holds both their money and can freeze the trade the night before kickoff.
>
> Terrace removes the platform entirely.
>
> Here's Diego's laptop, here's Camille's — no server between them. Hyperswarm finds them directly. They shake hands over protomux, and both of them, independently, write this trade into one shared Autobase ledger. Neither is trusting the other's word — the ledger *is* the signature, because both keys had to append for the trade to exist. Try to forge it as one party — the ledger rejects it.
>
> Now the ticket. It's already on Camille's machine — encrypted, delivered peer‑to‑peer, but locked. Diego settles, and settling forces him to reveal the one secret that both records the payment and decrypts the pass. There it is — paid and handed over in one atomic act. No escrow agent, no arbitrator.
>
> Honest line: the USD₮ payment leg is a labeled mock today — everything else, the transport, the encrypted co‑signed ledger, and that atomic delivery, is real and tested.
>
> This is Pear Credit's thesis, wearing a jersey: self‑custody, no server to hack, P2P value between two people who never had to trust anything but math. That's Terrace."

---

## Pre‑submission checklist (tick before you hit submit on DoraHacks)
- [ ] Repo public at https://github.com/aAAaqwq/terrace, MIT license present
- [ ] `npm install && npm test` passes on a fresh clone (all 3 suites)
- [ ] ≤3‑min demo video recorded (see [docs/DEMO-SCRIPT.md](DEMO-SCRIPT.md)) and uploaded to YouTube as **Unlisted**
- [ ] Demo video link pasted into the BUIDL + this doc's table
- [ ] BUIDL submitted to the **Tether Developers Cup**, **Pears** track, before the **7/8** cut
- [ ] Tagline, description, and tags pasted from above
- [ ] Commit history is public and shows progression (it does)
