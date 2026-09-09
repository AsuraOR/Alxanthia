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
  let selectedStemQty = 1; // 1, 2, 3... stems
  let selectedPackage = 1; // 0: Posy (3), 1: Handful (5), 2: Armful (9), 3: Grand (15)
  let customCounts = { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 }; // Starts empty (no silent preselection)
  let cart = []; // line items: { id, type: 'stem'|'package'|'custom', ...type-specific fields, qty }
  let nextLineId = 1;
  let selectedWrap = 'kraft';
  let orderNote = '';
  let siteData = null;
  let activePreviewToken = 0;
  let currentLoadedSrc = '';
  let currentLatinText = '';

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
   * Order action: Choose a single finished stem
   */
  function selectStemOrder(flowerKey, scroll = true) {
    if (flowerKey && siteData.flowers[flowerKey]) {
      selectedFlower = flowerKey;
    }
    cart = [{ id: nextLineId++, type: 'stem', flowerKey: selectedFlower, qty: selectedStemQty }];
    renderBouquetsUI();
    renderOrderSection();
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
   * Order action: Change single stem quantity
   */
  function bumpStemQty(delta) {
    selectedStemQty = Math.max(1, Math.min(30, selectedStemQty + delta));
    const line = activeLine();
    if (line && line.type === 'stem') {
      line.qty = selectedStemQty;
    } else {
      cart = [{ id: nextLineId++, type: 'stem', flowerKey: selectedFlower, qty: selectedStemQty }];
    }
    renderBouquetsUI();
    renderOrderSection();
  }

  /**
   * Order action: Add flower to custom bouquet
   */
  function addFlowerToBouquet(flowerKey) {
    if (!customCounts[flowerKey]) customCounts[flowerKey] = 0;
    customCounts[flowerKey] += 1;
    cart = [{ id: nextLineId++, type: 'custom', counts: { ...customCounts }, qty: 1 }];

    const t = siteData.translations[currentLang] || siteData.translations.id;
    const fl = siteData.flowers[flowerKey];
    const name = fl ? (fl[currentLang] || fl.en).name : flowerKey;
    const tot = getCustomTotals();

    // Announce addition to screen reader
    const announcer = document.getElementById('order-announcer');
    if (announcer) {
      announcer.textContent = `${name} ditambahkan ke buket. Total ${tot.stems} tangkai.`;
    }

    renderCustomBuilder();
    renderBouquetsUI();
    renderOrderSection();
  }

  /**
   * Order action: Select a bouquet package
   */
  function selectPackageOrder(pkgIndex, scroll = true, restoreFocus = true) {
    selectedPackage = Math.max(0, Math.min(pkgIndex, siteData.packages.length - 1));
    cart = [{ id: nextLineId++, type: 'package', pkgIndex: selectedPackage, qty: 1 }];
    renderBouquetsUI();
    renderOrderSection();
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
   * Order action: Apply custom bouquet and scroll to order
   */
  function useCustomBouquet() {
    const tot = getCustomTotals();
    if (tot.isValid) {
      cart = [{ id: nextLineId++, type: 'custom', counts: { ...customCounts }, qty: 1 }];
      renderBouquetsUI();
      renderOrderSection();
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
   * Order action: Bump custom flower count
   */
  function bumpCustomCount(flowerKey, delta) {
    const cur = customCounts[flowerKey] || 0;
    customCounts[flowerKey] = Math.max(0, cur + delta);
    cart = [{ id: nextLineId++, type: 'custom', counts: { ...customCounts }, qty: 1 }];
    renderCustomBuilder();
    renderBouquetsUI();
    renderOrderSection();
  }

  /**
   * Order action: Reset custom bouquet
   */
  function resetCustomCounts() {
    (siteData.flowerOrder || ['Sunflower', 'Rose', 'Tulip', 'Gerbera']).forEach(k => {
      customCounts[k] = 0;
    });
    cart = [{ id: nextLineId++, type: 'custom', counts: { ...customCounts }, qty: 1 }];
    renderCustomBuilder();
    renderBouquetsUI();
    renderOrderSection();
  }

  /**
   * Order action: Select wrapping paper colour
   */
  function selectWrap(wrapKey) {
    selectedWrap = wrapKey;
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
   * The cart's single active line (P1-06 will allow more than one).
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
            <button type="button" class="btn-add-bouquet" data-flower="${key}">
              ${t.addToBouquetLabel}
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

      // Button: Add to bouquet + with instant feedback
      const addBtn = card.querySelector('.btn-add-bouquet');
      if (addBtn) {
        addBtn.addEventListener('click', (e) => {
          e.preventDefault();
          addFlowerToBouquet(key);

          // Inline visual badge feedback
          const originalText = addBtn.textContent;
          addBtn.textContent = `✓ +1 (${customCounts[key]})`;
          addBtn.classList.add('btn-added-flash');
          setTimeout(() => {
            addBtn.textContent = originalText;
            addBtn.classList.remove('btn-added-flash');
          }, 900);
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
        const active = activeLine()?.type === 'package' && index === selectedPackage;
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
      const active = activeLine()?.type === 'package' && index === selectedPackage;
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
      hintEl.textContent = tot.isValid ? t.okHint : interpolateRules(t.minHint);
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
  function renderHowTo(t) {
    setText('#how-eyebrow', t.howEyebrow);
    setText('#how-title', t.howTitle);

    const stepsEl = document.getElementById('steps-grid');
    if (stepsEl && t.steps) {
      stepsEl.innerHTML = '';
      t.steps.forEach(step => {
        const div = document.createElement('div');
        div.className = 'step-card';
        div.innerHTML = `
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
    setText('#mat-caption', t.matCaption);
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
   * Product Preview Crossfade
   */
  function updateSummaryPhoto(targetSrc, targetAlt) {
    const frame = document.getElementById('summary-photo-frame');
    const mainImg = document.getElementById('summary-img');
    const prevImg = document.getElementById('summary-img-prev');

    if (!mainImg || !targetSrc) return;

    if (currentLoadedSrc === targetSrc) {
      mainImg.alt = targetAlt;
      if (frame) frame.classList.remove('has-error', 'is-loading');
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (frame) frame.classList.remove('is-loading', 'has-error');
      mainImg.src = targetSrc;
      mainImg.alt = targetAlt;
      if (prevImg) prevImg.src = targetSrc;
      currentLoadedSrc = targetSrc;
      return;
    }

    const requestToken = ++activePreviewToken;
    if (frame) {
      frame.classList.add('is-loading');
      frame.classList.remove('has-error');
    }

    const preloader = new Image();
    preloader.onload = () => {
      if (requestToken !== activePreviewToken) return;
      if (frame) frame.classList.remove('is-loading');
      if (prevImg && currentLoadedSrc) {
        prevImg.src = currentLoadedSrc;
      }
      mainImg.src = targetSrc;
      mainImg.alt = targetAlt;
      currentLoadedSrc = targetSrc;
    };
    preloader.onerror = () => {
      if (requestToken !== activePreviewToken) return;
      if (frame) {
        frame.classList.remove('is-loading');
        frame.classList.add('has-error');
      }
    };
    preloader.src = targetSrc;
  }

  /**
   * Botanical Name Caption Crossfade
   */
  function updateSummaryLatin(newLatin) {
    const latinEl = document.getElementById('summary-latin');
    if (!latinEl) return;
    if (currentLatinText === newLatin) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !currentLatinText) {
      latinEl.textContent = newLatin;
      currentLatinText = newLatin;
      return;
    }

    latinEl.classList.add('fading-out');
    setTimeout(() => {
      latinEl.textContent = newLatin;
      latinEl.classList.remove('fading-out');
      currentLatinText = newLatin;
    }, 90);
  }

  /**
   * Render Order / Finishing Section
   */
  function renderOrderSection() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    const curLine = activeLine();
    const cartHasSelection = cart.length > 0;

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

    // 1. Single stem quantity stepper (visible only once a stem is actually selected)
    const stemQtyCard = document.getElementById('stem-qty-card');
    if (stemQtyCard) {
      if (cartHasSelection && curLine?.type === 'stem') {
        stemQtyCard.style.display = 'block';
        setText('#stem-qty-label', t.stemQtyLabel || 'Jumlah tangkai');
        setText('#stem-qty-count', selectedStemQty);
        setText('#stem-qty-unit', t.stemsWord || 'tangkai');

        const decBtn = document.getElementById('btn-stem-dec');
        const incBtn = document.getElementById('btn-stem-inc');
        if (decBtn) {
          decBtn.onclick = () => bumpStemQty(-1);
          decBtn.disabled = selectedStemQty <= 1;
        }
        if (incBtn) {
          incBtn.onclick = () => bumpStemQty(1);
        }
      } else {
        stemQtyCard.style.display = 'none';
      }
    }

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

    // 4. Edit selection button route (with clear focus destinations - A3)
    const editBtn = document.getElementById('btn-edit-selection');
    if (editBtn) {
      editBtn.onclick = () => {
        if (curLine?.type === 'custom') {
          const customBody = document.getElementById('custom-builder-body');
          const toggleCustomBtn = document.getElementById('btn-toggle-custom');
          const customPanel = document.getElementById('custom-builder');
          if (customBody && customBody.classList.contains('collapsed')) {
            customBody.classList.remove('collapsed');
            if (toggleCustomBtn) {
              toggleCustomBtn.setAttribute('aria-expanded', 'true');
              const toggleText = document.getElementById('custom-toggle-text');
              if (toggleText) {
                const t = siteData.translations[currentLang] || siteData.translations.id;
                toggleText.textContent = t.customBuilderToggleClose || 'Tutup penyusun custom ↑';
              }
            }
            if (customPanel) {
              customPanel.classList.remove('is-collapsed');
            }
          }
          scrollToSection('#custom-builder', '#custom-builder');
          const firstStepper = document.querySelector('#custom-rows-list .btn-inc');
          if (firstStepper) firstStepper.focus({ preventScroll: true });
        } else if (curLine?.type === 'package') {
          scrollToSection('#bouquets', `.bouquet-card[data-index="${selectedPackage}"]`);
          const activePkgBtn = document.querySelector(`.btn-choose-bouquet[data-index="${selectedPackage}"]`);
          if (activePkgBtn) activePkgBtn.focus({ preventScroll: true });
        } else {
          scrollToSection('#collection', `.flower-card[data-flower="${selectedFlower}"]`);
          const activeStemBtn = document.querySelector(`.btn-order-stem[data-flower="${selectedFlower}"]`);
          if (activeStemBtn) activeStemBtn.focus({ preventScroll: true });
        }
      };
    }

    // 5. Prepare summary title, subtitle, price, photo, includes according to mode
    let selTitle = '';
    let selSub = '';
    let selPrice = '';
    let photoSrc = '';
    let photoAlt = '';
    let baseIncludes = [];
    let isCustomInvalid = false;
    let customFlowerSummaryList = [];

    const wrapName = t.wrapNames[selectedWrap] || t.wrapNames.kraft;

    if (!cartHasSelection) {
      selTitle = t.emptySummaryTitle || (currentLang === 'en' ? 'No flower selected yet' : 'Belum ada bunga dipilih');
      selSub = t.emptySummarySub || (currentLang === 'en' ? 'Choose a stem or bouquet above' : 'Pilih bunga satuan atau buket di atas');
      selPrice = t.emptySummaryPrice || '—';
      photoSrc = '';
      photoAlt = selTitle;
      baseIncludes = [];
      isCustomInvalid = false;
    } else if (curLine?.type === 'package') {
      const pkgIdx = Math.min(Math.max(selectedPackage, 0), siteData.packages.length - 1);
      const pkg = siteData.packages[pkgIdx];
      selTitle = t.pkgNames[pkgIdx];
      selSub = `${pkg.stems} ${t.stemsWord}`;
      selPrice = formatRp(pkg.price);
      photoSrc = pkg.photoWebp || pkg.photo;
      photoAlt = `${selTitle} — ${pkg.stems} ${t.pkgStemLine}`;
      baseIncludes = t.pkgIncludes.map(l => l.replace('{n}', pkg.stems));
    } else if (curLine?.type === 'custom') {
      const tot = computeCartTotals(cart);
      selTitle = `${t.customTitleShort} (${tot.stems} ${t.stemsWord})`;
      selSub = `${tot.stems} ${t.stemsWord}`;
      isCustomInvalid = !tot.isValid;
      selPrice = tot.isValid ? formatRp(tot.total) : `— (${interpolateRules(t.minHint)})`;
      photoSrc = siteData.packages[1].photoWebp || siteData.packages[1].photo;
      photoAlt = `${t.customTitleShort} — ${tot.stems} ${t.stemsWord}`;

      customFlowerSummaryList = (siteData.flowerOrder || []).filter(k => (customCounts[k] || 0) > 0)
        .map(k => {
          const fl = siteData.flowers[k];
          const name = fl ? (fl[currentLang] || fl.en).name : k;
          return `${customCounts[k]} × ${name}`;
        });

      if (customFlowerSummaryList.length > 0) {
        baseIncludes = customFlowerSummaryList.concat(t.customIncludesTail);
      } else {
        baseIncludes = [t.emptyCustomMsg].concat(t.customIncludesTail);
      }
    } else {
      // 'stem' mode
      const key = siteData.flowers[selectedFlower] ? selectedFlower : 'Sunflower';
      const curFlower = siteData.flowers[key];
      const flTrans = curFlower[currentLang] || curFlower.en;
      selTitle = selectedStemQty > 1
        ? `${selectedStemQty} × ${flTrans.name} ${t.stemSuffix}`
        : `${flTrans.name} ${t.stemSuffix}`;
      selSub = curFlower.latin;
      const stemTotal = (curFlower.stemPrice || 55000) * selectedStemQty;
      selPrice = formatRp(stemTotal);
      photoSrc = curFlower.photo;
      photoAlt = `${flTrans.name} — ${curFlower.latin}`;
      baseIncludes = t.stemIncludes.map(l =>
        l.replace('{flower}', flTrans.name)
         .replace('{size}', flTrans.size)
         .replace('{qty}', selectedStemQty)
      );
    }

    setText('#summary-title', selTitle);
    updateSummaryLatin(selSub);
    if (cartHasSelection) {
      updateSummaryPhoto(photoSrc, photoAlt);
    }
    const summaryPhotoFrame = document.getElementById('summary-photo-frame');
    if (summaryPhotoFrame) {
      summaryPhotoFrame.classList.toggle('is-empty', !cartHasSelection);
    }

    // Custom illustration photo note
    const photoNote = document.getElementById('summary-photo-caption-note');
    if (photoNote) {
      if (cartHasSelection && curLine?.type === 'custom') {
        photoNote.style.display = 'block';
        photoNote.textContent = t.customIllustrativeNote || 'Foto ilustrasi buket';
      } else {
        photoNote.style.display = 'none';
      }
    }

    // Price display
    const priceEl = document.getElementById('summary-price');
    if (priceEl) {
      if (siteData.store.showPrices) {
        priceEl.style.display = 'block';
        priceEl.textContent = selPrice;
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
      if (cartHasSelection && curLine?.type === 'custom' && isCustomInvalid) {
        minWarningEl.style.display = 'block';
        setText('#custom-min-warning-text', interpolateRules(t.customMinErrorSummary || t.minHint));
      } else {
        minWarningEl.style.display = 'none';
      }
    }

    // Render includes list (Safe textContent assignment for gift notes & inputs - R02)
    function renderSummaryIncludes() {
      const includesListEl = document.getElementById('summary-includes-list');
      const includesLabelEl = document.getElementById('includes-label');
      if (includesLabelEl) {
        includesLabelEl.style.display = cartHasSelection ? '' : 'none';
      }
      if (includesListEl) {
        includesListEl.innerHTML = '';
        const allIncludes = [...baseIncludes];
        if (cartHasSelection) {
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

      if (curLine?.type === 'custom' && isCustomInvalid) {
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

      const template = siteData.store.whatsappTemplates?.[currentLang]?.[curLine?.type];
      const hasTemplate = typeof template === 'string' && template.trim() !== '';
      let waMsg = '';
      if (curLine?.type === 'custom') {
        const tot = computeCartTotals(cart);
        const flowerList = customFlowerSummaryList.map(item => `• ${item}`).join('\n');
        const vars = {
          items: customFlowerSummaryList.join(', '), total: formatRp(tot.total),
          stems: tot.stems, itemList: flowerList, wrapInfo: wrapTxt, cardInfo: cardTxt
        };
        if (hasTemplate) {
          waMsg = fillTemplate(template, vars);
        } else if (currentLang === 'en') {
          waMsg = `Hello Komorebi! I would like to order a Custom Bouquet (${tot.stems} stems, estimated ${formatRp(tot.total)}, excludes delivery fee):\n${flowerList}\n${wrapTxt}${cardTxt}Can this be arranged?`;
        } else {
          waMsg = `Halo Komorebi! Saya ingin memesan Buket Custom (${tot.stems} tangkai, estimasi ${formatRp(tot.total)}, belum termasuk ongkir):\n${flowerList}\n${wrapTxt}${cardTxt}Apakah bisa dibuatkan?`;
        }
      } else if (curLine?.type === 'package') {
        const pkgIdx = Math.min(Math.max(selectedPackage, 0), siteData.packages.length - 1);
        const pkg = siteData.packages[pkgIdx];
        const items = `${selTitle} (${pkg.stems} ${currentLang === 'en' ? 'stems' : 'tangkai'})`;
        const vars = {
          items, total: formatRp(pkg.price), stems: pkg.stems,
          itemList: `• ${items}`, wrapInfo: wrapTxt, cardInfo: cardTxt
        };
        if (hasTemplate) {
          waMsg = fillTemplate(template, vars);
        } else if (currentLang === 'en') {
          waMsg = `Hello Komorebi! I would like to order ${selTitle} (${pkg.stems} stems) — ${formatRp(pkg.price)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`;
        } else {
          waMsg = `Halo Komorebi! Saya ingin memesan ${selTitle} (${pkg.stems} tangkai) — ${formatRp(pkg.price)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
        }
      } else {
        // stem mode
        const key = siteData.flowers[selectedFlower] ? selectedFlower : 'Sunflower';
        const curFlower = siteData.flowers[key];
        const flTrans = curFlower[currentLang] || curFlower.en;
        const stemTotal = (curFlower.stemPrice || 55000) * selectedStemQty;
        const items = `${selectedStemQty} × ${flTrans.name} ${t.stemSuffix}`;
        const vars = {
          items, total: formatRp(stemTotal), stems: selectedStemQty,
          itemList: `• ${items}`, wrapInfo: wrapTxt, cardInfo: cardTxt
        };
        if (hasTemplate) {
          waMsg = fillTemplate(template, vars);
        } else if (currentLang === 'en') {
          waMsg = `Hello Komorebi! I would like to order ${selectedStemQty} × ${flTrans.name} ${t.stemSuffix} — Total ${formatRp(stemTotal)} (excludes delivery fee). ${wrapTxt}${cardTxt}Is it available?`;
        } else {
          waMsg = `Halo Komorebi! Saya ingin memesan ${selectedStemQty} × ${flTrans.name} ${t.stemSuffix} — Total ${formatRp(stemTotal)} (belum termasuk ongkir). ${wrapTxt}${cardTxt}Apakah masih tersedia?`;
        }
      }

      btnWhatsapp.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
      const channelName = btnWhatsapp.querySelector('.channel-name');
      if (channelName) channelName.textContent = t.waLabel || 'WhatsApp — Konfirmasi Pesanan';
      const channelAction = btnWhatsapp.querySelector('.channel-action');
      if (channelAction) channelAction.textContent = t.messageLabel || 'chat →';
    }
    updateWhatsAppLink();

    setText('#order-note', t.orderNote);

    // Announcer for screen readers
    const announcer = document.getElementById('order-announcer');
    if (announcer) {
      announcer.textContent = `${selTitle} — ${selPrice}.`;
    }

    // 7. Update sticky mobile order bar (R04)
    if (!cartHasSelection) {
      setText('#sticky-order-title', 'Komorebi Creations');
      setText('#sticky-order-price', t.stickyPrompt || (currentLang === 'en' ? 'Choose flowers' : 'Pilih bunga'));
      setText('#sticky-order-cta', `${t.ctaBrowse || (currentLang === 'en' ? 'Browse' : 'Lihat bunga')} ↓`);
    } else {
      if (curLine?.type === 'custom' && isCustomInvalid) {
        const tot = computeCartTotals(cart);
        const minStemsCount = siteData.minStems ?? 3;
        const minPrompt = (t.minStemsRequired || (currentLang === 'en' ? 'Min. {n} stems' : 'Min. {n} tangkai')).replace('{n}', minStemsCount);
        setText('#sticky-order-title', `${t.customTitleShort} (${tot.stems})`);
        setText('#sticky-order-price', minPrompt);
        setText('#sticky-order-cta', t.configureStemsCta || (currentLang === 'en' ? 'Configure stems ↑' : 'Atur bunga ↑'));
      } else {
        setText('#sticky-order-title', selTitle);
        setText('#sticky-order-price', selPrice);
        setText('#sticky-order-cta', `${t.navOrder || (currentLang === 'en' ? 'Order' : 'Pesan')} →`);
      }
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
      bumpStemQty: bumpStemQty,
      selectPackage: selectPackageOrder,
      bumpCustom: bumpCustomCount,
      resetCustom: resetCustomCounts,
      useCustom: useCustomBouquet,
      selectWrap: selectWrap,
      setOrderNote: (note) => {
        orderNote = typeof note === 'string' ? note : '';
        renderOrderSection();
      },
      resetToInitial: () => {
        cart = [];
        nextLineId = 1;
        selectedFlower = 'Sunflower';
        selectedStemQty = 1;
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
      isWhatsAppReady: isWhatsAppReady,
      isShopeeReady: isShopeeReady,
      setCategory: setCategory,
      interpolateRules: interpolateRules,
      getState: () => ({
        currentLang,
        orderMode: activeLine()?.type || 'stem',
        hasUserSelected: cart.length > 0,
        selectedFlower,
        selectedStemQty,
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
