/* ============================================================
   TERRACE — UI controller (vanilla ES module)
   Serverless P2P World Cup ticket exchange, settled in USD₮.

   The UI talks ONLY to window.TerraceCore (implemented by the
   core dev). A self-contained MOCK core is installed below when
   no real core is present, so this file is demoable standalone.

   Contract consumed (see report at end of file):
     start({nation}) getListings() publishListing(...)
     makeOffer(id)   acceptOffer(offerId) getReceipt(tradeId)
     on('peer'|'listing'|'trade'|'status', cb)
   ============================================================ */

/* ------------------------------------------------------------
   Reference data — 16 World Cup nations
   ------------------------------------------------------------ */
const NATIONS = [
  { code: 'ARG', name: 'Argentina',   flag: '🇦🇷' },
  { code: 'BRA', name: 'Brazil',      flag: '🇧🇷' },
  { code: 'FRA', name: 'France',      flag: '🇫🇷' },
  { code: 'ENG', name: 'England',     flag: '🏴' },
  { code: 'ESP', name: 'Spain',       flag: '🇪🇸' },
  { code: 'GER', name: 'Germany',     flag: '🇩🇪' },
  { code: 'POR', name: 'Portugal',    flag: '🇵🇹' },
  { code: 'NED', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'ITA', name: 'Italy',       flag: '🇮🇹' },
  { code: 'CRO', name: 'Croatia',     flag: '🇭🇷' },
  { code: 'MEX', name: 'Mexico',      flag: '🇲🇽' },
  { code: 'USA', name: 'USA',         flag: '🇺🇸' },
  { code: 'JPN', name: 'Japan',       flag: '🇯🇵' },
  { code: 'MAR', name: 'Morocco',     flag: '🇲🇦' },
  { code: 'NGA', name: 'Nigeria',     flag: '🇳🇬' },
  { code: 'URU', name: 'Uruguay',     flag: '🇺🇾' },
];
const NATION_BY_CODE = Object.fromEntries(NATIONS.map((n) => [n.code, n]));
function flagOf(code) { return (NATION_BY_CODE[code] || {}).flag || '🏳️'; }
function nameOf(code) { return (NATION_BY_CODE[code] || {}).name || code; }

/* ============================================================
   MOCK CORE — installed only when the real core is absent.
   Simulates a live swarm: peers join, listings arrive, offers
   land on your tickets, trades co-sign on a shared ledger.
   ============================================================ */
