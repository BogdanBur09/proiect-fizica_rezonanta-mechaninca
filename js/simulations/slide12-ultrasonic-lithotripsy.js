/* ============================================================
   SLIDE12-ULTRASONIC-LITHOTRIPSY.JS — Extracorporeal Shock Wave
   Lithotripsy (ESWL), Rayleigh-Plesset Cavitation, Spalling Fracture
   & CUSA (23 kHz) Ultrasonic Surgical Dissection
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  // --- Physical Constants for Dimensionless Rayleigh-Plesset Solver ---
  // Water/urine at 37 °C, equilibrium microbubble radius R0 = 15 μm
  const RP_RHO = 1000.0;        // kg/m^3
  const RP_P0 = 101325.0;       // Pa (1 atm)
  const RP_PV = 6280.0;         // Pa (vapor pressure at 37 °C)
  const RP_SIGMA = 0.070;       // N/m (surface tension)
  const RP_MU_EFF = 0.015;      // Pa·s (viscous + acoustic radiation damping)
  const RP_R0_UM = 15.0;        // μm
  const RP_R0_M = 15e-6;        // m

  // Dimensionless groups (exact equilibrium: PG_DIM + PV_DIM - 1.0 - WE_INV === 0)
  const RP_WE_INV = (2.0 * RP_SIGMA) / (RP_R0_M * RP_P0);
  const RP_PV_DIM = RP_PV / RP_P0;
  const RP_PG_DIM = 1.0 + RP_WE_INV - RP_PV_DIM;
  const RP_RE4_INV = (4.0 * RP_MU_EFF) / (RP_R0_M * Math.sqrt(RP_RHO * RP_P0));

  const SIGMA_FOCUS_MM = 5.5;   // Gaussian focal beam waist (mm)
  const TAU_PER_SEC = 42.0;     // Visual time-stretch factor for cavitation dynamics

  // Stone acoustic & mechanical material profiles (urine Z_w = 1.50 MRayl)
  const STONE_MATERIALS = {
    urate: {
      key: 'urate',
      label: 'Urat (Moale)',
      shortLabel: 'Urat',
      zMRayl: 3.64,
      rSw: -0.416,
      pThresh: 14.0,
      kMat: 8.2,
      baseFill: '#d97706',
      hiFill: '#fbbf24',
      darkFill: '#78350f',
      edgeStroke: '#f59e0b'
    },
    oxalate: {
      key: 'oxalate',
      label: 'Oxalat CaOx (Dur)',
      shortLabel: 'Oxalat',
      zMRayl: 8.00,
      rSw: -0.684,
      pThresh: 26.0,
      kMat: 6.2,
      baseFill: '#94a3b8',
      hiFill: '#e2e8f0',
      darkFill: '#475569',
      edgeStroke: '#cbd5e1'
    }
  };

  // --- Canvas Safety Helpers ---
  function clamp(v, lo, hi) {
    if (!Number.isFinite(v)) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function safeArc(ctx, x, y, r, a0, a1, ccw) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) ||
        !Number.isFinite(a0) || !Number.isFinite(a1)) {
      return;
    }
    ctx.arc(x, y, Math.max(0.1, r), a0, a1, !!ccw);
  }

  function safeLinearGrad(ctx, x0, y0, x1, y1) {
    if (!Number.isFinite(x0) || !Number.isFinite(y0) ||
        !Number.isFinite(x1) || !Number.isFinite(y1)) {
      return null;
    }
    if (Math.abs(x1 - x0) < 1e-4 && Math.abs(y1 - y0) < 1e-4) {
      return null;
    }
    return ctx.createLinearGradient(x0, y0, x1, y1);
  }

  function safeRadialGrad(ctx, x0, y0, r0, x1, y1, r1) {
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(r0) ||
        !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(r1)) {
      return null;
    }
    return ctx.createRadialGradient(
      x0, y0, Math.max(0, r0),
      x1, y1, Math.max(0.1, r1)
    );
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
        !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return;
    }
    const rad = Math.max(0, Math.min(r || 0, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  // Deterministic pseudo-random helper for repeatable geometry
  function seededRand(seed) {
    let s = (seed | 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // C1-smooth ESWL focal shock waveform normalized to [-0.25, +1.00]
  function shockPulseNorm(u) {
    if (!Number.isFinite(u) || u < -0.15 || u > 12.0) return 0.0;
    if (u < 0.0) {
      const s = Math.sin((Math.PI * (u + 0.15)) / 0.30);
      return s * s;
    }
    return (1.0 - 1.2555 * u) * Math.exp(-0.90 * u);
  }

  class UltrasonicLithotripsySim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config || {});

      // --- Parameters & Defaults ---
      const cfg = this.config;
      this.defaultRate = Number.isFinite(cfg.rate) ? clamp(cfg.rate, 0.5, 4.0) : 1.5;
      this.defaultPressure = Number.isFinite(cfg.pressure) ? clamp(cfg.pressure, 15, 60) : 40;
      this.defaultOffset = Number.isFinite(cfg.focalOffset) ? clamp(cfg.focalOffset, -15, 15) : 0;
      this.defaultStoneType = cfg.stoneType === 'oxalate' ? 'oxalate' : 'urate';

      this.rate = this.defaultRate;               // Shock repetition rate (Hz)
      this.pressureMPa = this.defaultPressure;    // Peak focal positive pressure (MPa)
      this.focalOffsetMm = this.defaultOffset;    // Offset from F2_0 (mm)
      this.stoneType = this.defaultStoneType;     // 'urate' | 'oxalate'
      this.mode = 'auto';                         // 'auto' | 'single' | 'cusa'
      this.cusaMode = false;

      // --- ESWL Shock & Fracture State ---
      this.shockCount = 0;
      this.stoneIntegrity = 100.0;                // 100% -> 0%
      this.cusaEmulsified = 0.0;                  // 0% -> 100% in CUSA mode
      this._autoCooldown = 0.32;                  // First shock launches promptly
      this.wavefronts = [];                       // Propagating wavefronts F1 -> F2
      this.activePulses = [];                     // Focal pulses driving RP & waveform
      this.spallFlash = 0.0;                      // Posterior tensile spalling intensity
      this.compressSweep = 0.0;                   // Forward compression front progress
      this.sparkFlash = 0.0;                      // Spark discharge glow at F1
      this.collapseFlash = 0.0;                   // Cavitation micro-jet flash at F2

      // --- Dimensionless Rayleigh-Plesset Cavitation State ---
      this.rpR = 1.0;                             // R / R0
      this.rpV = 0.0;                             // d(R/R0)/d(tau)
      this.rpTau = 0.0;                           // Dimensionless time
      this.rpMaxRecent = 1.0;
      this.rpMinRecent = 1.0;

      // --- Telemetry History Ring Buffers ---
      this.historyMax = 220;
      this.pHistory = [];                         // Instantaneous P(t) [MPa]
      this.rpHistory = [];                        // R(t)/R0
      this._histAccum = 0;
      this._binPeakP = 0;
      this._initHistoryBuffers();

      // --- Stone Polygon, Cracks, Shards, Bubbles, Powder & CUSA Particles ---
      this._stoneVerts = [];
      this._shards = [];
      this._cracks = [];
      this._bubbles = [];
      this._powder = [];
      this._suctionDroplets = [];
      this._buildStoneGeometry();
      this._buildCavitationCluster();

      // --- Canvas Drag / Hit Geometry ---
      this._dragAxis = 'y';                       // 'y' (radial) or 'x' (axial)
      this.isDraggingFocus = false;
      this._dragStartPos = { x: 0, y: 0 };
      this._dragStartOffset = 0;
      this._stageHit = {
        x: 0, y: 0, w: 0, h: 0,
        stoneX: 0, stoneY: 0, f2X: 0, f2Y: 0, pxPerMm: 2.2
      };

      // --- Bound Listener References (cleaned up in destroy()) ---
      this._boundCanvasDown = null;
      this._boundCanvasMove = null;
      this._boundTouchStart = null;
      this._boundTouchMove = null;
      this._boundWinUp = null;
      this._boundWinTouchEnd = null;
      this._bindCanvasEvents();
    }

    _initHistoryBuffers() {
      this.pHistory = [];
      this.rpHistory = [];
      for (let i = 0; i < this.historyMax; i++) {
        this.pHistory.push(0);
        this.rpHistory.push(1.0);
      }
    }

    _buildStoneGeometry() {
      const rng = seededRand(12042);
      const nVerts = 14;
      this._stoneVerts = [];
      for (let i = 0; i < nVerts; i++) {
        const ang = (i / nVerts) * Math.PI * 2;
        const radScale = 0.80 + 0.34 * rng();
        this._stoneVerts.push({
          ang,
          r: radScale,
          jx: (rng() - 0.5) * 0.08,
          jy: (rng() - 0.5) * 0.08
        });
      }

      // 5 fracture shards for integrity < 60%
      this._shards = [];
      for (let s = 0; s < 5; s++) {
        const a0 = (s / 5) * Math.PI * 2 - 0.3;
        const a1 = ((s + 1) / 5) * Math.PI * 2 - 0.3;
        const midA = 0.5 * (a0 + a1);
        this._shards.push({
          a0,
          a1,
          dirX: Math.cos(midA),
          dirY: Math.sin(midA),
          rotSign: (s % 2 === 0 ? 1 : -1) * (0.3 + 0.5 * rng()),
          scale: 0.85 + 0.25 * rng()
        });
      }

      // Deterministic depth-3 fractal crack tree emanating from posterior spall wall & center
      this._cracks = [];
      const addBranch = (x, y, angle, len, depth, threshBase) => {
        if (depth <= 0 || len < 0.06) return;
        const jitter = (rng() - 0.5) * 0.45;
        const x2 = x + Math.cos(angle + jitter) * len;
        const y2 = y + Math.sin(angle + jitter) * len;
        this._cracks.push({
          x1: x, y1: y, x2, y2,
          depth,
          thresh: clamp(threshBase, 0.03, 0.94)
        });
        const subThresh = threshBase + 0.14 + 0.12 * rng();
        addBranch(x2, y2, angle + 0.48 + (rng() - 0.5) * 0.25, len * 0.68, depth - 1, subThresh);
        addBranch(x2, y2, angle - 0.48 + (rng() - 0.5) * 0.25, len * 0.65, depth - 1, subThresh + 0.05);
      };

      // Primary spalling cracks originating near posterior wall (right side x ~ +0.65)
      addBranch(0.62, -0.05, Math.PI + 0.18, 0.52, 3, 0.04);
      addBranch(0.58, 0.22, Math.PI - 0.32, 0.48, 3, 0.09);
      addBranch(0.55, -0.30, Math.PI + 0.42, 0.44, 3, 0.14);
      // Secondary central & anterior shear cracks
      addBranch(-0.10, 0.08, 0.55, 0.42, 3, 0.28);
      addBranch(-0.15, -0.18, -0.68, 0.40, 3, 0.35);
    }

    _buildCavitationCluster() {
      const rng = seededRand(99173);
      this._bubbles = [];
      for (let i = 0; i < 22; i++) {
        const ang = rng() * Math.PI * 2;
        const dist = Math.sqrt(rng()); // 0..1 normalized radius around F2
        this._bubbles.push({
          dxNorm: Math.cos(ang) * dist,
          dyNorm: Math.sin(ang) * dist,
          baseR: 1.6 + rng() * 2.5,
          phase: rng() * Math.PI * 2
        });
      }
    }

    _spawnPowderBurst(count, fullShatter) {
      const rng = seededRand((this.shockCount * 7919 + 313) | 0);
      const n = Math.min(count, 110 - this._powder.length);
      for (let i = 0; i < n; i++) {
        const ang = rng() * Math.PI * 2;
        const spd = fullShatter ? (12 + rng() * 44) : (8 + rng() * 24);
        const rad = fullShatter ? (0.8 + rng() * 1.6) : (0.7 + rng() * 1.2);
        this._powder.push({
          ox: (rng() - 0.5) * 0.85,
          oy: (rng() - 0.5) * 0.85,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd + (fullShatter ? 6 : 2),
          r: rad,
          life: 1.0,
          decay: fullShatter ? (0.04 + rng() * 0.05) : (0.35 + rng() * 0.35),
          persistent: !!fullShatter
        });
      }
    }

    // --- Effective Gaussian Focal Attenuation ---
    _getFocusFactor() {
      const off = this.focalOffsetMm;
      return Math.exp(-(off * off) / (2.0 * SIGMA_FOCUS_MM * SIGMA_FOCUS_MM));
    }

    _getEffectivePressureMPa() {
      return this.pressureMPa * this._getFocusFactor();
    }

    // --- DOM Lifecycle ---
    onInit() {
      const rateSlider = document.getElementById('sim12-rate');
      const rateVal = document.getElementById('sim12-rate-val');
      if (rateSlider) {
        rateSlider.value = String(this.rate);
        rateSlider.addEventListener('input', (e) => {
          this.setRate(parseFloat(e.target.value));
        });
      }
      if (rateVal) {
        rateVal.textContent = `${this.rate.toFixed(1)} Hz`;
      }

      const pressSlider = document.getElementById('sim12-pressure');
      const pressVal = document.getElementById('sim12-pressure-val');
      if (pressSlider) {
        pressSlider.value = String(Math.round(this.pressureMPa));
        pressSlider.addEventListener('input', (e) => {
          this.setPressure(parseFloat(e.target.value));
        });
      }
      if (pressVal) {
        pressVal.textContent = `${Math.round(this.pressureMPa)} MPa`;
      }

      const offSlider = document.getElementById('sim12-offset');
      const offVal = document.getElementById('sim12-offset-val');
      if (offSlider) {
        offSlider.value = String(Math.round(this.focalOffsetMm));
        offSlider.addEventListener('input', (e) => {
          this.setFocalOffset(parseFloat(e.target.value));
        });
      }
      if (offVal) {
        const off = Math.round(this.focalOffsetMm);
        offVal.textContent = `${off > 0 ? '+' : ''}${off} mm`;
      }

      // Presets (every lookup strictly independent & null-guarded)
      const btnSingle = document.getElementById('sim12-preset-single');
      if (btnSingle) {
        btnSingle.addEventListener('click', () => this.triggerSingleShock());
      }

      const btnAuto = document.getElementById('sim12-preset-auto');
      if (btnAuto) {
        btnAuto.addEventListener('click', () => this.enableAutoMode());
      }

      const btnStone = document.getElementById('sim12-preset-stone');
      if (btnStone) {
        btnStone.addEventListener('click', () => this.toggleStoneType());
      }

      const btnCusa = document.getElementById('sim12-preset-cusa');
      if (btnCusa) {
        btnCusa.addEventListener('click', () => this.toggleCusaMode());
      }

      // Actions
      const playBtn = document.getElementById('sim12-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          this._syncPlayButton();
        });
      }

      const resetBtn = document.getElementById('sim12-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          this.start();
          this._syncPlayButton();
        });
      }

      this._syncSlidersAndReadouts();
      this._syncPresetButtons();
      this._syncStoneButtonLabel();
      this._syncPlayButton();
      this._updateUIBadges();
    }

    onReset() {
      this.rate = this.defaultRate;
      this.pressureMPa = this.defaultPressure;
      this.focalOffsetMm = this.defaultOffset;
      this.stoneType = this.defaultStoneType;
      this.mode = 'auto';
      this.cusaMode = false;

      this.shockCount = 0;
      this.stoneIntegrity = 100.0;
      this.cusaEmulsified = 0.0;
      this._autoCooldown = 0.32;
      this.wavefronts = [];
      this.activePulses = [];
      this.spallFlash = 0.0;
      this.compressSweep = 0.0;
      this.sparkFlash = 0.0;
      this.collapseFlash = 0.0;
      this._powder = [];
      this._suctionDroplets = [];

      this.rpR = 1.0;
      this.rpV = 0.0;
      this.rpTau = 0.0;
      this.rpMaxRecent = 1.0;
      this.rpMinRecent = 1.0;
      this._histAccum = 0;
      this._binPeakP = 0;
      this._initHistoryBuffers();

      this._syncSlidersAndReadouts();
      this._syncPresetButtons();
      this._syncStoneButtonLabel();
      this._syncPlayButton();
      this._updateUIBadges();
    }

    start() {
      super.start();
      this._syncPlayButton();
    }

    stop() {
      super.stop();
      this._syncPlayButton();
    }

    requestRender() {
      if (!this.running) this.render();
    }

    destroy() {
      if (this.canvas) {
        if (this._boundCanvasDown) this.canvas.removeEventListener('mousedown', this._boundCanvasDown);
        if (this._boundCanvasMove) this.canvas.removeEventListener('mousemove', this._boundCanvasMove);
        if (this._boundTouchStart) this.canvas.removeEventListener('touchstart', this._boundTouchStart);
        if (this._boundTouchMove) this.canvas.removeEventListener('touchmove', this._boundTouchMove);
      }
      if (this._boundWinUp) window.removeEventListener('mouseup', this._boundWinUp);
      if (this._boundWinTouchEnd) window.removeEventListener('touchend', this._boundWinTouchEnd);
      super.destroy();
    }

    // --- Public Parameter Setters & Presets ---
    setRate(val) {
      if (!Number.isFinite(val)) return;
      this.rate = clamp(Math.round(val * 2) / 2, 0.5, 4.0);
      this._syncSlidersAndReadouts();
      this._updateUIBadges();
      this.requestRender();
    }

    setPressure(val) {
      if (!Number.isFinite(val)) return;
      this.pressureMPa = clamp(Math.round(val), 15, 60);
      this._syncSlidersAndReadouts();
      this._updateUIBadges();
      this.requestRender();
    }

    setFocalOffset(val) {
      if (!Number.isFinite(val)) return;
      this.focalOffsetMm = clamp(Math.round(val), -15, 15);
      this._syncSlidersAndReadouts();
      this._updateUIBadges();
      this.requestRender();
    }

    triggerSingleShock() {
      this.cusaMode = false;
      this.mode = 'single';
      if (this.stoneIntegrity <= 0) {
        this.stoneIntegrity = 100.0;
        this.shockCount = 0;
        this._powder = [];
      }
      this._emitShockWave();
      if (!this.running) this.start();
      this._syncPresetButtons();
      this._updateUIBadges();
      this.requestRender();
    }

    enableAutoMode() {
      this.cusaMode = false;
      this.mode = 'auto';
      if (this.stoneIntegrity <= 0) {
        this.stoneIntegrity = 100.0;
        this.shockCount = 0;
        this._powder = [];
      }
      this._autoCooldown = 0.05;
      if (!this.running) this.start();
      this._syncPresetButtons();
      this._updateUIBadges();
      this.requestRender();
    }

    toggleStoneType() {
      this.stoneType = this.stoneType === 'urate' ? 'oxalate' : 'urate';
      this.stoneIntegrity = 100.0;
      this.shockCount = 0;
      this._powder = [];
      this.spallFlash = 0.0;
      this.compressSweep = 0.0;
      this._syncStoneButtonLabel();
      this._syncPresetButtons();
      this._updateUIBadges();
      this.requestRender();
    }

    toggleCusaMode() {
      this.cusaMode = !this.cusaMode;
      this.mode = this.cusaMode ? 'cusa' : 'auto';
      this.wavefronts = [];
      this.activePulses = [];
      if (this.cusaMode && this.cusaEmulsified >= 100) {
        this.cusaEmulsified = 0;
      }
      if (!this.running) this.start();
      this._syncPresetButtons();
      this._updateUIBadges();
      this.requestRender();
    }

    // --- UI Sync Helpers (strictly null-guarded, no sibling coupling) ---
    _syncPlayButton() {
      const playBtn = document.getElementById('sim12-play');
      if (playBtn) {
        playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Rulează';
      }
    }

    _syncSlidersAndReadouts() {
      const rateSlider = document.getElementById('sim12-rate');
      if (rateSlider) rateSlider.value = String(this.rate);
      const rateVal = document.getElementById('sim12-rate-val');
      if (rateVal) rateVal.textContent = `${this.rate.toFixed(1)} Hz`;

      const pressSlider = document.getElementById('sim12-pressure');
      if (pressSlider) pressSlider.value = String(Math.round(this.pressureMPa));
      const pressVal = document.getElementById('sim12-pressure-val');
      if (pressVal) pressVal.textContent = `${Math.round(this.pressureMPa)} MPa`;

      const offSlider = document.getElementById('sim12-offset');
      if (offSlider) offSlider.value = String(Math.round(this.focalOffsetMm));
      const offVal = document.getElementById('sim12-offset-val');
      if (offVal) {
        const off = Math.round(this.focalOffsetMm);
        offVal.textContent = `${off > 0 ? '+' : ''}${off} mm`;
      }
    }

    _syncStoneButtonLabel() {
      const btnStone = document.getElementById('sim12-preset-stone');
      if (btnStone) {
        btnStone.textContent = this.stoneType === 'oxalate'
          ? '🪨 Calcul: Oxalat (Dur)'
          : '🟡 Calcul: Urat (Moale)';
      }
    }

    _syncPresetButtons() {
      const map = {
        'sim12-preset-single': this.mode === 'single' && !this.cusaMode,
        'sim12-preset-auto': this.mode === 'auto' && !this.cusaMode,
        'sim12-preset-stone': this.stoneType === 'oxalate',
        'sim12-preset-cusa': this.cusaMode
      };
      const ids = Object.keys(map);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const btn = document.getElementById(id);
        if (!btn) continue;
        const on = !!map[id];
        btn.classList.toggle('active', on);
        btn.classList.toggle('sim-btn--preset', on);
      }
    }

    _updateUIBadges() {
      const pEff = this._getEffectivePressureMPa();
      const absOff = Math.abs(this.focalOffsetMm);

      const bInt = document.getElementById('sim12-badge-integrity');
      if (bInt) {
        if (this.cusaMode) {
          bInt.textContent = `Emulsionat: ${Math.round(this.cusaEmulsified)}%`;
          bInt.className = 'sim-badge sim-badge--cyan';
        } else {
          const pct = Math.round(this.stoneIntegrity);
          bInt.textContent = `Integritate: ${pct}%`;
          bInt.className = pct > 65
            ? 'sim-badge sim-badge--green'
            : (pct > 15 ? 'sim-badge sim-badge--amber' : 'sim-badge sim-badge--danger');
        }
      }

      const bPress = document.getElementById('sim12-badge-pressure');
      if (bPress) {
        if (this.cusaMode) {
          const ampUm = 80.0 + 3.5 * this.pressureMPa;
          bPress.textContent = `CUSA: 23 kHz | ${ampUm.toFixed(0)} μm`;
          bPress.className = 'sim-badge sim-badge--cyan';
        } else {
          bPress.textContent = `P_F2: +${pEff.toFixed(1)} / -${(0.25 * pEff).toFixed(1)} MPa`;
          bPress.className = absOff > 6.0
            ? 'sim-badge sim-badge--danger'
            : 'sim-badge sim-badge--amber';
        }
      }

      const bShocks = document.getElementById('sim12-badge-shocks');
      if (bShocks) {
        if (this.cusaMode) {
          bShocks.textContent = 'Frecvență: 23.0 kHz';
          bShocks.className = 'sim-badge sim-badge--cyan';
        } else {
          bShocks.textContent = `Șocuri: ${this.shockCount}`;
          bShocks.className = 'sim-badge sim-badge--cyan';
        }
      }

      const bState = document.getElementById('sim12-badge-state');
      if (bState) {
        if (this.cusaMode) {
          bState.textContent = 'Mod CUSA 23 kHz';
          bState.className = 'sim-badge sim-badge--cyan';
        } else if (this.stoneIntegrity <= 0) {
          bState.textContent = 'Pulbere < 1 mm';
          bState.className = 'sim-badge sim-badge--green';
        } else if (absOff > 6.0) {
          bState.textContent = `Defocalizat (Δ=${Math.round(this.focalOffsetMm)} mm)`;
          bState.className = 'sim-badge sim-badge--danger';
        } else if (this.stoneIntegrity < 99.9) {
          bState.textContent = 'Fisurare';
          bState.className = 'sim-badge sim-badge--amber';
        } else {
          bState.textContent = 'Intact';
          bState.className = 'sim-badge sim-badge--cyan';
        }
      }
    }

    // --- Pointer Drag for Focal Point F2 ---
    _getCanvasPoint(e) {
      if (!this.canvas) return null;
      const rect = this.canvas.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      }
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    _bindCanvasEvents() {
      if (!this.canvas) return;

      const handleStart = (e) => {
        const pt = this._getCanvasPoint(e);
        if (!pt) return;
        const hit = this._stageHit;
        const insideStage = pt.x >= hit.x && pt.x <= hit.x + hit.w &&
                            pt.y >= hit.y && pt.y <= hit.y + hit.h;
        const distF2 = Math.hypot(pt.x - hit.f2X, pt.y - hit.f2Y);
        if (!insideStage && distF2 > 36) return;

        this.isDraggingFocus = true;
        this._dragStartPos = { x: pt.x, y: pt.y };
        this._dragStartOffset = this.focalOffsetMm;
        this._dragNearF2 = distF2 <= 28;
        this.canvas.style.cursor = 'grabbing';
        if (e.cancelable) e.preventDefault();

        // If user clicks away from F2 inside the kidney stage, orient immediately
        if (!this._dragNearF2) {
          const dxS = pt.x - hit.stoneX;
          const dyS = pt.y - hit.stoneY;
          const pxMm = Math.max(0.5, hit.pxPerMm);
          if (Math.abs(dxS) > Math.abs(dyS) + 4) {
            this._dragAxis = 'x';
            this.setFocalOffset(dxS / pxMm);
          } else {
            this._dragAxis = 'y';
            this.setFocalOffset(dyS / pxMm);
          }
        }
      };

      const handleMove = (e) => {
        const pt = this._getCanvasPoint(e);
        if (!pt) return;
        const hit = this._stageHit;

        if (!this.isDraggingFocus) {
          const distF2 = Math.hypot(pt.x - hit.f2X, pt.y - hit.f2Y);
          const insideStage = pt.x >= hit.x && pt.x <= hit.x + hit.w &&
                              pt.y >= hit.y && pt.y <= hit.y + hit.h;
          this.canvas.style.cursor = (distF2 <= 32 || insideStage) ? 'grab' : 'default';
          return;
        }

        if (e.cancelable) e.preventDefault();
        const dx = pt.x - this._dragStartPos.x;
        const dy = pt.y - this._dragStartPos.y;
        const pxMm = Math.max(0.5, hit.pxPerMm);

        if (Math.hypot(dx, dy) >= 4) {
          if (Math.abs(dx) > Math.abs(dy) + 3) {
            this._dragAxis = 'x';
          } else if (Math.abs(dy) > Math.abs(dx) + 3) {
            this._dragAxis = 'y';
          }
        }

        if (this._dragNearF2) {
          const deltaPx = this._dragAxis === 'x' ? dx : dy;
          this.setFocalOffset(this._dragStartOffset + deltaPx / pxMm);
        } else {
          const relPx = this._dragAxis === 'x' ? (pt.x - hit.stoneX) : (pt.y - hit.stoneY);
          this.setFocalOffset(relPx / pxMm);
        }
      };

      const handleEnd = () => {
        if (!this.isDraggingFocus) return;
        this.isDraggingFocus = false;
        if (this.canvas) this.canvas.style.cursor = 'default';
      };

      this._boundCanvasDown = handleStart;
      this._boundCanvasMove = handleMove;
      this._boundTouchStart = handleStart;
      this._boundTouchMove = handleMove;
      this._boundWinUp = handleEnd;
      this._boundWinTouchEnd = handleEnd;

      this.canvas.addEventListener('mousedown', this._boundCanvasDown);
      this.canvas.addEventListener('mousemove', this._boundCanvasMove);
      this.canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
      this.canvas.addEventListener('touchmove', this._boundTouchMove, { passive: false });
      window.addEventListener('mouseup', this._boundWinUp);
      window.addEventListener('touchend', this._boundWinTouchEnd);
    }

    // --- Physics Simulation Step ---
    _emitShockWave() {
      this.wavefronts.push({
        progress: 0.0,     // 0.0 (F1) -> ~0.35 (reflector) -> 1.0 (F2 arrival) -> 1.25 (tail)
        impacted: false,
        pPeak: this.pressureMPa
      });
      this.sparkFlash = 1.0;
    }

    _onShockArrival(wf) {
      const pEff = wf.pPeak * this._getFocusFactor();
      this.shockCount += 1;

      // Enqueue focal shock pulse into Rayleigh-Plesset forcing & waveform trace
      this.activePulses.push({
        tauStart: this.rpTau + 0.15 * 1.4,
        pEff
      });
      this.compressSweep = 0.01;
      this.spallFlash = clamp(pEff / 45.0, 0.2, 1.0);

      // Stone spalling & cavitation damage
      if (!this.cusaMode && this.stoneIntegrity > 0) {
        const mat = STONE_MATERIALS[this.stoneType] || STONE_MATERIALS.urate;
        const excess = Math.max(0.0, pEff - mat.pThresh);
        let dmg = 0.0;
        if (excess > 0.0) {
          const spallDmg = mat.kMat * Math.pow(excess / 25.0, 1.35);
          const cavDmg = 1.8 * this._getFocusFactor() * (pEff / 40.0);
          dmg = spallDmg + cavDmg;
        } else if (pEff > 8.0) {
          // Sub-threshold surface cavitation fatigue only
          dmg = 0.15;
        }

        const prevIntegrity = this.stoneIntegrity;
        this.stoneIntegrity = clamp(this.stoneIntegrity - dmg, 0.0, 100.0);

        if (this.stoneIntegrity <= 0.0 && prevIntegrity > 0.0) {
          this._spawnPowderBurst(90, true);
        } else if (excess > 0.0) {
          this._spawnPowderBurst(8, false);
        }
      }

      this._updateUIBadges();
    }

    _getDimensionlessPInf(tau) {
      if (this.cusaMode) {
        const amp = 2.2 * (this.pressureMPa / 40.0);
        return 1.0 + amp * Math.sin((2.0 * Math.PI * tau) / 5.5);
      }
      let pAc = 0.0;
      for (let i = 0; i < this.activePulses.length; i++) {
        const pulse = this.activePulses[i];
        const u = (tau - pulse.tauStart) / 1.4;
        if (u >= -0.15 && u <= 12.0) {
          pAc += 0.24 * pulse.pEff * shockPulseNorm(u);
        }
      }
      return 1.0 + pAc;
    }

    _getInstantaneousPressureMPa(tau) {
      if (this.cusaMode) {
        // Scaled acoustic field around CUSA 23 kHz vibrating horn tip
        const pPeakCusa = 0.25 * this.pressureMPa;
        return pPeakCusa * Math.sin((2.0 * Math.PI * tau) / 5.5);
      }
      let pTotal = 0.0;
      for (let i = 0; i < this.activePulses.length; i++) {
        const pulse = this.activePulses[i];
        const u = (tau - pulse.tauStart) / 1.4;
        if (u >= -0.15 && u <= 12.0) {
          pTotal += pulse.pEff * shockPulseNorm(u);
        }
      }
      return pTotal;
    }

    _rpDeriv(R, V, tau) {
      const Rc = clamp(R, 0.12, 12.0);
      const Vc = clamp(V, -18.0, 18.0);
      const pInf = this._getDimensionlessPInf(tau);
      const rhs = RP_PG_DIM * Math.pow(Rc, -4.2) +
                  RP_PV_DIM -
                  pInf -
                  RP_WE_INV / Rc -
                  (RP_RE4_INV * Vc) / Rc -
                  1.5 * Vc * Vc;
      const acc = clamp(rhs / Rc, -5000.0, 5000.0);
      return { dR: Vc, dV: acc };
    }

    _stepRayleighPlesset(dt) {
      const dTau = dt * TAU_PER_SEC;
      if (dTau <= 0) return;

      const substeps = Math.max(32, Math.ceil(dTau / 0.015));
      const h = dTau / substeps;

      for (let s = 0; s < substeps; s++) {
        const R0 = this.rpR;
        const V0 = this.rpV;
        const t0 = this.rpTau;

        const k1 = this._rpDeriv(R0, V0, t0);
        const k2 = this._rpDeriv(R0 + 0.5 * h * k1.dR, V0 + 0.5 * h * k1.dV, t0 + 0.5 * h);
        const k3 = this._rpDeriv(R0 + 0.5 * h * k2.dR, V0 + 0.5 * h * k2.dV, t0 + 0.5 * h);
        const k4 = this._rpDeriv(R0 + h * k3.dR, V0 + h * k3.dV, t0 + h);

        let nextR = R0 + (h / 6.0) * (k1.dR + 2.0 * k2.dR + 2.0 * k3.dR + k4.dR);
        let nextV = V0 + (h / 6.0) * (k1.dV + 2.0 * k2.dV + 2.0 * k3.dV + k4.dV);

        if (!Number.isFinite(nextR) || !Number.isFinite(nextV)) {
          nextR = 1.0;
          nextV = 0.0;
        }

        if (nextR <= 0.12) {
          nextR = 0.12;
          if (nextV < 0) nextV = -0.5 * nextV;
        } else if (nextR > 12.0) {
          nextR = 12.0;
          if (nextV > 0) nextV = 0.0;
        }
        nextV = clamp(nextV, -18.0, 18.0);

        // Detect sharp inertial collapse minimum to fire micro-jet flash
        if (V0 < -0.5 && nextV >= 0.0 && nextR < 0.75) {
          this.collapseFlash = Math.max(this.collapseFlash, clamp(1.0 - nextR, 0.35, 1.0));
        }

        this.rpR = nextR;
        this.rpV = nextV;
        this.rpTau = t0 + h;

        // Peak-hold instantaneous pressure across RK4 substeps so sharp shock apexes (+40 MPa) are captured accurately
        const pSub = this._getInstantaneousPressureMPa(this.rpTau);
        if (Math.abs(pSub) >= Math.abs(this._binPeakP)) {
          this._binPeakP = pSub;
        }
      }

      // Prune expired ESWL pulses
      for (let i = this.activePulses.length - 1; i >= 0; i--) {
        const u = (this.rpTau - this.activePulses[i].tauStart) / 1.4;
        if (u > 12.0) {
          this.activePulses.splice(i, 1);
        }
      }
    }

    update(dt) {
      const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0;
      if (safeDt <= 0) return;

      // 1. Shock Scheduler (ESWL) or Emulsification (CUSA)
      if (!this.cusaMode) {
        if (this.mode === 'auto' && this.stoneIntegrity > 0) {
          this._autoCooldown -= safeDt;
          if (this._autoCooldown <= 0) {
            this._emitShockWave();
            this._autoCooldown = 1.0 / Math.max(0.5, this.rate);
          }
        }
      } else {
        // CUSA 23 kHz continuous parenchymal emulsification
        const emulRate = 5.5 * (this.pressureMPa / 40.0);
        if (this.cusaEmulsified < 100.0) {
          this.cusaEmulsified = clamp(this.cusaEmulsified + emulRate * safeDt, 0.0, 100.0);
        }
        // Spawn suction droplets drifting into the hollow titanium horn lumen
        if (this._suctionDroplets.length < 28 && Math.random() < 12.0 * safeDt) {
          this._suctionDroplets.push({
            progress: 0.0,
            yOff: (Math.random() - 0.5) * 14.0,
            r: 1.5 + Math.random() * 2.2
          });
        }
        for (let i = this._suctionDroplets.length - 1; i >= 0; i--) {
          this._suctionDroplets[i].progress += safeDt * 1.45;
          if (this._suctionDroplets[i].progress >= 1.0) {
            this._suctionDroplets.splice(i, 1);
          }
        }
        this._updateUIBadges();
      }

      // 2. Propagate ESWL Wavefronts (transit F1 -> F2 in ~0.40s)
      const wfSpeed = 1.0 / 0.40;
      for (let i = this.wavefronts.length - 1; i >= 0; i--) {
        const wf = this.wavefronts[i];
        wf.progress += wfSpeed * safeDt;
        if (!wf.impacted && wf.progress >= 1.0) {
          wf.impacted = true;
          this._onShockArrival(wf);
        }
        if (wf.progress > 1.32) {
          this.wavefronts.splice(i, 1);
        }
      }

      // 3. Decay visual flashes & advance internal stone stress sweep
      this.sparkFlash = Math.max(0.0, this.sparkFlash - safeDt * 3.8);
      this.spallFlash = Math.max(0.0, this.spallFlash - safeDt * 1.8);
      this.collapseFlash = Math.max(0.0, this.collapseFlash - safeDt * 2.4);
      if (this.compressSweep > 0.0) {
        this.compressSweep += safeDt * 3.6;
        if (this.compressSweep > 1.4) this.compressSweep = 0.0;
      }

      // 4. Advance Powder Particles
      for (let i = this._powder.length - 1; i >= 0; i--) {
        const p = this._powder[i];
        p.ox += (p.vx * safeDt) / 28.0;
        p.oy += (p.vy * safeDt) / 28.0;
        p.vx *= Math.pow(0.28, safeDt);
        p.vy = p.vy * Math.pow(0.35, safeDt) + (p.persistent ? 2.5 * safeDt : 0);
        if (p.persistent) {
          // Gently keep sand settled inside renal pelvis / lower calyx
          p.ox = clamp(p.ox, -1.65, 1.65);
          p.oy = clamp(p.oy, -1.15, 1.35);
          p.life = Math.max(0.55, p.life - p.decay * safeDt);
        } else {
          p.life -= p.decay * safeDt;
          if (p.life <= 0) this._powder.splice(i, 1);
        }
      }

      // 5. Sub-Stepped RK4 Rayleigh-Plesset Cavitation Solver
      this._stepRayleighPlesset(safeDt);

      // Track peak-magnitude pressure within current display sample bin so sharp shock apexes (+40 MPa) are never aliased out
      const pNow = this._getInstantaneousPressureMPa(this.rpTau);
      if (Math.abs(pNow) >= Math.abs(this._binPeakP)) {
        this._binPeakP = pNow;
      }

      // 6. Telemetry Ring Buffers (~60 Hz sampling)
      this._histAccum += safeDt;
      const sampleStep = 1.0 / 60.0;
      while (this._histAccum >= sampleStep) {
        this._histAccum -= sampleStep;
        this.pHistory.push(this._binPeakP);
        this.rpHistory.push(this.rpR);
        if (this.pHistory.length > this.historyMax) this.pHistory.shift();
        if (this.rpHistory.length > this.historyMax) this.rpHistory.shift();
        this._binPeakP = this._getInstantaneousPressureMPa(this.rpTau);
      }
    }

    // --- Master Render ---
    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (!Number.isFinite(W) || !Number.isFinite(H) || W < 40 || H < 40) return;

      ctx.clearRect(0, 0, W, H);

      const topH = Math.max(90, Math.round(H * 0.59));
      const botH = Math.max(60, H - topH);

      this._renderUpperStage(ctx, 0, 0, W, topH);
      this._renderLowerTelemetry(ctx, 0, topH, W, botH);
    }

    // --- Upper 59% Physical Stage ---
    _renderUpperStage(ctx, ox, oy, W, topH) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, W, topH);
      ctx.clip();

      // Background dark laboratory gradient
      const bg = safeLinearGrad(ctx, 0, 0, 0, topH);
      if (bg) {
        bg.addColorStop(0, '#060a14');
        bg.addColorStop(0.68, '#0b1324');
        bg.addColorStop(1, '#111c33');
        ctx.fillStyle = bg;
      } else {
        ctx.fillStyle = '#080e1c';
      }
      ctx.fillRect(ox, oy, W, topH);

      // Subtle technical grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.055)';
      ctx.lineWidth = 1;
      const gridStep = 40;
      for (let x = gridStep; x < W; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, topH);
        ctx.stroke();
      }
      for (let y = gridStep; y < topH; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      const compact = W < 580;
      const stageMidY = topH * 0.54;
      const stoneX = W * 0.70;
      const stoneY = stageMidY;
      const stoneR = clamp(Math.min(W * 0.052, topH * 0.135), 14, 34);
      const pxPerMm = clamp(Math.min(topH / 120, (W * 0.16) / 15), 1.3, 2.8);

      const offPx = this.focalOffsetMm * pxPerMm;
      const f2X = this._dragAxis === 'x' ? stoneX + offPx : stoneX;
      const f2Y = this._dragAxis === 'x' ? stoneY : stoneY + offPx;

      // Update drag hit region for pointer interaction
      this._stageHit = {
        x: W * 0.42,
        y: 22,
        w: W * 0.56,
        h: Math.max(30, topH - 28),
        stoneX,
        stoneY,
        f2X,
        f2Y,
        pxPerMm
      };

      // Stage HUD title
      ctx.fillStyle = '#38bdf8';
      ctx.font = compact ? '700 8.5px Inter, monospace' : '700 10.5px Inter, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const titleStr = this.cusaMode
        ? (compact
          ? 'BISTURIU CUSA (23 kHz) — DISECȚIE CAVITAȚIONALĂ'
          : 'BISTURIU ULTRASONIC CUSA (23 kHz) — DISECȚIE SELECTIVĂ PRIN CAVITAȚIE')
        : (compact
          ? 'ESWL — FOCALIZARE ELIPSOIDALĂ F₁ → F₂'
          : 'LITOTRIPSIE EXTRACORPORALĂ (ESWL) — FOCALIZARE ELIPSOIDALĂ F₁ → F₂');
      ctx.fillText(titleStr, 12, 9);

      if (this.cusaMode) {
        this._renderCusaStage(ctx, W, topH, stageMidY, stoneX, stoneY, stoneR, f2X, f2Y, compact);
      } else {
        this._renderEswlStage(ctx, W, topH, stageMidY, stoneX, stoneY, stoneR, f2X, f2Y, pxPerMm, compact);
      }

      ctx.restore();
    }

    _renderKidneyCrossSection(ctx, cx, cy, rx, ry, compact) {
      ctx.save();
      // Outer renal capsule (bean silhouette)
      const kGrad = safeRadialGrad(ctx, cx - rx * 0.15, cy, rx * 0.15, cx, cy, Math.max(rx, ry) * 1.15);
      if (kGrad) {
        kGrad.addColorStop(0, '#4c172a');
        kGrad.addColorStop(0.65, '#3b1121');
        kGrad.addColorStop(1, '#240a14');
        ctx.fillStyle = kGrad;
      } else {
        ctx.fillStyle = '#3b1121';
      }

      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.72, cy - ry * 0.36);
      ctx.bezierCurveTo(cx - rx * 0.68, cy - ry * 1.05, cx + rx * 0.85, cy - ry * 1.02, cx + rx * 0.96, cy - ry * 0.12);
      ctx.bezierCurveTo(cx + rx * 1.02, cy + ry * 0.88, cx - rx * 0.58, cy + ry * 1.05, cx - rx * 0.72, cy + ry * 0.36);
      // Hilum indentation on left side
      ctx.bezierCurveTo(cx - rx * 0.44, cy + ry * 0.18, cx - rx * 0.44, cy - ry * 0.18, cx - rx * 0.72, cy - ry * 0.36);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(251, 113, 133, 0.58)';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Renal medulla pyramids
      ctx.fillStyle = 'rgba(136, 19, 55, 0.42)';
      const pyrAngles = [-1.15, -0.58, 0.0, 0.58, 1.15];
      for (let i = 0; i < pyrAngles.length; i++) {
        const a = pyrAngles[i];
        const px = cx + Math.cos(a) * rx * 0.56;
        const py = cy + Math.sin(a) * ry * 0.58;
        ctx.beginPath();
        safeArc(ctx, px, py, Math.min(rx, ry) * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }

      // Inner renal pelvis & calyx cavity around stone
      ctx.fillStyle = '#140813';
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx + rx * 0.02, cy, rx * 0.38, ry * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Lower ureter exit channel
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.28, cy + ry * 0.25);
      ctx.quadraticCurveTo(cx - rx * 0.55, cy + ry * 0.55, cx - rx * 0.65, cy + ry * 0.96);
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.32)';
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#fda4af';
      ctx.font = compact ? '600 7.5px Inter, monospace' : '600 8.5px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SECȚIUNE RENALĂ', cx + rx * 0.10, cy - ry * 0.80);
      ctx.restore();
    }

    _renderEswlStage(ctx, W, topH, stageMidY, stoneX, stoneY, stoneR, f2X, f2Y, pxPerMm, compact) {
      // 1. Ellipsoid Geometry: F1 (left transducer) -> F2_0 (stone center)
      const f1X = Math.max(38, W * 0.125);
      const f1Y = stageMidY;
      const xc = 0.5 * (f1X + stoneX);
      const yc = stageMidY;
      const c = Math.max(20, 0.5 * (stoneX - f1X));
      const b = Math.max(24, Math.min(0.38 * topH, 0.82 * c));
      const a = Math.sqrt(b * b + c * c);

      // Reflector angular span: x <= xc + 0.12 * a -> theta around PI
      const span = Math.acos(-0.12); // ~1.691 rad
      const thMin = Math.PI - span;
      const thMax = Math.PI + span;
      const rimTop = { x: xc + a * Math.cos(thMin), y: yc + b * Math.sin(thMin) };
      const rimBot = { x: xc + a * Math.cos(thMax), y: yc + b * Math.sin(thMax) };

      // 2. Faint full ellipse reference contour connecting F1 & F2
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(xc, yc, a, b, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 3. Translucent Acoustic Water-Coupling Cushion (H2O)
      const cushionLeft = Math.max(rimTop.x - 4, xc - a * 0.12);
      const cushionRight = stoneX - stoneR * 2.1;
      if (cushionRight > cushionLeft + 10) {
        ctx.save();
        const cGrad = safeLinearGrad(ctx, cushionLeft, yc, cushionRight, yc);
        if (cGrad) {
          cGrad.addColorStop(0, 'rgba(0, 229, 255, 0.03)');
          cGrad.addColorStop(0.6, 'rgba(0, 229, 255, 0.11)');
          cGrad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');
          ctx.fillStyle = cGrad;
        } else {
          ctx.fillStyle = 'rgba(0, 229, 255, 0.07)';
        }
        ctx.beginPath();
        ctx.moveTo(rimTop.x, rimTop.y);
        ctx.quadraticCurveTo(cushionRight + 10, yc - b * 0.48, cushionRight, yc - b * 0.42);
        ctx.lineTo(cushionRight, yc + b * 0.42);
        ctx.quadraticCurveTo(cushionRight + 10, yc + b * 0.48, rimBot.x, rimBot.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = 'rgba(125, 211, 252, 0.78)';
        ctx.font = compact ? '500 7px Inter, monospace' : '500 8.5px Inter, monospace';
        ctx.textAlign = 'center';
        const cLabel = compact ? 'Cuplaj (H₂O)' : 'Cuplaj acustic (H₂O)';
        ctx.fillText(cLabel, 0.5 * (rimTop.x + cushionRight), yc + b * 0.34);
        ctx.restore();
      }

      // 4. Kidney Cross-Section around stone
      const kidRx = clamp(W * 0.145, 58, 125);
      const kidRy = clamp(topH * 0.36, 46, 98);
      this._renderKidneyCrossSection(ctx, stoneX, stoneY, kidRx, kidRy, compact);

      // 5. Semi-Ellipsoidal Metallic Reflector Dish
      ctx.save();
      ctx.beginPath();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const th = thMin + (i / steps) * (thMax - thMin);
        const rx = xc + a * Math.cos(th);
        const ry = yc + b * Math.sin(th);
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 6.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      const dishGrad = safeLinearGrad(ctx, xc - a, yc - b, xc, yc + b);
      if (dishGrad) {
        dishGrad.addColorStop(0, '#475569');
        dishGrad.addColorStop(0.5, '#e2e8f0');
        dishGrad.addColorStop(1, '#64748b');
        ctx.strokeStyle = dishGrad;
      } else {
        ctx.strokeStyle = '#cbd5e1';
      }
      ctx.lineWidth = 3.0;
      ctx.stroke();
      ctx.restore();

      // 6. Incident & Reflected Acoustic Rays (13 rays from F1 -> reflector -> F2)
      const nRays = 13;
      const rayPoints = [];
      for (let i = 0; i < nRays; i++) {
        const frac = 0.07 + 0.86 * (i / (nRays - 1));
        const th = thMin + frac * (thMax - thMin);
        const px = xc + a * Math.cos(th);
        const py = yc + b * Math.sin(th);
        const d1 = Math.hypot(px - f1X, py - f1Y);
        const d2 = Math.hypot(f2X - px, f2Y - py);
        rayPoints.push({ px, py, d1, d2, total: d1 + d2 });
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1;
      for (let i = 0; i < rayPoints.length; i += 2) {
        const rp = rayPoints[i];
        ctx.beginPath();
        ctx.moveTo(f1X, f1Y);
        ctx.lineTo(rp.px, rp.py);
        ctx.lineTo(f2X, f2Y);
        ctx.stroke();
      }
      ctx.restore();

      // 7. F1 Piezo/Spark Emitter
      ctx.save();
      if (this.sparkFlash > 0.02) {
        const sg = safeRadialGrad(ctx, f1X, f1Y, 0.5, f1X, f1Y, 22 * this.sparkFlash);
        if (sg) {
          sg.addColorStop(0, `rgba(255, 255, 255, ${0.95 * this.sparkFlash})`);
          sg.addColorStop(0.45, `rgba(0, 229, 255, ${0.65 * this.sparkFlash})`);
          sg.addColorStop(1, 'rgba(0, 229, 255, 0)');
          ctx.fillStyle = sg;
          ctx.beginPath();
          safeArc(ctx, f1X, f1Y, 22 * this.sparkFlash, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      safeArc(ctx, f1X, f1Y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.font = compact ? '700 8px Inter, monospace' : '700 9.5px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('F₁', f1X, f1Y + 14);
      ctx.restore();

      // 8. Converging Ellipsoidal Shock Wavefronts
      for (let w = 0; w < this.wavefronts.length; w++) {
        const wf = this.wavefronts[w];
        const prog = wf.progress;
        const alpha = prog <= 1.0 ? 0.92 : Math.max(0, 1.0 - (prog - 1.0) / 0.32);

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < rayPoints.length; i++) {
          const rp = rayPoints[i];
          const sDist = prog * rp.total;
          let wx, wy;
          if (sDist <= rp.d1) {
            const t1 = rp.d1 > 0 ? sDist / rp.d1 : 0;
            wx = f1X + (rp.px - f1X) * t1;
            wy = f1Y + (rp.py - f1Y) * t1;
          } else {
            const t2 = rp.d2 > 0 ? (sDist - rp.d1) / rp.d2 : 1;
            wx = rp.px + (f2X - rp.px) * t2;
            wy = rp.py + (f2Y - rp.py) * t2;
          }
          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // Subtle tensile trailing wavefront behind compression front
        if (prog > 0.12 && prog < 1.15) {
          const tailProg = prog - 0.07;
          ctx.beginPath();
          for (let i = 0; i < rayPoints.length; i++) {
            const rp = rayPoints[i];
            const sDist = tailProg * rp.total;
            let wx, wy;
            if (sDist <= rp.d1) {
              const t1 = rp.d1 > 0 ? sDist / rp.d1 : 0;
              wx = f1X + (rp.px - f1X) * t1;
              wy = f1Y + (rp.py - f1Y) * t1;
            } else {
              const t2 = rp.d2 > 0 ? (sDist - rp.d1) / rp.d2 : 1;
              wx = rp.px + (f2X - rp.px) * t2;
              wy = rp.py + (f2Y - rp.py) * t2;
            }
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.strokeStyle = `rgba(255, 82, 82, ${(alpha * 0.55).toFixed(3)})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 9. Off-target Renal Parenchyma Trauma Halo when |offset| > 6 mm
      if (Math.abs(this.focalOffsetMm) > 6.0) {
        const pulse = 0.55 + 0.45 * Math.sin(this.time * 7.0);
        ctx.save();
        const tGrad = safeRadialGrad(ctx, f2X, f2Y, 2, f2X, f2Y, 28 + 8 * pulse);
        if (tGrad) {
          tGrad.addColorStop(0, `rgba(255, 45, 85, ${(0.55 * pulse).toFixed(3)})`);
          tGrad.addColorStop(0.6, `rgba(239, 68, 68, ${(0.28 * pulse).toFixed(3)})`);
          tGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = tGrad;
          ctx.beginPath();
          safeArc(ctx, f2X, f2Y, 28 + 8 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
        // Trauma warning banner in upper stage
        ctx.fillStyle = 'rgba(220, 38, 38, 0.88)';
        const bw = compact ? Math.min(W - 24, 240) : 330;
        const bx = stoneX - bw * 0.55;
        const by = 24;
        drawRoundedRect(ctx, clamp(bx, 10, W - bw - 10), by, bw, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = compact ? '700 7.5px Inter, monospace' : '700 8.5px Inter, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          compact
            ? '⚠ DEFOCALIZARE: STRES RENAL!'
            : '⚠ DEFOCALIZARE: STRES MECANIC PE ȚESUTUL RENAL!',
          clamp(bx, 10, W - bw - 10) + bw * 0.5,
          by + 9
        );
        ctx.restore();
      }

      // 10. Crystalline Kidney Stone, Spalling Heatmap, Cracks, Shards & <1mm Powder
      this._renderStoneAndFracture(ctx, stoneX, stoneY, stoneR);

      // 11. Cavitation Microbubbles (Rayleigh-Plesset R/R0) & Micro-Jet Collapse
      this._renderCavitationBubbles(ctx, f2X, f2Y, stoneR * 0.85, stoneX, stoneY);

      // 12. Draggable Focal Point F2 Reticle
      this._renderF2Reticle(ctx, f2X, f2Y, compact);
    }

    _renderStoneAndFracture(ctx, stoneX, stoneY, stoneR) {
      const mat = STONE_MATERIALS[this.stoneType] || STONE_MATERIALS.urate;
      const damage = 1.0 - this.stoneIntegrity / 100.0;

      // Render stone body or separating shards while integrity > 0
      if (this.stoneIntegrity > 0) {
        if (this.stoneIntegrity >= 60.0) {
          // Intact / initial micro-cracking crystalline stone
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < this._stoneVerts.length; i++) {
            const v = this._stoneVerts[i];
            const vx = stoneX + Math.cos(v.ang) * stoneR * v.r;
            const vy = stoneY + Math.sin(v.ang) * stoneR * v.r;
            if (i === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();

          const sg = safeRadialGrad(
            ctx,
            stoneX - stoneR * 0.25, stoneY - stoneR * 0.25, stoneR * 0.1,
            stoneX, stoneY, stoneR * 1.1
          );
          if (sg) {
            sg.addColorStop(0, mat.hiFill);
            sg.addColorStop(0.55, mat.baseFill);
            sg.addColorStop(1, mat.darkFill);
            ctx.fillStyle = sg;
          } else {
            ctx.fillStyle = mat.baseFill;
          }
          ctx.fill();
          ctx.strokeStyle = mat.edgeStroke;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Clip inside stone for compression sweep + posterior spalling tensile stress heatmap
          ctx.clip();
          if (this.compressSweep > 0.0 && this.compressSweep <= 1.2) {
            const sweepX = stoneX - stoneR + this.compressSweep * (2.0 * stoneR);
            const cg = safeLinearGrad(ctx, sweepX - 10, stoneY, sweepX + 10, stoneY);
            if (cg) {
              cg.addColorStop(0, 'rgba(0, 229, 255, 0)');
              cg.addColorStop(0.5, 'rgba(0, 229, 255, 0.72)');
              cg.addColorStop(1, 'rgba(0, 229, 255, 0)');
              ctx.fillStyle = cg;
              ctx.fillRect(stoneX - stoneR * 1.2, stoneY - stoneR * 1.2, stoneR * 2.4, stoneR * 2.4);
            }
          }

          if (this.spallFlash > 0.02) {
            // Posterior wall tensile spallation zone (right third of stone)
            const spX = stoneX + stoneR * 0.48;
            const spG = safeRadialGrad(ctx, spX, stoneY, 1, spX, stoneY, stoneR * 0.95);
            if (spG) {
              spG.addColorStop(0, `rgba(255, 23, 68, ${(0.88 * this.spallFlash).toFixed(3)})`);
              spG.addColorStop(0.55, `rgba(244, 63, 94, ${(0.45 * this.spallFlash).toFixed(3)})`);
              spG.addColorStop(1, 'rgba(244, 63, 94, 0)');
              ctx.fillStyle = spG;
              ctx.beginPath();
              safeArc(ctx, spX, stoneY, stoneR * 0.95, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Progressive fractal micro-cracks
          this._renderFractalCracks(ctx, stoneX, stoneY, stoneR, damage);
          ctx.restore();
        } else {
          // 5 separating shards for integrity < 60%
          const sepFrac = clamp((60.0 - this.stoneIntegrity) / 60.0, 0.0, 1.0);
          const sepDist = sepFrac * stoneR * 0.58;
          const shardScale = Math.max(0.32, 1.0 - 0.45 * sepFrac);

          for (let s = 0; s < this._shards.length; s++) {
            const sh = this._shards[s];
            const sx = stoneX + sh.dirX * sepDist;
            const sy = stoneY + sh.dirY * sepDist;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sh.rotSign * sepFrac * 0.35);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const r1 = stoneR * 0.88 * sh.scale * shardScale;
            const r2 = stoneR * 0.92 * sh.scale * shardScale;
            ctx.lineTo(Math.cos(sh.a0) * r1, Math.sin(sh.a0) * r1);
            ctx.lineTo(Math.cos(0.5 * (sh.a0 + sh.a1)) * r1 * 1.05, Math.sin(0.5 * (sh.a0 + sh.a1)) * r1 * 1.05);
            ctx.lineTo(Math.cos(sh.a1) * r2, Math.sin(sh.a1) * r2);
            ctx.closePath();
            ctx.fillStyle = mat.baseFill;
            ctx.fill();
            ctx.strokeStyle = this.spallFlash > 0.1 ? '#ff5252' : mat.edgeStroke;
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Render < 1 mm powder sand particles
      if (this._powder.length > 0) {
        ctx.save();
        for (let i = 0; i < this._powder.length; i++) {
          const p = this._powder[i];
          const px = stoneX + p.ox * stoneR;
          const py = stoneY + p.oy * stoneR;
          ctx.fillStyle = this.stoneType === 'oxalate'
            ? `rgba(226, 232, 240, ${(0.85 * p.life).toFixed(3)})`
            : `rgba(251, 191, 36, ${(0.88 * p.life).toFixed(3)})`;
          ctx.beginPath();
          safeArc(ctx, px, py, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    _renderFractalCracks(ctx, cx, cy, stoneR, damage) {
      if (damage <= 0.01) return;
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < this._cracks.length; i++) {
        const cr = this._cracks[i];
        if (damage < cr.thresh) continue;
        const grow = clamp((damage - cr.thresh) / 0.18, 0.15, 1.0);
        const x1 = cx + cr.x1 * stoneR;
        const y1 = cy + cr.y1 * stoneR;
        const x2 = x1 + (cr.x2 - cr.x1) * stoneR * grow;
        const y2 = y1 + (cr.y2 - cr.y1) * stoneR * grow;

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = (cr.depth >= 3 ? 2.1 : 1.3) + damage * 0.9;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = this.spallFlash > 0.15
          ? 'rgba(255, 82, 82, 0.85)'
          : 'rgba(251, 191, 36, 0.55)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();
    }

    _renderCavitationBubbles(ctx, fx, fy, clusterR, stoneX, stoneY) {
      const rNorm = clamp(this.rpR, 0.12, 12.0);
      // Visual radius scaling smoothly across R/R0 in [0.12 .. 9.5]
      const visScale = clamp(Math.pow(rNorm, 0.65), 0.25, 3.8);

      ctx.save();
      for (let i = 0; i < this._bubbles.length; i++) {
        const b = this._bubbles[i];
        const bx = fx + b.dxNorm * clusterR;
        const by = fy + b.dyNorm * clusterR;
        const rad = b.baseR * visScale;

        const bg = safeRadialGrad(ctx, bx - rad * 0.25, by - rad * 0.25, 0.1, bx, by, rad);
        if (bg) {
          bg.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
          bg.addColorStop(0.55, 'rgba(0, 229, 255, 0.45)');
          bg.addColorStop(1, 'rgba(56, 189, 248, 0.10)');
          ctx.fillStyle = bg;
        } else {
          ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
        }

        ctx.beginPath();
        safeArc(ctx, bx, by, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Micro-jet implosion ring & directional jet arrow on inertial collapse
      if (this.collapseFlash > 0.05) {
        const ringR = 6.0 + (1.0 - this.collapseFlash) * clusterR * 1.4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.85 * this.collapseFlash).toFixed(3)})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        safeArc(ctx, fx, fy, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // Micro-jet directed toward stone center if offset
        const jdx = stoneX - fx;
        const jdy = stoneY - fy;
        const jLen = Math.hypot(jdx, jdy);
        const ux = jLen > 2 ? jdx / jLen : 1;
        const uy = jLen > 2 ? jdy / jLen : 0;
        this.drawArrow(
          fx - ux * 10, fy - uy * 10,
          fx + ux * 12, fy + uy * 12,
          `rgba(0, 229, 255, ${this.collapseFlash.toFixed(2)})`,
          1.8
        );
      }
      ctx.restore();
    }

    _renderF2Reticle(ctx, f2X, f2Y, compact) {
      const absOff = Math.abs(this.focalOffsetMm);
      const col = absOff <= 3 ? '#00e5ff' : (absOff <= 6 ? '#ffab40' : '#ff5252');
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      safeArc(ctx, f2X, f2Y, 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crosshair ticks
      ctx.beginPath();
      ctx.moveTo(f2X - 22, f2Y); ctx.lineTo(f2X - 8, f2Y);
      ctx.moveTo(f2X + 8, f2Y); ctx.lineTo(f2X + 22, f2Y);
      ctx.moveTo(f2X, f2Y - 22); ctx.lineTo(f2X, f2Y - 8);
      ctx.moveTo(f2X, f2Y + 8); ctx.lineTo(f2X, f2Y + 22);
      ctx.stroke();

      // Pill tag for F2 (Trage) so it stays 100% legible over stone/bubbles
      const tagTxt = 'F₂ (Trage)';
      ctx.font = compact ? '700 7.5px Inter, monospace' : '700 8.5px Inter, monospace';
      const tagW = compact ? 52 : 60;
      const tagH = 14;
      const tagX = f2X - tagW * 0.5;
      const tagY = f2Y - 34;
      ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
      drawRoundedRect(ctx, tagX, tagY, tagW, tagH, 3);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagTxt, f2X, tagY + tagH * 0.5);
      ctx.restore();
    }

    // --- CUSA (23 kHz) Ultrasonic Surgical Dissection Stage ---
    _renderCusaStage(ctx, W, topH, stageMidY, stoneX, stoneY, stoneR, f2X, f2Y, compact) {
      // Parenchymal tissue region on the right
      const tissueX = stoneX - stoneR * 0.4;
      const tissueW = W * 0.28;
      const tissueH = topH * 0.66;
      const tissueY = stageMidY - tissueH * 0.5;

      ctx.save();
      const tGrad = safeRadialGrad(ctx, stoneX, stoneY, 10, stoneX, stoneY, tissueW * 0.9);
      if (tGrad) {
        tGrad.addColorStop(0, 'rgba(136, 19, 55, 0.55)');
        tGrad.addColorStop(0.7, 'rgba(76, 29, 46, 0.45)');
        tGrad.addColorStop(1, 'rgba(30, 10, 22, 0.25)');
        ctx.fillStyle = tGrad;
      } else {
        ctx.fillStyle = 'rgba(76, 29, 46, 0.45)';
      }
      drawRoundedRect(ctx, tissueX, tissueY, tissueW, tissueH, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Parenchymal hepatocyte/renal cells (diminishing as emulsified)
      const cellRng = seededRand(44021);
      const remainFrac = Math.max(0.15, 1.0 - 0.85 * (this.cusaEmulsified / 100.0));
      const nCells = Math.round(28 * remainFrac);
      for (let i = 0; i < nCells; i++) {
        const cx = tissueX + 18 + cellRng() * Math.max(10, tissueW - 36);
        const cy = tissueY + 18 + cellRng() * Math.max(10, tissueH - 36);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.32)';
        ctx.beginPath();
        safeArc(ctx, cx, cy, 4 + cellRng() * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Elastic collagen-rich blood vessel (spared by CUSA selectivity)
      const tipXBase = Math.max(W * 0.42, stoneX - stoneR * 1.15);
      const ampPx = 1.5 + 2.5 * (this.pressureMPa / 60.0);
      const hornVib = Math.sin(this.time * 55.0) * ampPx;
      const tipX = tipXBase + hornVib + (this._dragAxis === 'x' ? this.focalOffsetMm * 1.4 : 0);
      const tipY = stageMidY + (this._dragAxis === 'y' ? this.focalOffsetMm * 1.8 : 0);

      const vesselX = stoneX + stoneR * 0.45;
      const distTipVessel = Math.abs(tipY - stageMidY);
      const flexPush = Math.max(0, 1.0 - distTipVessel / 45.0) * 10.0 * (0.7 + 0.3 * Math.sin(this.time * 24));

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(vesselX - 8, tissueY + 6);
      ctx.quadraticCurveTo(vesselX + flexPush, tipY, vesselX + 6, tissueY + tissueH - 6);
      ctx.stroke();

      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#69f0ae';
      ctx.font = compact ? '700 7.5px Inter, monospace' : '700 8.5px Inter, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(compact ? 'Vas Protejat' : 'Vas Protejat (Colagen)', vesselX + 10, tissueY + 14);

      // Stepped Titanium Ultrasonic Horn + Langevin Piezo Stack
      const handleX = Math.max(24, W * 0.08) + hornVib;
      const stackW = Math.max(48, W * 0.14);
      const bodyH = 30;

      // Handpiece housing & Langevin PZT rings
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, handleX, tipY - bodyH * 0.5, stackW, bodyH, 5);
      ctx.fill();
      ctx.stroke();

      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 === 0 ? '#fbbf24' : '#e2e8f0';
        ctx.fillRect(handleX + 10 + k * (stackW * 0.18), tipY - bodyH * 0.38, 6, bodyH * 0.76);
      }

      // Tapered Titanium Horn Amplifier
      const hornStart = handleX + stackW;
      const hGrad = safeLinearGrad(ctx, hornStart, tipY - 12, tipX, tipY + 12);
      if (hGrad) {
        hGrad.addColorStop(0, '#64748b');
        hGrad.addColorStop(0.5, '#e2e8f0');
        hGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = hGrad;
      } else {
        ctx.fillStyle = '#cbd5e1';
      }
      ctx.beginPath();
      ctx.moveTo(hornStart, tipY - 12);
      ctx.lineTo(hornStart + (tipX - hornStart) * 0.45, tipY - 12);
      ctx.lineTo(hornStart + (tipX - hornStart) * 0.50, tipY - 5);
      ctx.lineTo(tipX, tipY - 4);
      ctx.lineTo(tipX, tipY + 4);
      ctx.lineTo(hornStart + (tipX - hornStart) * 0.50, tipY + 5);
      ctx.lineTo(hornStart + (tipX - hornStart) * 0.45, tipY + 12);
      ctx.lineTo(hornStart, tipY + 12);
      ctx.closePath();
      ctx.fill();

      // Central aspiration lumen channel + emulsified droplets sucked inside
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(hornStart, tipY);
      ctx.stroke();

      for (let i = 0; i < this._suctionDroplets.length; i++) {
        const d = this._suctionDroplets[i];
        const dx = tipX + 14 - d.progress * (tipX + 14 - hornStart);
        const dy = tipY + d.yOff * (1.0 - d.progress);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.85)';
        ctx.beginPath();
        safeArc(ctx, dx, dy, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Localized Cavitation Bubble Cloud at CUSA tip
      this._renderCavitationBubbles(ctx, tipX + 8, tipY, 20, vesselX, tipY);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = compact ? '600 7.5px Inter, monospace' : '600 8.5px Inter, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Traductor Piezo + Corn Ti (23 kHz)', handleX, tipY + 26);

      ctx.restore();
    }

    // --- Lower 41% 3-Card Telemetry Console ---
    _renderLowerTelemetry(ctx, ox, oy, W, botH) {
      ctx.save();
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(ox, oy, W, botH);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, oy + 0.5);
      ctx.lineTo(ox + W, oy + 0.5);
      ctx.stroke();

      const compact = W < 580;
      const pad = compact ? 5 : 8;
      const availW = W - pad * 4;
      const cardH = Math.max(24, botH - pad * 2);
      const cardY = oy + pad;

      const w1 = Math.max(60, Math.round(availW * 0.38));
      const w2 = Math.max(60, Math.round(availW * 0.38));
      const w3 = Math.max(50, availW - w1 - w2);

      const x1 = ox + pad;
      const x2 = x1 + w1 + pad;
      const x3 = x2 + w2 + pad;

      this._renderShockWaveformCard(ctx, x1, cardY, w1, cardH, compact);
      this._renderRayleighPlessetCard(ctx, x2, cardY, w2, cardH, compact);
      this._renderIntegrityMeterCard(ctx, x3, cardY, w3, cardH, compact);

      ctx.restore();
    }

    _renderCardShell(ctx, x, y, w, h, title, titleColor, compact) {
      drawRoundedRect(ctx, x, y, w, h, 6);
      ctx.fillStyle = 'rgba(11, 20, 38, 0.94)';
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = titleColor;
      ctx.font = compact ? '700 7.5px Inter, monospace' : '700 9.5px Inter, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(title, x + 8, y + 6);
    }

    _renderShockWaveformCard(ctx, x, y, w, h, compact) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      const title = compact ? 'UNDĂ P(t) [MPa]' : 'UNDĂ DE ȘOC FOCALĂ P(t) [MPa]';
      this._renderCardShell(ctx, x, y, w, h, title, '#00e5ff', compact);

      const padL = compact ? 24 : 34;
      const padR = 8;
      const padT = compact ? 18 : 22;
      const padB = 10;
      const px = x + padL;
      const py = y + padT;
      const pw = w - padL - padR;
      const ph = h - padT - padB;
      if (pw < 20 || ph < 16) {
        ctx.restore();
        return;
      }

      // Scale: -18 MPa .. +64 MPa
      const pMin = -18.0;
      const pMax = 64.0;
      const mapY = (p) => py + ph * (1.0 - (clamp(p, pMin, pMax) - pMin) / (pMax - pMin));
      const yZero = mapY(0);
      const yPos40 = mapY(40);
      const yNeg10 = mapY(-10);

      // Reference lines: +40 MPa, 0 MPa, -10 MPa
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, yPos40); ctx.lineTo(px + pw, yPos40);
      ctx.moveTo(px, yNeg10); ctx.lineTo(px + pw, yNeg10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.beginPath();
      ctx.moveTo(px, yZero); ctx.lineTo(px + pw, yZero);
      ctx.stroke();

      // Y-axis tick labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = compact ? '600 7px Inter, monospace' : '600 8px Inter, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('+40', px - 3, yPos40);
      ctx.fillText('0', px - 3, yZero);
      ctx.fillText('-10', px - 3, yNeg10);

      // Plot trace (cyan above 0, red tensile tail below 0)
      const n = this.pHistory.length;
      if (n >= 2) {
        for (let i = 1; i < n; i++) {
          const p0 = this.pHistory[i - 1];
          const p1 = this.pHistory[i];
          const gx0 = px + ((i - 1) / (n - 1)) * pw;
          const gx1 = px + (i / (n - 1)) * pw;
          const gy0 = mapY(p0);
          const gy1 = mapY(p1);
          ctx.strokeStyle = (p0 + p1) * 0.5 < -0.2 ? '#ff5252' : '#00e5ff';
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(gx0, gy0);
          ctx.lineTo(gx1, gy1);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    _renderRayleighPlessetCard(ctx, x, y, w, h, compact) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      const title = compact ? 'CAVITAȚIE R(t)/R₀' : 'CAVITAȚIE RAYLEIGH-PLESSET R(t)/R₀';
      this._renderCardShell(ctx, x, y, w, h, title, '#fbbf24', compact);

      const padL = compact ? 22 : 30;
      const padR = 8;
      const padT = compact ? 18 : 22;
      const padB = 10;
      const px = x + padL;
      const py = y + padT;
      const pw = w - padL - padR;
      const ph = h - padT - padB;
      if (pw < 20 || ph < 16) {
        ctx.restore();
        return;
      }

      // Dynamic y-max fitted cleanly to observed expansion
      let rPeak = 3.2;
      for (let i = 0; i < this.rpHistory.length; i++) {
        if (this.rpHistory[i] > rPeak) rPeak = this.rpHistory[i];
      }
      const rMaxAxis = Math.min(12.0, Math.ceil(rPeak * 1.1));
      const mapY = (r) => py + ph * (1.0 - clamp(r, 0.0, rMaxAxis) / rMaxAxis);
      const yEq = mapY(1.0);

      // R/R0 = 1.0 equilibrium line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, yEq); ctx.lineTo(px + pw, yEq);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = compact ? '600 7px Inter, monospace' : '600 8px Inter, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rMaxAxis), px - 3, py + 4);
      ctx.fillText('1.0', px - 3, yEq);
      ctx.fillText('0', px - 3, py + ph - 2);

      const n = this.rpHistory.length;
      if (n >= 2) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const gx = px + (i / (n - 1)) * pw;
          const gy = mapY(this.rpHistory[i]);
          if (i === 0) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();

        // Highlight latest point
        const lastX = px + pw;
        const lastY = mapY(this.rpHistory[n - 1]);
        ctx.fillStyle = this.collapseFlash > 0.15 ? '#00e5ff' : '#fbbf24';
        ctx.beginPath();
        safeArc(ctx, lastX, lastY, this.collapseFlash > 0.15 ? 3.5 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Live radius readout in μm
      ctx.fillStyle = '#cbd5e1';
      ctx.font = compact ? '600 7px Inter, monospace' : '600 8px Inter, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const rUm = this.rpR * RP_R0_UM;
      ctx.fillText(`R=${rUm.toFixed(0)} μm`, x + w - 7, y + 6);

      ctx.restore();
    }

    _renderIntegrityMeterCard(ctx, x, y, w, h, compact) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      const title = this.cusaMode
        ? (compact ? 'EMULSIONARE' : 'EMULSIONARE CUSA')
        : (compact ? 'INTEGRITATE' : 'INTEGRITATE CALCUL');
      this._renderCardShell(ctx, x, y, w, h, title, '#69f0ae', compact);

      const pct = this.cusaMode ? this.cusaEmulsified : this.stoneIntegrity;
      const pctCol = this.cusaMode
        ? '#00e5ff'
        : (pct > 65 ? '#69f0ae' : (pct > 15 ? '#ffab40' : '#ff5252'));

      // Large percentage readout
      ctx.fillStyle = pctCol;
      ctx.font = compact ? '700 15px Inter, monospace' : '700 20px Inter, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${Math.round(pct)}%`, x + 8, y + (compact ? 20 : 24));

      // Progress bar
      const barX = x + 8;
      const barY = y + (compact ? 40 : 50);
      const barW = Math.max(12, w - 16);
      const barH = compact ? 7 : 9;

      drawRoundedRect(ctx, barX, barY, barW, barH, 3);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      const fillW = Math.max(0, barW * clamp(pct / 100.0, 0, 1));
      if (fillW > 1) {
        drawRoundedRect(ctx, barX, barY, fillW, barH, 3);
        ctx.fillStyle = pctCol;
        ctx.fill();
      }

      // Compact diagnostic lines
      const mat = STONE_MATERIALS[this.stoneType] || STONE_MATERIALS.urate;
      const lineY = barY + barH + (compact ? 6 : 9);
      ctx.fillStyle = '#94a3b8';
      ctx.font = compact ? '500 7px Inter, monospace' : '500 8.5px Inter, monospace';

      if (this.cusaMode) {
        ctx.fillText('Mod: 23 kHz Selectiv', x + 8, lineY);
        if (lineY + 13 < y + h - 4) {
          ctx.fillStyle = '#69f0ae';
          ctx.fillText('Vas: Protejat (Colagen)', x + 8, lineY + 13);
        }
      } else {
        ctx.fillText(`Tip: ${compact ? mat.shortLabel : mat.label}`, x + 8, lineY);
        if (lineY + 13 < y + h - 4) {
          const stateStr = this.stoneIntegrity <= 0
            ? 'Pulbere < 1 mm'
            : (this.stoneIntegrity < 99.9 ? 'Fisurare' : 'Intact');
          ctx.fillStyle = pctCol;
          ctx.fillText(`Stare: ${stateStr}`, x + 8, lineY + 13);
        }
        if (lineY + 26 < y + h - 4) {
          const off = Math.round(this.focalOffsetMm);
          ctx.fillStyle = '#94a3b8';
          const doseStr = compact
            ? `Doză: ${this.shockCount} | Δ=${off > 0 ? '+' : ''}${off}`
            : `Doză: ${this.shockCount} șocuri | Δ=${off > 0 ? '+' : ''}${off}mm`;
          ctx.fillText(doseStr, x + 8, lineY + 26);
        }
      }

      ctx.restore();
    }
  }

  window.UltrasonicLithotripsySim = UltrasonicLithotripsySim;
})();
