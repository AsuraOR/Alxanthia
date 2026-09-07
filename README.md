# 🌸 Komorebi Creations — Website & Guide

Official website for **Komorebi Creations (DIY Flower Kit)** with 1:1 botanical aesthetics, responsive layout, and custom domain configuration.

---

## 🔒 Private Access Passcode Protection

The website is protected with a private botanical lock screen so that only you and your girlfriend can access it.

- **Current Passcode**: `22062024`
- **How it works**:
  - When you visit `komorebicreations.com`, an elegant botanical lock screen appears asking for the passcode.
  - Enter `22062024` and press **Unlock →**.
  - **Auto-Remembered**: Your browser automatically saves the unlocked status, so neither of you will have to re-enter the code on your devices.
  - **Lock Site Button**: A subtle "Lock Site" button is placed in the footer if you ever want to re-lock the website on any device.

### How to Change the Passcode:
Open `site-content.js` in VS Code and edit line 21:
```javascript
auth: {
  enabled: true,
  passcode: "22062024" // Change this to any passcode you like
}
```

---

## ✏️ How to Edit Texts, Prices, Links & Images in VS Code

All website content is cleanly separated and well-commented in:
👉 **`site-content.js`**

Open `site-content.js` in **VS Code** or any text editor:

### 1. Store Links & Contact:
```javascript
store: {
  brandName: "Komorebi",
  instagramUrl: "https://instagram.com/komorebi",
  tokopediaUrl: "https://www.tokopedia.com",
  shopeeUrl: "https://shopee.co.id",
  whatsappNumber: "6281234567890", // Update with your WhatsApp number
  ...
}
```

### 2. Product Prices:
```javascript
Sunflower: {
  prices: {
    Kit: "Rp 95.000",
    Stem: "Rp 55.000",
    Bouquet: "Rp 285.000"
  }
}
```

### 3. Website Texts (Indonesian & English):
- `id:` Contains all Indonesian texts (titles, blurbs, steps, FAQs, about story).
- `en:` Contains all English texts.

After editing, simply save the file (**`Ctrl + S`**) and refresh your browser (**`F5`**).

---

## 📦 Files to Upload to GitHub

```text
komorebi-creations/
├── index.html            ✅ Main website page (with private lock screen)
├── styles.css            ✅ Botanical stylesheet
├── site-content.js       ✅ Content data, prices, links & passcode
├── app.js                ✅ Website logic, WhatsApp generator & passcode verifier
├── CNAME                 ✅ Domain file (komorebicreations.com)
├── komorebi-logo.png     ✅ Brand logo
├── README.md             ✅ Guide & documentation
└── img/                  ✅ High-resolution botanical photos
    ├── hero.png
    ├── kit.png
    ├── lavender.png
    ├── macro.png
    ├── rose.png
    ├── sunflower.png
    ├── tulip.png
    └── us.png
```