if (!window.TerraceCore) {
  window.TerraceCore = (() => {
    const listeners = { peer: [], listing: [], trade: [], status: [] };
    const emit = (ev, payload) => listeners[ev].forEach((cb) => { try { cb(payload); } catch (_) {} });

    let me = null;
    let ledgerHeight = 4128;
    let peerCount = 0;
    let listings = [];
    let writable = true;   // host is writable at once; a joiner awaits authorization
    let marketKey = null;  // the shareable invite (ledger bootstrap key)
    const trades = new Map();
    const passes = new Map(); // listingId -> { hashlock, transferCode, note } (HTLC fan-pass)

    const rid = (p) => p + Math.random().toString(36).slice(2, 8);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

    const MATCHES = [
      { match: 'ARG vs BRA', stage: 'Final · Estadio Azteca' },
      { match: 'FRA vs ENG', stage: 'Quarter-Final' },
      { match: 'ESP vs GER', stage: 'Group F · MD3' },
      { match: 'POR vs NED', stage: 'Round of 16' },
      { match: 'MEX vs USA', stage: 'Group A · Opener' },
      { match: 'JPN vs CRO', stage: 'Round of 16' },
      { match: 'MAR vs NGA', stage: 'Semi-Final' },
      { match: 'ITA vs URU', stage: 'Group C · MD2' },
    ];
    const SECTIONS = ['North Stand', 'Terrace 118', 'Block 204', 'Home End', 'Ultras 5', 'Lower Tier 12'];
    const seat = () => `Row ${2 + Math.floor(Math.random() * 40)}, Seat ${1 + Math.floor(Math.random() * 28)}`;
    const otherNations = () => NATIONS.filter((n) => !me || n.code !== me.nation);

    function makeListing(nationCode) {
      const m = pick(MATCHES);
      return {
        id: rid('lst_'),
        match: m.match,
        section: pick(SECTIONS),
        seat: seat(),
        priceUsdt: [85, 120, 160, 210, 240, 320, 480, 520][Math.floor(Math.random() * 8)],
        nation: nationCode,
        sellerId: rid('peer_'),
        ts: Date.now(),
        status: 'open',
        _stage: m.stage,
      };
    }

    // Seal a listing as a tokenized fan-pass: fabricate a hashlock and stash the
    // encrypted transfer code, revealed only once the trade settles (HTLC-style).
    function attachPass(listing, transferCode, note) {
      const hashlock = hex(64);
      passes.set(listing.id, {
        hashlock,
        transferCode,
        note: note || 'Single-use mobile transfer · scan at the turnstile',
      });
      return { ...listing, hashlock, pass: { kind: 'terrace-fan-pass', ref: rid('pass_') } };
    }

    // seed a handful of open listings from "other" nations
    function seed() {
      const pool = otherNations();
      listings = Array.from({ length: 5 }, () => makeListing(pick(pool).code));
      // make the first one a marquee Final — and seal it with a tokenized fan-pass
      listings[0] = attachPass(
        { ...listings[0], match: 'ARG vs BRA', _stage: 'Final · Estadio Azteca', priceUsdt: 520 },
        'FIFA26-FINAL-' + hex(6).toUpperCase(),
        'Sealed fan-pass · revealed to the buyer the instant settlement co-signs',
      );
    }

    // drive a trade through offered → cosigned → settled
    function driveTrade(trade, { fromOffered }) {
      trades.set(trade.id, trade);
      const step2 = () => {
        const t2 = { ...trades.get(trade.id), state: 'cosigned', sellerSig: 'ed:' + hex(8), buyerSig: 'ed:' + hex(8) };
        trades.set(t2.id, t2);
        ledgerHeight += 1;
        emit('trade', t2);
        setTimeout(step3, 1500 + Math.random() * 900);
      };
      const step3 = () => {
        const t3 = { ...trades.get(trade.id), state: 'settled' };
        trades.set(t3.id, t3);
        ledgerHeight += 1;
        // flip the underlying listing to settled
        const li = listings.find((l) => l.id === t3.listingId);
        if (li) li.status = 'settled';
        emit('trade', t3);
      };
      if (fromOffered) {
        emit('trade', trade); // surface the offered state first
        // remote counterparty co-signs shortly after
        setTimeout(step2, 1400 + Math.random() * 1000);
      } else {
        setTimeout(step2, 1200 + Math.random() * 800);
      }
    }

    return {
      // invite present => joining an existing market (must await host
      // authorization before becoming a writer); absent => hosting a new one.
      async start({ nation, invite } = {}) {
        const joining = !!(invite && /^[0-9a-f]{64}$/i.test(String(invite)));
        me = { peerId: rid('you_'), nation };
        marketKey = joining ? String(invite).toLowerCase() : hex(64);
        writable = !joining; // a joiner is not yet a co-writer
        seed();

        // simulate the swarm filling up
        setTimeout(() => {
          const joins = 3 + Math.floor(Math.random() * 4);
          let i = 0;
          const tick = () => {
            if (i++ >= joins) return;
            peerCount += 1;
            const n = pick(otherNations());
            emit('peer', { peerId: rid('peer_'), nation: n.code, count: peerCount });
            emit('status', { connected: true, peers: peerCount, writable });
            setTimeout(tick, 500 + Math.random() * 700);
          };
          emit('status', { connected: true, peers: 0, writable });
          tick();
        }, 350);

        // a joiner gets authorized as a co-writer by the host shortly after
        // pairing — this is the ~20s block the real core can impose, compressed.
        if (joining) {
          setTimeout(() => {
            writable = true;
            emit('status', { connected: true, peers: peerCount, writable: true });
          }, 3400 + Math.random() * 900);
        }

        // periodically, a new listing floats in from a peer
        setInterval(() => {
          if (peerCount === 0) return;
          const n = pick(otherNations());
          const l = makeListing(n.code);
          listings = [l, ...listings].slice(0, 24);
          emit('listing', l);
        }, 9000 + Math.random() * 4000);

        return {
          peerId: me.peerId,
          nation: me.nation,
          bootstrap: marketKey,
          invite: marketKey,
          isHost: !joining,
          writable
        };
      },

      async getListings() {
        return listings.map((l) => ({ ...l }));
      },

      async publishListing({ match, section, seat, priceUsdt, nation, passSecret }) {
        let l = {
          id: rid('lst_'),
          match, section, seat,
          priceUsdt: Number(priceUsdt),
          nation,
          sellerId: me.peerId,
          ts: Date.now(),
          status: 'open',
          _stage: 'Listed by you',
        };
        // If a transfer code was supplied, this listing is a tokenized fan-pass.
        if (passSecret && String(passSecret).trim()) {
          l = attachPass(l, String(passSecret).trim(), 'Sealed by you · revealed to the buyer at settlement');
        }
        listings = [l, ...listings];
        // A remote buyer discovers your ticket and makes an offer.
        setTimeout(() => {
          const buyer = pick(otherNations());
          const offerId = rid('off_');
          const trade = {
            id: rid('trd_'),
            listingId: l.id,
            offerId,                       // mock surfaces offerId on the offered trade
            buyerId: rid('peer_'),
            sellerId: me.peerId,
            buyerNation: buyer.code,
            sellerNation: me.nation,
            priceUsdt: l.priceUsdt,
            state: 'offered',
            buyerSig: 'ed:' + hex(8),
            sellerSig: null,
            ts: Date.now(),
            _incoming: true,
          };
          l.status = 'pending';
          trades.set(trade.id, trade);
          emit('trade', trade);            // UI shows "accept & co-sign"
        }, 4200 + Math.random() * 2600);
        return { ...l };
      },

      async makeOffer(listingId) {
        const l = listings.find((x) => x.id === listingId);
        if (!l) throw new Error('listing gone');
        l.status = 'pending';
        const offer = {
          id: rid('off_'),
          listingId,
          buyerId: me.peerId,
          buyerNation: me.nation,
          ts: Date.now(),
        };
        // The remote seller co-signs on the shared ledger — streamed as trade events.
        const trade = {
          id: rid('trd_'),
          listingId,
          buyerId: me.peerId,
          sellerId: l.sellerId,
          buyerNation: me.nation,
          sellerNation: l.nation,
          priceUsdt: l.priceUsdt,
          state: 'offered',
          buyerSig: 'ed:' + hex(8),
          sellerSig: null,
          ts: Date.now(),
        };
        setTimeout(() => driveTrade(trade, { fromOffered: false }), 300);
        return offer;
      },

      async acceptOffer(offerId) {
        // find the offered trade carrying this offerId (you = seller, co-signing)
        let target = null;
        for (const t of trades.values()) if (t.offerId === offerId) target = t;
        if (!target) throw new Error('offer gone');
        const t = { ...target, state: 'cosigned', sellerSig: 'ed:' + hex(8) };
        trades.set(t.id, t);
        ledgerHeight += 1;
        emit('trade', t);
        setTimeout(() => {
          const s = { ...trades.get(t.id), state: 'settled' };
          trades.set(s.id, s);
          ledgerHeight += 1;
          const li = listings.find((l) => l.id === s.listingId);
          if (li) li.status = 'settled';
          emit('trade', s);
        }, 1500 + Math.random() * 800);
        return { ...t };
      },

      async getReceipt(tradeId) {
        const t = trades.get(tradeId);
        if (!t) throw new Error('trade gone');
        const l = listings.find((x) => x.id === t.listingId) || {};
        const p = passes.get(t.listingId) || null;
        const settled = t.state === 'settled';
        return {
          tradeId,
          match: l.match || '—',
          seat: [l.section, l.seat].filter(Boolean).join(' · ') || '—',
          priceUsdt: t.priceUsdt,
          buyerNation: t.buyerNation,
          sellerNation: t.sellerNation,
          ledgerHeight,
          hash: hex(40),
          ts: Date.now(),
          // HTLC fan-pass: null for classic listings, hex hashlock otherwise.
          hashlock: p ? p.hashlock : null,
          revealed: p ? settled : false,
          passUnlocked: p ? settled : false,
        };
      },

      // HTLC fan-pass state for a trade. Locked (secret sealed) before settlement,
      // revealed with the transfer code the instant the trade settles — atomically.
      async getPass(tradeId) {
        const t = trades.get(tradeId);
        if (!t) throw new Error('trade gone');
        const p = passes.get(t.listingId) || null;
        if (!p) return { hasPass: false, locked: false, revealed: false, hashlock: null, pass: null };
        if (t.state !== 'settled') {
          return { hasPass: true, locked: true, revealed: false, hashlock: p.hashlock, pass: null };
        }
        const l = listings.find((x) => x.id === t.listingId) || {};
        return {
          hasPass: true,
          locked: false,
          revealed: true,
          hashlock: p.hashlock,
          pass: {
            kind: 'terrace-fan-pass',
            match: l.match || '—',
            section: l.section || '',
            seat: l.seat || '',
            transferCode: p.transferCode,
            note: p.note,
          },
        };
      },

      // For a hashlocked trade the core auto-reveals the secret on settle.
      async settleTrade(tradeId) {
        const t = trades.get(tradeId);
        if (!t) throw new Error('trade gone');
        if (t.state !== 'settled') {
          const s = { ...t, state: 'settled' };
          trades.set(s.id, s);
          ledgerHeight += 1;
          const li = listings.find((l) => l.id === s.listingId);
          if (li) li.status = 'settled';
          emit('trade', s);
        }
        return { ok: true, settled: true };
      },

      on(ev, cb) { if (listeners[ev]) listeners[ev].push(cb); },
    };
  })();
  window.__TERRACE_MOCK__ = true;
}

/* ============================================================
   APP STATE
   ============================================================ */
const core = window.TerraceCore;
const state = {
  me: null,                 // { peerId, nation }
  selectedNation: null,
  connected: false,
  peers: 0,
  activeTab: 'market',
  listings: [],             // Listing[]
  trades: new Map(),        // id -> Trade
  offerMeta: new Map(),     // tradeId -> { offerId }  (for acceptOffer)
  receipts: new Map(),      // tradeId -> Receipt
  passes: new Map(),        // tradeId -> getPass() result (revealed HTLC fan-pass)
  passUnlockedUI: new Set(),// tradeIds whose LOCKED→UNLOCKED reveal already played
  seenTrades: new Set(),    // tradeIds already toasted at 'offered'
  newBadge: 0,              // unseen settled/trade badge for Trades tab
  // in-app invite + authorization
  mode: 'host',             // onboarding: 'host' | 'join'
  inviteInput: '',          // pasted invite (join mode)
  isHost: true,             // resolved after start()
  invite: null,             // this market's shareable key
  writable: true,           // may I write to the ledger yet?
  justAuthorized: false,    // transient success flag for the auth banner
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const truncId = (id) => (id ? id.slice(0, 4) + '…' + id.slice(-4) : '—');
const truncHash = (h) => (h ? '0x' + h.slice(0, 10) + '…' + h.slice(-6) : '—');
const money = (n) => Number(n).toLocaleString('en-US');

const HEX64 = /^[0-9a-f]{64}$/i;
const isHex64 = (s) => typeof s === 'string' && HEX64.test(s.trim());

/* Copy to clipboard with a Bare/Pear-safe fallback. */
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) { return false; }
}

