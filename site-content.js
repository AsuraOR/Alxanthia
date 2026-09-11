/**
 * =============================================================================
 * ALXANTHIA WEBSITE CONTENT CONFIGURATION (site-content.js)
 * =============================================================================
 * 
 * PETUNJUK UNTUK NON-DEVELOPER (INDONESIA):
 * Anda bisa mengubah teks, harga, tautan WhatsApp, Shopee, dan gambar di sini!
 * Pastikan tanda kutip ("...") dan koma (,) tetap ada dan tidak terhapus.
 * 
 * INSTRUCTIONS FOR NON-DEVELOPERS (ENGLISH):
 * You can edit all texts, prices, links, WhatsApp number, and images here.
 * Make sure quotes ("...") and commas (,) remain intact.
 * =============================================================================
 */

window.ALXANTHIA_DATA = {
  // Private Access Passcode Protection
  auth: {
    enabled: true,
    passcode: "22062024" // You can change this passcode anytime
  },

  // Store & Contact Links
  store: {
    brandName: "Alxanthia",
    tagline: "est. 2026",
    logo: "alxanthia-logo-96.webp",
    logo2x: "alxanthia-logo-192.webp",
    instagramUrl: "https://instagram.com/alxanthia",
    // Shopee store URL: left empty until confirmed by store owner (see README.md Owner-Input List)
    shopeeUrl: "",
    // Contact email: left empty until confirmed by store owner. The footer row only
    // renders once this is filled in.
    email: "",
    // Business address: left empty until confirmed by store owner. The footer row only
    // renders once this is filled in.
    address: "Bali, Indonesia",
    // WhatsApp phone number with country code (e.g. 6281234567890 for Indonesia)
    whatsappNumber: "628972000622",
    // Public HTTPS endpoint that stores an order and returns JSON. Keep API keys
    // server-side; see CHECKOUT-SETUP.md. Leave blank until it is deployed.
    orderSubmissionUrl: "https://alxanthia-order-endpoint.ketut-ketut92.workers.dev",
    // OWNER-05: Cloudflare Turnstile PUBLIC site key (safe to publish here — it is
    // not a secret). Leave blank until you create a Turnstile widget for
    // alxanthia.com; the checkout form simply skips the verification step while
    // this is empty. See CONFIGURE-SUBMISSION-ENDPOINT.md Part 3a.
    turnstileSiteKey: "",
    whatsappTemplates: {
      id: {
        stem: "Halo Alxanthia! Saya ingin memesan {items} — Total {total} (belum termasuk ongkir). {wrapInfo}{cardInfo}Apakah masih tersedia?",
        package: "Halo Alxanthia! Saya ingin memesan {items} — {total} (belum termasuk ongkir). {wrapInfo}{cardInfo}Apakah masih tersedia?",
        custom: "Halo Alxanthia! Saya ingin memesan Buket Custom ({stems} tangkai, estimasi {total}, belum termasuk ongkir):\n{itemList}\n{wrapInfo}{cardInfo}Apakah bisa dibuatkan?"
      },
      en: {
        stem: "Hello Alxanthia! I would like to order {items} — Total {total} (excludes delivery fee). {wrapInfo}{cardInfo}Is it available?",
        package: "Hello Alxanthia! I would like to order {items} — {total} (excludes delivery fee). {wrapInfo}{cardInfo}Is it available?",
        custom: "Hello Alxanthia! I would like to order a Custom Bouquet ({stems} stems, estimated {total}, excludes delivery fee):\n{itemList}\n{wrapInfo}{cardInfo}Can this be arranged?"
      }
    },
    whatsappWaitlistId: "Halo Alxanthia! Saya tertarik dengan kit DIY-nya — tolong kabari saya saat diluncurkan.",
    whatsappWaitlistEn: "Hello Alxanthia! I'm interested in the DIY kit — please let me know when it launches.",
    // Marketplace & Channel visibility toggles
    channels: {
      showShopee: true,
      showWhatsapp: true
    },
    showPrices: true,
    showKitTeaser: true
  },

  // General Images used on the landing page (WebP derivatives)
  images: {
    hero: "img/hero-800.webp",
    heroSrcset: "img/hero-400.webp 400w, img/hero-800.webp 800w, img/hero-1122.webp 1122w",
    heroSizes: "(max-width: 768px) 90vw, 496px",
    macro: "img/macro-960.webp",
    macroSrcset: "img/macro-480.webp 480w, img/macro-960.webp 960w, img/macro-1254.webp 1254w",
    macroSizes: "(max-width: 768px) 90vw, 540px"
  },

  // "How It's Made" step photos, in step order (01 Potong / 02 Bentuk / 03 Rangkai / 04 Bungkus & kirim)
  stepPhotos: [
    { src: "img/step-1-potong-480.webp", srcset: "img/step-1-potong-480.webp 480w, img/step-1-potong-800.webp 800w" },
    { src: "img/step-2-bentuk-480.webp", srcset: "img/step-2-bentuk-480.webp 480w, img/step-2-bentuk-800.webp 800w" },
    { src: "img/step-3-rangkai-480.webp", srcset: "img/step-3-rangkai-480.webp 480w, img/step-3-rangkai-800.webp 800w" },
    { src: "img/step-4-bungkus-480.webp", srcset: "img/step-4-bungkus-480.webp 480w, img/step-4-bungkus-800.webp 800w" }
  ],

  // Pricing & Builder Rules (editable without modifying app.js)
  // Bungkus & pita (wrap & ribbon fee) scales with the flower count: every
  // wrapFeeUnitStems stems in a bouquet adds one more wrapFeePerUnit charge.
  wrapFeeUnitStems: 3,
  wrapFeePerUnit: 35000,
  // Price for adding a handwritten message card to the order (checkbox in the finishing section).
  messageCardPrice: 5000,
  minStems: 3,

  // Bumps whenever prices/catalogue change here or in the server-side Apps Script
  // catalogue (see CONFIGURE-SUBMISSION-ENDPOINT.md). Sent with every order so a
  // browser tab left open across a price change can be diagnosed later.
  catalogVersion: 1,

  // OWNER DECISION (OWNER-01): minimum number of calendar days from today that the
  // checkout date picker and the server will accept. Pick the number you can honour
  // in a busy week, not the fastest order you have ever produced. Update the matching
  // MINIMUM_LEAD_DAYS constant in the Apps Script from CONFIGURE-SUBMISSION-ENDPOINT.md
  // whenever you change this number, and redeploy the script.
  minimumLeadDays: 2,

  // OWNER DECISION (OWNER-02): how long completed-order rows (containing names, phone
  // numbers, and addresses) are kept, shown in the checkout privacy notice. Edit the
  // "id"/"en" text below directly if you want different wording.
  dataRetentionNotice: {
    id: "12 bulan setelah pesanan selesai",
    en: "12 months after the order is completed"
  },

  // Bali kabupaten/kota list for the checkout delivery-location dropdown
  baliRegencies: ["Denpasar", "Badung", "Gianyar", "Tabanan", "Klungkung", "Bangli", "Karangasem", "Buleleng", "Jembrana"],

  // Wrapping Paper Options
  wraps: [
    { key: "kraft", swatch: "#B79A6E" },
    { key: "cream", swatch: "#F0E7D6" },
    { key: "sage", swatch: "#7E8F7C" },
    { key: "blush", swatch: "#C9A4A8" }
  ],

  // Mini Pot Catalog (placeholder prices — easy to update later)
  miniPots: [
    { key: "sunflower", price: 125000, heightCm: 14, photo: "img/mini-pot-sunflower.webp", accent: "#C89A3C", en: { name: "Sunflower Mini Pot", blurb: "A sunny chenille bloom in a hand-coiled miniature pot." }, id: { name: "Mini Pot Bunga Matahari", blurb: "Bunga matahari cerah dalam pot mini yang seluruhnya dibuat dari chenille." } },
    { key: "lily-of-the-valley", price: 125000, heightCm: 11, photo: "img/mini-pot-lily-of-the-valley.webp", accent: "#78906A", en: { name: "Lily of the Valley Mini Pot", blurb: "Delicate white bells gathered in a soft chenille pot." }, id: { name: "Mini Pot Lily of the Valley", blurb: "Lonceng putih mungil yang dirangkai lembut di dalam pot chenille." } },
    { key: "daisy", price: 125000, heightCm: 13, photo: "img/mini-pot-daisy.webp", accent: "#D7A932", en: { name: "Daisy Mini Pot", blurb: "A cheerful white daisy with a golden centre, made to brighten small spaces." }, id: { name: "Mini Pot Daisy", blurb: "Daisy putih dengan pusat keemasan untuk memberi warna di sudut kecil." } }
  ],

  // Optional custom-bouquet additions (placeholder prices)
  customAdditions: [
    { key: "rounded", price: 12000, photo: "img/addition-rounded-leaves.webp", en: { name: "Rounded Leaves" }, id: { name: "Daun Bulat" } },
    { key: "fern", price: 12000, photo: "img/addition-fern-leaves.webp", en: { name: "Fern Leaves" }, id: { name: "Daun Pakis" } }
  ],

  // Bouquet Packages
  packages: [
    {
      stems: 3,
      price: 195000,
      photo: "img/bouquet-3.png",
      photoWebp: "img/bouquet-3-720.webp",
      srcset: "img/bouquet-3-360.webp 360w, img/bouquet-3-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px"
    },
    {
      stems: 5,
      price: 295000,
      photo: "img/bouquet-5.png",
      photoWebp: "img/bouquet-5-720.webp",
      srcset: "img/bouquet-5-360.webp 360w, img/bouquet-5-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px"
    },
    {
      stems: 9,
      price: 465000,
      photo: "img/bouquet-9.png",
      photoWebp: "img/bouquet-9-720.webp",
      srcset: "img/bouquet-9-360.webp 360w, img/bouquet-9-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px"
    },
    {
      stems: 15,
      price: 745000,
      photo: "img/bouquet-15.png",
      photoWebp: "img/bouquet-15-720.webp",
      srcset: "img/bouquet-15-360.webp 360w, img/bouquet-15-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px"
    }
  ],

  // Flower Catalog & Specific Settings
  flowerOrder: ["Sunflower", "Rose", "Tulip", "Gerbera"],

  flowers: {
    Sunflower: {
      key: "Sunflower",
      slug: "sunflower",
      latin: "Helianthus annuus",
      accent: "#C89A3C",
      photo: "img/sunflower-720.webp",
      srcset: "img/sunflower-360.webp 360w, img/sunflower-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px",
      alt: "Handmade chenille sunflowers with green leaves",
      stemPrice: 55000,
      photoStemCount: 3,
      en: {
        name: "Sunflower",
        size: "45 cm stem",
        detail: "12 cm head",
        blurb: "Our signature. Layered ochre petals and a dense seeded crown.",
        singleNote: "Price per finished stem"
      },
      id: {
        name: "Bunga Matahari",
        size: "tangkai 45 cm",
        detail: "kepala 12 cm",
        blurb: "Bunga andalan kami. Kelopak oker berlapis dengan mahkota berbiji rapat.",
        singleNote: "Harga per 1 tangkai jadi"
      }
    },
    Rose: {
      key: "Rose",
      slug: "rose",
      latin: "Rosa centifolia",
      accent: "#A8586A",
      photo: "img/rose-720.webp",
      srcset: "img/rose-360.webp 360w, img/rose-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px",
      alt: "Handmade chenille roses in dusty pink",
      stemPrice: 60000,
      photoStemCount: 3,
      en: {
        name: "Rose",
        size: "40 cm stem",
        detail: "spiralled head",
        blurb: "Petals wound one by one into a spiral. The most patient flower we make.",
        singleNote: "Price per finished stem"
      },
      id: {
        name: "Mawar",
        size: "tangkai 40 cm",
        detail: "kepala melingkar",
        blurb: "Kelopak dipasang satu per satu jadi lingkaran. Bunga paling menuntut kesabaran.",
        singleNote: "Harga per 1 tangkai jadi"
      }
    },
    Tulip: {
      key: "Tulip",
      slug: "tulip",
      latin: "Tulipa gesneriana",
      accent: "#C0614E",
      photo: "img/tulip-720.webp",
      srcset: "img/tulip-360.webp 360w, img/tulip-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px",
      alt: "Handmade chenille tulips with slender leaves",
      stemPrice: 50000,
      photoStemCount: 4,
      en: {
        name: "Tulip",
        size: "38 cm stem",
        detail: "6 petals",
        blurb: "Six clean petals and a single leaf. Quiet enough for any room.",
        singleNote: "Price per finished stem"
      },
      id: {
        name: "Tulip",
        size: "tangkai 38 cm",
        detail: "6 kelopak",
        blurb: "Enam kelopak bersih dan satu daun. Tenang untuk ruangan mana pun.",
        singleNote: "Harga per 1 tangkai jadi"
      }
    },
    Gerbera: {
      key: "Gerbera",
      slug: "gerbera",
      latin: "Gerbera jamesonii",
      accent: "#C97A45",
      photo: "img/gerbera-720.webp",
      srcset: "img/gerbera-360.webp 360w, img/gerbera-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px",
      alt: "Three handmade chenille gerbera daisies in coral orange",
      stemPrice: 55000,
      photoStemCount: 3,
      en: {
        name: "Gerbera",
        size: "40 cm stem",
        detail: "coral, two-tone",
        blurb: "Two rings of narrow coral petals around a seeded brown centre.",
        singleNote: "Price per finished stem"
      },
      id: {
        name: "Gerbera",
        size: "tangkai 40 cm",
        detail: "koral, dua nada",
        blurb: "Dua lingkar kelopak koral ramping mengelilingi mahkota cokelat berbiji.",
        singleNote: "Harga per 1 tangkai jadi"
      }
    },
    Lavender: {
      key: "Lavender",
      slug: "lavender",
      latin: "Lavandula angustifolia",
      accent: "#7B6E9B",
      photo: "img/lavender-720.webp",
      srcset: "img/lavender-360.webp 360w, img/lavender-720.webp 720w",
      sizes: "(max-width: 600px) 90vw, (max-width: 1024px) 45vw, 260px",
      alt: "A bundle of handmade chenille lavender spikes",
      stemPrice: 55000,
      en: {
        name: "Lavender",
        size: "32 cm stem",
        detail: "9 spikes",
        blurb: "Nine slender spikes to a bundle. Featured in bouquet arrangements."
      },
      id: {
        name: "Lavender",
        size: "tangkai 32 cm",
        detail: "9 tangkai",
        blurb: "Sembilan tangkai ramping per ikat. Tampil dalam rangkaian buket."
      }
    }
  },

  // Formats definition
  formatKeys: ["Stem", "Package", "Custom"],

  // Bilingual UI Texts
  translations: {
    // BAHASA INDONESIA
    id: {
      navCollection: "Bunga",
      navBouquets: "Buket",
      navHow: "Cara dibuat",
      navFaq: "FAQ",
      navOrder: "Pesan",

      heroEyebrow: "Bunga jadi & buket · benang chenille",
      heroTitle: "Bunga yang tak pernah layu — kami rangkai untuk Anda.",
      heroSub: "Setiap tangkai kami bentuk dan rangkai sendiri, lalu dikemas siap dipajang. Ambil satu tangkai, salah satu paket buket kami, atau susun campuran Anda sendiri.",
      heroPlateCaption: "Helianthus annuus",
      heroPlatePl: "PL. I",
      ctaBrowse: "Lihat bunganya",
      ctaBouquet: "Susun buket",

      ben1t: "Datang sudah jadi",
      ben1d: "Tidak perlu dirangkai — buka dan letakkan.",
      ben2t: "Tanpa air",
      ben2d: "Chenille dan kawat, untuk pajangan dalam ruangan.",
      ben3t: "Dibuat sesuai pesanan",
      ben3d: "Dipotong, dibentuk, dan dibungkus setelah Anda pesan.",

      tr1t: "Dikirim dari Indonesia",
      tr1d: "Ke seluruh Indonesia dalam kemasan boks protektif.",
      tr2t: "Dibuat 2–3 hari kerja",
      tr2d: "Buket 9 tangkai ke atas, 3–4 hari kerja.",
      tr3t: "Dikemas agar utuh",
      tr3d: "Kelopak lentur selalu bisa dirapikan kembali dengan tangan.",
      tr4t: "Pemesanan langsung",
      tr4d: "Detail pesanan & pengiriman dikonfirmasi langsung via WhatsApp studio.",

      colEyebrow: "Koleksi",
      zoomPhotoLabel: "Perbesar foto {name}",
      colTitle: "Cara memesan",
      colIntro: "Pilih tangkai jadi, mini pot, atau buket — versi kami atau versi Anda.",
      catOneLabel: "Kategori 01",
      catOneTitle: "Bunga jadi",
      catOneNote: "Empat bunga, semuanya kami rangkai dan dijual per tangkai.",
      catTwoLabel: "Kategori 02",
      catTwoTitle: "Mini pot",
      catTwoNote: "Tiga bunga mungil dengan pot yang juga dibuat dari kawat bulu chenille.",
      catThreeLabel: "Kategori 03",
      catThreeTitle: "Buket",
      catThreeNote: "Empat paket siap pesan, atau campuran custom yang Anda hitung sendiri.",
      miniPotMaterial: "100% kerajinan chenille",
      miniPotHeight: "Tinggi ~{h} cm",
      miniPotBtn: "Tambahkan mini pot",

      orderStemLabel: "Tambahkan tangkai ini",
      perStemPrefix: "per tangkai",
      shippingExcl: "(belum termasuk ongkir)",

      pkgNames: ["Buket Mini", "Buket Sedang", "Buket Besar", "Buket Istimewa"],
      pkgBlurbs: [
        "Tiga tangkai campuran variasi studio. Pas untuk meja dan nakas.",
        "Lima tangkai dengan komposisi bertingkat yang seimbang. Pilihan buket klasik studio.",
        "Sembilan tangkai, warna campur pilihan studio.",
        "Lima belas tangkai mekar penuh untuk momen istimewa."
      ],
      pkgStemLine: "tangkai",
      pkgIncludes: [
        "{n} tangkai jadi, bunga campur",
        "Dibalut kertas pembungkus & pita katun",
        "Dikemas rapi dalam kotak pelindung",
        "Kartu petunjuk perawatan disertakan"
      ],
      pkgBtn: "Tambahkan buket ini",
      pkgBtnActive: "✓ Dipilih",
      pkgContinueBtn: "Lanjut ke sentuhan akhir ↓",
      pkgPhotoLabel: "foto buket",
      pkgFavoriteTag: "Favorit Studio",

      customEyebrow: "Buket custom",
      customTitle: "Atau hitung sendiri isinya",
      customIntro: "Tambahkan bunga yang Anda inginkan, estimasi harga diperbarui seketika. Minimal {minStems} tangkai. Biaya bungkus & pita: {wrapFeePerUnit} untuk setiap {wrapFeeUnitStems} tangkai.",
      customPickLabel: "Pilih tangkainya",
      customAdditionsLabel: "Pilih tambahan",
      customAdditionsNote: "Pilih satu atau dua jenis daun untuk melengkapi buket Anda.",
      additionsLabel: "Tambahan",
      noAdditionsLabel: "Tanpa tambahan",
      messageCardSelected: "Kartu ucapan",
      cardCheckboxLabel: "Tambahkan kartu ucapan (+{price})",
      giftDetailsLabel: "Detail penerima (opsional)",
      recipientNameOrderLabel: "Nama penerima",
      cardSenderOrderLabel: "Nama pengirim pada kartu",
      resetLabel: "Atur ulang",
      estimateLabel: "Estimasi biaya",
      flowersLabel: "Bunga",
      wrapFeeLabel: "Bungkus & pita (termasuk dalam total)",
      estTotalLabel: "Estimasi total",
      stemsWord: "tangkai",
      stemWord: "tangkai",
      minHint: "Tambahkan minimal {minStems} tangkai untuk memesan buket custom.",
      okHint: "Estimasi — total akhir dan ongkir kami konfirmasikan via chat sebelum pembayaran.",
      customAddAnotherHint: "Buket custom yang sudah ada di keranjang tidak akan berubah — ini menambahkan buket baru.",
      useCustomLabel: "Tambahkan buket ini ke keranjang →",
      emptyCustomMsg: "Belum ada bunga dipilih. Gunakan tombol + di atas untuk menambahkan tangkai.",
      addedToast: "{flower} ditambahkan ke buket ({count} tangkai)",
      viewCustomLink: "Lihat buket custom →",
      customIllustrativeNote: "Foto ilustrasi buket — rangkaian dirakit persis sesuai komposisi bunga pilihan Anda.",

      kitSoonEyebrow: "Segera menyusul",
      kitSoonTitle: "Kit DIY-nya masih kami siapkan",
      kitSoonBody: "Kami sedang menggambar panduannya dan menguji kemasannya, supaya pemula bisa membuat satu bunga dalam dua puluh menit. Kalau itu yang Anda cari, beri tahu kami — makin banyak yang menunggu, makin cepat kami luncurkan.",
      kitSoonCta: "Saya mau kitnya →",
      kitSoonCtaDisabled: "Segera hadir",
      kitSoonSecondary: "Baca FAQ",

      howEyebrow: "Cara dibuat",
      howTitle: "Dikerjakan tangan, lalu dikirim ke Anda",
      stepPhotoLabel: "Foto proses segera hadir",
      steps: [
        ["01 — Potong", "Kelopak dipotong sesuai pola", "Setiap bunga punya polanya sendiri. Chenille dipotong dan disortir per bagian sebelum dirangkai."],
        ["02 — Bentuk", "Setiap kelopak dilengkungkan tangan", "Inti kawat di dalam chenille menerima lengkungan lalu menahannya. Itulah yang membuat kelopaknya terasa tumbuh, bukan sekadar dilipat."],
        ["03 — Rangkai", "Dipasang ke tangkai", "Kelopak disusun melingkari mahkota, dipuntir kencang, lalu daunnya dipasang dan tangkainya dibalut sesuai panjang."],
        ["04 — Bungkus & kirim", "Dikemas seperti saat meninggalkan kami", "Buket diikat dan dibungkus, tangkai satuan dibalut kertas. Keduanya dikirim dalam kotak, dengan kartu perawatan."]
      ],

      matEyebrow: "Bahannya",
      matTitle: "Mengapa chenille bergerak seperti kelopak",
      matBody: "Serat chenille yang lembut di atas inti kawat berpuntir: ia menerima lengkungan seperti kelopak sungguhan, lalu menahannya. Itulah yang membuat bunga ini terasa tumbuh, bukan sekadar dilipat.",
      matPoints: [
        ["Bisa dibentuk ulang dengan tangan.", "Kalau kelopak tertekan di perjalanan, cukup lengkungkan kembali mengikuti lentur kawat intinya."],
        ["Ujung kawat dilipat dan dibalut.", "Aman dipegang dan aman diberikan sebagai hadiah."],
        ["Dibuat untuk pajangan dalam ruangan jangka panjang.", "Jauhkan dari lembap dan sinar matahari langsung yang lama."]
      ],

      orderEyebrow: "Pesan",
      orderTitle: "Lengkapi pesanan Anda, lalu konfirmasi via chat",
      orderPickerLabel: "Belum ada pilihan — pilih produk di sini",
      cartEmpty: "Belum ada produk dipilih. Pilih tangkai, mini pot, atau buket di bawah untuk memulai.",
      finishLabel: "Sentuhan akhir",
      wrapIntro: "Pilih warna kertas pembungkus untuk bunga Anda. Sudah termasuk dalam harga buket; tangkai satuan dibalut kertas pelindung siap vas.",
      cardLabel: "Kartu ucapan",
      cardPlaceholder: "mis. Selamat wisuda, Sagita — sukses selalu!",
      cardNote: "Ditulis tangan di kartu kecil.",
      cardNoteCounter: "{n}/{max} karakter",
      selectionLabel: "Pilihan Anda",
      includesLabel: "Termasuk",
      continueLabel: "Lanjut ke pemesanan",
      openLabel: "buka →",
      messageLabel: "chat →",
      emptySummaryTitle: "Belum ada bunga dipilih",
      emptySummarySub: "Pilih bunga satuan atau buket di atas",
      emptySummaryPrice: "—",
      emptySummaryPrompt: "Silakan pilih bunga terlebih dahulu",
      emptySummaryBtn: "pilih di atas ↑",
      emptySummaryIncludes: [
        "Pilih bunga satuan di atas, paket buket, atau susun buket custom Anda sendiri.",
        "Dibalut kertas pembungkus & dikemas dalam kotak pelindung",
        "Kartu panduan perawatan disertakan"
      ],
      minStemsRequired: "Min. {n} tangkai",
      configureStemsCta: "Atur bunga ↑",
      channelComingSoon: "segera hadir",
      channelUnavailableNotice: "Listing Shopee sedang disiapkan. Seluruh pemesanan dan kustomisasi dilayani langsung via WhatsApp studio.",
      channelsAllDisabledNotice: "Pemesanan online saat ini sedang dijeda. Hubungi kami via Instagram untuk pertanyaan ketersediaan.",
      shopeeLabel: "Shopee",
      shopeeSub: "Official Store · Belanja praktis",
      shopeeAction: "buka toko →",
      shopeeBadgeTag: "Toko Resmi",
      marketplaceNotice: "Toko Shopee resmi kami siap melayani pesanan Anda. Untuk buket kustom & konsultasi rangkaian, pesan langsung via WhatsApp studio.",
      marketplaceNoticeComingSoon: "Listing Shopee sedang disiapkan. Seluruh pesanan, buket custom, dan kartu ucapan saat ini dilayani langsung via WhatsApp studio.",
      marketplaceNoticeActive: "Toko Shopee resmi kami siap melayani pesanan standar. Catatan: buket kustom dan kartu ucapan khusus memerlukan konfirmasi via WhatsApp studio.",
      waDraftNotice: "Membuka draf pesan di WhatsApp (tidak terkirim otomatis sampai Anda menekan tombol kirim di aplikasi).",
      waLabel: "WhatsApp — Konfirmasi Pesanan",
      orderNote: "Total pesanan dan ongkos kirim akan dikonfirmasikan langsung melalui chat WhatsApp studio sebelum Anda melakukan transfer.",
      btnEditSelection: "Ubah pilihan",
      clearCartLabel: "Kosongkan keranjang",
      clearCartConfirm: "Kosongkan keranjang? Semua produk yang sudah dipilih akan dihapus dan tidak bisa dikembalikan.",
      clearCartAnnounce: "Keranjang dikosongkan.",
      customMinErrorSummary: "Tambahkan minimal {minStems} tangkai untuk melanjutkan pesanan buket custom.",
      customMinHint: "Minimal {n} tangkai",
      removeLineLabel: "Hapus {item} dari keranjang",
      decreaseLineLabel: "Kurangi jumlah {item}",
      increaseLineLabel: "Tambah jumlah {item}",
      announceLineAdded: "{item} ditambahkan. {n} item di keranjang.",
      announceLineRemoved: "{item} dihapus. {n} item di keranjang.",
      floatingCartLabel: "di keranjang",
      floatingCartAriaLabel: "Lihat keranjang — {n} item",
      announceQtyChanged: "{item} diperbarui menjadi {qty}. {n} item di keranjang.",

      wrapNames: { kraft: "Kraft", cream: "Krem", sage: "Sage", blush: "Blush" },
      wrapAriaSuffix: "kertas pembungkus",

      // Native checkout dialog copy (DEV-13) — every string the checkout dialog shows,
      // in one place per language, including live-status and error text.
      checkoutReviewEyebrow: "Tinjau pesanan",
      checkoutReviewTitle: "Periksa detail pesanan Anda",
      checkoutReferenceLabel: "Referensi pesanan",
      checkoutStepIndicator: "Langkah {step} dari {total}",
      checkoutStepReview: "Tinjau",
      checkoutStepForm: "Detail",
      checkoutStepSuccess: "Selesai",
      checkoutSubtotalLabel: "Subtotal produk",
      checkoutWrapFeeLabel: "Biaya bungkus custom",
      checkoutCardFeeLabel: "Kartu ucapan",
      checkoutDeliveryRowLabel: "Ongkos kirim",
      checkoutDeliveryRowValue: "Dihitung terpisah via WhatsApp",
      checkoutTotalLabel: "Estimasi total produk",
      checkoutNotice: "Belum ada pembayaran pada tahap ini. Kami akan mengonfirmasi alamat, ongkos kirim, dan total akhir melalui WhatsApp.",
      checkoutEditOrder: "Ubah pesanan",
      checkoutContinueOrder: "Lanjutkan pemesanan",
      checkoutInvalidCart: "Pilih produk yang valid sebelum melanjutkan.",
      checkoutBackToReview: "← Kembali ke tinjauan",
      checkoutFormEyebrow: "Formulir pesanan",
      checkoutFormTitle: "Lengkapi detail pesanan",
      checkoutBuyerLegend: "Data pemesan",
      checkoutBuyerNameLabel: "Nama pemesan",
      checkoutBuyerPhoneLabel: "Nomor WhatsApp pemesan",
      checkoutBuyerPhoneExample: "Contoh: 081234567890",
      checkoutBuyerHelp: "Kami memakai nomor ini untuk konfirmasi pesanan, ongkir, dan pembayaran.",
      checkoutLocationLegend: "Lokasi & pengiriman",
      checkoutLocationTypeLabel: "Lokasi Anda",
      checkoutLocationBali: "Di Bali",
      checkoutLocationOutsideBali: "Luar Bali",
      checkoutRegencyLabel: "Kabupaten/kota",
      checkoutRegencyChoose: "Pilih satu",
      checkoutDeliveryMethodLabel: "Metode pengiriman",
      checkoutDeliveryGrabGojek: "Grab/Gojek (saya pesan sendiri)",
      checkoutDeliverySelfPickup: "Ambil sendiri di studio",
      checkoutAddressLabel: "Alamat lengkap pengiriman",
      checkoutCityLabel: "Kota atau kabupaten",
      checkoutPostalLabel: "Kode pos",
      checkoutPickupHelp: "Alamat pengambilan akan dikonfirmasi dan dikirimkan melalui WhatsApp.",
      checkoutOutsideBaliHelp: "Pengiriman akan dikirim sesuai dengan alamat yang ditulis, mohon diperhatikan dengan benar.",
      checkoutDateLabel: "Tanggal yang diinginkan",
      checkoutDeliveryHelp: "Tanggal merupakan preferensi dan akan dikonfirmasi melalui WhatsApp. Pesanan butuh minimal {days} hari persiapan sebelum tanggal ini.",
      checkoutAckLabel: "Saya memahami bahwa pesanan dibuat setelah pembayaran dikonfirmasi dan detail pengiriman akan diperiksa melalui WhatsApp.",
      checkoutPrivacyNotice: "Nama, nomor WhatsApp, alamat, dan detail penerima yang Anda isi hanya dipakai untuk memproses, mengirim, dan mengonfirmasi pesanan ini. Data disimpan di spreadsheet internal Alxanthia yang aksesnya dibatasi hanya untuk tim studio, selama {retention}, lalu dihapus kecuali dibutuhkan untuk catatan keuangan. Dengan mencentang kotak di bawah, Anda menyetujui data ini diproses sebagaimana dijelaskan di atas.",
      checkoutPrivacyLinkText: "Kebijakan privasi",
      checkoutRequiredMark: "(wajib)",
      checkoutSaveOrder: "Simpan pesanan",
      checkoutSaving: "Menyimpan…",
      checkoutFieldsIncomplete: "{count} kolom perlu dilengkapi.",
      checkoutNotConfigured: "Penyimpanan pesanan belum dikonfigurasi. Silakan hubungi studio.",
      checkoutAmbiguousFailure: "Kami belum dapat memastikan pesanan tersimpan. Hubungi studio dengan referensi {reference} sebelum mencoba lagi.",
      checkoutConnectionFailure: "Pesanan belum tersimpan. Periksa koneksi internet Anda lalu coba lagi.",
      checkoutConflictFailure: "Referensi {reference} sudah digunakan dengan data yang berbeda. Hubungi studio melalui WhatsApp sebelum mencoba lagi — jangan kirim ulang.",
      checkoutRejectedFailure: "Pesanan tidak dapat disimpan. Periksa kembali data Anda atau hubungi studio.",
      checkoutSubmittingNotice: "Sedang menyimpan pesanan Anda, mohon tunggu…",
      checkoutSuccessEyebrow: "Pesanan dicatat",
      checkoutSuccessTitle: "Pesanan Anda sudah dicatat.",
      checkoutSuccessCopy: "Lanjutkan ke WhatsApp agar studio kami dapat mengonfirmasi ketersediaan, pengiriman, dan pembayaran.",
      checkoutSuccessOrderLabel: "Pesanan Anda",
      checkoutSuccessTotalLabel: "Estimasi total produk",
      checkoutDuplicateCopy: "Pesanan ini sudah tercatat sebelumnya dengan referensi yang sama — tidak ada baris ganda yang dibuat.",
      checkoutWhatsappButton: "Lanjut ke WhatsApp →",
      checkoutCopyReference: "Salin referensi pesanan",
      checkoutCopySuccess: "Referensi pesanan disalin.",
      checkoutCopyFallback: "Tidak bisa menyalin otomatis. Salin manual: {reference}",
      checkoutStartNewOrder: "Mulai pesanan baru",
      checkoutRecentOrderBanner: "Anda punya pesanan baru-baru ini: {reference}.",
      checkoutRecentOrderLink: "Lihat lagi",
      checkoutRecentOrderDismiss: "Tutup",
      checkoutCloseDialog: "Tutup",
      checkoutErrCheckbox: "Centang kotak ini untuk melanjutkan.",
      checkoutErrSelect: "Silakan pilih salah satu.",
      checkoutErrRequired: "Kolom ini wajib diisi.",
      checkoutErrPattern: "Masukkan nomor WhatsApp yang valid.",
      checkoutErrPostalPattern: "Masukkan 5 digit kode pos.",
      checkoutErrDateRange: "Pilih tanggal yang memenuhi masa persiapan minimum.",
      checkoutErrGeneric: "Kolom ini perlu diperiksa.",
      checkoutTurnstileRequired: "Selesaikan verifikasi keamanan di bawah sebelum menyimpan pesanan.",
      wrapLinePrefix: "Pembungkus",
      cardLinePrefix: "Kartu ucapan",
      stemSuffix: "— tangkai jadi",
      customTitleShort: "Buket custom",
      categoryAll: "Semua",
      categoryStems: "Bunga Jadi",
      categoryPots: "Mini Pot",
      categoryBouquets: "Paket Buket",
      categoryCustom: "Buket Custom",
      customBuilderToggleOpen: "Susun buket custom sendiri ↓",
      customBuilderToggleClose: "Tutup penyusun custom ↑",
      stemIncludes: [
        "{flower} jadi ({qty} tangkai), dirangkai oleh studio",
        "{size}, siap dipajang di vas",
        "Dibalut kertas pelindung, dikemas dalam boks",
        "Kartu panduan perawatan disertakan"
      ],
      customIncludesTail: [
        "Dibalut kertas pembungkus pilihan & pita katun",
        "Dikemas rapi dalam kotak pelindung",
        "Dibuat sesuai pesanan — 3–4 hari kerja",
        "Kartu panduan perawatan disertakan"
      ],

      faqEyebrow: "Pertanyaan",
      faqTitle: "Sebelum Anda memesan",
      faqs: [
        ["Dikirim dari mana?", "Semuanya dibuat dan dikirim dari Indonesia, dikemas aman dalam kotak pelindung ke seluruh nusantara."],
        ["Berapa lama sebelum dikirim?", "Tangkai satuan dan buket kecil (3–5 tangkai) dibuat dalam 2–3 hari kerja; buket 9 tangkai ke atas membutuhkan 3–4 hari kerja."],
        ["Apakah bisa rusak di jalan?", "Buket dibungkus dan dikotakkan dengan mahkota bunga terlindungi. Serat chenille dan kawat lentur sehingga bila sedikit tertekan, mudah dibentuk ulang dengan tangan. Jika paket mengalami kendala berat akibat ekspedisi, kirimkan foto pada WhatsApp studio kami untuk bantuan langsung."],
        ["Bisa ganti isi buketnya?", "Bisa — gunakan penyusun custom di halaman ini untuk kombinasi jumlah yang Anda inginkan, atau chat kami di WhatsApp untuk request warna khusus."],
        ["Bagaimana cara merawatnya?", "Tanpa air sama sekali. Pajang di dalam ruangan, jauh dari kelembapan dan paparan terik matahari langsung; bersihkan debu halus dengan kuas lembut."],
        ["Kit DIY-nya masih ada?", "Masih kami siapkan — panduan bergambar dan kemasan sedang kami rapikan. Kirim pesan ke WhatsApp kami jika ingin masuk daftar tunggu prioritas."]
      ],

      footerCare: "Pengiriman & perawatan",
      footerContactTitle: "Kontak",
      footerHelpTitle: "Bantuan",
      footerStoreTitle: "Toko",
      footerWhatsappLabel: "WhatsApp",
      footerOrderLink: "Cara pesan",
      footerPaymentNote: "Pembayaran dikonfirmasi via WhatsApp",
      copyright: "© 2026 Alxanthia",
      marketplaceComingSoonBadge: "segera hadir"
    },

    // ENGLISH
    en: {
      navCollection: "Flowers",
      navBouquets: "Bouquets",
      navHow: "How they're made",
      navFaq: "FAQ",
      navOrder: "Order",

      heroEyebrow: "Finished flowers & bouquets · chenille stems",
      heroTitle: "Flowers that never wilt — finished by our hands.",
      heroSub: "Every stem is shaped and assembled here, then boxed ready to display. Take a single flower, one of our bouquet packages, or build your own mix.",
      heroPlateCaption: "Helianthus annuus",
      heroPlatePl: "PL. I",
      ctaBrowse: "See the flowers",
      ctaBouquet: "Build a bouquet",

      ben1t: "Arrives finished",
      ben1d: "Nothing to assemble — unwrap and place it.",
      ben2t: "No water, ever",
      ben2d: "Chenille and wire, made for indoor display.",
      ben3t: "Made to order",
      ben3d: "Cut, shaped and wrapped after you order.",

      tr1t: "Ships from Indonesia",
      tr1d: "Delivered nationwide in sturdy protective boxes.",
      tr2t: "Made in 2–3 working days",
      tr2d: "Bouquets of 9+ stems take 3–4 working days.",
      tr3t: "Boxed to arrive intact",
      tr3d: "Pliable petals can always be shaped gently by hand.",
      tr4t: "Direct studio order",
      tr4d: "Order details and delivery confirmed directly via studio WhatsApp.",

      colEyebrow: "The collection",
      zoomPhotoLabel: "Enlarge photo of {name}",
      colTitle: "Ways to order",
      colIntro: "Choose a finished stem, a mini pot, or a bouquet — ours or yours.",
      catOneLabel: "Category 01",
      catOneTitle: "Finished flowers",
      catOneNote: "Four flowers, each assembled by us and sold by the stem.",
      catTwoLabel: "Category 02",
      catTwoTitle: "Mini pots",
      catTwoNote: "Three tiny flowers with pots handcrafted from chenille pipe cleaners too.",
      catThreeLabel: "Category 03",
      catThreeTitle: "Bouquets",
      catThreeNote: "Four ready packages, or a custom mix you count out yourself.",
      miniPotMaterial: "100% chenille craft",
      miniPotHeight: "~{h} cm tall",
      miniPotBtn: "Add mini pot",

      orderStemLabel: "Add this stem",
      perStemPrefix: "per stem",
      shippingExcl: "(excludes delivery fee)",

      pkgNames: ["The Posy", "The Handful", "The Armful", "The Grand"],
      pkgBlurbs: [
        "Three stems in a studio mix. Ideal for desk and bedside display.",
        "Five stems arranged with gentle height at the centre. A balanced classic studio bouquet.",
        "Nine stems in a harmonious studio mix.",
        "Fifteen full blooming stems for standout celebrations."
      ],
      pkgStemLine: "stems",
      pkgIncludes: [
        "{n} finished stems, mixed flowers",
        "Wrapped in protective paper & cotton ribbon",
        "Securely boxed for delivery",
        "Care guide card included"
      ],
      pkgBtn: "Add this bouquet",
      pkgBtnActive: "✓ Selected",
      pkgContinueBtn: "Continue to finishing ↓",
      pkgPhotoLabel: "bouquet photo",
      pkgFavoriteTag: "Studio Favorite",

      customEyebrow: "Custom bouquet",
      customTitle: "Or count out your own",
      customIntro: "Add the flowers you want and the estimate updates as you go. Minimum {minStems} stems. Wrapping & ribbon: {wrapFeePerUnit} for every {wrapFeeUnitStems} stems.",
      customPickLabel: "Choose your stems",
      customAdditionsLabel: "Choose your additions",
      customAdditionsNote: "Choose one or both leaf styles to finish your bouquet.",
      additionsLabel: "Additions",
      noAdditionsLabel: "No additions",
      messageCardSelected: "Message card",
      cardCheckboxLabel: "Add a message card (+{price})",
      giftDetailsLabel: "Recipient details (optional)",
      recipientNameOrderLabel: "Recipient name",
      cardSenderOrderLabel: "Sender name on the card",
      resetLabel: "Reset",
      estimateLabel: "Estimate",
      flowersLabel: "Flowers",
      wrapFeeLabel: "Wrapping & ribbon (included in total)",
      estTotalLabel: "Estimated total",
      stemsWord: "stems",
      stemWord: "stem",
      minHint: "Add at least {minStems} stems to order a custom bouquet.",
      okHint: "An estimate — final totals and shipping are confirmed via chat before payment.",
      customAddAnotherHint: "Custom bouquets already in your cart won't change — this adds a new one.",
      useCustomLabel: "Add this bouquet to cart →",
      emptyCustomMsg: "No flowers selected yet. Use the + buttons above to add stems.",
      addedToast: "{flower} added to bouquet ({count} stems)",
      viewCustomLink: "View custom bouquet →",
      customIllustrativeNote: "Bouquet illustration — assembled to match your chosen stem composition.",

      kitSoonEyebrow: "Coming later",
      kitSoonTitle: "The DIY kit is still in the workshop",
      kitSoonBody: "We're drawing the plates and testing the packs so a beginner can build a flower in twenty minutes. If that's what you came for, tell us — the more people waiting, the sooner we launch it.",
      kitSoonCta: "I want the kit →",
      kitSoonCtaDisabled: "Coming soon",
      kitSoonSecondary: "Read the FAQ",

      howEyebrow: "How they're made",
      howTitle: "Made by hand, then sent to you",
      stepPhotoLabel: "Process photo coming soon",
      steps: [
        ["01 — Cut", "Petals cut to pattern", "Each flower has its own drawn pattern. Chenille is cut and sorted by part before anything is assembled."],
        ["02 — Shape", "Every petal curved by hand", "The wire core inside the chenille takes a curve and holds it. That is what makes a petal read as grown rather than folded."],
        ["03 — Assemble", "Wound onto the stem", "Petals are layered around the crown, twisted tight, then the leaves go on and the stem is wrapped to length."],
        ["04 — Wrap & send", "Boxed the way it left us", "Bouquets are tied and sleeved, single stems wrapped in paper. Both go out boxed, with a care card."]
      ],

      matEyebrow: "The material",
      matTitle: "Why chenille behaves like a petal",
      matBody: "A soft chenille pile over a twisted wire core: it takes a curve the way a petal does, and then it holds it. That is what makes these flowers read as grown rather than folded.",
      matPoints: [
        ["Reshapes with your fingers.", "If a petal flattens in transit, gently curve it back along its flexible wire core."],
        ["Wire ends folded and wrapped.", "Safe to handle and to hand over as a gift."],
        ["Made for long-lasting indoor display.", "Keep away from moisture and prolonged direct sunlight."]
      ],

      orderEyebrow: "Order",
      orderTitle: "Finish your order, then confirm via chat",
      orderPickerLabel: "Nothing selected — pick a product here",
      cartEmpty: "Nothing selected yet. Pick a stem, a mini pot, or a bouquet below to start.",
      finishLabel: "Finishing",
      wrapIntro: "Choose the paper we wrap your flowers in. Included in every bouquet price; single stems arrive paper-wrapped and vase-ready.",
      cardLabel: "Message card",
      cardPlaceholder: "e.g. Happy graduation, Sagita — from all of us!",
      cardNote: "Handwritten on a small card.",
      cardNoteCounter: "{n}/{max} characters",
      selectionLabel: "Your selection",
      includesLabel: "Includes",
      continueLabel: "Continue to order",
      openLabel: "open →",
      messageLabel: "chat →",
      emptySummaryTitle: "No flower selected yet",
      emptySummarySub: "Choose a stem or bouquet above",
      emptySummaryPrice: "—",
      emptySummaryPrompt: "Please select a flower first",
      emptySummaryBtn: "select above ↑",
      emptySummaryIncludes: [
        "Select a single stem above, a bouquet package, or assemble your own custom bouquet.",
        "Wrapped in paper & securely boxed for transit",
        "Care guide card included"
      ],
      minStemsRequired: "Min. {n} stems",
      configureStemsCta: "Configure stems ↑",
      channelComingSoon: "coming soon",
      channelUnavailableNotice: "Shopee listings opening soon. Orders are currently welcomed directly via studio WhatsApp.",
      channelsAllDisabledNotice: "Online ordering is temporarily paused. Contact us via Instagram for availability inquiries.",
      shopeeLabel: "Shopee",
      shopeeSub: "Official Store · Direct checkout",
      shopeeAction: "visit store →",
      shopeeBadgeTag: "Official Store",
      marketplaceNotice: "Our official Shopee store is open for convenient checkout. For custom bouquets & consultation, order directly via WhatsApp studio.",
      marketplaceNoticeComingSoon: "Shopee official listing is currently in preparation. All orders, custom arrangements, and handwritten message cards are currently serviced directly via studio WhatsApp.",
      marketplaceNoticeActive: "Our official Shopee store is open for standard checkouts. Note: custom bouquets and personalized message cards require direct order via WhatsApp studio.",
      waDraftNotice: "Opens a draft message in WhatsApp (does not send automatically until you press send in WhatsApp).",
      waLabel: "WhatsApp — Confirm Order",
      orderNote: "Total and shipping costs are confirmed directly with our studio via WhatsApp chat before payment.",
      btnEditSelection: "Edit selection",
      clearCartLabel: "Clear cart",
      clearCartConfirm: "Clear your cart? Everything you've selected will be removed and this can't be undone.",
      clearCartAnnounce: "Cart cleared.",
      customMinErrorSummary: "Add at least {minStems} stems to proceed with a custom bouquet.",
      customMinHint: "Minimum {n} stems",
      removeLineLabel: "Remove {item} from cart",
      decreaseLineLabel: "Decrease {item} quantity",
      increaseLineLabel: "Increase {item} quantity",
      announceLineAdded: "{item} added. {n} item(s) in cart.",
      announceLineRemoved: "{item} removed. {n} item(s) in cart.",
      floatingCartLabel: "in cart",
      floatingCartAriaLabel: "View cart — {n} item(s)",
      announceQtyChanged: "{item} updated to {qty}. {n} item(s) in cart.",

      wrapNames: { kraft: "Kraft", cream: "Cream", sage: "Sage", blush: "Blush" },
      wrapAriaSuffix: "wrap paper",

      // Native checkout dialog copy (DEV-13) — every string the checkout dialog shows,
      // in one place per language, including live-status and error text.
      checkoutReviewEyebrow: "Order review",
      checkoutReviewTitle: "Check your order details",
      checkoutReferenceLabel: "Order reference",
      checkoutStepIndicator: "Step {step} of {total}",
      checkoutStepReview: "Review",
      checkoutStepForm: "Details",
      checkoutStepSuccess: "Done",
      checkoutSubtotalLabel: "Product subtotal",
      checkoutWrapFeeLabel: "Custom wrapping fee",
      checkoutCardFeeLabel: "Message card",
      checkoutDeliveryRowLabel: "Delivery fee",
      checkoutDeliveryRowValue: "Calculated separately via WhatsApp",
      checkoutTotalLabel: "Estimated product total",
      checkoutNotice: "No payment is required at this stage. We will confirm your address, delivery fee, and final total through WhatsApp.",
      checkoutEditOrder: "Edit order",
      checkoutContinueOrder: "Continue order",
      checkoutInvalidCart: "Choose a valid product before continuing.",
      checkoutBackToReview: "← Back to review",
      checkoutFormEyebrow: "Order form",
      checkoutFormTitle: "Complete your order details",
      checkoutBuyerLegend: "Buyer",
      checkoutBuyerNameLabel: "Buyer name",
      checkoutBuyerPhoneLabel: "Buyer WhatsApp number",
      checkoutBuyerPhoneExample: "Example: 081234567890",
      checkoutBuyerHelp: "We use this number to confirm your order, delivery fee, and payment.",
      checkoutLocationLegend: "Location & delivery",
      checkoutLocationTypeLabel: "Your location",
      checkoutLocationBali: "In Bali",
      checkoutLocationOutsideBali: "Outside Bali",
      checkoutRegencyLabel: "City/regency",
      checkoutRegencyChoose: "Choose one",
      checkoutDeliveryMethodLabel: "Delivery method",
      checkoutDeliveryGrabGojek: "Grab/Gojek (you book it yourself)",
      checkoutDeliverySelfPickup: "Self pickup at the studio",
      checkoutAddressLabel: "Complete delivery address",
      checkoutCityLabel: "City or regency",
      checkoutPostalLabel: "Postal code",
      checkoutPickupHelp: "The pickup address will be confirmed and sent via WhatsApp.",
      checkoutOutsideBaliHelp: "Delivery will be sent to the address you write — please make sure it is correct.",
      checkoutDateLabel: "Preferred date",
      checkoutDeliveryHelp: "The date is a preference and will be confirmed through WhatsApp. Orders need at least {days} day(s) of preparation before this date.",
      checkoutAckLabel: "I understand that production starts after payment is confirmed and delivery details will be checked through WhatsApp.",
      checkoutPrivacyNotice: "The name, WhatsApp number, address, and recipient details you enter are only used to process, deliver, and confirm this order. Data is stored in Alxanthia's internal spreadsheet, access-restricted to the studio team only, for {retention}, then deleted unless it is needed for financial records. By checking the box below, you consent to this data being processed as described above.",
      checkoutPrivacyLinkText: "Privacy notice",
      checkoutRequiredMark: "(required)",
      checkoutSaveOrder: "Save order",
      checkoutSaving: "Saving…",
      checkoutFieldsIncomplete: "{count} field(s) need to be completed.",
      checkoutNotConfigured: "Order saving is not configured yet. Please contact the studio.",
      checkoutAmbiguousFailure: "We could not verify that the order was saved. Please contact the studio with reference {reference} before trying again.",
      checkoutConnectionFailure: "The order was not saved. Please check your internet connection and try again.",
      checkoutConflictFailure: "Reference {reference} was already used with different details. Please contact the studio via WhatsApp before trying again — do not resend.",
      checkoutRejectedFailure: "The order could not be saved. Please check your details or contact the studio.",
      checkoutSubmittingNotice: "Saving your order, please wait…",
      checkoutSuccessEyebrow: "Order recorded",
      checkoutSuccessTitle: "Your order request has been recorded.",
      checkoutSuccessCopy: "Continue to WhatsApp so our studio can confirm availability, delivery, and payment.",
      checkoutSuccessOrderLabel: "Your order",
      checkoutSuccessTotalLabel: "Estimated product total",
      checkoutDuplicateCopy: "This order was already recorded earlier with the same reference — no duplicate row was created.",
      checkoutWhatsappButton: "Continue to WhatsApp →",
      checkoutCopyReference: "Copy order reference",
      checkoutCopySuccess: "Order reference copied.",
      checkoutCopyFallback: "Could not copy automatically. Copy manually: {reference}",
      checkoutStartNewOrder: "Start a new order",
      checkoutRecentOrderBanner: "You have a recent order: {reference}.",
      checkoutRecentOrderLink: "View again",
      checkoutRecentOrderDismiss: "Dismiss",
      checkoutCloseDialog: "Close",
      checkoutErrCheckbox: "Please check this box to continue.",
      checkoutErrSelect: "Please choose an option.",
      checkoutErrRequired: "This field is required.",
      checkoutErrPattern: "Enter a valid WhatsApp number.",
      checkoutErrPostalPattern: "Enter a 5-digit postal code.",
      checkoutErrDateRange: "Choose a date that meets the minimum preparation time.",
      checkoutErrGeneric: "This field needs attention.",
      checkoutTurnstileRequired: "Please complete the security check below before saving your order.",
      wrapLinePrefix: "Wrap",
      cardLinePrefix: "Message card",
      stemSuffix: "— finished stem",
      customTitleShort: "Custom bouquet",
      categoryAll: "All",
      categoryStems: "Finished Stems",
      categoryPots: "Mini Pots",
      categoryBouquets: "Bouquet Packages",
      categoryCustom: "Custom Bouquet",
      customBuilderToggleOpen: "Build your own custom bouquet ↓",
      customBuilderToggleClose: "Close custom builder ↑",
      stemIncludes: [
        "{flower} finished ({qty} stem(s)), assembled by studio",
        "{size}, ready to place in a vase",
        "Wrapped in paper, boxed for delivery",
        "Care guide card included"
      ],
      customIncludesTail: [
        "Wrapped in chosen paper & tied with cotton ribbon",
        "Carefully boxed for secure transit",
        "Handmade to order — 3–4 working days",
        "Care guide card included"
      ],

      faqEyebrow: "Questions",
      faqTitle: "Before you order",
      faqs: [
        ["Where do you ship from?", "Everything is made and sent from Indonesia, delivered safely nationwide in protective boxes."],
        ["How long before it's sent?", "Single stems and small bouquets (3–5 stems) take 2–3 working days; bouquets of nine stems or more take 3–4 working days."],
        ["Will it arrive crushed?", "Bouquets are sleeved and boxed with flower heads protected. Chenille and wire stems are pliable and can easily be reshaped by hand if slightly pressed. If severe shipping damage occurs, contact our WhatsApp studio with photos for prompt assistance."],
        ["Can I change what's in a bouquet?", "Yes — use the custom builder on this page for your desired flower combination, or message our WhatsApp for custom color requests."],
        ["How do I care for them?", "No water needed. Display indoors away from moisture and prolonged direct sunlight; dust gently with a soft brush."],
        ["Are the DIY kits still coming?", "They are still being prepared — instructions and packaging are being refined. Message our WhatsApp to join the priority waitlist."]
      ],

      footerCare: "Shipping & care",
      footerContactTitle: "Contact",
      footerHelpTitle: "Help",
      footerStoreTitle: "Shop",
      footerWhatsappLabel: "WhatsApp",
      footerOrderLink: "How to order",
      footerPaymentNote: "Payment confirmed via WhatsApp",
      copyright: "© 2026 Alxanthia",
      marketplaceComingSoonBadge: "coming soon"
    }
  }
};
