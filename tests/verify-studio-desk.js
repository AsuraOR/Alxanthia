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

// A general-purpose, dynamically-growing sheet stub for the Desk Ops sheets
// (Desk Ledger/Checklist/Activity) — unlike makeSheetStub above, it isn't
// pinned to the Orders HEADERS shape, supports appendRow/setValues, and
// grows as rows are appended, matching how ensureDeskOpsSheets_()/
// recordPayment()/setChecklistItem()/markReviewed() actually use a sheet.
function makeOpsSheetStub(rows) {
  const grid = (rows || []).map((r) => r.slice());
  return {
    _grid: grid,
    getLastRow: () => grid.length,
    getLastColumn: () => (grid[0] ? grid[0].length : 0),
    getRange: (row, col, numRows, numCols) => {
      numRows = numRows || 1;
      numCols = numCols || 1;
      return {
        getValues: () => {
          const out = [];
          for (let r = 0; r < numRows; r += 1) {
            const gRow = grid[row - 1 + r] || [];
            const rowArr = [];
            for (let c = 0; c < numCols; c += 1) rowArr.push(gRow[col - 1 + c] !== undefined ? gRow[col - 1 + c] : '');
            out.push(rowArr);
          }
          return out;
        },
        getValue: () => {
          const gRow = grid[row - 1] || [];
          return gRow[col - 1] !== undefined ? gRow[col - 1] : '';
        },
        setValue: (v) => {
          while (grid.length < row) grid.push([]);
          grid[row - 1][col - 1] = v;
        },
        setValues: (values) => {
          for (let r = 0; r < values.length; r += 1) {
            while (grid.length < row + r) grid.push([]);
            for (let c = 0; c < values[r].length; c += 1) grid[row - 1 + r][col - 1 + c] = values[r][c];
          }
        }
      };
    },
    appendRow: (rowValues) => { grid.push(rowValues.slice()); },
    setFrozenRows: () => {}
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

  // 'Orders' resolves to opts.sheet (as every existing suite expects); any
  // Desk Ops sheet name resolves to its stub only if the caller configured
  // one via opts.opsSheets — otherwise getSheetByName correctly returns
  // null, exercising the same "not migrated yet" path a real, un-migrated
  // spreadsheet would.
  const sheetsByName = Object.assign({ Orders: opts.sheet || null }, opts.opsSheets || {});
  const insertedSheetNames = [];
  let uuidCounter = 0;

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
      },
      getUuid: () => `uuid-${uuidCounter += 1}`
    },
    Logger: { log: () => {} },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: (name) => (Object.prototype.hasOwnProperty.call(sheetsByName, name) ? sheetsByName[name] : null),
        insertSheet: (name) => {
          const created = makeOpsSheetStub([]);
          sheetsByName[name] = created;
          insertedSheetNames.push(name);
          return created;
        }
      })
    }
  };
  sandbox._cachePutCalls = cachePutCalls;
  sandbox._sheetsByName = sheetsByName;
  sandbox._insertedSheetNames = insertedSheetNames;
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
console.log('--- SUITE 3 (P5-6): a phase-cancelled row ages out on the same window as Delivered, not instantly ---');
{
  // A row cancelled by Work Phase used to be dropped outright, while the
  // Desk's own Dibatalkan chip matches Payment Status — two different
  // notions of "cancelled". A phase-cancelled row must now reach the
  // client (so it can appear under Dibatalkan) unless it's old enough to
  // age out under the same KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE window
  // Delivered rows use. fixedNow is 2026-09-12.
  const sheet = makeSheetStub([
    rowFor({ 'Order Reference': 'C', 'Preferred Date': '2026-09-14', 'Item Data': '[]', 'Order Summary': 'x', 'Work Phase': 'Cancelled', 'Location Type': 'bali' }),
    rowFor({ 'Order Reference': 'E', 'Preferred Date': '2026-08-23', 'Item Data': '[]', 'Order Summary': 'x', 'Work Phase': 'Cancelled', 'Location Type': 'bali' })
  ]);
  const orders = makeSandbox({ sheet }).listOrders();
  const refs = orders.map((o) => o.ref);
  assert.ok(refs.includes('C'), 'a recently phase-cancelled row must still reach the client');
  assert.ok(!refs.includes('E'), 'a phase-cancelled row 20 days past its date must age out, same as Delivered');
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
  assert.ok(deskHtml.includes('Belum tersimpan'), 'an unsaved note must be visibly marked, not rely on invisible blur-to-save alone');
  assert.ok(deskHtml.includes('data-retrynotes="1"') && deskHtml.includes('Coba lagi'),
    'a failed note save must offer an explicit retry, since nothing else will re-trigger the blur-to-save');
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
  assert.ok(/writeField\(o\.ref, 'shipping', value, \{ rerender: false \}\)/.test(deskHtml),
    'writing the shipping field from the change handler must skip the synchronous full re-render');
  assert.ok(/writeField\(o\.ref, 'notes', value, \{[\s\S]*?rerender: false/.test(deskHtml),
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

console.log('--- SUITE 30 (P2-3): an unread order is tagged Baru and counted, per device ---');
{
  assert.ok(deskHtml.includes("var LAST_SEEN_KEY = 'alxanthia-desk-lastseen-v1';"),
    'the last-seen timestamp must be persisted per device, like PER_KEY and NOTE_DRAFTS_KEY');
  assert.ok(deskHtml.includes('function markSeen(') && deskHtml.includes('markSeen(o);'),
    'opening a ticket must advance lastSeenAt for that order');
  assert.ok(deskHtml.includes("o.submitted > lastSeenAt) tagCandidates.push('<span class=\"tag go\">Baru</span>')"),
    'a card newer than lastSeenAt must be tagged Baru');
  assert.ok(deskHtml.includes('pesanan baru'), 'a pesanan baru counter must appear in the pulse strip');
  console.log('✔ Suite 30 Passed\n');
}

console.log('--- SUITE 31 (P3-1): developer vocabulary (columns, files, row numbers, timezone IDs) stays off-screen by default ---');
{
  const leaks = (deskHtml.match(/Payment Status|Work Phase|Internal Notes|Shipping Fee|Payment Plan|site-content\.js|Asia\/Makassar/g) || []);
  assert.ok(leaks.length > 0, 'sanity: the sheet vocabulary must still exist somewhere (WRITABLE_FIELDS-equivalent logic, comments)');
  const detailsStart = deskHtml.indexOf('<details class="provenance">');
  const detailsEnd = deskHtml.indexOf('</details>', detailsStart);
  assert.ok(detailsStart !== -1 && detailsEnd !== -1, 'the provenance block must be a collapsed <details>, not a visible-by-default strip');
  assert.ok(deskHtml.includes('function savedToast(field)') && deskHtml.includes('var FIELD_LABELS ='),
    'the save toast must map the field key to an Indonesian label, never render the sheet column name');
  assert.ok(!deskHtml.includes("esc(o.ref) + ' · baris '"),
    'the visible order reference must not be suffixed with the sheet row number');
  assert.ok(deskHtml.includes("fmtDateLong(todayStr()) + ' · WITA'"),
    'the top bar must show a human timezone name, not the Asia/Makassar identifier');
  assert.ok(!deskHtml.includes('<b>site-content.js</b>'), 'the footer must not name the internal data file');
  console.log('✔ Suite 31 Passed\n');
}

console.log('--- SUITE 32 (P3-2/P3-3/P3-4): the payment panel reads as one coherent form ---');
{
  const paymentBlockStart = deskHtml.indexOf('function paymentBlock(o)');
  const paymentBlockEnd = deskHtml.indexOf('\n  function renderTicket()', paymentBlockStart);
  const paymentBlockSrc = deskHtml.slice(paymentBlockStart, paymentBlockEnd);
  assert.ok(paymentBlockSrc.includes('class="seg" role="group" aria-label="Cara pembayaran"'),
    'the plan switcher must reuse the existing segmented-control markup (.seg), not two same-weight buttons');
  assert.ok(paymentBlockSrc.includes('data-plan="Full" aria-pressed='), 'the plan switcher must use aria-pressed, like the existing Urutkan segmented control');
  assert.ok(paymentBlockSrc.includes('var planLocked = pay !== \'Unpaid\';') &&
    paymentBlockSrc.includes('Cara pembayaran terkunci setelah pembayaran mulai diproses.'),
    'the plan switcher must be disabled with an explanation once payment has started, mirroring the server PAYMENT_STARTED rule');
  const ongkirIdx = paymentBlockSrc.indexOf('id="ongkir-');
  const planIdx = paymentBlockSrc.indexOf('data-plan="Full"');
  assert.ok(planIdx !== -1 && ongkirIdx !== -1 && planIdx < ongkirIdx,
    'the plan switcher must render before the ongkir field, not inside the same actions row as Tandai lunas');
  assert.ok(/if \(amount === null\) html \+= '<p class="why">Isi ongkir dulu[\s\S]{0,300}if \(shipErr\)/.test(paymentBlockSrc),
    'the isi-ongkir hint must render immediately under the ongkir field, not after the action buttons');
  assert.ok(paymentBlockSrc.includes('class="amtwrap"') && paymentBlockSrc.includes('id="ongkirEcho"'),
    'the ongkir field must show a Rp prefix and a live formatted echo');
  assert.ok(deskHtml.includes('function updateOngkirEcho('), 'a live echo/total updater must exist for the ongkir input');
  console.log('✔ Suite 32 Passed\n');
}

console.log('--- SUITE 33 (P3-6): the destructive cancel action is separated from routine payment buttons ---');
{
  assert.ok(deskHtml.includes('function cancelBlock(o)'), 'a dedicated cancelBlock() must exist, separate from paymentBlock()');
  const paymentBlockStart = deskHtml.indexOf('function paymentBlock(o)');
  const paymentBlockEnd = deskHtml.indexOf('\n  function renderTicket()', paymentBlockStart);
  const paymentBlockSrc = deskHtml.slice(paymentBlockStart, paymentBlockEnd);
  assert.ok(!paymentBlockSrc.includes('data-askcancel'),
    'Batalkan pesanan must no longer live inside the payment .actions row');
  assert.ok(deskHtml.includes('cancelBlock(o) +'), 'the ticket must render cancelBlock() at the bottom, below the notes block');
  console.log('✔ Suite 33 Passed\n');
}

console.log('--- SUITE 35 (P3-5): dates show a weekday where planning actually depends on it ---');
{
  assert.ok(deskHtml.includes("var DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];") &&
    deskHtml.includes('function fmtDateLong('),
    'a fmtDateLong() helper with Indonesian weekday abbreviations must exist');
  assert.ok(deskHtml.includes("esc(fmtDateLong(o.date))"), 'the ticket header date must show the weekday');
  assert.ok(deskHtml.includes("fmtDateLong(todayStr())"), 'the top bar date must show the weekday');
  console.log('✔ Suite 35 Passed\n');
}

console.log('--- SUITE 34 (P3-7): notes save status is honest, with retry instead of a mostly-no-op button ---');
{
  assert.ok(!deskHtml.includes('data-savenotes'), 'the old explicit Simpan catatan button must be gone — auto-save on blur is the one story now');
  assert.ok(deskHtml.includes('data-retrynotes="1"'), 'a retry action must exist for a failed note save');
  assert.ok(deskHtml.includes("notesErr ? 'Gagal menyimpan'"), 'the status label must reflect an actual save failure, not just always read belum tersimpan');
  console.log('✔ Suite 34 Passed\n');
}

console.log('--- SUITE 36 (P4-1/P4-2/P4-6): touch targets, contrast, and tag density ---');
{
  assert.ok(/\.btn \{[^}]*min-height: 44px;/.test(deskHtml), '.btn must have a 44px minimum tap target');
  assert.ok(/\.tick \{[^}]*min-height: 44px;/.test(deskHtml), '.tick must have a 44px minimum tap target');
  assert.ok(/\.comp \{[^}]*min-height: 44px;/.test(deskHtml), '.comp must have a 44px minimum tap target');
  assert.ok(deskHtml.includes('.chips button::before') && deskHtml.includes('.seg button::before'),
    'dense rows (chips, segmented controls) must extend their tap target via an invisible overlay rather than growing visually');
  assert.ok(deskHtml.includes('--muted: #5F6A5D;'), '--muted must be darkened in the light palette for AA contrast');
  assert.ok(deskHtml.includes('var tagCandidates = []') && deskHtml.includes('var tags = tagCandidates.slice(0, 3);'),
    'card tags must be capped at three, in priority order');
  assert.ok(!deskHtml.includes("if (o.card) tags.push('<span class=\"tag\">Kartu</span>')"),
    'the Kartu tag must be dropped from cards — the ticket itself already shows it');
  assert.ok(deskHtml.includes("'<span class=\"what\">' + wrapSwatchHtml + esc(summary)"),
    'the wrap colour must move inline next to the item summary as a bare chip, not a labelled tag');
  console.log('✔ Suite 36 Passed\n');
}

console.log('--- SUITE 37 (P4-3/P4-4/P4-5): screen-reader noise, lost focus, and a manual theme switch ---');
{
  assert.ok(!deskHtml.includes('<section class="ticket" id="ticket" aria-live="polite">'),
    'the whole ticket must not be an aria-live region — it announces the entire order on every change');
  assert.ok(deskHtml.includes('<section class="pulse" id="pulse" aria-live="polite">'),
    'the short pulse summary should stay a live region');
  assert.ok(deskHtml.includes("data-fk=\"paymentHeading\"") && deskHtml.includes("data-fk=\"phaseHeading\"") &&
    deskHtml.includes("data-fk=\"notesHeading\""),
    'block headings must be focusable fallback targets (tabindex=-1 + data-fk)');
  assert.ok(deskHtml.includes("refocus = 'paymentHeading';") && deskHtml.includes("refocus = 'phaseHeading';"),
    'payment and phase actions must claim focus back after their full re-render');
  assert.ok(deskHtml.includes("elTicket.querySelector('[data-fk=\"' + refocus + '\"]') || elTicket.querySelector('.block > h3[data-fk]')"),
    'a refocus target that no longer exists after the change must fall back to a block heading, not lose focus to <body>');
  assert.ok(deskHtml.includes("var THEME_KEY = 'alxanthia-desk-theme-v1';") && deskHtml.includes('function applyTheme('),
    'a persisted manual theme override must exist, since the stylesheet already supports data-theme in both directions');
  assert.ok(deskHtml.includes('data-theme-choice="light"') && deskHtml.includes('data-theme-choice="dark"'),
    'the theme switch must offer explicit Terang/Gelap choices, not just follow the OS');
  console.log('✔ Suite 37 Passed\n');
}

console.log('--- SUITE 38 (P5-1/P5-2/P5-3/P5-4): offline indicator, refresh timestamp, desktop history, copy revert ---');
{
  assert.ok(deskHtml.includes("document.body.classList.toggle('offline', !navigator.onLine)") &&
    deskHtml.includes("if (!navigator.onLine) {\n      toast('Tidak ada koneksi"),
    'writeField must refuse to even attempt an optimistic write while offline, and render() must reflect the offline state');
  assert.ok(deskHtml.includes('var ordersFetchedAt = null;') && deskHtml.includes('function relTimeFromNow('),
    'the last successful order refresh must be tracked and shown as a relative time');
  assert.ok(deskHtml.includes("window.matchMedia('(max-width: 899px)').matches"),
    'pushing a history entry for the detail view must be guarded to the mobile breakpoint, where it has any effect');
  assert.ok(/copyCard\.textContent = 'Tersalin';\s*\/\*[\s\S]*?setTimeout\(function \(\) \{\s*if \(document\.body\.contains\(copyCard\)\) copyCard\.textContent = 'Salin teks kartu';/.test(deskHtml),
    'the copy-card button must revert its label after a timeout, not stay "Tersalin" indefinitely');
  console.log('✔ Suite 38 Passed\n');
}

console.log('--- SUITE 39 (P5-6): the client\'s Cancelled definition matches either signal the sheet can set ---');
{
  assert.ok(deskHtml.includes("order.phase !== 'Cancelled' && order.payment !== 'Cancelled'"),
    'isActive() must also exclude a phase-cancelled order, not just a payment-cancelled one');
  assert.ok(deskHtml.includes("return order.payment === 'Cancelled' || order.phase === 'Cancelled';"),
    'the Dibatalkan lane must match either Payment Status or Work Phase being Cancelled');
  assert.ok(serverSrc.includes("if (order.phase === 'Cancelled' || order.phase === 'Delivered') {"),
    'includeOrder_ must age phase-cancelled rows out on the same window as Delivered, instead of dropping them outright');
  console.log('✔ Suite 39 Passed\n');
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

console.log('--- SUITE 40 (P5-7): the client prefers the server\'s date over the device clock ---');
{
  assert.ok(deskHtml.includes('if (state.catalog && state.catalog.serverToday) return state.catalog.serverToday;'),
    'todayStr() must prefer catalog.serverToday when the catalogue has loaded');
  assert.ok(serverSrc.includes('labels.serverToday = todayStr_();'),
    'getCatalog()/refreshCatalog() must return the server\'s own todayStr_(), computed fresh rather than cached with the rest of the catalogue');
  const sandbox = makeSandbox({ fetch: () => ({ getResponseCode: () => 200, getContentText: () => siteContentJson }) });
  const catalog = sandbox.getCatalog();
  assert.strictEqual(catalog.serverToday, '2026-09-12', 'serverToday must reflect the server clock (fixedNow), independent of any device clock');
  console.log('✔ Suite 40 Passed\n');
}

console.log('--- SUITE 50 (SD-01..SD-04 client): review, ledger, checklist sync, and Riwayat are wired into the ticket ---');
{
  assert.ok(deskHtml.includes('function reviewBlock(o)') && deskHtml.includes('data-markreviewed="1"'),
    'a Tinjau pesanan block with an explicit mark-reviewed action must exist');
  assert.ok(deskHtml.includes('function markReviewedAction(o)') && deskHtml.includes('.markReviewed({ ref: o.ref });'),
    'marking reviewed must call the server markReviewed command');

  assert.ok(deskHtml.includes('function ledgerBlock(o)') && deskHtml.includes('<span>Diterima '),
    'a ledger block showing the verified received amount must exist, separate from the Payment Status workflow');
  assert.ok(deskHtml.includes("o.paymentReconciliation === 'legacy_unreconciled'"),
    'a legacy-unreconciled order must be flagged in the ledger block, not silently treated as freshly unpaid');
  assert.ok(deskHtml.includes('function generateIdempotencyKey()') &&
    deskHtml.includes('paymentIdempotencyKey = generateIdempotencyKey();'),
    'opening the Catat pembayaran form must mint an idempotency key');
  assert.ok(/withFailureHandler\(function \(err\) \{\s*delete pending\[key\];\s*toast\(esc\(String\(\(err && err\.message\) \|\| err\)\), true\);\s*render\(\);\s*\}\)\s*\.recordPayment/.test(deskHtml),
    'a failed recordPayment call must not clear paymentIdempotencyKey, so a retry reuses the same key');
  assert.ok(!/paymentIdempotencyKey = null;[\s\S]{0,40}withFailureHandler/.test(deskHtml),
    'the idempotency key must survive a failure, not be cleared before the retry path');

  assert.ok(deskHtml.includes('function loadTicketExtras(o)') && deskHtml.includes('.getChecklist(o.ref);') && deskHtml.includes('.getActivity(o.ref);'),
    'opening a ticket must fetch its server checklist and activity extras');
  assert.ok(deskHtml.includes('function applyServerChecklist(') && deskHtml.includes('extrasLoadedFor === o.ref'),
    'extras must load once per ticket open, and the server checklist must be merged in as the authoritative state');
  assert.ok(deskHtml.includes("syncChecklistItem(o.ref, comp.dataset.contentkey"),
    'ticking a make-list item must also push its state to the server, keyed by content rather than position');
  assert.ok(deskHtml.includes("data-contentkey=\"' + esc(c.contentKey)"),
    'each make-list item must carry its content-derived checklist key in the DOM');

  assert.ok(deskHtml.includes('var PACKING_ITEMS =') && deskHtml.includes('function packingComplete(o)'),
    'a distinct final packing checklist must exist');
  assert.ok(deskHtml.includes('var packingBlocksAdvance = packingRequired && !packingComplete(o);') &&
    deskHtml.includes("phasePending || packingBlocksAdvance || blockerBlocksAdvance ? ' disabled' : ''"),
    'the Lanjut button leaving Dirangkai dan dikemas must be blocked until the packing checklist is complete');

  assert.ok(deskHtml.includes('function riwayatBlock(o)') && deskHtml.includes('state.activity[o.ref]'),
    'a read-only Riwayat panel sourced from the server activity log must exist');

  assert.ok(deskHtml.includes('function itemContentKey(item)') && deskHtml.includes('function itemChecklistKeys(items)'),
    'the client must mirror the server\'s itemContentKey_/itemChecklistKeys_ exactly for checklist keys to match');
  console.log('✔ Suite 50 Passed\n');
}

// ---------------------------------------------------------------------------
// 5. Desk Ops suites (SD-01..SD-04 in STUDIO-DESK-ADDITIONAL-IMPLEMENTATION.md)
//    — the additive payment ledger, durable checklist, activity log, and
//    review-completion storage, each in its own sheet, keyed by Order
//    Reference, written only through the narrow commands below.
// ---------------------------------------------------------------------------
function makeDeskOpsSandbox(orderRows, opsSheets) {
  const sheet = makeSheetStub(orderRows);
  return makeSandbox({ sheet, opsSheets: opsSheets || {} });
}

console.log('--- SUITE 41 (SD-01): recordPayment records a receipt and surfaces it on the order ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-LEDGER-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 200000, 'Shipping Fee': '',
    'Payment Status': 'Unpaid'
  })];
  const ledgerSheet = makeOpsSheetStub([[]]);
  const sandbox = makeDeskOpsSandbox(orderRows, { 'Desk Ledger': ledgerSheet, 'Desk Activity': makeOpsSheetStub([[]]) });

  const res = sandbox.recordPayment({ ref: 'ALX-LEDGER-1', type: 'receipt', amount: 100000, idempotencyKey: 'idem-1' });
  assert.strictEqual(res.ok, true, 'a valid receipt must be recorded');
  assert.strictEqual(res.summary.received, 100000);
  assert.strictEqual(res.summary.hasLedgerEvents, true);

  const orders = sandbox.listOrders();
  assert.strictEqual(orders[0].received, 100000, 'listOrders() must surface the received total from the ledger');
  assert.strictEqual(orders[0].hasLedgerEvents, true);
  console.log('✔ Suite 41 Passed\n');
}

console.log('--- SUITE 42 (SD-01): a shipping change after a deposit preserves the received amount and updates the balance ---');
{
  // Total Rp200.000, verified DP Rp100.000, new total Rp220.000: received
  // remains Rp100.000, balance becomes Rp120.000 — the review's own
  // acceptance example for SD-01.
  const orderRows = [rowFor({
    'Order Reference': 'ALX-LEDGER-2', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 200000, 'Shipping Fee': '',
    'Payment Status': 'Unpaid', 'Payment Plan': 'Deposit 50%'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, {
    'Desk Ledger': makeOpsSheetStub([[]]),
    'Desk Activity': makeOpsSheetStub([[]])
  });
  sandbox.recordPayment({ ref: 'ALX-LEDGER-2', type: 'receipt', amount: 100000, idempotencyKey: 'idem-2a' });
  sandbox.updateOrder({ ref: 'ALX-LEDGER-2', row: 2, field: 'shipping', value: 20000 });

  const orders = sandbox.listOrders();
  assert.strictEqual(orders[0].received, 100000, 'the verified receipt must not move just because the total changed');
  assert.strictEqual(orders[0].verified + orders[0].shipping - orders[0].received, 120000, 'the outstanding balance must reflect the new total');
  console.log('✔ Suite 42 Passed\n');
}

console.log('--- SUITE 43 (SD-01): a duplicate receipt command (retry after a lost response) records one event, not two ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-LEDGER-3', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 200000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, {
    'Desk Ledger': makeOpsSheetStub([[]]),
    'Desk Activity': makeOpsSheetStub([[]])
  });
  const first = sandbox.recordPayment({ ref: 'ALX-LEDGER-3', type: 'receipt', amount: 100000, idempotencyKey: 'idem-3' });
  const retry = sandbox.recordPayment({ ref: 'ALX-LEDGER-3', type: 'receipt', amount: 100000, idempotencyKey: 'idem-3' });
  assert.strictEqual(retry.ok, true);
  assert.strictEqual(retry.idempotentReplay, true, 'a repeated idempotencyKey must be recognised as a replay');
  assert.strictEqual(retry.event.eventId, first.event.eventId, 'the replay must return the original event, not a new one');
  assert.strictEqual(sandbox.listOrders()[0].received, 100000, 'the amount must not be counted twice');
  console.log('✔ Suite 43 Passed\n');
}

console.log('--- SUITE 44 (SD-01): a legacy Paid order with no ledger history is flagged for reconciliation, not silently zeroed ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-LEGACY-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 200000, 'Shipping Fee': '', 'Payment Status': 'Paid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, { 'Desk Ledger': makeOpsSheetStub([[]]) });
  const orders = sandbox.listOrders();
  assert.strictEqual(orders[0].received, 0);
  assert.strictEqual(orders[0].paymentReconciliation, 'legacy_unreconciled',
    'a Paid order with no ledger events must be surfaced as needing reconciliation, not treated as freshly unpaid');

  const freshOrders = [rowFor({
    'Order Reference': 'ALX-FRESH-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 200000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const freshSandbox = makeDeskOpsSandbox(freshOrders, { 'Desk Ledger': makeOpsSheetStub([[]]) });
  assert.strictEqual(freshSandbox.listOrders()[0].paymentReconciliation, 'known',
    'an order that was never marked Paid has nothing to reconcile');
  console.log('✔ Suite 44 Passed\n');
}

console.log('--- SUITE 45 (SD-01): dispatch is blocked server-side when verified receipts fall short, even if Payment Status says Paid ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-DISPATCH-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Ready for dispatch', 'Location Type': 'bali', 'Verified Total': 200000, 'Shipping Fee': '', 'Payment Status': 'Paid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, {
    'Desk Ledger': makeOpsSheetStub([[]]),
    'Desk Activity': makeOpsSheetStub([[]])
  });
  sandbox.recordPayment({ ref: 'ALX-DISPATCH-1', type: 'receipt', amount: 50000, idempotencyKey: 'idem-5' });
  const res = sandbox.updateOrder({ ref: 'ALX-DISPATCH-1', row: 2, field: 'phase', value: 'Shipped' });
  assert.strictEqual(res.ok, false, 'Shipped must be refused when verified receipts (Rp50.000) fall short of the Rp200.000 total');
  assert.strictEqual(res.code, 'PAYMENT_DUE');

  sandbox.recordPayment({ ref: 'ALX-DISPATCH-1', type: 'receipt', amount: 150000, idempotencyKey: 'idem-6' });
  const res2 = sandbox.updateOrder({ ref: 'ALX-DISPATCH-1', row: 2, field: 'phase', value: 'Shipped' });
  assert.strictEqual(res2.ok, true, 'Shipped must succeed once verified receipts reach the total');
  console.log('✔ Suite 45 Passed\n');
}

console.log('--- SUITE 46 (SD-02): checklist state is durable, keyed by content rather than position ---');
{
  const sandbox = makeDeskOpsSandbox([], { 'Desk Checklist': makeOpsSheetStub([[]]) });
  const itemA = { type: 'stem', id: 'Rose', qty: 3, wrapped: true };
  const itemB = { type: 'pot', id: 'daisy', qty: 1 };
  const keysBefore = sandbox.itemChecklistKeys_([itemA, itemB]);
  const keysReordered = sandbox.itemChecklistKeys_([itemB, itemA]);
  assert.deepStrictEqual(new Set(keysBefore), new Set(keysReordered), 'reordering items must not change their individual keys');

  const setRes = sandbox.setChecklistItem({ ref: 'ALX-CHK-1', key: keysBefore[0], contentVersion: keysBefore[0], completed: true });
  assert.strictEqual(setRes.ok, true);
  let state = sandbox.getChecklist('ALX-CHK-1');
  assert.strictEqual(state.length, 1);
  assert.strictEqual(state[0].completed, true);

  // Toggling again upserts in place, not a second row.
  sandbox.setChecklistItem({ ref: 'ALX-CHK-1', key: keysBefore[0], contentVersion: keysBefore[0], completed: false });
  state = sandbox.getChecklist('ALX-CHK-1');
  assert.strictEqual(state.length, 1, 'the same (ref, key) must upsert in place, never append a duplicate row');
  assert.strictEqual(state[0].completed, false);

  const itemAEdited = { type: 'stem', id: 'Rose', qty: 5, wrapped: true };
  const keysAfterEdit = sandbox.itemChecklistKeys_([itemAEdited, itemB]);
  assert.notStrictEqual(keysAfterEdit[0], keysBefore[0], 'editing an item\'s content must change its own key, invalidating only its own check');
  assert.strictEqual(keysAfterEdit[1], keysBefore[1], 'an unrelated, unchanged item must keep its key');
  console.log('✔ Suite 46 Passed\n');
}

console.log('--- SUITE 47 (SD-03): phase/payment changes and payment events leave a plain-Indonesian activity trail ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-ACT-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, {
    'Desk Ledger': makeOpsSheetStub([[]]),
    'Desk Activity': makeOpsSheetStub([[]])
  });
  sandbox.updateOrder({ ref: 'ALX-ACT-1', row: 2, field: 'phase', value: 'Assembly and packing' });
  sandbox.recordPayment({ ref: 'ALX-ACT-1', type: 'receipt', amount: 50000, idempotencyKey: 'idem-7' });

  const activity = sandbox.getActivity('ALX-ACT-1');
  assert.strictEqual(activity.length, 2);
  assert.strictEqual(activity[0].action, 'payment_recorded', 'getActivity() must return newest first');
  assert.ok(activity[0].detail.includes('Rp 50.000'), 'the activity detail must be a plain-Indonesian description, not a raw field dump');
  assert.strictEqual(activity[1].action, 'phase_changed');
  assert.ok(activity[1].detail.includes('Dirangkai dan dikemas'));
  console.log('✔ Suite 47 Passed\n');
}

console.log('--- SUITE 48 (SD-04): review completion is explicit, survives reload, and is idempotent ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-REVIEW-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, { 'Desk Activity': makeOpsSheetStub([[]]) });

  assert.strictEqual(sandbox.listOrders()[0].reviewedAt, '', 'an order must not start out reviewed');

  const first = sandbox.markReviewed({ ref: 'ALX-REVIEW-1' });
  assert.strictEqual(first.ok, true);
  assert.ok(first.reviewedAt);

  const retry = sandbox.markReviewed({ ref: 'ALX-REVIEW-1' });
  assert.strictEqual(retry.idempotentReplay, true, 'reviewing an already-reviewed order must be idempotent, not create a second record');
  assert.strictEqual(retry.reviewedAt, first.reviewedAt);

  const orders = sandbox.listOrders();
  assert.strictEqual(orders[0].reviewedAt, first.reviewedAt, 'listOrders() must surface the reviewed state so it survives a reload');
  console.log('✔ Suite 48 Passed\n');
}

console.log('--- SUITE 49: Desk Ops migration is additive, idempotent, and reports what it does ---');
{
  const sandbox = makeDeskOpsSandbox([], {});
  const dryRun = sandbox.deskOpsMigrationDryRun();
  assert.ok(dryRun.includes('Desk Ledger: MISSING') && dryRun.includes('dry run'),
    'a dry run must report what would happen without creating anything');
  assert.deepStrictEqual(sandbox._insertedSheetNames, [], 'a dry run must not actually create any sheet');

  const applyReport = sandbox.deskOpsMigrationApply();
  assert.ok(applyReport.includes('Desk Ledger') && applyReport.includes('creating'));
  assert.strictEqual(sandbox._insertedSheetNames.length, 8, 'all eight Desk Ops sheets must be created');
  // Array.from() re-materialises both sides in this (outer) realm — the vm
  // sandbox's own arrays are a different realm than this test file's, so a
  // strict-equal Array constructor check would fail here despite matching
  // content.
  assert.deepStrictEqual(
    Array.from(sandbox._sheetsByName['Desk Ledger'].getRange(1, 1, 1, sandbox.DESK_LEDGER_HEADERS.length).getValues()[0]),
    Array.from(sandbox.DESK_LEDGER_HEADERS),
    'the created sheet\'s header row must match the real DESK_LEDGER_HEADERS constant, not a copy that could drift from it'
  );

  // Re-running after creation must be a no-op, not a duplicate/second sheet.
  const secondApply = sandbox.deskOpsMigrationApply();
  assert.ok(secondApply.includes('OK'), 're-running the migration once sheets exist must report OK, not recreate them');
  assert.strictEqual(sandbox._insertedSheetNames.length, 8, 'a second run must not insert any further sheets');
  console.log('✔ Suite 49 Passed\n');
}

// ---------------------------------------------------------------------------
// 6. Desk Ops suites (SD-08..SD-11 in STUDIO-DESK-ADDITIONAL-IMPLEMENTATION.md)
//    — scheduling, package composition snapshots, delivery/pickup records,
//    and explicit blockers, each additive and keyed by Order Reference like
//    SD-01..SD-04 above.
// ---------------------------------------------------------------------------
console.log('--- SUITE 51 (SD-08): scheduling stores an agreed date/time and production deadline, validated and durable ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-SCHED-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, { 'Desk Schedule': makeOpsSheetStub([[]]), 'Desk Activity': makeOpsSheetStub([[]]) });

  const badDate = sandbox.setSchedule({ ref: 'ALX-SCHED-1', agreedDate: '2026/09/20' });
  assert.strictEqual(badDate.ok, false);
  assert.strictEqual(badDate.code, 'BAD_DATE');

  const inconsistent = sandbox.setSchedule({ ref: 'ALX-SCHED-1', agreedDate: '2026-09-20', productionDeadline: '2026-09-22' });
  assert.strictEqual(inconsistent.ok, false);
  assert.strictEqual(inconsistent.code, 'INCONSISTENT_DATES', 'a production deadline after the agreed date must be rejected');

  const first = sandbox.setSchedule({ ref: 'ALX-SCHED-1', agreedDate: '2026-09-20', agreedTime: '14:30', productionDeadline: '2026-09-19' });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.schedule.agreedDate, '2026-09-20');
  assert.strictEqual(first.schedule.agreedTime, '14:30');
  assert.strictEqual(first.schedule.productionDeadline, '2026-09-19');

  // Rescheduling upserts the same row rather than appending a second one.
  const second = sandbox.setSchedule({ ref: 'ALX-SCHED-1', agreedDate: '2026-09-21', rescheduleReason: 'Pembeli minta ubah tanggal' });
  assert.strictEqual(second.ok, true);
  const stored = sandbox.getSchedule('ALX-SCHED-1');
  assert.strictEqual(stored.agreedDate, '2026-09-21');
  assert.strictEqual(stored.rescheduleReason, 'Pembeli minta ubah tanggal');

  const activity = sandbox.getActivity('ALX-SCHED-1');
  assert.strictEqual(activity.length, 2, 'each schedule change must leave its own activity entry');
  assert.strictEqual(activity[0].action, 'schedule_changed');

  const orders = sandbox.listOrders();
  assert.strictEqual(orders[0].schedule.agreedDate, '2026-09-21', 'listOrders() must surface the current schedule on each order');
  console.log('✔ Suite 51 Passed\n');
}

console.log('--- SUITE 52 (SD-09): package composition is validated against the catalogue and snapshots labels; changing it invalidates its own checklist entry ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-COMP-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sheet = makeSheetStub(orderRows);
  const checklistSheet = makeOpsSheetStub([[]]);
  const sandbox = makeSandbox({
    sheet,
    opsSheets: { 'Desk Composition': makeOpsSheetStub([[]]), 'Desk Checklist': checklistSheet, 'Desk Activity': makeOpsSheetStub([[]]) },
    fetch: () => ({ getResponseCode: () => 200, getContentText: () => siteContentJson })
  });

  // Package index 0 is specified as 3 stems (site-content.js), so a 2-stem
  // composition must be rejected against the catalogue's own spec.
  const mismatch = sandbox.setComposition({ ref: 'ALX-COMP-1', lineKey: 'line-1', packageIndex: 0, stems: { Sunflower: 2 } });
  assert.strictEqual(mismatch.ok, false);
  assert.strictEqual(mismatch.code, 'STEM_COUNT_MISMATCH');

  const empty = sandbox.setComposition({ ref: 'ALX-COMP-1', lineKey: 'line-1', packageIndex: 0, stems: {} });
  assert.strictEqual(empty.ok, false);
  assert.strictEqual(empty.code, 'BAD_COMPOSITION');

  // Tick the make-list entry for this same line before the composition changes.
  checklistSheet.appendRow(['ALX-COMP-1', 'line-1', 'v1', true, '2026-09-12 10:00:00', 'maker@example.com']);

  const res = sandbox.setComposition({ ref: 'ALX-COMP-1', lineKey: 'line-1', packageIndex: 0, stems: { Sunflower: 3 }, additions: { rounded: 1 } });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.composition.stems[0].name, 'Bunga Matahari', 'the flower label must be snapshotted from the catalogue, not just the raw key');
  assert.strictEqual(res.composition.additions[0].name, 'Daun Bulat');

  const stored = sandbox.getComposition('ALX-COMP-1');
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].composition.stems[0].qty, 3);

  const checklistState = sandbox.getChecklist('ALX-COMP-1');
  const line1 = checklistState.find((c) => c.key === 'line-1');
  assert.strictEqual(line1.completed, false, 'a composition change must invalidate whatever was already ticked for this same line');
  console.log('✔ Suite 52 Passed\n');
}