/* Deterministic content fingerprint over the human-readable receipt fields.
   Pure JS (FNV-1a x2 => 16 hex chars) so tampering ANY visible field yields a
   different fingerprint than the one anchored at settlement. Never fakes a pass. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0);
}
function receiptFingerprint(f) {
  const canon = [
    f.match, f.seat, String(f.priceUsdt),
    f.buyerNation, f.sellerNation, String(f.ledgerHeight), String(f.hash),
  ].join('␟');
  const a = fnv1a(canon);
  const b = fnv1a(canon + '::' + a.toString(16));
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/* ============================================================
   ONBOARDING
   ============================================================ */
function renderOnboarding() {
  const root = $('#onboarding');
  root.innerHTML = `
    <section class="onboard-hero">
      <div>
        <span class="wordmark"><span class="dot"></span>Terrace<sup>P2P</sup></span>
      </div>
      <div>
        <span class="kicker">Tether Developers Cup · Pears Track</span>
        <h1>Own the<br>Terrace.<em>Trade the ticket.</em></h1>
        <p class="onboard-lede">
          A serverless fan-to-fan exchange for World Cup tickets, settled in
          USD₮ and co-signed peer-to-peer. No box office. No scalper. No relay to kill.
        </p>
        <div class="onboard-tags">
          <span class="tag">Hyperswarm discovery</span>
          <span class="tag">Autobase co-signed ledger</span>
          <span class="tag">Settled in <b>USD₮</b></span>
        </div>
      </div>
      <div style="color:var(--chalk-faint);font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase">
        No server &nbsp;/&nbsp; No custodian &nbsp;/&nbsp; No counterparty trust
      </div>
    </section>

    <section class="onboard-pick">
      <div class="pick-head">
        <div>
          <span class="kicker">Step 01</span>
          <h2>Pick your nation,<br>enter the swarm</h2>
        </div>
        <span class="step">16 sides · live</span>
      </div>
      <div class="nation-grid" id="nationGrid" role="listbox" aria-label="Choose your nation"></div>

      <div class="mode-block">
        <span class="kicker" style="margin-bottom:12px">Step 02 · Open or enter a market</span>
        <div class="mode-seg" role="tablist" aria-label="Host a new market or join with an invite">
          <button type="button" class="mode-opt selected" data-mode="host" role="tab" aria-selected="true">
            <span class="mo-ico">✦</span>
            <span class="mo-t">Host a new market</span>
            <span class="mo-d">Open a fresh co-signed ledger, then share the invite</span>
          </button>
          <button type="button" class="mode-opt" data-mode="join" role="tab" aria-selected="false">
            <span class="mo-ico">⤵</span>
            <span class="mo-t">Join with an invite</span>
            <span class="mo-d">Paste a friend's 64-character market key</span>
          </button>
        </div>
        <div class="invite-entry" id="inviteEntry" hidden>
          <label for="inviteInput">Market invite key</label>
          <div class="invite-input-row" id="inviteInputRow">
            <input id="inviteInput" type="text" spellcheck="false" autocomplete="off"
              inputmode="latin" placeholder="paste the 64-character hex invite…" aria-describedby="inviteNote" />
            <span class="invite-flag" id="inviteFlag" aria-hidden="true"></span>
          </div>
          <p class="invite-note" id="inviteNote">64 hex characters (0–9, a–f). Ask the host to send you theirs.</p>
        </div>
      </div>

      <div class="pick-foot">
        <button class="btn" id="enterBtn" disabled>
          <span id="enterLabel">Host the market</span> <span class="arw">→</span>
        </button>
        <span class="hint" id="pickHint">Choose the colours you'll trade under.</span>
      </div>
    </section>
  `;

  const grid = $('#nationGrid', root);
  NATIONS.forEach((n) => {
    const card = el('button', 'nation');
    card.type = 'button';
    card.setAttribute('role', 'option');
    card.dataset.code = n.code;
    card.innerHTML = `<span class="flag">${n.flag}</span><span class="name">${n.name}</span>`;
    card.addEventListener('click', () => selectNation(n.code));
    grid.appendChild(card);
  });

  root.querySelectorAll('.mode-opt').forEach((b) => {
    b.addEventListener('click', () => selectMode(b.dataset.mode));
  });
  const inviteInput = $('#inviteInput', root);
  inviteInput.addEventListener('input', () => {
    state.inviteInput = inviteInput.value;
    validateInvite();
    updateEnter();
  });
  inviteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('#enterBtn').disabled) enterSwarm();
  });

  $('#enterBtn', root).addEventListener('click', enterSwarm);
}

function selectNation(code) {
  state.selectedNation = code;
  document.querySelectorAll('.nation').forEach((c) => {
    c.classList.toggle('selected', c.dataset.code === code);
    c.setAttribute('aria-selected', c.dataset.code === code ? 'true' : 'false');
  });
  $('#pickHint').innerHTML = `Trading under <b>${flagOf(code)} ${nameOf(code)}</b> — ${state.mode === 'join' ? 'paste an invite to join.' : 'ready when you are.'}`;
  updateEnter();
}

function selectMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-opt').forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const entry = $('#inviteEntry');
  if (entry) entry.hidden = mode !== 'join';
  const label = $('#enterLabel');
  if (label) label.textContent = mode === 'join' ? 'Join the market' : 'Host the market';
  if (mode === 'join') {
    const inp = $('#inviteInput');
    if (inp) setTimeout(() => inp.focus(), 40);
    validateInvite();
  }
  updateEnter();
}

function validateInvite() {
  const row = $('#inviteInputRow');
  const flag = $('#inviteFlag');
  const note = $('#inviteNote');
  if (!row || !flag || !note) return;
  const v = (state.inviteInput || '').trim();
  if (v.length === 0) {
    row.classList.remove('ok', 'bad');
    flag.textContent = '';
    note.textContent = '64 hex characters (0–9, a–f). Ask the host to send you theirs.';
    return;
  }
  if (isHex64(v)) {
    row.classList.add('ok'); row.classList.remove('bad');
    flag.textContent = '✓';
    note.innerHTML = 'Valid market key — <b>ready to join</b>.';
  } else {
    row.classList.add('bad'); row.classList.remove('ok');
    flag.textContent = '✕';
    note.textContent = `Not a valid key yet — ${v.length}/64 hex chars.`;
  }
}

function updateEnter() {
  const btn = $('#enterBtn');
  if (!btn) return;
  const ready = !!state.selectedNation && (state.mode === 'host' || isHex64(state.inviteInput));
  btn.disabled = !ready;
}

async function enterSwarm() {
  if (!state.selectedNation) return;
  const joining = state.mode === 'join';
  const invite = joining ? (state.inviteInput || '').trim().toLowerCase() : null;
  if (joining && !isHex64(invite)) return;

  const btn = $('#enterBtn');
  btn.disabled = true;
  btn.innerHTML = `${joining ? 'Joining the market' : 'Opening the market'}… <span class="arw">◍</span>`;
  try {
    const res = await core.start({ nation: state.selectedNation, invite });
    state.me = { peerId: res.peerId, nation: res.nation };
    state.isHost = res.isHost != null ? !!res.isHost : !invite;
    state.invite = res.invite || res.bootstrap || window.__TERRACE_INVITE__ || invite || null;
    state.writable = res.writable !== undefined ? !!res.writable : true;
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = 'Retry <span class="arw">→</span>';
    toast('heat', '⚠️', 'Could not join the swarm', String(err.message || err));
    return;
  }
  $('#onboarding').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await bootApp();
}

/* ============================================================
   APP SHELL
   ============================================================ */
async function bootApp() {
  renderShell();
  wireCoreEvents();
  updateAuthState();
  await loadListings();
  switchTab('market');
}

