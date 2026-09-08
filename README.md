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

**Komorebi Creations** adalah studio independen yang merangkai bunga abadi berbahan kawat bulu chenille lembut di atas inti kawat lentur berpuntir. Setiap tangkai dan buket dibentuk, dirangkai tangan, dan dibungkus rapi siap pajang langsung dari studio kami untuk pengiriman ke seluruh Indonesia.

### 🌸 The Botanical Collection & Pricing

#### Tangkai Jadi (Single Finished Stems)
| Spesies | Nama Latin | Harga / Tangkai | Catatan Ketersediaan |
| :--- | :--- | :--- | :--- |
| **Bunga Matahari** | *Helianthus annuus* | Rp 55.000 | Tangkai jadi tunggal, siap pajang |
| **Mawar** | *Rosa centifolia* | Rp 60.000 | Spiral kelopak berlapis lembut |
| **Tulip** | *Tulipa gesneriana* | Rp 50.000 | Kuncup kelopak satin tegak |
| **Gerbera** | *Gerbera jamesonii* | Rp 55.000 | Dua lingkar kelopak koral ramping (harga per 1 tangkai) |

*Catatan: Lavender hadir sebagai elemen pengisi estetis dalam foto referensi buket studio, bukan tangkai tunggal yang dijual terpisah.*

#### Pilihan Format Pesanan:
1. **Tangkai Jadi**: 1 atau lebih tangkai individu pilihan Anda, dibalut kertas pelindung kraft dan instruksi perawatan.
2. **Paket Buket Floris** (Wrapping & kartu ucapan sudah termasuk):
   - **Petit (3 Tangkai)**: Rp 195.000 — Komposisi ringkas manis untuk meja kerja atau hadiah kecil.
   - **Klasik (5 Tangkai)**: Rp 295.000 — Komposisi buket seimbang terfavorit studio.
   - **Rimbun (9 Tangkai)**: Rp 465.000 — Komposisi mekar penuh untuk wisuda atau momen istimewa.
   - **Istimewa (15 Tangkai)**: Rp 745.000 — Rangkaian mewah penuh untuk perayaan besar.
3. **Buket Campuran Custom**: Pilih kombinasi bunga Anda sendiri (minimal 3 tangkai, termasuk wrapping buket Rp 35.000, hemat 10% untuk 9+ tangkai).
4. **DIY Kit (Coming Later)**: Teaser pra-rilis bagi yang ingin merangkai sendiri di rumah (segera hadir).

---

## ✨ Features & Architecture

- **Tipografi Editorial Botani**: Tipografi elegan Google Fonts (`Cormorant Garamond` & `Karla`) dengan palet warna linen alami (`#FAF6EE`, `#23201B`, `#3F5545`, `#8E6127`).
- **Interactive Order Builder**: Customizer interaktif dengan pembaruan visual instan (thumbnail produk, harga dinamis per format, rincian isi paket, dan kuantitas).
- **Rute Pemesanan WhatsApp & Marketplace**:
  - Generator pesan WhatsApp otomatis dengan draf pesanan lengkap (spesies bunga, format, kuantitas, total harga, dan nomor referensi).
  - Integrasi marketplace Shopee (tautan langsung ke toko resmi Shopee serta panduan konfirmasi via WhatsApp).
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
  shopeeUrl: "https://shopee.co.id",
  whatsappNumber: "6281234567890", // Ganti dengan nomor WhatsApp aktif
  ...
}
```

### 2. Harga Tangkai & Paket Buket
- **Harga per Tangkai**: Sunting nilai `stemPrice` (angka dalam Rupiah) pada objek `flowers`:
  ```javascript
  flowers: {
    Sunflower: {
      stemPrice: 55000,
      accent: "#C89A3C",
      ...
    },
    Rose: {
      stemPrice: 60000,
      ...
    }
  }
  ```
- **Harga Paket Buket Jadi**: Sunting nilai `price` dan `stems` pada larik `packages`:
  ```javascript
  packages: [
    { stems: 3, price: 195000, photoWebp: "img/bouquet-3.webp" },
    { stems: 5, price: 295000, photoWebp: "img/bouquet-5.webp" },
    { stems: 9, price: 465000, photoWebp: "img/bouquet-9.webp" },
    { stems: 15, price: 745000, photoWebp: "img/bouquet-15.webp" }
  ]
  ```
- **Aturan Buket Custom**: Biaya wrapping (`wrapFee: 35000`), batas diskon grosir (`bulkFrom: 9`), dan persentase potongan (`bulkRate: 0.10`).

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
