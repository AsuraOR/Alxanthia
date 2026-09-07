/**
 * =============================================================================
 * KOMOREBI CREATIONS — APPLICATION CONTROLLER (app.js)
 * =============================================================================
 */

(function () {
  'use strict';

  // Constants & Storage Keys
  const LANG_KEY = 'komorebi.lang';
  const CUSTOM_DATA_KEY = 'komorebi_custom_data';

  // State
  let currentLang = 'id';
  let selectedFlower = 'Sunflower';
  let selectedFormat = 'Kit';
  let siteData = null;

  /**
   * Load data directly from site-content.js (window.KOMOREBI_DATA)
   */
  function loadData() {
    try {
      localStorage.removeItem(CUSTOM_DATA_KEY);
    } catch (e) {}

    if (window.KOMOREBI_DATA) {
      siteData = JSON.parse(JSON.stringify(window.KOMOREBI_DATA));
    }
  }

  /**
   * Initialize language from localStorage or default to 'id'
   */
  function initLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'id' || saved === 'en') {
        currentLang = saved;
      }
    } catch (e) {}
    try {
      document.documentElement.lang = currentLang;
    } catch (e) {}
  }

  /**
   * Switch language and update UI
   */
  function setLanguage(lang) {
    if (lang !== 'id' && lang !== 'en') return;
    currentLang = lang;
    try {
      document.documentElement.lang = lang;
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}
    renderAll();
  }

  /**
   * Helper: Get formatted price display string
   */
  function getPriceDisplay(flower, format) {
    if (!flower || !flower.prices || !flower.prices[format]) return 'Rp 0';
    const p = flower.prices[format];
    return typeof p === 'object' ? p.display : p;
  }

  /**
   * Helper: Get option metadata (yield, time, availability, channel URLs)
   */
  function getOptionMeta(flower, format) {
    const isEn = currentLang === 'en';
    if (!flower || !flower.options || !flower.options[format]) {
      return {
        yield: isEn ? '1 stem' : '1 tangkai',
        assemblyTime: null,
        availability: 'available',
        channels: { tokopediaUrl: null, shopeeUrl: null }
      };
    }
    const opt = flower.options[format];
    return {
      yield: isEn ? opt.yieldEn : opt.yieldId,
      assemblyTime: isEn ? opt.assemblyTimeEn : opt.assemblyTimeId,
      availability: opt.availability || 'available',
      channels: opt.channels || { tokopediaUrl: null, shopeeUrl: null }
    };
  }

  /**
   * Smoothly scroll to in-page section with sticky header offset compensation
   */
  function scrollToSection(selector) {
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
  }

  /**
   * Atomic Order Selection: updates flower and/or format in a single pass
   */
  function setOrderSelection(flowerKey, formatKey, scroll = false) {
    let changed = false;
    if (flowerKey && siteData.flowers[flowerKey] && selectedFlower !== flowerKey) {
      selectedFlower = flowerKey;
      changed = true;
    }
    if (formatKey && siteData.formatKeys.includes(formatKey) && selectedFormat !== formatKey) {
      selectedFormat = formatKey;
      changed = true;
    }
    if (changed) {
      renderOrderSection();
    }
    if (scroll) {
      scrollToSection('#order');
    }
  }

  /**
   * Select a flower species
   */
  function selectFlower(flowerKey) {
    setOrderSelection(flowerKey, null, false);
  }

  /**
   * Select a format (Kit, Stem, Bouquet)
   */
  function selectFormat(formatKey) {
    setOrderSelection(null, formatKey, false);
  }

  /**
   * Quick order handler from collection card buttons
   */
  function quickOrder(flowerKey, formatKey) {
    setOrderSelection(flowerKey, formatKey, true);
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
   * Render Header & Navigation
   */
  function renderHeader(t) {
    setText('#nav-collection', t.navCollection);
    setText('#nav-kit', t.navKit);
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
   * Render Hero Section
   */
  function renderHero(t) {
    setText('#hero-eyebrow', t.heroEyebrow);
    setText('#hero-title', t.heroTitle);
    setText('#hero-sub', t.heroSub);
    setText('#cta-browse', t.ctaBrowse);
    setText('#cta-inside', t.ctaInside);

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
  function renderTrustBar(t) {
    const el = document.getElementById('trust-inner');
    if (!el) return;
    el.innerHTML = `
      <p class="trust-item"><strong>${t.tr1t}</strong><br />${t.tr1d}</p>
      <p class="trust-item"><strong>${t.tr2t}</strong><br />${t.tr2d}</p>
      <p class="trust-item"><strong>${t.tr3t}</strong><br />${t.tr3d}</p>
      <p class="trust-item"><strong>${t.tr4t}</strong><br />${t.tr4d}</p>
    `;
  }

  /**
   * Render Collection Cards Grid
   */
  function renderCollection(t) {
    setText('#col-eyebrow', t.colEyebrow);
    setText('#col-title', t.colTitle);
    setText('#col-intro', t.colIntro);

    const grid = document.getElementById('collection-grid');
    if (!grid) return;

    grid.innerHTML = '';

    siteData.flowerOrder.forEach(key => {
      const flower = siteData.flowers[key];
      if (!flower) return;
      const trans = flower[currentLang] || flower.en;
      const priceKit = getPriceDisplay(flower, 'Kit');
      const flowerAlt = currentLang === 'en'
        ? (flower.alt || `${trans.name} handcrafted from chenille stems`)
        : `${trans.name} buatan tangan dari benang chenille`;

      const card = document.createElement('article');
      card.className = 'flower-card';
      card.innerHTML = `
        <div class="flower-photo-wrapper">
          <span class="flower-accent-line" style="background:${flower.accent}"></span>
          <img src="${flower.photo}" srcset="${flower.srcset || ''}" sizes="${flower.sizes || '(max-width: 600px) 90vw, 260px'}" width="360" height="450" alt="${flowerAlt}" class="flower-photo" loading="lazy" />
        </div>
        <div class="flower-info">
          <h3 class="flower-name">${trans.name}</h3>
          <p class="flower-blurb">${trans.blurb}</p>
          <p class="flower-makes">${t.makesPrefix} ${trans.makes} · ${trans.size}</p>
          ${siteData.store.showPrices ? `<p class="flower-price">${t.kitPricePrefix} ${priceKit}</p>` : ''}
          <a href="#order" class="btn-buy-kit" data-flower="${key}" data-format="Kit">
            ${t.buyKitPrefix} ${trans.name} ${t.buyKitSuffix || ''}
          </a>
          <div class="flower-quick-links">
            <a href="#order" class="quick-link" data-flower="${key}" data-format="Stem">${t.stemLabel}</a>
            <a href="#order" class="quick-link" data-flower="${key}" data-format="Bouquet">${t.bouquetLabel}</a>
          </div>
        </div>
      `;

      const buyBtn = card.querySelector('.btn-buy-kit');
      if (buyBtn) {
        buyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          quickOrder(key, 'Kit');
        });
      }

      const stemLink = card.querySelector('[data-format="Stem"]');
      if (stemLink) {
        stemLink.addEventListener('click', (e) => {
          e.preventDefault();
          quickOrder(key, 'Stem');
        });
      }

      const bouquetLink = card.querySelector('[data-format="Bouquet"]');
      if (bouquetLink) {
        bouquetLink.addEventListener('click', (e) => {
          e.preventDefault();
          quickOrder(key, 'Bouquet');
        });
      }

      grid.appendChild(card);
    });
  }

  /**
   * Render Kit Details & Specs
   */
  function renderKit(t) {
    setText('#kit-eyebrow', t.kitEyebrow);
    setText('#kit-title', t.kitTitle);
    setText('#kit-intro', t.kitIntro);
    setAttr('#kit-image', 'src', siteData.images.kit);
    setAttr('#kit-image', 'alt', currentLang === 'en'
      ? 'Overhead view of one sunflower DIY kit with components neatly arranged'
      : 'Tampilan atas satu kit DIY bunga matahari dengan seluruh komponen tertata rapi');
    if (siteData.images.kitSrcset) {
      setAttr('#kit-image', 'srcset', siteData.images.kitSrcset);
      setAttr('#kit-image', 'sizes', siteData.images.kitSizes || '(max-width: 768px) 90vw, 540px');
    }

    // List of kit contents
    const listEl = document.getElementById('kit-list');
    if (listEl && t.kitContents) {
      listEl.innerHTML = '';
      t.kitContents.forEach((item, index) => {
        const num = String(index + 1).padStart(2, '0');
        const li = document.createElement('li');
        li.className = 'kit-list-item';
        li.innerHTML = `
          <span class="kit-list-num">${num}</span>
          <p class="kit-list-text"><strong>${item.title}</strong><br />${item.desc}</p>
        `;
        listEl.appendChild(li);
      });
    }

    // Specifications
    setText('#specs-title', t.specTitle);
    const specsEl = document.getElementById('specs-grid');
    if (specsEl && t.specs) {
      specsEl.innerHTML = '';
      t.specs.forEach(spec => {
        const div = document.createElement('div');
        div.className = 'spec-item';
        div.innerHTML = `
          <dt>${spec.label}</dt>
          <dd>${spec.value}</dd>
        `;
        specsEl.appendChild(div);
      });
    }
  }

  /**
   * Render How-It-Works Steps
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
          <p class="step-kicker">${step.kicker}</p>
          <h3 class="step-title">${step.title}</h3>
          <p class="step-desc">${step.desc}</p>
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
    setText('#mat-caption', t.matCaption);
    setText('#mat-body', t.matBody);
    setAttr('#material-image', 'src', siteData.images.macro);
    setAttr('#material-image', 'alt', currentLang === 'en'
      ? 'Close-up texture of soft chenille wire stems'
      : 'Tekstur dekat kawat bulu chenille yang lembut');
    if (siteData.images.macroSrcset) {
      setAttr('#material-image', 'srcset', siteData.images.macroSrcset);
      setAttr('#material-image', 'sizes', siteData.images.macroSizes || '(max-width: 768px) 90vw, 540px');
    }

    const pointsEl = document.getElementById('material-points');
    if (pointsEl && t.matPoints) {
      pointsEl.innerHTML = '';
      t.matPoints.forEach(pt => {
        const li = document.createElement('li');
        li.className = 'material-point-item';
        li.innerHTML = `
          <span class="material-point-num">${pt.n}</span>
          <p class="material-point-text"><strong>${pt.lead}</strong> ${pt.rest}</p>
        `;
        pointsEl.appendChild(li);
      });
    }
  }

  /**
   * Render Order Builder & Summary Box
   */
  function renderOrderSection() {
    const t = siteData.translations[currentLang] || siteData.translations.id;

    setText('#order-eyebrow', t.orderEyebrow);
    setText('#order-title', t.orderTitle);
    setText('#step1-label', t.step1);
    setText('#step2-label', t.step2);
    setText('#step3-label', t.step3);
    setText('#selection-label', t.selectionLabel);
    setText('#includes-label', t.includesLabel);

    // Step 1: Flower chips with radiogroup semantics (preserves keyboard focus)
    const flowerChipsEl = document.getElementById('flower-chips');
    if (flowerChipsEl) {
      flowerChipsEl.setAttribute('role', 'radiogroup');
      flowerChipsEl.setAttribute('aria-label', t.step1);

      const existingChips = flowerChipsEl.querySelectorAll('.chip-flower');
      if (existingChips.length === siteData.flowerOrder.length) {
        existingChips.forEach((btn, index) => {
          const key = siteData.flowerOrder[index];
          const isActive = key === selectedFlower;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      } else {
        flowerChipsEl.innerHTML = '';
        siteData.flowerOrder.forEach(key => {
          const fl = siteData.flowers[key];
          if (!fl) return;
          const flTrans = fl[currentLang] || fl.en;
          const isActive = key === selectedFlower;

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `chip-flower ${isActive ? 'active' : ''}`;
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
          btn.setAttribute('aria-label', flTrans.name);
          btn.innerHTML = `<span class="chip-dot" style="background:${fl.accent}"></span>${flTrans.name}`;
          btn.addEventListener('click', () => selectFlower(key));
          flowerChipsEl.appendChild(btn);
        });
      }
    }

    // Step 2: Formats with radiogroup semantics (preserves keyboard focus)
    const formatCardsEl = document.getElementById('format-cards');
    if (formatCardsEl) {
      formatCardsEl.setAttribute('role', 'radiogroup');
      formatCardsEl.setAttribute('aria-label', t.step2);

      const existingCards = formatCardsEl.querySelectorAll('.format-card');
      if (existingCards.length === t.formats.length) {
        existingCards.forEach((btn, index) => {
          const f = t.formats[index];
          const isActive = f.key === selectedFormat;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      } else {
        formatCardsEl.innerHTML = '';
        t.formats.forEach(f => {
          const isActive = f.key === selectedFormat;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `format-card ${isActive ? 'active' : ''}`;
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
          btn.setAttribute('aria-label', `${f.label}: ${f.note}`);
          btn.innerHTML = `
            <span class="format-label">${f.label}</span>
            <span class="format-note">${f.note}</span>
          `;
          btn.addEventListener('click', () => selectFormat(f.key));
          formatCardsEl.appendChild(btn);
        });
      }
    }

    // Summary Box
    const curFlower = siteData.flowers[selectedFlower] || siteData.flowers.Sunflower;
    const curFlowerTrans = curFlower[currentLang] || curFlower.en;
    const curFormatObj = t.formats.find(f => f.key === selectedFormat) || t.formats[0];
    const optMeta = getOptionMeta(curFlower, selectedFormat);
    const curPrice = getPriceDisplay(curFlower, selectedFormat);

    // Summary Title & Latin
    setText('#summary-title', `${curFlowerTrans.name} — ${curFormatObj.label}`);
    setText('#summary-latin', curFlower.latin);

    // Price
    const priceEl = document.getElementById('summary-price');
    if (priceEl) {
      if (siteData.store.showPrices) {
        priceEl.style.display = 'block';
        priceEl.textContent = curPrice;
      } else {
        priceEl.style.display = 'none';
      }
    }

    // Includes lines
    const includesListEl = document.getElementById('summary-includes-list');
    if (includesListEl) {
      includesListEl.innerHTML = '';
      const templateLines = t.includes[selectedFormat] || [];
      const computedLines = templateLines.map(line =>
        line.replace('{flower}', curFlowerTrans.name)
            .replace('{size}', curFlowerTrans.size)
            .replace('{yield}', optMeta.yield)
      );

      // If kit, also show yield and assembly time clearly
      if (selectedFormat === 'Kit') {
        const timeNote = optMeta.assemblyTime ? ` · ${optMeta.assemblyTime}` : '';
        computedLines.push(`${t.makesPrefix} ${optMeta.yield}${timeNote} · ${curFlowerTrans.size}`);
      }

      computedLines.forEach(line => {
        const li = document.createElement('li');
        li.className = 'summary-includes-item';
        li.innerHTML = `<span class="bullet-dot">·</span><span>${line}</span>`;
        includesListEl.appendChild(li);
      });
    }

    // Step 3: Marketplace & WhatsApp Links
    const ch = siteData.store.channels;
    const btnTokopedia = document.getElementById('btn-tokopedia');
    const btnShopee = document.getElementById('btn-shopee');
    const btnWhatsapp = document.getElementById('btn-whatsapp');

    const tokopUrl = optMeta.channels?.tokopediaUrl || siteData.store.tokopediaUrl;
    const shopUrl = optMeta.channels?.shopeeUrl || siteData.store.shopeeUrl;

    if (btnTokopedia) {
      btnTokopedia.style.display = ch.showTokopedia ? 'flex' : 'none';
      if (tokopUrl) {
        btnTokopedia.href = tokopUrl;
        btnTokopedia.removeAttribute('aria-disabled');
        btnTokopedia.classList.remove('btn-disabled');
        btnTokopedia.querySelector('.channel-action').textContent = t.openLabel;
      } else {
        btnTokopedia.removeAttribute('href');
        btnTokopedia.setAttribute('aria-disabled', 'true');
        btnTokopedia.classList.add('btn-disabled');
        btnTokopedia.querySelector('.channel-action').textContent = t.channelComingSoon || 'segera hadir';
      }
    }

    if (btnShopee) {
      btnShopee.style.display = ch.showShopee ? 'flex' : 'none';
      if (shopUrl) {
        btnShopee.href = shopUrl;
        btnShopee.removeAttribute('aria-disabled');
        btnShopee.classList.remove('btn-disabled');
        btnShopee.querySelector('.channel-action').textContent = t.openLabel;
      } else {
        btnShopee.removeAttribute('href');
        btnShopee.setAttribute('aria-disabled', 'true');
        btnShopee.classList.add('btn-disabled');
        btnShopee.querySelector('.channel-action').textContent = t.channelComingSoon || 'segera hadir';
      }
    }

    if (btnWhatsapp) {
      btnWhatsapp.style.display = ch.showWhatsapp ? 'flex' : 'none';
      btnWhatsapp.classList.remove('btn-disabled');
      const waNumber = (siteData.store.whatsappNumber || '').replace(/[^0-9]/g, '');
      const waTpl = currentLang === 'en'
        ? (siteData.store.whatsappTemplateEn || 'Hello! I want to order {flower} — {format} ({quantity}, {price})')
        : (siteData.store.whatsappTemplateId || 'Halo! Saya ingin memesan {flower} — {format} ({quantity}, {price})');

      const waMsg = waTpl
        .replace('{flower}', curFlowerTrans.name)
        .replace('{format}', curFormatObj.label)
        .replace('{quantity}', optMeta.yield)
        .replace('{price}', curPrice);

      btnWhatsapp.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
      btnWhatsapp.querySelector('.channel-name').textContent = t.waLabel;
      btnWhatsapp.querySelector('.channel-action').textContent = t.messageLabel;
    }

    // Dynamic order note: honest marketplace status & WhatsApp notice
    const hasMarketplaceListing = Boolean(tokopUrl || shopUrl);
    const orderNoteText = hasMarketplaceListing
      ? t.orderNote
      : `${t.channelUnavailableNotice || t.orderNote} ${t.waDraftNotice || ''}`;
    setText('#order-note', orderNoteText);

    // Polite live region announcement
    const announcer = document.getElementById('order-announcer');
    if (announcer) {
      const announceText = currentLang === 'en'
        ? `${curFlowerTrans.name} — ${curFormatObj.label} selected. Price ${curPrice}.`
        : `${curFlowerTrans.name} — ${curFormatObj.label} dipilih. Harga ${curPrice}.`;
      announcer.textContent = announceText;
    }

    // Update sticky mobile order bar
    setText('#sticky-order-title', `${curFlowerTrans.name} — ${curFormatObj.label}`);
    setText('#sticky-order-price', curPrice);
    setText('#sticky-order-cta', `${t.navOrder || 'Pesan'} →`);
  }

  /**
   * Render FAQ Section (Accessible Accordion / Disclosure)
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
        // Open the first FAQ by default for immediate context
        if (index === 0) details.open = true;
        details.innerHTML = `
          <summary class="faq-summary">
            <h3 class="faq-question">${item.q}</h3>
            <span class="faq-icon" aria-hidden="true">+</span>
          </summary>
          <div class="faq-answer">
            <p>${item.a}</p>
          </div>
        `;
        faqAccordion.appendChild(details);
      });
    }
  }

  /**
   * Render About Section
   */
  function renderAbout(t) {
    setText('#about-eyebrow', t.aboutEyebrow);
    setText('#about-lede', t.aboutLede);
    setText('#about-body', t.aboutBody);
    setText('#about-ig', t.aboutIg);
    setAttr('#about-ig', 'href', siteData.store.instagramUrl || '#');
    setAttr('#about-image', 'src', siteData.images.us);
    setAttr('#about-image', 'alt', currentLang === 'en'
      ? 'Handcrafting flower stems and packing kits at the workshop table'
      : 'Proses pembuatan tangkai bunga dan pengemasan kit di meja workshop');
    if (siteData.images.usSrcset) {
      setAttr('#about-image', 'srcset', siteData.images.usSrcset);
      setAttr('#about-image', 'sizes', siteData.images.usSizes || '(max-width: 768px) 90vw, 540px');
    }
  }

  /**
   * Render Footer
   */
  function renderFooter(t) {
    setText('#footer-care', t.footerCare);
    setText('#footer-copyright', t.copyright || '© 2026 Komorebi');

    setAttr('#footer-link-ig', 'href', siteData.store.instagramUrl || '#');
    setAttr('#footer-link-tokopedia', 'href', siteData.store.tokopediaUrl || '#');
    setAttr('#footer-link-shopee', 'href', siteData.store.shopeeUrl || '#');
  }

  /**
   * Master Render Function
   */
  function renderAll() {
    const t = siteData.translations[currentLang] || siteData.translations.id;
    renderHeader(t);
    renderHero(t);
    renderTrustBar(t);
    renderCollection(t);
    renderKit(t);
    renderHowTo(t);
    renderMaterial(t);
    renderOrderSection();
    renderFaq(t);
    renderAbout(t);
    renderFooter(t);
  }

  const AUTH_KEY = 'komorebi_unlocked';

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

    // If disabled in site-content.js, unlock automatically
    if (!authConfig.enabled) {
      if (lockScreen) lockScreen.classList.add('unlocked');
      if (relockBtn) relockBtn.style.display = 'none';
      updateLockA11y(false);
      return;
    }

    // Check if previously unlocked
    try {
      if (localStorage.getItem(AUTH_KEY) === 'true') {
        if (lockScreen) lockScreen.classList.add('unlocked');
        updateLockA11y(false);
      } else {
        if (lockScreen) lockScreen.classList.remove('unlocked');
        updateLockA11y(true);
        if (passInput) passInput.focus();
      }
    } catch (e) {
      updateLockA11y(false);
    }

    // Form submission
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
          if (lockScreen) lockScreen.classList.add('unlocked');
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

    // Relock button in footer
    if (relockBtn) {
      relockBtn.addEventListener('click', function (e) {
        e.preventDefault();
        try {
          localStorage.removeItem(AUTH_KEY);
        } catch (err) {}
        if (lockScreen) {
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
      if (!heroVisible && !orderVisible && !footerVisible) {
        stickyBar.classList.add('visible');
        stickyBar.setAttribute('aria-hidden', 'false');
      } else {
        stickyBar.classList.remove('visible');
        stickyBar.setAttribute('aria-hidden', 'true');
      }
    }

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
        scrollToSection('#order');
        setTimeout(() => {
          const activeChip = document.querySelector('.chip-flower.active') || document.querySelector('.chip-flower');
          if (activeChip) activeChip.focus();
        }, 350);
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

    // Mobile Navigation Toggle
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    function openNavMenu() {
      if (!navMenu || !navToggle) return;
      navMenu.classList.add('open');
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', currentLang === 'en' ? 'Close navigation menu' : 'Tutup menu navigasi');
      const firstLink = navMenu.querySelector('.nav-link');
      if (firstLink) firstLink.focus();
    }

    function closeNavMenu() {
      if (!navMenu || !navToggle) return;
      navMenu.classList.remove('open');
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

    // Escape closes mobile nav and restores focus
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu && navMenu.classList.contains('open')) {
        closeNavMenu();
        if (navToggle) navToggle.focus();
      }
    });

    // Close when clicking outside header
    document.addEventListener('click', (e) => {
      if (navMenu && navMenu.classList.contains('open')) {
        const header = document.querySelector('.site-header');
        if (header && !header.contains(e.target)) {
          closeNavMenu();
        }
      }
    });

    // Close when clicking nav links
    document.querySelectorAll('.nav-link, .nav-cta, .nav-cta-mobile').forEach(link => {
      link.addEventListener('click', () => {
        closeNavMenu();
      });
    });

    // Brand link scroll to top
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

    // Initialize Sticky Order Bar
    initStickyOrderBar();
  }

  /**
   * Initialize App
   */
  function init() {
    loadData();
    initLang();
    setupEventListeners();
    setupAuth();
    renderAll();

    // Export API for Visual Editor
    window.KomorebiApp = {
      getData: () => siteData,
      setData: (newData) => {
        siteData = newData;
        renderAll();
      },
      getCurrentLang: () => currentLang,
      setLanguage: setLanguage,
      renderAll: renderAll,
      reloadOriginal: () => {
        localStorage.removeItem(CUSTOM_DATA_KEY);
        siteData = JSON.parse(JSON.stringify(window.KOMOREBI_DATA));
        renderAll();
      }
    };
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
