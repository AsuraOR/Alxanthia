# Native checkout launch setup

For a non-technical, click-by-click walkthrough with copy-and-paste code, start with [`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md).

The buyer, location/delivery, message-card, and consent form now runs directly on the Alxanthia website. Product details come from the existing cart and customers never re-enter them. The form is intentionally short — customers mostly pick options rather than type — and the browser must still send the completed order to a server before WhatsApp is offered; frontend code alone cannot safely write to a private spreadsheet.

## Submission endpoint

Deploy a small HTTPS endpoint and set its public URL as `store.orderSubmissionUrl` in `site-content.js`. Keep Google and payment credentials on the server—never in this repository. The endpoint must:

1. accept `POST` with `Content-Type: application/json`;
2. allow the production website origin with CORS (not `*` in production);
3. validate required customer fields, quantities, allowed wrapping IDs, and the acknowledgement;
4. recalculate current product prices rather than trusting browser totals;
5. store exactly one row in the restricted `Orders` sheet;
6. make repeated `order_reference` values idempotent or flag them for review; and
7. return HTTP 2xx JSON `{ "ok": true, "order_reference": "ALX-..." }` only after storage succeeds.

The website deliberately keeps the form visible and does not offer WhatsApp when the endpoint is missing, rejects the request, returns invalid JSON, or cannot be reached.

## Submitted fields

Operational fields (computed by the site, never typed by the customer) are `order_reference`, `submitted_language`, `order_mode`, `order_summary`, `item_data`, `total_stems`, `wrap`, `message_card_enabled`, `message_card_fee`, `gift_message`, `recipient_name`, `card_sender_name`, `product_subtotal`, `estimated_product_total`, `currency`, and `source`.

`recipient_name` and `card_sender_name` come from the "Detail penerima (opsional)" fields in the order/finishing section on the main page — not from the checkout form — so they exist even when the buyer never opens the checkout modal's location step. `gift_message` is only populated when the message-card checkbox was checked; otherwise it is an empty string, and `message_card_fee` is `0`.

Customer fields (typed/selected in the checkout form) are `buyer_name`, `buyer_whatsapp`, `location_type` (`bali` or `luar_bali`), conditional `regency` and `delivery_method` (`grab_gojek` or `self_pickup`, only meaningful when `location_type` is `bali`), conditional `address`, `city`, and `postal_code` (only meaningful when `location_type` is `luar_bali`), `preferred_date`, and `acknowledgement`.

Because the form is a single HTML `<form>`, fields belonging to the branch the customer did **not** choose are still submitted (empty, or left at their default option) — never trust `regency`/`delivery_method`/`address`/`city`/`postal_code` in isolation; always read them alongside `location_type` first.

## Google Sheets

Name the primary worksheet `Orders`. Use the column list in [`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md). Freeze the header, enable filters, protect `Final Total`, and keep monetary cells numeric with IDR formatting. `Final Total` is `Estimated Product Total + Shipping Fee`. Restrict access because the sheet contains personal data.

- Payment Status: `Awaiting confirmation`, `Awaiting payment`, `Paid`, `Expired`, `Refunded`, `Cancelled` (default `Awaiting confirmation`).
- Work Phase: `Not started`, `Materials prepared`, `Flowers being made`, `Bouquet assembly`, `Quality check`, `Packed`, `Ready for dispatch`, `Shipped`, `Delivered`, `Cancelled` (default `Not started`).

## Manual payment workflow

Before creating a Midtrans Payment Link, verify the row, current prices, capacity, delivery details (kabupaten/kota + delivery method for Bali orders, or the written address for out-of-Bali orders), delivery service, shipping fee, and final total. Put the Alxanthia reference in the Midtrans description, save the unique link to the same row, and change Payment Status to `Awaiting payment`. Set `Paid` only after checking the Midtrans dashboard or official notification—never from a message or screenshot.

## Launch test

Submit a stem, every package size, and a minimum custom bouquet in both languages. Test the Bali path (each delivery method) and the out-of-Bali path. Test with and without the message-card checkbox, and with and without an optional recipient/sender name. Confirm every successful response corresponds to exactly one stored row before WhatsApp appears. Test emoji, quotation marks, ampersands, and line breaks; a preferred date in the past (must be rejected client-side); endpoint downtime; double clicks; duplicate references; denied clipboard access; and 320, 390, 768, and 1440 px layouts.
