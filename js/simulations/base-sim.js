/* ============================================================
   BASE-SIM.JS — Abstract Base Class for All Simulations
   Provides: Hi-DPI canvas, animation loop, play/pause/reset
   ============================================================ */

(function () {
  'use strict';

  class BaseSim {
    /**
     * @param {string} canvasId  - The canvas element ID
     * @param {object} config    - Simulation-specific configuration
     */
    constructor(canvasId, config) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.config = Object.assign({}, config);

      this.running = false;
      this.time = 0;
      this._animId = null;
      this._lastTimestamp = 0;

      // Bind methods for clean callbacks
      this._tick = this._tick.bind(this);
    }

    /** Initialize canvas size and start observing resize */
    init() {
      this.resize();
      this._resizeObserver = new ResizeObserver(() => this.resize());
      if (this.canvas && this.canvas.parentElement) {
        this._resizeObserver.observe(this.canvas.parentElement);
      }
      // Also listen for DPR changes from ScaleManager
      if (window.ScaleManager) {
        window.ScaleManager.onChange((type) => {
          if (type === 'dpr' || type === 'resize' || type === 'scale') {
            this.resize();
          }
        });
      }
      this.onInit();
      this.render();
    }

    /** Resize canvas for Hi-DPI */
    resize() {
      if (!this.canvas) return;
      if (window.ScaleManager) {
        window.ScaleManager.resizeCanvas(this.canvas);
      } else {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = Math.round(rect.width * dpr);
        this.canvas.height = Math.round(rect.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      this.width = this.canvas.getBoundingClientRect().width;
      this.height = this.canvas.getBoundingClientRect().height;
      if (this.running) this.render();
    }

    /** Get effective canvas drawing dimensions (CSS pixels) */
    get W() { return this.width || 0; }
    get H() { return this.height || 0; }

    /** Start animation loop */
    start() {
      if (this.running) return;
      this.running = true;
      this._lastTimestamp = performance.now();
      this._animId = requestAnimationFrame(this._tick);
    }

    /** Stop animation loop */
    stop() {
      this.running = false;
      if (this._animId) {
        cancelAnimationFrame(this._animId);
        this._animId = null;
      }
    }

    /** Toggle play/pause */
    toggle() {
      this.running ? this.stop() : this.start();
    }

    /** Reset simulation to initial state */
    reset() {
      this.stop();
      this.time = 0;
      this.onReset();
      this.render();
    }

    /** Destroy and clean up */
    destroy() {
      this.stop();
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
      }
    }

    /** Animation frame handler */
    _tick(timestamp) {
      if (!this.running) return;

      // Calculate delta time in seconds, capped at 50ms
      let dt = (timestamp - this._lastTimestamp) / 1000;
      this._lastTimestamp = timestamp;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0 || isNaN(dt)) dt = 0;

      // Apply sim speed setting
      if (window.SettingsManager) {
        dt *= window.SettingsManager.get('simSpeed');
      }

      this.time += dt;
      this.update(dt);
      this.render();

      this._animId = requestAnimationFrame(this._tick);
    }

    // --- Override These in Subclasses ---

    /** Called after init, set up initial state */
    onInit() {}

    /** Called on reset, restore initial state */
    onReset() {}

    /**
     * Physics step
     * @param {number} dt - Delta time in seconds (already scaled by simSpeed)
     */
    update(dt) {}

    /** Render the current state to canvas */
    render() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.W, this.H);
    }

    // --- Utility Methods ---

    /** Draw an arrow from (x1,y1) to (x2,y2) */
    drawArrow(x1, y1, x2, y2, color, lineWidth) {
      const ctx = this.ctx;
      const headLen = 8 * (lineWidth || 2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lineWidth || 2;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    /** Draw a zigzag spring from (x,y1) to (x,y2) */
    drawSpring(x, y1, y2, coils, amplitude, color, lineWidth) {
      const ctx = this.ctx;
      const len = y2 - y1;
      const segLen = len / (coils * 2);

      ctx.save();
      ctx.strokeStyle = color || '#00e5ff';
      ctx.lineWidth = lineWidth || 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(x, y1);

      for (let i = 0; i < coils * 2; i++) {
        const yMid = y1 + segLen * (i + 0.5);
        const xOff = (i % 2 === 0 ? amplitude : -amplitude);
        ctx.lineTo(x + xOff, yMid);
      }
      ctx.lineTo(x, y2);
      ctx.stroke();
      ctx.restore();
    }

    /** Draw a damper (dashpot) from (x,y1) to (x,y2) */
    drawDamper(x, y1, y2, width, color) {
      const ctx = this.ctx;
      const midY = (y1 + y2) / 2;
      const half = width / 2;
      const pistonTop = midY - (y2 - y1) * 0.15;
      const pistonBot = midY + (y2 - y1) * 0.15;

      ctx.save();
      ctx.strokeStyle = color || '#9e9eb8';
      ctx.lineWidth = 1.5;

      // Rod from top
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, pistonTop);
      ctx.stroke();

      // Piston head
      ctx.beginPath();
      ctx.moveTo(x - half * 0.6, pistonTop);
      ctx.lineTo(x + half * 0.6, pistonTop);
      ctx.stroke();

      // Cylinder
      ctx.strokeRect(x - half, pistonBot, width, (y2 - y1) * 0.35);

      // Rod from bottom
      ctx.beginPath();
      ctx.moveTo(x, pistonBot + (y2 - y1) * 0.35);
      ctx.lineTo(x, y2);
      ctx.stroke();

      ctx.restore();
    }

    /** Format a number for display */
    fmt(n, decimals) {
      return Number(n).toFixed(decimals === undefined ? 2 : decimals);
    }
  }

  window.BaseSim = BaseSim;
})();
