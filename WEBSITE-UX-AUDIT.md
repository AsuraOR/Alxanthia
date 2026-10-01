# Alxanthia storefront — UI/UX audit

**Status:** open. Findings only — no code was changed.
**Audited commit:** `a65f53b` (main, 1 Oct 2026).
**Scope:** the customer-facing site (`index.html`, `styles.css`, `app.js`, `site-content.js`).
Studio Desk is out of scope (see [`STUDIO-DESK-UX-REVIEW.md`](STUDIO-DESK-UX-REVIEW.md)).
Checkout reliability, security and metadata are covered by [`AUDIT.md`](AUDIT.md) and are
not repeated here. Where a finding overlaps an `ALX-` task there, it says so.

The question behind this review: **can a first-time visitor on a phone find what they want, put
it in the cart, and send the order without getting lost or second-guessing the price?** Mostly
yes. The brand, photography and type are strong, and the checkout form is well built. Most of the
friction is in the stretch **between "I like this flower" and "Tinjau pesanan"**: the page
moves you without warning, shows the catalogue twice, and repeats prices and controls.

---

## How this was checked

- Served the repo locally and drove it in headless Chromium at **390 × 844** (phone) and
  **1440 × 900** (desktop), in Indonesian and English. The preview curtain was bypassed locally.
- The real brand fonts (Cormorant Garamond, Karla) were loaded so screenshots match production.
  Turnstile and the order endpoint were stubbed, and **no order was submitted.**
- Walked the full flow: browse → filter → add a stem, mini pot or package → custom builder →
  cart → review → form validation → date picker. Measured the page in the DOM: scroll positions,
  focus, accessible names, tap-target sizes, font sizes and clamped text.
- The live domain could not be reached from the audit sandbox, so this reflects the repo, not
  necessarily what is deployed.

Severity: **P1** costs orders or trust · **P2** causes confusion or friction ·
**P3** visual polish and consistency.

---

## Summary

| ID | Sev | Finding |
| --- | --- | --- |
| UX-01 | P1 | First "add" jumps the visitor 3,000–5,000 px down to the order section, and every stem add moves keyboard focus there |
| UX-02 | P1 | The whole catalogue is shown a second time inside the order section |
| UX-03 | P1 | Every order says "Bungkus: Kraft", even with nothing wrapped. Wrapped single stems never get the colour choice |
| UX-04 | P1 | Phone shows two floating cart controls at once, and the pill covers page content |
| UX-05 | P2 | Each stem card shows its price three times; on phones the labels wrap and crowd |
| UX-06 | P2 | Add buttons don't say "add" or name the product (screen readers hear 4× "Tanpa bungkus") |
| UX-07 | P2 | Product descriptions are cut off on phones with no way to read them |
| UX-08 | P2 | Checkout step labels and buttons misdescribe what happens next |
| UX-09 | P2 | Phone cart header is crowded; an empty "Termasuk" heading shows |
| UX-10 | P2 | Shopee "Segera hadir" dead end sits at the point of decision |
| UX-11 | P2 | Privacy wall-of-text between the last field and the consent box |
| UX-12 | P2 | Location and language are inconsistent (Bali / Indonesia / Jimbaran; English labels in ID mode) |
| UX-13 | P2 | FAQ misses the questions buyers ask before paying; some content is repeated |
| UX-14 | P3 | Grid, container and card styles differ between sections |
| UX-15 | P3 | Several labels are 11–12 px |
| UX-16 | P3 | Navigation naming: "Cara memesan" is the catalogue; "Pesan" ignores the cart |

**Quick wins** (each about an hour or less): UX-03 (hide the wrap line), UX-04 (one cart control
on phones), UX-05 (remove the note box), UX-06 (labels), UX-09 (hide the empty heading),
UX-10 (hide Shopee), UX-12 (copy).

---

## P1 — fix before opening to the public

### UX-01 — Adding to cart teleports the visitor away from the catalogue

**What happens.** On the first add, `selectStemOrder`, `selectMiniPot` and the package and
custom handlers call `scrollToSection('#order', …)` when `wasCartEmpty` is true.

| Viewport | Scroll before tap | Scroll after tap |
| --- | --- | --- |
| Desktop 1440 | 1,791 px (stem card) | 4,825 px (order section) |
| Phone 390 | ~1,800 px (stem card) | 6,938 px (order section) |

