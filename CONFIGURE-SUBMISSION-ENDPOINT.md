# Configure the Alxanthia submission endpoint

This guide is written for the store owner. You do not need to know how to program: follow each step in order and copy the supplied code exactly.

## What you are setting up

```text
Alxanthia website form → Cloudflare Worker → Google Apps Script → Google Sheets
```

The website form is already present. It intentionally does not show a successful-order screen until an external endpoint confirms that the order was saved. The public endpoint setting is currently empty in `site-content.js`.

You will create:

1. a private Google Sheet containing the orders;
2. a Google Apps Script that writes to that sheet, recalculates every price itself, and never trusts the numbers the browser sends; and
3. a Cloudflare Worker that securely connects the website to the script, checks a security widget (Turnstile), and limits how fast one visitor can submit.

Never paste your webhook secret, Google credentials, Cloudflare API token, Turnstile secret key, or Midtrans credentials into the website repository.

**If you are updating an existing endpoint rather than setting one up for the first time**, read [Migrating an existing deployment](#migrating-an-existing-deployment) near the end of this guide before you touch the Sheet — the column list changed and the old copied-down formula must be removed.

---

## Part 1 — Create (or update) the Google Sheet

1. Sign in to the Google account that should own the orders.
2. Open <https://sheets.google.com> and create a blank spreadsheet (or open your existing **Alxanthia Orders** spreadsheet if you already have one).
3. Rename the spreadsheet **Alxanthia Orders**.
4. Rename its first worksheet tab **Orders**.
5. Click cell `A1` and paste this tab-separated header row exactly. The Apps Script in Part 2 looks up every column **by this header text**, not by column letter, so the order of columns does not matter as long as every heading below exists exactly once:

```text
Order Reference	Idempotency Key	Payload Hash	Catalog Version	Submitted Catalog Version	Submitted At	Language	Currency	Source	Acknowledged	Buyer Name	Buyer WhatsApp	Location Type	Regency	Delivery Method	Address	City	Postal Code	Preferred Date	Order Mode	Order Summary	Item Data	Total Stems	Wrap	Message Card	Gift Message	Recipient Name	Card Sender Name	Submitted Product Subtotal	Submitted Message Card Fee	Submitted Total	Verified Product Subtotal	Verified Message Card Fee	Verified Total	Price Mismatch	Shipping Fee	Final Total	Midtrans Payment Link	Payment Status	Work Phase	Delivery Service	Tracking Link/Number	Internal Notes
```

6. If the headings stay in one cell, select it and choose **Data → Split text to columns → Tab**.
7. Choose **View → Freeze → 1 row**.
8. Select row 1 and choose **Data → Create a filter**.

A quick guide to the new/changed columns:

- **Idempotency Key** and **Payload Hash** are written by the script for deduplication — you will not type into them.
- **Catalog Version** records which price list was active when the order was verified (this script's own `CATALOG_VERSION`). **Submitted Catalog Version** records what the customer's browser believed it was (`site-content.js`'s `catalogVersion`) — kept as a separate column (ALX-08) so the two can be compared: if they differ, the customer's tab was open across a price change, which is a useful diagnostic distinct from a genuine tampering attempt.
- **Submitted Product/Message Card/Total** are exactly what the customer's browser calculated. **Verified Product/Message Card/Total** are what the Apps Script recalculated from its own price list. They usually match. Treat **Verified Total**, never Submitted Total, as the real order amount.
- **Price Mismatch** is normally blank. The script writes `REVIEW` here if the submitted and verified totals disagree — this can mean the customer's browser tab was open across a price change, or that someone tried to tamper with the totals in their browser. Either way, double-check the row before sending a payment link.
- **Final Total** is a live formula (`Verified Total + Shipping Fee`), written automatically by the script once you fill in **Shipping Fee**. Do **not** type a formula into this column yourself and do **not** copy any formula down the sheet — see [Migrating an existing deployment](#migrating-an-existing-deployment) if you have an old copied-down formula to remove.

A reminder about the location columns: **Location Type** is `bali` or `luar_bali`. For a Bali order, **Regency** (kabupaten/kota) and **Delivery Method** (`grab_gojek` or `self_pickup`) are filled and **Address/City/Postal Code** stay blank. For an out-of-Bali order, it's the reverse. Always check **Location Type** first before reading the other columns.

### Add the status dropdowns

Select the **Payment Status** column, then choose **Data → Data validation → Dropdown** and add exactly:

```text
Awaiting confirmation
Awaiting payment
Paid
Expired
Refunded
Cancelled
```

Select the **Work Phase** column and add exactly:

```text
Not started
Materials prepared
Flowers being made
Bouquet assembly
Quality check
Packed
Ready for dispatch
Shipped
Delivered
Cancelled
```

Format **Submitted Product Subtotal**, **Submitted Message Card Fee**, **Submitted Total**, **Verified Product Subtotal**, **Verified Message Card Fee**, **Verified Total**, **Shipping Fee**, and **Final Total** as Indonesian rupiah while keeping them numeric.

### Protect the verified/final columns (OWNER-04, OWNER-07)

Select the **Verified Product Subtotal**, **Verified Message Card Fee**, **Verified Total**, and **Final Total** columns, then **Data → Protect sheets and ranges**, and restrict editing to yourself. These are the numbers you should trust; nobody (including a well-meaning collaborator) should hand-edit them.

### Confirm sharing (OWNER-07)

Open **Share** in the top right and confirm the spreadsheet is **not** shared as "Anyone with the link" — it contains customer names, phone numbers, and addresses. Share it only with the specific people (by email) who need it.

---

## Part 2 — Create the Google Apps Script

1. In the spreadsheet, choose **Extensions → Apps Script**.
2. Rename the project **Alxanthia Order Writer**.
3. Delete the example `myFunction` code.
4. Paste the code below in full.

```javascript
/**
 * Alxanthia Order Writer — Google Apps Script.
 * Paste this whole file into Extensions → Apps Script, replacing any
 * existing code, exactly as instructed in CONFIGURE-SUBMISSION-ENDPOINT.md.
 */

// ============================================================================
// Configuration — keep this catalogue in sync with site-content.js. Bump
// CATALOG_VERSION whenever a price, product, mini pot, or addition changes,
// and update the matching value in site-content.js at the same time.
// ============================================================================
var SHEET_NAME = 'Orders';
var CATALOG_VERSION = 1;
var MINIMUM_LEAD_DAYS = 2; // must match site-content.js `minimumLeadDays` (OWNER-01)
var TIMEZONE = 'Asia/Makassar'; // GMT+08:00, for Bali (OWNER-07)

var CATALOG = {
  wrapFeeUnitStems: 3,       // must match site-content.js `wrapFeeUnitStems`
  wrapFeePerUnit: 35000,     // must match site-content.js `wrapFeePerUnit`
  messageCardPrice: 5000,    // must match site-content.js `messageCardPrice`
  minStems: 3,               // must match site-content.js `minStems`
  // Keys must match site-content.js `flowers` keys exactly (case-sensitive).
  flowerStemPrice: { Sunflower: 55000, Rose: 60000, Tulip: 50000, Gerbera: 55000 },
  // Keys must match site-content.js `miniPots[].key` exactly.
  miniPotPrice: { sunflower: 125000, 'lily-of-the-valley': 125000, daisy: 125000 },
  // Keys must match site-content.js `customAdditions[].key` exactly.
  additionPrice: { rounded: 12000, fern: 12000 },
  // Index must match the position of each entry in site-content.js `packages`.
  packagePrice: [195000, 295000, 465000, 745000],
  packageStems: [3, 5, 9, 15]
};

var BALI_REGENCIES = ['Denpasar', 'Badung', 'Gianyar', 'Tabanan', 'Klungkung', 'Bangli', 'Karangasem', 'Buleleng', 'Jembrana'];
var WRAP_IDS = ['kraft', 'cream', 'sage', 'blush'];

var MAX_BODY_BYTES = 30000;
var MAX_LINES_PER_ORDER = 20;
var MAX_QTY_PER_LINE = 20;
var MAX_TOTAL_QTY = 60;
var MAX_TEXT = { buyer_name: 120, address: 300, city: 100, gift_message: 200, recipient_name: 120, card_sender_name: 120 };
// ALX-06: MAX_TOTAL_QTY above counts line quantities (how many of each item
// was ordered), not the flowers/additions nested inside one custom bouquet
// definition — without these, a single custom line at qty:1 could still
// declare an absurd stem count. Same order of magnitude as MAX_TOTAL_QTY;
// revisit alongside it if a real order ever legitimately needs more.
var MAX_CUSTOM_STEMS_PER_FLOWER = 60;
var MAX_CUSTOM_TOTAL_STEMS = 60;
var MAX_CUSTOM_ADDITION_PER_KEY = 60;

// ALX-07: every column doPost writes to, checked to exist exactly once
// before any append — a missing column previously made buildRow() silently
// drop that field, and a missing "Idempotency Key" column silently disabled
// deduplication entirely (findExisting()'s `keyCol !== undefined` guard).
var REQUIRED_HEADERS = [
  'Order Reference', 'Idempotency Key', 'Payload Hash', 'Catalog Version', 'Submitted Catalog Version',
  'Submitted At', 'Language', 'Currency', 'Source', 'Acknowledged', 'Buyer Name', 'Buyer WhatsApp',
  'Location Type', 'Regency', 'Delivery Method', 'Address', 'City', 'Postal Code', 'Preferred Date',
  'Order Mode', 'Order Summary', 'Item Data', 'Total Stems', 'Wrap', 'Message Card', 'Gift Message',
  'Recipient Name', 'Card Sender Name', 'Submitted Product Subtotal', 'Submitted Message Card Fee',
  'Submitted Total', 'Verified Product Subtotal', 'Verified Message Card Fee', 'Verified Total',
  'Price Mismatch', 'Shipping Fee', 'Final Total', 'Midtrans Payment Link', 'Payment Status',
  'Work Phase', 'Delivery Service', 'Tracking Link/Number', 'Internal Notes'
];

// ============================================================================
// Entry point
// ============================================================================
function doPost(event) {
  try {
    // ALX-11: an optional hard stop independent of anything the client
    // sends — a paused *website* (client-side channel visibility) is not
    // an access control; this Script Property is. Set it to 'true' under
    // Project Settings → Script Properties to reject every submission
    // while the studio is genuinely closed to new orders.
    if (PropertiesService.getScriptProperties().getProperty('ORDERING_PAUSED') === 'true') {
      return jsonResponse({ ok: false, code: 'ORDERING_PAUSED', error: 'Ordering is temporarily paused.' });
    }

    const raw = (event && event.postData && event.postData.contents) || '';
    if (raw.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, code: 'PAYLOAD_TOO_LARGE', error: 'Request body too large.' });
    }

    let request;
    try {
      request = JSON.parse(raw || '{}');
    } catch (parseError) {
      return jsonResponse({ ok: false, code: 'BAD_JSON', error: 'Malformed JSON.' });
    }

    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!secret || request.webhook_secret !== secret) {
      return jsonResponse({ ok: false, code: 'UNAUTHORIZED', error: 'Unauthorized' });
    }

    const order = request.order || {};
    if (order.buyer_whatsapp) order.buyer_whatsapp = normalizeIndonesianPhone(order.buyer_whatsapp);
    const validation = validateOrder(order);
    if (!validation.ok) {
      return jsonResponse({ ok: false, code: 'VALIDATION', error: validation.error });
    }

    const payloadHash = computePayloadHash(order);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return jsonResponse({ ok: false, code: 'STORAGE_ERROR', error: 'Orders worksheet was not found.' });

    const headers = getHeaderMap(sheet);
    const schemaCheck = validateHeaderSchema(headers);
    if (!schemaCheck.ok) return jsonResponse({ ok: false, code: 'SCHEMA_ERROR', error: schemaCheck.error });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const existing = findExisting(sheet, headers, order.idempotency_key, order.order_reference);

      // DEV-04: same idempotency key, identical payload → the browser retried
      // after an ambiguous failure. Return the original success, not a new row —
      // but repair a derived cell first if an earlier attempt appended the row
      // and then failed before finishing it (ALX-07).
      if (existing.byKey) {
        if (existing.byKey.payloadHash === payloadHash) {
          repairRowIfNeeded(sheet, headers, existing.byKey.row);
          return jsonResponse({ ok: true, order_reference: existing.byKey.orderReference, duplicate: true });
        }
        // Same key, different content — a genuine conflict. Stop; do not store.
        return jsonResponse({
          ok: false, code: 'CONFLICT', order_reference: existing.byKey.orderReference,
          error: 'Idempotency key reused with different order data.'
        });
      }

      // Same human-readable reference under a different key: astronomically
      // unlikely (1,048,576 combinations/day — see ALX-09), but the reference
      // must stay unique for owner lookups and payment links, so mint a fresh
      // one rather than storing two orders under the same customer-visible
      // reference. `renamedFrom` tells the client which of its own references
      // this response actually confirms.
      let finalReference = order.order_reference;
      let renamedFrom = null;
      if (existing.byReference && existing.byReference.idempotencyKey !== order.idempotency_key) {
        renamedFrom = order.order_reference;
        finalReference = regenerateOrderReference(order.order_reference, function (candidate) {
          return !!findExisting(sheet, headers, '', candidate).byReference;
        });
        if (!finalReference) {
          return jsonResponse({ ok: false, code: 'STORAGE_ERROR', error: 'Could not allocate a unique order reference.' });
        }
      }

      const pricing = computeVerifiedTotals(order.item_data, order.message_card_enabled === true, CATALOG);
      const orderMode = resolveOrderMode(order.item_data);
      const priceMismatch = Math.round(pricing.total) !== Math.round(Number(order.estimated_product_total) || -1);
      const isBali = order.location_type === 'bali';
      // ALX-08: built from validated item_data and this script's own CATALOG —
      // never from order.order_summary, which the browser could have sent as
      // anything. See buildOrderSummary().
      const orderSummary = buildOrderSummary(order.item_data, CATALOG);

      const row = buildRow(headers, {
        'Order Reference': finalReference,
        'Idempotency Key': order.idempotency_key,
        'Payload Hash': payloadHash,
        'Catalog Version': CATALOG_VERSION,
        'Submitted Catalog Version': safeNumber(order.catalog_version),
        'Submitted At': new Date(),
        'Language': order.submitted_language,
        'Currency': order.currency,
        'Source': order.source,
        'Acknowledged': order.acknowledgement === true ? 'Yes' : 'No',
        'Buyer Name': safeText(order.buyer_name),
        'Buyer WhatsApp': safeText(order.buyer_whatsapp),
        'Location Type': order.location_type,
        'Regency': isBali ? safeText(order.regency) : '',
        'Delivery Method': isBali ? safeText(order.delivery_method) : '',
        'Address': isBali ? '' : safeText(order.address),
        'City': isBali ? '' : safeText(order.city),
        'Postal Code': isBali ? '' : safeText(order.postal_code),
        'Preferred Date': order.preferred_date,
        'Order Mode': orderMode,
        'Order Summary': safeText(orderSummary),
        'Item Data': JSON.stringify(order.item_data || []),
        'Total Stems': pricing.totalStems,
        'Wrap': order.wrap,
        'Message Card': order.message_card_enabled ? 'Yes' : 'No',
        'Gift Message': order.message_card_enabled ? safeText(order.gift_message) : '',
        'Recipient Name': order.message_card_enabled ? safeText(order.recipient_name) : '',
        'Card Sender Name': order.message_card_enabled ? safeText(order.card_sender_name) : '',
        'Submitted Product Subtotal': safeNumber(order.product_subtotal),
        'Submitted Message Card Fee': safeNumber(order.message_card_fee),
        'Submitted Total': safeNumber(order.estimated_product_total),
        'Verified Product Subtotal': pricing.productSubtotal,
        'Verified Message Card Fee': pricing.messageCardFee,
        'Verified Total': pricing.total,
        'Price Mismatch': priceMismatch ? 'REVIEW' : '',
        'Shipping Fee': '',
        'Final Total': '',
        'Midtrans Payment Link': '',
        'Payment Status': 'Awaiting confirmation',
        'Work Phase': 'Not started',
        'Delivery Service': '',
        'Tracking Link/Number': '',
        'Internal Notes': ''
      });

      sheet.appendRow(row);
      const newRow = sheet.getLastRow();
      setFinalTotalFormula(sheet, headers, newRow);
      notifyOwner_(finalReference, orderMode, pricing.total, priceMismatch, sheet, newRow);

      return jsonResponse({ ok: true, order_reference: finalReference, renamed_from: renamedFrom || undefined });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse({ ok: false, code: 'STORAGE_ERROR', error: String((error && error.message) || error) });
  }
}

// ============================================================================
// Validation (DEV-05, DEV-06, DEV-11)
// ============================================================================
function validateOrder(order) {
  function fail(message) { return { ok: false, error: message }; }
  if (!order || typeof order !== 'object') return fail('Missing order.');

  if (!/^ALX-\d{6}-[A-HJ-NP-Z2-9]{4}$/.test(order.order_reference || '')) return fail('Invalid order reference.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.idempotency_key || '')) return fail('Invalid idempotency key.');

  if (['id', 'en'].indexOf(order.submitted_language) === -1) return fail('Invalid language.');
  if (order.currency !== 'IDR') return fail('Invalid currency.');
  if (order.source !== 'website') return fail('Invalid source.');
  if (order.acknowledgement !== true) return fail('Acknowledgement is required.');

  const buyerName = String(order.buyer_name || '').trim();
  if (!buyerName || buyerName.length > MAX_TEXT.buyer_name) return fail('Invalid buyer name.');
  if (!/^\+62\d{8,13}$/.test(order.buyer_whatsapp || '')) return fail('Invalid buyer WhatsApp number.');

  if (['bali', 'luar_bali'].indexOf(order.location_type) === -1) return fail('Invalid location type.');
  if (order.location_type === 'bali') {
    if (BALI_REGENCIES.indexOf(order.regency) === -1) return fail('Invalid or missing regency for a Bali order.');
    if (['grab_gojek', 'self_pickup'].indexOf(order.delivery_method) === -1) return fail('Invalid delivery method for a Bali order.');
  } else {
    const address = String(order.address || '').trim();
    const city = String(order.city || '').trim();
    if (!address || address.length > MAX_TEXT.address) return fail('Invalid delivery address.');
    if (!city || city.length > MAX_TEXT.city) return fail('Invalid city.');
    if (!/^[0-9]{5}$/.test(order.postal_code || '')) return fail('Invalid postal code.');
  }

  if (!isValidLeadTimeDate(order.preferred_date)) return fail('Preferred date must meet the minimum production lead time.');
  if (WRAP_IDS.indexOf(order.wrap) === -1) return fail('Invalid wrapping option.');

  if (typeof order.message_card_enabled !== 'boolean') return fail('Invalid message card state.');
  const giftMessage = String(order.gift_message || '');
  if (giftMessage.length > MAX_TEXT.gift_message) return fail('Gift message is too long.');
  if (!order.message_card_enabled && giftMessage.trim()) return fail('Gift message present without message card enabled.');
  const recipientName = String(order.recipient_name || '');
  const cardSenderName = String(order.card_sender_name || '');
  if (recipientName.length > MAX_TEXT.recipient_name) return fail('Recipient name is too long.');
  if (cardSenderName.length > MAX_TEXT.card_sender_name) return fail('Card sender name is too long.');
  // ALX-13: independently reject inactive card fields — the client already
  // clears these the instant the card is unchecked, so a request sending
  // either of them without the card enabled is either a stale client or
  // manipulated, and must not be stored under a name the customer removed.
  if (!order.message_card_enabled && (recipientName.trim() || cardSenderName.trim())) return fail('Card recipient/sender name present without message card enabled.');

  return validateItemData(order.item_data);
}

function isValidLeadTimeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const picked = new Date(value + 'T00:00:00');
  if (isNaN(picked.getTime())) return false;
  // ALX-12: JS's Date constructor accepts an impossible day/month and
  // rolls it forward instead of failing — new Date('2027-02-31T00:00:00')
  // silently yields March 3rd. A round-trip check against the original
  // Y-M-D components is what actually rejects it.
  const parts = value.split('-').map(Number);
  if (picked.getFullYear() !== parts[0] || picked.getMonth() + 1 !== parts[1] || picked.getDate() !== parts[2]) return false;
  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const today = new Date(todayStr + 'T00:00:00');
  const minDate = new Date(today.getTime());
  minDate.setDate(minDate.getDate() + MINIMUM_LEAD_DAYS);
  return picked.getTime() >= minDate.getTime();
}

function validateItemData(itemData) {
  function fail(message) { return { ok: false, error: message }; }
  if (!Array.isArray(itemData) || !itemData.length || itemData.length > MAX_LINES_PER_ORDER) return fail('Invalid item list.');

  let totalQty = 0;
  for (let i = 0; i < itemData.length; i += 1) {
    const item = itemData[i];
    if (!item || typeof item !== 'object') return fail('Invalid item entry.');
    const qty = item.qty;
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return fail('Invalid item quantity.');
    totalQty += qty;

    if (item.type === 'stem') {
      if (!hasOwn(CATALOG.flowerStemPrice, item.id)) return fail('Unknown flower.');
    } else if (item.type === 'pot') {
      if (!hasOwn(CATALOG.miniPotPrice, item.id)) return fail('Unknown mini pot.');
    } else if (item.type === 'package') {
      const idx = Number(item.id);
      if (!Number.isInteger(idx) || idx < 0 || idx >= CATALOG.packagePrice.length) return fail('Unknown package.');
    } else if (item.type === 'custom') {
      const stemsResult = validateCustomStems(item.stems);
      if (!stemsResult.ok) return stemsResult;
      const additionsResult = validateCustomAdditions(item.additions);
      if (!additionsResult.ok) return additionsResult;
    } else {
      return fail('Unknown item type.');
    }
  }
  if (totalQty > MAX_TOTAL_QTY) return fail('Order quantity too large.');
  return { ok: true };
}

function validateCustomStems(stems) {
  function fail(message) { return { ok: false, error: message }; }
  if (!stems || typeof stems !== 'object') return fail('Invalid custom bouquet.');
  let total = 0;
  const keys = Object.keys(stems);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!hasOwn(CATALOG.flowerStemPrice, key)) return fail('Unknown flower in custom bouquet.');
    const count = stems[key];
    if (!Number.isSafeInteger(count) || count < 1 || count > MAX_CUSTOM_STEMS_PER_FLOWER) return fail('Invalid custom bouquet stem count.');
    total += count;
  }
  if (total < CATALOG.minStems) return fail('Custom bouquet below minimum stem count.');
  if (total > MAX_CUSTOM_TOTAL_STEMS) return fail('Custom bouquet stem count too large.');
  return { ok: true };
}

function validateCustomAdditions(additions) {
  function fail(message) { return { ok: false, error: message }; }
  if (additions === undefined || additions === null) return { ok: true };
  if (typeof additions !== 'object') return fail('Invalid custom bouquet additions.');
  const keys = Object.keys(additions);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!hasOwn(CATALOG.additionPrice, key)) return fail('Unknown addition.');
    const count = additions[key];
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_CUSTOM_ADDITION_PER_KEY) return fail('Invalid addition quantity.');
  }
  return { ok: true };
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// ============================================================================
// Server-owned pricing (DEV-01, DEV-02) — mirrors app.js's computeCartTotals()
// exactly, using ONLY this file's CATALOG, never the browser's numbers.
// ============================================================================
function resolveOrderMode(itemData) {
  const seen = {};
  const types = [];
  (itemData || []).forEach(function (item) {
    if (item && item.type && !seen[item.type]) {
      seen[item.type] = true;
      types.push(item.type);
    }
  });
  if (types.length > 1) return 'mixed';
  return types[0] || 'custom';
}

function computeVerifiedTotals(itemData, messageCardEnabled, catalog) {
  const items = Array.isArray(itemData) ? itemData : [];
  let productSubtotal = 0;
  let totalStems = 0;

  items.forEach(function (item) {
    const qty = Math.floor(Number(item.qty));
    if (item.type === 'stem') {
      productSubtotal += catalog.flowerStemPrice[item.id] * qty;
      totalStems += qty;
    } else if (item.type === 'pot') {
      productSubtotal += catalog.miniPotPrice[item.id] * qty;
    } else if (item.type === 'package') {
      const idx = Number(item.id);
      productSubtotal += catalog.packagePrice[idx] * qty;
      totalStems += (catalog.packageStems[idx] || 0) * qty;
    } else if (item.type === 'custom') {
      let bouquetStems = 0;
      let bouquetSubtotal = 0;
      const stems = item.stems || {};
      Object.keys(stems).forEach(function (flowerKey) {
        const count = Math.floor(Number(stems[flowerKey]));
        bouquetStems += count;
        bouquetSubtotal += count * catalog.flowerStemPrice[flowerKey];
      });
      const additions = item.additions || {};
      Object.keys(additions).forEach(function (key) {
        const count = Math.floor(Number(additions[key]));
        bouquetSubtotal += count * catalog.additionPrice[key];
      });
      const wrapFee = bouquetStems > 0 ? Math.ceil(bouquetStems / catalog.wrapFeeUnitStems) * catalog.wrapFeePerUnit : 0;
      productSubtotal += (bouquetSubtotal + wrapFee) * qty;
      totalStems += bouquetStems * qty;
    }
  });

  const messageCardFee = messageCardEnabled && items.length > 0 ? catalog.messageCardPrice : 0;
  return { productSubtotal: productSubtotal, messageCardFee: messageCardFee, total: productSubtotal + messageCardFee, totalStems: totalStems };
}

// ============================================================================
// Idempotency (DEV-04)
// ============================================================================
function computePayloadHash(order) {
  const canonical = JSON.stringify({
    order_reference: order.order_reference, item_data: order.item_data, wrap: order.wrap,
    message_card_enabled: order.message_card_enabled, gift_message: order.gift_message,
    recipient_name: order.recipient_name, card_sender_name: order.card_sender_name,
    buyer_name: order.buyer_name, buyer_whatsapp: order.buyer_whatsapp, location_type: order.location_type,
    regency: order.regency, delivery_method: order.delivery_method, address: order.address,
    city: order.city, postal_code: order.postal_code, preferred_date: order.preferred_date
  });
  const digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical, Utilities.Charset.UTF_8);
  return digestBytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function findExisting(sheet, headers, idempotencyKey, orderReference) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { byKey: null, byReference: null };
  const keyCol = headers.map['Idempotency Key'];
  const refCol = headers.map['Order Reference'];
  const hashCol = headers.map['Payload Hash'];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  let byKey = null;
  let byReference = null;
  for (let i = 0; i < values.length; i += 1) {
    const rowValues = values[i];
    if (!byKey && keyCol !== undefined && rowValues[keyCol] === idempotencyKey) {
      byKey = { row: i + 2, orderReference: rowValues[refCol], payloadHash: rowValues[hashCol] };
    }
    if (!byReference && refCol !== undefined && rowValues[refCol] === orderReference) {
      byReference = { row: i + 2, idempotencyKey: rowValues[keyCol] };
    }
    if (byKey && byReference) break;
  }
  return { byKey: byKey, byReference: byReference };
}

// ============================================================================
// Sheet helpers (DEV-03) — every column is resolved by its header text, so
// inserting or reordering columns later never silently corrupts the mapping.
// ============================================================================
function getHeaderMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  const duplicates = [];
  values.forEach(function (name, idx) {
    if (!name) return;
    const key = String(name).trim();
    // ALX-07: a repeated header used to alias silently to whichever column
    // this forEach saw last, aliasing two real columns into one and losing
    // the other's data on every write. Detect it instead of overwriting.
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      duplicates.push(key);
    } else {
      map[key] = idx;
    }
  });
  return { map: map, length: lastCol, duplicates: duplicates };
}

/**
 * ALX-07: fail loudly, before any append, if the sheet's header row does not
 * match what doPost's writes assume — instead of buildRow() silently
 * dropping data into no column at all, or findExisting() silently disabling
 * deduplication because "Idempotency Key" wasn't found.
 */
function validateHeaderSchema(headers) {
  function fail(message) { return { ok: false, error: message }; }
  if (headers.duplicates && headers.duplicates.length > 0) {
    return fail('Duplicate column header(s) in the Orders sheet: ' + headers.duplicates.join(', ') + '. Every heading from Part 1 must exist exactly once.');
  }
  const missing = REQUIRED_HEADERS.filter(function (name) { return headers.map[name] === undefined; });
  if (missing.length > 0) {
    return fail('Missing column header(s) in the Orders sheet: ' + missing.join(', ') + '. Re-check Part 1\'s header row.');
  }
  return { ok: true };
}

function buildRow(headers, valuesByHeader) {
  const row = new Array(headers.length).fill('');
  Object.keys(valuesByHeader).forEach(function (name) {
    const idx = headers.map[name];
    if (idx !== undefined) row[idx] = valuesByHeader[name];
  });
  return row;
}

function setFinalTotalFormula(sheet, headers, row) {
  const verifiedCol = headers.map['Verified Total'];
  const shippingCol = headers.map['Shipping Fee'];
  const finalCol = headers.map['Final Total'];
  if (verifiedCol === undefined || shippingCol === undefined || finalCol === undefined) return;
  const verifiedA1 = columnToLetter(verifiedCol + 1) + row;
  const shippingA1 = columnToLetter(shippingCol + 1) + row;
  // Blank until BOTH the verified total and the shipping fee exist (DEV-03) —
  // written once, after appendRow(), directly into this row's own cell, never
  // copied down in advance.
  sheet.getRange(row, finalCol + 1).setFormula(
    '=IF(OR(' + verifiedA1 + '="",' + shippingA1 + '=""),"",' + verifiedA1 + '+' + shippingA1 + ')'
  );
}

/**
 * ALX-07: called on every duplicate-lookup hit (a retried, already-stored
 * attempt) so a row left incomplete by a prior failure between appendRow()
 * and setFinalTotalFormula() gets repaired instead of staying permanently
 * blank. Only touches a cell that is truly empty — no formula AND no
 * manually-typed value — so it can never overwrite a legitimate owner edit.
 */
function repairRowIfNeeded(sheet, headers, row) {
  const finalCol = headers.map['Final Total'];
  if (finalCol === undefined) return;
  const cell = sheet.getRange(row, finalCol + 1);
  if (cell.getFormula() === '' && cell.getValue() === '') {
    setFinalTotalFormula(sheet, headers, row);
  }
}

/**
 * ALX-09: mints a fresh customer-visible reference sharing the original's
 * date segment, retrying until `isTaken` reports a free one. Returns null
 * (never a best-effort guess) if it cannot find one within a few tries, so
 * the caller fails loudly instead of ever storing two orders under the same
 * reference.
 */
function regenerateOrderReference(base, isTaken) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const datePart = String(base || '').split('-')[1] || Utilities.formatDate(new Date(), TIMEZONE, 'yyMMdd');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 4; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const candidate = 'ALX-' + datePart + '-' + suffix;
    if (!isTaken(candidate)) return candidate;
  }
  return null;
}

/**
 * ALX-08: the human-readable "Order Summary" column, built only from
 * validated item_data and this script's own CATALOG — never from
 * order.order_summary, which is browser-supplied and was previously stored
 * verbatim. Product names are generic (flower/addition keys, mini-pot slugs,
 * package stem counts) rather than the storefront's marketing names, since
 * those live only in site-content.js — but every value here is guaranteed
 * to describe what validateOrder() actually accepted, which is the point.
 */
function buildOrderSummary(itemData, catalog) {
  return (itemData || []).map(function (item) {
    if (item.type === 'stem') return item.qty + '× ' + item.id;
    if (item.type === 'pot') return item.qty + '× ' + humanizeKey(item.id) + ' mini pot';
    if (item.type === 'package') {
      const idx = Number(item.id);
      const stems = catalog.packageStems[idx];
      return item.qty + '× package (' + stems + ' stems)';
    }
    const stemParts = Object.keys(item.stems || {}).map(function (key) {
      return item.stems[key] + '× ' + key;
    });
    const additionParts = Object.keys(item.additions || {})
      .filter(function (key) { return item.additions[key] > 0; })
      .map(function (key) { return item.additions[key] + '× ' + humanizeKey(key) + ' addition'; });
    const parts = stemParts.concat(additionParts);
    return item.qty + '× custom bouquet (' + parts.join(', ') + ')';
  }).join('; ');
}

function humanizeKey(key) {
  return String(key || '').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function columnToLetter(column) {
  let temp;
  let letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

// ============================================================================
// Owner notification (DEV-21) — best-effort only; a failure here must never
// turn an already-stored order into a failed response.
// ============================================================================
function notifyOwner_(orderReference, orderMode, verifiedTotal, priceMismatch, sheet, row) {
  try {
    const email = PropertiesService.getScriptProperties().getProperty('OWNER_NOTIFY_EMAIL');
    if (!email) return;
    const url = sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + row;
    const subject = (priceMismatch ? '[REVIEW] ' : '') + 'New Alxanthia order ' + orderReference;
    const body = 'Reference: ' + orderReference + '\nMode: ' + orderMode + '\nVerified total: Rp ' + verifiedTotal +
      (priceMismatch ? '\n\nSubmitted and verified totals differ — review before sending a payment link.' : '') +
      '\n\nOpen the row: ' + url;
    MailApp.sendEmail(email, subject, body);
  } catch (notifyError) {
    // Intentionally swallowed — see OWNER-08 for the interim Sheet-native
    // notification while you confirm this is delivering reliably.
  }
}

// ============================================================================
// Small utilities
// ============================================================================
function safeText(value) {
  const text = String(value === undefined || value === null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// Mirrors app.js's normalizeIndonesianPhone. The website already normalizes
// buyer_whatsapp before submitting, but this endpoint can be called directly
// (or by an older/cached client), so it re-normalizes here too — the sheet
// must only ever see one canonical format (+62...), never 089..., 89..., etc.
function normalizeIndonesianPhone(raw) {
  var digits = String(raw || '').trim().replace(/[^\d+]/g, '');
  digits = digits.replace(/(?!^)\+/g, '');
  if (digits.indexOf('+62') === 0) {
    digits = '+62' + digits.slice(3).replace(/^0+/, '');
  } else if (digits.indexOf('62') === 0) {
    digits = '+62' + digits.slice(2).replace(/^0+/, '');
  } else if (digits.indexOf('0') === 0) {
    digits = '+62' + digits.slice(1);
  } else if (digits.indexOf('+') === 0) {
    return digits;
  } else if (digits) {
    digits = '+62' + digits;
  }
  return digits;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
```

5. Click **Project Settings** (the gear icon), check **Show "appsscript.json" manifest file in editor**, then set the **Script time zone** to `Asia/Makassar` (GMT+08:00) if the field is visible there — otherwise the `TIMEZONE` constant at the top of the code above already fixes this independently of the project setting (OWNER-07).
6. Open **Project Settings → Script Properties** and add:

   | Property | Value |
   | --- | --- |
   | `WEBHOOK_SECRET` | A unique random value of at least 30 letters and numbers. Do not use example text and do not share it. |
   | `OWNER_NOTIFY_EMAIL` | The inbox that should receive a short email for every new order (OWNER-03, OWNER-21). Leave blank to skip this — see OWNER-08 for the interim option. |
   | `ORDERING_PAUSED` | Leave unset. Only set to exactly `true` when you need every submission rejected regardless of what the website shows (ALX-11) — a real, server-side stop, unlike pausing the WhatsApp/Shopee buttons on the site itself. Remove it (not just set to `false`) to resume. |

7. Click **Save**. Do not click **Run**; `doPost` only works when it receives a web request.

### Deploy the Apps Script

1. Click **Deploy → New deployment** (or **Manage deployments → Edit → New version** if you are updating an existing one).
2. Click the gear beside **Select type**, then choose **Web app** (only needed the first time).
3. Enter **Alxanthia order writer** as the description.
4. Choose **Execute as: Me**.
5. Choose **Who has access: Anyone**.
6. Click **Deploy**, select your Google account, and approve the requested spreadsheet access.
7. Copy the Web App URL ending in `/exec`. Keep it private for the next part.

If you ever change a price, add a product, or edit the Bali kabupaten/kota list in `site-content.js`, update the matching value in the `CATALOG`/`BALI_REGENCIES` constants at the top of this script too, bump `CATALOG_VERSION` (and the matching `catalogVersion` in `site-content.js`), then redeploy (**Deploy → Manage deployments → edit the pencil icon → New version**) — otherwise the script will reprice orders using stale numbers or reject valid new options.

---

## Part 3 — Create the Cloudflare Worker

1. Sign in or create a free account at <https://dash.cloudflare.com>.
2. Open **Workers & Pages → Create → Worker**.
3. Name it **alxanthia-order-endpoint** and deploy the starter Worker (skip if updating an existing one).
4. Open **Edit code**, delete the starter code, and paste:

```javascript
// ALX-10: the exact Turnstile widget action app.js renders with — pinned
// here too so a token issued for some other action/site can't be replayed.
const TURNSTILE_ACTION = 'order_submission';
// Mirrors the Apps Script's own MAX_BODY_BYTES (Part 1) — this Worker
// enforces the same cap before the request ever reaches Apps Script.
const MAX_BODY_BYTES = 30000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
      'Vary': 'Origin'
    };

    if (origin !== env.ALLOWED_ORIGIN) return reply({ ok: false, error: 'Origin not allowed' }, 403, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ ok: false, error: 'Method not allowed' }, 405, headers);

    // ALX-10: reject an unsupported content type before touching the body at all.
    const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return reply({ ok: false, error: 'Unsupported content type.' }, 415, headers);
    }

    // An early, cheap rejection for an obviously oversized request — the
    // byte-length check after reading the body (below) is the real limit,
    // since Content-Length is only a declared value, not a guarantee.
    const declaredLength = Number(request.headers.get('Content-Length') || '0');
    if (declaredLength > MAX_BODY_BYTES) {
      return reply({ ok: false, error: 'The order is too large to submit.' }, 413, headers);
    }

    // ALX-10: rate-limited by IP before any parsing or upstream work. Add a
    // Rate Limiting binding named RATE_LIMITER (Settings → Bindings → Add →
    // Rate Limiting) to enforce this — bindings are local to each Cloudflare
    // location, not a strict global quota, so treat this as one layer, not
    // the only one. The Worker still functions without the binding, just
    // without this layer; confirm it's bound before launch (O-02).
    if (env.RATE_LIMITER) {
      const rateLimitKey = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: rateLimitKey });
      if (!success) {
        log(null, 'RATE_LIMITED', origin);
        return reply({ ok: false, error: 'Too many requests. Please try again shortly.' }, 429, headers);
      }
    }

    let rawBody;
    try {
      rawBody = await request.text();
    } catch (readError) {
      return reply({ ok: false, error: 'Some details could not be saved. Please check the form and try again.' }, 400, headers);
    }
    if (rawBody.length > MAX_BODY_BYTES) {
      return reply({ ok: false, error: 'The order is too large to submit.' }, 413, headers);
    }

    let order;
    try {
      order = JSON.parse(rawBody);
    } catch (parseError) {
      return reply({ ok: false, error: 'Some details could not be saved. Please check the form and try again.' }, 400, headers);
    }
    // ALX-10: a JSON `null`, an array, or any other non-object top-level
    // value used to reach the Turnstile check below and throw an unhandled
    // exception reading `order.cf_turnstile_token` off it.
    if (!order || typeof order !== 'object' || Array.isArray(order)) {
      return reply({ ok: false, error: 'Some details could not be saved. Please check the form and try again.' }, 400, headers);
    }

    // ALX-10: fail CLOSED — a missing TURNSTILE_SECRET must never silently
    // skip bot protection in production. Set ALLOW_INSECURE_TESTING to
    // exactly 'true' on a dedicated test/staging Worker only, to let setup
    // proceed in stages before Turnstile is configured (OWNER-05).
    if (!env.TURNSTILE_SECRET && env.ALLOW_INSECURE_TESTING !== 'true') {
      log(order.order_reference, 'TURNSTILE_NOT_CONFIGURED', origin);
      return reply({ ok: false, error: 'Ordering is temporarily unavailable.' }, 503, headers);
    }
    if (env.TURNSTILE_SECRET) {
      const token = order.cf_turnstile_token;
      const expectedHostname = hostnameOf(env.ALLOWED_ORIGIN);
      if (!token || !(await verifyTurnstile(token, env.TURNSTILE_SECRET, request.headers.get('CF-Connecting-IP'), expectedHostname))) {
        log(order.order_reference, 'TURNSTILE_FAILED', origin);
        return reply({ ok: false, error: 'Verification failed. Please try again.' }, 403, headers);
      }
    }
    delete order.cf_turnstile_token;

    let googleResult;
    try {
      const googleResponse = await fetch(env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ webhook_secret: env.WEBHOOK_SECRET, order })
      });
      googleResult = await googleResponse.json();
    } catch (upstreamError) {
      log(order.order_reference, 'UPSTREAM_UNREACHABLE', origin);
      return reply({ ok: false, error: 'Order could not be stored.' }, 502, headers);
    }

    if (googleResult.ok === true) {
      log(googleResult.order_reference, googleResult.duplicate ? 'DUPLICATE' : 'STORED', origin);
      // ALX-09: relay renamed_from too, so a rare reference collision the
      // Apps Script resolved is not silently dropped on the way back.
      return reply({ ok: true, order_reference: googleResult.order_reference, duplicate: googleResult.duplicate === true, renamed_from: googleResult.renamed_from }, 200, headers);
    }

    // DEV-07: fixed, public error codes — never relay the Apps Script's raw
    // error text (which can describe internal validation details) to the browser.
    const status = STATUS_BY_CODE[googleResult.code] || 502;
    const publicMessage = PUBLIC_MESSAGE_BY_CODE[googleResult.code] || 'Order could not be stored.';
    log(order.order_reference, googleResult.code || 'UNKNOWN_ERROR', origin);
    return reply({ ok: false, error: publicMessage, order_reference: googleResult.order_reference }, status, headers);
  }
};

function hostnameOf(originUrl) {
  try { return new URL(originUrl).hostname; } catch (e) { return ''; }
}

const STATUS_BY_CODE = {
  VALIDATION: 400,
  BAD_JSON: 400,
  PAYLOAD_TOO_LARGE: 413,
  // The browser never sends webhook_secret itself, so UNAUTHORIZED here means
  // the Worker's and Apps Script's secrets are out of sync — an owner setup
  // problem, not something the customer can fix, hence a 502 (ambiguous).
  UNAUTHORIZED: 502,
  CONFLICT: 409,
  STORAGE_ERROR: 502,
  // ALX-07: also an owner setup problem (a missing/duplicated sheet column),
  // never something the customer caused or can fix.
  SCHEMA_ERROR: 502,
  // ALX-11: a deliberate, owner-set hard stop — not the customer's fault,
  // but real and worth its own status rather than a generic 502.
  ORDERING_PAUSED: 503
};

const PUBLIC_MESSAGE_BY_CODE = {
  VALIDATION: 'Some details could not be saved. Please check the form and try again.',
  BAD_JSON: 'Some details could not be saved. Please check the form and try again.',
  PAYLOAD_TOO_LARGE: 'The order is too large to submit.',
  CONFLICT: 'This order reference was already used with different details.',
  STORAGE_ERROR: 'Order could not be stored.',
  SCHEMA_ERROR: 'Order could not be stored.',
  ORDERING_PAUSED: 'Ordering is temporarily paused. Please contact us directly to place an order.'
};

async function verifyTurnstile(token, secret, remoteIp, expectedHostname) {
  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    if (remoteIp) form.append('remoteip', remoteIp);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const result = await response.json();
    if (result.success !== true) return false;
    // ALX-10: also pin the action and hostname the token was issued for —
    // otherwise a token is valid for ANY action or site sharing the same
    // Turnstile account, not just this order form.
    if (result.action && result.action !== TURNSTILE_ACTION) return false;
    if (expectedHostname && result.hostname && result.hostname !== expectedHostname) return false;
    return true;
  } catch (verifyError) {
    return false;
  }
}

function log(reference, code, origin) {
  // DEV-07: log the rejection code, reference, origin, and timestamp only —
  // never the buyer's name, phone number, address, or gift message. Visible
  // under Workers & Pages → your Worker → Logs.
  console.log(JSON.stringify({ code: code, reference: reference || null, origin: origin, at: new Date().toISOString() }));
}

function reply(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}
```

5. Click **Save and deploy**.
6. Open the Worker's **Settings → Variables and Secrets** (the label may be **Bindings**).
7. Add these values:

| Name | Value | Visibility |
| --- | --- | --- |
| `ALLOWED_ORIGIN` | Your exact website origin, such as `https://alxanthia.com`, with no trailing slash | Plain text |
| `GOOGLE_SCRIPT_URL` | The Google Apps Script URL ending in `/exec` | Secret if available |
| `WEBHOOK_SECRET` | The exact random secret used in Apps Script's Script Properties | Secret |
| `TURNSTILE_SECRET` | The Turnstile **secret key** from OWNER-05. Required in production (ALX-10) — the Worker now rejects every submission with "Ordering is temporarily unavailable" while this is empty, instead of silently skipping bot protection. | Secret |
| `ALLOW_INSECURE_TESTING` | Leave unset on the production Worker. Set to exactly `true` only on a separate test/staging Worker, to let setup proceed before `TURNSTILE_SECRET` exists. | Plain text |

8. Add a **Rate Limiting** binding (ALX-10): **Settings → Bindings → Add → Rate Limiting**, variable name `RATE_LIMITER`, and a reasonable limit for real customer traffic (start conservative — this only rejects with a 429 once actually exceeded, and requests within the limit are unaffected). Confirm it's bound before launch (O-02); a Worker without it still runs, just without this layer.
9. Save the variables and redeploy if Cloudflare asks.
10. Copy the public Worker URL, such as `https://alxanthia-order-endpoint.your-name.workers.dev`.

The Worker code itself never needs to change when you add fields, rename regencies, or adjust prices — it forwards whatever the website sends and lets the Apps Script decide what is valid. Only Part 1 (Sheet columns) and Part 2 (Apps Script `CATALOG`/`BALI_REGENCIES`) need updating for that kind of change.

### Part 3a — Create the Turnstile widget (OWNER-05)

This step is what actually turns on the bot check the Worker code above is ready for. Skipping it is safe (checkout keeps working without it) but means DEV-07's abuse control is not active yet — do this before removing the passcode/`noindex` staging gates (OWNER-11).

1. In the Cloudflare dashboard, open **Turnstile** in the left sidebar (search "Turnstile" if you don't see it).
2. Click **Add widget**.
3. Name it `Alxanthia checkout` and add your domain (`alxanthia.com`, plus `www.alxanthia.com` if you use it).
4. Choose the **Managed** widget mode (the default) and create it.
5. Copy the **Site Key** (safe to publish) and paste it into `site-content.js`:

   ```javascript
   turnstileSiteKey: "your-site-key-here",
   ```

6. Copy the **Secret Key** and add it as the Worker's `TURNSTILE_SECRET` variable from the table above (Secret visibility). Never put the secret key in `site-content.js` or anywhere else in this repository.
7. Deploy the updated website (with the site key filled in) and redeploy the Worker (with the secret key set) together, then submit one real test order to confirm the widget appears on the order form and the order still saves.

### Confirm rate limiting (OWNER-06)

1. In the Cloudflare dashboard for your domain, open **Security → WAF → Rate limiting rules** (the exact path can vary by plan).
2. Create or confirm a rule scoped to the Worker's route (or to `POST` requests to the Worker's hostname) that limits requests to roughly **10 per minute per IP address**, blocking or challenging requests over that rate.
3. This repository cannot verify a dashboard-only rule exists — confirm it manually and re-check occasionally as you watch real traffic (Worker **Logs**) after launch, adjusting the number up or down from what you observe.

---

## Part 4 — Connect the website

In `site-content.js`, find:

```javascript
orderSubmissionUrl: "",
```

Change it to your public Worker URL:

```javascript
orderSubmissionUrl: "https://alxanthia-order-endpoint.your-name.workers.dev",
```

Only the Worker URL (and, once created, the Turnstile **site** key from Part 3a) belong in this file. Do not add the webhook secret, Turnstile secret key, Apps Script URL, Google credentials, or Midtrans credentials.

If you prefer, send the public Worker URL to the developer maintaining the website. It is safe to share the public Worker URL and the Turnstile site key; it is not safe to share any secret.

---

## Part 5 — Test orders

Deploy the updated website, then, using test data only:

1. Submit a single finished stem.
2. Submit a mini pot on its own — confirm it is accepted (this used to be rejected before DEV-01) and that **Order Mode** reads `pot`.
3. Submit a cart mixing a stem, a mini pot, and a package in one order — confirm **Order Mode** reads `mixed`, not `custom`.
4. Submit a custom bouquet with an addition and a paid message card.
5. For each, confirm:
   - the **Verified Total** matches what the page showed you, and **Price Mismatch** is blank;
   - **Total Stems**, **Order Mode**, and **Item Data** look correct;
   - the location columns are filled correctly for the path you tested (Bali columns filled and address columns blank, or vice versa);
   - **Payment Status** is **Awaiting confirmation** and **Work Phase** is **Not started**;
   - **Final Total** is blank until you fill in **Shipping Fee**, then appears automatically;
   - exactly one row was added — resubmitting the same still-open checkout (e.g. clicking Save twice, or retrying after closing/reopening a slow connection) must never add a second row for the same attempt;
   - if `OWNER_NOTIFY_EMAIL` is set, an email arrived with the reference and a link to the row, and no private customer fields.
6. Try picking a date before the minimum lead time — it must be rejected both by the page and, if you bypass the page, by the Apps Script.
7. Click **Lanjut ke WhatsApp** and confirm the message has the reference, name, order, total, and date—but not the address, WhatsApp number, gift message, or recipient/sender name.

## Troubleshooting

### "Penyimpanan pesanan belum dikonfigurasi" / "Order saving is not configured yet"

The Worker URL is still missing from `site-content.js`, or the updated website has not been deployed.

### The order form shows a "verification" error and will not save

Turnstile is configured on the Worker (`TURNSTILE_SECRET` is set) but the matching `turnstileSiteKey` is missing, wrong, or the deployed website is older than the change — confirm both were deployed together (Part 3a, step 7).

### An order is stuck saying its status is uncertain

1. Look in the Sheet for the displayed reference before retrying — resubmitting reuses the same idempotency key automatically, so it is safe to click Save again.
2. Open the Cloudflare Worker **Logs** and find the entry for that reference; the `code` field says why it was rejected.
3. Confirm `ALLOWED_ORIGIN` exactly matches the website URL, including `www` if used and without a trailing slash.
4. Confirm `GOOGLE_SCRIPT_URL` ends in `/exec`.
5. Confirm `WEBHOOK_SECRET` in Cloudflare matches the Script Property of the same name in Apps Script exactly.
6. Confirm the Apps Script deployment executes as you and allows Anyone.

### Google Sheet stays empty

Confirm the worksheet is named exactly `Orders`, the Apps Script was created from that spreadsheet, the header row matches Part 1 exactly (the script looks up columns by header text), and the deployed URL—not the editor URL—was placed in Cloudflare.

### A valid-looking Bali order is rejected

Check that the regency the customer picked is spelled exactly the same in `site-content.js`'s `baliRegencies` list and in the Apps Script's `BALI_REGENCIES` list — a mismatch after either one was edited is the most common cause.

### A valid-looking order is rejected right after a price change

Check that `CATALOG_VERSION` and every price in the Apps Script's `CATALOG` match `site-content.js` exactly, and that you redeployed a **New version** of the Apps Script (not just saved it) after editing.

## Migrating an existing deployment

If you already had an earlier version of this endpoint running (before pot/mixed carts, server-side repricing, and real idempotency existed), do this in one maintenance window (OWNER-04):

1. Keep the passcode curtain active, or otherwise pause public ordering, for the duration of this migration.
2. **File → Make a copy** of your current spreadsheet as a backup, and leave that copy untouched.
3. On the live spreadsheet, delete the old `Final Total` formula from every existing row below the header (select the whole column's data rows and press Delete) — the old guide had you copy this formula down in advance, which now conflicts with `appendRow()`.
4. Add the new columns from Part 1 that did not exist before (`Idempotency Key`, `Payload Hash`, `Catalog Version`, `Submitted Catalog Version`, `Language`, `Currency`, `Source`, `Acknowledged`, `Verified Product Subtotal`, `Verified Message Card Fee`, `Verified Total`, `Price Mismatch`). Existing rows can stay blank in these new columns — they were not part of the older orders.
5. Replace the Apps Script code with Part 2's version in full, replace the Worker code with Part 3's version in full, then deploy **New version**/**Save and deploy** for both.
6. Confirm the header row has every column from Part 1's list exactly once (ALX-07): `doPost` now checks this itself on every submission and fails loudly with `SCHEMA_ERROR` rather than silently dropping data into the wrong column or storing a row with missing fields, but fixing it here first avoids that error reaching a real customer.
7. Submit one test order (Part 5) and verify every column before reopening public ordering.
8. Re-apply the column protections from Part 1 if they were lost when columns were added.
