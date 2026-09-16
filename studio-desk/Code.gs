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
// Desk Ops — additive operational storage beyond the five Orders columns
// above (see STUDIO-DESK-ADDITIONAL-IMPLEMENTATION.md, ground rule 4). Seven
// small sheets, each in the same spreadsheet as Orders, each keyed by Order
// Reference, each written only through the narrow, validated commands below
// — never through updateOrder(), which stays limited to WRITABLE_FIELDS.
// Run deskOpsMigrationApply() once from the Apps Script editor to create
// them; see "Desk Ops setup" in STUDIO-DESK-SETUP.md.
// ============================================================================
var DESK_LEDGER_SHEET = 'Desk Ledger';
var DESK_LEDGER_HEADERS = ['Event ID', 'Order Reference', 'Type', 'Amount', 'Note', 'Recorded At', 'Recorded By', 'Reverses Event ID', 'Idempotency Key'];
var DESK_CHECKLIST_SHEET = 'Desk Checklist';
var DESK_CHECKLIST_HEADERS = ['Order Reference', 'Item Key', 'Content Version', 'Completed', 'Completed At', 'Completed By'];
var DESK_ACTIVITY_SHEET = 'Desk Activity';
var DESK_ACTIVITY_HEADERS = ['Event ID', 'Order Reference', 'Action', 'Detail', 'At', 'By', 'Mutation ID'];

// SD-08 — one row per order, upserted (not append-only like the ledger): the
// current agreed fulfillment commitment and internal production target,
// kept distinct from the Orders sheet's own Preferred Date (the customer's
// original, provisional request — never overwritten by this).
var DESK_SCHEDULE_SHEET = 'Desk Schedule';
var DESK_SCHEDULE_HEADERS = ['Order Reference', 'Agreed Date', 'Agreed Time', 'Production Deadline', 'Agreed At', 'Agreed By', 'Reschedule Reason'];

// SD-09 — one row per (order, package line), upserted: what she actually
// put in a studio-selected package, snapshotted so a later catalogue change
// can never rewrite what a historical order meant.
var DESK_COMPOSITION_SHEET = 'Desk Composition';
var DESK_COMPOSITION_HEADERS = ['Order Reference', 'Line Key', 'Composition JSON', 'Updated At', 'Updated By'];

// SD-10 — one row per order, upserted: delivery/pickup facts distinct from
// Work Phase. Handoff (she released it) and receipt/pickup completion
// (confirmed received) are separate timestamps — the first is never proof
// of the second.
var DESK_DELIVERY_SHEET = 'Desk Delivery';
var DESK_DELIVERY_HEADERS = [
  'Order Reference', 'Recipient Name', 'Recipient Contact', 'Destination Detail', 'Courier', 'Tracking',
  'Handoff At', 'Completed At', 'Updated At', 'Updated By'
];

// SD-11 — append-only: opening a blocker and resolving it are each their
// own row, so the history of what blocked an order and when it cleared is
// never overwritten. The CURRENT state is "the latest row for this ref
// with no Resolved At".
var DESK_BLOCKER_SHEET = 'Desk Blocker';
var DESK_BLOCKER_HEADERS = ['Event ID', 'Order Reference', 'Reason', 'Note', 'Opened At', 'Opened By', 'Resolved At', 'Resolved By'];
var BLOCKER_REASONS = ['bahan belum tersedia', 'menunggu jawaban pembeli', 'masalah pengiriman', 'lainnya'];

// receipt: money in. refund: money out. correction: a signed adjustment for
// fixing a mistake without silently editing or deleting the row it corrects
// — pair it with reversesEventId. Never delete or overwrite a ledger row.
var LEDGER_TYPES = ['receipt', 'refund', 'correction'];

var PHASE_LABELS_ID_ = {
  'Not started': 'Belum mulai', 'Assembly and packing': 'Dirangkai dan dikemas',
  'Ready for dispatch': 'Siap dikirim', 'Shipped': 'Dikirim', 'Delivered': 'Selesai', 'Cancelled': 'Dibatalkan'
};
var PAYMENT_LABELS_ID_ = {
  'Unpaid': 'Belum bayar', 'Checking transfer': 'Perlu dicek', 'Checking deposit': 'Periksa DP',
  'Deposit paid': 'DP diterima', 'Checking balance': 'Periksa pelunasan', 'Paid': 'Lunas', 'Cancelled': 'Dibatalkan'
};

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

  var ledgerSummary = getLedgerSummaryMap_();
  var reviewedMap = getReviewedMap_();
  var scheduleMap = getScheduleMap_();
  var deliveryMap = getDeliveryMap_();
  var blockerMap = getBlockerMap_();

  var orders = [];
  for (var i = 0; i < values.length; i += 1) {
    var order = rowToOrder_(values[i], headers, startRow + i);
    if (order && includeOrder_(order)) {
      attachOpsSummary_(order, ledgerSummary, reviewedMap, scheduleMap, deliveryMap, blockerMap);
      orders.push(order);
    }
  }
  return orders;
}

