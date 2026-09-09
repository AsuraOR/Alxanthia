# Checkout launch setup

The website code contains no Tally, Google, Midtrans, or payment credentials. Before launch, publish a Tally form and replace `https://tally.so/r/FORM_ID` in `site-content.js` with its public form URL.

## Tally form

Build the sections and validation described in `revisions/komorebi-checkout-implementation-plan.md`: review confirmation; required buyer name and WhatsApp; optional email; self/gift branching and recipient contact permission; required delivery address, city/regency, postal code, and preferred date; optional directions/window/card sender/anonymous gift/notes; and the required acknowledgement. Email must remain optional. Explain that recipient details are used for delivery coordination.

Create these hidden fields exactly:

`order_reference`, `submitted_language`, `order_mode`, `order_summary`, `item_data`, `total_stems`, `wrap`, `gift_message`, `product_subtotal`, `discount_amount`, `estimated_product_total`, `currency`, `source`.

Embed permissions must allow the production website. Keep Tally's standard `Tally.FormSubmitted` parent-window event enabled; the website does not offer WhatsApp until that event arrives. Test the event from the real published domain because the listener deliberately accepts only the `https://tally.so` origin.

## Google Sheets

Connect Tally to a restricted spreadsheet and name the main worksheet `Orders`. Use the columns in section 9 of the implementation plan. Freeze the header, enable filters, protect `Final Total`, and keep monetary cells numeric with IDR formatting. `Final Total` is `Estimated Product Total + Shipping Fee`.

Use these exact dropdowns:

- Payment Status: `Awaiting confirmation`, `Awaiting payment`, `Paid`, `Expired`, `Refunded`, `Cancelled` (default `Awaiting confirmation`).
- Work Phase: `Not started`, `Materials prepared`, `Flowers being made`, `Bouquet assembly`, `Quality check`, `Packed`, `Ready for dispatch`, `Shipped`, `Delivered`, `Cancelled` (default `Not started`).

Treat every browser-provided hidden value as an order request, not trusted payment data. Restrict access because the sheet contains personal data, and flag repeated order references for manual duplicate review.

## Manual payment workflow

Before creating a Midtrans Payment Link, verify the sheet row, current prices, capacity, address, delivery service, shipping fee, and final total. Put the Komorebi reference in the Midtrans order description. Save the unique link to the same row and change Payment Status to `Awaiting payment`. Set `Paid` only after checking the Midtrans dashboard or official notification—never from a message or screenshot. No Midtrans secret belongs in this repository.

## Launch test

Submit one stem, one package, and one custom bouquet in both languages. Confirm each submission creates exactly one row before the WhatsApp action appears, hidden fields match the visible review, gift-message special characters remain intact, and the WhatsApp URL excludes address, contact details, email, and gift text. Also test the unconfigured-form message, iframe failure, duplicate reference handling, and WhatsApp copy-reference fallback.
