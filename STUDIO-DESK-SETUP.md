# Set up the Alxanthia Studio Desk

This guide is written for the store owner. You do not need to know how to program: follow each step in order and copy the supplied code exactly.

## What you are setting up

```text
Website → Cloudflare Worker → Apps Script "Order Writer" → Orders sheet   (existing, do not touch)
                                                                ↕
                                          Apps Script "Studio Desk" (new, standalone)
                                                                ↕
                                        site-content.json on alxanthia.com (built from site-content.js; labels only)
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
```

5. Click the **+** next to *Files*, choose **HTML**, name it exactly `Index` (no `.html`), delete
   what is there, and paste in the page below in full, then save.

```html
<title>Alxanthia Studio Desk</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">

<style>
  /* ---------------------------------------------------------------------
     Alxanthia Studio Desk — maker-facing order interface.
     Palette comes from the studio's own materials: the four wrap swatches
     in site-content.js (kraft / cream / sage / blush). Pine is the chrome
     accent; attention states use kraft-amber and madder red so "done" can
     stay quiet ink instead of competing green.
     --------------------------------------------------------------------- */
  :root {
    --ground: #F2F4EF;
    --surface: #FCFCF9;
    --surface-2: #EDEFE8;
    --ink: #1B201B;
    --ink-2: #4E564D;
    --muted: #737B70;
    --rule: #D9DDD3;
    --rule-strong: #C2C8BA;
    --pine: #33503F;
    --pine-soft: #E2EAE1;
    --on-accent: #FCFCF9;
    --amber: #8E6318;
    --amber-soft: #F6ECD8;
    --madder: #972E34;
    --madder-soft: #F7E3E2;
    --blush: #C9A4A8;
    --shadow: 0 1px 2px rgba(27, 32, 27, .06), 0 8px 24px -16px rgba(27, 32, 27, .28);
    --r: 10px;
    --sans: "Archivo", "Helvetica Neue", Arial, sans-serif;
    --serif: "Newsreader", Georgia, "Times New Roman", serif;
    --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #141711;
      --surface: #1C201B;
      --surface-2: #242923;
      --ink: #EDEFE7;
      --ink-2: #C3C9BD;
      --muted: #929A8C;
      --rule: #2E332C;
      --rule-strong: #414739;
      --pine: #93BC9D;
      --pine-soft: #23301F;
      --on-accent: #141711;
      --amber: #DFA94F;
      --amber-soft: #332714;
      --madder: #E58E91;
      --madder-soft: #341D1D;
      --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 10px 28px -18px rgba(0, 0, 0, .8);
    }
  }

  :root[data-theme="dark"] {
    --ground: #141711;
    --surface: #1C201B;
    --surface-2: #242923;
    --ink: #EDEFE7;
    --ink-2: #C3C9BD;
    --muted: #929A8C;
    --rule: #2E332C;
    --rule-strong: #414739;
    --pine: #93BC9D;
    --pine-soft: #23301F;
    --on-accent: #141711;
    --amber: #DFA94F;
    --amber-soft: #332714;
    --madder: #E58E91;
    --madder-soft: #341D1D;
    --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 10px 28px -18px rgba(0, 0, 0, .8);
  }

  * { box-sizing: border-box; }
  [hidden] { display: none !important; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .shell { max-width: 1180px; margin: 0 auto; padding: 0 16px 72px; }

  /* ---------- top bar ---------- */
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 16px;
    padding-block: 22px 14px;
    border-bottom: 1px solid var(--rule);
  }
  .bar h1 {
    margin: 0;
    font-family: var(--serif);
    font-size: 25px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .bar h1 small {
    display: block;
    font-family: var(--sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 3px;
  }
  .bar .today {
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink-2);
    margin-inline-start: auto;
  }
  .bar .refresh {
    font: 600 12px/1 var(--sans);
    padding: 8px 11px;
    border-radius: 7px;
    border: 1px solid var(--rule-strong);
    background: var(--surface);
    color: var(--ink-2);
    cursor: pointer;
  }
  .bar .refresh[disabled] { opacity: .5; cursor: not-allowed; }

  /* ---------- load strip ---------- */
  .pulse {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 26px;
    padding-block: 14px;
    border-bottom: 1px solid var(--rule);
  }
  .pulse div { display: flex; align-items: baseline; gap: 8px; }
  .pulse b {
    font-family: var(--mono);
    font-size: 19px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .pulse span {
    font-size: 11.5px;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  .pulse .late b { color: var(--madder); }
  .pulse .pay b { color: var(--amber); }

  /* ---------- lane chips ---------- */
  .chips {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    padding-block: 14px;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chips button {
    flex: 0 0 auto;
    font: 500 13px/1 var(--sans);
    padding: 9px 13px;
    border-radius: 999px;
    border: 1px solid var(--rule-strong);
    background: var(--surface);
    color: var(--ink-2);
    cursor: pointer;
  }
  .chips button .n {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--muted);
    margin-inline-start: 5px;
  }
  .chips button[aria-pressed="true"] {
    background: var(--pine);
    border-color: var(--pine);
    color: var(--on-accent);
  }
  .chips button[aria-pressed="true"] .n { color: inherit; opacity: .7; }

  /* ---------- two-pane layout ---------- */
  .panes { display: grid; gap: 20px; align-items: start; }
  @media (min-width: 900px) {
    .panes { grid-template-columns: 360px minmax(0, 1fr); }
  }

  /* ---------- search and sort ---------- */
  .search { margin-bottom: 10px; }
  .search label {
    display: block;
    margin-bottom: 6px;
    font: 600 10.5px/1 var(--sans);
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .search input {
    width: 100%;
    font: 500 14px/1.2 var(--sans);
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--rule-strong);
    border-radius: 7px;
    padding: 10px 12px;
  }
  .search input::placeholder { color: var(--muted); }
  .sort {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .sort .k {
    font: 600 10.5px/1 var(--sans);
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .sort .seg { display: flex; border: 1px solid var(--rule-strong); border-radius: 7px; overflow: hidden; }
  .sort .seg button {
    font: 500 12.5px/1 var(--sans);
    padding: 8px 11px;
    border: 0;
    background: var(--surface);
    color: var(--ink-2);
    cursor: pointer;
  }
  .sort .seg button + button { border-inline-start: 1px solid var(--rule-strong); }
  .sort .seg button[aria-pressed="true"] { background: var(--ink); color: var(--ground); }

  /* ---------- queue ---------- */
  .queue { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .queue-empty {
    border: 1px dashed var(--rule-strong);
    border-radius: var(--r);
    padding: 26px 18px;
    text-align: center;
    color: var(--muted);
    font-size: 13.5px;
  }
  .card {
    width: 100%;
    display: grid;
    grid-template-columns: 4px minmax(0, 1fr);
    gap: 0 12px;
    text-align: start;
    font: inherit;
    color: inherit;
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--r);
    padding: 0;
    overflow: hidden;
    cursor: pointer;
  }
  .card:hover { border-color: var(--rule-strong); }
  .card[aria-current="true"] { border-color: var(--pine); box-shadow: var(--shadow); }
  .card .stripe { background: var(--rule-strong); }
  .card.is-late .stripe { background: var(--madder); }
  .card.is-today .stripe { background: var(--amber); }
  .card.is-working .stripe { background: var(--pine); }
  .card .body { padding: 12px 14px 13px 2px; min-width: 0; }
  .card .row1 { display: flex; align-items: baseline; gap: 8px; }
  .card .ref {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
    letter-spacing: -0.01em;
  }
  .card .due {
    margin-inline-start: auto;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .card.is-late .due { color: var(--madder); }
  .card.is-today .due { color: var(--amber); }
  .card .who { font-family: var(--serif); font-size: 17.5px; line-height: 1.25; margin: 3px 0 1px; }
  .card .what {
    font-size: 13px;
    color: var(--ink-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card .in {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
  }
  .card .tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font: 600 10.5px/1 var(--sans);
    letter-spacing: .06em;
    text-transform: uppercase;
    padding: 5px 7px;
    border-radius: 4px;
    background: var(--surface-2);
    color: var(--ink-2);
    white-space: nowrap;
  }
  .tag.warn { background: var(--amber-soft); color: var(--amber); }
  .tag.stop { background: var(--madder-soft); color: var(--madder); }
  .tag.go { background: var(--pine-soft); color: var(--pine); }
  .tag .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .swatch {
    width: 11px; height: 11px; border-radius: 2px;
    border: 1px solid rgba(27, 32, 27, .25);
    flex: 0 0 auto;
  }

  /* ---------- ticket ---------- */
  .ticket {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--r);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .ticket .back {
    display: none;
    font: 600 12px/1 var(--sans);
    letter-spacing: .04em;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--rule);
    color: var(--pine);
    padding: 13px 16px;
    width: 100%;
    text-align: start;
    cursor: pointer;
  }
  .ticket-head {
    padding: 16px 18px 15px;
    border-bottom: 1px solid var(--rule);
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    align-items: flex-start;
  }
  .ticket-head .id { min-width: 0; }
  .ticket-head .ref { font-family: var(--mono); font-size: 12.5px; font-weight: 500; color: var(--muted); }
  .ticket-head h2 {
    font-family: var(--serif);
    font-size: 23px;
    font-weight: 600;
    margin: 2px 0 6px;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  .ticket-head .wa {
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink-2);
    text-decoration: none;
    border-bottom: 1px solid var(--rule-strong);
  }
  .ticket-head .in { display: block; font-family: var(--mono); font-size: 11.5px; color: var(--muted); margin-top: 5px; }
  .ticket-head .when { margin-inline-start: auto; text-align: end; }
  .ticket-head .when .d {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    display: block;
  }
  .ticket-head .when .rel {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ticket-head.is-late .when .d, .ticket-head.is-late .when .rel { color: var(--madder); }
  .ticket-head.is-today .when .d, .ticket-head.is-today .when .rel { color: var(--amber); }

  .block { padding: 17px 18px; border-bottom: 1px solid var(--rule); }
  .block:last-child { border-bottom: 0; }
  .block > h3 {
    margin: 0 0 12px;
    font: 600 10.5px/1 var(--sans);
    letter-spacing: .13em;
    text-transform: uppercase;
    color: var(--muted);
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .block > h3 .count {
    margin-inline-start: auto;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0;
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
    text-transform: none;
  }
  .block.pay-open { background: var(--amber-soft); }

  /* ---------- payment ---------- */
  .amount { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .amount .big {
    font-family: var(--mono);
    font-size: 26px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
  .amount .lbl { font-size: 12px; color: var(--ink-2); }
  .breakdown {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--ink-2);
    margin-top: 5px;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
  }
  .ongkir { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-top: 13px; }
  .ongkir label { font: 600 11px/1 var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .ongkir input {
    font: 500 15px/1 var(--mono);
    width: 132px;
    padding: 10px 11px;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .ongkir input[disabled] { opacity: .5; }
  .ongkir .hint { font-size: 12px; color: var(--ink-2); flex: 1 1 160px; }
  .paystate { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
  .paystate .step {
    font: 600 11px/1 var(--sans);
    letter-spacing: .06em;
    text-transform: uppercase;
    padding: 7px 9px;
    border-radius: 4px;
    background: var(--surface);
    border: 1px solid var(--rule-strong);
    color: var(--muted);
  }
  .paystate .step.on { background: var(--pine); border-color: var(--pine); color: var(--on-accent); }
  .paystate .step.past { border-color: var(--pine); color: var(--pine); }
  .actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 14px; align-items: center; }

  .btn {
    font: 600 13.5px/1 var(--sans);
    padding: 12px 17px;
    border-radius: 7px;
    border: 1px solid var(--pine);
    background: var(--pine);
    color: var(--on-accent);
    cursor: pointer;
  }
  .btn.ghost { background: transparent; color: var(--ink-2); border-color: var(--rule-strong); }
  .btn.small { font-size: 12px; padding: 9px 12px; }
  .btn[disabled] { opacity: .45; cursor: not-allowed; }
  .why { font-size: 12.5px; color: var(--ink-2); flex: 1 1 180px; }
  .why.err { color: var(--madder); }

  .confirm {
    margin-top: 13px;
    border: 1px solid var(--pine);
    border-radius: 7px;
    padding: 13px 14px;
    background: var(--surface);
  }
  .confirm p { margin: 0 0 4px; font-size: 14px; }
  .confirm .rule { font-size: 12.5px; color: var(--madder); }
  .confirm .actions { margin-top: 11px; }

  .paid-line {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .paid-line .ok { color: var(--pine); font-weight: 600; }
  .paid-line .cancelled { color: var(--madder); font-weight: 600; }
  .paid-line .amt { font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .paid-line .st { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }

  /* ---------- checks ---------- */
  .checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .checks li {
    display: grid;
    grid-template-columns: 17px minmax(0, 1fr);
    gap: 9px;
    align-items: start;
    padding: 6px 0;
    font-size: 13.5px;
  }
  .checks .mark { font-family: var(--mono); font-size: 13px; font-weight: 600; line-height: 1.35; text-align: center; }
  .checks .pass .mark { color: var(--pine); }
  .checks .fail .mark { color: var(--madder); }
  .checks .fail, .checks .fail .sub { color: var(--madder); }
  .checks .sub { display: block; font-size: 12px; color: var(--muted); }

  .tick {
    display: grid;
    grid-template-columns: 17px minmax(0, 1fr);
    gap: 9px;
    align-items: start;
    width: 100%;
    text-align: start;
    background: none;
    border: 0;
    padding: 7px 0;
    font: inherit;
    font-size: 13.5px;
    color: var(--ink);
    cursor: pointer;
  }
  .box {
    width: 16px; height: 16px;
    border: 1.5px solid var(--rule-strong);
    border-radius: 3px;
    margin-top: 2px;
    display: grid;
    place-items: center;
    font: 700 11px/1 var(--sans);
    color: transparent;
  }
  [aria-pressed="true"] > .box { background: var(--pine); border-color: var(--pine); color: var(--on-accent); }
  .tick[aria-pressed="true"] .label { color: var(--muted); text-decoration: line-through; text-decoration-thickness: 1px; }

  /* ---------- make list ---------- */
  .make { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .make > li { border-top: 1px solid var(--rule); }
  .make > li:first-child { border-top: 0; }
  .comp {
    display: grid;
    grid-template-columns: 17px 40px minmax(0, 1fr);
    gap: 11px;
    align-items: start;
    width: 100%;
    text-align: start;
    background: none;
    border: 0;
    padding: 13px 0;
    font: inherit;
    color: var(--ink);
    cursor: pointer;
  }
  .comp .qty {
    font-family: var(--mono);
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
  }
  .comp .name { display: block; font-size: 15.5px; line-height: 1.3; }
  .comp .spec { display: block; font-size: 12.5px; color: var(--ink-2); font-family: var(--mono); margin-top: 3px; }
  .comp .spec .k { color: var(--muted); }
  .comp[aria-pressed="true"] .name { color: var(--muted); text-decoration: line-through; text-decoration-thickness: 1px; }

  /* ---------- finishing ---------- */
  .pair .k {
    font: 600 10.5px/1 var(--sans);
    letter-spacing: .11em;
    text-transform: uppercase;
    color: var(--muted);
    display: block;
    margin-bottom: 5px;
  }
  .pair .v { font-size: 14.5px; display: flex; align-items: center; gap: 7px; }
  .pair .v .swatch { width: 15px; height: 15px; }

  .cardnote {
    background: var(--surface-2);
    border: 1px solid var(--rule);
    border-left: 3px solid var(--blush);
    border-radius: 4px;
    padding: 13px 14px;
    margin-top: 5px;
  }
  .cardnote p {
    margin: 0;
    font-family: var(--serif);
    font-style: italic;
    font-size: 16.5px;
    line-height: 1.5;
    text-wrap: pretty;
  }
  .cardnote .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--muted);
    font-family: var(--mono);
  }

  /* ---------- phases ---------- */
  .phases { display: flex; gap: 0; overflow-x: auto; padding-bottom: 6px; }
  .phase { flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px; padding-inline-end: 16px; min-width: 108px; }
  .phase .line { height: 3px; border-radius: 2px; background: var(--rule); }
  .phase.done .line { background: var(--rule-strong); }
  .phase.now .line { background: var(--pine); }
  .phase .t { font-size: 12.5px; color: var(--muted); line-height: 1.3; }
  .phase.now .t { color: var(--ink); font-weight: 600; }

  .notes {
    width: 100%;
    font: inherit;
    font-size: 14px;
    color: var(--ink);
    background: var(--surface-2);
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 11px 12px;
    min-height: 74px;
    resize: vertical;
  }
  .notes::placeholder { color: var(--muted); }
  .notes[disabled] { opacity: .6; }

  .provenance {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    padding: 13px 18px;
    background: var(--surface-2);
    border-top: 1px solid var(--rule);
    display: flex;
    flex-wrap: wrap;
    gap: 3px 14px;
  }

  /* ---------- save toast ---------- */
  .toast {
    position: fixed;
    inset-inline: 0;
    bottom: 18px;
    margin-inline: auto;
    width: max-content;
    max-width: calc(100% - 32px);
    background: var(--ink);
    color: var(--ground);
    font: 500 12.5px/1.3 var(--sans);
    padding: 11px 15px;
    border-radius: 999px;
    box-shadow: var(--shadow);
    z-index: 20;
  }
  .toast b { font-family: var(--mono); font-weight: 600; }
  .toast.err { background: var(--madder); }

  .foot {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid var(--rule);
    font-size: 12.5px;
    color: var(--muted);
    max-width: 64ch;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  .foot b { color: var(--ink-2); font-weight: 600; }

  :focus-visible { outline: 2px solid var(--pine); outline-offset: 2px; border-radius: 3px; }

  @media (max-width: 899px) {
    .ticket .back { display: block; }
    body.detail .queue, body.detail .pulse, body.detail .chips, body.detail .search, body.detail .sort { display: none; }
    body:not(.detail) .ticket { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }

  /* ---------- boot states (not in the design prototype: it had no server
     round trip to wait on or fail) ---------- */
  .skeleton {
    padding: 40px 4px;
    color: var(--muted);
    font-size: 13.5px;
  }
  .error-screen {
    padding: 26px 4px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .error-screen p { margin: 0; color: var(--madder); font-size: 14px; max-width: 56ch; }
  .stale-banner {
    margin-block: 12px 0;
    padding: 10px 13px;
    background: var(--amber-soft);
    color: var(--amber);
    border-radius: 7px;
    font-size: 12.5px;
  }
</style>

<div class="shell" id="shell">
  <header class="bar">
    <h1><small>Alxanthia</small>Studio Desk</h1>
    <button type="button" class="refresh" id="refreshBtn" hidden>Muat ulang pesanan</button>
    <div class="today" id="today"></div>
  </header>

  <div class="stale-banner" id="staleBanner" hidden></div>

  <div class="skeleton" id="skeleton" hidden>Memuat pesanan…</div>

  <div class="error-screen" id="errorScreen" hidden>
    <p id="errorMessage"></p>
    <button type="button" class="btn" id="retryBtn">Coba lagi</button>
  </div>

  <div id="app" hidden>
    <section class="pulse" id="pulse" aria-live="polite"></section>
    <nav class="chips" id="chips" aria-label="Saring pesanan"></nav>

    <main class="panes">
      <div>
        <div class="search">
          <label for="orderSearch">Cari pesanan</label>
          <input id="orderSearch" type="search" placeholder="Nama, kode pesanan, atau nomor WA" autocomplete="off" aria-controls="queue">
        </div>
        <div class="sort">
          <span class="k">Urutkan</span>
          <div class="seg" id="sort" role="group" aria-label="Urutan daftar">
            <button type="button" data-sort="due" aria-pressed="true">Deadline terdekat</button>
            <button type="button" data-sort="in" aria-pressed="false">Pesanan pertama</button>
          </div>
        </div>
        <ol class="queue" id="queue"></ol>
      </div>
      <section class="ticket" id="ticket" aria-live="polite"></section>
    </main>
  </div>

  <p class="foot">
    <span><b>Studio Desk.</b> Setiap perubahan di sini langsung tersimpan ke sheet Orders. Nama bunga,
    ukuran tangkai, warna kertas buket dan isi paket dibaca langsung dari <b>site-content.js</b>.</span>
    <button type="button" class="btn ghost small" id="reloadCatalogBtn">Muat ulang katalog</button>
    <span id="catalogMeta"></span>
  </p>
</div>

<script>
  'use strict';

  /* Work Phase — English keys are what the sheet stores; Indonesian is what
     she reads. All five (six with Cancelled, excluded from the queue by the
     server) are hers to move. */
  var PHASES = [
    { key: 'Not started',          label: 'Belum mulai' },
    { key: 'Assembly and packing', label: 'Dirangkai dan dikemas' },
    { key: 'Ready for dispatch',   label: 'Siap dikirim' },
    { key: 'Shipped',              label: 'Dikirim' },
    { key: 'Delivered',            label: 'Selesai' }
  ];

  /* Payment Status — manual bank transfer, no payment gateway. */
  var PAYMENTS = [
    { key: 'Unpaid',            label: 'Belum bayar' },
    { key: 'Checking transfer', label: 'Perlu dicek' },
    { key: 'Checking deposit',  label: 'Periksa DP' },
    { key: 'Deposit paid',      label: 'DP diterima' },
    { key: 'Checking balance',  label: 'Periksa pelunasan' },
    { key: 'Paid',              label: 'Lunas' },
    { key: 'Cancelled',         label: 'Dibatalkan' }
  ];

  /* =====================================================================
     State. Orders and the catalogue arrive from the server; only the
     build-list ticks and the card-read tick are kept locally, per device,
     keyed by order reference — bench scratch state, not a business record.
     ===================================================================== */
  var state = {
    lane: 'all',
    sort: 'due',
    search: '',
    selected: null,
    orders: null,
    catalog: null,
    ordersError: null,
    catalogError: null,
    per: {}
  };
  var confirming = false;
  var pending = {}; // "ref|field" -> true while a write is in flight
  var fieldErrors = {}; // "ref|field" -> Indonesian error message
  var noteDrafts = {}; // ref -> unsaved textarea value, persisted so a trip to WhatsApp can't lose it
  var refocus = null;

  var PER_KEY = 'alxanthia-desk-per-v1';
  try {
    var savedPer = JSON.parse(localStorage.getItem(PER_KEY) || 'null');
    if (savedPer && typeof savedPer === 'object') state.per = savedPer;
  } catch (e) { /* private window or blocked storage — defaults are fine */ }

  function savePer() {
    try { localStorage.setItem(PER_KEY, JSON.stringify(state.per)); } catch (e) {}
  }

  var NOTE_DRAFTS_KEY = 'alxanthia-desk-notedrafts-v1';
  try {
    var savedDrafts = JSON.parse(localStorage.getItem(NOTE_DRAFTS_KEY) || 'null');
    if (savedDrafts && typeof savedDrafts === 'object') noteDrafts = savedDrafts;
  } catch (e) { /* private window or blocked storage — defaults are fine */ }

  function saveNoteDrafts() {
    try { localStorage.setItem(NOTE_DRAFTS_KEY, JSON.stringify(noteDrafts)); } catch (e) {}
  }

  function per(ref) {
    if (!state.per[ref]) state.per[ref] = {};
    return state.per[ref];
  }

  function findOrder(ref) {
    return (state.orders || []).find(function (o) { return o.ref === ref; }) || null;
  }

  function isPending(ref, field) { return !!pending[ref + '|' + field]; }

  /* =====================================================================
     Helpers shared with the layout — dates, currency, escaping.
     ===================================================================== */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function daysUntil(dateStr) {
    var a = new Date(dateStr + 'T00:00:00'), b = new Date(todayStr() + 'T00:00:00');
    return Math.round((a - b) / 86400000);
  }

  function relDate(dateStr) {
    var d = daysUntil(dateStr);
    if (isNaN(d)) return '';
    if (d < 0) return (-d) + ' hari lewat';
    if (d === 0) return 'hari ini';
    if (d === 1) return 'besok';
    return d + ' hari lagi';
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function fmtDate(dateStr) {
    var p = String(dateStr || '').split('-');
    if (p.length !== 3) return String(dateStr || '');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1];
  }

  function fmtStamp(stamp) {
    var parts = String(stamp || '').split(' ');
    if (parts.length < 2) return String(stamp || '');
    return fmtDate(parts[0]) + ' ' + parts[1];
  }

  function rupiah(n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var NAME_PREFIXES = ['ni', 'i', 'ibu', 'bu', 'bapak', 'pak', 'mbak', 'mas', 'kak'];

  function firstName(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    while (parts.length > 1 && NAME_PREFIXES.indexOf(parts[0].toLowerCase().replace(/\.$/, '')) !== -1) {
      parts.shift();
    }
    return parts.length ? parts[0] : '';
  }

  function humanizeKey(key) {
    return String(key || '').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function resolveLabel(map, key) {
    var entry = map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
    return entry || { name: humanizeKey(key), spec: '' };
  }

  /* Mirrors buildTicketLines_ in the Apps Script server code exactly — the
     client can't call back into that file synchronously, so this is a
     deliberate duplicate. Keep both in sync if either changes. */
  function buildList(order, catalog) {
    return (order.items || []).map(function (item, i) {
      if (item.type === 'stem') {
        var flower = resolveLabel(catalog.flowers, item.id);
        var stemLines = flower.spec ? [{ v: flower.spec }] : [];
        stemLines.push({ k: 'bungkus', v: item.wrapped === true ? 'Dengan kertas pembungkus' : 'Tanpa kertas pembungkus' });
        return { key: 'i' + i, qty: item.qty, name: flower.name, lines: stemLines };
      }
      if (item.type === 'pot') {
        var pot = resolveLabel(catalog.pots, item.id);
        return { key: 'i' + i, qty: item.qty, name: pot.name, lines: pot.spec ? [{ v: pot.spec }] : [] };
      }
      if (item.type === 'package') {
        var pkg = (catalog.packages || [])[Number(item.id)];
        var stems = pkg ? pkg.stems : '?';
        return { key: 'i' + i, qty: item.qty, name: 'Paket ' + stems + ' tangkai', lines: [{ v: 'pilihan bunga studio' }] };
      }
      if (item.type === 'custom') {
        var each = [], total = [];
        Object.keys(item.stems || {}).forEach(function (k) {
          var f = resolveLabel(catalog.flowers, k);
          each.push(item.stems[k] + '× ' + f.name);
          total.push(item.stems[k] * item.qty + '× ' + f.name);
        });
        Object.keys(item.additions || {}).forEach(function (k) {
          if (!item.additions[k]) return;
          var a = resolveLabel(catalog.additions, k);
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

  function billed(o) {
    if (o.shipping === null || o.shipping === undefined || o.shipping === '') return null;
    return o.verified + Number(o.shipping);
  }

  function usesDeposit(o) { return o.paymentPlan === 'Deposit 50%'; }
  function depositAmount(o) {
    var total = billed(o);
    return total === null ? null : Math.ceil(total / 2);
  }
  function balanceAmount(o) {
    var total = billed(o), deposit = depositAmount(o);
    return total === null ? null : total - deposit;
  }

  function usesBouquetWrap(items) {
    return (items || []).some(function (item) {
      return item && (item.type === 'package' || item.type === 'custom');
    });
  }

  function waitingPay(order) {
    return order.payment !== 'Paid' && order.payment !== 'Cancelled' && order.phase !== 'Delivered';
  }

  function matchesSearch(order, query) {
    var needle = String(query || '').trim().toLowerCase();
    if (!needle) return true;
    if (String(order.buyer || '').toLowerCase().indexOf(needle) !== -1 ||
        String(order.ref || '').toLowerCase().indexOf(needle) !== -1) return true;
    var digits = needle.replace(/[^\d]/g, '');
    if (digits && String(order.wa || '').replace(/[^\d]/g, '').indexOf(digits) !== -1) return true;
    return false;
  }

  function laneOf(order) { return order.phase; }

  /* Finished orders are archived out of the working queue the moment
     Work Phase reaches Delivered — the "Aktif" lane is everything still
     in progress. They stay reachable from the Selesai chip and, from the
     sheet's own side, for KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE days past
     their Preferred Date (see includeOrder_ in the server code — this is
     NOT days since it was marked Delivered) before listOrders() drops them
     entirely. */
  function isActive(order) { return order.phase !== 'Delivered' && order.payment !== 'Cancelled'; }

  /* Shared by the chip counts and the queue itself, so a lane always means
     the same thing in both places. */
  function laneMatch(order, laneKey) {
    if (laneKey === 'all') return isActive(order);
    if (laneKey === 'pay') return waitingPay(order);
    if (laneKey === 'cancelled') return order.payment === 'Cancelled';
    return laneOf(order) === laneKey;
  }

  /* The filtered, sorted list she is actually looking at — computed once and
     shared between renderQueue() and the default-selection logic in
     render(), so the ticket on the right is always the card at the top of
     the list on the left. */
  function visibleOrders() {
    return state.orders.filter(function (o) {
      return laneMatch(o, state.lane) && matchesSearch(o, state.search);
    }).sort(function (a, b) {
      if (state.sort === 'in') return a.submitted < b.submitted ? -1 : a.submitted > b.submitted ? 1 : 0;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  /* =====================================================================
     The gate: four checks read from the sheet, one she ticks herself.
     ===================================================================== */
  function gate(order, catalog) {
    var auto = [];
    var pay = order.payment;
    var payLabel = (PAYMENTS.find(function (p) { return p.key === pay; }) || {}).label || pay;
    auto.push({
      ok: pay === 'Paid' || pay === 'Deposit paid',
      label: pay === 'Paid' ? 'Pembayaran lunas' : (pay === 'Deposit paid' ? 'DP 50% diterima' : 'Pembayaran belum diterima'),
      sub: 'Status di sheet: ' + payLabel
    });
    auto.push({
      ok: !order.mismatch,
      label: order.mismatch ? 'Harga ditandai REVIEW' : 'Harga terverifikasi',
      sub: order.mismatch
        ? 'Verified Total dan Submitted Total beda di sheet — cek dulu sebelum mulai.'
        : rupiah(order.verified) + ' (produk + kartu, terverifikasi server)'
    });
    var d = daysUntil(order.date);
    var leadDays = (catalog && catalog.minimumLeadDays) || 2;
    auto.push({
      ok: d >= 0,
      label: d < 0 ? 'Sudah lewat tanggal' : (d < leadDays ? 'Tanggal mepet' : 'Tanggal masih cukup'),
      sub: fmtDate(order.date) + ' · ' + relDate(order.date)
    });
    auto.push(order.locationType === 'bali'
      ? {
          ok: !!(order.regency && order.method),
          label: 'Tujuan lengkap',
          sub: (order.regency || '—') + ' · ' + (order.method === 'self_pickup' ? 'ambil sendiri' : 'Grab / Gojek')
        }
      : {
          ok: !!(order.address && order.city && order.postal),
          label: 'Tujuan lengkap',
          sub: (order.city || '—') + ' ' + (order.postal || '')
        });

    var manual = order.card ? [{ key: 'card', label: 'Teks kartu sudah dibaca ulang' }] : [];
    var ticks = per(order.ref).ticks || {};
    var autoOk = auto.every(function (c) { return c.ok; });
    var manualOk = manual.every(function (m) { return ticks[m.key]; });
    return { auto: auto, manual: manual, autoOk: autoOk, ready: autoOk && manualOk };
  }

  /* =====================================================================
     Rendering
     ===================================================================== */
  var elShell = document.getElementById('shell');
  var elApp = document.getElementById('app');
  var elSkeleton = document.getElementById('skeleton');
  var elErrorScreen = document.getElementById('errorScreen');
  var elErrorMessage = document.getElementById('errorMessage');
  var elRetryBtn = document.getElementById('retryBtn');
  var elRefreshBtn = document.getElementById('refreshBtn');
  var elStaleBanner = document.getElementById('staleBanner');
  var elReloadCatalogBtn = document.getElementById('reloadCatalogBtn');
  var elCatalogMeta = document.getElementById('catalogMeta');
  var elQueue = document.getElementById('queue');
  var elTicket = document.getElementById('ticket');
  var elChips = document.getElementById('chips');
  var elPulse = document.getElementById('pulse');
  var elSort = document.getElementById('sort');
  var elSearch = document.getElementById('orderSearch');

  function render() {
    document.getElementById('today').textContent = fmtDate(todayStr()) + ' · Asia/Makassar';

    if (state.ordersError) {
      elSkeleton.hidden = true;
      elApp.hidden = true;
      elErrorScreen.hidden = false;
      elErrorMessage.textContent = state.ordersError;
      return;
    }
    if (state.orders === null || state.catalog === null) {
      elErrorScreen.hidden = true;
      elApp.hidden = true;
      elSkeleton.hidden = false;
      return;
    }
    elErrorScreen.hidden = true;
    elSkeleton.hidden = true;
    elApp.hidden = false;
    elRefreshBtn.hidden = false;

    if (state.catalogError) {
      elStaleBanner.hidden = false;
      elStaleBanner.textContent = 'Katalog tidak bisa dimuat — nama bunga tampil apa adanya. Data pesanan dan semua angka tetap akurat.';
    } else if (state.catalog.stale) {
      elStaleBanner.hidden = false;
      elStaleBanner.textContent = 'Katalog tidak bisa dimuat ulang dari situs — nama bunga/paket di bawah mungkin sudah lama. Data pesanan dan angka tetap akurat.';
    } else {
      elStaleBanner.hidden = true;
    }
    elCatalogMeta.textContent = state.catalog.fetchedAt ? ('katalog dimuat ' + fmtStamp(state.catalog.fetchedAt)) : '';

    if (!state.selected) {
      var visible = visibleOrders();
      if (visible.length) state.selected = visible[0].ref;
    }

    renderTop();
    renderQueue();
    renderTicket();
  }

  function renderTop() {
    var late = 0, today = 0, pay = 0, working = 0;
    state.orders.forEach(function (o) {
      if (o.phase === 'Delivered') return;
      var d = daysUntil(o.date);
      if (d < 0) late++;
      else if (d === 0) today++;
      if (waitingPay(o)) pay++;
      if (o.phase === 'Assembly and packing') working++;
    });
    elPulse.innerHTML =
      '<div><b>' + today + '</b><span>jatuh tempo hari ini</span></div>' +
      (late ? '<div class="late"><b>' + late + '</b><span>terlambat</span></div>' : '') +
      '<div class="pay"><b>' + pay + '</b><span>menunggu bayar</span></div>' +
      '<div><b>' + working + '</b><span>sedang dikerjakan</span></div>';

    var lanes = [{ key: 'all', label: 'Aktif' }, { key: 'pay', label: 'Menunggu bayar' }]
      .concat(PHASES.map(function (p) { return { key: p.key, label: p.label }; }))
      .concat([{ key: 'cancelled', label: 'Dibatalkan' }]);

    elChips.innerHTML = lanes.map(function (l) {
      var n = state.orders.filter(function (o) { return laneMatch(o, l.key); }).length;
      return '<button type="button" data-lane="' + esc(l.key) + '" aria-pressed="' + (state.lane === l.key) +
        '">' + esc(l.label) + '<span class="n">' + n + '</span></button>';
    }).join('');

    Array.prototype.forEach.call(elSort.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort));
    });
  }

  function renderQueue() {
    var catalog = state.catalog;
    var list = visibleOrders();

    if (!list.length) {
      elQueue.innerHTML = '<li class="queue-empty">' +
        (state.search ? 'Tidak ada pesanan yang cocok.' : 'Tidak ada pesanan di kelompok ini.') + '</li>';
      return;
    }

    elQueue.innerHTML = list.map(function (o) {
      var d = daysUntil(o.date);
      var phase = o.phase;
      var cls = 'card';
      if (phase !== 'Delivered') {
        if (d < 0) cls += ' is-late';
        else if (d === 0) cls += ' is-today';
        else if (phase !== 'Not started') cls += ' is-working';
      }

      var tags = [];
      if (o.mismatch) tags.push('<span class="tag stop"><span class="dot"></span>Review</span>');
      if (waitingPay(o)) {
        var pl = (PAYMENTS.find(function (p) { return p.key === o.payment; }) || {}).label || o.payment;
        tags.push('<span class="tag warn"><span class="dot"></span>' + esc(pl) + '</span>');
      } else if (o.payment === 'Cancelled') {
        tags.push('<span class="tag stop"><span class="dot"></span>Dibatalkan</span>');
      }
      var phaseEntry = PHASES.find(function (p) { return p.key === phase; });
      if (phase !== 'Not started' && phaseEntry) {
        tags.push('<span class="tag go"><span class="dot"></span>' + esc(phaseEntry.label) + '</span>');
      } else if (gate(o, catalog).autoOk) {
        tags.push('<span class="tag go"><span class="dot"></span>Siap dikerjakan</span>');
      }
      if (usesBouquetWrap(o.items)) {
        var w = catalog.wraps[o.wrap] || { name: humanizeKey(o.wrap), swatch: '#999' };
        tags.push('<span class="tag"><span class="swatch" style="background:' + esc(w.swatch) + '"></span>' + esc(w.name) + '</span>');
      }
      if (o.card) tags.push('<span class="tag">Kartu</span>');

      var summary = o.items.length
        ? buildList(o, catalog).map(function (r) { return r.qty + '× ' + r.name; }).join(' · ')
        : o.itemsRaw;

      return '<li><button type="button" class="' + cls + '" data-ref="' + esc(o.ref) + '"' +
        (state.selected === o.ref ? ' aria-current="true"' : '') + '>' +
        '<span class="stripe"></span>' +
        '<span class="body">' +
          '<span class="row1"><span class="ref">' + esc(o.ref) + '</span>' +
            '<span class="due">' + esc(fmtDate(o.date)) + ' · ' + esc(relDate(o.date)) + '</span></span>' +
          '<span class="who">' + esc(o.buyer) + '</span>' +
          '<span class="what">' + esc(summary) + '</span>' +
          '<span class="in">masuk ' + esc(fmtStamp(o.submitted)) + '</span>' +
          '<span class="tags">' + tags.join('') + '</span>' +
        '</span></button></li>';
    }).join('');
  }

  function paymentBlock(o) {
    var pay = o.payment;
    if (pay === 'Paid') {
      var paidAmount = billed(o);
      return '<div class="block"><h3>Pembayaran</h3>' +
        '<div class="paid-line"><span class="ok">Lunas</span>' +
        '<span class="amt">' + esc(paidAmount === null ? '—' : rupiah(paidAmount)) + '</span></div>' +
        '<div class="breakdown"><span>Produk &amp; kartu ' + esc(rupiah(o.verified)) + '</span>' +
        '<span>Ongkir ' + (o.shipping === null || o.shipping === undefined || o.shipping === ''
          ? 'belum diisi' : esc(rupiah(o.shipping))) + '</span></div>' +
        '<div class="actions">' +
        '<button type="button" class="btn ghost" data-sendpaid="1">Kirim konfirmasi lunas</button>' +
        '</div></div>';
    }

    var ship = o.shipping;
    var amount = billed(o);
    var deposit = depositAmount(o);
    var balance = balanceAmount(o);
    var isDeposit = usesDeposit(o);
    var shippingPending = isPending(o.ref, 'shipping');
    var paymentPending = isPending(o.ref, 'payment');
    var planPending = isPending(o.ref, 'paymentPlan');
    var shipErr = fieldErrors[o.ref + '|shipping'];
    var payErr = fieldErrors[o.ref + '|payment'] || fieldErrors[o.ref + '|paymentPlan'];
    var bank = state.catalog.bank || {};
    var bankReady = !!bank.number;
    var readyIndex = PHASES.findIndex(function (x) { return x.key === 'Ready for dispatch'; });
    var phaseIndex = PHASES.findIndex(function (x) { return x.key === o.phase; });
    var balanceDue = phaseIndex >= readyIndex;

    var html = '<div class="block pay-open"><h3>Pembayaran</h3>' +
      '<div class="amount"><span class="big">' + esc(amount === null ? '—' : rupiah(amount)) + '</span>' +
      '<span class="lbl">total yang ditagih ke pembeli</span></div>' +
      '<div class="breakdown"><span>Produk &amp; kartu ' + esc(rupiah(o.verified)) + '</span>' +
      '<span>Ongkir ' + (ship === null || ship === undefined || ship === '' ? 'belum diisi' : esc(rupiah(ship))) + '</span></div>';

    if (o.locationType === 'bali') {
      html += '<div class="ongkir"><span class="hint">Ongkir Rp 0 — ' +
        (o.method === 'self_pickup' ? 'diambil sendiri di studio.' : 'Grab/Gojek dibayar langsung ke driver.') +
        '</span></div>';
    } else {
      html += '<div class="ongkir"><label for="ongkir-' + esc(o.ref) + '">Ongkir</label>' +
        '<input id="ongkir-' + esc(o.ref) + '" type="number" inputmode="numeric" min="0" step="1000" ' +
        'value="' + (ship === null || ship === undefined ? '' : esc(ship)) + '" placeholder="0"' +
        (shippingPending ? ' disabled' : '') + '>' +
        '<span class="hint">Kurir ke ' + esc(o.city) + '. Sisa pelunasan mengikuti total terbaru.</span></div>';
      if (shipErr) html += '<p class="why err">' + esc(shipErr) + '</p>';
    }

    html += '<div class="actions" role="group" aria-label="Cara pembayaran">' +
      '<button type="button" class="btn ' + (!isDeposit ? '' : 'ghost') + '" data-plan="Full"' + (planPending ? ' disabled' : '') + '>Bayar penuh</button>' +
      '<button type="button" class="btn ' + (isDeposit ? '' : 'ghost') + '" data-plan="Deposit 50%"' + (planPending || amount === null ? ' disabled' : '') + '>DP 50%</button></div>';

    if (isDeposit && amount !== null) {
      html += '<div class="breakdown"><span>DP 50% ' + esc(rupiah(deposit)) + '</span>' +
        '<span>Sisa pelunasan ' + esc(rupiah(balance)) + '</span></div>';
    }

    if (pay === 'Cancelled') {
      html += '<div class="paid-line"><span class="cancelled">Dibatalkan</span>' +
        (isDeposit ? '<span class="why">Jika DP sudah diterima, proses pengembalian dicatat manual.</span>' : '') + '</div>' +
        '<div class="actions"><button type="button" class="btn ghost" data-pay="Unpaid">Aktifkan lagi</button></div>';
    } else if (isDeposit) {
      var depositReceived = pay === 'Deposit paid' || pay === 'Checking balance';
      html += '<div class="paid-line"><span class="' + (depositReceived ? 'ok' : '') + '">' +
        (depositReceived ? 'DP diterima' : (pay === 'Checking deposit' ? 'DP perlu dicek' : 'Belum bayar DP')) + '</span>' +
        '<span class="amt">' + esc(rupiah(depositReceived ? balance : deposit)) + '</span></div>' +
        '<div class="actions">' +
        (!depositReceived
          ? '<button type="button" class="btn ghost" data-sendpayment="deposit"' + (bankReady ? '' : ' disabled') + '>Kirim tagihan DP</button>' +
            '<button type="button" class="btn ghost" data-pay="Checking deposit">Tandai DP perlu dicek</button>' +
            '<button type="button" class="btn" data-askpaid="Deposit paid">Tandai DP diterima</button>'
          : (balanceDue
            ? (o.phase === 'Ready for dispatch'
                ? '<button type="button" class="btn" data-sendpayment="balance"' + (bankReady ? '' : ' disabled') + '>Kirim pesan pelunasan</button>'
                : '') +
              '<button type="button" class="btn ghost" data-pay="Checking balance">Tandai perlu dicek</button>' +
              '<button type="button" class="btn" data-askpaid="Paid">Tandai lunas</button>'
            : '<span class="why">Pelunasan diminta saat pesanan Siap dikirim.</span>')) +
        '<button type="button" class="btn ghost small" data-askcancel="1">Batalkan pesanan</button></div>';
    } else {
      html += '<div class="actions"><button type="button" class="btn ghost" data-sendpayment="full"' + (bankReady ? '' : ' disabled') + '>Kirim pesan</button>' +
        '<button type="button" class="btn ghost" data-pay="Checking transfer">Tandai perlu dicek</button>' +
        '<button type="button" class="btn" data-askpaid="Paid">Tandai lunas</button>' +
        '<button type="button" class="btn ghost small" data-askcancel="1">Batalkan pesanan</button></div>';
    }

    if (amount === null) html += '<span class="why">Isi ongkir dulu supaya totalnya bisa ditagih.</span>';
    if (!bankReady) html += '<span class="why">Nomor rekening belum diisi — pesan pembayaran tidak bisa dikirim.</span>';
    if (payErr) html += '<span class="why err">' + esc(payErr) + '</span>';
    if (confirming === 'cancel') {
      html += '<div class="confirm"><p>Batalkan pesanan ' + esc(o.ref) + '? Pesanan akan ditandai dibatalkan.</p>' +
        '<div class="actions"><button type="button" class="btn" data-pay="Cancelled">Ya, batalkan</button>' +
        '<button type="button" class="btn ghost" data-cancelconfirm="1">Tidak</button></div></div>';
    } else if (confirming && amount !== null) {
      var target = confirming === 'Deposit paid' ? deposit : (confirming === 'Paid' && isDeposit ? balance : amount);
      html += '<div class="confirm"><p><b>' + esc(rupiah(target)) + '</b> sudah masuk ke rekening ' +
        esc(bank.bank || '—') + ' ' + esc(bank.number || '') + '?</p>' +
        '<p class="rule">Cek di mutasi rekening — jangan dari screenshot pembeli.</p>' +
        '<div class="actions"><button type="button" class="btn" data-pay="' + esc(confirming) + '">Ya, sudah masuk</button>' +
        '<button type="button" class="btn ghost" data-cancelconfirm="1">Batal</button></div></div>';
    }
    return html + '</div>';
  }

  function renderTicket() {
    var o = findOrder(state.selected);
    if (!o) { elTicket.innerHTML = '<div class="block"><p class="why">Pilih pesanan dari daftar.</p></div>'; return; }
    var catalog = state.catalog;

    var p = per(o.ref);
    var g = gate(o, catalog);
    var comps = buildList(o, catalog);
    var ticks = p.ticks || {};
    var compState = p.comps || {};
    var doneComps = comps.filter(function (c) { return compState[c.key]; }).length;
    var d = daysUntil(o.date);
    var phase = o.phase;
    var pIndex = PHASES.findIndex(function (x) { return x.key === phase; });
    var headCls = phase === 'Delivered' ? '' : (d < 0 ? ' is-late' : (d === 0 ? ' is-today' : ''));
    var phasePending = isPending(o.ref, 'phase');
    var phaseErr = fieldErrors[o.ref + '|phase'];
    var notesPending = isPending(o.ref, 'notes');

    var html = '<button type="button" class="back" data-back="1">← Daftar pesanan</button>' +
      '<div class="ticket-head' + headCls + '">' +
        '<div class="id"><div class="ref">' + esc(o.ref) + ' · baris ' + o.row + '</div>' +
          '<h2>' + esc(o.buyer) + '</h2>' +
          '<a class="wa" href="https://wa.me/' + esc(String(o.wa).replace('+', '')) + '" target="_blank" rel="noopener">' + esc(o.wa) + '</a>' +
          '<span class="in">masuk ' + esc(fmtStamp(o.submitted)) + '</span></div>' +
        '<div class="when"><span class="d">' + esc(fmtDate(o.date)) + '</span>' +
          '<span class="rel">' + esc(relDate(o.date)) + '</span></div>' +
      '</div>';

    html += paymentBlock(o);

    /* Verification gate — only while the work has not started. */
    if (pIndex <= 0) {
      html += '<div class="block"><h3>Periksa dulu</h3><ul class="checks">' +
        g.auto.map(function (c) {
          return '<li class="' + (c.ok ? 'pass' : 'fail') + '"><span class="mark" aria-hidden="true">' +
            (c.ok ? '✓' : '✕') + '</span><span>' + esc(c.label) +
            '<span class="sub">' + esc(c.sub) + '</span></span></li>';
        }).join('') + '</ul>' +
        g.manual.map(function (m) {
          var on = !!ticks[m.key];
          return '<button type="button" class="tick" data-tick="' + esc(m.key) + '" data-fk="tick-' + esc(m.key) +
            '" aria-pressed="' + on + '"><span class="box" aria-hidden="true">✓</span>' +
            '<span class="label">' + esc(m.label) + '</span></button>';
        }).join('') +
        '<div class="actions"><button type="button" class="btn" data-advance="1"' + (g.ready && !phasePending ? '' : ' disabled') + '>' +
        'Mulai kerjakan</button><span class="why' + (phaseErr ? ' err' : '') + '">' +
        (phaseErr || (g.ready ? '' : (g.autoOk ? 'Centang baris di atas dulu.' : 'Belum bisa dimulai — lihat tanda merah di atas.'))) +
        '</span></div></div>';
    }

    /* What to make — one tick per line item. */
    html += '<div class="block"><h3>Yang dibuat<span class="count">' + doneComps + '/' + comps.length + ' item</span></h3>' +
      (comps.length
        ? '<ul class="make">' + comps.map(function (c) {
            var on = !!compState[c.key];
            return '<li><button type="button" class="comp" data-comp="' + esc(c.key) + '" data-fk="comp-' + esc(c.key) +
              '" aria-pressed="' + on + '"><span class="box" aria-hidden="true">✓</span>' +
              '<span class="qty">' + c.qty + '×</span><span><span class="name">' + esc(c.name) + '</span>' +
              c.lines.map(function (l) {
                return '<span class="spec">' + (l.k ? '<span class="k">' + esc(l.k) + ':</span> ' : '') + esc(l.v) + '</span>';
              }).join('') +
              '</span></button></li>';
          }).join('') + '</ul>'
        : '<p class="why">' + esc(o.itemsRaw || 'Tidak ada rincian item.') + '</p>') + '</div>';

    /* Finishing — bouquet colour (when relevant) and the card. Individual
       flower wrapping is shown on its own item line above. */
    html += '<div class="block"><h3>Penyelesaian</h3>';
    if (usesBouquetWrap(o.items)) {
      var w = catalog.wraps[o.wrap] || { name: humanizeKey(o.wrap), swatch: '#999' };
      html += '<div class="pair"><span class="k">Warna kertas buket</span><span class="v">' +
        '<span class="swatch" style="background:' + esc(w.swatch) + '"></span>' + esc(w.name) + '</span></div>';
    }

    if (o.card) {
      html += '<div style="margin-top:15px"><span class="k" style="display:block;font:600 10.5px/1 var(--sans);' +
        'letter-spacing:.11em;text-transform:uppercase;color:var(--muted)">Kartu ucapan — tulis apa adanya</span>' +
        '<div class="cardnote"><p>' + esc(o.card.text) + '</p>' +
        '<div class="meta"><span>Untuk: ' + esc(o.card.to) + '</span><span>Dari: ' + esc(o.card.from) + '</span></div>' +
        '<div class="actions"><button type="button" class="btn ghost small" data-copycard="1">Salin teks kartu</button></div>' +
        '</div></div>';
    } else {
      html += '<p style="margin:14px 0 0;font-size:13px;color:var(--muted)">Tanpa kartu ucapan.</p>';
    }
    html += '</div>';

    /* Delivery */
    var dest = o.locationType === 'bali'
      ? (o.method === 'self_pickup' ? 'Ambil sendiri di studio' : 'Grab / Gojek') + ' · ' + o.regency
      : 'Kurir ke luar Bali · ' + o.address + ', ' + o.city + ' ' + o.postal;
    html += '<div class="block"><h3>Pengantaran</h3><div style="font-size:14.5px">' + esc(dest) + '</div></div>';

    /* Work phase — all five (Cancelled aside) are hers. */
    html += '<div class="block"><h3>Tahap kerja</h3><div class="phases">' +
      PHASES.map(function (x, i) {
        var cls = i < pIndex ? 'done' : (i === pIndex ? 'now' : '');
        return '<div class="phase ' + cls + '"><span class="line"></span><span class="t">' + esc(x.label) + '</span></div>';
      }).join('') + '</div>';

    var next = PHASES[pIndex + 1];
    if (pIndex > 0 || !next) {
      html += '<div class="actions">' +
        (next ? '<button type="button" class="btn" data-advance="1"' + (phasePending ? ' disabled' : '') + '>Lanjut: ' + esc(next.label) + '</button>'
              : '<span class="why">Pesanan selesai.</span>') +
        (pIndex > 0 ? '<button type="button" class="btn ghost" data-retreat="1"' + (phasePending ? ' disabled' : '') + '>Kembali</button>' : '') +
        (pIndex > 0 ? '<button type="button" class="btn ghost" data-sendphase="1">Kirim pesan</button>' : '') +
        (phaseErr && pIndex > 0 ? '<span class="why err">' + esc(phaseErr) + '</span>' : '') +
        '</div>';
    }
    html += '</div>';

    var unsavedNote = noteDrafts[o.ref] !== undefined && noteDrafts[o.ref] !== o.notes;
    html += '<div class="block"><h3>Catatan kerja' +
      (unsavedNote ? '<span class="count" style="color:var(--amber);text-transform:none">belum tersimpan</span>' : '') +
      '</h3>' +
      '<textarea class="notes" id="notes-' + esc(o.ref) + '" data-fk="notes" ' +
      (notesPending ? 'disabled ' : '') +
      'placeholder="Catat kalau ada bahan kurang, warna diganti, atau pesan dari pembeli…"></textarea>' +
      '<div class="actions"><button type="button" class="btn ghost small" data-savenotes="1"' +
      (notesPending ? ' disabled' : '') + '>Simpan catatan</button></div></div>' +
      '<div class="provenance"><span>Orders · baris ' + o.row + '</span>' +
      '<span>Desk menulis: Payment Plan · Payment Status · Shipping Fee · Work Phase · Internal Notes</span>' +
      '<span>Kolom lain hanya dibaca</span></div>';

    elTicket.innerHTML = html;
    var notesEl = elTicket.querySelector('.notes');
    notesEl.value = noteDrafts[o.ref] !== undefined ? noteDrafts[o.ref] : o.notes;

    if (refocus) {
      var target = elTicket.querySelector('[data-fk="' + refocus + '"]');
      if (target) target.focus();
      refocus = null;
    }
  }

  /* =====================================================================
     Toasts
     ===================================================================== */
  var toastTimer = null;
  function toast(message, isError) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.id = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.className = 'toast' + (isError ? ' err' : '');
    el.innerHTML = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function savedToast(column) {
    toast('Tersimpan ke sheet Orders · <b>' + esc(column) + '</b>');
  }

  /* =====================================================================
     Writes: optimistic with rollback. Applied locally, rendered, sent to
     the server; on success the order is replaced with the server's own
     copy, on failure the previous value comes back and the control
     re-enables so a double-tap can't queue two writes.
     ===================================================================== */
  function writeField(ref, field, value, columnLabel, onSaved) {
    var key = ref + '|' + field;
    if (pending[key]) return;
    var order = findOrder(ref);
    if (!order) return;
    var previous = order[field];

    pending[key] = true;
    delete fieldErrors[key];
    order[field] = value;
    render();

    google.script.run
      .withSuccessHandler(function (res) {
        delete pending[key];
        if (res && res.ok) {
          var idx = state.orders.findIndex(function (x) { return x.ref === res.order.ref; });
          if (idx !== -1) state.orders[idx] = res.order;
          savedToast(columnLabel);
          if (onSaved) onSaved();
        } else {
          order[field] = previous;
          fieldErrors[key] = (res && res.message) || 'Gagal menyimpan perubahan.';
          toast(esc(fieldErrors[key]), true);
        }
        render();
      })
      .withFailureHandler(function (err) {
        delete pending[key];
        order[field] = previous;
        fieldErrors[key] = String((err && err.message) || err || 'Gagal menyimpan perubahan.');
        toast(esc(fieldErrors[key]), true);
        render();
      })
      .updateOrder({ ref: ref, row: order.row, field: field, value: value });
  }

  /* The draft is cleared only once the server confirms the write — not on
     blur, and not just because a send button was tapped — so a WhatsApp
     round trip (or any other navigation away) can never silently drop an
     unsaved note. */
  function saveNotes(o) {
    var value = noteDrafts[o.ref] !== undefined ? noteDrafts[o.ref] : o.notes;
    if (value === o.notes) {
      delete noteDrafts[o.ref];
      saveNoteDrafts();
      renderTicket();
      return;
    }
    writeField(o.ref, 'notes', value, 'Internal Notes', function () {
      delete noteDrafts[o.ref];
      saveNoteDrafts();
    });
  }

  /* =====================================================================
     Boot: fetch the catalogue and the order list in parallel.
     ===================================================================== */
  function boot() {
    state.ordersError = null;
    state.catalogError = null;
    render();

    google.script.run
      .withSuccessHandler(function (catalog) { state.catalog = catalog; render(); })
      .withFailureHandler(function (err) {
        state.catalogError = String((err && err.message) || err);
        state.catalog = { stale: true, flowers: {}, pots: {}, additions: {},
                          packages: [], wraps: {}, minimumLeadDays: 2, bank: {} };
        render();
      })
      .getCatalog();

    google.script.run
      .withSuccessHandler(function (orders) { state.orders = orders; render(); })
      .withFailureHandler(function (err) { state.ordersError = String((err && err.message) || err); render(); })
      .listOrders();
  }

  function reloadOrders() {
    elRefreshBtn.disabled = true;
    google.script.run
      .withSuccessHandler(function (orders) {
        elRefreshBtn.disabled = false;
        state.orders = orders;
        render();
      })
      .withFailureHandler(function (err) {
        elRefreshBtn.disabled = false;
        toast(esc(String((err && err.message) || err)), true);
      })
      .listOrders();
  }

  /* =====================================================================
     Events
     ===================================================================== */
  elRetryBtn.addEventListener('click', boot);
  elRefreshBtn.addEventListener('click', reloadOrders);
  elReloadCatalogBtn.addEventListener('click', function () {
    elReloadCatalogBtn.disabled = true;
    google.script.run
      .withSuccessHandler(function (catalog) {
        elReloadCatalogBtn.disabled = false;
        state.catalog = catalog;
        render();
      })
      .withFailureHandler(function (err) {
        elReloadCatalogBtn.disabled = false;
        toast(esc(String((err && err.message) || err)), true);
      })
      .refreshCatalog();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.orders !== null) reloadOrders();
  });

  elChips.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-lane]');
    if (!b) return;
    state.lane = b.dataset.lane;
    renderTop();
    renderQueue();
  });

  elSort.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sort]');
    if (!b) return;
    state.sort = b.dataset.sort;
    renderTop();
    renderQueue();
  });

  elSearch.addEventListener('input', function () {
    state.search = elSearch.value;
    renderQueue();
  });

  /* Master/detail on mobile is CSS state (body.detail), so the phone's own
     back gesture would otherwise leave the Desk entirely rather than close
     the ticket. Push a history entry when one opens and let popstate close
     it, so the gesture and the in-page back button share one path. The Desk
     runs inside the Apps Script /exec sandbox iframe, where history
     manipulation can be restricted — if pushState throws, historyPushed
     stays false and the in-page button falls back to closing the view
     directly instead of touching history at all. */
  var historyPushed = false;

  function closeDetail() {
    document.body.classList.remove('detail');
  }

  window.addEventListener('popstate', function () {
    historyPushed = false;
    closeDetail();
  });

  elQueue.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-ref]');
    if (!b) return;
    state.selected = b.dataset.ref;
    confirming = false;
    document.body.classList.add('detail');
    try {
      history.pushState({ desk: 'detail', ref: state.selected }, '');
      historyPushed = true;
    } catch (e) { historyPushed = false; }
    renderQueue();
    renderTicket();
    elTicket.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  elTicket.addEventListener('click', function (e) {
    var o = findOrder(state.selected);
    if (!o) return;
    var p = per(o.ref);

    if (e.target.closest('[data-back]')) {
      if (historyPushed) { historyPushed = false; history.back(); } else { closeDetail(); }
      return;
    }

    var tick = e.target.closest('[data-tick]');
    if (tick) {
      p.ticks = p.ticks || {};
      p.ticks[tick.dataset.tick] = !p.ticks[tick.dataset.tick];
      refocus = 'tick-' + tick.dataset.tick;
      savePer();
      renderTicket();
      return;
    }

    var comp = e.target.closest('[data-comp]');
    if (comp) {
      p.comps = p.comps || {};
      p.comps[comp.dataset.comp] = !p.comps[comp.dataset.comp];
      refocus = 'comp-' + comp.dataset.comp;
      savePer();
      renderTicket();
      return;
    }

    var payBtn = e.target.closest('[data-pay]');
    if (payBtn) {
      confirming = false;
      writeField(o.ref, 'payment', payBtn.dataset.pay, 'Payment Status');
      return;
    }

    var planBtn = e.target.closest('[data-plan]');
    if (planBtn) {
      writeField(o.ref, 'paymentPlan', planBtn.dataset.plan, 'Payment Plan');
      return;
    }

    var askPaid = e.target.closest('[data-askpaid]');
    if (askPaid) { confirming = askPaid.dataset.askpaid; renderTicket(); return; }
    if (e.target.closest('[data-askcancel]')) { confirming = 'cancel'; renderTicket(); return; }
    if (e.target.closest('[data-cancelconfirm]')) { confirming = false; renderTicket(); return; }

    if (e.target.closest('[data-advance]')) {
      var i = PHASES.findIndex(function (x) { return x.key === o.phase; });
      if (PHASES[i + 1] && PHASES[i + 1].key === 'Shipped' && o.payment !== 'Paid') {
        toast('Pelunasan harus diterima sebelum pesanan dikirim.', true);
        return;
      }
      if (PHASES[i + 1]) writeField(o.ref, 'phase', PHASES[i + 1].key, 'Work Phase');
      return;
    }

    if (e.target.closest('[data-retreat]')) {
      var j = PHASES.findIndex(function (x) { return x.key === o.phase; });
      if (j > 0) writeField(o.ref, 'phase', PHASES[j - 1].key, 'Work Phase');
      return;
    }

    var copyCard = e.target.closest('[data-copycard]');
    if (copyCard && o.card) {
      copyText(o.card.text + '\n— ' + o.card.from);
      copyCard.textContent = 'Tersalin';
      return;
    }

    if (e.target.closest('[data-sendpayment]')) {
      if (billed(o) === null) return;
      openWhatsApp(o, paymentRequestMessage(o, e.target.closest('[data-sendpayment]').dataset.sendpayment));
      return;
    }

    if (e.target.closest('[data-sendpaid]')) {
      openWhatsApp(o, paymentConfirmedMessage(o));
      return;
    }

    if (e.target.closest('[data-sendphase]')) {
      var msg = phaseMessage(o);
      if (msg) openWhatsApp(o, msg);
      return;
    }

    if (e.target.closest('[data-savenotes]')) {
      saveNotes(o);
      return;
    }
  });

  elTicket.addEventListener('change', function (e) {
    var o = findOrder(state.selected);
    if (!o) return;

    if (e.target.classList.contains('notes')) {
      saveNotes(o);
      return;
    }
    if (e.target.type !== 'number') return;
    var raw = e.target.value.trim();
    var value = raw === '' ? '' : Math.max(0, Number(raw));
    writeField(o.ref, 'shipping', value, 'Shipping Fee');
  });

  elTicket.addEventListener('input', function (e) {
    if (!e.target.classList.contains('notes')) return;
    noteDrafts[state.selected] = e.target.value;
    saveNoteDrafts();
  });

  function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
  }

  /* Opens the buyer's WhatsApp chat with the message already typed in,
     ready to send — never sent automatically, she still taps send herself.
     A new top-level window, not the Apps Script iframe (wa.me refuses to
     render framed). */
  function openWhatsApp(o, message) {
    var digits = String(o.wa || '').replace(/[^\d]/g, '');
    var url = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function paymentRequestMessage(o, kind) {
    var amount = billed(o);
    var bank = state.catalog.bank || {};
    if (kind === 'deposit') {
      return 'Halo ' + firstName(o.buyer) + ', terima kasih untuk pesanannya.\n' +
        'Nomor pesanan: ' + o.ref + '\nTotal pesanan: ' + rupiah(amount) + '\n' +
        'DP 50%: ' + rupiah(depositAmount(o)) + '\nSisa pelunasan: ' + rupiah(balanceAmount(o)) + '\n' +
        'Transfer ke ' + bank.bank + ' ' + bank.number + ' a.n. ' + bank.holder + '\n' +
        'Kalau sudah, balas chat ini ya. Produksi dimulai setelah DP kami konfirmasi.';
    }
    if (kind === 'balance') {
      return 'Halo ' + firstName(o.buyer) + ', pesananmu (' + o.ref + ') sudah siap dikirim.\n' +
        'Total pesanan: ' + rupiah(amount) + '\nDP sudah diterima: ' + rupiah(depositAmount(o)) + '\n' +
        'Sisa pelunasan: ' + rupiah(balanceAmount(o)) + '\n' +
        'Transfer ke ' + bank.bank + ' ' + bank.number + ' a.n. ' + bank.holder + '\n' +
        'Setelah pelunasan kami konfirmasi, pesanan siap dikirim. Terima kasih!';
    }
    return 'Halo ' + firstName(o.buyer) + ', terima kasih untuk pesanannya.\n' +
      'Nomor pesanan: ' + o.ref + '\n' +
      'Total: ' + rupiah(amount) + '\n' +
      'Transfer ke ' + bank.bank + ' ' + bank.number + ' a.n. ' + bank.holder + '\n' +
      'Kalau sudah, balas chat ini ya — nanti kami cek dan langsung dikerjakan untuk ' + fmtDate(o.date) + '.';
  }

  function paymentConfirmedMessage(o) {
    if (usesDeposit(o)) {
      return 'Halo ' + firstName(o.buyer) + ', pelunasan pesanan ' + o.ref + ' sudah kami terima. ' +
        'Status pembayaran sekarang lunas. Terima kasih!';
    }
    return 'Halo ' + firstName(o.buyer) + ', pembayaran untuk pesanan ' + o.ref + ' sudah kami terima. ' +
      'Terima kasih! Pesananmu akan segera kami mulai buatkan.';
  }

  /* One message per work phase, shown once she's already advanced into it —
     "Kirim pesan" sits next to Kembali for every phase past Belum mulai. */
  function phaseMessage(o) {
    var name = firstName(o.buyer);
    if (o.phase === 'Assembly and packing') {
      return 'Halo ' + name + ', pesananmu (' + o.ref + ') sedang kami rangkai dan kemas. Kami kabari lagi begitu siap ya.';
    }
    if (o.phase === 'Ready for dispatch') {
      if (o.locationType === 'bali') {
        return o.method === 'self_pickup'
          ? 'Halo ' + name + ', pesananmu (' + o.ref + ') sudah siap diambil di studio kapan saja.'
          : 'Halo ' + name + ', pesananmu (' + o.ref + ') sudah siap. Kamu bisa pesan Gojek/Grab kapan saja untuk mengambilnya.';
      }
      return 'Halo ' + name + ', pesananmu (' + o.ref + ') sudah siap dan akan segera kami kirim.';
    }
    if (o.phase === 'Shipped') {
      return 'Halo ' + name + ', pesananmu (' + o.ref + ') sudah dikirim dan sedang dalam perjalanan menujumu.';
    }
    if (o.phase === 'Delivered') {
      return 'Halo ' + name + ', terima kasih ya! Semoga pesananmu (' + o.ref + ') sudah sampai dengan baik.';
    }
    return null;
  }

  boot();
</script>
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
`site-content.json` immediately (built automatically from `site-content.js` by `npm run build` —
publishing the website is enough, there is nothing extra to do). If a quiet banner says the catalogue
couldn't be reloaded, `site-content.json` was unreachable or unparseable; the Desk keeps working from
its last good copy in the meantime, and order data and totals are unaffected either way (they come
from the sheet, never the catalogue).

### A finished order disappears from the queue sooner than expected

The 14-day window a Delivered order stays visible (`KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE`) is
counted from **Preferred Date** — when the customer wanted the flowers — not from the day you marked
it Delivered. If an order's Preferred Date was already weeks ago by the time you finish it, it can
drop out of the queue almost immediately after you mark it Delivered. This is expected behaviour, not
a bug: the Desk does not currently record a separate delivery date. If you need finished orders to
stay visible for a fixed number of days after you actually deliver them, that requires adding a
`Delivered At` column and is a deliberate, separate change — ask your developer.

### Money doesn't match what the customer was quoted

It can't — the Desk only ever shows `Verified Total` (plus `Shipping Fee` once you type it),
recalculated server-side by the order writer at submission time, never anything from the customer's
browser or from the Desk itself. If a total looks wrong, check `Price Mismatch` on that row in the
sheet directly (the Desk's gate surfaces this as "Harga ditandai REVIEW").