// A row cancelled by Work Phase (set from the sheet) used to be dropped
// entirely, while the Desk's own Dibatalkan chip matches Payment Status —
// two different notions of "cancelled" (see P5-6 in
// STUDIO-DESK-UX-REVIEW.md). Phase-cancelled rows now age out on the same
// window as Delivered rows instead of vanishing outright, so they reach
// laneMatch() and can appear under Dibatalkan.
function includeOrder_(order) {
  if (order.phase === 'Cancelled' || order.phase === 'Delivered') {
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
      // SD-01: the status string alone is not authoritative once verified
      // receipts exist — cross-check against the ledger too. An order with
      // no ledger events at all is a legacy order (or one paid before this
      // feature existed) and is not newly blocked by this; that gap is
      // exactly the reconciliation state attachOpsSummary_ surfaces instead
      // of guessing at it here.
      var verifiedCol = headers.map['Verified Total'];
      var shippingCol = headers.map['Shipping Fee'];
      var verifiedTotal = verifiedCol === undefined ? 0 : Number(sheet.getRange(row, verifiedCol + 1).getValue()) || 0;
      var shippingFee = shippingCol === undefined ? 0 : Number(sheet.getRange(row, shippingCol + 1).getValue()) || 0;
      var billedTotal = verifiedTotal + shippingFee;
      var ledgerCheck = getPaymentSummaryForRef_(ref);
      if (ledgerCheck.hasLedgerEvents && ledgerCheck.received < billedTotal) {
        return {
          ok: false, code: 'PAYMENT_DUE',
          message: 'Jumlah yang tercatat diterima (' + formatRupiah_(ledgerCheck.received) +
            ') belum mencapai total tagihan (' + formatRupiah_(billedTotal) + ').'
        };
      }
    }

    // SD-11: an open blocker never cancels an order or erases its
    // progress, but it does hold forward work — moving deeper into the
    // phase sequence — until resolved. Moving backward (Kembali) and
    // everything else (payment, notes, cara pembayaran) stays usable.
    if (field === 'phase') {
      var currentPhaseValue = String(sheet.getRange(row, colIdx + 1).getValue());
      var currentPhaseIdx = PHASE_VALUES.indexOf(currentPhaseValue);
      var targetPhaseIdx = PHASE_VALUES.indexOf(validated.value);
      if (targetPhaseIdx > currentPhaseIdx) {
        var openBlocker = getOpenBlocker_(ref);
        if (openBlocker) {
          return {
            ok: false, code: 'BLOCKED',
            message: 'Pesanan ini masih ada kendala (' + openBlocker.reason + ') — selesaikan dulu sebelum melanjutkan tahap kerja.'
          };
        }
      }
    }

    sheet.getRange(row, colIdx + 1).setValue(validated.value);

    // Best-effort activity log entry for the change just made. This is a
    // second sheet write outside the Orders write above — Apps Script has
    // no cross-sheet transaction, so logActivity_ never throws and never
    // rolls back a write that has already succeeded. See SD-03 in
    // STUDIO-DESK-ADDITIONAL-IMPLEMENTATION.md.
    var activityDetail = updateActivityDetail_(field, validated.value);
    if (activityDetail) logActivity_(ref, activityDetail.action, activityDetail.detail, '');

    var rowValues = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    return { ok: true, order: attachOpsSummaryForSingle_(rowToOrder_(rowValues, headers, row)) };
  } finally {
    lock.releaseLock();
  }
}

function updateActivityDetail_(field, value) {
  if (field === 'phase') {
    return { action: 'phase_changed', detail: 'Tahap kerja: ' + (PHASE_LABELS_ID_[value] || value) };
  }
  if (field === 'payment') {
    return { action: 'payment_status_changed', detail: 'Status pembayaran: ' + (PAYMENT_LABELS_ID_[value] || value) };
  }
  return null;
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
// Desk Ops sheet access — a missing sheet throws a clear, actionable error
// rather than failing obscurely; run deskOpsMigrationApply() first.
// ============================================================================
function openOpsSheet_(name) {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
  var spreadsheet = SpreadsheetApp.openById(id);
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet "' + name + '" belum ada. Jalankan deskOpsMigrationApply() dari editor Apps Script ' +
      '(lihat "Desk Ops setup" di STUDIO-DESK-SETUP.md).');
  }
  return sheet;
}

// ============================================================================
// Migration — additive and repeatable. Never removes or reorders a column,
// never touches the Orders sheet, and re-running it is always safe: a sheet
// or header that already exists is left exactly as it is. Run
// deskOpsMigrationDryRun() first from the Apps Script editor (View > Logs
// for the report), then deskOpsMigrationApply() to actually create
// anything. See "Desk Ops setup" in STUDIO-DESK-SETUP.md.
// ============================================================================
function ensureDeskOpsSheets_(apply) {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
  var spreadsheet = SpreadsheetApp.openById(id);
  var specs = [
    { name: DESK_LEDGER_SHEET, headers: DESK_LEDGER_HEADERS },
    { name: DESK_CHECKLIST_SHEET, headers: DESK_CHECKLIST_HEADERS },
    { name: DESK_ACTIVITY_SHEET, headers: DESK_ACTIVITY_HEADERS },
    { name: DESK_SCHEDULE_SHEET, headers: DESK_SCHEDULE_HEADERS },
    { name: DESK_COMPOSITION_SHEET, headers: DESK_COMPOSITION_HEADERS },
    { name: DESK_DELIVERY_SHEET, headers: DESK_DELIVERY_HEADERS },
    { name: DESK_BLOCKER_SHEET, headers: DESK_BLOCKER_HEADERS }
  ];
  var report = [];
  specs.forEach(function (spec) {
    var sheet = spreadsheet.getSheetByName(spec.name);
    if (!sheet) {
      report.push(spec.name + ': MISSING' + (apply ? ' -> creating' : ' (dry run — would create)'));
      if (apply) {
        sheet = spreadsheet.insertSheet(spec.name);
        sheet.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers]);
        sheet.setFrozenRows(1);
      }
      return;
    }
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v || '').trim(); });
    var missing = spec.headers.filter(function (h) { return existing.indexOf(h) === -1; });
    if (missing.length) {
      report.push(spec.name + ': present, MISSING HEADERS [' + missing.join(', ') + ']' +
        (apply ? ' -> appending' : ' (dry run — would append)'));
      if (apply) {
        var startCol = existing.length + 1;
        missing.forEach(function (h, i) { sheet.getRange(1, startCol + i).setValue(h); });
      }
    } else {
      report.push(spec.name + ': OK (' + existing.length + ' columns, all expected headers present)');
    }
  });
  var text = report.join('\n');
  Logger.log(text);
  return text;
}

