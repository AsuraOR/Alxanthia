# Komorebi Lightweight Checkout and Order-Capture Implementation Plan

## Document purpose

This document is an implementation specification for an AI coding agent. It describes a lightweight checkout system for the existing Komorebi Creations website that:

- preserves the current product catalogue, bouquet packages, custom bouquet builder, bilingual experience, and visual identity;
- records every submitted order in Google Sheets through a hosted Tally order form;
- opens WhatsApp with a concise, prefilled order-confirmation message after the order has been recorded;
- leaves shipping confirmation and Midtrans Payment Link creation manual in version 1;
- does not expose payment credentials or other secrets in frontend code; and
- avoids building a custom account, cart, database, payment processor, admin dashboard, or courier integration.

The implementation agent must inspect the repository before changing anything. It must preserve unrelated working behavior and make the smallest coherent set of changes.

---

## 1. Target customer journey

1. The customer opens the Komorebi homepage.
2. The customer chooses an individual flower, a fixed bouquet package, or a custom bouquet.
3. The customer selects quantities and finishing options.
4. The website shows one complete, consistent order review.
5. The customer continues to a short hosted Tally order form.
6. Existing order data is transferred to Tally without requiring the customer to select everything again.
7. The customer enters buyer, recipient, delivery, and contact information.
8. Tally records the submission and synchronizes it to Google Sheets.
9. The customer is shown a success state with the order reference.
10. The customer continues to WhatsApp with a prefilled message.
11. Komorebi confirms availability, delivery fee, delivery timing, and final total in WhatsApp.
12. Komorebi creates and sends a unique Midtrans Payment Link manually.
13. Komorebi checks the Midtrans dashboard or payment email, then manually changes the spreadsheet payment status to `Paid`.
14. Komorebi manages production and fulfilment using controlled spreadsheet statuses.

### Critical ordering rule

The order must be submitted and stored before WhatsApp opens. WhatsApp alone is not the system of record because a customer can open WhatsApp without sending the message.

---

## 2. Version 1 scope

### Included

- One order state shared by all product-selection surfaces.
- Order-review screen or section before personal data collection.
- Hosted or embedded Tally form.
- Tally hidden fields populated from the website order state.
- Required customer and delivery questions.
- Automatic synchronization from Tally to Google Sheets.
- Prefilled WhatsApp confirmation message.
- Manual shipping-fee confirmation.
- Manual Midtrans Payment Link creation.
- Manual payment-status and work-phase updates in Google Sheets.
- Indonesian and English customer-facing copy where the website currently supports both languages.
- Validation, accessibility, error handling, analytics-safe events, and automated tests for production code.

### Explicitly excluded

- Midtrans API keys in frontend JavaScript.
- Automatic Midtrans Payment Link generation.
- Midtrans webhook handling.
- Automatic WhatsApp Business API messages.
- Automatic GoSend booking or shipping quotation.
- Customer accounts or passwords.
- A custom merchant administration dashboard.
- A custom backend or database solely for checkout.
- Automatic decrementing of inventory.
- Guaranteed delivery times.
- Collection of payment screenshots.

Do not implement excluded features unless the business owner separately approves a later phase.

---

## 3. Proposed architecture

| Responsibility | System |
| --- | --- |
| Product browsing and order configuration | Existing Komorebi website |
| Temporary in-browser order state | Existing JavaScript controller/store |
| Customer and delivery form | Tally |
| Permanent order record | Google Sheets via Tally integration |
| Customer conversation | WhatsApp deep link |
| Payment collection | Midtrans hosted Payment Link |
| Payment verification | Midtrans dashboard/email in version 1 |
| Production tracking | Google Sheets dropdown fields |
| Delivery booking | Manual in version 1 |

### Trust boundaries

