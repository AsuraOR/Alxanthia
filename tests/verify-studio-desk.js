/**
 * =============================================================================
 * ALXANTHIA STUDIO DESK — SERVER TEST SUITE
 * =============================================================================
 * Run with: node tests/verify-studio-desk.js
 *
 * Modelled on tests/verify-server-pricing.js: reads the Desk's source directly
 * from studio-desk/Code.gs and studio-desk/Index.html — the exact files an
 * owner copies into a new, standalone Apps Script project (see Part 4 of
 * STUDIO-DESK-SETUP.md) — and exercises the server file in a sandbox with
 * minimal Apps Script API stubs, so the actual documented server code is
 * what gets tested — not a reimplementation, or a copy in the tests, that
 * could drift from it.
 * =============================================================================
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================================');
console.log('ALXANTHIA STUDIO DESK — SERVER TEST SUITE');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// 1. Read the Desk's source straight from the files an owner pastes in.
// ---------------------------------------------------------------------------
const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'studio-desk', 'Code.gs'), 'utf8');
assert(serverSrc.includes('function doGet'), 'studio-desk/Code.gs does not look like the Apps Script server code');
const deskHtml = fs.readFileSync(path.join(__dirname, '..', 'studio-desk', 'Index.html'), 'utf8');
assert(deskHtml.includes('function paymentBlock'), 'studio-desk/Index.html does not look like the Studio Desk page');

// ---------------------------------------------------------------------------
// 2. A fake Orders sheet — an in-memory grid plus a write log, standing in
//    for SpreadsheetApp's Range API.
// ---------------------------------------------------------------------------
const HEADERS = [
  'Order Reference', 'Idempotency Key', 'Payload Hash', 'Catalog Version', 'Submitted Catalog Version',
  'Submitted At', 'Language', 'Currency', 'Source', 'Acknowledged', 'Buyer Name', 'Buyer WhatsApp',
  'Location Type', 'Regency', 'Delivery Method', 'Address', 'City', 'Postal Code', 'Preferred Date',
  'Order Mode', 'Order Summary', 'Item Data', 'Total Stems', 'Wrap', 'Message Card', 'Gift Message',
  'Recipient Name', 'Card Sender Name', 'Submitted Product Subtotal', 'Submitted Message Card Fee',
  'Submitted Total', 'Verified Product Subtotal', 'Verified Message Card Fee', 'Verified Total',
    'Price Mismatch', 'Shipping Fee', 'Final Total', 'Midtrans Payment Link', 'Payment Plan', 'Payment Status',
  'Work Phase', 'Delivery Service', 'Tracking Link/Number', 'Internal Notes'
];

function colIndex(name) {
  const idx = HEADERS.indexOf(name);
  assert(idx !== -1, `Unknown fixture column: ${name}`);
  return idx;
}

function rowFor(fields) {
  const row = new Array(HEADERS.length).fill('');
  Object.keys(fields).forEach((name) => { row[colIndex(name)] = fields[name]; });
  return row;
}

function makeSheetStub(dataRows) {
  const grid = [HEADERS.slice()].concat(dataRows.map((r) => r.slice()));
  const writes = [];
  return {
    _writes: writes,
    getLastRow: () => grid.length,
    getLastColumn: () => HEADERS.length,
    getRange: (row, col, numRows, numCols) => {
      numRows = numRows || 1;
      numCols = numCols || 1;
      return {
        getValues: () => {
          const out = [];
          for (let r = 0; r < numRows; r += 1) {
            const rowArr = [];
            for (let c = 0; c < numCols; c += 1) rowArr.push(grid[row - 1 + r][col - 1 + c]);
            out.push(rowArr);
          }
          return out;
        },
        getValue: () => grid[row - 1][col - 1],
        setValue: (v) => {
          writes.push({ row, col, value: v });
          grid[row - 1][col - 1] = v;
        }
      };
    }
  };
}

// ---------------------------------------------------------------------------
// 3. Minimal Apps Script API stubs
// ---------------------------------------------------------------------------
const fixedNow = new Date(Date.UTC(2026, 8, 12, 4, 0, 0)); // 2026-09-12 12:00 Asia/Makassar

function pad(n) { return String(n).padStart(2, '0'); }

function makeSandbox(opts) {
  opts = opts || {};
  const scriptProps = Object.assign({
    SPREADSHEET_ID: 'sheet123',
    DESK_ALLOWED_EMAILS: 'maker@example.com',
    BANK_NAME: 'BCA', BANK_NUMBER: '1234567890', BANK_HOLDER: 'Alxanthia Studio'
  }, opts.props || {});
  const cacheStore = {};
  const cachePutCalls = [];

  const RealDate = Date;
  function MockDate(...args) {
    if (args.length === 0) return new RealDate(fixedNow.getTime());
    return new RealDate(...args);
  }
  MockDate.prototype = RealDate.prototype;
  MockDate.now = () => fixedNow.getTime();

  const sandbox = {
    console,
    Date: MockDate,
    Session: { getActiveUser: () => ({ getEmail: () => (opts.email !== undefined ? opts.email : 'maker@example.com') }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (Object.prototype.hasOwnProperty.call(scriptProps, k) ? scriptProps[k] : null),
        setProperty: (k, v) => { scriptProps[k] = v; }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (Object.prototype.hasOwnProperty.call(cacheStore, k) ? cacheStore[k] : null),
        put: (k, v) => { cachePutCalls.push(k); cacheStore[k] = v; },
        remove: (k) => { delete cacheStore[k]; }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    UrlFetchApp: { fetch: opts.fetch || (() => ({ getResponseCode: () => 500, getContentText: () => '' })) },
    Utilities: {
      formatDate: (date, tz, fmt) => {
        if (fmt === 'yyyy-MM-dd') return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
      }
    },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => opts.sheet || null }) }
  };
  sandbox._cachePutCalls = cachePutCalls;
  vm.createContext(sandbox);
  vm.runInContext(serverSrc, sandbox);
  return sandbox;
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 1: listOrders() maps a fixture row to the documented shape ---');
{
  const sheet = makeSheetStub([
    rowFor({
      'Order Reference': 'ALX-260912-K4T9',
      'Submitted At': new Date(Date.UTC(2026, 8, 12, 1, 14)),
      'Buyer Name': 'Ni Putu Ayu Lestari', 'Buyer WhatsApp': '+6281234567890',
      'Location Type': 'bali', 'Regency': 'Denpasar', 'Delivery Method': 'grab_gojek',
      'Preferred Date': '2026-09-14',
      'Order Summary': '3x Sunflower',
      'Item Data': JSON.stringify([{ type: 'stem', id: 'Sunflower', qty: 3 }]),
      'Wrap': 'sage', 'Message Card': 'No',
      'Verified Total': 497000, 'Price Mismatch': '', 'Shipping Fee': '',
      'Payment Status': 'Paid', 'Work Phase': 'Not started', 'Internal Notes': ''
    })
  ]);
  const sandbox = makeSandbox({ sheet });
  const orders = sandbox.listOrders();
  assert.strictEqual(orders.length, 1);
  const o = orders[0];
  assert.strictEqual(o.ref, 'ALX-260912-K4T9');
  assert.strictEqual(o.row, 2, 'row is a hint only, but must point at the fixture row');
  assert.strictEqual(o.submitted, '2026-09-12 01:14');
  assert.strictEqual(o.locationType, 'bali');
  assert.strictEqual(o.regency, 'Denpasar');
  assert.strictEqual(o.method, 'grab_gojek');
  assert.strictEqual(o.date, '2026-09-14');
  assert.strictEqual(JSON.stringify(o.items), JSON.stringify([{ type: 'stem', id: 'Sunflower', qty: 3 }]));
  assert.strictEqual(o.card, null);
  assert.strictEqual(o.verified, 497000);
  assert.strictEqual(o.shipping, null, 'a blank Shipping Fee cell must map to null');
  assert.strictEqual(o.mismatch, false);
  assert.strictEqual(o.payment, 'Paid');
  assert.strictEqual(o.phase, 'Not started');
  console.log('✔ Suite 1 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 2: the 14-day Delivered window ---');
{
  const sheet = makeSheetStub([
    rowFor({ 'Order Reference': 'A', 'Preferred Date': '2026-08-23', 'Item Data': '[]', 'Order Summary': 'x', 'Work Phase': 'Delivered', 'Location Type': 'bali' }),
    rowFor({ 'Order Reference': 'B', 'Preferred Date': '2026-09-07', 'Item Data': '[]', 'Order Summary': 'x', 'Work Phase': 'Delivered', 'Location Type': 'bali' })
  ]);
  const orders = makeSandbox({ sheet }).listOrders();
  const refs = orders.map((o) => o.ref);
  assert.ok(!refs.includes('A'), 'a Delivered row 20 days past its date must be excluded');
  assert.ok(refs.includes('B'), 'a Delivered row 5 days past its date must be included');
  console.log('✔ Suite 2 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 3: Cancelled rows are excluded ---');
{
  const sheet = makeSheetStub([
    rowFor({ 'Order Reference': 'C', 'Preferred Date': '2026-09-14', 'Item Data': '[]', 'Order Summary': 'x', 'Work Phase': 'Cancelled', 'Location Type': 'bali' })
  ]);
  const orders = makeSandbox({ sheet }).listOrders();
  assert.strictEqual(orders.length, 0);
  console.log('✔ Suite 3 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 4: malformed Item Data never throws ---');
{
  const sheet = makeSheetStub([
    rowFor({ 'Order Reference': 'D', 'Preferred Date': '2026-09-14', 'Item Data': '{not json', 'Order Summary': '3x Rose', 'Work Phase': 'Not started', 'Location Type': 'bali' })
  ]);
  const orders = makeSandbox({ sheet }).listOrders();
  assert.strictEqual(JSON.stringify(orders[0].items), '[]');
  assert.strictEqual(orders[0].itemsRaw, '3x Rose');
  console.log('✔ Suite 4 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 5: updateOrder rejects a column outside the writable four ---');
{
  const sheet = makeSheetStub([rowFor({ 'Order Reference': 'E', 'Work Phase': 'Not started' })]);
  const sandbox = makeSandbox({ sheet });
  const res = sandbox.updateOrder({ ref: 'E', row: 2, field: 'verified', value: 1 });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'BAD_FIELD');
  assert.strictEqual(sheet._writes.length, 0, 'a rejected field must never reach the sheet');
  console.log('✔ Suite 5 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 6: updateOrder rejects an Indonesian label as a phase value ---');
{
  const sheet = makeSheetStub([rowFor({ 'Order Reference': 'F', 'Work Phase': 'Not started' })]);
  const sandbox = makeSandbox({ sheet });
  const res = sandbox.updateOrder({ ref: 'F', row: 2, field: 'phase', value: 'Selesai' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'BAD_VALUE');
  assert.strictEqual(sheet._writes.length, 0);
  console.log('✔ Suite 6 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 7: a stale row hint still writes the correct row, located by reference ---');
{
  const sheet = makeSheetStub([
    rowFor({ 'Order Reference': 'G1', 'Work Phase': 'Not started' }),
    rowFor({ 'Order Reference': 'G2', 'Payment Status': 'Paid', 'Work Phase': 'Not started' })
  ]);
  const sandbox = makeSandbox({ sheet });
  // The page's row hint (2) actually belongs to G1, not G2 — the server must
  // re-scan by reference rather than trust it.
  const res = sandbox.updateOrder({ ref: 'G2', row: 2, field: 'phase', value: 'Shipped' });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.order.phase, 'Shipped');
  assert.strictEqual(sheet._writes[0].row, 3, 'the write must land on G2s real row, not the stale hint');
  console.log('✔ Suite 7 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 8: updateOrder with a reference that no longer exists ---');
{
  const sheet = makeSheetStub([rowFor({ 'Order Reference': 'H', 'Work Phase': 'Not started' })]);
  const sandbox = makeSandbox({ sheet });
  const res = sandbox.updateOrder({ ref: 'ZZZZ', row: 2, field: 'phase', value: 'Shipped' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'NOT_FOUND');
  console.log('✔ Suite 8 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 9: a formula-like note is stored prefixed, never as a live formula ---');
{
  const sheet = makeSheetStub([rowFor({ 'Order Reference': 'I', 'Work Phase': 'Not started' })]);
  const sandbox = makeSandbox({ sheet });
  const res = sandbox.updateOrder({ ref: 'I', row: 2, field: 'notes', value: '=SUM(A1:A9)' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(sheet._writes[0].value, "'=SUM(A1:A9)");
  console.log('✔ Suite 9 Passed\n');
}

// ---------------------------------------------------------------------------
console.log('--- SUITE 10: Final Total is never written by the Desk ---');
{
  const sheet = makeSheetStub([rowFor({ 'Order Reference': 'J', 'Work Phase': 'Not started' })]);
  const sandbox = makeSandbox({ sheet });
  sandbox.updateOrder({ ref: 'J', row: 2, field: 'shipping', value: 45000 });
  sandbox.updateOrder({ ref: 'J', row: 2, field: 'payment', value: 'Paid' });
  sandbox.updateOrder({ ref: 'J', row: 2, field: 'notes', value: 'ok' });
  const finalCol = colIndex('Final Total') + 1;
  sheet._writes.forEach((w) => assert.notStrictEqual(w.col, finalCol, 'Final Total must stay untouched'));
  console.log('✔ Suite 10 Passed\n');
}

console.log('--- SUITE 10a: deposit plan and statuses are persisted ---');
{
  const sheet = makeSheetStub([rowFor({ 'Order Reference': 'DP', 'Payment Plan': 'Full', 'Payment Status': 'Unpaid', 'Work Phase': 'Not started' })]);
  const sandbox = makeSandbox({ sheet });
  let res = sandbox.updateOrder({ ref: 'DP', row: 2, field: 'paymentPlan', value: 'Deposit 50%' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.order.paymentPlan, 'Deposit 50%');
  res = sandbox.updateOrder({ ref: 'DP', row: 2, field: 'payment', value: 'Deposit paid' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.order.payment, 'Deposit paid');
  console.log('✔ Suite 10a Passed\n');
}

console.log('--- SUITE 10b: an unpaid balance blocks dispatch server-side ---');
{
  const sheet = makeSheetStub([rowFor({ 'Order Reference': 'DUE', 'Payment Plan': 'Deposit 50%', 'Payment Status': 'Deposit paid', 'Work Phase': 'Ready for dispatch' })]);
  const sandbox = makeSandbox({ sheet });
  const res = sandbox.updateOrder({ ref: 'DUE', row: 2, field: 'phase', value: 'Shipped' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'PAYMENT_DUE');
  assert.strictEqual(sheet._writes.length, 0);
  console.log('✔ Suite 10b Passed\n');
}

console.log('--- SUITE 10c: a paid order keeps its money panel, with a paid-confirmation action ---');
{
  const paymentBlockStart = deskHtml.indexOf('function paymentBlock(o)');
  const paymentBlockEnd = deskHtml.indexOf('\n  function renderTicket()', paymentBlockStart);
  const paymentBlockSrc = deskHtml.slice(paymentBlockStart, paymentBlockEnd);
  assert.ok(
    !paymentBlockSrc.includes("if (pay === 'Paid') return '';"),
    'a Paid order must not blank its payment panel — the billed total must stay visible'
  );
  assert.ok(
    paymentBlockSrc.includes('data-sendpaid="1"'),
    'a Paid order must offer a way to send the payment-confirmed message'
  );
  assert.ok(
    !paymentBlockSrc.includes("pay === 'Deposit paid') return ''") &&
      !paymentBlockSrc.includes("pay === 'Checking balance') return ''"),
    'the panel must remain visible after the first DP and while its balance is checked'
  );
  console.log('✔ Suite 10c Passed\n');
}

console.log('--- SUITE 10d: order search matches buyer names and order codes ---');
{
  const match = deskHtml.match(/  function matchesSearch\(order, query\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'the Desk must include its order-search predicate');
  const searchSandbox = {};
  vm.createContext(searchSandbox);
  vm.runInContext(match[0] + '\nthis.matchesSearch = matchesSearch;', searchSandbox);
  const order = { buyer: 'Ni Putu Ayu Lestari', ref: 'ALX-260912-K4T9', wa: '+62 812-3456-7890' };
  assert.strictEqual(searchSandbox.matchesSearch(order, 'ayu'), true);
  assert.strictEqual(searchSandbox.matchesSearch(order, 'k4t9'), true);
  assert.strictEqual(searchSandbox.matchesSearch(order, '  ALX-260912  '), true);
  assert.strictEqual(searchSandbox.matchesSearch(order, 'made'), false);
  assert.strictEqual(searchSandbox.matchesSearch(order, ''), true);
  assert.strictEqual(searchSandbox.matchesSearch(order, '812-3456'), true, 'digits-only match must ignore dashes in the query');
  assert.strictEqual(searchSandbox.matchesSearch(order, '62812345 67890'), true, 'digits-only match must ignore spacing in the query');
  assert.strictEqual(searchSandbox.matchesSearch(order, '99999'), false);
  console.log('✔ Suite 10d Passed\n');
}

console.log('--- SUITE 14: firstName() greets by first name, stripping Balinese/Indonesian honorifics ---');
{
  const match = deskHtml.match(/  var NAME_PREFIXES[\s\S]*?\n  function firstName\(full\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'the Desk must include its firstName() greeting helper');
  const nameSandbox = {};
  vm.createContext(nameSandbox);
  vm.runInContext(match[0] + '\nthis.firstName = firstName;', nameSandbox);
  assert.strictEqual(nameSandbox.firstName('Ni Made Ayu Lestari'), 'Made');
  assert.strictEqual(nameSandbox.firstName('I Wayan Sudiarta'), 'Wayan');
  assert.strictEqual(nameSandbox.firstName('Budi Santoso'), 'Budi');
  assert.strictEqual(nameSandbox.firstName('Budi'), 'Budi');
  assert.strictEqual(nameSandbox.firstName('Ibu Sari'), 'Sari');
  assert.strictEqual(nameSandbox.firstName('Ni'), 'Ni', 'a lone honorific-looking token must not be stripped down to nothing');
  assert.strictEqual(nameSandbox.firstName(''), '');
  assert.strictEqual(nameSandbox.firstName(undefined), '');
  console.log('✔ Suite 14 Passed\n');
}

console.log('--- SUITE 15: cancelling an order requires confirmation and can be undone ---');
{
  assert.ok(deskHtml.includes('data-askcancel="1"'), 'the cancel button must route through a confirm step, not write directly');
  assert.ok(!deskHtml.includes('data-pay="Cancelled">Batalkan pesanan'),
    'the ghost cancel button must no longer write Payment Status directly');
  assert.ok(deskHtml.includes("confirming = 'cancel'"), 'clicking the cancel button must arm the cancel confirmation');
  assert.ok(deskHtml.includes('Batalkan pesanan') && deskHtml.includes('Ya, batalkan'),
    'a confirm dialog with an explicit Ya/Tidak choice must exist for cancellation');
  assert.ok(deskHtml.includes('data-pay="Unpaid">Aktifkan lagi'),
    'a cancelled order must offer a way back to Unpaid');
  console.log('✔ Suite 15 Passed\n');
}

console.log('--- SUITE 16: a catalogue failure degrades instead of blanking the whole Desk ---');
{
  const renderStart = deskHtml.indexOf('function render() {');
  const renderEnd = deskHtml.indexOf('\n  function renderTop()', renderStart);
  const renderSrc = deskHtml.slice(renderStart, renderEnd);
  assert.ok(
    /if \(state\.ordersError\) \{/.test(renderSrc) && !/if \(state\.ordersError \|\| state\.catalogError\)/.test(renderSrc),
    'only an orders fetch failure may show the fatal error screen — a catalogue failure must not'
  );
  const bootStart = deskHtml.indexOf('function boot() {');
  const bootEnd = deskHtml.indexOf('\n  function reloadOrders()', bootStart);
  const bootSrc = deskHtml.slice(bootStart, bootEnd);
  assert.ok(bootSrc.includes('state.catalogError'), 'boot() must still record the catalogue error for the stale banner');
  assert.ok(/state\.catalog = \{ stale: true/.test(bootSrc),
    'boot() must install a safe empty catalogue so rendering can proceed after getCatalog() throws');
  assert.ok(deskHtml.includes('bankReady'),
    'payment-send buttons must be guarded when bank details are unavailable, rather than sending a message with undefined in it');
  console.log('✔ Suite 16 Passed\n');
}

console.log('--- SUITE 17: the Delivered retention window is named for what it actually measures ---');
{
  assert.ok(serverSrc.includes('KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE'),
    'the retention constant must be named for the date it actually counts from (Preferred Date)');
  assert.ok(!/\bKEEP_DELIVERED_DAYS\b(?!_PAST_PREFERRED_DATE)/.test(serverSrc),
    'no reference to the old, misleadingly-named constant may remain');
  console.log('✔ Suite 17 Passed\n');
}

console.log('--- SUITE 18: an unsaved note survives a trip away from the Desk ---');
{
  assert.ok(deskHtml.includes('NOTE_DRAFTS_KEY'), 'note drafts must be persisted, like state.per, not kept only in memory');
  assert.ok(deskHtml.includes('saveNoteDrafts()'), 'a saveNoteDrafts() persistence helper must exist and be called');
  assert.ok(deskHtml.includes('data-savenotes="1"'), 'an explicit save control must exist beside blur-to-save');
  assert.ok(deskHtml.includes('belum tersimpan'), 'an unsaved note must be visibly marked, not rely on invisible blur-to-save alone');
  const saveNotesMatch = deskHtml.match(/function saveNotes\(o\) \{[\s\S]*?\n  \}/);
  assert.ok(saveNotesMatch, 'a saveNotes() helper must exist');
  assert.ok(/onSaved: function \(\) \{\s*delete noteDrafts\[o\.ref\]/.test(saveNotesMatch[0]),
    'the draft must be cleared only inside the write success callback, not before the server confirms it'
  );
  console.log('✔ Suite 18 Passed\n');
}

console.log('--- SUITE 19: the phone back gesture closes the ticket instead of leaving the Desk ---');
{
  assert.ok(deskHtml.includes("history.pushState({ desk: 'detail'"), 'opening a ticket must push a history entry on mobile');
  assert.ok(deskHtml.includes("addEventListener('popstate'"), 'a popstate listener must close the detail view');
  assert.ok(/try \{\s*history\.pushState/.test(deskHtml), 'pushState must be guarded — it can be restricted inside the Apps Script iframe');
  console.log('✔ Suite 19 Passed\n');
}

console.log('--- SUITE 20: an early balance payment can still be recorded ahead of Ready for dispatch ---');
{
  const paymentBlockStart = deskHtml.indexOf('function paymentBlock(o)');
  const paymentBlockEnd = deskHtml.indexOf('\n  function renderTicket()', paymentBlockStart);
  const paymentBlockSrc = deskHtml.slice(paymentBlockStart, paymentBlockEnd);
  assert.ok(paymentBlockSrc.includes('var balanceDue = phaseIndex >= readyIndex;'),
    'whether the balance can be recorded must be computed from phase order, not string equality alone');
  assert.ok(paymentBlockSrc.includes("o.phase === 'Ready for dispatch'\n                ? '<button type=\"button\" class=\"btn\" data-sendpayment=\"balance\""),
    'Kirim pesan pelunasan (asking for money early) must remain gated to exactly Ready for dispatch');
  assert.ok(paymentBlockSrc.includes("(balanceDue\n            ? "),
    'Tandai perlu dicek / Tandai lunas must be reachable at or after Ready for dispatch, not only exactly at it');
  console.log('✔ Suite 20 Passed\n');
}

console.log('--- SUITE 20a: the catalogue fetch is data, not code — no new Function() over network content ---');
{
  assert.ok(!serverSrc.includes('new Function'), 'the catalogue fetch must never execute the response as code');
  assert.ok(serverSrc.includes("JSON.parse(res.getContentText())"), 'the catalogue fetch must JSON.parse the response');
  assert.ok(serverSrc.includes("site-content.json"), 'SITE_CONTENT_URL must point at the JSON endpoint, not the executable script');
  console.log('✔ Suite 20a Passed\n');
}

console.log('--- SUITE 21: cancelled orders get their own lane and drop out of Aktif ---');
{
  assert.ok(deskHtml.includes("{ key: 'cancelled', label: 'Dibatalkan' }"), 'a Dibatalkan lane must exist');
  assert.ok(deskHtml.includes("order.payment !== 'Cancelled'"), 'isActive must exclude cancelled orders from the Aktif lane');
  console.log('✔ Suite 21 Passed\n');
}

console.log('--- SUITE 22: the default-selected ticket matches the top of the visible, sorted list ---');
{
  assert.ok(deskHtml.includes('function visibleOrders()'), 'a shared visibleOrders() helper must exist');
  assert.ok(deskHtml.includes('var visible = visibleOrders();'),
    'the default selection must be computed from the same filtered/sorted list the queue renders, not raw sheet order');
  console.log('✔ Suite 22 Passed\n');
}

console.log('--- SUITE 23 (P1-1): a late order is a warning, not a permanent lock ---');
{
  const gateStart = deskHtml.indexOf('function gate(order, catalog) {');
  const gateEnd = deskHtml.indexOf('\n  /* =====', gateStart);
  const gateSrc = deskHtml.slice(gateStart, gateEnd);
  assert.ok(gateSrc.includes('blocking: false'),
    'the date check must be marked non-blocking so a past Preferred Date cannot disable Mulai kerjakan forever');
  assert.ok(/autoOk = auto\.every\(function \(c\) \{ return !c\.blocking \|\| c\.ok; \}\)/.test(gateSrc),
    'autoOk (which gates the button) must only consider blocking checks');
  assert.ok(gateSrc.includes('isNaN(d)'), 'an unreadable Preferred Date must be handled explicitly rather than silently failing d >= 0');
  assert.ok(deskHtml.includes('Tetap mulai kerjakan'),
    'the button must relabel to make clear she is starting a late order on purpose');
  assert.ok(deskHtml.includes('Tanggalnya sudah lewat — kabari pembeli dulu kalau perlu.'),
    'the why line must explain a late-but-startable order in her words, without blocking her');
  console.log('✔ Suite 23 Passed\n');
}

console.log('--- SUITE 24 (P1-2/P1-4): a tap while a field is dirty is never lost to a synchronous re-render ---');
{
  assert.ok(/writeField\(o\.ref, 'shipping', value, 'Shipping Fee', \{ rerender: false \}\)/.test(deskHtml),
    'writing the shipping field from the change handler must skip the synchronous full re-render');
  assert.ok(/writeField\(o\.ref, 'notes', value, 'Internal Notes', \{[\s\S]*?rerender: false/.test(deskHtml),
    'writing notes from the change handler must skip the synchronous full re-render');
  assert.ok(deskHtml.includes('function setControlPending('),
    'a targeted in-place pending indicator must exist for fields written without a full re-render');
  assert.ok(deskHtml.includes("comp.setAttribute('aria-pressed', String(compOn));") &&
    !/data-comp\][\s\S]{0,400}renderTicket\(\);/.test(deskHtml),
    'ticking a make-list item must update the DOM in place, not rebuild the whole ticket');
  assert.ok(deskHtml.includes("tick.setAttribute('aria-pressed', String(tickOn));"),
    'ticking a manual gate check must update the DOM in place, not rebuild the whole ticket');
  assert.ok(deskHtml.includes('function updateCompCount()') && deskHtml.includes('function updateAdvanceButtonState()'),
    'in-place updaters for the item counter and the gate button must exist');
  assert.ok(/var scrollY = window\.scrollY;\s*elTicket\.innerHTML = html;/.test(deskHtml),
    'renderTicket must capture and restore scroll position around its innerHTML rebuild');
  console.log('✔ Suite 24 Passed\n');
}

console.log('--- SUITE 25 (P1-3): the pulse counters exclude cancelled orders, matching isActive() ---');
{
  const topStart = deskHtml.indexOf('function renderTop() {');
  const topEnd = deskHtml.indexOf('\n  function renderQueue()', topStart);
  const topSrc = deskHtml.slice(topStart, topEnd);
  assert.ok(topSrc.includes('if (!isActive(o)) return;'),
    'renderTop() counters must skip inactive (delivered or cancelled) orders using the same isActive() as the lanes');
  assert.ok(!topSrc.includes("if (o.phase === 'Delivered') return;"),
    'the old Delivered-only guard must be gone — it let a cancelled order keep inflating the counters');
  console.log('✔ Suite 25 Passed\n');
}

console.log('--- SUITE 26 (P1-5): un-cancelling a deposit order offers to restore the deposit, not erase it ---');
{
  const paymentBlockStart = deskHtml.indexOf('function paymentBlock(o)');
  const paymentBlockEnd = deskHtml.indexOf('\n  function renderTicket()', paymentBlockStart);
  const paymentBlockSrc = deskHtml.slice(paymentBlockStart, paymentBlockEnd);
  assert.ok(paymentBlockSrc.includes('data-pay="Deposit paid">Aktifkan — DP sudah diterima'),
    'a Deposit 50% order must offer a reactivation path that restores Deposit paid, not just Unpaid');
  assert.ok(paymentBlockSrc.includes('data-pay="Unpaid">Aktifkan — belum ada pembayaran'),
    'a Deposit 50% order must still offer the belum-ada-pembayaran path back to Unpaid');
  assert.ok(paymentBlockSrc.includes("if (isDeposit) {") , 'the two reactivation buttons must only apply to Deposit 50% orders');
  console.log('✔ Suite 26 Passed\n');
}

console.log('--- SUITE 27 (P2-1): the open ticket is reconciled against the visible list on every change ---');
{
  assert.ok(deskHtml.includes('function reconcileSelection()'), 'a reconcileSelection() helper must exist');
  const renderStart = deskHtml.indexOf('function render() {');
  const renderEnd = deskHtml.indexOf('\n  function renderTop()', renderStart);
  const renderSrc = deskHtml.slice(renderStart, renderEnd);
  assert.ok(renderSrc.includes('reconcileSelection();'), 'render() must call reconcileSelection() before rendering the panes');
  const chipsStart = deskHtml.indexOf("elChips.addEventListener('click'");
  const chipsEnd = deskHtml.indexOf('\n  });', chipsStart);
  assert.ok(deskHtml.slice(chipsStart, chipsEnd).includes('render();'),
    'switching lanes must re-render the ticket too, not just the queue, so a stale ticket cannot linger');
  const searchStart = deskHtml.indexOf("elSearch.addEventListener('input'");
  const searchEnd = deskHtml.indexOf('\n  });', searchStart);
  assert.ok(deskHtml.slice(searchStart, searchEnd).includes('render();'),
    'searching must re-render the ticket too, not just the queue, so a stale ticket cannot linger');
  assert.ok(deskHtml.includes('Pesanan selesai. Dipindahkan ke daftar Selesai.'),
    'marking an order Delivered must surface a toast explaining why its card disappeared from Aktif');
  console.log('✔ Suite 27 Passed\n');
}

console.log('--- SUITE 28 (P2-2): a search with no in-lane hits offers the cross-lane match ---');
{
  const queueStart = deskHtml.indexOf('function renderQueue() {');
  const queueEnd = deskHtml.indexOf('\n  function paymentBlock(', queueStart);
  const queueSrc = deskHtml.slice(queueStart, queueEnd);
  assert.ok(queueSrc.includes('matchesSearch(o, state.search)') && queueSrc.includes('data-crosslane='),
    'the empty-queue state must search across all orders and offer a cross-lane link when it finds a hit');
  assert.ok(deskHtml.includes("e.target.closest('[data-crosslane]')"),
    'a click handler for the cross-lane suggestion must exist and switch state.lane, keeping the query');
  console.log('✔ Suite 28 Passed\n');
}

console.log('--- SUITE 29 (P2-4/P2-5/P2-6/P2-7): orientation — current phase, chip/phase scroll, tappable counters, date groups ---');
{
  assert.ok(/phaseEntry \? '<span class="tag go"/.test(deskHtml),
    'the ticket header must show the current work phase as a chip, not require scrolling to find it');
  assert.ok(deskHtml.includes("elTicket.querySelector('.phase.now')") && deskHtml.includes('scrollIntoView'),
    'the current phase must be scrolled into view within its horizontally-scrolling strip');
  assert.ok(deskHtml.includes("elChips.querySelector('[aria-pressed=\"true\"]')"),
    'the active lane chip must be scrolled into view so it cannot end up off-screen');
  assert.ok(deskHtml.includes("laneKey === 'late'") && deskHtml.includes("laneKey === 'today'"),
    'laneMatch must support late/today lanes so the pulse counters are reachable by tapping');
  assert.ok(deskHtml.includes('class="pulse-item"') && deskHtml.includes("elPulse.addEventListener('click'"),
    'the pulse counters must be buttons wired to switch state.lane');
  assert.ok(deskHtml.includes('function dateGroupKey(') && deskHtml.includes("state.sort === 'due'") &&
    deskHtml.includes('queue-group'),
    'the queue must render date group headers when sorted by deadline');
  console.log('✔ Suite 29 Passed\n');
}

// ---------------------------------------------------------------------------
// 4. getCatalog()/pickLabels_() suites use a trimmed real copy of
//    site-content.js so this fixture can never drift from the live site.
//    getCatalog() now fetches site-content.json (see P3-1 in
//    STUDIO-DESK-FIXES.md), built from site-content.js by scripts/build.js —
//    so the fixture reproduces that exact build step rather than trusting a
//    second, hand-written JSON copy that could drift from it.
// ---------------------------------------------------------------------------
const siteContentSrc = fs.readFileSync(path.join(__dirname, '..', 'site-content.js'), 'utf8');

function buildSiteContentJson(src) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return JSON.stringify(sandbox.window.ALXANTHIA_DATA);
}

const siteContentJson = buildSiteContentJson(siteContentSrc);

console.log('--- SUITE 11: getCatalog() parses site-content.json into the Part 4 shape, no prices ---');
{
  const sandbox = makeSandbox({ fetch: () => ({ getResponseCode: () => 200, getContentText: () => siteContentJson }) });
  const catalog = sandbox.getCatalog();

  assert.ok(catalog.flowers.Sunflower, 'a known flower key must resolve');
  assert.strictEqual(catalog.flowers.Sunflower.name, 'Bunga Matahari');
  assert.ok(catalog.flowers.Sunflower.spec.includes('45 cm'));
  assert.ok(catalog.pots.daisy);
  assert.strictEqual(catalog.pots.daisy.name, 'Mini Pot Daisy');
  assert.ok(catalog.pots.daisy.spec.includes('13 cm'));
  assert.ok(catalog.additions.rounded);
  assert.strictEqual(catalog.additions.rounded.name, 'Daun Bulat');
  assert.strictEqual(catalog.packages.length, 4);
  assert.strictEqual(catalog.packages[2].stems, 9);
  assert.ok(catalog.wraps.sage);
  assert.strictEqual(catalog.wraps.sage.name, 'Sage');
  assert.strictEqual(catalog.wraps.sage.swatch, '#7E8F7C');
  assert.strictEqual(catalog.minimumLeadDays, 2);
  assert.ok(catalog.bank, 'bank details must come from Script Properties, always present');

  const serialized = JSON.stringify([catalog.flowers, catalog.pots, catalog.additions, catalog.packages, catalog.wraps]);
  assert.ok(!/price/i.test(serialized), 'no price field of any kind may cross into the catalogue payload');
  console.log('✔ Suite 11 Passed\n');
}

console.log('--- SUITE 12: getCatalog() falls back to the backup on a failed fetch, caches nothing ---');
{
  const backup = JSON.stringify({
    flowers: { Rose: { name: 'Mawar', spec: '' } }, pots: {}, additions: {}, packages: [], wraps: {}, minimumLeadDays: 2
  });
  const sandbox = makeSandbox({
    props: { DESK_CATALOG_BACKUP: backup },
    fetch: () => ({ getResponseCode: () => 500, getContentText: () => '' })
  });
  const catalog = sandbox.getCatalog();
  assert.strictEqual(catalog.stale, true);
  assert.strictEqual(catalog.flowers.Rose.name, 'Mawar');
  assert.strictEqual(sandbox._cachePutCalls.length, 0, 'a failed fetch must not populate the cache');
  console.log('✔ Suite 12 Passed\n');
}

console.log('--- SUITE 12a: a malformed catalogue payload falls back to the backup instead of throwing ---');
{
  const backup = JSON.stringify({
    flowers: { Rose: { name: 'Mawar', spec: '' } }, pots: {}, additions: {}, packages: [], wraps: {}, minimumLeadDays: 2
  });
  const sandbox = makeSandbox({
    props: { DESK_CATALOG_BACKUP: backup },
    fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{not valid json' })
  });
  const catalog = sandbox.getCatalog();
  assert.strictEqual(catalog.stale, true);
  assert.strictEqual(catalog.flowers.Rose.name, 'Mawar');
  assert.strictEqual(sandbox._cachePutCalls.length, 0, 'a payload that fails to parse must not populate the cache');
  console.log('✔ Suite 12a Passed\n');
}

console.log('--- SUITE 13: an unknown catalogue key renders a humanised fallback, not a crash ---');
{
  const sandbox = makeSandbox({ fetch: () => ({ getResponseCode: () => 200, getContentText: () => siteContentJson }) });
  const catalog = sandbox.getCatalog();
  const lines = sandbox.buildTicketLines_([{ type: 'stem', id: 'unknown-flower', qty: 1 }], catalog);
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].name, 'Unknown Flower');
  const wrapped = sandbox.buildTicketLines_([{ type: 'stem', id: 'Sunflower', wrapped: true, qty: 1 }], catalog);
  const unwrapped = sandbox.buildTicketLines_([{ type: 'stem', id: 'Sunflower', wrapped: false, qty: 1 }], catalog);
  assert.ok(wrapped[0].lines.some((line) => line.k === 'bungkus' && line.v === 'Dengan kertas pembungkus'));
  assert.ok(unwrapped[0].lines.some((line) => line.k === 'bungkus' && line.v === 'Tanpa kertas pembungkus'));
  console.log('✔ Suite 13 Passed\n');
}

console.log('======================================================================');
console.log('✔ ALL 35 STUDIO DESK SERVER SUITES PASSED SUCCESSFULLY');
console.log('======================================================================');