The visitor tapped the first sunflower and lands on a cart, past the mini pots, bouquets and
custom builder they haven't seen yet. To add a second item they have to find their way back.

Separately, **every** stem add (not only the first) runs
`finishLabel.focus({ preventScroll: true })`. The view stays put, but keyboard and screen-reader
focus jumps to "Sentuhan akhir" in the order section. The next Tab press continues from there,
not from the card the visitor was on.

**Fix.** Keep the visitor where they are. Confirm the add in place: briefly change the button to
"✓ Ditambahkan", pulse the cart count, and announce through the existing `#order-announcer`. Let
the cart control (UX-04) carry them to checkout when *they* choose. Don't move focus on add.

### UX-02 — The catalogue appears twice

With an empty cart, `#order` renders `#order-picker`: all 15 SKUs again as small tiles (8 stem
variants, 3 mini pots, 4 packages). The sunflower photo appears twice side by side, differing only
by "— Tanpa bungkus" / "— Dengan bungkus". This is a big part of why the phone page is
**15,600 px tall**, and it gives visitors two places to shop with two different card designs.

The empty-state copy also says products are "di bawah" (below). On desktop the picker is to the
**left**.

**Fix.** With an empty cart, replace the picker with a short empty state: one line and three
shortcuts (Bunga jadi · Mini pot · Buket) that scroll back to the catalogue. The catalogue above
stays the only place to shop.

### UX-03 — Wrap colour is recorded even when nothing is wrapped, and unchosen when something is

- `selectedWrap` defaults to `'kraft'` and is always shown in review
  (`#checkout-finish` → "Bungkus: Kraft.") and always sent (`wrapId: selectedWrap`).
  A **mini-pot-only** cart and a **"Tanpa bungkus"** stem order both say "Bungkus: Kraft". The
  customer reads it as a choice they didn't make, and the studio receives it on an order with
  no wrap.
- The colour chips only show when `cart.some(line => line.type === 'package' || line.type === 'custom')`.
  A customer who picks **"Dengan bungkus"** on a stem pays for wrapping but is never offered the
  colour, and is silently recorded as Kraft.
- Where the chips do show, they sit below the cart, far from the product, and one colour applies
  to every wrapped item in the order.

**Fix.** Derive "uses wrap" from the cart, including wrapped stems. Show the chips, the review line
and `wrapId` only when it's true (send `null` otherwise). Later, consider choosing the colour on
the card or in the builder.

### UX-04 — Two floating cart controls on phones

After one add on a phone, both of these are visible:

- the round **"1 di keranjang"** pill (`#floating-cart-pill`), bottom-right, and
- the **sticky order bar** (`#sticky-order-bar`) with item, price and "Pesan →".

The pill floats just above the bar and covers live content: product card text, and the Shopee
note inside the order panel. On desktop the pill sits under the header at top-right, over the
last product card's photo badge.