- The website is a public client and cannot be trusted to protect secrets.
- Tally and Midtrans are hosted third-party services.
- Values passed to Tally hidden fields are useful operational data, not authoritative payment records.
- The customer-visible amount is an estimate until Komorebi confirms delivery and the final total.
- A row in Google Sheets does not prove payment.
- Only a successful Midtrans transaction viewed in Midtrans should change payment status to `Paid` in version 1.

---

## 4. Required order-state model

Reuse the existing application state where possible. Do not create a second independent selection model.

The normalized order state must support:

```text
orderMode: none | stem | package | custom
selectedStemId: string | null
selectedStemQuantity: integer >= 0
selectedPackageId: string | null
customStemQuantities: map of product ID to integer >= 0
totalStemCount: integer >= 0
wrapId: string | null
giftMessage: string
productSubtotal: integer >= 0
discountAmount: integer >= 0
estimatedProductTotal: integer >= 0
currency: IDR
language: id | en
```

### State requirements

- Only one order mode may be active at a time.
- Editing custom-bouquet quantities must activate `custom` mode.
- Selecting a fixed package must clear incompatible individual/custom selections.
- Selecting an individual stem must preserve its quantity and clear incompatible package/custom selections.
- The same calculation functions must power the product UI, sticky summary, order review, Tally payload, and WhatsApp summary.
- Never recalculate prices independently in the Tally-link or WhatsApp-link builder.
- User-entered gift messages must always be handled as text, never HTML.
- The order must not proceed while no valid product is selected.
- A custom bouquet must meet the existing minimum-stem rule before checkout.

---

## 5. Customer-facing website flow

### Step 1 — Product selection

Preserve the three routes:

1. Individual flower.
2. Fixed bouquet package.
3. Custom bouquet.

Recommended CTA labels:

| Context | Indonesian | English |
| --- | --- | --- |
| Individual stem | Pilih bunga ini | Choose this flower |
| Fixed bouquet | Pilih buket ini | Choose this bouquet |
| Valid custom bouquet | Tambahkan buket ke pesanan | Add bouquet to order |
| Persistent order bar | Tinjau pesanan | Review order |

After a valid choice, update the persistent order summary and provide a clear path to the order-review area. Do not unexpectedly open Tally immediately after product selection.

### Step 2 — Finishing options

Allow the customer to configure existing finishing options, including:

- wrap colour;
- gift-card message; and
- any existing product-specific option that affects the stored order.

Show changes immediately in the shared order summary.

### Step 3 — Order review

Before collecting personal information, display:

- selected product/package;
- quantities by product;
- total stem count where applicable;
- wrapping choice;
- gift-card message or `No card message`;
- product subtotal;
- discount as a separate line when applicable;
- estimated product total; and
- a clear note that delivery is calculated and confirmed through WhatsApp.

Required actions:

- `Ubah pesanan / Edit order`
- `Lanjutkan pemesanan / Continue order`

Required notice:

> Belum ada pembayaran pada tahap ini. Kami akan mengonfirmasi alamat, ongkos kirim, dan total akhir melalui WhatsApp.

English equivalent:

> No payment is required at this stage. We will confirm your address, delivery fee, and final total through WhatsApp.

### Step 4 — Order form

The form may be embedded if it behaves reliably and visually fits the page. Otherwise open the hosted form in the same tab. Do not use a popup window.

Keep a readable order summary visible immediately before the form. Customers must not have to reselect product details in Tally.

### Step 5 — Recorded-order confirmation

After successful submission, show:

> Pesanan Anda sudah dicatat. Lanjutkan ke WhatsApp agar studio kami dapat mengonfirmasi ketersediaan, pengiriman, dan pembayaran.

Then provide:

`Lanjut ke WhatsApp →`

Do not state that an order is confirmed, paid, or in production at this point.

---

## 6. Tally form specification

### Section A — Review

Display a human-readable order summary passed from the website.

Required confirmation:

**Apakah detail pesanan di atas sudah benar?**

- `Ya, detail pesanan sudah benar.`

### Section B — Buyer

