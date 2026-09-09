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
| **6** | **Komposisi Spesifik Formula Buket** | Campuran bunga pilihan studio (*studio mix*) | ⏳ Draf Placeholder (Menunggu Konfirmasi Pemilik) | Deskripsi paket buket saat ini menggunakan draf racikan artistik studio (*harmonious studio mix*). Seluruh rincian menunggu konfirmasi akhir pemilik sebelum peluncuran resmi. |
| **7** | **Domain Resmi & URL Kanonikal** | `"https://komorebicreations.com/"` | ⏳ Menunggu Konfirmasi Domain | Digunakan pada tag canonical dan Open Graph di `index.html`. Bila domain final berbeda, sesuaikan di `index.html`, `sitemap.xml`, dan `CNAME`. |
| **8** | **Tirai Pratinjau Staging** (`auth.enabled`) | `true` (Sandi dikonfigurasi di `site-content.js`) | 🔒 Tirai Pratinjau Aktif | Tirai pratinjau sisi klien untuk mencegah perayapan dan peninjauan draf sebelum pemilik siap. Sandi diatur langsung oleh pemilik di `site-content.js`. Ubah ke `false` saat peluncuran publik. |

---

## 🌿 Tentang Komorebi Creations

**Komorebi Creations** adalah studio kerajinan botani independen yang merangkai bunga abadi berbahan kawat bulu chenille lembut di atas inti kawat lentur berpuntir. Setiap tangkai dibentuk dengan tangan, dirangkai kokoh, dan dikemas rapi siap pajang langsung dari studio kami untuk pengiriman ke seluruh nusantara.

### 🌸 Koleksi Botani & Struktur Harga (Draf Placeholder Toko)

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
- **Aksesibilitas & Ergonomi (WCAG 2.5.5 - R05, R07, A3, B2)**:
  - Seluruh tombol aksi interaktif (`.btn-order-stem`, `.btn-add-bouquet`, `.btn-choose-bouquet`, `.btn-pkg-continue`, `.btn-channel`, `.btn-stepper`, `.chip-wrap`) memiliki ukuran touch target minimal **44px × 44px**.
  - Tipografi seluruh badge dan teks penjelas diangkat menjadi minimal **11.5px–12px** (seluruh `font-size: 10px` telah dieliminasi).
  - WAI-ARIA Radio Group pattern pada pilihan pembungkus (`#wrap-chips`) dengan navigasi tombol panah (Arrow Left/Right/Up/Down) dan roving tabindex (`tabindex="0"` pada item aktif, `-1` pada lainnya).
  - Dialog inspektor foto (`<dialog id="image-modal">`) mengembalikan fokus keyboard secara mulus ke elemen pemicu (`modalReturnElement`) saat ditutup.
  - Sticky mobile order bar memiliki IntersectionObserver yang otomatis menyembunyikan bar saat hero banner atau ringkasan pesanan terlihat, mencegah tumpang tindih visual.
- **Kejujuran Saluran Marketplace (R01, A1)**:
  - Bendera konfigurasi `store.channels.showShopee` dan `store.channels.showWhatsapp` dihormati secara ketat via fungsi kesiapan terpusat `isWhatsAppReady()` dan `isShopeeReady()`.
  - Jika URL toko Shopee belum dikonfirmasi, sistem tidak mengarahkan pengunjung ke tautan generik, melainkan menampilkan status *"Segera hadir"* yang dinonaktifkan dengan jujur serta menjelaskan bahwa buket custom dan kartu ucapan dilayani via WhatsApp studio.

---

## 📁 Struktur Direktori Repositori

