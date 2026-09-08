/**
 * =============================================================================
 * KOMOREBI WEBSITE CONTENT CONFIGURATION (site-content.js)
 * =============================================================================
 * 
 * PETUNJUK UNTUK NON-DEVELOPER (INDONESIA):
 * Anda bisa mengubah teks, harga, tautan WhatsApp, Tokopedia, Shopee, dan gambar di sini!
 * Pastikan tanda kutip ("...") dan koma (,) tetap ada dan tidak terhapus.
 * 
 * INSTRUCTIONS FOR NON-DEVELOPERS (ENGLISH):
 * You can edit all texts, prices, links, WhatsApp number, and images here.
 * Make sure quotes ("...") and commas (,) remain intact.
 * =============================================================================
 */

window.KOMOREBI_DATA = {
  // Private Access Passcode Protection
  auth: {
    enabled: true,
    passcode: "22062024" // You can change this passcode anytime
  },

  // Store & Contact Links
  store: {
    brandName: "Komorebi",
    tagline: "est. 2026",
    logo: "komorebi-logo-96.webp",
    logo2x: "komorebi-logo-192.webp",
    instagramUrl: "https://instagram.com/komorebi",
    tokopediaUrl: null, // Marketplace listing URLs pending confirmation
    shopeeUrl: null,
    // WhatsApp phone number with country code (e.g. 6281234567890 for Indonesia)
    whatsappNumber: "6281234567890",
    whatsappTemplateId: "Halo Komorebi! Saya ingin memesan {title} ({price}). {wrapInfo}{cardInfo}Apakah masih tersedia?",
    whatsappTemplateEn: "Hello Komorebi! I would like to order {title} ({price}). {wrapInfo}{cardInfo}Is it available?",
    whatsappWaitlistId: "Halo Komorebi! Saya tertarik dengan kit DIY-nya — tolong kabari saya saat diluncurkan.",
    whatsappWaitlistEn: "Hello Komorebi! I'm interested in the DIY kit — please let me know when it launches.",
    // Marketplace & Channel visibility toggles
    channels: {
      showTokopedia: true,
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

  // Pricing & Builder Rules (editable without modifying app.js)
  wrapFee: 35000,
  bulkFrom: 9,
  bulkRate: 0.10,
  minStems: 3,

  // Wrapping Paper Options
  wraps: [
    { key: "kraft", swatch: "#B79A6E" },
    { key: "cream", swatch: "#F0E7D6" },
    { key: "sage",  swatch: "#7E8F7C" },
    { key: "blush", swatch: "#C9A4A8" }
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
      en: {
        name: "Sunflower",
        size: "45 cm stem",
        detail: "12 cm head",
        blurb: "Our signature. Layered ochre petals and a dense seeded crown."
      },
      id: {
        name: "Bunga Matahari",
        size: "tangkai 45 cm",
        detail: "kepala 12 cm",
        blurb: "Bunga andalan kami. Kelopak oker berlapis dengan mahkota berbiji rapat."
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
      en: {
        name: "Rose",
        size: "40 cm stem",
        detail: "spiralled head",
        blurb: "Petals wound one by one into a spiral. The most patient flower we make."
      },
      id: {
        name: "Mawar",
        size: "tangkai 40 cm",
        detail: "kepala melingkar",
        blurb: "Kelopak dipasang satu per satu jadi lingkaran. Bunga paling menuntut kesabaran."
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
      en: {
        name: "Tulip",
        size: "38 cm stem",
        detail: "6 petals",
        blurb: "Six clean petals and a single leaf. Quiet enough for any room."
      },
      id: {
        name: "Tulip",
        size: "tangkai 38 cm",
        detail: "6 kelopak",
        blurb: "Enam kelopak bersih dan satu daun. Tenang untuk ruangan mana pun."
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
      en: {
        name: "Gerbera",
        size: "40 cm stem",
        detail: "coral, two-tone",
        blurb: "Two rings of narrow coral petals around a seeded brown centre."
      },
      id: {
        name: "Gerbera",
        size: "tangkai 40 cm",
        detail: "koral, dua nada",
        blurb: "Dua lingkar kelopak koral ramping mengelilingi mahkota cokelat berbiji."
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
        blurb: "Nine slender spikes to a bundle. Kept in bouquet shots."
      },
      id: {
        name: "Lavender",
        size: "tangkai 32 cm",
        detail: "9 tangkai",
        blurb: "Sembilan tangkai ramping per ikat. Tampil dalam foto buket."
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
      tr1d: "Ke seluruh Indonesia lewat marketplace.",
      tr2t: "Dibuat 2–3 hari kerja",
      tr2d: "Buket 9 tangkai ke atas, 3–4 hari.",
      tr3t: "Dikemas agar utuh",
      tr3d: "Kelopak selalu bisa dibentuk ulang dengan tangan.",
      tr4t: "Pembayaran terlindungi",
      tr4d: "Checkout lewat Tokopedia atau Shopee.",

      colEyebrow: "Koleksi",
      colTitle: "Dua cara memesan",
      colIntro: "Tangkai jadi satuan, atau buket — versi kami atau versi Anda.",
      catOneLabel: "Kategori 01",
      catOneTitle: "Bunga jadi",
      catOneNote: "Empat bunga, semuanya kami rangkai dan dijual per tangkai.",
      catTwoLabel: "Kategori 02",
      catTwoTitle: "Buket",
      catTwoNote: "Empat paket siap pesan, atau campuran custom yang Anda hitung sendiri.",

      orderStemLabel: "Pesan tangkai ini",
      addToBouquetLabel: "Tambah ke buket +",
      perStemPrefix: "per tangkai",

      pkgNames: ["Buket Mini", "Buket Sedang", "Buket Besar", "Buket Istimewa"],
      pkgBlurbs: [
        "Tiga tangkai, satu jenis atau campuran. Ukuran meja dan nakas.",
        "Lima tangkai dengan bagian tengah yang lebih tinggi. Paling sering dipesan.",
        "Sembilan tangkai, warna campur, penuh dalam pelukan. Sudah harga grosir.",
        "Lima belas tangkai untuk momen yang memang menuntutnya. Sudah harga grosir."
      ],
      pkgStemLine: "tangkai",
      pkgIncludes: [
        "{n} tangkai jadi, bunga campur",
        "Dibalut kertas, diikat pita",
        "Dikemas dalam kotak",
        "Kartu perawatan disertakan"
      ],
      pkgBtn: "Pilih buket ini",
      pkgBtnActive: "Dipilih",
      pkgPhotoLabel: "foto buket",

      customEyebrow: "Buket custom",
      customTitle: "Atau hitung sendiri isinya",
      customIntro: "Tambahkan bunga yang Anda mau, estimasi harganya ikut berubah. Minimal tiga tangkai; sembilan tangkai ke atas dapat potongan 10% untuk bunganya.",
      customPickLabel: "Pilih tangkainya",
      resetLabel: "Atur ulang",
      estimateLabel: "Estimasi",
      flowersLabel: "Bunga",
      discountLabel: "Potongan grosir (9+ tangkai)",
      wrapFeeLabel: "Bungkus & pita",
      estTotalLabel: "Estimasi total",
      stemsWord: "tangkai",
      stemWord: "tangkai",
      minHint: "Tambahkan minimal tiga tangkai untuk memesan buket.",
      okHint: "Estimasi — total akhirnya kami konfirmasi lewat chat sebelum Anda bayar.",
      useCustomLabel: "Pakai buket ini",

      kitSoonEyebrow: "Segera menyusul",
      kitSoonTitle: "Kit DIY-nya masih kami siapkan",
      kitSoonBody: "Kami sedang menggambar panduannya dan menguji kemasannya, supaya pemula bisa membuat satu bunga dalam dua puluh menit. Kalau itu yang Anda cari, beri tahu kami — makin banyak yang menunggu, makin cepat kami luncurkan.",
      kitSoonCta: "Saya mau kitnya →",
      kitSoonSecondary: "Baca FAQ",

      howEyebrow: "Cara dibuat",
      howTitle: "Dikerjakan tangan, lalu dikirim ke Anda",
      steps: [
        ["01 — Potong", "Kelopak dipotong sesuai pola", "Setiap bunga punya polanya sendiri. Chenille dipotong dan disortir per bagian sebelum dirangkai."],
        ["02 — Bentuk", "Setiap kelopak dilengkungkan tangan", "Inti kawat di dalam chenille menerima lengkungan lalu menahannya. Itulah yang membuat kelopaknya terasa tumbuh, bukan sekadar dilipat."],
        ["03 — Rangkai", "Dipasang ke tangkai", "Kelopak disusun melingkari mahkota, dipuntir kencang, lalu daunnya dipasang dan tangkainya dibalut sesuai panjang."],
        ["04 — Bungkus & kirim", "Dikemas seperti saat meninggalkan kami", "Buket diikat dan dibungkus, tangkai satuan dibalut kertas. Keduanya dikirim dalam kotak, dengan kartu perawatan."]
      ],

      matEyebrow: "Bahannya",
      matTitle: "Mengapa chenille bergerak seperti kelopak",
      matCaption: "Gbr. 1 — serat chenille pada inti kawat berpuntir",
      matBody: "Serat chenille yang lembut di atas inti kawat berpuntir: ia menerima lengkungan seperti kelopak sungguhan, lalu menahannya. Itulah yang membuat bunga ini terasa tumbuh, bukan sekadar dilipat.",
      matPoints: [
        ["Bisa dibentuk ulang dengan tangan.", "Kalau kelopak tertekan di perjalanan, cukup lengkungkan kembali — tidak ada yang dilem kaku."],
        ["Ujung kawat dilipat dan dibalut.", "Aman dipegang dan aman diberikan sebagai hadiah."],
        ["Dibuat untuk pajangan dalam ruangan jangka panjang.", "Jauhkan dari lembap dan sinar matahari langsung yang lama."]
      ],

      orderEyebrow: "Pesan",
      orderTitle: "Lengkapi pesanan Anda, lalu lanjut ke checkout",
      finishLabel: "Sentuhan akhir",
      wrapIntro: "Pilih kertas pembungkus untuk bunga Anda. Sudah termasuk dalam harga setiap buket.",
      cardLabel: "Kartu ucapan",
      cardPlaceholder: "mis. Selamat lulus, Sagita — dari kami semua",
      cardNote: "Kosongkan saja kalau tidak perlu. Ditulis tangan di kartu kecil, tanpa biaya tambahan.",
      selectionLabel: "Pilihan Anda",
      includesLabel: "Termasuk",
      continueLabel: "Lanjut ke",
      openLabel: "buka →",
      messageLabel: "chat →",
      channelComingSoon: "segera hadir",
      channelUnavailableNotice: "Listing marketplace segera dibuka. Saat ini pemesanan dilayani langsung via WhatsApp.",
      waDraftNotice: "Membuka draft pesan di WhatsApp (tidak terkirim otomatis).",
      waLabel: "WhatsApp — tanya atau custom",
      orderNote: "Pembayaran dan pengiriman ditangani marketplace resmi, lengkap dengan perlindungan pembelinya.",

      wrapNames: { kraft: "Kraft", cream: "Krem", sage: "Sage", blush: "Blush" },
      wrapLinePrefix: "Pembungkus",
      cardLinePrefix: "Kartu ucapan",
      stemSuffix: "— tangkai jadi",
      customTitleShort: "Buket custom",
      stemIncludes: [
        "{flower} jadi, dirangkai oleh kami",
        "{size}, siap ditaruh di vas",
        "Dibalut kertas, dikemas dalam kotak",
        "Kartu perawatan disertakan"
      ],
      customIncludesTail: [
        "Dibungkus, diikat, dan dikotakkan oleh kami",
        "Dibuat sesuai pesanan — 3–4 hari kerja"
      ],

      faqEyebrow: "Pertanyaan",
      faqTitle: "Sebelum Anda memesan",
      faqs: [
        ["Dikirim dari mana?", "Semuanya dibuat dan dikirim dari Indonesia, ke seluruh nusantara lewat kurir Tokopedia dan Shopee."],
        ["Berapa lama sebelum dikirim?", "Tangkai satuan dan buket kecil butuh 2–3 hari kerja; buket sembilan tangkai ke atas, 3–4 hari."],
        ["Apakah bisa rusak di jalan?", "Buket dibungkus dan dikotakkan dengan kepala bunga terlindungi. Kalau ada kelopak yang tertekan, cukup dibentuk ulang dengan tangan."],
        ["Bisa ganti isi buketnya?", "Bisa — pakai penyusun custom untuk campuran yang tepat, atau chat kami di WhatsApp untuk warna atau ukuran yang belum tercantum."],
        ["Bagaimana cara merawatnya?", "Tanpa air. Pajang di dalam ruangan, jauh dari lembap dan sinar matahari langsung yang lama; bersihkan debu dengan sikat kering dan bentuk ulang kelopak dengan tangan."],
        ["Kit DIY-nya masih ada?", "Masih, hanya belum sekarang — panduan dan kemasannya sedang kami rapikan. Chat kami di WhatsApp kalau Anda mau satu, nanti Anda kami dahulukan."]
      ],

      footerCare: "Pengiriman & perawatan",
      copyright: "© 2026 Komorebi"
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
      tr1d: "Nationwide via the marketplaces.",
      tr2t: "Made in 2–3 working days",
      tr2d: "Bouquets of 9+ stems, 3–4 days.",
      tr3t: "Boxed to arrive intact",
      tr3d: "Any petal can be reshaped by hand.",
      tr4t: "Payment protected",
      tr4d: "Checkout handled by Tokopedia or Shopee.",

      colEyebrow: "The collection",
      colTitle: "Two ways to order",
      colIntro: "Single finished stems, or a bouquet — ours or yours.",
      catOneLabel: "Category 01",
      catOneTitle: "Finished flowers",
      catOneNote: "Four flowers, each assembled by us and sold by the stem.",
      catTwoLabel: "Category 02",
      catTwoTitle: "Bouquets",
      catTwoNote: "Four ready packages, or a custom mix you count out yourself.",

      orderStemLabel: "Order this stem",
      addToBouquetLabel: "Add to bouquet +",
      perStemPrefix: "per stem",

      pkgNames: ["The Posy", "The Handful", "The Armful", "The Grand"],
      pkgBlurbs: [
        "Three stems, one flower or mixed. The desk-and-bedside size.",
        "Five stems with a little more height at the centre. Our most ordered.",
        "Nine stems, mixed colours, full in the hand. Bulk price applies.",
        "Fifteen stems for the occasions that ask for one. Bulk price applies."
      ],
      pkgStemLine: "stems",
      pkgIncludes: [
        "{n} finished stems, mixed flowers",
        "Wrapped in paper, tied with ribbon",
        "Boxed for delivery",
        "Care card included"
      ],
      pkgBtn: "Choose this bouquet",
      pkgBtnActive: "Selected",
      pkgPhotoLabel: "bouquet photo",

      customEyebrow: "Custom bouquet",
      customTitle: "Or count out your own",
      customIntro: "Add the flowers you want and the estimate updates as you go. Minimum three stems; nine or more takes 10% off the flowers.",
      customPickLabel: "Choose your stems",
      resetLabel: "Reset",
      estimateLabel: "Estimate",
      flowersLabel: "Flowers",
      discountLabel: "Bulk discount (9+ stems)",
      wrapFeeLabel: "Wrapping & ribbon",
      estTotalLabel: "Estimated total",
      stemsWord: "stems",
      stemWord: "stem",
      minHint: "Add at least three stems to order a bouquet.",
      okHint: "An estimate — we confirm the final total on chat before you pay.",
      useCustomLabel: "Use this bouquet",

      kitSoonEyebrow: "Coming later",
      kitSoonTitle: "The DIY kit is still in the workshop",
      kitSoonBody: "We're drawing the plates and testing the packs so a beginner can build a flower in twenty minutes. If that's what you came for, tell us — the more people waiting, the sooner we launch it.",
      kitSoonCta: "I want the kit →",
      kitSoonSecondary: "Read the FAQ",

      howEyebrow: "How they're made",
      howTitle: "Made by hand, then sent to you",
      steps: [
        ["01 — Cut", "Petals cut to pattern", "Each flower has its own drawn pattern. Chenille is cut and sorted by part before anything is assembled."],
        ["02 — Shape", "Every petal curved by hand", "The wire core inside the chenille takes a curve and holds it. That is what makes a petal read as grown rather than folded."],
        ["03 — Assemble", "Wound onto the stem", "Petals are layered around the crown, twisted tight, then the leaves go on and the stem is wrapped to length."],
        ["04 — Wrap & send", "Boxed the way it left us", "Bouquets are tied and sleeved, single stems wrapped in paper. Both go out boxed, with a care card."]
      ],

      matEyebrow: "The material",
      matTitle: "Why chenille behaves like a petal",
      matCaption: "Fig. 1 — chenille pile on a twisted wire core",
      matBody: "A soft chenille pile over a twisted wire core: it takes a curve the way a petal does, and then it holds it. That is what makes these flowers read as grown rather than folded.",
      matPoints: [
        ["Reshapes with your fingers.", "If a petal flattens in transit, bend it back — nothing is glued rigid."],
        ["Wire ends folded and wrapped.", "Safe to handle and to hand over as a gift."],
        ["Made for long-lasting indoor display.", "Keep away from moisture and prolonged direct sunlight."]
      ],

      orderEyebrow: "Order",
      orderTitle: "Finish your order, then continue to checkout",
      finishLabel: "Finishing",
      wrapIntro: "Choose the paper we wrap your flowers in. Included in every bouquet price.",
      cardLabel: "Message card",
      cardPlaceholder: "e.g. Happy graduation, Sagita — from all of us",
      cardNote: "Leave it blank if you'd rather not have one. Handwritten on a small card, no extra charge.",
      selectionLabel: "Your selection",
      includesLabel: "Includes",
      continueLabel: "Continue to",
      openLabel: "open →",
      messageLabel: "message →",
      channelComingSoon: "coming soon",
      channelUnavailableNotice: "Marketplace listings opening soon. In the meantime, orders are welcomed directly via WhatsApp.",
      waDraftNotice: "Opens a draft message in WhatsApp (does not send automatically).",
      waLabel: "WhatsApp — ask or customise",
      orderNote: "Payment and delivery are handled by the marketplace, with their buyer protection.",

      wrapNames: { kraft: "Kraft", cream: "Cream", sage: "Sage", blush: "Blush" },
      wrapLinePrefix: "Wrap",
      cardLinePrefix: "Message card",
      stemSuffix: "— finished stem",
      customTitleShort: "Custom bouquet",
      stemIncludes: [
        "{flower}, assembled by us",
        "{size}, ready to place in a vase",
        "Wrapped in paper, boxed for delivery",
        "Care card included"
      ],
      customIncludesTail: [
        "Wrapped, tied and boxed by us",
        "Made to order — 3–4 working days"
      ],

      faqEyebrow: "Questions",
      faqTitle: "Before you order",
      faqs: [
        ["Where do you ship from?", "Everything is made and sent from Indonesia, delivered nationwide through Tokopedia and Shopee couriers."],
        ["How long before it's sent?", "Single stems and small bouquets take 2–3 working days to make; bouquets of nine stems or more, 3–4 days."],
        ["Will it arrive crushed?", "Bouquets are sleeved and boxed with the heads protected. If a petal flattens in transit you can simply bend it back by hand."],
        ["Can I change what's in a bouquet?", "Yes — use the custom builder for the exact mix, or message us on WhatsApp for a palette or a size that isn't listed."],
        ["How do I care for them?", "No water. Display indoors, away from moisture and prolonged direct sunlight; dust gently with a dry brush and reshape petals by hand."],
        ["Are the DIY kits still coming?", "They are, just not yet — we're finishing the instruction plates and the packing. Tell us on WhatsApp if you want one and we'll put you first in line."]
      ],

      footerCare: "Shipping & care",
      copyright: "© 2026 Komorebi"
    }
  }
};
