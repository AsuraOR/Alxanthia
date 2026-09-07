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
  }

  /**
   * Switch language and update UI
   */
  function setLanguage(lang) {
    if (lang !== 'id' && lang !== 'en') return;
    currentLang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}
    renderAll();
  }

  /**
   * Select a flower species
   */
  function selectFlower(flowerKey) {
    if (siteData.flowers[flowerKey]) {
      selectedFlower = flowerKey;
      renderOrderSection();
    }
  }

  /**
   * Select a format (Kit, Stem, Bouquet)
   */
  function selectFormat(formatKey) {
    if (siteData.formatKeys.includes(formatKey)) {
      selectedFormat = formatKey;
      renderOrderSection();
    }
  }

  /**
   * Quick order handler from collection card buttons
   */
  function quickOrder(flowerKey, formatKey) {
    selectFlower(flowerKey);
    selectFormat(formatKey);
    const orderSection = document.getElementById('order');
    if (orderSection) {
      orderSection.scrollIntoView({ behavior: 'smooth' });
    }
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
   * Helper: safe attribute replacement
   */
  function setAttr(selector, attr, val) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el && val !== undefined && val !== null) {
      el.setAttribute(attr, val);
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

    const btnId = document.getElementById('lang-id');
    const btnEn = document.getElementById('lang-en');
    if (btnId && btnEn) {
      if (currentLang === 'id') {
        btnId.classList.add('active');
        btnEn.classList.remove('active');
      } else {
        btnId.classList.remove('active');
        btnEn.classList.add('active');
      }
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
      const priceKit = flower.prices.Kit;

      const card = document.createElement('article');
      card.className = 'flower-card';
      card.innerHTML = `
        <div class="flower-photo-wrapper">
          <span class="flower-accent-line" style="background:${flower.accent}"></span>
          <img src="${flower.photo}" alt="${flower.alt || trans.name}" class="flower-photo" loading="lazy" />
        </div>
        <div class="flower-info">
          <h3 class="flower-name">${trans.name}</h3>
          <p class="flower-blurb">${trans.blurb}</p>
          <p class="flower-makes">${t.makesPrefix} ${trans.makes} · ${trans.size}</p>
          ${siteData.store.showPrices ? `<p class="flower-price">${t.kitPricePrefix} ${priceKit}</p>` : ''}
          <a href="#order" class="btn-buy-kit" data-flower="${key}" data-format="Kit" style="background:#23201B">
            ${t.buyKitPrefix} ${trans.name} ${t.buyKitSuffix || ''}
          </a>
          <div class="flower-quick-links">
            <a href="#order" class="quick-link" data-flower="${key}" data-format="Stem">${t.stemLabel}</a>
            <a href="#order" class="quick-link" data-flower="${key}" data-format="Bouquet">${t.bouquetLabel}</a>
          </div>
        </div>
      `;

      // Hover color on buy kit button
      const buyBtn = card.querySelector('.btn-buy-kit');
      if (buyBtn) {
        buyBtn.addEventListener('mouseenter', () => { buyBtn.style.backgroundColor = flower.accent; });
        buyBtn.addEventListener('mouseleave', () => { buyBtn.style.backgroundColor = '#23201B'; });
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
    setText('#order-note', t.orderNote);

    // Step 1: Flower chips
    const flowerChipsEl = document.getElementById('flower-chips');
    if (flowerChipsEl) {
      flowerChipsEl.innerHTML = '';
      siteData.flowerOrder.forEach(key => {
        const fl = siteData.flowers[key];
        if (!fl) return;
        const flTrans = fl[currentLang] || fl.en;
        const isActive = key === selectedFlower;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip-flower ${isActive ? 'active' : ''}`;
        btn.innerHTML = `<span class="chip-dot" style="background:${fl.accent}"></span>${flTrans.name}`;
        btn.addEventListener('click', () => selectFlower(key));
        flowerChipsEl.appendChild(btn);
      });
    }

    // Step 2: Formats
    const formatCardsEl = document.getElementById('format-cards');
    if (formatCardsEl) {
      formatCardsEl.innerHTML = '';
      t.formats.forEach(f => {
        const isActive = f.key === selectedFormat;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `format-card ${isActive ? 'active' : ''}`;
        btn.innerHTML = `
          <span class="format-label">${f.label}</span>
          <span class="format-note">${f.note}</span>
        `;
        btn.addEventListener('click', () => selectFormat(f.key));
        formatCardsEl.appendChild(btn);
      });
    }

    // Summary Box
    const curFlower = siteData.flowers[selectedFlower] || siteData.flowers.Sunflower;
    const curFlowerTrans = curFlower[currentLang] || curFlower.en;
    const curFormatObj = t.formats.find(f => f.key === selectedFormat) || t.formats[0];

    // Summary Title & Latin
    setText('#summary-title', `${curFlowerTrans.name} — ${curFormatObj.label}`);
    setText('#summary-latin', curFlower.latin);

    // Price
    const priceEl = document.getElementById('summary-price');
    const curPrice = curFlower.prices[selectedFormat] || 'Rp 0';
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
        line.replace('{flower}', curFlowerTrans.name).replace('{size}', curFlowerTrans.size)
      );

      // If kit, also append makes line
      if (selectedFormat === 'Kit') {
        computedLines.push(`${t.makesPrefix} ${curFlowerTrans.makes} · ${curFlowerTrans.size}`);
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

    if (btnTokopedia) {
      btnTokopedia.style.display = ch.showTokopedia ? 'flex' : 'none';
      btnTokopedia.href = siteData.store.tokopediaUrl || '#';
      btnTokopedia.querySelector('.channel-action').textContent = t.openLabel;
    }

    if (btnShopee) {
      btnShopee.style.display = ch.showShopee ? 'flex' : 'none';
      btnShopee.href = siteData.store.shopeeUrl || '#';
      btnShopee.querySelector('.channel-action').textContent = t.openLabel;
    }

    if (btnWhatsapp) {
      btnWhatsapp.style.display = ch.showWhatsapp ? 'flex' : 'none';
      const waNumber = siteData.store.whatsappNumber.replace(/[^0-9]/g, '');
      const waTpl = currentLang === 'en'
        ? (siteData.store.whatsappTemplateEn || 'Hello! I want to order {flower} — {format} ({price})')
        : (siteData.store.whatsappTemplateId || 'Halo! Saya ingin memesan {flower} — {format} ({price})');

      const waMsg = waTpl
        .replace('{flower}', curFlowerTrans.name)
        .replace('{format}', curFormatObj.label)
        .replace('{price}', curPrice);

      btnWhatsapp.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
      btnWhatsapp.querySelector('.channel-name').textContent = t.waLabel;
      btnWhatsapp.querySelector('.channel-action').textContent = t.messageLabel;
    }
  }

  /**
   * Render FAQ Section
   */
  function renderFaq(t) {
    setText('#faq-eyebrow', t.faqEyebrow);
    setText('#faq-title', t.faqTitle);

    const faqGrid = document.getElementById('faq-grid');
    if (faqGrid && t.faqs) {
      faqGrid.innerHTML = '';
      t.faqs.forEach(item => {
        const div = document.createElement('div');
        div.className = 'faq-card';
        div.innerHTML = `
          <h3 class="faq-question">${item.q}</h3>
          <p class="faq-answer">${item.a}</p>
        `;
        faqGrid.appendChild(div);
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

  /**
   * Global event listeners
   */
  function setupEventListeners() {
    const btnId = document.getElementById('lang-id');
    const btnEn = document.getElementById('lang-en');

    if (btnId) btnId.addEventListener('click', () => setLanguage('id'));
    if (btnEn) btnEn.addEventListener('click', () => setLanguage('en'));
  }

  /**
   * Initialize App
   */
  function init() {
    loadData();
    initLang();
    setupEventListeners();
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
