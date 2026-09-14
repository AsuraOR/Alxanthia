# Set up the Alxanthia Studio Desk

This guide is written for the store owner. You do not need to know how to program: follow each step in order and copy the supplied code exactly.

## What you are setting up

```text
Website → Cloudflare Worker → Apps Script "Order Writer" → Orders sheet   (existing, do not touch)
                                                                ↕
                                          Apps Script "Studio Desk" (new, standalone)
                                                                ↕
                                                  site-content.js on alxanthia.com (labels only)
```

The Studio Desk is a second, separate Apps Script project — a phone-friendly page for the maker
that reads the same `Orders` worksheet the order-writer script (set up in
`CONFIGURE-SUBMISSION-ENDPOINT.md`) already writes to, and writes back exactly five columns:
**Payment Plan**, **Payment Status**, **Shipping Fee**, **Work Phase**, **Internal Notes**. It never touches pricing,
never recalculates a total, and is a completely separate Apps Script project from the order writer —
a mistake in the Desk's code can never stop a customer's order from being saved.

Finished flowers now arrive in the Desk as two distinct variants. Each stem item contains a Boolean
`wrapped` value: `true` means **dengan kertas pembungkus** and includes the Rp5.000 per-flower fee
already verified by the Order Writer; `false` means **tanpa kertas pembungkus**. A paper **colour** is
shown only when the order contains a predefined or custom bouquet. The Desk still never calculates
either fee itself—it only displays the verified order data.

Never paste your Google account password, or any secret from `CONFIGURE-SUBMISSION-ENDPOINT.md`
(the webhook secret, Turnstile keys), into anything in this guide. The only secrets the Desk itself
uses — the allow-listed emails and the bank account details — live in this new script's own Script
Properties, set in Part 5 below.

---

## Part 1 — Get the spreadsheet ID

1. Open your **Alxanthia Orders** spreadsheet (the same one `CONFIGURE-SUBMISSION-ENDPOINT.md` set up).
2. Look at the address bar. The link looks like:
   `https://docs.google.com/spreadsheets/d/`**`1a2B3c4D5e6F7g8H9i0J`**`/edit#gid=0`
3. The bold middle part is the **spreadsheet ID**. Copy it into a note — you will paste it into a
   Script Property in Part 5.

---

## Part 2 — Add the payment plan and update the dropdown lists

The words the Desk uses for work stage and payment are changing to match what
`CONFIGURE-SUBMISSION-ENDPOINT.md` now documents. Old rows keep their old words until you fix them,
and the Desk cannot show a stage it does not recognise.

1. Add a column named **Payment Plan** immediately before **Payment Status**. Fill existing order rows
   with `Full`; new orders receive that default automatically. Do not add a dropdown to this column—the
   Desk writes either `Full` or `Deposit 50%`.
2. In the sheet, click the **Work Phase** column header to select the column.
3. **Data → Data validation**, click the existing rule, and replace the list with exactly these six
   lines:

   ```text
   Not started
   Assembly and packing
   Ready for dispatch
   Shipped
   Delivered
   Cancelled
   ```

4. Click the **Payment Status** column header and do the same with exactly these seven:

   ```text
   Unpaid
   Checking transfer
   Checking deposit
   Deposit paid
   Checking balance
   Paid
   Cancelled
   ```

5. Now fix the orders already in the sheet. Scroll through the `Work Phase` column and change any old
   value to its nearest new one:

   | Old value | Change it to |
   | --- | --- |
   | Materials prepared, Flowers being made, Bouquet assembly, Quality check, Packed | Assembly and packing |
   | Awaiting payment | *(payment column)* Unpaid |
   | Awaiting confirmation | *(payment column)* Checking transfer |
   | Expired, Refunded | *(payment column)* Cancelled |

   Anything already reading `Not started`, `Ready for dispatch`, `Shipped`, `Delivered`, `Paid` or
   `Cancelled` stays as it is.

---

## Part 3 — Share the spreadsheet with her

The Desk runs as *her*, so Google itself decides whether she is allowed in. That is the safest
arrangement: nobody can use the Desk who cannot already open the sheet.

1. Click **Share** in the top right of the spreadsheet.
2. Add her Google account email, set it to **Editor**, and send.
3. Confirm the sheet is still **not** "Anyone with the link" — it must stay restricted to named
   people.

Because she now has sheet access, re-check the protected columns: **Data → Protect sheets and
ranges** should still restrict `Verified Product Subtotal`, `Verified Message Card Fee`,
`Verified Total` and `Final Total` to you only. The Desk never writes those, but this stops an
accidental edit if she ever opens the sheet directly.

---

## Part 4 — Create the Studio Desk script

1. Go to <https://script.google.com> and click **New project** (top left). This must be a brand-new,
   **standalone** project — do not use the "Alxanthia Order Writer" project from
   `CONFIGURE-SUBMISSION-ENDPOINT.md`, and do not open Apps Script from inside the spreadsheet's
   **Extensions** menu (that would bind it to the spreadsheet, which a spreadsheet can only have one
   of, and the order writer already is it).
2. Rename it **Alxanthia Studio Desk** (click the title).
3. Delete the sample `myFunction` code.
4. Paste in the following code in full, then save (the disk icon).

```javascript
/**
 * Alxanthia Studio Desk — Google Apps Script.
 * Paste this whole file into a NEW, standalone project created at
 * script.google.com — NOT the "Alxanthia Order Writer" project bound to the
 * Orders spreadsheet — exactly as instructed in STUDIO-DESK-SETUP.md.
 */

// ============================================================================
// Configuration
// ============================================================================
var SHEET_NAME = 'Orders';
var TIMEZONE = 'Asia/Makassar'; // must match CONFIGURE-SUBMISSION-ENDPOINT.md
var MAX_ROWS = 500;
var KEEP_DELIVERED_DAYS = 14;

var SITE_CONTENT_URL = 'https://alxanthia.com/site-content.js';
var CATALOG_CACHE_KEY = 'desk_catalog_v1';
var CATALOG_TTL_SECONDS = 21600; // 6 hours, the CacheService maximum

// Page-side field name -> sheet column header. The only five columns the
// Desk is ever allowed to write, enforced here rather than trusted from the
// page.
var WRITABLE_FIELDS = {
  paymentPlan: 'Payment Plan',
  payment: 'Payment Status',
  shipping: 'Shipping Fee',
  phase: 'Work Phase',
  notes: 'Internal Notes'
};

var PAYMENT_PLAN_VALUES = ['Full', 'Deposit 50%'];
var PAYMENT_VALUES = ['Unpaid', 'Checking transfer', 'Checking deposit', 'Deposit paid', 'Checking balance', 'Paid', 'Cancelled'];
var PHASE_VALUES = ['Not started', 'Assembly and packing', 'Ready for dispatch', 'Shipped', 'Delivered', 'Cancelled'];

// ============================================================================
// Web app entry point
// ============================================================================
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setTitle('Alxanthia Studio Desk — Meja Kerja Perajin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================================
// Access control — the spreadsheet stays unshared; a caller must be listed
// here even though the deployment itself is open to "Anyone with a Google
// account". Fails closed: an unset or empty property lets nobody in.
// ============================================================================
function checkAccess_() {
  var raw = PropertiesService.getScriptProperties().getProperty('DESK_ALLOWED_EMAILS') || '';
  var allowed = raw.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || allowed.indexOf(email) === -1) {
    throw new Error('Akun ini tidak punya akses ke Studio Desk. Hubungi pemilik studio.');
  }
}

// ============================================================================
// listOrders()
// ============================================================================
function listOrders() {
  checkAccess_();
  var sheet = openSheet_();
  var headers = readHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var startRow = Math.max(2, lastRow - MAX_ROWS + 1);
  var numRows = lastRow - startRow + 1;
  var values = sheet.getRange(startRow, 1, numRows, headers.length).getValues();

  var orders = [];
  for (var i = 0; i < values.length; i += 1) {
    var order = rowToOrder_(values[i], headers, startRow + i);
    if (order && includeOrder_(order)) orders.push(order);
  }
  return orders;
}

function includeOrder_(order) {
  if (order.phase === 'Cancelled') return false;
  if (order.phase === 'Delivered') {
    var daysPast = daysBetween_(order.date, todayStr_());
    if (daysPast > KEEP_DELIVERED_DAYS) return false;
  }
  return true;
}

function todayStr_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function daysBetween_(earlierDateStr, laterDateStr) {
  var a = new Date(String(earlierDateStr) + 'T00:00:00');
  var b = new Date(String(laterDateStr) + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function rowToOrder_(rowValues, headers, rowNumber) {
  function get(name) {
    var idx = headers.map[name];
    return idx === undefined ? '' : rowValues[idx];
  }

  var ref = get('Order Reference');
  if (!ref) return null;

  var locationType = String(get('Location Type') || '');
  var isBali = locationType === 'bali';

  var items;
  try {
    var parsed = JSON.parse(String(get('Item Data') || '[]'));
    items = Array.isArray(parsed) ? parsed : [];
  } catch (parseError) {
    items = [];
  }

  var hasCard = String(get('Message Card') || '') === 'Yes';
  var card = hasCard ? {
    to: String(get('Recipient Name') || ''),
    from: String(get('Card Sender Name') || ''),
    text: String(get('Gift Message') || '')
  } : null;

  var shippingRaw = get('Shipping Fee');
  var shipping = (shippingRaw === '' || shippingRaw === null || shippingRaw === undefined)
    ? null
    : Number(shippingRaw);

  return {
    ref: String(ref),
    row: rowNumber,
    submitted: formatDateTimeCell_(get('Submitted At')),
    buyer: String(get('Buyer Name') || ''),
    wa: String(get('Buyer WhatsApp') || ''),
    locationType: locationType,
    regency: isBali ? String(get('Regency') || '') : '',
    method: isBali ? String(get('Delivery Method') || '') : '',
    address: isBali ? '' : String(get('Address') || ''),
    city: isBali ? '' : String(get('City') || ''),
    postal: isBali ? '' : String(get('Postal Code') || ''),
    date: formatDateCell_(get('Preferred Date')),
    items: items,
    itemsRaw: String(get('Order Summary') || ''),
    wrap: String(get('Wrap') || ''),
    card: card,
    verified: Number(get('Verified Total')) || 0,
    shipping: shipping,
    mismatch: String(get('Price Mismatch') || '') !== '',
    paymentPlan: String(get('Payment Plan') || 'Full'),
    payment: String(get('Payment Status') || 'Unpaid'),
    phase: String(get('Work Phase') || 'Not started'),
    notes: String(get('Internal Notes') || '')
  };
}

function formatDateCell_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd');
  return String(value || '');
}

function formatDateTimeCell_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd HH:mm');
  return String(value || '');
}

// ============================================================================
// updateOrder(payload)
// ============================================================================
function updateOrder(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  var field = payload.field;

  if (!Object.prototype.hasOwnProperty.call(WRITABLE_FIELDS, field)) {
    return { ok: false, code: 'BAD_FIELD', message: 'Kolom ini tidak bisa diubah dari Studio Desk.' };
  }

  var validated = validateFieldValue_(field, payload.value);
  if (!validated.ok) {
    return { ok: false, code: 'BAD_VALUE', message: validated.message };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  }
  try {
    var sheet = openSheet_();
    var headers = readHeaders_(sheet);
    var refCol = headers.map['Order Reference'];
    var columnName = WRITABLE_FIELDS[field];
    var colIdx = headers.map[columnName];
    if (refCol === undefined || colIdx === undefined) {
      return { ok: false, code: 'NOT_FOUND', message: 'Kolom yang dibutuhkan tidak ditemukan di sheet Orders.' };
    }

    var row = findRowByReference_(sheet, refCol, ref, payload.row);
    if (!row) {
      return { ok: false, code: 'NOT_FOUND', message: 'Pesanan dengan referensi ini tidak ditemukan lagi.' };
    }

    var currentRef = sheet.getRange(row, refCol + 1).getValue();
    if (String(currentRef) !== ref) {
      return { ok: false, code: 'STALE_ROW', message: 'Baris pesanan berubah. Muat ulang daftar pesanan lalu coba lagi.' };
    }

    if (field === 'paymentPlan') {
      var planPaymentCol = headers.map['Payment Status'];
      var planPayment = planPaymentCol === undefined ? '' : sheet.getRange(row, planPaymentCol + 1).getValue();
      if (String(planPayment || 'Unpaid') !== 'Unpaid') {
        return { ok: false, code: 'PAYMENT_STARTED', message: 'Cara pembayaran tidak bisa diubah setelah transfer mulai diproses.' };
      }
    }

    // A deposit may start production, but an order must be fully paid before
    // it can leave the studio. Enforce this on the server, not only in the UI.
    if (field === 'phase' && (validated.value === 'Shipped' || validated.value === 'Delivered')) {
      var paymentCol = headers.map['Payment Status'];
      var currentPayment = paymentCol === undefined ? '' : sheet.getRange(row, paymentCol + 1).getValue();
      if (String(currentPayment) !== 'Paid') {
        return { ok: false, code: 'PAYMENT_DUE', message: 'Pelunasan harus diterima sebelum pesanan dikirim.' };
      }
    }

    sheet.getRange(row, colIdx + 1).setValue(validated.value);

    var rowValues = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    return { ok: true, order: rowToOrder_(rowValues, headers, row) };
  } finally {
    lock.releaseLock();
  }
}

function validateFieldValue_(field, value) {
  if (field === 'paymentPlan') {
    if (PAYMENT_PLAN_VALUES.indexOf(value) === -1) {
      return { ok: false, message: 'Cara pembayaran tidak dikenali.' };
    }
    return { ok: true, value: value };
  }
  if (field === 'payment') {
    if (PAYMENT_VALUES.indexOf(value) === -1) {
      return { ok: false, message: 'Status pembayaran tidak dikenali.' };
    }
    return { ok: true, value: value };
  }
  if (field === 'phase') {
    if (PHASE_VALUES.indexOf(value) === -1) {
      return { ok: false, message: 'Tahap kerja tidak dikenali.' };
    }
    return { ok: true, value: value };
  }
  if (field === 'shipping') {
    if (value === '' || value === null || value === undefined) {
      return { ok: true, value: '' };
    }
    if (typeof value !== 'number' && typeof value !== 'string') {
      return { ok: false, message: 'Ongkir harus berupa angka 0 atau lebih.' };
    }
    var num = Number(value);
    if (!isFinite(num) || num < 0) {
      return { ok: false, message: 'Ongkir harus berupa angka 0 atau lebih.' };
    }
    return { ok: true, value: num };
  }
  if (field === 'notes') {
    if (typeof value !== 'string') {
      return { ok: false, message: 'Catatan harus berupa teks.' };
    }
    return { ok: true, value: safeText_(value.slice(0, 1000)) };
  }
  return { ok: false, message: 'Kolom tidak dikenali.' };
}

// Mirrors the order writer's safeText() in CONFIGURE-SUBMISSION-ENDPOINT.md so
// a note starting with =, +, - or @ cannot become a formula.
function safeText_(value) {
  var text = String(value === undefined || value === null ? '' : value);
  return /^[=+-@]/.test(text) ? "'" + text : text;
}

function findRowByReference_(sheet, refCol, ref, hintRow) {
  var lastRow = sheet.getLastRow();
  if (hintRow && hintRow >= 2 && hintRow <= lastRow) {
    var hintValue = sheet.getRange(hintRow, refCol + 1).getValue();
    if (String(hintValue) === ref) return hintRow;
  }
  if (lastRow < 2) return null;
  var refs = sheet.getRange(2, refCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < refs.length; i += 1) {
    if (String(refs[i][0]) === ref) return i + 2;
  }
  return null;
}

// ============================================================================
// createOrder(payload) — Direct order creation from Studio Desk
// ============================================================================
function createOrder(payload) {
  checkAccess_();
  payload = payload || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  }
  try {
    var sheet = openSheet_();
    var headers = readHeaders_(sheet);
    var now = new Date();
    var datePart = Utilities.formatDate(now, TIMEZONE, 'yyMMdd');
    var randCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    var ref = payload.ref || ('ALX-' + datePart + '-' + randCode);

    var isBali = payload.locationType === 'bali';
    var card = payload.card || null;
    var items = Array.isArray(payload.items) ? payload.items : [];

    var rowValues = new Array(headers.length).fill('');
    function setCol(colName, val) {
      var idx = headers.map[colName];
      if (idx !== undefined) rowValues[idx] = val;
    }

    setCol('Order Reference', ref);
    setCol('Submitted At', now);
    setCol('Language', 'id');
    setCol('Currency', 'IDR');
    setCol('Source', 'studio_desk');
    setCol('Acknowledged', 'Yes');
    setCol('Buyer Name', safeText_(payload.buyer || ''));
    setCol('Buyer WhatsApp', safeText_(payload.wa || ''));
    setCol('Location Type', isBali ? 'bali' : 'luar_bali');
    setCol('Regency', isBali ? safeText_(payload.regency || '') : '');
    setCol('Delivery Method', isBali ? safeText_(payload.method || '') : '');
    setCol('Address', isBali ? '' : safeText_(payload.address || ''));
    setCol('City', isBali ? '' : safeText_(payload.city || ''));
    setCol('Postal Code', isBali ? '' : safeText_(payload.postal || ''));
    setCol('Preferred Date', payload.date || todayStr_());
    setCol('Order Mode', 'desk');
    setCol('Order Summary', safeText_(payload.itemsRaw || ''));
    setCol('Item Data', JSON.stringify(items));
    setCol('Wrap', safeText_(payload.wrap || ''));
    setCol('Message Card', card ? 'Yes' : 'No');
    setCol('Gift Message', card ? safeText_(card.text || '') : '');
    setCol('Recipient Name', card ? safeText_(card.to || '') : '');
    setCol('Card Sender Name', card ? safeText_(card.from || '') : '');
    setCol('Verified Total', Number(payload.verified) || 0);
    setCol('Price Mismatch', '');
    setCol('Shipping Fee', payload.shipping !== undefined && payload.shipping !== null && payload.shipping !== '' ? Number(payload.shipping) : (isBali ? 0 : ''));
    setCol('Payment Plan', payload.paymentPlan || 'Full');
    setCol('Payment Status', payload.payment || 'Unpaid');
    setCol('Work Phase', payload.phase || 'Not started');
    setCol('Internal Notes', safeText_(payload.notes || ''));

    sheet.appendRow(rowValues);
    var newRow = sheet.getLastRow();
    return { ok: true, order: rowToOrder_(rowValues, headers, newRow) };
  } catch (err) {
    return { ok: false, message: err.message || String(err) };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// getDeskSettings() / saveDeskSettings(settings)
// ============================================================================
function getDeskSettings() {
  checkAccess_();
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('DESK_CUSTOM_SETTINGS');
  var custom = {};
  if (raw) {
    try { custom = JSON.parse(raw); } catch (e) {}
  }
  return {
    bank: props.getProperty('BANK_NAME') || '',
    accNumber: props.getProperty('BANK_NUMBER') || '',
    accHolder: props.getProperty('BANK_HOLDER') || '',
    signature: custom.signature || '',
    templates: custom.templates || null
  };
}

function saveDeskSettings(settings) {
  checkAccess_();
  settings = settings || {};
  var props = PropertiesService.getScriptProperties();
  if (settings.bank) props.setProperty('BANK_NAME', String(settings.bank).trim());
  if (settings.accNumber) props.setProperty('BANK_NUMBER', String(settings.accNumber).trim());
  if (settings.accHolder) props.setProperty('BANK_HOLDER', String(settings.accHolder).trim());
  props.setProperty('DESK_CUSTOM_SETTINGS', JSON.stringify({
    signature: settings.signature || '',
    templates: settings.templates || {}
  }));
  return { ok: true };
}

// ============================================================================
// Sheet helpers
// ============================================================================
function openSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
  var spreadsheet = SpreadsheetApp.openById(id);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Worksheet "Orders" tidak ditemukan di spreadsheet ini.');
  return sheet;
}

function readHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  values.forEach(function (name, idx) {
    if (!name) return;
    map[String(name).trim()] = idx;
  });
  return { map: map, length: lastCol };
}

// ============================================================================
// getCatalog() / refreshCatalog()
// ============================================================================
function getCatalog() {
  checkAccess_();
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CATALOG_CACHE_KEY);
  var labels = hit ? JSON.parse(hit) : fetchAndCacheCatalog_();
  labels.bank = bankInfo_();
  return labels;
}

function refreshCatalog() {
  checkAccess_();
  CacheService.getScriptCache().remove(CATALOG_CACHE_KEY);
  var labels = fetchAndCacheCatalog_();
  labels.bank = bankInfo_();
  return labels;
}

function fetchAndCacheCatalog_() {
  var cache = CacheService.getScriptCache();
  var props = PropertiesService.getScriptProperties();
  try {
    var res = UrlFetchApp.fetch(SITE_CONTENT_URL, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() === 200) {
      var data = (new Function('window', res.getContentText() + '\nreturn window.ALXANTHIA_DATA;'))({});
      var labels = pickLabels_(data);
      labels.fetchedAt = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');
      cache.put(CATALOG_CACHE_KEY, JSON.stringify(labels), CATALOG_TTL_SECONDS);
      props.setProperty('DESK_CATALOG_BACKUP', JSON.stringify(labels));
      return labels;
    }
  } catch (fetchError) {
    // fall through to the last good copy
  }

  var backup = props.getProperty('DESK_CATALOG_BACKUP');
  if (backup) {
    var parsedBackup = JSON.parse(backup);
    parsedBackup.stale = true;
    return parsedBackup;
  }
  return { stale: true, flowers: {}, pots: {}, additions: {}, packages: [], wraps: {}, minimumLeadDays: 2 };
}

function pickLabels_(data) {
  data = data || {};

  var flowers = {};
  Object.keys(data.flowers || {}).forEach(function (key) {
    var entry = data.flowers[key] || {};
    var id = entry.id || {};
    var specParts = [id.size, id.detail].filter(function (part) { return !!part; });
    flowers[key] = { name: id.name || humanizeKey_(key), spec: specParts.join(' · ') };
  });

  var pots = {};
  (data.miniPots || []).forEach(function (pot) {
    var id = pot.id || {};
    pots[pot.key] = { name: id.name || humanizeKey_(pot.key), spec: 'tinggi ' + pot.heightCm + ' cm' };
  });

  var additions = {};
  (data.customAdditions || []).forEach(function (addition) {
    var id = addition.id || {};
    additions[addition.key] = { name: id.name || humanizeKey_(addition.key) };
  });

  var packages = (data.packages || []).map(function (pkg) {
    return { stems: pkg.stems };
  });

  var wrapNames = ((data.translations || {}).id || {}).wrapNames || {};
  var wraps = {};
  (data.wraps || []).forEach(function (wrap) {
    wraps[wrap.key] = { name: wrapNames[wrap.key] || humanizeKey_(wrap.key), swatch: wrap.swatch };
  });

  return {
    flowers: flowers,
    pots: pots,
    additions: additions,
    packages: packages,
    wraps: wraps,
    minimumLeadDays: Number(data.minimumLeadDays) || 2
  };
}

function bankInfo_() {
  var props = PropertiesService.getScriptProperties();
  return {
    bank: props.getProperty('BANK_NAME') || '',
    number: props.getProperty('BANK_NUMBER') || '',
    holder: props.getProperty('BANK_HOLDER') || ''
  };
}

function humanizeKey_(key) {
  return String(key || '').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function resolveLabel_(map, key) {
  var entry = map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
  return entry || { name: humanizeKey_(key), spec: '' };
}

function buildTicketLines_(items, catalog) {
  return (items || []).map(function (item, i) {
    if (item.type === 'stem') {
      var flower = resolveLabel_(catalog.flowers, item.id);
      var stemLines = flower.spec ? [{ v: flower.spec }] : [];
      stemLines.push({ k: 'bungkus', v: item.wrapped === true ? 'Dengan kertas pembungkus' : 'Tanpa kertas pembungkus' });
      return { key: 'i' + i, qty: item.qty, name: flower.name, lines: stemLines };
    }
    if (item.type === 'pot') {
      var pot = resolveLabel_(catalog.pots, item.id);
      return { key: 'i' + i, qty: item.qty, name: pot.name, lines: pot.spec ? [{ v: pot.spec }] : [] };
    }
    if (item.type === 'package') {
      var pkg = (catalog.packages || [])[Number(item.id)];
      var stems = pkg ? pkg.stems : '?';
      return { key: 'i' + i, qty: item.qty, name: 'Paket ' + stems + ' tangkai', lines: [{ v: 'pilihan bunga studio' }] };
    }
    if (item.type === 'custom') {
      var each = [];
      var total = [];
      Object.keys(item.stems || {}).forEach(function (k) {
        var f = resolveLabel_(catalog.flowers, k);
        each.push(item.stems[k] + '× ' + f.name);
        total.push(item.stems[k] * item.qty + '× ' + f.name);
      });
      Object.keys(item.additions || {}).forEach(function (k) {
        if (!item.additions[k]) return;
        var a = resolveLabel_(catalog.additions, k);
        each.push(item.additions[k] + '× ' + a.name);
        total.push(item.additions[k] * item.qty + '× ' + a.name);
      });
      var lines = [{ k: 'per rangkaian', v: each.join(' · ') }];
      if (item.qty > 1) lines.push({ k: 'total', v: total.join(' · ') });
      return { key: 'i' + i, qty: item.qty, name: 'Rangkaian custom', lines: lines };
    }
    return { key: 'i' + i, qty: item.qty || 1, name: 'Item tidak dikenal', lines: [] };
  });
}
```