// Select this function in the Apps Script editor and press Run, then check
// View > Logs — reports what the migration would do without changing
// anything.
function deskOpsMigrationDryRun() {
  return ensureDeskOpsSheets_(false);
}

// Select this function in the Apps Script editor and press Run to actually
// create the seven Desk Ops sheets (or add any headers missing from an
// existing one). Safe to re-run.
function deskOpsMigrationApply() {
  return ensureDeskOpsSheets_(true);
}

// ============================================================================
// Money formatting for server-composed messages (activity log text, error
// messages) — no locale API dependency, just thousands separators.
// ============================================================================
function formatRupiah_(n) {
  var neg = n < 0;
  var s = String(Math.round(Math.abs(Number(n) || 0)));
  var out = '';
  while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
  out = s + out;
  return (neg ? '-' : '') + 'Rp ' + out;
}

// ============================================================================
// A stable identity for a line item's own content, independent of its
// position in the order — reordering items must not invalidate their
// checklist state (SD-02), but editing an item's content must invalidate
// only that item's own check. Mirrored exactly in Index.html's own script
// (client-side rendering cannot call back into this file); keep both in
// sync if either changes.
// ============================================================================
function canonicalJson_(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson_).join(',') + ']';
  var keys = Object.keys(value).sort();
  return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalJson_(value[k]); }).join(',') + '}';
}

function itemContentKey_(item) {
  var sig = canonicalJson_(item || {});
  var hash = 5381;
  for (var i = 0; i < sig.length; i += 1) {
    hash = ((hash * 33) ^ sig.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

// Disambiguates identical items (two identical custom bouquets, say) by
// their order of appearance among items sharing the same content hash —
// reordering two DIFFERENT items never changes either one's key, and
// swapping two IDENTICAL items is unobservable by definition.
function itemChecklistKeys_(items) {
  var seen = {};
  return (items || []).map(function (item) {
    var base = itemContentKey_(item);
    var n = seen[base] = (seen[base] || 0) + 1;
    return 'item:' + base + '#' + n;
  });
}

// ============================================================================
// SD-01 — payment ledger. Immutable, append-only events; a correction or
// refund is its own new event, never an edit to a past one. Idempotent by
// idempotencyKey: retrying the same command after a lost response, or a
// double tap, records the receipt once.
// ============================================================================
function recordPayment(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  var type = String(payload.type || '');
  var idempotencyKey = String(payload.idempotencyKey || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };
  if (LEDGER_TYPES.indexOf(type) === -1) {
    return { ok: false, code: 'BAD_TYPE', message: 'Jenis catatan pembayaran tidak dikenali.' };
  }
  if (!idempotencyKey) {
    return { ok: false, code: 'BAD_KEY', message: 'Permintaan ini tidak lengkap — coba lagi.' };
  }
  var amount = Number(payload.amount);
  if (!isFinite(amount) || amount === 0) {
    return { ok: false, code: 'BAD_AMOUNT', message: 'Jumlah harus berupa angka dan tidak nol.' };
  }
  if (type !== 'correction' && amount < 0) {
    return { ok: false, code: 'BAD_AMOUNT', message: 'Jumlah harus lebih dari nol untuk penerimaan atau pengembalian dana.' };
  }
  var note = safeText_(String(payload.note || '').slice(0, 500));

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  }
  try {
    var sheet = openOpsSheet_(DESK_LEDGER_SHEET);
    var existing = findLedgerEventByIdempotencyKey_(sheet, idempotencyKey);
    if (existing) {
      // The same command, retried after a lost response or a double tap —
      // return the original event instead of recording the receipt twice.
      return { ok: true, event: existing, summary: getPaymentSummaryForRef_(ref), idempotentReplay: true };
    }

    var signedAmount = type === 'refund' ? -Math.abs(amount) : amount;
    var eventId = 'pay_' + Utilities.getUuid();
    var by = String(Session.getActiveUser().getEmail() || '');
    var recordedAt = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var reverses = payload.reversesEventId ? String(payload.reversesEventId) : '';
    sheet.appendRow([eventId, ref, type, signedAmount, note, recordedAt, by, reverses, idempotencyKey]);

    var actionLabel = type === 'receipt' ? 'Pembayaran diterima' : (type === 'refund' ? 'Dana dikembalikan' : 'Koreksi pembayaran');
    logActivity_(ref, 'payment_recorded', actionLabel + ': ' + formatRupiah_(Math.abs(signedAmount)) + (note ? ' — ' + note : ''), idempotencyKey);

    return {
      ok: true,
      event: { eventId: eventId, ref: ref, type: type, amount: signedAmount, note: note, recordedAt: recordedAt, recordedBy: by },
      summary: getPaymentSummaryForRef_(ref)
    };
  } finally {
    lock.releaseLock();
  }
}

function findLedgerEventByIdempotencyKey_(sheet, idempotencyKey) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_LEDGER_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][8]) === idempotencyKey) return rowToLedgerEvent_(values[i]);
  }
  return null;
}

function rowToLedgerEvent_(row) {
  return {
    eventId: String(row[0]), ref: String(row[1]), type: String(row[2]), amount: Number(row[3]),
    note: String(row[4] || ''), recordedAt: String(row[5] || ''), recordedBy: String(row[6] || ''),
    reversesEventId: String(row[7] || '')
  };
}

