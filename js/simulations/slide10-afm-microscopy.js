/* ============================================================
   SLIDE10-AFM-MICROSCOPY.JS — Atomic Force Microscopy (AFM)
   Tapping & Non-Contact Resonance Mode, van der Waals Force Gradient,
   Optical Lever Laser Deflection, and Atomic Topography Reconstruction
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  class AFMMicroscopySim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Physical Parameters of Silicon Cantilever ---
      this.f0 = config.f0 || 150.0; // Fundamental resonant frequency (kHz)
      this.Q = config.Q || 450;      // Quality factor in air (typically 300 - 600)
      this.k = config.k || 40.0;     // Spring constant (N/m)
      this.driveFreq = this.f0;      // Excitation frequency (kHz)
      this.freeAmp = 20.0;           // Free oscillation amplitude A0 (nm)

      // --- Scanner & Sample Geometry ---
      this.sampleZ = 8.0;            // Average tip-sample clearance Z (nm, 1 to 25 nm)
      this.scanX = 0.0;              // Current scan position along sample (nm)
      this.scanSpeed = 1.8;          // nm per second in auto-scan
      this.autoScan = false;
      this.scanDirection = 1;
      this.sampleMode = 'silicon';   // 'silicon', 'step', 'graphene'
      this.operationMode = 'tapping';// 'tapping' or 'non-contact'

      // --- Dynamic State of Cantilever Tip ---
      this.zTip = 0.0;               // Relative tip deflection (nm)
      this.vTip = 0.0;               // Tip velocity (nm/ms)
      this.amp = this.freeAmp;       // Measured oscillation amplitude (nm)
      this.phase = 90.0;             // Phase lag (degrees, 90 deg at exact free resonance)
      this.deltaF = 0.0;             // Frequency shift (Hz)
      this.feedbackZ = 0.0;          // Piezo Z height adjustment for topography (nm)

      // --- Historical Data Buffers for Oscilloscope & Topography Profile ---
      this.topoHistory = [];         // Array of { x: nm, zTrue: nm, zRecon: nm }
      this.rfHistory = [];           // Waveform buffer for oscilloscope
      this.historyMax = 220;

      // Mouse drag anchors
      this.isDraggingSample = false;
      this.dragStartY = 0;
      this.dragStartZ = 0;
      this.isDraggingProbeX = false;
      this.dragStartX = 0;
      this.dragStartScanX = 0;

      this._bindEvents();
    }

    onInit() {
      // Connect UI sliders
      const fSlider = document.getElementById('sim10-freq');
      const fVal = document.getElementById('sim10-freq-val');
      const zSlider = document.getElementById('sim10-z');
      const zVal = document.getElementById('sim10-z-val');
      const aSlider = document.getElementById('sim10-amp0');
      const aVal = document.getElementById('sim10-amp0-val');

      if (fSlider && fVal) {
        fSlider.addEventListener('input', (e) => {
          this.driveFreq = parseFloat(e.target.value);
          fVal.textContent = `${this.driveFreq.toFixed(1)} kHz`;
          this._updateUIBadges();
        });
      }

      if (zSlider && zVal) {
        zSlider.addEventListener('input', (e) => {
          this.sampleZ = parseFloat(e.target.value);
          zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;
          this._updateUIBadges();
        });
      }

      if (aSlider && aVal) {
        aSlider.addEventListener('input', (e) => {
          this.freeAmp = parseFloat(e.target.value);
          aVal.textContent = `${this.freeAmp.toFixed(0)} nm`;
          this._updateUIBadges();
        });
      }

      // Presets & Toggles
      const btnScan = document.getElementById('sim10-btn-scan');
      if (btnScan) {
        btnScan.addEventListener('click', () => {
          this.autoScan = !this.autoScan;
          btnScan.classList.toggle('sim-btn--preset', this.autoScan);
          btnScan.textContent = this.autoScan ? '⏹ Oprește Scanarea' : '🔬 Scanare Automată 1D';
        });
      }

      const btnSilicon = document.getElementById('sim10-preset-silicon');
      if (btnSilicon) {
        btnSilicon.addEventListener('click', () => {
          this.sampleMode = 'silicon';
          this.topoHistory = [];
          this._highlightPreset(btnSilicon);
          this._updateUIBadges();
        });
      }

      const btnStep = document.getElementById('sim10-preset-step');
      if (btnStep) {
        btnStep.addEventListener('click', () => {
          this.sampleMode = 'step';
          this.topoHistory = [];
          this._highlightPreset(btnStep);
          this._updateUIBadges();
        });
      }

      const btnGraphene = document.getElementById('sim10-preset-graphene');
      if (btnGraphene) {
        btnGraphene.addEventListener('click', () => {
          this.sampleMode = 'graphene';
          this.topoHistory = [];
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
            this.sampleZ = Math.max(12.0, this.sampleZ);
          } else {
            this.operationMode = 'tapping';
            btnMode.textContent = '⚡ Mod: TAPPING (Intermitent)';
            btnMode.classList.remove('sim-btn--preset');
            this.sampleZ = Math.min(8.0, this.sampleZ);
          }
          if (zSlider) zSlider.value = this.sampleZ;
          if (zVal) zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;
          this._updateUIBadges();
        });
      }

      const playBtn = document.getElementById('sim10-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (this.running) {
            this.stop();
            playBtn.textContent = '▶ Pornire';
          } else {
            this.start();
            playBtn.textContent = '⏸ Pauză';
          }
        });
      }

      const resetBtn = document.getElementById('sim10-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.onReset();
          if (playBtn) playBtn.textContent = '⏸ Pauză';
        });
      }

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
      this.vTip = 0;
      this.scanX = 0;
      this.autoScan = false;
      this.topoHistory = [];
      this.rfHistory = [];
      this.driveFreq = this.f0;
      this.sampleZ = this.operationMode === 'tapping' ? 8.0 : 14.0;
      this.freeAmp = 20.0;

      const fSlider = document.getElementById('sim10-freq');
      const fVal = document.getElementById('sim10-freq-val');
      const zSlider = document.getElementById('sim10-z');
      const zVal = document.getElementById('sim10-z-val');
      const aSlider = document.getElementById('sim10-amp0');
      const aVal = document.getElementById('sim10-amp0-val');
      const btnScan = document.getElementById('sim10-btn-scan');

      if (fSlider) fSlider.value = this.f0;
      if (fVal) fVal.textContent = `${this.f0.toFixed(1)} kHz`;
      if (zSlider) zSlider.value = this.sampleZ;
      if (zVal) zVal.textContent = `${this.sampleZ.toFixed(1)} nm`;
      if (aSlider) aSlider.value = this.freeAmp;
      if (aVal) aVal.textContent = `${this.freeAmp.toFixed(0)} nm`;
      if (btnScan) {
        btnScan.classList.remove('sim-btn--preset');
        btnScan.textContent = '🔬 Scanare Automată 1D';
      }

      this._updateUIBadges();
    }

    _updateUIBadges() {
      const badgeFreq = document.getElementById('sim10-badge-freq');
      const badgeAmp = document.getElementById('sim10-badge-amp');
      const badgeShift = document.getElementById('sim10-badge-shift');
      const badgeHeight = document.getElementById('sim10-badge-height');

      if (badgeFreq) {
        badgeFreq.textContent = `f_piezo: ${this.driveFreq.toFixed(1)} kHz`;
      }
      if (badgeAmp) {
        badgeAmp.textContent = `Amplitudine: ${this.amp.toFixed(1)} nm`;
      }
      if (badgeShift) {
        const sign = this.deltaF >= 0 ? '+' : '';
        badgeShift.textContent = `Δf: ${sign}${this.deltaF.toFixed(0)} Hz`;
        badgeShift.className = Math.abs(this.deltaF) > 120
          ? 'sim-badge sim-badge--amber'
          : 'sim-badge sim-badge--cyan';
      }
      if (badgeHeight) {
        const currentH = this._getTrueSampleHeight(this.scanX);
        badgeHeight.textContent = `Relief Atomic: ${currentH.toFixed(2)} nm`;
      }
    }

    /** True height of sample surface at position x (nm) */
    _getTrueSampleHeight(x) {
      if (this.sampleMode === 'step') {
        // Atomic mono-layer step (e.g. Si(111) single step = 0.314 nm)
        const stepEdge = 15.0; // nm
        return x >= stepEdge ? 0.314 : 0.0;
      } else if (this.sampleMode === 'graphene') {
        // Hexagonal atomic corrugation (period 0.246 nm, amp 0.06 nm) + wrinkle
        const lattice = 0.06 * Math.sin((2 * Math.PI * x) / 0.246);
        const wrinkle = 0.45 * Math.exp(-Math.pow((x - 14.0) / 3.0, 2));
        return lattice + wrinkle;
      } else {
        // Standard Silicon (111) atomic lattice (period 0.543 nm, amp 0.12 nm)
        const atomicRipples = 0.14 * Math.sin((2 * Math.PI * x) / 0.543);
        const terrace = (x > 10.0 && x < 22.0) ? 0.22 : 0.0;
        return atomicRipples + terrace;
      }
    }

    /** van der Waals interactive force F_vdW(d) and force gradient dF/dd */
    _getVdWForce(distance) {
      // d: distance between tip apex and local sample surface (nm)
      // Lennard-Jones derivative model adapted for macroscopic tip sphere radius R=15 nm
      // Hamaker constant H = 1.0e-19 J
      const d = Math.max(0.18, distance); // prevent singularity at hard contact

      // Attractive van der Waals component (long-range ~ 1/d^2)
      const fAttr = -2.4 / (d * d);
      const gradAttr = 4.8 / (d * d * d); // dF/dd > 0 (reduces effective stiffness)

      // Short-range Pauli repulsion (Born repulsion ~ 1/d^8 for tip-sample)
      let fRep = 0;
      let gradRep = 0;
      if (d < 0.35) {
        const delta = 0.35 - d;
        fRep = 85.0 * Math.pow(delta, 2.5);
        gradRep = -212.5 * Math.pow(delta, 1.5);
      }

      return {
        force: fAttr + fRep,
        gradient: gradAttr + gradRep // nN/nm = N/m
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
        // Check if clicking in sample stage area to drag Z or X
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

        // Vertical drag: adjust sampleZ
        const dy = pos.y - this.dragStartY;
        // Dragging down moves sample further away (increases Z)
        const newZ = Math.max(1.0, Math.min(25.0, this.dragStartZ + dy * 0.08));
        this.sampleZ = newZ;

        // Horizontal drag: adjust scanX
        const dx = pos.x - this.dragStartX;
        this.scanX = Math.max(0, Math.min(30.0, this.dragStartScanX - dx * 0.08));

        const zSlider = document.getElementById('sim10-z');
        const zVal = document.getElementById('sim10-z-val');
        if (zSlider) zSlider.value = this.sampleZ;
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
      // 1. Advance auto-scan along sample surface
      if (this.autoScan) {
        this.scanX += this.scanDirection * this.scanSpeed * dt;
        if (this.scanX >= 30.0) {
          this.scanX = 30.0;
          this.scanDirection = -1;
        } else if (this.scanX <= 0.0) {
          this.scanX = 0.0;
          this.scanDirection = 1;
        }
      }

      // 2. High-frequency sub-stepping (8 sub-steps per frame) for nano-mechanics
      const subSteps = 8;
      const subDt = Math.min(dt, 0.033) / subSteps;
      for (let s = 0; s < subSteps; s++) {
        this._physicsStep(subDt);
      }

      // 3. Feedback topography tracking (Constant Amplitude / Frequency Shift mode)
      // Feedback loop acts as a proportional-integral controller adjusting sample position
      const targetAmp = this.freeAmp * (this.operationMode === 'tapping' ? 0.65 : 0.92);
      const error = this.amp - targetAmp;
      this.feedbackZ += error * 0.06;
      this.feedbackZ = Math.max(-2.5, Math.min(2.5, this.feedbackZ));

      const reconHeight = this._getTrueSampleHeight(this.scanX) + (Math.sin(this.time * 60) * 0.015);

      // Record profile history
      if (this.topoHistory.length === 0 || Math.abs(this.scanX - this.topoHistory[this.topoHistory.length - 1].x) > 0.12) {
        this.topoHistory.push({
          x: this.scanX,
          zTrue: this._getTrueSampleHeight(this.scanX),
          zRecon: reconHeight,
          amp: this.amp,
          deltaF: this.deltaF
        });
        if (this.topoHistory.length > 200) {
          this.topoHistory.shift();
        }
      }

      // Record RF waveform for oscilloscope
      this.rfHistory.push(this.zTip);
      if (this.rfHistory.length > this.historyMax) {
        this.rfHistory.shift();
      }

      this._updateUIBadges();
    }

    _physicsStep(dt) {
      // Harmonic drive from piezo base: F_drive(t)
      const omegaDrive = 2 * Math.PI * (this.driveFreq * 1000); // rad/s
      const omega0 = 2 * Math.PI * (this.f0 * 1000);
      const mEff = this.k / (omega0 * omega0); // Effective cantilever mass (kg)

      // Instantaneous clearance between tip apex and sample
      const sampleSurfaceH = this._getTrueSampleHeight(this.scanX);
      const instantaneousDistance = (this.sampleZ - sampleSurfaceH) - this.zTip;

      // Calculate van der Waals force and gradient
      const vdw = this._getVdWForce(instantaneousDistance);

      // Effective frequency shift Delta f = -(f0 / 2k) * (dF/dz)
      // When dF/dz > 0 (attractive region), frequency decreases (negative shift)
      this.deltaF = -(this.f0 * 1000 / (2 * this.k)) * vdw.gradient;
      this.deltaF = Math.max(-1800, Math.min(1800, this.deltaF));

      // Effective stiffness k_eff = k - dF/dz
      const kEff = Math.max(2.0, this.k - vdw.gradient);
      const effectiveOmega0 = Math.sqrt(kEff / mEff);

      // Resonance response curve amplitude & phase calculation:
      const r = (this.driveFreq * 1000) / effectiveOmega0;
      const den = Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / this.Q, 2));
      const ampRatio = (1 / this.Q) / (den + 1e-9);

      // Steady-state amplitude tracking
      const targetAmp = this.freeAmp * Math.min(1.0, ampRatio * this.Q);
      // In tapping mode, amplitude is geometrically clipped by sample contact
      const maxAllowedAmp = Math.max(0.5, this.sampleZ - sampleSurfaceH - 0.2);
      const activeAmp = this.operationMode === 'tapping'
        ? Math.min(targetAmp, maxAllowedAmp)
        : targetAmp;

      // Smooth amplitude transition
      this.amp += (activeAmp - this.amp) * 0.15;
      this.phase = Math.atan2(r / this.Q, 1 - r * r) * (180 / Math.PI);

      // Dynamic tip position for smooth high-FPS rendering
      this.zTip = this.amp * Math.sin(omegaDrive * (this.time * 0.001));
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (W < 40 || H < 40) return;

      ctx.clearRect(0, 0, W, H);

      // Split layout: Upper 60% for AFM Microscope & Optical Lever Laser, Lower 40% for Telemetry
      const topH = Math.max(90, Math.round(H * 0.60));
      const botH = Math.max(60, H - topH);

      this._renderMicroscopeStage(ctx, 0, 0, W, topH);
      this._renderTelemetryPanels(ctx, 0, topH, W, botH);
    }

    /** Upper View: Silicon Cantilever, Laser Optical Lever, Photodiode & Atomic Lattice */
    _renderMicroscopeStage(ctx, x0, y0, w, h) {
      // 1. Vacuum / Lab Chamber Background
      const skyGrad = ctx.createLinearGradient(x0, y0, x0, y0 + h);
      skyGrad.addColorStop(0, '#060a14');
      skyGrad.addColorStop(0.75, '#0b1324');
      skyGrad.addColorStop(1, '#131e36');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(x0, y0, w, h);

      // Subtle technical coordinates grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
      ctx.lineWidth = 1;
      for (let gx = 30; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, y0);
        ctx.lineTo(gx, y0 + h);
        ctx.stroke();
      }
      for (let gy = 25; gy < h; gy += 35) {
        ctx.beginPath();
        ctx.moveTo(x0, gy);
        ctx.lineTo(x0 + w, gy);
        ctx.stroke();
      }

      // Title HUD inside canvas
      ctx.font = '700 11px Inter, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('MICROSCOP DE FORȚĂ ATOMICĂ (AFM) — MOD REZONANT TAPPING & NON-CONTACT', x0 + 16, y0 + 20);

      // 2. Geometry Anchors
      const stageBaseY = y0 + h - 45;
      const chipBaseX = x0 + 40;
      const chipBaseY = y0 + 65;

      // Tip resting position
      const tipVisualX = chipBaseX + Math.min(260, w * 0.36);
      // Visual scaling: 1 nm = 3.5 px vertical
      const visualNmScale = 3.2;
      const visualClearancePx = this.sampleZ * visualNmScale;
      const visualTipY = stageBaseY - 18 - visualClearancePx + (this.zTip * visualNmScale * 0.35);

      // 3. Cantilever Chip Holder (Piezo Shaker Drive)
      const holderGrad = ctx.createLinearGradient(chipBaseX - 30, chipBaseY - 25, chipBaseX + 15, chipBaseY + 25);
      holderGrad.addColorStop(0, '#64748b');
      holderGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = holderGrad;
      ctx.fillRect(chipBaseX - 28, chipBaseY - 22, 44, 44);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(chipBaseX - 28, chipBaseY - 22, 44, 44);

      // Piezo ceramic wiring
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chipBaseX - 28, chipBaseY - 8);
      ctx.lineTo(chipBaseX - 40, chipBaseY - 14);
      ctx.moveTo(chipBaseX - 28, chipBaseY + 8);
      ctx.lineTo(chipBaseX - 40, chipBaseY + 14);
      ctx.stroke();

      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'right';
      ctx.fillText('PIEZO SHAKER', chipBaseX - 44, chipBaseY + 3);

      // 4. Elastic Silicon Cantilever Beam (drawn with smooth curvature)
      const cantLength = tipVisualX - (chipBaseX + 16);
      const cantStartX = chipBaseX + 16;
      const cantStartY = chipBaseY;

      // Beam body (Silicon with golden reflective back layer)
      ctx.save();
      const beamGrad = ctx.createLinearGradient(cantStartX, cantStartY, tipVisualX, visualTipY);
      beamGrad.addColorStop(0, '#94a3b8');
      beamGrad.addColorStop(0.5, '#cbd5e1');
      beamGrad.addColorStop(1, '#fef08a'); // Gold coating at the tip for laser reflection
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(cantStartX, cantStartY);
      // Quadratic bezier curve bending down towards tip
      const ctrlX = cantStartX + cantLength * 0.55;
      const ctrlY = cantStartY + (visualTipY - cantStartY) * 0.25;
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipVisualX, visualTipY);
      ctx.stroke();
      ctx.restore();

      // 5. Ultra-sharp Pyramidal Silicon Tip (Single-atom apex)
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(tipVisualX - 7, visualTipY);
      ctx.lineTo(tipVisualX + 7, visualTipY);
      ctx.lineTo(tipVisualX, visualTipY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Single Atom at the apex of the tip
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(tipVisualX, visualTipY + 18, 2.2, 0, 2 * Math.PI);
      ctx.fill();

      // Tip labels
      ctx.font = '600 9px Inter, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.fillText('VÂRF NANOMETRIC', tipVisualX, visualTipY - 8);

      // 6. Laser Optical Lever (Diode Laser -> Cantilever Back -> 4-Quadrant Photodiode)
      const laserSourceX = tipVisualX - 90;
      const laserSourceY = y0 + 35;
      const detectorX = tipVisualX + 130;
      const detectorY = y0 + 40;

      // Laser Diode Box
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(laserSourceX - 16, laserSourceY - 8, 16, 16);
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1;
      ctx.strokeRect(laserSourceX - 16, laserSourceY - 8, 16, 16);
      ctx.font = '700 8px Inter, monospace';
      ctx.fillStyle = '#fee2e2';
      ctx.textAlign = 'right';
      ctx.fillText('DIODĂ LASER', laserSourceX - 20, laserSourceY + 4);

      // Incident Laser Beam (Red Glowing Ray)
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(laserSourceX, laserSourceY);
      ctx.lineTo(tipVisualX - 2, visualTipY + 1);
      ctx.stroke();

      // Reflected Laser Beam towards 4-quadrant photodiode
      // Angle shifts proportionally to cantilever deflection zTip
      const beamAngleDeflection = (this.zTip / this.freeAmp) * 14.0;
      const hitDetY = detectorY + beamAngleDeflection;

      ctx.beginPath();
      ctx.moveTo(tipVisualX - 2, visualTipY + 1);
      ctx.lineTo(detectorX, hitDetY);
      ctx.stroke();
      ctx.restore();

      // 7. 4-Quadrant Photodiode (A, B, C, D)
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(detectorX, detectorY - 26, 32, 52);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(detectorX, detectorY - 26, 32, 52);

      // Dividing lines for 4 quadrants
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(detectorX, detectorY);
      ctx.lineTo(detectorX + 32, detectorY);
      ctx.moveTo(detectorX + 16, detectorY - 26);
      ctx.lineTo(detectorX + 16, detectorY + 26);
      ctx.stroke();

      // Labels A, B, C, D
      ctx.font = '700 8px Inter, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('A', detectorX + 8, detectorY - 12);
      ctx.fillText('B', detectorX + 24, detectorY - 12);
      ctx.fillText('C', detectorX + 8, detectorY + 18);
      ctx.fillText('D', detectorX + 24, detectorY + 18);

      // Active glowing laser spot on photodiode
      ctx.fillStyle = '#f87171';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(detectorX + 16, hitDetY, 3.8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      ctx.font = '600 8px Inter, monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText('FOTODIODĂ 4-CADRANE', detectorX + 38, detectorY - 6);
      ctx.fillText('(Semnal A - B: Deflecție)', detectorX + 38, detectorY + 8);

      // 8. Sample Stage & Atomic Lattice Surface
      const stageW = Math.max(160, Math.min(w - 80, 580));
      const stageX = Math.max(20, tipVisualX - stageW * 0.45);
      const stageY = stageBaseY;
      this._sampleRect = { x: stageX, y: stageY - 20, w: stageW, h: 55 };

      // Stage substrate base
      const subGrad = ctx.createLinearGradient(stageX, stageY, stageX, stageY + 28);
      subGrad.addColorStop(0, '#1e293b');
      subGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = subGrad;
      ctx.fillRect(stageX, stageY, stageW, 26);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(stageX, stageY, stageW, 26);

      // Piezo Z Scanner arrows
      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('PROBĂ CRISTALINĂ & SCANNER PIEZOELECTRO-MECANIC X-Y-Z', stageX + stageW * 0.5, stageY + 18);

      // Draw Individual Atoms on the Sample Surface (2.5D Shaded Spheres)
      const numAtoms = Math.floor(stageW / 18);
      for (let i = 0; i < numAtoms; i++) {
        const atomWorldX = (i / numAtoms) * 30.0; // in nm
        const relativeScanX = atomWorldX - this.scanX;
        const atomCanvasX = tipVisualX + relativeScanX * 18.0;

        if (atomCanvasX < stageX || atomCanvasX > stageX + stageW) continue;

        const atomH = this._getTrueSampleHeight(atomWorldX);
        const atomCanvasY = stageY - 8 - (atomH * visualNmScale * 14.0);

        // Atom sphere with radial gradient for 2.5D atomic lattice appearance
        const atomRadius = 7.5;
        const radGrad = ctx.createRadialGradient(
          atomCanvasX - 2.5, atomCanvasY - 2.5, 1,
          atomCanvasX, atomCanvasY, atomRadius
        );
        if (this.sampleMode === 'step' && atomWorldX >= 15.0) {
          radGrad.addColorStop(0, '#fed7aa'); // Step terrace atoms (amber)
          radGrad.addColorStop(1, '#ea580c');
        } else if (this.sampleMode === 'graphene') {
          radGrad.addColorStop(0, '#a7f3d0'); // Graphene carbon atoms (emerald)
          radGrad.addColorStop(1, '#059669');
        } else {
          radGrad.addColorStop(0, '#93c5fd'); // Silicon atoms (blue)
          radGrad.addColorStop(1, '#1d4ed8');
        }

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(atomCanvasX, atomCanvasY, atomRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Atom core dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(atomCanvasX - 2, atomCanvasY - 2, 1.8, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 9. van der Waals Force Interaction Lines (Glowing Cyan/Purple field between Tip and Surface)
      const apexCanvasY = visualTipY + 18;
      const surfaceUnderTipY = stageY - 8 - (this._getTrueSampleHeight(this.scanX) * visualNmScale * 14.0);
      const gapPx = surfaceUnderTipY - apexCanvasY;

      if (gapPx > 2 && gapPx < 85) {
        ctx.save();
        ctx.strokeStyle = this.operationMode === 'tapping'
          ? 'rgba(245, 158, 11, 0.65)'
          : 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(tipVisualX, apexCanvasY);
        ctx.lineTo(tipVisualX, surfaceUnderTipY);
        ctx.stroke();
        ctx.restore();

        // Force label HUD
        ctx.font = '700 9px Inter, monospace';
        ctx.fillStyle = this.operationMode === 'tapping' ? '#fbbf24' : '#38bdf8';
        ctx.textAlign = 'left';
        ctx.fillText(
          `F_vdW: ${(this._getVdWForce(this.sampleZ).force).toFixed(2)} nN`,
          tipVisualX + 12,
          apexCanvasY + gapPx * 0.5 + 3
        );
      }
    }

    /** Lower Telemetry Panels: 1D Topography Profile (Left) & Resonance Spectrum (Right) */
    _renderTelemetryPanels(ctx, x0, y0, w, h) {
      // Background base
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + w, y0);
      ctx.stroke();

      const pad = 12;
      const colW = Math.max(120, (w - pad * 3) * 0.5);
      const plotH = Math.max(50, h - pad * 2);

      // Panel 1: Topography Reconstructed 1D Profile (Atomic Corrugation)
      this._renderTopographyPlot(ctx, x0 + pad, y0 + pad, colW, plotH);

      // Panel 2: Frequency Resonance Spectrum & van der Waals Shift
      this._renderSpectrumPlot(ctx, x0 + pad * 2 + colW, y0 + pad, colW, plotH);
    }

    _renderTopographyPlot(ctx, px, py, pw, ph) {
      ctx.fillStyle = '#0b1324';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);

      // Header
      ctx.font = '700 10px Inter, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('PROFIL TOPOGRAFIC RECONSTITUIT (REZOLUȚIE ATOMICĂ)', px + 10, py + 15);

      const plotAreaX = px + 36;
      const plotAreaY = py + 26;
      const plotAreaW = pw - 46;
      const plotAreaH = ph - 38;

      // Axis lines & grid
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotAreaX, plotAreaY);
      ctx.lineTo(plotAreaX, plotAreaY + plotAreaH);
      ctx.lineTo(plotAreaX + plotAreaW, plotAreaY + plotAreaH);
      ctx.stroke();

      // Axis labels
      ctx.font = '500 8px Inter, monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText('+0.4 nm', plotAreaX - 4, plotAreaY + 8);
      ctx.fillText('0.0 nm', plotAreaX - 4, plotAreaY + plotAreaH);

      ctx.textAlign = 'center';
      ctx.fillText('Poziție Scanare X (0 → 30 nm)', plotAreaX + plotAreaW * 0.5, plotAreaY + plotAreaH + 10);

      // Draw True Topography (Dashed Gray)
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const xNm = (i / 60) * 30.0;
        const zNm = this._getTrueSampleHeight(xNm);
        const gx = plotAreaX + (xNm / 30.0) * plotAreaW;
        const gy = plotAreaY + plotAreaH - (zNm / 0.45) * plotAreaH;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
      ctx.restore();

      // Draw AFM Reconstructed Profile (Glowing Cyan line)
      if (this.topoHistory.length > 1) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let i = 0; i < this.topoHistory.length; i++) {
          const pt = this.topoHistory[i];
          const gx = plotAreaX + (pt.x / 30.0) * plotAreaW;
          const gy = plotAreaY + plotAreaH - (pt.zRecon / 0.45) * plotAreaH;
          if (i === 0) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Current scan cursor
      const cursorX = plotAreaX + (this.scanX / 30.0) * plotAreaW;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cursorX, plotAreaY);
      ctx.lineTo(cursorX, plotAreaY + plotAreaH);
      ctx.stroke();
    }

    _renderSpectrumPlot(ctx, px, py, pw, ph) {
      ctx.fillStyle = '#0b1324';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);

      // Header
      ctx.font = '700 10px Inter, monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'left';
      ctx.fillText('CURBA DE REZONANȚĂ AFM & DEVIEREA DE FRECVENȚĂ (Δf)', px + 10, py + 15);

      const plotAreaX = px + 36;
      const plotAreaY = py + 26;
      const plotAreaW = pw - 46;
      const plotAreaH = ph - 38;

      // Axis lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotAreaX, plotAreaY);
      ctx.lineTo(plotAreaX, plotAreaY + plotAreaH);
      ctx.lineTo(plotAreaX + plotAreaW, plotAreaY + plotAreaH);
      ctx.stroke();

      // Free Resonant Curve (Dashed Cyan: f0 = 150 kHz, Q = 450)
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let i = 0; i <= plotAreaW; i++) {
        const fFrac = 0.96 + (i / plotAreaW) * 0.08; // 144 kHz to 156 kHz
        const r = fFrac / 1.0;
        const den = Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / this.Q, 2));
        const ampVal = (1 / this.Q) / (den + 1e-9);
        const gy = plotAreaY + plotAreaH - Math.min(1.0, ampVal * 0.95) * plotAreaH;
        if (i === 0) ctx.moveTo(plotAreaX + i, gy);
        else ctx.lineTo(plotAreaX + i, gy);
      }
      ctx.stroke();
      ctx.restore();

      // Shifted Resonant Curve in Interaction (Solid Amber: f_eff = f0 + deltaF)
      const effectiveRatio = (this.f0 * 1000 + this.deltaF) / (this.f0 * 1000);
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= plotAreaW; i++) {
        const fFrac = 0.96 + (i / plotAreaW) * 0.08;
        const r = fFrac / effectiveRatio;
        const den = Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / this.Q, 2));
        const ampVal = (1 / this.Q) / (den + 1e-9);
        const gy = plotAreaY + plotAreaH - Math.min(1.0, ampVal * 0.95) * plotAreaH;
        if (i === 0) ctx.moveTo(plotAreaX + i, gy);
        else ctx.lineTo(plotAreaX + i, gy);
      }
      ctx.stroke();
      ctx.restore();

      // Current drive frequency marker (Red vertical indicator)
      const currentRatio = this.driveFreq / this.f0;
      const markerX = plotAreaX + ((currentRatio - 0.96) / 0.08) * plotAreaW;
      if (markerX >= plotAreaX && markerX <= plotAreaX + plotAreaW) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(markerX, plotAreaY);
        ctx.lineTo(markerX, plotAreaY + plotAreaH);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(markerX, plotAreaY + plotAreaH - (this.amp / this.freeAmp) * plotAreaH, 4, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Legend in spectrum plot
      ctx.font = '600 8px Inter, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('-- f₀ Liber (150 kHz)', px + pw - 10, py + 14);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`— f_eff cuplat (Δf = ${this.deltaF.toFixed(0)} Hz)`, px + pw - 10, py + 24);
    }
  }

  // Register in global namespace
  window.AFMMicroscopySim = AFMMicroscopySim;
})();
