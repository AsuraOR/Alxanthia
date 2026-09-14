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
var ACTIVITY_SHEET_NAME = 'Studio Desk Activity';
var PAYMENT_SHEET_NAME = 'Studio Desk Payments';
var INVENTORY_SHEET_NAME = 'Studio Desk Inventory';
var PHOTO_SHEET_NAME = 'Studio Desk Photos';

var SITE_CONTENT_URL = 'https://alxanthia.com/site-content.js';
var CATALOG_CACHE_KEY = 'desk_catalog_v1';
var CATALOG_TTL_SECONDS = 21600; // 6 hours, the CacheService maximum

// Page-side field name -> sheet column header. The allowlist is enforced here
// rather than trusted from the page. Pricing fields are deliberately absent;
// the owner-only manual-order function has its own narrower permission gate.
var WRITABLE_FIELDS = {
  confirmed: 'Order Confirmation Sent',
  paymentPlan: 'Payment Plan',
  payment: 'Payment Status',
  shipping: 'Shipping Fee',
  phase: 'Work Phase',
  notes: 'Internal Notes',
  buyer: 'Buyer Name',
  wa: 'Buyer WhatsApp',
  date: 'Preferred Date',
  regency: 'Regency',
  method: 'Delivery Method',
  address: 'Address',
  city: 'City',
  postal: 'Postal Code',
  deliveryService: 'Delivery Service',
  tracking: 'Tracking Link/Number'
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
    confirmed: String(get('Order Confirmation Sent') || '').toLowerCase() === 'yes',
    paymentPlan: String(get('Payment Plan') || 'Full'),
    payment: String(get('Payment Status') || ''),
    phase: String(get('Work Phase') || ''),
    deliveryService: String(get('Delivery Service') || ''),
    tracking: String(get('Tracking Link/Number') || ''),
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

    var before = sheet.getRange(row, colIdx + 1).getValue();
    sheet.getRange(row, colIdx + 1).setValue(validated.value);
    appendActivity_(ref, 'Perbarui ' + columnName, before, validated.value);

    var rowValues = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    return { ok: true, order: rowToOrder_(rowValues, headers, row) };
  } finally {
    lock.releaseLock();
  }
}

function validateFieldValue_(field, value) {
  if (field === 'confirmed') {
    if (typeof value !== 'boolean') return { ok: false, message: 'Status konfirmasi harus Ya atau Tidak.' };
    return { ok: true, value: value ? 'Yes' : 'No' };
  }
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
  if (field === 'buyer') {
    var buyer = String(value || '').trim();
    if (!buyer || buyer.length > 120) return { ok: false, message: 'Nama pembeli wajib diisi dan maksimal 120 karakter.' };
    return { ok: true, value: safeText_(buyer) };
  }
  if (field === 'wa') {
    var wa = normaliseWhatsApp_(value);
    if (!wa) return { ok: false, message: 'Nomor WhatsApp tidak valid. Gunakan nomor Indonesia aktif.' };
    return { ok: true, value: wa };
  }
  if (field === 'date') {
    var date = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'Tanggal diperlukan tidak valid.' };
    return { ok: true, value: date };
  }
  if (['regency', 'method', 'address', 'city', 'postal', 'deliveryService', 'tracking'].indexOf(field) !== -1) {
    return { ok: true, value: safeText_(String(value || '').trim().slice(0, field === 'address' ? 500 : 160)) };
  }
  return { ok: false, message: 'Kolom tidak dikenali.' };
}