// Single-reference summary — used by updateOrder()'s dispatch check and by
// recordPayment()'s own return value. Degrades to "no ledger events" if the
// Desk Ops sheets haven't been migrated yet, exactly like
// getLedgerSummaryMap_ — an un-migrated shop must not have every dispatch
// blocked by a missing sheet it doesn't know it needs.
function getPaymentSummaryForRef_(ref) {
  var sheet;
  try { sheet = openOpsSheet_(DESK_LEDGER_SHEET); } catch (e) { return { received: 0, hasLedgerEvents: false }; }
  var lastRow = sheet.getLastRow();
  var received = 0;
  var hasEvents = false;
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, DESK_LEDGER_HEADERS.length).getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][1]) !== ref) continue;
      hasEvents = true;
      received += Number(values[i][3]) || 0;
    }
  }
  return { received: received, hasLedgerEvents: hasEvents };
}

// Whole-sheet summary, read once and reused across every order — used by
// listOrders() so it never scans the ledger once per order.
function getLedgerSummaryMap_() {
  var map = {};
  var sheet;
  try { sheet = openOpsSheet_(DESK_LEDGER_SHEET); } catch (e) { return map; } // ops sheets are optional until migration runs
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_LEDGER_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var ref = String(values[i][1]);
    if (!ref) continue;
    if (!map[ref]) map[ref] = { received: 0, hasLedgerEvents: false };
    map[ref].received += Number(values[i][3]) || 0;
    map[ref].hasLedgerEvents = true;
  }
  return map;
}

function getPaymentLedger(ref) {
  checkAccess_();
  ref = String(ref || '');
  var sheet;
  try { sheet = openOpsSheet_(DESK_LEDGER_SHEET); } catch (e) { return []; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_LEDGER_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][1]) !== ref) continue;
    out.push(rowToLedgerEvent_(values[i]));
  }
  return out;
}

// Layers the additive Desk Ops records (payment ledger, review completion)
// onto an order read from the Orders sheet. Never derives a receipt or a
// review from anything but an explicit Desk Ops record — a legacy order
// whose Payment Status implies money already changed hands, but which has
// no ledger events, is surfaced as needing reconciliation rather than
// being silently treated as freshly unpaid or, worse, as fully received.
function attachOpsSummary_(order, ledgerSummary, reviewedMap, scheduleMap, deliveryMap, blockerMap) {
  var ledger = ledgerSummary[order.ref];
  order.received = ledger ? ledger.received : 0;
  order.hasLedgerEvents = !!(ledger && ledger.hasLedgerEvents);
  var impliesPastPayment = ['Deposit paid', 'Checking balance', 'Paid'].indexOf(order.payment) !== -1;
  order.paymentReconciliation = (!order.hasLedgerEvents && impliesPastPayment) ? 'legacy_unreconciled' : 'known';
  var reviewed = reviewedMap[order.ref];
  order.reviewedAt = reviewed ? reviewed.reviewedAt : '';
  order.reviewedBy = reviewed ? reviewed.reviewedBy : '';
  order.schedule = (scheduleMap && scheduleMap[order.ref]) || null;
  order.delivery = (deliveryMap && deliveryMap[order.ref]) || null;
  order.blocker = (blockerMap && blockerMap[order.ref]) || null;
}

// Single-order equivalent of attachOpsSummary_, for updateOrder()'s and
// recordPayment()'s single-order responses, where a fresh bulk scan isn't
// warranted.
function attachOpsSummaryForSingle_(order) {
  if (!order) return order;
  var ledger = getPaymentSummaryForRef_(order.ref);
  order.received = ledger.received;
  order.hasLedgerEvents = ledger.hasLedgerEvents;
  var impliesPastPayment = ['Deposit paid', 'Checking balance', 'Paid'].indexOf(order.payment) !== -1;
  order.paymentReconciliation = (!order.hasLedgerEvents && impliesPastPayment) ? 'legacy_unreconciled' : 'known';
  var reviewed = getReviewedForRef_(order.ref);
  order.reviewedAt = reviewed.reviewedAt;
  order.reviewedBy = reviewed.reviewedBy;
  order.schedule = getSchedule_(order.ref);
  order.delivery = getDelivery_(order.ref);
  order.blocker = getOpenBlocker_(order.ref);
  return order;
}

// ============================================================================
// SD-02 — durable checklist. One row per (Order Reference, Item Key),
// upserted in place — a toggle is idempotent by nature, unlike a payment
// receipt. Browser-side state is a cache of this, never the saved truth.
// ============================================================================
function getChecklist(ref) {
  checkAccess_();
  ref = String(ref || '');
  var sheet;
  try { sheet = openOpsSheet_(DESK_CHECKLIST_SHEET); } catch (e) { return []; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_CHECKLIST_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) !== ref) continue;
    out.push({
      key: String(values[i][1]), contentVersion: String(values[i][2] || ''),
      completed: values[i][3] === true || String(values[i][3]).toLowerCase() === 'true',
      completedAt: String(values[i][4] || ''), completedBy: String(values[i][5] || '')
    });
  }
  return out;
}

