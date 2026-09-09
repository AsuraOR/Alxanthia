/**
 * =============================================================================
 * KOMOREBI CREATIONS — APPLICATION CONTROLLER (app.js)
 * =============================================================================
 * Product Pivot: Finished Flowers & Bouquets
 */

(function () {
  'use strict';

  // Constants & Storage Keys
  const LANG_KEY = 'komorebi.lang';
  const AUTH_KEY = 'komorebi_unlocked';

  // State
  let currentLang = 'id';
  let selectedFlower = 'Sunflower';
  let selectedPackage = 1; // 0: Posy (3), 1: Handful (5), 2: Armful (9), 3: Grand (15)
  let customCounts = { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 }; // Starts empty (no silent preselection)
  let cart = []; // line items: { id, type: 'stem'|'package'|'custom', ...type-specific fields, qty }
  let nextLineId = 1;
  let selectedWrap = 'kraft';
  let orderNote = '';
  let siteData = null;

  /**
   * Currency formatter helper (Indonesian Rupiah standard)
   */
  function formatRp(n) {
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }

  /**
   * Load data directly from site-content.js (window.KOMOREBI_DATA)
   */
  function loadData() {
    if (window.KOMOREBI_DATA) {
      siteData = JSON.parse(JSON.stringify(window.KOMOREBI_DATA));
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
    const bulkFrom = siteData?.bulkFrom ?? 9;
    const bulkPercent = Math.round((siteData?.bulkRate ?? 0.10) * 100);
    const wrapFeeFormatted = formatRp(siteData?.wrapFee ?? 35000);
    return template
      .replace(/\{minStems\}/g, minStems)
      .replace(/\{bulkFrom\}/g, bulkFrom)
      .replace(/\{bulkPercent\}/g, bulkPercent)
      .replace(/\{wrapFee\}/g, wrapFeeFormatted);
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
      ? 'Komorebi — Finished Chenille Stem Flowers & Handcrafted Bouquets'
      : 'Komorebi — Bunga Jadi & Buket Kawat Bulu Chenille · Handcrafted Botanical Bouquets';
    const desc = isEn
      ? 'Chenille stem botanical flowers that never wilt: Sunflower, Rose, Tulip, and Gerbera. Handcrafted ready-to-display stems and bouquets.'
      : 'Bunga kawat bulu chenille yang tak pernah layu: Bunga Matahari, Mawar, Tulip, dan Gerbera. Dirangkai rapi oleh kami, tersedia per tangkai atau buket siap pajang.';
    const ogTitle = isEn
      ? 'Komorebi — Handcrafted Chenille Stem Flowers & Bouquets'
      : 'Komorebi — Bunga Jadi & Buket Kawat Bulu Chenille';
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

    const bulkFrom = siteData.bulkFrom ?? 9;
    const bulkRate = siteData.bulkRate ?? 0.10;
    const wrapFee = siteData.wrapFee ?? 35000;
    const minStems = siteData.minStems ?? 3;

    const discount = stems >= bulkFrom ? Math.round(flowersSubtotal * bulkRate) : 0;
    const total = flowersSubtotal - discount + wrapFee;
    const isValid = stems >= minStems;

    return {
      stems,
      flowersSubtotal,
      discount,
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
    const bulkFrom = siteData.bulkFrom ?? 9;
    const bulkRate = siteData.bulkRate ?? 0.10;
    const wrapFeeCfg = siteData.wrapFee ?? 35000;
    const minStems = siteData.minStems ?? 3;

    let hasCustomLine = false;
    let everyCustomLineValid = true;

    const lines = list.map(line => {
      let stems = 0;
      let subtotal = 0;
      let discount = 0;

      if (line.type === 'stem') {
        const flower = siteData.flowers[line.flowerKey];
        const price = flower ? (flower.stemPrice || 55000) : 55000;
        stems = line.qty;
        subtotal = price * line.qty;
      } else if (line.type === 'package') {
        const pkg = siteData.packages[line.pkgIndex];
        stems = (pkg ? pkg.stems : 0) * line.qty;
        subtotal = (pkg ? pkg.price : 0) * line.qty;
      } else if (line.type === 'custom') {
        hasCustomLine = true;
        let bouquetStems = 0;
        let bouquetSubtotal = 0;
        order.forEach(key => {
          const qty = (line.counts && line.counts[key]) || 0;
          const flower = siteData.flowers[key];
          const price = flower ? (flower.stemPrice || 55000) : 55000;
          bouquetStems += qty;
          bouquetSubtotal += qty * price;
        });
        if (bouquetStems < minStems) everyCustomLineValid = false;
        stems = bouquetStems * line.qty;
        subtotal = bouquetSubtotal * line.qty;
        discount = bouquetStems >= bulkFrom ? Math.round(subtotal * bulkRate) : 0;
      }

      return { id: line.id, type: line.type, stems, subtotal, discount, total: subtotal - discount };
    });

    const stemsTotal = lines.reduce((sum, l) => sum + l.stems, 0);
    const subtotalTotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
    const discountTotal = lines.reduce((sum, l) => sum + l.discount, 0);
    const wrapFee = hasCustomLine ? wrapFeeCfg : 0;
    const total = subtotalTotal - discountTotal + wrapFee;

    return {
      lines,
      stems: stemsTotal,
      subtotal: subtotalTotal,
      discount: discountTotal,
      wrapFee,
      total,
      isValid: list.length > 0 && everyCustomLineValid
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
    const addQty = lineSpec.qty || 1;
    let line;
    if (lineSpec.type !== 'custom') {
      const existing = cart.find(l => l.type === lineSpec.type && (
        lineSpec.type === 'stem' ? l.flowerKey === lineSpec.flowerKey : l.pkgIndex === lineSpec.pkgIndex
      ));
      if (existing) {
        existing.qty += addQty;
        line = existing;
      }
    }
    if (!line) {
      line = { ...lineSpec, id: nextLineId++, qty: addQty };
      cart.push(line);
    }
    renderCartLines();
    renderBouquetsUI();
    renderOrderSection();

    const t = siteData.translations[currentLang] || siteData.translations.id;
    const { title } = describeLine(line, t);
    announceToScreenReader(fillTemplate(t.announceLineAdded || '{item} added. {n} item(s) in cart.', { item: title, n: cart.length }));

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

    announceToScreenReader(fillTemplate(t.announceLineRemoved || '{item} removed. {n} item(s) in cart.', { item: title, n: cart.length }));

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
    const newQty = line.qty + delta;
    if (newQty <= 0) {
      removeLine(id);
      return;
    }
    line.qty = newQty;
    renderCartLines();
    renderBouquetsUI();
    renderOrderSection();

    const t = siteData.translations[currentLang] || siteData.translations.id;
    const { title } = describeLine(line, t);
    announceToScreenReader(fillTemplate(t.announceQtyChanged || '{item} updated to {qty}. {n} item(s) in cart.', { item: title, qty: newQty, n: cart.length }));
  }

  /**
   * Order action: Choose a single finished stem
   */
  function selectStemOrder(flowerKey, scroll = true) {
    if (flowerKey && siteData.flowers[flowerKey]) {
      selectedFlower = flowerKey;
    }
    addLine({ type: 'stem', flowerKey: selectedFlower, qty: 1 });
    if (scroll) {
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
   * Order action: Select a bouquet package
   */
  function selectPackageOrder(pkgIndex, scroll = true, restoreFocus = true) {
    selectedPackage = Math.max(0, Math.min(pkgIndex, siteData.packages.length - 1));
    addLine({ type: 'package', pkgIndex: selectedPackage, variety: 'mix', qty: 1 });
    if (restoreFocus) {
      const activeBtn = document.querySelector(`.btn-choose-bouquet[data-index="${selectedPackage}"]`);
      if (activeBtn) activeBtn.focus({ preventScroll: true });
    }
    if (scroll) {
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
   * Order action: Commit the custom bouquet draft as a new cart line
   * (custom lines never merge — each is a distinct bouquet) and scroll to order
   */
  function useCustomBouquet() {
    const tot = getCustomTotals();
    if (tot.isValid) {
      addLine({ type: 'custom', counts: { ...customCounts }, qty: 1 });
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
    customCounts[flowerKey] = Math.max(0, cur + delta);
    renderCustomBuilder();
    renderBouquetsUI();
  }

  /**
   * Order action: Reset the custom bouquet draft
   */
  function resetCustomCounts() {
    (siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera']).forEach(k => {
      customCounts[k] = 0;
    });
    renderCustomBuilder();
    renderBouquetsUI();
  }

  /**
   * Order action: Select wrapping paper colour
   */
  function selectWrap(wrapKey) {
    selectedWrap = wrapKey;
    renderOrderSection();
  }

  /**
   * Order action: choose a variety (or studio mix) for a package cart line.
   * Additive only — computeCartTotals ignores variety, since it never
   * changes price (P1-07).
   */
  function selectPackageVariety(lineId, variety) {
    const line = cart.find(l => l.id === lineId && l.type === 'package');
    if (!line) return;
    line.variety = variety;
    renderOrderSection();
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
  let activeCategory = 'all'; // 'all' | 'stems' | 'bouquets' | 'custom'

  function setCategory(cat, shouldScroll = true) {
    activeCategory = cat || 'all';
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
      const isCur = tab.getAttribute('data-category') === activeCategory;
      tab.classList.toggle('active', isCur);
      tab.setAttribute('aria-pressed', isCur ? 'true' : 'false');
    });

    const colEl = document.getElementById('collection');
    const bouqEl = document.getElementById('bouquets');
    const customEl = document.getElementById('custom-builder');
    const pkgsGrid = document.getElementById('packages-grid');
    const catTwoHeader = document.querySelector('#bouquets .category-header-row');

    if (activeCategory === 'stems') {
      if (colEl) colEl.style.display = '';
      if (bouqEl) bouqEl.style.display = 'none';
    } else if (activeCategory === 'bouquets') {
      if (colEl) colEl.style.display = 'none';
      if (bouqEl) bouqEl.style.display = '';
      if (catTwoHeader) catTwoHeader.style.display = '';
      if (pkgsGrid) pkgsGrid.style.display = '';
      if (customEl) customEl.style.display = 'none';
    } else if (activeCategory === 'custom') {
      if (colEl) colEl.style.display = 'none';
      if (bouqEl) bouqEl.style.display = '';
      if (catTwoHeader) catTwoHeader.style.display = 'none';
      if (pkgsGrid) pkgsGrid.style.display = 'none';
      if (customEl) customEl.style.display = '';
    } else {
      // 'all'
      if (colEl) colEl.style.display = '';
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
    setText('#cat-tab-bouquets', t.categoryBouquets || (currentLang === 'en' ? 'Bouquets' : 'Paket Buket'));
    setText('#cat-tab-custom', t.categoryCustom || (currentLang === 'en' ? 'Custom Mix' : 'Buket Custom'));
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
        <div class="flower-photo-wrapper" role="button" tabindex="0" aria-label="${trans.name}">
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
   * Render Category 02 — Bouquets Section UI
   */
  function renderBouquetsUI() {
    const t = siteData.translations[currentLang] || siteData.translations.id;

    setText('#cat2-label', t.catTwoLabel);
    setText('#cat2-title', t.catTwoTitle);
    setText('#cat2-note', t.catTwoNote);

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
    setText('#custom-reset-btn', t.resetLabel);

    const toggleBtn = document.getElementById('btn-toggle-custom');
    const toggleText = document.getElementById('custom-toggle-text');
    if (toggleBtn && toggleText) {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') !== 'false';
      toggleText.textContent = isExpanded
        ? (t.customBuilderToggleClose || 'Tutup penyusun custom ↑')
        : (t.customBuilderToggleOpen || 'Susun buket custom sendiri ↓');
    }

    // List of flower rows
    const rowsList = document.getElementById('custom-rows-list');
    if (rowsList) {
      // Record currently focused element if any
      const activeEl = document.activeElement;
      const activeFlower = activeEl ? activeEl.getAttribute('data-flower') : null;
      const isInc = activeEl ? activeEl.classList.contains('btn-inc') : false;
      const isDec = activeEl ? activeEl.classList.contains('btn-dec') : false;

      rowsList.innerHTML = '';
      const order = siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];

      order.forEach(key => {
        const flower = siteData.flowers[key];
        if (!flower) return;
        const trans = flower[currentLang] || flower.en;
        const count = customCounts[key] || 0;
        const priceStr = `${formatRp(flower.stemPrice || 55000)} / ${t.stemWord}`;

        const li = document.createElement('li');
        li.className = 'custom-row-item';
        li.innerHTML = `
          <div class="custom-flower-meta">
            <span class="custom-flower-dot" style="background:${flower.accent}" aria-hidden="true"></span>
            <div>
              <p class="custom-flower-name">${trans.name}</p>
              <p class="custom-flower-price">${priceStr}</p>
            </div>
          </div>
          <div class="stepper-controls">
            <button type="button" class="btn-stepper btn-dec" data-flower="${key}" aria-label="${currentLang === 'en' ? 'Decrease' : 'Kurangi'} ${trans.name}">−</button>
            <span class="stepper-count" aria-live="polite">${count}</span>
            <button type="button" class="btn-stepper btn-inc" data-flower="${key}" aria-label="${currentLang === 'en' ? 'Increase' : 'Tambahkan'} ${trans.name}">+</button>
          </div>
        `;

        li.querySelector('.btn-dec').addEventListener('click', () => bumpCustomCount(key, -1));
        li.querySelector('.btn-inc').addEventListener('click', () => bumpCustomCount(key, 1));
        rowsList.appendChild(li);
      });

      // Restore focus if a stepper button was clicked
      if (activeFlower) {
        const selector = isInc
          ? `.btn-inc[data-flower="${activeFlower}"]`
          : isDec
            ? `.btn-dec[data-flower="${activeFlower}"]`
            : null;
        if (selector) {
          const btnToFocus = rowsList.querySelector(selector);
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

    // Live Estimate Breakdown
    setText('#custom-est-label', t.estimateLabel);
    setText('#est-flowers-label', `${t.flowersLabel} (${tot.stems})`);
    setText('#est-flowers-val', formatRp(tot.flowersSubtotal));

    const discountRow = document.getElementById('est-discount-row');
    if (discountRow) {
      if (tot.discount > 0) {
        discountRow.style.display = 'flex';
        setText('#est-discount-label', interpolateRules(t.discountLabel));
        setText('#est-discount-val', `− ${formatRp(tot.discount)}`);
      } else {
        discountRow.style.display = 'none';
      }
    }

    setText('#est-wrap-label', t.wrapFeeLabel);
    setText('#est-wrap-val', formatRp(tot.wrapFee));

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
          ? (siteData.store.whatsappWaitlistEn || "Hello Komorebi! I'm interested in the DIY kit — please let me know when it launches.")
          : (siteData.store.whatsappWaitlistId || 'Halo Komorebi! Saya tertarik dengan kit DIY-nya — tolong kabari saya saat diluncurkan.');
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
  function varietyName(varietyKey, t) {
    if (!varietyKey || varietyKey === 'mix') return t.pkgVarietyMix || 'Studio mix';
    const flower = siteData.flowers[varietyKey];
    return flower ? (flower[currentLang] || flower.en).name : varietyKey;
  }

  function describeLine(line, t) {
    if (line.type === 'stem') {
      const flower = siteData.flowers[line.flowerKey];
      const trans = flower ? (flower[currentLang] || flower.en) : { name: line.flowerKey };
      return { title: trans.name, photoSrc: flower ? flower.photo : '', photoAlt: trans.name };
    }
    if (line.type === 'package') {
      const pkg = siteData.packages[line.pkgIndex];
      const pkgName = t.pkgNames[line.pkgIndex] || `Package ${line.pkgIndex + 1}`;
      const title = (line.variety && line.variety !== 'mix')
        ? `${pkgName} — ${varietyName(line.variety, t)}`
        : pkgName;
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
   * Locate a rendered cart-line <li> by its line id, from a stable ancestor
   * (#cart-lines survives re-renders; the <li>s inside it don't).
   */
  function findCartLineEl(linesEl, lineId) {
    const items = Array.from(linesEl.querySelectorAll('.cart-line'));
    return items.find(el => el.getAttribute('data-line-id') === String(lineId)) || null;
  }

  /**
   * Package variety chooser — one radio per flower plus "studio mix".
   * Reuses the #wrap-chips roving-tabindex / arrow-key pattern exactly
   * (same role="radio", aria-checked, keyboard handling) rather than a
   * second implementation (P1-07).
   */
  function renderVarietyChooser(line, t, linesEl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cart-line-variety';

    const label = document.createElement('p');
    label.className = 'cart-line-variety-label';
    label.textContent = t.pkgVarietyLabel || 'Pilih varietas';
    wrapper.appendChild(label);

    const optionsEl = document.createElement('div');
    optionsEl.className = 'cart-line-variety-options';
    optionsEl.setAttribute('role', 'radiogroup');
    optionsEl.setAttribute('aria-label', t.pkgVarietyLabel || 'Pilih varietas');

    const options = ['mix', ...(siteData.flowerOrder || [])];
    const currentVariety = line.variety || 'mix';

    options.forEach((key, idx) => {
      const active = currentVariety === key;
      const name = varietyName(key, t);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-wrap chip-variety ${active ? 'active' : ''}`;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
      btn.setAttribute('data-variety-index', String(idx));

      const nameSpan = document.createElement('span');
      nameSpan.textContent = name;
      btn.appendChild(nameSpan);
      if (active) {
        const check = document.createElement('span');
        check.className = 'wrap-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';
        btn.appendChild(check);
      }

      const focusActiveChip = () => {
        const freshLi = findCartLineEl(linesEl, line.id);
        const freshOptions = freshLi ? freshLi.querySelector('.cart-line-variety-options') : null;
        const activeChip = freshOptions ? freshOptions.querySelector('.chip-variety.active') : null;
        if (activeChip) activeChip.focus();
      };

      btn.addEventListener('click', () => {
        selectPackageVariety(line.id, key);
        focusActiveChip();
      });
      btn.addEventListener('keydown', (e) => {
        let targetIdx = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          targetIdx = (idx + 1) % options.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          targetIdx = (idx - 1 + options.length) % options.length;
        }
        if (targetIdx >= 0) {
          selectPackageVariety(line.id, options[targetIdx]);
          focusActiveChip();
        }
      });

      optionsEl.appendChild(btn);
    });

    wrapper.appendChild(optionsEl);
    return wrapper;
  }

  /**
   * Render every cart line as its own row: thumbnail, title, per-line price,
   * a qty stepper, and a remove control. Built with document.createElement /
   * textContent only — cart lines are the one region whose content is
   * derived from a growing data structure, so it stays out of innerHTML.
   */
  function renderCartLines() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const linesEl = document.getElementById('cart-lines');
    if (!linesEl) return;

    while (linesEl.children.length > 0) linesEl.removeChild(linesEl.children[linesEl.children.length - 1]);

    const cartTotals = computeCartTotals(cart);

    cart.forEach((line, index) => {
      const { title, photoSrc, photoAlt } = describeLine(line, t);
      const linePrice = cartTotals.lines[index].total;

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

      if (line.type === 'package') {
        li.appendChild(renderVarietyChooser(line, t, linesEl));
      }

      linesEl.appendChild(li);
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
          onSelect: () => selectStemOrder(key, false)
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
          onSelect: () => selectPackageOrder(index, false)
        }));
      });
    }
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
    setText('#btn-edit-selection', t.btnEditSelection || 'Ubah pilihan ↑');
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
        btn.setAttribute('aria-label', `${name} wrap paper`);
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

    // 3. Message card textarea
    const noteInput = document.getElementById('card-note-input');
    if (noteInput) {
      noteInput.placeholder = t.cardPlaceholder;
      if (noteInput.value !== orderNote) {
        noteInput.value = orderNote;
      }
      noteInput.oninput = (e) => {
        orderNote = e.target.value;
        renderSummaryIncludes();
        updateWhatsAppLink();
      };
    }

    // 4. Edit selection button: with multiple lines possible, this is a
    //    generic "go add or change something" affordance, not one line's editor.
    const editBtn = document.getElementById('btn-edit-selection');
    if (editBtn) {
      editBtn.onclick = () => {
        scrollToSection('#collection');
      };
    }

    // 5. Cart-level price and includes (renderCartLines handles per-line display)
    renderCartLines();

    const cartTotals = computeCartTotals(cart);
    const cartInvalid = cartHasSelection && !cartTotals.isValid;
    const wrapName = t.wrapNames[selectedWrap] || t.wrapNames.kraft;

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
          if (orderNote.trim()) {
            allIncludes.push(`${t.cardLinePrefix}: "${orderNote.trim()}"`);
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
        btnShopee.style.display = 'none';
      } else if (!shopeeActive) {
        btnShopee.style.display = 'flex';
        btnShopee.removeAttribute('href');
        btnShopee.setAttribute('aria-disabled', 'true');
        btnShopee.classList.add('btn-disabled');
        const shopName = btnShopee.querySelector('.channel-name');
        if (shopName) shopName.textContent = t.shopeeLabel || 'Shopee';
        const shopSub = document.getElementById('shopee-channel-sub');
        if (shopSub) shopSub.textContent = currentLang === 'en' ? 'Official Store · Coming soon' : 'Toko Resmi · Segera hadir';
        const shopAction = document.getElementById('shopee-channel-action');
        if (shopAction) shopAction.textContent = t.channelComingSoon || (currentLang === 'en' ? 'coming soon' : 'segera hadir');
      } else {
        btnShopee.style.display = 'flex';
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
                ? 'Opening Komorebi official store on Shopee...'
                : 'Membuka toko resmi Komorebi di Shopee...';
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
      const cardTxt = orderNote.trim() ? `${t.cardLinePrefix}: "${orderNote.trim()}". ` : '';

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
          const flowerList = flowerNames.map(item => `• ${item}`).join('\n');
          const vars = {
            items: flowerNames.join(', '), total: formatRp(cartTotals.total),
            stems: cartTotals.stems, itemList: flowerList, wrapInfo: wrapTxt, cardInfo: cardTxt
          };
          if (hasTemplate) {
            waMsg = fillTemplate(template, vars);
          } else if (currentLang === 'en') {
            waMsg = `Hello Komorebi! I would like to order a Custom Bouquet (${cartTotals.stems} stems, estimated ${formatRp(cartTotals.total)}, excludes delivery fee):\n${flowerList}\n${wrapTxt}${cardTxt}Can this be arranged?`;
          } else {
            waMsg = `Halo Komorebi! Saya ingin memesan Buket Custom (${cartTotals.stems} tangkai, estimasi ${formatRp(cartTotals.total)}, belum termasuk ongkir):\n${flowerList}\n${wrapTxt}${cardTxt}Apakah bisa dibuatkan?`;
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
            waMsg = `Hello Komorebi! I would like to order ${items} — ${formatRp(cartTotals.total)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`;
          } else {
            waMsg = `Halo Komorebi! Saya ingin memesan ${items} — ${formatRp(cartTotals.total)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
          }
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
            waMsg = `Hello Komorebi! I would like to order ${line.qty} × ${flTrans.name} ${t.stemSuffix} — Total ${formatRp(cartTotals.total)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`;
          } else {
            waMsg = `Halo Komorebi! Saya ingin memesan ${line.qty} × ${flTrans.name} ${t.stemSuffix} — Total ${formatRp(cartTotals.total)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
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
          ? `Hello Komorebi! I would like to order:\n${itemList}\nTotal ${formatRp(cartTotals.total)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`
          : `Halo Komorebi! Saya ingin memesan:\n${itemList}\nTotal ${formatRp(cartTotals.total)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
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
      setText('#sticky-order-title', 'Komorebi Creations');
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
    setText('#footer-copyright', t.copyright || '© 2026 Komorebi');
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

    [mainContent, header, footer, stickyBar].forEach(el => {
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

    if (!authConfig.enabled) {
      if (lockScreen) lockScreen.classList.add('unlocked');
      if (relockBtn) relockBtn.style.display = 'none';
      updateLockA11y(false);
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const expected = String(authConfig.passcode || '22062024').trim();
        if (urlParams.get('unlock') === expected) {
          localStorage.setItem(AUTH_KEY, 'true');
        }
      }

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
        const expected = String(authConfig.passcode || '22062024').trim();

        if (entered === expected) {
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
      if ((!heroVisible && !orderVisible && !footerVisible) || focusInside) {
        stickyBar.classList.add('visible');
        stickyBar.setAttribute('aria-hidden', 'false');
      } else {
        stickyBar.classList.remove('visible');
        stickyBar.setAttribute('aria-hidden', 'true');
      }
    }

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

    function openNavMenu() {
      if (!navMenu || !navToggle) return;
      navMenu.classList.add('open');
      if (navScrim) navScrim.classList.add('visible');
      document.body.classList.add('nav-open');
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', currentLang === 'en' ? 'Close navigation menu' : 'Tutup menu navigasi');
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
    loadData();
    initLang();
    setupEventListeners();
    setupReducedMotionListener();
    setupAuth();
    renderAll();
    initScrollReveals();

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
    window.KomorebiApp = {
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
        siteData = JSON.parse(JSON.stringify(window.KOMOREBI_DATA));
        renderAll();
      },
      selectStem: selectStemOrder,
      selectPackage: selectPackageOrder,
      bumpCustom: bumpCustomCount,
      resetCustom: resetCustomCounts,
      useCustom: useCustomBouquet,
      selectWrap: selectWrap,
      selectPackageVariety: selectPackageVariety,
      setOrderNote: (note) => {
        orderNote = typeof note === 'string' ? note : '';
        renderOrderSection();
      },
      resetToInitial: () => {
        cart = [];
        nextLineId = 1;
        selectedFlower = 'Sunflower';
        selectedPackage = 1;
        customCounts = { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 };
        selectedWrap = 'kraft';
        orderNote = '';
        activeCategory = 'all';
        renderAll();
      },
      getCustomTotals: getCustomTotals,
      computeCartTotals: computeCartTotals,
      getCart: () => cart.map(l => ({ ...l })),
      _setCartForTest: (c) => { cart = c; },
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