1. **Nama pemesan / Buyer name** — required text.
2. **Nomor WhatsApp pemesan / Buyer WhatsApp number** — required telephone text.
3. **Email** — optional email.

Helper text:

> Kami akan menghubungi nomor ini untuk konfirmasi pesanan, ongkos kirim, dan pembayaran.

### Section C — Recipient

**Pesanan ini untuk siapa? / Who is this order for?** — required single choice:

- Untuk saya sendiri / Myself
- Untuk orang lain atau hadiah / Someone else or a gift

When `gift` is selected, reveal:

1. **Nama penerima / Recipient name** — required.
2. **Nomor WhatsApp penerima / Recipient WhatsApp number** — required.
3. **Apakah kami boleh menghubungi penerima? / May we contact the recipient?** — required:
   - Ya, boleh / Yes
   - Hubungi saya terlebih dahulu / Contact me first
   - Jangan hubungi penerima; ini kejutan / Do not contact the recipient; it is a surprise

### Section D — Delivery

Komorebi offers delivery only. Do not ask the customer to choose a fulfilment method and do not display a pickup option.

Require:

1. **Alamat lengkap pengiriman / Complete delivery address**.
2. **Kota atau kabupaten / City or regency**.
3. **Kode pos / Postal code**.

Optional but recommended:

4. **Patokan atau petunjuk lokasi / Location directions**.

Date question:

**Tanggal yang diinginkan / Preferred date** — required date.

- Prevent dates that contradict the advertised minimum production lead time when Tally supports the rule reliably.
- If the system cannot safely calculate eligible dates, display the lead-time notice and allow Komorebi to confirm the date manually.
- For nationwide courier delivery, label the date as preferred dispatch date rather than guaranteed arrival date.

Optional delivery-window choice:

- Pagi / Morning
- Siang / Afternoon
- Sore / Evening
- Fleksibel / Flexible

Notice:

> Tanggal dan waktu merupakan preferensi dan akan dikonfirmasi melalui WhatsApp.

### Section E — Gift details

Prefill or display the website gift message.

Optional questions:

1. **Nama pengirim pada kartu / Sender name on card**.
2. **Kirim secara anonim? / Send anonymously?** — Yes/No.

### Section F — Notes and consent

**Catatan tambahan / Additional notes** — optional long text.

Show:

> Permintaan yang memengaruhi harga akan dikonfirmasi sebelum pembayaran.

Required acknowledgement:

> Saya memahami bahwa pesanan dibuat setelah pembayaran dikonfirmasi dan detail pengiriman akan diperiksa melalui WhatsApp.

Submit button:

`Simpan pesanan / Save order`

### Data-minimization requirements

- Do not ask for identity documents.
- Do not ask for banking information.
- Do not ask for a payment screenshot.
- Do not require email unless an actual operational need is approved.
- Do not ask the customer to re-enter information already passed from the website.
- Explain why recipient contact details are required.

---

## 7. Tally hidden fields

Configure hidden fields with stable, lowercase names. At minimum:

| Field | Example | Notes |
| --- | --- | --- |
| `order_reference` | `KMR-260909-X7P4` | Generate before opening the form |
| `submitted_language` | `id` | Current website language |
| `order_mode` | `custom` | `stem`, `package`, or `custom` |
| `order_summary` | `2x Sunflower; 2x Rose; 1x Tulip` | Human-readable plain text |
| `item_data` | Compact serialized item list | Do not include secrets or personal data |
| `total_stems` | `5` | Numeric string |
| `wrap` | `sage` | Stable option ID, not only display label |
| `gift_message` | Customer text | Encode safely; render as text |
| `product_subtotal` | `295000` | Integer IDR, no separators |
| `discount_amount` | `0` | Integer IDR |
| `estimated_product_total` | `295000` | Excludes unconfirmed shipping |
| `currency` | `IDR` | Fixed value |
| `source` | `website` | Attribution |

### Hidden-field integrity warning