**Fix.** On phones, keep only the sticky bar and give it the count ("2 item · Rp 115.000 ·
Lihat keranjang"). Keep the pill for desktop, and move it so it doesn't cover cards.

---

## P2 — reduce confusion

### UX-05 — Stem cards repeat the price three times

Each stem card shows "Rp 55.000 per tangkai", then a grey bordered box "ⓘ Harga per 1 tangkai
jadi" (it looks like an alert), then the price again inside **both** buttons. At 390 px in a
2-column grid, the price line wraps to two lines and each button label wraps ("TANPA / BUNGKUS").

**Fix.** Keep the price line. Remove the note box: "per tangkai" already says it, and the photo
badge "Foto: 3 tangkai" covers the multi-stem photo. Make the buttons "+ Tanpa bungkus" and
"+ Dibungkus (+Rp 5.000)". Alternatively, use a single "Tambah" button with a wrap toggle above
it. Consider one column for stem cards below ~400 px.

### UX-06 — Add buttons don't say what they do (overlaps `ALX-16`)

Visible labels: stems "Tanpa bungkus" / "Dengan bungkus" (read like options, not actions), pots
"Tambahkan mini pot", packages "Tambahkan buket ini", custom "Tambahkan buket ini ke keranjang →".

Measured accessible names: **4× "Tanpa bungkus Rp …"**, **3× "Tambahkan mini pot"**,
**4× "Tambahkan buket ini"**. None names the product. The builder's +/− buttons already do it
right ("Tambahkan Mawar").

**Fix.** Use one verb everywhere ("Tambah ke keranjang"). Give each button an `aria-label` with
the product, e.g. "Tambahkan Mawar tanpa bungkus ke keranjang".

### UX-07 — Descriptions are truncated on phones with no way to expand

At 390 px, `.flower-blurb`, `.mini-pot-blurb` and `.bouquet-blurb` use a 3-line clamp. Four were
cut off mid-sentence ("…mahkota berbiji…"). Tapping the photo opens a modal, but:

- for **flowers**, the modal caption is Latin name + size + detail, **not the description**, so
  the cut-off text can't be read anywhere;
- the only hint that photos open is a `title` tooltip, which touch screens never show.

**Fix.** Put the description in the flower modal caption (pots and packages already do this).
Add a small visible zoom icon on photos, or drop the clamp. These are two-sentence blurbs.

### UX-08 — Checkout steps and labels misdescribe what happens

- The cart CTA "Tinjau pesanan / LANJUT →" has a **chat-bubble icon**, which suggests WhatsApp
  opens. It opens a review dialog. "LANJUT →" as a second line repeats the action.
- The disabled CTA "Pilih produk terlebih dahulu" is a **dashed box in serif type**. It reads
  like a text field, not a disabled button.
- The dialog says **"Langkah 2 dari 2"** on the form, and the primary button is **"Simpan
  pesanan"** (save). The order still isn't with the studio until the customer taps "Lanjut ke
  WhatsApp →" on the success screen, a third step nobody announced. Customers who stop at "saved"
  will think they're done.

**Fix.** Use "Langkah 1 dari 3 · Tinjau", "2 dari 3 · Data", "3 dari 3 · Kirim via WhatsApp".
Rename the form button to "Kirim pesanan". Drop the chat icon from the review button. Style the
disabled state as a muted solid button with a helper line below it.

### UX-09 — Phone cart header is crowded, and an empty heading shows

At 390 px the cart panel header puts "PILIHAN ANDA" (wrapping to two lines), "KOSONGKAN
KERANJANG" and "UBAH PILIHAN" in one cramped block. The destructive action is the most prominent
of the three (it does ask for confirmation, which is good). With a stem-only cart, a
**"TERMASUK" heading renders with nothing under it.** With an empty cart, the panel shows two
stray divider lines.

**Fix.** Title alone on line 1. Move "Kosongkan keranjang" to a small text link under the total.
Hide `#summary-includes-list`'s heading when the list is empty. Remove the dividers in the empty
state.

### UX-10 — Shopee "Segera hadir" is a dead end at the moment of decision

Directly under the checkout button sits a "Shopee · SEGERA HADIR" box explaining that Shopee isn't
ready. The footer repeats it. It adds a choice that can't be taken at the point where the visitor
should only see one action.

**Fix.** While `store.shopeeUrl` is empty, render nothing in the order panel. A footer mention is
enough.

### UX-11 — Privacy text interrupts the end of the form

On phones, the privacy notice (`#checkout-privacy-notice`) is about 10 lines of small text,
between the last field and the consent checkbox. The visitor has to scroll through it to reach
"Simpan pesanan".

**Fix.** One sentence ("Data Anda hanya dipakai untuk pesanan ini dan disimpan 12 bulan.") plus a
`<details>` "Selengkapnya" with the full text.

### UX-12 — Location and language are inconsistent

- Header: "EST. 2026 | **BASED IN BALI**". Trust bar and FAQ: "Dikirim dari **Indonesia**".
  Footer: "Bali, Indonesia". Pickup: "studio (**Jimbaran**)". A buyer outside Bali can't tell
  whether shipping comes from Bali; a buyer in Bali doesn't learn about pickup until the form.
- In Indonesian mode some UI is still English: "BASED IN BALI", footer "**LOCK SITE**", lock
  screen "UNLOCK →".

**Fix.** Pick one line and use it everywhere, e.g. "Dibuat di Jimbaran, Bali · dikirim ke
seluruh Indonesia". Translate the remaining strings. Remove "Lock site" from the footer at launch;
it's a staging tool (see `O-06`).

### UX-13 — FAQ gaps and repeated content

The six FAQs cover origin, lead time, damage, customisation, care and the DIY kit. Missing are
the questions people ask **before paying**:

- How do I pay (transfer / QRIS / Midtrans link)? When?
- Roughly what does shipping cost, and which couriers? Can I pick up in Jimbaran?
- Can I send it directly to someone else as a gift?
- Can I change or cancel after confirming?

Meanwhile, the hero's three benefits and the four-item trust bar directly under it partly repeat
each other (made to order, ships finished). The DIY teaser offers a "Baca FAQ" button right
after the FAQ.

**Fix.** Add the four questions (owner input needed — see `O-04`). Merge the hero benefits and
the trust bar into one row. Drop "Baca FAQ" from the teaser.

---

## P3 — polish

### UX-14 — Layout and card consistency

- **Three card styles** across one catalogue: stems are open (no box), mini pots are boxed and
  inset, bouquets are boxed and full-width.
- **Mini-pot grid** is 3 centred cards starting at x = 204 px, while every other grid starts at
  the container edge (154 px). On phones the third pot is an orphan in a 2-column grid.
- **DIY teaser and footer rules** span 130–1310 px; the rest of the page uses 154–1286 px.
- **Hero benefits:** "Dibuat sesuai pesanan" wraps to two lines at a very tall line-height, which
  pushes its row down and leaves a gap above the other two descriptions.
- **"Cara dibuat" steps:** headings of 1 vs 2 lines misalign the four descriptions.

**Fix.** Use one card component, one grid (`repeat(auto-fill, minmax(240px, 1fr))` aligned to the
container), and one container width. Tighten the `dt` line-height in the hero benefits.

### UX-15 — Small type on key labels

Measured at 390 px: header "Pesan" **11 px**; hero buttons, Latin names and the order-picker group
labels **12 px**; prices inside stem buttons **~12 px**; builder hint and order note **12.5 px**.
Body text is 16 px, which is good. The custom-card checkbox's tap area is **30 px** tall (the
only target under 44 px).