function setChecklistItem(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  var key = String(payload.key || '');
  var contentVersion = String(payload.contentVersion || '');
  var completed = payload.completed === true;
  if (!ref || !key) return { ok: false, code: 'BAD_KEY', message: 'Referensi atau kunci centang tidak valid.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  }
  try {
    var sheet = openOpsSheet_(DESK_CHECKLIST_SHEET);
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var row = [ref, key, contentVersion, completed, completed ? at : '', completed ? by : ''];
    upsertRow_(sheet, [ref, key], row);
    return { ok: true, item: { key: key, contentVersion: contentVersion, completed: completed, completedAt: row[4], completedBy: row[5] } };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// SD-03 — activity log. logActivity_ is the internal, best-effort writer
// used from inside updateOrder()/recordPayment()/markReviewed(); getActivity
// is the public read for the Riwayat panel.
// ============================================================================
function logActivity_(ref, action, detail, mutationId) {
  try {
    var sheet = openOpsSheet_(DESK_ACTIVITY_SHEET);
    var eventId = 'act_' + Utilities.getUuid();
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([eventId, ref, action, detail, at, by, mutationId || '']);
  } catch (e) {
    // Best-effort: whatever this call accompanies (an Orders write, a
    // ledger event) has already succeeded by the time this runs. Apps
    // Script cannot write to two sheets in one transaction — losing an
    // activity log entry must never roll back or mask a real write.
  }
}

function getActivity(ref) {
  checkAccess_();
  ref = String(ref || '');
  var sheet;
  try { sheet = openOpsSheet_(DESK_ACTIVITY_SHEET); } catch (e) { return []; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_ACTIVITY_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][1]) !== ref) continue;
    out.push({ action: String(values[i][2] || ''), detail: String(values[i][3] || ''), at: String(values[i][4] || ''), by: String(values[i][5] || '') });
  }
  out.reverse(); // newest first
  return out.slice(0, 50);
}

// ============================================================================
// SD-04 — explicit review completion. Idempotent: marking an already
// reviewed order returns the existing record rather than creating a
// duplicate, so a retried command or a double tap cannot produce two
// "reviewed" entries.
// ============================================================================
function markReviewed(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  }
  try {
    var existing = getReviewedForRef_(ref);
    if (existing.reviewedAt) {
      return { ok: true, reviewedAt: existing.reviewedAt, reviewedBy: existing.reviewedBy, idempotentReplay: true };
    }
    var sheet = openOpsSheet_(DESK_ACTIVITY_SHEET);
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var eventId = 'act_' + Utilities.getUuid();
    sheet.appendRow([eventId, ref, 'reviewed', 'Pesanan ditinjau', at, by, '']);
    return { ok: true, reviewedAt: at, reviewedBy: by };
  } finally {
    lock.releaseLock();
  }
}

function getReviewedForRef_(ref) {
  var sheet;
  try { sheet = openOpsSheet_(DESK_ACTIVITY_SHEET); } catch (e) { return { reviewedAt: '', reviewedBy: '' }; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { reviewedAt: '', reviewedBy: '' };
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_ACTIVITY_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][1]) === ref && String(values[i][2]) === 'reviewed') {
      return { reviewedAt: String(values[i][4] || ''), reviewedBy: String(values[i][5] || '') };
    }
  }
  return { reviewedAt: '', reviewedBy: '' };
}

function getReviewedMap_() {
  var map = {};
  var sheet;
  try { sheet = openOpsSheet_(DESK_ACTIVITY_SHEET); } catch (e) { return map; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_ACTIVITY_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][2]) !== 'reviewed') continue;
    map[String(values[i][1])] = { reviewedAt: String(values[i][4] || ''), reviewedBy: String(values[i][5] || '') };
  }
  return map;
}

// ============================================================================
// Shared "one current row per key" upsert — Desk Schedule, Desk
// Composition, and Desk Delivery all keep exactly one current row per key
// and overwrite it in place (unlike the append-only Desk Ledger/Blocker).
// ============================================================================
function upsertRow_(sheet, keyValues, rowValues) {
  var lastRow = sheet.getLastRow();
  var foundRow = 0;
  if (lastRow >= 2) {
    var keyLen = keyValues.length;
    var existing = sheet.getRange(2, 1, lastRow - 1, keyLen).getValues();
    for (var i = 0; i < existing.length; i += 1) {
      var match = true;
      for (var k = 0; k < keyLen; k += 1) {
        if (String(existing[i][k]) !== String(keyValues[k])) { match = false; break; }
      }
      if (match) { foundRow = i + 2; break; }
    }
  }
  if (foundRow) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function validateDateStr_(s) {
  if (s === '' || s === null || s === undefined) return { ok: true, value: '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return { ok: false };
  var d = new Date(String(s) + 'T00:00:00');
  if (isNaN(d.getTime())) return { ok: false };
  return { ok: true, value: String(s) };
}

function validateTimeStr_(s) {
  if (s === '' || s === null || s === undefined) return { ok: true, value: '' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s))) return { ok: false };
  return { ok: true, value: String(s) };
}

