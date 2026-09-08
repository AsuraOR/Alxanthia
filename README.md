<div align="center">

  <img src="komorebi-logo-96.webp" alt="Komorebi Logo" width="88" height="88" />

  # Komorebi Creations

  **Bunga yang mekar selamanya — dirangkai tangan oleh kami untuk Anda.**  
  *Handcrafted Finished Chenille Stem Flowers & Botanical Bouquets*

  [![Domain](https://img.shields.io/badge/website-komorebicreations.com-3F5545?style=for-the-badge)](https://komorebicreations.com)
  [![Status](https://img.shields.io/badge/status-staging%20%2F%20private%20review-8E6127?style=for-the-badge)](#)
  [![Stack](https://img.shields.io/badge/stack-HTML5%20%7C%20CSS3%20%7C%20JS%20(Zero--Dependency)-23201B?style=for-the-badge)](#)

</div>

---

## 📋 DAFTAR INPUT PEMILIK TOKO / OWNER-INPUT LIST (R12)

> [!IMPORTANT]
> **Pemberitahuan untuk Pemilik / Store Owner:**  
> Seluruh sistem situs web dan kalkulator pemesanan telah siap pakai dan lolos uji integrasi otomatis. Namun, demi integritas dan kejujuran operasional, beberapa parameter operasional sengaja diset ke status tunggu (placeholder/kosong) dan **tidak dikarang-karang oleh sistem**.  
> Silakan periksa tabel berikut dan perbarui nilai di [`site-content.js`](site-content.js) saat data resmi sudah tersedia:

| # | Parameter Operasional | Nilai Saat Ini di `site-content.js` | Status | Petunjuk Pembaruan untuk Pemilik |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Tautan Toko Shopee Resmi** (`store.shopeeUrl`) | `""` (string kosong) | ⏳ Menunggu Konfirmasi | Tombol Shopee di halaman saat ini otomatis berstatus aman *"Segera hadir"* dan dinonaktifkan. Begitu toko Shopee dibuka, isi dengan URL toko (mis. `"https://shopee.co.id/komorebi.creations"`). |
| **2** | **Nomor WhatsApp Studio** (`store.whatsappNumber`) | `"6281234567890"` | ⏳ Placeholder | Masukkan nomor WhatsApp aktif studio (awali dengan kode negara `62` tanpa tanda `+` atau spasi, contoh: `"6281298765432"`). Seluruh generator chat otomatis mengarah ke nomor ini. |
| **3** | **Akun Instagram Studio** (`store.instagramUrl`) | `"https://instagram.com/komorebi"` | ⏳ Placeholder | Masukkan URL akun Instagram resmi studio (mis. `"https://instagram.com/komorebicreations"`). |
| **4** | **Lokasi Studio & Ekspedisi Pengiriman** | *"Dikirim dari Indonesia"* (seluruh pesanan) | ⏳ Menunggu Spesifikasi | Di FAQ dinyatakan dikirim dari Indonesia. Jika pemilik ingin menegaskan kota asal (mis. *"Jakarta Selatan"* atau *"Bandung"*) dan jenis kurir (Instant/Sameday GoSend, JNE, SiCepat), dapat disunting di `translations.id.faqs` dan `translations.en.faqs`. |
| **5** | **Jam Operasional Balas Chat Studio** | Standar hari kerja (2–3 hari pembuatan) | ⏳ Opsional | Jika memiliki jam operasional studio tertentu (mis. *"Senin–Sabtu 09.00–18.00 WIB"*), dapat ditambahkan ke teks catatan pemesanan di `site-content.js`. |
| **6** | **Komposisi Spesifik Formula Buket** | Campuran bunga pilihan studio (*studio mix*) | ✅ Terverifikasi | Deskripsi paket buket saat ini secara jujur menyatakan racikan variasi artistik studio (*harmonious studio mix*), bukan formula kaku yang dibuat-buat. Jika di masa depan ada resep tangkai yang kaku, cantumkan di `site-content.js`. |
| **7** | **Domain Resmi & URL Kanonikal** | `"https://komorebicreations.com/"` | ⏳ Staging | Digunakan pada tag canonical dan Open Graph di `index.html`. Bila domain final berbeda, ganti di `index.html` dan `CNAME`. |
| **8** | **Proteksi Kode Sandi Akses Staging** (`auth.enabled`) | `true` (Sandi: `"22062024"`) | 🔒 Aktif di Staging | Proteksi privat aktif agar toko tidak dapat diakses publik sebelum pemilik siap. Ubah ke `false` saat peluncuran publik. |

---

## 🌿 Tentang Komorebi Creations

**Komorebi Creations** adalah studio kerajinan botani independen yang merangkai bunga abadi berbahan benang kawat bulu chenille lembut di atas inti kawat lentur berpuntir. Setiap tangkai dibentuk dengan tangan, dirangkai kokoh, dan dikemas rapi siap pajang langsung dari studio kami untuk pengiriman ke seluruh nusantara.

### 🌸 Koleksi Botani & Struktur Harga Resmi

#### 1. Tangkai Jadi Tunggal (Single Finished Stems)
| Spesies Bunga | Nama Latin Botani | Harga / Tangkai | Karakter Rangkaian |
| :--- | :--- | :--- | :--- |
| **Bunga Matahari** | *Helianthus annuus* | Rp 55.000 | Kelopak oker berlapis dengan mahkota berbiji rapat (tangkai 45 cm, kepala 12 cm) |
| **Mawar** | *Rosa centifolia* | Rp 60.000 | Spiral kelopak melingkar lembut, paling menuntut ketelatenan (tangkai 40 cm) |
| **Tulip** | *Tulipa gesneriana* | Rp 50.000 | Kuncup satin tegak ramping dengan warna coral/terracotta (tangkai 35 cm) |
| **Gerbera** | *Gerbera jamesonii* | Rp 55.000 | Dua lingkar kelopak koral ramping (tangkai 40 cm; foto menampilkan 3 tangkai untuk referensi warna) |

*Catatan Botani: Bunga Lavender (*Lavandula angustifolia*) hadir sebagai aksen pengisi estetis dalam foto referensi rangkaian buket studio, bukan sebagai varian tangkai tunggal lepasan.*

#### 2. Format Pemesanan
1. **Tangkai Jadi Satuan**: 1 atau lebih tangkai individu, dibalut kertas pelindung siap vas dengan kartu panduan perawatan.
2. **Paket Buket Floris Studio** (Kertas pembungkus premium, pita katun, boks protektif & kartu ucapan sudah termasuk):
   - **Buket Mini (3 Tangkai)**: Rp 195.000 — Rangkaian ringkas manis untuk meja kerja, nakas, atau cenderamata.
   - **Buket Sedang (5 Tangkai)**: Rp 295.000 — Komposisi bertingkat seimbang terfavorit studio (*classic bouquet*).
   - **Buket Besar (9 Tangkai)**: Rp 465.000 — Komposisi mekar rimbun, sudah termasuk potongan hemat volume 10%.
   - **Buket Istimewa (15 Tangkai)**: Rp 745.000 — Komposisi mekar penuh untuk momen wisuda dan perayaan besar.
3. **Penyusun Buket Custom (Interactive Custom Builder)**:
   - Hitung sendiri komposisi tangkai bunga sesuai selera.
   - Minimal 3 tangkai untuk pemesanan buket custom.
   - Biaya bungkus & pita katun: Rp 35.000 (otomatis masuk ke kalkulasi).
   - Pesanan 9 tangkai ke atas otomatis memperoleh **potongan hemat 10%** dari subtotal harga bunganya.
4. **DIY Craft Kit (Coming Later)**: Teaser pra-rilis kit merangkai sendiri di rumah yang saat ini masih disiapkan di studio.

---

## 🏛️ Arsitektur Sistem & Prinsip Teknis (R10)

Situs Komorebi dibangun dengan mematuhi prinsip **Zero-Dependency Architecture**:
- **Pure Web Standards**: Dibangun murni dengan semantik HTML5 modern, Vanilla CSS3 (Custom Properties & Fluid Typography), dan Vanilla ES6+ JavaScript.
- **Zero Build Tools & No node_modules**: Tidak memerlukan Webpack, Vite, Babel, Tailwind, atau bundler rumit di runtime. File dapat langsung dibuka di browser apa pun atau dideploy ke web server statis (GitHub Pages, Cloudflare Pages, Nginx, Apache).
- **Unidirectional State Machine (`app.js`)**:
  - State terpusat mengatur: `currentLang` ('id' | 'en'), `orderMode` ('stem' | 'package' | 'custom'), `hasUserSelected` (boolean), `selectedFlower`, `selectedStemQty`, `selectedPackage`, `customCounts`, `selectedWrap`, dan `orderNote`.
  - Transisi status instan: Memilih tangkai bunga satuan, mengklik paket buket, atau menggeser tombol stepper custom builder seketika memperbarui mode pesanan, kalkulasi harga, pratinjau foto, dan draf WhatsApp tanpa desinkronisasi.
- **Keamanan Input Pengguna (XSS Prevention - R02)**:
  - Input kartu ucapan (`orderNote`) dan data dinamis dimasukkan ke DOM menggunakan `textContent` pada elemen `span` terisolasi dengan bullet dot terpisah (`<span class="bullet-dot" aria-hidden="true">·</span>`). Tidak ada kode HTML atau karakter berbahaya yang dapat tereksekusi.
- **Aksesibilitas & Ergonomi (WCAG 2.5.5 - R05, R07)**:
  - Seluruh tombol aksi interaktif (`.btn-order-stem`, `.btn-add-bouquet`, `.btn-choose-bouquet`, `.btn-pkg-continue`, `.btn-channel`) memiliki ukuran touch target minimal **44px × 44px**.
  - Tipografi terkecil di seluruh breakpoint layar dinaikkan menjadi minimal **11px–12.5px** sehingga tidak ada teks yang sulit dibaca pada ponsel sempit (320px–390px).
  - Dialog inspektor foto (`<dialog id="image-modal">`) mengembalikan fokus keyboard secara mulus ke elemen pemicu (`modalReturnElement`) saat ditutup melalui tombol silang, tombol Escape, atau klik backdrop luar.
  - Sticky mobile order bar memiliki mesin pantau IntersectionObserver yang otomatis menyembunyikan bar saat hero banner atau ringkasan pesanan terlihat, mencegah tumpang tindih visual.
- **Kejujuran Saluran Marketplace (R01)**:
  - Bendera konfigurasi `store.channels.showShopee` dan `store.channels.showWhatsapp` dihormati secara ketat.
  - Jika URL toko Shopee belum dikonfirmasi, sistem tidak mengarahkan pengunjung ke halaman generic Shopee, melainkan menampilkan badge *"Segera hadir"* yang dinonaktifkan dengan jujur serta menjelaskan bahwa buket custom dan kartu ucapan dilayani via WhatsApp studio.

---

## 📁 Struktur Direktori Repositori

```text
komorebi-creations-1/
├── index.html            # Markup semantik utama, meta tag SEO/OpenGraph, JSON-LD, dialog modal & lock screen
├── styles.css            # Stylesheet botani lengkap (design tokens, layout, dark botanical accordion, responsive queries)
├── site-content.js       # Pusat konfigurasi data tunggal (katalog botani, teks bilingual ID/EN, link toko, auth)
├── app.js                # Pengendali aplikasi interaktif (state machine, customizer engine, kalkulator harga, a11y)
├── tests/
│   └── verify-ordering.js # 10 rangkaian tes integrasi otomatis yang mengeksekusi langsung app.js & site-content.js
├── revisions/            # Dokumen review post-implementasi & panduan revisi
├── CNAME                 # Konfigurasi custom domain staging
├── robots.txt            # Pengaturan robot mesin pencari
├── sitemap.xml           # Peta situs XML resmi
├── favicon.ico           # Favicon multiresolusi
├── favicon-16x16.png     # Favicon 16px
├── favicon-32x32.png     # Favicon 32px
├── apple-touch-icon.png  # Ikon perangkat iOS
├── komorebi-logo-96.webp # Logo studio resolusi 1x
├── komorebi-logo-192.webp# Logo studio resolusi 2x
├── README.md             # Dokumentasi teknis & operasional ini
└── img/                  # Fotografi botani responsif terkompresi (WebP bertingkat)
    ├── hero-*.webp       # Foto pembuka Bunga Matahari di atas kertas krem (400w, 800w, 1122w)
    ├── macro-*.webp      # Makro serat chenille kawat berpuntir (480w, 960w, 1254w)
    ├── sunflower-*.webp  # Foto katalog Bunga Matahari (360w, 720w)
    ├── rose-*.webp       # Foto katalog Mawar (360w, 720w)
    ├── tulip-*.webp      # Foto katalog Tulip (360w, 720w)
    ├── gerbera-*.webp    # Foto katalog Gerbera (360w, 720w)
    ├── lavender-*.webp   # Foto katalog aksen Lavender (360w, 720w)
    └── bouquet-*.webp    # Foto katalog buket paket 3, 5, 9, 15 tangkai (360w, 720w)
```

---

## 🔒 Arahan Staging & Protokol Peluncuran Publik (R09)

### Status Staging Saat Ini (Active Protection)
Untuk melindungi merek dan mencegah perayapan mesin pencari terhadap data yang belum diverifikasi:
1. **Robots Meta Tag**: `index.html` saat ini memiliki tag:
   ```html
   <meta name="robots" content="noindex, nofollow" />
   ```
2. **Private Passcode Screen**: Seluruh konten situs terkunci di balik layar verifikasi kata sandi (`siteData.auth.passcode`). Kata sandi bawaan staging adalah:  
   🔑 **`22062024`**

### Protokol Langkah demi Langkah Peluncuran Publik (Public Go-Live)
Ketika pemilik studio telah memverifikasi seluruh parameter pada **Daftar Input Pemilik**:
1. Buka [`site-content.js`](site-content.js):
   - Isi `store.whatsappNumber` dengan nomor WhatsApp resmi.
   - Isi `store.shopeeUrl` jika toko Shopee sudah live (atau biarkan kosong jika belum).
   - Ubah konfigurasi autentikasi menjadi nonaktif:
     ```javascript
     auth: {
       enabled: false,
       passcode: ""
     }
     ```
2. Buka [`index.html`](index.html):
   - Ubah tag robots staging menjadi izin pengindeksan publik:
     ```html
     <meta name="robots" content="index, follow" />
     ```
3. Jalankan rangkaian tes verifikasi:
   ```bash
   node tests/verify-ordering.js
   ```
4. Lakukan commit dan deploy ke platform hosting Anda.

---

## 🧪 Menjalankan Verifikasi & Server Lokal

### 1. Menjalankan Tes Integrasi Otomatis (R11)
Tes ini memvalidasi 10 skenario kritis langsung terhadap kode `app.js` dan `site-content.js`:
```bash
node tests/verify-ordering.js
```
*Hasil yang diharapkan: 10 suite lulus (✔ ALL 10 INTEGRATION TEST SUITES PASSED SUCCESSFULLY).*

### 2. Menjalankan Server Pratinjau Lokal
Karena situs tidak menggunakan dependensi eksternal, Anda dapat menggunakan server HTTP bawaan:
```bash
# Menggunakan Python 3
python -m http.server 8080

# Atau menggunakan Node.js (jika npx terpasang)
npx serve -l 8080 .
```
Buka browser pada `http://localhost:8080` dan masukkan sandi `22062024` untuk membuka pratinjau.

---

<div align="center">
  <sub>© 2026 Komorebi Creations · Handcrafted Botanical Bouquets</sub>
</div>