5. Click the **+** next to *Files*, choose **HTML**, name it exactly `Index` (no `.html`), delete
   what is there, and paste in the page below in full, then save.

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alxanthia Studio Desk — Meja Kerja Perajin</title>
  
  <!-- Google Fonts: Plus Jakarta Sans for UI, Playfair Display & Newsreader for boutique craft styling, JetBrains Mono for codes -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400;1,6..72,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    /* ==========================================================================
       DESIGN TOKENS & ARTISANAL COLOR SYSTEM
       Inspired by handmade crochet crafts, linen cloth, dried botanicals, and warm Bali sunlight.
       ========================================================================== */
    :root {
      --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --font-serif: 'Newsreader', Georgia, serif;
      --font-mono: 'JetBrains Mono', ui-monospace, monospace;

      /* Light Theme (Warm Botanical Linen) */
      --bg-ground: #F6F4EE;
      --bg-surface: #FFFFFF;
      --bg-surface-elevated: #FDFCFA;
      --bg-surface-subtle: #EDE8DE;
      --bg-card: #FFFFFF;
      --border-subtle: #E2DBD0;
      --border-strong: #C8BFB2;

      --text-main: #1C231E;
      --text-muted: #5C675E;
      --text-faint: #8E9A90;

      /* Primary Forest Pine (Alxanthia Brand) */
      --pine-900: #13241A;
      --pine-800: #1B3527;
      --pine-700: #254936;
      --pine-600: #335E46;
      --pine-500: #447B5D;
      --pine-100: #E6EFEA;
      --pine-50:  #F2F7F4;

      /* Warm Artisan Amber (Due Today / DP Status) */
      --amber-700: #9E5B10;
      --amber-600: #C27418;
      --amber-100: #FDF3E3;
      --amber-50:  #FFF9F0;

      /* Rosy Terracotta / Overdue Alert */
      --rose-700: #9B333B;
      --rose-600: #C4454E;
      --rose-100: #FDECEE;

      /* Blush Pink (Card Accent) */
      --blush-500: #C98A94;
      --blush-100: #FBF0F2;

      /* Swatch Colors from Catalog */
      --swatch-kraft: #B79A6E;
      --swatch-cream: #F0E7D6;
      --swatch-sage:  #7E8F7C;
      --swatch-blush: #C9A4A8;

      /* Elevation & Radii */
      --radius-sm: 6px;
      --radius-md: 12px;
      --radius-lg: 18px;
      --radius-pill: 9999px;

      --shadow-sm: 0 1px 3px rgba(28, 35, 30, 0.05);
      --shadow-md: 0 4px 14px -3px rgba(28, 35, 30, 0.08), 0 2px 6px -2px rgba(28, 35, 30, 0.04);
      --shadow-lg: 0 12px 32px -8px rgba(28, 35, 30, 0.12), 0 4px 12px -2px rgba(28, 35, 30, 0.04);
    }

    [data-theme="dark"] {
      --bg-ground: #111512;
      --bg-surface: #181E19;
      --bg-surface-elevated: #1F2721;
      --bg-surface-subtle: #27312A;
      --bg-card: #181E19;
      --border-subtle: #2C382F;
      --border-strong: #3D4C40;

      --text-main: #EDF2EE;
      --text-muted: #9EABA0;
      --text-faint: #6A776D;

      --pine-800: #264734;
      --pine-700: #356248;
      --pine-500: #5AA179;
      --pine-100: #1A2B20;
      --pine-50:  #142018;

      --amber-700: #D68B29;
      --amber-600: #F3A946;
      --amber-100: #2E2211;
      --amber-50:  #20180B;

      --rose-700: #E6656E;
      --rose-600: #FF7D86;
      --rose-100: #2F171A;

      --blush-500: #D697A1;
      --blush-100: #2B1C20;

      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
      --shadow-md: 0 4px 14px -3px rgba(0, 0, 0, 0.5);
      --shadow-lg: 0 12px 32px -8px rgba(0, 0, 0, 0.7);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background: var(--bg-ground);
      color: var(--text-main);
      font-size: 14.5px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
      overflow-x: hidden;
    }

    button, input, textarea, select {
      font: inherit;
      color: inherit;
    }

    /* ==========================================================================
       TOP APP BAR
       ========================================================================== */
    .app-header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 40;
      box-shadow: var(--shadow-sm);
    }

    .header-inner {
      max-width: 1440px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      background: var(--pine-100);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .brand-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .brand-titles h1 {
      font-family: var(--font-serif);
      font-size: 21px;
      font-weight: 600;
      line-height: 1.15;
      color: var(--text-main);
      letter-spacing: -0.01em;
    }

    .brand-titles .tagline {
      font-size: 11.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--pine-600);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .brand-titles .tagline::before {
      content: "";
      display: inline-block;
      width: 6px;
      height: 6px;
      background: var(--pine-500);
      border-radius: 50%;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .time-badge {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-surface-subtle);
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-subtle);
      display: none;
    }
    @media (min-width: 900px) {
      .time-badge { display: flex; align-items: center; gap: 6px; }
    }

    .btn-batch-prep {
      background: var(--amber-100);
      color: var(--amber-700);
      border: 1px solid #E8D5AE;
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-batch-prep:hover {
      background: #F8ECD2;
      transform: translateY(-1px);
    }
    [data-theme="dark"] .btn-batch-prep {
      background: #2D2313;
      border-color: #523F21;
      color: #F3B058;
    }

    .btn-new-order {
      background: var(--pine-700);
      color: #FFFFFF;
      border: none;
      padding: 9px 18px;
      border-radius: var(--radius-pill);
      font-weight: 600;
      font-size: 13.5px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(37, 73, 54, 0.25);
      transition: all 0.15s ease;
    }
    .btn-new-order:hover {
      background: var(--pine-800);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 73, 54, 0.35);
    }

    .btn-icon {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      width: 38px;
      height: 38px;
      border-radius: var(--radius-pill);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted);
      transition: all 0.15s ease;
    }
    .btn-icon:hover {
      background: var(--border-subtle);
      color: var(--text-main);
    }

    /* ==========================================================================
       VIEW MODE TABS SWITCHER (Daftar Antrean vs Kalender Jadwal)
       ========================================================================== */
    .view-mode-tabs {
      display: inline-flex;
      background: var(--bg-surface-subtle);
      padding: 3px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-subtle);
      gap: 4px;
    }
    .view-tab-btn {
      border: none;
      background: transparent;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .view-tab-btn.active {
      background: var(--bg-surface);
      color: var(--pine-700);
      box-shadow: var(--shadow-sm);
    }
    [data-theme="dark"] .view-tab-btn.active {
      color: #72BF92;
      background: var(--bg-surface-elevated);
    }

    /* ==========================================================================
       STUDIO METRIC PULSE (Summary Ribbon)
       ========================================================================== */
    .studio-pulse {
      max-width: 1440px;
      margin: 16px auto 0;
      padding: 0 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
    }

    .pulse-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: var(--shadow-sm);
      transition: all 0.15s ease;
      cursor: default;
      overflow: hidden;
    }
    .pulse-card.is-clickable {
      cursor: pointer;
    }
    .pulse-card.is-clickable:hover {
      border-color: var(--pine-500);
      transform: translateY(-1px);
    }

    .pulse-card.is-today {
      border-left: 4px solid var(--amber-600);
      background: linear-gradient(to right, var(--amber-50), var(--bg-surface));
    }
    .pulse-card.is-late {
      border-left: 4px solid var(--rose-600);
      background: linear-gradient(to right, var(--rose-100), var(--bg-surface));
    }
    .pulse-card.is-working {
      border-left: 4px solid var(--pine-600);
    }
    .pulse-card.is-prep-card {
      border-left: 4px solid var(--amber-700);
      background: linear-gradient(to right, #FAF3E6, var(--bg-surface));
    }
    [data-theme="dark"] .pulse-card.is-prep-card {
      background: linear-gradient(to right, #241D12, var(--bg-surface));
    }

    .pulse-num {
      font-family: var(--font-mono);
      font-size: 24px;
      font-weight: 700;
      line-height: 1;
      color: var(--text-main);
    }
    .pulse-card.is-late .pulse-num { color: var(--rose-700); }
    .pulse-card.is-today .pulse-num { color: var(--amber-700); }

    .pulse-meta {
      display: flex;
      flex-direction: column;
    }
    .pulse-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }
    .pulse-sub {
      font-size: 12px;
      color: var(--text-faint);
    }

    /* ==========================================================================
       FILTER CHIPS, SEARCH & CONTROLS ROW
       ========================================================================== */
    .controls-row {
      max-width: 1440px;
      margin: 16px auto 0;
      padding: 0 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .chips-lane {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip-btn {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-pill);
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .chip-btn:hover {
      border-color: var(--border-strong);
      color: var(--text-main);
    }
    .chip-btn[aria-pressed="true"] {
      background: var(--pine-700);
      color: #FFFFFF;
      border-color: var(--pine-700);
      box-shadow: 0 2px 6px rgba(37, 73, 54, 0.2);
    }
    .chip-btn .count {
      font-family: var(--font-mono);
      font-size: 11.5px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: rgba(0, 0, 0, 0.07);
    }
    .chip-btn[aria-pressed="true"] .count {
      background: rgba(255, 255, 255, 0.25);
    }

    .search-sort-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .search-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-pill);
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      width: 220px;
      box-shadow: var(--shadow-sm);
    }
    .search-box:focus-within {
      border-color: var(--pine-500);
      box-shadow: 0 0 0 2px rgba(68, 123, 93, 0.2);
    }
    .search-box input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 13px;
    }

    .sort-select {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-pill);
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      outline: none;
    }

    /* ==========================================================================
       TWO-PANE WORKSPACE: QUEUE + TICKET
       ========================================================================== */
    .desk-layout {
      max-width: 1440px;
      margin: 16px auto 40px;
      padding: 0 20px;
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 20px;
      align-items: start;
    }
    @media (min-width: 1200px) {
      .desk-layout { grid-template-columns: 420px 1fr; gap: 24px; }
    }

    /* Left Pane: Queue Cards */
    .queue-pane {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .order-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      min-height: fit-content;
    }
    .order-card:hover {
      border-color: var(--border-strong);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
    .order-card[aria-selected="true"] {
      border-color: var(--pine-600);
      background: var(--bg-surface-elevated);
      box-shadow: 0 0 0 2px var(--pine-500), var(--shadow-md);
    }
    .order-card.is-today {
      border-left: 4px solid var(--amber-600);
    }
    .order-card.is-late {
      border-left: 4px solid var(--rose-600);
    }
    .order-card.is-working {
      border-left: 4px solid var(--pine-600);
    }
    .order-card.is-done {
      opacity: 0.7;
    }

    .card-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
    }
    .card-ref {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .badge-due {
      font-size: 11.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface-subtle);
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .is-today .badge-due { background: var(--amber-100); color: var(--amber-700); }
    .is-late .badge-due { background: var(--rose-100); color: var(--rose-700); }

    .card-buyer {
      font-family: var(--font-serif);
      font-size: 17px;
      font-weight: 600;
      color: var(--text-main);
      line-height: 1.25;
      flex-shrink: 0;
    }

    .card-summary {
      font-size: 12.5px;
      color: var(--text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
      flex-shrink: 0;
    }

    .card-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-shrink: 0;
    }

    .pill-tag {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: var(--radius-sm);
      background: var(--bg-surface-subtle);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .pill-tag.pay-paid { background: #E6F4EA; color: #1E6B37; font-weight: 700; }
    .pill-tag.pay-unpaid { background: var(--rose-100); color: var(--rose-700); }
    .pill-tag.pay-check { background: var(--amber-100); color: var(--amber-700); }
    .pill-tag.pay-dp { background: #FAF0D8; color: #8F5413; font-weight: 700; border: 1px solid #E6D4B0; }
    .pill-tag.phase-active { background: var(--pine-100); color: var(--pine-700); }

    .swatch-circle {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.2);
      display: inline-block;
    }

    .empty-queue {
      background: var(--bg-surface);
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-md);
      padding: 48px 20px;
      text-align: center;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    /* Right Pane: Maker Work Ticket */
    .ticket-pane {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 0;
      overflow: hidden; /* Fixes shaded corner overflow by cleanly clipping all child backgrounds */
      box-shadow: var(--shadow-md);
    }

    .ticket-mobile-back {
      display: none;
      width: 100%;
      background: var(--bg-surface-subtle);
      border: none;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--pine-700);
      font-weight: 600;
      font-size: 13.5px;
      cursor: pointer;
      padding: 12px 20px;
      align-items: center;
      gap: 8px;
      transition: background 0.15s ease;
    }
    .ticket-mobile-back:hover {
      background: var(--pine-100);
    }
    [data-theme="dark"] .ticket-mobile-back {
      color: #72BF92;
      background: var(--bg-surface-subtle);
    }
    [data-theme="dark"] .ticket-mobile-back:hover {
      background: #1F2E24;
    }

    .ticket-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 24px 28px 20px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .ticket-header.is-today {
      background: linear-gradient(to bottom, var(--amber-50), transparent);
      border-bottom: 1px solid #EADBBF;
    }
    .ticket-header.is-late {
      background: linear-gradient(to bottom, var(--rose-100), transparent);
      border-bottom: 1px solid #E6B5BA;
    }
    [data-theme="dark"] .ticket-header.is-today {
      background: linear-gradient(to bottom, rgba(217, 130, 43, 0.2), transparent);
      border-bottom: 1px solid rgba(217, 130, 43, 0.3);
    }
    [data-theme="dark"] .ticket-header.is-late {
      background: linear-gradient(to bottom, rgba(214, 57, 57, 0.25), transparent);
      border-bottom: 1px solid rgba(214, 57, 57, 0.35);
    }

    .ticket-body {
      padding: 0 28px 24px;
    }

    .buyer-info h2 {
      font-family: var(--font-serif);
      font-size: 26px;
      font-weight: 600;
      color: var(--text-main);
      line-height: 1.15;
      margin-bottom: 4px;
    }
    .buyer-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .wa-link {
      color: #198754;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #E8F5E9;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
    }
    .wa-link:hover { text-decoration: underline; }

    .ticket-badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .due-headline {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
    }
    .due-relative {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }

    /* Ticket Sections */
    .ticket-block {
      padding: 20px 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .ticket-block:last-child { border-bottom: none; }

    .block-title {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    /* 1. PAYMENT & DP BLOCK */
    .payment-box {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 18px 20px;
    }
    .payment-box.needs-attention {
      background: var(--amber-50);
      border-color: #E6CE9F;
    }

    .plan-switch-group {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }
    .btn-plan {
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      color: var(--text-muted);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-plan.active {
      background: var(--pine-700);
      color: #FFFFFF;
      border-color: var(--pine-700);
      box-shadow: 0 2px 6px rgba(37, 73, 54, 0.2);
    }

    .dp-banner-card {
      background: #FAF5E9;
      border: 1px solid #E8D5AE;
      border-radius: var(--radius-md);
      padding: 14px 18px;
      margin-top: 12px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    [data-theme="dark"] .dp-banner-card {
      background: #242018;
      border-color: #403623;
    }
    .dp-banner-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .dp-banner-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--amber-700);
    }
    .dp-banner-val {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
    }

    .payment-main-row {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }

    .amount-display {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .amount-val {
      font-family: var(--font-mono);
      font-size: 28px;
      font-weight: 700;
      color: var(--text-main);
    }
    .amount-lbl {
      font-size: 13px;
      color: var(--text-muted);
    }

    .payment-breakdown {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 8px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
    }

    .ongkir-input-row {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed var(--border-strong);
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .ongkir-input-row label {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .ongkir-input-row input {
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 600;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      color: var(--text-main);
      width: 140px;
    }
    .ongkir-hint {
      font-size: 12.5px;
      color: var(--text-muted);
      flex: 1 1 200px;
    }

    .payment-actions-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
    }

    .btn-secondary {
      background: var(--bg-surface);
      border: 1px solid var(--border-strong);
      color: var(--text-main);
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .btn-secondary:hover {
      background: var(--border-subtle);
    }

    .btn-pay-confirm {
      background: #256B3A;
      color: #FFFFFF;
      border: none;
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 6px rgba(37, 107, 58, 0.25);
    }
    .btn-pay-confirm:hover { background: #1B532C; }

    /* 2. WHATSAPP ASSISTANT DRAWER/BUTTONS */
    .wa-templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }
    .wa-card-btn {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .wa-card-btn:hover {
      border-color: #25D366;
      background: var(--bg-surface-elevated);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }
    .wa-card-icon {
      color: #25D366;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .wa-card-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
      display: block;
      margin-bottom: 2px;
    }
    .wa-card-desc {
      font-size: 11.5px;
      color: var(--text-muted);
      line-height: 1.35;
      display: block;
    }

    /* 3. VISUAL CRAFT RECIPE & PROGRESS */
    .craft-progress-bar {
      height: 6px;
      background: var(--border-subtle);
      border-radius: var(--radius-pill);
      overflow: hidden;
      margin-bottom: 16px;
    }
    .craft-progress-fill {
      height: 100%;
      background: var(--pine-500);
      transition: width 0.25s ease;
    }

    .craft-items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .craft-item-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .craft-item-row:hover {
      border-color: var(--border-strong);
    }
    .craft-item-row.is-done {
      background: #F1F6F3;
      border-color: #CFE0D6;
      opacity: 0.85;
    }
    [data-theme="dark"] .craft-item-row.is-done {
      background: #19271E;
      border-color: #2D4737;
    }

    .craft-checkbox {
      width: 22px;
      height: 22px;
      border-radius: var(--radius-sm);
      border: 2px solid var(--border-strong);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--bg-surface);
      color: transparent;
      transition: all 0.15s ease;
    }
    .craft-checkbox svg {
      display: none;
    }
    .craft-item-row.is-done .craft-checkbox,
    .prep-item-card.is-checked .craft-checkbox {
      background: var(--pine-600);
      border-color: var(--pine-600);
      color: #FFFFFF;
    }
    .craft-item-row.is-done .craft-checkbox svg,
    .prep-item-card.is-checked .craft-checkbox svg {
      display: block;
    }

    .craft-thumb {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .craft-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .craft-details {
      flex: 1;
    }
    .craft-title {
      font-size: 14.5px;
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .craft-qty-pill {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--pine-100);
      color: var(--pine-700);
    }
    .craft-spec {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .craft-breakdown {
      font-size: 12px;
      font-family: var(--font-mono);
      color: var(--text-muted);
      margin-top: 4px;
      background: rgba(0, 0, 0, 0.03);
      padding: 4px 8px;
      border-radius: var(--radius-sm);
    }

    /* 4. WRAP PAPER */
    .wrap-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px 18px;
    }
    .wrap-swatch-large {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      border: 2px solid rgba(0, 0, 0, 0.15);
      flex-shrink: 0;
    }
    .wrap-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-main);
    }
    .wrap-desc {
      font-size: 12.5px;
      color: var(--text-muted);
    }

    /* 5. HANDWRITTEN GREETING CARD STATIONERY */
    .card-stationery {
      background: #FFFDF9;
      border: 1px solid #EADDC8;
      box-shadow: 0 2px 10px rgba(183, 154, 110, 0.15);
      border-radius: var(--radius-md);
      padding: 20px 24px;
      position: relative;
    }
    [data-theme="dark"] .card-stationery {
      background: #23201B;
      border-color: #4A3E2F;
    }
    .card-stationery::before {
      content: "ARTISAN CARD";
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #B79A6E;
    }
    .card-message-text {
      font-family: var(--font-serif);
      font-size: 18px;
      font-style: italic;
      color: var(--text-main);
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .card-meta-line {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px dashed #E5D5BC;
      font-size: 13px;
    }
    .card-persons {
      display: flex;
      gap: 16px;
      color: var(--text-muted);
    }
    .card-persons b { color: var(--text-main); }

    /* 6. WORK PHASE STEPPER */
    .stepper-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .stepper-track {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
    .step-node {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .step-bar {
      height: 6px;
      background: var(--border-subtle);
      border-radius: var(--radius-pill);
      transition: all 0.2s ease;
    }
    .step-node.completed .step-bar { background: var(--pine-600); }
    .step-node.current .step-bar { background: var(--amber-600); box-shadow: 0 0 0 2px var(--amber-100); }
    .step-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-align: center;
      line-height: 1.2;
    }
    .step-node.current .step-label {
      color: var(--text-main);
      font-weight: 700;
    }

    .stepper-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 8px;
    }
    .btn-advance-phase {
      background: var(--pine-700);
      color: #FFFFFF;
      border: none;
      padding: 10px 22px;
      border-radius: var(--radius-pill);
      font-weight: 600;
      font-size: 13.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(37, 73, 54, 0.25);
    }
    .btn-advance-phase:hover {
      background: var(--pine-800);
    }

    /* 7. INTERNAL NOTES */
    .notes-box {
      width: 100%;
      padding: 12px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface-subtle);
      font-size: 13.5px;
      resize: vertical;
      min-height: 70px;
      outline: none;
    }
    .notes-box:focus {
      border-color: var(--pine-500);
      background: var(--bg-surface);
    }

    /* ==========================================================================
       CALENDAR VIEW SECTION
       ========================================================================== */
    .calendar-container {
      max-width: 1440px;
      margin: 16px auto 40px;
      padding: 0 20px;
    }
    .calendar-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-md);
      overflow: hidden;
    }
    .calendar-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .cal-title-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .cal-month-title {
      font-family: var(--font-serif);
      font-size: 24px;
      font-weight: 600;
      color: var(--text-main);
    }
    .cal-nav-btn {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      width: 34px;
      height: 34px;
      border-radius: var(--radius-pill);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .cal-nav-btn:hover {
      background: var(--border-subtle);
    }

    .cal-legend-row {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--text-muted);
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-green { background: #2E8540; }
    .dot-yellow { background: #D9822B; }
    .dot-red { background: #D63939; }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
    }
    @media (max-width: 768px) {
      .calendar-grid { gap: 4px; }
    }

    .cal-col-head {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-align: center;
      padding-bottom: 8px;
    }

    .cal-day-cell {
      min-height: 115px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
    }
    .cal-day-cell:hover {
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }
    .cal-day-cell.is-today {
      border: 2px solid var(--amber-600);
      background: var(--bg-surface-elevated);
    }
    .cal-day-cell.other-month {
      opacity: 0.35;
      background: transparent;
    }
    .cal-day-cell.has-orders {
      background: var(--bg-surface);
    }
    .cal-day-cell.is-selected-date {
      border-color: var(--pine-600);
      box-shadow: 0 0 0 2px var(--pine-500);
    }

    .cal-day-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cal-day-num {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
    }
    .cal-today-badge {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      background: var(--amber-100);
      color: var(--amber-700);
      padding: 1px 6px;
      border-radius: var(--radius-pill);
    }

    .cal-orders-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 2px;
      overflow: hidden;
    }

    .cal-order-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 6px;
      border-radius: var(--radius-sm);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cal-order-pill.paid { border-left: 3px solid #2E8540; }
    .cal-order-pill.dp { border-left: 3px solid #D9822B; }
    .cal-order-pill.unpaid { border-left: 3px solid #D63939; }

    .cal-capacity-badge {
      font-size: 10.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      align-self: flex-start;
      margin-top: auto;
    }
    .capacity-green { background: #E6F4EA; color: #1E6B37; }
    .capacity-yellow { background: #FEF3D6; color: #8F5413; }
    .capacity-red { background: #FDE8E8; color: #9B1C1C; }

    /* Calendar Day Detail Overlay / Section */
    .cal-agenda-drawer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px dashed var(--border-strong);
      display: none;
    }
    .cal-agenda-drawer.active {
      display: block;
    }
    .cal-agenda-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--pine-700);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cal-agenda-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }

    /* ==========================================================================
       MODALS: (BATCH PREP, SETTINGS, NEW ORDER)
       ========================================================================= */
    .order-modal {
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      color: var(--text-main);
      box-shadow: var(--shadow-lg);
      max-width: 680px;
      width: 92vw;
      margin: auto;
      padding: 0;
      outline: none;
      overflow: hidden;
    }
    .order-modal::backdrop {
      background: rgba(19, 36, 26, 0.45);
      backdrop-filter: blur(4px);
    }

    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-header h3 {
      font-family: var(--font-serif);
      font-size: 20px;
      font-weight: 600;
    }

    .modal-body {
      padding: 20px 24px;
      max-height: 72vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
      border-bottom-left-radius: var(--radius-lg);
      border-bottom-right-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Batch Prep Styling */
    .prep-scope-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .prep-scope-btn {
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .prep-scope-btn.active {
      background: var(--pine-700);
      color: #FFFFFF;
      border-color: var(--pine-700);
    }

    .prep-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin: 12px 0 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .prep-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 10px;
    }
    .prep-item-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .prep-item-card:hover {
      border-color: var(--border-strong);
    }
    .prep-item-card.is-checked {
      background: #F1F6F3;
      border-color: #CFE0D6;
      opacity: 0.75;
    }
    [data-theme="dark"] .prep-item-card.is-checked {
      background: #19271E;
      border-color: #2D4737;
    }

    .prep-thumb {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .prep-thumb img { width: 100%; height: 100%; object-fit: cover; }

    .prep-info { flex: 1; }
    .prep-name {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text-main);
    }
    .prep-detail {
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .prep-qty-pill {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      background: var(--amber-100);
      color: var(--amber-700);
    }

    /* Template Editor Settings Styling */
    .token-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .token-chip {
      font-family: var(--font-mono);
      font-size: 11.5px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-strong);
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--pine-700);
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .token-chip:hover {
      background: var(--pine-100);
      border-color: var(--pine-600);
    }

    .template-tab-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .template-tab-btn {
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .template-tab-btn.active {
      background: var(--pine-700);
      color: #FFFFFF;
      border-color: var(--pine-700);
    }

    .preview-box-rendered {
      background: #F8F6F0;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      color: var(--text-main);
      max-height: 160px;
      overflow-y: auto;
    }
    [data-theme="dark"] .preview-box-rendered {
      background: #202621;
    }

    /* Form Fields inside Modals */
    .form-group-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    @media (max-width: 580px) {
      .form-group-grid { grid-template-columns: 1fr; }
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-field label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .form-field input, .form-field select, .form-field textarea {
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      color: var(--text-main);
      outline: none;
    }
    .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
      border-color: var(--pine-500);
    }

    /* Flower Picker in New Order Modal */
    .flower-picker-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
      gap: 10px;
    }
    .picker-card {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .picker-thumb {
      width: 54px;
      height: 54px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      margin-bottom: 6px;
    }
    .picker-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .picker-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.2;
    }
    .picker-price {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .counter-control {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-count {
      width: 26px;
      height: 26px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .count-val {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      min-width: 20px;
      text-align: center;
    }

    .swatch-picker-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .swatch-opt {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .swatch-opt.active {
      border-color: var(--pine-600);
      background: var(--pine-100);
      color: var(--pine-700);
    }

    /* Toast Notification */
    .toast-pill {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--pine-900);
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: var(--radius-pill);
      font-size: 13.5px;
      font-weight: 600;
      box-shadow: var(--shadow-lg);
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .toast-pill.show {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    /* ==========================================================================
       RESPONSIVE & MOBILE REFINEMENTS
       ========================================================================== */
    .btn-text-mobile { display: none; }
    .btn-text-full { display: inline; }
    .controls-nav-group {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    @media (max-width: 959px) {
      .desk-layout {
        grid-template-columns: 1fr !important;
        padding: 0 12px;
        margin: 12px auto 30px;
        gap: 16px;
      }
      .queue-pane {
        padding-right: 0;
      }
      body.view-detail-mode .studio-pulse,
      body.view-detail-mode .controls-row,
      .desk-layout.view-detail .queue-pane {
        display: none !important;
      }
      .desk-layout:not(.view-detail) .ticket-pane {
        display: none !important;
      }
      .ticket-mobile-back {
        display: flex !important;
      }
      .calendar-container {
        padding: 0 12px;
        margin: 12px auto 30px;
      }
    }

    @media (max-width: 680px) {
      /* Header on mobile */
      .header-inner {
        padding: 8px 12px;
        gap: 6px;
      }
      .brand-group {
        gap: 8px;
      }
      .brand-logo {
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
      }
      .brand-titles h1 {
        font-size: 14.5px;
        line-height: 1.15;
        white-space: nowrap;
      }
      .brand-titles .tagline {
        font-size: 8.5px;
      }
      .header-actions {
        gap: 6px;
      }
      .btn-batch-prep {
        padding: 6px 9px;
        font-size: 11.5px;
        gap: 5px;
      }
      .btn-new-order {
        padding: 6px 10px;
        font-size: 11.5px;
        gap: 5px;
      }
      .btn-icon {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
      }
      .btn-icon svg {
        width: 15px;
        height: 15px;
      }
      .btn-text-full { display: none; }
      .btn-text-mobile { display: inline; }

      /* Studio Pulse on mobile */
      .studio-pulse {
        margin: 10px auto 0;
        padding: 0 12px;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .pulse-card {
        padding: 10px 10px;
        gap: 8px;
      }
      .pulse-num {
        font-size: 20px;
        min-width: 20px;
      }
      .pulse-label {
        font-size: 10px;
        letter-spacing: 0.04em;
      }
      .pulse-sub {
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Controls row on mobile */
      .controls-row {
        margin: 10px auto 0;
        padding: 0 12px;
        gap: 10px;
      }
      .controls-nav-group {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .view-mode-tabs {
        width: 100%;
        display: flex;
      }
      .view-tab-btn {
        flex: 1;
        justify-content: center;
        padding: 6px 8px;
        font-size: 12px;
      }
      .chips-lane {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        gap: 6px;
        padding: 2px 2px 6px 2px;
        scrollbar-width: none;
        width: 100%;
      }
      .chips-lane::-webkit-scrollbar {
        display: none;
      }
      .chip-btn {
        flex-shrink: 0;
        padding: 5px 11px;
        font-size: 12px;
        gap: 6px;
      }
      .search-sort-group {
        width: 100%;
        display: flex;
        gap: 8px;
      }
      .search-box {
        flex: 1;
        min-width: 0;
        width: auto;
        padding: 6px 10px;
      }
      .search-box input {
        font-size: 12px;
      }
      .sort-select {
        flex: 0 0 auto;
        max-width: 135px;
        padding: 6px 8px;
        font-size: 12px;
      }

      /* Detail Ticket on mobile */
      .ticket-header {
        padding: 16px 18px 16px;
        gap: 12px;
      }
      .buyer-info h2 {
        font-size: 22px;
      }
      .buyer-links {
        gap: 8px;
        font-size: 12px;
      }
      .ticket-body {
        padding: 0 16px 20px;
      }
      .ticket-block {
        padding: 16px 0;
      }
      .payment-box {
        padding: 14px 16px;
      }
      .dp-banner-card {
        padding: 10px 12px;
        gap: 8px;
        grid-template-columns: 1fr 1fr;
      }
      .dp-banner-val {
        font-size: 15px;
      }
      .amount-val {
        font-size: 22px;
      }
      .payment-actions-row {
        flex-direction: column;
        gap: 8px;
      }
      .payment-actions-row button {
        width: 100%;
        justify-content: center;
      }

      /* Calendar View on mobile */
      .calendar-card {
        padding: 14px 12px;
      }
      .calendar-header {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .cal-title-group {
        justify-content: space-between;
      }
      .cal-day-cell {
        min-height: 80px;
        padding: 4px 5px;
        gap: 3px;
      }
      .cal-day-num {
        font-size: 11.5px;
      }
      .cal-today-badge {
        font-size: 8px;
        padding: 0 3px;
      }
      .cal-order-pill {
        font-size: 9.5px;
        padding: 2px 3px;
      }
      .cal-capacity-badge {
        font-size: 9px;
        padding: 0 4px;
      }

      /* Modals on mobile */
      .order-modal {
        width: 95vw;
        max-height: 92vh;
        border-radius: var(--radius-md);
      }
      .modal-header {
        padding: 14px 16px;
      }
      .modal-body {
        padding: 16px 14px;
        max-height: 70vh;
        gap: 16px;
      }
      .modal-footer {
        padding: 12px 16px;
        flex-direction: column-reverse;
        gap: 8px;
      }
      .modal-footer button {
        width: 100%;
        justify-content: center;
      }
      .prep-grid {
        grid-template-columns: 1fr;
      }
      .flower-picker-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
    }

    @media (max-width: 380px) {
      .brand-titles .tagline { display: none; }
      .brand-titles h1 { font-size: 13px; }
      .btn-batch-prep { padding: 6px 7px; font-size: 11px; }
      .btn-new-order { padding: 6px 8px; font-size: 11px; }
      .btn-icon { width: 28px; height: 28px; }
    }
  </style>
</head>
<body>

  <!-- =========================================================================
       TOP APPLICATION HEADER
       ========================================================================= -->
  <header class="app-header">
    <div class="header-inner">
      <div class="brand-group">
        <div class="brand-logo">
          <img src="https://alxanthia.com/alxanthia-logo-96.webp" onerror="this.src='https://alxanthia.com/img/sunflower-720.webp'" alt="Alxanthia Logo">
        </div>
        <div class="brand-titles">
          <h1>Alxanthia Studio Desk</h1>
          <span class="tagline">Meja Kerja Perajin</span>
        </div>
      </div>

      <div class="header-actions">
        <div class="time-badge" id="clock-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="current-time">Senin, 14 Sep 2026 · Bali</span>
        </div>

        <!-- Ringkasan Bahan Hari Ini (Batch Prep) Button -->
        <button type="button" class="btn-batch-prep" id="btn-open-batch-prep" title="Ringkasan Kebutuhan Bahan Hari Ini">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <span class="btn-text-full">Kebutuhan Bahan</span>
          <span class="btn-text-mobile">Bahan</span>
        </button>

        <button type="button" class="btn-new-order" id="btn-open-new-order" title="Buat Pesanan Baru">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span class="btn-text-full">+ Buat Pesanan Baru</span>
          <span class="btn-text-mobile">+ Pesanan</span>
        </button>

        <!-- WhatsApp & Settings Modal Button -->
        <button type="button" class="btn-icon" id="btn-open-settings" title="Pengaturan Template WA & Rekening">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>

        <button type="button" class="btn-icon" id="btn-theme-toggle" title="Ganti Tema (Gelap/Terang)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- =========================================================================
       STUDIO METRIC PULSE (Ringkasan Kerja Hari Ini)
       ========================================================================= -->
  <section class="studio-pulse" id="studio-pulse">
    <!-- Populated by JS -->
  </section>

  <!-- =========================================================================
       CONTROLS ROW (VIEW SWITCHER + FILTER CHIPS + SEARCH)
       ========================================================================= -->
  <section class="controls-row">
    <div class="controls-nav-group">
      <!-- View Mode Tabs: Antrean vs Kalender -->
      <div class="view-mode-tabs">
        <button type="button" class="view-tab-btn active" id="tab-view-queue">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Daftar Antrean
        </button>
        <button type="button" class="view-tab-btn" id="tab-view-calendar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Kalender Jadwal
        </button>
      </div>

      <!-- Filter Chips (Visible in Queue View) -->
      <nav class="chips-lane" id="lane-chips">
        <!-- Populated by JS -->
      </nav>
    </div>

    <div class="search-sort-group" id="search-sort-controls">
      <div class="search-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="order-search" placeholder="Cari pembeli / kode..." autocomplete="off">
      </div>

      <select class="sort-select" id="sort-select">
        <option value="due">Deadline Terdekat</option>
        <option value="newest">Pesanan Terbaru</option>
        <option value="oldest">Pesanan Terlama</option>
      </select>
    </div>
  </section>

  <!-- =========================================================================
       VIEW 1: TWO-PANE WORKSPACE: QUEUE + TICKET
       ========================================================================= -->
  <main class="desk-layout" id="desk-layout">
    <!-- Left: Queue of Orders -->
    <section class="queue-pane" id="queue-pane">
      <!-- Order cards rendered by JS -->
    </section>

    <!-- Right: Detailed Maker Work Ticket -->
    <article class="ticket-pane" id="ticket-pane">
      <!-- Ticket rendered by JS -->
    </article>
  </main>

  <!-- =========================================================================
       VIEW 2: CALENDAR SCHEDULE VIEW (Tampilan Jadwal Kalender)
       ========================================================================= -->
  <section class="calendar-container" id="calendar-view" style="display: none;">
    <div class="calendar-card">
      <div class="calendar-header">
        <div class="cal-title-group">
          <button type="button" class="cal-nav-btn" id="cal-prev-month" title="Bulan Sebelumnya">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 class="cal-month-title" id="cal-month-heading">September 2026</h2>
          <button type="button" class="cal-nav-btn" id="cal-next-month" title="Bulan Berikutnya">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button type="button" class="btn-secondary" id="cal-today-btn" style="padding: 4px 12px; font-size: 12px;">
            Hari Ini (14 Sep)
          </button>
        </div>

        <div class="cal-legend-row">
          <span class="legend-item"><span class="legend-dot dot-green"></span> 1 Pesanan (Santai)</span>
          <span class="legend-item"><span class="legend-dot dot-yellow"></span> 2 Pesanan (Padat)</span>
          <span class="legend-item"><span class="legend-dot dot-red"></span> 3+ Pesanan (Kapasitas Penuh)</span>
        </div>
      </div>

      <!-- Calendar Month Grid -->
      <div class="calendar-grid" id="calendar-grid">
        <!-- Rendered by JS -->
      </div>

      <!-- Selected Day Agenda Drawer -->
      <div class="cal-agenda-drawer" id="cal-agenda-drawer">
        <div class="cal-agenda-title">
          <span id="cal-agenda-date-label">Pesanan Tanggal: 14 September 2026</span>
          <button type="button" class="btn-secondary" id="cal-agenda-close-btn" style="font-size: 12px; padding: 4px 10px;">
            Tutup Rincian
          </button>
        </div>
        <div class="cal-agenda-grid" id="cal-agenda-grid">
          <!-- Populated by JS -->
        </div>
      </div>
    </div>
  </section>

  <!-- =========================================================================
       MODAL 1: RINGKASAN KEBUTUHAN BAHAN (BATCH PREP)
       ========================================================================= -->
  <dialog class="order-modal" id="modal-batch-prep" closedby="any">
    <div class="modal-header">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 22px;">📦</span>
        <div>
          <h3>Ringkasan Kebutuhan Bahan</h3>
          <span style="font-size: 12px; color: var(--text-muted);">Tally & Siapkan Bunga, Pot & Kertas di Meja Kerja</span>
        </div>
      </div>
      <button type="button" class="btn-icon" id="btn-close-prep-modal" aria-label="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body">
      <!-- Scope selector -->
      <div>
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 8px;">
          Pilih Lingkup Waktu:
        </span>
        <div class="prep-scope-nav" id="prep-scope-nav">
          <button type="button" class="prep-scope-btn active" data-scope="today">Hari Ini (14 Sep)</button>
          <button type="button" class="prep-scope-btn" data-scope="tomorrow">Besok (15 Sep)</button>
          <button type="button" class="prep-scope-btn" data-scope="3days">3 Hari Ke Depan</button>
          <button type="button" class="prep-scope-btn" data-scope="all">Semua Pesanan Aktif</button>
        </div>
      </div>

      <!-- Scope active stats banner -->
      <div id="prep-summary-banner" style="background: var(--bg-surface-subtle); padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; color: var(--text-muted); border: 1px solid var(--border-subtle);">
        <!-- Populated by JS -->
      </div>

      <!-- Rollup Categories -->
      <div id="prep-categories-container">
        <!-- Rendered by JS -->
      </div>
    </div>

    <div class="modal-footer">
      <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">
        *Klik item untuk mencentang bahan yang sudah ditaruh di meja kerja.
      </div>
      <div style="display: flex; gap: 10px;">
        <button type="button" class="btn-secondary" id="btn-copy-prep-text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Salin Ringkasan Teks
        </button>
        <button type="button" class="btn-new-order" id="btn-done-prep">Selesai</button>
      </div>
    </div>
  </dialog>

  <!-- =========================================================================
       MODAL 2: PENGATURAN TEMPLATE WHATSAPP & REKENING STUDIO
       ========================================================================= -->
  <dialog class="order-modal" id="modal-settings" closedby="any">
    <div class="modal-header">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 22px;">⚙️</span>
        <div>
          <h3>Pengaturan Studio & Template WhatsApp</h3>
          <span style="font-size: 12px; color: var(--text-muted);">Kustomisasi No Rekening, Salam & Format Pesan Otomatis</span>
        </div>
      </div>
      <button type="button" class="btn-icon" id="btn-close-settings-modal" aria-label="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body">
      <!-- Bagian 1: Data Rekening Studio -->
      <div>
        <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--pine-700); margin-bottom: 12px;">
          1. Rekening Bank & Identitas Studio
        </h4>
        <div class="form-group-grid">
          <div class="form-field">
            <label>Nama Bank</label>
            <input type="text" id="set-bank-name" placeholder="BCA">
          </div>
          <div class="form-field">
            <label>Nomor Rekening</label>
            <input type="text" id="set-acc-num" placeholder="1234567890">
          </div>
          <div class="form-field">
            <label>Atas Nama Pemilik Rekening</label>
            <input type="text" id="set-acc-holder" placeholder="Alxanthia Studio">
          </div>
          <div class="form-field">
            <label>Penutup / Signature WhatsApp</label>
            <input type="text" id="set-signature" placeholder="Alxanthia Studio 🌸 · Bali">
          </div>
        </div>
      </div>

      <!-- Bagian 2: Kustomisasi Template Pesan WhatsApp -->
      <div>
        <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--pine-700); margin-bottom: 12px;">
          2. Kustomisasi Template Pesan WhatsApp
        </h4>

        <!-- Template Tabs -->
        <div class="template-tab-group" id="template-tab-group">
          <button type="button" class="template-tab-btn active" data-tpl="rek">1. Tagihan Rekening & DP</button>
          <button type="button" class="template-tab-btn" data-tpl="paid">2. Konfirmasi Bayar / DP</button>
          <button type="button" class="template-tab-btn" data-tpl="ready">3. Bunga Jadi & Pelunasan</button>
          <button type="button" class="template-tab-btn" data-tpl="shipped">4. Info Driver / Resi</button>
        </div>

        <!-- Token insertion chips -->
        <div style="margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">
            Klik label untuk menyisipkan variabel otomatis ke pesan:
          </span>
          <div class="token-bar" id="token-bar">
            <button type="button" class="token-chip" data-token="{nama}">+ {nama}</button>
            <button type="button" class="token-chip" data-token="{ref}">+ {ref}</button>
            <button type="button" class="token-chip" data-token="{total}">+ {total}</button>
            <button type="button" class="token-chip" data-token="{dp}">+ {dp}</button>
            <button type="button" class="token-chip" data-token="{sisa}">+ {sisa}</button>
            <button type="button" class="token-chip" data-token="{bank}">+ {bank}</button>
            <button type="button" class="token-chip" data-token="{rek}">+ {rek}</button>
            <button type="button" class="token-chip" data-token="{atas_nama}">+ {atas_nama}</button>
            <button type="button" class="token-chip" data-token="{tanggal}">+ {tanggal}</button>
            <button type="button" class="token-chip" data-token="{metode}">+ {metode}</button>
          </div>
        </div>

        <div class="form-field">
          <textarea id="tpl-editor-textarea" rows="6" style="font-family: var(--font-mono); font-size: 12.5px; line-height: 1.45;"></textarea>
        </div>

        <!-- Live Preview -->
        <div style="margin-top: 14px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 6px;">
            👁️ Pratinjau Teks WhatsApp Sebenarnya (Menggunakan Pesanan Aktif):
          </span>
          <div class="preview-box-rendered" id="tpl-live-preview">
            <!-- Rendered live by JS -->
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" id="btn-reset-settings" style="color: var(--rose-700);">
        Reset ke Default Pabrik
      </button>
      <div style="display: flex; gap: 10px;">
        <button type="button" class="btn-secondary" id="btn-cancel-settings">Batal</button>
        <button type="button" class="btn-new-order" id="btn-save-settings">Simpan Pengaturan</button>
      </div>
    </div>
  </dialog>

  <!-- =========================================================================
       MODAL 3: "+ BUAT PESANAN BARU" (New Order Builder for GF)
       ========================================================================= -->
  <dialog class="order-modal" id="modal-new-order" closedby="any">
    <div class="modal-header">
      <h3>+ Buat Pesanan Baru</h3>
      <button type="button" class="btn-icon" id="btn-close-modal" aria-label="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <form id="form-new-order" method="dialog">
      <div class="modal-body">
        <!-- Step 1: Info Pembeli & Skema Pembayaran -->
        <div>
          <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--pine-700); margin-bottom: 12px;">1. Info Pembeli & Skema Pembayaran</h4>
          <div class="form-group-grid">
            <div class="form-field">
              <label>Nama Pembeli</label>
              <input type="text" id="inp-buyer-name" required placeholder="misal: Ni Luh Putu...">
            </div>
            <div class="form-field">
              <label>WhatsApp Pembeli</label>
              <input type="tel" id="inp-buyer-wa" required placeholder="081234567890">
            </div>
            <div class="form-field">
              <label>Tanggal Diperlukan (Deadline)</label>
              <input type="date" id="inp-buyer-date" required>
            </div>
            <div class="form-field">
              <label>Skema Pembayaran (DP / Penuh)</label>
              <select id="inp-payment-plan">
                <option value="Full">Bayar Penuh (100% di awal)</option>
                <option value="Deposit 50%">DP 50% (Uang Muka 50% di awal)</option>
              </select>
            </div>
            <div class="form-field">
              <label>Wilayah Pengiriman</label>
              <select id="inp-location-type">
                <option value="bali">Bali (Grab / Gojek / Ambil Sendiri)</option>
                <option value="luar_bali">Luar Bali (Ekspedisi JNE / Kurir)</option>
              </select>
            </div>
          </div>

          <div class="form-field" style="margin-top: 12px;" id="field-bali-detail">
            <label>Pengantaran Bali</label>
            <div style="display: flex; gap: 12px;">
              <select id="inp-regency" style="flex: 1;">
                <option value="Denpasar">Denpasar</option>
                <option value="Badung">Badung</option>
                <option value="Gianyar">Gianyar</option>
                <option value="Tabanan">Tabanan</option>
                <option value="Klungkung">Klungkung</option>
              </select>
              <select id="inp-delivery-method" style="flex: 1;">
                <option value="grab_gojek">Grab / Gojek (Bayar ke driver)</option>
                <option value="self_pickup">Ambil Sendiri di Studio</option>
              </select>
            </div>
          </div>

          <div class="form-field" style="margin-top: 12px; display: none;" id="field-luar-bali-detail">
            <label>Alamat Lengkap & Kota</label>
            <input type="text" id="inp-address" placeholder="Jl. Mawar No. 10, Jakarta Selatan, 12345">
          </div>
        </div>

        <!-- Step 2: Pilih Bunga / Produk -->
        <div>
          <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--pine-700); margin-bottom: 12px;">2. Pilih Bunga & Produk</h4>
          <div class="flower-picker-grid" id="modal-flower-picker">
            <!-- Populated by JS -->
          </div>
          <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 8px; font-style: italic;">
            *Biaya bungkus & pita otomatis Rp 35.000 per 3 tangkai bunga.
          </div>
        </div>

        <!-- Step 3: Kertas Wrap & Kartu Ucapan -->
        <div>
          <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--pine-700); margin-bottom: 12px;">3. Kertas Pembungkus & Kartu Ucapan</h4>
          
          <div class="form-field" style="margin-bottom: 16px;">
            <label>Pilihan Warna Kertas</label>
            <div class="swatch-picker-row" id="modal-swatch-picker">
              <!-- Swatches populated by JS -->
            </div>
          </div>

          <div style="background: var(--bg-surface-subtle); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; margin-bottom: 10px;">
              <input type="checkbox" id="modal-has-card" style="width: 17px; height: 17px;">
              Tambah Kartu Ucapan (+ Rp 5.000)
            </label>
            <div id="modal-card-fields" style="display: none; flex-direction: column; gap: 10px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input type="text" id="inp-card-to" placeholder="Untuk: (Nama Penerima)">
                <input type="text" id="inp-card-from" placeholder="Dari: (Nama Pengirim)">
              </div>
              <textarea id="inp-card-text" rows="2" placeholder="Tuliskan ucapan..."></textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;" id="modal-total-label">Estimasi Total</span>
          <span style="font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--pine-700);" id="modal-total-preview">Rp 0</span>
          <span style="font-size: 11.5px; color: var(--amber-700); font-weight: 600; display: none;" id="modal-dp-preview"></span>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn-secondary" id="btn-cancel-modal">Batal</button>
          <button type="submit" class="btn-new-order" style="padding: 10px 24px;">Simpan Pesanan</button>
        </div>
      </div>
    </form>
  </dialog>

  <!-- Notification Toast -->
  <div class="toast-pill" id="toast-pill">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    <span id="toast-msg">Tersimpan ke antrean</span>
  </div>

  <!-- =========================================================================
       STUDIO DESK SCRIPT LOGIC
       ========================================================================= -->
  <script>
    'use strict';
    /* --- Google Apps Script Environment Detection & Remote Persistence --- */
    function isAppsScript() {
      return typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined';
    }

    function updateOrderField(ref, field, value, successMsg) {
      const order = state.orders.find(o => o.ref === ref);
      if (!order) return;
      const oldValue = order[field];
      order[field] = value;
      saveState();
      renderAll();

      if (isAppsScript()) {
        google.script.run
          .withSuccessHandler(function(res) {
            if (!res || !res.ok) {
              order[field] = oldValue;
              saveState();
              renderAll();
              showToast((res && res.message) || 'Gagal menyimpan ke Google Sheets.', true);
            } else {
              showToast(successMsg || 'Tersimpan di Google Sheets ✓');
              if (res.order) {
                const idx = state.orders.findIndex(o => o.ref === ref);
                if (idx !== -1) {
                  state.orders[idx] = Object.assign({}, order, res.order);
                  renderAll();
                }
              }
            }
          })
          .withFailureHandler(function(err) {
            order[field] = oldValue;
            saveState();
            renderAll();
            showToast('Koneksi sheet gagal: ' + (err.message || err), true);
          })
          .updateOrder({ ref: order.ref, row: order.row, field: field, value: value });
      } else {
        showToast(successMsg || 'Tersimpan ✓');
      }
    }


    /* --- Studio Catalog Data --- */
    const CATALOG = {
      wrapFeeUnitStems: 3,
      wrapFeePerUnit: 35000,
      messageCardPrice: 5000,
      minimumLeadDays: 2,
      flowers: {
        Sunflower: { price: 55000, name: 'Bunga Matahari', spec: '45 cm · kepala 12 cm', img: 'https://alxanthia.com/img/sunflower-720.webp', fallbackImg: 'https://alxanthia.com/img/sunflower-720.webp' },
        Rose:      { price: 60000, name: 'Mawar',          spec: '40 cm · kepala melingkar', img: 'https://alxanthia.com/img/rose-720.webp', fallbackImg: 'https://alxanthia.com/img/rose-720.webp' },
        Tulip:     { price: 50000, name: 'Tulip',          spec: '38 cm · 6 kelopak', img: 'https://alxanthia.com/img/tulip-720.webp', fallbackImg: 'https://alxanthia.com/img/tulip-720.webp' },
        Gerbera:   { price: 55000, name: 'Gerbera',        spec: '40 cm · koral dua nada', img: 'https://alxanthia.com/img/gerbera-720.webp', fallbackImg: 'https://alxanthia.com/img/gerbera-720.webp' }
      },
      pots: {
        sunflower:            { price: 125000, name: 'Mini Pot Bunga Matahari', spec: 'tinggi 14 cm', img: 'https://alxanthia.com/img/mini-pot-sunflower.webp', fallbackImg: 'https://alxanthia.com/img/mini-pot-sunflower.webp' },
        'lily-of-the-valley': { price: 125000, name: 'Mini Pot Lily of the Valley', spec: 'tinggi 11 cm', img: 'https://alxanthia.com/img/mini-pot-lily-of-the-valley.webp', fallbackImg: 'https://alxanthia.com/img/mini-pot-lily-of-the-valley.webp' },
        daisy:                { price: 125000, name: 'Mini Pot Daisy', spec: 'tinggi 13 cm', img: 'https://alxanthia.com/img/mini-pot-daisy.webp', fallbackImg: 'https://alxanthia.com/img/mini-pot-daisy.webp' }
      },
      additions: {
        rounded: { price: 12000, name: 'Daun Bulat', spec: 'tangkai daun bulat', img: 'https://alxanthia.com/img/addition-rounded-leaves.webp', fallbackImg: 'https://alxanthia.com/img/addition-rounded-leaves.webp' },
        fern:    { price: 12000, name: 'Daun Pakis', spec: 'tangkai daun pakis', img: 'https://alxanthia.com/img/addition-fern-leaves.webp', fallbackImg: 'https://alxanthia.com/img/addition-fern-leaves.webp' }
      },
      packages: [
        { price: 195000, stems: 3, img: 'https://alxanthia.com/img/bouquet-3-720.webp', fallbackImg: 'https://alxanthia.com/img/bouquet-3-720.webp' },
        { price: 295000, stems: 5, img: 'https://alxanthia.com/img/bouquet-5-720.webp', fallbackImg: 'https://alxanthia.com/img/bouquet-5-720.webp' },
        { price: 465000, stems: 9, img: 'https://alxanthia.com/img/bouquet-9-720.webp', fallbackImg: 'https://alxanthia.com/img/bouquet-9-720.webp' },
        { price: 745000, stems: 15, img: 'https://alxanthia.com/img/bouquet-15-720.webp', fallbackImg: 'https://alxanthia.com/img/bouquet-15-720.webp' }
      ],
      wraps: {
        kraft: { swatch: '#B79A6E', name: 'Kraft', note: 'Kertas cokelat natural tebal' },
        cream: { swatch: '#F0E7D6', name: 'Krem', note: 'Kertas krem lembut elegan' },
        sage:  { swatch: '#7E8F7C', name: 'Sage', note: 'Kertas hijau sage botanical' },
        blush: { swatch: '#C9A4A8', name: 'Blush', note: 'Kertas dusty pink manis' }
      }
    };

    /* Default studio bank & WA settings */
    const DEFAULT_SETTINGS = {
      bank: 'BCA',
      accNumber: '1234567890',
      accHolder: 'Alxanthia Studio',
      signature: 'Alxanthia Studio 🌸 · Bali',
      templates: {
        rek: 'Halo Kak {nama}, ini rincian pesanan dan nomor rekening untuk pesanan *{ref}*:\n\nTotal Pesanan: {total}\n*Wajib DP 50%: {dp}*\nSisa Pelunasan: {sisa} (dilunasi saat buket selesai dirangkai)\n\nTransfer DP ke: Bank *{bank} {rek}* a.n. *{atas_nama}*\n\nMohon konfirmasi jika sudah transfer DP ya Kak agar segera kami siapkan untuk tanggal *{tanggal}*. Terima kasih! 🌸',
        paid: 'Halo Kak {nama}, pembayaran DP 50% ({dp}) untuk pesanan *{ref}* sudah kami terima dengan baik. Terima kasih! 💖\n\nPesanan Kakak sedang kami siapkan dan mulai dirangkai untuk tanggal *{tanggal}*. Nanti saat sudah jadi dan siap kirim kami kabari lagi ya ✨\n\n{signature}',
        ready: 'Halo Kak {nama}! Kabar baik, buket bunganya untuk pesanan *{ref}* sudah selesai kami rangkai dengan cantik 🌸✨\n\nUntuk pengiriman ({metode}), mohon lakukan pelunasan sisa tagihan ya Kak:\n*Sisa Pelunasan: {sisa}*\nTransfer ke: {bank} {rek} a.n. {atas_nama}\n\nSetelah pelunasan masuk, pesanan langsung kami serahkan ke kurir/driver. Terima kasih banyak Kak! 💖',
        shipped: 'Halo Kak {nama}, pesanan *{ref}* sudah kami serahkan ke pengantaran ({metode}) ya 🛵✨\nSemoga bunganya sampai dengan selamat dan membawa kebahagiaan! 💐\n\nTerima kasih telah berbelanja di Alxanthia Studio.\n\n{signature}'
      }
    };

    const PHASES = [
      { key: 'Not started',          label: 'Belum mulai' },
      { key: 'Assembly and packing', label: 'Dirangkai & dikemas' },
      { key: 'Ready for dispatch',   label: 'Siap dikirim' },
      { key: 'Shipped',              label: 'Dikirim' },
      { key: 'Delivered',            label: 'Selesai' }
    ];

    const TODAY = '2026-09-14';

    /* Sample initial orders demonstrating Full Payment & DP 50% workflows */
    const DEFAULT_ORDERS = [
      {
        row: 128, ref: 'ALX-260914-K4T9', submitted: '2026-09-14 09:14',
        buyer: 'Ni Putu Ayu Lestari', wa: '+6281234567890',
        locationType: 'bali', regency: 'Denpasar', method: 'grab_gojek',
        date: '2026-09-14', wrap: 'sage', paymentPlan: 'Full', payment: 'Paid', paidAt: '14 Sep 09:51',
        mismatch: false, shipping: 0, phase: 'Assembly and packing',
        items: [
          { type: 'custom', qty: 1, stems: { Sunflower: 3, Rose: 2 }, additions: { fern: 1 } },
          { type: 'pot', id: 'daisy', qty: 1 }
        ],
        card: { to: 'Kadek Surya', from: 'Ayu', text: 'Selamat ulang tahun, Kadek. Semoga harimu selalu secerah bunga matahari ini!' },
        notes: 'Pita warna hijau sage senada kertas bungkus ya.'
      },
      {
        row: 126, ref: 'ALX-260912-H7RB', submitted: '2026-09-12 19:22',
        buyer: 'Luh Ratna Dewi', wa: '+6287712349900',
        locationType: 'bali', regency: 'Badung', method: 'grab_gojek',
        date: '2026-09-14', wrap: 'blush', paymentPlan: 'Deposit 50%', payment: 'Deposit paid', paidAt: '12 Sep 20:05',
        mismatch: false, shipping: 0, phase: 'Ready for dispatch',
        items: [ { type: 'custom', qty: 2, stems: { Gerbera: 3 }, additions: { rounded: 2 } } ],
        card: null,
        notes: 'Dua rangkaian kembar — jaga tinggi kepala sama rata. DP 50% sudah lunas, tunggu pelunasan sebelum kirim.'
      },
      {
        row: 125, ref: 'ALX-260911-B8QX', submitted: '2026-09-11 16:05',
        buyer: 'Komang Sari', wa: '+6281998877665',
        locationType: 'bali', regency: 'Gianyar', method: 'self_pickup',
        date: '2026-09-15', wrap: 'cream', paymentPlan: 'Deposit 50%', payment: 'Checking deposit', paidAt: null,
        mismatch: false, shipping: 0, phase: 'Not started',
        items: [ { type: 'stem', id: 'Tulip', qty: 6 } ],
        card: { to: 'Ibu Wayan', from: 'Komang', text: 'Terima kasih banyak untuk bimbingannya selama ini, Ibu. Semoga selalu sehat.' },
        notes: 'Pembeli konfirmasi sudah transfer DP via WA, minta tolong dicek.'
      },
      {
        row: 127, ref: 'ALX-260913-P2M7', submitted: '2026-09-13 21:47',
        buyer: 'Gede Wirawan', wa: '+6281377665544',
        locationType: 'luar_bali', address: 'Jl. Kemang Selatan 12A, Kebayoran Baru',
        city: 'Jakarta Selatan', postal: '12190',
        date: '2026-09-17', wrap: 'kraft', paymentPlan: 'Full', payment: 'Unpaid', paidAt: null,
        mismatch: false, shipping: 38000, phase: 'Not started',
        items: [ { type: 'package', id: '2', qty: 1 } ],
        card: null,
        notes: ''
      },
      {
        row: 129, ref: 'ALX-260914-T3WH', submitted: '2026-09-14 06:30',
        buyer: 'Made Bagus Prayoga', wa: '+6285611223344',
        locationType: 'luar_bali', address: 'Jl. Dharmahusada Indah 45',
        city: 'Surabaya', postal: '60285',
        date: '2026-09-18', wrap: 'blush', paymentPlan: 'Deposit 50%', payment: 'Unpaid', paidAt: null,
        mismatch: false, shipping: 45000, phase: 'Not started',
        items: [
          { type: 'stem', id: 'Rose', qty: 3 },
          { type: 'pot', id: 'lily-of-the-valley', qty: 1 }
        ],
        card: { to: 'Dinda', from: 'Bagus', text: 'Untuk hari pertamamu di kantor baru. Semangat selalu!' },
        notes: 'Pelanggan minta kartu ditulis dengan tinta hitam rapi.'
      },
      {
        row: 124, ref: 'ALX-260910-J9FN', submitted: '2026-09-10 11:03',
        buyer: 'Ni Kadek Dwi', wa: '+6281255443322',
        locationType: 'bali', regency: 'Tabanan', method: 'grab_gojek',
        date: '2026-09-13', wrap: 'kraft', paymentPlan: 'Full', payment: 'Paid', paidAt: '10 Sep 12:15',
        mismatch: false, shipping: 0, phase: 'Shipped',
        items: [ { type: 'package', id: '0', qty: 1 } ],
        card: null,
        notes: ''
      }
    ];

    /* --- State Management & Storage --- */
    const STORAGE_KEY = 'alxanthia_studio_desk_remake_v3';
    const SETTINGS_KEY = 'alxanthia_studio_settings_v2';
    const PREP_CHECK_KEY = 'alxanthia_studio_prep_checklist_v1';

    let state = {
      orders: [],
      lane: 'all',
      sort: 'due',
      search: '',
      selectedRef: null,
      theme: 'light',
      viewMode: 'queue', // 'queue' | 'calendar'
      calendarYear: 2026,
      calendarMonth: 8, // September (0-indexed)
      selectedCalendarDate: null,
      orderItemTicks: {},
      prepChecklist: {},
      prepScope: 'today',
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    };

    function loadState() {
      // 1. Client preferences
      try {
        const savedTheme = localStorage.getItem('alx_desk_theme');
        if (savedTheme) applyTheme(savedTheme);
        const savedTicks = localStorage.getItem('alx_desk_ticks');
        if (savedTicks) state.orderItemTicks = JSON.parse(savedTicks);
        const savedPrepTicks = localStorage.getItem('alx_desk_prep_ticks');
        if (savedPrepTicks) state.prepCheckedItems = JSON.parse(savedPrepTicks);
        const savedSettings = localStorage.getItem('alx_desk_settings');
        if (savedSettings) state.settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(savedSettings));
      } catch (e) {}

      // Initialize orders with cache/default so page is immediately populated
      try {
        const raw = localStorage.getItem('alx_desk_remake_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.orders && parsed.orders.length) state.orders = parsed.orders;
          if (parsed.selectedRef) state.selectedRef = parsed.selectedRef;
        } else {
          state.orders = JSON.parse(JSON.stringify(DEFAULT_ORDERS));
          state.selectedRef = state.orders[0].ref;
        }
      } catch (e) {
        state.orders = JSON.parse(JSON.stringify(DEFAULT_ORDERS));
        state.selectedRef = state.orders[0].ref;
      }

      // Render immediately so user sees UI instantly
      renderAll();

      // If running live inside Google Apps Script, fetch live orders & catalog in background
      if (isAppsScript()) {
        google.script.run
          .withSuccessHandler(function(orders) {
            if (Array.isArray(orders)) {
              state.orders = orders;
              if (orders.length > 0) {
                if (!state.selectedRef || !state.orders.some(o => o.ref === state.selectedRef)) {
                  state.selectedRef = state.orders[0].ref;
                }
              } else {
                state.selectedRef = null;
              }
              saveState();
              renderAll();
            }
          })
          .withFailureHandler(function(err) {
            showToast('Gagal terhubung ke Sheet: ' + (err.message || err), true);
          })
          .listOrders();

        google.script.run
          .withSuccessHandler(function(cat) {
            if (cat && cat.bank) {
              if (cat.bank.bank) state.settings.bank = cat.bank.bank;
              if (cat.bank.number) state.settings.accNumber = cat.bank.number;
              if (cat.bank.holder) state.settings.accHolder = cat.bank.holder;
            }
            renderTicket();
          })
          .getCatalog();

        if (google.script.run.getDeskSettings) {
          google.script.run
            .withSuccessHandler(function(serverSettings) {
              if (serverSettings) {
                if (serverSettings.signature) state.settings.signature = serverSettings.signature;
                if (serverSettings.templates) {
                  state.settings.templates = Object.assign({}, DEFAULT_SETTINGS.templates, serverSettings.templates);
                }
              }
            })
            .getDeskSettings();
        }
      }
    }

    function saveState() {
      try {
        localStorage.setItem('alx_desk_theme', state.theme);
        localStorage.setItem('alx_desk_ticks', JSON.stringify(state.orderItemTicks));
        localStorage.setItem('alx_desk_prep_ticks', JSON.stringify(state.prepCheckedItems));
        localStorage.setItem('alx_desk_settings', JSON.stringify(state.settings));
        localStorage.setItem('alx_desk_remake_v1', JSON.stringify({
          orders: state.orders,
          selectedRef: state.selectedRef,
          settings: state.settings
        }));
      } catch (e) {}
    }

    function applyTheme(theme) {
      state.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      const icon = document.getElementById('btn-theme-toggle');
      if (icon) {
        icon.innerHTML = theme === 'dark' 
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      }
    }

    /* --- Helper Calculations & DP System --- */
    function computeTotals(order) {
      let subtotal = 0;
      if (order.items && order.items.length) {
        order.items.forEach(item => {
          if (item.type === 'stem') {
            const f = CATALOG.flowers[item.id];
            subtotal += (f && f.price ? f.price : 55000) * (item.qty || 1);
          } else if (item.type === 'pot') {
            const p = CATALOG.pots[item.id];
            subtotal += (p && p.price ? p.price : 125000) * (item.qty || 1);
          } else if (item.type === 'package') {
            const pkg = CATALOG.packages[Number(item.id)];
            subtotal += (pkg && pkg.price ? pkg.price : 195000) * (item.qty || 1);
          } else if (item.type === 'custom') {
            let stemsCount = 0;
            let stemsPrice = 0;
            Object.keys(item.stems || {}).forEach(k => {
              const count = item.stems[k];
              stemsCount += count;
              const f = CATALOG.flowers[k];
              stemsPrice += count * (f && f.price ? f.price : 55000);
            });
            Object.keys(item.additions || {}).forEach(k => {
              const count = item.additions[k];
              const a = CATALOG.additions[k];
              stemsPrice += count * (a && a.price ? a.price : 12000);
            });
            const wrapFee = stemsCount > 0 ? Math.ceil(stemsCount / CATALOG.wrapFeeUnitStems) * CATALOG.wrapFeePerUnit : 0;
            subtotal += (stemsPrice + wrapFee) * (item.qty || 1);
          }
        });
      }
      if (order.verified && order.verified > 0) {
        subtotal = order.verified - (order.card ? CATALOG.messageCardPrice : 0);
        if (subtotal < 0) subtotal = order.verified;
      }
      const cardFee = order.card ? CATALOG.messageCardPrice : 0;
      const shipFee = Number(order.shipping || 0);
      const verifiedTotal = order.verified && order.verified > 0 ? order.verified : (subtotal + cardFee);
      const finalTotal = verifiedTotal + shipFee;
      const isDeposit = order.paymentPlan === 'Deposit 50%';
      const deposit = Math.ceil(finalTotal / 2);
      const balance = finalTotal - deposit;

      return {
        product: subtotal,
        card: cardFee,
        shipping: shipFee,
        verified: verifiedTotal,
        finalTotal: finalTotal,
        isDeposit: isDeposit,
        depositAmount: deposit,
        balanceAmount: balance
      };
    }

    function daysUntil(dateStr) {
      const target = new Date(dateStr + 'T00:00:00');
      const now = new Date(TODAY + 'T00:00:00');
      return Math.round((target - now) / (1000 * 60 * 60 * 24));
    }

    function formatRelativeDate(dateStr) {
      const d = daysUntil(dateStr);
      if (d < 0) return `${-d} hari lewat`;
      if (d === 0) return 'Hari ini';
      if (d === 1) return 'Besok';
      return `${d} hari lagi`;
    }

    function formatRupiah(num) {
      return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
    }

    function showToast(msg) {
      const toast = document.getElementById('toast-pill');
      const msgEl = document.getElementById('toast-msg');
      if (!toast || !msgEl) return;
      msgEl.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2600);
    }

    /* Detailed recipe list for one order */
    function getItemRecipeList(order) {
      return order.items.map((item, idx) => {
        const itemKey = `item_${idx}`;
        if (item.type === 'stem') {
          const flower = CATALOG.flowers[item.id] || { name: item.id, spec: '', img: '' };
          return {
            key: itemKey,
            qty: item.qty,
            name: flower.name,
            spec: flower.spec,
            img: flower.img,
            fallbackImg: flower.fallbackImg,
            breakdown: null
          };
        }
        if (item.type === 'pot') {
          const pot = CATALOG.pots[item.id] || { name: item.id, spec: '', img: '' };
          return {
            key: itemKey,
            qty: item.qty,
            name: pot.name,
            spec: pot.spec,
            img: pot.img,
            fallbackImg: pot.fallbackImg,
            breakdown: null
          };
        }
        if (item.type === 'package') {
          const pkg = CATALOG.packages[Number(item.id)] || { stems: 3, img: '' };
          return {
            key: itemKey,
            qty: item.qty,
            name: `Paket Buket ${pkg.stems} Tangkai`,
            spec: 'Kombinasi bunga cantik pilihan studio',
            img: pkg.img,
            fallbackImg: pkg.fallbackImg,
            breakdown: null
          };
        }
        // Custom bouquet
        const stemParts = [];
        Object.keys(item.stems || {}).forEach(k => {
          stemParts.push(`${item.stems[k]}× ${CATALOG.flowers[k] ? CATALOG.flowers[k].name : k}`);
        });
        Object.keys(item.additions || {}).forEach(k => {
          if (item.additions[k]) {
            stemParts.push(`${item.additions[k]}× ${CATALOG.additions[k] ? CATALOG.additions[k].name : k}`);
          }
        });
        return {
          key: itemKey,
          qty: item.qty,
          name: 'Rangkaian Buket Custom',
          spec: 'Komposisi bunga & daun khusus pesanan ini',
          img: 'https://alxanthia.com/img/bouquet-5-720.webp',
          fallbackImg: 'https://alxanthia.com/img/bouquet-5-720.webp',
          breakdown: `Komposisi per rangkaian: ${stemParts.join(' · ')}`
        };
      });
    }

    /* --- WhatsApp Message Dynamic Token Formatter --- */
    function renderWaMessage(tplText, order) {
      const totals = computeTotals(order);
      const firstName = (order.buyer || '').split(' ')[0] || 'Kak';
      const cleanWa = (order.wa || '').replace(/[^0-9]/g, '');
      const bank = state.settings.bank || 'BCA';
      const rek = state.settings.accNumber || '1234567890';
      const atasNama = state.settings.accHolder || 'Alxanthia Studio';
      const sig = state.settings.signature || 'Alxanthia Studio 🌸';
      const metode = order.locationType === 'bali'
        ? (order.method === 'self_pickup' ? 'Ambil Sendiri di Studio' : `Grab / Gojek (${order.regency || 'Bali'})`)
        : `Ekspedisi ke ${order.city || 'Luar Bali'}`;

      let out = tplText || '';
      out = out.replace(/\{nama\}/g, firstName);
      out = out.replace(/\{ref\}/g, order.ref);
      out = out.replace(/\{total\}/g, formatRupiah(totals.finalTotal));
      out = out.replace(/\{dp\}/g, formatRupiah(totals.depositAmount));
      out = out.replace(/\{sisa\}/g, formatRupiah(totals.balanceAmount));
      out = out.replace(/\{bank\}/g, bank);
      out = out.replace(/\{rek\}/g, rek);
      out = out.replace(/\{atas_nama\}/g, atasNama);
      out = out.replace(/\{tanggal\}/g, order.date);
      out = out.replace(/\{metode\}/g, metode);
      out = out.replace(/\{signature\}/g, sig);
      return out;
    }

    /* --- Render Studio Pulse --- */
    function renderPulse() {
      let todayCount = 0;
      let lateCount = 0;
      let workingCount = 0;
      let unpaidCount = 0;
      let readyCount = 0;
      let dpActiveCount = 0;
      let todayStems = 0;

      state.orders.forEach(o => {
        if (o.phase === 'Delivered') return;
        const d = daysUntil(o.date);
        if (d < 0) lateCount++;
        else if (d === 0) {
          todayCount++;
          // Tally stems for pulse
          o.items.forEach(it => {
            if (it.type === 'stem') todayStems += it.qty;
            else if (it.type === 'package') todayStems += (CATALOG.packages[Number(it.id)]?.stems || 3) * it.qty;
            else if (it.type === 'custom') {
              let c = 0;
              Object.keys(it.stems || {}).forEach(k => c += it.stems[k]);
              todayStems += c * it.qty;
            }
          });
        }

        if (o.payment !== 'Paid') unpaidCount++;
        if (o.paymentPlan === 'Deposit 50%') dpActiveCount++;
        if (o.phase === 'Assembly and packing') workingCount++;
        if (o.phase === 'Ready for dispatch') readyCount++;
      });

      const pulseEl = document.getElementById('studio-pulse');
      pulseEl.innerHTML = `
        <div class="pulse-card ${todayCount > 0 ? 'is-today' : ''}">
          <span class="pulse-num">${todayCount}</span>
          <div class="pulse-meta">
            <span class="pulse-label">Hari Ini</span>
            <span class="pulse-sub">Jatuh tempo</span>
          </div>
        </div>

        ${lateCount > 0 ? `
          <div class="pulse-card is-late">
            <span class="pulse-num">${lateCount}</span>
            <div class="pulse-meta">
              <span class="pulse-label">Terlambat</span>
              <span class="pulse-sub">Perlu prioritas</span>
            </div>
          </div>
        ` : ''}

        <div class="pulse-card ${workingCount > 0 ? 'is-working' : ''}">
          <span class="pulse-num">${workingCount}</span>
          <div class="pulse-meta">
            <span class="pulse-label">Sedang Dibuat</span>
            <span class="pulse-sub">Di meja kerja</span>
          </div>
        </div>

        <div class="pulse-card">
          <span class="pulse-num">${unpaidCount}</span>
          <div class="pulse-meta">
            <span class="pulse-label">Menunggu Bayar</span>
            <span class="pulse-sub">Belum lunas / DP</span>
          </div>
        </div>

        <div class="pulse-card">
          <span class="pulse-num">${dpActiveCount}</span>
          <div class="pulse-meta">
            <span class="pulse-label">Skema DP 50%</span>
            <span class="pulse-sub">Uang muka aktif</span>
          </div>
        </div>

        <!-- Pulse Card for Batch Material Prep -->
        <div class="pulse-card is-prep-card is-clickable" id="pulse-btn-batch-prep" title="Buka Ringkasan Kebutuhan Bahan Hari Ini">
          <span class="pulse-num">${todayStems}</span>
          <div class="pulse-meta">
            <span class="pulse-label">Bahan Hari Ini</span>
            <span class="pulse-sub">Tangkai disiapkan ➔</span>
          </div>
        </div>
      `;

      const pBtn = document.getElementById('pulse-btn-batch-prep');
      if (pBtn) pBtn.onclick = () => openBatchPrepModal();
    }

    function renderLanes() {
      const chipsEl = document.getElementById('lane-chips');
      const lanes = [
        { key: 'all', label: 'Semua' },
        { key: 'pay', label: 'Menunggu Bayar' },
        { key: 'dp', label: 'Pesanan DP' },
        { key: 'active', label: 'Perlu Dirangkai' },
        { key: 'ready', label: 'Siap Kirim' },
        { key: 'Delivered', label: 'Selesai' }
      ];

      chipsEl.innerHTML = lanes.map(l => {
        const count = state.orders.filter(o => {
          if (l.key === 'all') return true;
          if (l.key === 'pay') return o.payment !== 'Paid' && o.phase !== 'Delivered';
          if (l.key === 'dp') return o.paymentPlan === 'Deposit 50%' && o.phase !== 'Delivered';
          if (l.key === 'active') return (o.phase === 'Not started' || o.phase === 'Assembly and packing') && o.phase !== 'Delivered';
          if (l.key === 'ready') return o.phase === 'Ready for dispatch';
          if (l.key === 'Delivered') return o.phase === 'Delivered';
          return true;
        }).length;

        const isPressed = state.lane === l.key;
        return `
          <button type="button" class="chip-btn" data-lane="${l.key}" aria-pressed="${isPressed}">
            ${l.label} <span class="count">${count}</span>
          </button>
        `;
      }).join('');
    }

    function renderQueue() {
      const queueEl = document.getElementById('queue-pane');
      const query = (state.search || '').toLowerCase().trim();

      let filtered = state.orders.filter(o => {
        // Date filter if user clicked a calendar date
        if (state.selectedCalendarDate && o.date !== state.selectedCalendarDate) {
          return false;
        }

        // Lane filter
        if (state.lane === 'pay' && (o.payment === 'Paid' || o.phase === 'Delivered')) return false;
        if (state.lane === 'dp' && (o.paymentPlan !== 'Deposit 50%' || o.phase === 'Delivered')) return false;
        if (state.lane === 'active' && (o.phase !== 'Not started' && o.phase !== 'Assembly and packing')) return false;
        if (state.lane === 'ready' && o.phase !== 'Ready for dispatch') return false;
        if (state.lane === 'Delivered' && o.phase !== 'Delivered') return false;

        // Search query filter
        if (!matchesSearch(o, state.search)) return false;
        return true;
      });

      // Sorting
      filtered.sort((a, b) => {
        if (state.sort === 'newest') return a.submitted < b.submitted ? 1 : -1;
        if (state.sort === 'oldest') return a.submitted > b.submitted ? 1 : -1;
        return a.date > b.date ? 1 : -1;
      });

      let bannerHtml = '';
      if (state.selectedCalendarDate) {
        bannerHtml = `
          <div style="background: var(--pine-100); border: 1px solid var(--pine-500); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 12.5px; font-weight: 600; color: var(--pine-700);">
              📅 Filter Tanggal: <b>${state.selectedCalendarDate}</b> (${filtered.length} pesanan)
            </span>
            <button type="button" class="btn-secondary" id="btn-clear-date-filter" style="font-size: 11.5px; padding: 2px 8px;">
              ✕ Hapus Filter
            </button>
          </div>
        `;
      }

      if (filtered.length === 0) {
        queueEl.innerHTML = bannerHtml + `
          <div class="empty-queue">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
            <p style="font-weight: 600;">Tidak ada pesanan ditemukan</p>
            <p style="font-size: 12.5px; opacity: 0.7;">Coba ubah filter atau kata kunci pencarian.</p>
          </div>
        `;
        const clrBtn = document.getElementById('btn-clear-date-filter');
        if (clrBtn) clrBtn.onclick = () => {
          state.selectedCalendarDate = null;
          renderQueue();
        };
        return;
      }

      queueEl.innerHTML = bannerHtml + filtered.map(o => {
        const isSelected = o.ref === state.selectedRef;
        const d = daysUntil(o.date);
        let statusCls = '';
        if (o.phase === 'Delivered') statusCls = 'is-done';
        else if (d < 0) statusCls = 'is-late';
        else if (d === 0) statusCls = 'is-today';
        else if (o.phase !== 'Not started') statusCls = 'is-working';

        const wrapInfo = CATALOG.wraps[o.wrap] || { swatch: '#ccc', name: o.wrap };
        const recipes = getItemRecipeList(o);
        const summaryText = recipes.map(r => `${r.qty}× ${r.name}`).join(' · ');

        let payBadge = '';
        if (o.payment === 'Paid') {
          payBadge = '<span class="pill-tag pay-paid">Lunas</span>';
        } else if (o.paymentPlan === 'Deposit 50%') {
          if (o.payment === 'Deposit paid') payBadge = '<span class="pill-tag pay-dp">✓ DP 50% Diterima</span>';
          else if (o.payment === 'Checking deposit') payBadge = '<span class="pill-tag pay-check">Cek DP 50%</span>';
          else if (o.payment === 'Checking balance') payBadge = '<span class="pill-tag pay-check">Cek Pelunasan</span>';
          else payBadge = '<span class="pill-tag pay-unpaid">Belum DP</span>';
        } else {
          if (o.payment === 'Checking transfer') payBadge = '<span class="pill-tag pay-check">Perlu Dicek</span>';
          else payBadge = '<span class="pill-tag pay-unpaid">Belum Bayar</span>';
        }

        const currentPhaseObj = PHASES.find(p => p.key === o.phase) || { label: o.phase };

        return `
          <button type="button" class="order-card ${statusCls}" data-ref="${o.ref}" aria-selected="${isSelected}">
            <div class="card-top">
              <span class="card-ref">${o.ref}</span>
              <span class="badge-due">${formatRelativeDate(o.date)}</span>
            </div>
            <div class="card-buyer">${o.buyer}</div>
            <div class="card-summary">${summaryText}</div>
            <div class="card-meta-row">
              ${payBadge}
              <span class="pill-tag phase-active">${currentPhaseObj.label}</span>
              <span class="pill-tag">
                <span class="swatch-circle" style="background:${wrapInfo.swatch}"></span>
                ${wrapInfo.name}
              </span>
              ${o.card ? '<span class="pill-tag" title="Ada Kartu Ucapan">💌 Kartu</span>' : ''}
            </div>
          </button>
        `;
      }).join('');

      const clrBtn = document.getElementById('btn-clear-date-filter');
      if (clrBtn) clrBtn.onclick = () => {
        state.selectedCalendarDate = null;
        renderQueue();
      };
    }

    
  function matchesSearch(order, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var buyer = String((order && order.buyer) || '').toLowerCase();
    var ref = String((order && order.ref) || '').toLowerCase();
    return buyer.indexOf(q) !== -1 || ref.indexOf(q) !== -1;
  }

  function paymentBlock(o) {
    var pay = o.payment;
    if (pay === 'Paid') return '';

    const totals = computeTotals(o);
    const isDepositPlan = o.paymentPlan === 'Deposit 50%';
    const isDepositReceived = o.payment === 'Deposit paid' || o.payment === 'Checking balance';
    const isFullyPaid = false;

    return `
        <!-- 1. PEMBAYARAN & SISTEM DP -->
        <div class="ticket-block">
          <div class="block-title">
            <span>Pembayaran & Skema DP</span>
            <span style="font-family: var(--font-mono); font-size: 11px;">Status: <b>${o.payment}</b></span>
          </div>

          <div class="payment-box ${!isFullyPaid ? 'needs-attention' : ''}">
            <!-- Skema Switcher -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">
                Pilih Skema Pembayaran:
              </span>
              <div class="plan-switch-group">
                <button type="button" class="btn-plan ${!isDepositPlan ? 'active' : ''}" id="btn-plan-full">Bayar Penuh (100%)</button>
                <button type="button" class="btn-plan ${isDepositPlan ? 'active' : ''}" id="btn-plan-dp">DP 50% (Uang Muka)</button>
              </div>
            </div>

            <!-- Total display -->
            <div class="payment-main-row">
              <div class="amount-display">
                <span class="amount-val">${formatRupiah(totals.finalTotal)}</span>
                <span class="amount-lbl">Total keseluruhan pesanan</span>
              </div>
            </div>

            <div class="payment-breakdown">
              <span>Produk: <b>${formatRupiah(totals.product)}</b></span>
              ${totals.card > 0 ? `<span>· Kartu: <b>${formatRupiah(totals.card)}</b></span>` : ''}
              <span>· Ongkir: <b>${totals.shipping > 0 ? formatRupiah(totals.shipping) : 'Rp 0'}</b></span>
            </div>

            <!-- DP 50% Banner Card (jika DP aktif) -->
            ${isDepositPlan ? `
              <div class="dp-banner-card">
                <div class="dp-banner-cell">
                  <span class="dp-banner-label">Wajib DP 50% (Awal)</span>
                  <span class="dp-banner-val" style="color: #8E520A;">${formatRupiah(totals.depositAmount)}</span>
                  <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">
                    ${isDepositReceived || isFullyPaid ? '✓ DP Sudah Diterima' : '⏳ Belum Dibayar'}
                  </span>
                </div>
                <div class="dp-banner-cell">
                  <span class="dp-banner-label">Sisa Pelunasan (50%)</span>
                  <span class="dp-banner-val">${formatRupiah(totals.balanceAmount)}</span>
                  <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">
                    ${isFullyPaid ? '✓ Lunas Sepenuhnya' : (o.phase === 'Ready for dispatch' ? '⚠️ Wajib Lunas Sekarang' : 'Dibayar saat bunga siap kirim')}
                  </span>
                </div>
              </div>
            ` : ''}

            <!-- Input Ongkir -->
            <div class="ongkir-input-row">
              ${o.locationType === 'bali' ? `
                <span class="ongkir-hint">
                  ✓ <b>Ongkir Rp 0</b> — Pesanan area Bali. ${o.method === 'self_pickup' ? 'Pelanggan mengambil sendiri di studio.' : 'Ongkir Grab/Gojek dibayarkan pembeli langsung ke driver saat barang tiba.'}
                </span>
              ` : `
                <label for="inp-ship-fee">Biaya Ongkir (Rp):</label>
                <input type="number" id="inp-ship-fee" value="${o.shipping || ''}" placeholder="0" step="1000">
                <span class="ongkir-hint">
                  Kirim ke ${o.city || 'Luar Bali'}. Masukkan tarif ekspedisi; DP dan sisa pelunasan otomatis terhitung.
                </span>
              `}
            </div>

            <!-- Action Buttons for Payment / DP -->
            <div class="payment-actions-row">
              ${isDepositPlan ? `
                ${!isDepositReceived && !isFullyPaid ? `
                  <button type="button" class="btn-pay-confirm" id="btn-mark-dp-paid">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Tandai DP 50% Diterima (${formatRupiah(totals.depositAmount)})
                  </button>
                  <button type="button" class="btn-secondary" id="btn-check-dp">
                    Tandai DP Perlu Dicek
                  </button>
                ` : !isFullyPaid ? `
                  <span style="font-size: 13px; font-weight: 600; color: #2A6638; background: #E8F5EB; padding: 6px 12px; border-radius: var(--radius-pill);">
                    ✓ DP 50% Diterima — Rangkaian boleh dibuat
                  </span>
                  <button type="button" class="btn-pay-confirm" id="btn-mark-full-paid" style="background: #1B532C;">
                    Tandai Pelunasan Diterima (Lunas Total)
                  </button>
                  <button type="button" class="btn-secondary" id="btn-check-balance">
                    Tandai Pelunasan Perlu Dicek
                  </button>
                ` : `
                  <span style="font-size: 13px; font-weight: 700; color: #2A6638;">
                    ✓ Lunas Sepenuhnya (DP & Pelunasan Beres)
                  </span>
                  <button type="button" class="btn-secondary" id="btn-revert-pay" style="font-size: 12px;">
                    Ubah Status
                  </button>
                `}
              ` : `
                ${!isFullyPaid ? `
                  <button type="button" class="btn-pay-confirm" id="btn-mark-full-paid">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Tandai Lunas Penuh (${formatRupiah(totals.finalTotal)})
                  </button>
                  <button type="button" class="btn-secondary" id="btn-check-transfer">
                    Tandai Perlu Dicek
                  </button>
                ` : `
                  <span style="font-size: 13px; font-weight: 700; color: #2A6638;">
                    ✓ Pembayaran Lunas
                  </span>
                  <button type="button" class="btn-secondary" id="btn-revert-pay" style="font-size: 12px;">
                    Ubah Status
                  </button>
                `}
              `}
              
              <button type="button" class="btn-secondary" id="btn-copy-bill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Salin Rincian Rekening & Tagihan
              </button>
            </div>
          </div>
        </div>


    `;
  }

  function renderTicket() {
      const ticketEl = document.getElementById('ticket-pane');
      const order = state.orders.find(o => o.ref === state.selectedRef);

      if (!order) {
        ticketEl.innerHTML = `
          <div style="padding: 60px 20px; text-align: center; color: var(--text-muted);">
            <p style="font-size: 16px; font-weight: 600;">Pilih pesanan di sebelah kiri</p>
            <p style="font-size: 13px; opacity: 0.7;">Lembar kerja pembuat akan ditampilkan di sini.</p>
          </div>
        `;
        return;
      }

      const totals = computeTotals(order);
      const d = daysUntil(order.date);
      let headerCls = '';
      if (order.phase !== 'Delivered') {
        if (d < 0) headerCls = 'is-late';
        else if (d === 0) headerCls = 'is-today';
      }

      const wrapInfo = CATALOG.wraps[order.wrap] || { swatch: '#ccc', name: order.wrap, note: '' };
      const recipes = getItemRecipeList(order);
      const orderTicks = state.orderItemTicks[order.ref] || {};
      const completedCount = recipes.filter(r => orderTicks[r.key]).length;
      const progressPct = recipes.length > 0 ? Math.round((completedCount / recipes.length) * 100) : 0;

      const phaseIdx = PHASES.findIndex(p => p.key === order.phase);
      const nextPhase = PHASES[phaseIdx + 1];

      const cleanWa = (order.wa || '').replace(/[^0-9]/g, '');
      const isDepositPlan = order.paymentPlan === 'Deposit 50%';
      const isDepositReceived = order.payment === 'Deposit paid' || order.payment === 'Checking balance';
      const isFullyPaid = order.payment === 'Paid';

      ticketEl.innerHTML = `
        <button type="button" class="ticket-mobile-back" id="btn-mobile-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Kembali ke Antrean Pesanan
        </button>

        <!-- Ticket Header -->
        <div class="ticket-header ${headerCls}">
          <div class="buyer-info">
            <div style="font-family: var(--font-mono); font-size: 12px; color: var(--text-faint); margin-bottom: 2px;">
              ${order.ref} · Masuk ${order.submitted}
            </div>
            <h2>${order.buyer}</h2>
            <div class="buyer-links">
              <a class="wa-link" href="https://wa.me/${cleanWa}" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                Chat WhatsApp (${order.wa})
              </a>
              <span style="color: var(--text-muted);">
                ${order.locationType === 'bali' 
                  ? `🛵 Bali (${order.regency}) · ${order.method === 'self_pickup' ? 'Ambil Sendiri' : 'Grab/Gojek'}`
                  : `📦 Ekspedisi ke ${order.city || 'Luar Bali'}`}
              </span>
            </div>
          </div>

          <div class="ticket-badges">
            <div class="due-headline">${order.date}</div>
            <div class="due-relative">${formatRelativeDate(order.date)}</div>
          </div>
        </div>

        <div class="ticket-body">
          ${paymentBlock(order)}

        <!-- 2. WHATSAPP ASSISTANT (Connected to Template Settings) -->
        <div class="ticket-block">
          <div class="block-title">
            <span>WhatsApp Assistant (Pesan Cepat ke Pembeli)</span>
            <span style="font-size: 11px; color: var(--text-faint);">1-Klik Buka WA / Format Kustom</span>
          </div>

          <div class="wa-templates-grid">
            <button type="button" class="wa-card-btn" id="wa-btn-rek">
              <svg class="wa-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              <div>
                <span class="wa-card-title">1. ${isDepositPlan ? 'Tagihan DP 50%' : 'Rincian Rekening'}</span>
                <span class="wa-card-desc">${isDepositPlan ? `Tagih DP 50% sebesar ${formatRupiah(totals.depositAmount)}.` : 'Kirim nominal total & no rek studio.'}</span>
              </div>
            </button>

            <button type="button" class="wa-card-btn" id="wa-btn-paid">
              <svg class="wa-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <div>
                <span class="wa-card-title">2. ${isDepositPlan ? 'Konfirmasi DP Diterima' : 'Konfirmasi Bayar'}</span>
                <span class="wa-card-desc">Kabari uang masuk & pesanan mulai dirangkai.</span>
              </div>
            </button>

            <button type="button" class="wa-card-btn" id="wa-btn-ready">
              <svg class="wa-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <div>
                <span class="wa-card-title">3. ${isDepositPlan && !isFullyPaid ? 'Bunga Jadi + Tagih Sisa' : 'Bunga Selesai'}</span>
                <span class="wa-card-desc">${isDepositPlan && !isFullyPaid ? `Kabari bunga jadi & minta sisa ${formatRupiah(totals.balanceAmount)}.` : 'Kabari pesanan sudah jadi & siap difoto.'}</span>
              </div>
            </button>

            <button type="button" class="wa-card-btn" id="wa-btn-shipped">
              <svg class="wa-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <div>
                <span class="wa-card-title">4. Info Kirim / Driver</span>
                <span class="wa-card-desc">Kirim resi ekspedisi / info penjemputan Grab.</span>
              </div>
            </button>
          </div>
        </div>

        <!-- 3. YANG DIBUAT (Visual Recipe & Maker Checklist) -->
        <div class="ticket-block">
          <div class="block-title">
            <span>Yang Dibuat (${completedCount}/${recipes.length} Selesai)</span>
            <span style="font-family: var(--font-mono);">${progressPct}% Rapi</span>
          </div>

          <div class="craft-progress-bar">
            <div class="craft-progress-fill" style="width: ${progressPct}%;"></div>
          </div>

          <div class="craft-items-list">
            ${recipes.map(item => {
              const isChecked = !!orderTicks[item.key];
              return `
                <div class="craft-item-row ${isChecked ? 'is-done' : ''}" data-tick-item="${item.key}">
                  <div class="craft-checkbox">
                    ${isChecked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                  </div>
                  <div class="craft-thumb">
                    <img src="${item.img}" onerror="this.src='${item.fallbackImg}'" alt="${item.name}">
                  </div>
                  <div class="craft-details">
                    <div class="craft-title">
                      <span class="craft-qty-pill">${item.qty}×</span>
                      <span>${item.name}</span>
                    </div>
                    <div class="craft-spec">${item.spec}</div>
                    ${item.breakdown ? `<div class="craft-breakdown">${item.breakdown}</div>` : ''}
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-faint); font-weight: 600;">
                    ${isChecked ? 'SELESAI ✓' : 'KLIK CENTANG'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4. KERTAS BUNGKUS & PITA -->
        <div class="ticket-block">
          <div class="block-title">
            <span>Penyelesaian & Kertas Pembungkus</span>
          </div>

          <div class="wrap-card">
            <div class="wrap-swatch-large" style="background: ${wrapInfo.swatch};"></div>
            <div>
              <div class="wrap-name">Kertas ${wrapInfo.name}</div>
              <div class="wrap-desc">${wrapInfo.note || 'Bungkus rapi dengan pita senada.'}</div>
            </div>
          </div>
        </div>

        <!-- 5. KARTU UCAPAN (Handwriting Note Station) -->
        <div class="ticket-block">
          <div class="block-title">
            <span>Kartu Ucapan Pesanan</span>
            ${order.card ? `
              <button type="button" class="btn-secondary" id="btn-copy-card" style="padding: 4px 12px; font-size: 12px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Salin Teks Kartu
              </button>
            ` : ''}
          </div>

          ${order.card ? `
            <div class="card-stationery">
              <div class="card-message-text">“${order.card.text}”</div>
              <div class="card-meta-line">
                <div class="card-persons">
                  <span>Untuk: <b>${order.card.to || '-'}</b></span>
                  <span>Dari: <b>${order.card.from || '-'}</b></span>
                </div>
                <div style="font-size: 12px; font-style: italic; color: var(--text-faint);">
                  *Salin lalu tulis tangan di kartu studio
                </div>
              </div>
            </div>
          ` : `
            <div style="color: var(--text-muted); font-size: 13.5px; font-style: italic;">
              Tanpa kartu ucapan untuk pesanan ini.
            </div>
          `}
        </div>

        <!-- 6. TAHAP KERJA (Stepper with Gate Rules) -->
        <div class="ticket-block">
          <div class="block-title">
            <span>Tahap Pengerjaan</span>
            <span style="color: var(--pine-700); font-weight: 700;">${PHASES[phaseIdx].label}</span>
          </div>

          <div class="stepper-container">
            <div class="stepper-track">
              ${PHASES.map((p, i) => {
                let nodeCls = '';
                if (i < phaseIdx) nodeCls = 'completed';
                else if (i === phaseIdx) nodeCls = 'current';
                return `
                  <div class="step-node ${nodeCls}">
                    <div class="step-bar"></div>
                    <span class="step-label">${p.label}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="stepper-actions">
              ${nextPhase ? `
                <button type="button" class="btn-advance-phase" id="btn-advance-phase">
                  <span>Lanjut ke: <b>${nextPhase.label}</b></span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ` : `
                <span style="font-weight: 700; color: var(--pine-700); font-size: 14px;">
                  🎉 Pesanan Selesai Seluruhnya!
                </span>
              `}

              ${phaseIdx > 0 ? `
                <button type="button" class="btn-secondary" id="btn-retreat-phase" style="font-size: 12.5px;">
                  ← Mundur ke tahap sebelumnya
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- 7. CATATAN INTERNAL -->
        <div class="ticket-block">
          <div class="block-title">
            <span>Catatan Khusus Studio</span>
            <span style="font-size: 11px; color: var(--text-faint);">Otomatis Tersimpan</span>
          </div>

          <textarea class="notes-box" id="ticket-notes" placeholder="Tulis catatan bahan, permintaan warna pita khusus pembeli, atau kendala...">${order.notes || ''}</textarea>
        </div>
      </div>
      `;

      attachTicketListeners(order);
    }

    function attachTicketListeners(order) {
      const cleanWa = (order.wa || '').replace(/[^0-9]/g, '');
      const totals = computeTotals(order);
      const isDepositPlan = order.paymentPlan === 'Deposit 50%';

      // Mobile back
      const btnBack = document.getElementById('btn-mobile-back');
      if (btnBack) {
        btnBack.onclick = () => {
          document.getElementById('desk-layout').classList.remove('view-detail');
          document.body.classList.remove('view-detail-mode');
        };
      }

      // Check off recipe items
      document.querySelectorAll('[data-tick-item]').forEach(el => {
        el.onclick = () => {
          const key = el.getAttribute('data-tick-item');
          if (!state.orderItemTicks[order.ref]) state.orderItemTicks[order.ref] = {};
          state.orderItemTicks[order.ref][key] = !state.orderItemTicks[order.ref][key];
          saveState();
          renderTicket();
        };
      });

      // Switch Payment Plan (Full vs Deposit 50%)
      const btnPlanFull = document.getElementById('btn-plan-full');
      if (btnPlanFull) {
        btnPlanFull.onclick = () => {
          updateOrderField(order.ref, 'paymentPlan', 'Full', 'Skema pembayaran: Bayar Penuh');
        };
      }
      const btnPlanDp = document.getElementById('btn-plan-dp');
      if (btnPlanDp) {
        btnPlanDp.onclick = () => {
          updateOrderField(order.ref, 'paymentPlan', 'Deposit 50%', 'Skema pembayaran: DP 50%');
        };
      }

      // Mark DP Paid
      const btnMarkDp = document.getElementById('btn-mark-dp-paid');
      if (btnMarkDp) {
        btnMarkDp.onclick = () => {
          const confirmed = confirm(
            `Konfirmasi Pembayaran DP 50%?\n\n` +
            `Pastikan uang muka sebesar ${formatRupiah(totals.depositAmount)} telah masuk ke rekening:\n` +
            `${state.settings.bank} ${state.settings.accNumber} a.n. ${state.settings.accHolder}\n\n` +
            `⚠️ Periksa mutasi m-banking Anda, jangan hanya dari screenshot pembeli.`
          );
          if (confirmed) {
            updateOrderField(order.ref, 'payment', 'Deposit paid', 'DP 50% Diterima ✓');
          }
        };
      }

      // Mark Checking DP
      const btnCheckDp = document.getElementById('btn-check-dp');
      if (btnCheckDp) {
        btnCheckDp.onclick = () => {
          updateOrderField(order.ref, 'payment', 'Checking deposit', 'Status: DP perlu dicek di mutasi');
        };
      }

      // Mark Full Paid (Lunas)
      const btnFullPaid = document.getElementById('btn-mark-full-paid');
      if (btnFullPaid) {
        btnFullPaid.onclick = () => {
          const toPay = isDepositPlan ? totals.balanceAmount : totals.finalTotal;
          const confirmed = confirm(
            `Konfirmasi Pembayaran Lunas?\n\n` +
            `Pastikan dana pelunasan sebesar ${formatRupiah(toPay)} telah masuk ke rekening:\n` +
            `${state.settings.bank} ${state.settings.accNumber} a.n. ${state.settings.accHolder}\n\n` +
            `⚠️ Periksa mutasi rekening Anda.`
          );
          if (confirmed) {
            updateOrderField(order.ref, 'payment', 'Paid', 'Pesanan Lunas Sepenuhnya ✓');
          }
        };
      }

      // Mark Checking Balance
      const btnCheckBalance = document.getElementById('btn-check-balance');
      if (btnCheckBalance) {
        btnCheckBalance.onclick = () => {
          updateOrderField(order.ref, 'payment', 'Checking balance', 'Status: Pelunasan perlu dicek di mutasi');
        };
      }

      // Mark Checking Transfer
      const btnCheckTransfer = document.getElementById('btn-check-transfer');
      if (btnCheckTransfer) {
        btnCheckTransfer.onclick = () => {
          updateOrderField(order.ref, 'payment', 'Checking transfer', 'Status: Transfer perlu dicek');
        };
      }

      // Revert Payment
      const btnRevert = document.getElementById('btn-revert-pay');
      if (btnRevert) {
        btnRevert.onclick = () => {
          const nextPay = isDepositPlan ? 'Deposit paid' : 'Unpaid';
          updateOrderField(order.ref, 'payment', nextPay, 'Status pembayaran diubah');
        };
      }

      // Advance Phase (With strict DP Dispatch Gate Check)
      const btnAdvance = document.getElementById('btn-advance-phase');
      if (btnAdvance) {
        btnAdvance.onclick = () => {
          const pIdx = PHASES.findIndex(p => p.key === order.phase);
          const nextTarget = PHASES[pIdx + 1];
          if (!nextTarget) return;

          // Production Gate: can only start if Paid OR Deposit paid
          if (nextTarget.key === 'Assembly and packing' && order.payment === 'Unpaid') {
            const proceed = confirm(
              'Perhatian: Pembeli belum membayar uang muka (DP) atau lunas.\n\nYakin ingin mulai merangkai bunga sekarang sebelum ada pembayaran?'
            );
            if (!proceed) return;
          }

          // Dispatch Gate: MUST be Paid before shipping!
          if ((nextTarget.key === 'Shipped' || nextTarget.key === 'Delivered') && order.payment !== 'Paid') {
            alert(
              `⚠️ Pelunasan Belum Diterima!\n\n` +
              `Pesanan ini memiliki skema ${order.paymentPlan} dan belum Lunas.\n` +
              `Sisa pelunasan sebesar ${formatRupiah(totals.balanceAmount)} harus diterima sebelum pesanan diserahkan ke kurir / dikirim.`
            );
            return;
          }

          order.phase = nextTarget.key;
          saveState();
          showToast(`Tahap diubah: ${nextTarget.label}`);
          renderAll();
        };
      }

      // Retreat Phase
      const btnRetreat = document.getElementById('btn-retreat-phase');
      if (btnRetreat) {
        btnRetreat.onclick = () => {
          const pIdx = PHASES.findIndex(p => p.key === order.phase);
          if (pIdx > 0) {
            order.phase = PHASES[pIdx - 1].key;
            saveState();
            showToast(`Mundur ke: ${PHASES[pIdx - 1].label}`);
            renderAll();
          }
        };
      }

      // Shipping input change
      const inpShip = document.getElementById('inp-ship-fee');
      if (inpShip) {
        inpShip.onchange = () => {
          order.shipping = Math.max(0, Number(inpShip.value || 0));
          saveState();
          showToast('Ongkir diperbarui, DP & sisa dihitung ulang');
          renderTicket();
        };
      }

      // Internal notes auto-save
      const notesEl = document.getElementById('ticket-notes');
      if (notesEl) {
        notesEl.onchange = () => {
          order.notes = notesEl.value;
          saveState();
          showToast('Catatan tersimpan');
        };
      }

      // Copy bill text (Customized for DP or Full)
      const btnCopyBill = document.getElementById('btn-copy-bill');
      if (btnCopyBill) {
        btnCopyBill.onclick = () => {
          const msg = renderWaMessage(state.settings.templates.rek, order);
          navigator.clipboard.writeText(msg).then(() => showToast('Teks info rekening tersalin!'));
        };
      }

      // Copy card text
      const btnCopyCard = document.getElementById('btn-copy-card');
      if (btnCopyCard && order.card) {
        btnCopyCard.onclick = () => {
          const cardText = `${order.card.text}\n\n— Untuk: ${order.card.to || ''}\n— Dari: ${order.card.from || ''}`;
          navigator.clipboard.writeText(cardText).then(() => showToast('Teks kartu ucapan tersalin!'));
        };
      }

      // WA Template 1: Rekening / DP
      const waRek = document.getElementById('wa-btn-rek');
      if (waRek) {
        waRek.onclick = () => {
          const msg = renderWaMessage(state.settings.templates.rek, order);
          window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }

      // WA Template 2: Paid / DP Received
      const waPaid = document.getElementById('wa-btn-paid');
      if (waPaid) {
        waPaid.onclick = () => {
          const msg = renderWaMessage(state.settings.templates.paid, order);
          window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }

      // WA Template 3: Ready / Sisa Pelunasan
      const waReady = document.getElementById('wa-btn-ready');
      if (waReady) {
        waReady.onclick = () => {
          const msg = renderWaMessage(state.settings.templates.ready, order);
          window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }

      // WA Template 4: Shipped
      const waShipped = document.getElementById('wa-btn-shipped');
      if (waShipped) {
        waShipped.onclick = () => {
          const msg = renderWaMessage(state.settings.templates.shipped, order);
          window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
    }

    /* =========================================================================
       CALENDAR VIEW LOGIC & RENDERING
       ========================================================================= */
    const MONTH_NAMES = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    function renderCalendar() {
      const year = state.calendarYear;
      const month = state.calendarMonth;
      const heading = document.getElementById('cal-month-heading');
      if (heading) heading.textContent = `${MONTH_NAMES[month]} ${year}`;

      const gridEl = document.getElementById('calendar-grid');
      if (!gridEl) return;

      // 1. Column headers
      let gridHtml = DAY_NAMES.map(d => `<div class="cal-col-head">${d}</div>`).join('');

      // 2. Month calculation
      const firstDayOfMonth = new Date(year, month, 1);
      // JS getDay(): 0 is Sunday, convert to Monday = 0
      let startDayOfWeek = firstDayOfMonth.getDay() - 1;
      if (startDayOfWeek === -1) startDayOfWeek = 6;

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrevMonth = new Date(year, month, 0).getDate();

      // Pad previous month days
      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dNum = daysInPrevMonth - i;
        gridHtml += `
          <div class="cal-day-cell other-month">
            <span class="cal-day-num">${dNum}</span>
          </div>
        `;
      }

      // Current month days
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === TODAY;
        const isSelected = dateStr === state.selectedCalendarDate;

        // Find orders for this date
        const ordersOnDate = state.orders.filter(o => o.date === dateStr);
        const count = ordersOnDate.length;

        let capacityBadge = '';
        if (count > 0) {
          if (count === 1) capacityBadge = '<span class="cal-capacity-badge capacity-green">🟢 1 Pesanan</span>';
          else if (count === 2) capacityBadge = '<span class="cal-capacity-badge capacity-yellow">🟡 2 Pesanan</span>';
          else capacityBadge = `<span class="cal-capacity-badge capacity-red">🔴 ${count} Pesanan (Padat)</span>`;
        }

        const pillsHtml = ordersOnDate.slice(0, 3).map(o => {
          const wrapSwatch = CATALOG.wraps[o.wrap]?.swatch || '#ccc';
          const pStatus = o.payment === 'Paid' ? 'paid' : (o.paymentPlan === 'Deposit 50%' ? 'dp' : 'unpaid');
          const firstName = o.buyer.split(' ')[0];
          return `
            <div class="cal-order-pill ${pStatus}" title="${o.ref} - ${o.buyer}">
              <span class="swatch-circle" style="background: ${wrapSwatch}; width: 6px; height: 6px;"></span>
              <span>${firstName}</span>
            </div>
          `;
        }).join('');

        const moreCount = ordersOnDate.length - 3;
        const moreHtml = moreCount > 0 ? `<span style="font-size: 10px; color: var(--text-faint);">+${moreCount} lagi...</span>` : '';

        gridHtml += `
          <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected-date' : ''} ${count > 0 ? 'has-orders' : ''}" data-cal-date="${dateStr}">
            <div class="cal-day-top">
              <span class="cal-day-num">${d}</span>
              ${isToday ? '<span class="cal-today-badge">Hari Ini</span>' : ''}
            </div>
            <div class="cal-orders-stack">
              ${pillsHtml}
              ${moreHtml}
            </div>
            ${capacityBadge}
          </div>
        `;
      }

      // Pad remaining cells to complete grid row (multiple of 7)
      const totalCells = startDayOfWeek + daysInMonth;
      const remaining = (7 - (totalCells % 7)) % 7;
      for (let j = 1; j <= remaining; j++) {
        gridHtml += `
          <div class="cal-day-cell other-month">
            <span class="cal-day-num">${j}</span>
          </div>
        `;
      }

      gridEl.innerHTML = gridHtml;

      // Attach click events on day cells
      gridEl.querySelectorAll('[data-cal-date]').forEach(cell => {
        cell.onclick = () => {
          const dateStr = cell.getAttribute('data-cal-date');
          selectCalendarDate(dateStr);
        };
      });

      // Render agenda drawer if a date is selected
      renderCalendarAgenda();
    }

    function selectCalendarDate(dateStr) {
      if (state.selectedCalendarDate === dateStr) {
        // toggle off
        state.selectedCalendarDate = null;
      } else {
        state.selectedCalendarDate = dateStr;
      }
      renderCalendar();
    }

    function renderCalendarAgenda() {
      const drawer = document.getElementById('cal-agenda-drawer');
      const label = document.getElementById('cal-agenda-date-label');
      const grid = document.getElementById('cal-agenda-grid');
      if (!drawer || !grid) return;

      if (!state.selectedCalendarDate) {
        drawer.classList.remove('active');
        return;
      }

      const ordersOnDate = state.orders.filter(o => o.date === state.selectedCalendarDate);
      label.textContent = `📅 Jadwal Kerja Tanggal: ${state.selectedCalendarDate} (${ordersOnDate.length} Pesanan)`;
      drawer.classList.add('active');

      if (ordersOnDate.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-muted); font-size: 13.5px;">
            Tidak ada pesanan yang jatuh tempo pada tanggal ini.
          </div>
        `;
        return;
      }

      grid.innerHTML = ordersOnDate.map(o => {
        const wrapInfo = CATALOG.wraps[o.wrap] || { swatch: '#ccc', name: o.wrap };
        const recipes = getItemRecipeList(o);
        const summary = recipes.map(r => `${r.qty}× ${r.name}`).join(' · ');
        const totals = computeTotals(o);

        return `
          <div class="order-card" style="margin: 0;">
            <div class="card-top">
              <span class="card-ref">${o.ref}</span>
              <span class="pill-tag phase-active">${o.phase}</span>
            </div>
            <div class="card-buyer">${o.buyer}</div>
            <div class="card-summary">${summary}</div>
            <div style="font-size: 12px; font-family: var(--font-mono); color: var(--pine-700); font-weight: 700;">
              ${formatRupiah(totals.finalTotal)} · ${o.paymentPlan} (${o.payment})
            </div>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <button type="button" class="btn-secondary" style="font-size: 12px; padding: 4px 10px; width: 100%; justify-content: center;" onclick="openOrderInQueue('${o.ref}')">
                Buka di Meja Kerja ➔
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    function openOrderInQueue(ref) {
      state.selectedRef = ref;
      switchViewMode('queue');
      document.getElementById('desk-layout').classList.add('view-detail');
      document.body.classList.add('view-detail-mode');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderTicket();
    }

    function switchViewMode(mode) {
      state.viewMode = mode;
      document.getElementById('desk-layout').classList.remove('view-detail');
      document.body.classList.remove('view-detail-mode');
      const qTab = document.getElementById('tab-view-queue');
      const cTab = document.getElementById('tab-view-calendar');
      const deskLayout = document.getElementById('desk-layout');
      const calView = document.getElementById('calendar-view');
      const searchControls = document.getElementById('search-sort-controls');
      const laneChips = document.getElementById('lane-chips');

      if (mode === 'calendar') {
        qTab.classList.remove('active');
        cTab.classList.add('active');
        deskLayout.style.display = 'none';
        calView.style.display = 'block';
        searchControls.style.display = 'none';
        laneChips.style.display = 'none';
        renderCalendar();
      } else {
        cTab.classList.remove('active');
        qTab.classList.add('active');
        deskLayout.style.display = 'grid';
        calView.style.display = 'none';
        searchControls.style.display = 'flex';
        laneChips.style.display = 'flex';
        renderQueue();
        renderTicket();
      }
    }

    /* =========================================================================
       RINGKASAN KEBUTUHAN BAHAN (BATCH PREP / MATERIAL ROLLUP)
       ========================================================================= */
    function calculateBatchPrep(scope) {
      let targetOrders = state.orders.filter(o => o.phase !== 'Delivered');

      if (scope === 'today') {
        targetOrders = targetOrders.filter(o => o.date === TODAY);
      } else if (scope === 'tomorrow') {
        const tom = new Date(TODAY);
        tom.setDate(tom.getDate() + 1);
        const tomStr = tom.toISOString().split('T')[0];
        targetOrders = targetOrders.filter(o => o.date === tomStr);
      } else if (scope === '3days') {
        const d3 = new Date(TODAY);
        d3.setDate(d3.getDate() + 3);
        const d3Str = d3.toISOString().split('T')[0];
        targetOrders = targetOrders.filter(o => o.date >= TODAY && o.date <= d3Str);
      } // 'all' keeps all active unfinished orders

      const flowers = { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 };
      const additions = { rounded: 0, fern: 0 };
      const pots = { sunflower: 0, 'lily-of-the-valley': 0, daisy: 0 };
      const wraps = { kraft: 0, cream: 0, sage: 0, blush: 0 };
      let cardsCount = 0;

      targetOrders.forEach(order => {
        // Tally wraps
        if (order.wrap && wraps[order.wrap] !== undefined) {
          wraps[order.wrap]++;
        }

        // Tally cards
        if (order.card) cardsCount++;

        // Tally items
        order.items.forEach(it => {
          if (it.type === 'stem') {
            if (flowers[it.id] !== undefined) flowers[it.id] += it.qty;
          } else if (it.type === 'pot') {
            if (pots[it.id] !== undefined) pots[it.id] += it.qty;
          } else if (it.type === 'package') {
            const pkg = CATALOG.packages[Number(it.id)];
            if (pkg) {
              // Standard studio package combination (e.g. mixed Sunflower & Rose)
              flowers.Sunflower += Math.ceil(pkg.stems / 2) * it.qty;
              flowers.Rose += Math.floor(pkg.stems / 2) * it.qty;
            }
          } else if (it.type === 'custom') {
            Object.keys(it.stems || {}).forEach(k => {
              if (flowers[k] !== undefined) flowers[k] += (it.stems[k] || 0) * it.qty;
            });
            Object.keys(it.additions || {}).forEach(k => {
              if (additions[k] !== undefined) additions[k] += (it.additions[k] || 0) * it.qty;
            });
          }
        });
      });

      return {
        orderCount: targetOrders.length,
        flowers,
        additions,
        pots,
        wraps,
        cardsCount
      };
    }

    function openBatchPrepModal() {
      const modal = document.getElementById('modal-batch-prep');
      renderBatchPrepContent();
      modal.showModal();
    }

    function renderBatchPrepContent() {
      const scope = state.prepScope || 'today';
      const rollup = calculateBatchPrep(scope);

      // Summary banner
      const banner = document.getElementById('prep-summary-banner');
      let scopeLabel = 'Hari Ini (14 Sep 2026)';
      if (scope === 'tomorrow') scopeLabel = 'Besok (15 Sep 2026)';
      else if (scope === '3days') scopeLabel = '3 Hari Ke Depan (14 - 16 Sep 2026)';
      else if (scope === 'all') scopeLabel = 'Semua Pesanan Aktif di Antrean';

      banner.innerHTML = `
        Menampilkan kebutuhan bahan untuk <b>${rollup.orderCount} pesanan</b> (${scopeLabel}). Centang kotak saat bunga/bahan sudah ditaruh di meja.
      `;

      // Render Categories
      const container = document.getElementById('prep-categories-container');
      let html = '';

      // 1. Bunga Utama
      html += `
        <div class="prep-section-title">
          <span>1. Bunga Utama (Stems)</span>
          <span>Total Tangkai</span>
        </div>
        <div class="prep-grid">
      `;
      Object.keys(rollup.flowers).forEach(k => {
        const count = rollup.flowers[k];
        if (count === 0) return;
        const fl = CATALOG.flowers[k];
        const isChecked = !!state.prepChecklist[`${scope}_flower_${k}`];
        html += `
          <div class="prep-item-card ${isChecked ? 'is-checked' : ''}" data-prep-toggle="${scope}_flower_${k}">
            <div class="craft-checkbox">
              ${isChecked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
            <div class="prep-thumb"><img src="${fl.img}" onerror="this.src='${fl.fallbackImg}'" alt="${fl.name}"></div>
            <div class="prep-info">
              <div class="prep-name">${fl.name}</div>
              <div class="prep-detail">${fl.spec}</div>
            </div>
            <span class="prep-qty-pill">${count} Tangkai</span>
          </div>
        `;
      });
      html += `</div>`;

      // 2. Daun Tambahan
      const hasAdditions = Object.values(rollup.additions).some(c => c > 0);
      if (hasAdditions) {
        html += `
          <div class="prep-section-title" style="margin-top: 16px;">
            <span>2. Daun & Ranting Tambahan</span>
            <span>Jumlah Tangkai</span>
          </div>
          <div class="prep-grid">
        `;
        Object.keys(rollup.additions).forEach(k => {
          const count = rollup.additions[k];
          if (count === 0) return;
          const ad = CATALOG.additions[k];
          const isChecked = !!state.prepChecklist[`${scope}_add_${k}`];
          html += `
            <div class="prep-item-card ${isChecked ? 'is-checked' : ''}" data-prep-toggle="${scope}_add_${k}">
              <div class="craft-checkbox">
                ${isChecked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
              <div class="prep-thumb"><img src="${ad.img}" onerror="this.src='${ad.fallbackImg}'" alt="${ad.name}"></div>
              <div class="prep-info">
                <div class="prep-name">${ad.name}</div>
                <div class="prep-detail">${ad.spec}</div>
              </div>
              <span class="prep-qty-pill">${count} Tangkai</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // 3. Mini Pot
      const hasPots = Object.values(rollup.pots).some(c => c > 0);
      if (hasPots) {
        html += `
          <div class="prep-section-title" style="margin-top: 16px;">
            <span>3. Mini Pot Crochet</span>
            <span>Jumlah Pot</span>
          </div>
          <div class="prep-grid">
        `;
        Object.keys(rollup.pots).forEach(k => {
          const count = rollup.pots[k];
          if (count === 0) return;
          const pt = CATALOG.pots[k];
          const isChecked = !!state.prepChecklist[`${scope}_pot_${k}`];
          html += `
            <div class="prep-item-card ${isChecked ? 'is-checked' : ''}" data-prep-toggle="${scope}_pot_${k}">
              <div class="craft-checkbox">
                ${isChecked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
              <div class="prep-thumb"><img src="${pt.img}" onerror="this.src='${pt.fallbackImg}'" alt="${pt.name}"></div>
              <div class="prep-info">
                <div class="prep-name">${pt.name}</div>
                <div class="prep-detail">${pt.spec}</div>
              </div>
              <span class="prep-qty-pill">${count} Pot</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // 4. Kertas Pembungkus & Kartu
      html += `
        <div class="prep-section-title" style="margin-top: 16px;">
          <span>4. Kertas Pembungkus (Wrap) & Kartu</span>
          <span>Kebutuhan</span>
        </div>
        <div class="prep-grid">
      `;
      Object.keys(rollup.wraps).forEach(k => {
        const count = rollup.wraps[k];
        if (count === 0) return;
        const wr = CATALOG.wraps[k];
        const isChecked = !!state.prepChecklist[`${scope}_wrap_${k}`];
        html += `
          <div class="prep-item-card ${isChecked ? 'is-checked' : ''}" data-prep-toggle="${scope}_wrap_${k}">
            <div class="craft-checkbox">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="prep-thumb" style="background:${wr.swatch}; border: 1px solid rgba(0,0,0,0.2);"></div>
            <div class="prep-info">
              <div class="prep-name">Kertas ${wr.name}</div>
              <div class="prep-detail">${wr.note}</div>
            </div>
            <span class="prep-qty-pill">${count} Lembar</span>
          </div>
        `;
      });

      if (rollup.cardsCount > 0) {
        const isCardChecked = !!state.prepChecklist[`${scope}_cards`];
        html += `
          <div class="prep-item-card ${isCardChecked ? 'is-checked' : ''}" data-prep-toggle="${scope}_cards">
            <div class="craft-checkbox">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="prep-thumb" style="display:flex; align-items:center; justify-content:center; font-size:20px; background:#FFFDF9;">💌</div>
            <div class="prep-info">
              <div class="prep-name">Kartu Ucapan Studio</div>
              <div class="prep-detail">Tulis tangan rapi dengan tinta hitam</div>
            </div>
            <span class="prep-qty-pill">${rollup.cardsCount} Kartu</span>
          </div>
        `;
      }
      html += `</div>`;

      container.innerHTML = html;

      // Attach item checklist toggle events
      container.querySelectorAll('[data-prep-toggle]').forEach(card => {
        card.onclick = () => {
          const key = card.getAttribute('data-prep-toggle');
          state.prepChecklist[key] = !state.prepChecklist[key];
          saveState();
          renderBatchPrepContent();
        };
      });
    }

    function initBatchPrepEvents() {
      const openBtn = document.getElementById('btn-open-batch-prep');
      const closeBtn = document.getElementById('btn-close-prep-modal');
      const doneBtn = document.getElementById('btn-done-prep');
      const copyBtn = document.getElementById('btn-copy-prep-text');
      const modal = document.getElementById('modal-batch-prep');

      if (openBtn) openBtn.onclick = openBatchPrepModal;
      if (closeBtn) closeBtn.onclick = () => modal.close();
      if (doneBtn) doneBtn.onclick = () => modal.close();

      // Scope button clicks
      const scopeNav = document.getElementById('prep-scope-nav');
      if (scopeNav) {
        scopeNav.onclick = e => {
          const btn = e.target.closest('[data-scope]');
          if (!btn) return;
          state.prepScope = btn.getAttribute('data-scope');
          scopeNav.querySelectorAll('.prep-scope-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderBatchPrepContent();
        };
      }

      // Copy plain text rollup
      if (copyBtn) {
        copyBtn.onclick = () => {
          const scope = state.prepScope || 'today';
          const rollup = calculateBatchPrep(scope);
          let txt = `📦 KEBUTUHAN BAHAN ALXANTHIA (${scope.toUpperCase()})\n`;
          txt += `Jumlah Pesanan: ${rollup.orderCount}\n\n`;
          txt += `*Bunga Utama:*\n`;
          Object.keys(rollup.flowers).forEach(k => {
            if (rollup.flowers[k] > 0) txt += `• ${rollup.flowers[k]}× ${CATALOG.flowers[k].name}\n`;
          });
          if (Object.values(rollup.additions).some(c => c > 0)) {
            txt += `\n*Daun Tambahan:*\n`;
            Object.keys(rollup.additions).forEach(k => {
              if (rollup.additions[k] > 0) txt += `• ${rollup.additions[k]}× ${CATALOG.additions[k].name}\n`;
            });
          }
          if (Object.values(rollup.pots).some(c => c > 0)) {
            txt += `\n*Mini Pot:*\n`;
            Object.keys(rollup.pots).forEach(k => {
              if (rollup.pots[k] > 0) txt += `• ${rollup.pots[k]}× ${CATALOG.pots[k].name}\n`;
            });
          }
          txt += `\n*Kertas Pembungkus:*\n`;
          Object.keys(rollup.wraps).forEach(k => {
            if (rollup.wraps[k] > 0) txt += `• ${rollup.wraps[k]}× Kertas ${CATALOG.wraps[k].name}\n`;
          });
          if (rollup.cardsCount > 0) {
            txt += `• ${rollup.cardsCount}× Kartu Ucapan\n`;
          }

          navigator.clipboard.writeText(txt).then(() => showToast('Ringkasan bahan disalin ke clipboard!'));
        };
      }
    }

    /* =========================================================================
       SETTINGS & WHATSAPP TEMPLATE EDITOR
       ========================================================================= */
    let currentEditingTemplateKey = 'rek';

    function initSettingsModalEvents() {
      const openBtn = document.getElementById('btn-open-settings');
      const closeBtn = document.getElementById('btn-close-settings-modal');
      const cancelBtn = document.getElementById('btn-cancel-settings');
      const saveBtn = document.getElementById('btn-save-settings');
      const resetBtn = document.getElementById('btn-reset-settings');
      const modal = document.getElementById('modal-settings');

      if (openBtn) {
        openBtn.onclick = () => {
          populateSettingsForm();
          modal.showModal();
        };
      }
      if (closeBtn) closeBtn.onclick = () => modal.close();
      if (cancelBtn) cancelBtn.onclick = () => modal.close();

      // Template Tab Switching
      const tabGroup = document.getElementById('template-tab-group');
      if (tabGroup) {
        tabGroup.onclick = e => {
          const btn = e.target.closest('[data-tpl]');
          if (!btn) return;
          // Save current textarea before switching
          saveCurrentTextareaToState();
          currentEditingTemplateKey = btn.getAttribute('data-tpl');
          tabGroup.querySelectorAll('.template-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          loadCurrentTemplateToTextarea();
        };
      }

      // Token click to insert
      const tokenBar = document.getElementById('token-bar');
      const textarea = document.getElementById('tpl-editor-textarea');
      if (tokenBar && textarea) {
        tokenBar.onclick = e => {
          const btn = e.target.closest('[data-token]');
          if (!btn) return;
          const token = btn.getAttribute('data-token');
          const start = textarea.selectionStart || textarea.value.length;
          const end = textarea.selectionEnd || textarea.value.length;
          const val = textarea.value;
          textarea.value = val.substring(0, start) + token + val.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + token.length;
          textarea.focus();
          updateTemplateLivePreview();
        };

        textarea.oninput = updateTemplateLivePreview;
      }

      // Bank fields input update preview
      ['set-bank-name', 'set-acc-num', 'set-acc-holder', 'set-signature'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) inp.oninput = updateTemplateLivePreview;
      });

      // Save settings
      if (saveBtn) {
        saveBtn.onclick = () => {
          saveCurrentTextareaToState();
          state.settings.bank = document.getElementById('set-bank-name').value.trim() || 'BCA';
          state.settings.accNumber = document.getElementById('set-acc-num').value.trim() || '1234567890';
          state.settings.accHolder = document.getElementById('set-acc-holder').value.trim() || 'Alxanthia Studio';
          state.settings.signature = document.getElementById('set-signature').value.trim() || 'Alxanthia Studio 🌸';
          saveState();
          modal.close();
          showToast('Pengaturan studio & template WhatsApp tersimpan!');
          renderTicket();

          if (isAppsScript()) {
            google.script.run
              .withSuccessHandler(function() {
                showToast('Pengaturan studio tersimpan ke Cloud Properties ✓');
              })
              .withFailureHandler(function(err) {
                showToast('Gagal simpan ke cloud: ' + (err.message || err), true);
              })
              .saveDeskSettings(state.settings);
          }
        };
      }

      // Reset to defaults
      if (resetBtn) {
        resetBtn.onclick = () => {
          if (confirm('Reset seluruh nomor rekening dan template pesan ke pengaturan default?')) {
            state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            saveState();
            populateSettingsForm();
            showToast('Template di-reset ke default pabrik');
          }
        };
      }
    }

    function populateSettingsForm() {
      document.getElementById('set-bank-name').value = state.settings.bank || 'BCA';
      document.getElementById('set-acc-num').value = state.settings.accNumber || '1234567890';
      document.getElementById('set-acc-holder').value = state.settings.accHolder || 'Alxanthia Studio';
      document.getElementById('set-signature').value = state.settings.signature || 'Alxanthia Studio 🌸';
      loadCurrentTemplateToTextarea();
    }

    function saveCurrentTextareaToState() {
      const textarea = document.getElementById('tpl-editor-textarea');
      if (textarea && currentEditingTemplateKey) {
        state.settings.templates[currentEditingTemplateKey] = textarea.value;
      }
    }

    function loadCurrentTemplateToTextarea() {
      const textarea = document.getElementById('tpl-editor-textarea');
      if (textarea) {
        textarea.value = state.settings.templates[currentEditingTemplateKey] || '';
        updateTemplateLivePreview();
      }
    }

    function updateTemplateLivePreview() {
      const textarea = document.getElementById('tpl-editor-textarea');
      const previewEl = document.getElementById('tpl-live-preview');
      if (!textarea || !previewEl) return;

      const order = state.orders.find(o => o.ref === state.selectedRef) || state.orders[0];
      if (!order) {
        previewEl.textContent = textarea.value;
        return;
      }

      // Temporary override settings for live preview
      const prevBank = state.settings.bank;
      const prevAcc = state.settings.accNumber;
      const prevHold = state.settings.accHolder;
      const prevSig = state.settings.signature;

      state.settings.bank = document.getElementById('set-bank-name').value || 'BCA';
      state.settings.accNumber = document.getElementById('set-acc-num').value || '1234567890';
      state.settings.accHolder = document.getElementById('set-acc-holder').value || 'Alxanthia Studio';
      state.settings.signature = document.getElementById('set-signature').value || 'Alxanthia Studio 🌸';

      const rendered = renderWaMessage(textarea.value, order);
      previewEl.textContent = rendered;

      // Revert in-memory temporary overrides
      state.settings.bank = prevBank;
      state.settings.accNumber = prevAcc;
      state.settings.accHolder = prevHold;
      state.settings.signature = prevSig;
    }

    function renderAll() {
      renderPulse();
      renderLanes();
      renderQueue();
      renderTicket();
      if (state.viewMode === 'calendar') {
        renderCalendar();
      }
    }

    /* --- New Order Modal Logic with DP Support --- */
    let newOrderCounts = {
      flowers: { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 },
      additions: { fern: 0, rounded: 0 },
      pots: { daisy: 0, sunflower: 0, 'lily-of-the-valley': 0 }
    };
    let newOrderWrap = 'sage';

    function initNewOrderModal() {
      const picker = document.getElementById('modal-flower-picker');
      const swatchPicker = document.getElementById('modal-swatch-picker');
      const modal = document.getElementById('modal-new-order');
      const openBtn = document.getElementById('btn-open-new-order');
      const closeBtn = document.getElementById('btn-close-modal');
      const cancelBtn = document.getElementById('btn-cancel-modal');
      const planSelect = document.getElementById('inp-payment-plan');

      // Date input default to TODAY + 2 days
      const d = new Date(TODAY);
      d.setDate(d.getDate() + 2);
      const minDateStr = d.toISOString().split('T')[0];
      const dateInp = document.getElementById('inp-buyer-date');
      if (dateInp) {
        dateInp.value = minDateStr;
        dateInp.min = TODAY;
      }

      // Populate Flower & Items picker
      let pickerHtml = '';
      Object.keys(CATALOG.flowers).forEach(key => {
        const item = CATALOG.flowers[key];
        pickerHtml += `
          <div class="picker-card">
            <div class="picker-thumb"><img src="${item.img}" onerror="this.src='${item.fallbackImg}'" alt="${item.name}"></div>
            <span class="picker-name">${item.name}</span>
            <span class="picker-price">${formatRupiah(item.price)}</span>
            <div class="counter-control">
              <button type="button" class="btn-count" data-dec="flower" data-key="${key}">-</button>
              <span class="count-val" id="cnt-flower-${key}">0</span>
              <button type="button" class="btn-count" data-inc="flower" data-key="${key}">+</button>
            </div>
          </div>
        `;
      });

      Object.keys(CATALOG.additions).forEach(key => {
        const item = CATALOG.additions[key];
        pickerHtml += `
          <div class="picker-card">
            <div class="picker-thumb"><img src="${item.img}" onerror="this.src='${item.fallbackImg}'" alt="${item.name}"></div>
            <span class="picker-name">${item.name}</span>
            <span class="picker-price">${formatRupiah(item.price)}</span>
            <div class="counter-control">
              <button type="button" class="btn-count" data-dec="addition" data-key="${key}">-</button>
              <span class="count-val" id="cnt-addition-${key}">0</span>
              <button type="button" class="btn-count" data-inc="addition" data-key="${key}">+</button>
            </div>
          </div>
        `;
      });

      Object.keys(CATALOG.pots).forEach(key => {
        const item = CATALOG.pots[key];
        pickerHtml += `
          <div class="picker-card">
            <div class="picker-thumb"><img src="${item.img}" onerror="this.src='${item.fallbackImg}'" alt="${item.name}"></div>
            <span class="picker-name">${item.name}</span>
            <span class="picker-price">${formatRupiah(item.price)}</span>
            <div class="counter-control">
              <button type="button" class="btn-count" data-dec="pot" data-key="${key}">-</button>
              <span class="count-val" id="cnt-pot-${key}">0</span>
              <button type="button" class="btn-count" data-inc="pot" data-key="${key}">+</button>
            </div>
          </div>
        `;
      });

      picker.innerHTML = pickerHtml;

      // Swatch picker
      swatchPicker.innerHTML = Object.keys(CATALOG.wraps).map(key => {
        const w = CATALOG.wraps[key];
        const isActive = key === newOrderWrap;
        return `
          <div class="swatch-opt ${isActive ? 'active' : ''}" data-wrap="${key}">
            <span class="swatch-circle" style="background: ${w.swatch}; width: 16px; height: 16px;"></span>
            <span>${w.name}</span>
          </div>
        `;
      }).join('');

      swatchPicker.addEventListener('click', e => {
        const opt = e.target.closest('[data-wrap]');
        if (!opt) return;
        newOrderWrap = opt.getAttribute('data-wrap');
        document.querySelectorAll('.swatch-opt').forEach(el => el.classList.remove('active'));
        opt.classList.add('active');
      });

      if (planSelect) {
        planSelect.onchange = () => updateModalCounts();
      }

      // Picker count events
      picker.addEventListener('click', e => {
        const inc = e.target.closest('[data-inc]');
        const dec = e.target.closest('[data-dec]');
        if (inc) {
          const type = inc.getAttribute('data-inc');
          const key = inc.getAttribute('data-key');
          if (type === 'flower') newOrderCounts.flowers[key] = (newOrderCounts.flowers[key] || 0) + 1;
          else if (type === 'addition') newOrderCounts.additions[key] = (newOrderCounts.additions[key] || 0) + 1;
          else if (type === 'pot') newOrderCounts.pots[key] = (newOrderCounts.pots[key] || 0) + 1;
          updateModalCounts();
        } else if (dec) {
          const type = dec.getAttribute('data-dec');
          const key = dec.getAttribute('data-key');
          if (type === 'flower') newOrderCounts.flowers[key] = Math.max(0, (newOrderCounts.flowers[key] || 0) - 1);
          else if (type === 'addition') newOrderCounts.additions[key] = Math.max(0, (newOrderCounts.additions[key] || 0) - 1);
          else if (type === 'pot') newOrderCounts.pots[key] = Math.max(0, (newOrderCounts.pots[key] || 0) - 1);
          updateModalCounts();
        }
      });

      // Card toggle
      const hasCard = document.getElementById('modal-has-card');
      const cardFields = document.getElementById('modal-card-fields');
      hasCard.onchange = () => {
        cardFields.style.display = hasCard.checked ? 'flex' : 'none';
        updateModalCounts();
      };

      // Location toggle
      const locType = document.getElementById('inp-location-type');
      locType.onchange = () => {
        const isBali = locType.value === 'bali';
        document.getElementById('field-bali-detail').style.display = isBali ? 'block' : 'none';
        document.getElementById('field-luar-bali-detail').style.display = isBali ? 'none' : 'block';
      };

      openBtn.onclick = () => {
        resetNewOrderForm();
        modal.showModal();
      };
      const closeModal = () => modal.close();
      closeBtn.onclick = closeModal;
      cancelBtn.onclick = closeModal;

      modal.addEventListener('click', e => {
        if (e.target === modal) {
          const rect = modal.getBoundingClientRect();
          const inContent = (
            rect.top <= e.clientY && e.clientY <= rect.bottom &&
            rect.left <= e.clientX && e.clientX <= rect.right
          );
          if (!inContent) modal.close();
        }
      });

      const form = document.getElementById('form-new-order');
      form.onsubmit = e => {
        e.preventDefault();
        saveNewOrderFromModal();
        modal.close();
      };
    }

    function resetNewOrderForm() {
      newOrderCounts = {
        flowers: { Sunflower: 0, Rose: 0, Tulip: 0, Gerbera: 0 },
        additions: { fern: 0, rounded: 0 },
        pots: { daisy: 0, sunflower: 0, 'lily-of-the-valley': 0 }
      };
      newOrderWrap = 'sage';
      document.getElementById('inp-buyer-name').value = '';
      document.getElementById('inp-buyer-wa').value = '';
      document.getElementById('inp-payment-plan').value = 'Full';
      document.getElementById('modal-has-card').checked = false;
      document.getElementById('modal-card-fields').style.display = 'none';
      document.getElementById('inp-card-to').value = '';
      document.getElementById('inp-card-from').value = '';
      document.getElementById('inp-card-text').value = '';
      updateModalCounts();
    }

    function updateModalCounts() {
      Object.keys(newOrderCounts.flowers).forEach(k => {
        const el = document.getElementById(`cnt-flower-${k}`);
        if (el) el.textContent = newOrderCounts.flowers[k];
      });
      Object.keys(newOrderCounts.additions).forEach(k => {
        const el = document.getElementById(`cnt-addition-${k}`);
        if (el) el.textContent = newOrderCounts.additions[k];
      });
      Object.keys(newOrderCounts.pots).forEach(k => {
        const el = document.getElementById(`cnt-pot-${k}`);
        if (el) el.textContent = newOrderCounts.pots[k];
      });

      let sub = 0;
      let totalStems = 0;
      Object.keys(newOrderCounts.flowers).forEach(k => {
        const c = newOrderCounts.flowers[k];
        totalStems += c;
        sub += c * CATALOG.flowers[k].price;
      });
      Object.keys(newOrderCounts.additions).forEach(k => {
        sub += newOrderCounts.additions[k] * CATALOG.additions[k].price;
      });
      Object.keys(newOrderCounts.pots).forEach(k => {
        sub += newOrderCounts.pots[k] * CATALOG.pots[k].price;
      });

      if (totalStems > 0) {
        sub += Math.ceil(totalStems / CATALOG.wrapFeeUnitStems) * CATALOG.wrapFeePerUnit;
      }
      if (document.getElementById('modal-has-card').checked) {
        sub += CATALOG.messageCardPrice;
      }

      document.getElementById('modal-total-preview').textContent = formatRupiah(sub);

      const isDp = document.getElementById('inp-payment-plan').value === 'Deposit 50%';
      const dpPreviewEl = document.getElementById('modal-dp-preview');
      if (isDp && sub > 0) {
        const dpVal = Math.ceil(sub / 2);
        dpPreviewEl.textContent = `★ Wajib DP 50%: ${formatRupiah(dpVal)} (Sisa ${formatRupiah(sub - dpVal)})`;
        dpPreviewEl.style.display = 'block';
      } else {
        dpPreviewEl.style.display = 'none';
      }
    }

    function saveNewOrderFromModal() {
      const buyerName = document.getElementById('inp-buyer-name').value.trim();
      let buyerWa = document.getElementById('inp-buyer-wa').value.trim();
      if (buyerWa.startsWith('0')) buyerWa = '+62' + buyerWa.slice(1);
      const buyerDate = document.getElementById('inp-buyer-date').value;
      const plan = document.getElementById('inp-payment-plan').value;
      const locType = document.getElementById('inp-location-type').value;
      const regency = document.getElementById('inp-regency').value;
      const deliveryMethod = document.getElementById('inp-delivery-method').value;
      const address = document.getElementById('inp-address').value.trim();

      const items = [];
      const selectedStems = {};
      let totalStems = 0;
      Object.keys(newOrderCounts.flowers).forEach(k => {
        if (newOrderCounts.flowers[k] > 0) {
          selectedStems[k] = newOrderCounts.flowers[k];
          totalStems += newOrderCounts.flowers[k];
        }
      });
      const selectedAdditions = {};
      Object.keys(newOrderCounts.additions).forEach(k => {
        if (newOrderCounts.additions[k] > 0) {
          selectedAdditions[k] = newOrderCounts.additions[k];
        }
      });

      if (totalStems > 0) {
        items.push({
          type: 'custom',
          qty: 1,
          stems: selectedStems,
          additions: selectedAdditions
        });
      }

      Object.keys(newOrderCounts.pots).forEach(k => {
        if (newOrderCounts.pots[k] > 0) {
          items.push({ type: 'pot', id: k, qty: newOrderCounts.pots[k] });
        }
      });

      if (items.length === 0) {
        items.push({ type: 'stem', id: 'Sunflower', qty: 3 });
      }

      const hasCard = document.getElementById('modal-has-card').checked;
      const card = hasCard ? {
        to: document.getElementById('inp-card-to').value.trim(),
        from: document.getElementById('inp-card-from').value.trim(),
        text: document.getElementById('inp-card-text').value.trim() || 'Selamat berbahagia!'
      } : null;

      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const datePart = (buyerDate || TODAY).replace(/-/g, '').slice(2);
      const newRef = `ALX-${datePart}-${randomSuffix}`;

      let sub = 0;
      Object.keys(newOrderCounts.flowers).forEach(k => {
        sub += (newOrderCounts.flowers[k] || 0) * CATALOG.flowers[k].price;
      });
      Object.keys(newOrderCounts.additions).forEach(k => {
        sub += (newOrderCounts.additions[k] || 0) * CATALOG.additions[k].price;
      });
      Object.keys(newOrderCounts.pots).forEach(k => {
        sub += (newOrderCounts.pots[k] || 0) * CATALOG.pots[k].price;
      });
      if (totalStems > 0) {
        sub += Math.ceil(totalStems / CATALOG.wrapFeeUnitStems) * CATALOG.wrapFeePerUnit;
      }
      if (hasCard) {
        sub += CATALOG.messageCardPrice;
      }

      const summaryParts = [];
      items.forEach(it => {
        if (it.type === 'custom') {
          summaryParts.push('Rangkaian custom');
        } else if (it.type === 'stem') {
          summaryParts.push(`${it.qty}x ${CATALOG.flowers[it.id] ? CATALOG.flowers[it.id].name : it.id}`);
        } else if (it.type === 'pot') {
          summaryParts.push(`${it.qty}x ${CATALOG.pots[it.id] ? CATALOG.pots[it.id].name : it.id}`);
        }
      });
      const itemsRaw = summaryParts.join(', ') || 'Pesanan Studio Desk';

      const newOrder = {
        row: state.orders.length + 120,
        ref: newRef,
        submitted: `${TODAY} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        buyer: buyerName,
        wa: buyerWa,
        locationType: locType,
        regency: locType === 'bali' ? regency : '',
        method: locType === 'bali' ? deliveryMethod : '',
        address: locType === 'bali' ? '' : address,
        city: locType === 'bali' ? '' : 'Luar Bali',
        postal: '',
        date: buyerDate || TODAY,
        wrap: newOrderWrap,
        paymentPlan: plan,
        payment: 'Unpaid',
        paidAt: null,
        verified: sub,
        itemsRaw: itemsRaw,
        mismatch: false,
        shipping: locType === 'bali' ? 0 : 35000,
        phase: 'Not started',
        items: items,
        card: card,
        notes: plan === 'Deposit 50%' ? 'Skema DP 50% di awal.' : ''
      };

      if (isAppsScript()) {
        google.script.run
          .withSuccessHandler(function(res) {
            if (res && res.ok) {
              showToast('Pesanan ' + newRef + ' berhasil disimpan ke Spreadsheet!');
              loadState();
            } else {
              showToast('Gagal membuat pesanan: ' + ((res && res.message) || 'Error'), true);
            }
          })
          .withFailureHandler(function(err) {
            showToast('Koneksi sheet gagal: ' + (err.message || err), true);
          })
          .createOrder(newOrder);
      } else {
        state.orders.unshift(newOrder);
        state.selectedRef = newOrder.ref;
        saveState();
        showToast('Pesanan ' + newRef + ' (' + plan + ') berhasil dibuat!');
        renderAll();
      }
    }

    /* --- Global Event Handlers & Navigation --- */
    function initGlobalEvents() {
      // Theme toggle
      document.getElementById('btn-theme-toggle').onclick = () => {
        const nextTheme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
        saveState();
      };

      // View mode switching
      document.getElementById('tab-view-queue').onclick = () => switchViewMode('queue');
      document.getElementById('tab-view-calendar').onclick = () => switchViewMode('calendar');

      // Calendar month nav
      const prevCal = document.getElementById('cal-prev-month');
      const nextCal = document.getElementById('cal-next-month');
      const todayCal = document.getElementById('cal-today-btn');
      const closeAgendaBtn = document.getElementById('cal-agenda-close-btn');

      if (prevCal) {
        prevCal.onclick = () => {
          state.calendarMonth--;
          if (state.calendarMonth < 0) {
            state.calendarMonth = 11;
            state.calendarYear--;
          }
          renderCalendar();
        };
      }
      if (nextCal) {
        nextCal.onclick = () => {
          state.calendarMonth++;
          if (state.calendarMonth > 11) {
            state.calendarMonth = 0;
            state.calendarYear++;
          }
          renderCalendar();
        };
      }
      if (todayCal) {
        todayCal.onclick = () => {
          state.calendarYear = 2026;
          state.calendarMonth = 8;
          state.selectedCalendarDate = TODAY;
          renderCalendar();
        };
      }
      if (closeAgendaBtn) {
        closeAgendaBtn.onclick = () => {
          state.selectedCalendarDate = null;
          renderCalendar();
        };
      }

      // Lane chips click
      document.getElementById('lane-chips').addEventListener('click', e => {
        const btn = e.target.closest('[data-lane]');
        if (!btn) return;
        state.lane = btn.getAttribute('data-lane');
        state.selectedCalendarDate = null; // Clear calendar date filter when lane is clicked
        renderLanes();
        renderQueue();
      });

      // Order search
      document.getElementById('order-search').addEventListener('input', e => {
        state.search = e.target.value;
        renderQueue();
      });

      // Sort select
      document.getElementById('sort-select').addEventListener('change', e => {
        state.sort = e.target.value;
        renderQueue();
      });

      // Queue item select
      document.getElementById('queue-pane').addEventListener('click', e => {
        const card = e.target.closest('[data-ref]');
        if (!card) return;
        state.selectedRef = card.getAttribute('data-ref');
        document.getElementById('desk-layout').classList.add('view-detail');
        document.body.classList.add('view-detail-mode');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderQueue();
        renderTicket();
      });
    }

    /* --- App Initialization --- */
    window.addEventListener('DOMContentLoaded', () => {
      loadState();
      initNewOrderModal();
      initBatchPrepEvents();
      initSettingsModalEvents();
      initGlobalEvents();
      renderAll();
    });
  </script>
</body>
</html>

```

---

## Part 5 — Add the settings

In the same project, click the gear (**Project Settings**) in the left sidebar, scroll to **Script
Properties**, and click **Add script property** for each of these:

| Property | Value |
| --- | --- |
| `SPREADSHEET_ID` | the ID you copied in Part 1 |
| `DESK_ALLOWED_EMAILS` | her Google email and yours, separated by a comma |
| `BANK_NAME` | e.g. `BCA` |
| `BANK_NUMBER` | your studio account number |
| `BANK_HOLDER` | the account holder name |

Save. Changing the bank details later means editing these values — never the code. Nobody can open
the Desk and see any orders at all until `SPREADSHEET_ID` and `DESK_ALLOWED_EMAILS` are both set.

---

## Part 6 — Publish it

1. Top right: **Deploy → New deployment**.
2. Click the gear next to *Select type* and choose **Web app**.
3. Fill in:
   - **Description**: `v1`
   - **Execute as**: **User accessing the web app** ← this one matters; the default is wrong. The
     Desk relies on Google itself telling it who is signed in, so it can check that email against
     `DESK_ALLOWED_EMAILS`.
   - **Who has access**: **Anyone with a Google account**
4. Click **Deploy**.
5. Google will ask for permission. You will see a warning screen saying *"Google hasn't verified this
   app"* — that is normal for a private script you wrote yourself. Click **Advanced**, then **Go to
   Alxanthia Studio Desk (unsafe)**, then **Allow**. It is your own script accessing your own sheet.
6. Copy the **Web app URL** that ends in `/exec`. That is the Desk.

---

## Part 7 — Put it on her phone

Send her the `/exec` link, then walk her through adding it to her home screen so it opens like an app:

- **iPhone (Safari)**: open the link → the share button at the bottom → **Add to Home Screen**.
- **Android (Chrome)**: open the link → the ⋮ menu top right → **Add to Home screen**.

The first time she opens it, Google will ask her to sign in and approve the same permission screen
from Part 6. She will see the same "hasn't verified this app" warning and the same **Advanced → Go
to … → Allow** path. If her email is not yet in `DESK_ALLOWED_EMAILS`, the page will load but show
"Akun ini tidak punya akses ke Studio Desk" instead of the order queue — double-check Part 5.

---

## Part 8 — Check it works

Place one test order on the website, then on the Desk confirm:

- The new order appears in the queue with the right buyer, date and flowers.
- Searching with part of the buyer's name or order code shows the matching order.
- **Salin teks rekening** produces a message with the right total and your account number.
- Marking it *perlu dicek* and then *lunas* changes `Payment Status` in the sheet within a second.
- Typing an ongkir on an out-of-Bali order fills in `Final Total` in the sheet by itself.
- **Lanjut** changes `Work Phase` in the sheet.
- A note typed in the Desk appears in `Internal Notes`.
- Changing a flower's name in `site-content.js`, deploying the website, then tapping **Muat ulang
  katalog** shows the new name on the Desk.
- Closing the phone's browser tab and reopening the `/exec` link still shows the order (a page
  reload always re-checks access and re-fetches the queue).

Then delete the test row from the sheet.

---

## Part 9 — Two things to remember afterwards

1. **Any code change needs a redeploy.** Editing the script is not enough: **Deploy → Manage
   deployments → edit (pencil) → Version: New version → Deploy**. The `/exec` link stays the same, so
   nothing on her phone needs changing.
2. **The Desk is the place to mark an order paid** — not the sheet. It is the only screen that shows
   the exact amount to check against, and the rule is still the one from
   `OWNER-ACTION-GUIDE.md` Step 9: confirm the money in your bank's mutasi, never from a screenshot.

---

## Troubleshooting

### The page shows "Akun ini tidak punya akses ke Studio Desk"

The signed-in Google account is not (or not yet) listed in the `DESK_ALLOWED_EMAILS` Script
Property from Part 5. Add it, exactly as her Google account's email, comma-separated from any other
allowed address, and reload the page — no redeploy needed, Script Properties take effect immediately.

### The page is stuck on "Memuat pesanan…" or shows an error screen

1. Open **Deploy → Manage deployments** and confirm the deployment executes as **User accessing the
   web app** and is shared with **Anyone with a Google account** (Part 6).
2. Confirm `SPREADSHEET_ID` (Part 5) is the ID from the address bar, not the whole URL.
3. Confirm the worksheet inside that spreadsheet is still named exactly `Orders`.
4. Tap **Coba lagi** on the error screen — it retries both the catalogue and the order list.

### A change she makes doesn't show up in the sheet

The page shows an error toast naming what went wrong when a save fails, and puts the control back
the way it was — it never fails silently. If the toast says the sheet is busy, wait a few seconds and
try again (another save was in progress). If it names a different problem, re-check Parts 1 and 5.

### Flower/pot/package names look outdated or generic

Tap **Muat ulang katalog** in the footer — it clears the six-hour cache and re-fetches
`site-content.js` immediately. If a quiet banner says the catalogue couldn't be reloaded, the site's
`site-content.js` was unreachable; the Desk keeps working from its last good copy in the meantime, and
order data and totals are unaffected either way (they come from the sheet, never the catalogue).

### Money doesn't match what the customer was quoted

It can't — the Desk only ever shows `Verified Total` (plus `Shipping Fee` once you type it),
recalculated server-side by the order writer at submission time, never anything from the customer's
browser or from the Desk itself. If a total looks wrong, check `Price Mismatch` on that row in the
sheet directly (the Desk's gate surfaces this as "Harga ditandai REVIEW").
