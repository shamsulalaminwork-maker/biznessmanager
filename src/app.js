import { loadData, saveData, onBack, exitApp, sharePDF, shareText, isNative } from './native.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = n => String(r2(n));
const fmtComma = n => r2(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const I = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const ICON = {
  receipt: I('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  box: I('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  up: I('<path d="M6 15l6-6 6 6"/>'),
  down: I('<path d="M6 9l6 6 6-6"/>'),
  chev: I('<path d="M9 5l7 7-7 7"/>'),
  share: I('<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  eye: I('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  check: I('<path d="M5 12l5 5 9-10"/>')
};

/* ---------- data ---------- */
const DEFAULT = {
  settings: { prefix: 'C', next: 76, email: 'corpomechbd@gmail.com', phone: '+8801612-170202', address: "Shop 128, 68-69 Concept Tower, Greenroad,\nPanthapath, 1205" },
  products: [
    { id: 'p1', name: 'Coupon', desc: "Coupon (300 GSM Artcard, Dimension - 2'x2.25')", price: 4.4, unit: 'Pcs', flat: false },
    { id: 'p2', name: 'Cutting Charge', desc: 'Cutting Charge', price: 50, unit: '', flat: true }
  ],
  invoices: [], draft: null
};
let db = clone(DEFAULT);
const persist = () => saveData(db);
const invNo = () => db.settings.prefix + String(db.settings.next).padStart(3, '0');
const newInvoice = () => ({ id: uid(), no: invNo(), date: todayISO(), customer: '', items: [], status: 'due' });
const total = inv => r2(inv.items.reduce((s, i) => s + num(i.total), 0));

/* ---------- toast, back stack, pages, sheets ---------- */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2700);
}
const stack = [];
const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
const updUnder = () => $('#tabview').classList.toggle('under', stack.some(e => e.page));

function pushPage(o) {
  const el = document.createElement('section'); el.className = 'page';
  el.innerHTML = `<header class="ph"><button class="ib tap" aria-label="Back">${ICON.back}</button><h1>${esc(o.title)}</h1><div class="pr"></div></header><div class="pb"></div><footer class="pf hid"></footer>`;
  $('#pages').appendChild(el);
  const entry = { page: true, el, o, close() { if (o.beforeClose && o.beforeClose(entry) === false) return; closePage(entry); } };
  stack.push(entry);
  $('.ib', el).onclick = () => goBack();
  entry.body = $('.pb', el); entry.foot = $('.pf', el); entry.right = $('.pr', el);
  o.build(entry);
  raf2(() => { el.classList.add('in'); updUnder(); });
  return entry;
}
function closePage(entry) {
  const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
  entry.el.classList.remove('in'); updUnder();
  setTimeout(() => entry.el.remove(), 380);
}
function openSheet(html, bind) {
  const wrap = document.createElement('div'); wrap.className = 'sheetwrap';
  wrap.innerHTML = `<div class="backdrop"></div><div class="sheet"><div class="grab"></div>${html}</div>`;
  $('#overlay').appendChild(wrap);
  const entry = { el: wrap, close() { closeSheet(entry); } };
  stack.push(entry);
  $('.backdrop', wrap).onclick = () => goBack();
  if (bind) bind($('.sheet', wrap), entry);
  raf2(() => wrap.classList.add('in'));
  return entry;
}
function closeSheet(entry) {
  const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
  entry.el.classList.remove('in'); setTimeout(() => entry.el.remove(), 360);
}
function ask(title, msg, yesLabel, yes) {
  openSheet(`<h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="row"><div><button class="btn line full tap" data-n>Cancel</button></div><div><button class="btn full tap" data-y>${esc(yesLabel)}</button></div></div>`, (s, e) => {
    $('[data-n]', s).onclick = () => e.close();
    $('[data-y]', s).onclick = () => { e.close(); setTimeout(yes, 120); };
  });
}
function goBack() {
  const top = stack[stack.length - 1];
  if (top) return top.close();
  if (tab !== 'invoices') return switchTab('invoices');
  exitApp();
}

/* ---------- tabs ---------- */
let tab = 'invoices', filter = 'all';
const TABS = [['invoices', 'Invoices', ICON.receipt], ['products', 'Products', ICON.box], ['settings', 'Settings', ICON.gear]];
function drawNav() {
  $('#nav').innerHTML = TABS.map(([k, l, ic]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${ic}<span>${l}</span></button>`).join('');
  $('#nav').onclick = e => { const b = e.target.closest('[data-t]'); if (b && b.dataset.t !== tab) switchTab(b.dataset.t); };
}
function switchTab(t) { tab = t; drawNav(); renderTab(); }
function renderTab() {
  $('#app > .fab')?.remove();
  const v = $('#tabview'); v.scrollTop = 0;
  v.innerHTML = '<div class="view"></div>';
  ({ invoices: tInvoices, products: tProducts, settings: tSettings })[tab]($('.view', v));
}

/* ---------- invoices tab ---------- */
function tInvoices(v) {
  const all = db.invoices, due = all.filter(x => x.status !== 'paid');
  const list = filter === 'all' ? all : all.filter(x => (x.status === 'paid') === (filter === 'paid'));
  v.innerHTML = `<div class="lt"><h1>Invoices</h1></div>
  <div class="sum"><div><small>Total invoiced</small><b>${fmtComma(all.reduce((s, x) => s + total(x), 0))} Tk</b></div><div class="due"><small>Unpaid</small><b>${fmtComma(due.reduce((s, x) => s + total(x), 0))} Tk</b></div></div>
  <div class="seg">${[['all', 'All'], ['due', 'Due'], ['paid', 'Paid']].map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
  <div id="list">${list.map((x, i) => `
    <div class="card inv tap" data-id="${x.id}" style="animation-delay:${Math.min(i, 8) * 40}ms">
      <div class="top"><div><div class="nm">${esc(x.customer)}</div><div class="meta">${esc(x.no)} · ${longDate(x.date)} · ${x.items.length} item${x.items.length === 1 ? '' : 's'}</div></div>
      <div><div class="amt">${fmtComma(total(x))} Tk</div><div style="text-align:right"><button class="pill tap ${x.status}" data-a="st">${x.status === 'paid' ? 'PAID' : 'DUE'}</button></div></div></div>
      <div class="acts"><button class="btn sec sm tap" data-a="pdf">${ICON.eye}PDF</button><button class="btn sec sm tap" data-a="dup">${ICON.copy}Copy</button><button class="btn sec sm tap" data-a="del">${ICON.trash}Delete</button></div>
    </div>`).join('') || `<div class="empty">${all.length ? 'Nothing here.' : 'No invoices yet.<br>Tap + to create your first one.'}</div>`}</div>`;
  v.onclick = e => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; return renderTab(); }
    const c = e.target.closest('[data-id]'); if (!c) return;
    const x = db.invoices.find(y => y.id === c.dataset.id), a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'st') { x.status = x.status === 'paid' ? 'due' : 'paid'; persist(); renderTab(); toast(`${x.no} marked ${x.status === 'paid' ? 'paid' : 'due'}`); }
    else if (a === 'pdf') openPreview(x);
    else if (a === 'dup') { const d = clone(x); d.id = uid(); d.no = invNo(); d.date = todayISO(); d.status = 'due'; openEditor(d, true); }
    else if (a === 'del') ask('Delete invoice?', `${x.no} for ${x.customer} will be removed.`, 'Delete', () => { db.invoices = db.invoices.filter(y => y !== x); persist(); renderTab(); toast('Deleted'); });
    else openEditor(clone(x), false);
  };
  const fab = document.createElement('button'); fab.className = 'fab tap'; fab.innerHTML = ICON.plus; fab.setAttribute('aria-label', 'New invoice');
  fab.onclick = () => openEditor(db.draft ? clone(db.draft) : newInvoice(), true);
  $('#app').appendChild(fab);
}

/* ---------- invoice editor ---------- */
function recalc(it) {
  if (!it.flat && it.qty !== '' && it.price !== '') { it.total = fmt(num(it.qty) * num(it.price)); return true; }
  return false;
}
function itemHTML(it, i) {
  return `<div class="card it ${it.flat ? 'flat' : ''}" data-id="${it.id}">
    <div class="ih"><b>Item <span class="n">${i + 1}</span></b><span><button class="ib gray tap" data-a="up">${ICON.up}</button><button class="ib gray tap" data-a="dn">${ICON.down}</button><button class="ib danger tap" data-a="del">${ICON.trash}</button></span></div>
    <label class="l">Description</label><textarea data-f="desc" rows="1">${esc(it.desc)}</textarea>
    <div class="row qrow" style="margin-top:10px">
      <div><label class="l">Qty</label><input data-f="qty" inputmode="decimal" value="${esc(it.qty)}"></div>
      <div><label class="l">Unit</label><input data-f="unit" value="${esc(it.unit)}" placeholder="Pcs"></div>
      <div><label class="l">Price</label><input data-f="price" inputmode="decimal" value="${esc(it.price)}"></div>
    </div>
    <div style="margin-top:10px"><label class="l">Total (Tk)</label><input data-f="total" inputmode="decimal" value="${esc(it.total)}"></div>
    <label class="sw"><input type="checkbox" data-f="flat" ${it.flat ? 'checked' : ''}>Flat amount (no qty or price)</label>
  </div>`;
}
const autosize = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 4 + 'px'; };

function openEditor(w, isNew) {
  const snap = JSON.stringify(w);
  const hasContent = () => w.customer.trim() || w.items.length;
  const keepDraft = () => { if (isNew) { db.draft = hasContent() ? w : null; persist(); } };
  pushPage({
    title: isNew ? 'New invoice' : 'Edit ' + w.no,
    beforeClose(entry) {
      if (!isNew && JSON.stringify(w) !== snap) { ask('Discard changes?', 'Your edits to this invoice have not been saved.', 'Discard', () => closePage(entry)); return false; }
      keepDraft(); return true;
    },
    build(entry) {
      const b = entry.body;
      b.innerHTML = `
      <div class="card"><label class="l">Billing to</label><input id="cust" placeholder="Customer name" value="${esc(w.customer)}">
        <div class="row" style="margin-top:12px"><div><label class="l">Invoice no</label><input id="no" value="${esc(w.no)}"></div><div><label class="l">Date</label><input id="date" type="date" value="${w.date}"></div></div></div>
      <div class="secth"><span>Items</span></div><div id="items"></div>
      <div class="row"><div><button class="btn sec full tap" id="addp">${ICON.box}From products</button></div><div><button class="btn sec full tap" id="addc">${ICON.plus}Custom line</button></div></div>`;
      entry.foot.classList.remove('hid');
      entry.foot.innerHTML = `<div class="tot"><span>Total</span><b id="gt"></b></div><div class="row"><div><button class="btn line full tap" id="save">${ICON.check}Save</button></div><div><button class="btn full tap" id="prev">${ICON.eye}Preview PDF</button></div></div>`;
      const list = $('#items', b), upd = () => { $('#gt', entry.foot).textContent = fmtComma(total(w)) + ' Tk'; keepDraft(); };
      const renumber = () => list.querySelectorAll('.it .n').forEach((n, i) => n.textContent = i + 1);
      const draw = () => { list.innerHTML = w.items.map(itemHTML).join(''); list.querySelectorAll('textarea').forEach(autosize); };
      const addItem = it => {
        w.items.push(it); const t = document.createElement('div'); t.innerHTML = itemHTML(it, w.items.length - 1);
        const card = t.firstElementChild; list.appendChild(card); autosize($('textarea', card)); upd();
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      };
      draw(); upd();
      $('#cust', b).oninput = e => { w.customer = e.target.value; keepDraft(); };
      $('#no', b).oninput = e => { w.no = e.target.value; keepDraft(); };
      $('#date', b).oninput = e => { w.date = e.target.value || todayISO(); keepDraft(); };
      $('#addc', b).onclick = () => addItem({ id: uid(), desc: '', qty: '', unit: '', price: '', total: '', flat: false });
      $('#addp', b).onclick = () => openSheet(`<h3>Add product</h3><p>Tap a product to add it. You can edit everything afterwards.</p>` +
        (db.products.map(p => `<div class="pick tap" data-p="${p.id}"><div><b>${esc(p.name)}</b><span>${p.flat ? 'Flat ' : ''}${fmt(p.price)} Tk${p.unit && !p.flat ? ' / ' + esc(p.unit) : ''}</span></div>${ICON.plus.replace('<svg', '<svg width="22" height="22"')}</div>`).join('') || '<p>No products yet. Add some in the Products tab.</p>'),
        (s, e) => s.onclick = ev => {
          const p = ev.target.closest('[data-p]'); if (!p) return;
          const pr = db.products.find(x => x.id === p.dataset.p);
          e.close();
          addItem(pr.flat ? { id: uid(), desc: pr.desc, qty: '', unit: '', price: '', total: fmt(pr.price), flat: true }
            : { id: uid(), desc: pr.desc, qty: '1', unit: pr.unit, price: fmt(pr.price), total: fmt(pr.price), flat: false });
        });
      const find = el => { const c = el.closest('[data-id]'); return c && { c, it: w.items.find(x => x.id === c.dataset.id) }; };
      const onField = e => {
        const r = find(e.target), f = e.target.dataset.f; if (!r || !f || f === 'flat') return;
        r.it[f] = e.target.value;
        if (f === 'desc') autosize(e.target);
        if ((f === 'qty' || f === 'price') && recalc(r.it)) $('[data-f=total]', r.c).value = r.it.total;
        upd();
      };
      list.addEventListener('input', onField);
      list.addEventListener('change', e => {
        const r = find(e.target); if (!r) return;
        if (e.target.dataset.f === 'flat') {
          r.it.flat = e.target.checked; r.c.classList.toggle('flat', r.it.flat);
          if (r.it.flat) { r.it.qty = ''; r.it.price = ''; $('[data-f=qty]', r.c).value = ''; $('[data-f=price]', r.c).value = ''; }
          else recalc(r.it), $('[data-f=total]', r.c).value = r.it.total;
          upd();
        }
      });
      list.addEventListener('click', e => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        const r = find(e.target), i = w.items.indexOf(r.it);
        if (a === 'del') {
          r.c.style.maxHeight = r.c.offsetHeight + 'px'; void r.c.offsetHeight; r.c.classList.add('removing');
          w.items.splice(i, 1); upd(); setTimeout(() => { r.c.remove(); renumber(); }, 280);
        } else {
          const j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= w.items.length) return;
          [w.items[i], w.items[j]] = [w.items[j], w.items[i]]; draw(); upd();
        }
      });
      const valid = () => {
        if (!w.customer.trim()) { toast('Enter the customer name'); $('#cust', b).focus(); return false; }
        if (!w.items.length) { toast('Add at least one item'); return false; }
        return true;
      };
      $('#prev', entry.foot).onclick = () => { if (valid()) openPreview(w); };
      $('#save', entry.foot).onclick = () => {
        if (!valid()) return;
        const i = db.invoices.findIndex(x => x.id === w.id);
        if (i >= 0) db.invoices[i] = clone(w); else {
          db.invoices.unshift(clone(w));
          const m = w.no.match(/^(.*?)(\d+)$/);
          if (m && m[1] === db.settings.prefix && parseInt(m[2]) >= db.settings.next) db.settings.next = parseInt(m[2]) + 1;
        }
        if (isNew) db.draft = null;
        persist(); closePage(entry); tab = 'invoices'; drawNav(); renderTab(); toast('Invoice saved');
      };
    }
  });
}

/* ---------- invoice drawing (sample layout, coordinates 1313 x 1857) ---------- */
const RED = '#d22329', BW = 1313, BH = 1857;
const FONT = 'Inter, Arial, sans-serif';
const loadFonts = () => Promise.all(['400', '600', '700'].map(w => document.fonts.load(`${w} 30px Inter`)));
function wrap(ctx, text, maxW) {
  const out = [];
  String(text).split('\n').forEach(par => {
    let line = '';
    par.split(' ').forEach(wd => {
      const t = line ? line + ' ' + wd : wd;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = wd; } else line = t;
    });
    out.push(line);
  });
  return out;
}
function paginate(inv) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `400 30px ${FONT}`;
  const rows = inv.items.map((it, i) => { const lines = wrap(ctx, it.desc || '', it.flat ? 860 : 445); return { it, i, lines, h: Math.max(80, lines.length * 43 + 36) }; });
  const pages = [[]]; let y = 592;
  rows.forEach(r => { if (y + r.h > 1640) { pages.push([]); y = 180; } pages[pages.length - 1].push(r); y += r.h; });
  if (y + 78 > 1640) pages.push([]);
  return pages;
}
function drawPage(inv, pages, pi, widthPx) {
  const sc = widthPx / BW, cv = document.createElement('canvas');
  cv.width = widthPx; cv.height = Math.round(BH * sc);
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
  c.scale(sc, sc); c.textBaseline = 'alphabetic';
  const rows = pages[pi]; let y;
  if (pi === 0) {
    c.fillStyle = RED; c.font = `700 62px ${FONT}`; c.fillText('CorpoMerch', 90, 145);
    c.fillStyle = '#000'; c.font = `400 32px ${FONT}`; c.fillText('Billing To', 97, 262);
    c.font = `700 38px ${FONT}`; c.fillText(inv.customer, 97, 322, 540);
    c.strokeStyle = RED; c.lineWidth = 2.5; c.setLineDash([8, 6]);
    c.beginPath(); c.roundRect(684, 211, 497, 200, 22); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#000'; c.font = `700 33px ${FONT}`; c.fillText('Invoice', 722, 262);
    c.font = `400 32px ${FONT}`; c.fillText('Invoice No: ' + inv.no, 722, 316); c.fillText('Date: ' + longDate(inv.date), 722, 369);
    y = 512;
  } else y = 100;
  c.fillStyle = RED; c.fillRect(87, y, 1136, 80);
  c.fillStyle = '#fff'; c.font = `400 32px ${FONT}`; c.fillText('Sl', 101, y + 51);
  c.font = `600 32px ${FONT}`;
  c.fillText('Item Description', 161, y + 51); c.fillText('Qty', 631, y + 51); c.fillText('Price', 825, y + 51); c.fillText('Total', 1049, y + 51);
  c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(87, y, 1136, 80);
  [148, 617, 811, 1035].forEach(x => { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 80); c.stroke(); });
  y += 80;
  rows.forEach(r => {
    const it = r.it;
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(87, y, 1136, r.h);
    (it.flat ? [148, 1035] : [148, 617, 811, 1035]).forEach(x => { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + r.h); c.stroke(); });
    c.fillStyle = '#000'; c.font = `400 30px ${FONT}`;
    const cy = y + r.h / 2;
    c.fillText((r.i + 1) + '.', 101, cy + 10);
    const top = cy - (r.lines.length - 1) * 21.5 + 10;
    r.lines.forEach((l, k) => c.fillText(l, 161, top + k * 43));
    if (!it.flat) {
      if (it.qty !== '') c.fillText(fmt(num(it.qty)) + (it.unit ? ' ' + it.unit : ''), 631, cy + 10, 170);
      if (it.price !== '') c.fillText(fmt(num(it.price)), 825, cy + 10, 200);
    }
    c.fillText(fmt(num(it.total)) + ' Tk', 1049, cy + 10, 170);
    y += r.h;
  });
  if (pi === pages.length - 1) {
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(87, y, 1136, 78);
    c.beginPath(); c.moveTo(1035, y); c.lineTo(1035, y + 78); c.stroke();
    c.fillStyle = '#000'; c.font = `400 30px ${FONT}`; c.fillText('Total', 101, y + 50); c.fillText(fmtComma(total(inv)) + ' Tk', 1049, y + 50, 170);
  }
  c.fillStyle = RED; c.fillRect(0, 1697, BW, 160);
  c.fillStyle = '#fff'; c.font = `400 28px ${FONT}`;
  c.fillText(db.settings.email, 110, 1762); c.fillText(db.settings.phone, 110, 1806);
  db.settings.address.split('\n').slice(0, 2).forEach((l, k) => c.fillText(l, 631, 1762 + k * 40));
  if (pages.length > 1) { c.font = `400 22px ${FONT}`; c.fillText(`Page ${pi + 1} of ${pages.length}`, 1100, 1840); }
  return cv;
}

/* ---------- PDF: 300 dpi A4 pages (2480 x 3508) inside a hand-built PDF ---------- */
async function buildPDF(inv) {
  await loadFonts();
  const pages = paginate(inv), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = b => { if (typeof b === 'string') b = enc.encode(b); parts.push(b); len += b.length; };
  const W = 595.28, H = 841.89, n = pages.length;
  push('%PDF-1.4\n');
  const obj = (id, body, stream) => { offs[id] = len; push(`${id} 0 obj\n${body}`); if (stream) { push('\nstream\n'); push(stream); push('\nendstream'); } push('\nendobj\n'); };
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  const objs = [];
  for (let i = 0; i < n; i++) {
    const cv = drawPage(inv, pages, i, 2480);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
    objs.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height });
    cv.width = cv.height = 1;
  }
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  objs.forEach((o, i) => {
    const p = 3 + i * 3, content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`);
    obj(p + 1, `<< /Type /XObject /Subtype /Image /Width ${o.w} /Height ${o.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.bytes.length} >>`, o.bytes);
    obj(p + 2, `<< /Length ${content.length} >>`, content);
  });
  const cnt = 3 + n * 3, xref = len;
  push(`xref\n0 ${cnt}\n0000000000 65535 f \n`);
  for (let i = 1; i < cnt; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${cnt} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0;
  parts.forEach(a => { out.set(a, p); p += a.length; });
  return out;
}
const fileName = inv => `Invoice_${inv.customer.trim().replace(/[^\w]+/g, '_') || 'Customer'}_CorpoMerch_${inv.no}.pdf`;

function openPreview(inv) {
  const snap = clone(inv);
  pushPage({
    title: 'Preview ' + snap.no,
    build(entry) {
      entry.body.innerHTML = '<div class="spin"></div>';
      entry.foot.classList.remove('hid');
      entry.foot.innerHTML = `<button class="btn full tap" id="sh">${ICON.share}Share / Save PDF</button>`;
      loadFonts().then(() => {
        if (!entry.el.isConnected) return;
        const pages = paginate(snap);
        entry.body.innerHTML = pages.map((_, i) => `<div class="pv" style="animation-delay:${i * 80}ms"><img alt="Invoice page ${i + 1}"></div>`).join('');
        pages.forEach((_, i) => { entry.body.querySelectorAll('img')[i].src = drawPage(snap, pages, i, 1100).toDataURL('image/jpeg', 0.9); });
      });
      let busy = false;
      $('#sh', entry.foot).onclick = async () => {
        if (busy) return; busy = true;
        const btn = $('#sh', entry.foot); btn.style.opacity = .6; toast('Creating PDF...');
        try { await sharePDF(await buildPDF(snap), fileName(snap)); }
        catch (e) { if (!/cancel|abort/i.test(String(e && (e.message || e)))) toast('Could not share the PDF'); }
        busy = false; btn.style.opacity = 1;
      };
    }
  });
}

/* ---------- products ---------- */
function tProducts(v) {
  v.innerHTML = `<div class="lt"><h1>Products</h1><button class="btn sm tap" id="np">${ICON.plus}New</button></div>` +
    (db.products.map((p, i) => `<div class="card prod tap" data-id="${p.id}" style="animation-delay:${Math.min(i, 8) * 40}ms"><div class="t"><b>${esc(p.name)}</b><small>${esc(p.desc)}</small><small>${p.flat ? 'Flat ' : ''}${fmt(p.price)} Tk${p.unit && !p.flat ? ' / ' + esc(p.unit) : ''}</small></div>${ICON.chev}</div>`).join('') || '<div class="empty">No products yet.</div>');
  $('#np', v).onclick = () => editProduct();
  v.onclick = e => { const c = e.target.closest('[data-id]'); if (c) editProduct(db.products.find(x => x.id === c.dataset.id)); };
}
function editProduct(p) {
  const n = p ? clone(p) : { id: uid(), name: '', desc: '', price: '', unit: 'Pcs', flat: false };
  pushPage({
    title: p ? 'Edit product' : 'New product',
    build(entry) {
      const b = entry.body;
      b.innerHTML = `<div class="card"><label class="l">Name</label><input id="pn" value="${esc(n.name)}" placeholder="e.g. Coupon">
      <div class="gap"></div><label class="l">Description printed on invoice</label><textarea id="pd">${esc(n.desc)}</textarea>
      <div class="row" style="margin-top:10px"><div><label class="l">Default price (Tk)</label><input id="pp" inputmode="decimal" value="${esc(n.price)}"></div><div><label class="l">Unit</label><input id="pu" value="${esc(n.unit)}" placeholder="Pcs"></div></div>
      <label class="sw"><input type="checkbox" id="pf" ${n.flat ? 'checked' : ''}>Flat amount (like a charge)</label></div>
      ${p ? `<button class="btn sec full tap" id="pdl">${ICON.trash}Delete product</button>` : ''}`;
      autosize($('#pd', b)); $('#pd', b).oninput = e => autosize(e.target);
      entry.foot.classList.remove('hid');
      entry.foot.innerHTML = `<button class="btn full tap" id="ps">${ICON.check}Save product</button>`;
      $('#ps', entry.foot).onclick = () => {
        n.name = $('#pn', b).value.trim(); n.desc = $('#pd', b).value.trim() || n.name; n.price = num($('#pp', b).value); n.unit = $('#pu', b).value.trim(); n.flat = $('#pf', b).checked;
        if (!n.name) return toast('Enter a name');
        if (p) Object.assign(p, n); else db.products.push(n);
        persist(); closePage(entry); renderTab(); toast('Product saved');
      };
      if (p) $('#pdl', b).onclick = () => ask('Delete product?', 'Existing invoices are not affected.', 'Delete', () => { db.products = db.products.filter(x => x !== p); persist(); closePage(entry); renderTab(); });
    }
  });
}

/* ---------- settings ---------- */
function tSettings(v) {
  const s = db.settings;
  v.innerHTML = `<div class="lt"><h1>Settings</h1></div>
  <div class="card"><div class="row"><div><label class="l">Invoice prefix</label><input id="sp" value="${esc(s.prefix)}"></div><div><label class="l">Next number</label><input id="sn" inputmode="numeric" value="${s.next}"></div></div>
  <div class="gap"></div><label class="l">Footer email</label><input id="se" value="${esc(s.email)}">
  <div class="gap"></div><label class="l">Footer phone</label><input id="sh" value="${esc(s.phone)}">
  <div class="gap"></div><label class="l">Footer address (2 lines max)</label><textarea id="sa">${esc(s.address)}</textarea></div>
  <button class="btn full tap" id="ss">${ICON.check}Save settings</button>
  <div class="secth" style="margin-top:22px"><span>Backup</span></div>
  <div class="card"><button class="btn sec full tap" id="ex">${ICON.share}${isNative ? 'Share backup' : 'Copy backup'}</button>
  <div class="gap"></div><textarea id="bk" placeholder="Paste a backup here to restore" style="min-height:70px"></textarea>
  <div class="gap"></div><button class="btn line full tap" id="im">Restore from pasted backup</button>
  <p class="hint">Your invoices and products are stored inside this app on your phone. Uninstalling the app erases them, so keep a backup (send it to yourself on WhatsApp or save it to a note).</p></div>`;
  autosize($('#sa', v));
  $('#ss', v).onclick = () => {
    s.prefix = $('#sp', v).value.trim(); s.next = parseInt($('#sn', v).value) || 1; s.email = $('#se', v).value.trim(); s.phone = $('#sh', v).value.trim(); s.address = $('#sa', v).value.trim();
    persist(); toast('Settings saved');
  };
  $('#ex', v).onclick = async () => { const ok = await shareText(JSON.stringify(db), 'CorpoMerch invoice backup'); if (!isNative) toast(ok ? 'Backup copied' : 'Could not copy'); };
  $('#im', v).onclick = () => {
    let d; try { d = JSON.parse($('#bk', v).value); if (!d.settings || !d.products || !d.invoices) throw 0; } catch (e) { return toast('That is not a valid backup'); }
    ask('Restore backup?', 'This replaces all current invoices, products and settings.', 'Restore', () => { db = d; persist(); renderTab(); toast('Backup restored'); });
  };
}

/* ---------- start ---------- */
(async () => {
  const saved = await loadData();
  if (saved && saved.settings && saved.products) db = saved;
  onBack(goBack);
  let base = window.innerHeight;
  window.addEventListener('resize', () => {
    if (window.innerHeight > base) base = window.innerHeight;
    const kb = window.innerHeight < base - 150;
    document.body.classList.toggle('kb', kb);
    const a = document.activeElement;
    if (kb && a && /INPUT|TEXTAREA/.test(a.tagName)) setTimeout(() => a.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  });
  drawNav(); renderTab();
})();