function normaliseWhatsApp_(value) {
  var digits = String(value || '').replace(/\D/g, '');
  if (digits.indexOf('0') === 0) digits = '62' + digits.slice(1);
  if (digits.indexOf('8') === 0) digits = '62' + digits;
  return /^62\d{8,13}$/.test(digits) ? '+' + digits : '';
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
// Studio operations added for the production Desk: manual orders, editing,
// archive, payment ledger, activity history, inventory and portable backups.
// Auxiliary sheets are created lazily and never change the Orders layout.
// ============================================================================
function getWorkspace() {
  checkAccess_();
  var orders = listOrders();
  var catalog = getCatalog();
  return {
    today: todayStr_(),
    orders: orders,
    catalog: catalog,
    capabilities: { manualOrders: manualOrderAllowed_() },
    insights: buildInsights_(orders),
    inventory: listInventory_()
  };
}

function updateOrderDetails(payload) {
  checkAccess_();
  payload = payload || {};
  var allowed = ['buyer', 'wa', 'date', 'regency', 'method', 'address', 'city', 'postal', 'deliveryService', 'tracking'];
  var fields = payload.fields || {};
  var keys = Object.keys(fields);
  if (!keys.length) return { ok: false, code: 'BAD_FIELD', message: 'Tidak ada perubahan untuk disimpan.' };
  var validated = {};
  for (var i = 0; i < keys.length; i += 1) {
    if (allowed.indexOf(keys[i]) === -1) return { ok: false, code: 'BAD_FIELD', message: 'Rincian ini tidak boleh diubah.' };
    validated[keys[i]] = validateFieldValue_(keys[i], fields[keys[i]]);
    if (!validated[keys[i]].ok) return { ok: false, code: 'BAD_VALUE', message: validated[keys[i]].message };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var sheet = openSheet_(); var headers = readHeaders_(sheet); var refCol = headers.map['Order Reference'];
    if (refCol === undefined) return { ok: false, code: 'MISSING_COLUMN', message: 'Kolom "Order Reference" belum ada di sheet Orders.' };
    var row = findRowByReference_(sheet, refCol, String(payload.ref || ''), payload.row);
    if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Pesanan dengan referensi ini tidak ditemukan lagi.' };
    for (var j = 0; j < keys.length; j += 1) {
      var columnName = WRITABLE_FIELDS[keys[j]], col = headers.map[columnName];
      if (col === undefined) return { ok: false, code: 'MISSING_COLUMN', message: 'Kolom "' + columnName + '" belum ada di sheet Orders.' };
    }
    for (var k = 0; k < keys.length; k += 1) {
      var name = WRITABLE_FIELDS[keys[k]], idx = headers.map[name], range = sheet.getRange(row, idx + 1);
      var before = range.getValue(); range.setValue(validated[keys[k]].value);
      appendActivity_(String(payload.ref), 'Perbarui ' + name, before, validated[keys[k]].value);
    }
    return { ok: true, order: rowToOrder_(sheet.getRange(row, 1, 1, headers.length).getValues()[0], headers, row) };
  } finally { lock.releaseLock(); }
}

function archiveOrder(payload) {
  payload = payload || {};
  return updateOrder({ ref: payload.ref, row: payload.row, field: 'phase', value: 'Cancelled' });
}

function createManualOrder(payload) {
  checkAccess_();
  if (!manualOrderAllowed_()) return { ok: false, code: 'FORBIDDEN', message: 'Akun ini tidak diizinkan membuat pesanan manual atau menulis total terverifikasi.' };
  payload = payload || {};
  var buyer = validateFieldValue_('buyer', payload.buyer);
  var wa = validateFieldValue_('wa', payload.wa);
  var date = validateFieldValue_('date', payload.date);
  var verified = Number(payload.verified);
  var items = Array.isArray(payload.items) ? payload.items : [];
  var summary = String(payload.summary || '').trim();
  if (!buyer.ok || !wa.ok || !date.ok) return { ok: false, code: 'BAD_VALUE', message: (!buyer.ok ? buyer : !wa.ok ? wa : date).message };
  if (!items.length && !summary) return { ok: false, code: 'NO_ITEMS', message: 'Pilih atau tulis minimal satu produk.' };
  if (!isFinite(verified) || verified < 0) return { ok: false, code: 'BAD_VALUE', message: 'Total pesanan harus berupa angka 0 atau lebih.' };
  if (payload.locationType === 'luar_bali' && (!String(payload.address || '').trim() || !String(payload.city || '').trim() || !String(payload.postal || '').trim())) {
    return { ok: false, code: 'BAD_VALUE', message: 'Alamat, kota, dan kode pos wajib diisi untuk pengiriman luar Bali.' };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var sheet = openSheet_();
    var headers = readHeaders_(sheet);
    var required = ['Order Reference', 'Submitted At', 'Buyer Name', 'Buyer WhatsApp', 'Preferred Date', 'Order Summary', 'Item Data', 'Verified Total', 'Payment Plan', 'Payment Status', 'Work Phase'];
    for (var r = 0; r < required.length; r += 1) {
      if (headers.map[required[r]] === undefined) return { ok: false, code: 'MISSING_COLUMN', message: 'Kolom "' + required[r] + '" belum ada di sheet Orders.' };
    }
    var ref = makeOrderReference_();
    var rowValues = new Array(headers.length).fill('');
    function put(name, value) { if (headers.map[name] !== undefined) rowValues[headers.map[name]] = value; }
    put('Order Reference', ref);
    put('Submitted At', Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm'));
    put('Language', 'id'); put('Currency', 'IDR'); put('Source', 'studio-desk'); put('Acknowledged', 'Yes');
    put('Buyer Name', buyer.value); put('Buyer WhatsApp', wa.value);
    put('Location Type', payload.locationType === 'luar_bali' ? 'luar_bali' : 'bali');
    put('Regency', safeText_(payload.regency || '')); put('Delivery Method', safeText_(payload.method || ''));
    put('Address', safeText_(payload.address || '')); put('City', safeText_(payload.city || '')); put('Postal Code', safeText_(payload.postal || ''));
    put('Preferred Date', date.value); put('Order Mode', 'manual');
    put('Order Summary', safeText_(summary || buildSummary_(items)));
    put('Item Data', JSON.stringify(items)); put('Wrap', safeText_(payload.wrap || 'sage'));
    put('Message Card', payload.card ? 'Yes' : 'No');
    if (payload.card) { put('Gift Message', safeText_(payload.card.text || '')); put('Recipient Name', safeText_(payload.card.to || '')); put('Card Sender Name', safeText_(payload.card.from || '')); }
    put('Verified Total', verified); put('Shipping Fee', Number(payload.shipping) || 0);
    put('Payment Plan', PAYMENT_PLAN_VALUES.indexOf(payload.paymentPlan) !== -1 ? payload.paymentPlan : 'Full');
    put('Payment Status', 'Unpaid'); put('Work Phase', 'Not started'); put('Order Confirmation Sent', 'No');
    put('Internal Notes', safeText_(String(payload.notes || '').slice(0, 1000)));
    sheet.appendRow(rowValues);
    var row = sheet.getLastRow();
    setFinalTotalFormula_(sheet, headers, row);
    appendActivity_(ref, 'Buat pesanan manual', '', verified);
    var refreshed = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    return { ok: true, order: rowToOrder_(refreshed, headers, row) };
  } finally { lock.releaseLock(); }
}

function duplicateOrder(payload) {
  checkAccess_();
  payload = payload || {};
  var original = findOrderObject_(String(payload.ref || ''), payload.row);
  if (!original) return { ok: false, code: 'NOT_FOUND', message: 'Pesanan asal tidak ditemukan.' };
  return createManualOrder({
    buyer: original.buyer, wa: original.wa, date: String(payload.date || original.date),
    locationType: original.locationType, regency: original.regency, method: original.method,
    address: original.address, city: original.city, postal: original.postal,
    items: original.items, summary: original.itemsRaw, wrap: original.wrap, card: original.card,
    verified: original.verified, shipping: original.shipping || 0, paymentPlan: original.paymentPlan,
    notes: 'Duplikat dari ' + original.ref
  });
}

function recordPayment(payload) {
  checkAccess_();
  payload = payload || {};
  var amount = Number(payload.amount);
  if (!payload.ref || !isFinite(amount) || amount <= 0) return { ok: false, code: 'BAD_VALUE', message: 'Nominal pembayaran harus lebih dari 0.' };
  var sheet = ensureSupportSheet_(PAYMENT_SHEET_NAME, ['Waktu', 'Order Reference', 'Nominal', 'Metode', 'Catatan', 'Dicatat Oleh']);
  sheet.appendRow([new Date(), String(payload.ref), amount, safeText_(payload.method || 'Transfer bank'), safeText_(String(payload.note || '').slice(0, 300)), activeEmail_()]);
  appendActivity_(String(payload.ref), 'Catat pembayaran', '', amount);
  return { ok: true, payments: getPaymentHistory({ ref: payload.ref }) };
}

function getPaymentHistory(payload) {
  checkAccess_();
  var ref = String((payload || {}).ref || '');
  return readSupportRows_(PAYMENT_SHEET_NAME, 6).filter(function (row) { return String(row[1]) === ref; }).map(function (row) {
    return { at: formatDateTimeCell_(row[0]), amount: Number(row[2]) || 0, method: String(row[3] || ''), note: String(row[4] || '') };
  }).reverse();
}

function getActivity(payload) {
  checkAccess_();
  var ref = String((payload || {}).ref || '');
  return readSupportRows_(ACTIVITY_SHEET_NAME, 6).filter(function (row) { return String(row[1]) === ref; }).map(function (row) {
    return { at: formatDateTimeCell_(row[0]), action: String(row[2] || ''), before: String(row[3] || ''), after: String(row[4] || ''), by: String(row[5] || '') };
  }).reverse().slice(0, 50);
}

function savePhotoLink(payload) {
  checkAccess_(); payload = payload || {};
  var ref = String(payload.ref || ''), url = String(payload.url || '').trim(), kind = String(payload.kind || 'Referensi');
  if (!ref || !/^https:\/\//i.test(url)) return { ok: false, code: 'BAD_VALUE', message: 'Gunakan tautan foto HTTPS yang valid.' };
  if (['Referensi', 'Hasil akhir', 'Bukti pengiriman'].indexOf(kind) === -1) return { ok: false, code: 'BAD_VALUE', message: 'Jenis foto tidak dikenali.' };
  var sheet = ensureSupportSheet_(PHOTO_SHEET_NAME, ['Waktu', 'Order Reference', 'Jenis', 'Tautan Foto', 'Catatan', 'Ditambahkan Oleh']);
  sheet.appendRow([new Date(), ref, kind, safeText_(url.slice(0, 1000)), safeText_(String(payload.note || '').slice(0, 300)), activeEmail_()]);
  appendActivity_(ref, 'Tambah foto ' + kind, '', url);
  return { ok: true, photos: getPhotoLinks({ ref: ref }) };
}

function getPhotoLinks(payload) {
  checkAccess_(); var ref = String((payload || {}).ref || '');
  return readSupportRows_(PHOTO_SHEET_NAME, 6).filter(function (row) { return String(row[1]) === ref; }).map(function (row) {
    return { at: formatDateTimeCell_(row[0]), kind: String(row[2] || ''), url: String(row[3] || ''), note: String(row[4] || '') };
  }).reverse();
}

function saveInventory(payload) {
  checkAccess_();
  payload = payload || {};
  var key = String(payload.key || '').trim();
  var qty = Number(payload.qty);
  if (!key || !isFinite(qty) || qty < 0) return { ok: false, message: 'Nama bahan dan stok harus valid.' };
  var sheet = ensureSupportSheet_(INVENTORY_SHEET_NAME, ['Kunci Bahan', 'Nama Bahan', 'Stok', 'Satuan', 'Diperbarui']);
  var rows = readSupportRows_(INVENTORY_SHEET_NAME, 5);
  var rowNumber = 0;
  for (var i = 0; i < rows.length; i += 1) if (String(rows[i][0]) === key) rowNumber = i + 2;
  var values = [key, safeText_(payload.name || key), qty, safeText_(payload.unit || 'buah'), new Date()];
  if (rowNumber) sheet.getRange(rowNumber, 1, 1, 5).setValues([values]); else sheet.appendRow(values);
  return { ok: true, inventory: listInventory_() };
}

function exportDeskData() {
  checkAccess_();
  var orders = listOrders();
  var payments = readSupportRows_(PAYMENT_SHEET_NAME, 6);
  var activity = readSupportRows_(ACTIVITY_SHEET_NAME, 6);
  var photos = readSupportRows_(PHOTO_SHEET_NAME, 6);
  return { fileName: 'alxanthia-studio-desk-' + todayStr_() + '.json', json: JSON.stringify({ exportedAt: new Date().toISOString(), orders: orders, payments: payments, activity: activity, photos: photos, inventory: listInventory_() }, null, 2) };
}

function buildInsights_(orders) {
  var today = todayStr_();
  var out = { urgent: [], revenue: 0, outstanding: 0, workloadByDate: {}, customers: {} };
  (orders || []).forEach(function (o) {
    var total = Number(o.verified || 0) + Number(o.shipping || 0);
    out.revenue += o.payment === 'Paid' ? total : 0;
    if (o.payment !== 'Paid' && o.payment !== 'Cancelled') out.outstanding += total;
    var units = workloadUnits_(o.items);
    out.workloadByDate[o.date] = (out.workloadByDate[o.date] || 0) + units;
    var customerKey = normaliseWhatsApp_(o.wa) || o.buyer.toLowerCase();
    if (!out.customers[customerKey]) out.customers[customerKey] = { name: o.buyer, orders: 0, spend: 0 };
    out.customers[customerKey].orders += 1; out.customers[customerKey].spend += o.payment === 'Paid' ? total : 0;
    var days = daysBetween_(today, o.date);
    if (days <= 1 && o.payment !== 'Paid') out.urgent.push({ ref: o.ref, kind: 'payment', label: 'Pembayaran belum lunas', date: o.date });
    else if (days <= 0 && o.phase === 'Not started') out.urgent.push({ ref: o.ref, kind: 'production', label: 'Produksi belum dimulai', date: o.date });
    else if (o.phase === 'Ready for dispatch' && !o.tracking) out.urgent.push({ ref: o.ref, kind: 'delivery', label: 'Pengiriman belum dicatat', date: o.date });
  });
  out.urgent = out.urgent.slice(0, 20);
  return out;
}

function workloadUnits_(items) {
  var units = 0;
  (items || []).forEach(function (item) {
    var qty = Math.max(1, Number(item.qty) || 1);
    if (item.type === 'custom') {
      var stems = 0; Object.keys(item.stems || {}).forEach(function (k) { stems += Number(item.stems[k]) || 0; });
      units += qty * Math.max(1, Math.ceil(stems / 3));
    } else if (item.type === 'package') units += qty * (Number(item.id) + 1);
    else units += qty;
  });
  return units;
}

function buildSummary_(items) { return (items || []).map(function (item) { return (Number(item.qty) || 1) + '× ' + humanizeKey_(item.id || item.type); }).join('; '); }
function makeOrderReference_() { return 'ALX-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 7).toUpperCase(); }
function activeEmail_() { return String(Session.getActiveUser().getEmail() || ''); }

function manualOrderAllowed_() {
  var raw = PropertiesService.getScriptProperties().getProperty('DESK_MANUAL_ORDER_EMAILS') || '';
  var email = activeEmail_().toLowerCase();
  return !!email && raw.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean).indexOf(email) !== -1;
}

function findOrderObject_(ref, hintRow) {
  var sheet = openSheet_(); var headers = readHeaders_(sheet); var refCol = headers.map['Order Reference'];
  if (refCol === undefined) return null;
  var row = findRowByReference_(sheet, refCol, ref, hintRow);
  if (!row) return null;
  return rowToOrder_(sheet.getRange(row, 1, 1, headers.length).getValues()[0], headers, row);
}

function openSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
  return SpreadsheetApp.openById(id);
}

function ensureSupportSheet_(name, headers) {
  var spreadsheet = openSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) { sheet = spreadsheet.insertSheet(name); sheet.getRange(1, 1, 1, headers.length).setValues([headers]); sheet.setFrozenRows(1); }
  return sheet;
}

function readSupportRows_(name, width) {
  try {
    var sheet = openSpreadsheet_().getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  } catch (e) { return []; }
}

function appendActivity_(ref, action, before, after) {
  try {
    var sheet = ensureSupportSheet_(ACTIVITY_SHEET_NAME, ['Waktu', 'Order Reference', 'Aktivitas', 'Sebelum', 'Sesudah', 'Dilakukan Oleh']);
    sheet.appendRow([new Date(), String(ref), safeText_(action), safeText_(before), safeText_(after), activeEmail_()]);
  } catch (ignored) { /* The core order write already succeeded; history must not roll it back. */ }
}

function listInventory_() {
  return readSupportRows_(INVENTORY_SHEET_NAME, 5).map(function (row) { return { key: String(row[0]), name: String(row[1]), qty: Number(row[2]) || 0, unit: String(row[3] || 'buah'), updatedAt: formatDateTimeCell_(row[4]) }; });
}

function setFinalTotalFormula_(sheet, headers, row) {
  var finalCol = headers.map['Final Total']; var verifiedCol = headers.map['Verified Total']; var shippingCol = headers.map['Shipping Fee'];
  if (finalCol === undefined || verifiedCol === undefined || shippingCol === undefined) return;
  var formula = '=IF(OR(RC[' + (verifiedCol - finalCol) + ']="",RC[' + (shippingCol - finalCol) + ']=""),"",RC[' + (verifiedCol - finalCol) + ']+RC[' + (shippingCol - finalCol) + '])';
  sheet.getRange(row, finalCol + 1).setFormulaR1C1(formula);
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