```text
komorebi-creations-1/
├── index.html            # Markup semantik utama, filter navigasi kategori, meta tag SEO/OpenGraph, JSON-LD, dialog modal & lock screen
├── styles.css            # Stylesheet botani lengkap (design tokens, layout responsif, hirarki mobile, WCAG 44px touch targets)
├── site-content.js       # Pusat konfigurasi data tunggal (katalog botani, teks bilingual ID/EN, link toko, aturan toko dinamis)
├── app.js                # Pengendali aplikasi interaktif (state machine, customizer engine, metadata switcher, a11y)
├── tests/
│   └── verify-ordering.js # 15 rangkaian tes integrasi otomatis yang mengeksekusi langsung app.js & site-content.js
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

## 🔒 Arahan Staging & Protokol Peluncuran Publik (R09, C2)

### Status Staging Saat Ini (Active Protection)
Untuk melindungi merek dan mencegah perayapan mesin pencari terhadap data yang belum dikonfirmasi pemilik:
1. **Robots Meta Tag**: `index.html` saat ini memiliki tag:
   ```html
   <meta name="robots" content="noindex, nofollow" />
   ```
2. **Staging Preview Curtain (Client-side Overlay)**: Seluruh konten situs berada di balik tirai pratinjau interaktif (`siteData.auth.passcode`) untuk mencegah paparan draf ke publik. *Pemberitahuan: ini merupakan tirai pratinjau sisi klien untuk kemudahan peninjauan pemilik toko sebelum publikasi, bukan kontrol akses kriptografis server-side.* Sandi pratinjau dikonfigurasi secara privat di [`site-content.js`](site-content.js) pada properti `auth.passcode`.

### 🚀 Checklist Peluncuran Publik (Go-Live Checklist)
Ketika pemilik studio siap mempublikasikan toko secara resmi:
- [ ] **WhatsApp Studio**: Perbarui nomor WhatsApp aktif di `site-content.js` (`store.whatsappNumber`).
- [ ] **Shopee Official Store**: Masukkan URL toko Shopee resmi di `site-content.js` (`store.shopeeUrl`) saat toko live, atau biarkan kosong agar tombol tetap berstatus aman *"Segera hadir"*.
- [ ] **Instagram**: Perbarui URL Instagram resmi studio di `site-content.js` (`store.instagramUrl`).
- [ ] **Lokasi & Kurir**: Perbarui informasi kota asal pengiriman dan opsi ekspedisi di FAQ (`translations.id.faqs` dan `translations.en.faqs`).
- [ ] **Formula & Harga Paket**: Konfirmasi harga dan komposisi buket (3, 5, 9, 15 tangkai) di `site-content.js`.
- [ ] **Robots Indexing**: Di [`index.html`](index.html), ubah tag robots dari `noindex, nofollow` menjadi `index, follow`:
  ```html
  <meta name="robots" content="index, follow" />
  ```
- [ ] **Nonaktifkan Tirai Pratinjau**: Di [`site-content.js`](site-content.js), set `auth.enabled` ke `false`:
  ```javascript
  auth: {
    enabled: false,
    passcode: ""
  }
  ```
- [ ] **Domain & DNS**: Pastikan `CNAME` dan `sitemap.xml` sesuai dengan domain produksi yang terhubung di penyedia DNS.
- [ ] **Verifikasi Akhir**: Jalankan tes integrasi otomatis:
  ```bash
  node tests/verify-ordering.js
  ```

---

## 🧪 Menjalankan Verifikasi & Server Lokal

### 1. Menjalankan Tes Integrasi Otomatis (R11)
Tes ini memvalidasi 18 skenario kritis langsung terhadap kode `app.js` dan `site-content.js`:
```bash
node tests/verify-ordering.js
```
*Hasil yang diharapkan: 18 suite lulus (✔ ALL 18 INTEGRATION TEST SUITES PASSED SUCCESSFULLY).*

### 2. Menjalankan Server Pratinjau Lokal
Karena situs tidak menggunakan dependensi eksternal, Anda dapat menggunakan server HTTP bawaan:
```bash
# Menggunakan Python 3
python -m http.server 8080

# Atau menggunakan Node.js (jika npx terpasang)
npx serve -l 8080 .
```
Buka browser pada `http://localhost:8080` dan masukkan sandi staging yang tercantum di `site-content.js` untuk membuka pratinjau.

---

<div align="center">
  <sub>© 2026 Komorebi Creations · Handcrafted Botanical Bouquets</sub>
</div>