console.log('--- SUITE 53 (SD-10): delivery info persists without clobbering unrelated fields, tracking is validated, and handoff/completion are payment- and blocker-gated, idempotent ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-DELIV-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, {
    'Desk Delivery': makeOpsSheetStub([[]]),
    'Desk Ledger': makeOpsSheetStub([[]]),
    'Desk Blocker': makeOpsSheetStub([[]]),
    'Desk Activity': makeOpsSheetStub([[]])
  });

  const badTracking = sandbox.setDeliveryInfo({ ref: 'ALX-DELIV-1', tracking: 'javascript:alert(1)' });
  assert.strictEqual(badTracking.ok, false);
  assert.strictEqual(badTracking.code, 'BAD_TRACKING');

  const info = sandbox.setDeliveryInfo({ ref: 'ALX-DELIV-1', recipientName: 'Made Ayu', courier: 'Grab', tracking: 'https://track.example/abc' });
  assert.strictEqual(info.ok, true);
  assert.strictEqual(info.delivery.recipientName, 'Made Ayu');

  const partial = sandbox.setDeliveryInfo({ ref: 'ALX-DELIV-1', destinationDetail: 'Depan pagar hijau' });
  assert.strictEqual(partial.delivery.recipientName, 'Made Ayu', 'an unrelated field update must preserve what was already set');
  assert.strictEqual(partial.delivery.tracking, 'https://track.example/abc');

  const blockedByPayment = sandbox.markHandoff({ ref: 'ALX-DELIV-1' });
  assert.strictEqual(blockedByPayment.ok, false);
  assert.strictEqual(blockedByPayment.code, 'PAYMENT_DUE', 'handoff (courier or self-pickup alike) must never bypass the payment gate');

  sandbox.recordPayment({ ref: 'ALX-DELIV-1', type: 'receipt', amount: 50000, idempotencyKey: 'idem-deliv-1' });
  sandbox.updateOrder({ ref: 'ALX-DELIV-1', row: 2, field: 'payment', value: 'Paid' });
  const stillShort = sandbox.markHandoff({ ref: 'ALX-DELIV-1' });
  assert.strictEqual(stillShort.ok, false);
  assert.strictEqual(stillShort.code, 'PAYMENT_DUE', 'Payment Status alone is not authoritative once ledger events exist — the received total must also cover the bill');

  sandbox.recordPayment({ ref: 'ALX-DELIV-1', type: 'receipt', amount: 50000, idempotencyKey: 'idem-deliv-2' });

  sandbox.setBlocker({ ref: 'ALX-DELIV-1', reason: 'menunggu jawaban pembeli' });
  const blockedByBlocker = sandbox.markHandoff({ ref: 'ALX-DELIV-1' });
  assert.strictEqual(blockedByBlocker.ok, false);
  assert.strictEqual(blockedByBlocker.code, 'BLOCKED', 'an open blocker must hold handoff, not just phase changes');
  sandbox.resolveBlocker({ ref: 'ALX-DELIV-1' });

  const handoff = sandbox.markHandoff({ ref: 'ALX-DELIV-1' });
  assert.strictEqual(handoff.ok, true);
  assert.ok(handoff.delivery.handoffAt);

  const handoffRetry = sandbox.markHandoff({ ref: 'ALX-DELIV-1' });
  assert.strictEqual(handoffRetry.idempotentReplay, true, 'a repeated handoff command must not overwrite the original handoffAt');
  assert.strictEqual(handoffRetry.delivery.handoffAt, handoff.delivery.handoffAt);

  const complete = sandbox.markDeliveryComplete({ ref: 'ALX-DELIV-1' });
  assert.strictEqual(complete.ok, true);
  assert.ok(complete.delivery.completedAt);

  const completeRetry = sandbox.markDeliveryComplete({ ref: 'ALX-DELIV-1' });
  assert.strictEqual(completeRetry.idempotentReplay, true);
  assert.strictEqual(completeRetry.delivery.completedAt, complete.delivery.completedAt);
  console.log('✔ Suite 53 Passed\n');
}