URL and hidden-field values can be changed by a customer. Treat them as an order request, not as trusted payment truth. Before issuing the Midtrans link, Komorebi must compare the saved order with the current product configuration and confirm the final total.

### URL construction requirements

- Use `URL` and `URLSearchParams`; do not concatenate raw query strings.
- Never place the buyer address, buyer phone number, recipient phone number, or other personal information in the form URL.
- Do not put secrets in query parameters.
- Keep serialized data within practical URL-length limits.
- If item data becomes too long, send only the human-readable summary and normalized compact item representation required for operations.

---

## 8. Order-reference requirements

Generate a non-sensitive reference before opening Tally.

Recommended format:

```text
KMR-YYMMDD-RRRR
```

Where `RRRR` is a short random uppercase alphanumeric suffix. Example:

```text
KMR-260909-X7P4
```

Requirements:

- Do not use a simple spreadsheet row number as the customer-facing identifier.
- Do not encode customer information in the identifier.
- Preserve the same reference in the website, Tally submission, Google Sheets row, WhatsApp message, and Midtrans Payment Link order details.
- Generating a reference does not mean the order was successfully submitted.
- If the customer goes back and changes the product before submission, keep the reference only while the same checkout attempt remains active.

---

## 9. Google Sheets order tracker

Create one primary worksheet named `Orders`.

### Recommended columns

| Column | Source | Required behavior |
| --- | --- | --- |
| Order Reference | Tally hidden field | Unique visible reference |
| Submitted At | Tally | Automatic timestamp |
| Buyer Name | Tally | Customer input |
| Buyer WhatsApp | Tally | Customer input |
| Buyer Email | Tally | Optional |
| Order For | Tally | Self or gift |
| Recipient Name | Tally | Conditional |
| Recipient WhatsApp | Tally | Conditional |
| Recipient Contact Permission | Tally | Conditional |
| Address | Tally | Personal information; restrict sheet access |
| City/Regency | Tally | Shipping use |
| Postal Code | Tally | Shipping use |
| Location Directions | Tally | Optional |
| Preferred Date | Tally | Not a guarantee |
| Preferred Window | Tally | Optional |
| Order Mode | Website hidden field | Stem/package/custom |
| Order Summary | Website hidden field | Plain text |
| Item Data | Website hidden field | Compact normalized representation |
| Total Stems | Website hidden field | Numeric |
| Wrap | Website hidden field | Stable value |
| Gift Message | Website hidden field | Plain text |
| Card Sender Name | Tally | Optional |
| Anonymous Gift | Tally | Yes/No |
| Additional Notes | Tally | Optional |
| Product Subtotal | Website hidden field | Integer IDR |
| Discount | Website hidden field | Integer IDR |
| Estimated Product Total | Website hidden field | Excludes shipping |
| Shipping Fee | Staff | Integer IDR |
| Final Total | Formula | Product total plus shipping fee |
| Midtrans Payment Link | Staff | Unique link per confirmed order |
| Payment Status | Staff | Controlled dropdown |
| Work Phase | Staff | Controlled dropdown |
| Delivery Service | Staff | GoSend or nationwide courier |
| Tracking Link/Number | Staff | Added on dispatch |
| Internal Notes | Staff | Never shown to customer |

### Payment-status dropdown

Use exactly:

- `Awaiting confirmation`
- `Awaiting payment`
- `Paid`
- `Expired`
- `Refunded`
- `Cancelled`

Default new submissions to `Awaiting confirmation`.

### Work-phase dropdown

Use exactly:

- `Not started`
- `Materials prepared`
- `Flowers being made`
- `Bouquet assembly`
- `Quality check`
- `Packed`
- `Ready for dispatch`
- `Shipped`
- `Delivered`
- `Cancelled`

Default new submissions to `Not started`.

### Sheet behavior

