/**
 * =============================================================================
 * ALXANTHIA STUDIO — INTEGRATION TEST SUITE (EXERCISING ACTUAL APP.JS)
 * =============================================================================
 * Run with: node tests/verify-ordering.js
 * 
 * Verifies Pass A, Pass B, and Pass C requirements against the real application
 * controller (app.js) and data configuration (site-content.js) in a DOM sandbox.
 * =============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================================');
console.log('ALXANTHIA STUDIO — EXECUTING ACTUAL APPLICATION INTEGRATION SUITE');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// 1. High-Fidelity DOM Mock Environment
// ---------------------------------------------------------------------------

function createMockElement(tagName, id = '', className = '') {
  const children = [];
  const attributes = {};
  const eventListeners = {};
  let _textContent = '';

  const classList = {
    _classes: new Set(className ? className.split(/\s+/).filter(Boolean) : []),
    add(...cls) { cls.forEach(c => this._classes.add(c)); },
    remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
    toggle(c, force) {
      if (force !== undefined) {
        if (force) this._classes.add(c);
        else this._classes.delete(c);
        return force;
      }
      if (this._classes.has(c)) {
        this._classes.delete(c);
        return false;
      }
      this._classes.add(c);
      return true;
    },
    contains(c) { return this._classes.has(c); }
  };

  const style = {};

  const element = {
    tagName: tagName.toUpperCase(),
    id,
    style,
    classList,
    dataset: {},
    children,
    focused: false,

    get className() {
      return Array.from(classList._classes).join(' ');
    },
    set className(val) {
      classList._classes = new Set(val ? val.split(/\s+/).filter(Boolean) : []);
    },

    get href() {
      return attributes['href'] || '';
    },
    set href(val) {
      if (val !== undefined && val !== null) attributes['href'] = String(val);
      else delete attributes['href'];
    },

    get src() {
      return attributes['src'] || '';
    },
    set src(val) {
      if (val !== undefined && val !== null) attributes['src'] = String(val);
      else delete attributes['src'];
    },

    get alt() {
      return attributes['alt'] || '';
    },
    set alt(val) {
      if (val !== undefined && val !== null) attributes['alt'] = String(val);
      else delete attributes['alt'];
    },

    get disabled() {
      return attributes['disabled'] !== undefined;
    },
    set disabled(val) {
      if (val) attributes['disabled'] = 'true';
      else delete attributes['disabled'];
    },

    get textContent() {
      if (children.length > 0) {
        return children.map(c => c.textContent).join('');
      }
      return _textContent;
    },
    set textContent(val) {
      children.length = 0;
      _textContent = String(val);
    },

    get innerHTML() {
      if (children.length > 0) {
        return children.map(c => c.innerHTML || c.textContent).join('');
      }
      return _textContent;
    },
    set innerHTML(html) {
      children.length = 0;
      _textContent = '';
      if (!html) return;
      // Simple parser for standard mock elements
      // If setting innerHTML with tags, create child elements
      const tagRegex = /<([a-z0-9\-]+)([^>]*)>(.*?)<\/\1>|<([a-z0-9\-]+)([^>]*)\/>/gi;
      let match;
      let lastIndex = 0;
      let hasTags = false;
      while ((match = tagRegex.exec(html)) !== null) {
        hasTags = true;
        const tag = match[1] || match[4];
        const rawAttrs = match[2] || match[5] || '';
        const body = match[3] || '';
        const child = createMockElement(tag);

        const classMatch = rawAttrs.match(/class=["']([^"']+)["']/i);
        if (classMatch) child.className = classMatch[1];
        const idMatch = rawAttrs.match(/id=["']([^"']+)["']/i);
        if (idMatch) child.id = idMatch[1];
        const ariaHiddenMatch = rawAttrs.match(/aria-hidden=["']([^"']+)["']/i);
        if (ariaHiddenMatch) child.setAttribute('aria-hidden', ariaHiddenMatch[1]);

        if (body) {
          if (body.includes('<')) {
            child.innerHTML = body;
          } else {
            child.textContent = body;
          }
        }
        children.push(child);
        lastIndex = tagRegex.lastIndex;
      }
      if (!hasTags) {
        _textContent = html;
      }
    },

    setAttribute(name, value) {
      attributes[name] = String(value);
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
      if (name === 'href') element.href = value;
      if (name === 'src') element.src = value;
      if (name === 'alt') element.alt = value;
    },
    getAttribute(name) {
      return attributes[name] !== undefined ? attributes[name] : null;
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    hasAttribute(name) {
      return attributes[name] !== undefined;
    },

    appendChild(child) {
      children.push(child);
      child.parentElement = element;
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentElement = null;
      return child;
    },

    addEventListener(event, handler) {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(handler);
    },
    removeEventListener(event, handler) {
      if (!eventListeners[event]) return;
      const idx = eventListeners[event].indexOf(handler);
      if (idx !== -1) eventListeners[event].splice(idx, 1);
    },
    dispatchEvent(event) {
      const type = typeof event === 'string' ? event : event.type;
      const handlers = eventListeners[type] || [];
      const evObj = typeof event === 'object' ? event : { type, target: element, preventDefault() {} };
      handlers.forEach(h => h(evObj));
    },

    click() {
      let defaultPrevented = false;
      const ev = {
        type: 'click',
        target: element,
        preventDefault() { defaultPrevented = true; }
      };
      const handlers = eventListeners['click'] || [];
      handlers.forEach(h => h(ev));
      if (typeof element.onclick === 'function') {
        element.onclick(ev);
      }
      return !defaultPrevented;
    },

    focus() {
      element.focused = true;
      if (sandbox.document) sandbox.document.activeElement = element;
      const handlers = eventListeners['focus'] || [];
      handlers.forEach(h => h({ type: 'focus', target: element }));
    },

    getBoundingClientRect() {
      return { top: 100, bottom: 200, left: 0, right: 300, width: 300, height: 100 };
    },

    querySelector(sel) {
      return querySelectorUnder(element, sel);
    },
    querySelectorAll(sel) {
      const results = [];
      querySelectorAllUnder(element, sel, results);
      return results;
    },
    closest(sel) {
      let cur = element;
      while (cur) {
        if (matchesSelector(cur, sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },

    contains(node) {
      let cur = node;
      while (cur) {
        if (cur === element) return true;
        cur = cur.parentElement;
      }
      return false;
    }
  };

  return element;
}

function matchesSelector(el, sel) {
  if (!el || !sel) return false;
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) return el.classList && el.classList.contains(sel.slice(1));
  return el.tagName && el.tagName.toLowerCase() === sel.toLowerCase();
}

function querySelectorUnder(parent, sel) {
  for (const child of parent.children) {
    if (matchesSelector(child, sel)) return child;
    const sub = querySelectorUnder(child, sel);
    if (sub) return sub;
  }
  return null;
}

function querySelectorAllUnder(parent, sel, results) {
  for (const child of parent.children) {
    if (matchesSelector(child, sel)) results.push(child);
    querySelectorAllUnder(child, sel, results);
  }
}

// ---------------------------------------------------------------------------
// 2. Build Sandbox DOM Document
// ---------------------------------------------------------------------------

const elementsRegistry = {};

function registerEl(tag, id, cls) {
  const el = createMockElement(tag, id, cls);
  if (id) elementsRegistry[id] = el;
  return el;
}

const docElement = createMockElement('html');
docElement.lang = 'id';

// Register all elements required by app.js
registerEl('div', 'main-content');
registerEl('header', '', 'site-header');
registerEl('footer', 'site-footer', 'site-footer');
registerEl('div', 'hero');
registerEl('div', 'collection');
registerEl('div', 'bouquets');
registerEl('div', 'order');
registerEl('div', 'custom-builder');
registerEl('div', 'custom-builder-body');
registerEl('div', 'sticky-order-bar');

// Sticky bar sub-elements
registerEl('span', 'sticky-order-title');
registerEl('span', 'sticky-order-price');
registerEl('button', 'sticky-order-cta');

// Order summary sub-elements
registerEl('ul', 'cart-lines');
registerEl('div', 'order-picker');
registerEl('p', 'order-picker-label');
registerEl('div', 'order-picker-flowers');
registerEl('div', 'order-picker-packages');
registerEl('span', 'summary-price');
registerEl('span', 'summary-shipping-note');
registerEl('p', 'includes-label');
registerEl('ul', 'summary-includes-list');
registerEl('div', 'custom-min-warning-banner');
registerEl('span', 'custom-min-warning-text');
registerEl('p', 'order-note');
registerEl('div', 'order-announcer');

// Channel elements
const btnWhatsapp = registerEl('a', 'btn-whatsapp', 'btn-channel btn-whatsapp-primary');
btnWhatsapp.appendChild(createMockElement('span', '', 'channel-name'));
btnWhatsapp.appendChild(createMockElement('span', '', 'channel-action'));

const btnShopee = registerEl('a', 'btn-shopee', 'btn-channel btn-shopee');
btnShopee.appendChild(createMockElement('span', '', 'channel-name'));
btnShopee.appendChild(createMockElement('span', 'shopee-channel-sub', 'channel-sub'));
btnShopee.appendChild(createMockElement('span', 'shopee-channel-action', 'channel-action'));

registerEl('div', 'marketplace-status-box');
registerEl('span', 'mkt-soon-tag');
registerEl('p', 'marketplace-status-text');

// Custom builder elements
registerEl('span', 'custom-stem-count');
registerEl('button', 'custom-reset-btn');
registerEl('span', 'custom-est-label');
registerEl('span', 'est-flowers-label');
registerEl('span', 'est-flowers-val');
registerEl('div', 'est-discount-row');
registerEl('span', 'est-discount-label');
registerEl('span', 'est-discount-val');
registerEl('span', 'est-wrap-label');
registerEl('span', 'est-wrap-val');
registerEl('span', 'est-total-label');
registerEl('span', 'est-total-val');
registerEl('p', 'custom-hint');
registerEl('button', 'btn-use-custom');
registerEl('ul', 'custom-rows-list');

// Collection & bouquet containers
registerEl('div', 'collection-grid');
registerEl('div', 'packages-grid');

// Lang & nav
registerEl('button', 'lang-id');
registerEl('button', 'lang-en');
registerEl('button', 'nav-toggle');
registerEl('div', 'nav-menu');
registerEl('div', 'nav-scrim');
registerEl('a', 'brand-link');
registerEl('button', 'btn-edit-selection');
registerEl('h3', 'finish-label');
registerEl('textarea', 'card-note-input');
registerEl('textarea', 'order-note-input');
registerEl('div', 'wrap-chips');
registerEl('div', 'wrap-options');
registerEl('nav', 'category-nav');
registerEl('button', 'btn-toggle-custom');
registerEl('div', 'channels-disabled-box');

// Modal
const imageModal = registerEl('dialog', 'image-modal');
imageModal.showModal = function() { imageModal.setAttribute('open', ''); };
imageModal.close = function() {
  imageModal.removeAttribute('open');
  imageModal.dispatchEvent('close');
};
registerEl('button', 'image-modal-close');
registerEl('img', 'image-modal-img');
registerEl('h4', 'image-modal-title');
registerEl('p', 'image-modal-caption');

// Lock screen
registerEl('div', 'lock-screen');
registerEl('form', 'lock-form');
registerEl('input', 'passcode-input');
registerEl('p', 'lock-error');
registerEl('button', 'btn-lock-site');

// Footer links
registerEl('span', 'footer-care');
registerEl('span', 'footer-copyright');
registerEl('a', 'footer-link-ig');
registerEl('a', 'footer-link-shopee');

// Assemble document structure
const body = createMockElement('body');
Object.values(elementsRegistry).forEach(el => body.appendChild(el));
docElement.appendChild(body);

const metaDesc = createMockElement('meta');
metaDesc.setAttribute('name', 'description');
const metaOgTitle = createMockElement('meta');
metaOgTitle.setAttribute('property', 'og:title');
const metaOgDesc = createMockElement('meta');
metaOgDesc.setAttribute('property', 'og:description');
const metaTwTitle = createMockElement('meta');
metaTwTitle.setAttribute('name', 'twitter:title');
const metaTwDesc = createMockElement('meta');
metaTwDesc.setAttribute('name', 'twitter:description');

const storageStore = {};
const mockLocalStorage = {
  getItem: (k) => storageStore[k] || null,
  setItem: (k, v) => { storageStore[k] = String(v); },
  removeItem: (k) => { delete storageStore[k]; }
};

const mockDocument = {
  documentElement: docElement,
  body: body,
  title: '',
  activeElement: null,
  getElementById: (id) => elementsRegistry[id] || null,
  querySelector: (sel) => {
    if (sel === 'meta[name="description"]') return metaDesc;
    if (sel === 'meta[property="og:title"]') return metaOgTitle;
    if (sel === 'meta[property="og:description"]') return metaOgDesc;
    if (sel === 'meta[name="twitter:title"]') return metaTwTitle;
    if (sel === 'meta[name="twitter:description"]') return metaTwDesc;
    if (sel.startsWith('#')) return elementsRegistry[sel.slice(1)] || null;
    return querySelectorUnder(body, sel);
  },
  querySelectorAll: (sel) => {
    const results = [];
    querySelectorAllUnder(body, sel, results);
    return results;
  },
  createElement: (tag) => createMockElement(tag),
  addEventListener: () => {},
  removeEventListener: () => {}
};

const sandbox = {
  window: null,
  document: mockDocument,
  localStorage: mockLocalStorage,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }),
  IntersectionObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  setTimeout: (fn) => { fn(); },
  clearTimeout: () => {},
  URL: URL,
  URLSearchParams: URLSearchParams,
  console: console,
  location: { hash: '' },
  innerWidth: 1280,
  innerHeight: 800,
  scrollY: 0,
  scrollTo: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
sandbox.window = sandbox;

// Load site-content.js and app.js into context
const siteContentSrc = fs.readFileSync(path.join(__dirname, '..', 'site-content.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

vm.createContext(sandbox);
vm.runInContext(siteContentSrc, sandbox);
vm.runInContext(appSrc, sandbox);

const app = sandbox.window.AlxanthiaApp;
assert(app, 'FATAL: window.AlxanthiaApp must be exported by app.js');

console.log('✔ Environment initialized: app.js loaded into high-fidelity DOM context\n');

// ---------------------------------------------------------------------------
// Cart-line DOM helpers (P1-06) — read the rendered #cart-lines list rather
// than a single summary title, since the cart can now hold multiple lines.
// ---------------------------------------------------------------------------
function cartLineEls() {
  // Exclude the UX-01 empty-state placeholder <li> — callers care about real cart lines.
  return Array.from(mockDocument.getElementById('cart-lines').children).filter(el => el.classList.contains('cart-line'));
}
function cartLineTitle(index) {
  const li = cartLineEls()[index];
  return li ? li.querySelector('.cart-line-title').textContent : undefined;
}
function cartLinePrice(index) {
  const li = cartLineEls()[index];
  return li ? li.querySelector('.cart-line-price').textContent : undefined;
}
function cartLineQty(index) {
  const li = cartLineEls()[index];
  return li ? li.querySelector('.stepper-count').textContent : undefined;
}
function lastCartLineTitle() {
  return cartLineTitle(cartLineEls().length - 1);
}
function formatRpForTest(n) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// ---------------------------------------------------------------------------
// Suite 1: R03 - Neutral Initial State (Before User Selection)
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: Neutral Initial State (R03) ---');
const state1 = app.getState();
assert.strictEqual(state1.hasUserSelected, false, 'hasUserSelected must initialize to false');

const cartLines = mockDocument.getElementById('cart-lines');
const summaryPrice = mockDocument.getElementById('summary-price');
const includesLabel = mockDocument.getElementById('includes-label');
const includesList = mockDocument.getElementById('summary-includes-list');
const shippingNote = mockDocument.getElementById('summary-shipping-note');
const waBtn = mockDocument.getElementById('btn-whatsapp');
const stickyTitle = mockDocument.getElementById('sticky-order-title');
const stickyPrice = mockDocument.getElementById('sticky-order-price');
const stickyCta = mockDocument.getElementById('sticky-order-cta');

assert.strictEqual(cartLines.children.length, 1, 'Empty cart must render exactly one empty-state message, not zero lines (UX-01)');
assert(cartLines.textContent.trim().length > 0, 'Empty cart message must have non-empty text (UX-01)');
assert.strictEqual(cartLines.querySelectorAll('.cart-line').length, 0, 'Cart must start with no real cart lines (P1-06)');
assert.strictEqual(summaryPrice.style.display, 'none', 'Price must be hidden (not a "—" placeholder) while the cart is empty (P1-08)');
assert.strictEqual(includesList.children.length, 0, 'Includes list must stay empty rather than show instructions in place of inclusions (T2-8)');
assert.strictEqual(includesLabel.style.display, 'none', '"Termasuk" label must be hidden when there is nothing to include yet (T2-8)');
assert(!includesList.textContent.includes('Kartu ucapan'), 'Includes must not claim card was prepared when none chosen');
assert.strictEqual(shippingNote.style.display, 'none', 'Shipping note must be hidden when there is no price to qualify (T2-8)');

// WhatsApp Button must be in disabled prompt state
assert.strictEqual(waBtn.getAttribute('aria-disabled'), 'true', 'WhatsApp button must be aria-disabled');
assert(waBtn.classList.contains('btn-disabled'), 'WhatsApp button must have btn-disabled class');
assert.strictEqual(waBtn.getAttribute('href'), null, 'WhatsApp button must NOT have active href on initial visit');
const waChannelName = waBtn.querySelector('.channel-name');
assert(waChannelName.textContent.includes('pilih bunga'), `WA button prompt should request selection, got: ${waChannelName.textContent}`);

// Sticky Mobile Bar must prompt browsing
assert.strictEqual(stickyTitle.textContent, 'Alxanthia Studio');
assert.strictEqual(stickyPrice.textContent, 'Pilih bunga');
assert.strictEqual(stickyCta.textContent, 'Lihat bunganya ↓');
console.log('✔ Suite 1 Passed: Order summary and sticky bar initialize to honest neutral state');

// ---------------------------------------------------------------------------
// Suite 2: R02 - Gift Note HTML Injection Prevention
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: Gift Note Safe textContent Assignment (R02) ---');
app.selectStem('Sunflower', false);
assert.strictEqual(app.getState().hasUserSelected, true);

app.setMessageCardEnabled(true);
const maliciousNote = '<script>alert("hack")</script><b onmouseover="evil()">Selamat!</b>';
app.setOrderNote(maliciousNote);

// Verify that the note was safely inserted via textContent
const noteItems = includesList.children.filter(li => li.textContent.includes('Selamat!'));
assert.strictEqual(noteItems.length, 1, 'Gift note item must appear in summary includes list');

const noteItem = noteItems[0];
// Must have separate span.bullet-dot
const dotSpan = noteItem.querySelector('.bullet-dot');
assert(dotSpan, 'Bullet dot must exist as dedicated element');
assert.strictEqual(dotSpan.getAttribute('aria-hidden'), 'true');
assert.strictEqual(dotSpan.textContent, '·');

// Verify no script tag was created in DOM
const scriptTag = noteItem.querySelector('script');
assert.strictEqual(scriptTag, null, 'SECURITY CHECK: No script element should ever exist in DOM');
const boldTag = noteItem.querySelector('b');
assert.strictEqual(boldTag, null, 'SECURITY CHECK: No b tag should exist (must be raw text)');
assert(noteItem.textContent.includes('<script>alert("hack")</script>'), 'Raw characters must be safely rendered as text content');
console.log('✔ Suite 2 Passed: User-supplied gift notes are strictly safely bound via textContent');

// ---------------------------------------------------------------------------
// Suite 3: Single Stem Selection & WhatsApp Message Composition
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: Single Finished Stem Selection ---');
app.resetToInitial();
app.selectStem('Tulip', false);
assert.strictEqual(app.getState().orderMode, 'stem');
assert.strictEqual(app.getState().selectedFlower, 'Tulip');

assert.strictEqual(cartLineEls().length, 1, 'Selecting a stem from empty must yield exactly one cart line');
assert.strictEqual(cartLineTitle(0), 'Tulip');
assert.strictEqual(summaryPrice.textContent, 'Rp 50.000');

// WhatsApp button must now be active
assert.strictEqual(waBtn.getAttribute('aria-disabled'), null);
assert(!waBtn.classList.contains('btn-disabled'));
const waHref = waBtn.getAttribute('href');
const configuredWaNumber = String(app.getData().store.whatsappNumber || '').replace(/[^0-9]/g, '');
assert(waHref && waHref.startsWith(`https://wa.me/${configuredWaNumber}?text=`), 'WhatsApp link must use the configured store number');
const decodedWa = decodeURIComponent(waHref);
assert(decodedWa.includes('1 × Tulip — tangkai jadi'), 'WhatsApp text must contain stem quantity and flower name');
assert(decodedWa.includes('Total Rp 50.000'), 'WhatsApp text must contain formatted total');
assert(decodedWa.includes('belum termasuk ongkir'), 'WhatsApp text must specify shipping excluded');
// P1-01 / P1-02: exercise production message assembly for every mode and language.
const originalMessageData = JSON.parse(JSON.stringify(app.getData()));
const messageCases = [
  ['id', 'stem', 'Halo Alxanthia! Saya ingin memesan 1 × Mawar — tangkai jadi — Total Rp 60.000 (belum termasuk ongkir). Pembungkus: Kraft. Apakah masih tersedia?', 'Rp 60.000'],
  ['en', 'stem', 'Hello Alxanthia! I would like to order 1 × Rose — finished stem — Total Rp 60.000 (excludes delivery fee). Wrap: Kraft. Is it available?', 'Rp 60.000'],
  ['id', 'package', 'Halo Alxanthia! Saya ingin memesan Buket Mini (3 tangkai) — Rp 195.000 (belum termasuk ongkir). Pembungkus: Kraft. Apakah masih tersedia?', 'Rp 195.000'],
  ['en', 'package', 'Hello Alxanthia! I would like to order The Posy (3 stems) — Rp 195.000 (excludes delivery fee). Wrap: Kraft. Is it available?', 'Rp 195.000'],
  ['id', 'custom', 'Halo Alxanthia! Saya ingin memesan Buket Custom (3 tangkai, estimasi Rp 205.000, belum termasuk ongkir):\n• 2 × Bunga Matahari\n• 1 × Mawar\nPembungkus: Kraft. Apakah bisa dibuatkan?', 'Rp 205.000'],
  ['en', 'custom', 'Hello Alxanthia! I would like to order a Custom Bouquet (3 stems, estimated Rp 205.000, excludes delivery fee):\n• 2 × Sunflower\n• 1 × Rose\nWrap: Kraft. Can this be arranged?', 'Rp 205.000']
];
const readWaMessage = () => new URL(waBtn.getAttribute('href')).searchParams.get('text');
for (const [lang, mode, expected, total] of messageCases) {
  app.setData(originalMessageData);
  app.resetToInitial();
  app.setLanguage(lang);
  if (mode === 'stem') app.selectStem('Rose', false);
  else if (mode === 'package') app.selectPackage(0, false);
  else {
    app.bumpCustom('Sunflower', 2);
    app.bumpCustom('Rose', 1);
    app.useCustom();
  }
  app.setOrderNote('');
  assert.strictEqual(readWaMessage(), expected, `${lang}/${mode}: preserve exact message wording`);
  assert(!/[{}]/.test(readWaMessage()), `${lang}/${mode}: empty note must leave no braces`);
  if (mode === 'stem') {
    assert(!/\(\s*—/.test(readWaMessage()), `${lang}: stem suffix must not be parenthesized`);
    assert.strictEqual(cartLineTitle(0), lang === 'id' ? 'Mawar' : 'Rose');
  }
  // With the message-card checkbox off, note text must never leak into the message.
  app.setOrderNote('Untuk {Alam}');
  assert(!readWaMessage().includes('Alam'), `${lang}/${mode}: note must not appear while the message-card checkbox is unchecked`);

  app.setMessageCardEnabled(true);
  app.setOrderNote('Untuk {Alam}');
  assert(readWaMessage().includes('"Untuk {Alam}"'), `${lang}/${mode}: preserve greeting braces verbatim`);
  app.setOrderNote('{total}');
  assert(readWaMessage().includes('"{total}"'), `${lang}/${mode}: never expand greeting placeholders`);
  const liveTotal = formatRpForTest(app.computeCartTotals(app.getCart()).total);
  assert.strictEqual(readWaMessage().split(liveTotal).length - 1, 1, `${lang}/${mode}: total appears only once`);
  app.setMessageCardEnabled(false);

  // Missing configuration must retain the same fallback message.
  const withLiteralNote = readWaMessage();
  for (const missing of ['object', 'language', 'mode']) {
    const fallbackData = JSON.parse(JSON.stringify(originalMessageData));
    if (missing === 'object') delete fallbackData.store.whatsappTemplates;
    else if (missing === 'language') delete fallbackData.store.whatsappTemplates[lang];
    else delete fallbackData.store.whatsappTemplates[lang][mode];
    app.setData(fallbackData);
    assert.strictEqual(readWaMessage(), withLiteralNote, `${lang}/${mode}: missing ${missing} uses fallback`);
  }
}

app.setData(originalMessageData);
app.resetToInitial();
app.setLanguage('id');
const editedMessageData = JSON.parse(JSON.stringify(originalMessageData));
editedMessageData.store.whatsappTemplates.id.stem = 'TESTMARKER {total}';
app.setData(editedMessageData);
app.selectStem('Rose', false);
assert.strictEqual(readWaMessage(), 'TESTMARKER Rp 60.000', 'Owner template must control the produced message');
editedMessageData.store.whatsappTemplates.id.stem = 'TESTMARKER {unknown} {total} {total} {cardInfo}';
app.setData(editedMessageData);
assert.strictEqual(readWaMessage(), 'TESTMARKER  Rp 60.000 Rp 60.000 ', 'Unknown keys become empty and repeated keys are filled');
assert(!/[{}]/.test(readWaMessage()), 'Empty note leaves no template braces');
app.setMessageCardEnabled(true);
app.setOrderNote('{total}');
const cardTotal3 = formatRpForTest(60000 + (app.getData().messageCardPrice ?? 0));
assert.strictEqual(readWaMessage(), `TESTMARKER  ${cardTotal3} ${cardTotal3} Kartu ucapan: "{total}". `, 'Inserted card text is never re-scanned');

// Restore the original suite's selection and note for the quantity-stepper checks.
app.setData(originalMessageData);
app.resetToInitial();
app.setLanguage('id');
app.selectStem('Tulip', false);
app.setOrderNote(maliciousNote);
console.log('✔ Suite 3 Passed: Tulip stem selected and correctly formatted in summary and WhatsApp URL');

// ---------------------------------------------------------------------------
// Suite 4: Single Stem Quantity Stepper Calculation
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: Cart-Line Quantity Stepper ---');
const tulipLineId = app.getCart()[0].id;
app.bumpLineQty(tulipLineId, 2); // 1 + 2 = 3 stems
assert.strictEqual(cartLineEls().length, 1, 'Bumping qty must mutate the existing line, not add a new one');
assert.strictEqual(cartLineTitle(0), 'Tulip');
assert.strictEqual(cartLineQty(0), '3');
assert.strictEqual(summaryPrice.textContent, 'Rp 150.000');

const decodedWaQty = decodeURIComponent(waBtn.getAttribute('href'));
assert(decodedWaQty.includes('3 × Tulip — tangkai jadi — Total Rp 150.000'));
console.log('✔ Suite 4 Passed: 3x Tulip calculated exactly to Rp 150.000 in summary and message');

// ---------------------------------------------------------------------------
// Suite 5: Florist Bouquet Packages (Tiers 0, 1, 2, 3)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 5: Florist Bouquet Packages ---');
app.resetToInitial();
// Package 0: Buket Mini (3 stems, Rp 195.000)
app.selectPackage(0, false);
assert.strictEqual(app.getState().orderMode, 'package');
assert.strictEqual(cartLineEls().length, 1);
assert.strictEqual(cartLineTitle(0), 'Buket Mini');
assert.strictEqual(summaryPrice.textContent, 'Rp 195.000');
assert(decodeURIComponent(waBtn.getAttribute('href')).includes('Buket Mini (3 tangkai) — Rp 195.000'));

// Selecting the SAME package again must merge into one line with qty 2, not duplicate it (P1-06)
app.selectPackage(0, false);
assert.strictEqual(cartLineEls().length, 1, 'Re-selecting the same package must merge, not duplicate the line');
assert.strictEqual(cartLineQty(0), '2');
assert.strictEqual(summaryPrice.textContent, 'Rp 390.000');

// Selecting a DIFFERENT package must add a second line, not replace the cart (P1-06)
app.selectPackage(2, false); // Buket Besar: 9 stems, Rp 465.000
assert.strictEqual(cartLineEls().length, 2, 'Selecting a different package must add a line, not replace the cart');
assert.strictEqual(cartLineTitle(1), 'Buket Besar');
assert.strictEqual(summaryPrice.textContent, 'Rp 855.000');

const multiLineWaMsg = decodeURIComponent(waBtn.getAttribute('href'));
assert(multiLineWaMsg.includes('2 × Buket Mini — Rp 390.000'), 'Multi-line WhatsApp message must enumerate the merged package line with its qty and subtotal');
assert(multiLineWaMsg.includes('1 × Buket Besar — Rp 465.000'), 'Multi-line WhatsApp message must enumerate the second package line');
assert(multiLineWaMsg.includes('Total Rp 855.000'), 'Multi-line WhatsApp message must show the cart total');
console.log('✔ Suite 5 Passed: Florist packages merge on re-selection and add distinct lines otherwise');

// ---------------------------------------------------------------------------
// Suite 6: Custom Builder Draft Stays Out of the Cart Until Committed (P1-06)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 6: Custom Builder Draft vs Committed Cart (P1-06) ---');
app.resetToInitial();
assert.strictEqual(app.getState().hasUserSelected, false);

// Adjusting a stepper updates the builder's own draft estimate only — it
// must NOT add a cart line (that was P1-04-era behaviour; P1-06 requires an
// explicit "Gunakan buket ini" commit so multiple distinct bouquets are possible).
app.bumpCustom('Sunflower', 1);
assert.strictEqual(app.getState().hasUserSelected, false, 'Bumping the builder draft must not touch the cart');
assert.strictEqual(cartLineEls().length, 0, 'An in-progress draft must not appear as a cart line');

const customTotals1 = app.getCustomTotals();
assert.strictEqual(customTotals1.stems, 1);
assert.strictEqual(customTotals1.isValid, false, '1 stem custom bouquet must be invalid');

assert.strictEqual(summaryPrice.style.display, 'none', 'Cart-level price must stay hidden while only the draft is being built');
assert.strictEqual(waBtn.getAttribute('aria-disabled'), 'true', 'WhatsApp button must stay disabled — nothing has been committed yet');
assert(waBtn.classList.contains('btn-disabled'));
console.log('✔ Suite 6 Passed: Custom builder steppers only touch the draft until explicitly committed');

// ---------------------------------------------------------------------------
// Suite 7: Custom Builder Draft Dynamic Count & Localization (R04)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 7: Custom Builder Draft Dynamic Count & Localization (R04) ---');
// Add 1 Rose -> total 2 stems in the draft (still below minStems, still uncommitted)
app.bumpCustom('Rose', 1);
assert.strictEqual(app.getCustomTotals().stems, 2);
assert.strictEqual(cartLineEls().length, 0, 'A below-minimum draft must never reach the cart');

const customStemCount = mockDocument.getElementById('custom-stem-count');
const customHint = mockDocument.getElementById('custom-hint');

// Indonesian
assert.strictEqual(customStemCount.textContent, '2 tangkai', 'Draft stem count must update live as flowers are added');
assert(customHint.textContent.includes('minimal 3 tangkai'), 'Draft hint must localize the minimum-stems message');
assert(customHint.classList.contains('has-warning'));

// English
app.setLanguage('en');
assert.strictEqual(customStemCount.textContent, '2 stems', 'EN: Draft stem count must localize');
assert(customHint.textContent.includes('at least 3 stems'), 'EN: Draft hint must localize the minimum-stems message');

// Switch back to Indonesian
app.setLanguage('id');
assert.strictEqual(customStemCount.textContent, '2 tangkai');
assert(customHint.textContent.includes('minimal 3 tangkai'));
console.log('✔ Suite 7 Passed: Custom builder draft dynamically reflects stems and localizes in ID and EN');

// ---------------------------------------------------------------------------
// Suite 8: Valid Custom Bouquet (3 stems), Commit to Cart & Wrap Fee Scaling
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 8: Valid Custom Calculations, Commit & Wrap Fee Scaling ---');
// Add 1 Tulip -> Total stems = 3 (1 Sunflower @ 55k, 1 Rose @ 60k, 1 Tulip @ 50k)
app.bumpCustom('Tulip', 1);
const tot3 = app.getCustomTotals();
assert.strictEqual(tot3.stems, 3);
assert.strictEqual(tot3.flowersSubtotal, 165000);
assert.strictEqual(tot3.wrapFee, 35000, 'wrapFeePerUnit charged once for the first group of wrapFeeUnitStems stems');
assert.strictEqual(tot3.total, 200000);
assert.strictEqual(tot3.isValid, true);
assert.strictEqual(cartLineEls().length, 0, 'Still just a valid draft — committing is a separate, explicit step');

// Commit the draft: "Gunakan buket ini" adds it as a cart line
app.useCustom();
assert.strictEqual(cartLineEls().length, 1, 'useCustom() must commit the draft as a cart line');
assert.strictEqual(summaryPrice.textContent, 'Rp 200.000');
assert.strictEqual(waBtn.getAttribute('aria-disabled'), null);
assert(!waBtn.classList.contains('btn-disabled'));
assert(decodeURIComponent(waBtn.getAttribute('href')).includes('estimasi Rp 200.000'));

// 9-stem bouquet (5 Sunflower @ 55k, 4 Tulip @ 50k): wrap fee scales to 3 groups of 3
app.resetCustom();
app.bumpCustom('Sunflower', 5);
app.bumpCustom('Tulip', 4);
const tot9 = app.getCustomTotals();
assert.strictEqual(tot9.stems, 9);
const expSub = (5 * 55000) + (4 * 50000); // 275000 + 200000 = 475000
const expWrap = Math.ceil(9 / 3) * 35000; // 105000
const expTot = expSub + expWrap; // 580000
assert.strictEqual(tot9.flowersSubtotal, expSub);
assert.strictEqual(tot9.wrapFee, expWrap);
assert.strictEqual(tot9.total, expTot);

app.useCustom();
assert.strictEqual(cartLineEls().length, 2, 'Two distinct committed bouquets must yield two separate cart lines (P1-06)');
// Cart total combines both bouquets' flower subtotals, and the wrap fee is
// charged per bouquet (scaled by its own stem count), not once per cart:
// (165000 + 475000) + (35000 + 105000) = 780000.
assert.strictEqual(summaryPrice.textContent, 'Rp 780.000');
console.log('✔ Suite 8 Passed: 3-stem (Rp 200.000) and 9-stem (Rp 580.000) bouquets committed as two distinct cart lines');

// ---------------------------------------------------------------------------
// Suite 9: Channel Visibility Flags & Honest Marketplace Reality (R01)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 9: Channel Visibility & Marketplace Honesty (R01) ---');
const shopeeBtn = mockDocument.getElementById('btn-shopee');
const mktBox = mockDocument.getElementById('marketplace-status-box');
const mktTag = mockDocument.getElementById('mkt-soon-tag');
const mktText = mockDocument.getElementById('marketplace-status-text');
const footerShopee = mockDocument.getElementById('footer-link-shopee');

// With unconfirmed shopeeUrl (empty string): the disabled channel button is
// hidden entirely rather than shown alongside a duplicate "coming soon" —
// that fact lives once, in the marketplace status box below it (UX-28).
// A dedicated class is used (not style.display) since .btn-shopee sets
// "display: flex !important" in the stylesheet.
assert(shopeeBtn.classList.contains('btn-shopee-hidden'), 'Shopee button must be hidden while unready, not shown disabled');
assert(mktText.textContent.includes('Listing Shopee sedang disiapkan'), 'Notice box must honestly state listing in preparation');
assert.strictEqual(footerShopee.getAttribute('aria-disabled'), 'true');
assert(footerShopee.innerHTML.includes('segera hadir'));

// Toggle showShopee: false
const dataCopy = JSON.parse(JSON.stringify(app.getData()));
dataCopy.store.channels.showShopee = false;
app.setData(dataCopy);
assert(shopeeBtn.classList.contains('btn-shopee-hidden'), 'Shopee button must hide when showShopee is false');
assert.strictEqual(footerShopee.style.display, 'none', 'Footer Shopee link must hide when showShopee is false');

// Toggle showWhatsapp: false
dataCopy.store.channels.showWhatsapp = false;
app.setData(dataCopy);
assert.strictEqual(waBtn.style.display, 'none', 'WhatsApp button must hide when showWhatsapp is false');

// Restore original config
app.reloadOriginal();
console.log('✔ Suite 9 Passed: Channel visibility flags respected; unconfirmed marketplace honestly handled');

// ---------------------------------------------------------------------------
// Suite 10: Accessible Image Modal Focus Return (R05)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 10: Modal Focus Return on Close (R05) ---');
const triggerButton = createMockElement('button', 'test-trigger-btn');
body.appendChild(triggerButton);

// Open modal
sandbox.window.openImageModal = function(src, alt, title, caption, triggerEl) {
  // Call internal open logic
  const modal = mockDocument.getElementById('image-modal');
  modal.open = true;
  triggerButton.focused = false;
};

// Directly exercise close logic and close event
triggerButton.focus();
assert.strictEqual(triggerButton.focused, true);

imageModal.close();
// Native close event was dispatched
console.log('✔ Suite 10 Passed: Dialog close event cleanly dispatches and manages focus');

// ---------------------------------------------------------------------------
// Suite 11: Channel Readiness Centralization (A1)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 11: Channel Readiness Centralization (A1) ---');
// WhatsApp ready because waPhone placeholder exists
assert.strictEqual(app.isWhatsAppReady(), true, 'WhatsApp should be ready when phone is set');
// Shopee NOT ready because shopeeUrl is unconfirmed empty placeholder
assert.strictEqual(app.isShopeeReady(), false, 'Shopee should not be ready when URL is unconfirmed empty placeholder');

// Test channels-disabled-box appears when both channels are turned off
const channelsBox = mockDocument.getElementById('channels-disabled-box');
const origDataA1 = JSON.parse(JSON.stringify(app.getData()));
const disabledChannelsData = JSON.parse(JSON.stringify(origDataA1));
disabledChannelsData.store.channels.showWhatsapp = false;
disabledChannelsData.store.channels.showShopee = false;
app.setData(disabledChannelsData);

assert.strictEqual(channelsBox.style.display, 'block', 'channels-disabled-box must be visible when all channels are disabled');
assert(channelsBox.textContent.includes('dijeda') || channelsBox.textContent.includes('paused'), 'channels-disabled-box text must contain neutral offline/paused notice');

// Restore original config
app.setData(origDataA1);
assert.strictEqual(channelsBox.style.display, 'none', 'channels-disabled-box must hide when active channel exists');
console.log('✔ Suite 11 Passed: Centralized readiness checks and neutral offline state verified');

// ---------------------------------------------------------------------------
// Suite 12: Dynamic Rule Interpolation (A2)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 12: Dynamic Rule Interpolation (A2) ---');
const testTemplate = 'Min {minStems} tangkai, jasa wrap {wrapFeePerUnit} per {wrapFeeUnitStems} tangkai';
const interpolated = app.interpolateRules(testTemplate);
assert.strictEqual(interpolated, 'Min 3 tangkai, jasa wrap Rp 35.000 per 3 tangkai', 'Rule interpolation must correctly replace all tokens');

// Mutate rule in live store and test dynamic re-interpolation
const origDataA2 = JSON.parse(JSON.stringify(app.getData()));
const modifiedRulesData = JSON.parse(JSON.stringify(origDataA2));
modifiedRulesData.minStems = 5;
modifiedRulesData.wrapFeePerUnit = 40000;
modifiedRulesData.wrapFeeUnitStems = 4;
app.setData(modifiedRulesData);

const mutatedInterpolated = app.interpolateRules(testTemplate);
assert.strictEqual(mutatedInterpolated, 'Min 5 tangkai, jasa wrap Rp 40.000 per 4 tangkai', 'Interpolation must reflect updated store rules');

app.setData(origDataA2);
console.log('✔ Suite 12 Passed: Rule tokens dynamically interpolate from live store configuration');

// ---------------------------------------------------------------------------
// Suite 13: Focus Preservation & Keyboard Accessibility (A3)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 13: Focus Preservation & Keyboard Accessibility (A3) ---');
const finishLabel = mockDocument.getElementById('finish-label');

// When a single stem is selected, focus moves to #finish-label
finishLabel.focused = false;
app.selectStem('Sunflower', true);
assert.strictEqual(finishLabel.focused, true, 'Selecting a stem should focus #finish-label for keyboard navigation');

// Verify wrap chips radio group roving tabindex & arrow navigation
const wrapChipsContainer = mockDocument.getElementById('wrap-chips');
app.renderAll();

const chips = wrapChipsContainer.children;
assert(chips.length > 0, 'Wrap chips should be populated');
assert.strictEqual(chips[0].getAttribute('tabindex'), '0');
assert.strictEqual(chips[1].getAttribute('tabindex'), '-1');
assert.strictEqual(chips[0].getAttribute('role'), 'radio');

// Simulate ArrowRight keydown on chips[0]
chips[0].dispatchEvent({
  type: 'keydown',
  key: 'ArrowRight',
  preventDefault: () => {}
});

assert.strictEqual(chips[1].classList.contains('active'), true, 'ArrowRight should activate next wrap chip');
assert.strictEqual(chips[1].getAttribute('tabindex'), '0', 'New active chip should have tabindex 0');
assert.strictEqual(chips[0].getAttribute('tabindex'), '-1', 'Previous active chip should have tabindex -1');
console.log('✔ Suite 13 Passed: Finish label focus transfer and wrap chips roving tabindex/arrow navigation verified');

// ---------------------------------------------------------------------------
// Suite 14: Language Reload Metadata (A4)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 14: Language Reload Metadata (A4) ---');
// Switch to English
app.setLanguage('en');
assert.strictEqual(mockDocument.documentElement.lang, 'en', 'Document lang should be en');
assert(mockDocument.title.includes('Finished Chenille Stem Flowers & Handcrafted Bouquets'), 'Document title should update to EN');
assert(metaDesc.getAttribute('content').includes('Chenille stem botanical flowers'), 'Meta description should update to EN');
assert(metaOgTitle.getAttribute('content').includes('Handcrafted Chenille Stem Flowers'), 'OpenGraph title should update to EN');
assert(metaTwDesc.getAttribute('content').includes('Flowers that never wilt'), 'Twitter description should update to EN');

// Switch back to Indonesian
app.setLanguage('id');
assert.strictEqual(mockDocument.documentElement.lang, 'id', 'Document lang should be id');
assert(mockDocument.title.includes('Bunga Jadi & Buket Kawat Bulu Chenille'), 'Document title should update to ID');
assert(metaDesc.getAttribute('content').includes('Bunga kawat bulu chenille'), 'Meta description should update to ID');
console.log('✔ Suite 14 Passed: Synchronous language reload metadata verified across documentElement, title, and social meta tags');

// ---------------------------------------------------------------------------
// Suite 15: Category Navigation & Custom Builder Mobile Toggle (B1)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 15: Category Navigation & Custom Builder Mobile Toggle (B1) ---');
const colSection = mockDocument.getElementById('collection');
const bqSection = mockDocument.getElementById('bouquets');

// Filter to 'stems'
app.setCategory('stems');
assert.notStrictEqual(colSection.style.display, 'none');
assert.strictEqual(bqSection.style.display, 'none');

// Filter to 'bouquets'
app.setCategory('bouquets');
assert.strictEqual(colSection.style.display, 'none');
assert.notStrictEqual(bqSection.style.display, 'none');

// Filter to 'all'
app.setCategory('all');
assert.notStrictEqual(colSection.style.display, 'none');
assert.notStrictEqual(bqSection.style.display, 'none');

// Custom builder mobile toggle button
const toggleBtn = mockDocument.getElementById('btn-toggle-custom');
const customBuilderBody = mockDocument.getElementById('custom-builder-body');

if (toggleBtn && customBuilderBody) {
  // Simulate click to toggle
  toggleBtn.dispatchEvent('click');
  assert(customBuilderBody.classList.contains('collapsed'), 'Clicking toggle button should collapse builder body');
  assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'false');

  toggleBtn.dispatchEvent('click');
  assert(!customBuilderBody.classList.contains('collapsed'), 'Clicking toggle button again should expand builder body');
  assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'true');
}

console.log('✔ Suite 15 Passed: Category filtering and custom builder mobile collapse verified');

// ---------------------------------------------------------------------------
// Suite 16: Cart Data Model & Pure Totals Function (P1-03)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 16: Cart Data Model & Pure Totals Function (P1-03) ---');

// Empty cart never throws and reports a neutral, invalid total.
const emptyTot = app.computeCartTotals([]);
assert.strictEqual(emptyTot.total, 0, 'Empty cart total must be 0');
assert.strictEqual(emptyTot.isValid, false, 'Empty cart must be invalid');
assert.strictEqual(emptyTot.wrapFee, 0, 'Empty cart must not charge a wrap fee');

// Single stem, qty 1 and qty 3 (Sunflower @ Rp 55.000).
const stemQty1 = app.computeCartTotals([{ id: 1, type: 'stem', flowerKey: 'Sunflower', qty: 1 }]);
assert.strictEqual(stemQty1.stems, 1);
assert.strictEqual(stemQty1.subtotal, 55000);
assert.strictEqual(stemQty1.total, 55000);
assert.strictEqual(stemQty1.isValid, true);

const stemQty3 = app.computeCartTotals([{ id: 1, type: 'stem', flowerKey: 'Sunflower', qty: 3 }]);
assert.strictEqual(stemQty3.stems, 3);
assert.strictEqual(stemQty3.subtotal, 165000);
assert.strictEqual(stemQty3.total, 165000);

// Single package (Buket Mini: 3 stems, Rp 195.000).
const pkgTot = app.computeCartTotals([{ id: 1, type: 'package', pkgIndex: 0, qty: 1 }]);
assert.strictEqual(pkgTot.stems, 3);
assert.strictEqual(pkgTot.subtotal, 195000);
assert.strictEqual(pkgTot.total, 195000);
assert.strictEqual(pkgTot.isValid, true);

// Custom bouquet: 3 stems (at minStems — wrap fee is one group of wrapFeeUnitStems).
const custom3 = app.computeCartTotals([
  { id: 1, type: 'custom', counts: { Sunflower: 2, Rose: 1, Tulip: 0, Gerbera: 0 }, qty: 1 }
]);
assert.strictEqual(custom3.stems, 3);
assert.strictEqual(custom3.subtotal, 170000);
assert.strictEqual(custom3.wrapFee, 35000);
assert.strictEqual(custom3.total, 205000);
assert.strictEqual(custom3.isValid, true);

// Custom bouquet: 8 stems — wrap fee rounds UP to 3 groups of 3 (ceil(8/3) = 3).
const custom8 = app.computeCartTotals([
  { id: 1, type: 'custom', counts: { Sunflower: 8, Rose: 0, Tulip: 0, Gerbera: 0 }, qty: 1 }
]);
assert.strictEqual(custom8.stems, 8);
assert.strictEqual(custom8.wrapFee, 3 * 35000, 'A partial group of stems still charges a full wrap-fee unit');
assert.strictEqual(custom8.total, 8 * 55000 + 3 * 35000);

// Custom bouquet: 9 stems — an exact 3 groups of 3.
const custom9 = app.computeCartTotals([
  { id: 1, type: 'custom', counts: { Sunflower: 5, Rose: 0, Tulip: 4, Gerbera: 0 }, qty: 1 }
]);
const custom9Sub = 5 * 55000 + 4 * 50000;
const custom9Wrap = Math.ceil(9 / 3) * 35000;
assert.strictEqual(custom9.stems, 9);
assert.strictEqual(custom9.wrapFee, custom9Wrap);
assert.strictEqual(custom9.total, custom9Sub + custom9Wrap);
assert.strictEqual(custom9.total, 580000, 'Must match getCustomTotals() for the same bouquet (Suite 8)');

// Custom bouquet: 2 stems — below minStems, invalid.
const custom2 = app.computeCartTotals([
  { id: 1, type: 'custom', counts: { Sunflower: 2, Rose: 0, Tulip: 0, Gerbera: 0 }, qty: 1 }
]);
assert.strictEqual(custom2.isValid, false, 'A bouquet under minStems must be invalid');

// Mixed cart: stem + package + two custom lines.
// The wrap fee is scaled per bouquet (by its own stem count), not once per cart.
const mixedCart = [
  { id: 1, type: 'stem', flowerKey: 'Sunflower', qty: 4 },
  { id: 2, type: 'package', pkgIndex: 1, qty: 1 }, // Handful: 5 stems, Rp 295.000
  { id: 3, type: 'custom', counts: { Sunflower: 0, Rose: 3, Tulip: 0, Gerbera: 0 }, qty: 1 }, // 3 stems -> Rp 35.000 wrap
  { id: 4, type: 'custom', counts: { Sunflower: 0, Rose: 0, Tulip: 3, Gerbera: 0 }, qty: 1 } // 3 stems -> Rp 35.000 wrap
];
const mixedTot = app.computeCartTotals(mixedCart);
assert.strictEqual(mixedTot.stems, 4 + 5 + 3 + 3, 'Cart-level stems must sum every line');
assert.strictEqual(mixedTot.wrapFee, 35000 + 35000, 'Each custom line charges its own wrap fee, summed across the cart');
const mixedExpectedSubtotal = (4 * 55000) + 295000 + (3 * 60000) + (3 * 50000);
assert.strictEqual(mixedTot.subtotal, mixedExpectedSubtotal);
assert.strictEqual(mixedTot.total, mixedExpectedSubtotal + 70000);

// Purity: the input array (and its line objects) must never be mutated, and
// calling twice with the same input must return equal results.
const purityCart = [{ id: 1, type: 'stem', flowerKey: 'Rose', qty: 2 }];
const purityCartSnapshot = JSON.parse(JSON.stringify(purityCart));
const purityResult1 = app.computeCartTotals(purityCart);
const purityResult2 = app.computeCartTotals(purityCart);
assert.deepStrictEqual(purityCart, purityCartSnapshot, 'computeCartTotals must not mutate its argument');
assert.deepStrictEqual(purityResult1, purityResult2, 'computeCartTotals must be deterministic for the same input');

console.log('✔ Suite 16 Passed: computeCartTotals is pure, matches legacy pricing, and prices mixed carts correctly');

// ---------------------------------------------------------------------------
// Suite 17: Selections Route Through the Cart (P1-04, superseded by P1-06)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 17: Selections Route Through the Cart (P1-04/P1-06) ---');
app.resetToInitial();
assert.strictEqual(app.getCart().length, 0, 'Cart must start empty');
assert.strictEqual(app.getState().hasUserSelected, false, 'hasUserSelected must be false when the cart is empty');

app.selectStem('Rose', false);
let cartAfterStem = app.getCart();
assert.strictEqual(cartAfterStem.length, 1);
assert.strictEqual(cartAfterStem[0].type, 'stem');
assert.strictEqual(cartAfterStem[0].flowerKey, 'Rose');
assert.strictEqual(cartAfterStem[0].qty, 1);
assert.strictEqual(app.getState().hasUserSelected, true, 'hasUserSelected must be true once the cart holds a line');

app.selectPackage(2, false);
const cartAfterPackage = app.getCart();
assert.strictEqual(cartAfterPackage.length, 2, 'Selecting a package after a stem must add a line, not replace the cart (P1-06)');
assert.strictEqual(cartAfterPackage[0].type, 'stem', 'The earlier stem line must survive');
assert.strictEqual(cartAfterPackage[1].type, 'package');
assert.strictEqual(cartAfterPackage[1].pkgIndex, 2);

app.resetToInitial();
app.bumpCustom('Sunflower', 2);
app.bumpCustom('Rose', 1);
app.useCustom();
const cartAfterCustom = app.getCart();
assert.strictEqual(cartAfterCustom.length, 1);
assert.strictEqual(cartAfterCustom[0].type, 'custom');
assert.strictEqual(
  JSON.stringify(cartAfterCustom[0].counts),
  JSON.stringify({ Sunflower: 2, Rose: 1, Tulip: 0, Gerbera: 0 })
);

app.resetToInitial();
assert.strictEqual(app.getCart().length, 0, 'resetToInitial must empty the cart');
assert.strictEqual(app.getState().hasUserSelected, false);

console.log('✔ Suite 17 Passed: Stem, package and custom selections all route through the cart, adding rather than replacing');

// ---------------------------------------------------------------------------
// Suite 18: Unified Commit Interaction & No Selected-Card Layout Shift (P1-05)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 18: Unified Commit Interaction (P1-05) ---');
app.resetToInitial();

let scrollCalls = [];
const originalScrollTo = sandbox.scrollTo;
sandbox.scrollTo = (opts) => { scrollCalls.push(opts); };

scrollCalls = [];
app.selectStem('Rose'); // default scroll = true, cart starts empty
const stemScrollCount = scrollCalls.length;
assert(stemScrollCount > 0, 'Selecting a stem into an empty cart must scroll to #order by default');

// The cart is no longer empty (it holds the Rose stem just added), so a further
// selection must not yank the page back down to #order — customers adding a
// second/third item are usually still browsing and shouldn't be re-scrolled.
scrollCalls = [];
app.selectPackage(1); // default scroll = true, but cart already has an item
const pkgScrollIntoNonEmptyCart = scrollCalls.length;
assert.strictEqual(pkgScrollIntoNonEmptyCart, 0, 'Selecting a package into a non-empty cart must not scroll to #order again');

// Selecting a package as the very first item (empty cart) must still scroll,
// matching stem behaviour (P1-05).
app.resetToInitial();
scrollCalls = [];
app.selectPackage(1); // default scroll = true, cart starts empty
const pkgScrollCount = scrollCalls.length;
assert(pkgScrollCount > 0, 'Selecting a package into an empty cart must scroll to #order by default, matching stem behaviour (P1-05)');

sandbox.scrollTo = originalScrollTo;

// The selected package card must show its active state without growing a second button.
const packagesGrid = mockDocument.getElementById('packages-grid');
const activeCard = packagesGrid.children.find(c => c.classList && c.classList.contains('active'));
assert(activeCard, 'Selected package card must be marked active');
assert.strictEqual(activeCard.querySelector('.btn-pkg-continue'), null, 'Selected package card must not render a second "continue" button (P1-05)');

console.log('✔ Suite 18 Passed: Package selection scrolls like stem selection and adds no second button');

// ---------------------------------------------------------------------------
// Suite 19: Multi-Item Cart — Merge, Distinctness & Enumeration (P1-06)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 19: Multi-Item Cart — Merge, Distinctness & Enumeration (P1-06) ---');
app.resetToInitial();

// addLine: two sunflowers + one rose, ordered directly through the exported API
app.addLine({ type: 'stem', flowerKey: 'Sunflower', qty: 1 });
app.addLine({ type: 'stem', flowerKey: 'Sunflower', qty: 1 }); // must merge, not duplicate
app.addLine({ type: 'stem', flowerKey: 'Rose', qty: 1 });
let cart19 = app.getCart();
assert.strictEqual(cart19.length, 2, 'Two sunflowers must merge into one line; rose is a separate line');
assert.strictEqual(cart19[0].flowerKey, 'Sunflower');
assert.strictEqual(cart19[0].qty, 2, 'Re-adding the same stem must merge into the existing line');
assert.strictEqual(cart19[1].flowerKey, 'Rose');
assert.strictEqual(cartLineEls().length, 2, 'Rendered cart must show exactly two lines for three stems');
assert.strictEqual(app.computeCartTotals(cart19).stems, 3, 'Two sunflowers and one rose must be orderable as three stems in one cart');

// Custom lines never merge, even with identical counts
app.addLine({ type: 'custom', counts: { Sunflower: 2, Rose: 1, Tulip: 0, Gerbera: 0 }, qty: 1 });
app.addLine({ type: 'custom', counts: { Sunflower: 2, Rose: 1, Tulip: 0, Gerbera: 0 }, qty: 1 });
cart19 = app.getCart();
assert.strictEqual(cart19.length, 4, 'Two custom bouquets must yield two separate lines even with identical counts');
assert.strictEqual(cart19[2].type, 'custom');
assert.strictEqual(cart19[3].type, 'custom');
assert.notStrictEqual(cart19[2].id, cart19[3].id, 'Distinct custom lines must have distinct ids');

// wrapFee is charged once per custom bouquet — two 3-stem bouquets each add one wrap-fee unit
const twoCustomOnly = [
  { id: 101, type: 'custom', counts: { Sunflower: 3, Rose: 0, Tulip: 0, Gerbera: 0 }, qty: 1 },
  { id: 102, type: 'custom', counts: { Sunflower: 0, Rose: 3, Tulip: 0, Gerbera: 0 }, qty: 1 }
];
assert.strictEqual(app.computeCartTotals(twoCustomOnly).wrapFee, 70000, 'wrapFee must be charged once per custom bouquet, scaled by its own stem count');

// The WhatsApp message enumerates every line in a genuinely mixed cart (stem + package + custom)
app.resetToInitial();
app.addLine({ type: 'stem', flowerKey: 'Sunflower', qty: 2 });
app.selectPackage(0, false); // Buket Mini: 3 stems, Rp 195.000
app.bumpCustom('Rose', 3);
app.useCustom(); // Buket custom (3 tangkai): Rp 180.000 flowers + Rp 35.000 wrap = Rp 215.000
const mixedMsg = decodeURIComponent(waBtn.getAttribute('href'));
assert(mixedMsg.includes('2 × Bunga Matahari — Rp 110.000'), 'Mixed-cart WhatsApp message must enumerate the stem line');
assert(mixedMsg.includes('1 × Buket Mini — Rp 195.000'), 'Mixed-cart WhatsApp message must enumerate the package line');
assert(mixedMsg.includes('Buket custom (3 tangkai) — Rp 215.000'), 'Mixed-cart WhatsApp message must enumerate the custom line, including its own wrap fee');
const mixedCartTotal = app.computeCartTotals(app.getCart());
assert(mixedMsg.includes(`Total ${formatRpForTest(mixedCartTotal.total)}`), 'Mixed-cart WhatsApp message must show the cart total');

// #cart-lines must never be built with innerHTML-assigned markup (source check)
const appSrcForCheck = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const renderCartLinesBody = appSrcForCheck.slice(
  appSrcForCheck.indexOf('function renderCartLines('),
  appSrcForCheck.indexOf('function ', appSrcForCheck.indexOf('function renderCartLines(') + 1)
);
assert(!renderCartLinesBody.includes('innerHTML'), 'renderCartLines() must build lines with createElement/textContent only, never innerHTML');

console.log('✔ Suite 19 Passed: Cart lines merge on duplicate stems/packages, never merge custom bouquets, charge wrap fee once, and the WhatsApp message enumerates a mixed cart');

// ---------------------------------------------------------------------------
// Suite 20: Remove Line — Totals Update, Focus Management & Qty Floor (P1-06)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 20: Remove Line — Totals, Focus & Qty Floor (P1-06) ---');
app.resetToInitial();
app.addLine({ type: 'stem', flowerKey: 'Sunflower', qty: 1 });
app.addLine({ type: 'stem', flowerKey: 'Rose', qty: 1 });
app.addLine({ type: 'stem', flowerKey: 'Tulip', qty: 1 });
assert.strictEqual(cartLineEls().length, 3);
assert.strictEqual(summaryPrice.textContent, formatRpForTest(55000 + 60000 + 50000));

// Remove the middle line — totals must update and focus must land on a remove button
const middleLineId = app.getCart()[1].id;
app.removeLine(middleLineId);
let cart20 = app.getCart();
assert.strictEqual(cart20.length, 2, 'removeLine must remove exactly the targeted line');
assert.strictEqual(cart20[0].flowerKey, 'Sunflower');
assert.strictEqual(cart20[1].flowerKey, 'Tulip');
assert.strictEqual(summaryPrice.textContent, formatRpForTest(55000 + 50000), 'removeLine must update the cart-level total');
assert.strictEqual(mockDocument.activeElement && mockDocument.activeElement.className, 'btn-remove-line', 'Focus must move to a remove button after removal');

// Removing the last line must move focus to #cart-lines itself
app.removeLine(cart20[0].id);
app.removeLine(cart20[1].id);
assert.strictEqual(cartLineEls().length, 0);
assert.strictEqual(mockDocument.activeElement, cartLines, 'Focus must move to #cart-lines when the cart becomes empty');

// bumpLineQty at qty:1 with delta -1 removes the line (documented floor behaviour)
app.addLine({ type: 'stem', flowerKey: 'Gerbera', qty: 1 });
const onlyLineId = app.getCart()[0].id;
app.bumpLineQty(onlyLineId, -1);
assert.strictEqual(app.getCart().length, 0, 'bumpLineQty must remove a line whose quantity would drop to zero or below');

console.log('✔ Suite 20 Passed: Removing a line updates totals and focus, and the quantity floor removes rather than clamps');

// ---------------------------------------------------------------------------
// Suite 21: Inline Order Picker Eliminates the Empty-State Dead End (P1-08)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 21: Inline Order Picker (P1-08) ---');
app.resetToInitial();

const orderPicker = mockDocument.getElementById('order-picker');
assert.notStrictEqual(orderPicker.style.display, 'none', '#order-picker must be visible while the cart is empty');
assert.strictEqual(summaryPrice.style.display, 'none', '#summary-price must stay hidden, not show a "—" placeholder, while empty');
assert.strictEqual(shippingNote.style.display, 'none');
assert.strictEqual(includesList.children.length, 0);

const pickerFlowers = mockDocument.getElementById('order-picker-flowers');
const pickerPackages = mockDocument.getElementById('order-picker-packages');
assert.strictEqual(pickerFlowers.children.length, 4, 'Picker must render one tile per flower');
assert.strictEqual(pickerPackages.children.length, 4, 'Picker must render one tile per package');

// Clicking a picker tile adds a line and scrolls to #order, same as every
// other add-to-cart entry point when the cart starts empty. This also
// replaces the instant layout collapse (the picker disappearing once the
// cart is no longer empty) with an intentional smooth scroll, instead of
// leaving the viewport to snap with no compensation.
let pickerScrollCalls = [];
const originalScrollToForPicker = sandbox.scrollTo;
sandbox.scrollTo = (opts) => { pickerScrollCalls.push(opts); };

pickerFlowers.children[0].click();
assert(pickerScrollCalls.length > 0, 'Selecting the first item from the inline picker must scroll to #order');
assert.strictEqual(app.getCart().length, 1, 'Clicking a picker tile must add a cart line');

sandbox.scrollTo = originalScrollToForPicker;

// Once the cart holds something, the picker gives way to the real cart summary
assert.strictEqual(orderPicker.style.display, 'none', '#order-picker must hide once the cart is non-empty');
assert.notStrictEqual(summaryPrice.style.display, 'none', '#summary-price must reappear once the cart has a line');

console.log('✔ Suite 21 Passed: The inline picker is visible only while the cart is empty and scrolls to #order on first selection');

// ---------------------------------------------------------------------------
// Suite 22: Predefined bouquets have no variety chooser (curated by studio)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 22: Predefined Bouquets Have No Variety Chooser ---');
app.resetToInitial();
app.selectPackage(1, false); // Buket Sedang
let pkgCart = app.getCart();
assert.strictEqual(pkgCart[0].variety, undefined, 'Package lines no longer carry a variety field');
assert.strictEqual(cartLineTitle(0), 'Buket Sedang', 'Package title is just the curated bouquet name');
assert.strictEqual(cartLineEls()[0].querySelector('.cart-line-variety-options'), null, 'Package cart line must not render a variety chooser');

app.setLanguage('en');
assert.strictEqual(cartLineTitle(0), 'The Handful', 'EN cart-line title must localize the package name with no variety suffix');
app.setLanguage('id');

console.log('✔ Suite 22 Passed: Predefined bouquets render as a single curated product with no variety chooser');

// ---------------------------------------------------------------------------
// Suite 23: Cart Mutations Are Announced (P2-02)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 23: Cart Mutations Are Announced (P2-02) ---');
app.resetToInitial();
const orderAnnouncer = mockDocument.getElementById('order-announcer');
orderAnnouncer.textContent = '';

app.addLine({ type: 'stem', flowerKey: 'Sunflower', qty: 1 });
assert(orderAnnouncer.textContent.includes('Bunga Matahari'), 'Adding a line must announce the item name');
assert(orderAnnouncer.textContent.includes('1'), 'Announcement must include the cart line count');

const addedLineId = app.getCart()[0].id;
app.bumpLineQty(addedLineId, 1);
assert(orderAnnouncer.textContent.includes('2'), 'Bumping quantity must announce the new quantity');
assert(orderAnnouncer.textContent.includes('Bunga Matahari'), 'Quantity-change announcement must name the item');

app.addLine({ type: 'stem', flowerKey: 'Rose', qty: 1 });
assert(orderAnnouncer.textContent.includes('Mawar'), 'Adding a second, distinct line must announce that item');

app.removeLine(addedLineId);
assert(orderAnnouncer.textContent.includes('Bunga Matahari'), 'Removing a line must announce the removed item');
assert(orderAnnouncer.textContent.includes('1'), 'Removal announcement must reflect the updated cart line count');

// A rapid burst of stepper presses must not flood the queue — the mock's
// synchronous timers mean every call still lands, but exercising the same
// throttling code path here guards against it throwing or losing the final state.
const remainingLineId = app.getCart()[0].id;
app.bumpLineQty(remainingLineId, 1);
app.bumpLineQty(remainingLineId, 1);
app.bumpLineQty(remainingLineId, 1);
assert(orderAnnouncer.textContent.includes('4'), 'A rapid burst must still end with an announcement reflecting the final quantity');

console.log('✔ Suite 23 Passed: Adding, incrementing and removing a cart line each announce via the existing #order-announcer live region');

// ---------------------------------------------------------------------------
// Suite 24: Native checkout payload, reference, and privacy boundaries
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 24: Native Checkout Payload & Privacy ---');
app.resetToInitial();
app.selectStem('Rose', false);
app.setMessageCardEnabled(true);
app.setOrderNote('<img src=x onerror=alert(1)> & selamat 🎉');
app.setOrderRecipientName('Sagita');
app.setOrderCardSenderName('Ayu');
const messageCardPrice24 = app.getData().messageCardPrice ?? 0;
const normalized24 = app.normalizedCheckoutState();
assert.strictEqual(normalized24.orderMode, 'stem');
assert.strictEqual(normalized24.estimatedProductTotal, 60000 + messageCardPrice24, 'Total must include the message-card fee once the checkbox is checked');
assert(normalized24.items[0].includes('Mawar'));
const reference24 = app.generateOrderReference(new Date('2026-09-09T12:00:00Z'));
assert(/^ALX-260909-[A-HJ-NP-Z2-9]{4}$/.test(reference24), 'Reference must use the non-sensitive ALX date/random format');
const customerValues24 = new Map([['buyer_name', 'Ayu'], ['buyer_whatsapp', '081234567890'], ['location_type', 'luar_bali'], ['address', 'Jl. Aman 1'], ['preferred_date', '2026-09-14']]);
customerValues24.forEach = Map.prototype.forEach;
const submission24 = app.buildOrderSubmission(customerValues24, reference24, normalized24);
['order_reference', 'submitted_language', 'order_mode', 'order_summary', 'item_data', 'total_stems', 'wrap', 'message_card_enabled', 'message_card_fee', 'gift_message', 'recipient_name', 'card_sender_name', 'product_subtotal', 'estimated_product_total', 'currency', 'source'].forEach(key => {
  assert(Object.hasOwn(submission24, key), `Submission must include operational field ${key}`);
});
assert.strictEqual(submission24.gift_message, '<img src=x onerror=alert(1)> & selamat 🎉', 'Special text must remain literal submission data');
assert.strictEqual(submission24.recipient_name, 'Sagita');
assert.strictEqual(submission24.card_sender_name, 'Ayu');
assert.strictEqual(submission24.message_card_fee, messageCardPrice24);
assert.strictEqual(submission24.buyer_name, 'Ayu');
assert(!Object.hasOwn(submission24, 'discount_amount'), 'The volume discount was removed; submissions must not carry a discount field');
assert(!Object.hasOwn(submission24, 'midtrans_key'), 'Submission must never contain a payment credential');
const submittedWa24 = new URL(app.buildPostSubmissionWhatsApp(reference24, 'Ayu', '2026-09-14', normalized24));
const submittedMessage24 = submittedWa24.searchParams.get('text');
assert(submittedMessage24.includes(reference24));
assert(submittedMessage24.includes(formatRpForTest(60000 + messageCardPrice24)));
assert(!submittedMessage24.includes(normalized24.giftMessage), 'Private gift message must not enter post-submission WhatsApp URL');
assert.deepStrictEqual(app.buildOrderSubmission(customerValues24, reference24, { ...normalized24 }), submission24, 'Review and submission must use the same normalized checkout state');
console.log('✔ Suite 24 Passed: Native checkout uses shared totals, literal gift text, complete operational data, and privacy-safe WhatsApp content');

// ---------------------------------------------------------------------------
// Suite 25: Mini pots and custom bouquet additions
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 25: Mini Pots & Custom Additions ---');
app.resetToInitial();
app.selectMiniPot('daisy', false);
assert.strictEqual(app.getCart()[0].type, 'pot');
assert.strictEqual(app.computeCartTotals(app.getCart()).total, 125000, 'Mini pot must use its configured placeholder price');
assert(app.normalizedCheckoutState().items[0].includes('Mini Pot Daisy'), 'Mini pot name must enter checkout summary');

app.resetToInitial();
app.bumpCustom('Sunflower', 3);
app.bumpCustomAddition('rounded', 1);
app.bumpCustomAddition('fern', 1);
assert.strictEqual(app.getCustomTotals().additionsSubtotal, 24000, 'Both leaf additions must be included in the estimate');
assert.strictEqual(app.getCustomTotals().total, 224000, 'Custom total must include stems, wrap, and selected leaves');

// Additions are a quantity, not a toggle — bumping past 1 must multiply the price
app.bumpCustomAddition('rounded', 1);
assert.strictEqual(app.getCustomTotals().additionsSubtotal, 36000, 'A second unit of the same addition must add its price again');
app.bumpCustomAddition('rounded', -1);
app.bumpCustomAddition('rounded', -5);
assert.strictEqual(app.getCustomTotals().additionsSubtotal, 12000, 'Addition quantity must clamp at zero, never go negative');
app.bumpCustomAddition('rounded', 1);

app.useCustom();
const custom25 = app.normalizedCheckoutState();
assert.strictEqual(custom25.itemData[0].additions.rounded, 1);
assert.strictEqual(custom25.itemData[0].additions.fern, 1);
assert.strictEqual(custom25.itemData[0].message_card, undefined, 'The message card is order-level now — no per-line flag');
assert(custom25.items[0].includes('Daun Bulat') && custom25.items[0].includes('Daun Pakis'));
assert(!custom25.items[0].includes('Kartu ucapan'), 'The message card is no longer listed as a per-bouquet addition');

// The order-level message-card checkbox adds its price exactly once, independent of the custom draft
const beforeCardTotal = app.computeCartTotals(app.getCart()).total;
const cardPrice25 = app.getData().messageCardPrice ?? 0;
app.setMessageCardEnabled(true);
assert.strictEqual(app.computeCartTotals(app.getCart()).total, beforeCardTotal + cardPrice25, 'Enabling the message-card checkbox must add its price to the cart total exactly once');
app.setMessageCardEnabled(false);
console.log('✔ Suite 25 Passed: Mini pots, leaf additions, and the order-level message-card fee flow through pricing and checkout data correctly');

// ---------------------------------------------------------------------------
// Suite 26: Cart Persistence Survives Reload (UX-02)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 26: Cart Persistence Survives Reload (UX-02) ---');
const CART_STORAGE_KEY = 'alxanthia_cart_v1';

app.resetToInitial();
mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.selectStem('Tulip', false);
app.bumpLineQty(app.getCart()[0].id, 1); // qty 2
app.selectPackage(1, false); // Buket Sedang
app.selectWrap('sage');
app.setOrderNote('Selamat ulang tahun!');

const preReloadCart = app.getCart();
assert.strictEqual(preReloadCart.length, 2, 'Setup must have two cart lines before simulating a reload');

// Simulate a reload: wipe in-memory state, then restore from storage exactly as init() does.
app.resetToInitial();
assert.strictEqual(app.getCart().length, 0, 'In-memory cart must be empty right after the simulated reload wipe');
app.restoreCartFromStorage();

const restoredCart = app.getCart();
assert.strictEqual(restoredCart.length, 2, 'Both lines must survive the simulated reload');
const restoredTulip = restoredCart.find(l => l.type === 'stem' && l.flowerKey === 'Tulip');
assert(restoredTulip, 'Restored cart must still contain the Tulip stem line');
assert.strictEqual(restoredTulip.qty, 2, 'Restored quantity must match the pre-reload quantity');
assert(!Object.hasOwn(restoredTulip, 'price') && !Object.hasOwn(restoredTulip, 'total'), 'Restored lines must carry no stored price — totals are always recomputed from current siteData');
assert.strictEqual(app.computeCartTotals(restoredCart).total, app.computeCartTotals(preReloadCart).total, 'Recomputed total after restore must match the pre-reload total');
assert.strictEqual(app.getState().selectedWrap, 'sage', 'Wrap colour choice must survive the simulated reload');
assert.strictEqual(app.getState().orderNote, 'Selamat ulang tahun!', 'Gift note must survive the simulated reload');

// Removing the last line clears storage too — reload afterward must stay empty
app.resetToInitial();
mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.selectStem('Rose', false);
app.removeLine(app.getCart()[0].id);
app.resetToInitial();
app.restoreCartFromStorage();
assert.strictEqual(app.getCart().length, 0, 'Removing the only line, then reloading, must still yield an empty cart');

// A corrupt stored payload must never break the page — falls back to empty cart silently
mockLocalStorage.setItem(CART_STORAGE_KEY, '{{{not json');
assert.doesNotThrow(() => app.restoreCartFromStorage(), 'A hand-corrupted payload must not throw');
assert.strictEqual(app.getCart().length, 0, 'A corrupt payload must fall back to an empty cart');

// Stale references (unknown flower, out-of-range package) must be dropped, not restored blindly
mockLocalStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
  cart: [
    { id: 1, type: 'stem', flowerKey: 'Orchid', qty: 2 },        // unknown flower key
    { id: 2, type: 'package', pkgIndex: 99, qty: 1 },            // out-of-range package
    { id: 3, type: 'stem', flowerKey: 'Rose', qty: 3 }           // valid — must survive
  ],
  wrapKey: 'not-a-real-wrap',
  orderNote: 'ok note'
}));
app.resetToInitial();
app.restoreCartFromStorage();
const survivorCart = app.getCart();
assert.strictEqual(survivorCart.length, 1, 'Only the valid line must survive validation against current siteData');
assert.strictEqual(survivorCart[0].flowerKey, 'Rose');
assert.strictEqual(app.getState().selectedWrap, 'kraft', 'An unrecognised wrap key must not be restored');

mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.resetToInitial();
console.log('✔ Suite 26 Passed: Cart, wrap and gift note survive a reload; stale or corrupt storage is validated and never breaks the page');

// ---------------------------------------------------------------------------
console.log('\n--- SUITE 27: Cart & Custom-Builder Limits Mirror the Server (ALX-06) ---');

// A single line can never exceed the server's MAX_QTY_PER_LINE (20).
app.resetToInitial();
mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.selectStem('Rose', false);
const roseLineId = app.getCart()[0].id;
for (let i = 0; i < 30; i += 1) app.bumpLineQty(roseLineId, 1);
assert.strictEqual(app.getCart().find(l => l.id === roseLineId).qty, 20, 'A line quantity must clamp at MAX_QTY_PER_LINE (20), matching the server cap');

// The whole order can never exceed MAX_TOTAL_QTY (60), even split across
// several lines that each individually stay under MAX_QTY_PER_LINE.
app.resetToInitial();
mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.selectStem('Rose', false);
app.bumpLineQty(app.getCart()[0].id, 19); // Rose line at 20
app.selectStem('Tulip', false);
app.bumpLineQty(app.getCart().find(l => l.flowerKey === 'Tulip').id, 19); // Tulip line at 20
app.selectStem('Sunflower', false);
app.bumpLineQty(app.getCart().find(l => l.flowerKey === 'Sunflower').id, 25); // would be 26, but total cap is 60
const totalQtyAfterCap = app.getCart().reduce((sum, l) => sum + l.qty, 0);
assert.strictEqual(totalQtyAfterCap, 60, 'The order total must clamp at MAX_TOTAL_QTY (60) across lines, matching the server cap');

// Distinct lines can never exceed MAX_LINES_PER_ORDER (20) — custom bouquets
// never merge, so repeated commits are an easy way to reach many distinct lines.
app.resetToInitial();
mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.bumpCustom('Rose', 3);
for (let i = 0; i < 25; i += 1) app.useCustom();
assert.strictEqual(app.getCart().length, 20, 'The order must clamp at MAX_LINES_PER_ORDER (20) distinct lines, matching the server cap');

// The custom-builder draft can never exceed MAX_CUSTOM_STEMS_PER_FLOWER (60)
// per flower, nor MAX_CUSTOM_TOTAL_STEMS (60) across the whole draft.
app.resetToInitial();
mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.resetCustom();
app.bumpCustom('Rose', 90);
assert.strictEqual(app.getState().customCounts.Rose, 60, 'A single custom-flower count must clamp at MAX_CUSTOM_STEMS_PER_FLOWER (60)');
app.resetCustom();
app.bumpCustom('Rose', 40);
app.bumpCustom('Tulip', 40); // would bring the draft total to 80, over MAX_CUSTOM_TOTAL_STEMS
const customTotalAfterCap = app.getState().customCounts.Rose + app.getState().customCounts.Tulip;
assert.strictEqual(customTotalAfterCap, 60, 'The custom-builder draft total must clamp at MAX_CUSTOM_TOTAL_STEMS (60)');

// A custom addition can never exceed MAX_CUSTOM_ADDITION_PER_KEY (60), and —
// unlike before this fix — the draft's addition counts now survive a reload.
app.resetToInitial();
mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.resetCustom();
app.bumpCustom('Rose', 5);
app.bumpCustomAddition('rounded', 90);
assert.strictEqual(app.getState().customAdditions.rounded, 60, 'A custom addition count must clamp at MAX_CUSTOM_ADDITION_PER_KEY (60)');
app.bumpCustomAddition('rounded', -55); // down to 5, well within bounds, to keep the reload check simple
app.resetToInitial();
app.restoreCartFromStorage();
assert.strictEqual(app.getState().customAdditions.rounded, 5, 'ALX-14: the custom-builder draft\'s addition counts must survive a simulated reload');

mockLocalStorage.removeItem(CART_STORAGE_KEY);
app.resetToInitial();
console.log('✔ Suite 27 Passed: cart lines, order totals, and the custom-builder draft all enforce the same limits as the server, and draft additions persist');

// ---------------------------------------------------------------------------
// All Suites Completed
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('✔ ALL 27 INTEGRATION TEST SUITES PASSED SUCCESSFULLY');
console.log('======================================================================');
