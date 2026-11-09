/* ============================================================
   SCALE-MANAGER.JS — DPI Scaling & Responsive Zoom Controller
   ============================================================ */

(function () {
  'use strict';

  const ScaleManager = {
    _scale: 1,
    _slider: null,
    _display: null,
    _observers: [],

    init() {
      this._slider = document.getElementById('scale-slider');
      this._display = document.getElementById('scale-value');

      if (this._slider) {
        // Load saved scale
        const saved = localStorage.getItem('app-scale');
        if (saved) {
          this._slider.value = parseFloat(saved) * 100;
        }
        this.setScale(parseInt(this._slider.value, 10) / 100);

        this._slider.addEventListener('input', () => {
          this.setScale(parseInt(this._slider.value, 10) / 100);
        });

        // Double-click to reset
        this._slider.addEventListener('dblclick', () => {
          this._slider.value = 100;
          this.setScale(1);
        });
      }

      // Listen for DPR changes (e.g. dragging window between monitors)
      this._watchDPR();

      // Resize handler
      window.addEventListener('resize', () => this._onResize());
    },

    setScale(value) {
      this._scale = Math.max(0.75, Math.min(1.25, value));
      document.documentElement.style.setProperty('--app-scale', this._scale);
      if (this._display) {
        this._display.textContent = Math.round(this._scale * 100) + '%';
      }
      if (this._slider) {
        this._slider.value = Math.round(this._scale * 100);
      }
      localStorage.setItem('app-scale', this._scale);
      this._notify('scale', this._scale);
    },

    getScale() {
      return this._scale;
    },

    getDPR() {
      return window.devicePixelRatio || 1;
    },

    /**
     * Resize a canvas for Hi-DPI rendering.
     * Call this after the canvas container has been laid out.
     */
    resizeCanvas(canvas) {
      const dpr = this.getDPR();
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true; // resized
      }
      return false; // no change
    },

    /**
     * Subscribe to scale/resize events.
     * callback(eventType, value)
     */
    onChange(callback) {
      this._observers.push(callback);
    },

    _notify(type, value) {
      for (const cb of this._observers) {
        try { cb(type, value); } catch (e) { console.error('ScaleManager observer error:', e); }
      }
    },

    _onResize() {
      this._notify('resize', {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: this.getDPR()
      });
    },

    _watchDPR() {
      let currentDPR = this.getDPR();
      const check = () => {
        const mq = window.matchMedia(`(resolution: ${currentDPR}dppx)`);
        const handler = () => {
          const newDPR = this.getDPR();
          if (newDPR !== currentDPR) {
            currentDPR = newDPR;
            this._notify('dpr', currentDPR);
          }
          check(); // re-register for the new DPR
        };
        if (mq.addEventListener) {
          mq.addEventListener('change', handler, { once: true });
        }
      };
      check();
    }
  };

  window.ScaleManager = ScaleManager;
})();
