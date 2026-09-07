/**
 * =============================================================================
 * KOMOREBI CREATIONS — NON-DEVELOPER VISUAL EDITOR (editor.js)
 * =============================================================================
 */

(function () {
  'use strict';

  let isEditMode = false;
  let currentTab = 'links';

  /**
   * Helper: Show transient toast message
   */
  function showToast(msg) {
    let toast = document.querySelector('.editor-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'editor-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  /**
   * Inject Editor Floating Toggle and Bottom Dock
   */
  function injectUI() {
    // Floating button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'editor-toggle-btn';
    toggleBtn.className = 'editor-toggle-btn';
    toggleBtn.type = 'button';
    toggleBtn.innerHTML = `<span>⚙️</span><span>Mode Edit / Editor</span>`;
    document.body.appendChild(toggleBtn);

    // Floating bottom dock
    const dock = document.createElement('div');
    dock.id = 'editor-dock';
    dock.className = 'editor-dock';
    dock.innerHTML = `
      <span class="editor-dock-title"><span>✏️</span> Mode Edit Aktif</span>
      <button type="button" class="editor-dock-btn" id="btn-open-settings">
        <span>⚙️</span> Pengaturan Link & Harga
      </button>
      <button type="button" class="editor-dock-btn btn-save" id="btn-save-local">
        <span>💾</span> Simpan di Browser
      </button>
      <button type="button" class="editor-dock-btn btn-download" id="btn-download-file">
        <span>⬇️</span> Unduh site-content.js
      </button>
      <button type="button" class="editor-dock-btn" id="btn-reset-data" style="color:#C0614E">
        <span>🔄</span> Reset Awal
      </button>
      <button type="button" class="editor-dock-btn btn-close" id="btn-close-editor" title="Tutup Mode Edit">
        ✖ Selesai
      </button>
    `;
    document.body.appendChild(dock);

    // Settings Modal
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'editor-modal-overlay';
    modalOverlay.className = 'editor-modal-overlay';
    modalOverlay.innerHTML = `
      <div class="editor-modal">
        <div class="editor-modal-header">
          <h3 class="editor-modal-title">⚙️ Pengaturan Website (Non-Developer)</h3>
          <button type="button" class="editor-modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="editor-modal-body">
          <div class="editor-tabs">
            <button type="button" class="editor-tab-btn active" data-tab="links">Tautan & Kontak</button>
            <button type="button" class="editor-tab-btn" data-tab="prices">Daftar Harga</button>
            <button type="button" class="editor-tab-btn" data-tab="images">Gambar</button>
            <button type="button" class="editor-tab-btn" data-tab="channels">Fitur / Tombol</button>
          </div>

          <!-- TAB 1: LINKS & CONTACT -->
          <div class="editor-tab-content" id="tab-links">
            <div class="editor-section-card">
              <h4>WhatsApp & Marketplace</h4>
              <div class="form-group">
                <label class="form-label">Nomor WhatsApp (dengan kode negara tanpa +, misal: 6281234567890)</label>
                <input type="text" class="form-input" id="input-whatsapp-number" />
              </div>
              <div class="form-group">
                <label class="form-label">Template Pesan WhatsApp (ID)</label>
                <input type="text" class="form-input" id="input-wa-template-id" />
              </div>
              <div class="form-group">
                <label class="form-label">Template Pesan WhatsApp (EN)</label>
                <input type="text" class="form-input" id="input-wa-template-en" />
              </div>
              <div class="form-group">
                <label class="form-label">Link Tokopedia Toko</label>
                <input type="url" class="form-input" id="input-tokopedia-url" />
              </div>
              <div class="form-group">
                <label class="form-label">Link Shopee Toko</label>
                <input type="url" class="form-input" id="input-shopee-url" />
              </div>
              <div class="form-group">
                <label class="form-label">Link Instagram</label>
                <input type="url" class="form-input" id="input-instagram-url" />
              </div>
            </div>
          </div>

          <!-- TAB 2: PRICES -->
          <div class="editor-tab-content" id="tab-prices" style="display:none">
            <div class="editor-section-card">
              <h4>Bunga Matahari (Sunflower)</h4>
              <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px;">
                <div class="form-group">
                  <label class="form-label">Harga Kit</label>
                  <input type="text" class="form-input" id="price-sunflower-kit" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Tangkai Jadi</label>
                  <input type="text" class="form-input" id="price-sunflower-stem" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Buket</label>
                  <input type="text" class="form-input" id="price-sunflower-bouquet" />
                </div>
              </div>
            </div>

            <div class="editor-section-card" style="margin-top:14px">
              <h4>Mawar (Rose)</h4>
              <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px;">
                <div class="form-group">
                  <label class="form-label">Harga Kit</label>
                  <input type="text" class="form-input" id="price-rose-kit" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Tangkai Jadi</label>
                  <input type="text" class="form-input" id="price-rose-stem" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Buket</label>
                  <input type="text" class="form-input" id="price-rose-bouquet" />
                </div>
              </div>
            </div>

            <div class="editor-section-card" style="margin-top:14px">
              <h4>Tulip</h4>
              <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px;">
                <div class="form-group">
                  <label class="form-label">Harga Kit</label>
                  <input type="text" class="form-input" id="price-tulip-kit" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Tangkai Jadi</label>
                  <input type="text" class="form-input" id="price-tulip-stem" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Buket</label>
                  <input type="text" class="form-input" id="price-tulip-bouquet" />
                </div>
              </div>
            </div>

            <div class="editor-section-card" style="margin-top:14px">
              <h4>Lavender</h4>
              <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px;">
                <div class="form-group">
                  <label class="form-label">Harga Kit</label>
                  <input type="text" class="form-input" id="price-lavender-kit" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Tangkai Jadi</label>
                  <input type="text" class="form-input" id="price-lavender-stem" />
                </div>
                <div class="form-group">
                  <label class="form-label">Harga Buket</label>
                  <input type="text" class="form-input" id="price-lavender-bouquet" />
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 3: IMAGES -->
          <div class="editor-tab-content" id="tab-images" style="display:none">
            <div class="editor-section-card">
              <h4>File Gambar (Path / URL)</h4>
              <div class="form-group">
                <label class="form-label">Hero Image</label>
                <input type="text" class="form-input" id="img-hero" />
              </div>
              <div class="form-group">
                <label class="form-label">Inside Kit Image</label>
                <input type="text" class="form-input" id="img-kit" />
              </div>
              <div class="form-group">
                <label class="form-label">Macro / Material Image</label>
                <input type="text" class="form-input" id="img-macro" />
              </div>
              <div class="form-group">
                <label class="form-label">About Us Image</label>
                <input type="text" class="form-input" id="img-us" />
              </div>
            </div>
          </div>

          <!-- TAB 4: CHANNELS & VISIBILITY -->
          <div class="editor-tab-content" id="tab-channels" style="display:none">
            <div class="editor-section-card">
              <h4>Visibilitas Tombol & Harga</h4>
              <div class="form-group">
                <label class="form-checkbox-label">
                  <input type="checkbox" id="check-show-prices" />
                  <span>Tampilkan Harga di Seluruh Halaman</span>
                </label>
              </div>
              <div class="form-group">
                <label class="form-checkbox-label">
                  <input type="checkbox" id="check-show-tokopedia" />
                  <span>Tampilkan Tombol Tokopedia</span>
                </label>
              </div>
              <div class="form-group">
                <label class="form-checkbox-label">
                  <input type="checkbox" id="check-show-shopee" />
                  <span>Tampilkan Tombol Shopee</span>
                </label>
              </div>
              <div class="form-group">
                <label class="form-checkbox-label">
                  <input type="checkbox" id="check-show-whatsapp" />
                  <span>Tampilkan Tombol WhatsApp</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="editor-modal-footer">
          <button type="button" class="btn-secondary" id="modal-cancel-btn" style="padding:10px 18px">Batal</button>
          <button type="button" class="btn-primary" id="modal-apply-btn" style="padding:10px 22px">Terapkan Perubahan</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    // Event Bindings
    toggleBtn.addEventListener('click', toggleEditMode);
    document.getElementById('btn-close-editor').addEventListener('click', () => setEditMode(false));
    document.getElementById('btn-open-settings').addEventListener('click', openSettingsModal);
    document.getElementById('modal-close-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('modal-apply-btn').addEventListener('click', applyModalSettings);

    document.getElementById('btn-save-local').addEventListener('click', saveToLocalStorage);
    document.getElementById('btn-download-file').addEventListener('click', downloadConfigFile);
    document.getElementById('btn-reset-data').addEventListener('click', resetAllData);

    // Tab switcher in modal
    modalOverlay.querySelectorAll('.editor-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modalOverlay.querySelectorAll('.editor-tab-btn').forEach(b => b.classList.remove('active'));
        modalOverlay.querySelectorAll('.editor-tab-content').forEach(c => (c.style.display = 'none'));

        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const target = document.getElementById(`tab-${tab}`);
        if (target) target.style.display = 'block';
      });
    });

    // Keyboard shortcut Ctrl+Shift+E to toggle edit mode
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        toggleEditMode();
      }
    });
  }

  /**
   * Toggle Edit Mode
   */
  function toggleEditMode() {
    setEditMode(!isEditMode);
  }

  function setEditMode(active) {
    isEditMode = active;
    const body = document.body;
    const toggleBtn = document.getElementById('editor-toggle-btn');
    const dock = document.getElementById('editor-dock');

    if (isEditMode) {
      body.classList.add('edit-mode-active');
      toggleBtn.classList.add('active');
      dock.classList.add('visible');
      enableInlineEditing();
      showToast('✏️ Mode Edit Aktif! Klik langsung teks di halaman untuk mengubahnya.');
    } else {
      body.classList.remove('edit-mode-active');
      toggleBtn.classList.remove('active');
      dock.classList.remove('visible');
      disableInlineEditing();
      showToast('Mode Edit Ditutup.');
    }
  }

  /**
   * Enable direct inline editing on page elements
   */
  function enableInlineEditing() {
    const editables = document.querySelectorAll('[data-editable]');
    editables.forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('blur', handleInlineEdit);
    });

    // Image click handler in edit mode
    document.querySelectorAll('.editable-image-wrapper').forEach(wrapper => {
      wrapper.addEventListener('click', handleImageClick);
    });
  }

  function disableInlineEditing() {
    const editables = document.querySelectorAll('[data-editable]');
    editables.forEach(el => {
      el.removeAttribute('contenteditable');
      el.removeEventListener('blur', handleInlineEdit);
    });

    document.querySelectorAll('.editable-image-wrapper').forEach(wrapper => {
      wrapper.removeEventListener('click', handleImageClick);
    });
  }

  /**
   * Handle on-page direct text editing
   */
  function handleInlineEdit(e) {
    const el = e.target;
    const key = el.dataset.editable;
    if (!key || !window.KomorebiApp) return;

    const data = window.KomorebiApp.getData();
    const curLang = window.KomorebiApp.getCurrentLang();
    const trans = data.translations[curLang] || data.translations.id;

    const newText = el.textContent.trim();
    trans[key] = newText;

    saveToLocalStorage(false); // auto-save quietly
  }

  /**
   * Handle image click to change image path
   */
  function handleImageClick(e) {
    if (!isEditMode) return;
    const imgEl = this.querySelector('img');
    const imageKey = this.dataset.imageKey;
    if (!imgEl || !imageKey || !window.KomorebiApp) return;

    const data = window.KomorebiApp.getData();
    const currentSrc = data.images[imageKey] || imgEl.getAttribute('src');

    const newSrc = prompt('Masukkan nama file gambar baru (misal: img/hero.png) atau tautan URL:', currentSrc);
    if (newSrc && newSrc !== currentSrc) {
      data.images[imageKey] = newSrc.trim();
      imgEl.src = newSrc.trim();
      saveToLocalStorage(false);
      showToast(`Gambar diperbarui menjadi ${newSrc}!`);
    }
  }

  /**
   * Open Settings Modal and populate current values
   */
  function openSettingsModal() {
    if (!window.KomorebiApp) return;
    const data = window.KomorebiApp.getData();

    // Populate Tab 1: Links
    document.getElementById('input-whatsapp-number').value = data.store.whatsappNumber || '';
    document.getElementById('input-wa-template-id').value = data.store.whatsappTemplateId || '';
    document.getElementById('input-wa-template-en').value = data.store.whatsappTemplateEn || '';
    document.getElementById('input-tokopedia-url').value = data.store.tokopediaUrl || '';
    document.getElementById('input-shopee-url').value = data.store.shopeeUrl || '';
    document.getElementById('input-instagram-url').value = data.store.instagramUrl || '';

    // Populate Tab 2: Prices
    if (data.flowers.Sunflower) {
      document.getElementById('price-sunflower-kit').value = data.flowers.Sunflower.prices.Kit || '';
      document.getElementById('price-sunflower-stem').value = data.flowers.Sunflower.prices.Stem || '';
      document.getElementById('price-sunflower-bouquet').value = data.flowers.Sunflower.prices.Bouquet || '';
    }
    if (data.flowers.Rose) {
      document.getElementById('price-rose-kit').value = data.flowers.Rose.prices.Kit || '';
      document.getElementById('price-rose-stem').value = data.flowers.Rose.prices.Stem || '';
      document.getElementById('price-rose-bouquet').value = data.flowers.Rose.prices.Bouquet || '';
    }
    if (data.flowers.Tulip) {
      document.getElementById('price-tulip-kit').value = data.flowers.Tulip.prices.Kit || '';
      document.getElementById('price-tulip-stem').value = data.flowers.Tulip.prices.Stem || '';
      document.getElementById('price-tulip-bouquet').value = data.flowers.Tulip.prices.Bouquet || '';
    }
    if (data.flowers.Lavender) {
      document.getElementById('price-lavender-kit').value = data.flowers.Lavender.prices.Kit || '';
      document.getElementById('price-lavender-stem').value = data.flowers.Lavender.prices.Stem || '';
      document.getElementById('price-lavender-bouquet').value = data.flowers.Lavender.prices.Bouquet || '';
    }

    // Populate Tab 3: Images
    document.getElementById('img-hero').value = data.images.hero || '';
    document.getElementById('img-kit').value = data.images.kit || '';
    document.getElementById('img-macro').value = data.images.macro || '';
    document.getElementById('img-us').value = data.images.us || '';

    // Populate Tab 4: Channels
    document.getElementById('check-show-prices').checked = !!data.store.showPrices;
    document.getElementById('check-show-tokopedia').checked = !!data.store.channels.showTokopedia;
    document.getElementById('check-show-shopee').checked = !!data.store.channels.showShopee;
    document.getElementById('check-show-whatsapp').checked = !!data.store.channels.showWhatsapp;

    document.getElementById('editor-modal-overlay').classList.add('open');
  }

  function closeSettingsModal() {
    document.getElementById('editor-modal-overlay').classList.remove('open');
  }

  /**
   * Apply settings from modal back into siteData
   */
  function applyModalSettings() {
    if (!window.KomorebiApp) return;
    const data = window.KomorebiApp.getData();

    // Tab 1: Links
    data.store.whatsappNumber = document.getElementById('input-whatsapp-number').value.trim();
    data.store.whatsappTemplateId = document.getElementById('input-wa-template-id').value.trim();
    data.store.whatsappTemplateEn = document.getElementById('input-wa-template-en').value.trim();
    data.store.tokopediaUrl = document.getElementById('input-tokopedia-url').value.trim();
    data.store.shopeeUrl = document.getElementById('input-shopee-url').value.trim();
    data.store.instagramUrl = document.getElementById('input-instagram-url').value.trim();

    // Tab 2: Prices
    if (data.flowers.Sunflower) {
      data.flowers.Sunflower.prices.Kit = document.getElementById('price-sunflower-kit').value.trim();
      data.flowers.Sunflower.prices.Stem = document.getElementById('price-sunflower-stem').value.trim();
      data.flowers.Sunflower.prices.Bouquet = document.getElementById('price-sunflower-bouquet').value.trim();
    }
    if (data.flowers.Rose) {
      data.flowers.Rose.prices.Kit = document.getElementById('price-rose-kit').value.trim();
      data.flowers.Rose.prices.Stem = document.getElementById('price-rose-stem').value.trim();
      data.flowers.Rose.prices.Bouquet = document.getElementById('price-rose-bouquet').value.trim();
    }
    if (data.flowers.Tulip) {
      data.flowers.Tulip.prices.Kit = document.getElementById('price-tulip-kit').value.trim();
      data.flowers.Tulip.prices.Stem = document.getElementById('price-tulip-stem').value.trim();
      data.flowers.Tulip.prices.Bouquet = document.getElementById('price-tulip-bouquet').value.trim();
    }
    if (data.flowers.Lavender) {
      data.flowers.Lavender.prices.Kit = document.getElementById('price-lavender-kit').value.trim();
      data.flowers.Lavender.prices.Stem = document.getElementById('price-lavender-stem').value.trim();
      data.flowers.Lavender.prices.Bouquet = document.getElementById('price-lavender-bouquet').value.trim();
    }

    // Tab 3: Images
    data.images.hero = document.getElementById('img-hero').value.trim();
    data.images.kit = document.getElementById('img-kit').value.trim();
    data.images.macro = document.getElementById('img-macro').value.trim();
    data.images.us = document.getElementById('img-us').value.trim();

    // Tab 4: Channels
    data.store.showPrices = document.getElementById('check-show-prices').checked;
    data.store.channels.showTokopedia = document.getElementById('check-show-tokopedia').checked;
    data.store.channels.showShopee = document.getElementById('check-show-shopee').checked;
    data.store.channels.showWhatsapp = document.getElementById('check-show-whatsapp').checked;

    window.KomorebiApp.setData(data);
    saveToLocalStorage(true);
    closeSettingsModal();
    showToast('Pengaturan berhasil diperbarui!');
  }

  /**
   * Save current data to browser localStorage
   */
  function saveToLocalStorage(showFeedback = true) {
    if (!window.KomorebiApp) return;
    try {
      const data = window.KomorebiApp.getData();
      localStorage.setItem('komorebi_custom_data', JSON.stringify(data));
      if (showFeedback) {
        showToast('💾 Berhasil disimpan ke browser!');
      }
    } catch (e) {
      console.error('Error saving to localStorage:', e);
      if (showFeedback) {
        alert('Gagal menyimpan ke browser: ' + e.message);
      }
    }
  }

  /**
   * Download updated site-content.js file for permanent use
   */
  function downloadConfigFile() {
    if (!window.KomorebiApp) return;
    const data = window.KomorebiApp.getData();

    const fileContent = `/**
 * =============================================================================
 * KOMOREBI WEBSITE CONTENT CONFIGURATION (site-content.js)
 * Generated via Komorebi In-Browser Editor
 * =============================================================================
 */

window.KOMOREBI_DATA = ${JSON.stringify(data, null, 2)};
`;

    const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'site-content.js';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(
      '✅ File "site-content.js" berhasil diunduh!\n\n' +
      'Langkah selanjutnya:\n' +
      'Pindahkan atau timpa (replace) file "site-content.js" yang baru ini ke folder website Anda.\n' +
      'Dengan begitu, semua perubahan Anda akan tersimpan secara permanen untuk semua pengunjung website!'
    );
  }

  /**
   * Reset data to default
   */
  function resetAllData() {
    if (confirm('Apakah Anda yakin ingin mengembalikan semua data teks, harga, dan pengaturan ke awal?')) {
      if (window.KomorebiApp) {
        window.KomorebiApp.reloadOriginal();
        showToast('🔄 Website dikembalikan ke data awal.');
      }
    }
  }

  // Initialize editor on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }
})();