function renderShell() {
  const app = $('#app');
  app.innerHTML = `
    <header class="topbar">
      <span class="wordmark"><span class="dot"></span>Terrace<sup>P2P</sup></span>
      <div class="topbar-right">
        <div class="role-badge ${state.isHost ? 'host' : 'guest'}" id="roleBadge"
          title="${state.isHost ? 'You opened this market' : 'You joined via invite'}">
          <span class="rb-dot"></span>${state.isHost ? 'Host' : 'Guest'}
        </div>
        <div class="status" id="statusPill" title="Live swarm status">
          <span class="live"></span>
          <span><span class="full">Connecting to swarm…</span></span>
        </div>
        <div class="me-chip">
          <span class="flag">${flagOf(state.me.nation)}</span>
          <span class="meta">
            <span class="lbl">You · ${nameOf(state.me.nation)}</span>
            <span class="pid">${truncId(state.me.peerId)}</span>
          </span>
        </div>
      </div>
    </header>
    <nav class="tabs" id="tabs">
      <button class="tab" data-tab="market">◆ Marketplace</button>
      <button class="tab" data-tab="publish">＋ List a ticket</button>
      <button class="tab" data-tab="trades">✓ Trades &amp; receipts <span class="count" id="tradeCount">0</span></button>
    </nav>
    <div class="auth-banner" id="authBanner" role="status" aria-live="polite"></div>
    <main class="view" id="view" aria-live="polite"></main>
  `;
  $('#tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t) switchTab(t.dataset.tab);
  });
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  if (tab === 'trades') { state.newBadge = 0; updateTradeBadge(); }
  const view = $('#view');
  view.scrollTop = 0;
  if (tab === 'market') renderMarket(view);
  else if (tab === 'publish') renderPublish(view);
  else if (tab === 'trades') renderTrades(view);
}

/* ============================================================
   CORE EVENT WIRING
   ============================================================ */
function wireCoreEvents() {
  core.on('status', ({ connected, peers, writable }) => {
    state.connected = connected;
    if (typeof peers === 'number') state.peers = peers;
    if (typeof writable === 'boolean') setWritable(writable);
    updateStatusPill();
  });
  core.on('peer', ({ nation, count }) => {
    if (typeof count === 'number') state.peers = count;
    state.connected = true;
    updateStatusPill();
    if (nation) toast('', flagOf(nation), `${nameOf(nation)} fan joined the terrace`, 'peer connected · direct');
  });
  core.on('listing', (listing) => onNewListing(listing));
  core.on('trade', (trade) => onTradeUpdate(trade));
}

function updateStatusPill() {
  const pill = $('#statusPill');
  if (!pill) return;
  pill.classList.toggle('on', state.connected && state.peers >= 0 && state.connected);
  const label = state.connected
    ? `Connected · <b>${state.peers}</b> ${state.peers === 1 ? 'fan' : 'fans'} online`
    : `<span class="full">Connecting to swarm…</span>`;
  pill.querySelector('span:last-child').innerHTML = state.connected
    ? `<span class="full">${label}</span>`
    : label;
}

function updateTradeBadge() {
  const c = $('#tradeCount');
  if (!c) return;
  c.textContent = state.newBadge;
  c.classList.toggle('show', state.newBadge > 0);
}

/* ---------- writable / authorization ---------- */
function setWritable(next) {
  if (next === state.writable) return;
  const gainedAccess = next && !state.writable;
  state.writable = next;
  if (gainedAccess) {
    state.justAuthorized = true;
    toast('tether', '✓', 'Authorized as a co-writer',
      'The host added your key to the ledger — publish, offer & co-sign are live.');
    setTimeout(() => { state.justAuthorized = false; updateAuthState(); }, 6000);
  }
  updateAuthState();
  // rebuild the active view so gated controls reflect the new permission
  if (state.activeTab === 'market') paintListings();
  else if (state.activeTab === 'publish') renderPublish($('#view'));
  else if (state.activeTab === 'trades') renderTrades($('#view'));
}

function updateAuthState() {
  const banner = $('#authBanner');
  if (!banner) return;
  if (!state.writable) {
    banner.className = 'auth-banner show waiting';
    banner.innerHTML = `
      <span class="ab-spin" aria-hidden="true"></span>
      <div class="ab-copy">
        <b>Getting authorized as a co-writer…</b>
        <span class="ab-sub">The host is adding your key to the shared ledger. Publishing, offers and co-signing unlock automatically — no need to click and wait.</span>
      </div>`;
  } else if (state.justAuthorized) {
    banner.className = 'auth-banner show ok';
    banner.innerHTML = `
      <span class="ab-check" aria-hidden="true">✓</span>
      <div class="ab-copy">
        <b>Authorized — you're a co-signer on the ledger</b>
        <span class="ab-sub">Every trade you touch is now signed by your key. You can publish, offer and co-sign.</span>
      </div>`;
  } else {
    banner.className = 'auth-banner';
    banner.innerHTML = '';
  }
}

/* Disable a write action until the ledger authorizes us. Returns true if OK. */
function gateWrite(btn) {
  if (state.writable) return true;
  btn.disabled = true;
  btn.classList.add('locked');
  btn.title = 'Waiting for the host to authorize you as a co-writer…';
  return false;
}

/* ============================================================
   MARKETPLACE
   ============================================================ */
async function loadListings() {
  try {
    state.listings = await core.getListings();
  } catch (err) {
    state.listings = [];
    toast('heat', '⚠️', 'Could not load listings', String(err.message || err));
  }
}

function renderMarket(view) {
  view.innerHTML = `
    ${state.isHost && state.invite ? hostInviteMarkup() : ''}
    <div class="sec-head">
      <div class="titles">
        <span class="kicker">Live order book · direct from peers</span>
        <h2>The <em>Marketplace</em></h2>
      </div>
      <button class="btn ghost sm" id="toPublish">List a ticket →</button>
    </div>
    <div class="market-grid" id="marketGrid"></div>
  `;
  $('#toPublish', view).addEventListener('click', () => switchTab('publish'));
  wireHostInvite(view);
  paintListings();
}

/* ---------- host invite share panel ---------- */
function hostInviteMarkup() {
  const key = state.invite;
  return `
    <section class="invite-panel" aria-label="Your market invite">
      <div class="ip-glow" aria-hidden="true"></div>
      <div class="ip-main">
        <span class="ip-kicker">You're hosting · share to fill your terrace</span>
        <h3>Your market invite</h3>
        <p class="ip-lede">Send this key to a friend. They paste it into <b>Join with an invite</b> to enter your
          co-signed ledger — no server, no link to kill, pure peer-to-peer.</p>
        <div class="ip-key-row">
          <code class="ip-key" id="inviteKey" title="Market bootstrap key">${key}</code>
          <button type="button" class="btn sm ip-copy" id="copyInvite">
            <span class="ci-label">Copy invite</span>
          </button>
        </div>
        <div class="ip-foot">
          <span class="ip-chip">🔑 64-hex bootstrap key</span>
          <span class="ip-chip">✍️ you authorize each co-writer</span>
        </div>
      </div>
    </section>`;
}

function wireHostInvite(view) {
  const btn = $('#copyInvite', view);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const ok = await copyText(state.invite);
    const label = $('.ci-label', btn);
    if (ok) {
      btn.classList.add('copied');
      if (label) label.textContent = 'Copied ✓';
      toast('tether', '📋', 'Invite copied', 'Share it P2P — the joiner pastes it to enter your market.');
      setTimeout(() => {
        btn.classList.remove('copied');
        if (label) label.textContent = 'Copy invite';
      }, 2200);
    } else {
      toast('heat', '⚠️', 'Copy failed', 'Select the key and copy it manually.');
    }
  });
}

