/**
 * =============================================================================
 * ALXANTHIA STUDIO — APPLICATION CONTROLLER (app.js)
 * =============================================================================
 * Product Pivot: Finished Flowers & Bouquets
 */

(function () {
  'use strict';

  // Constants & Storage Keys
  const LANG_KEY = 'alxanthia.lang';
  const AUTH_KEY = 'alxanthia_unlocked';
  const CART_KEY = 'alxanthia_cart_v1';
  // ALX-03: the reference/idempotency key/fingerprint of a submission whose
  // outcome is not yet known to be safely retryable — written before the
  // network call, so a lost response (reload, tab close, dropped connection)
  // can resume the SAME attempt instead of minting a new idempotency key and
  // risking a second real order for a request the server may have already stored.
  const PENDING_ATTEMPT_KEY = 'alxanthia_pending_attempt';
  const PENDING_ATTEMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — short and documented (ALX-03)
  const CARD_NOTE_MAX = 200;
  // ALX-06: mirrors CONFIGURE-SUBMISSION-ENDPOINT.md's MAX_QTY_PER_LINE /
  // MAX_LINES_PER_ORDER / MAX_TOTAL_QTY / MAX_CUSTOM_* / MAX_TEXT exactly —
  // that file is the source of truth; keep both in sync if either changes.
  const MAX_QTY_PER_LINE = 20;
  const MAX_LINES_PER_ORDER = 20;
  const MAX_TOTAL_QTY = 60;
  const MAX_CUSTOM_STEMS_PER_FLOWER = 60;
  const MAX_CUSTOM_TOTAL_STEMS = 60;
  const MAX_CUSTOM_ADDITION_PER_KEY = 60;
  const MAX_TEXT = { buyer_name: 120, address: 300, city: 100, gift_message: 200, recipient_name: 120, card_sender_name: 120 };

  // State
  let currentLang = 'id';
  let selectedFlower = 'Sunflower';
  let selectedPackage = 1; // 0: Posy (3), 1: Handful (5), 2: Armful (9), 3: Grand (15)
  let customCounts = { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 }; // Starts empty (no silent preselection)
  let customAdditions = { rounded: 0, fern: 0 }; // quantity per addition, not a boolean toggle
  let cart = []; // line items: { id, type: 'stem'|'pot'|'package'|'custom', ...type-specific fields, qty }
  let nextLineId = 1;
  let selectedWrap = 'kraft';
  let orderNote = '';
  let messageCardEnabled = false; // order-level: gates the card textarea & its fee, decided in the finishing section
  let orderRecipientName = '';
  let orderCardSenderName = '';
  let siteData = null;
  let checkoutAttempt = null;
  let refreshStickyVisibility = null; // set once initStickyOrderBar() runs; re-checks visibility on cart changes
  let turnstileToken = ''; // DEV-07: current Cloudflare Turnstile token, if the widget is configured
  let turnstileWidgetId = null;
  let lastFloatingCartCount = null; // null until first render, so the pill doesn't bump on initial paint

  /**
   * Resets every piece of in-memory ordering state to its startup default.
   * Shared by the test harness's resetToInitial() and the checkout dialog's
   * "Start a new order" action (DEV-10) so both stay in sync.
   */
  function resetAllState() {
    cart = [];
    nextLineId = 1;
    selectedFlower = 'Sunflower';
    selectedPackage = 1;
    customCounts = { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 };
    customAdditions = { rounded: 0, fern: 0 };
    selectedWrap = 'kraft';
    orderNote = '';
    messageCardEnabled = false;
    orderRecipientName = '';
    orderCardSenderName = '';
    checkoutAttempt = null;
    activeCategory = 'all';
  }

  /**
   * Currency formatter helper (Indonesian Rupiah standard)
   */
  function formatRp(n) {
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }

  /**
   * Load data directly from site-content.js (window.ALXANTHIA_DATA)
   */
  function loadData() {
    if (!window.ALXANTHIA_DATA) {
      // A vague "Cannot read properties of null" surfaces later, from every
      // call site that reads siteData — name the real cause here instead (ALX-22).
      throw new Error('site-content.js failed to load or has a syntax error: window.ALXANTHIA_DATA is missing.');
    }
    siteData = JSON.parse(JSON.stringify(window.ALXANTHIA_DATA));
  }

  /**
   * Persist the cart and finishing draft so a reload, accidental back-nav,
   * or an OS memory purge on mobile doesn't silently discard it (UX-02).
   * Prices are never stored — only identifiers and quantities — so an
   * owner's price edit always reaches a returning visitor.
   */
  function persistCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify({
        cart, wrapKey: selectedWrap, orderNote, customCounts, customAdditions,
        messageCardEnabled, orderRecipientName, orderCardSenderName
      }));
    } catch (e) {}
  }

  /**
   * Restore cart/draft state from localStorage, called once at startup
   * before the first render. A stale or hand-edited payload must never
   * break the page: every line is revalidated against the current
   * siteData, and any failure falls back to an empty cart silently.
   */
  function restoreCartFromStorage() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];
      const restoredLines = [];

      (Array.isArray(parsed.cart) ? parsed.cart : []).forEach(line => {
        if (!line || typeof line !== 'object') return;
        const qty = Math.floor(Number(line.qty));
        if (!(qty > 0)) return;

        if (line.type === 'stem' && siteData.flowers[line.flowerKey]) {
          restoredLines.push({ type: 'stem', flowerKey: line.flowerKey, qty, _id: line.id });
        } else if (line.type === 'pot' && (siteData.miniPots || []).some(p => p.key === line.potKey)) {
          restoredLines.push({ type: 'pot', potKey: line.potKey, qty, _id: line.id });
        } else if (line.type === 'package' && Number.isInteger(line.pkgIndex) && line.pkgIndex >= 0 && line.pkgIndex < (siteData.packages || []).length) {
          restoredLines.push({ type: 'package', pkgIndex: line.pkgIndex, qty, _id: line.id });
        } else if (line.type === 'custom') {
          const counts = {};
          order.forEach(key => {
            const c = Math.floor(Number(line.counts && line.counts[key]));
            if (c > 0) counts[key] = c;
          });
          if (Object.keys(counts).length === 0) return;
          const additions = {};
          (siteData.customAdditions || []).forEach(addition => {
            const c = Math.floor(Number(line.additions && line.additions[addition.key]));
            if (c > 0) additions[addition.key] = c;
          });
          restoredLines.push({ type: 'custom', counts, additions, qty, _id: line.id });
        }
      });

      let maxOriginalId = 0;
      restoredLines.forEach(line => {
        if (Number.isInteger(line._id) && line._id > 0) maxOriginalId = Math.max(maxOriginalId, line._id);
      });
      let nextFreshId = maxOriginalId + 1;
      const assignedIds = new Set();
      restoredLines.forEach(line => {
        if (Number.isInteger(line._id) && line._id > 0 && !assignedIds.has(line._id)) {
          line.id = line._id;
        } else {
          line.id = nextFreshId++;
        }
        assignedIds.add(line.id);
        delete line._id;
      });

      cart = restoredLines;
      nextLineId = Math.max(maxOriginalId, nextFreshId - 1) + 1;

      if (typeof parsed.wrapKey === 'string' && (siteData.wraps || []).some(w => w.key === parsed.wrapKey)) {
        selectedWrap = parsed.wrapKey;
      }
      if (typeof parsed.orderNote === 'string') {
        orderNote = parsed.orderNote.slice(0, CARD_NOTE_MAX);
      }
      if (parsed.customCounts && typeof parsed.customCounts === 'object') {
        // ALX-06: re-clamp on restore too — a stale or hand-edited payload
        // must never bypass the per-flower/total-stem caps.
        let restoredTotal = 0;
        order.forEach(key => {
          const c = Math.floor(Number(parsed.customCounts[key]));
          const clamped = c > 0 ? Math.min(c, MAX_CUSTOM_STEMS_PER_FLOWER) : 0;
          const withinTotal = Math.min(clamped, Math.max(0, MAX_CUSTOM_TOTAL_STEMS - restoredTotal));
          customCounts[key] = withinTotal;
          restoredTotal += withinTotal;
        });
      }
      // ALX-14: the in-progress custom-builder draft's leaf additions were
      // never persisted at all — a reload silently zeroed them out even
      // though committed cart lines kept theirs.
      if (parsed.customAdditions && typeof parsed.customAdditions === 'object') {
        (siteData.customAdditions || []).forEach(addition => {
          const c = Math.floor(Number(parsed.customAdditions[addition.key]));
          customAdditions[addition.key] = c > 0 ? Math.min(c, MAX_CUSTOM_ADDITION_PER_KEY) : 0;
        });
      }
      messageCardEnabled = !!parsed.messageCardEnabled;
      if (typeof parsed.orderRecipientName === 'string') orderRecipientName = parsed.orderRecipientName.slice(0, 120);
      if (typeof parsed.orderCardSenderName === 'string') orderCardSenderName = parsed.orderCardSenderName.slice(0, 120);
    } catch (e) {
      cart = [];
    }
  }

  /**
   * Channel readiness helpers (centralized source of truth - A1)
   */
  function isWhatsAppReady() {
    if (!siteData || !siteData.store) return false;
    const isShown = siteData.store.channels?.showWhatsapp !== false;
    const rawNum = String(siteData.store.whatsappNumber || '').replace(/[^0-9]/g, '');
    return isShown && rawNum.length >= 7;
  }

  function isShopeeReady() {
    if (!siteData || !siteData.store) return false;
    const isShown = siteData.store.channels?.showShopee !== false;
    const url = String(siteData.store.shopeeUrl || '').trim();
    return isShown && !!url && url !== '#' && url !== 'https://shopee.co.id';
  }

  /**
   * Dynamic rule interpolation helper (A2)
   */
  function interpolateRules(template) {
    if (!template || typeof template !== 'string') return template;
    const minStems = siteData?.minStems ?? 3;
    const wrapFeeUnitStems = siteData?.wrapFeeUnitStems ?? 3;
    const wrapFeePerUnitFormatted = formatRp(siteData?.wrapFeePerUnit ?? 35000);
    return template
      .replace(/\{minStems\}/g, minStems)
      .replace(/\{wrapFeeUnitStems\}/g, wrapFeeUnitStems)
      .replace(/\{wrapFeePerUnit\}/g, wrapFeePerUnitFormatted);
  }

  /**
   * Generic {placeholder} substitution for checkout copy (DEV-13). Unlike
   * interpolateRules() above (fixed pricing-rule tokens only), this fills
   * whatever keys the caller supplies, e.g. ck('checkoutFieldsIncomplete', { count: 2 }).
   */
  function ck(key, vars) {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    let template = t[key];
    if (template === undefined) template = (siteData.translations.id || {})[key] || '';
    if (!vars) return template;
    return String(template).replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
  }

  /**
   * Apply language metadata to document (title, description, lang attribute - A4)
   */
  function applyLanguageMetadata(lang) {
    try {
      if (document.documentElement) {
        document.documentElement.lang = lang;
      }
    } catch (e) {}

    const isEn = lang === 'en';
    const title = isEn
      ? 'Alxanthia — Finished Chenille Stem Flowers & Handcrafted Bouquets'
      : 'Alxanthia — Bunga Jadi & Buket Kawat Bulu Chenille · Handcrafted Botanical Bouquets';
    const desc = isEn
      ? 'Chenille stem botanical flowers that never wilt: Sunflower, Rose, Tulip, and Gerbera. Handcrafted ready-to-display stems and bouquets.'
      : 'Bunga kawat bulu chenille yang tak pernah layu: Bunga Matahari, Mawar, Tulip, dan Gerbera. Dirangkai rapi oleh kami, tersedia per tangkai atau buket siap pajang.';
    const ogTitle = isEn
      ? 'Alxanthia — Handcrafted Chenille Stem Flowers & Bouquets'
      : 'Alxanthia — Bunga Jadi & Buket Kawat Bulu Chenille';
    const ogDesc = isEn
      ? 'Flowers that never wilt — handcrafted by us for you. Sunflower, Rose, Tulip, and Gerbera.'
      : 'Bunga yang tak pernah layu — dirangkai tangan kami untuk Anda. Bunga Matahari, Mawar, Tulip, dan Gerbera.';

    document.title = title;

    const setMetaContent = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute('content', val);
    };

    setMetaContent('meta[name="description"]', desc);
    setMetaContent('meta[property="og:title"]', ogTitle);
    setMetaContent('meta[property="og:description"]', ogDesc);
    setMetaContent('meta[name="twitter:title"]', ogTitle);
    setMetaContent('meta[name="twitter:description"]', ogDesc);
  }

  /**
   * Initialize language from localStorage or default to 'id'
   */
  function initLang() {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang === 'id' || urlLang === 'en') {
          currentLang = urlLang;
        } else {
          const saved = localStorage.getItem(LANG_KEY);
          if (saved === 'id' || saved === 'en') {
            currentLang = saved;
          }
        }
      } else {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved === 'id' || saved === 'en') {
          currentLang = saved;
        }
      }
    } catch (e) {}
    applyLanguageMetadata(currentLang);
  }

  /**
   * Switch language and update UI and document metadata
   */
  function setLanguage(lang) {
    if (lang !== 'id' && lang !== 'en') return;
    currentLang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}

    applyLanguageMetadata(lang);
    renderAll();
  }

  function fillTemplate(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, (m, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : '');
  }

  /**
   * Calculate custom bouquet totals
   */
  function getCustomTotals() {
    let stems = 0;
    let flowersSubtotal = 0;
    const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];

    order.forEach(key => {
      const qty = customCounts[key] || 0;
      const flower = siteData.flowers[key];
      const price = flower ? (flower.stemPrice || 55000) : 55000;
      stems += qty;
      flowersSubtotal += qty * price;
    });

    const wrapFeeUnitStems = siteData.wrapFeeUnitStems ?? 3;
    const wrapFeePerUnit = siteData.wrapFeePerUnit ?? 35000;
    const minStems = siteData.minStems ?? 3;
    const additionsSubtotal = (siteData.customAdditions || []).reduce((sum, addition) =>
      sum + (customAdditions[addition.key] || 0) * (addition.price || 0), 0);

    const wrapFee = stems > 0 ? Math.ceil(stems / wrapFeeUnitStems) * wrapFeePerUnit : 0;
    const total = flowersSubtotal + wrapFee + additionsSubtotal;
    const isValid = stems >= minStems;

    return {
      stems,
      flowersSubtotal,
      additionsSubtotal,
      wrapFee,
      total,
      isValid
    };
  }

  /**
   * Pure cart pricing function — reads only its argument and siteData.
   * Mirrors getCustomTotals()'s per-bouquet arithmetic exactly, generalized to a cart of lines.
   */
  function computeCartTotals(cartArg) {
    const list = Array.isArray(cartArg) ? cartArg : [];
    const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];
    const wrapFeeUnitStems = siteData.wrapFeeUnitStems ?? 3;
    const wrapFeePerUnit = siteData.wrapFeePerUnit ?? 35000;
    const minStems = siteData.minStems ?? 3;

    let everyCustomLineValid = true;

    const lines = list.map(line => {
      let stems = 0;
      let subtotal = 0;
      let wrapFee = 0;

      if (line.type === 'stem') {
        const flower = siteData.flowers[line.flowerKey];
        const price = flower ? (flower.stemPrice || 55000) : 55000;
        stems = line.qty;
        subtotal = price * line.qty;
      } else if (line.type === 'pot') {
        const pot = (siteData.miniPots || []).find(item => item.key === line.potKey);
        subtotal = (pot ? pot.price : 0) * line.qty;
      } else if (line.type === 'package') {
        const pkg = siteData.packages[line.pkgIndex];
        stems = (pkg ? pkg.stems : 0) * line.qty;
        subtotal = (pkg ? pkg.price : 0) * line.qty;
      } else if (line.type === 'custom') {
        let bouquetStems = 0;
        let bouquetSubtotal = 0;
        order.forEach(key => {
          const qty = (line.counts && line.counts[key]) || 0;
          const flower = siteData.flowers[key];
          const price = flower ? (flower.stemPrice || 55000) : 55000;
          bouquetStems += qty;
          bouquetSubtotal += qty * price;
        });
        (siteData.customAdditions || []).forEach(addition => {
          const count = (line.additions && line.additions[addition.key]) || 0;
          bouquetSubtotal += count * (addition.price || 0);
        });
        if (bouquetStems < minStems) everyCustomLineValid = false;
        const bouquetWrapFee = bouquetStems > 0 ? Math.ceil(bouquetStems / wrapFeeUnitStems) * wrapFeePerUnit : 0;
        stems = bouquetStems * line.qty;
        subtotal = bouquetSubtotal * line.qty;
        wrapFee = bouquetWrapFee * line.qty;
      }

      return { id: line.id, type: line.type, stems, subtotal, wrapFee, total: subtotal + wrapFee };
    });

    const stemsTotal = lines.reduce((sum, l) => sum + l.stems, 0);
    const subtotalTotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
    const wrapFeeTotal = lines.reduce((sum, l) => sum + l.wrapFee, 0);
    const messageCardFee = list.length > 0 && messageCardEnabled ? (siteData.messageCardPrice ?? 0) : 0;
    const total = subtotalTotal + wrapFeeTotal + messageCardFee;

    return {
      lines,
      stems: stemsTotal,
      subtotal: subtotalTotal,
      wrapFee: wrapFeeTotal,
      messageCardFee,
      total,
      isValid: list.length > 0 && everyCustomLineValid
    };
  }

  function checkoutLineLabel(line, lang = currentLang) {
    const t = siteData.translations[lang] || siteData.translations.id;
    if (line.type === 'stem') {
      const flower = siteData.flowers[line.flowerKey];
      return `${line.qty} × ${(flower && (flower[lang] || flower.en).name) || line.flowerKey}`;
    }
    if (line.type === 'pot') {
      const pot = (siteData.miniPots || []).find(item => item.key === line.potKey);
      return `${line.qty} × ${pot ? (pot[lang] || pot.en).name : line.potKey}`;
    }
    if (line.type === 'package') {
      const pkg = siteData.packages[line.pkgIndex];
      return `${line.qty} × ${t.pkgNames[line.pkgIndex]} (${pkg ? pkg.stems : 0} ${t.stemsWord})`;
    }
    const parts = (siteData.flowerOrder || []).filter(key => line.counts && line.counts[key] > 0).map(key => {
      const flower = siteData.flowers[key];
      return `${line.counts[key]} × ${(flower[lang] || flower.en).name}`;
    });
    const additionParts = (siteData.customAdditions || [])
      .filter(addition => line.additions && line.additions[addition.key] > 0)
      .map(addition => {
        const count = line.additions[addition.key];
        const name = (addition[lang] || addition.en).name;
        return count > 1 ? `${count} × ${name}` : name;
      });
    const additions = additionParts.length ? ` · ${t.additionsLabel}: ${additionParts.join(', ')}` : '';
    return `${line.qty > 1 ? `${line.qty} × ` : ''}${lang === 'en' ? 'Custom bouquet' : 'Buket custom'} (${parts.join(', ')})${additions}`;
  }

  function normalizedCheckoutState() {
    const totals = computeCartTotals(cart);
    const types = [...new Set(cart.map(line => line.type))];
    const itemData = cart.map(line => {
      if (line.type === 'stem') return { type: 'stem', id: line.flowerKey, qty: line.qty };
      if (line.type === 'pot') return { type: 'pot', id: line.potKey, qty: line.qty };
      if (line.type === 'package') return { type: 'package', id: String(line.pkgIndex), qty: line.qty };
      return { type: 'custom', qty: line.qty, additions: { ...(line.additions || {}) }, stems: siteData.flowerOrder.reduce((out, key) => {
        const qty = (line.counts && line.counts[key]) || 0;
        if (qty) out[key] = qty;
        return out;
      }, {}) };
    });
    return {
      // DEV-01: a cart mixing more than one product type is `mixed`, distinct from a
      // single custom bouquet. `itemData` (not this label) is the authoritative product
      // list — the server must reprice from itemData, never trust orderMode for pricing.
      orderMode: types.length > 1 ? 'mixed' : (types[0] || 'custom'),
      items: cart.map(line => checkoutLineLabel(line)),
      itemData,
      totalStemCount: totals.stems,
      wrapId: selectedWrap,
      messageCardEnabled,
      messageCardFee: totals.messageCardFee,
      giftMessage: messageCardEnabled ? orderNote : '',
      recipientName: orderRecipientName,
      cardSenderName: orderCardSenderName,
      productSubtotal: totals.subtotal + totals.wrapFee,
      estimatedProductTotal: totals.total,
      currency: 'IDR', language: currentLang, isValid: totals.isValid
    };
  }

  function generateOrderReference(now = new Date()) {
    const date = [String(now.getFullYear()).slice(-2), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(4);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return `ALX-${date}-${Array.from(bytes, value => alphabet[value % alphabet.length]).join('')}`;
  }

  /**
   * DEV-04: a real deduplication key, separate from the human-readable reference
   * above (which only has 4 random characters and is not safe to deduplicate on).
   * Kept on checkoutAttempt and reused across every retry of the same attempt;
   * only "Start a new order" clears it.
   */
  function generateIdempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function buildPostSubmissionWhatsApp(reference, buyerName = '', preferredDate = '', state = normalizedCheckoutState()) {
    const url = new URL(`https://wa.me/${String(siteData.store.whatsappNumber || '').replace(/[^0-9]/g, '')}`);
    const name = buyerName || (state.language === 'en' ? '—' : '—');
    const date = preferredDate || (state.language === 'en' ? 'To be confirmed' : 'Akan dikonfirmasi');
    url.searchParams.set('text', state.language === 'en'
      ? `Hello Alxanthia! I have just submitted order request ${reference}.\n\nName: ${name}\nOrder: ${state.items.join('; ')}\nProduct subtotal: ${formatRp(state.estimatedProductTotal)}\nPreferred date: ${date}\n\nPlease confirm availability, timing, and delivery cost. Thank you!`
      : `Halo Alxanthia! Saya baru mengirim permintaan pesanan ${reference}.\n\nNama: ${name}\nPesanan: ${state.items.join('; ')}\nSubtotal produk: ${formatRp(state.estimatedProductTotal)}\nTanggal yang diinginkan: ${date}\n\nMohon konfirmasi ketersediaan, tanggal, dan ongkos kirimnya. Terima kasih!`);
    return url.toString();
  }

  /**
   * Collapses any way a customer might type an Indonesian number — 089...,
   * 89..., 62..., +62 81-2345-..., with spaces/dashes/parens — into a single
   * canonical E.164 form (+62...) so only one format ever reaches the sheet.
   * Numbers that already carry a different country code are left untouched.
   */
  function normalizeIndonesianPhone(raw) {
    let digits = String(raw || '').trim().replace(/[^\d+]/g, '');
    digits = digits.replace(/(?!^)\+/g, '');
    if (digits.startsWith('+62')) {
      digits = '+62' + digits.slice(3).replace(/^0+/, '');
    } else if (digits.startsWith('62')) {
      digits = '+62' + digits.slice(2).replace(/^0+/, '');
    } else if (digits.startsWith('0')) {
      digits = '+62' + digits.slice(1);
    } else if (digits.startsWith('+')) {
      return digits;
    } else if (digits) {
      digits = '+62' + digits;
    }
    return digits;
  }

  function buildOrderSubmission(formData, reference, state = normalizedCheckoutState(), idempotencyKey = '') {
    const customer = {};
    formData.forEach((value, key) => { customer[key] = String(value); });
    // DEV-06: the browser checkbox becomes the HTML string "on" (or is simply absent
    // when unchecked) inside FormData — normalize it to a real Boolean before it ever
    // reaches the server, which must still enforce that it is exactly `true`.
    customer.acknowledgement = customer.acknowledgement === 'on' || customer.acknowledgement === 'true';
    if (customer.buyer_whatsapp) customer.buyer_whatsapp = normalizeIndonesianPhone(customer.buyer_whatsapp);
    return {
      order_reference: reference,
      idempotency_key: idempotencyKey,
      catalog_version: siteData.catalogVersion ?? 1,
      cf_turnstile_token: turnstileToken,
      submitted_language: state.language,
      order_mode: state.orderMode,
      order_summary: state.items.join('; '),
      item_data: state.itemData,
      total_stems: state.totalStemCount,
      wrap: state.wrapId,
      message_card_enabled: state.messageCardEnabled,
      message_card_fee: state.messageCardFee,
      gift_message: state.giftMessage,
      recipient_name: state.recipientName,
      card_sender_name: state.cardSenderName,
      product_subtotal: state.productSubtotal,
      estimated_product_total: state.estimatedProductTotal,
      currency: state.currency,
      source: 'website',
      ...customer
    };
  }

  /**
   * Smoothly scroll to in-page section with sticky header offset compensation
   */
  function scrollToSection(selector, highlightTargetSelector = null) {
    const target = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!target) return;
    const header = document.querySelector('.site-header');
    const headerHeight = header ? header.getBoundingClientRect().height : 68;
    const targetY = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });

    if (highlightTargetSelector) {
      const hlTarget = typeof highlightTargetSelector === 'string'
        ? document.querySelector(highlightTargetSelector)
        : highlightTargetSelector;
      if (hlTarget) {
        hlTarget.classList.remove('section-highlight');
        if (typeof hlTarget.offsetWidth === 'number') {
          void hlTarget.offsetWidth;
        }
        hlTarget.classList.add('section-highlight');
        setTimeout(() => {
          hlTarget.classList.remove('section-highlight');
        }, 1400);
      }
    }
  }

  /**
   * Total individual units in the cart (stems, pots, packages, bouquets),
   * as opposed to cart.length which counts merged cart *lines* (UX-06).
   */
  function cartUnitCount() {
    return cart.reduce((sum, l) => sum + l.qty, 0);
  }

  /**
   * Visible + screen-reader-announced feedback when a cart/custom-builder
   * limit is hit, instead of silently clamping or letting the order reach
   * the server only to fail there (ALX-06).
   */
  let cartLimitNoticeTimer = null;
  function showCartLimitNotice(key, vars) {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const message = fillTemplate(t[key] || '', vars);
    if (!message) return;
    const el = document.getElementById('cart-limit-notice');
    if (el) {
      el.textContent = message;
      el.hidden = false;
      if (cartLimitNoticeTimer) clearTimeout(cartLimitNoticeTimer);
      cartLimitNoticeTimer = setTimeout(() => { el.hidden = true; }, 5000);
    }
    announceToScreenReader(message);
  }

  /**
   * Announce a cart mutation via the single #order-announcer live region.
   * Throttled to at most one DOM write per 500ms so holding a stepper
   * button doesn't flood the queue — a rapid burst still ends with one
   * trailing announcement reflecting the latest state (P2-02).
   */
  let announceTimer = null;
  let lastAnnounceAt = 0;
  function announceToScreenReader(message) {
    const announcer = document.getElementById('order-announcer');
    if (!announcer) return;
    const elapsed = Date.now() - lastAnnounceAt;
    if (announceTimer) {
      clearTimeout(announceTimer);
      announceTimer = null;
    }
    if (elapsed >= 500) {
      announcer.textContent = message;
      lastAnnounceAt = Date.now();
    } else {
      announceTimer = setTimeout(() => {
        announcer.textContent = message;
        lastAnnounceAt = Date.now();
        announceTimer = null;
      }, 500 - elapsed);
    }
  }

  /**
   * Cart mutation: add a line, merging into an existing stem/package line
   * with the same identity (same flowerKey, or same pkgIndex). Custom lines
   * never merge — each committed bouquet is a distinct line.
   */
  function addLine(lineSpec) {
    const requestedQty = lineSpec.qty || 1;
    let line;
    let existing;
    if (lineSpec.type !== 'custom') {
      existing = cart.find(l => l.type === lineSpec.type && (
        lineSpec.type === 'stem' ? l.flowerKey === lineSpec.flowerKey :
        lineSpec.type === 'pot' ? l.potKey === lineSpec.potKey :
        l.pkgIndex === lineSpec.pkgIndex
      ));
    }

    // ALX-06: never let a merge or a new line exceed the server's caps —
    // MAX_QTY_PER_LINE for one line, MAX_LINES_PER_ORDER for distinct
    // lines, MAX_TOTAL_QTY for the whole order.
    if (!existing && cart.length >= MAX_LINES_PER_ORDER) {
      showCartLimitNotice('cartLimitLines', { max: MAX_LINES_PER_ORDER });
      return existing || null;
    }
    const lineCeiling = existing ? Math.max(0, MAX_QTY_PER_LINE - existing.qty) : MAX_QTY_PER_LINE;
    const totalCeiling = Math.max(0, MAX_TOTAL_QTY - cartUnitCount());
    const addQty = Math.max(0, Math.min(requestedQty, lineCeiling, totalCeiling));
    if (addQty < requestedQty) {
      showCartLimitNotice(addQty < requestedQty && lineCeiling < totalCeiling ? 'cartLimitQtyPerLine' : 'cartLimitTotalQty', { max: lineCeiling < totalCeiling ? MAX_QTY_PER_LINE : MAX_TOTAL_QTY });
    }
    if (addQty <= 0) return existing || null;

    if (existing) {
      existing.qty += addQty;
      line = existing;
    } else {
      line = { ...lineSpec, id: nextLineId++, qty: addQty };
      cart.push(line);
    }
    renderCartLines();
    renderBouquetsUI();
    renderOrderSection();
    persistCart();

    const t = siteData.translations[currentLang] || siteData.translations.id;
    const { title } = describeLine(line, t);
    announceToScreenReader(fillTemplate(t.announceLineAdded || '{item} added. {n} item(s) in cart.', { item: title, n: cartUnitCount() }));

    return line;
  }

  /**
   * Cart mutation: remove a line by id. Moves focus to the next line's
   * remove button, or to #cart-lines if the cart is now empty.
   */
  function removeLine(id) {
    const idx = cart.findIndex(l => l.id === id);
    if (idx === -1) return;
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const { title } = describeLine(cart[idx], t);
    cart.splice(idx, 1);
    renderCartLines();
    renderBouquetsUI();
    renderOrderSection();
    persistCart();

    announceToScreenReader(fillTemplate(t.announceLineRemoved || '{item} removed. {n} item(s) in cart.', { item: title, n: cartUnitCount() }));

    const linesEl = document.getElementById('cart-lines');
    if (linesEl) {
      const removeBtns = linesEl.querySelectorAll('.btn-remove-line');
      if (removeBtns.length > 0) {
        removeBtns[Math.min(idx, removeBtns.length - 1)].focus({ preventScroll: true });
      } else {
        linesEl.focus({ preventScroll: true });
      }
    }
  }

  /**
   * Cart mutation: change a line's quantity. A quantity that reaches zero or
   * below removes the line entirely (documented choice — see P1-06 spec).
   */
  function bumpLineQty(id, delta) {
    const line = cart.find(l => l.id === id);
    if (!line) return;
    let newQty = line.qty + delta;
    if (newQty <= 0) {
      removeLine(id);
      return;
    }
    // ALX-06: mirrors the server's MAX_QTY_PER_LINE / MAX_TOTAL_QTY caps —
    // an increment can't push a line, or the order, past what doPost would
    // reject anyway.
    if (delta > 0) {
      const totalCeiling = MAX_TOTAL_QTY - (cartUnitCount() - line.qty);
      const clamped = Math.min(newQty, MAX_QTY_PER_LINE, totalCeiling);
      if (clamped < newQty) {
        showCartLimitNotice(newQty > MAX_QTY_PER_LINE ? 'cartLimitQtyPerLine' : 'cartLimitTotalQty', { max: newQty > MAX_QTY_PER_LINE ? MAX_QTY_PER_LINE : MAX_TOTAL_QTY });
      }
      newQty = Math.max(line.qty, clamped);
    }
    line.qty = newQty;
    renderCartLines();
    renderBouquetsUI();
    renderOrderSection();
    persistCart();

    const t = siteData.translations[currentLang] || siteData.translations.id;
    const { title } = describeLine(line, t);
    announceToScreenReader(fillTemplate(t.announceQtyChanged || '{item} updated to {qty}. {n} item(s) in cart.', { item: title, qty: newQty, n: cartUnitCount() }));
  }

  /**
   * Order action: Choose a single finished stem
   */
  function selectStemOrder(flowerKey, scroll = true) {
    const wasCartEmpty = cart.length === 0;
    if (flowerKey && siteData.flowers[flowerKey]) {
      selectedFlower = flowerKey;
    }
    addLine({ type: 'stem', flowerKey: selectedFlower, qty: 1 });
    if (scroll) {
      if (wasCartEmpty) scrollToSection('#order', '.order-controls-col');
      const finishLabel = document.getElementById('finish-label');
      if (finishLabel) {
        finishLabel.focus({ preventScroll: true });
        finishLabel.classList.remove('finish-label-pulse');
        if (typeof finishLabel.offsetWidth === 'number') {
          void finishLabel.offsetWidth;
        }
        finishLabel.classList.add('finish-label-pulse');
        setTimeout(() => {
          finishLabel.classList.remove('finish-label-pulse');
        }, 1200);
      }
    }
  }

  function selectMiniPot(potKey, scroll = true) {
    const wasCartEmpty = cart.length === 0;
    const pot = (siteData.miniPots || []).find(item => item.key === potKey);
    if (!pot) return;
    addLine({ type: 'pot', potKey, qty: 1 });
    if (scroll && wasCartEmpty) scrollToSection('#order', '.order-controls-col');
  }

  /**
   * Order action: Select a bouquet package
   */
  function selectPackageOrder(pkgIndex, scroll = true, restoreFocus = true) {
    const wasCartEmpty = cart.length === 0;
    selectedPackage = Math.max(0, Math.min(pkgIndex, siteData.packages.length - 1));
    addLine({ type: 'package', pkgIndex: selectedPackage, qty: 1 });
    if (restoreFocus) {
      const activeBtn = document.querySelector(`.btn-choose-bouquet[data-index="${selectedPackage}"]`);
      if (activeBtn) activeBtn.focus({ preventScroll: true });
    }
    if (scroll) {
      if (wasCartEmpty) scrollToSection('#order', '.order-controls-col');
      const finishLabel = document.getElementById('finish-label');
      if (finishLabel) {
        finishLabel.focus({ preventScroll: true });
        finishLabel.classList.remove('finish-label-pulse');
        if (typeof finishLabel.offsetWidth === 'number') {
          void finishLabel.offsetWidth;
        }
        finishLabel.classList.add('finish-label-pulse');
        setTimeout(() => {
          finishLabel.classList.remove('finish-label-pulse');
        }, 1200);
      }
    }
  }

  /**
   * Order action: Commit the custom bouquet draft as a new cart line
   * (custom lines never merge — each is a distinct bouquet) and scroll to order
   */
  function useCustomBouquet() {
    const tot = getCustomTotals();
    if (tot.isValid) {
      addLine({ type: 'custom', counts: { ...customCounts }, additions: { ...customAdditions }, qty: 1 });
      scrollToSection('#order', '.order-controls-col');
      const finishLabel = document.getElementById('finish-label');
      if (finishLabel) {
        finishLabel.focus({ preventScroll: true });
        finishLabel.classList.remove('finish-label-pulse');
        if (typeof finishLabel.offsetWidth === 'number') {
          void finishLabel.offsetWidth;
        }
        finishLabel.classList.add('finish-label-pulse');
        setTimeout(() => {
          finishLabel.classList.remove('finish-label-pulse');
        }, 1200);
      }
    }
  }

  /**
   * Order action: Bump custom flower count in the draft (not yet in the cart)
   */
  function bumpCustomCount(flowerKey, delta) {
    const cur = customCounts[flowerKey] || 0;
    let next = Math.max(0, cur + delta);
    // ALX-06: mirrors the server's MAX_CUSTOM_STEMS_PER_FLOWER /
    // MAX_CUSTOM_TOTAL_STEMS caps on a custom bouquet definition.
    if (delta > 0) {
      const currentTotal = getCustomTotals().stems;
      const totalCeiling = MAX_CUSTOM_TOTAL_STEMS - (currentTotal - cur);
      const clamped = Math.min(next, MAX_CUSTOM_STEMS_PER_FLOWER, totalCeiling);
      if (clamped < next) {
        showCartLimitNotice(next > MAX_CUSTOM_STEMS_PER_FLOWER ? 'customLimitStemsPerFlower' : 'customLimitTotalStems', { max: next > MAX_CUSTOM_STEMS_PER_FLOWER ? MAX_CUSTOM_STEMS_PER_FLOWER : MAX_CUSTOM_TOTAL_STEMS });
      }
      next = Math.max(cur, clamped);
    }
    customCounts[flowerKey] = next;
    renderCustomBuilder();
    renderBouquetsUI();
    persistCart();
  }

  /**
   * Order action: Reset the custom bouquet draft
   */
  function resetCustomCounts() {
    (siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera']).forEach(k => {
      customCounts[k] = 0;
    });
    Object.keys(customAdditions).forEach(key => { customAdditions[key] = 0; });
    renderCustomBuilder();
    renderBouquetsUI();
    persistCart();
  }

  function bumpCustomAddition(key, delta) {
    if (!Object.prototype.hasOwnProperty.call(customAdditions, key)) return;
    const cur = customAdditions[key] || 0;
    let next = Math.max(0, cur + delta);
    // ALX-06: mirrors the server's MAX_CUSTOM_ADDITION_PER_KEY cap.
    if (delta > 0 && next > MAX_CUSTOM_ADDITION_PER_KEY) {
      showCartLimitNotice('customLimitAddition', { max: MAX_CUSTOM_ADDITION_PER_KEY });
      next = MAX_CUSTOM_ADDITION_PER_KEY;
    }
    customAdditions[key] = next;
    renderCustomBuilder();
    persistCart(); // ALX-14: was never persisted, so a reload silently dropped selected additions
  }

  /**
   * Order action: Select wrapping paper colour
   */
  function selectWrap(wrapKey) {
    selectedWrap = wrapKey;
    renderOrderSection();
    persistCart();
  }

  /**
   * Helper: safe text replacement
   */
  function setText(selector, text) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el && text !== undefined && text !== null) {
      el.textContent = text;
    }
  }

  /**
   * Helper: safe attribute replacement with duplicate avoidance
   */
  function setAttr(selector, attr, val) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el && val !== undefined && val !== null) {
      if (el.getAttribute(attr) !== val) {
        el.setAttribute(attr, val);
      }
    }
  }

  /**
   * Accessible Product Image Inspector Modal (P3.11)
   */
  let modalReturnElement = null;

  function openImageModal(src, alt, title, caption, triggerEl) {
    const modal = document.getElementById('image-modal');
    if (!modal) return;
    modalReturnElement = triggerEl;

    const img = document.getElementById('image-modal-img');
    const titleEl = document.getElementById('image-modal-title');
    const captionEl = document.getElementById('image-modal-caption');

    if (img) {
      img.src = src;
      img.alt = alt || title;
    }
    if (titleEl) titleEl.textContent = title;
    if (captionEl) captionEl.textContent = caption;

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }

    const closeBtn = document.getElementById('image-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function restoreModalFocus() {
    if (modalReturnElement && typeof modalReturnElement.focus === 'function') {
      try {
        modalReturnElement.focus();
      } catch (e) {}
    }
    modalReturnElement = null;
  }

  function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (!modal) return;
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
      restoreModalFocus();
    }
  }

  /**
   * The most recently added or touched cart line. Legacy single-target UI
   * (the #stem-qty-card global stepper) still keys off this.
   */
  function activeLine() {
    return cart.length ? cart[cart.length - 1] : null;
  }

  /**
   * Render Header & Navigation
   */
  function renderHeader(t) {
    setText('#nav-collection', t.navCollection);
    setText('#nav-bouquets', t.navBouquets);
    setText('#nav-how', t.navHow);
    setText('#nav-faq', t.navFaq);
    setText('#nav-order', t.navOrder);
    setText('#mobile-order-btn', t.navOrder || 'Pesan');

    // Responsive brand logo
    if (siteData.store.logo) {
      setAttr('.brand-logo', 'src', siteData.store.logo);
      if (siteData.store.logo2x) {
        setAttr('.brand-logo', 'srcset', `${siteData.store.logo} 1x, ${siteData.store.logo2x} 2x`);
      }
    }

    const btnId = document.getElementById('lang-id');
    const btnEn = document.getElementById('lang-en');
    if (btnId && btnEn) {
      if (currentLang === 'id') {
        btnId.classList.add('active');
        btnId.setAttribute('aria-pressed', 'true');
        btnEn.classList.remove('active');
        btnEn.setAttribute('aria-pressed', 'false');
      } else {
        btnId.classList.remove('active');
        btnId.setAttribute('aria-pressed', 'false');
        btnEn.classList.add('active');
        btnEn.setAttribute('aria-pressed', 'true');
      }
    }

    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-label', isExpanded
        ? (currentLang === 'en' ? 'Close navigation menu' : 'Tutup menu navigasi')
        : (currentLang === 'en' ? 'Open navigation menu' : 'Buka menu navigasi')
      );
    }
  }

  /**
   * Category Navigation Filter
   */
  let activeCategory = 'all'; // 'all' | 'stems' | 'pots' | 'bouquets' | 'custom'

  function setCategory(cat, shouldScroll = true) {
    activeCategory = cat || 'all';
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
      const isCur = tab.getAttribute('data-category') === activeCategory;
      tab.classList.toggle('active', isCur);
      tab.setAttribute('aria-pressed', isCur ? 'true' : 'false');
    });

    const colEl = document.getElementById('collection');
    const potsEl = document.getElementById('mini-pots');
    const bouqEl = document.getElementById('bouquets');
    const customEl = document.getElementById('custom-builder');
    const pkgsGrid = document.getElementById('packages-grid');
    const catTwoHeader = document.querySelector('#bouquets .category-header-row');

    if (activeCategory === 'stems') {
      if (colEl) colEl.style.display = '';
      if (potsEl) potsEl.style.display = 'none';
      if (bouqEl) bouqEl.style.display = 'none';
    } else if (activeCategory === 'pots') {
      if (colEl) colEl.style.display = 'none';
      if (potsEl) potsEl.style.display = '';
      if (bouqEl) bouqEl.style.display = 'none';
    } else if (activeCategory === 'bouquets') {
      if (colEl) colEl.style.display = 'none';
      if (potsEl) potsEl.style.display = 'none';
      if (bouqEl) bouqEl.style.display = '';
      if (catTwoHeader) catTwoHeader.style.display = '';
      if (pkgsGrid) pkgsGrid.style.display = '';
      if (customEl) customEl.style.display = 'none';
    } else if (activeCategory === 'custom') {
      if (colEl) colEl.style.display = 'none';
      if (potsEl) potsEl.style.display = 'none';
      if (bouqEl) bouqEl.style.display = '';
      if (catTwoHeader) catTwoHeader.style.display = 'none';
      if (pkgsGrid) pkgsGrid.style.display = 'none';
      if (customEl) customEl.style.display = '';
    } else {
      // 'all'
      if (colEl) colEl.style.display = '';
      if (potsEl) potsEl.style.display = '';
      if (bouqEl) bouqEl.style.display = '';
      if (catTwoHeader) catTwoHeader.style.display = '';
      if (pkgsGrid) pkgsGrid.style.display = '';
      if (customEl) customEl.style.display = '';
    }

    if (shouldScroll && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      const navEl = document.getElementById('category-filter-bar') || document.getElementById('category-nav');
      if (navEl && typeof navEl.getBoundingClientRect === 'function') {
        const header = document.querySelector('.site-header');
        const headerHeight = (header && typeof header.getBoundingClientRect === 'function') ? header.getBoundingClientRect().height : 68;
        const rect = navEl.getBoundingClientRect();
        if (rect.top < 0 || rect.top > headerHeight + 16) {
          scrollToSection(navEl);
        }
      }
    }
  }

  function renderCategoryNav(t) {
    setText('#cat-tab-all', t.categoryAll || (currentLang === 'en' ? 'All' : 'Semua'));
    setText('#cat-tab-stems', t.categoryStems || (currentLang === 'en' ? 'Finished Stems' : 'Bunga Jadi'));
    setText('#cat-tab-pots', t.categoryPots || 'Mini Pots');
    setText('#cat-tab-bouquets', t.categoryBouquets || (currentLang === 'en' ? 'Bouquets' : 'Paket Buket'));
    setText('#cat-tab-custom', t.categoryCustom || (currentLang === 'en' ? 'Custom Mix' : 'Buket Custom'));
  }

  function renderMiniPots(t) {
    setText('#cat2-label', t.catTwoLabel);
    setText('#cat2-title', t.catTwoTitle);
    setText('#cat2-note', t.catTwoNote);
    const grid = document.getElementById('mini-pots-grid');
    if (!grid) return;
    grid.innerHTML = '';
    (siteData.miniPots || []).forEach(pot => {
      const trans = pot[currentLang] || pot.en;
      const card = document.createElement('article');
      card.className = 'mini-pot-card';
      const heightBadge = pot.heightCm
        ? fillTemplate(t.miniPotHeight || '~{h} cm', { h: pot.heightCm })
        : t.miniPotMaterial;
      card.innerHTML = `
        <div class="mini-pot-photo-wrapper"><img src="${pot.photo}" width="1254" height="1254" alt="${trans.name}" class="mini-pot-photo" loading="lazy" /></div>
        <div class="mini-pot-info">
          <span class="mini-pot-material">${heightBadge}</span>
          <h4 class="mini-pot-title">${trans.name}</h4>
          <p class="mini-pot-blurb">${trans.blurb}</p>
          <p class="mini-pot-price">${formatRp(pot.price)}</p>
          <button type="button" class="btn-choose-bouquet btn-add-mini-pot">${t.miniPotBtn}</button>
        </div>`;
      card.querySelector('.btn-add-mini-pot').addEventListener('click', () => selectMiniPot(pot.key));
      grid.appendChild(card);
    });
  }

  /**
   * Render Hero Section
   */
  function renderHero(t) {
    setText('#hero-eyebrow', t.heroEyebrow);
    setText('#hero-title', t.heroTitle);
    setText('#hero-sub', t.heroSub);
    setText('#cta-browse', t.ctaBrowse);
    setText('#cta-bouquets', t.ctaBouquet);

    setText('#ben1-t', t.ben1t);
    setText('#ben1-d', t.ben1d);
    setText('#ben2-t', t.ben2t);
    setText('#ben2-d', t.ben2d);
    setText('#ben3-t', t.ben3t);
    setText('#ben3-d', t.ben3d);

    setText('#hero-caption-latin', t.heroPlateCaption || 'Helianthus annuus');
    setText('#hero-caption-pl', t.heroPlatePl || 'PL. I');

    setAttr('#hero-image', 'src', siteData.images.hero);
    setAttr('#hero-image', 'alt', currentLang === 'en'
      ? 'A finished sunflower made from chenille stems, on cream paper'
      : 'Bunga matahari jadi dari kawat bulu chenille di atas kertas krem');
    if (siteData.images.heroSrcset) {
      setAttr('#hero-image', 'srcset', siteData.images.heroSrcset);
      setAttr('#hero-image', 'sizes', siteData.images.heroSizes || '(max-width: 768px) 90vw, 496px');
    }
  }

  /**
   * Render Trust Guarantees Bar
   */
  const TRUST_ICONS = [
    // Shipping box (delivered nationwide)
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path></svg>',
    // Clock (turnaround time)
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path></svg>',
    // Shield-check (packed to arrive intact)
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"></path><path d="M9 12l2 2 4-4"></path></svg>',
    // Chat bubble (direct order via WhatsApp)
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.3 8.3 0 0 1-4-1l-4.5 1 1-4.4a8.3 8.3 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8.4 8.4 8.4 0 0 1 8.5 8.4z"></path></svg>'
  ];

  function renderTrustBar(t) {
    const el = document.getElementById('trust-inner');
    if (!el) return;
    const rows = [
      [t.tr1t, t.tr1d],
      [t.tr2t, t.tr2d],
      [t.tr3t, t.tr3d],
      [t.tr4t, t.tr4d]
    ];
    el.innerHTML = rows.map(([title, desc], i) => `
      <div class="trust-item">
        <span class="trust-icon" aria-hidden="true">${TRUST_ICONS[i]}</span>
        <p class="trust-item-text"><strong>${title}</strong>${desc}</p>
      </div>
    `).join('');
  }

  /**
   * Render Category 01 — Finished Flowers Collection
   */
  function renderCollection(t) {
    setText('#col-eyebrow', t.colEyebrow);
    setText('#col-title', t.colTitle);
    setText('#col-intro', t.colIntro);

    setText('#cat1-label', t.catOneLabel);
    setText('#cat1-title', t.catOneTitle);
    setText('#cat1-note', t.catOneNote);

    const grid = document.getElementById('collection-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];
    order.forEach(key => {
      const flower = siteData.flowers[key];
      if (!flower) return;
      const trans = flower[currentLang] || flower.en;
      const priceStr = formatRp(flower.stemPrice || 55000);
      const flowerAlt = currentLang === 'en'
        ? (flower.alt || `${trans.name} handcrafted from chenille stems`)
        : `${trans.name} buatan tangan dari benang chenille`;

      const card = document.createElement('article');
      card.className = 'flower-card';
      const singleNoteHtml = trans.singleNote
        ? `<div class="flower-single-note">
            <svg class="note-icon" width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.3A5.7 5.7 0 1 1 2.3 8 5.7 5.7 0 0 1 8 2.3zm0 2.7a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm-1 3.2h2v4.8H7V8.2z"/>
            </svg>
            <span>${trans.singleNote}</span>
          </div>`
        : '';
      const photoStemCount = flower.photoStemCount || 1;
      const photoBadgeHtml = trans.singleNote
        ? `<span class="flower-photo-pill">${currentLang === 'en' ? `Photo: ${photoStemCount} stems` : `Foto: ${photoStemCount} tangkai`}</span>`
        : '';

      card.innerHTML = `
        <div class="flower-photo-wrapper" role="button" tabindex="0" aria-label="${fillTemplate(t.zoomPhotoLabel || 'Enlarge photo of {name}', { name: trans.name })}">
          <span class="flower-accent-line" style="background:${flower.accent}"></span>
          <img src="${flower.photo}" srcset="${flower.srcset || ''}" sizes="${flower.sizes || '(max-width: 600px) 90vw, 260px'}" width="360" height="450" alt="${flowerAlt}" class="flower-photo" loading="lazy" />
          ${photoBadgeHtml}
        </div>
        <div class="flower-info">
          <h4 class="flower-name">${trans.name}</h4>
          <p class="flower-latin">${flower.latin}</p>
          <p class="flower-blurb">${trans.blurb}</p>
          <div class="flower-meta-block">
            <p class="flower-spec-line">${trans.size} · ${trans.detail}</p>
            ${siteData.store.showPrices ? `<p class="flower-price-line">${priceStr} <span class="per-stem-tag">${t.perStemPrefix}</span></p>` : ''}
            ${singleNoteHtml}
          </div>
          <div class="flower-actions-row">
            <button type="button" class="btn-order-stem" data-flower="${key}" style="--accent-hover:${flower.accent}">
              ${t.orderStemLabel}
            </button>
          </div>
        </div>
      `;

      // Photo wrapper inspects/enlarges the product (P3.11)
      const photoWrap = card.querySelector('.flower-photo-wrapper');
      if (photoWrap) {
        photoWrap.setAttribute('title', currentLang === 'en' ? 'Click to enlarge photo' : 'Klik untuk memperbesar foto');
        const handleOpenInspector = (e) => {
          e.preventDefault();
          openImageModal(flower.photo, flowerAlt, trans.name, `${flower.latin} · ${trans.size} · ${trans.detail}`, photoWrap);
        };
        photoWrap.addEventListener('click', handleOpenInspector);
        photoWrap.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleOpenInspector(e);
          }
        });
      }

      // Button: Order this stem
      const orderBtn = card.querySelector('.btn-order-stem');
      if (orderBtn) {
        orderBtn.addEventListener('click', (e) => {
          e.preventDefault();
          selectStemOrder(key, true);
        });
      }

      grid.appendChild(card);
    });
  }

  /**
   * Render Category 03 — Bouquets Section UI
   */
  function renderBouquetsUI() {
    const t = siteData.translations[currentLang] || siteData.translations.id;

    setText('#cat3-label', t.catThreeLabel);
    setText('#cat3-title', t.catThreeTitle);
    setText('#cat3-note', t.catThreeNote);

    const grid = document.getElementById('packages-grid');
    if (!grid) return;

    // If cards already exist for current language, perform smooth in-place update with animations!
    const existingCards = grid.querySelectorAll('.bouquet-card');
    const expectedCount = (siteData.packages || []).length;
    if (existingCards.length === expectedCount && existingCards[0].getAttribute('data-lang') === currentLang) {
      existingCards.forEach((card, index) => {
        const active = cart.some(l => l.type === 'package' && l.pkgIndex === index);
        const wasActive = card.classList.contains('active');

        if (active) {
          card.classList.add('active');
          if (!wasActive) {
            card.classList.remove('bouquet-card-selected-pop');
            if (typeof card.offsetWidth === 'number') {
              void card.offsetWidth;
            }
            card.classList.add('bouquet-card-selected-pop');
            setTimeout(() => {
              card.classList.remove('bouquet-card-selected-pop');
            }, 500);
          }
        } else {
          card.classList.remove('active');
          card.classList.remove('bouquet-card-selected-pop');
        }

        const chooseBtn = card.querySelector('.btn-choose-bouquet');
        if (chooseBtn) {
          chooseBtn.textContent = active ? t.pkgBtnActive : t.pkgBtn;
          chooseBtn.classList.toggle('is-active', active);
          if (active && !wasActive) {
            chooseBtn.classList.remove('is-active-pop');
            if (typeof chooseBtn.offsetWidth === 'number') {
              void chooseBtn.offsetWidth;
            }
            chooseBtn.classList.add('is-active-pop');
            setTimeout(() => {
              chooseBtn.classList.remove('is-active-pop');
            }, 500);
          } else if (!active) {
            chooseBtn.classList.remove('is-active-pop');
          }
        }
      });

      renderCustomBuilder();
      renderKitTeaser();
      return;
    }

    grid.innerHTML = '';

    (siteData.packages || []).forEach((pkg, index) => {
      const active = cart.some(l => l.type === 'package' && l.pkgIndex === index);
      const isPopular = index === 1; // Handful / 5-stem package is classic studio favorite
      const name = t.pkgNames[index] || `Package ${index + 1}`;
      const blurb = t.pkgBlurbs[index] || '';
      const priceStr = formatRp(pkg.price);
      const card = document.createElement('article');
      card.setAttribute('data-lang', currentLang);
      card.className = `bouquet-card ${active ? 'active' : ''} ${isPopular ? 'popular-card' : ''}`;
      card.innerHTML = `
        <div class="bouquet-photo-wrapper">
          ${isPopular ? `<span class="pkg-popular-badge">${t.pkgFavoriteTag || 'Favorit Studio'}</span>` : ''}
          <img src="${pkg.photoWebp || pkg.photo}" srcset="${pkg.srcset || ''}" sizes="${pkg.sizes || '(max-width: 600px) 90vw, 260px'}" width="360" height="360" alt="${name} — ${pkg.stems} ${t.pkgStemLine}" class="bouquet-photo" loading="lazy" />
        </div>
        <div class="bouquet-info">
          <div class="bouquet-meta-row">
            <span class="bouquet-stems-label">${pkg.stems} ${t.pkgStemLine}</span>
          </div>
          <h4 class="bouquet-title">${name}</h4>
          <p class="bouquet-blurb">${blurb}</p>
          ${siteData.store.showPrices ? `<p class="bouquet-price">${priceStr}</p>` : ''}
          <div class="pkg-actions-col">
            <button type="button" class="btn-choose-bouquet ${active ? 'is-active' : ''}" data-index="${index}">
              ${active ? t.pkgBtnActive : t.pkgBtn}
            </button>
          </div>
        </div>
      `;

      const chooseBtn = card.querySelector('.btn-choose-bouquet');
      if (chooseBtn) {
        chooseBtn.addEventListener('click', () => {
          selectPackageOrder(index);
        });
      }

      grid.appendChild(card);
    });

    renderCustomBuilder();
    renderKitTeaser();
  }

  /**
   * Render Custom Bouquet Builder Panel
   */
  function renderCustomBuilder() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const tot = getCustomTotals();

    setText('#custom-eyebrow', t.customEyebrow);
    setText('#custom-title', t.customTitle);
    setText('#custom-intro', interpolateRules(t.customIntro));
    setText('#custom-pick-label', t.customPickLabel);
    setText('#custom-additions-label', t.customAdditionsLabel);
    setText('#custom-additions-note', t.customAdditionsNote);
    setText('#custom-reset-btn', t.resetLabel);

    const toggleBtn = document.getElementById('btn-toggle-custom');
    const toggleText = document.getElementById('custom-toggle-text');
    if (toggleBtn && toggleText) {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') !== 'false';
      toggleText.textContent = isExpanded
        ? (t.customBuilderToggleClose || 'Tutup penyusun custom ↑')
        : (t.customBuilderToggleOpen || 'Susun buket custom sendiri ↓');
    }

    const additionsGrid = document.getElementById('custom-additions-grid');
    if (additionsGrid) {
      // Record currently focused stepper button, if any, so a bump doesn't eject focus.
      const activeEl = document.activeElement;
      const activeAddition = activeEl ? activeEl.getAttribute('data-addition') : null;
      const isAddInc = activeEl ? activeEl.classList.contains('btn-addition-inc') : false;
      const isAddDec = activeEl ? activeEl.classList.contains('btn-addition-dec') : false;

      const expectedAdditions = siteData.customAdditions || [];
      const existingAdditionCards = additionsGrid.querySelectorAll('.custom-addition-card');

      // This grid re-renders on every cart mutation (it lives inside
      // renderCustomBuilder, called from renderBouquetsUI's fast path), not
      // just when an addition itself changes. When the same set of addition
      // cards is already in place for the current language, update counts
      // in place instead of tearing every card (and its <img>) down and
      // rebuilding, which used to flicker every addition photo on any
      // unrelated add/remove.
      if (existingAdditionCards.length === expectedAdditions.length
        && (expectedAdditions.length === 0 || existingAdditionCards[0].getAttribute('data-lang') === currentLang)) {
        existingAdditionCards.forEach((card, i) => {
          const addition = expectedAdditions[i];
          const count = customAdditions[addition.key] || 0;
          card.classList.toggle('is-selected', count > 0);
          const countEl = card.querySelector('.stepper-count');
          if (countEl) countEl.textContent = String(count);
          const decBtn = card.querySelector('.btn-addition-dec');
          if (decBtn) decBtn.disabled = count === 0;
        });
      } else {
        additionsGrid.innerHTML = '';
        expectedAdditions.forEach(addition => {
          const trans = addition[currentLang] || addition.en;
          const count = customAdditions[addition.key] || 0;
          const card = document.createElement('div');
          card.className = `custom-addition-card ${count > 0 ? 'is-selected' : ''}`;
          card.setAttribute('data-lang', currentLang);
          card.innerHTML = `
            <img src="${addition.photo}" width="1254" height="1254" alt="${trans.name}" loading="lazy" />
            <span class="custom-addition-copy"><strong>${trans.name}</strong><small>${formatRp(addition.price)} / ${currentLang === 'en' ? 'piece' : 'lembar'}</small></span>
            <div class="stepper-controls custom-addition-stepper">
              <button type="button" class="btn-stepper btn-addition-dec" data-addition="${addition.key}" ${count === 0 ? 'disabled' : ''} aria-label="${currentLang === 'en' ? 'Decrease' : 'Kurangi'} ${trans.name}">−</button>
              <span class="stepper-count" aria-live="polite">${count}</span>
              <button type="button" class="btn-stepper btn-addition-inc" data-addition="${addition.key}" aria-label="${currentLang === 'en' ? 'Increase' : 'Tambahkan'} ${trans.name}">+</button>
            </div>`;
          card.querySelector('.btn-addition-dec').addEventListener('click', () => bumpCustomAddition(addition.key, -1));
          card.querySelector('.btn-addition-inc').addEventListener('click', () => bumpCustomAddition(addition.key, 1));
          additionsGrid.appendChild(card);
        });
      }

      if (activeAddition) {
        let selector = isAddInc
          ? `.btn-addition-inc[data-addition="${activeAddition}"]`
          : isAddDec
            ? `.btn-addition-dec[data-addition="${activeAddition}"]`
            : null;
        let btnToFocus = selector ? additionsGrid.querySelector(selector) : null;
        // The "−" that just reached 0 disables itself — land on "+" instead of losing focus.
        if (isAddDec && btnToFocus && btnToFocus.disabled) {
          btnToFocus = additionsGrid.querySelector(`.btn-addition-inc[data-addition="${activeAddition}"]`);
        }
        if (btnToFocus) btnToFocus.focus();
      }
    }

    // List of flower rows
    const rowsList = document.getElementById('custom-rows-list');
    if (rowsList) {
      // Record currently focused element if any
      const activeEl = document.activeElement;
      const activeFlower = activeEl ? activeEl.getAttribute('data-flower') : null;
      const isInc = activeEl ? activeEl.classList.contains('btn-inc') : false;
      const isDec = activeEl ? activeEl.classList.contains('btn-dec') : false;

      const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];
      const existingRows = rowsList.querySelectorAll('.custom-row-item');

      // Same reasoning as the additions grid above: this list re-renders on
      // every cart mutation, so update counts in place when the row set
      // already matches instead of rebuilding every row from scratch.
      if (existingRows.length === order.length
        && (order.length === 0 || existingRows[0].getAttribute('data-lang') === currentLang)) {
        existingRows.forEach((li, i) => {
          const key = order[i];
          const count = customCounts[key] || 0;
          const countEl = li.querySelector('.stepper-count');
          if (countEl) countEl.textContent = String(count);
          const decBtn = li.querySelector('.btn-dec');
          if (decBtn) decBtn.disabled = count === 0;
        });
      } else {
        rowsList.innerHTML = '';
        order.forEach(key => {
          const flower = siteData.flowers[key];
          if (!flower) return;
          const trans = flower[currentLang] || flower.en;
          const count = customCounts[key] || 0;
          const priceStr = `${formatRp(flower.stemPrice || 55000)} / ${t.stemWord}`;

          const li = document.createElement('li');
          li.className = 'custom-row-item';
          li.setAttribute('data-lang', currentLang);
          li.innerHTML = `
            <div class="custom-flower-meta">
              <span class="custom-flower-dot" style="background:${flower.accent}" aria-hidden="true"></span>
              <div>
                <p class="custom-flower-name">${trans.name}</p>
                <p class="custom-flower-price">${priceStr}</p>
              </div>
            </div>
            <div class="stepper-controls">
              <button type="button" class="btn-stepper btn-dec" data-flower="${key}" ${count === 0 ? 'disabled' : ''} aria-label="${currentLang === 'en' ? 'Decrease' : 'Kurangi'} ${trans.name}">−</button>
              <span class="stepper-count" aria-live="polite">${count}</span>
              <button type="button" class="btn-stepper btn-inc" data-flower="${key}" aria-label="${currentLang === 'en' ? 'Increase' : 'Tambahkan'} ${trans.name}">+</button>
            </div>
          `;

          li.querySelector('.btn-dec').addEventListener('click', () => bumpCustomCount(key, -1));
          li.querySelector('.btn-inc').addEventListener('click', () => bumpCustomCount(key, 1));
          rowsList.appendChild(li);
        });
      }

      // Restore focus if a stepper button was clicked
      if (activeFlower) {
        const selector = isInc
          ? `.btn-inc[data-flower="${activeFlower}"]`
          : isDec
            ? `.btn-dec[data-flower="${activeFlower}"]`
            : null;
        if (selector) {
          let btnToFocus = rowsList.querySelector(selector);
          // The "−" that just reached 0 disables itself — land on "+" instead of losing focus.
          if (isDec && btnToFocus && btnToFocus.disabled) {
            btnToFocus = rowsList.querySelector(`.btn-inc[data-flower="${activeFlower}"]`);
          }
          if (btnToFocus) btnToFocus.focus();
        }
      }
    }

    // Stem count line & reset button
    setText('#custom-stem-count', `${tot.stems} ${t.stemsWord}`);
    const resetBtn = document.getElementById('custom-reset-btn');
    if (resetBtn) {
      resetBtn.onclick = resetCustomCounts;
    }

    // Live Estimate Breakdown — below the stem minimum, no row shows a
    // concrete number beside a dashed total (UX-07): the whole list dashes
    // together, since none of these figures are final until it's valid.
    setText('#custom-est-label', t.estimateLabel);
    setText('#est-flowers-label', `${t.flowersLabel} (${tot.stems})`);
    setText('#est-flowers-val', tot.isValid ? formatRp(tot.flowersSubtotal) : '—');

    setText('#est-wrap-label', t.wrapFeeLabel);
    setText('#est-wrap-val', tot.isValid ? formatRp(tot.wrapFee) : '—');
    setText('#est-additions-label', t.additionsLabel);
    setText('#est-additions-val', tot.isValid ? formatRp(tot.additionsSubtotal) : '—');

    setText('#est-total-label', t.estTotalLabel);
    setText('#est-total-val', tot.isValid ? formatRp(tot.total) : '—');

    // Status hint & CTA button
    const hintEl = document.getElementById('custom-hint');
    const useBtn = document.getElementById('btn-use-custom');

    if (hintEl) {
      const hasExistingCustomLine = cart.some(l => l.type === 'custom');
      if (tot.isValid) {
        hintEl.textContent = hasExistingCustomLine ? `${t.okHint} ${t.customAddAnotherHint}` : t.okHint;
      } else {
        hintEl.textContent = interpolateRules(t.minHint);
      }
      hintEl.classList.toggle('has-warning', !tot.isValid);
    }

    if (useBtn) {
      useBtn.textContent = t.useCustomLabel;
      useBtn.disabled = !tot.isValid;
      useBtn.onclick = useCustomBouquet;
    }
  }

  /**
   * Render DIY Kit Teaser Band (Coming Later)
   */
  function renderKitTeaser() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const band = document.getElementById('kit-teaser-band');
    if (!band) return;

    if (!siteData.store.showKitTeaser) {
      band.style.display = 'none';
      return;
    }

    band.style.display = 'grid';
    setText('#kit-soon-eyebrow', t.kitSoonEyebrow);
    setText('#kit-soon-title', t.kitSoonTitle);
    setText('#kit-soon-body', t.kitSoonBody);
    setText('#kit-soon-secondary', t.kitSoonSecondary);

    const ctaLink = document.getElementById('kit-soon-cta');
    if (ctaLink) {
      if (isWhatsAppReady()) {
        const waNumber = (siteData.store.whatsappNumber || '').replace(/[^0-9]/g, '');
        const waWaitlistMsg = currentLang === 'en'
          ? (siteData.store.whatsappWaitlistEn || "Hello Alxanthia! I'm interested in the DIY kit — please let me know when it launches.")
          : (siteData.store.whatsappWaitlistId || 'Halo Alxanthia! Saya tertarik dengan kit DIY-nya — tolong kabari saya saat diluncurkan.');
        ctaLink.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waWaitlistMsg)}`;
        ctaLink.classList.remove('btn-disabled');
        ctaLink.removeAttribute('aria-disabled');
        ctaLink.textContent = t.kitSoonCta;
      } else {
        ctaLink.removeAttribute('href');
        ctaLink.classList.add('btn-disabled');
        ctaLink.setAttribute('aria-disabled', 'true');
        ctaLink.textContent = t.kitSoonCtaDisabled || (currentLang === 'en' ? 'Coming soon' : 'Segera hadir');
      }
    }
  }

  /**
   * Render How They're Made Section
   */
  const STEP_ICON_PATHS = [
    '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>',
    '<path d="M12 3C8 7 8 14 12 21C16 14 16 7 12 3Z"></path>',
    '<path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"></path><line x1="8" y1="12" x2="16" y2="12"></line>',
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>'
  ];

  function renderHowTo(t) {
    setText('#how-eyebrow', t.howEyebrow);
    setText('#how-title', t.howTitle);

    const stepsEl = document.getElementById('steps-grid');
    if (stepsEl && t.steps) {
      stepsEl.innerHTML = '';
      const stepPhotos = siteData.stepPhotos || [];
      t.steps.forEach((step, index) => {
        const div = document.createElement('div');
        div.className = 'step-card';
        const photo = stepPhotos[index];
        let photoHtml;
        if (photo && photo.src) {
          photoHtml = `
            <img class="step-photo" src="${photo.src}" ${photo.srcset ? `srcset="${photo.srcset}" sizes="(max-width: 600px) 45vw, 280px"` : ''} alt="${step[1]}" loading="lazy" width="480" height="480" />
          `;
        } else {
          const iconPath = STEP_ICON_PATHS[index] || STEP_ICON_PATHS[0];
          photoHtml = `
            <div class="step-photo-placeholder" role="img" aria-label="${step[1]}">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
              <span class="step-photo-label">${t.stepPhotoLabel || ''}</span>
            </div>
          `;
        }
        div.innerHTML = `
          ${photoHtml}
          <p class="step-kicker">${step[0]}</p>
          <h3 class="step-title">${step[1]}</h3>
          <p class="step-desc">${step[2]}</p>
        `;
        stepsEl.appendChild(div);
      });
    }
  }

  /**
   * Render Material Section
   */
  function renderMaterial(t) {
    setText('#mat-eyebrow', t.matEyebrow);
    setText('#mat-title', t.matTitle);
    setText('#mat-body', t.matBody);
    setAttr('#material-image', 'src', siteData.images.macro);
    setAttr('#material-image', 'alt', currentLang === 'en'
      ? 'Close-up of chenille stems showing the soft pile over a twisted wire core'
      : 'Tekstur dekat kawat bulu chenille memperlihatkan serat lembut pada inti kawat');
    if (siteData.images.macroSrcset) {
      setAttr('#material-image', 'srcset', siteData.images.macroSrcset);
      setAttr('#material-image', 'sizes', siteData.images.macroSizes || '(max-width: 768px) 90vw, 540px');
    }

    const pointsEl = document.getElementById('material-points');
    if (pointsEl && t.matPoints) {
      pointsEl.innerHTML = '';
      const roman = ['i', 'ii', 'iii', 'iv'];
      t.matPoints.forEach((pt, index) => {
        const li = document.createElement('li');
        li.className = 'material-point-item';
        li.innerHTML = `
          <span class="material-point-num">${roman[index] || (index + 1)}</span>
          <p class="material-point-text"><strong>${pt[0]}</strong> ${pt[1]}</p>
        `;
        pointsEl.appendChild(li);
      });
    }
  }

  /**
   * Cart line title/photo helper — resolves what a line represents for display.
   */
  function describeLine(line, t) {
    if (line.type === 'stem') {
      const flower = siteData.flowers[line.flowerKey];
      const trans = flower ? (flower[currentLang] || flower.en) : { name: line.flowerKey };
      return { title: trans.name, photoSrc: flower ? flower.photo : '', photoAlt: trans.name };
    }
    if (line.type === 'pot') {
      const pot = (siteData.miniPots || []).find(item => item.key === line.potKey);
      const trans = pot ? (pot[currentLang] || pot.en) : { name: line.potKey };
      return { title: trans.name, photoSrc: pot ? pot.photo : '', photoAlt: trans.name };
    }
    if (line.type === 'package') {
      const pkg = siteData.packages[line.pkgIndex];
      const title = t.pkgNames[line.pkgIndex] || `Package ${line.pkgIndex + 1}`;
      return { title, photoSrc: pkg ? (pkg.photoWebp || pkg.photo) : '', photoAlt: title };
    }
    // custom
    const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];
    const bouquetStems = order.reduce((sum, k) => sum + ((line.counts && line.counts[k]) || 0), 0);
    const title = `${t.customTitleShort} (${bouquetStems} ${t.stemsWord})`;
    const illustrativePkg = siteData.packages[1];
    return { title, photoSrc: illustrativePkg ? (illustrativePkg.photoWebp || illustrativePkg.photo) : '', photoAlt: title };
  }

  /**
   * Render every cart line as its own row: thumbnail, title, per-line price,
   * a qty stepper, and a remove control. Built with document.createElement /
   * textContent only — cart lines are the one region whose content is
   * derived from a growing data structure, so it stays out of innerHTML.
   */
  function buildCartLineEl(line, t, title, photoSrc, photoAlt, linePrice) {
    const li = document.createElement('li');
    li.className = 'cart-line';
    li.setAttribute('data-line-id', String(line.id));

    const thumb = document.createElement('img');
    thumb.className = 'cart-line-photo';
    thumb.src = photoSrc;
    thumb.alt = photoAlt;
    thumb.width = 56;
    thumb.height = 56;
    thumb.loading = 'lazy';
    li.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'cart-line-info';
    const titleEl = document.createElement('p');
    titleEl.className = 'cart-line-title';
    titleEl.textContent = title;
    const priceEl = document.createElement('p');
    priceEl.className = 'cart-line-price';
    priceEl.textContent = formatRp(linePrice);
    info.appendChild(titleEl);
    info.appendChild(priceEl);
    li.appendChild(info);

    const stepper = document.createElement('div');
    stepper.className = 'stepper-controls cart-line-stepper';
    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'btn-stepper btn-line-dec';
    decBtn.textContent = '−';
    decBtn.setAttribute('aria-label', (t.decreaseLineLabel || 'Decrease {item} quantity').replace('{item}', title));
    decBtn.addEventListener('click', () => bumpLineQty(line.id, -1));
    const countEl = document.createElement('span');
    countEl.className = 'stepper-count';
    countEl.setAttribute('aria-live', 'polite');
    countEl.textContent = String(line.qty);
    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'btn-stepper btn-line-inc';
    incBtn.textContent = '+';
    incBtn.setAttribute('aria-label', (t.increaseLineLabel || 'Increase {item} quantity').replace('{item}', title));
    incBtn.addEventListener('click', () => bumpLineQty(line.id, 1));
    stepper.appendChild(decBtn);
    stepper.appendChild(countEl);
    stepper.appendChild(incBtn);
    li.appendChild(stepper);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-line';
    removeBtn.setAttribute('aria-label', (t.removeLineLabel || 'Remove {item} from cart').replace('{item}', title));
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeLine(line.id));
    li.appendChild(removeBtn);

    return li;
  }

  /**
   * Update an existing cart-line <li> in place (title/price/qty/labels only).
   * The <img> node is left untouched — its src never changes for a line that
   * already existed, so reusing the node avoids a decode/repaint flicker on
   * every unrelated add/remove.
   */
  function updateCartLineEl(li, t, title, photoSrc, photoAlt, linePrice, qty) {
    const img = li.querySelector('.cart-line-photo');
    if (img) {
      if (img.src !== photoSrc) img.src = photoSrc;
      if (img.alt !== photoAlt) img.alt = photoAlt;
    }
    const titleEl = li.querySelector('.cart-line-title');
    if (titleEl) titleEl.textContent = title;
    const priceEl = li.querySelector('.cart-line-price');
    if (priceEl) priceEl.textContent = formatRp(linePrice);
    const countEl = li.querySelector('.stepper-count');
    if (countEl) countEl.textContent = String(qty);
    const decBtn = li.querySelector('.btn-line-dec');
    if (decBtn) decBtn.setAttribute('aria-label', (t.decreaseLineLabel || 'Decrease {item} quantity').replace('{item}', title));
    const incBtn = li.querySelector('.btn-line-inc');
    if (incBtn) incBtn.setAttribute('aria-label', (t.increaseLineLabel || 'Increase {item} quantity').replace('{item}', title));
    const removeBtn = li.querySelector('.btn-remove-line');
    if (removeBtn) removeBtn.setAttribute('aria-label', (t.removeLineLabel || 'Remove {item} from cart').replace('{item}', title));
  }

  function renderCartLines() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const linesEl = document.getElementById('cart-lines');
    if (!linesEl) return;

    if (cart.length === 0) {
      const alreadyEmpty = linesEl.children.length === 1 && linesEl.children[0].classList.contains('cart-line-empty');
      if (!alreadyEmpty) {
        while (linesEl.children.length > 0) linesEl.removeChild(linesEl.children[linesEl.children.length - 1]);
        const emptyLi = document.createElement('li');
        emptyLi.className = 'cart-line-empty';
        emptyLi.textContent = t.cartEmpty || (currentLang === 'en'
          ? 'Nothing selected yet. Pick a stem, a mini pot, or a bouquet below to start.'
          : 'Belum ada produk dipilih. Pilih tangkai, mini pot, atau buket di bawah untuk memulai.');
        linesEl.appendChild(emptyLi);
      }
      return;
    }

    // Drop the empty-state placeholder, if the cart just went from 0 to 1 item.
    if (linesEl.children.length === 1 && linesEl.children[0].classList.contains('cart-line-empty')) {
      linesEl.removeChild(linesEl.children[0]);
    }

    // Reuse existing <li> nodes for lines that already existed (matched by id)
    // instead of tearing down and rebuilding the whole list on every
    // add/remove/qty change — recreating every <img> in the cart each time
    // caused every existing line's thumbnail to flicker, not just the one
    // that changed, and also stole keyboard focus from stepper buttons.
    const existingById = new Map();
    Array.from(linesEl.children).forEach(li => {
      const id = li.getAttribute('data-line-id');
      if (id) existingById.set(id, li);
    });

    const cartTotals = computeCartTotals(cart);
    const seenIds = new Set();

    cart.forEach((line, index) => {
      const idStr = String(line.id);
      seenIds.add(idStr);
      const { title, photoSrc, photoAlt } = describeLine(line, t);
      const linePrice = cartTotals.lines[index].total;

      // Cart lines are only ever appended (new) or spliced out (removed) —
      // the relative order among surviving lines never changes — so an
      // existing line is updated in place and left exactly where it already
      // sits in the DOM; only a genuinely new line needs appending.
      const existingLi = existingById.get(idStr);
      if (existingLi) {
        updateCartLineEl(existingLi, t, title, photoSrc, photoAlt, linePrice, line.qty);
      } else {
        linesEl.appendChild(buildCartLineEl(line, t, title, photoSrc, photoAlt, linePrice));
      }
    });

    existingById.forEach((li, id) => {
      if (!seenIds.has(id)) linesEl.removeChild(li);
    });
  }

  /**
   * Build one compact selectable tile for the empty-cart order picker.
   * Shared shape for both flowers and packages so the markup lives in one place.
   */
  function renderPickerTile({ photoSrc, title, priceStr, ariaLabel, onSelect }) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'picker-tile';
    tile.setAttribute('aria-label', ariaLabel);

    const thumb = document.createElement('img');
    thumb.className = 'picker-tile-photo';
    thumb.src = photoSrc;
    thumb.alt = '';
    thumb.setAttribute('aria-hidden', 'true');
    thumb.width = 64;
    thumb.height = 64;
    thumb.loading = 'lazy';
    tile.appendChild(thumb);

    const info = document.createElement('span');
    info.className = 'picker-tile-info';
    const titleEl = document.createElement('span');
    titleEl.className = 'picker-tile-title';
    titleEl.textContent = title;
    const priceEl = document.createElement('span');
    priceEl.className = 'picker-tile-price';
    priceEl.textContent = priceStr;
    info.appendChild(titleEl);
    info.appendChild(priceEl);
    tile.appendChild(info);

    tile.addEventListener('click', onSelect);
    return tile;
  }

  /**
   * Render the inline order picker — visible only while the cart is empty,
   * so the header "Pesan" CTA and #order never land on a dead end (P1-08).
   */
  function renderOrderPicker() {
    const pickerEl = document.getElementById('order-picker');
    if (!pickerEl) return;

    if (cart.length > 0) {
      pickerEl.style.display = 'none';
      return;
    }
    pickerEl.style.display = 'block';

    const t = siteData.translations[currentLang] || siteData.translations.id;
    setText('#order-picker-label', t.orderPickerLabel || 'Pilih produk');
    setText('#order-picker-flowers-label', t.catOneTitle || 'Bunga jadi');
    setText('#order-picker-pots-label', t.catTwoTitle || 'Mini pot');
    setText('#order-picker-packages-label', t.catThreeTitle || 'Buket');

    const flowersEl = document.getElementById('order-picker-flowers');
    if (flowersEl) {
      while (flowersEl.children.length > 0) flowersEl.removeChild(flowersEl.children[flowersEl.children.length - 1]);
      (siteData.flowerOrder || []).forEach(key => {
        const flower = siteData.flowers[key];
        if (!flower) return;
        const trans = flower[currentLang] || flower.en;
        const priceStr = formatRp(flower.stemPrice || 55000);
        flowersEl.appendChild(renderPickerTile({
          photoSrc: flower.photo,
          title: trans.name,
          priceStr,
          ariaLabel: `${t.orderStemLabel} — ${trans.name}, ${priceStr}`,
          onSelect: () => selectStemOrder(key, true)
        }));
      });
    }

    const packagesEl = document.getElementById('order-picker-packages');
    if (packagesEl) {
      while (packagesEl.children.length > 0) packagesEl.removeChild(packagesEl.children[packagesEl.children.length - 1]);
      (siteData.packages || []).forEach((pkg, index) => {
        const title = t.pkgNames[index] || `Package ${index + 1}`;
        const priceStr = formatRp(pkg.price);
        packagesEl.appendChild(renderPickerTile({
          photoSrc: pkg.photoWebp || pkg.photo,
          title,
          priceStr,
          ariaLabel: `${t.pkgBtn} — ${title}, ${priceStr}`,
          onSelect: () => selectPackageOrder(index, true)
        }));
      });
    }

    const potsEl = document.getElementById('order-picker-pots');
    if (potsEl) {
      while (potsEl.children.length > 0) potsEl.removeChild(potsEl.children[potsEl.children.length - 1]);
      (siteData.miniPots || []).forEach(pot => {
        const trans = pot[currentLang] || pot.en;
        const priceStr = formatRp(pot.price);
        potsEl.appendChild(renderPickerTile({
          photoSrc: pot.photo,
          title: trans.name,
          priceStr,
          ariaLabel: `${t.miniPotBtn} — ${trans.name}, ${priceStr}`,
          onSelect: () => selectMiniPot(pot.key, true)
        }));
      });
    }

    // Hide a group's heading (and the group itself) when its grid ended up empty (UX-03)
    [
      ['order-picker-group-flowers', flowersEl],
      ['order-picker-group-pots', potsEl],
      ['order-picker-group-packages', packagesEl]
    ].forEach(([groupId, gridEl]) => {
      const groupEl = document.getElementById(groupId);
      if (groupEl) groupEl.style.display = (gridEl && gridEl.children.length > 0) ? '' : 'none';
    });
  }

  /**
   * Floating cart status pill: an always-on-top indicator of how many units
   * are in the cart, so an add/remove is visibly confirmed even though (per
   * P1-05) the page no longer auto-scrolls to the cart after the first item.
   * Hidden while the cart is empty; bumps briefly whenever the count changes.
   */
  function renderFloatingCartBadge(t) {
    const pill = document.getElementById('floating-cart-pill');
    if (!pill) return;
    const countEl = document.getElementById('floating-cart-count');
    const labelEl = document.getElementById('floating-cart-label');
    const n = cartUnitCount();

    if (countEl) countEl.textContent = String(n);
    if (labelEl) labelEl.textContent = t.floatingCartLabel || (currentLang === 'en' ? 'in cart' : 'di keranjang');
    pill.setAttribute('aria-label', fillTemplate(
      t.floatingCartAriaLabel || (currentLang === 'en' ? 'View cart — {n} item(s)' : 'Lihat keranjang — {n} item'),
      { n }
    ));

    const isVisible = n > 0;
    pill.classList.toggle('visible', isVisible);
    pill.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    pill.tabIndex = isVisible ? 0 : -1;

    if (isVisible && lastFloatingCartCount !== null && n !== lastFloatingCartCount) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        pill.classList.remove('bump');
        if (typeof pill.offsetWidth === 'number') void pill.offsetWidth;
        pill.classList.add('bump');
        setTimeout(() => pill.classList.remove('bump'), 400);
      }
    }
    lastFloatingCartCount = n;
  }

  /**
   * Render Order / Finishing Section
   */
  function renderOrderSection() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const cartHasSelection = cart.length > 0;

    renderOrderPicker();

    setText('#order-eyebrow', t.orderEyebrow);
    setText('#order-title', t.orderTitle);
    setText('#finish-label', t.finishLabel);
    setText('#wrap-intro', t.wrapIntro);
    setText('#card-label', t.cardLabel);
    setText('#card-note-hint', t.cardNote);
    setText('#selection-label', t.selectionLabel);
    setText('#includes-label', t.includesLabel);
    setText('#step3-label', t.continueLabel);
    setText('#btn-edit-selection', t.btnEditSelection || 'Ubah pilihan');
    setText('#summary-shipping-note', t.shippingExcl || '(belum termasuk ongkir)');

    // 2. Wrap colour selection chips (WAI-ARIA Radio Group pattern - A3)
    const wrapChipsEl = document.getElementById('wrap-chips');
    if (wrapChipsEl) {
      wrapChipsEl.innerHTML = '';
      const wraps = siteData.wraps || [];
      wraps.forEach((w, wIdx) => {
        const active = selectedWrap === w.key;
        const name = t.wrapNames[w.key] || w.key;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip-wrap ${active ? 'active' : ''}`;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
        btn.setAttribute('tabindex', active ? '0' : '-1');
        btn.setAttribute('data-wrap-key', w.key);
        btn.setAttribute('data-wrap-index', wIdx);
        btn.setAttribute('aria-label', `${name} ${t.wrapAriaSuffix || 'wrap paper'}`);
        btn.innerHTML = `
          <span class="wrap-swatch" style="background:${w.swatch}"></span>
          <span>${name}</span>
          ${active ? '<span class="wrap-check" aria-hidden="true">✓</span>' : ''}
        `;
        btn.addEventListener('click', () => {
          selectWrap(w.key);
          const activeChip = wrapChipsEl.querySelector('.chip-wrap.active');
          if (activeChip) activeChip.focus();
        });
        btn.addEventListener('keydown', (e) => {
          let targetIdx = -1;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            targetIdx = (wIdx + 1) % wraps.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            targetIdx = (wIdx - 1 + wraps.length) % wraps.length;
          }
          if (targetIdx >= 0) {
            selectWrap(wraps[targetIdx].key);
            const nextChip = wrapChipsEl.querySelector(`[data-wrap-index="${targetIdx}"]`);
            if (nextChip) nextChip.focus();
          }
        });
        wrapChipsEl.appendChild(btn);
      });
    }

    // 3. Message card: paid checkbox gates the textarea and its fee
    const messageCardPrice = siteData.messageCardPrice ?? 0;
    setText('#card-note-toggle-label', fillTemplate(t.cardCheckboxLabel || 'Tambahkan kartu ucapan (+{price})', { price: formatRp(messageCardPrice) }));
    const cardToggle = document.getElementById('card-note-toggle');
    const cardFieldsWrap = document.getElementById('card-note-fields');
    const noteInput = document.getElementById('card-note-input');
    const noteCounterEl = document.getElementById('card-note-counter');
    const updateNoteCounter = () => {
      if (noteCounterEl) noteCounterEl.textContent = fillTemplate(t.cardNoteCounter || '{n}/{max}', { n: orderNote.length, max: CARD_NOTE_MAX });
    };
    if (cardToggle) {
      cardToggle.checked = messageCardEnabled;
      cardToggle.onchange = event => {
        messageCardEnabled = !!event.target.checked;
        renderOrderSection();
        persistCart();
      };
    }
    if (cardFieldsWrap) cardFieldsWrap.hidden = !messageCardEnabled;
    if (noteInput) {
      noteInput.placeholder = t.cardPlaceholder;
      noteInput.maxLength = CARD_NOTE_MAX;
      if (noteInput.value !== orderNote) {
        noteInput.value = orderNote;
      }
      updateNoteCounter();
      noteInput.oninput = (e) => {
        // maxlength stops normal typing, but a paste can still exceed it —
        // clamp again here so the summary line and WhatsApp link never see
        // more than CARD_NOTE_MAX characters either (UX-15).
        orderNote = e.target.value.slice(0, CARD_NOTE_MAX);
        if (e.target.value !== orderNote) e.target.value = orderNote;
        updateNoteCounter();
        renderSummaryIncludes();
        updateWhatsAppLink();
        persistCart();
      };
    }

    // 3b. Recipient & card-sender name (optional, order-level — replaces the
    //     old gift-recipient fields that used to live in the checkout form).
    //     Only relevant once a card is actually being added.
    const giftDetailsFields = document.getElementById('gift-details-fields');
    if (giftDetailsFields) giftDetailsFields.hidden = !messageCardEnabled;
    setText('#gift-details-label', t.giftDetailsLabel);
    setText('#recipient-name-order-label', t.recipientNameOrderLabel);
    setText('#card-sender-order-label', t.cardSenderOrderLabel);
    const recipientNameInput = document.getElementById('order-recipient-name');
    if (recipientNameInput) {
      if (recipientNameInput.value !== orderRecipientName) recipientNameInput.value = orderRecipientName;
      recipientNameInput.oninput = (e) => {
        orderRecipientName = e.target.value.slice(0, 120);
        persistCart();
      };
    }
    const cardSenderInput = document.getElementById('order-card-sender-name');
    if (cardSenderInput) {
      if (cardSenderInput.value !== orderCardSenderName) cardSenderInput.value = orderCardSenderName;
      cardSenderInput.oninput = (e) => {
        orderCardSenderName = e.target.value.slice(0, 120);
        persistCart();
      };
    }

    // 4. Edit selection button: with multiple lines possible, this is a
    //    generic "go add or change something" affordance, not one line's editor.
    const editBtn = document.getElementById('btn-edit-selection');
    if (editBtn) {
      editBtn.style.display = cartHasSelection ? '' : 'none';
      editBtn.onclick = () => {
        scrollToSection('#collection');
      };
    }

    // 4b. Clear cart: empties every line in one action (vs. removing lines
    // one at a time), with a native confirm() since this is destructive.
    const clearCartBtn = document.getElementById('btn-clear-cart');
    if (clearCartBtn) {
      setText('#btn-clear-cart', t.clearCartLabel || 'Kosongkan keranjang');
      clearCartBtn.style.display = cartHasSelection ? '' : 'none';
      clearCartBtn.onclick = () => {
        if (!window.confirm(t.clearCartConfirm || 'Kosongkan keranjang?')) return;
        resetAllState();
        persistCart();
        renderAll();
        announceToScreenReader(t.clearCartAnnounce || 'Keranjang dikosongkan.');
      };
    }

    // 5. Cart-level price and includes (renderCartLines handles per-line display)
    renderCartLines();
    renderFloatingCartBadge(t);

    const cartTotals = computeCartTotals(cart);
    const cartInvalid = cartHasSelection && !cartTotals.isValid;
    const wrapName = t.wrapNames[selectedWrap] || t.wrapNames.kraft;

    const checkoutButton = document.getElementById('btn-checkout');
    if (checkoutButton) {
      const enabled = cartHasSelection && !cartInvalid;
      checkoutButton.disabled = !enabled;
      checkoutButton.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      checkoutButton.classList.toggle('btn-disabled', !enabled);
      const name = checkoutButton.querySelector('.channel-name');
      const action = checkoutButton.querySelector('.channel-action');
      if (name) name.textContent = enabled
        ? (currentLang === 'en' ? 'Review order' : 'Tinjau pesanan')
        : (currentLang === 'en' ? 'Choose a product first' : 'Pilih produk terlebih dahulu');
      if (action) action.textContent = enabled ? (currentLang === 'en' ? 'continue →' : 'lanjut →') : '';
    }

    const priceEl = document.getElementById('summary-price');
    if (priceEl) {
      if (siteData.store.showPrices && cartHasSelection) {
        priceEl.style.display = 'block';
        priceEl.textContent = formatRp(cartTotals.total);
      } else {
        priceEl.style.display = 'none';
      }
    }

    // Shipping note only makes sense once there's an actual price to qualify
    const shippingNoteEl = document.getElementById('summary-shipping-note');
    if (shippingNoteEl) {
      shippingNoteEl.style.display = (cartHasSelection && siteData.store.showPrices) ? '' : 'none';
    }

    // Custom minimum warning banner (interpolated - A2)
    const minWarningEl = document.getElementById('custom-min-warning-banner');
    if (minWarningEl) {
      if (cartInvalid) {
        minWarningEl.style.display = 'block';
        setText('#custom-min-warning-text', interpolateRules(t.customMinErrorSummary || t.minHint));
      } else {
        minWarningEl.style.display = 'none';
      }
    }

    // Render cart-level includes: wrap fee (if any), wrap colour, gift note
    // (Safe textContent assignment for gift notes & inputs - R02)
    function renderSummaryIncludes() {
      const includesListEl = document.getElementById('summary-includes-list');
      const includesLabelEl = document.getElementById('includes-label');
      if (includesLabelEl) {
        includesLabelEl.style.display = cartHasSelection ? '' : 'none';
      }
      if (includesListEl) {
        includesListEl.innerHTML = '';
        const allIncludes = [];
        if (cartHasSelection) {
          if (cartTotals.wrapFee > 0) {
            allIncludes.push(`${t.wrapFeeLabel}: ${formatRp(cartTotals.wrapFee)}`);
          }
          allIncludes.push(`${t.wrapLinePrefix}: ${wrapName}`);
          if (messageCardEnabled) {
            const feeText = cartTotals.messageCardFee > 0 ? ` (+${formatRp(cartTotals.messageCardFee)})` : '';
            allIncludes.push(orderNote.trim()
              ? `${t.cardLinePrefix}: "${orderNote.trim()}"${feeText}`
              : `${t.messageCardSelected}${feeText}`);
          }
        }

        allIncludes.forEach(text => {
          const li = document.createElement('li');
          li.className = 'summary-includes-item';
          const dot = document.createElement('span');
          dot.className = 'bullet-dot';
          dot.setAttribute('aria-hidden', 'true');
          dot.textContent = '·';
          const textSpan = document.createElement('span');
          textSpan.textContent = text;
          li.appendChild(dot);
          li.appendChild(textSpan);
          includesListEl.appendChild(li);
        });
      }
    }
    renderSummaryIncludes();

    // 6. Marketplace (Shopee) & WhatsApp Channel Buttons (R01, R03 & A1)
    const btnWhatsapp = document.getElementById('btn-whatsapp');
    const btnShopee = document.getElementById('btn-shopee');
    const mktNoticeBox = document.getElementById('marketplace-status-box');
    const offlineNoticeBox = document.getElementById('channels-disabled-box');

    const waReady = isWhatsAppReady();
    const shopeeActive = isShopeeReady();

    // Show neutral notice if all channels are paused/offline
    if (offlineNoticeBox) {
      if (!waReady && !shopeeActive) {
        offlineNoticeBox.style.display = 'block';
        offlineNoticeBox.textContent = t.channelsAllDisabledNotice || (currentLang === 'en'
          ? 'Online ordering is temporarily paused. Contact us via Instagram for availability inquiries.'
          : 'Pemesanan online saat ini sedang dijeda. Hubungi kami via Instagram untuk pertanyaan ketersediaan.');
      } else {
        offlineNoticeBox.style.display = 'none';
      }
    }

    if (btnShopee) {
      if (siteData.store.channels?.showShopee === false) {
        // .btn-shopee sets "display: flex !important", which a plain
        // style.display assignment cannot override — a dedicated class
        // beats it on specificity instead.
        btnShopee.classList.add('btn-shopee-hidden');
      } else if (!shopeeActive) {
        // The "coming soon" fact already lives in #marketplace-status-box
        // right below — showing a second, disabled Shopee button here just
        // repeats it (UX-28). The button returns the moment shopeeUrl is
        // configured, via the isShopeeReady() branch below.
        btnShopee.classList.add('btn-shopee-hidden');
      } else {
        btnShopee.classList.remove('btn-shopee-hidden');
        btnShopee.classList.remove('btn-disabled');
        btnShopee.removeAttribute('aria-disabled');
        btnShopee.href = siteData.store.shopeeUrl;
        const shopName = btnShopee.querySelector('.channel-name');
        if (shopName) shopName.textContent = t.shopeeLabel || 'Shopee';
        const shopSub = document.getElementById('shopee-channel-sub');
        if (shopSub) shopSub.textContent = t.shopeeSub || (currentLang === 'en' ? 'Official Store · Direct checkout' : 'Official Store · Belanja praktis');
        const shopAction = document.getElementById('shopee-channel-action');
        if (shopAction) shopAction.textContent = t.shopeeAction || (currentLang === 'en' ? 'visit store →' : 'buka toko →');

        if (!btnShopee.dataset.hasShopeeListener) {
          btnShopee.dataset.hasShopeeListener = 'true';
          btnShopee.addEventListener('click', () => {
            const announcer = document.getElementById('order-announcer');
            if (announcer) {
              announcer.textContent = currentLang === 'en'
                ? 'Opening Alxanthia official store on Shopee...'
                : 'Membuka toko resmi Alxanthia di Shopee...';
            }
          });
        }
      }
    }

    if (mktNoticeBox) {
      if (siteData.store.channels?.showShopee === false && !waReady) {
        mktNoticeBox.style.display = 'none';
      } else {
        mktNoticeBox.style.display = '';
        if (shopeeActive) {
          setText('#mkt-soon-tag', t.shopeeBadgeTag || (currentLang === 'en' ? 'Official Store' : 'Toko Resmi'));
          setText('#marketplace-status-text', waReady ? (t.marketplaceNoticeActive || t.marketplaceNotice) : (currentLang === 'en'
            ? 'Our official Shopee store is open for standard checkouts.'
            : 'Toko Shopee resmi kami siap melayani pesanan standar.'));
        } else {
          setText('#mkt-soon-tag', t.channelComingSoon || (currentLang === 'en' ? 'Coming Soon' : 'Segera Hadir'));
          setText('#marketplace-status-text', waReady ? (t.marketplaceNoticeComingSoon || t.channelUnavailableNotice) : (t.channelsAllDisabledNotice || 'Listing Shopee sedang disiapkan.'));
        }
      }
    }

    function updateWhatsAppLink() {
      if (!btnWhatsapp) return;

      if (siteData.store.channels?.showWhatsapp === false) {
        btnWhatsapp.style.display = 'none';
        return;
      }
      btnWhatsapp.style.display = 'flex';

      if (!waReady) {
        btnWhatsapp.removeAttribute('href');
        btnWhatsapp.setAttribute('aria-disabled', 'true');
        btnWhatsapp.classList.add('btn-disabled');
        const channelName = btnWhatsapp.querySelector('.channel-name');
        if (channelName) channelName.textContent = t.waLabel || 'WhatsApp';
        const channelAction = btnWhatsapp.querySelector('.channel-action');
        if (channelAction) channelAction.textContent = t.channelComingSoon || (currentLang === 'en' ? 'coming soon' : 'segera hadir');
        return;
      }

      if (!cartHasSelection) {
        btnWhatsapp.removeAttribute('href');
        btnWhatsapp.setAttribute('aria-disabled', 'true');
        btnWhatsapp.classList.add('btn-disabled');
        const channelName = btnWhatsapp.querySelector('.channel-name');
        if (channelName) channelName.textContent = t.emptySummaryPrompt || (currentLang === 'en' ? 'Please select a flower first' : 'Silakan pilih bunga terlebih dahulu');
        const channelAction = btnWhatsapp.querySelector('.channel-action');
        if (channelAction) channelAction.textContent = t.emptySummaryBtn || (currentLang === 'en' ? 'select above ↑' : 'pilih di atas ↑');
        return;
      }

      if (cartInvalid) {
        btnWhatsapp.removeAttribute('href');
        btnWhatsapp.setAttribute('aria-disabled', 'true');
        btnWhatsapp.classList.add('btn-disabled');
        const minStemsCount = siteData.minStems ?? 3;
        const channelName = btnWhatsapp.querySelector('.channel-name');
        if (channelName) channelName.textContent = (t.customMinHint || (currentLang === 'en' ? 'Minimum {n} stems' : 'Minimal {n} tangkai')).replace('{n}', minStemsCount);
        const channelAction = btnWhatsapp.querySelector('.channel-action');
        if (channelAction) channelAction.textContent = t.configureStemsCta || (currentLang === 'en' ? 'configure ↑' : 'atur ↑');
        return;
      }

      btnWhatsapp.classList.remove('btn-disabled');
      btnWhatsapp.removeAttribute('aria-disabled');

      const waNumber = (siteData.store.whatsappNumber || '').replace(/[^0-9]/g, '');
      const wrapTxt = `${t.wrapLinePrefix}: ${wrapName}. `;
      const cardTxt = messageCardEnabled && orderNote.trim() ? `${t.cardLinePrefix}: "${orderNote.trim()}". ` : '';

      let waMsg = '';
      if (cart.length === 1) {
        // A single line still uses its exact per-mode owner template.
        const line = cart[0];
        const template = siteData.store.whatsappTemplates?.[currentLang]?.[line.type];
        const hasTemplate = typeof template === 'string' && template.trim() !== '';
        if (line.type === 'custom') {
          const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];
          const presentKeys = order.filter(k => (line.counts[k] || 0) > 0);
          const flowerNames = presentKeys.map(k => {
            const fl = siteData.flowers[k];
            return `${line.counts[k]} × ${(fl ? (fl[currentLang] || fl.en) : { name: k }).name}`;
          });
          const additionNames = (siteData.customAdditions || [])
            .filter(addition => line.additions && line.additions[addition.key] > 0)
            .map(addition => {
              const count = line.additions[addition.key];
              const name = (addition[currentLang] || addition.en).name;
              return count > 1 ? `${count} × ${name}` : name;
            });
          const customItems = [...flowerNames, ...additionNames.map(item => `${t.additionsLabel}: ${item}`)];
          const flowerList = customItems.map(item => `• ${item}`).join('\n');
          const vars = {
            items: flowerNames.join(', '), total: formatRp(cartTotals.total),
            stems: cartTotals.stems, itemList: flowerList, wrapInfo: wrapTxt, cardInfo: cardTxt
          };
          if (hasTemplate) {
            waMsg = fillTemplate(template, vars);
          } else if (currentLang === 'en') {
            waMsg = `Hello Alxanthia! I would like to order a Custom Bouquet (${cartTotals.stems} stems, estimated ${formatRp(cartTotals.total)}, excludes delivery fee):\n${flowerList}\n${wrapTxt}${cardTxt}Can this be arranged?`;
          } else {
            waMsg = `Halo Alxanthia! Saya ingin memesan Buket Custom (${cartTotals.stems} tangkai, estimasi ${formatRp(cartTotals.total)}, belum termasuk ongkir):\n${flowerList}\n${wrapTxt}${cardTxt}Apakah bisa dibuatkan?`;
          }
        } else if (line.type === 'package') {
          const pkg = siteData.packages[line.pkgIndex];
          const { title: pkgTitle } = describeLine(line, t);
          const items = `${pkgTitle} (${pkg.stems} ${currentLang === 'en' ? 'stems' : 'tangkai'})`;
          const vars = {
            items, total: formatRp(cartTotals.total), stems: pkg.stems,
            itemList: `• ${items}`, wrapInfo: wrapTxt, cardInfo: cardTxt
          };
          if (hasTemplate) {
            waMsg = fillTemplate(template, vars);
          } else if (currentLang === 'en') {
            waMsg = `Hello Alxanthia! I would like to order ${items} — ${formatRp(cartTotals.total)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`;
          } else {
            waMsg = `Halo Alxanthia! Saya ingin memesan ${items} — ${formatRp(cartTotals.total)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
          }
        } else if (line.type === 'pot') {
          const pot = (siteData.miniPots || []).find(item => item.key === line.potKey);
          const potName = pot ? (pot[currentLang] || pot.en).name : line.potKey;
          const items = `${line.qty} × ${potName}`;
          waMsg = currentLang === 'en'
            ? `Hello Alxanthia! I would like to order ${items} — Total ${formatRp(cartTotals.total)} (excludes delivery fee). ${cardTxt}Is it available?`
            : `Halo Alxanthia! Saya ingin memesan ${items} — Total ${formatRp(cartTotals.total)} (belum termasuk ongkir). ${cardTxt}Apakah masih tersedia?`;
        } else {
          // stem
          const flower = siteData.flowers[line.flowerKey];
          const flTrans = flower[currentLang] || flower.en;
          const items = `${line.qty} × ${flTrans.name} ${t.stemSuffix}`;
          const vars = {
            items, total: formatRp(cartTotals.total), stems: line.qty,
            itemList: `• ${items}`, wrapInfo: wrapTxt, cardInfo: cardTxt
          };
          if (hasTemplate) {
            waMsg = fillTemplate(template, vars);
          } else if (currentLang === 'en') {
            waMsg = `Hello Alxanthia! I would like to order ${line.qty} × ${flTrans.name} ${t.stemSuffix} — Total ${formatRp(cartTotals.total)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`;
          } else {
            waMsg = `Halo Alxanthia! Saya ingin memesan ${line.qty} × ${flTrans.name} ${t.stemSuffix} — Total ${formatRp(cartTotals.total)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
          }
        }
      } else {
        // Multiple lines: enumerate every line (P1-06) — no per-mode owner
        // template covers a mixed cart, so this uses one consistent shape.
        const itemList = cart.map((line, idx) => {
          const { title } = describeLine(line, t);
          const lineTotal = cartTotals.lines[idx].total;
          const qtyPrefix = line.type === 'custom' ? '' : `${line.qty} × `;
          return `• ${qtyPrefix}${title} — ${formatRp(lineTotal)}`;
        }).join('\n');
        waMsg = currentLang === 'en'
          ? `Hello Alxanthia! I would like to order:\n${itemList}\nTotal ${formatRp(cartTotals.total)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`
          : `Halo Alxanthia! Saya ingin memesan:\n${itemList}\nTotal ${formatRp(cartTotals.total)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
      }

      btnWhatsapp.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
      const channelName = btnWhatsapp.querySelector('.channel-name');
      if (channelName) channelName.textContent = t.waLabel || 'WhatsApp — Konfirmasi Pesanan';
      const channelAction = btnWhatsapp.querySelector('.channel-action');
      if (channelAction) channelAction.textContent = t.messageLabel || 'chat →';
    }
    updateWhatsAppLink();

    setText('#order-note', t.orderNote);

    // 7. Update sticky mobile order bar (R04)
    if (!cartHasSelection) {
      setText('#sticky-order-title', 'Alxanthia Studio');
      setText('#sticky-order-price', t.stickyPrompt || (currentLang === 'en' ? 'Choose flowers' : 'Pilih bunga'));
      setText('#sticky-order-cta', `${t.ctaBrowse || (currentLang === 'en' ? 'Browse' : 'Lihat bunga')} ↓`);
    } else if (cartInvalid) {
      const minStemsCount = siteData.minStems ?? 3;
      const minPrompt = (t.minStemsRequired || (currentLang === 'en' ? 'Min. {n} stems' : 'Min. {n} tangkai')).replace('{n}', minStemsCount);
      setText('#sticky-order-title', `${t.customTitleShort} (${cartTotals.stems})`);
      setText('#sticky-order-price', minPrompt);
      setText('#sticky-order-cta', t.configureStemsCta || (currentLang === 'en' ? 'Configure stems ↑' : 'Atur bunga ↑'));
    } else {
      setText('#sticky-order-title', `${cartTotals.stems} ${t.stemsWord}`);
      setText('#sticky-order-price', formatRp(cartTotals.total));
      setText('#sticky-order-cta', `${t.navOrder || (currentLang === 'en' ? 'Order' : 'Pesan')} →`);
    }

    if (refreshStickyVisibility) refreshStickyVisibility();
  }

  /**
   * Render FAQ Section (Accessible Accordion)
   */
  function renderFaq(t) {
    setText('#faq-eyebrow', t.faqEyebrow);
    setText('#faq-title', t.faqTitle);

    const faqAccordion = document.getElementById('faq-accordion');
    if (faqAccordion && t.faqs) {
      faqAccordion.innerHTML = '';
      t.faqs.forEach((item, index) => {
        const details = document.createElement('details');
        details.className = 'faq-item';
        if (index === 0) details.open = true;
        details.innerHTML = `
          <summary class="faq-summary">
            <h3 class="faq-question">${item[0]}</h3>
            <span class="faq-icon" aria-hidden="true"></span>
          </summary>
          <div class="faq-answer-wrapper">
            <div class="faq-answer">
              <p>${item[1]}</p>
            </div>
          </div>
        `;
        faqAccordion.appendChild(details);
      });
    }
  }

  /**
   * Render Footer
   */
  function renderFooter(t) {
    setText('#footer-care', t.footerCare);
    setText('#footer-copyright', t.copyright || '© 2026 Alxanthia');
    setText('#footer-tagline', siteData.store.tagline || '');
    setText('#footer-contact-title', t.footerContactTitle || 'Kontak');
    setText('#footer-help-title', t.footerHelpTitle || 'Bantuan');
    setText('#footer-store-title', t.footerStoreTitle || 'Toko');
    setText('#footer-link-order', t.footerOrderLink || 'Cara pesan');
    setText('#footer-payment-note', t.footerPaymentNote || 'Pembayaran dikonfirmasi via WhatsApp');

    setAttr('#footer-link-ig', 'href', siteData.store.instagramUrl || '#');

    const waFooterLink = document.getElementById('footer-link-whatsapp');
    if (waFooterLink) {
      setText(waFooterLink, t.footerWhatsappLabel || 'WhatsApp');
      if (isWhatsAppReady()) {
        const waNumber = (siteData.store.whatsappNumber || '').replace(/[^0-9]/g, '');
        waFooterLink.href = `https://wa.me/${waNumber}`;
        waFooterLink.removeAttribute('aria-disabled');
      } else {
        waFooterLink.removeAttribute('href');
        waFooterLink.setAttribute('aria-disabled', 'true');
      }
    }

    const emailRow = document.getElementById('footer-email-row');
    const emailLink = document.getElementById('footer-link-email');
    const email = (siteData.store.email || '').trim();
    if (emailRow && emailLink) {
      if (email) {
        emailLink.href = `mailto:${email}`;
        emailLink.textContent = email;
        emailRow.hidden = false;
      } else {
        emailRow.hidden = true;
      }
    }

    const addressRow = document.getElementById('footer-address-row');
    const address = (siteData.store.address || '').trim();
    if (addressRow) {
      if (address) {
        addressRow.textContent = address;
        addressRow.hidden = false;
      } else {
        addressRow.hidden = true;
      }
    }

    const shopLink = document.getElementById('footer-link-shopee');
    if (shopLink) {
      const isShopeeActive = siteData.store.channels?.showShopee !== false &&
        !!siteData.store.shopeeUrl &&
        siteData.store.shopeeUrl.trim() !== '' &&
        siteData.store.shopeeUrl !== 'https://shopee.co.id' &&
        siteData.store.shopeeUrl !== '#';

      if (siteData.store.channels?.showShopee === false) {
        shopLink.style.display = 'none';
      } else if (isShopeeActive) {
        shopLink.style.display = '';
        shopLink.href = siteData.store.shopeeUrl;
        shopLink.textContent = t.shopeeLabel || 'Shopee';
        shopLink.removeAttribute('aria-disabled');
      } else {
        shopLink.style.display = '';
        shopLink.removeAttribute('href');
        shopLink.setAttribute('aria-disabled', 'true');
        shopLink.innerHTML = `Shopee <small class="footer-soon-tag">(${t.channelComingSoon || t.marketplaceComingSoonBadge || 'segera hadir'})</small>`;
      }
    }
  }

  /**
   * Master Render Function
   */
  function renderAll() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    renderHeader(t);
    renderCategoryNav(t);
    renderHero(t);
    renderTrustBar(t);
    renderCollection(t);
    renderMiniPots(t);
    renderBouquetsUI();
    renderOrderSection();
    renderHowTo(t);
    renderMaterial(t);
    renderFaq(t);
    renderFooter(t);
  }

  function updateLockA11y(isLocked) {
    const mainContent = document.getElementById('main-content');
    const header = document.querySelector('.site-header');
    const footer = document.querySelector('.site-footer');
    const stickyBar = document.getElementById('sticky-order-bar');
    const skipLink = document.querySelector('.skip-link');

    // The skip-link sits before the lock screen in the DOM (so it stays
    // reachable at the very top when unlocked); while locked it's part of
    // the page the curtain exists to hide, so it must be caught here too,
    // or Tab escapes the passcode field into it (UX-19).
    [mainContent, header, footer, stickyBar, skipLink].forEach(el => {
      if (el) {
        if (isLocked) {
          el.setAttribute('aria-hidden', 'true');
          if ('inert' in el) el.inert = true;
        } else {
          el.removeAttribute('aria-hidden');
          if ('inert' in el) el.inert = false;
        }
      }
    });

    document.body.classList.toggle('lock-scroll-off', isLocked);
  }

  /**
   * Setup Passcode Gatekeeper
   */
  function setupAuth() {
    const lockScreen = document.getElementById('lock-screen');
    const lockForm = document.getElementById('lock-form');
    const passInput = document.getElementById('passcode-input');
    const lockError = document.getElementById('lock-error');
    const relockBtn = document.getElementById('btn-lock-site');

    const authConfig = siteData.auth || { enabled: true, passcode: '22062024' };
    // Single source of truth for the expected passcode (ALX-22) — computed
    // once here, not re-read with its own fallback at every comparison site,
    // so rotating it is one edit instead of three.
    const expectedPasscode = String(authConfig.passcode || '22062024').trim();

    if (!authConfig.enabled) {
      if (lockScreen) lockScreen.classList.add('unlocked');
      if (relockBtn) relockBtn.style.display = 'none';
      updateLockA11y(false);
      return;
    }

    try {
      // No `?unlock=` query-parameter branch here by design: it placed the
      // passcode into browser history and outbound Referer headers (ALX-22).
      if (localStorage.getItem(AUTH_KEY) === 'true') {
        if (lockScreen) {
          lockScreen.classList.add('unlocked');
          lockScreen.style.display = 'none';
        }
        updateLockA11y(false);
      } else {
        if (lockScreen) {
          lockScreen.style.display = 'flex';
          lockScreen.classList.remove('unlocked');
        }
        updateLockA11y(true);
        if (passInput) passInput.focus();
      }
    } catch (e) {
      updateLockA11y(false);
    }

    if (lockForm) {
      lockForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const entered = (passInput ? passInput.value : '').trim();

        if (entered === expectedPasscode) {
          try {
            localStorage.setItem(AUTH_KEY, 'true');
          } catch (err) {}
          if (lockError) lockError.textContent = '';
          if (lockScreen) {
            lockScreen.classList.add('unlocked');
            setTimeout(() => {
              if (lockScreen.classList.contains('unlocked')) {
                lockScreen.style.display = 'none';
              }
            }, 360);
          }
          updateLockA11y(false);
        } else {
          if (lockError) {
            lockError.textContent = currentLang === 'en' ? 'Incorrect passcode. Try again.' : 'Kata sandi salah. Coba lagi.';
          }
          if (passInput) {
            passInput.value = '';
            passInput.focus();
          }
        }
      });
    }

    if (relockBtn) {
      relockBtn.addEventListener('click', function (e) {
        e.preventDefault();
        // Low priority, optional (UX-31): a stray click during staging
        // review would otherwise lock out the viewer mid-demo with no
        // way back. The auth.enabled gate that hides this button entirely
        // at public launch is untouched.
        const confirmMsg = currentLang === 'en'
          ? 'Lock the site again? You will need the passcode to view it.'
          : 'Kunci situs ini lagi? Anda memerlukan kata sandi untuk membukanya kembali.';
        if (!window.confirm(confirmMsg)) return;
        try {
          localStorage.removeItem(AUTH_KEY);
        } catch (err) {}
        if (lockScreen) {
          lockScreen.style.display = 'flex';
          lockScreen.classList.remove('unlocked');
          updateLockA11y(true);
          if (passInput) {
            passInput.value = '';
            passInput.focus();
          }
        }
      });
    }

    // Belt-and-suspenders on top of inert: with everything else on the page
    // excluded, some browsers let Tab land on <body> itself at the wrap
    // boundary instead of cycling straight back to the passcode field.
    // Trap the wrap-around explicitly so Tab only ever moves between the
    // passcode input and the unlock button while locked (UX-19).
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !lockScreen || lockScreen.classList.contains('unlocked')) return;
      const focusables = Array.from(lockScreen.querySelectorAll('input, button, select, textarea, a[href]'))
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /**
   * Setup Sticky Mobile Order Bar
   */
  function initStickyOrderBar() {
    const stickyBar = document.getElementById('sticky-order-bar');
    const heroEl = document.getElementById('hero');
    const orderEl = document.getElementById('order');
    const footerEl = document.getElementById('site-footer') || document.querySelector('.site-footer');
    if (!stickyBar || !heroEl || !orderEl) return;

    let heroVisible = true;
    let orderVisible = false;
    let footerVisible = false;

    function updateSticky() {
      const focusInside = stickyBar.contains(document.activeElement);
      if (focusInside || (cart.length > 0 && !heroVisible && !orderVisible && !footerVisible)) {
        stickyBar.classList.add('visible');
        stickyBar.setAttribute('aria-hidden', 'false');
      } else {
        stickyBar.classList.remove('visible');
        stickyBar.setAttribute('aria-hidden', 'true');
      }
    }

    refreshStickyVisibility = updateSticky;

    stickyBar.addEventListener('focusin', updateSticky);
    stickyBar.addEventListener('focusout', () => {
      setTimeout(updateSticky, 50);
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.target === heroEl) {
            heroVisible = entry.isIntersecting;
          } else if (entry.target === orderEl) {
            orderVisible = entry.isIntersecting;
          } else if (entry.target === footerEl) {
            footerVisible = entry.isIntersecting;
          }
        });
        updateSticky();
      }, { threshold: 0.05 });

      observer.observe(heroEl);
      observer.observe(orderEl);
      if (footerEl) observer.observe(footerEl);
    } else {
      window.addEventListener('scroll', () => {
        const heroRect = heroEl.getBoundingClientRect();
        const orderRect = orderEl.getBoundingClientRect();
        heroVisible = heroRect.bottom > 64;
        orderVisible = orderRect.top < window.innerHeight && orderRect.bottom > 0;
        if (footerEl) {
          const footerRect = footerEl.getBoundingClientRect();
          footerVisible = footerRect.top < window.innerHeight && footerRect.bottom > 0;
        }
        updateSticky();
      }, { passive: true });
    }

    const cta = document.getElementById('sticky-order-cta');
    if (cta) {
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        if (cart.length === 0) {
          scrollToSection('#collection');
        } else if (activeLine()?.type === 'custom' && !computeCartTotals(cart).isValid) {
          scrollToSection('#custom-builder');
        } else {
          scrollToSection('#order');
        }
      });
    }
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    const btnId = document.getElementById('lang-id');
    const btnEn = document.getElementById('lang-en');

    if (btnId) btnId.addEventListener('click', () => setLanguage('id'));
    if (btnEn) btnEn.addEventListener('click', () => setLanguage('en'));

    // Category Tabs Filter Navigation
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const cat = tab.getAttribute('data-category');
        setCategory(cat);
      });
    });

    // Custom Builder Mobile Collapsible Toggle
    const toggleCustomBtn = document.getElementById('btn-toggle-custom');
    const customBody = document.getElementById('custom-builder-body');
    const customPanel = document.getElementById('custom-builder');
    if (toggleCustomBtn && customBody) {
      toggleCustomBtn.addEventListener('click', () => {
        const isExpanded = toggleCustomBtn.getAttribute('aria-expanded') !== 'false';
        toggleCustomBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        customBody.classList.toggle('collapsed', isExpanded);
        if (customPanel) {
          customPanel.classList.toggle('is-collapsed', isExpanded);
        }
        const toggleText = document.getElementById('custom-toggle-text');
        if (toggleText) {
          const t = siteData.translations[currentLang] || siteData.translations.id;
          toggleText.textContent = isExpanded
            ? (t.customBuilderToggleOpen || 'Susun buket custom sendiri ↓')
            : (t.customBuilderToggleClose || 'Tutup penyusun custom ↑');
        }
      });
    }

    // Mobile Navigation Toggle
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navScrim = document.getElementById('nav-scrim');

    // While the menu is open, the rest of the page sits behind a scrim and
    // must not be reachable by Tab — mirrors updateLockA11y()'s technique
    // for the lock curtain (UX-18).
    function setBehindMenuInert(isInert) {
      const mainContent = document.getElementById('main-content');
      const footer = document.querySelector('.site-footer');
      const stickyBar = document.getElementById('sticky-order-bar');
      [mainContent, footer, stickyBar].forEach(el => {
        if (el && 'inert' in el) el.inert = isInert;
      });
    }

    function openNavMenu() {
      if (!navMenu || !navToggle) return;
      navMenu.classList.add('open');
      if (navScrim) navScrim.classList.add('visible');
      document.body.classList.add('nav-open');
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', currentLang === 'en' ? 'Close navigation menu' : 'Tutup menu navigasi');
      setBehindMenuInert(true);
      const firstLink = navMenu.querySelector('.nav-link');
      if (firstLink) firstLink.focus();
    }

    function closeNavMenu() {
      if (!navMenu || !navToggle) return;
      navMenu.classList.remove('open');
      if (navScrim) navScrim.classList.remove('visible');
      document.body.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', currentLang === 'en' ? 'Open navigation menu' : 'Buka menu navigasi');
      setBehindMenuInert(false);
    }

    if (navToggle && navMenu) {
      navToggle.addEventListener('click', () => {
        if (navMenu.classList.contains('open')) {
          closeNavMenu();
        } else {
          openNavMenu();
        }
      });
    }

    if (navScrim) {
      navScrim.addEventListener('click', closeNavMenu);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu && navMenu.classList.contains('open')) {
        closeNavMenu();
        if (navToggle) navToggle.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (navMenu && navMenu.classList.contains('open')) {
        const header = document.querySelector('.site-header');
        if (header && !header.contains(e.target) && (!navScrim || !navScrim.contains(e.target))) {
          closeNavMenu();
        }
      }
    });

    document.querySelectorAll('.nav-link, .nav-cta, .nav-cta-mobile').forEach(link => {
      link.addEventListener('click', (e) => {
        closeNavMenu();
        const href = link.getAttribute('href');
        if (href === '#collection') {
          e.preventDefault();
          if (activeCategory === 'bouquets' || activeCategory === 'custom') {
            setCategory('stems', false);
          }
          scrollToSection('#collection-overview');
        } else if (href === '#bouquets') {
          e.preventDefault();
          if (activeCategory === 'stems') {
            setCategory('bouquets', false);
          }
          scrollToSection('#bouquets');
        }
      });
    });

    const ctaBrowse = document.getElementById('cta-browse');
    if (ctaBrowse) {
      ctaBrowse.addEventListener('click', (e) => {
        e.preventDefault();
        if (activeCategory === 'bouquets' || activeCategory === 'custom') {
          setCategory('stems', false);
        }
        scrollToSection('#collection-overview');
      });
    }

    const ctaBouquets = document.getElementById('cta-bouquets');
    if (ctaBouquets) {
      ctaBouquets.addEventListener('click', (e) => {
        e.preventDefault();
        if (activeCategory === 'stems') {
          setCategory('bouquets', false);
        }
        scrollToSection('#bouquets');
      });
    }

    // Close on desktop resize
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 769 && navMenu && navMenu.classList.contains('open')) {
        closeNavMenu();
      }
    });

    const brandLink = document.getElementById('brand-link');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        closeNavMenu();
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      });
    }

    const faqAccordion = document.getElementById('faq-accordion');
    if (faqAccordion) {
      faqAccordion.addEventListener('click', (e) => {
        const summary = e.target.closest('.faq-summary');
        if (!summary) return;
        const details = summary.parentElement;
        if (!details || details.tagName !== 'DETAILS') return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;

        if (details.open && !details.classList.contains('is-closing')) {
          e.preventDefault();
          details.classList.add('is-closing');
          setTimeout(() => {
            details.open = false;
            details.classList.remove('is-closing');
          }, 220);
        }
      });
    }

    // Product Image Inspector Modal (P3.11 & R05)
    const imageModal = document.getElementById('image-modal');
    const imageModalClose = document.getElementById('image-modal-close');
    if (imageModalClose) {
      imageModalClose.addEventListener('click', closeImageModal);
    }
    if (imageModal) {
      imageModal.addEventListener('close', restoreModalFocus);
      imageModal.addEventListener('cancel', restoreModalFocus);
      imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
          closeImageModal();
        }
      });
    }

    const btnWhatsapp = document.getElementById('btn-whatsapp');
    if (btnWhatsapp) {
      btnWhatsapp.addEventListener('click', (e) => {
        if (btnWhatsapp.getAttribute('aria-disabled') === 'true') {
          e.preventDefault();
          if (cart.length === 0) {
            scrollToSection('#collection');
          } else if (activeLine()?.type === 'custom' && !computeCartTotals(cart).isValid) {
            scrollToSection('#custom-builder');
          }
        }
      });
    }

    const floatingCartPill = document.getElementById('floating-cart-pill');
    if (floatingCartPill) {
      floatingCartPill.addEventListener('click', () => {
        scrollToSection('#order', '.summary-box');
      });
    }

    initStickyOrderBar();
  }

  /**
   * Reduced-Motion Listener
   */
  function setupReducedMotionListener() {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    function handleMotionChange(e) {
      if (e.matches) {
        document.querySelectorAll('.reveal-item').forEach(el => {
          el.classList.add('revealed');
        });
      }
    }
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', handleMotionChange);
    } else if (motionQuery.addListener) {
      motionQuery.addListener(handleMotionChange);
    }
  }

  /**
   * DEV-10: safe (no address/phone/email/card-text) recent-order record so a
   * customer who reloads or closes the tab can still find their reference and
   * the WhatsApp link. Never store anything the acknowledgement/privacy notice
   * doesn't already cover as "kept for this order".
   */
  const RECENT_ORDER_KEY = 'alxanthia_recent_order_v1';

  function saveRecentOrder() {
    if (!checkoutAttempt || !checkoutAttempt.submitted) return;
    try {
      localStorage.setItem(RECENT_ORDER_KEY, JSON.stringify({
        reference: checkoutAttempt.reference,
        idempotencyKey: checkoutAttempt.idempotencyKey,
        timestamp: Date.now(),
        orderSummary: checkoutAttempt.state.items.join('; '),
        total: checkoutAttempt.state.estimatedProductTotal,
        language: checkoutAttempt.state.language,
        waUrl: checkoutAttempt.waUrl || ''
      }));
    } catch (e) {}
  }

  function loadRecentOrder() {
    try {
      const raw = localStorage.getItem(RECENT_ORDER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.reference) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clearRecentOrder() {
    try { localStorage.removeItem(RECENT_ORDER_KEY); } catch (e) {}
  }

  function renderRecentOrderBanner() {
    const banner = document.getElementById('recent-order-banner');
    if (!banner) return;
    const record = loadRecentOrder();
    // Show whenever a stored record exists — the checkout dialog sits on top
    // of this banner anyway, so there is no redundancy to avoid by also
    // checking in-memory checkoutAttempt state (that used to leave the
    // banner hidden until a full page reload, since checkoutAttempt.submitted
    // stays true for the rest of the session after a successful order).
    if (!record) {
      banner.hidden = true;
      return;
    }
    setText('#recent-order-text', ck('checkoutRecentOrderBanner', { reference: record.reference }));
    setText('#recent-order-view', ck('checkoutRecentOrderLink'));
    setAttr('#recent-order-dismiss', 'aria-label', ck('checkoutRecentOrderDismiss'));
    banner.hidden = false;
  }

  /**
   * DEV-14: a single map from visible dialog step to its focusable heading and
   * the modal's aria-labelledby target — used on every review/form/success
   * transition so the dialog's accessible name always matches what's on screen.
   */
  const CHECKOUT_STEPS = {
    'checkout-review': { headingId: 'checkout-title', stepNumber: 1, footerId: 'checkout-review-footer' },
    'checkout-form-step': { headingId: 'checkout-form-title', stepNumber: 2, footerId: 'checkout-form-footer' },
    'checkout-success': { headingId: 'checkout-success-title', stepNumber: 2, footerId: null }
  };
  // DEV-16: each step's total+actions bar is a real, non-scrolling footer
  // region (see .checkout-dialog-footer) rather than position:sticky inside
  // the scrollable content, which used to render on top of later fields.
  const CHECKOUT_FOOTER_IDS = ['checkout-review-footer', 'checkout-form-footer'];

  function showCheckoutStep(stepId) {
    closeDatePicker();
    Object.keys(CHECKOUT_STEPS).forEach(id => {
      const section = document.getElementById(id);
      if (section) section.hidden = id !== stepId;
    });
    const meta = CHECKOUT_STEPS[stepId];
    CHECKOUT_FOOTER_IDS.forEach(footerId => {
      const footer = document.getElementById(footerId);
      if (footer) footer.hidden = !meta || meta.footerId !== footerId;
    });
    const modal = document.getElementById('checkout-modal');
    if (modal && meta) modal.setAttribute('aria-labelledby', meta.headingId);
    const indicator = document.getElementById('checkout-step-indicator');
    if (indicator) {
      indicator.textContent = stepId === 'checkout-success'
        ? ck('checkoutStepSuccess')
        : ck('checkoutStepIndicator', { step: meta.stepNumber, total: 2 });
    }
    const heading = meta ? document.getElementById(meta.headingId) : null;
    if (heading && typeof heading.focus === 'function') heading.focus();
  }

  /**
   * DEV-09: while a submission is in flight, close/edit/back controls are
   * disabled and the dialog's native `cancel` event (Esc key) is suppressed so
   * an order can't be silently orphaned mid-request.
   */
  function setCheckoutSubmitGuard(isSubmitting) {
    if (checkoutAttempt) checkoutAttempt.isSubmitting = isSubmitting;
    ['checkout-close', 'checkout-edit', 'checkout-back-to-review', 'checkout-continue'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = isSubmitting;
    });
    const notice = document.getElementById('form-error');
    if (isSubmitting && notice && !notice.textContent) notice.textContent = '';
  }

  /**
   * Identity of "what would be submitted right now" — used both to decide
   * whether a review reuses the in-flight attempt's reference (DEV-04) and,
   * on success, to detect that the cart has since diverged from what was
   * actually recorded (ALX-05).
   */
  function checkoutFingerprint(state) {
    return JSON.stringify({
      itemData: state.itemData, wrapId: state.wrapId, messageCardEnabled: state.messageCardEnabled,
      giftMessage: state.giftMessage, recipientName: state.recipientName, cardSenderName: state.cardSenderName
    });
  }

  /**
   * ALX-03: write the pending attempt's identity BEFORE the network call —
   * this is the only copy that survives a reload while the outcome is
   * still unknown. Cleared once the outcome is definitively "success" or
   * "duplicate" (the order is safely recorded); kept for every other
   * outcome (conflict/ambiguous/connection/rejected) so a retry after
   * reload still reuses the same idempotency key.
   */
  function persistPendingAttempt() {
    try {
      localStorage.setItem(PENDING_ATTEMPT_KEY, JSON.stringify({
        reference: checkoutAttempt.reference,
        idempotencyKey: checkoutAttempt.idempotencyKey,
        fingerprint: checkoutAttempt.fingerprint,
        startedAt: Date.now()
      }));
    } catch (e) {}
  }

  function clearPendingAttempt() {
    try { localStorage.removeItem(PENDING_ATTEMPT_KEY); } catch (e) {}
  }

  /**
   * Called once at startup, after the cart/draft has been restored, so the
   * fingerprint comparison is against the same order the pending attempt
   * was recorded for. A mismatched or expired record belongs to an order
   * that no longer exists in this form — safe to discard, never to reuse.
   */
  function restorePendingAttempt() {
    let pending;
    try {
      const raw = localStorage.getItem(PENDING_ATTEMPT_KEY);
      if (!raw) return;
      pending = JSON.parse(raw);
    } catch (e) { clearPendingAttempt(); return; }
    if (!pending || typeof pending !== 'object' || !pending.reference || !pending.idempotencyKey || !pending.fingerprint) {
      clearPendingAttempt();
      return;
    }
    if (!(Date.now() - Number(pending.startedAt || 0) < PENDING_ATTEMPT_MAX_AGE_MS)) {
      clearPendingAttempt();
      return;
    }
    const currentFingerprint = checkoutFingerprint(normalizedCheckoutState());
    if (pending.fingerprint !== currentFingerprint) {
      // The cart no longer matches what was pending — reusing this key for
      // a different order would be wrong, and a genuinely new order must
      // get a genuinely new UUID (ALX-03/ALX-05).
      clearPendingAttempt();
      return;
    }
    checkoutAttempt = { reference: pending.reference, idempotencyKey: pending.idempotencyKey, fingerprint: pending.fingerprint };
  }

  function openCheckoutReview() {
    const state = normalizedCheckoutState();
    if (!state.isValid) {
      // DEV-19: this message used to be written into #checkout-error inside a
      // dialog that this path never opens, so nobody ever saw it. Route it
      // through the order section's existing live region instead.
      announceToScreenReader(ck('checkoutInvalidCart'));
      scrollToSection(cart.length ? '#custom-builder' : '#collection');
      return;
    }
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    // DEV-04: reuse the same reference + idempotency key across repeated
    // reviews of an unsubmitted, unchanged order (so a retry stays one
    // attempt); only start a fresh attempt once the order has actually
    // changed, or the previous attempt already succeeded.
    const fingerprint = checkoutFingerprint(state);
    if (!checkoutAttempt || checkoutAttempt.submitted || checkoutAttempt.fingerprint !== fingerprint) {
      checkoutAttempt = { reference: generateOrderReference(), idempotencyKey: generateIdempotencyKey(), fingerprint };
    }
    checkoutAttempt.state = state;

    setText('#checkout-eyebrow', ck('checkoutReviewEyebrow'));
    setText('#checkout-reference-label', ck('checkoutReferenceLabel'));
    setText('#checkout-reference', checkoutAttempt.reference);
    const list = document.getElementById('checkout-items');
    const cartTotals = computeCartTotals(cart);
    if (list) {
      list.textContent = '';
      // Show a per-line price here (UX-13) — richer than state.items, which
      // stays plain text for the WhatsApp/submission summaries that reuse it.
      cart.forEach((line, idx) => {
        const li = document.createElement('li');
        const lineTotal = cartTotals.lines[idx] ? cartTotals.lines[idx].total : 0;
        li.textContent = `${checkoutLineLabel(line)} — ${formatRp(lineTotal)}`;
        list.appendChild(li);
      });
    }
    setText('#checkout-subtotal-label', ck('checkoutSubtotalLabel'));
    // DEV-17: the wrap/ribbon fee gets its own row instead of being folded
    // silently into the subtotal — only custom bouquets carry a wrap fee.
    setText('#checkout-subtotal', formatRp(cartTotals.subtotal));
    setText('#checkout-wrap-fee-label', ck('checkoutWrapFeeLabel'));
    setText('#checkout-wrap-fee', formatRp(cartTotals.wrapFee));
    const wrapFeeRow = document.getElementById('checkout-wrap-fee-row');
    if (wrapFeeRow) wrapFeeRow.hidden = !(cartTotals.wrapFee > 0);
    setText('#checkout-card-fee-label', ck('checkoutCardFeeLabel'));
    setText('#checkout-card-fee', formatRp(state.messageCardFee));
    const cardFeeRow = document.getElementById('checkout-card-fee-row');
    if (cardFeeRow) cardFeeRow.hidden = !state.messageCardEnabled;
    setText('#checkout-total-label', ck('checkoutTotalLabel'));
    setText('#checkout-total', formatRp(state.estimatedProductTotal));
    setText('#checkout-delivery-row-label', ck('checkoutDeliveryRowLabel'));
    setText('#checkout-delivery-row-value', ck('checkoutDeliveryRowValue'));
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const en = currentLang === 'en';
    const cardNoteText = state.messageCardEnabled && orderNote.trim() ? ` ${en ? 'Card message' : 'Pesan kartu'}: "${orderNote.trim()}".` : '';
    setText('#checkout-finish', `${en ? 'Wrap' : 'Bungkus'}: ${t.wrapNames[selectedWrap]}.${cardNoteText}`);
    setText('#checkout-notice', ck('checkoutNotice'));
    setText('#checkout-edit', ck('checkoutEditOrder'));
    setText('#checkout-continue', ck('checkoutContinueOrder'));
    setText('#checkout-review-footer-total', formatRp(state.estimatedProductTotal));
    const error = document.getElementById('checkout-error');
    if (error) error.textContent = '';
    setCheckoutSubmitGuard(false);
    // DEV-14: showModal() itself moves focus to the dialog's first focusable
    // element (the close button) as part of opening — call it BEFORE setting
    // our own heading focus, or the browser's native focus would win.
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    showCheckoutStep('checkout-review');
  }

  /**
   * Reopen the dialog on an already-submitted attempt (DEV-10): the success
   * screen, not a brand-new review, since the order is already recorded.
   */
  function reopenCheckoutSuccess() {
    const modal = document.getElementById('checkout-modal');
    if (!modal || !checkoutAttempt || !checkoutAttempt.submitted) return;
    renderSuccessStep();
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    showCheckoutStep('checkout-success');
  }

  function openCheckoutDialog() {
    if (checkoutAttempt && checkoutAttempt.submitted) {
      // ALX-05: only reopen the recorded order's success screen if the cart
      // still matches exactly what was submitted. Products added since
      // success must lead to a fresh review of the new draft, not a stale
      // success screen that hides them — the recorded order stays reachable
      // separately through the recent-order banner (saveRecentOrder()).
      const state = normalizedCheckoutState();
      if (state.isValid && checkoutFingerprint(state) === checkoutAttempt.fingerprint) {
        reopenCheckoutSuccess();
        return;
      }
    }
    openCheckoutReview();
  }

  function renderSuccessStep() {
    if (!checkoutAttempt) return;
    setText('#checkout-success-eyebrow', ck('checkoutSuccessEyebrow'));
    setText('#checkout-success-title', ck('checkoutSuccessTitle'));
    setText('#checkout-success-copy', checkoutAttempt.duplicate ? ck('checkoutDuplicateCopy') : ck('checkoutSuccessCopy'));
    setText('#success-reference-label', ck('checkoutReferenceLabel'));
    setText('#success-reference', checkoutAttempt.reference);
    setText('#success-order-label', ck('checkoutSuccessOrderLabel'));
    const itemsList = document.getElementById('success-items');
    if (itemsList) {
      itemsList.textContent = '';
      (checkoutAttempt.state.items || []).forEach(itemLabel => {
        const li = document.createElement('li');
        li.textContent = itemLabel;
        itemsList.appendChild(li);
      });
    }
    setText('#success-total-label', ck('checkoutSuccessTotalLabel'));
    setText('#success-total', formatRp(checkoutAttempt.state.estimatedProductTotal || 0));
    setText('#checkout-whatsapp', ck('checkoutWhatsappButton'));
    setText('#copy-reference', ck('checkoutCopyReference'));
    setText('#checkout-start-new', ck('checkoutStartNewOrder'));
    const wa = document.getElementById('checkout-whatsapp');
    if (wa) {
      if (checkoutAttempt.lastPayload) {
        // Fresh submission — rebuild with the real buyer name/date just entered.
        const payload = checkoutAttempt.lastPayload;
        const url = buildPostSubmissionWhatsApp(checkoutAttempt.reference, payload.buyer_name, payload.preferred_date, checkoutAttempt.state);
        wa.href = url;
        checkoutAttempt.waUrl = url;
      } else if (checkoutAttempt.waUrl) {
        // Recovered from the recent-order banner — reuse the URL saved at
        // submit time rather than rebuilding one without a buyer name.
        wa.href = checkoutAttempt.waUrl;
      }
    }
    const copyStatus = document.getElementById('copy-status');
    if (copyStatus) copyStatus.textContent = '';
    const fallback = document.getElementById('copy-fallback-text');
    if (fallback) fallback.hidden = true;
  }

  function showRecordedOrder(payload, isDuplicate = false) {
    if (!checkoutAttempt) return;
    checkoutAttempt.submitted = true;
    checkoutAttempt.duplicate = isDuplicate;
    checkoutAttempt.lastPayload = payload;
    renderSuccessStep();
    setCheckoutSubmitGuard(false);
    showCheckoutStep('checkout-success');
    saveRecentOrder();
    renderRecentOrderBanner();
  }

  /**
   * Themed date picker for #preferred-date-input (checkoutDateLabel field).
   *
   * The native <input type="date"> pop-up renders using the OS/browser's
   * own dark-or-light chrome (see the screenshot in the redesign request),
   * which clashes with the site's cream/green theme and can't be restyled
   * with CSS. The field itself stays a real, validated text input — value
   * format, `required`, and `min` all keep working exactly as before, so
   * typing "2026-09-15" directly (as tests/run-browser-runner.js does via
   * page.fill) still works — this only replaces the *pop-up* with an
   * on-brand calendar built from the same theme tokens as the rest of the
   * checkout form.
   */
  const DATE_PICKER_MONTHS = {
    id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  const DATE_PICKER_WEEKDAYS = {
    id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  let datePickerViewYear = null;
  let datePickerViewMonth = null; // 0-11
  let datePickerFocusISO = null;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISODate(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
  function todayLocalISO() {
    const d = new Date();
    return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * Mirrors the server's isValidLeadTimeDate() range check (see
   * CONFIGURE-SUBMISSION-ENDPOINT.md) as a client-side custom validity, since
   * a plain text field gets no native `rangeUnderflow` for a `min` attribute.
   */
  function updateDateFieldValidity(field) {
    const value = (field.value || '').trim();
    if (!value || !ISO_DATE_RE.test(value)) { field.setCustomValidity(''); return; }
    field.setCustomValidity(field.min && value < field.min ? 'date-out-of-range' : '');
  }

  function isDatePickerOpen() {
    const popover = document.getElementById('date-popover');
    return !!popover && !popover.hidden;
  }

  function closeDatePicker() {
    const popover = document.getElementById('date-popover');
    const input = document.getElementById('preferred-date-input');
    if (popover) popover.hidden = true;
    if (input) input.setAttribute('aria-expanded', 'false');
  }

  function renderDatePickerCalendar() {
    const popover = document.getElementById('date-popover');
    const input = document.getElementById('preferred-date-input');
    if (!popover || !input) return;
    const lang = currentLang === 'en' ? 'en' : 'id';
    const months = DATE_PICKER_MONTHS[lang];
    const weekdays = DATE_PICKER_WEEKDAYS[lang];
    const minISO = input.min || '';
    const selectedISO = ISO_DATE_RE.test(input.value) ? input.value : '';
    const todayISO = todayLocalISO();

    const firstOfMonth = new Date(datePickerViewYear, datePickerViewMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(datePickerViewYear, datePickerViewMonth + 1, 0).getDate();

    if (!datePickerFocusISO || datePickerFocusISO.slice(0, 7) !== `${datePickerViewYear}-${pad2(datePickerViewMonth + 1)}`) {
      const selectedInView = selectedISO && selectedISO.slice(0, 7) === `${datePickerViewYear}-${pad2(datePickerViewMonth + 1)}`;
      const firstOfMonthISO = toISODate(datePickerViewYear, datePickerViewMonth, 1);
      // Default the roving-tabindex cell to the 1st of the month, unless
      // that's disabled (before `min`) — a disabled <button> can't take
      // focus, so land on the first selectable day instead.
      datePickerFocusISO = selectedInView ? selectedISO : (minISO > firstOfMonthISO ? minISO : firstOfMonthISO);
    }

    let cellsHtml = '';
    for (let i = 0; i < startWeekday; i++) cellsHtml += `<span class="date-popover-day is-empty" aria-hidden="true"></span>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toISODate(datePickerViewYear, datePickerViewMonth, day);
      const disabled = minISO && iso < minISO;
      const isSelected = iso === selectedISO;
      const isToday = iso === todayISO;
      const classes = ['date-popover-day'];
      if (isSelected) classes.push('is-selected');
      if (isToday) classes.push('is-today');
      cellsHtml += `<button type="button" class="${classes.join(' ')}" data-date="${iso}" ${disabled ? 'disabled' : ''} tabindex="${iso === datePickerFocusISO ? '0' : '-1'}" aria-selected="${isSelected}"${isToday ? ' aria-current="date"' : ''}>${day}</button>`;
    }

    const minMonthStamp = minISO ? Number(minISO.slice(0, 4)) * 12 + Number(minISO.slice(5, 7)) - 1 : -Infinity;
    const viewMonthStamp = datePickerViewYear * 12 + datePickerViewMonth;

    popover.innerHTML = `
      <div class="date-popover-header">
        <button type="button" class="date-popover-nav" id="date-popover-prev" aria-label="${lang === 'en' ? 'Previous month' : 'Bulan sebelumnya'}" ${viewMonthStamp <= minMonthStamp ? 'disabled' : ''}>‹</button>
        <span class="date-popover-title">${months[datePickerViewMonth]} ${datePickerViewYear}</span>
        <button type="button" class="date-popover-nav" id="date-popover-next" aria-label="${lang === 'en' ? 'Next month' : 'Bulan berikutnya'}">›</button>
      </div>
      <div class="date-popover-weekdays">${weekdays.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="date-popover-days" role="grid" aria-label="${months[datePickerViewMonth]} ${datePickerViewYear}">${cellsHtml}</div>
      <div class="date-popover-footer">
        <button type="button" class="btn-clear-cart" id="date-popover-clear">${lang === 'en' ? 'Clear' : 'Bersihkan'}</button>
      </div>`;
  }

  function focusDatePickerCell(iso) {
    const cell = document.querySelector(`.date-popover-day[data-date="${iso}"]`);
    if (cell) cell.focus();
  }

  function openDatePicker() {
    const popover = document.getElementById('date-popover');
    const input = document.getElementById('preferred-date-input');
    if (!popover || !input) return;
    const raw = input.value.trim();
    const base = ISO_DATE_RE.test(raw) ? raw : ((input.min && input.min > todayLocalISO()) ? input.min : todayLocalISO());
    datePickerViewYear = Number(base.slice(0, 4));
    datePickerViewMonth = Number(base.slice(5, 7)) - 1;
    datePickerFocusISO = null;
    renderDatePickerCalendar();
    popover.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    positionDatePicker();
  }

  /**
   * The popover is `position: fixed` (see styles.css for why), so its
   * on-screen placement has to be computed from the field's current
   * viewport position rather than left to normal document flow.
   */
  function positionDatePicker() {
    const popover = document.getElementById('date-popover');
    const input = document.getElementById('preferred-date-input');
    if (!popover || !input || popover.hidden) return;
    const rect = input.getBoundingClientRect();
    let left = rect.left;
    const maxLeft = window.innerWidth - popover.offsetWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.left = `${left}px`;
  }

  function changeDatePickerMonth(delta) {
    datePickerViewMonth += delta;
    if (datePickerViewMonth < 0) { datePickerViewMonth = 11; datePickerViewYear -= 1; }
    else if (datePickerViewMonth > 11) { datePickerViewMonth = 0; datePickerViewYear += 1; }
    datePickerFocusISO = null;
    renderDatePickerCalendar();
    const focusable = document.querySelector('.date-popover-day[tabindex="0"]');
    if (focusable) focusable.focus();
  }

  function moveDatePickerFocus(deltaDays) {
    const input = document.getElementById('preferred-date-input');
    const current = datePickerFocusISO || todayLocalISO();
    const [y, m, d] = current.split('-').map(Number);
    const next = new Date(y, m - 1, d + deltaDays);
    const nextISO = toISODate(next.getFullYear(), next.getMonth(), next.getDate());
    if (input && input.min && nextISO < input.min) return;
    datePickerFocusISO = nextISO;
    datePickerViewYear = next.getFullYear();
    datePickerViewMonth = next.getMonth();
    renderDatePickerCalendar();
    focusDatePickerCell(nextISO);
  }

  function setDatePickerValue(iso) {
    const input = document.getElementById('preferred-date-input');
    if (!input) return;
    input.value = iso;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closeDatePicker();
    input.focus();
  }

  function initDatePicker() {
    const field = document.getElementById('date-field');
    const input = document.getElementById('preferred-date-input');
    if (!field || !input || document.getElementById('date-popover')) return;

    const popover = document.createElement('div');
    popover.className = 'date-popover';
    popover.id = 'date-popover';
    popover.hidden = true;
    popover.setAttribute('role', 'dialog');
    field.appendChild(popover);

    input.addEventListener('input', () => updateDateFieldValidity(input));
    input.addEventListener('click', () => { if (!isDatePickerOpen()) openDatePicker(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isDatePickerOpen()) openDatePicker();
        const focusable = popover.querySelector('.date-popover-day[tabindex="0"]');
        if (focusable) focusable.focus();
      } else if (e.key === 'Escape' && isDatePickerOpen()) {
        e.preventDefault();
        closeDatePicker();
      }
    });

    popover.addEventListener('click', (e) => {
      const dayBtn = e.target.closest('.date-popover-day[data-date]');
      if (dayBtn) { if (!dayBtn.disabled) setDatePickerValue(dayBtn.dataset.date); return; }
      if (e.target.closest('#date-popover-prev')) { changeDatePickerMonth(-1); return; }
      if (e.target.closest('#date-popover-next')) { changeDatePickerMonth(1); return; }
      if (e.target.closest('#date-popover-clear')) { setDatePickerValue(''); }
    });

    popover.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeDatePicker(); input.focus(); return; }
      if (!e.target.classList.contains('date-popover-day')) return;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (e.key in moves) { e.preventDefault(); moveDatePickerFocus(moves[e.key]); return; }
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.disabled) {
        e.preventDefault();
        setDatePickerValue(e.target.dataset.date);
      }
    });

    // Prev/next month re-render the popover's innerHTML from inside its own
    // click handler, which destroys e.target (the button just clicked)
    // while the event is still bubbling. By the time it reaches here,
    // `field.contains(e.target)` would see a detached node and wrongly
    // read as "outside". composedPath() is captured before dispatch and
    // stays accurate across that kind of mid-event DOM mutation.
    document.addEventListener('click', (e) => {
      if (isDatePickerOpen() && !e.composedPath().includes(field)) closeDatePicker();
    });
    document.addEventListener('focusin', (e) => {
      if (isDatePickerOpen() && !e.composedPath().includes(field)) closeDatePicker();
    });
    // Fixed-position popover: track scroll/resize to keep it anchored to the
    // field. This also covers the browser's own "scroll the newly focused
    // field into view" behaviour, which otherwise fires right after opening
    // and would immediately misplace (or, if this instead closed on scroll,
    // instantly close) a popover that just opened.
    document.querySelector('.checkout-panel-scroll')?.addEventListener('scroll', () => { if (isDatePickerOpen()) positionDatePicker(); }, { passive: true });
    window.addEventListener('resize', () => { if (isDatePickerOpen()) positionDatePicker(); }, { passive: true });
  }

  function localizeCheckoutForm() {
    const copy = {
      '#checkout-form-eyebrow': ck('checkoutFormEyebrow'), '#checkout-form-title': ck('checkoutFormTitle'), '#buyer-legend': ck('checkoutBuyerLegend'),
      // Targets the dedicated text child, not the parent `-label` span, which
      // also contains the nested `-required` mark span — setText() replaces
      // the element's entire textContent, so writing to the parent would
      // destroy that child every time (ALX-21).
      '#buyer-name-label-text': `${ck('checkoutBuyerNameLabel')} `, '#buyer-phone-label-text': `${ck('checkoutBuyerPhoneLabel')} `, '#buyer-help': `${ck('checkoutBuyerHelp')} ${ck('checkoutBuyerPhoneExample')}`,
      '#location-legend': ck('checkoutLocationLegend'), '#location-type-label-text': `${ck('checkoutLocationTypeLabel')} `, '#regency-label-text': `${ck('checkoutRegencyLabel')} `,
      '#delivery-method-label': ck('checkoutDeliveryMethodLabel'), '#address-label-text': `${ck('checkoutAddressLabel')} `, '#city-label-text': `${ck('checkoutCityLabel')} `, '#postal-label-text': `${ck('checkoutPostalLabel')} `,
      '#pickup-help': ck('checkoutPickupHelp'),
      '#outside-bali-help': ck('checkoutOutsideBaliHelp'),
      '#date-label-text': `${ck('checkoutDateLabel')} `, '#delivery-help': ck('checkoutDeliveryHelp', { days: siteData.minimumLeadDays ?? 2 }),
      '#ack-label': ck('checkoutAckLabel'), '#save-order': ck('checkoutSaveOrder'),
      '#checkout-back-to-review': ck('checkoutBackToReview'),
      '#checkout-privacy-notice': ck('checkoutPrivacyNotice', { retention: (siteData.dataRetentionNotice && siteData.dataRetentionNotice[currentLang]) || '' }),
      '#buyer-name-required': ck('checkoutRequiredMark'), '#buyer-phone-required': ck('checkoutRequiredMark'),
      '#location-type-required': ck('checkoutRequiredMark'), '#regency-required': ck('checkoutRequiredMark'),
      '#address-required': ck('checkoutRequiredMark'), '#city-required': ck('checkoutRequiredMark'),
      '#postal-required': ck('checkoutRequiredMark'), '#date-required': ck('checkoutRequiredMark')
    };
    Object.entries(copy).forEach(([selector, value]) => setText(selector, value));
    const form = document.getElementById('checkout-form');
    const en = currentLang === 'en';
    const setOptions = (name, options) => {
      const select = form.elements[name];
      options.forEach((label, index) => { if (select.options[index]) select.options[index].textContent = label; });
    };
    setOptions('location_type', [ck('checkoutLocationBali'), ck('checkoutLocationOutsideBali')]);
    setOptions('delivery_method', [ck('checkoutDeliveryGrabGojek'), ck('checkoutDeliverySelfPickup')]);

    const regencySelect = form.elements['regency'];
    if (regencySelect) {
      const regencies = siteData.baliRegencies || [];
      const currentValue = regencySelect.value;
      while (regencySelect.options.length > 1) regencySelect.remove(1);
      regencySelect.options[0].textContent = ck('checkoutRegencyChoose');
      regencies.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        regencySelect.appendChild(opt);
      });
      if (regencies.includes(currentValue)) regencySelect.value = currentValue;
    }

    // DEV-11: the date picker enforces today + the owner-configured production
    // lead time, not just "today" — mirrored server-side (see
    // CONFIGURE-SUBMISSION-ENDPOINT.md's MINIMUM_LEAD_DAYS).
    const dateInput = form.elements['preferred_date'];
    if (dateInput) {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + (siteData.minimumLeadDays ?? 0));
      dateInput.min = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}-${String(minDate.getDate()).padStart(2, '0')}`;
      updateDateFieldValidity(dateInput);
      if (document.getElementById(fieldErrorId(dateInput))) {
        setFieldError(dateInput, dateInput.checkValidity() ? '' : fieldValidationMessage(dateInput));
      }
    }
    setText('#checkout-form-footer-total', checkoutAttempt ? formatRp(checkoutAttempt.state.estimatedProductTotal) : '');
  }

  /**
   * In-app checkout form validation (UX-14) — replaces the native
   * reportValidity() bubble (English-only, one field at a time, overlaps
   * the field's own label) with a persistent, Indonesian-first message
   * beside every invalid field. `novalidate` on the form suppresses the
   * native UI; the underlying validity API still works without it.
   */
  function fieldErrorId(field) {
    return `err-${field.name}`;
  }

  function ensureFieldErrorEl(field) {
    let el = document.getElementById(fieldErrorId(field));
    if (!el) {
      el = document.createElement('span');
      el.id = fieldErrorId(field);
      el.className = 'field-error';
      el.setAttribute('role', 'alert');
      el.hidden = true;
      const container = field.closest('label') || field.parentElement;
      container.appendChild(el);
    }
    return el;
  }

  function fieldValidationMessage(field) {
    if (field.validity.valueMissing) {
      if (field.type === 'checkbox') return ck('checkoutErrCheckbox');
      if (field.tagName === 'SELECT') return ck('checkoutErrSelect');
      return ck('checkoutErrRequired');
    }
    if (field.validity.patternMismatch) {
      return field.name === 'postal_code' ? ck('checkoutErrPostalPattern') : ck('checkoutErrPattern');
    }
    if (field.name === 'preferred_date' && field.validity.customError) {
      return ck('checkoutErrDateRange');
    }
    return ck('checkoutErrGeneric');
  }

  function setFieldError(field, message) {
    const el = ensureFieldErrorEl(field);
    el.textContent = message || '';
    el.hidden = !message;
    if (message) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
    const described = (field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (!described.includes(el.id)) {
      field.setAttribute('aria-describedby', [...described, el.id].join(' '));
    }
  }

  function validateCheckoutForm(form) {
    const invalidFields = [];
    Array.from(form.elements).forEach(field => {
      if (!field.name || field.disabled || field.type === 'hidden') return;
      if (field.checkValidity()) {
        setFieldError(field, '');
      } else {
        setFieldError(field, fieldValidationMessage(field));
        invalidFields.push(field);
      }
    });
    return invalidFields;
  }

  /**
   * DEV-07: load and render the Cloudflare Turnstile widget only once a
   * public site key is configured (OWNER-05) — the checkout form works
   * without it, so setup can proceed before Turnstile is ready.
   */
  function initTurnstile() {
    const siteKey = String((siteData.store && siteData.store.turnstileSiteKey) || '').trim();
    const container = document.getElementById('turnstile-widget');
    if (!siteKey || !container || typeof document.createElement !== 'function') return;
    window.__alxanthiaTurnstileReady = function () {
      if (!window.turnstile) return;
      turnstileWidgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: (token) => { turnstileToken = token; },
        'expired-callback': () => { turnstileToken = ''; },
        'error-callback': () => { turnstileToken = ''; }
      });
    };
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__alxanthiaTurnstileReady&render=explicit';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  function resetTurnstile() {
    turnstileToken = '';
    if (window.turnstile && turnstileWidgetId !== null) {
      try { window.turnstile.reset(turnstileWidgetId); } catch (e) {}
    }
  }

  /**
   * DEV-08: a submission gets at most 20 seconds before we treat it as
   * ambiguous rather than leaving the customer staring at "Saving..." forever.
   */
  const CHECKOUT_TIMEOUT_MS = 20000;

  async function submitWebsiteOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.getElementById('form-error');
    // ALX-04: explicit guard at entry — a double `submit` (double-click,
    // Enter held down) must issue exactly one request, not queue a second
    // one behind the first's still-open button-disable.
    if (checkoutAttempt && checkoutAttempt.isSubmitting) return;
    const invalidFields = validateCheckoutForm(form);
    if (invalidFields.length > 0) {
      error.textContent = ck('checkoutFieldsIncomplete', { count: invalidFields.length });
      invalidFields[0].focus();
      return;
    }
    error.textContent = '';
    const endpoint = String(siteData.store.orderSubmissionUrl || '').trim();
    if (!endpoint) {
      error.textContent = ck('checkoutNotConfigured');
      return;
    }
    // DEV-04: a prior 409 means this exact attempt (same idempotency key) is
    // stuck in a genuine conflict — stop instead of hammering the endpoint.
    if (checkoutAttempt.conflicted) {
      error.textContent = ck('checkoutConflictFailure', { reference: checkoutAttempt.reference });
      return;
    }
    const turnstileConfigured = !!String((siteData.store && siteData.store.turnstileSiteKey) || '').trim();
    if (turnstileConfigured && !turnstileToken) {
      error.textContent = ck('checkoutTurnstileRequired');
      return;
    }

    const button = document.getElementById('save-order');
    const payload = buildOrderSubmission(new FormData(form), checkoutAttempt.reference, checkoutAttempt.state, checkoutAttempt.idempotencyKey);
    setCheckoutSubmitGuard(true);
    button.disabled = true;
    button.textContent = ck('checkoutSaving');
    error.textContent = '';
    // ALX-03: written before the network call — the only record that
    // survives if the response never comes back.
    persistPendingAttempt();

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), CHECKOUT_TIMEOUT_MS) : null;

    // Every branch below sets `outcome` to one of: success | duplicate |
    // conflict | ambiguous | connection | rejected (DEV-08's typed failures).
    let outcome;
    let response = null;
    try {
      // ALX-04: the timeout stays active across this ENTIRE try block —
      // request, body read, and response validation — not just until
      // fetch()'s promise settles at headers-received. response.json()
      // below shares the same AbortSignal-backed body read, so a stalled
      // body still aborts within CHECKOUT_TIMEOUT_MS instead of hanging
      // forever on "Saving…".
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined
        });
      } catch (networkError) {
        // A request that never got a response at all: an abort (whether
        // from our own timeout or a stalled body — see below) is
        // uncertain, never a definite failure; anything else is a plain
        // connection failure.
        outcome = networkError && networkError.name === 'AbortError' ? 'ambiguous' : 'connection';
      }

      if (!outcome) {
        if (response.status === 409) {
          outcome = 'conflict';
        } else if (response.status >= 500) {
          outcome = 'ambiguous';
        } else if (!response.ok) {
          outcome = 'rejected';
        } else {
          try {
            const result = await response.json();
            // DEV-06: both the success flag and the exact matching reference
            // are required — `{ "ok": true }` alone is no longer accepted.
            // ALX-09: the one exception is a server-side rename after a rare
            // reference collision — accepted only when the server explicitly
            // echoes back the exact reference THIS attempt sent as
            // `renamed_from`, so a stale/replayed response for a different
            // order still can't be mistaken for this one's success.
            const referenceMatches = result && (
              result.order_reference === checkoutAttempt.reference ||
              (result.renamed_from === checkoutAttempt.reference && !!result.order_reference)
            );
            if (result && result.ok === true && referenceMatches) {
              if (result.order_reference !== checkoutAttempt.reference) {
                checkoutAttempt.reference = result.order_reference;
              }
              outcome = result.duplicate === true ? 'duplicate' : 'success';
            } else {
              outcome = 'ambiguous';
            }
          } catch (parseError) {
            // Headers came back fine, but the body read was aborted (a
            // stalled body past CHECKOUT_TIMEOUT_MS) or was malformed —
            // either way the server may have already stored the order,
            // so this is ambiguous, never a plain rejection (ALX-04).
            outcome = 'ambiguous';
          }
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setCheckoutSubmitGuard(false);
      button.disabled = false;
      button.textContent = ck('checkoutSaveOrder');
      resetTurnstile(); // a Turnstile token is single-use regardless of outcome
    }

    if (outcome === 'success' || outcome === 'duplicate') {
      clearPendingAttempt(); // ALX-03: safely recorded — no longer "uncertain"
      showRecordedOrder(payload, outcome === 'duplicate');
    } else if (outcome === 'conflict') {
      checkoutAttempt.conflicted = true;
      error.textContent = ck('checkoutConflictFailure', { reference: checkoutAttempt.reference });
    } else if (outcome === 'connection') {
      error.textContent = ck('checkoutConnectionFailure');
    } else if (outcome === 'rejected') {
      error.textContent = ck('checkoutRejectedFailure');
    } else {
      error.textContent = ck('checkoutAmbiguousFailure', { reference: checkoutAttempt.reference });
    }
  }

  function initCheckout() {
    const modal = document.getElementById('checkout-modal');
    const trigger = document.getElementById('btn-checkout');
    if (!modal || !trigger) return;
    trigger.addEventListener('click', openCheckoutDialog);
    document.getElementById('checkout-close').addEventListener('click', () => {
      if (checkoutAttempt && checkoutAttempt.isSubmitting) return;
      modal.close();
    });
    // DEV-09: suppress Esc-to-close (the dialog's native `cancel` event)
    // while a submission is in flight.
    modal.addEventListener('cancel', (e) => {
      if (checkoutAttempt && checkoutAttempt.isSubmitting) e.preventDefault();
    });
    document.getElementById('checkout-edit').addEventListener('click', () => {
      if (checkoutAttempt && checkoutAttempt.isSubmitting) return;
      modal.close();
      scrollToSection('#order');
    });
    document.getElementById('checkout-continue').addEventListener('click', () => {
      localizeCheckoutForm();
      setText('#checkout-form-summary', `${checkoutAttempt.reference} · ${checkoutAttempt.state.items.join('; ')} · ${formatRp(checkoutAttempt.state.estimatedProductTotal)}`);
      showCheckoutStep('checkout-form-step');
    });
    document.getElementById('checkout-back-to-review')?.addEventListener('click', () => {
      if (checkoutAttempt && checkoutAttempt.isSubmitting) return;
      openCheckoutReview();
    });
    document.getElementById('checkout-start-new')?.addEventListener('click', () => {
      modal.close();
      resetAllState();
      persistCart();
      clearRecentOrder();
      renderAll();
      renderRecentOrderBanner();
      scrollToSection('#order');
    });
    const locationType = document.querySelector('#checkout-form [name="location_type"]');
    const baliFields = document.getElementById('bali-fields');
    const outsideBaliFields = document.getElementById('outside-bali-fields');
    const toggleLocationFields = () => {
      const isBali = locationType.value !== 'luar_bali';
      baliFields.hidden = !isBali;
      outsideBaliFields.hidden = isBali;
      // DEV-12: the inactive branch is disabled (excluded from FormData) and
      // cleared — the server must still enforce the branch independently,
      // since client-side disabling is not security.
      baliFields.querySelectorAll('input, select').forEach(field => {
        field.required = isBali;
        field.disabled = !isBali;
        if (!isBali) {
          field.value = field.tagName === 'SELECT' ? field.options[0].value : '';
          setFieldError(field, '');
        } else if (document.getElementById(fieldErrorId(field))) {
          setFieldError(field, field.checkValidity() ? '' : fieldValidationMessage(field));
        }
      });
      outsideBaliFields.querySelectorAll('input, textarea').forEach(field => {
        field.required = !isBali;
        field.disabled = isBali;
        if (isBali) {
          field.value = '';
          setFieldError(field, '');
        } else if (document.getElementById(fieldErrorId(field))) {
          setFieldError(field, field.checkValidity() ? '' : fieldValidationMessage(field));
        }
      });
      if (!isBali) outsideBaliFields.querySelector('textarea, input')?.focus();
    };
    locationType.addEventListener('change', toggleLocationFields);
    toggleLocationFields();
    const deliveryMethod = document.querySelector('#checkout-form [name="delivery_method"]');
    const pickupHelp = document.getElementById('pickup-help');
    const togglePickupHelp = () => {
      if (pickupHelp) pickupHelp.hidden = deliveryMethod.value !== 'self_pickup';
    };
    deliveryMethod.addEventListener('change', togglePickupHelp);
    togglePickupHelp();
    const checkoutFormEl = document.getElementById('checkout-form');
    checkoutFormEl.addEventListener('submit', submitWebsiteOrder);
    // Filling in a field that already shows an error clears only that
    // field's message — never re-validates the whole form (UX-14).
    const revalidateOnInteraction = (e) => {
      const field = e.target;
      if (field && field.name && document.getElementById(fieldErrorId(field))) {
        setFieldError(field, field.checkValidity() ? '' : fieldValidationMessage(field));
      }
    };
    checkoutFormEl.addEventListener('input', revalidateOnInteraction);
    checkoutFormEl.addEventListener('change', revalidateOnInteraction);
    initDatePicker();
    document.getElementById('copy-reference').addEventListener('click', async () => {
      const fallback = document.getElementById('copy-fallback-text');
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(checkoutAttempt.reference);
        setText('#copy-status', ck('checkoutCopySuccess'));
        if (fallback) fallback.hidden = true;
      } catch (e) {
        // DEV-18: clipboard permission denied — show a selectable fallback
        // with the reference, instead of a bare, unexplained value.
        setText('#copy-status', '');
        if (fallback) {
          fallback.textContent = ck('checkoutCopyFallback', { reference: checkoutAttempt.reference });
          fallback.hidden = false;
          if (typeof fallback.focus === 'function') fallback.focus();
        }
      }
    });
    document.getElementById('recent-order-view')?.addEventListener('click', () => {
      const record = loadRecentOrder();
      if (!record) return;
      checkoutAttempt = {
        reference: record.reference,
        idempotencyKey: record.idempotencyKey,
        submitted: true,
        duplicate: false,
        state: { language: record.language || currentLang, items: record.orderSummary ? record.orderSummary.split('; ') : [], estimatedProductTotal: record.total || 0 },
        lastPayload: null,
        waUrl: record.waUrl
      };
      renderSuccessStep();
      setCheckoutSubmitGuard(false);
      if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
      showCheckoutStep('checkout-success');
    });
    document.getElementById('recent-order-dismiss')?.addEventListener('click', () => {
      const banner = document.getElementById('recent-order-banner');
      if (banner) banner.hidden = true;
    });
  }

  /**
   * Section Entrances with IntersectionObserver
   */
  function initScrollReveals() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    if (!('IntersectionObserver' in window)) return;

    const targets = document.querySelectorAll(
      '.hero-title, .hero-sub, .hero-actions, .section-header-flex, .category-header-row, .steps-grid, .material-figure, .material-text-col, .summary-box, .faq-accordion, .flower-card, .bouquet-card, .custom-builder-panel, .kit-teaser-band'
    );

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    targets.forEach(el => {
      if (el.contains(document.activeElement)) {
        el.classList.add('revealed');
      } else {
        el.classList.add('reveal-item');
        revealObserver.observe(el);
      }
    });

    document.addEventListener('focusin', (e) => {
      const parentReveal = e.target.closest('.reveal-item');
      if (parentReveal) {
        parentReveal.classList.add('revealed');
        revealObserver.unobserve(parentReveal);
      }
    });

    function revealTargetAnchor() {
      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
          if (target.classList.contains('reveal-item')) {
            target.classList.add('revealed');
            revealObserver.unobserve(target);
          }
          target.querySelectorAll('.reveal-item').forEach(el => {
            el.classList.add('revealed');
            revealObserver.unobserve(el);
          });
        }
      }
    }
    window.addEventListener('hashchange', revealTargetAnchor);
    revealTargetAnchor();
  }

  /**
   * Initialize App
   */
  function init() {
    try {
      loadData();
      restoreCartFromStorage();
      restorePendingAttempt();
      initLang();
      setupEventListeners();
      setupReducedMotionListener();
      setupAuth();
      renderAll();
      initCheckout();
      initTurnstile();
      renderRecentOrderBanner();
      initScrollReveals();
    } catch (err) {
      // Fail closed (ALX-22): a broken site-content.js must never publish
      // the unfinished draft. Keep the passcode curtain up regardless of
      // its previous state, and surface a hardcoded (never siteData-driven)
      // contact fallback, since nothing behind the curtain can be trusted.
      console.error('Alxanthia failed to initialize — the site is showing its fallback state: ' + (err && err.message ? err.message : err));
      const lockScreen = document.getElementById('lock-screen');
      if (lockScreen) {
        lockScreen.classList.remove('unlocked');
        lockScreen.style.display = 'flex';
      }
      const fallback = document.getElementById('site-unavailable');
      if (fallback) fallback.classList.add('is-visible');
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const selectStemKey = urlParams.get('selectStem');
        if (selectStemKey) {
          selectStemOrder(selectStemKey, false);
        }
        const selectPkgIdx = urlParams.get('selectPkg');
        if (selectPkgIdx !== null) {
          selectPackageOrder(parseInt(selectPkgIdx, 10), false);
        }
        const scrollTarget = urlParams.get('scroll');
        if (scrollTarget) {
          document.querySelectorAll('.reveal-item').forEach(el => el.classList.add('revealed'));
          const id = scrollTarget.replace(/^#/, '');
          const el = document.getElementById(id) || document.querySelector(scrollTarget);
          if (el) el.scrollIntoView({ behavior: 'instant' });
        }
      }
    } catch (e) {}

    // Export API for Testing & Verification
    window.AlxanthiaApp = {
      getData: () => siteData,
      setData: (newData) => {
        siteData = newData;
        renderAll();
      },
      getCurrentLang: () => currentLang,
      setLanguage: setLanguage,
      applyLanguageMetadata: applyLanguageMetadata,
      renderAll: renderAll,
      reloadOriginal: () => {
        siteData = JSON.parse(JSON.stringify(window.ALXANTHIA_DATA));
        renderAll();
      },
      selectStem: selectStemOrder,
      selectMiniPot: selectMiniPot,
      selectPackage: selectPackageOrder,
      bumpCustom: bumpCustomCount,
      bumpCustomAddition: bumpCustomAddition,
      resetCustom: resetCustomCounts,
      useCustom: useCustomBouquet,
      selectWrap: selectWrap,
      setOrderNote: (note) => {
        orderNote = typeof note === 'string' ? note : '';
        renderOrderSection();
        persistCart();
      },
      setMessageCardEnabled: (checked) => {
        messageCardEnabled = !!checked;
        renderOrderSection();
        persistCart();
      },
      setOrderRecipientName: (name) => {
        orderRecipientName = typeof name === 'string' ? name.slice(0, 120) : '';
        renderOrderSection();
        persistCart();
      },
      setOrderCardSenderName: (name) => {
        orderCardSenderName = typeof name === 'string' ? name.slice(0, 120) : '';
        renderOrderSection();
        persistCart();
      },
      resetToInitial: () => {
        resetAllState();
        renderAll();
      },
      getCustomTotals: getCustomTotals,
      computeCartTotals: computeCartTotals,
      normalizedCheckoutState: normalizedCheckoutState,
      generateOrderReference: generateOrderReference,
      buildPostSubmissionWhatsApp: buildPostSubmissionWhatsApp,
      buildOrderSubmission: buildOrderSubmission,
      normalizeIndonesianPhone: normalizeIndonesianPhone,
      getCart: () => cart.map(l => ({ ...l })),
      _setCartForTest: (c) => { cart = c; },
      persistCart: persistCart,
      restoreCartFromStorage: restoreCartFromStorage,
      addLine: addLine,
      removeLine: removeLine,
      bumpLineQty: bumpLineQty,
      isWhatsAppReady: isWhatsAppReady,
      isShopeeReady: isShopeeReady,
      setCategory: setCategory,
      interpolateRules: interpolateRules,
      getState: () => ({
        currentLang,
        orderMode: activeLine()?.type || 'stem',
        hasUserSelected: cart.length > 0,
        selectedFlower,
        selectedPackage,
        customCounts: { ...customCounts },
        customAdditions: { ...customAdditions },
        messageCardEnabled,
        orderRecipientName,
        orderCardSenderName,
        selectedWrap,
        orderNote,
        activeCategory,
        cart: cart.map(l => ({ ...l }))
      })
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
