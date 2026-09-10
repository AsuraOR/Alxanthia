# Native checkout launch setup

For a non-technical, click-by-click walkthrough with copy-and-paste code, start with [`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md).

The buyer, location/delivery, message-card, privacy consent, and acknowledgement form now runs directly on the Alxanthia website. Product details come from the existing cart and customers never re-enter them. The form is intentionally short — customers mostly pick options rather than type — and the browser must still send the completed order to a server before WhatsApp is offered; frontend code alone cannot safely write to a private spreadsheet or safely calculate a trustworthy price.

## Submission endpoint

Deploy the Cloudflare Worker + Google Apps Script pair described in [`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md) and set its public Worker URL as `store.orderSubmissionUrl` in `site-content.js`. Keep Google, Turnstile, and payment credentials on the server—never in this repository. The endpoint must:

1. accept `POST` with `Content-Type: application/json`;
2. allow the production website origin with CORS (not `*` in production);
3. verify a Cloudflare Turnstile token once configured (OWNER-05), and apply a request-rate limit (OWNER-06);
4. validate the complete payload — required customer fields, allowed product/addition/wrap IDs, integer quantities within sane limits, the preferred date against the configured production lead time, and the exact acknowledgement value — never just a minimal subset;
5. **recalculate every price itself** from a server-owned catalogue (`item_data`), never trusting the browser's totals — the browser's numbers are stored alongside the verified ones for comparison, but only the verified total is authoritative;
6. store exactly one row in the restricted `Orders` sheet, resolved by column header (not letter), with no formula pre-copied below real rows;
7. deduplicate on a real per-attempt idempotency key (a UUID, not the short human-readable reference) with a payload hash: an identical retry returns the original success, a key reused with different data is rejected as a conflict; and
8. return HTTP 2xx JSON `{ "ok": true, "order_reference": "ALX-..." }` only after storage succeeds, and `result.order_reference` must exactly equal the reference the browser is holding — an `{ "ok": true }` with no reference, or a mismatched one, is treated as a failure by the front end.

The website deliberately keeps the form visible and does not offer WhatsApp when the endpoint is missing, rejects the request, times out, returns invalid JSON, or cannot be reached. A 20-second timeout, and separate messaging for a definite connection failure vs. an ambiguous one (timeout or 5xx after the request was sent), are both built into the checkout form's JavaScript.

## Submitted fields

Operational fields (computed by the site, never typed by the customer) are `order_reference`, `idempotency_key`, `catalog_version`, `submitted_language`, `order_mode`, `order_summary`, `item_data`, `total_stems`, `wrap`, `message_card_enabled`, `message_card_fee`, `gift_message`, `recipient_name`, `card_sender_name`, `product_subtotal`, `estimated_product_total`, `currency`, `source`, and (once Turnstile is configured) `cf_turnstile_token`.

`order_mode` is one of `stem`, `pot`, `package`, `custom`, or `mixed` (when the cart combines more than one of the first four). It is a convenience label only — the server always treats `item_data`, not this field, as the authoritative product list when recalculating prices.

`recipient_name` and `card_sender_name` come from the "Detail penerima (opsional)" fields in the order/finishing section on the main page — not from the checkout form — so they exist even when the buyer never opens the checkout modal's location step. `gift_message` is only populated when the message-card checkbox was checked; otherwise it is an empty string, and `message_card_fee` is `0`.

