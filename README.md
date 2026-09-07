<div align="center">

  <img src="komorebi-logo-96.webp" alt="Komorebi Logo" width="88" height="88" />

  # Komorebi Creations

  **Bunga yang mekar selamanya — dirangkai oleh tangan Anda sendiri.**
  *Handcrafted Chenille Stem Botanical Kits & Arrangements*

  [![Domain](https://img.shields.io/badge/website-komorebicreations.com-3F5545?style=for-the-badge)](https://komorebicreations.com)
  [![Status](https://img.shields.io/badge/status-development-8E6127?style=for-the-badge)](#)
  [![Stack](https://img.shields.io/badge/stack-HTML5%20%7C%20CSS3%20%7C%20JS-23201B?style=for-the-badge)](#)

</div>

---

## 🌿 About Komorebi

**Komorebi Creations** adalah studio independen yang merancang kit merangkai bunga berbahan kawat bulu chenille lembut di atas inti kawat lentur berpuntir. Setiap kit dipotong rapi sesuai ukuran, dihitung, dan dikemas layaknya pelat botani klasik (*botanical plates*), memungkinkan siapa saja membentuk, merangkai, dan memajang bunga abadi mereka dalam waktu sekitar 20 menit.

### 🌸 The Botanical Collection & Pricing
| Spesies | Nama Latin | Kit DIY | Tangkai Jadi | Buket (5–11 tangkai) |
| :--- | :--- | :--- | :--- | :--- |
| **Bunga Matahari** | *Helianthus annuus* | Rp 95.000 | Rp 55.000 | Rp 285.000 |
| **Mawar** | *Rosa centifolia* | Rp 105.000 | Rp 60.000 | Rp 305.000 |
| **Tulip** | *Tulipa gesneriana* | Rp 95.000 | Rp 55.000 | Rp 285.000 |
| **Lavender** | *Lavandula angustifolia* | Rp 95.000 | Rp 55.000 | Rp 285.000 |

Format yang tersedia:
1. **Kit DIY**: Kawat chenille terpotong rapi, kawat tangkai, lem, dan panduan botani bergambar.
2. **Tangkai Jadi**: Dirangkai tangan satu per satu oleh kami, dibalut kertas kraft.
3. **Buket**: 5–11 tangkai terangkai harmonis, diikat pita katun, dikemas dalam kotak protektif.

---

## ✨ Features & Architecture

- **Tipografi Editorial Botani**: Tipografi elegan Google Fonts (`Cormorant Garamond` & `Karla`) dengan palet warna linen alami (`#FAF6EE`, `#23201B`, `#3F5545`, `#8E6127`).
- **Interactive Order Builder**: Customizer interaktif dengan pembaruan visual instan (thumbnail produk, harga dinamis per format, rincian isi paket, dan kuantitas).
- **Rute Pemesanan WhatsApp & Marketplace**:
  - Generator pesan WhatsApp otomatis dengan draf pesanan lengkap (spesies bunga, format, kuantitas, total harga, dan nomor referensi).
  - Integrasi marketplace Tokopedia & Shopee (otomatis menampilkan panduan langsung ke WhatsApp apabila tautan kanal belum aktif).
- **Dukungan Bilingual Instan**: Pengalih bahasa sekali klik (`ID` Bahasa Indonesia ↔ `EN` English) dengan persistensi preferensi di `localStorage`.
- **Akses Pratinjau Pengembangan (Private Gatekeeper)**: Layar kunci botani untuk tahap pengembangan privat dengan penyimpanan status verifikasi di browser.
- **Search & Social Discovery**:
  - Metadata Open Graph lengkap (Facebook, WhatsApp preview, iMessage, LinkedIn).
  - Twitter Card (`summary_large_image`).
  - Structured Data Schema.org (JSON-LD) untuk `Organization`, `WebSite`, dan `Product` (tanpa ulasan atau rating palsu).
  - `robots.txt` dan `sitemap.xml` terstandarisasi.
- **Performa & Responsivitas Tinggi**:
  - Aset gambar modern WebP bertingkat (`srcset`) dengan kompresi optimal.
  - 0px horizontal overflow di semua ukuran layar (320px, 390px, 820px, 1024px, 1440px).
  - Arsitektur zero-dependency tanpa proses build atau node_modules di runtime produksi.

---

## 📁 Repository Structure

```text
komorebi-creations/
├── index.html            # Landing page utama, metadata SEO, JSON-LD, dan lock screen
├── styles.css            # Stylesheet botani responsif (desktop, tablet, mobile)
├── site-content.js       # Pusat data (katalog produk, teks terjemahan, link toko, konfigurasi auth)
├── app.js                # Pengendali aplikasi interaktif & state engine
├── CNAME                 # Konfigurasi domain khusus (komorebicreations.com)
├── robots.txt            # Konfigurasi robot mesin pencari
├── sitemap.xml           # Peta situs XML standar
├── favicon.ico           # Favicon multiresolusi
├── favicon-16x16.png     # Favicon browser 16px
├── favicon-32x32.png     # Favicon browser 32px
├── apple-touch-icon.png  # Ikon layar utama iOS
├── komorebi-logo.png     # Master logo studio
├── README.md             # Dokumentasi proyek
└── img/                  # Aset fotografi botani responsif (WebP & master PNG)
    ├── hero-*.webp       # Foto pembuka bunga matahari (400w, 800w, 1122w)
    ├── kit-*.webp        # Flat lay isi kit di atas meja (480w, 960w, 1448w)
    ├── macro-*.webp      # Makro serat chenille kawat berpuntir (480w, 960w, 1254w)
    ├── us-*.webp         # Foto meja studio pembuat (480w, 960w, 1448w)
    ├── sunflower-*.webp  # Foto katalog bunga matahari (360w, 720w)
    ├── rose-*.webp       # Foto katalog bunga mawar (360w, 720w)
    ├── tulip-*.webp      # Foto katalog bunga tulip (360w, 720w)
    └── lavender-*.webp   # Foto katalog bunga lavender (360w, 720w)
```

---

## 🛠️ Panduan Kustomisasi (`site-content.js`)

Seluruh data toko, harga, katalog, dan teks tersentralisasi di satu file: [`site-content.js`](site-content.js). Anda dapat menyunting file ini menggunakan text editor apa pun:

### 1. Informasi Kontak & Tautan Toko
Buka `site-content.js` pada objek `store`:
```javascript
store: {
  brandName: "Komorebi",
  instagramUrl: "https://instagram.com/komorebi",
  tokopediaUrl: "https://www.tokopedia.com/...",
  shopeeUrl: "https://shopee.co.id/...",
  whatsappNumber: "6281234567890", // Ganti dengan nomor WhatsApp aktif
  ...
}
```

### 2. Harga Produk & Spesies
Ubah harga pada masing-masing spesies:
```javascript
Sunflower: {
  prices: {
    Kit: "Rp 95.000",
    Stem: "Rp 55.000",
    Bouquet: "Rp 285.000"
  }
}
```

### 3. Teks, Cerita, & Panduan
Ubah salinan teks pada bagian `translations.id` (Bahasa Indonesia) atau `translations.en` (Bahasa Inggris) untuk memperbarui judul, FAQ, instruksi perakitan, atau cerita studio.

---

## 🔐 Mode Akses Pengembangan & Peluncuran Publik

### Mode Pengembangan Privat (Saat Ini Aktif)
Situs saat ini berada dalam mode pengembangan privat dengan proteksi kode sandi:
```javascript
// site-content.js (baris 21)
auth: {
  enabled: true,
  passcode: "YOUR_SECRET_PASSCODE"
}
```
Ketika Anda atau rekan memasukkan kata sandi yang benar, browser akan mengingat status akses (`komorebi_unlocked: true`) sehingga tidak perlu memasukkan sandi berulang kali pada perangkat yang sama.

### Cara Meluncurkan ke Publik (Public Launch)
Ketika Anda siap membuka toko secara terbuka untuk umum:
1. Di [`site-content.js`](site-content.js), ubah `auth.enabled` menjadi `false`:
   ```javascript
   auth: {
     enabled: false,
     passcode: ""
   }
   ```
2. Di [`index.html`](index.html), ubah tag robots dari `noindex, nofollow` menjadi:
   ```html
   <meta name="robots" content="index, follow" />
   ```
3. Lakukan commit dan push ke repository GitHub. Situs akan langsung terbuka untuk semua pengunjung tanpa layar kunci.

---

## 🚀 Menjalankan Secara Lokal

Situs ini menggunakan arsitektur vanilla tanpa proses build:
1. Buka file `index.html` langsung di peramban web (browser), atau
2. Jalankan server lokal sederhana:
   ```bash
   # Menggunakan Node.js
   npx serve .
   # Atau menggunakan Python
   python -m http.server 8000
   ```

---

<div align="center">
  <sub>© 2026 Komorebi Creations. Handcrafted with love.</sub>
</div>
