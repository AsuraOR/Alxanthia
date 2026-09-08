# Komorebi — product pivot spec (DIY kit → finished flowers & bouquets)

For the agent working on the **live site** (`index.html`, `app.js`, `site-content.js`, `styles.css`).
The attached design (`Komorebi Landing.dc.html` + `img/`) is the reference for content, structure and copy.
Keep the existing visual language, CSS classes, bilingual system (ID default / EN), passcode gate, edit mode, sticky order bar and marketplace channel toggles. **Do not restyle the site.**

---

## 1. Why

DIY kit launch is blocked on entry cost (box manufacturing, glue, labels, R&D). The shop now sells **finished flowers** and **bouquets** first. The DIY kit becomes a "coming later" waitlist teaser.

---

## 2. Catalogue changes

**Flowers: Lavender is out of the catalogue, Gerbera is in.**

`site-content.js` → `flowerOrder: ["Sunflower", "Rose", "Tulip", "Gerbera"]`

New `flowers.Gerbera` entry, same shape as the others:

| field | value |
| --- | --- |
| slug | `gerbera` |
| latin | `Gerbera jamesonii` |
| accent | `#C97A45` |
| photo | `img/gerbera.png` (source file included — generate `-360.webp` / `-720.webp` derivatives to match the others) |
| alt | Three handmade chenille gerbera daisies in coral orange |
| size | `40 cm stem` / `tangkai 40 cm` |
| detail | `coral, two-tone` / `koral, dua nada` |

- Lavender stays in the *bouquet photos* (it appears in the shots) but is **not** orderable as a stem and **not** in the custom builder. Remove it from `flowerOrder` and from the collection/order chips; leaving the data object in place is fine.
- Delete the `Kit` price from every flower and from `formatKeys`. New `formatKeys: ["Stem", "Package", "Custom"]`.

**Stem prices (IDR, unchanged where they existed):**

Sunflower 55.000 · Rose 60.000 · Tulip 50.000 · Gerbera 55.000

---

## 3. THE COLLECTION section — now two categories, stacked

`#collection` renders **Category 01 — Finished flowers**, then `#bouquets` renders **Category 02 — Bouquets**. Each category gets a small header row: mono label (`Category 01` / `Kategori 01`), serif title, one-line note. See the design.

### 3a. Finished flowers (4 cards)

Reuse the existing `.flower-card` markup and `renderCollection()`. Per card:

- photo with accent bar on top (as today)
- name, latin (italic serif), blurb
- spec line: `{size} · {detail}` — replaces the old "Makes 3 flowers" line
- price line: `Rp 55.000 per stem` / `Rp 55.000 per tangkai`
- primary button **Order this stem** / **Pesan tangkai ini** → sets order selection to `{flower, mode:"stem"}` and scrolls to `#order`
- secondary text button **Add to bouquet +** / **Tambah ke buket +** → switches order mode to `custom` and increments that flower's count by 1

The old three-way "kit / finished stem / bouquet" links on each card are gone.

### 3b. Bouquets (4 packages)

New data block in `site-content.js`:

```js
packages: [
  { stems: 3,  price: 195000, photo: "img/bouquet-3.png"  },
  { stems: 5,  price: 295000, photo: "img/bouquet-5.png"  },
  { stems: 9,  price: 465000, photo: "img/bouquet-9.png"  },
  { stems: 15, price: 745000, photo: "img/bouquet-15.png" }
]
```

Names — ID: `Buket Mini`, `Buket Sedang`, `Buket Besar`, `Buket Istimewa`. EN: `The Posy`, `The Handful`, `The Armful`, `The Grand`. Blurbs are in the design; copy them verbatim.

Card: square photo (1:1, `object-fit:cover`) → mono `{n} stems` label + four accent dots → serif name → blurb → price → **Choose this bouquet** / **Pilih buket ini** button (label becomes `Selected` / `Dipilih` and the card gets a `#23201B` border + `#F3EDE1` fill when active).

Bouquet photos are included as PNG (`img/bouquet-3|5|9|15.png`) — please make the webp/srcset derivatives.

Package `includes` lines: `{n} finished stems, mixed flowers` · `Wrapped in paper, tied with ribbon` · `Boxed for delivery` · `Care card included` (ID equivalents in the design).

### 3c. Custom bouquet builder

Panel below the packages (`#F3EDE1` card, 1px `#E2D9C8` border). Left column: one row per flower — accent dot, name, `Rp X / stem`, then `−` / count / `+` buttons (40×40, min 44px tap target on mobile please). Below the rows: `{n} stems` running count + **Reset** / **Atur ulang**.

Right column, live estimate:

```
Flowers (n)              Rp <sum of qty × stem price>
Bulk discount (9+ stems) − Rp <10% of flowers subtotal>   ← only shown when stems >= 9
Wrapping & ribbon        Rp 35.000
─────────────────────────────────────
Estimated total          Rp <flowers − discount + 35.000>
```

Rules, exactly as built:

- **Minimum 3 stems.** Under that: total shows `—`, the CTA is disabled (`#A79E8C`, `cursor:not-allowed`) and the hint reads "Add at least three stems to order a bouquet." in `#8E6127`.
- **Wrap fee Rp 35.000** always added to a bouquet.
- **10% off the flowers subtotal at 9+ stems** (not applied to the wrap fee).
- Valid state hint: "An estimate — we confirm the final total on chat before you pay."
- CTA **Use this bouquet** / **Pakai buket ini** → sets order mode `custom` and scrolls to `#order`.