- Freeze the header row.
- Enable filters.
- Protect formula columns such as `Final Total`.
- Format monetary columns as Indonesian rupiah without changing their numeric nature.
- Restrict access because the sheet contains personal contact and address data.
- Use conditional formatting for payment and work states.
- Do not treat colour alone as the only indicator of status.
- Keep staff-only columns separate from customer-submitted columns.

Suggested conditional formatting:

| Condition | Treatment |
| --- | --- |
| Awaiting confirmation/payment | Amber |
| Paid | Blue or green |
| Expired/cancelled | Grey |
| Refund required/refunded | Red or purple |
| Delivered | Green |

---

## 10. WhatsApp handoff

### Timing

The WhatsApp link must appear only after the Tally submission succeeds. Do not open WhatsApp as the form submit action if that could prevent Tally from saving the submission.

### Customer message template

Indonesian:

```text
Halo Komorebi! Saya baru mengirim permintaan pesanan {{ORDER_REFERENCE}}.

Nama: {{BUYER_NAME}}
Pesanan: {{SHORT_ORDER_SUMMARY}}
Subtotal produk: {{FORMATTED_PRODUCT_TOTAL}}
Tanggal yang diinginkan: {{PREFERRED_DATE}}

Mohon konfirmasi ketersediaan, tanggal, dan ongkos kirimnya. Terima kasih!
```

English:

```text
Hello Komorebi! I have just submitted order request {{ORDER_REFERENCE}}.

Name: {{BUYER_NAME}}
Order: {{SHORT_ORDER_SUMMARY}}
Product subtotal: {{FORMATTED_PRODUCT_TOTAL}}
Preferred date: {{PREFERRED_DATE}}

Please confirm availability, timing, and delivery cost. Thank you!
```

### Privacy requirements

Do not put these values in the WhatsApp URL:

- complete street address;
- email address;
- buyer or recipient phone number;
- private gift-card message;
- internal notes; or
- any payment credential.

The message must describe the submission as an order request, not as a confirmed or paid order.

Use `URL` and `URLSearchParams` or an equivalently safe URL API for encoding. Never build the message using HTML insertion.

### Failure behavior

If WhatsApp cannot open:

- keep the success state visible;
- show the order reference;
- show a `Copy order reference` control;
- show the studio WhatsApp contact as a normal link; and
- explain that the order request was already recorded.

Never resubmit the Tally form merely because WhatsApp failed.

---

## 11. Staff conversation and Midtrans workflow

### First staff response

```text
Halo Kak {{NAME}}, terima kasih! Permintaan pesanan {{ORDER_REFERENCE}} sudah kami terima.

Subtotal produk: {{PRODUCT_TOTAL}}
Ongkos kirim: {{SHIPPING_FEE}}
Total akhir: {{FINAL_TOTAL}}
Estimasi siap/dikirim: {{CONFIRMED_DATE}}

Jika detailnya sudah sesuai, pembayaran dapat dilakukan melalui tautan Midtrans berikut:
{{PAYMENT_LINK}}

Kami mulai mengerjakan pesanan setelah pembayaran terkonfirmasi.
```

### Staff checklist before sending payment link

- Confirm the order reference exists in Google Sheets.
- Confirm product availability and production capacity.
- Confirm the address and eligible delivery method.
- Confirm the shipping fee.
- Recalculate and confirm the product price using the current official prices.
- Record the shipping fee and final total.
- Create one unique Midtrans Payment Link for the final total.
- Include the Komorebi order reference in the Midtrans order description/reference where supported.
- Paste the payment link into the correct sheet row.
- Change payment status to `Awaiting payment`.
- Send the link to the customer.

### After payment

- Verify the payment in the Midtrans dashboard or official payment notification.
- Change payment status to `Paid` only after verification.
- Confirm receipt to the customer.
- Begin production and advance the work phase.

Never mark an order paid based solely on a customer message or screenshot.

---

## 12. Validation and error handling

### Website validation

- Reject checkout when no valid product is selected.
- Reject invalid or negative quantities.
- Enforce the custom-bouquet minimum.
- Preserve legitimate selections when navigating between the review and edit areas.
- Ensure the same amount appears in every website summary.
- Show an actionable error if the hosted form cannot load.