// ============================================================================
// SD-08 — scheduling. Preferred Date on the Orders sheet stays the
// customer's original, provisional request; this is the current agreed
// commitment and internal production target, entirely separate and never
// overwriting it.
// ============================================================================
function setSchedule(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };

  var agreedDateV = validateDateStr_(payload.agreedDate);
  if (!agreedDateV.ok) return { ok: false, code: 'BAD_DATE', message: 'Tanggal yang disepakati tidak valid.' };
  var agreedTimeV = validateTimeStr_(payload.agreedTime);
  if (!agreedTimeV.ok) return { ok: false, code: 'BAD_TIME', message: 'Jam yang disepakati tidak valid.' };
  var deadlineV = validateDateStr_(payload.productionDeadline);
  if (!deadlineV.ok) return { ok: false, code: 'BAD_DEADLINE', message: 'Target produksi tidak valid.' };

  // The production target exists to make sure making finishes in time to
  // dispatch by the agreed date — it must not fall after it.
  if (agreedDateV.value && deadlineV.value && deadlineV.value > agreedDateV.value) {
    return { ok: false, code: 'INCONSISTENT_DATES', message: 'Target produksi tidak boleh lebih lambat dari tanggal yang disepakati.' };
  }

  var note = safeText_(String(payload.rescheduleReason || '').slice(0, 300));

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var sheet = openOpsSheet_(DESK_SCHEDULE_SHEET);
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var row = [ref, agreedDateV.value, agreedTimeV.value, deadlineV.value, at, by, note];
    upsertRow_(sheet, [ref], row);

    var detailParts = [];
    if (agreedDateV.value) detailParts.push('tanggal disepakati ' + agreedDateV.value + (agreedTimeV.value ? ' ' + agreedTimeV.value : ''));
    if (deadlineV.value) detailParts.push('target produksi ' + deadlineV.value);
    logActivity_(ref, 'schedule_changed', 'Jadwal diperbarui: ' + (detailParts.join(', ') || 'dikosongkan') + (note ? ' — ' + note : ''), '');

    return {
      ok: true,
      schedule: {
        agreedDate: agreedDateV.value, agreedTime: agreedTimeV.value, productionDeadline: deadlineV.value,
        agreedAt: at, agreedBy: by, rescheduleReason: note
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function rowToSchedule_(row) {
  return {
    agreedDate: String(row[1] || ''), agreedTime: String(row[2] || ''), productionDeadline: String(row[3] || ''),
    agreedAt: String(row[4] || ''), agreedBy: String(row[5] || ''), rescheduleReason: String(row[6] || '')
  };
}

function getSchedule_(ref) {
  var sheet;
  try { sheet = openOpsSheet_(DESK_SCHEDULE_SHEET); } catch (e) { return null; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_SCHEDULE_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === ref) return rowToSchedule_(values[i]);
  }
  return null;
}

function getSchedule(ref) {
  checkAccess_();
  return getSchedule_(String(ref || ''));
}

function getScheduleMap_() {
  var map = {};
  var sheet;
  try { sheet = openOpsSheet_(DESK_SCHEDULE_SHEET); } catch (e) { return map; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_SCHEDULE_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var ref = String(values[i][0]);
    if (ref) map[ref] = rowToSchedule_(values[i]);
  }
  return map;
}

// ============================================================================
// SD-09 — package composition snapshot. Line Key reuses the same
// itemChecklistKeys_ scheme as Desk Checklist (content-derived, stable
// across reordering) so a package's composition and its make-list check
// are always talking about the same physical line. Labels are snapshotted
// into the stored JSON so a later catalogue edit or removal can never
// rewrite what a historical order actually meant.
// ============================================================================
function catalogForValidation_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CATALOG_CACHE_KEY);
  return hit ? JSON.parse(hit) : fetchAndCacheCatalog_();
}

function setComposition(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  var lineKey = String(payload.lineKey || '');
  if (!ref || !lineKey) return { ok: false, code: 'BAD_KEY', message: 'Referensi atau baris paket tidak valid.' };

  var rawStems = (payload.stems && typeof payload.stems === 'object') ? payload.stems : {};
  var rawAdditions = (payload.additions && typeof payload.additions === 'object') ? payload.additions : {};
  var cleanStems = {};
  var stemTotal = 0;
  Object.keys(rawStems).forEach(function (k) {
    var n = Math.round(Number(rawStems[k]));
    if (isFinite(n) && n > 0) { cleanStems[String(k)] = n; stemTotal += n; }
  });
  var cleanAdditions = {};
  Object.keys(rawAdditions).forEach(function (k) {
    var n = Math.round(Number(rawAdditions[k]));
    if (isFinite(n) && n > 0) cleanAdditions[String(k)] = n;
  });
  if (stemTotal <= 0) return { ok: false, code: 'BAD_COMPOSITION', message: 'Isi komposisi paket dulu — pilih bunga dan jumlahnya.' };

  var catalog = catalogForValidation_();
  var pkg = (catalog.packages || [])[Number(payload.packageIndex)];
  if (pkg && typeof pkg.stems === 'number' && stemTotal !== pkg.stems) {
    return {
      ok: false, code: 'STEM_COUNT_MISMATCH',
      message: 'Jumlah tangkai (' + stemTotal + ') harus sama dengan spesifikasi paket (' + pkg.stems + ' tangkai).'
    };
  }

  var snapshot = {
    stems: Object.keys(cleanStems).map(function (k) {
      return { key: k, qty: cleanStems[k], name: resolveLabel_(catalog.flowers, k).name };
    }),
    additions: Object.keys(cleanAdditions).map(function (k) {
      return { key: k, qty: cleanAdditions[k], name: resolveLabel_(catalog.additions, k).name };
    })
  };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var sheet = openOpsSheet_(DESK_COMPOSITION_SHEET);
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    upsertRow_(sheet, [ref, lineKey], [ref, lineKey, JSON.stringify(snapshot), at, by]);

    // A composition change invalidates whatever was already ticked for
    // this same line in the make-list — see SD-09's "invalidate affected
    // completion checks if composition changes after work starts".
    try {
      var checklistSheet = openOpsSheet_(DESK_CHECKLIST_SHEET);
      upsertRow_(checklistSheet, [ref, lineKey], [ref, lineKey, '', false, '', '']);
    } catch (checklistError) { /* checklist sheet optional; nothing to invalidate if absent */ }

    logActivity_(ref, 'composition_set', 'Komposisi paket dicatat: ' + stemTotal + ' tangkai', '');
    return { ok: true, composition: snapshot };
  } finally {
    lock.releaseLock();
  }
}

function getComposition(ref) {
  checkAccess_();
  ref = String(ref || '');
  var sheet;
  try { sheet = openOpsSheet_(DESK_COMPOSITION_SHEET); } catch (e) { return []; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_COMPOSITION_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) !== ref) continue;
    var parsed = null;
    try { parsed = JSON.parse(String(values[i][2] || 'null')); } catch (parseError) { parsed = null; }
    out.push({ lineKey: String(values[i][1]), composition: parsed, updatedAt: String(values[i][3] || ''), updatedBy: String(values[i][4] || '') });
  }
  return out;
}