console.log('--- SUITE 54 (SD-11): a blocker holds forward phase progress only, is idempotent to open/resolve, and never touches payment or notes ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-BLOCK-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Assembly and packing', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, { 'Desk Blocker': makeOpsSheetStub([[]]), 'Desk Activity': makeOpsSheetStub([[]]) });

  const badReason = sandbox.setBlocker({ ref: 'ALX-BLOCK-1', reason: 'alasan aneh' });
  assert.strictEqual(badReason.ok, false);
  assert.strictEqual(badReason.code, 'BAD_REASON');

  const opened = sandbox.setBlocker({ ref: 'ALX-BLOCK-1', reason: 'bahan belum tersedia', note: 'Menunggu kiriman mawar' });
  assert.strictEqual(opened.ok, true);
  assert.strictEqual(opened.blocker.reason, 'bahan belum tersedia');

  // Opening again while one is already open is a no-op replay, not a second blocker.
  const openedAgain = sandbox.setBlocker({ ref: 'ALX-BLOCK-1', reason: 'masalah pengiriman' });
  assert.strictEqual(openedAgain.idempotentReplay, true);
  assert.strictEqual(openedAgain.blocker.reason, 'bahan belum tersedia', 'a second setBlocker call must return the existing open blocker, not open a different one');

  const forward = sandbox.updateOrder({ ref: 'ALX-BLOCK-1', row: 2, field: 'phase', value: 'Ready for dispatch' });
  assert.strictEqual(forward.ok, false);
  assert.strictEqual(forward.code, 'BLOCKED', 'an open blocker must hold forward phase movement');

  const backward = sandbox.updateOrder({ ref: 'ALX-BLOCK-1', row: 2, field: 'phase', value: 'Not started' });
  assert.strictEqual(backward.ok, true, 'moving backward must stay usable while a blocker is open');

  const notes = sandbox.updateOrder({ ref: 'ALX-BLOCK-1', row: 2, field: 'notes', value: 'Catatan internal' });
  assert.strictEqual(notes.ok, true, 'an open blocker must never hold unrelated fields like notes');

  const resolved = sandbox.resolveBlocker({ ref: 'ALX-BLOCK-1' });
  assert.strictEqual(resolved.ok, true);
  assert.strictEqual(resolved.blocker, null);

  const resolvedRetry = sandbox.resolveBlocker({ ref: 'ALX-BLOCK-1' });
  assert.strictEqual(resolvedRetry.idempotentReplay, true, 'resolving with nothing open must be a no-op, not an error');

  const nowAllowed = sandbox.updateOrder({ ref: 'ALX-BLOCK-1', row: 2, field: 'phase', value: 'Assembly and packing' });
  assert.strictEqual(nowAllowed.ok, true, 'forward movement must be allowed again once the blocker is resolved');

  const activity = sandbox.getActivity('ALX-BLOCK-1');
  assert.ok(activity.some((a) => a.action === 'blocker_opened'));
  assert.ok(activity.some((a) => a.action === 'blocker_resolved'));

  const orders = sandbox.listOrders();
  assert.strictEqual(orders[0].blocker, null, 'listOrders() must show no open blocker once resolved');
  console.log('✔ Suite 54 Passed\n');
}