Put `wrapFee: 35000`, `bulkFrom: 9`, `bulkRate: 0.10`, `minStems: 3` in `site-content.js` so the numbers are editable without touching `app.js`.

### 3d. DIY kit teaser (below the bouquets)

Rules-off band, mono eyebrow **Coming later** / **Segera menyusul**, serif title "The DIY kit is still in the workshop" / "Kit DIY-nya masih kami siapkan", body copy from the design, then two buttons: **I want the kit →** / **Saya mau kitnya →** (WhatsApp deep link with its own message template, e.g. `Halo Komorebi! Saya tertarik dengan kit DIY-nya — tolong kabari saya saat diluncurkan.`) and **Read the FAQ** → `#faq`.

Gate it behind a `showKitTeaser: true` flag in `site-content.js`.

---

## 4. Order section (`#order`)

The two-step flower/format chooser is replaced. Selection now comes from the cards above; `#order` is **finishing + summary**.

Left column:
- **Finishing** — wrap colour chips (single select): Kraft `#B79A6E`, Cream/Krem `#F0E7D6`, Sage `#7E8F7C`, Blush `#C9A4A8`. Included in the price.
- **Message card** — textarea, placeholder "e.g. Happy graduation, Sagita — from all of us" / ID equivalent, note that it's handwritten and free, blank is fine.

Right column — existing `.summary-box`, three modes:

| mode | title | sub | price | includes |
| --- | --- | --- | --- | --- |
| `stem` | `{Flower} — finished stem` | latin name | stem price | stem includes list |
| `package` | package name | `{n} stems` | package price | package includes list |
| `custom` | `Custom bouquet` / `Buket custom` | `{n} stems` | estimated total (or `—`) | one line per flower `2 × Sunflower`, then "Wrapped, tied and boxed by us", "Made to order — 3–4 working days" |

Every mode appends `Wrap: {colour}` and, when the textarea is non-empty, `Message card: "{text}"` to the includes list. Feed both into the WhatsApp template too (`{wrap}`, `{note}` placeholders) and update the sticky order bar title/price the same way.

Keep the Tokopedia / Shopee / WhatsApp buttons and the `channels` + `showPrices` toggles as they are.

---

## 5. Sections to delete

- **`#kit` "Inside your kit"** — whole section, its `renderKit()`, `kit-list` / `specs-grid` content, `images.kit*`, the `contents` and `specs` translation blocks, `specs-guidance`, and the nav link `#nav-kit`.
- **`#about` "Who makes these"** — whole section, `renderAbout()`, `images.us*`, and the `about*` strings. **We want to stay anonymous.** The footer Instagram link stays; the shop can be credited, we can't.
- Old `formats` translation arrays (Kit / Stem / Bouquet), `Kit` prices, `makesPrefix` / `kitPricePrefix` / `buyKit*` strings, `includes.Kit`.

## 6. Sections rewritten (copy only, same markup)

- **Hero** — eyebrow "Finished flowers & bouquets · chenille stems", new title/sub, CTAs **See the flowers** → `#collection` and **Build a bouquet** → `#bouquets`; the three benefits become "Arrives finished", "No water, ever", "Made to order".
- **Trust bar** — item 2 becomes "Made in 2–3 working days / Bouquets of 9+ stems, 3–4 days"; item 3 becomes "Boxed to arrive intact / Any petal can be reshaped by hand" (was the missing-piece guarantee).
- **`#howto`** — was "how you build it", now **How they're made**: Cut → Shape → Assemble → Wrap & send. Four steps, copy in the design. Nav label "How they're made" / "Cara dibuat".
- **`#material`** — mostly unchanged; the reshaping point is reworded for a finished product ("If a petal flattens in transit, bend it back").
- **`#faq`** — 6 questions: shipping origin, lead time (2–3 / 3–4 days), "Will it arrive crushed?", "Can I change what's in a bouquet?", care, and **"Are the DIY kits still coming?"** (yes, waitlist via WhatsApp). The old missing-piece / damaged-parcel / child-safety kit questions are gone.
- **Nav** — Flowers · Bouquets · How they're made · FAQ · Order (ID: Bunga · Buket · Cara dibuat · FAQ · Pesan).

All EN and ID strings are in the `STRINGS` object at the bottom of the design file — lift them directly into `translations` rather than retranslating.

---

## 7. Please also

- Keep every price, fee, package and rule in `site-content.js` (non-developer editable), nothing hardcoded in `app.js`.
- Scroll-reveal targets: add the new bouquet cards / builder panel to the `initScrollReveals()` selector list and drop `.kit-grid`, `.specs-card`, `.about-figure`, `.about-text-col`.
- Add `img/gerbera.png` and `img/bouquet-*.png` to the webp derivative pipeline with srcset + `loading="lazy"`, matching the existing images.
- Builder must work with keyboard and screen reader: `aria-live` on the estimate total, real `<button>`s for `−`/`+`, labelled counts.
- Marketplace URLs are still `null` — leave the WhatsApp fallback behaviour as is.
