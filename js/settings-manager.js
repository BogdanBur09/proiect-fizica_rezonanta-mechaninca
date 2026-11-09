/* ============================================================
   SETTINGS-MANAGER.JS — Global Settings Fallback Modal
   ============================================================ */

(function () {
  'use strict';

  const DEFAULTS = {
    targetFPS: 60,
    fontSize: 100,      // percent
    simSpeed: 1.0,      // time step multiplier
    showVectors: true,
    showGraph: true,
    showHUD: true,
    highContrast: false,
    theme: 'dark'        // 'dark' or 'light' (reserved for future)
  };

  const SettingsManager = {
    _modal: null,
    _settings: {},
    _observers: [],

    init() {
      // Load saved settings
      const saved = localStorage.getItem('app-settings');
      this._settings = Object.assign({}, DEFAULTS, saved ? JSON.parse(saved) : {});

      // Cache DOM
      this._modal = document.getElementById('settings-modal');
      const closeBtn = document.getElementById('settings-close');
      const backdrop = this._modal ? this._modal.querySelector('.settings-modal__backdrop') : null;

      // Events
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      if (backdrop) backdrop.addEventListener('click', () => this.close());

      const settingsBtn = document.getElementById('settings-btn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => this.toggle());
      }

      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) this.close();
      });

      // Build modal contents
      this._buildUI();

      // Apply initial settings
      this._applyAll();
    },

    get(key) {
      return this._settings[key] !== undefined ? this._settings[key] : DEFAULTS[key];
    },

    set(key, value) {
      this._settings[key] = value;
      this._save();
      this._notify(key, value);
    },

    isOpen() {
      return this._modal && this._modal.classList.contains('open');
    },

    open() {
      if (this._modal) {
        this._modal.classList.add('open');
        this._syncUI();
      }
    },

    close() {
      if (this._modal) this._modal.classList.remove('open');
    },

    toggle() {
      this.isOpen() ? this.close() : this.open();
    },

    onChange(callback) {
      this._observers.push(callback);
    },

    resetAll() {
      this._settings = Object.assign({}, DEFAULTS);
      this._save();
      this._applyAll();
      this._syncUI();
      for (const key of Object.keys(DEFAULTS)) {
        this._notify(key, DEFAULTS[key]);
      }
    },

    _save() {
      localStorage.setItem('app-settings', JSON.stringify(this._settings));
    },

    _notify(key, value) {
      for (const cb of this._observers) {
        try { cb(key, value); } catch (e) { console.error('SettingsManager observer error:', e); }
      }
    },

    _applyAll() {
      // Apply font size
      document.documentElement.style.setProperty(
        '--settings-font-scale',
        this._settings.fontSize / 100
      );
    },

    _buildUI() {
      const body = this._modal ? this._modal.querySelector('.settings-modal__body') : null;
      if (!body) return;

      body.innerHTML = `
        <!-- Display Group -->
        <div class="settings-group">
          <div class="settings-group__title">Afișare</div>

          <div class="setting-row">
            <div class="setting-row__label">
              Mărime Font
              <small>Ajustează dimensiunea textului</small>
            </div>
            <input type="range" id="set-font-size" min="80" max="130" step="5" value="${this._settings.fontSize}">
            <span class="setting-row__value" id="set-font-size-val">${this._settings.fontSize}%</span>
          </div>

          <div class="setting-row">
            <div class="setting-row__label">
              Contrast Ridicat
              <small>Mărește contrastul culorilor</small>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="set-high-contrast" ${this._settings.highContrast ? 'checked' : ''}>
              <span class="toggle-switch__slider"></span>
            </label>
          </div>
        </div>

        <!-- Simulation Group -->
        <div class="settings-group">
          <div class="settings-group__title">Simulare</div>

          <div class="setting-row">
            <div class="setting-row__label">
              FPS Țintă
              <small>Rata de cadre a simulării</small>
            </div>
            <select id="set-fps">
              <option value="30" ${this._settings.targetFPS === 30 ? 'selected' : ''}>30 FPS</option>
              <option value="60" ${this._settings.targetFPS === 60 ? 'selected' : ''}>60 FPS</option>
            </select>
          </div>

          <div class="setting-row">
            <div class="setting-row__label">
              Viteza Simulării
              <small>Multiplicator pas de timp (Δt)</small>
            </div>
            <input type="range" id="set-sim-speed" min="0.1" max="3.0" step="0.1" value="${this._settings.simSpeed}">
            <span class="setting-row__value" id="set-sim-speed-val">${this._settings.simSpeed.toFixed(1)}×</span>
          </div>

          <div class="setting-row">
            <div class="setting-row__label">
              Afișează Vectori Forță
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="set-show-vectors" ${this._settings.showVectors ? 'checked' : ''}>
              <span class="toggle-switch__slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-row__label">
              Afișează Grafic Rezonanță
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="set-show-graph" ${this._settings.showGraph ? 'checked' : ''}>
              <span class="toggle-switch__slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-row__label">
              Afișează HUD
              <small>Info tehnic pe canvas</small>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="set-show-hud" ${this._settings.showHUD ? 'checked' : ''}>
              <span class="toggle-switch__slider"></span>
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-modal__actions">
          <button class="sim-btn sim-btn--danger" id="set-reset-all">↺ Resetează Tot</button>
          <button class="sim-btn sim-btn--primary" id="set-close-btn">✓ Închide</button>
        </div>
      `;

      // Bind events
      this._bindControl('set-font-size', 'fontSize', 'range', 'set-font-size-val', v => v + '%');
      this._bindControl('set-sim-speed', 'simSpeed', 'range', 'set-sim-speed-val', v => parseFloat(v).toFixed(1) + '×');
      this._bindToggle('set-high-contrast', 'highContrast');
      this._bindToggle('set-show-vectors', 'showVectors');
      this._bindToggle('set-show-graph', 'showGraph');
      this._bindToggle('set-show-hud', 'showHUD');

      const fpsSelect = document.getElementById('set-fps');
      if (fpsSelect) {
        fpsSelect.addEventListener('change', () => {
          this.set('targetFPS', parseInt(fpsSelect.value, 10));
        });
      }

      const resetBtn = document.getElementById('set-reset-all');
      if (resetBtn) resetBtn.addEventListener('click', () => this.resetAll());

      const closeBtn2 = document.getElementById('set-close-btn');
      if (closeBtn2) closeBtn2.addEventListener('click', () => this.close());
    },

    _bindControl(inputId, key, type, displayId, formatter) {
      const input = document.getElementById(inputId);
      const display = document.getElementById(displayId);
      if (!input) return;

      input.addEventListener('input', () => {
        const val = type === 'range' ? parseFloat(input.value) : input.value;
        this.set(key, val);
        if (display && formatter) display.textContent = formatter(val);
        if (key === 'fontSize') this._applyAll();
      });
    },

    _bindToggle(inputId, key) {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.addEventListener('change', () => {
        this.set(key, input.checked);
      });
    },

    _syncUI() {
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
      const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      setVal('set-font-size', this._settings.fontSize);
      setTxt('set-font-size-val', this._settings.fontSize + '%');
      setVal('set-sim-speed', this._settings.simSpeed);
      setTxt('set-sim-speed-val', this._settings.simSpeed.toFixed(1) + '×');
      setVal('set-fps', this._settings.targetFPS);
      setChk('set-high-contrast', this._settings.highContrast);
      setChk('set-show-vectors', this._settings.showVectors);
      setChk('set-show-graph', this._settings.showGraph);
      setChk('set-show-hud', this._settings.showHUD);
    }
  };

  window.SettingsManager = SettingsManager;
})();