// ============================================================================
// SD-10 — delivery and pickup records, distinct from Work Phase. Handoff
// (she released the goods) and completion (confirmed received/picked up)
// are separate, each stamped server-side at call time — never trusting a
// client-supplied timestamp — and each idempotent (an already-recorded
// timestamp is never silently overwritten by a retry).
// ============================================================================
function rowToDelivery_(row) {
  return {
    recipientName: String(row[1] || ''), recipientContact: String(row[2] || ''), destinationDetail: String(row[3] || ''),
    courier: String(row[4] || ''), tracking: String(row[5] || ''), handoffAt: String(row[6] || ''),
    completedAt: String(row[7] || ''), updatedAt: String(row[8] || ''), updatedBy: String(row[9] || '')
  };
}

function getDelivery_(ref) {
  var sheet;
  try { sheet = openOpsSheet_(DESK_DELIVERY_SHEET); } catch (e) { return null; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_DELIVERY_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === ref) return rowToDelivery_(values[i]);
  }
  return null;
}

function getDelivery(ref) {
  checkAccess_();
  return getDelivery_(String(ref || ''));
}

function getDeliveryMap_() {
  var map = {};
  var sheet;
  try { sheet = openOpsSheet_(DESK_DELIVERY_SHEET); } catch (e) { return map; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_DELIVERY_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var ref = String(values[i][0]);
    if (ref) map[ref] = rowToDelivery_(values[i]);
  }
  return map;
}

// Accepts empty, a bare code/text, or an http(s) URL — anything else
// (javascript:, data:, or a malformed scheme) is rejected outright, so the
// client can safely decide whether to render this as a clickable link.
function validateTracking_(value) {
  var text = String(value || '').trim();
  if (!text) return { ok: true, value: '', isUrl: false };
  if (/^https?:\/\/\S+$/i.test(text)) return { ok: true, value: text.slice(0, 500), isUrl: true };
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return { ok: false };
  return { ok: true, value: safeText_(text.slice(0, 200)), isUrl: false };
}

function setDeliveryInfo(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };

  var trackingV = validateTracking_(payload.tracking);
  if (!trackingV.ok) return { ok: false, code: 'BAD_TRACKING', message: 'Nomor/tautan lacak tidak valid.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var sheet = openOpsSheet_(DESK_DELIVERY_SHEET);
    var existing = getDelivery_(ref) || {};
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var row = [
      ref,
      safeText_(String(payload.recipientName !== undefined ? payload.recipientName : (existing.recipientName || '')).slice(0, 200)),
      safeText_(String(payload.recipientContact !== undefined ? payload.recipientContact : (existing.recipientContact || '')).slice(0, 200)),
      safeText_(String(payload.destinationDetail !== undefined ? payload.destinationDetail : (existing.destinationDetail || '')).slice(0, 500)),
      safeText_(String(payload.courier !== undefined ? payload.courier : (existing.courier || '')).slice(0, 200)),
      payload.tracking !== undefined ? trackingV.value : (existing.tracking || ''),
      existing.handoffAt || '', existing.completedAt || '', at, by
    ];
    upsertRow_(sheet, [ref], row);
    logActivity_(ref, 'delivery_updated', 'Info pengantaran diperbarui.', '');
    return { ok: true, delivery: rowToDelivery_(row) };
  } finally {
    lock.releaseLock();
  }
}

// Shared by markHandoff() below — goods must not leave the studio (courier
// OR self-pickup) ahead of full payment. Mirrors updateOrder()'s own
// Shipped/Delivered check, including the SD-01 ledger cross-check, so
// pickup can never bypass the same rule shipping is held to.
function requirePaymentComplete_(ref) {
  var sheet = openSheet_();
  var headers = readHeaders_(sheet);
  var refCol = headers.map['Order Reference'];
  var row = findRowByReference_(sheet, refCol, ref, null);
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Pesanan dengan referensi ini tidak ditemukan lagi.' };
  var paymentCol = headers.map['Payment Status'];
  var currentPayment = paymentCol === undefined ? '' : sheet.getRange(row, paymentCol + 1).getValue();
  if (String(currentPayment) !== 'Paid') {
    return { ok: false, code: 'PAYMENT_DUE', message: 'Pelunasan harus diterima sebelum pesanan diserahkan.' };
  }
  var verifiedCol = headers.map['Verified Total'];
  var shippingCol = headers.map['Shipping Fee'];
  var verifiedTotal = verifiedCol === undefined ? 0 : Number(sheet.getRange(row, verifiedCol + 1).getValue()) || 0;
  var shippingFee = shippingCol === undefined ? 0 : Number(sheet.getRange(row, shippingCol + 1).getValue()) || 0;
  var billedTotal = verifiedTotal + shippingFee;
  var ledgerCheck = getPaymentSummaryForRef_(ref);
  if (ledgerCheck.hasLedgerEvents && ledgerCheck.received < billedTotal) {
    return { ok: false, code: 'PAYMENT_DUE', message: 'Jumlah yang tercatat diterima belum mencapai total tagihan.' };
  }
  return { ok: true };
}

