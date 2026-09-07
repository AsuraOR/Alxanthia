# 🌸 Komorebi Creations — Website & Editor Guide (Panduan Pengguna)

Selamat datang di website **Komorebi Creations (DIY Flower Kit)**!
Website ini dibuat persis **1:1** dengan desain botani orisinal, dan dirancang khusus agar **sangat mudah diedit oleh non-developer** (tanpa perlu paham koding).

---

## 🚀 Cara Menjalankan Website

Cukup **klik dua kali** file `index.html` di komputer Anda, atau buka dengan browser apa saja (Google Chrome, Microsoft Edge, Safari, Mozilla Firefox). 
Tidak butuh install Node.js, bun, server, atau software apapun!

---

## ✏️ Cara 1: Mengedit Langsung di Browser (Paling Praktis / Tanpa Koding)

Website ini dilengkapi dengan **Fitur Mode Edit Visual**:

1. Buka `index.html` di browser Anda.
2. Di pojok kanan bawah, klik tombol **"⚙️ Mode Edit / Editor"** (atau tekan tombol keyboard `Ctrl + Shift + E`).
3. Bar alat editor akan muncul di bagian bawah:
   - **Mengedit Teks**: Klik langsung teks mana saja di halaman web (judul, paragraf, langkah, dll), lalu ketik teks baru Anda seperti di Microsoft Word.
   - **Mengedit Gambar**: Klik gambar mana saja (Hero, Isi Kit, Material, Foto Kami) untuk mengubah nama file atau link gambarnya.
   - **Mengedit Link & Harga**: Klik tombol **"⚙️ Pengaturan Link & Harga"** di bar bawah untuk membuka panel:
     - Mengganti nomor WhatsApp (misal: `6281234567890`) & pesan otomatisnya.
     - Mengganti link toko Tokopedia, Shopee, atau Instagram.
     - Mengganti harga Bunga Matahari, Mawar, Tulip, Lavender (Kit, Tangkai Jadi, Buket).
     - Menyalakan/mematikan tombol Tokopedia, Shopee, atau WhatsApp.
4. Klik **"💾 Simpan di Browser"** untuk menyimpan perubahan di browser Anda.
5. Klik **"⬇️ Unduh site-content.js"**:
   - Browser akan mengunduh file bernama `site-content.js`.
   - Pindahkan/timpa file `site-content.js` hasil unduhan tersebut ke dalam folder website ini.
   - **Selesai!** Perubahan Anda kini permanen dan akan terlihat oleh semua pengunjung website!

---

## 📝 Cara 2: Mengedit Lewat File `site-content.js`

Jika Anda lebih suka mengedit lewat teks:
1. Buka file `site-content.js` dengan **Notepad**, **VS Code**, atau editor teks biasa.
2. Semua kata-kata dalam Bahasa Indonesia dan Bahasa Inggris, daftar harga, dan tautan sosial media tertata rapi di dalamnya.
3. Edit kata-kata di antara tanda petik `"..."`.
4. Simpan file (`Ctrl + S`), lalu refresh halaman `index.html` di browser Anda.

---

## 🌐 Cara Mempublikasikan Website ke Internet

Website ini adalah **Static Web App murni**, sehingga bisa di-hosting secara **GRATIS** dan cepat di:
- **Netlify**: Cukup drag-and-drop folder ini ke [app.netlify.com/drop](https://app.netlify.com/drop).
- **Vercel**: Hubungkan repository atau deploy via Vercel CLI.
- **GitHub Pages**: Aktifkan GitHub Pages pada repository di tab Settings -> Pages -> Deploy from branch `main`.
- **cPanel / Hosting Biasa**: Upload semua file di folder ini ke folder `public_html`.

---

## 📂 Struktur Folder
```
komorebi-creations/
├── index.html            <- Halaman utama website
├── styles.css            <- Desain tampilan & warna botani (1:1)
├── site-content.js       <- Pusat data teks, harga, link & gambar yang bisa diedit
├── app.js                <- Logika interaktif (pilih bunga, format, hitung harga, WhatsApp)
├── editor.js             <- Fitur editor visual in-browser untuk non-developer
├── editor.css            <- Tampilan bar & modal editor
├── komorebi-logo.png     <- Logo Komorebi
└── img/                  <- Foto-foto bunga & produk
    ├── hero.png
    ├── kit.png
    ├── lavender.png
    ├── macro.png
    ├── rose.png
    ├── sunflower.png
    ├── tulip.png
    └── us.png
```
