# 📝 Panduan Edit Konten — Komorebi Creations

Satu file ini merangkum **semua** yang bisa Anda ubah sendiri di website: teks,
harga, foto, dan tautan. Semua isi website disimpan di **satu file**:
[`site-content.js`](site-content.js). Panduan ini menunjukkan persis bagian
mana yang harus dibuka untuk mengubah apa.

> Anda tidak perlu paham coding. Anda hanya perlu menemukan baris yang tepat,
> mengganti teks di antara tanda kutip `"..."`, lalu menyimpan file.

---

## Aturan emas sebelum mulai

1. **Jangan hapus tanda kutip (`"`) atau koma (`,`).** Setiap baris teks
   diapit tanda kutip dan diakhiri koma — kalau salah satu hilang, seluruh
   website bisa berhenti berfungsi.
2. **Jangan hapus kurung kurawal `{ }` atau kurung siku `[ ]`.** Itu "bingkai"
   yang menyatukan data. Ubah teks di *dalamnya*, jangan hapus bingkainya.
3. **Ada dua bagian bahasa: `id:` dan `en:`.** Situs ini bilingual (Indonesia
   & Inggris). Kalau Anda ubah teks Indonesia, cari juga baris yang sama di
   bagian `en:` bila ingin versi Inggrisnya ikut berubah — keduanya berdiri
   sendiri-sendiri.
4. **Simpan sebagai teks biasa (plain text), bukan dari Word/Google Docs.**
   Kalau menyunting lewat GitHub langsung di browser, ini otomatis aman.