function paintListings() {
  const grid = $('#marketGrid');
  if (!grid) return;
  const open = state.listings.filter((l) => l.status !== 'settled');
  if (open.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div class="big">🎟️</div>
        <p class="lead">No open tickets on the terrace yet.</p>
        <p>Sit tight — listings arrive live as fans join, or list one of your own.</p>
      </div>`;
    return;
  }
  grid.innerHTML = '';
  open.forEach((l, i) => grid.appendChild(listingCard(l, i === 0)));
}

function listingCard(l, feature) {
  const mine = state.me && l.sellerId === state.me.peerId;
  const card = el('article', 'listing' + (feature ? ' feature' : '') + (mine ? ' mine' : '') + (l.status === 'settled' ? ' settled' : ''));
  card.dataset.id = l.id;

  const statusPill = mine
    ? '<span class="pill mine">Your ticket</span>'
    : l.status === 'pending'
      ? '<span class="pill pending">Offer pending</span>'
      : l.status === 'settled'
        ? '<span class="pill settled">Settled</span>'
        : '<span class="pill open">Open</span>';

  const stage = l._stage || 'Matchday';
  card.innerHTML = `
    <div class="listing-top">
      <span class="sellerflag"><span class="flag">${flagOf(l.nation)}</span>${mine ? 'You' : nameOf(l.nation) + ' seller'}</span>
      ${statusPill}
    </div>
    <div class="match">${l.match}</div>
    <div class="stage">${stage}</div>
    ${l.hashlock ? '<div class="pass-tag">🔒 Tokenized pass</div>' : ''}
    <div class="seatline">
      <span class="seatchip">${l.section}</span>
      <span class="seatchip"><b>${l.seat}</b></span>
    </div>
    <div class="listing-foot">
      <div class="price">
        <span class="num">${money(l.priceUsdt)}</span>
        <span class="cur">USD₮
          <span class="sub">peer-to-peer</span>
        </span>
      </div>
      <div class="cta-slot"></div>
    </div>
  `;

  const slot = $('.cta-slot', card);
  if (mine) {
    slot.innerHTML = '<span class="role-chip">listed by <b>you</b></span>';
  } else if (l.status === 'open') {
    const btn = el('button', 'btn sm');
    btn.innerHTML = state.writable
      ? 'Make offer <span class="arw">→</span>'
      : '🔒 Awaiting access';
    btn.addEventListener('click', () => makeOffer(l, btn));
    gateWrite(btn);
    slot.appendChild(btn);
  } else if (l.status === 'pending') {
    slot.innerHTML = '<span class="role-chip">co-signing…</span>';
  } else {
    slot.innerHTML = '<span class="role-chip">✓ settled</span>';
  }
  return card;
}

function onNewListing(listing) {
  // de-dup by id
  if (state.listings.some((l) => l.id === listing.id)) return;
  state.listings = [listing, ...state.listings];
  if (state.activeTab === 'market') {
    const grid = $('#marketGrid');
    if (grid) {
      const emptyEl = $('.empty', grid);
      if (emptyEl) { paintListings(); }
      else {
        const card = listingCard(listing, false);
        card.classList.add('is-new');
        grid.insertBefore(card, grid.firstChild);
      }
    }
  }
  toast('', flagOf(listing.nation), `New ticket · <b>${listing.match}</b>`,
    `${nameOf(listing.nation)} seller · ${money(listing.priceUsdt)} USD₮`);
}

async function makeOffer(listing, btn) {
  if (!state.writable) {
    toast('heat', '🔒', 'Not authorized yet', 'The host must add you as a co-writer before you can offer.');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = 'Signing offer…';
  try {
    const offer = await core.makeOffer(listing.id);
    listing.status = 'pending';
    toast('tether', '🤝', `Offer signed on <b>${listing.match}</b>`,
      `${money(listing.priceUsdt)} USD₮ · awaiting seller co-sign`);
    if (state.activeTab === 'market') paintListings();
    // trade events (cosigned → settled) will stream in via core.on('trade')
    void offer;
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = 'Make offer <span class="arw">→</span>';
    toast('heat', '⚠️', 'Offer failed', String(err.message || err));
  }
}

/* ============================================================
   PUBLISH
   ============================================================ */
const MATCH_OPTIONS = [
  'ARG vs BRA', 'FRA vs ENG', 'ESP vs GER', 'POR vs NED',
  'MEX vs USA', 'JPN vs CRO', 'MAR vs NGA', 'ITA vs URU',
];
const SECTION_OPTIONS = ['North Stand', 'Terrace 118', 'Block 204', 'Home End', 'Ultras 5', 'Lower Tier 12'];

function renderPublish(view) {
  view.innerHTML = `
    <div class="sec-head">
      <div class="titles">
        <span class="kicker">Broadcast to the swarm</span>
        <h2>List a <em>ticket</em></h2>
      </div>
    </div>
    <div class="publish-wrap">
      <form class="form-card" id="publishForm" novalidate>
        <div class="field">
          <label for="f-match">Fixture</label>
          <select id="f-match" required>
            ${MATCH_OPTIONS.map((m) => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-section">Section</label>
            <select id="f-section" required>
              ${SECTION_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="f-seat">Seat</label>
            <input id="f-seat" type="text" placeholder="Row 14, Seat 7" value="Row 14, Seat 7" required />
          </div>
        </div>
        <div class="field price-field">
          <label for="f-price">Ask price</label>
          <input id="f-price" type="number" min="1" step="1" placeholder="240" value="240" required />
          <span class="curmark">USD₮</span>
        </div>

        <div class="pass-toggle-block">
          <label class="pass-switch" for="f-pass-on">
            <input type="checkbox" id="f-pass-on" />
            <span class="ps-track" aria-hidden="true"><span class="ps-thumb"></span></span>
            <span class="ps-label">
              <b>🔒 Attach a tokenized fan-pass</b>
              <span class="ps-sub">Encrypted, delivered peer-to-peer; unlocks only when payment settles — atomically.</span>
            </span>
          </label>
          <div class="pass-secret" id="passSecretWrap" hidden>
            <label for="f-pass-secret">Transfer code / QR string</label>
            <input id="f-pass-secret" type="text" spellcheck="false" autocomplete="off"
              placeholder="e.g. FIFA26-XG7-9K2 · or paste a mobile-transfer QR string" />
            <p class="pass-secret-note">Sealed under a hashlock the moment you publish. The buyer only ever
              sees it the instant settlement co-signs — <b>the seller can't be paid without releasing it</b>.</p>
          </div>
        </div>

        <div class="form-note">
          <span class="flag">${flagOf(state.me.nation)}</span>
          <span>Listed under <b>${nameOf(state.me.nation)}</b> · seller <b>${truncId(state.me.peerId)}</b></span>
        </div>
        ${state.writable ? '' : `
        <div class="gate-note" role="status">
          <span class="ab-spin" aria-hidden="true"></span>
          <span>Getting authorized as a co-writer… publishing unlocks the moment the host adds your key.</span>
        </div>`}
        <button type="submit" class="btn block" id="publishBtn">
          ${state.writable ? 'Publish to the swarm <span class="arw">→</span>' : '🔒 Awaiting co-writer access'}
        </button>
      </form>

      <div class="preview-side">
        <div class="preview-label">Live preview — what peers will see</div>
        <div id="previewMount"></div>
      </div>
    </div>
  `;

  const form = $('#publishForm', view);
  const update = () => paintPreview();
  ['f-match', 'f-section', 'f-seat', 'f-price'].forEach((id) => {
    $('#' + id, form).addEventListener('input', update);
  });
  const passOn = $('#f-pass-on', form);
  const passWrap = $('#passSecretWrap', form);
  const passSecret = $('#f-pass-secret', form);
  passOn.addEventListener('change', () => {
    passWrap.hidden = !passOn.checked;
    if (passOn.checked) setTimeout(() => passSecret.focus(), 40);
    paintPreview();
  });
  passSecret.addEventListener('input', update);
  form.addEventListener('submit', onPublishSubmit);
  gateWrite($('#publishBtn', view));
  paintPreview();
}

function previewListing() {
  const passOn = $('#f-pass-on') ? $('#f-pass-on').checked : false;
  return {
    id: 'preview',
    match: $('#f-match') ? $('#f-match').value : MATCH_OPTIONS[0],
    section: $('#f-section') ? $('#f-section').value : SECTION_OPTIONS[0],
    seat: $('#f-seat') ? $('#f-seat').value || '—' : '—',
    priceUsdt: $('#f-price') ? Number($('#f-price').value || 0) : 0,
    nation: state.me.nation,
    sellerId: state.me.peerId,
    status: 'open',
    _stage: 'Listed by you',
    // truthy marker so the preview card shows the 🔒 Tokenized pass badge
    hashlock: passOn ? 'preview' : null,
  };
}

function paintPreview() {
  const mount = $('#previewMount');
  if (!mount) return;
  mount.innerHTML = '';
  mount.appendChild(listingCard(previewListing(), true));
}

async function onPublishSubmit(e) {
  e.preventDefault();
  const btn = $('#publishBtn');
  if (!state.writable) {
    toast('heat', '🔒', 'Not authorized yet', 'The host must add you as a co-writer before you can publish.');
    return;
  }
  const match = $('#f-match').value;
  const section = $('#f-section').value;
  const seat = ($('#f-seat').value || '').trim();
  const priceUsdt = Number($('#f-price').value);
  const passOn = $('#f-pass-on') ? $('#f-pass-on').checked : false;
  const passSecret = passOn ? ($('#f-pass-secret').value || '').trim() : '';

  if (!seat || !priceUsdt || priceUsdt <= 0) {
    toast('heat', '⚠️', 'Check your listing', 'Seat and a positive USD₮ price are required.');
    return;
  }
  if (passOn && !passSecret) {
    toast('heat', '🔒', 'Add a transfer code', 'Attach the pass secret (transfer code / QR string), or turn the fan-pass off.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Broadcasting…';
  try {
    const payload = { match, section, seat, priceUsdt, nation: state.me.nation };
    if (passSecret) payload.passSecret = passSecret; // omit => classic listing (unchanged)
    const listing = await core.publishListing(payload);
    if (!state.listings.some((l) => l.id === listing.id)) {
      state.listings = [listing, ...state.listings];
    }
    if (listing.hashlock) {
      toast('tether', '🔒', `Sealed & live · <b>${listing.match}</b>`,
        `${money(listing.priceUsdt)} USD₮ · pass unlocks atomically on settle`);
    } else {
      toast('tether', '📡', `Live on the swarm · <b>${listing.match}</b>`,
        `${money(listing.priceUsdt)} USD₮ · peers can offer now`);
    }
    switchTab('market');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = 'Publish to the swarm <span class="arw">→</span>';
    toast('heat', '⚠️', 'Publish failed', String(err.message || err));
  }
}

/* ============================================================
   TRADES + RECEIPTS
   ============================================================ */
function onTradeUpdate(trade) {
  state.trades.set(trade.id, trade);
  if (trade.offerId) state.offerMeta.set(trade.id, { offerId: trade.offerId });

  const mine = state.me && (trade.buyerId === state.me.peerId || trade.sellerId === state.me.peerId);

  // toasts on meaningful transitions
  if (trade.state === 'offered' && !state.seenTrades.has(trade.id)) {
    state.seenTrades.add(trade.id);
    if (trade.sellerId === state.me.peerId) {
      toast('', flagOf(trade.buyerNation), `${nameOf(trade.buyerNation)} wants your ticket`,
        `${money(trade.priceUsdt)} USD₮ · accept to co-sign`);
    }
  } else if (trade.state === 'cosigned') {
    toast('tether', '✍️', `Trade co-signed on the ledger`,
      `${money(trade.priceUsdt)} USD₮ · both sides signed`);
  } else if (trade.state === 'settled') {
    settleTrade(trade);
  }

  if (mine && trade.state !== 'settled' && state.activeTab !== 'trades') {
    state.newBadge += 1;
    updateTradeBadge();
  }
  if (state.activeTab === 'trades') renderTrades($('#view'));
  if (state.activeTab === 'market') paintListings();
}

async function settleTrade(trade) {
  try {
    const receipt = await core.getReceipt(trade.id);
    state.receipts.set(trade.id, receipt);
    // Hashlocked trade? Settlement just revealed the seller's secret — pull the
    // now-unlocked fan-pass so the receipt view can play the atomic reveal.
    if (receipt && receipt.hashlock && typeof core.getPass === 'function') {
      try {
        const pass = await core.getPass(trade.id);
        state.passes.set(trade.id, pass);
        if (pass && pass.revealed) {
          toast('tether', '🔓', 'Fan-pass unlocked',
            'Payment settled → the seller’s secret was revealed → the pass is yours.');
        }
      } catch (_) { /* pass optional; receipt still stands */ }
    }
    toast('tether', '🧾', `Settled · receipt verified`,
      `${money(receipt.priceUsdt)} USD₮ · ledger #${receipt.ledgerHeight}`);
  } catch (err) {
    toast('heat', '⚠️', 'Receipt unavailable', String(err.message || err));
  }
  if (state.activeTab !== 'trades') { state.newBadge += 1; updateTradeBadge(); }
  if (state.activeTab === 'trades') renderTrades($('#view'));
  if (state.activeTab === 'market') paintListings();
}

function renderTrades(view) {
  const trades = [...state.trades.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const settled = trades.filter((t) => t.state === 'settled' && state.receipts.has(t.id));
  const latestReceiptTrade = settled[0];

  view.innerHTML = `
    <div class="sec-head">
      <div class="titles">
        <span class="kicker">Co-signed on the shared ledger</span>
        <h2>Trades &amp; <em>receipts</em></h2>
      </div>
    </div>
    <div class="trades-wrap" id="tradesWrap"></div>
  `;
  const wrap = $('#tradesWrap', view);

  if (trades.length === 0) {
    wrap.innerHTML = `
      <div class="empty">
        <div class="big">🤝</div>
        <p class="lead">No trades yet.</p>
        <p>Make an offer on the marketplace, or list a ticket and wait for a buyer.</p>
      </div>`;
    return;
  }

  // hero receipt — with the atomic fan-pass reveal above it when hashlocked
  if (latestReceiptTrade) {
    const rec = state.receipts.get(latestReceiptTrade.id);
    if (rec && rec.hashlock) {
      wrap.appendChild(passRevealPanel(latestReceiptTrade.id, rec));
    }
    wrap.appendChild(receiptHero(rec, latestReceiptTrade));
  }

  // active + past trades lane
  const laneWrap = el('div');
  laneWrap.innerHTML = `<div class="preview-label" style="margin-bottom:12px">All trades on your ledger</div>`;
  const lane = el('div', 'trade-lane');
  trades.forEach((t) => lane.appendChild(tradeCard(t)));
  laneWrap.appendChild(lane);
  wrap.appendChild(laneWrap);
}

function tradeCard(t) {
  const iAmSeller = state.me && t.sellerId === state.me.peerId;
  const iAmBuyer = state.me && t.buyerId === state.me.peerId;
  const incoming = t.state === 'offered' && iAmSeller;
  const card = el('article', 'trade-card' + (incoming ? ' incoming' : ''));

  const listing = state.listings.find((l) => l.id === t.listingId) || {};
  const match = listing.match || '—';
  const receipt = state.receipts.get(t.id);
  const hasPass = !!(listing.hashlock || (receipt && receipt.hashlock));

  const stateStep = { offered: 0, cosigned: 1, settled: 2 }[t.state] ?? 0;
  const roleLabel = iAmBuyer ? 'You <b>buy</b>' : iAmSeller ? 'You <b>sell</b>' : 'Observed';

  card.innerHTML = `
    <div class="tc-top">
      <div class="matchup">
        <span>${flagOf(t.buyerNation)}</span>
        <span class="vs">VS</span>
        <span>${flagOf(t.sellerNation)}</span>
      </div>
      <span class="tc-chips">
        ${hasPass ? `<span class="tc-pass">${t.state === 'settled' ? '🔓 pass' : '🔒 pass'}</span>` : ''}
        <span class="state-chip ${t.state}">${t.state}</span>
      </span>
    </div>
    <div>
      <div class="tc-match">${match}</div>
      <div class="tc-meta">
        <span class="role-chip">${roleLabel}</span>
        <span class="amt">${money(t.priceUsdt)} USD₮</span>
      </div>
    </div>
    <div class="progress" aria-hidden="true">
      <div class="node ${stateStep >= 0 ? 'done' : ''} ${stateStep === 0 ? 'active' : ''}"></div>
      <div class="node ${stateStep >= 1 ? 'done' : ''} ${stateStep === 1 ? 'active' : ''}"></div>
      <div class="node ${stateStep >= 2 ? 'done' : ''}"></div>
    </div>
    <div class="progress-labels">
      <span class="${stateStep === 0 ? 'on' : ''}">Offered</span>
      <span class="${stateStep === 1 ? 'on' : ''}">Co-signed</span>
      <span class="${stateStep === 2 ? 'on' : ''}">Settled</span>
    </div>
    <div class="tc-action"></div>
  `;

  const action = $('.tc-action', card);
  if (incoming) {
    const btn = el('button', 'btn block sm');
    btn.innerHTML = state.writable
      ? 'Accept &amp; co-sign <span class="arw">→</span>'
      : '🔒 Awaiting co-writer access';
    btn.addEventListener('click', () => acceptIncoming(t, btn));
    gateWrite(btn);
    action.appendChild(btn);
  } else if (t.state === 'settled' && state.receipts.has(t.id)) {
    const btn = el('button', 'btn ghost block sm');
    btn.innerHTML = 'View receipt ↑';
    btn.addEventListener('click', () => {
      $('#view').scrollTo({ top: 0, behavior: 'smooth' });
    });
    action.appendChild(btn);
  } else if (t.state === 'cosigned') {
    action.innerHTML = '<span class="role-chip">finalising settlement…</span>';
  } else if (t.state === 'offered') {
    action.innerHTML = '<span class="role-chip">awaiting counterparty co-sign…</span>';
  }
  return card;
}

async function acceptIncoming(t, btn) {
  if (!state.writable) {
    toast('heat', '🔒', 'Not authorized yet', 'The host must add you as a co-writer before you can co-sign.');
    return;
  }
  const meta = state.offerMeta.get(t.id);
  const offerId = meta ? meta.offerId : t.offerId;
  if (!offerId) {
    toast('heat', '⚠️', 'Missing offer id', 'Cannot co-sign without the originating offer id.');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = 'Co-signing on ledger…';
  try {
    await core.acceptOffer(offerId);
    toast('tether', '✍️', 'You co-signed the trade', `${money(t.priceUsdt)} USD₮ · settling now`);
    // cosigned/settled will arrive via trade events
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = 'Accept &amp; co-sign <span class="arw">→</span>';
    toast('heat', '⚠️', 'Co-sign failed', String(err.message || err));
  }
}

/* ---------- THE HERO BEAT: atomic HTLC fan-pass unlock ----------
   The pass is shown LOCKED first (sealed, hashlock H visible), then — because
   settlement has already revealed the seller's secret — it animates UNLOCKING
   to expose the transfer code. Played once per trade (transform/opacity only,
   reduced-motion honoured via the global media query). */
function passRevealPanel(tradeId, receipt) {
  const pass = state.passes.get(tradeId);
  const unlocked = !!(pass && pass.revealed && pass.pass);
  const payload = unlocked ? pass.pass : null;
  const hashHex = (pass && pass.hashlock) || receipt.hashlock || '';
  const already = state.passUnlockedUI.has(tradeId);

  const transferCode = payload ? payload.transferCode : '';
  const matchMeta = (payload && payload.match) || receipt.match || '';
  const seatMeta = payload
    ? [payload.section, payload.seat].filter(Boolean).join(' · ')
    : (receipt.seat || '');
  const note = (payload && payload.note) || '';

  const wrap = el('div', 'pass-reveal');
  wrap.innerHTML = `
    <span class="pr-label">Atomic fan-pass · HTLC delivery</span>
    <div class="pass-card">
      <div class="pc-aura" aria-hidden="true"></div>
      <div class="pc-top">
        <span class="pc-lock" aria-hidden="true">
          <span class="pc-lock-closed">🔒</span>
          <span class="pc-lock-open">🔓</span>
        </span>
        <div class="pc-hash">
          <span class="pc-hash-k">Hashlock H</span>
          <code class="pc-hash-v">${truncHash(hashHex)}</code>
        </div>
        <span class="pc-state">
          <span class="pc-state-locked">Sealed</span>
          <span class="pc-state-open">Unlocked</span>
        </span>
      </div>
      <div class="pc-body">
        <div class="pc-sealed">
          <div class="pc-redacted" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="pc-sealed-sub">encrypted · delivered peer-to-peer · awaiting settlement</div>
        </div>
        <div class="pc-open">
          <div class="pc-open-k">Transfer code · your fan-pass</div>
          <div class="pc-code-row">
            <code class="pc-code">${escapeHtml(transferCode || '—')}</code>
            <button type="button" class="btn sm pc-copy"${transferCode ? '' : ' disabled'}>
              <span class="pcc-label">Copy code</span>
            </button>
          </div>
          <div class="pc-open-meta">
            <span>${escapeHtml(matchMeta)}</span>
            <span>${escapeHtml(seatMeta)}</span>
            ${note ? `<span>${escapeHtml(note)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
    <p class="pr-caption">
      <b>Payment settled → secret revealed → pass unlocked.</b>
      One atomic act — the seller couldn't be paid without handing you this.
    </p>
  `;

  const copyBtn = $('.pc-copy', wrap);
  if (copyBtn && transferCode) {
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(transferCode);
      const lbl = $('.pcc-label', copyBtn);
      if (ok) {
        copyBtn.classList.add('copied');
        if (lbl) lbl.textContent = 'Copied ✓';
        toast('tether', '📋', 'Pass code copied', 'Your single-use fan-pass transfer code is on the clipboard.');
        setTimeout(() => { copyBtn.classList.remove('copied'); if (lbl) lbl.textContent = 'Copy code'; }, 2200);
      } else {
        toast('heat', '⚠️', 'Copy failed', 'Select the code and copy it manually.');
      }
    });
  }

  if (unlocked && !already) {
    // First time this settled pass is on screen: seal it, let it read, then break.
    state.passUnlockedUI.add(tradeId);
    wrap.classList.add('is-locked');
    setTimeout(() => {
      wrap.classList.remove('is-locked');
      wrap.classList.add('is-unlocked');
    }, 1250);
  } else if (unlocked) {
    wrap.classList.add('is-unlocked'); // already revealed earlier — stay open on re-render
  } else {
    wrap.classList.add('is-locked');   // still awaiting settlement
  }
  return wrap;
}

/* ---------- the hero receipt + "Forge it & fail" proof ---------- */
function receiptHero(r, trade) {
  const iAmBuyer = state.me && trade.buyerId === state.me.peerId;

  // Pristine, ledger-anchored field-set + its content fingerprint. Re-verify
  // recomputes over what's on screen and compares to this — tampering any
  // visible field breaks the match. Never fakes a pass.
  const pristine = {
    match: r.match,
    seat: r.seat,
    priceUsdt: Number(r.priceUsdt),
    buyerNation: r.buyerNation,
    sellerNation: r.sellerNation,
    ledgerHeight: r.ledgerHeight,
    hash: String(r.hash || ''),
  };
  const genuineFp = receiptFingerprint(pristine);

  const wrap = el('div', 'receipt-hero');
  wrap.innerHTML = `
    <span class="rh-label">Verifiable receipt · latest settlement</span>
    <div class="receipt" data-state="verified">
      <div class="stamp"><span class="stamp-ok">Verified</span><span class="stamp-bad">Invalid</span></div>
      <div class="receipt-body">
        <div class="receipt-head">
          <div class="r-title">${r.match}</div>
          <div class="r-id">TRADE ${truncId(r.tradeId)}</div>
        </div>
        <div class="faceoff">
          <div class="side">
            <span class="flag">${flagOf(r.buyerNation)}</span>
            <span class="role">Buyer${iAmBuyer ? ' · you' : ''}</span>
            <span class="nat">${nameOf(r.buyerNation)}</span>
          </div>
          <span class="vs">VS</span>
          <div class="side">
            <span class="flag">${flagOf(r.sellerNation)}</span>
            <span class="role">Seller${!iAmBuyer && state.me.peerId === trade.sellerId ? ' · you' : ''}</span>
            <span class="nat">${nameOf(r.sellerNation)}</span>
          </div>
        </div>
        <div class="receipt-amount">
          <span class="num" data-field="price" spellcheck="false">${money(pristine.priceUsdt)}</span><span class="cur">USD₮</span>
          <div class="what">settled peer-to-peer · co-signed by two fans</div>
        </div>
      </div>
      <div class="perf"><span class="notch l"></span><span class="notch r"></span></div>
      <div class="receipt-meta">
        <div class="cell">
          <div class="k">Ledger height</div>
          <div class="v">#${r.ledgerHeight}</div>
        </div>
        <div class="cell">
          <div class="k">Seat</div>
          <input class="v r-edit" data-field="seat" value="${escapeAttr(pristine.seat)}" readonly spellcheck="false" aria-label="Seat" />
        </div>
        <div class="cell wide">
          <div class="k">Autobase hash</div>
          <input class="v hash r-edit" data-field="hash" value="${escapeAttr(pristine.hash)}" readonly spellcheck="false" aria-label="Autobase hash" />
        </div>
      </div>
      <div class="barcode"></div>
      <div class="receipt-tagline">
        <span class="mark">✓</span>
        <p>No server. <b>No scalper.</b> Co-signed peer-to-peer.</p>
      </div>
    </div>

    <div class="forge">
      <div class="forge-head">
        <span class="forge-kicker">The un-copyable part</span>
        <h4>Forge it. Go ahead.</h4>
        <p>This receipt was <b>co-signed by two fans in two countries</b>. Change one character of
          the price, the seat, or the hash and try to make it verify against the ledger — <b>you can't</b>.</p>
      </div>
      <div class="forge-readout">
        <div class="fr-row"><span class="fr-k">Ledger fingerprint</span><code class="fr-v" data-fp="ledger">${genuineFp}</code></div>
        <div class="fr-row"><span class="fr-k">Recomputed now</span><code class="fr-v" data-fp="now">${genuineFp}</code></div>
        <div class="fr-verdict ok" data-verdict>✓ Co-signature intact — matches the ledger</div>
      </div>
      <div class="forge-actions">
        <button type="button" class="btn ghost sm" data-act="tamper">✎ Tamper this receipt</button>
        <button type="button" class="btn sm" data-act="verify" hidden>Re-verify against ledger <span class="arw">→</span></button>
        <button type="button" class="btn ghost sm" data-act="reset" hidden>Reset</button>
      </div>
    </div>
  `;

  const receipt = $('.receipt', wrap);
  const priceEl = $('[data-field="price"]', wrap);
  const seatEl = $('[data-field="seat"]', wrap);
  const hashEl = $('[data-field="hash"]', wrap);
  const fpNow = $('[data-fp="now"]', wrap);
  const verdict = $('[data-verdict]', wrap);
  const tamperBtn = $('[data-act="tamper"]', wrap);
  const verifyBtn = $('[data-act="verify"]', wrap);
  const resetBtn = $('[data-act="reset"]', wrap);

  const readCurrent = () => ({
    ...pristine,
    priceUsdt: (priceEl.textContent || '').replace(/[^\d.]/g, '') || '0',
    seat: seatEl.value,
    hash: hashEl.value,
  });

  const refreshFp = () => {
    const fp = receiptFingerprint(readCurrent());
    fpNow.textContent = fp;
    fpNow.classList.toggle('drift', fp !== genuineFp);
  };

  const setEditing = (on) => {
    priceEl.setAttribute('contenteditable', on ? 'true' : 'false');
    priceEl.classList.toggle('editable', on);
    seatEl.readOnly = !on;
    hashEl.readOnly = !on;
    seatEl.classList.toggle('editable', on);
    hashEl.classList.toggle('editable', on);
    tamperBtn.hidden = on;
    verifyBtn.hidden = !on;
    resetBtn.hidden = !on;
  };

  const setVerdict = (kind, msg, fp) => {
    receipt.dataset.state = kind === 'ok' ? 'verified' : 'rejected';
    verdict.className = 'fr-verdict ' + (kind === 'ok' ? 'ok' : 'bad');
    verdict.textContent = msg;
    if (fp) fpNow.textContent = fp;
  };

  tamperBtn.addEventListener('click', () => {
    setEditing(true);
    verdict.className = 'fr-verdict pending';
    verdict.textContent = 'Editing — change a character, then re-verify against the ledger.';
    receipt.dataset.state = 'editing';
    priceEl.focus();
  });

  [priceEl].forEach((n) => n.addEventListener('input', refreshFp));
  [seatEl, hashEl].forEach((n) => n.addEventListener('input', refreshFp));

  verifyBtn.addEventListener('click', () => {
    const cur = readCurrent();
    const fp = receiptFingerprint(cur);
    const tampered = fp !== genuineFp;
    if (tampered) {
      setVerdict('bad', '✕ REJECTED — this receipt was never co-signed. The fingerprint no longer matches the ledger.', fp);
      receipt.classList.remove('shake'); void receipt.offsetWidth; receipt.classList.add('shake');
      toast('heat', '⛔', 'Forgery rejected', 'One character changed — the co-signed fingerprint no longer matches.');
    } else {
      setVerdict('ok', '✓ Co-signature intact — matches the ledger.', fp);
      toast('tether', '✓', 'Receipt verifies', 'Every field matches the fingerprint two fans co-signed.');
    }
  });

  resetBtn.addEventListener('click', () => {
    priceEl.textContent = money(pristine.priceUsdt);
    seatEl.value = pristine.seat;
    hashEl.value = pristine.hash;
    setEditing(false);
    refreshFp();
    setVerdict('ok', '✓ Co-signature intact — matches the ledger.', genuineFp);
    receipt.classList.remove('shake');
  });

  return wrap;
}

/* attribute-safe escaping for values injected into input value="…" */
function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* text-node escaping for values injected via innerHTML (may originate from peers) */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================================================
   TOASTS
   ============================================================ */
function toast(variant, ico, main, sub) {
  const host = $('#toasts');
  if (!host) return;
  const t = el('div', 'toast' + (variant ? ' ' + variant : ''));
  t.innerHTML = `
    <span class="ico">${ico}</span>
    <div>
      <div class="t-main">${main}</div>
      ${sub ? `<div class="t-sub">${sub}</div>` : ''}
    </div>`;
  host.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  }, 4600);
  // cap stack
  while (host.children.length > 4) host.firstChild.remove();
}

/* ============================================================
   BOOT
   ============================================================ */
renderOnboarding();
if (window.__TERRACE_MOCK__) {
  // tiny console hint for the demo runner
  console.info('[Terrace] Running with built-in MOCK core. Provide window.TerraceCore before load to use the real P2P core.');
}
