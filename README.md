# 🌸 Komorebi Creations — Website & Guide

Website resmi **Komorebi Creations (DIY Flower Kit)** dengan desain botani orisinal 1:1, elegan, cepat, dan responsif.

---

## 🚀 Cara Menjalankan Website

Cukup **klik dua kali** file `index.html` di komputer Anda, atau buka dengan browser apa saja (Google Chrome, Microsoft Edge, Safari, Firefox).
Tidak butuh install software, server, atau compiler apapun.

---

## ✏️ Cara Mengedit Teks, Harga, Link & Gambar di VS Code / Text Editor

Semua data website sudah dipisahkan dengan sangat rapi dan ramah dibaca di dalam file:
👉 **`site-content.js`**

Anda cukup buka file `site-content.js` menggunakan **VS Code**, **Notepad**, atau editor teks favorit Anda:

### 1. Mengubah Link & Nomor Kontak:
Cari bagian `store`:
```javascript
store: {
  brandName: "Komorebi",
  instagramUrl: "https://instagram.com/komorebi",
  tokopediaUrl: "https://www.tokopedia.com/...",
  shopeeUrl: "https://shopee.co.id/...",
  whatsappNumber: "6281234567890", // Ganti dengan nomor WhatsApp Anda
  ...
}
```

### 2. Mengubah Daftar Harga:
Cari nama bunganya di bagian `flowers`:
```javascript
Sunflower: {
  prices: {
    Kit: "Rp 95.000",
    Stem: "Rp 55.000",
    Bouquet: "Rp 285.000"
  }
}
```

### 3. Mengubah Semua Teks (Bahasa Indonesia & Bahasa Inggris):
Cari bagian `translations`:
- `id:` untuk semua teks dalam Bahasa Indonesia (Judul, deskripsi, FAQ, panduan langkah, tentang kami).
- `en:` untuk semua teks dalam Bahasa Inggris.

Setelah selesai mengedit, cukup tekan **Ctrl + S** untuk menyimpan file, lalu **refresh browser (`F5`)**. Semua perubahan Anda langsung tampil!

---

## 📦 File yang Perlu Di-upload ke GitHub

```text
komorebi-creations/
├── index.html            ✅ Halaman utama
├── styles.css            ✅ File stylesheet desain
├── site-content.js       ✅ File data teks, link, harga, & gambar
├── app.js                ✅ Logika website & WhatsApp
├── CNAME                 ✅ Domain: komorebicreations.com
├── komorebi-logo.png     ✅ Logo brand
├── README.md             ✅ Dokumentasi
└── img/                  ✅ Folder foto produk
    ├── hero.png
    ├── kit.png
    ├── lavender.png
    ├── macro.png
    ├── rose.png
    ├── sunflower.png
    ├── tulip.png
    └── us.png
```
