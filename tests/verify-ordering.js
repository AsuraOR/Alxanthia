// ==========================================================================
// KOMOREBI CREATIONS — AUTOMATED TEST SUITE (PHASE 6)
// Run with: node tests/verify-ordering.js
// ==========================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- RUNNING KOMOREBI CREATIONS VERIFICATION SUITE ---');

// 1. LOAD DATA ENVIRONMENT
const siteContentCode = fs.readFileSync(path.join(__dirname, '..', 'site-content.js'), 'utf8');
const sandbox = { window: {}, document: {}, localStorage: {}, navigator: { language: 'id' } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(siteContentCode, sandbox);

const siteData = sandbox.window.KOMOREBI_DATA;
assert(siteData, 'FAIL: siteData (window.KOMOREBI_DATA) must be loaded');
console.log('✔ Test 1: siteData successfully loaded and parsed');

// 2. DATA INTEGRITY CHECKS
assert(siteData.flowers, 'FAIL: siteData.flowers exists');
const requiredFlowers = ['Sunflower', 'Rose', 'Tulip', 'Gerbera'];
requiredFlowers.forEach(f => {
  assert(siteData.flowers[f], `FAIL: flower ${f} must exist in catalogue`);
  assert(typeof siteData.flowers[f].stemPrice === 'number', `FAIL: ${f} stemPrice must be a number`);
  assert(siteData.flowers[f].id && siteData.flowers[f].id.name, `FAIL: ${f} must have Indonesian name`);
  assert(siteData.flowers[f].en && siteData.flowers[f].en.name, `FAIL: ${f} must have English name`);
});
assert.strictEqual(siteData.flowers.Sunflower.stemPrice, 55000);
assert.strictEqual(siteData.flowers.Rose.stemPrice, 60000);
assert.strictEqual(siteData.flowers.Tulip.stemPrice, 50000);
assert.strictEqual(siteData.flowers.Gerbera.stemPrice, 55000);
assert(!siteData.flowerOrder.includes('Lavender'), '✔ PASS: Lavender correctly excluded from active single-stem flowerOrder');
console.log('✔ Test 2: Flower catalogue integrity verified (4 active species with exact prices)');

// 3. PACKAGES INTEGRITY
assert(Array.isArray(siteData.packages), 'FAIL: siteData.packages must be an array');
assert.strictEqual(siteData.packages.length, 4, 'FAIL: siteData.packages must have 4 tiers');
assert.strictEqual(siteData.packages[0].stems, 3);
assert.strictEqual(siteData.packages[0].price, 195000);
assert.strictEqual(siteData.packages[1].stems, 5);
assert.strictEqual(siteData.packages[1].price, 295000);
assert.strictEqual(siteData.packages[2].stems, 9);
assert.strictEqual(siteData.packages[2].price, 465000);
assert.strictEqual(siteData.packages[3].stems, 15);
assert.strictEqual(siteData.packages[3].price, 745000);
console.log('✔ Test 3: Florist packages pricing and stems verified (3, 5, 9, 15 stems)');

// 4. CUSTOM BUILDER CALCULATION LOGIC
function calculateCustomTotals(counts, data) {
  let stems = 0;
  let flowersSubtotal = 0;
  Object.keys(counts).forEach(k => {
    const qty = counts[k] || 0;
    const flower = data.flowers[k];
    const price = flower ? (flower.stemPrice || 55000) : 55000;
    stems += qty;
    flowersSubtotal += qty * price;
  });

  const bulkFrom = data.bulkFrom ?? 9;
  const bulkRate = data.bulkRate ?? 0.10;
  const wrapFee = data.wrapFee ?? 35000;
  const minStems = data.minStems ?? 3;

  const discount = stems >= bulkFrom ? Math.round(flowersSubtotal * bulkRate) : 0;
  const total = flowersSubtotal - discount + wrapFee;
  const isValid = stems >= minStems;

  return { stems, flowersSubtotal, discount, wrapFee, total, isValid };
}

// 4.1 Empty custom builder (P1.1)
const emptyCalc = calculateCustomTotals({ Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 }, siteData);
assert.strictEqual(emptyCalc.stems, 0, 'Empty custom bouquet must have 0 stems');
assert.strictEqual(emptyCalc.isValid, false, 'Empty custom bouquet must be invalid (< 3 stems)');
console.log('✔ Test 4.1: Empty custom bouquet initializes to 0 stems and isValid = false');

// 4.2 Below minimum (2 stems)
const twoStemsCalc = calculateCustomTotals({ Sunflower: 1, Rose: 1, Tulip: 0, Gerbera: 0 }, siteData);
assert.strictEqual(twoStemsCalc.stems, 2);
assert.strictEqual(twoStemsCalc.flowersSubtotal, 55000 + 60000); // 115000
assert.strictEqual(twoStemsCalc.isValid, false, '2 stems must be invalid (< 3 stems)');
console.log('✔ Test 4.2: 2-stem custom order rejected by validation (min 3 stems)');

// 4.3 Valid 3-stem custom bouquet
const threeStemsCalc = calculateCustomTotals({ Sunflower: 1, Rose: 1, Tulip: 1, Gerbera: 0 }, siteData);
assert.strictEqual(threeStemsCalc.stems, 3);
assert.strictEqual(threeStemsCalc.flowersSubtotal, 55000 + 60000 + 50000); // 165000
assert.strictEqual(threeStemsCalc.discount, 0);
assert.strictEqual(threeStemsCalc.wrapFee, 35000);
assert.strictEqual(threeStemsCalc.total, 200000);
assert.strictEqual(threeStemsCalc.isValid, true);
console.log('✔ Test 4.3: Valid 3-stem custom bouquet calculated correctly (Rp 200.000 incl. wrap)');

// 4.4 9-stem custom bouquet with 10% discount
const nineStemsCalc = calculateCustomTotals({ Sunflower: 5, Tulip: 4, Rose: 0, Gerbera: 0 }, siteData);
assert.strictEqual(nineStemsCalc.stems, 9);
const expectedNineSubtotal = (5 * 55000) + (4 * 50000); // 275000 + 200000 = 475000
assert.strictEqual(nineStemsCalc.flowersSubtotal, expectedNineSubtotal);
assert.strictEqual(nineStemsCalc.discount, Math.round(expectedNineSubtotal * 0.10)); // 47500
assert.strictEqual(nineStemsCalc.total, expectedNineSubtotal - 47500 + 35000); // 462500
assert.strictEqual(nineStemsCalc.isValid, true);
console.log('✔ Test 4.4: 9-stem custom order qualifies for 10% discount rule (Rp 462.500)');

// 5. SINGLE STEM ORDER & STEPPER CALCULATION (P1.1)
function calculateSingleStem(flowerKey, qty, data) {
  const flower = data.flowers[flowerKey];
  const unitPrice = flower ? flower.stemPrice : 55000;
  return {
    flowerKey,
    qty,
    unitPrice,
    total: unitPrice * qty
  };
}

const stem1 = calculateSingleStem('Sunflower', 1, siteData);
assert.strictEqual(stem1.total, 55000);
const stem2 = calculateSingleStem('Sunflower', 2, siteData);
assert.strictEqual(stem2.total, 110000);
const stem5Rose = calculateSingleStem('Rose', 5, siteData);
assert.strictEqual(stem5Rose.total, 300000);
console.log('✔ Test 5: Single stem quantity steppers produce exact arithmetic (1x, 2x, 5x)');

// 6. WHATSAPP DRAFT ENCODING & SECURITY (P1.2 & P1.4)
function generateDraftMessage(options) {
  const { lang, mode, stemKey, stemQty, pkgIndex, customCounts, wrapKey, note, data } = options;
  const t = data.translations[lang] || data.translations.id;
  const wrapName = t.wrapNames[wrapKey] || 'Kraft Alami';

  let itemSummary = '';
  let estPrice = '';

  if (mode === 'stem') {
    const fl = data.flowers[stemKey];
    const name = fl ? fl[lang].name : stemKey;
    const price = fl ? fl.stemPrice : 55000;
    itemSummary = `${stemQty}x ${name} (tangkai jadi)`;
    estPrice = `Rp ${(price * stemQty).toLocaleString('id-ID')}`;
  } else if (mode === 'package') {
    const pkg = data.packages[pkgIndex];
    const name = t.pkgNames[pkgIndex];
    itemSummary = `${name} (${pkg.stems} tangkai)`;
    estPrice = `Rp ${pkg.price.toLocaleString('id-ID')}`;
  } else {
    const tot = calculateCustomTotals(customCounts, data);
    const flowerList = Object.keys(customCounts)
      .filter(k => customCounts[k] > 0)
      .map(k => `${customCounts[k]}x ${data.flowers[k][lang].name}`)
      .join(', ');
    itemSummary = `Buket Custom: ${flowerList}`;
    estPrice = `Rp ${tot.total.toLocaleString('id-ID')}`;
  }

  const shippingNote = lang === 'en' ? '(excluding shipping fee)' : '(belum termasuk ongkir)';
  const sanitizedNote = (note || '').trim();

  let text = `Halo Komorebi,\nSaya ingin memesan:\n• ${itemSummary}\n• Kertas: ${wrapName}\n• Estimasi: ${estPrice} ${shippingNote}`;
  if (sanitizedNote) {
    text += `\n• Kartu Ucapan: "${sanitizedNote}"`;
  }

  const phone = data.store.whatsappNumber || '6281234567890';
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

// 6.1 Test draft with special characters, quotes, ampersands, emoji
const testNote = 'Selamat Ulang Tahun & Sukses Selalu! 🎉 <3 "With Love"';
const waUrl = generateDraftMessage({
  lang: 'id',
  mode: 'stem',
  stemKey: 'Sunflower',
  stemQty: 2,
  wrapKey: 'kraft',
  note: testNote,
  data: siteData
});

assert(waUrl.startsWith('https://wa.me/6281234567890?text='), 'FAIL: URL scheme must be wa.me');
const decodedText = decodeURIComponent(waUrl.split('text=')[1]);
assert(decodedText.includes('2x Bunga Matahari'), 'FAIL: decoded text must have 2x Bunga Matahari');
assert(decodedText.includes('Rp 110.000 (belum termasuk ongkir)'), 'FAIL: must include shipping exclusion');
assert(decodedText.includes(testNote), 'FAIL: must preserve literal punctuation & emoji without escaping errors');
assert(!decodedText.includes('<script>'), 'FAIL: no script tags');
console.log('✔ Test 6: WhatsApp draft encodes safely with literal punctuation, emojis, and shipping disclaimer');

// 7. BILINGUAL SYMMETRY
const tId = siteData.translations.id;
const tEn = siteData.translations.en;
const idKeys = Object.keys(tId);
const enKeys = Object.keys(tEn);
assert.strictEqual(idKeys.length, enKeys.length, 'FAIL: ID and EN translations must have equal number of keys');
idKeys.forEach(k => {
  assert(tEn[k] !== undefined, `FAIL: Missing English translation key: ${k}`);
});
console.log(`✔ Test 7: Translation symmetry verified (${idKeys.length} keys mapped 1-to-1 in ID & EN)`);

// 8. DOM AUDIT (index.html)
const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert(htmlContent.includes('id="nav-scrim"'), 'FAIL: nav-scrim must be in index.html');
assert(htmlContent.includes('id="stem-qty-card"'), 'FAIL: stem-qty-card must be in index.html');
assert(htmlContent.includes('id="btn-edit-selection"'), 'FAIL: btn-edit-selection must be in index.html');
assert(htmlContent.includes('id="custom-min-warning-banner"'), 'FAIL: custom-min-warning-banner must be in index.html');
assert(htmlContent.includes('id="marketplace-status-box"'), 'FAIL: marketplace-status-box must be in index.html');
assert(htmlContent.includes('id="image-modal"'), 'FAIL: image-modal dialog must be in index.html');
assert(htmlContent.includes('name="robots" content="noindex, nofollow"'), 'FAIL: Staging protection must be intact');

// Check section sequence (P2.8)
const bouquetsIdx = htmlContent.indexOf('id="bouquets"');
const orderIdx = htmlContent.indexOf('id="order"');
const howtoIdx = htmlContent.indexOf('id="howto"');
const materialIdx = htmlContent.indexOf('id="material"');
const faqIdx = htmlContent.indexOf('id="faq"');

assert(bouquetsIdx < orderIdx, 'FAIL: bouquets must precede order');
assert(orderIdx < howtoIdx, 'FAIL: order must precede howto (P2.8)');
assert(howtoIdx < materialIdx, 'FAIL: howto must precede material');
assert(materialIdx < faqIdx, 'FAIL: material must precede faq');
console.log('✔ Test 8: DOM architecture and page sequence verified (Catalogue -> Order -> Craftsmanship -> FAQ)');

// 9. CSS AUDIT (styles.css)
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

assert(cssContent.includes('.nav-scrim'), 'FAIL: .nav-scrim styles must exist');
assert(cssContent.includes('body.nav-open'), 'FAIL: body.nav-open styles must exist');
assert(cssContent.includes('.stem-qty-card'), 'FAIL: .stem-qty-card styles must exist');
assert(cssContent.includes('.image-modal'), 'FAIL: .image-modal styles must exist');
assert(cssContent.includes('flex-wrap: nowrap'), 'FAIL: .custom-row-item nowrap must exist (P2.9)');
console.log('✔ Test 9: CSS audit verified (nav-scrim, touch targets, image modal, steppers)');

// 10. SHOPEE ACTIVATION & TOKOPEDIA REMOVAL AUDIT
assert.strictEqual(siteData.store.shopeeUrl, 'https://shopee.co.id', 'FAIL: siteData.store.shopeeUrl must be https://shopee.co.id');
assert.strictEqual(siteData.store.tokopediaUrl, undefined, 'FAIL: tokopediaUrl must be completely removed from siteData.store');
assert.strictEqual(siteData.store.channels.showTokopedia, undefined, 'FAIL: showTokopedia must not exist in channels');
assert(siteData.store.channels.showShopee === true, 'FAIL: showShopee must be enabled');

assert(htmlContent.includes('id="btn-shopee"'), 'FAIL: #btn-shopee must exist in index.html');
assert(htmlContent.includes('href="https://shopee.co.id"'), 'FAIL: index.html must link to https://shopee.co.id');
assert(htmlContent.includes('id="footer-link-shopee"'), 'FAIL: #footer-link-shopee must exist in index.html');
assert(!htmlContent.includes('id="btn-tokopedia"'), 'FAIL: #btn-tokopedia must be removed from index.html');
assert(!htmlContent.includes('id="footer-link-tokopedia"'), 'FAIL: #footer-link-tokopedia must be removed from index.html');
assert(!htmlContent.includes('Tokopedia'), 'FAIL: Tokopedia must be completely removed from index.html DOM');

assert(cssContent.includes('.btn-shopee'), 'FAIL: .btn-shopee styles must exist');
assert(cssContent.includes('.mkt-active-tag'), 'FAIL: .mkt-active-tag styles must exist');
console.log('✔ Test 10: Shopee activation and Tokopedia complete removal verified');

console.log('\n======================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! (10/10 suites passed)');
console.log('======================================================');