console.log('--- SUITE 55 (SD-08..SD-11 client): schedule, delivery/handoff, blocker banner, and composition editor are wired into the ticket ---');
{
  assert.ok(deskHtml.includes('function scheduleBlock(o)') && deskHtml.includes('.setSchedule({'),
    'a Jadwal block calling the server setSchedule command must exist');
  assert.ok(deskHtml.includes('data-openscheduleform') && deskHtml.includes('data-submitschedule'),
    'the schedule form must be reachable and submittable from the ticket');

  assert.ok(deskHtml.includes('function deliveryBlock(o)') && deskHtml.includes('.setDeliveryInfo({'),
    'a delivery block calling the server setDeliveryInfo command must exist, replacing the old static Pengantaran block');
  assert.ok(deskHtml.includes('function markHandoffAction(o)') && deskHtml.includes('.markHandoff({ ref: o.ref });'),
    'a handoff action calling the server markHandoff command must exist');
  assert.ok(deskHtml.includes('function markDeliveryCompleteAction(o)') && deskHtml.includes('.markDeliveryComplete({ ref: o.ref });'),
    'a delivery-completion action calling the server markDeliveryComplete command must exist');
  assert.ok(deskHtml.includes("isPickup ? 'Tandai siap diambil' : 'Tandai diserahkan ke kurir'") &&
    deskHtml.includes("isPickup ? 'Tandai sudah diambil' : 'Tandai sudah diterima'"),
    'the handoff/completion action labels must read correctly for both self-pickup and courier delivery');

  assert.ok(deskHtml.includes('function blockerBanner(o)') && deskHtml.includes("if (!o.blocker) return ''"),
    'a blocker banner must exist and only render while a blocker is open');
  assert.ok(deskHtml.includes('function blockerActionBlock(o)') && deskHtml.includes('data-openblockerform'),
    'an Ada kendala action to open a new blocker must exist');
  assert.ok(deskHtml.includes('function submitBlockerForm(o)') && deskHtml.includes('.setBlocker({ ref: o.ref, reason: blockerForm.reason, note: note });'),
    'submitting the blocker form must call the server setBlocker command with the chosen reason');
  assert.ok(deskHtml.includes('function resolveBlockerAction(o)') && deskHtml.includes('.resolveBlocker({ ref: o.ref });'),
    'a resolve action calling the server resolveBlocker command must exist');
  assert.ok(deskHtml.includes('var blockerBlocksAdvance = !!o.blocker;') &&
    deskHtml.includes("phasePending || packingBlocksAdvance || blockerBlocksAdvance ? ' disabled' : ''"),
    'an open blocker must also disable the Lanjut button, on top of the existing packing-checklist gate');
  assert.ok(deskHtml.includes("var BLOCKER_REASONS = [") && deskHtml.includes("key: 'bahan belum tersedia'"),
    'the client must mirror the server BLOCKER_REASONS values exactly so a chosen reason round-trips');

  assert.ok(deskHtml.includes('function compositionFor(ref, lineKey)') && deskHtml.includes('.getComposition(o.ref);'),
    'opening a ticket must fetch its server composition rows, keyed like the checklist');
  assert.ok(deskHtml.includes('function compositionEditorHtml(o, c)') && deskHtml.includes('.setComposition({ ref: o.ref, lineKey: lineKey, packageIndex: packageIndex, stems: stems, additions: additions });'),
    'a composition editor for package-type lines must exist and call the server setComposition command');
  assert.ok(deskHtml.includes('if (c.isPackage) li += compositionEditorHtml(o, c);'),
    'the composition editor must only be offered on package-type make-list lines, not stems/pots/custom');
  assert.ok(deskHtml.includes('applyServerChecklist(o.ref, o.items, rows2 || []);'),
    'saving a composition change must refetch the checklist so an invalidated tick from the server is reflected locally');

  // The pre-existing generic number-input change handler used to key off
  // e.target.type alone, which would have mistaken any of the new number
  // inputs (stem/addition quantities) for the shipping-fee field.
  assert.ok(deskHtml.includes("e.target.type !== 'number' || e.target.id.indexOf('ongkir-') !== 0"),
    'the shipping-fee change handler must be scoped to its own input, not any number input on the ticket');
  console.log('✔ Suite 55 Passed\n');
}

