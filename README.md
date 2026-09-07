<div align="center">

  <img src="komorebi-logo.png" alt="Komorebi Logo" width="88" height="88" />

  # Komorebi Creations

  **Flowers that never wilt — built by your own hands.**

  *Handcrafted Chenille Stem Botanical Kits & Arrangements*

  [![Domain](https://img.shields.io/badge/website-komorebicreations.com-3F5545?style=for-the-badge)](https://komorebicreations.com)
  [![Status](https://img.shields.io/badge/status-live-8E6127?style=for-the-badge)](#)
  [![Stack](https://img.shields.io/badge/stack-HTML5%20%7C%20CSS3%20%7C%20JS-23201B?style=for-the-badge)](#)

</div>

---

## 🌿 About Komorebi

**Komorebi Creations** is an independent studio crafting botanical DIY kits made from soft chenille stems over twisted wire cores. Every kit arrives pre-cut and sorted like a botanical instruction plate, allowing anyone to shape, assemble, and keep their handmade bloom in about 20 minutes.

### 🌸 The Botanical Collection
- **Sunflower** (*Helianthus annuus*): Layered ochre petals with a dense seeded crown.
- **Rose** (*Rosa centifolia*): Spiralled dusty pink petals wound one by one.
- **Tulip** (*Tulipa gesneriana*): Six clean petals with slender architectural leaves.
- **Lavender** (*Lavandula angustifolia*): Bundles of slender textured spikes for narrow vases.

Each species is available in three formats:
1. **DIY Kit**: All parts, stems, glue, and botanical guide in the box.
2. **Finished Stem**: Hand-assembled by us, wrapped in kraft paper.
3. **Bouquet**: 5–11 stems arranged, tied, and boxed.

---

## ✨ Features & Highlights

- **Aesthetic Botanical Typography**: Clean, responsive editorial design with Google Fonts (`Cormorant Garamond` & `Karla`) and a warm linen color palette (`#FAF6EE`, `#23201B`, `#3F5545`, `#8E6127`).
- **Interactive Order Builder**: Real-time product customizer with live price calculations, dynamic inclusions, and direct checkout channels (Tokopedia, Shopee, and automated WhatsApp order messages).
- **Instant Bilingual Support**: One-click language switcher (`ID` Bahasa Indonesia ↔ `EN` English) with persistent preference storage.
- **Private Access Gatekeeper**: Built-in botanical passcode protection overlay with automatic device session memory.
- **Zero-Dependency Architecture**: Pure HTML5, modern CSS, and vanilla JavaScript. No build step, no Node.js dependencies, and zero maintenance overhead.
- **Production-Ready Hosting**: Deployed on GitHub Pages with custom domain and automated SSL/TLS encryption.

---

## 📁 Repository Structure

```text
komorebi-creations/
├── index.html            # Primary landing page & private lock screen
├── styles.css            # Custom botanical stylesheet (1:1 responsive layout)
├── site-content.js       # Central data file (texts, links, catalog, prices & auth)
├── app.js                # Interactive application controller & state engine
├── CNAME                 # Custom domain configuration (komorebicreations.com)
├── komorebi-logo.png     # Studio brand logo
├── README.md             # Project documentation
└── img/                  # High-resolution product & botanical photography
    ├── hero.png          # Pl. I Helianthus annuus hero plate
    ├── kit.png           # Overhead kit contents flatlay
    ├── lavender.png      # Lavender product photography
    ├── macro.png         # Fig. 1 Chenille stem pile macro close-up
    ├── rose.png          # Rose product photography
    ├── sunflower.png     # Sunflower product photography
    ├── tulip.png         # Tulip product photography
    └── us.png            # Maker studio table
```

---

## 🛠️ How to Customize (Editing Content)

All content on the website is configured in a single, well-organized file: [`site-content.js`](site-content.js). You can edit this file in any text editor or VS Code:

### 1. Store Details & Social Links
Open `site-content.js` and locate the `store` object:
```javascript
store: {
  brandName: "Komorebi",
  instagramUrl: "https://instagram.com/komorebi",
  tokopediaUrl: "https://www.tokopedia.com/...",
  shopeeUrl: "https://shopee.co.id/...",
  whatsappNumber: "6281234567890", // Update with your WhatsApp number
  ...
}
```

### 2. Product Prices
Update prices for any species and format:
```javascript
Sunflower: {
  prices: {
    Kit: "Rp 95.000",
    Stem: "Rp 55.000",
    Bouquet: "Rp 285.000"
  }
}
```

### 3. Texts & Translations
Modify copy under `translations.id` (Indonesian) or `translations.en` (English) to update headlines, FAQs, instructions, or stories.

### 4. Private Access Passcode
To update the private gatekeeper passcode, change line 21 in `site-content.js`:
```javascript
auth: {
  enabled: true,
  passcode: "YOUR_SECRET_CODE"
}
```

---

## 🚀 Running Locally

No installation or command-line setup is required:
1. Clone or download this repository.
2. Double-click `index.html` to open it in your browser.

---

<div align="center">
  <sub>© 2026 Komorebi Creations. Handcrafted with love.</sub>
</div>
