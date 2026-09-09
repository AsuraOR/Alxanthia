# Native checkout launch setup

The buyer, recipient, delivery, gift, notes, and consent form now runs directly on the Komorebi website. Product details come from the existing cart and customers never re-enter them. The browser must still send the completed order to a server before WhatsApp is offered; frontend code alone cannot safely write to a private spreadsheet.

## Submission endpoint

Deploy a small HTTPS endpoint and set its public URL as `store.orderSubmissionUrl` in `site-content.js`. Keep Google and payment credentials on the server—never in this repository. The endpoint must:

1. accept `POST` with `Content-Type: application/json`;
2. allow the production website origin with CORS (not `*` in production);
3. validate required customer fields, quantities, allowed wrapping IDs, and the acknowledgement;
4. recalculate current product prices rather than trusting browser totals;
5. store exactly one row in the restricted `Orders` sheet;
6. make repeated `order_reference` values idempotent or flag them for review; and
7. return HTTP 2xx JSON `{ "ok": true, "order_reference": "KMR-..." }` only after storage succeeds.

The website deliberately keeps the form visible and does not offer WhatsApp when the endpoint is missing, rejects the request, returns invalid JSON, or cannot be reached.

## Submitted fields

Operational fields are `order_reference`, `submitted_language`, `order_mode`, `order_summary`, `item_data`, `total_stems`, `wrap`, `gift_message`, `product_subtotal`, `discount_amount`, `estimated_product_total`, `currency`, and `source`.

Customer fields are `buyer_name`, `buyer_whatsapp`, optional `buyer_email`, `order_for`, conditional `recipient_name`, `recipient_whatsapp`, and `recipient_contact_permission`, `address`, `city`, `postal_code`, optional `location_directions`, `preferred_date`, optional `preferred_window`, optional `card_sender_name`, `anonymous_gift`, optional `additional_notes`, and `acknowledgement`.

## Google Sheets

Name the primary worksheet `Orders`. Use the columns in section 9 of `revisions/komorebi-checkout-implementation-plan.md`. Freeze the header, enable filters, protect `Final Total`, and keep monetary cells numeric with IDR formatting. `Final Total` is `Estimated Product Total + Shipping Fee`. Restrict access because the sheet contains personal data.

- Payment Status: `Awaiting confirmation`, `Awaiting payment`, `Paid`, `Expired`, `Refunded`, `Cancelled` (default `Awaiting confirmation`).
- Work Phase: `Not started`, `Materials prepared`, `Flowers being made`, `Bouquet assembly`, `Quality check`, `Packed`, `Ready for dispatch`, `Shipped`, `Delivered`, `Cancelled` (default `Not started`).

## Manual payment workflow

Before creating a Midtrans Payment Link, verify the row, current prices, capacity, address, delivery service, shipping fee, and final total. Put the Komorebi reference in the Midtrans description, save the unique link to the same row, and change Payment Status to `Awaiting payment`. Set `Paid` only after checking the Midtrans dashboard or official notification—never from a message or screenshot.

## Launch test

Submit a stem, every package size, a minimum custom bouquet, and a discounted custom bouquet in both languages. Test self, gift, and surprise-recipient paths. Confirm every successful response corresponds to exactly one stored row before WhatsApp appears. Test emoji, quotation marks, ampersands, and line breaks; endpoint downtime; double clicks; duplicate references; denied clipboard access; and 320, 390, 768, and 1440 px layouts.