### Tally validation

- Require buyer name and WhatsApp number.
- Validate WhatsApp number format permissively enough for Indonesian `08...` and `+62...` formats.
- Require recipient information only for gift orders.
- Require recipient-contact preference for gift orders.
- Always require the delivery-address fields.
- Require the acknowledgement before submission.
- Avoid blocking legitimate names or address punctuation.

### Duplicate prevention

- Disable the submit action while the form is submitting.
- Show a clear success state after one successful submission.
- Do not automatically retry a submission without customer awareness.
- Treat repeated submissions with the same reference as possible duplicates requiring staff review.

---

## 13. Accessibility requirements

- All controls must have visible labels or reliable accessible names.
- Form errors must be connected to their fields and announced to assistive technology.
- Focus must move predictably when conditional form sections appear.
- Keyboard users must be able to select products, change quantities, review, submit, and reach WhatsApp.
- Do not rely on colour alone for selection, error, payment, or work status.
- Buttons and links must accurately describe their action.
- Disabled controls must communicate why they are unavailable.
- Preserve minimum touch-target sizes on mobile.
- Do not move focus unexpectedly when the order summary updates.

---

## 14. Responsive requirements

Test at minimum:

- 320 px width;
- 390 px width;
- 768 px width;
- 1440 px width.

At mobile widths:

- the sticky order summary must not cover form or footer content;
- long product and recipient names must wrap without clipping;
- price and CTA must remain readable;
- opening the form must not discard the current selection;
- WhatsApp handoff must work with the mobile app or browser fallback; and
- the order-review hierarchy must remain clear without a side-by-side layout.

At desktop widths:

- the review and CTA may use two columns if reading order remains correct;
- keyboard focus order must match the visual order; and
- the Tally embed must not create a nested unusable scroll area.

---

## 15. Analytics events

Only add analytics if the project already has an approved analytics mechanism. Never transmit personal data, addresses, gift messages, phone numbers, or full order contents to analytics.

Suggested anonymous events:

- `checkout_started`
- `order_review_viewed`
- `order_form_opened`
- `order_form_submitted`
- `whatsapp_handoff_clicked`
- `whatsapp_handoff_failed`

Allowed properties include order mode, language, and total-stem bucket. Do not include the customer-facing order reference if it could later be linked to personal data.

---

## 16. Implementation phases

### Phase 0 — Repository discovery and baseline

- Identify the production HTML, CSS, JavaScript controller/store, product configuration, translations, and tests.
- Document the existing order modes and state transitions.
- Run all existing safe tests before editing.
- Record the baseline result.
- Do not modify pricing or business placeholders unless explicitly instructed.

Acceptance criteria:

- [ ] Existing architecture and test command are identified.
- [ ] Baseline test result is recorded.
- [ ] The agent identifies one authoritative price/calculation source.
- [ ] No implementation begins with unresolved duplicate order-state ownership.

### Phase 1 — Normalize checkout state and review

- Reuse or normalize the existing state model.
- Ensure individual, package, and custom choices are mutually coherent.
- Build one order-summary formatter reused by all outputs.
- Add or refine the review area and CTAs.
- Add bilingual copy.

Acceptance criteria:

- [ ] All three order modes produce correct reviews.
- [ ] Custom quantities and discounts match the existing pricing rules.
- [ ] No selection produces conflicting summaries.
- [ ] Editing returns the customer to the relevant controls without losing valid data.
- [ ] Gift messages render literally as text.

### Phase 2 — Tally configuration

- Create the form sections and conditional rules described above.
- Configure hidden fields exactly and document their names.
- Connect Tally submissions to the intended Google Sheet.
- Configure the success state without falsely confirming payment.
- Use placeholder configuration values in repository documentation rather than committing private form-management credentials.

Acceptance criteria:

- [ ] Customers do not reselect products in Tally.
- [ ] Self orders skip recipient questions.
- [ ] Gift orders require recipient/contact-preference data.
- [ ] Delivery orders require address data.
- [ ] One test submission appears as one spreadsheet row.
- [ ] Submitted hidden fields match the visible website review.

### Phase 3 — Website-to-form handoff

- Generate the order reference.
- Build the hosted-form URL with safe URL APIs.
- Pass only approved hidden fields.
- Preserve the checkout attempt when the customer edits the order.
- Provide a failure state if the form is unavailable.

Acceptance criteria:

- [ ] Special characters, emoji, ampersands, line breaks, and Indonesian text do not corrupt the URL.
- [ ] No personal or secret data appears in the form URL.
- [ ] Invalid orders cannot open the form.
- [ ] The form displays the same order reference and summary as the website.

### Phase 4 — WhatsApp handoff

- Configure the post-submission success action/page.
- Generate the bilingual prefilled message.
- Keep private data out of the WhatsApp URL.
- Implement the copy-reference fallback.

Acceptance criteria:

- [ ] The spreadsheet record exists before WhatsApp is offered.
- [ ] The WhatsApp message contains the correct reference, short summary, product subtotal, and preferred date.
- [ ] The message does not claim the order is confirmed or paid.
- [ ] Address and gift-card contents are absent from the WhatsApp URL.
- [ ] Failure to open WhatsApp does not create a duplicate order.

### Phase 5 — Google Sheets operations setup

- Create the `Orders` columns and controlled statuses.
- Configure formulas, formatting, filters, and access.
- Test the staff workflow with at least one individual stem, one package, and one custom bouquet.

Acceptance criteria:

- [ ] New orders default to `Awaiting confirmation` and `Not started`.
- [ ] Final total is calculated from numeric product total and shipping fee.
- [ ] Staff can filter unpaid, paid, in-production, ready, and delivered orders.
- [ ] Formula cells are protected from accidental editing.
- [ ] Sheet access is limited to approved operators.

### Phase 6 — Verification and handoff

- Run the complete automated test suite.
- Test the rendered flow at representative widths.
- Submit sandbox/test orders without real payment.
- Confirm no production credentials are committed.
- Document Tally form URL configuration and the manual Midtrans procedure.

Acceptance criteria:

- [ ] Existing tests remain passing.
- [ ] New production-code tests pass.
- [ ] No console errors are caused by the checkout flow.
- [ ] No secret exists in HTML, CSS, frontend JavaScript, repository history created by this work, or public configuration.
- [ ] The final report distinguishes automated checks from manual verification.

---

## 17. Required automated tests

Extend the existing integration test approach and execute actual production JavaScript rather than copying calculation logic into tests.

At minimum test:

1. Individual-stem order summary.
2. Fixed-package order summary.
3. Valid custom-bouquet summary.
4. Invalid custom bouquet cannot continue.
5. Correct discount and product-total output.
6. Switching modes clears incompatible state.
7. Gift message is handled as literal text.
8. Indonesian and English review copy.
9. Order-reference format.
10. Tally parameters use safe URL encoding.
11. Approved hidden fields are present.
12. Prohibited personal/secret fields are absent from the URL.
13. WhatsApp message uses the same normalized summary and total.
14. WhatsApp URL excludes address and private gift message.
15. Checkout state remains valid after returning to edit.
16. Empty or invalid selection does not open checkout.

Do not weaken, delete, or rewrite unrelated assertions merely to make the suite pass.

---

## 18. Manual verification checklist

### Customer journeys

- [ ] Buy one individual flower.
- [ ] Buy multiple quantities of one individual flower.
- [ ] Buy each fixed bouquet tier.
- [ ] Build the minimum custom bouquet.
- [ ] Build a discounted custom bouquet.
- [ ] Edit a reviewed order and continue again.
- [ ] Submit a self-delivery order.
- [ ] Submit a gift order with permission to contact the recipient.
- [ ] Submit a surprise gift order.
- [ ] Use a gift message containing emoji, quotation marks, ampersand, and line breaks.
- [ ] Complete the flow in Indonesian.
- [ ] Complete the flow in English.