5. **Selalu cek dulu sebelum publish.** Lihat bagian [Setelah Mengedit](#setelah-mengedit-cara-mengecek)
   di akhir panduan ini.
6. Ragu-ragu atau file terlihat rusak? Salin dulu isi file sebelum diubah
   (paste ke Notepad, misalnya) supaya mudah dikembalikan.

---

## Peta cepat: apa ada di mana

| Bagian di Website | Buka file | Cari properti |
| :--- | :--- | :--- |
| Nama toko, logo, tagline | `site-content.js` | `store.brandName`, `store.tagline`, `store.logo` |
| Judul & kalimat pembuka (Hero) | `site-content.js` | `translations.id.heroTitle`, `heroSub` |
| Bunga satuan (nama, harga, deskripsi, foto) | `site-content.js` | `flowers.{Sunflower / Rose / Tulip / Gerbera}` |
| Paket buket (harga, isi tangkai, foto) | `site-content.js` | `packages` (array 4 paket) |
| Ongkos bungkus, minimal tangkai, diskon | `site-content.js` | `wrapFee`, `minStems`, `bulkFrom`, `bulkRate` |
| Pilihan warna kertas bungkus | `site-content.js` | `wraps` |
| Teks & foto 4 langkah "Cara Dibuat" | `site-content.js` | `translations.id.steps`, `stepPhotos` |
| Teks bagian "Bahannya" | `site-content.js` | `translations.id.matTitle`, `matBody` |
| Pertanyaan & jawaban FAQ | `site-content.js` | `translations.id.faqs` |
| Nomor WhatsApp, Shopee, Instagram | `site-content.js` | `store.whatsappNumber`, `store.shopeeUrl`, `store.instagramUrl` |
| Sandi halaman pratinjau | `site-content.js` | `auth.passcode` |
| Foto produk baru (file gambar) | folder `img/` | lihat [Mengganti / Menambah Foto](#mengganti--menambah-foto) |

---

## 1. Merek & Header

```js
store: {
  brandName: "Komorebi",
  tagline: "est. 2026",
  logo: "komorebi-logo-96.webp",
  logo2x: "komorebi-logo-192.webp",
  ...
```
Ganti `brandName` dan `tagline` untuk mengubah nama/tulisan di sebelah logo.
Untuk mengganti logo, lihat [Mengganti / Menambah Foto](#mengganti--menambah-foto).

## 2. Halaman Depan (Hero)

Cari di `translations.id` (dan `translations.en` untuk versi Inggris):
```js
heroEyebrow: "Bunga jadi & buket · benang chenille",
heroTitle: "Bunga yang tak pernah layu — kami rangkai untuk Anda.",
heroSub: "Setiap tangkai kami bentuk dan rangkai sendiri, lalu dikemas siap dipajang. ...",
```
Foto besar di halaman depan diatur di `images.hero` (lihat bagian foto).

## 3. Koleksi Bunga Tangkai Satuan

Setiap bunga (Bunga Matahari, Mawar, Tulip, Gerbera) punya blok sendiri di
dalam `flowers: { ... }`. Contoh Bunga Matahari:

```js
Sunflower: {
  latin: "Helianthus annuus",     // nama latin, tampil di bawah nama bunga
  photo: "img/sunflower-720.webp",// foto utama bunga ini
  stemPrice: 55000,               // HARGA per tangkai (angka saja, tanpa titik)
  photoStemCount: 3,              // jumlah tangkai di foto (dipakai di kalimat "Foto menampilkan N tangkai")
  id: {
    name: "Bunga Matahari",       // nama yang tampil
    size: "tangkai 45 cm",
    detail: "kepala 12 cm",
    blurb: "Bunga andalan kami. Kelopak oker berlapis dengan mahkota berbiji rapat.",
    singleNote: "Harga per 1 tangkai jadi · Foto menampilkan 3 tangkai yang ditata bersama"
  },
  en: { ... teks versi Inggris, pola sama ... }
}
```

- **Ganti harga**: ubah angka di `stemPrice`. Contoh: `stemPrice: 65000,`
  untuk Rp 65.000.
- **Ganti deskripsi**: ubah teks di `blurb`.
- **Ganti ukuran/spesifikasi**: ubah `size` dan `detail`.
- **Ganti foto**: ubah `photo` (lihat [Mengganti / Menambah Foto](#mengganti--menambah-foto))
  dan sesuaikan `photoStemCount` bila jumlah tangkai di foto baru berbeda.
- Urutan bunga yang tampil di halaman diatur oleh `flowerOrder` (daftar di
  atas `flowers`).

## 4. Paket Buket

Ada di `packages: [ ... ]` — empat paket berurutan (3, 5, 9, 15 tangkai):

```js
{
  stems: 3,
  price: 195000,
  photo: "img/bouquet-3.png",
  photoWebp: "img/bouquet-3-720.webp",
  ...
}
```
- **Ganti harga paket**: ubah angka di `price`.
- **Ganti foto paket**: ubah `photoWebp` (lihat [Mengganti / Menambah Foto](#mengganti--menambah-foto)).
- Nama paket ("Buket Mini", "Buket Sedang", dst.) dan deskripsinya ada
  terpisah di `translations.id.pkgNames` dan `translations.id.pkgBlurbs` —
  urutannya harus sama dengan urutan paket di `packages` (mini → sedang →
  besar → istimewa).

## 5. Buket Custom & Aturan Harga

```js
wrapFee: 35000,     // biaya bungkus & pita, dikenakan sekali per keranjang
bulkFrom: 9,         // mulai berapa tangkai diskon berlaku
bulkRate: 0.10,      // besaran diskon (0.10 = 10%)
minStems: 3,         // minimal tangkai untuk buket custom
```
Ubah angka-angka ini untuk mengubah aturan harga buket custom di seluruh
situs (harga akan otomatis terhitung ulang, tidak perlu ubah tempat lain).

Pilihan warna kertas bungkus ada di `wraps` — setiap warna punya `key` (nama
internal, jangan diubah) dan `swatch` (kode warna, boleh diganti untuk warna
kertas baru). Nama warna yang tampil ke pembeli ada di
`translations.id.wrapNames` (urutannya harus sama dengan `wraps`).

## 6. Cara Dibuat (4 Langkah + Foto)

Teks 4 langkah ada di `translations.id.steps` (dan `.en.steps`):
```js
steps: [
  ["01 — Potong", "Kelopak dipotong sesuai pola", "Setiap bunga punya polanya sendiri..."],
  ["02 — Bentuk", "Setiap kelopak dilengkungkan tangan", "..."],
  ["03 — Rangkai", "Dipasang ke tangkai", "..."],
  ["04 — Bungkus & kirim", "Dikemas seperti saat meninggalkan kami", "..."]
],
```
Setiap baris berisi 3 bagian: **[label langkah, judul singkat, deskripsi]**.

Foto untuk keempat kartu ini ada terpisah di `stepPhotos` (dekat bagian atas
file, sebelum `wrapFee`), urutannya harus sama dengan `steps` di atas:
```js
stepPhotos: [
  { src: "img/step-1-potong-480.webp", srcset: "..." },  // untuk langkah 01
  { src: "img/step-2-bentuk-480.webp", srcset: "..." },  // untuk langkah 02
  { src: "img/step-3-rangkai-480.webp", srcset: "..." }, // untuk langkah 03
  { src: "img/step-4-bungkus-480.webp", srcset: "..." }  // untuk langkah 04
],
```
Kalau salah satu langkah belum ada fotonya, cukup hapus barisnya (atau ganti
`src` jadi `""`) — kartu itu otomatis menampilkan ikon placeholder, bukan
foto rusak.

## 7. Bahannya (Material Section)

```js
matEyebrow: "Bahannya",
matTitle: "Mengapa chenille bergerak seperti kelopak",
matBody: "Serat chenille yang lembut di atas inti kawat berpuntir: ...",
```
Foto close-up di bagian ini diatur di `images.macro`.

## 8. FAQ

```js
faqs: [
  ["Dikirim dari mana?", "Semuanya dibuat dan dikirim dari Indonesia, ..."],
  ["Berapa lama sebelum dikirim?", "Tangkai satuan dan buket kecil ..."],
  ...
],
```
Setiap baris adalah **[pertanyaan, jawaban]**. Tambah baris baru dengan pola
yang sama untuk menambah FAQ, atau hapus baris untuk menghapus satu FAQ
(pastikan tanda koma antar baris tetap rapi).

## 9. Kit DIY (Coming Soon)

```js
kitSoonTitle: "Kit DIY-nya masih kami siapkan",
kitSoonBody: "Kami sedang menggambar panduannya dan menguji kemasannya, ...",
```
Ubah teks ini kapan pun status kit DIY berubah (masih disiapkan / segera
rilis / sudah bisa dipesan — untuk mengaktifkan tombol pemesanan kit,
hubungi developer karena perlu perubahan alur, bukan sekadar teks).

## 10. Kontak & Tautan Toko

```js
store: {
  instagramUrl: "https://instagram.com/komorebi",
  shopeeUrl: "",                    // kosongkan dulu sampai toko Shopee resmi dibuka
  email: "",
  address: "",
  whatsappNumber: "6281234567890",  // kode negara 62, tanpa + atau spasi
  channels: {
    showShopee: true,               // false = sembunyikan tombol Shopee sepenuhnya
    showWhatsapp: true
  }
}
```
- Isi `shopeeUrl` begitu toko Shopee resmi sudah aktif — tombol otomatis
  berubah dari "Segera hadir" menjadi tautan aktif.
- `whatsappNumber` dipakai di semua tombol pesan via WhatsApp di seluruh
  situs — cukup ubah di satu tempat ini.

## 11. Sandi Halaman Pratinjau

```js
auth: {
  enabled: true,        // true = situs masih terkunci sandi, false = publik
  passcode: "22062024"  // sandi untuk membuka pratinjau
}
```
Ubah `passcode` kapan saja. Saat website siap dipublikasikan ke umum, ubah
`enabled` menjadi `false` (lihat checklist peluncuran di `README.md`).

---

## Mengganti / Menambah Foto

1. **Siapkan foto** dalam format `.webp` (ukuran file lebih kecil, kualitas
   tetap bagus). Kalau foto Anda masih `.jpg`/`.png`, boleh tetap dipakai,
   tapi ukuran file website akan lebih besar.
2. **Simpan foto ke folder `img/`** dengan nama yang jelas, misalnya
   `img/sunflower-baru.webp`.
3. **Arahkan properti terkait ke nama file baru itu**, contoh untuk foto
   bunga: ganti `photo: "img/sunflower-720.webp"` menjadi
   `photo: "img/sunflower-baru.webp"`.
4. Beberapa foto (hero, foto bunga, foto paket, foto langkah "Cara Dibuat")
   punya `srcset` — daftar beberapa ukuran foto yang sama supaya ponsel
   memuat foto kecil dan layar besar memuat foto besar. Kalau Anda hanya
   punya satu ukuran foto, boleh hapus baris `srcset`-nya saja dan biarkan
   `src`/`photo`/`photoWebp` menunjuk ke satu file itu — situs tetap
   berjalan, hanya sedikit kurang optimal di koneksi lambat.
5. Setelah ganti foto, buka halaman di browser dan cek foto tampil dengan
   benar sebelum publish.

---

## Mengedit Teks Kecil Lainnya (tombol, label, dll.)

Selain bagian-bagian besar di atas, ada banyak teks kecil (label tombol,
pesan kosong, notifikasi) tersebar di `translations.id` dan
`translations.en`. Polanya selalu sama:

```js
namaProperti: "Teks yang tampil di website",
```

Cara mencarinya paling mudah: **buka website, salin (copy) potongan teks
yang ingin diubah, lalu cari (Ctrl+F / Cmd+F) teks itu di `site-content.js`**.
Anda akan langsung sampai ke baris yang tepat. Ganti teks di antara tanda
kutip, simpan, selesai.

---

## Setelah Mengedit: Cara Mengecek

Sebelum meminta developer mem-publish perubahan, pastikan situs masih
berjalan normal:

```bash
node tests/verify-ordering.js
```
Harus muncul `✔ ALL 23 INTEGRATION TEST SUITES PASSED SUCCESSFULLY`. Kalau
muncul error, biasanya ada tanda kutip atau koma yang hilang — cek kembali
baris yang baru Anda ubah.

Untuk melihat tampilannya langsung di browser:
```bash
python -m http.server 8080
```
lalu buka `http://localhost:8080` dan masukkan sandi pratinjau.

Lihat juga `README.md` bagian **"DAFTAR INPUT PEMILIK TOKO"** untuk daftar
parameter operasional yang masih berstatus placeholder dan perlu diisi
sebelum situs go-live.