**Fix.** Use at least 13–14 px for interactive and price text, and at least 44 px tall for
`.message-card-option`.

### UX-16 — Navigation naming

- The catalogue section's H2 is "**Cara memesan**" (How to order), but it's the product
  catalogue. The footer's "**Cara pesan**" link goes somewhere else (`#order`).
- The header "Pesan" CTA always targets `#collection-overview`, even with items in the cart.

**Fix.** Rename the catalogue H2 to "Pilih bunga Anda" / "Koleksi". Once the cart has items,
point "Pesan" at `#order` and show the count.

---

## What's working — keep it

- **Brand and art direction.** Serif display type, warm paper palette, consistent product
  photography, the "Pl. I" plate caption. It feels like a studio, not a template.
- **Hero.** Clear promise, two obvious paths (see flowers / build a bouquet), and the product
  visible above the fold on desktop.
- **Checkout form.** Inline errors under each field, a "5 kolom perlu dilengkapi" summary, focus
  moved to the first invalid field, a custom date picker that greys out dates inside the lead
  time, and separate Bali and outside-Bali address fields.
- **Review step.** Order reference, itemised totals, "Ongkos kirim: dihitung terpisah", and a
  plain "Belum ada pembayaran pada tahap ini". Exactly the reassurance this model needs.
- **Custom builder.** Live estimate, an explicit minimum-stem warning, and +/− buttons with proper
  names.
- **Honesty cues.** "Foto: 3 tangkai" badges on multi-stem photos, "belum termasuk ongkir"
  everywhere, and a confirmation dialog before clearing the cart.
- **Basics.** Skip link, visible focus rings, 44 px targets almost everywhere, a full ID/EN
  toggle, and no console errors. `AUDIT.md` §9 already measured contrast and overflow as passing.

---

## Suggested order of work

1. **UX-01 + UX-04 together.** Stay in place on add, with one clear cart control. This is the
   biggest change to how the page feels.
2. **UX-02.** Remove the duplicate picker. The phone page gets several screens shorter.
3. **UX-03.** Wrap logic. Small code change; fixes what the studio receives.
4. **UX-05, UX-06, UX-09, UX-10, UX-12.** Copy and markup quick wins.
5. **UX-08, UX-11, UX-07.** Checkout clarity.
6. **UX-13.** Needs owner answers (payment, shipping, pickup, changes).
7. **UX-14 to UX-16.** Polish pass.

Re-check after changes at 390 px and 1440 px. In particular, confirm the post-add scroll position
and focus target (UX-01), that the phone page height drops (UX-02), and that a mini-pot-only
order's review line no longer mentions wrap (UX-03).