console.log('--- SUITE 56 (SD-12): an active order older than the recent window is still returned by listOrders() ---');
{
  var oldActiveRows = [rowFor({
    'Order Reference': 'ALX-OLD-ACTIVE', 'Preferred Date': '2026-01-01', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali'
  })];
  for (var i = 0; i < 500; i += 1) {
    oldActiveRows.push(rowFor({
      'Order Reference': 'ALX-FILLER-' + i, 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
      'Work Phase': 'Delivered', 'Location Type': 'bali'
    }));
  }
  const sandbox = makeSandbox({ sheet: makeSheetStub(oldActiveRows) });
  const refs = sandbox.listOrders().map(function (o) { return o.ref; });
  assert.ok(refs.includes('ALX-OLD-ACTIVE'),
    'an active order at row 2, 500+ rows outside the recent window, must still be returned — it must never be hidden just because its row is old');
  console.log('✔ Suite 56 Passed\n');
}

console.log("--- SUITE 57 (SD-12): a Delivered order's retention uses its real completion timestamp (SD-10) when one is on record, not just Preferred Date ---");
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-COMPLETED-1', 'Preferred Date': '2026-01-01', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Delivered', 'Location Type': 'bali', 'Payment Status': 'Paid'
  })];
  const deliveryRow = ['ALX-COMPLETED-1', '', '', '', '', '', '', '2026-09-11 10:00:00', '2026-09-11 10:00:00', 'maker@example.com'];
  const sandbox = makeSandbox({ sheet: makeSheetStub(orderRows), opsSheets: { 'Desk Delivery': makeOpsSheetStub([[], deliveryRow]) } });
  const orders = sandbox.listOrders();
  assert.strictEqual(orders.length, 1,
    'a Delivered order completed yesterday must still be listed, even though its Preferred Date (2026-01-01) is long past the retention window on its own');
  assert.strictEqual(orders[0].ref, 'ALX-COMPLETED-1');

  // Without any Desk Delivery record for it, the same far-past Preferred
  // Date order must still age out — the fallback must not silently keep
  // every Delivered order forever.
  const legacyRows = [rowFor({
    'Order Reference': 'ALX-LEGACY-DELIVERED', 'Preferred Date': '2026-01-01', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Delivered', 'Location Type': 'bali'
  })];
  const legacySandbox = makeSandbox({ sheet: makeSheetStub(legacyRows), opsSheets: { 'Desk Delivery': makeOpsSheetStub([[]]) } });
  assert.strictEqual(legacySandbox.listOrders().length, 0,
    'a Delivered order with no recorded completion timestamp must still fall back to the Preferred-Date-based window');
  console.log('✔ Suite 57 Passed\n');
}

