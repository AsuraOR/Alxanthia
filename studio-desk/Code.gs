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
// Counted from Preferred Date (when the customer wanted the order), NOT from
// the date the order was actually marked Delivered — the Desk does not
// record a delivery timestamp. A finished order can therefore drop out of
// view immediately (if its Preferred Date was already long past when it was
// marked Delivered) or linger past this window (if Delivered ahead of a
// future Preferred Date). See Troubleshooting: "A finished order disappears
// from the queue sooner than expected".
var KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE = 14;

var SITE_CONTENT_URL = 'https://alxanthia.com/site-content.json';
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
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('Alxanthia Studio Desk');
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
    if (daysPast > KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE) return false;
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
    payment: String(get('Payment Status') || ''),
    phase: String(get('Work Phase') || ''),
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

    // A defensive re-check right before writing: the row above was located
    // BY REFERENCE (ground rule 4), so this can only fire if the sheet
    // changed between that lookup and this line — not reachable from a
    // stale row-number hint alone, which findRowByReference_ already
    // resolves by re-scanning.
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
  return /^[=+\-@]/.test(text) ? "'" + text : text;
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
// Sheet helpers — columns are found by header text, never by letter or
// index, exactly like the order writer.
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
// getCatalog() / refreshCatalog() — the live catalogue. Money never travels
// through here; see pickLabels_().
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
      var data = JSON.parse(res.getContentText());
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

/**
 * Reduces window.ALXANTHIA_DATA to display labels only — no prices ever
 * cross into the Desk. Money comes from the sheet's Verified Total and
 * Shipping Fee alone.
 */
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

/**
 * The build-list derivation — one line per item, a custom bouquet's
 * composition folded into a spec line beneath it. The SAME algorithm is
 * inlined in Index.html's own script (client-side rendering cannot call
 * back into this file), so this copy exists to keep it under test; keep
 * both in sync if either changes. Unknown catalog keys (a flower removed
 * from site-content.js after the order was placed) fall back to a
 * humanised version of the raw key rather than crashing the ticket.
 */
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
