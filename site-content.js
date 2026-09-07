/**
 * =============================================================================
 * KOMOREBI WEBSITE CONTENT CONFIGURATION (site-content.js)
 * =============================================================================
 * 
 * PETUNJUK UNTUK NON-DEVELOPER (INDONESIA):
 * Anda bisa mengubah teks, harga, tautan WhatsApp, Tokopedia, Shopee, dan gambar di sini!
 * Pastikan tanda kutip ("...") dan koma (,) tetap ada dan tidak terhapus.
 * Anda juga bisa mengedit langsung di browser menggunakan tombol "⚙️ Mode Edit" di halaman website!
 * 
 * INSTRUCTIONS FOR NON-DEVELOPERS (ENGLISH):
 * You can edit all texts, prices, links, WhatsApp number, and images here.
 * Make sure quotes ("...") and commas (,) remain intact.
 * You can also use the on-page "⚙️ Edit Mode" button to edit visually!
 * =============================================================================
 */

window.KOMOREBI_DATA = {
  // Store & Contact Links
  store: {
    brandName: "Komorebi",
    tagline: "est. 2026",
    logo: "komorebi-logo.png",
    instagramUrl: "https://instagram.com/komorebi",
    tokopediaUrl: "https://www.tokopedia.com",
    shopeeUrl: "https://shopee.co.id",
    // WhatsApp phone number with country code (e.g. 6281234567890 for Indonesia)
    whatsappNumber: "6281234567890",
    whatsappTemplateId: "Halo Komorebi! Saya ingin memesan {flower} — {format} ({price}). Apakah masih tersedia?",
    whatsappTemplateEn: "Hello Komorebi! I would like to order {flower} — {format} ({price}). Is it available?",
    // Marketplace & Channel visibility toggles
    channels: {
      showTokopedia: true,
      showShopee: true,
      showWhatsapp: true
    },
    showPrices: true
  },

  // General Images used on the landing page
  images: {
    hero: "img/hero.png",
    kit: "img/kit.png",
    macro: "img/macro.png",
    us: "img/us.png"
  },

  // Flower Catalog & Specific Settings
  flowerOrder: ["Sunflower", "Rose", "Tulip", "Lavender"],

  flowers: {
    Sunflower: {
      id: "Sunflower",
      latin: "Helianthus annuus",
      accent: "#C89A3C",
      photo: "img/sunflower.png",
      alt: "Handmade chenille sunflowers with green leaves",
      prices: {
        Kit: "Rp 95.000",
        Stem: "Rp 55.000",
        Bouquet: "Rp 285.000"
      },
      en: {
        name: "Sunflower",
        makes: "3 flowers",
        size: "45 cm stem, 12 cm head",
        blurb: "Our signature. Layered ochre petals and a dense seeded crown."
      },
      id: {
        name: "Bunga Matahari",
        makes: "3 bunga",
        size: "tangkai 45 cm, kepala 12 cm",
        blurb: "Bunga andalan kami. Kelopak oker berlapis dengan mahkota berbiji rapat."
      }
    },
    Rose: {
      id: "Rose",
      latin: "Rosa centifolia",
      accent: "#A8586A",
      photo: "img/rose.png",
      alt: "Handmade chenille roses in dusty pink",
      prices: {
        Kit: "Rp 105.000",
        Stem: "Rp 60.000",
        Bouquet: "Rp 305.000"
      },
      en: {
        name: "Rose",
        makes: "3 flowers",
        size: "40 cm stem",
        blurb: "Spiralled petals wound one by one. The most patient flower in the set."
      },
      id: {
        name: "Mawar",
        makes: "3 bunga",
        size: "tangkai 40 cm",
        blurb: "Kelopak melingkar dipasang satu per satu. Bunga paling menuntut kesabaran."
      }
    },
    Tulip: {
      id: "Tulip",
      latin: "Tulipa gesneriana",
      accent: "#C0614E",
      photo: "img/tulip.png",
      alt: "Handmade chenille tulips with slender leaves",
      prices: {
        Kit: "Rp 85.000",
        Stem: "Rp 50.000",
        Bouquet: "Rp 265.000"
      },
      en: {
        name: "Tulip",
        makes: "4 flowers",
        size: "38 cm stem",
        blurb: "Six clean petals and a single leaf. The easiest first flower to build."
      },
      id: {
        name: "Tulip",
        makes: "4 bunga",
        size: "tangkai 38 cm",
        blurb: "Enam kelopak bersih dan satu daun. Bunga pertama yang paling mudah dibuat."
      }
    },
    Lavender: {
      id: "Lavender",
      latin: "Lavandula angustifolia",
      accent: "#7B6E9B",
      photo: "img/lavender.png",
      alt: "A bundle of handmade chenille lavender spikes",
      prices: {
        Kit: "Rp 90.000",
        Stem: "Rp 65.000",
        Bouquet: "Rp 275.000"
      },
      en: {
        name: "Lavender",
        makes: "9 spikes",
        size: "32 cm stem",
        blurb: "Nine slender spikes to a bundle. Made for narrow vases and desks."
      },
      id: {
        name: "Lavender",
        makes: "9 tangkai",
        size: "tangkai 32 cm",
        blurb: "Sembilan tangkai ramping per ikat. Cocok untuk vas sempit dan meja kerja."
      }
    }
  },

  // Formats definition
  formatKeys: ["Kit", "Stem", "Bouquet"],

  // Bilingual UI Texts
  translations: {
    // BAHASA INDONESIA
    id: {
      navCollection: "Koleksi",
      navKit: "Isi kit",
      navHow: "Cara membuat",
      navFaq: "FAQ",
      navOrder: "Pesan",

      heroEyebrow: "Kit bunga DIY · benang chenille",
      heroTitle: "Bunga yang tak pernah layu — dirangkai tangan Anda sendiri.",
      heroSub: "Satu kit lengkap untuk membuat bunga, setiap bagiannya sudah disiapkan. Bentuk, rangkai, lalu simpan bunga buatan Anda — sekitar 20 menit saja.",
      heroPlateCaption: "Helianthus annuus",
      heroPlatePl: "PL. I",
      ctaBrowse: "Lihat koleksi",
      ctaInside: "Lihat isi kitnya",

      ben1t: "Semua sudah termasuk",
      ben1d: "Bahan, tangkai, lem, dan panduan ada di dalam kotak.",
      ben2t: "Ramah pemula",
      ben2d: "Bahan sudah dipotong dan ada panduan bertahap.",
      ben3t: "Dibuat untuk disimpan",
      ben3d: "Untuk pajangan dalam ruangan yang tahan lama.",

      tr1t: "Dikirim dari Indonesia",
      tr1d: "Ke seluruh Indonesia lewat marketplace.",
      tr2t: "Dikemas 2–3 hari kerja",
      tr2d: "Setiap kit dihitung dengan tangan.",
      tr3t: "Ada bagian yang kurang?",
      tr3d: "Kirim fotonya, kami ganti.",
      tr4t: "Pembayaran terlindungi",
      tr4d: "Checkout lewat Tokopedia atau Shopee.",

      colEyebrow: "Koleksi",
      colTitle: "Empat bunga untuk dipilih",
      colIntro: "Setiap bunga tersedia tiga pilihan — kit untuk dirangkai sendiri, tangkai jadi, atau buket yang kami susun.",
      makesPrefix: "Membuat",
      kitPricePrefix: "Kit",
      buyKitPrefix: "Beli kit",
      buyKitSuffix: "",
      stemLabel: "Tangkai jadi",
      bouquetLabel: "Buket",

      kitEyebrow: "Isi kit Anda",
      kitTitle: "Setiap bagian, tertata sebelum Anda mulai",
      kitIntro: "Satu kit bunga matahari, dibuka. Tidak ada yang perlu dibeli terpisah, tidak ada yang perlu dipotong atau diukur sendiri.",
      kitContents: [
        { title: "Benang chenille pra-potong, tersortir warna", desc: "Dikemas per bagian agar Anda selalu tahu bagian berikutnya." },
        { title: "Tangkai bunga siap pakai", desc: "Sudah dipotong, dibalut, dengan ujung kawat yang dilipat." },
        { title: "Komponen kelopak dan daun", desc: "Dihitung per bunga, plus dua cadangan masing-masing." },
        { title: "Lem", desc: "Satu tube, cukup untuk seluruh kit." },
        { title: "Panduan bergambar", desc: "Langkah bergaya pelat botani, bernomor sesuai kemasannya." },
        { title: "QR code ke video tutorial", desc: "Ikuti sesuai kecepatan Anda, bisa dijeda kapan saja." }
      ],
      specTitle: "Spesifikasi · kit bunga matahari",
      specs: [
        { label: "Menghasilkan", value: "3 bunga" },
        { label: "Ukuran jadi", value: "tangkai 45 cm, kepala 12 cm" },
        { label: "Waktu", value: "±20 menit per bunga" },
        { label: "Tingkat", value: "Pemula" },
        { label: "Usia disarankan", value: "12+" },
        { label: "Anak lebih kecil", value: "Sebaiknya didampingi orang dewasa" }
      ],

      howEyebrow: "Cara membuatnya",
      howTitle: "Empat langkah, sekitar dua puluh menit",
      steps: [
        { kicker: "01 — Buka", title: "Tata panduannya", desc: "Setiap bagian datang terkemas dan bernomor sesuai panduan bergambar, jadi Anda bisa melihat bentuk utuhnya sebelum mulai." },
        { kicker: "02 — Bentuk", title: "Lengkungkan kelopak", desc: "Lipat tiap potongan mengikuti tanda lengkung. Cukup dengan tangan — inti kawatnya menahan bentuk yang Anda beri." },
        { kicker: "03 — Rangkai", title: "Pasang ke tangkai", desc: "Susun kelopak melingkari mahkota, puntir, lalu tambahkan daun. Setetes lem yang disertakan mengunci kepala bunganya." },
        { kicker: "04 — Pajang", title: "Letakkan di dalam ruangan", desc: "Tidak perlu air. Jauhkan dari lembap dan sinar matahari langsung yang lama, bersihkan debunya sesekali, dan bentuk ulang kelopak kapan saja." }
      ],

      matEyebrow: "Bahannya",
      matTitle: "Mengapa chenille bergerak seperti kelopak",
      matCaption: "Gbr. 1 — serat chenille pada inti kawat berpuntir",
      matBody: "Serat chenille yang lembut di atas inti kawat berpuntir: ia menerima lengkungan seperti kelopak sungguhan, lalu menahannya. Itulah yang membuat bunga ini terasa tumbuh, bukan sekadar dilipat.",
      matPoints: [
        { n: "i", lead: "Dirancang untuk dibentuk ulang.", rest: "Salah melengkung? Cukup lengkungkan kembali." },
        { n: "ii", lead: "Ujung kawat sudah dilipat.", rest: "Disarankan untuk usia 12+; anak yang lebih kecil sebaiknya didampingi." },
        { n: "iii", lead: "Dibuat untuk pajangan dalam ruangan jangka panjang.", rest: "Jauhkan dari lembap dan sinar matahari langsung yang lama." }
      ],

      orderEyebrow: "Pesan",
      orderTitle: "Susun pesanan Anda, lalu lanjut ke checkout",
      step1: "Langkah 1 — pilih bunga",
      step2: "Langkah 2 — pilih bentuk",
      step3: "Langkah 3 — lanjut ke",
      selectionLabel: "Pilihan Anda",
      includesLabel: "Termasuk",
      openLabel: "buka →",
      messageLabel: "chat →",
      waLabel: "WhatsApp — tanya atau custom",
      orderNote: "Pembayaran dan pengiriman ditangani marketplace, lengkap dengan perlindungan pembelinya.",

      formats: [
        { key: "Kit", label: "Kit DIY", note: "Anda rangkai sendiri — sekitar 20 menit per bunga" },
        { key: "Stem", label: "Tangkai jadi", note: "Kami rangkai, dibalut kertas" },
        { key: "Bouquet", label: "Buket", note: "5–11 tangkai, disusun dan dibungkus" }
      ],

      includes: {
        Kit: [
          "Benang chenille pra-potong, tersortir warna",
          "Tangkai bunga siap pakai dengan ujung kawat dilipat",
          "Komponen kelopak dan daun, plus cadangan",
          "Lem, panduan bergambar, dan QR video"
        ],
        Stem: [
          "{flower} jadi, dirangkai oleh kami",
          "{size}, siap ditaruh di vas",
          "Dibalut kertas, dikemas dalam kotak",
          "Kartu perawatan disertakan"
        ],
        Bouquet: [
          "5–11 tangkai jadi, disusun oleh kami",
          "Campuran bunga dan warna sesuai permintaan",
          "Diikat, dibungkus, dan dikotakkan",
          "Dibuat sesuai pesanan — chat kami untuk palet khusus"
        ]
      },

      faqEyebrow: "Pertanyaan",
      faqTitle: "Sebelum Anda memesan",
      faqs: [
        { q: "Dikirim dari mana?", a: "Semua kit dikemas dan dikirim dari Indonesia, ke seluruh nusantara lewat kurir Tokopedia dan Shopee." },
        { q: "Berapa lama sebelum dikirim?", a: "Kit dipotong dan dihitung dengan tangan, jadi beri waktu 2–3 hari kerja untuk pengemasan sebelum kurir menjemput." },
        { q: "Bagaimana kalau ada bagian yang kurang?", a: "Kirim foto isi paket yang Anda terima dan kami kirimkan bagian yang kurang tanpa biaya. Setiap kit juga berisi kelopak dan daun cadangan." },
        { q: "Bagaimana kalau paketnya rusak?", a: "Foto paket dan isinya sebelum dibuka lebih jauh, lalu sampaikan ke kami atau ke marketplace — kami ganti komponen yang rusak atau seluruh kitnya." },
        { q: "Aman untuk anak-anak?", a: "Disarankan untuk usia 12 tahun ke atas. Ujung kawat sudah dilipat sebelum dikemas, tetapi anak yang lebih kecil sebaiknya dibantu orang dewasa, terutama saat memakai lem." },
        { q: "Bagaimana cara merawatnya?", a: "Tanpa air. Pajang di dalam ruangan, jauh dari lembap dan sinar matahari langsung yang lama; bersihkan debu dengan sikat kering dan bentuk ulang kelopak dengan tangan." }
      ],

      aboutEyebrow: "Siapa yang membuat",
      aboutLede: "Kami mulai memotong kelopak di meja dapur, satu bunga demi satu bunga, sampai potongannya cukup rapi untuk diberikan kepada orang lain.",
      aboutBody: "Setiap kit masih dipotong, dihitung, dan dikemas oleh kami berdua. Bunga baru ditambahkan setelah kami gambar dan uji — empat sekarang, akan terus bertambah.",
      aboutIg: "Ikuti workshop kami di Instagram",
      footerCare: "Pengiriman & perawatan",
      copyright: "© 2026 Komorebi"
    },

    // ENGLISH
    en: {
      navCollection: "Collection",
      navKit: "Inside the kit",
      navHow: "How it works",
      navFaq: "FAQ",
      navOrder: "Order",

      heroEyebrow: "DIY flower kits · chenille stems",
      heroTitle: "Flowers that never wilt — built by your own hands.",
      heroSub: "A complete flower-making kit with every piece prepared for you. Shape, assemble and keep your handmade bloom — all in about 20 minutes.",
      heroPlateCaption: "Helianthus annuus",
      heroPlatePl: "PL. I",
      ctaBrowse: "Browse the collection",
      ctaInside: "See what's inside",

      ben1t: "Everything included",
      ben1d: "Parts, stem, glue and instructions in the box.",
      ben2t: "Beginner friendly",
      ben2d: "Pre-cut parts and a step-by-step plate.",
      ben3t: "Made to keep",
      ben3d: "For long-lasting indoor display.",

      tr1t: "Ships from Indonesia",
      tr1d: "Nationwide via the marketplaces.",
      tr2t: "Packed in 2–3 working days",
      tr2d: "Every kit counted by hand.",
      tr3t: "Missing a piece?",
      tr3d: "Send a photo and we replace it.",
      tr4t: "Payment protected",
      tr4d: "Checkout handled by Tokopedia or Shopee.",

      colEyebrow: "The collection",
      colTitle: "Four flowers to choose from",
      colIntro: "Each one comes three ways — a kit you build, a finished stem, or a bouquet we arrange.",
      makesPrefix: "Makes",
      kitPricePrefix: "Kit",
      buyKitPrefix: "Buy",
      buyKitSuffix: "kit",
      stemLabel: "Finished stem",
      bouquetLabel: "Bouquet",

      kitEyebrow: "Inside your kit",
      kitTitle: "Every piece, laid out before you begin",
      kitIntro: "One sunflower kit, unpacked. Nothing to buy separately, nothing to cut or measure yourself.",
      kitContents: [
        { title: "Pre-cut chenille stems, sorted by colour", desc: "Bagged by part so you always know which piece is next." },
        { title: "Prepared flower stem", desc: "Cut to length, wrapped, with folded wire ends." },
        { title: "Petal and leaf components", desc: "Counted per flower, plus two spares of each." },
        { title: "Glue", desc: "One tube, enough for the whole kit." },
        { title: "Illustrated instruction plate", desc: "Printed botanical-plate steps, numbered to match the bags." },
        { title: "QR code to the video tutorial", desc: "Follow along at your own pace, pause anywhere." }
      ],
      specTitle: "Specification · sunflower kit",
      specs: [
        { label: "Makes", value: "3 flowers" },
        { label: "Finished size", value: "45 cm stem, 12 cm head" },
        { label: "Time", value: "~20 min per flower" },
        { label: "Difficulty", value: "Beginner" },
        { label: "Recommended age", value: "12+" },
        { label: "Younger makers", value: "Adult supervision recommended" }
      ],

      howEyebrow: "How it works",
      howTitle: "Four steps, about twenty minutes",
      steps: [
        { kicker: "01 — Unpack", title: "Lay out the plate", desc: "Parts come bagged and numbered against the illustrated plate, so you can see the whole flower before you start." },
        { kicker: "02 — Shape", title: "Bend the petals", desc: "Fold each pre-cut length along the marked curve. Hands are enough — the wire core holds the shape you give it." },
        { kicker: "03 — Assemble", title: "Wind onto the stem", desc: "Layer petals around the crown, twist, then add leaves. A drop of the included glue sets the head in place." },
        { kicker: "04 — Display", title: "Place it indoors", desc: "No water needed. Keep away from moisture and prolonged direct sunlight, dust it now and then, reshape a petal whenever you like." }
      ],

      matEyebrow: "The material",
      matTitle: "Why chenille behaves like a petal",
      matCaption: "Fig. 1 — chenille pile on a twisted wire core",
      matBody: "A soft chenille pile over a twisted wire core: it takes a curve the way a petal does, and then it holds it. That is what makes these flowers read as grown rather than folded.",
      matPoints: [
        { n: "i", lead: "Designed to be reshaped.", rest: "Bend a petal wrong and you can simply bend it back." },
        { n: "ii", lead: "Prepared with folded wire ends.", rest: "Recommended for ages 12+; adult supervision for younger makers." },
        { n: "iii", lead: "Made for long-lasting indoor display.", rest: "Keep away from moisture and prolonged direct sunlight." }
      ],

      orderEyebrow: "Order",
      orderTitle: "Build your order, then continue to checkout",
      step1: "Step 1 — choose a flower",
      step2: "Step 2 — choose a format",
      step3: "Step 3 — continue to",
      selectionLabel: "Your selection",
      includesLabel: "Includes",
      openLabel: "open →",
      messageLabel: "message →",
      waLabel: "WhatsApp — ask or customise",
      orderNote: "Payment and delivery are handled by the marketplace, with their buyer protection.",

      formats: [
        { key: "Kit", label: "DIY kit", note: "You build it — about 20 min per flower" },
        { key: "Stem", label: "Finished stem", note: "Assembled by us, wrapped in paper" },
        { key: "Bouquet", label: "Bouquet", note: "5–11 stems, arranged and sleeved" }
      ],

      includes: {
        Kit: [
          "Pre-cut chenille stems, sorted by colour",
          "Prepared flower stem with folded wire ends",
          "Petal and leaf components, plus spares",
          "Glue, illustrated plate and video QR code"
        ],
        Stem: [
          "{flower}, assembled by us",
          "{size}, ready to place in a vase",
          "Wrapped in paper, boxed for delivery",
          "Care card included"
        ],
        Bouquet: [
          "5–11 finished stems, arranged by us",
          "Mixed flowers and colours on request",
          "Tied, sleeved and boxed",
          "Made to order — message us for custom palettes"
        ]
      },

      faqEyebrow: "Questions",
      faqTitle: "Before you order",
      faqs: [
        { q: "Where do you ship from?", a: "All kits are packed and sent from Indonesia, delivered nationwide through Tokopedia and Shopee couriers." },
        { q: "How long before it's sent?", a: "Kits are cut and counted by hand, so allow 2–3 working days for packing before the courier collects." },
        { q: "What if a piece is missing?", a: "Send us a photo of what arrived and we send the missing part at no cost. Every kit also ships with spare petals and leaves." },
        { q: "What if it arrives damaged?", a: "Photograph the parcel and contents before unpacking further and raise it with us or the marketplace — we replace damaged components or the whole kit." },
        { q: "Is it suitable for children?", a: "Recommended for ages 12 and up. Wire ends are folded before packing, but younger makers should work with an adult, especially with the glue." },
        { q: "How do I care for the flowers?", a: "No water. Display indoors, away from moisture and prolonged direct sunlight; dust gently with a dry brush and reshape petals by hand." }
      ],

      aboutEyebrow: "Who makes these",
      aboutLede: "We started cutting petals at a kitchen table, one flower at a time, until the pieces fit together well enough to hand to a stranger.",
      aboutBody: "Every kit is still cut, counted and packed by the two of us. New flowers are added as we draw and test them — four today, more on the way.",
      aboutIg: "Follow the workshop on Instagram",
      footerCare: "Shipping & care",
      copyright: "© 2026 Komorebi"
    }
  }
};