console.log('--- SUITE 58 (SD-12): searchArchive() finds any order by reference/buyer/phone regardless of age, with a validated query ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-ARCHIVE-OLD', 'Preferred Date': '2020-01-01', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Delivered', 'Location Type': 'bali', 'Buyer Name': 'Wayan Sudira', 'Buyer WhatsApp': '+6281111222333'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, {});

  const tooShort = sandbox.searchArchive({ query: 'a' });
  assert.strictEqual(tooShort.ok, false);
  assert.strictEqual(tooShort.code, 'QUERY_TOO_SHORT');

  const byRef = sandbox.searchArchive({ query: 'archive-old' });
  assert.strictEqual(byRef.ok, true);
  assert.strictEqual(byRef.results.length, 1, 'an order far outside listOrders()\' retention window must still be findable by reference');
  assert.strictEqual(byRef.results[0].ref, 'ALX-ARCHIVE-OLD');
  assert.strictEqual(byRef.nextCursor, null);

  assert.strictEqual(sandbox.searchArchive({ query: 'sudira' }).results.length, 1, 'search must match buyer name case-insensitively');
  assert.strictEqual(sandbox.searchArchive({ query: '1111222' }).results.length, 1, 'search must match a WhatsApp number substring');
  assert.strictEqual(sandbox.searchArchive({ query: 'nomatch12' }).results.length, 0);
  console.log('✔ Suite 58 Passed\n');
}

console.log('--- SUITE 59 (SD-12): searchArchive() paginates with a stable cursor, covering every match exactly once ---');
{
  var pageRows = [];
  for (var p = 0; p < 30; p += 1) {
    pageRows.push(rowFor({
      'Order Reference': 'ALX-PAGE-' + String(p).padStart(2, '0'), 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
      'Work Phase': 'Not started', 'Location Type': 'bali'
    }));
  }
  const sandbox = makeDeskOpsSandbox(pageRows, {});
  const page1 = sandbox.searchArchive({ query: 'ALX-PAGE' });
  assert.strictEqual(page1.results.length, 25, 'the first page must be capped at ARCHIVE_PAGE_SIZE');
  assert.strictEqual(page1.nextCursor, 25);
  assert.strictEqual(page1.totalMatches, 30);

  const page2 = sandbox.searchArchive({ query: 'ALX-PAGE', cursor: page1.nextCursor });
  assert.strictEqual(page2.results.length, 5, 'the second page must return the remainder');
  assert.strictEqual(page2.nextCursor, null);

  const refsPage1 = page1.results.map(function (o) { return o.ref; });
  const refsPage2 = page2.results.map(function (o) { return o.ref; });
  assert.strictEqual(new Set(refsPage1.concat(refsPage2)).size, 30, 'the two pages together must cover every match exactly once, with no gap or overlap');

  const badCursor = sandbox.searchArchive({ query: 'ALX-PAGE', cursor: -5 });
  assert.strictEqual(badCursor.results.length, 25, 'a negative cursor must be treated as 0, not throw or skew the page');
  console.log('✔ Suite 59 Passed\n');
}

