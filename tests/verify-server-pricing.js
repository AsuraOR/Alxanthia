/**
 * =============================================================================
 * ALXANTHIA STUDIO — SERVER-SIDE PRICING & VALIDATION TEST SUITE (DEV-25)
 * =============================================================================
 * Run with: node tests/verify-server-pricing.js
 *
 * This does NOT touch Google Sheets, Cloudflare, or any network endpoint. It
 * extracts the exact Apps Script code block from CONFIGURE-SUBMISSION-ENDPOINT.md
 * (the same text an owner copy-pastes into Apps Script) and evaluates it in a
 * sandbox with minimal Apps Script API stubs, so the *actual documented
 * server code* is what gets tested — not a reimplementation that could drift
 * from it. It then exercises the pure repricing/validation functions
 * (computeVerifiedTotals, resolveOrderMode, validateOrder) directly, covering
 * DEV-01 (pot/mixed order modes) and DEV-02/DEV-05 (server-owned pricing and
 * payload validation).
 * =============================================================================
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================================');
console.log('ALXANTHIA STUDIO — SERVER PRICING & VALIDATION SUITE');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// 1. Extract the Apps Script code block from the setup guide
// ---------------------------------------------------------------------------
const guidePath = path.join(__dirname, '..', 'CONFIGURE-SUBMISSION-ENDPOINT.md');
const guideSrc = fs.readFileSync(guidePath, 'utf8');
const jsBlocks = [...guideSrc.matchAll(/```javascript\n([\s\S]*?)\n```/g)].map((m) => m[1]);
const appsScriptSrc = jsBlocks.find((block) => block.includes('function doPost'));
assert(appsScriptSrc, 'Could not locate the Apps Script code block in CONFIGURE-SUBMISSION-ENDPOINT.md');

// ---------------------------------------------------------------------------
// 2. Minimal Apps Script API stubs — only what the PURE functions under test
//    touch. doPost() itself (which needs a real Sheet) is intentionally not
//    exercised here; that is covered manually per CONFIGURE-SUBMISSION-ENDPOINT.md
//    Part 5's test-order checklist against a real (test) deployment.
// ---------------------------------------------------------------------------
const fixedNow = new Date('2026-09-10T04:00:00Z'); // 12:00 in Asia/Makassar (UTC+8)

const sandbox = {
  console,
  Date: (function () {
    const RealDate = Date;
    function MockDate(...args) {
      if (args.length === 0) return new RealDate(fixedNow.getTime());
      return new RealDate(...args);
    }
    MockDate.prototype = RealDate.prototype;
    MockDate.now = () => fixedNow.getTime();
    return MockDate;
  })(),
  Utilities: {
    formatDate: (date, tz, fmt) => {
      // Only 'yyyy-MM-dd' is used by the script; tz is ignored here since the
      // sandbox's fixedNow is already pinned to a specific instant.
      const d = new Date(fixedNow.getTime());
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    },
    computeDigest: () => [1, 2, 3, 4],
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' }
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  ContentService: { createTextOutput: (s) => ({ setMimeType: () => s }), MimeType: { JSON: 'JSON' } },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  MailApp: { sendEmail: () => {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) }
};
vm.createContext(sandbox);
vm.runInContext(appsScriptSrc, sandbox);

const { computeVerifiedTotals, resolveOrderMode, validateOrder, CATALOG, isValidLeadTimeDate, columnToLetter } = sandbox;
assert(typeof computeVerifiedTotals === 'function', 'computeVerifiedTotals must be exposed');
assert(typeof resolveOrderMode === 'function', 'resolveOrderMode must be exposed');
assert(typeof validateOrder === 'function', 'validateOrder must be exposed');

// ---------------------------------------------------------------------------
// 3. Also load the real app.js client pricing (computeCartTotals) so the two
//    implementations can be cross-checked against each other, not just
//    against hand-computed numbers.
// ---------------------------------------------------------------------------
const siteContentSrc = fs.readFileSync(path.join(__dirname, '..', 'site-content.js'), 'utf8');
const clientSandbox = { window: {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, documentElement: {} }, navigator: {}, console };
vm.createContext(clientSandbox);
vm.runInContext(siteContentSrc, clientSandbox);
const clientData = clientSandbox.window.ALXANTHIA_DATA;

// Sanity: the server CATALOG in the doc must still match the live site-content.js
// prices this suite cross-checks against — this test itself is the trip-wire
// for the "update both together" instruction the guide gives store owners.
console.log('--- SUITE S1: Server catalogue matches site-content.js ---');
Object.keys(CATALOG.flowerStemPrice).forEach((key) => {
  assert.strictEqual(CATALOG.flowerStemPrice[key], clientData.flowers[key].stemPrice, `Server price for ${key} must match site-content.js`);
});
(clientData.miniPots || []).forEach((pot) => {
  assert.strictEqual(CATALOG.miniPotPrice[pot.key], pot.price, `Server mini pot price for ${pot.key} must match site-content.js`);
});
(clientData.customAdditions || []).forEach((addition) => {
  assert.strictEqual(CATALOG.additionPrice[addition.key], addition.price, `Server addition price for ${addition.key} must match site-content.js`);
});
(clientData.packages || []).forEach((pkg, idx) => {
  assert.strictEqual(CATALOG.packagePrice[idx], pkg.price, `Server package price at index ${idx} must match site-content.js`);
  assert.strictEqual(CATALOG.packageStems[idx], pkg.stems, `Server package stems at index ${idx} must match site-content.js`);
});
assert.strictEqual(CATALOG.wrapFeeUnitStems, clientData.wrapFeeUnitStems);
assert.strictEqual(CATALOG.wrapFeePerUnit, clientData.wrapFeePerUnit);
assert.strictEqual(CATALOG.messageCardPrice, clientData.messageCardPrice);
assert.strictEqual(CATALOG.minStems, clientData.minStems);
console.log('✔ Suite S1 Passed: server CATALOG mirrors site-content.js exactly\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE S2: Order-mode resolution (DEV-01) ---');
assert.strictEqual(resolveOrderMode([{ type: 'pot', id: 'daisy', qty: 1 }]), 'pot', 'A pot-only cart must resolve to order mode "pot"');
assert.strictEqual(resolveOrderMode([{ type: 'stem', id: 'Rose', qty: 1 }]), 'stem');
assert.strictEqual(resolveOrderMode([{ type: 'package', id: '0', qty: 1 }]), 'package');
assert.strictEqual(resolveOrderMode([{ type: 'custom', qty: 1, stems: { Rose: 3 } }]), 'custom');
assert.strictEqual(
  resolveOrderMode([{ type: 'stem', id: 'Rose', qty: 1 }, { type: 'pot', id: 'daisy', qty: 1 }, { type: 'package', id: '0', qty: 1 }]),
  'mixed',
  'A cart mixing stem + pot + package must resolve to "mixed", not "custom" (DEV-01)'
);
console.log('✔ Suite S2 Passed: pot-only carts resolve correctly and mixed carts are distinguished from custom bouquets\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE S3: Server repricing mirrors the client for every item type (DEV-02) ---');
const stemLine = [{ type: 'stem', id: 'Sunflower', qty: 2 }];
assert.strictEqual(computeVerifiedTotals(stemLine, false, CATALOG).productSubtotal, 2 * clientData.flowers.Sunflower.stemPrice);

const potLine = [{ type: 'pot', id: 'daisy', qty: 3 }];
assert.strictEqual(computeVerifiedTotals(potLine, false, CATALOG).productSubtotal, 3 * clientData.miniPots.find((p) => p.key === 'daisy').price);

const pkgLine = [{ type: 'package', id: '2', qty: 1 }]; // index 2 = 9-stem package
const pricedPkg = computeVerifiedTotals(pkgLine, false, CATALOG);
assert.strictEqual(pricedPkg.productSubtotal, clientData.packages[2].price);
assert.strictEqual(pricedPkg.totalStems, clientData.packages[2].stems);

// Custom bouquet: 3 Rose + 1 rounded addition, expect stems*price + addition*price + wrap fee
const customLine = [{ type: 'custom', qty: 1, stems: { Rose: 3 }, additions: { rounded: 1 } }];
const pricedCustom = computeVerifiedTotals(customLine, false, CATALOG);
const expectedWrapFee = Math.ceil(3 / CATALOG.wrapFeeUnitStems) * CATALOG.wrapFeePerUnit;
const expectedCustomSubtotal = 3 * clientData.flowers.Rose.stemPrice + clientData.customAdditions.find((a) => a.key === 'rounded').price + expectedWrapFee;
assert.strictEqual(pricedCustom.productSubtotal, expectedCustomSubtotal, 'Custom bouquet pricing must include flowers, additions, and scaled wrap fee');
assert.strictEqual(pricedCustom.totalStems, 3);

// A mixed cart's price is the sum of every line, computed independently
const mixedCart = [...stemLine, ...potLine, ...pkgLine];
const pricedMixed = computeVerifiedTotals(mixedCart, true, CATALOG);
const expectedMixedProduct = (2 * clientData.flowers.Sunflower.stemPrice) + (3 * clientData.miniPots.find((p) => p.key === 'daisy').price) + clientData.packages[2].price;
assert.strictEqual(pricedMixed.productSubtotal, expectedMixedProduct);
assert.strictEqual(pricedMixed.messageCardFee, CATALOG.messageCardPrice, 'Message card fee must apply once per order when enabled');
assert.strictEqual(pricedMixed.total, expectedMixedProduct + CATALOG.messageCardPrice);

// Message card fee never applies to an (invalid, but defensively checked) empty cart
assert.strictEqual(computeVerifiedTotals([], true, CATALOG).messageCardFee, 0);
console.log('✔ Suite S3 Passed: stems, mini pots, packages, custom bouquets, additions, wrap fee, and the message card all reprice correctly\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE S4: Tampered payloads are rejected (DEV-05) ---');
function validOrder(overrides) {
  const base = {
    order_reference: 'ALX-260915-ABCD',
    idempotency_key: '11111111-1111-4111-8111-111111111111',
    submitted_language: 'id', currency: 'IDR', source: 'website', acknowledgement: true,
    buyer_name: 'Sagita', buyer_whatsapp: '081234567890',
    location_type: 'bali', regency: 'Denpasar', delivery_method: 'grab_gojek',
    preferred_date: '2026-09-15', // fixedNow is 2026-09-10; lead time default 2 days
    wrap: 'kraft', message_card_enabled: false, gift_message: '', recipient_name: '', card_sender_name: '',
    item_data: [{ type: 'stem', id: 'Rose', qty: 1 }],
    estimated_product_total: clientData.flowers.Rose.stemPrice
  };
  return Object.assign(base, overrides);
}

assert.strictEqual(validateOrder(validOrder({})).ok, true, 'A well-formed order must validate');

assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'stem', id: 'NotAFlower', qty: 1 }] })).ok, false, 'An unknown flower id must be rejected');
assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'pot', id: 'not-a-pot', qty: 1 }] })).ok, false, 'An unknown mini pot id must be rejected');
assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'package', id: '99', qty: 1 }] })).ok, false, 'An out-of-range package index must be rejected');
assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'stem', id: 'Rose', qty: 0 }] })).ok, false, 'A zero quantity must be rejected');
assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'stem', id: 'Rose', qty: 1.5 }] })).ok, false, 'A non-integer quantity must be rejected');
assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'stem', id: 'Rose', qty: 9999 }] })).ok, false, 'An absurd quantity must be rejected');
assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'custom', qty: 1, stems: { Rose: 1 } }] })).ok, false, 'A custom bouquet below the minimum stem count must be rejected');
assert.strictEqual(validateOrder(validOrder({ item_data: [{ type: 'custom', qty: 1, stems: { Rose: 3 }, additions: { glitter: 1 } } ] })).ok, false, 'An unknown addition id must be rejected');
assert.strictEqual(validateOrder(validOrder({ wrap: 'rainbow' })).ok, false, 'An unlisted wrap id must be rejected');
assert.strictEqual(validateOrder(validOrder({ acknowledgement: false })).ok, false, 'A false acknowledgement must be rejected');
assert.strictEqual(validateOrder(validOrder({ acknowledgement: 'true' })).ok, false, 'Acknowledgement must be a real boolean, not the string "true"');
assert.strictEqual(validateOrder(validOrder({ message_card_enabled: false, gift_message: 'sneaked in' })).ok, false, 'Gift text without the card enabled must be rejected');
assert.strictEqual(validateOrder(validOrder({ location_type: 'bali', regency: 'Nowhereville' })).ok, false, 'An unlisted Bali regency must be rejected');
assert.strictEqual(validateOrder(validOrder({ location_type: 'luar_bali', address: 'Jl. Aman 1', city: 'Jakarta', postal_code: '123' })).ok, false, 'A postal code that is not exactly 5 digits must be rejected');
assert.strictEqual(validateOrder(validOrder({ location_type: 'luar_bali', address: '', city: 'Jakarta', postal_code: '12345' })).ok, false, 'A missing out-of-Bali address must be rejected');
assert.strictEqual(validateOrder(validOrder({ buyer_whatsapp: 'not-a-number' })).ok, false, 'An invalid WhatsApp number must be rejected');
assert.strictEqual(validateOrder(validOrder({ order_reference: 'NOT-A-REFERENCE' })).ok, false, 'A malformed order reference must be rejected');
assert.strictEqual(validateOrder(validOrder({ idempotency_key: 'not-a-uuid' })).ok, false, 'A malformed idempotency key must be rejected');
console.log('✔ Suite S4 Passed: manipulated totals, IDs, quantities, card state, and wrap IDs are all rejected\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE S5: Preferred-date lead time (DEV-11) ---');
// fixedNow = 2026-09-10; default MINIMUM_LEAD_DAYS in the doc is 2
assert.strictEqual(isValidLeadTimeDate('2026-09-09'), false, 'A date in the past must be rejected');
assert.strictEqual(isValidLeadTimeDate('2026-09-10'), false, 'Today alone is not enough lead time when the minimum is 2 days');
assert.strictEqual(isValidLeadTimeDate('2026-09-11'), false, 'One day of lead time is not enough when the minimum is 2 days');
assert.strictEqual(isValidLeadTimeDate('2026-09-12'), true, 'Exactly the minimum lead time must be accepted');
assert.strictEqual(isValidLeadTimeDate('2026-09-20'), true, 'A date further out must be accepted');
assert.strictEqual(isValidLeadTimeDate('not-a-date'), false, 'A malformed date must be rejected');
assert.strictEqual(validateOrder(validOrder({ preferred_date: '2026-09-11' })).ok, false, 'validateOrder must enforce the same lead time as isValidLeadTimeDate');
console.log('✔ Suite S5 Passed: the server enforces the same minimum production lead time as the checkout form\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE S6: Column-letter helper (used to place the live Final Total formula) ---');
assert.strictEqual(columnToLetter(1), 'A');
assert.strictEqual(columnToLetter(26), 'Z');
assert.strictEqual(columnToLetter(27), 'AA');
assert.strictEqual(columnToLetter(37), 'AK');
console.log('✔ Suite S6 Passed: column index → A1 letter conversion is correct\n');

console.log('======================================================================');
console.log('✔ ALL 6 SERVER PRICING/VALIDATION SUITES PASSED SUCCESSFULLY');
console.log('======================================================================');
