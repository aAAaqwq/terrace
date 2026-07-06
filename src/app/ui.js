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
    const trades = new Map();

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

    // seed a handful of open listings from "other" nations
    function seed() {
      const pool = otherNations();
      listings = Array.from({ length: 5 }, () => makeListing(pick(pool).code));
      // make the first one a marquee Final
      listings[0] = { ...listings[0], match: 'ARG vs BRA', _stage: 'Final · Estadio Azteca', priceUsdt: 520 };
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
      async start({ nation }) {
        me = { peerId: rid('you_'), nation };
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
            emit('status', { connected: true, peers: peerCount });
            setTimeout(tick, 500 + Math.random() * 700);
          };
          emit('status', { connected: true, peers: 0 });
          tick();
        }, 350);

        // periodically, a new listing floats in from a peer
        setInterval(() => {
          if (peerCount === 0) return;
          const n = pick(otherNations());
          const l = makeListing(n.code);
          listings = [l, ...listings].slice(0, 24);
          emit('listing', l);
        }, 9000 + Math.random() * 4000);

        return { peerId: me.peerId, nation: me.nation };
      },

      async getListings() {
        return listings.map((l) => ({ ...l }));
      },

      async publishListing({ match, section, seat, priceUsdt, nation }) {
        const l = {
          id: rid('lst_'),
          match, section, seat,
          priceUsdt: Number(priceUsdt),
          nation,
          sellerId: me.peerId,
          ts: Date.now(),
          status: 'open',
          _stage: 'Listed by you',
        };
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
        };
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
  seenTrades: new Set(),    // tradeIds already toasted at 'offered'
  newBadge: 0,              // unseen settled/trade badge for Trades tab
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
      <div class="pick-foot">
        <button class="btn" id="enterBtn" disabled>
          Enter the swarm <span class="arw">→</span>
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

  $('#enterBtn', root).addEventListener('click', enterSwarm);
}

function selectNation(code) {
  state.selectedNation = code;
  document.querySelectorAll('.nation').forEach((c) => {
    c.classList.toggle('selected', c.dataset.code === code);
    c.setAttribute('aria-selected', c.dataset.code === code ? 'true' : 'false');
  });
  const btn = $('#enterBtn');
  btn.disabled = false;
  $('#pickHint').innerHTML = `Trading under <b>${flagOf(code)} ${nameOf(code)}</b> — ready when you are.`;
}

async function enterSwarm() {
  if (!state.selectedNation) return;
  const btn = $('#enterBtn');
  btn.disabled = true;
  btn.innerHTML = 'Joining the DHT… <span class="arw">◍</span>';
  try {
    const res = await core.start({ nation: state.selectedNation });
    state.me = { peerId: res.peerId, nation: res.nation };
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Retry';
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
  await loadListings();
  switchTab('market');
}

function renderShell() {
  const app = $('#app');
  app.innerHTML = `
    <header class="topbar">
      <span class="wordmark"><span class="dot"></span>Terrace<sup>P2P</sup></span>
      <div class="topbar-right">
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
  core.on('status', ({ connected, peers }) => {
    state.connected = connected;
    if (typeof peers === 'number') state.peers = peers;
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
  paintListings();
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
    btn.innerHTML = 'Make offer <span class="arw">→</span>';
    btn.addEventListener('click', () => makeOffer(l, btn));
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
        <div class="form-note">
          <span class="flag">${flagOf(state.me.nation)}</span>
          <span>Listed under <b>${nameOf(state.me.nation)}</b> · seller <b>${truncId(state.me.peerId)}</b></span>
        </div>
        <button type="submit" class="btn block" id="publishBtn">
          Publish to the swarm <span class="arw">→</span>
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
  form.addEventListener('submit', onPublishSubmit);
  paintPreview();
}

function previewListing() {
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
  const match = $('#f-match').value;
  const section = $('#f-section').value;
  const seat = ($('#f-seat').value || '').trim();
  const priceUsdt = Number($('#f-price').value);

  if (!seat || !priceUsdt || priceUsdt <= 0) {
    toast('heat', '⚠️', 'Check your listing', 'Seat and a positive USD₮ price are required.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Broadcasting…';
  try {
    const listing = await core.publishListing({ match, section, seat, priceUsdt, nation: state.me.nation });
    if (!state.listings.some((l) => l.id === listing.id)) {
      state.listings = [listing, ...state.listings];
    }
    toast('tether', '📡', `Live on the swarm · <b>${listing.match}</b>`,
      `${money(listing.priceUsdt)} USD₮ · peers can offer now`);
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

  // hero receipt
  if (latestReceiptTrade) {
    wrap.appendChild(receiptHero(state.receipts.get(latestReceiptTrade.id), latestReceiptTrade));
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

  const stateStep = { offered: 0, cosigned: 1, settled: 2 }[t.state] ?? 0;
  const roleLabel = iAmBuyer ? 'You <b>buy</b>' : iAmSeller ? 'You <b>sell</b>' : 'Observed';

  card.innerHTML = `
    <div class="tc-top">
      <div class="matchup">
        <span>${flagOf(t.buyerNation)}</span>
        <span class="vs">VS</span>
        <span>${flagOf(t.sellerNation)}</span>
      </div>
      <span class="state-chip ${t.state}">${t.state}</span>
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
    btn.innerHTML = 'Accept &amp; co-sign <span class="arw">→</span>';
    btn.addEventListener('click', () => acceptIncoming(t, btn));
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

/* ---------- the hero receipt ---------- */
function receiptHero(r, trade) {
  const iAmBuyer = state.me && trade.buyerId === state.me.peerId;
  const wrap = el('div', 'receipt-hero');
  wrap.innerHTML = `
    <span class="rh-label">Verifiable receipt · latest settlement</span>
    <div class="receipt">
      <div class="stamp">Verified</div>
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
          <span class="num">${money(r.priceUsdt)}</span><span class="cur">USD₮</span>
          <div class="what">settled peer-to-peer · seat ${r.seat}</div>
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
          <div class="v">${r.seat}</div>
        </div>
        <div class="cell wide">
          <div class="k">Autobase hash</div>
          <div class="v hash">${truncHash(r.hash)}</div>
        </div>
      </div>
      <div class="barcode"></div>
      <div class="receipt-tagline">
        <span class="mark">✓</span>
        <p>No server. <b>No scalper.</b> Co-signed peer-to-peer.</p>
      </div>
    </div>
  `;
  return wrap;
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
