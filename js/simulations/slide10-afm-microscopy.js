/* ============================================================
   SLIDE10-AFM-MICROSCOPY.JS — Atomic Force Microscopy (AFM)
   Tapping & Non-Contact Resonance Mode, van der Waals Force Gradient,
   Optical Lever Laser Deflection, and Atomic Topography Reconstruction
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function safeArc(ctx, x, y, r, start, end, ccw) {
    const safeR = Math.max(0.1, Number.isFinite(r) ? r : 0.1);
    ctx.arc(x, y, safeR, start, end, !!ccw);
  }

  class AFMMicroscopySim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      const cfg = config || {};

      // --- Physical Parameters of Silicon Cantilever ---
      this.f0 = cfg.f0 || 150.0;       // Free resonant frequency (kHz)
      this.Q = cfg.Q || 140;           // Effective Q in ambient tapping (~140, ~1.07 kHz FWHM)
      this.k = cfg.k || 40.0;          // Cantilever spring constant (N/m)
      this.driveFreq = this.f0;        // Piezo drive frequency (kHz)
      this.freeAmp = 10.0;             // Free oscillation amplitude A0 (nm)

      // --- Scanner & Sample Geometry (6.0 nm high-resolution atomic scan field) ---
      this.scanRangeNm = 6.0;
      this.sampleZ = 10.3;             // Equilibrium tip-substrate height Z (nm)
      this.scanX = 0.0;                // Current scan X position (nm, 0..6.0)
      this.scanSpeed = 0.65;           // nm / s
      this.autoScan = true;            // Live scanning active on entry
      this.scanDirection = 1;
      this.sampleMode = 'silicon';     // 'silicon' | 'step' | 'graphene'
      this.operationMode = 'tapping';  // 'tapping' | 'non-contact'

      // --- Dynamic State ---
      this.zTip = 0.0;                 // Instantaneous visual tip deflection (nm)
      this.amp = this.freeAmp;         // Actual oscillation amplitude (nm)
      this.phase = 90.0;               // Phase lag (deg)
      this.deltaF = -180.0;            // Resonance frequency shift (Hz)
      this.avgForceNn = -0.35;         // Cycle-averaged tip-sample force (nN)
      this.tipInteractionGlow = 0.0;   // 0..1 glow when tapping / close vdW interaction
      this.visualPhase = 0.0;          // Smooth 2.4 Hz carrier (no stroboscopic aliasing)

      // --- Reconstructed Topography Profile Buffer ---
      this.topoHistory = [];
      this._lastSampleX = -999;

      // Pointer drag anchors
      this.isDraggingSample = false;
      this.dragStartY = 0;
      this.dragStartZ = 0;
      this.dragStartX = 0;
      this.dragStartScanX = 0;
      this._sampleRect = null;

      this._bindEvents();
    }

    onInit() {
      const fSlider = document.getElementById('sim10-freq');
      const fVal = document.getElementById('sim10-freq-val');
      const zSlider = document.getElementById('sim10-z');
      const zVal = document.getElementById('sim10-z-val');
      const aSlider = document.getElementById('sim10-amp0');
      const aVal = document.getElementById('sim10-amp0-val');

      if (fSlider && fVal) {
        fSlider.value = String(this.driveFreq);
        fVal.textContent = `${this.driveFreq.toFixed(2)} kHz`;
        fSlider.addEventListener('input', (e) => {
          this.driveFreq = clamp(parseFloat(e.target.value), 147.0, 153.0);
          fVal.textContent = `${this.driveFreq.toFixed(2)} kHz`;
          this._updateUIBadges();
          this.requestRender();
        });
      }

      if (zSlider && zVal) {
        zSlider.value = String(this.sampleZ);
        zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;
        zSlider.addEventListener('input', (e) => {
          this.sampleZ = clamp(parseFloat(e.target.value), 3.0, 22.0);
          zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;
          this._updateUIBadges();
          this.requestRender();
        });
      }

      if (aSlider && aVal) {
        aSlider.value = String(this.freeAmp);
        aVal.textContent = `${this.freeAmp.toFixed(0)} nm`;
        aSlider.addEventListener('input', (e) => {
          this.freeAmp = clamp(parseFloat(e.target.value), 4.0, 18.0);
          aVal.textContent = `${this.freeAmp.toFixed(0)} nm`;
          this._updateUIBadges();
          this.requestRender();
        });
      }

      const btnScan = document.getElementById('sim10-btn-scan');
      if (btnScan) {
        btnScan.classList.toggle('sim-btn--preset', this.autoScan);
        btnScan.textContent = this.autoScan ? '⏹ Oprește Scanarea' : '🔬 Scanare Automată 1D';
        btnScan.addEventListener('click', () => {
          this.autoScan = !this.autoScan;
          btnScan.classList.toggle('sim-btn--preset', this.autoScan);
          btnScan.textContent = this.autoScan ? '⏹ Oprește Scanarea' : '🔬 Scanare Automată 1D';
        });
      }

      const btnSilicon = document.getElementById('sim10-preset-silicon');
      const btnStep = document.getElementById('sim10-preset-step');
      const btnGraphene = document.getElementById('sim10-preset-graphene');

      if (btnSilicon) {
        btnSilicon.addEventListener('click', () => {
          this.sampleMode = 'silicon';
          this.topoHistory = [];
          this.scanX = 0.0;
          this.scanDirection = 1;
          this._highlightPreset(btnSilicon);
          this._updateUIBadges();
        });
      }

      if (btnStep) {
        btnStep.addEventListener('click', () => {
          this.sampleMode = 'step';
          this.topoHistory = [];
          this.scanX = 0.0;
          this.scanDirection = 1;
          this._highlightPreset(btnStep);
          this._updateUIBadges();
        });
      }

      if (btnGraphene) {
        btnGraphene.addEventListener('click', () => {
          this.sampleMode = 'graphene';
          this.topoHistory = [];
          this.scanX = 0.0;
          this.scanDirection = 1;
          this._highlightPreset(btnGraphene);
          this._updateUIBadges();
        });
      }

      const btnMode = document.getElementById('sim10-btn-toggle-mode');
      if (btnMode) {
        btnMode.addEventListener('click', () => {
          if (this.operationMode === 'tapping') {
            this.operationMode = 'non-contact';
            btnMode.textContent = '🧲 Mod: NON-CONTACT pur';
            btnMode.classList.add('sim-btn--preset');
            this.freeAmp = 5.0;
            this.sampleZ = 5.9;
          } else {
            this.operationMode = 'tapping';
            btnMode.textContent = '⚡ Mod: TAPPING (Intermitent)';
            btnMode.classList.remove('sim-btn--preset');
            this.freeAmp = 10.0;
            this.sampleZ = 10.3;
          }
          if (aSlider) aSlider.value = String(this.freeAmp);
          if (aVal) aVal.textContent = `${this.freeAmp.toFixed(0)} nm`;
          if (zSlider) zSlider.value = String(this.sampleZ);
          if (zVal) zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;
          this.topoHistory = [];
          this._updateUIBadges();
        });
      }

      const playBtn = document.getElementById('sim10-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Pornire';
        });
      }

      const resetBtn = document.getElementById('sim10-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          if (playBtn) playBtn.textContent = '⏸ Pauză';
        });
      }

      // Pre-evaluate one physics step so initial render has exact values
      this._physicsStep(0.005);
      this._updateUIBadges();
    }

    _highlightPreset(activeBtn) {
      const presets = ['sim10-preset-silicon', 'sim10-preset-step', 'sim10-preset-graphene'];
      for (const id of presets) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('sim-btn--preset');
      }
      if (activeBtn) activeBtn.classList.add('sim-btn--preset');
    }

    onReset() {
      this.zTip = 0;
      this.scanX = 0;
      this.scanDirection = 1;
      this.autoScan = true;
      this.topoHistory = [];
      this._lastSampleX = -999;
      this.driveFreq = this.f0;
      this.operationMode = 'tapping';
      this.freeAmp = 10.0;
      this.sampleZ = 10.3;
      this.sampleMode = 'silicon';

      const fSlider = document.getElementById('sim10-freq');
      const fVal = document.getElementById('sim10-freq-val');
      const zSlider = document.getElementById('sim10-z');
      const zVal = document.getElementById('sim10-z-val');
      const aSlider = document.getElementById('sim10-amp0');
      const aVal = document.getElementById('sim10-amp0-val');
      const btnScan = document.getElementById('sim10-btn-scan');
      const btnMode = document.getElementById('sim10-btn-toggle-mode');

      if (fSlider) fSlider.value = String(this.driveFreq);
      if (fVal) fVal.textContent = `${this.driveFreq.toFixed(2)} kHz`;
      if (zSlider) zSlider.value = String(this.sampleZ);
      if (zVal) zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;
      if (aSlider) aSlider.value = String(this.freeAmp);
      if (aVal) aVal.textContent = `${this.freeAmp.toFixed(0)} nm`;
      if (btnScan) {
        btnScan.classList.add('sim-btn--preset');
        btnScan.textContent = '⏹ Oprește Scanarea';
      }
      if (btnMode) {
        btnMode.classList.remove('sim-btn--preset');
        btnMode.textContent = '⚡ Mod: TAPPING (Intermitent)';
      }

      this._highlightPreset(document.getElementById('sim10-preset-silicon'));
      this._physicsStep(0.005);
      this._updateUIBadges();
    }

    _updateUIBadges() {
      const badgeFreq = document.getElementById('sim10-badge-freq');
      const badgeAmp = document.getElementById('sim10-badge-amp');
      const badgeShift = document.getElementById('sim10-badge-shift');
      const badgeHeight = document.getElementById('sim10-badge-height');

      if (badgeFreq) {
        badgeFreq.textContent = `f_piezo: ${this.driveFreq.toFixed(2)} kHz`;
      }
      if (badgeAmp) {
        badgeAmp.textContent = `Amplitudine: ${this.amp.toFixed(1)} nm`;
      }
      if (badgeShift) {
        const sign = this.deltaF >= 0 ? '+' : '';
        badgeShift.textContent = `Δf: ${sign}${Math.round(this.deltaF)} Hz`;
        badgeShift.className = Math.abs(this.deltaF) > 150
          ? 'sim-badge sim-badge--amber'
          : 'sim-badge sim-badge--cyan';
      }
      if (badgeHeight) {
        const currentH = this._getTrueSampleHeight(this.scanX);
        badgeHeight.textContent = `Relief Atomic: ${currentH.toFixed(2)} nm`;
      }
    }

    /** True atomic surface profile z_sample(x) in nm across [0 .. 6.0 nm], strictly >= 0.0 */
    _getTrueSampleHeight(x) {
      if (this.sampleMode === 'step') {
        // Atomic terrace step: lower terrace + tiny ripple -> upper mono-layer step (+0.31 nm Si(111))
        const ripple = 0.045 * (0.5 + 0.5 * Math.sin((2 * Math.PI * x) / 0.54));
        const smoothStep = 0.314 / (1 + Math.exp(-(x - 3.0) / 0.14));
        return ripple + smoothStep;
      } else if (this.sampleMode === 'graphene') {
        // Graphene lattice corrugation + central nanoscale blister/wrinkle
        const lattice = 0.055 * (0.5 + 0.5 * Math.sin((2 * Math.PI * x) / 0.36));
        const wrinkle = 0.32 * Math.exp(-Math.pow((x - 3.0) / 0.75, 2));
        return lattice + wrinkle;
      } else {
        // Silicon Si(111) reconstructed atomic row hills (~0.55 nm periodicity -> ~11 clean atomic peaks)
        const baseAtoms = 0.14 * (0.5 + 0.5 * Math.sin((2 * Math.PI * x) / 0.543));
        const island = (x > 1.9 && x < 4.2) ? 0.18 * (1 / (1 + Math.exp(-(x - 1.9) / 0.12)) - 1 / (1 + Math.exp(-(x - 4.2) / 0.12))) : 0.0;
        return baseAtoms + island;
      }
    }

    /** van der Waals + Pauli interaction at tip lower turnaround distance dMin (nm) */
    _getInteractionFromTurnaround(dMin) {
      // Smooth physical effective interaction for lower turnaround clearance dMin (nm)
      const d = Math.max(0.18, dMin);
      if (d > 4.5) {
        return { forceNn: 0.0, gradientNpm: 0.0 };
      }

      // Attractive van der Waals force F = -H*R / (6*d^2) -> negative force, positive stiffness softening dF/dz
      const fAttr = -0.38 / (d * d);
      const gradAttr = 0.76 / (d * d * d);

      // Short-range repulsive Hertz/Pauli contact for d < 0.34 nm
      let fRep = 0.0;
      let gradRep = 0.0;
      if (d < 0.34) {
        const pen = 0.34 - d;
        fRep = 18.0 * Math.pow(pen, 1.5);
        gradRep = -27.0 * Math.pow(pen, 0.5);
      }

      return {
        forceNn: fAttr + fRep,
        gradientNpm: gradAttr + gradRep // N/m equivalent effective cycle stiffness shift
      };
    }

    _bindEvents() {
      if (!this.canvas) return;

      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      };

      const onStart = (e) => {
        const pos = getPos(e);
        if (this._sampleRect &&
            pos.x >= this._sampleRect.x && pos.x <= this._sampleRect.x + this._sampleRect.w &&
            pos.y >= this._sampleRect.y && pos.y <= this._sampleRect.y + this._sampleRect.h) {
          this.isDraggingSample = true;
          this.dragStartY = pos.y;
          this.dragStartZ = this.sampleZ;
          this.dragStartX = pos.x;
          this.dragStartScanX = this.scanX;
        }
      };

      const onMove = (e) => {
        if (!this.isDraggingSample) return;
        const pos = getPos(e);

        const dy = pos.y - this.dragStartY;
        this.sampleZ = clamp(this.dragStartZ + dy * 0.08, 3.0, 22.0);

        const dx = pos.x - this.dragStartX;
        this.scanX = clamp(this.dragStartScanX - dx * 0.02, 0.0, this.scanRangeNm);

        const zSlider = document.getElementById('sim10-z');
        const zVal = document.getElementById('sim10-z-val');
        if (zSlider) zSlider.value = String(this.sampleZ);
        if (zVal) zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;

        this._updateUIBadges();
      };

      const onEnd = () => {
        this.isDraggingSample = false;
      };

      this.canvas.addEventListener('mousedown', onStart);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
    }

    update(dt) {
      const safeDt = clamp(dt, 0, 0.04);

      if (this.autoScan) {
        this.scanX += this.scanDirection * this.scanSpeed * safeDt;
        if (this.scanX >= this.scanRangeNm) {
          this.scanX = this.scanRangeNm;
          this.scanDirection = -1;
          this.topoHistory = [];
        } else if (this.scanX <= 0.0) {
          this.scanX = 0.0;
          this.scanDirection = 1;
          this.topoHistory = [];
        }
      }

      // Smooth 2.4 Hz visual carrier (eliminates 150 kHz stroboscopic aliasing)
      this.visualPhase += 2 * Math.PI * 2.4 * safeDt;
      if (this.visualPhase > Math.PI * 2) {
        this.visualPhase -= Math.PI * 2;
      }

      this._physicsStep(safeDt);

      // Record topography profile using physical interaction sensitivity
      const trueH = this._getTrueSampleHeight(this.scanX);
      const rFree = this.driveFreq / this.f0;
      const denFree = Math.sqrt(Math.pow(1 - rFree * rFree, 2) + Math.pow(rFree / this.Q, 2));
      const freeResAmp = this.freeAmp * Math.min(1.0, (1 / this.Q) / (denFree + 1e-9));
      const minTurnaroundDist = this.sampleZ - trueH - freeResAmp;
      // Feedback reconstructs surface topography accurately when tip enters van der Waals / tapping zone (< 2.2 nm)
      const signalStrength = clamp(1.35 - Math.max(0, minTurnaroundDist) * 0.48, 0.0, 1.0);
      const reconH = trueH * signalStrength + 0.006 * Math.sin(this.visualPhase * 2.0) * signalStrength;

      if (this.topoHistory.length === 0 || Math.abs(this.scanX - this._lastSampleX) >= 0.03) {
        this._lastSampleX = this.scanX;
        this.topoHistory.push({
          x: this.scanX,
          zTrue: trueH,
          zRecon: reconH
        });
        if (this.topoHistory.length > 260) {
          this.topoHistory.shift();
        }
      }

      this._updateUIBadges();
    }

    _physicsStep(dt) {
      const trueH = this._getTrueSampleHeight(this.scanX);

      // Estimate lower turnaround clearance from resonance envelope
      const rFree = this.driveFreq / this.f0;
      const denFree = Math.sqrt(Math.pow(1 - rFree * rFree, 2) + Math.pow(rFree / this.Q, 2));
      const resAmpNoContact = this.freeAmp * Math.min(1.0, (1 / this.Q) / (denFree + 1e-9));

      // Minimum tip-atom turnaround separation
      const rawDMin = this.sampleZ - trueH - resAmpNoContact;
      const effDMin = Math.max(0.24, rawDMin);

      // Compute cycle-averaged force & frequency shift Delta f = -(f0 / 2k) * (dF/dz)
      const inter = this._getInteractionFromTurnaround(effDMin);
      this.avgForceNn = inter.forceNn;

      // Physically realistic frequency shift scale (~ -150 to -600 Hz in attractive / light-tapping regime)
      const rawDeltaF = -(this.f0 * 1000 / (2 * this.k)) * inter.gradientNpm * 0.16;
      this.deltaF = clamp(rawDeltaF, -750, 650);

      // Shifted resonant frequency in kHz
      const fEffKHz = Math.max(145.0, this.f0 + this.deltaF * 0.001);
      const rEff = this.driveFreq / fEffKHz;
      const denEff = Math.sqrt(Math.pow(1 - rEff * rEff, 2) + Math.pow(rEff / this.Q, 2));
      const targetAmpFree = this.freeAmp * Math.min(1.0, (1 / this.Q) / (denEff + 1e-9));

      // In Tapping mode, intermittent contact with sample caps bottom amplitude dynamically
      const maxClearanceAmp = Math.max(0.4, this.sampleZ - trueH - 0.16);
      const targetAmp = (this.operationMode === 'tapping')
        ? Math.min(targetAmpFree, maxClearanceAmp)
        : targetAmpFree;

      // Smooth first-order envelope response
      const alpha = 1 - Math.exp(-dt * 18.0);
      this.amp += (targetAmp - this.amp) * (alpha > 0 ? alpha : 0.25);
      this.phase = Math.atan2(rEff / this.Q, 1 - rEff * rEff) * (180 / Math.PI);

      // Smooth visual tip displacement around equilibrium Z
      this.zTip = this.amp * Math.sin(this.visualPhase);

      // Highlight bottom-of-stroke interaction glow when tip approaches sample closely
      const instGap = (this.sampleZ - trueH) + this.zTip;
      this.tipInteractionGlow = clamp(1.0 - (instGap - 0.15) / 2.2, 0.0, 1.0);
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (W < 40 || H < 40) return;

      ctx.clearRect(0, 0, W, H);

      const topH = Math.max(110, Math.round(H * 0.56));
      const botH = Math.max(80, H - topH);

      this._renderMicroscopeStage(ctx, 0, 0, W, topH);
      this._renderTelemetryPanels(ctx, 0, topH, W, botH);
    }

    _renderMicroscopeStage(ctx, x0, y0, w, h) {
      // 1. Background
      const skyGrad = ctx.createLinearGradient(x0, y0, x0, y0 + h);
      skyGrad.addColorStop(0, '#060a14');
      skyGrad.addColorStop(0.75, '#0b1324');
      skyGrad.addColorStop(1, '#111c33');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(x0, y0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      for (let gx = 32; gx < w; gx += 42) {
        ctx.beginPath();
        ctx.moveTo(gx, y0);
        ctx.lineTo(gx, y0 + h);
        ctx.stroke();
      }
      for (let gy = 28; gy < h; gy += 36) {
        ctx.beginPath();
        ctx.moveTo(x0, gy);
        ctx.lineTo(x0 + w, gy);
        ctx.stroke();
      }

      // Header Banner + Live Mode / Force HUD Pill in Top-Right (zero overlap!)
      ctx.font = '700 10.5px Inter, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('MICROSCOP AFM — PÂRGHIE OPTICĂ & REZONANȚĂ', x0 + 14, y0 + 18);

      // Force & Gap HUD badge on top-right
      const hudText = `F_vdW: ${this.avgForceNn.toFixed(2)} nN | Z₀: ${this.sampleZ.toFixed(1)} nm`;
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      const hudW = ctx.measureText(hudText).width + 16;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x0 + w - hudW - 12, y0 + 7, hudW, 18);
      ctx.strokeStyle = this.operationMode === 'tapping' ? 'rgba(251, 191, 36, 0.5)' : 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + w - hudW - 12, y0 + 7, hudW, 18);
      ctx.fillStyle = this.operationMode === 'tapping' ? '#fbbf24' : '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText(hudText, x0 + w - 20, y0 + 19);

      // 2. Geometry Layout (Proportionally guaranteed inside [y0 + 30 .. y0 + h - 40])
      const stageY = y0 + h - 38;
      const tipHeightPx = 15;
      const maxVisualHeightPx = Math.max(40, stageY - (y0 + 82));
      const nmToPx = clamp(maxVisualHeightPx / 24.0, 2.2, 4.4);

      // Equilibrium cantilever anchor height so base and tip stay aligned gently
      const tipX = x0 + Math.round(w * 0.43);
      const holderX = Math.max(x0 + 54, Math.round(w * 0.12));

      //Tip deflection downwards is negative zTip -> positive canvas dY!
      const tipEquilibriumY = (stageY - 12) - this.sampleZ * nmToPx - tipHeightPx;
      const visualDeflPx = -this.zTip * nmToPx;
      //Clamp visual tip Y safely inside stage ceiling & atom top
      const tipBaseY = clamp(tipEquilibriumY + visualDeflPx, y0 + 52, stageY - 14 - tipHeightPx);

      // Cantilever holder stays aligned horizontally near tip equilibrium so beam looks realistic (never droopy fishing rod)
      const holderY = clamp(tipEquilibriumY - 6, y0 + 56, stageY - 46);

      // 3. Piezo Shaker & Chip Holder
      ctx.fillStyle = '#334155';
      ctx.fillRect(holderX - 28, holderY - 16, 36, 32);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(holderX - 28, holderY - 16, 36, 32);

      // Piezo stack stripes
      ctx.fillStyle = '#f59e0b';
      for (let s = -10; s <= 10; s += 10) {
        ctx.fillRect(holderX - 24, holderY + s - 2, 10, 4);
      }
      ctx.font = '600 8.5px Inter, monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText('PIEZO', holderX - 10, holderY - 21);

      // 4. Subtle Oscillation Envelope Ghost Bounds (+A / -A)
      const envPx = this.amp * nmToPx;
      const envTopY = clamp(tipEquilibriumY - envPx, y0 + 48, stageY - 14 - tipHeightPx);
      const envBotY = clamp(tipEquilibriumY + envPx, y0 + 48, stageY - 14 - tipHeightPx);

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      const beamStartX = holderX + 8;
      const beamSpan = tipX - beamStartX;
      [envTopY, envBotY].forEach((ey) => {
        ctx.beginPath();
        ctx.moveTo(beamStartX, holderY);
        ctx.quadraticCurveTo(beamStartX + beamSpan * 0.55, holderY + (ey - holderY) * 0.25, tipX, ey);
        ctx.stroke();
      });
      ctx.restore();

      // 5. Silicon Cantilever Beam (1st Flexural Mode Curvature + Gold Reflective Coating)
      ctx.save();
      const beamGrad = ctx.createLinearGradient(beamStartX, holderY, tipX, tipBaseY);
      beamGrad.addColorStop(0, '#94a3b8');
      beamGrad.addColorStop(0.65, '#cbd5e1');
      beamGrad.addColorStop(1, '#fde047'); // Gold mirror pad near tip
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(beamStartX, holderY);
      ctx.quadraticCurveTo(beamStartX + beamSpan * 0.55, holderY + (tipBaseY - holderY) * 0.25, tipX, tipBaseY);
      ctx.stroke();
      ctx.restore();

      // 6. Sharp Silicon Pyramidal Tip
      const apexY = tipBaseY + tipHeightPx;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(tipX - 6, tipBaseY);
      ctx.lineTo(tipX + 6, tipBaseY);
      ctx.lineTo(tipX, apexY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Glowing single apex atom (pulses warm amber when in close vdW / tapping regime)
      ctx.save();
      if (this.tipInteractionGlow > 0.1) {
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10 * this.tipInteractionGlow;
      }
      ctx.fillStyle = this.tipInteractionGlow > 0.45 ? '#fde047' : '#f8fafc';
      ctx.beginPath();
      safeArc(ctx, tipX, apexY, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Label clearly to the left of the tip (never colliding with beam or laser!)
      ctx.font = '600 8.5px Inter, monospace';
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'right';
      ctx.fillText('VÂRF Si', tipX - 11, tipBaseY + 11);

      // 7. Optical Lever: Laser Diode + 4-Quadrant Photodiode (Placed cleanly below y0 + 28)
      const laserX = Math.max(holderX + 55, tipX - 95);
      const laserY = y0 + 42;
      const detX = Math.min(x0 + w - 135, tipX + 125);
      const detY = y0 + 58;

      // Laser source housing
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(laserX - 14, laserY - 7, 14, 14);
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1;
      ctx.strokeRect(laserX - 14, laserY - 7, 14, 14);
      ctx.font = '700 8px Inter, monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.textAlign = 'right';
      ctx.fillText('LASER', laserX - 18, laserY + 3);

      // Reflected beam spot deflection on photodiode
      const spotShiftPx = clamp((-this.zTip / Math.max(4, this.freeAmp)) * 16.0, -18, 18);
      const hitY = detY + spotShiftPx;

      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.9;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 7;

      // Incident ray
      ctx.beginPath();
      ctx.moveTo(laserX, laserY);
      ctx.lineTo(tipX - 2, tipBaseY - 1);
      ctx.stroke();

      // Reflected ray
      ctx.beginPath();
      ctx.moveTo(tipX - 2, tipBaseY - 1);
      ctx.lineTo(detX, hitY);
      ctx.stroke();
      ctx.restore();

      // 4-Quadrant Photodiode Card (A, B / C, D)
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(detX, detY - 22, 28, 44);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(detX, detY - 22, 28, 44);

      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(detX, detY);
      ctx.lineTo(detX + 28, detY);
      ctx.moveTo(detX + 14, detY - 22);
      ctx.lineTo(detX + 14, detY + 22);
      ctx.stroke();

      ctx.font = '700 7.5px Inter, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('A', detX + 7, detY - 10);
      ctx.fillText('B', detX + 21, detY - 10);
      ctx.fillText('C', detX + 7, detY + 16);
      ctx.fillText('D', detX + 21, detY + 16);

      // Glowing laser spot on photodiode
      ctx.fillStyle = '#f87171';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      safeArc(ctx, detX + 14, hitY, 3.4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      ctx.font = '600 8px Inter, monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText('FOTODIODĂ', detX + 34, detY - 6);
      ctx.fillStyle = '#f87171';
      ctx.fillText(`Δ(A-C): ${(spotShiftPx * 0.85).toFixed(1)} mV`, detX + 34, detY + 7);

      // 8. Crystal Sample Stage & Atomic Lattice (0 .. 6.0 nm)
      const stageW = Math.max(180, Math.min(w - 48, 600));
      const stageX = Math.max(x0 + 24, Math.round((w - stageW) * 0.5));
      this._sampleRect = { x: stageX, y: stageY - 24, w: stageW, h: 52 };

      const subGrad = ctx.createLinearGradient(stageX, stageY, stageX, stageY + 26);
      subGrad.addColorStop(0, '#1e293b');
      subGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = subGrad;
      ctx.fillRect(stageX, stageY, stageW, 24);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(stageX, stageY, stageW, 24);

      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(`PROBĂ CRISTALINĂ (X = ${this.scanX.toFixed(2)} / ${this.scanRangeNm.toFixed(1)} nm) — Trage pentru X/Z`, stageX + stageW * 0.5, stageY + 16);

      // Draw crisp atomic spheres across [0 .. 6.0 nm] mapped to stage
      const pxPerNmX = stageW / this.scanRangeNm;
      const numAtoms = 28;
      for (let i = 0; i <= numAtoms; i++) {
        const atomWorldX = (i / numAtoms) * this.scanRangeNm;
        // Center scan window so atoms scroll smoothly under fixed tipX
        const atomCanvasX = tipX + (atomWorldX - this.scanX) * (pxPerNmX * 0.65);
        if (atomCanvasX < stageX + 8 || atomCanvasX > stageX + stageW - 8) continue;

        const atomH = this._getTrueSampleHeight(atomWorldX);
        const atomCanvasY = stageY - 7 - (atomH * 28.0);
        const r = 6.8;

        const radGrad = ctx.createRadialGradient(
          atomCanvasX - 2, atomCanvasY - 2, 0.8,
          atomCanvasX, atomCanvasY, r
        );
        if (this.sampleMode === 'step' && atomWorldX >= 3.0) {
          radGrad.addColorStop(0, '#fed7aa');
          radGrad.addColorStop(1, '#ea580c');
        } else if (this.sampleMode === 'graphene') {
          radGrad.addColorStop(0, '#a7f3d0');
          radGrad.addColorStop(1, '#059669');
        } else {
          radGrad.addColorStop(0, '#93c5fd');
          radGrad.addColorStop(1, '#1d4ed8');
        }

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        safeArc(ctx, atomCanvasX, atomCanvasY, r, 0, 2 * Math.PI);
        ctx.fill();

        // Highlight specular dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.beginPath();
        safeArc(ctx, atomCanvasX - 1.8, atomCanvasY - 1.8, 1.6, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 9. van der Waals interaction field pulse directly below tip apex
      const surfaceUnderTipY = stageY - 7 - (this._getTrueSampleHeight(this.scanX) * 28.0) - 6.8;
      if (apexY < surfaceUnderTipY && surfaceUnderTipY - apexY < 60) {
        ctx.save();
        ctx.strokeStyle = this.operationMode === 'tapping'
          ? `rgba(251, 191, 36, ${0.35 + 0.55 * this.tipInteractionGlow})`
          : 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([2.5, 2.5]);
        ctx.beginPath();
        ctx.moveTo(tipX, apexY);
        ctx.lineTo(tipX, surfaceUnderTipY);
        ctx.stroke();
        ctx.restore();
      }
    }

    _renderTelemetryPanels(ctx, x0, y0, w, h) {
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + w, y0);
      ctx.stroke();

      const pad = 10;
      const colW = Math.max(120, Math.floor((w - pad * 3) * 0.5));
      const plotH = Math.max(60, h - pad * 2);

      this._renderTopographyPlot(ctx, x0 + pad, y0 + pad, colW, plotH);
      this._renderSpectrumPlot(ctx, x0 + pad * 2 + colW, y0 + pad, colW, plotH);
    }

    _renderTopographyPlot(ctx, px, py, pw, ph) {
      ctx.fillStyle = '#0b1324';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);

      // Title Row (clean, never collides with legend)
      ctx.font = '700 9.5px Inter, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('PROFIL TOPOGRAFIC RECONSTITUIT (1D)', px + 10, py + 15);

      ctx.font = '600 8px Inter, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('-- Real   — Scanat AFM', px + pw - 10, py + 15);

      const plotX = px + 40;
      const plotY = py + 24;
      const plotW = Math.max(40, pw - 52);
      const plotH = Math.max(24, ph - 42);

      // Axes
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, plotY);
      ctx.lineTo(plotX, plotY + plotH);
      ctx.lineTo(plotX + plotW, plotY + plotH);
      ctx.stroke();

      // Axis labels
      ctx.font = '500 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText('+0.45 nm', plotX - 4, plotY + 8);
      ctx.fillText('0.00 nm', plotX - 4, plotY + plotH);

      ctx.textAlign = 'center';
      ctx.fillText(`Scanare X (0 → ${this.scanRangeNm.toFixed(1)} nm)`, plotX + plotW * 0.5, plotY + plotH + 12);

      // Clip interior curves strictly inside plot bounds so nothing ever overflows!
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotX, plotY - 2, plotW, plotH + 4);
      ctx.clip();

      const maxZScale = 0.45;
      const valToY = (v) => plotY + plotH - clamp(v / maxZScale, 0.0, 1.0) * plotH;

      // Dashed True Surface Profile
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const xNm = (i / 100) * this.scanRangeNm;
        const gx = plotX + (xNm / this.scanRangeNm) * plotW;
        const gy = valToY(this._getTrueSampleHeight(xNm));
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Solid Glowing Reconstructed AFM Trace
      if (this.topoHistory.length > 1) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        for (let i = 0; i < this.topoHistory.length; i++) {
          const pt = this.topoHistory[i];
          const gx = plotX + (pt.x / this.scanRangeNm) * plotW;
          const gy = valToY(pt.zRecon);
          if (i === 0) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Red scan position cursor
      const cursorX = plotX + (this.scanX / this.scanRangeNm) * plotW;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cursorX, plotY);
      ctx.lineTo(cursorX, plotY + plotH);
      ctx.stroke();

      ctx.restore();
    }

    _renderSpectrumPlot(ctx, px, py, pw, ph) {
      ctx.fillStyle = '#0b1324';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);

      // Header row 1: short clean title + Δf badge
      ctx.font = '700 9.5px Inter, monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'left';
      ctx.fillText('CURBA DE REZONANȚĂ AFM', px + 10, py + 15);

      const sign = this.deltaF >= 0 ? '+' : '';
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`-- f₀: 150 kHz`, px + pw - 96, py + 15);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`— Δf: ${sign}${Math.round(this.deltaF)} Hz`, px + pw - 10, py + 15);

      const plotX = px + 34;
      const plotY = py + 24;
      const plotW = Math.max(40, pw - 46);
      const plotH = Math.max(24, ph - 42);

      // Axes
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, plotY);
      ctx.lineTo(plotX, plotY + plotH);
      ctx.lineTo(plotX + plotW, plotY + plotH);
      ctx.stroke();

      // Frequency span: 147.0 kHz .. 153.0 kHz (zoomed 6 kHz span so 200-1000 Hz shift is clearly visible!)
      const fMin = 147.0;
      const fMax = 153.0;
      const fSpan = fMax - fMin;

      // X-axis ticks
      ctx.font = '500 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      [148, 150, 152].forEach((ft) => {
        const tx = plotX + ((ft - fMin) / fSpan) * plotW;
        ctx.fillText(`${ft}k`, tx, plotY + plotH + 12);
      });
      ctx.textAlign = 'right';
      ctx.fillText('A₀', plotX - 4, plotY + 8);
      ctx.fillText('0', plotX - 4, plotY + plotH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(plotX, plotY - 2, plotW, plotH + 4);
      ctx.clip();

      // Free Resonance Curve (Dashed Cyan)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i <= plotW; i += 2) {
        const fK = fMin + (i / plotW) * fSpan;
        const r = fK / this.f0;
        const den = Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / this.Q, 2));
        const val = (1 / this.Q) / (den + 1e-9);
        const gy = plotY + plotH - clamp(val, 0, 1.0) * (plotH - 4);
        if (i === 0) ctx.moveTo(plotX + i, gy);
        else ctx.lineTo(plotX + i, gy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Shifted Coupled Resonance Curve (Solid Amber)
      const fEff = Math.max(145.0, this.f0 + this.deltaF * 0.001);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      for (let i = 0; i <= plotW; i += 2) {
        const fK = fMin + (i / plotW) * fSpan;
        const r = fK / fEff;
        const den = Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / this.Q, 2));
        const val = (1 / this.Q) / (den + 1e-9);
        const gy = plotY + plotH - clamp(val, 0, 1.0) * (plotH - 4);
        if (i === 0) ctx.moveTo(plotX + i, gy);
        else ctx.lineTo(plotX + i, gy);
      }
      ctx.stroke();

      // Drive frequency marker & operating dot
      const markerX = plotX + clamp((this.driveFreq - fMin) / fSpan, 0, 1) * plotW;
      const opY = plotY + plotH - clamp(this.amp / Math.max(1, this.freeAmp), 0, 1) * (plotH - 4);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(markerX, plotY);
      ctx.lineTo(markerX, plotY + plotH);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      safeArc(ctx, markerX, opY, 4.0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  }

  window.AFMMicroscopySim = AFMMicroscopySim;
})();