Customer fields (typed/selected in the checkout form) are `buyer_name`, `buyer_whatsapp`, `location_type` (`bali` or `luar_bali`), conditional `regency` and `delivery_method` (`grab_gojek` or `self_pickup`, only meaningful when `location_type` is `bali`), conditional `address`, `city`, and `postal_code` (only meaningful when `location_type` is `luar_bali`), `preferred_date`, and `acknowledgement` (a real Boolean by the time it reaches the endpoint, not the checkbox's raw `"on"` string).

The checkout form now disables and clears whichever location branch (Bali vs. out-of-Bali) is not selected, so a disabled branch's fields are simply absent from the submitted payload rather than present-but-empty. Client-side disabling is a convenience only — the endpoint must still validate `location_type` and ignore or reject anything submitted for the inactive branch, since a browser is never a trusted source of truth.

## Google Sheets

Name the primary worksheet `Orders`. Use the full column list in [`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md) — every column is resolved by its header text, not a fixed letter, so inserting a column later never silently corrupts the mapping. Freeze the header, enable filters, protect the `Verified Product Subtotal`, `Verified Message Card Fee`, `Verified Total`, and `Final Total` columns, and keep monetary cells numeric with IDR formatting. `Final Total` is a live formula (`Verified Total + Shipping Fee`) written by the script once both exist — never copy a formula down the sheet yourself. Restrict access because the sheet contains personal data, and confirm it is not shared as "Anyone with the link".

- Payment Status: `Awaiting confirmation`, `Awaiting payment`, `Paid`, `Expired`, `Refunded`, `Cancelled` (default `Awaiting confirmation`).
- Work Phase: `Not started`, `Materials prepared`, `Flowers being made`, `Bouquet assembly`, `Quality check`, `Packed`, `Ready for dispatch`, `Shipped`, `Delivered`, `Cancelled` (default `Not started`).
- Price Mismatch: normally blank; the script writes `REVIEW` here when the submitted and verified totals disagree — treat these rows as needing a manual price check before invoicing.

## Manual payment workflow

Before creating a Midtrans Payment Link, verify the row, current prices, capacity, delivery details (kabupaten/kota + delivery method for Bali orders, or the written address for out-of-Bali orders), delivery service, shipping fee, and **Verified Total** (never the Submitted Total, which reflects only what the customer's browser calculated). Put the Alxanthia reference in the Midtrans description, save the unique link to the same row, and change Payment Status to `Awaiting payment`. Set `Paid` only after checking the Midtrans dashboard or official notification—never from a message or screenshot.

## Privacy

The checkout form shows a short privacy notice next to the acknowledgement checkbox explaining what buyer/recipient data is collected, why, where it is stored, who can access it, and how long it is kept — the retention period is an owner-editable string in `site-content.js` (`dataRetentionNotice`). Checking the acknowledgement box records the customer's consent to that processing; the box will not submit without also stating that production starts after payment confirmation.

## Launch test

Submit a stem, a mini pot on its own, every package size, a minimum custom bouquet, and a mixed cart (at least two different product types in one order) — in both languages. Test the Bali path (each delivery method) and the out-of-Bali path. Test with and without the message-card checkbox, and with and without an optional recipient/sender name. Confirm every successful response corresponds to exactly one stored row, with a **Verified Total** matching what the page showed, before WhatsApp appears. Test emoji, quotation marks, ampersands, and line breaks; a preferred date before the configured minimum lead time (must be rejected both client- and server-side); a manipulated total, item ID, or quantity sent directly to the endpoint (must be repriced from the server's own catalogue, not the tampered value); endpoint downtime and a slow/timed-out request (both must show a distinct message from a definite failure); double clicks and retries after an ambiguous failure (must produce exactly one stored row, reusing the same idempotency key); closing or pressing Escape while a submission is in flight (must be blocked until it resolves); denied clipboard access (must show a selectable fallback with the reference); reopening the site after a successful order (must show a quiet recovery link, never silently re-open a blank form); and 320, 390, 768, and 1440 px layouts.

`node tests/verify-ordering.js` and `node tests/verify-server-pricing.js` cover the pure client and server-side pricing/validation logic without touching any live endpoint; `node tests/run-browser-runner.js` drives the real checkout dialog in a headless browser with the submission endpoint mocked at the network layer. No automated test in this repository ever writes a row to the production Sheet — only the manual checklist above does, and only with test data.