function markHandoff(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var existing = getDelivery_(ref) || {};
    if (existing.handoffAt) return { ok: true, delivery: existing, idempotentReplay: true };

    var paymentCheck = requirePaymentComplete_(ref);
    if (!paymentCheck.ok) return paymentCheck;

    var openBlockerForHandoff = getOpenBlocker_(ref);
    if (openBlockerForHandoff) {
      return {
        ok: false, code: 'BLOCKED',
        message: 'Pesanan ini masih ada kendala (' + openBlockerForHandoff.reason + ') — selesaikan dulu sebelum menyerahkan pesanan.'
      };
    }

    var sheet = openOpsSheet_(DESK_DELIVERY_SHEET);
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var row = [
      ref, existing.recipientName || '', existing.recipientContact || '', existing.destinationDetail || '',
      existing.courier || '', existing.tracking || '', at, existing.completedAt || '', at, by
    ];
    upsertRow_(sheet, [ref], row);
    logActivity_(ref, 'handoff_recorded', 'Pesanan diserahkan untuk pengiriman/diambil.', '');
    return { ok: true, delivery: rowToDelivery_(row) };
  } finally {
    lock.releaseLock();
  }
}

function markDeliveryComplete(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var existing = getDelivery_(ref) || {};
    if (existing.completedAt) return { ok: true, delivery: existing, idempotentReplay: true };

    var sheet = openOpsSheet_(DESK_DELIVERY_SHEET);
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var row = [
      ref, existing.recipientName || '', existing.recipientContact || '', existing.destinationDetail || '',
      existing.courier || '', existing.tracking || '', existing.handoffAt || '', at, at, by
    ];
    upsertRow_(sheet, [ref], row);
    logActivity_(ref, 'delivery_completed', 'Pesanan dikonfirmasi diterima/diambil.', '');
    return { ok: true, delivery: rowToDelivery_(row) };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// SD-11 — explicit blockers. Append-only: opening and resolving are
// distinct, timestamped events, so a blocker's full lifecycle is never
// silently rewritten. At most one blocker is open per order at a time —
// calling setBlocker() again while one is already open just returns the
// existing one instead of opening a second; resolve it first to record a
// different reason. A blocker never touches Work Phase, Payment Status, or
// any checklist/ledger state — see updateOrder()/markHandoff() for the
// narrow "holds forward work only" enforcement.
// ============================================================================
function rowToBlocker_(row, rowIndex) {
  return {
    eventId: String(row[0]), ref: String(row[1]), reason: String(row[2] || ''), note: String(row[3] || ''),
    openedAt: String(row[4] || ''), openedBy: String(row[5] || ''), resolvedAt: String(row[6] || ''), resolvedBy: String(row[7] || ''),
    row: rowIndex
  };
}

function getOpenBlocker_(ref) {
  var sheet;
  try { sheet = openOpsSheet_(DESK_BLOCKER_SHEET); } catch (e) { return null; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_BLOCKER_HEADERS.length).getValues();
  var found = null;
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][1]) !== ref || String(values[i][6] || '')) continue;
    found = rowToBlocker_(values[i], i + 2);
  }
  return found;
}

function getBlocker(ref) {
  checkAccess_();
  return getOpenBlocker_(String(ref || ''));
}

function getBlockerMap_() {
  var map = {};
  var sheet;
  try { sheet = openOpsSheet_(DESK_BLOCKER_SHEET); } catch (e) { return map; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var values = sheet.getRange(2, 1, lastRow - 1, DESK_BLOCKER_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var ref = String(values[i][1]);
    if (!ref || String(values[i][6] || '')) continue;
    map[ref] = rowToBlocker_(values[i], i + 2);
  }
  return map;
}

function setBlocker(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  var reason = String(payload.reason || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };
  if (BLOCKER_REASONS.indexOf(reason) === -1) return { ok: false, code: 'BAD_REASON', message: 'Alasan kendala tidak dikenali.' };
  var note = safeText_(String(payload.note || '').slice(0, 500));

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var existing = getOpenBlocker_(ref);
    if (existing) return { ok: true, blocker: existing, idempotentReplay: true };

    var sheet = openOpsSheet_(DESK_BLOCKER_SHEET);
    var eventId = 'blk_' + Utilities.getUuid();
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([eventId, ref, reason, note, at, by, '', '']);
    logActivity_(ref, 'blocker_opened', 'Kendala: ' + reason + (note ? ' — ' + note : ''), '');
    return { ok: true, blocker: { eventId: eventId, ref: ref, reason: reason, note: note, openedAt: at, openedBy: by, resolvedAt: '', resolvedBy: '' } };
  } finally {
    lock.releaseLock();
  }
}

function resolveBlocker(payload) {
  checkAccess_();
  payload = payload || {};
  var ref = String(payload.ref || '');
  if (!ref) return { ok: false, code: 'BAD_REF', message: 'Referensi pesanan tidak valid.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCKED', message: 'Sheet sedang dipakai proses lain. Coba lagi sebentar.' };
  try {
    var existing = getOpenBlocker_(ref);
    if (!existing) return { ok: true, blocker: null, idempotentReplay: true };

    var sheet = openOpsSheet_(DESK_BLOCKER_SHEET);
    var by = String(Session.getActiveUser().getEmail() || '');
    var at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(existing.row, 7, 1, 2).setValues([[at, by]]);
    logActivity_(ref, 'blocker_resolved', 'Kendala selesai: ' + existing.reason, '');
    return { ok: true, blocker: null };
  } finally {
    lock.releaseLock();
  }
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
  // Computed fresh on every call, never cached with the rest of the
  // catalogue — the client uses this in place of the device clock for its
  // "hari ini"/"terlambat" math (see P5-7 in STUDIO-DESK-UX-REVIEW.md), so
  // it must stay accurate across midnight even while the catalogue is
  // served from a stale cache hit.
  labels.serverToday = todayStr_();
  return labels;
}

function refreshCatalog() {
  checkAccess_();
  CacheService.getScriptCache().remove(CATALOG_CACHE_KEY);
  var labels = fetchAndCacheCatalog_();
  labels.bank = bankInfo_();
  labels.serverToday = todayStr_();
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