console.log('--- SUITE 60 (SD-12 client): the Arsip lane searches the server instead of filtering the loaded orders, with pagination ---');
{
  assert.ok(deskHtml.includes("{ key: 'archive', label: 'Arsip' }"), 'an Arsip chip/lane must exist');
  assert.ok(deskHtml.includes("if (laneKey === 'archive') return false;"),
    'the Arsip lane must not be a laneMatch() filter over state.orders — a match can be arbitrarily older than anything loaded');
  assert.ok(deskHtml.includes("state.lane === 'archive'") && deskHtml.includes('function triggerArchiveSearch(query, append)'),
    'selecting Arsip and typing must call a dedicated server search function');
  assert.ok(deskHtml.includes('.searchArchive({ query: trimmed, cursor: cursor });'),
    'the Arsip search must call the server searchArchive command');
  assert.ok(deskHtml.includes('if (state.archive.query !== trimmed) return;'),
    'a late search response for a query she has since changed must never clobber newer results (same request-ordering concern as SD-03 writes)');
  assert.ok(deskHtml.includes('data-loadmorearchive') && deskHtml.includes('triggerArchiveSearch(state.archive.query, true);'),
    'a "Muat lebih banyak" control must fetch the next page via the same search function, in append mode');
  assert.ok(deskHtml.includes('function findOrder(ref)') &&
    deskHtml.includes('(state.archive.results || []).find(function (o) { return o.ref === ref; })'),
    'findOrder() must also check archive results, so opening a ticket found via Arsip search works');
  assert.ok(deskHtml.includes('var archiveSearchTimer = null;') && deskHtml.includes('setTimeout(function () { triggerArchiveSearch(typed, false); }, 400);'),
    'typing in the search box while on the Arsip lane must be debounced, not fire a server request per keystroke');
  console.log('✔ Suite 60 Passed\n');
}

console.log('--- SUITE 61 (SD-05 client): Perlu ditangani is the default view, a shared nextAction() drives both cards and the ticket, and sorting is deadline-aware ---');
{
  assert.ok(deskHtml.includes("lane: 'attention',"), 'Perlu ditangani (attention) must be the default landing lane, not Aktif');
  assert.ok(deskHtml.includes("{ key: 'attention', label: 'Perlu ditangani' }"), 'a Perlu ditangani chip must exist');
  assert.ok(deskHtml.includes("if (laneKey === 'attention') return orderGroups(order).length > 0;"),
    'the Perlu ditangani lane must be derived from orderGroups(), not a bespoke filter that can drift from it');

  assert.ok(deskHtml.includes('function orderGroups(o)'), 'a shared orderGroups() function must exist');
  ['missingOrBlocked', 'review', 'paymentCheck', 'overdue', 'productionToday', 'inProduction', 'readyForHandoff'].forEach(function (g) {
    assert.ok(deskHtml.includes("groups.push('" + g + "')"), 'orderGroups() must derive the "' + g + '" work group from actual order records');
  });

  assert.ok(deskHtml.includes('function nextAction(o)'), 'a single shared next-action derivation function must exist');
  const cardUsesNextAction = /var action = nextAction\(o\);[\s\S]{0,1200}class="next">/.test(deskHtml);
  assert.ok(cardUsesNextAction, 'cardLi() must render nextAction()\'s own text, not a separately maintained label');
  assert.ok(deskHtml.includes('var ticketAction = nextAction(o);') && deskHtml.includes("class=\"next-action-banner\">"),
    'renderTicket() must show the same nextAction() text at the top of an open ticket');
  assert.ok(deskHtml.includes('if (!o.blocker && ticketAction)'),
    'the ticket banner must not duplicate blockerBanner()\'s own "Kendala: ..." message when a blocker is already open');

  // Priority: something wrong with the order itself outranks routine
  // production/handoff status, so a blocked/mismatched/incomplete order is
  // never masked by "Lanjutkan pengerjaan" or similar.
  const blockedIdx = deskHtml.indexOf("if (o.blocker) return 'Kendala: ' + o.blocker.reason;");
  const reviewIdx = deskHtml.indexOf("if (!o.reviewedAt) return 'Tinjau pesanan';");
  const readyIdx = deskHtml.indexOf("if (o.phase === 'Ready for dispatch') return o.method === 'self_pickup' ? 'Tandai siap diambil' : 'Serahkan ke kurir';");
  assert.ok(blockedIdx !== -1 && reviewIdx !== -1 && readyIdx !== -1 && blockedIdx < reviewIdx && reviewIdx < readyIdx,
    'nextAction() must check a blocker and review status before routine phase-based actions, in that priority order');
  assert.ok(deskHtml.includes("'Tentukan jadwal'") && deskHtml.includes("'Alamat belum lengkap'") &&
    deskHtml.includes("(usesDeposit(o) && o.payment !== 'Deposit paid' ? 'Cek DP ' : 'Cek pelunasan ') + rupiah(outstanding)"),
    'nextAction() must produce the documented example phrasings (Cek DP <amount>, Tentukan jadwal, Alamat belum lengkap)');

  assert.ok(deskHtml.includes('function operationalDate(o)') &&
    deskHtml.includes('return (o.schedule && o.schedule.agreedDate) || o.date;'),
    'sorting/grouping must prefer the SD-08 agreed date once one exists, falling back to the original Preferred Date');
  assert.ok(deskHtml.includes('var da = operationalDate(a), db = operationalDate(b);') &&
    deskHtml.includes("return a.ref < b.ref ? -1 : (a.ref > b.ref ? 1 : 0);"),
    'visibleOrders() must sort by the operational deadline with a deterministic reference tie-breaker, per SD-05');
  assert.ok(deskHtml.includes('var d = daysUntil(operationalDate(o));'),
    'the date-group headers must group by the same operational date the list is sorted by');

  assert.ok(deskHtml.includes("'Tidak ada yang perlu ditangani sekarang.'"),
    'an empty Perlu ditangani queue must read as a positive result, not the generic "no orders in this group" message');
  console.log('✔ Suite 61 Passed\n');
}

console.log('--- SUITE 62 (SD-06 client): one prominent primary action per stage, reusing existing validated commands, never a new bypass ---');
{
  assert.ok(deskHtml.includes('function primaryAction(o, catalog)'), 'a shared primaryAction() function must exist');

  // Every branch must reuse an existing, already-server-validated action —
  // never a bespoke shortcut that could bypass a payment/review/packing rule.
  assert.ok(deskHtml.includes("return { text: 'Tinjau pesanan', attrs: 'data-markreviewed=\"1\"' };"),
    "not reviewed -> Tinjau pesanan, via the existing markReviewed command");
  assert.ok(deskHtml.includes("return { text: 'Siapkan tagihan WhatsApp', attrs: 'data-sendpayment=\"' + (usesDeposit(o) ? 'deposit' : 'full') + '\"' };"),
    "reviewed with an unrequested quote -> Siapkan tagihan WhatsApp");
  assert.ok(deskHtml.includes("return { text: 'Periksa pembayaran', attrs: 'data-focusblock=\"paymentHeading\"' };"),
    "a Checking* payment status -> Periksa pembayaran, pointing at the existing payment block rather than a new verifying command");
  assert.ok(deskHtml.includes("return { text: g.allOk ? 'Mulai kerjakan' : 'Tetap mulai kerjakan', attrs: 'data-advance=\"1\"' };") &&
    deskHtml.includes('var g = gate(o, catalog);\n      if (!g.ready) return null;'),
    "Mulai kerjakan must only ever appear once gate()'s own ready check passes — the same check the advance button itself already enforces");
  assert.ok(deskHtml.includes("return packingComplete(o) ? { text: 'Lanjut: Siap dikirim', attrs: 'data-advance=\"1\"' }") &&
    deskHtml.includes("{ text: 'Periksa & kemas', attrs: 'data-focusblock=\"packingHeading\"' };"),
    "Assembly and packing must offer Periksa & kemas until the packing checklist is complete, then Lanjut, never a shortcut around packingComplete()");
  assert.ok(deskHtml.includes("return { text: 'Siapkan pesan pelunasan', attrs: 'data-sendpayment=\"balance\"' };"),
    "Ready for dispatch with an outstanding balance -> Siapkan pesan pelunasan");
  assert.ok(deskHtml.includes("if (!(o.delivery && o.delivery.handoffAt)) return { text: 'Catat penyerahan', attrs: 'data-markhandoff=\"1\"' };"),
    "paid and packed, not yet handed off -> Catat penyerahan, via the existing (payment/blocker-gated) markHandoff command");
  assert.ok(deskHtml.includes("if (!(o.delivery && o.delivery.completedAt)) return { text: 'Tandai selesai', attrs: 'data-markdeliverycomplete=\"1\"' };"),
    "handed off, not yet confirmed received/picked up -> Tandai selesai");
  assert.ok(deskHtml.includes('if (!isActive(o) || o.blocker) return null;'),
    'a blocked order must never get a primary action button — blockerBanner()\'s own resolve action is the only thing offered');

  assert.ok(deskHtml.includes("html += '<button type=\"button\" class=\"btn primary-action-btn\" ' + pAction.attrs + '>' + esc(pAction.text) + '</button>';"),
    'the ticket must render primaryAction() as an actual button, not just text, when one applies');
  assert.ok(deskHtml.includes('} else if (!o.blocker && ticketAction) {'),
    "the plain-text next-action banner must be the fallback only when there is no single clickable primary action");

  assert.ok(deskHtml.includes("var focusBlock = e.target.closest('[data-focusblock]');") &&
    deskHtml.includes('focusTarget.scrollIntoView({ behavior:'),
    'data-focusblock must bring the relevant section into view rather than perform a hidden mutation on her behalf');

  assert.ok(deskHtml.includes("'>Kembali: ' + esc(PHASES[pIndex - 1].label) + '</button>'"),
    'the reverse-stage action must name its destination phase (e.g. Kembali: Dirangkai dan dikemas), not just say Kembali');
  console.log('✔ Suite 62 Passed\n');
}