### Failure paths

- [ ] Tally fails to load.
- [ ] Customer presses submit twice.
- [ ] Customer returns from the hosted form.
- [ ] WhatsApp is unavailable.
- [ ] Customer edits query parameters.
- [ ] A duplicate order reference reaches the sheet.
- [ ] Midtrans payment expires.
- [ ] Customer claims payment but Midtrans does not show success.

### Operations

- [ ] Sheet row contains all required operational data.
- [ ] Shipping fee produces the correct final total.
- [ ] Payment and work statuses can be filtered.
- [ ] Midtrans link is associated with the correct reference and amount.
- [ ] Only authorized people can access customer addresses and phone numbers.

---

## 19. Later phase: optional payment automation

This is not part of version 1.

When manual Midtrans handling becomes a measurable operational burden, a later project may use an automation provider or secure serverless backend to:

1. receive a new validated order;
2. create a unique Midtrans Payment Link;
3. store the link against the matching order reference;
4. receive Midtrans status-change webhooks;
5. verify the authoritative transaction status with Midtrans;
6. update the sheet without allowing status regression from delayed webhooks; and
7. notify staff of exceptions.

Security requirements for that later phase:

- Store the Midtrans server key only in a protected secret store.
- Never send the server key to the browser.
- Authenticate and validate webhook events.
- Verify payment amount and order reference.
- Make webhook handling idempotent.
- Ignore invalid backward status transitions.
- Log failures without logging secrets or unnecessary personal data.

Do not combine this later phase with the lightweight launch implementation.

---

## 20. Implementation-agent kickoff prompt

Copy the prompt below when handing this plan to an implementation agent:

```text
Implement the lightweight Komorebi checkout and order-capture system described in `komorebi-checkout-implementation-plan.md`.

Begin by inspecting the full repository and running the existing test suite. Treat the document as a behavioral specification, but adapt file-level changes to the repository's actual architecture. Preserve the current vintage botanical design, bilingual behavior, prices, product configuration, placeholders, accessibility fixes, and existing order logic unless the specification explicitly requires a change.

Implement version 1 only: website order review, safe Tally handoff, Google Sheets-ready field mapping, and post-submission WhatsApp confirmation. Shipping confirmation, Midtrans Payment Link creation, payment verification, and production-status changes remain manual. Do not add a custom backend, database, account system, Midtrans API integration, payment webhook, WhatsApp Business API, GoSend API, framework, or large dependency.

Never place secrets or Midtrans credentials in frontend code. Never treat browser-provided hidden fields as authoritative proof of price or payment. Reuse one normalized order state and one calculation/summary path across the UI, Tally payload, and WhatsApp message.

Make the smallest coherent edits. Add tests that execute actual production code. Do not weaken unrelated tests. After implementation, report:

1. files changed;
2. behavior implemented;
3. exact test commands and results;
4. manual checks performed;
5. required owner configuration in Tally and Google Sheets;
6. any unverified behavior or remaining limitation; and
7. confirmation that no production credential was added to the repository.
```

---

## 21. Business-owner configuration checklist

The implementation cannot be fully activated until the owner supplies or configures:

- [ ] Final Tally form URL.
- [ ] Final Tally hidden-field names.
- [ ] Google account and destination spreadsheet.
- [ ] People allowed to access customer records.
- [ ] Official Komorebi WhatsApp destination number.
- [ ] Production lead-time rule.
- [ ] Supported delivery regions and manual shipping procedure.
- [ ] Midtrans merchant account.
- [ ] Manual Midtrans Payment Link procedure.
- [ ] Final privacy notice and data-retention policy.

Until these values are supplied, use explicit configuration placeholders and fail safely. Do not silently substitute guessed business details.