console.log('--- SUITE 63 (SD-07): opening WhatsApp only ever records a prepared message, never a sent claim, until explicitly confirmed ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-MSG-1', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, { 'Desk Message': makeOpsSheetStub([[]]), 'Desk Activity': makeOpsSheetStub([[]]) });

  const prepared = sandbox.logMessagePrepared({ ref: 'ALX-MSG-1', type: 'payment_deposit' });
  assert.strictEqual(prepared.ok, true);
  assert.ok(prepared.eventId);
  assert.ok(prepared.preparedAt);

  // Never sent, just prepared and abandoned — getMessageHistory() must show
  // it as unconfirmed, and the order's own lastMessage must stay unset.
  let history = sandbox.getMessageHistory('ALX-MSG-1');
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].confirmedAt, '');
  assert.strictEqual(sandbox.listOrders()[0].lastMessage, null,
    'an order with only an unconfirmed prepared message must not show a lastMessage — opening WhatsApp is never itself a sent claim');

  const confirmed = sandbox.confirmMessageSent({ ref: 'ALX-MSG-1', eventId: prepared.eventId });
  assert.strictEqual(confirmed.ok, true);
  assert.ok(confirmed.confirmedAt);

  const orders = sandbox.listOrders();
  assert.strictEqual(orders[0].lastMessage.type, 'payment_deposit');
  assert.strictEqual(orders[0].lastMessage.confirmedAt, confirmed.confirmedAt,
    'listOrders() must surface the last CONFIRMED send, keyed correctly to this order');

  // A retry after a lost response confirms the same event once, not twice.
  const retry = sandbox.confirmMessageSent({ ref: 'ALX-MSG-1', eventId: prepared.eventId });
  assert.strictEqual(retry.idempotentReplay, true);
  assert.strictEqual(retry.confirmedAt, confirmed.confirmedAt);

  const unknownEvent = sandbox.confirmMessageSent({ ref: 'ALX-MSG-1', eventId: 'msg_doesnotexist' });
  assert.strictEqual(unknownEvent.ok, false);
  assert.strictEqual(unknownEvent.code, 'NOT_FOUND');
  console.log('✔ Suite 63 Passed\n');
}

console.log('--- SUITE 64 (SD-07): a deliberate resend records its own new event, keeping full history without altering payment or work stage ---');
{
  const orderRows = [rowFor({
    'Order Reference': 'ALX-MSG-2', 'Preferred Date': '2026-09-20', 'Item Data': '[]', 'Order Summary': 'x',
    'Work Phase': 'Not started', 'Location Type': 'bali', 'Verified Total': 100000, 'Shipping Fee': '', 'Payment Status': 'Unpaid'
  })];
  const sandbox = makeDeskOpsSandbox(orderRows, { 'Desk Message': makeOpsSheetStub([[]]), 'Desk Activity': makeOpsSheetStub([[]]) });

  const first = sandbox.logMessagePrepared({ ref: 'ALX-MSG-2', type: 'payment_deposit' });
  sandbox.confirmMessageSent({ ref: 'ALX-MSG-2', eventId: first.eventId });
  const second = sandbox.logMessagePrepared({ ref: 'ALX-MSG-2', type: 'payment_deposit' });
  assert.notStrictEqual(second.eventId, first.eventId, 'a resend must mint its own event, not reuse the first one');
  const secondConfirm = sandbox.confirmMessageSent({ ref: 'ALX-MSG-2', eventId: second.eventId });
  assert.strictEqual(secondConfirm.ok, true);
  assert.notStrictEqual(secondConfirm.idempotentReplay, true, 'confirming a genuinely new event must not be treated as a replay of the first');

  const history = sandbox.getMessageHistory('ALX-MSG-2');
  assert.strictEqual(history.length, 2, 'both the original send and the resend must remain in history, neither one overwritten');
  assert.strictEqual(history[0].eventId, second.eventId, 'getMessageHistory() must return newest first');

  const order = sandbox.listOrders()[0];
  assert.strictEqual(order.payment, 'Unpaid', 'a resend must never itself change Payment Status');
  assert.strictEqual(order.phase, 'Not started', 'a resend must never itself change Work Phase');
  console.log('✔ Suite 64 Passed\n');
}

console.log('--- SUITE 65 (SD-07 client): WhatsApp actions are purpose-labelled, prepared and confirmed are recorded separately, and a resend never touches payment/work stage ---');
{
  assert.ok(deskHtml.includes(">Buka WhatsApp: tagihan DP</button>") && deskHtml.includes(">Buka WhatsApp: pelunasan</button>") &&
    deskHtml.includes(">Buka WhatsApp: tagihan</button>") && deskHtml.includes(">Buka WhatsApp: konfirmasi lunas</button>"),
    'every WhatsApp action must be labelled by purpose ("Buka WhatsApp: ..."), not just "Kirim pesan"/"Kirim ..." implying it was already sent');
  assert.ok(deskHtml.includes(">Buka WhatsApp: ' + esc(PHASE_MESSAGE_LABELS[phase] || 'update')"),
    'the phase-update WhatsApp action must also be purpose-labelled (e.g. Buka WhatsApp: pesanan siap)');

  assert.ok(deskHtml.includes('function openWhatsApp(o, message, type, purposeLabel)') &&
    deskHtml.includes('var eventId = generateIdempotencyKey();') &&
    deskHtml.includes('.logMessagePrepared({ ref: o.ref, type: type, eventId: eventId });'),
    'opening WhatsApp must record a PREPARED message with its own event id, minted client-side before the (possibly slow) server round trip so the popup is never blocked');
  assert.ok(/var win = window\.open\(url,[\s\S]{0,200}var eventId = generateIdempotencyKey\(\);/.test(deskHtml),
    'window.open() must fire before the server round trip is even started, so it stays inside the click\'s own event and is never blocked as a popup');
  assert.ok(deskHtml.includes("if (!win) {") && deskHtml.includes('copyText(message);'),
    'when WhatsApp cannot open, the message text must be copied as a fallback rather than leaving her stuck');

  assert.ok(deskHtml.includes('function confirmMessageSentAction()') &&
    deskHtml.includes('.confirmMessageSent({ ref: target.ref, eventId: target.eventId });'),
    'the explicit "Sudah saya kirim" confirmation must be its own separate server call, distinct from opening WhatsApp');
  assert.ok(deskHtml.includes('var target = pendingSendConfirm;') && deskHtml.includes("pendingSendConfirm = { ref: o.ref, eventId: eventId, type: type, purposeLabel: purposeLabel };"),
    'the pending confirmation must capture the order reference at prepare time and confirm against THAT order, not whichever ticket happens to be open when she taps confirm');
  assert.ok(!deskHtml.includes('openWhatsApp(o, message);') && !/openWhatsApp\(o, message\)\s*\{[^}]*window\.open[^}]*\}\s*$/m.test(deskHtml.split('function paymentRequestMessage')[0].slice(-400)),
    'openWhatsApp must not claim a message sent on its own — no direct write of a confirmed/sent state inside it');

  assert.ok(deskHtml.includes('function lastMessageNote(o, type)') && deskHtml.includes('Terakhir dikonfirmasi terkirim'),
    'the last operator-confirmed send time/type must be shown next to the action that would resend it');
  assert.ok((deskHtml.match(/lastMessageNote\(o, /g) || []).length >= 4,
    'lastMessageNote() must be wired in next to each of the distinct WhatsApp actions (deposit/balance/full/confirmed/phase), not just one');

  // Resending must stay reachable and must never itself touch payment or
  // work-stage fields — openWhatsApp()/logMessagePrepared()/
  // confirmMessageSent() must be the only calls involved, none of them
  // updateOrder().
  assert.ok(deskHtml.includes("openWhatsApp(o, paymentRequestMessage(o, sendKind), 'payment_' + sendKind, sendKindLabels[sendKind] || sendKindLabels.full);"),
    'the payment-request action must always be reachable regardless of any prior send, i.e. a deliberate resend');

  assert.ok(deskHtml.includes("el.id = 'sendConfirmBar';") && deskHtml.includes('env(safe-area-inset-bottom'),
    'the confirmation prompt must be a fixed element padded for the safe area, so it stays usable on a notched phone');
  console.log('✔ Suite 65 Passed\n');
}

console.log('======================================================================');
console.log('✔ ALL 65 STUDIO DESK SERVER SUITES PASSED SUCCESSFULLY');
console.log('======================================================================');
