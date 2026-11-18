/* ============================================================
   SLIDE11-MEMS-GYROSCOPE.JS — Giroscopul MEMS cu Diapazon Vibrator (2-DOF)
   Coupled Drive X & Sense Y Coriolis Resonance, Complex-Envelope Solver,
   Differential Capacitance ΔC = C1 − C2 (fF), 2D Lissajous & Oscilloscope
   - Drive X (AGC resonance): x(t) = X0 sin(ωx t), fx = 20 kHz
   - Coriolis force along Y: Fc,y(t) = −2 m_eff X0 ωx Ωz cos(ωx t)
   - Sense Y transfer function:
       Y0 = 2 X0 |Ωz| / (ωx * sqrt((1 - ρ²)² + (ρ/Q)²)),  ρ = ωy / ωx
       φy = atan2(ρ / Q, 1 − ρ²)
   - Differential capacitance (with pull-in clamp |y| ≤ 0.92 d0):
       C1 = C0 d0 / (d0 − y),  C2 = C0 d0 / (d0 + y),  ΔC = C1 − C2
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  class MEMSGyroscopeSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      const cfg = config || {};

      // --- Fixed MEMS Silicon Die Physical Parameters ---
      this.fDriveHz = cfg.fDriveHz ?? 20000;
      this.omegaX = 2 * Math.PI * this.fDriveHz; // ~125,663.7 rad/s
      this.X0Um = cfg.X0Um ?? 4.0;               // AGC-stabilized Drive X amplitude (µm)
      this.C0fF = cfg.C0fF ?? 250;               // Rest Sense Y bank capacitance (fF)
      this.gapUm = cfg.gapUm ?? 2.0;             // Nominal comb-finger gap d0 (µm)
      this.mEff = 1.0e-9;                        // Proof mass 1.0 µg = 1e-9 kg

      // --- Default / Tunable Operating Parameters ---
      this._defaults = {
        omegaZ: this._clamp(cfg.omegaZ ?? 120, -300, 300),
        tuning: this._clamp(cfg.tuning ?? 1.000, 0.85, 1.15),
        Q: this._clamp(cfg.Q ?? 2000, 10, 5000)
      };

      this.omegaZ = this._defaults.omegaZ; // Applied angular velocity (°/s)
      this.tuning = this._defaults.tuning; // Mode-matching ratio ρ = ωy / ωx
      this.Q = this._defaults.Q;           // Sense-mode quality factor (vacuum)

      // --- Visual Carrier & Complex-Envelope State ---
      // Decouple 20 kHz physical resonance from 2.2 Hz visual carrier to eliminate
      // 60 fps stroboscopic aliasing while keeping exact physical magnitudes & phases.
      this.fVis = 2.2;
      this.thetaVis = 0;
      this.housingAngle = 0;

      // Complex envelope Y(t) = Yr + i*Yi (µm) around carrier quadrature axis
      this.Yr = 0;
      this.Yi = 0;
      this.xInstUm = 0;
      this.yInstUm = 0;

      // --- Ring Buffers for Trail, Lissajous (x,y) & Dual-Trace Oscilloscope ---
      this.trailMax = 36;
      this.trailHistory = [];
      this.lissMax = 96;
      this.lissHistory = [];
      this.scopeMax = 140;
      this.scopeHistory = [];

      // --- Pointer / Touch Rotation State ---
      this._dieRegion = { cx: 160, cy: 140, r: 90 };
      this._isDragging = false;
      this._lastDragAngle = 0;
      this._lastDragX = 0;
      this._dragMode = 'angle';

      this._bindCanvasEvents();
    }

    _clamp(val, min, max) {
      if (!Number.isFinite(val)) return min;
      return Math.max(min, Math.min(max, val));
    }

    /** Exact analytical steady-state Sense Y transfer function & differential capacitance */
    _computeSteadyState() {
      const omegaRad = (this.omegaZ * Math.PI) / 180;
      const rho = this.tuning;
      const qSafe = Math.max(1, this.Q);
      const denom = Math.sqrt(Math.pow(1 - rho * rho, 2) + Math.pow(rho / qSafe, 2));
      const gain = 1 / Math.max(1e-12, denom);

      // Y0 = 2 * X0 * |Omega_rad| / (omegaX * sqrt((1 - rho^2)^2 + (rho / Q)^2))
      const yAmpUm = (2 * this.X0Um * Math.abs(omegaRad)) / (this.omegaX * Math.max(1e-12, denom));
      const phiY = Math.atan2(rho / qSafe, 1 - rho * rho);
      const sgn = this.omegaZ > 0 ? 1 : (this.omegaZ < 0 ? -1 : 0);

      // Complex target phasor in quadrature frame: y_ss(t) = sgn * Y0 * sin(theta - phiY)
      const YrSS = sgn * yAmpUm * Math.cos(phiY);
      const YiSS = -sgn * yAmpUm * Math.sin(phiY);

      // Pull-in safety clamp |y_safe| <= 0.92 * d0
      const maxSafe = 0.92 * this.gapUm;
      const ySafePeak = Math.min(yAmpUm, maxSafe);
      const ySignedPeak = sgn * ySafePeak;

      const c1FF = (this.C0fF * this.gapUm) / Math.max(1e-6, this.gapUm - ySignedPeak);
      const c2FF = (this.C0fF * this.gapUm) / Math.max(1e-6, this.gapUm + ySignedPeak);
      const deltaCapFF = Math.abs(c1FF - c2FF);
      // Synchronous lock-in quadrature demodulated differential capacitance
      const deltaCapSignedFF = sgn * deltaCapFF * Math.sin(phiY);

      // Peak Coriolis force in µN: Fc,y = 2 * mEff * (X0 * 1e-6) * omegaX * |Omega_rad|
      const fcPeakUN = 2 * this.mEff * (this.X0Um * 1e-6) * this.omegaX * Math.abs(omegaRad) * 1e6;

      return {
        omegaRad,
        rho,
        gain,
        yAmpUm,
        yAmpSignedUm: sgn * yAmpUm,
        yAmpNm: yAmpUm * 1000,
        phiY,
        phaseDeg: phiY * (180 / Math.PI),
        sgn,
        YrSS,
        YiSS,
        c1FF,
        c2FF,
        deltaCapFF,
        deltaCapSignedFF,
        fcPeakUN
      };
    }

    /** Public telemetry snapshot for verification & diagnostics */
    getTelemetry() {
      const ss = this._computeSteadyState();
      const ySafeInst = this._clamp(this.yInstUm, -0.92 * this.gapUm, 0.92 * this.gapUm);
      const c1Inst = (this.C0fF * this.gapUm) / Math.max(1e-6, this.gapUm - ySafeInst);
      const c2Inst = (this.C0fF * this.gapUm) / Math.max(1e-6, this.gapUm + ySafeInst);

      return {
        omegaZ: this.omegaZ,
        tuning: this.tuning,
        Q: this.Q,
        gain: ss.gain,
        yAmpUm: ss.yAmpUm,
        yAmpSignedUm: ss.yAmpSignedUm,
        yAmpNm: ss.yAmpNm,
        yEnvUm: Math.hypot(this.Yr, this.Yi),
        deltaCapFF: ss.deltaCapFF,
        deltaCapSignedFF: ss.deltaCapSignedFF,
        deltaCapInstFF: c1Inst - c2Inst,
        c1FF: ss.c1FF,
        c2FF: ss.c2FF,
        fcPeakUN: ss.fcPeakUN,
        phaseDeg: ss.phaseDeg,
        housingAngle: this.housingAngle,
        xInstUm: this.xInstUm,
        yInstUm: this.yInstUm
      };
    }

    requestRender() {
      if (!this.running) this.render();
    }

    // =========================================================================
    // PARAMETER SETTERS & UI SYNCHRONIZATION
    // =========================================================================
    setOmegaZ(val) {
      this.omegaZ = this._clamp(val, -300, 300);
      const slider = document.getElementById('sim11-omega');
      const disp = document.getElementById('sim11-omega-val');
      if (slider) slider.value = String(Math.round(this.omegaZ / 5) * 5);
      if (disp) {
        const rounded = Math.round(this.omegaZ);
        disp.textContent = `${rounded >= 0 ? '+' : ''}${rounded} °/s`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setTuning(val) {
      this.tuning = this._clamp(val, 0.85, 1.15);
      const slider = document.getElementById('sim11-tuning');
      const disp = document.getElementById('sim11-tuning-val');
      if (slider) slider.value = this.tuning.toFixed(3);
      if (disp) disp.textContent = this.tuning.toFixed(3);
      this._updateUIBadges();
      this.requestRender();
    }

    setQ(val) {
      this.Q = this._clamp(val, 10, 5000);
      const slider = document.getElementById('sim11-q');
      const disp = document.getElementById('sim11-q-val');
      if (slider) slider.value = String(Math.round(this.Q));
      if (disp) disp.textContent = `Q = ${Math.round(this.Q)}`;
      this._syncVacuumButtonUI();
      this._updateUIBadges();
      this.requestRender();
    }

    _syncVacuumButtonUI() {
      const btnVac = document.getElementById('sim11-preset-vacuum');
      if (!btnVac) return;
      if (this.Q <= 50) {
        btnVac.className = 'sim-btn sim-btn--danger';
        btnVac.textContent = '⚠️ Pierdere Vid (Q = 15)';
      } else if (this.Q === 4500) {
        btnVac.className = 'sim-btn sim-btn--preset';
        btnVac.textContent = '🧪 Capsulă Vidată (Q = 4500)';
      } else {
        btnVac.className = 'sim-btn sim-btn--preset';
        btnVac.textContent = '🧪 Capsulă Vidată Q Înalt vs Pierdere Vid';
      }
    }

    _highlightPreset(activeId) {
      const ids = ['sim11-preset-phone', 'sim11-preset-drone'];
      for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById(ids[i]);
        if (el) {
          if (ids[i] === activeId) el.classList.add('sim-btn--preset');
          else el.classList.remove('sim-btn--preset');
        }
      }
    }

    _updateUIBadges() {
      const ss = this._computeSteadyState();
      const badgeOmega = document.getElementById('sim11-badge-omega');
      const badgeDcap = document.getElementById('sim11-badge-dcap');
      const badgeYamp = document.getElementById('sim11-badge-yamp');
      const badgeGain = document.getElementById('sim11-badge-gain');

      if (badgeOmega) {
        const rOmega = Math.round(this.omegaZ);
        badgeOmega.textContent = `Ωz = ${rOmega >= 0 ? '+' : ''}${rOmega} °/s`;
        badgeOmega.className = Math.abs(rOmega) > 220
          ? 'sim-badge sim-badge--amber'
          : 'sim-badge sim-badge--cyan';
      }

      if (badgeDcap) {
        const dc = ss.deltaCapSignedFF;
        const absDc = Math.abs(dc);
        const sign = dc > 0.0005 ? '+' : (dc < -0.0005 ? '−' : '+');
        const magStr = absDc < 10 ? absDc.toFixed(2) : absDc.toFixed(1);
        badgeDcap.textContent = `ΔC = ${dc < -0.0005 ? '-' : sign}${magStr} fF`;
        if ((this.Q < 50 || absDc < 2) && this.omegaZ !== 0) {
          badgeDcap.className = 'sim-badge sim-badge--danger';
        } else {
          badgeDcap.className = 'sim-badge sim-badge--amber';
        }
      }

      if (badgeYamp) {
        badgeYamp.textContent = `Y₀ = ${ss.yAmpUm.toFixed(3)} μm`;
        badgeYamp.className = ss.yAmpUm > 0.85 * this.gapUm
          ? 'sim-badge sim-badge--danger'
          : 'sim-badge sim-badge--green';
      }

      if (badgeGain) {
        const gStr = ss.gain >= 100 ? String(Math.round(ss.gain)) : ss.gain.toFixed(1);
        badgeGain.textContent = `Amplif. = ${gStr}×`;
        badgeGain.className = ss.gain < 50
          ? 'sim-badge sim-badge--danger'
          : 'sim-badge sim-badge--cyan';
      }
    }

    // =========================================================================
    // LIFECYCLE HOOKS & DOM BINDINGS
    // =========================================================================
    _seedInitialState() {
      const ss = this._computeSteadyState();
      this.Yr = ss.YrSS;
      this.Yi = ss.YiSS;
      this.thetaVis = 0;
      this.trailHistory = [];
      this.lissHistory = [];
      this.scopeHistory = [];

      // Pre-fill full oscilloscope buffer so initial render & reset immediately
      // display full-width dual-trace waveforms and a complete Lissajous ellipse.
      const preSteps = this.scopeMax;
      const dtStep = 1 / 60;
      const dTheta = 2 * Math.PI * this.fVis * dtStep;
      for (let i = 0; i < preSteps; i++) {
        this.thetaVis = (this.thetaVis + dTheta) % (2 * Math.PI);
        this.xInstUm = this.X0Um * Math.sin(this.thetaVis);
        this.yInstUm = this.Yr * Math.sin(this.thetaVis) + this.Yi * Math.cos(this.thetaVis);
        this._pushHistory();
      }
    }

    _pushHistory() {
      this.trailHistory.push({ x: this.xInstUm, y: this.yInstUm });
      if (this.trailHistory.length > this.trailMax) this.trailHistory.shift();

      this.lissHistory.push({ x: this.xInstUm, y: this.yInstUm });
      if (this.lissHistory.length > this.lissMax) this.lissHistory.shift();

      this.scopeHistory.push({ x: this.xInstUm, y: this.yInstUm });
      if (this.scopeHistory.length > this.scopeMax) this.scopeHistory.shift();
    }

    onInit() {
      const omegaSlider = document.getElementById('sim11-omega');
      const tuningSlider = document.getElementById('sim11-tuning');
      const qSlider = document.getElementById('sim11-q');

      const btnPhone = document.getElementById('sim11-preset-phone');
      const btnDrone = document.getElementById('sim11-preset-drone');
      const btnVacuum = document.getElementById('sim11-preset-vacuum');

      const playBtn = document.getElementById('sim11-play');
      const resetBtn = document.getElementById('sim11-reset');

      if (omegaSlider) {
        omegaSlider.addEventListener('input', (e) => {
          this._highlightPreset(null);
          this.setOmegaZ(parseFloat(e.target.value));
        });
      }

      if (tuningSlider) {
        tuningSlider.addEventListener('input', (e) => {
          this._highlightPreset(null);
          this.setTuning(parseFloat(e.target.value));
        });
      }

      if (qSlider) {
        qSlider.addEventListener('input', (e) => {
          this._highlightPreset(null);
          this.setQ(parseFloat(e.target.value));
        });
      }

      if (btnPhone) {
        btnPhone.addEventListener('click', () => {
          this._highlightPreset('sim11-preset-phone');
          this.setOmegaZ(220);
          this.setTuning(1.000);
          this.setQ(1500);
        });
      }

      if (btnDrone) {
        btnDrone.addEventListener('click', () => {
          this._highlightPreset('sim11-preset-drone');
          this.setOmegaZ(95);
          this.setTuning(1.000);
          this.setQ(2500);
        });
      }

      if (btnVacuum) {
        btnVacuum.addEventListener('click', () => {
          this._highlightPreset(null);
          const nextQ = this.Q === 4500 ? 15 : 4500;
          this.setQ(nextQ);
        });
      }

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Pornește';
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          this.start();
          if (playBtn) playBtn.textContent = '⏸ Pauză';
        });
      }

      this._seedInitialState();
      this.setOmegaZ(this.omegaZ);
      this.setTuning(this.tuning);
      this.setQ(this.Q);
    }

    onReset() {
      this.housingAngle = 0;
      this.omegaZ = this._defaults.omegaZ;
      this.tuning = this._defaults.tuning;
      this.Q = this._defaults.Q;

      this._highlightPreset(null);
      this._seedInitialState();

      this.setOmegaZ(this.omegaZ);
      this.setTuning(this.tuning);
      this.setQ(this.Q);

      const btnVac = document.getElementById('sim11-preset-vacuum');
      if (btnVac) {
        btnVac.className = 'sim-btn sim-btn--preset';
        btnVac.textContent = '🧪 Capsulă Vidată Q Înalt vs Pierdere Vid';
      }
    }

    // =========================================================================
    // POINTER / TOUCH ROTATION INTERACTION ON MEMS DIE
    // =========================================================================
    _bindCanvasEvents() {
      if (!this.canvas) return;

      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches && e.touches.length > 0 ? e.touches[0] : null;
        const cx = touch ? touch.clientX : e.clientX;
        const cy = touch ? touch.clientY : e.clientY;
        return { x: cx - rect.left, y: cy - rect.top };
      };

      const hitDie = (pt) => {
        const d = Math.hypot(pt.x - this._dieRegion.cx, pt.y - this._dieRegion.cy);
        return d <= this._dieRegion.r * 1.25;
      };

      this._onPointerDown = (e) => {
        const pt = getPos(e);
        if (!hitDie(pt)) return;
        this._isDragging = true;
        const dx = pt.x - this._dieRegion.cx;
        const dy = pt.y - this._dieRegion.cy;
        const dist = Math.hypot(dx, dy);
        this._dragMode = dist >= 10 ? 'angle' : 'horiz';
        this._lastDragAngle = Math.atan2(dy, dx);
        this._lastDragX = pt.x;
        if (this.canvas) this.canvas.style.cursor = 'grabbing';
      };

      this._onPointerMove = (e) => {
        const pt = getPos(e);
        if (!this._isDragging) {
          if (this.canvas) {
            this.canvas.style.cursor = hitDie(pt) ? 'grab' : 'default';
          }
          return;
        }

        const dx = pt.x - this._dieRegion.cx;
        const dy = pt.y - this._dieRegion.cy;
        let deltaOmega = 0;

        if (this._dragMode === 'angle' && Math.hypot(dx, dy) >= 8) {
          const angle = Math.atan2(dy, dx);
          let dAngle = angle - this._lastDragAngle;
          while (dAngle > Math.PI) dAngle -= 2 * Math.PI;
          while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
          this._lastDragAngle = angle;
          this.housingAngle += dAngle;
          deltaOmega = dAngle * 95;
        } else {
          const dPx = pt.x - this._lastDragX;
          this._lastDragX = pt.x;
          this.housingAngle += dPx * 0.015;
          deltaOmega = dPx * 1.4;
        }

        const nextOmega = this._clamp(Math.round((this.omegaZ + deltaOmega) / 5) * 5, -300, 300);
        this._highlightPreset(null);
        this.setOmegaZ(nextOmega);
      };

      this._onPointerUp = () => {
        if (!this._isDragging) return;
        this._isDragging = false;
        if (this.canvas) this.canvas.style.cursor = 'grab';
      };

      this.canvas.addEventListener('mousedown', this._onPointerDown);
      window.addEventListener('mousemove', this._onPointerMove);
      window.addEventListener('mouseup', this._onPointerUp);

      this.canvas.addEventListener('touchstart', this._onPointerDown, { passive: true });
      window.addEventListener('touchmove', this._onPointerMove, { passive: true });
      window.addEventListener('touchend', this._onPointerUp);
    }

    destroy() {
      if (this.canvas && this._onPointerDown) {
        this.canvas.removeEventListener('mousedown', this._onPointerDown);
        this.canvas.removeEventListener('touchstart', this._onPointerDown);
      }
      if (this._onPointerMove) {
        window.removeEventListener('mousemove', this._onPointerMove);
        window.removeEventListener('touchmove', this._onPointerMove);
      }
      if (this._onPointerUp) {
        window.removeEventListener('mouseup', this._onPointerUp);
        window.removeEventListener('touchend', this._onPointerUp);
      }
      super.destroy();
    }

    // =========================================================================
    // PHYSICS UPDATE (UNCONDITIONALLY STABLE EXPONENTIAL COMPLEX-ENVELOPE ODE)
    // =========================================================================
    update(dt) {
      const safeDt = Math.min(Math.max(0, dt), 0.05);
      if (safeDt <= 0) return;

      const ss = this._computeSteadyState();

      // Visual envelope time constant proportional to Q (0.04s at low Q -> 1.29s at Q=5000)
      const tauVis = 0.04 + 1.25 * (this.Q / 5000);
      // Visual detuning beat angular frequency
      const deltaOmegaVis = 2 * Math.PI * 4.0 * (this.tuning - 1.0);

      // Exact exponential complex-envelope update: dY/dt = -(1/tau + i*dW)*(Y - Y_ss)
      const decay = Math.exp(-safeDt / tauVis);
      const dBeta = -deltaOmegaVis * safeDt;
      const cosB = Math.cos(dBeta);
      const sinB = Math.sin(dBeta);

      const errR = this.Yr - ss.YrSS;
      const errI = this.Yi - ss.YiSS;
      this.Yr = ss.YrSS + decay * (errR * cosB - errI * sinB);
      this.Yi = ss.YiSS + decay * (errR * sinB + errI * cosB);

      // Advance sub-Nyquist visual carrier & housing rotation
      this.thetaVis = (this.thetaVis + 2 * Math.PI * this.fVis * safeDt) % (2 * Math.PI);
      if (!this._isDragging) {
        this.housingAngle += 0.55 * ss.omegaRad * safeDt;
      }

      // Reconstruct instantaneous Drive X and Sense Y displacements (µm)
      this.xInstUm = this.X0Um * Math.sin(this.thetaVis);
      this.yInstUm = this.Yr * Math.sin(this.thetaVis) + this.Yi * Math.cos(this.thetaVis);

      this._pushHistory();
      this._updateUIBadges();
    }

    // =========================================================================
    // CANVAS RENDERING PIPELINE (RESPONSIVE DESKTOP + MOBILE, SAFE GUARDS)
    // =========================================================================
    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (W < 40 || H < 40) return;

      ctx.clearRect(0, 0, W, H);

      // Dark laboratory background
      if (Number.isFinite(H) && H > 0) {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#050912');
        bg.addColorStop(0.55, '#0a1426');
        bg.addColorStop(1, '#060b16');
        ctx.fillStyle = bg;
      } else {
        ctx.fillStyle = '#060b16';
      }
      ctx.fillRect(0, 0, W, H);

      const isCompact = W < 540 || H < 460;
      const topH = Math.max(120, Math.round(H * 0.58));
      const botH = Math.max(80, H - topH);

      const ss = this._computeSteadyState();

      // Upper stage: Left = MEMS Silicon Die, Right = 2D Lissajous (x,y)
      const stageW = isCompact ? Math.round(W * 0.60) : Math.round(W * 0.64);
      this._renderMEMSStage(ctx, 0, 0, stageW, topH, isCompact, ss);
      this._renderLissajousCard(ctx, stageW + 4, 8, W - stageW - 12, topH - 16, isCompact, ss);

      // Subtle horizontal divider
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, topH);
      ctx.lineTo(W, topH);
      ctx.stroke();

      // Lower telemetry: Left = Oscilloscope, Right = Differential Capacitance Voltmeter
      const scopeW = isCompact ? Math.round(W * 0.56) : Math.round(W * 0.59);
      this._renderOscilloscopeCard(ctx, 8, topH + 6, scopeW - 12, botH - 14, isCompact, ss);
      this._renderVoltmeterCard(ctx, scopeW + 4, topH + 6, W - scopeW - 12, botH - 14, isCompact, ss);
    }

    _drawRoundedRect(ctx, x, y, w, h, r) {
      const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }

    _renderMEMSStage(ctx, x0, y0, w, h, isCompact, ss) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.clip();

      // Subtle technical grid
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
      ctx.lineWidth = 1;
      const step = isCompact ? 24 : 32;
      for (let gx = x0 + 16; gx < x0 + w; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, y0);
        ctx.lineTo(gx, y0 + h);
        ctx.stroke();
      }
      for (let gy = y0 + 22; gy < y0 + h; gy += step) {
        ctx.beginPath();
        ctx.moveTo(x0, gy);
        ctx.lineTo(x0 + w, gy);
        ctx.stroke();
      }

      // Header
      ctx.font = `700 ${isCompact ? 9 : 10.5}px Inter, sans-serif`;
      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const title = isCompact ? 'CIP MEMS 2-DOF (CORIOLIS)' : 'CIP SILICIU MEMS — GIROSCOP CORIOLIS 2-DOF';
      ctx.fillText(title, x0 + 10, y0 + 13, w - 20);

      // Die center and outer housing ring radius
      const dieCx = x0 + w * 0.50;
      const dieCy = y0 + 24 + (h - 40) * 0.50;
      const rRing = Math.max(36, Math.min(w * 0.40, (h - 44) * 0.46));
      const ringThick = isCompact ? 7 : 10;

      this._dieRegion = { cx: dieCx, cy: dieCy, r: rRing + 10 };

      // Ambient vacuum / cavity glow
      const cavityR = Math.max(0.1, rRing);
      if (Number.isFinite(dieCx) && Number.isFinite(dieCy) && Number.isFinite(cavityR)) {
        const cavGrad = ctx.createRadialGradient(dieCx, dieCy, Math.max(0.1, cavityR * 0.15), dieCx, dieCy, cavityR);
        cavGrad.addColorStop(0, this.Q < 50 ? 'rgba(255, 82, 82, 0.09)' : 'rgba(0, 229, 255, 0.08)');
        cavGrad.addColorStop(1, 'rgba(6, 11, 22, 0)');
        ctx.fillStyle = cavGrad;
        ctx.beginPath();
        ctx.arc(dieCx, dieCy, Math.max(0.1, cavityR), 0, Math.PI * 2);
        ctx.fill();
      }

      // 1. Rotatable Outer Housing Ring
      ctx.save();
      ctx.translate(dieCx, dieCy);
      ctx.rotate(this.housingAngle);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = ringThick;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.1, rRing - ringThick * 0.5), 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.1, rRing), 0, Math.PI * 2);
      ctx.stroke();

      // 24 housing notches (4 cardinal markers highlighted)
      const rInnerRing = Math.max(0.1, rRing - ringThick);
      for (let i = 0; i < 24; i++) {
        const ang = (i * Math.PI * 2) / 24;
        const isCardinal = (i % 6 === 0);
        ctx.strokeStyle = isCardinal ? (i === 0 ? '#ffab40' : '#00e5ff') : 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = isCardinal ? 2.2 : 1.0;
        const r0 = isCardinal ? rInnerRing - 2 : rInnerRing + 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
        ctx.lineTo(Math.cos(ang) * (rRing + (isCardinal ? 2 : 0)), Math.sin(ang) * (rRing + (isCardinal ? 2 : 0)));
        ctx.stroke();
      }
      ctx.restore();

      // Directional Ωz curved indicator outside top-right of ring
      if (Math.abs(this.omegaZ) >= 1) {
        const arcR = Math.max(0.1, rRing + (isCompact ? 5 : 7));
        const aStart = -Math.PI * 0.36;
        const aEnd = -Math.PI * 0.08;
        const omegaColor = this.omegaZ > 0 ? '#ffab40' : '#00e5ff';

        ctx.save();
        ctx.strokeStyle = omegaColor;
        ctx.fillStyle = omegaColor;
        ctx.lineWidth = isCompact ? 1.8 : 2.2;
        ctx.beginPath();
        ctx.arc(dieCx, dieCy, arcR, aStart, aEnd);
        ctx.stroke();

        // Arrowhead at end (CW if omegaZ > 0) or start (CCW if omegaZ < 0)
        const tipAng = this.omegaZ > 0 ? aEnd : aStart;
        const dirSign = this.omegaZ > 0 ? 1 : -1;
        const tx = dieCx + Math.cos(tipAng) * arcR;
        const ty = dieCy + Math.sin(tipAng) * arcR;
        const tangent = tipAng + dirSign * (Math.PI * 0.5);
        const hLen = isCompact ? 5.5 : 7;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - hLen * Math.cos(tangent - 0.5), ty - hLen * Math.sin(tangent - 0.5));
        ctx.lineTo(tx - hLen * Math.cos(tangent + 0.5), ty - hLen * Math.sin(tangent + 0.5));
        ctx.closePath();
        ctx.fill();

        const lblAng = -Math.PI * 0.22;
        const lx = dieCx + Math.cos(lblAng) * (arcR + (isCompact ? 8 : 11));
        const ly = dieCy + Math.sin(lblAng) * (arcR + (isCompact ? 8 : 11));
        ctx.font = `700 ${isCompact ? 8 : 9.5}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Ωz', lx - 4, ly);
        ctx.restore();
      }

      // 2. Fixed Silicon Outer Frame (inside housing ring)
      const frameHalf = rRing * 0.70;
      const massHalf = frameHalf * 0.42;

      // Visual displacements (in px), strictly bounded inside frame gap
      const maxExcursionPx = frameHalf * 0.14;
      const dxPx = (this.xInstUm / Math.max(0.1, this.X0Um)) * maxExcursionPx;
      // Note: +yInstUm moves mass UP (-canvas Y) toward top plate C1 so gap d0 - y shrinks!
      const dyPx = -this._clamp(this.yInstUm / 0.55, -1, 1) * maxExcursionPx;

      this._drawRoundedRect(ctx, dieCx - frameHalf, dieCy - frameHalf, frameHalf * 2, frameHalf * 2, 6);
      ctx.fillStyle = '#0b1222';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 4 Fixed Corner Anchor Pads
      const padSz = isCompact ? 5 : 7;
      const anchorOffset = frameHalf * 0.86;
      const corners = [
        [-1, -1], [1, -1], [1, 1], [-1, 1]
      ];
      ctx.fillStyle = '#64748b';
      for (let i = 0; i < 4; i++) {
        const ax = dieCx + corners[i][0] * anchorOffset;
        const ay = dieCy + corners[i][1] * anchorOffset;
        ctx.fillRect(ax - padSz * 0.5, ay - padSz * 0.5, padSz, padSz);
      }

      // 3. Drive X Stator Comb Fingers (Left & Right walls)
      const combSpan = massHalf * 0.72;
      const numTeeth = isCompact ? 4 : 5;
      const toothLen = Math.max(6, (frameHalf - massHalf) * 0.36);
      const combPitch = (combSpan * 2) / numTeeth;

      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = isCompact ? 1.4 : 1.8;
      for (let side = -1; side <= 1; side += 2) {
        const wallX = dieCx + side * frameHalf;
        for (let t = 0; t < numTeeth; t++) {
          const ty = dieCy - combSpan + combPitch * (t + 0.5);
          ctx.beginPath();
          ctx.moveTo(wallX, ty);
          ctx.lineTo(wallX - side * toothLen, ty);
          ctx.stroke();
        }
      }

      // 4. Differential Sense Y Stator Plates & Comb Teeth (Top C1 & Bottom C2)
      const yEnvUm = Math.hypot(this.Yr, this.Yi);
      const glowTop = this.yInstUm > 0 ? Math.min(0.65, 0.15 + Math.abs(this.yInstUm) / 0.4) : 0.12;
      const glowBot = this.yInstUm < 0 ? Math.min(0.65, 0.15 + Math.abs(this.yInstUm) / 0.4) : 0.12;

      // Top C1 glow
      ctx.fillStyle = `rgba(255, 171, 64, ${glowTop * 0.35})`;
      ctx.fillRect(dieCx - combSpan, dieCy - frameHalf + 2, combSpan * 2, toothLen + 4);
      // Bottom C2 glow
      ctx.fillStyle = `rgba(255, 171, 64, ${glowBot * 0.35})`;
      ctx.fillRect(dieCx - combSpan, dieCy + frameHalf - toothLen - 6, combSpan * 2, toothLen + 4);

      ctx.strokeStyle = '#ffab40';
      ctx.lineWidth = isCompact ? 1.4 : 1.8;
      for (let sideY = -1; sideY <= 1; sideY += 2) {
        const wallY = dieCy + sideY * frameHalf;
        for (let t = 0; t < numTeeth; t++) {
          const tx = dieCx - combSpan + combPitch * (t + 0.5);
          ctx.beginPath();
          ctx.moveTo(tx, wallY);
          ctx.lineTo(tx, wallY - sideY * toothLen);
          ctx.stroke();
        }
      }

      // Concise Stator Labels (C1 / C2 / DRIVE X) outside inner collision zones
      ctx.font = `700 ${isCompact ? 7.5 : 8.5}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffab40';
      ctx.fillText('C₁ (+)', dieCx, dieCy - frameHalf - (isCompact ? 6 : 8));
      ctx.fillText('C₂ (−)', dieCx, dieCy + frameHalf + (isCompact ? 7 : 9));

      if (!isCompact) {
        ctx.save();
        ctx.fillStyle = '#00e5ff';
        ctx.translate(dieCx - frameHalf - 9, dieCy);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('DRIVE X', 0, 0);
        ctx.restore();
      }

      // 5. 4 Folded-Flexure Serpentine Springs connecting corner anchors to proof mass
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = isCompact ? 1.2 : 1.5;
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        const sx = corners[i][0];
        const sy = corners[i][1];
        const ax = dieCx + sx * anchorOffset;
        const ay = dieCy + sy * anchorOffset;
        const mx = dieCx + dxPx + sx * massHalf;
        const my = dieCy + dyPx + sy * massHalf;

        this._drawSerpentineSpring(ctx, ax, ay, mx, my, sx, sy);
      }

      // 6. Central Silicon Proof Mass + Rotor Comb Fingers
      const massCx = dieCx + dxPx;
      const massCy = dieCy + dyPx;

      // Rotor Drive X fingers (interleaved between stator teeth)
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = isCompact ? 1.2 : 1.5;
      for (let side = -1; side <= 1; side += 2) {
        const edgeX = massCx + side * massHalf;
        for (let t = 0; t < numTeeth - 1; t++) {
          const ty = massCy - combSpan + combPitch * (t + 1.0);
          ctx.beginPath();
          ctx.moveTo(edgeX, ty);
          ctx.lineTo(edgeX + side * toothLen * 0.9, ty);
          ctx.stroke();
        }
      }

      // Rotor Sense Y fingers (interleaved between C1/C2 stator teeth)
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = isCompact ? 1.2 : 1.5;
      for (let sideY = -1; sideY <= 1; sideY += 2) {
        const edgeY = massCy + sideY * massHalf;
        for (let t = 0; t < numTeeth - 1; t++) {
          const tx = massCx - combSpan + combPitch * (t + 1.0);
          ctx.beginPath();
          ctx.moveTo(tx, edgeY);
          ctx.lineTo(tx, edgeY + sideY * toothLen * 0.9);
          ctx.stroke();
        }
      }

      // Proof Mass body with metallic gradient
      const mLeft = massCx - massHalf;
      const mTop = massCy - massHalf;
      if (Number.isFinite(mLeft) && Number.isFinite(mTop) && Number.isFinite(massHalf)) {
        const massGrad = ctx.createLinearGradient(mLeft, mTop, mLeft + massHalf * 2, mTop + massHalf * 2);
        massGrad.addColorStop(0, '#334155');
        massGrad.addColorStop(0.5, '#475569');
        massGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = massGrad;
      } else {
        ctx.fillStyle = '#334155';
      }
      this._drawRoundedRect(ctx, mLeft, mTop, massHalf * 2, massHalf * 2, 4);
      ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3x3 Etch Holes inside proof mass
      const holeSpacing = massHalf * 0.52;
      const holeR = Math.max(0.1, isCompact ? 1.7 : 2.5);
      ctx.fillStyle = '#080e1c';
      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          if (r === 0 && c === 0) continue; // Keep center clear for trail & Coriolis vector
          ctx.beginPath();
          ctx.arc(massCx + c * holeSpacing, massCy + r * holeSpacing, holeR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 7. Live Motion Trail at Proof Mass Center
      if (this.trailHistory.length > 1) {
        for (let i = 1; i < this.trailHistory.length; i++) {
          const p0 = this.trailHistory[i - 1];
          const p1 = this.trailHistory[i];
          const alpha = (i / this.trailHistory.length) * 0.75;
          const px0 = dieCx + (p0.x / Math.max(0.1, this.X0Um)) * maxExcursionPx;
          const py0 = dieCy - this._clamp(p0.y / 0.55, -1, 1) * maxExcursionPx;
          const px1 = dieCx + (p1.x / Math.max(0.1, this.X0Um)) * maxExcursionPx;
          const py1 = dieCy - this._clamp(p1.y / 0.55, -1, 1) * maxExcursionPx;
          ctx.strokeStyle = `rgba(255, 171, 64, ${alpha.toFixed(2)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px0, py0);
          ctx.lineTo(px1, py1);
          ctx.stroke();
        }
      }

      // Center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(massCx, massCy, Math.max(0.1, isCompact ? 2.0 : 2.6), 0, Math.PI * 2);
      ctx.fill();

      // Instantaneous Coriolis Force Arrow Fc,y(t) = -2 m vx Ωz
      // Since x(t) = X0 sin(theta), vx proportional to cos(theta).
      // Positive Fc,y in Sense Y (+y up on screen) draws upward when (-cos(theta) * sgn) > 0.
      const fcInstNorm = -ss.sgn * Math.cos(this.thetaVis) * Math.min(1, Math.abs(this.omegaZ) / 180);
      const fcArrowLen = fcInstNorm * (massHalf * 0.92);
      if (Math.abs(fcArrowLen) >= 5) {
        const yTip = massCy - fcArrowLen; // +Sense Y is up (-canvas Y)
        this.drawArrow(massCx, massCy, massCx, yTip, '#ff5252', isCompact ? 1.8 : 2.2);
        ctx.font = `700 ${isCompact ? 7.5 : 8.5}px JetBrains Mono, monospace`;
        ctx.fillStyle = '#ff5252';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Fc,y', massCx + 5, yTip + (fcArrowLen > 0 ? 4 : -4));
      }

      // Bottom drag hint inside MEMS stage
      ctx.font = `500 ${isCompact ? 8 : 9}px Inter, sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hintTxt = isCompact
        ? 'Trage inelul pentru Ωz'
        : (this.Q < 50 && yEnvUm < 0.01
            ? '⚠️ Amortizare atmosferică severă — Trage cipul pentru Ωz'
            : 'Trage cu mouse-ul pe cip pentru a roti Ωz');
      ctx.fillText(hintTxt, dieCx, y0 + h - 7, w - 16);

      ctx.restore();
    }

    _drawSerpentineSpring(ctx, ax, ay, mx, my, sx, sy) {
      // Draw a 3-fold folded-flexure serpentine beam from corner anchor (ax,ay) to mass corner (mx,my)
      const dx = mx - ax;
      const dy = my - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const perpAmp = Math.min(6, Math.max(3, len * 0.14));

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const bx = ax + dx * t;
        const by = ay + dy * t;
        const dir = (i % 2 === 1 ? 1 : -1) * sx * sy;
        ctx.lineTo(bx + dir * perpAmp * nx, by + dir * perpAmp * ny);
      }
      ctx.lineTo(mx, my);
      ctx.stroke();
    }

    _renderLissajousCard(ctx, x, y, w, h, isCompact, ss) {
      if (w < 40 || h < 40) return;

      this._drawRoundedRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = '#0b1324';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Header
      ctx.font = `700 ${isCompact ? 9 : 10.5}px Inter, sans-serif`;
      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isCompact ? 'LISSAJOUS (x,y)' : 'LISSAJOUS (x, y)', x + w * 0.5, y + 13, w - 12);

      // Square plot box
      const boxSize = Math.max(44, Math.min(w - 20, h - 56));
      const bx = x + (w - boxSize) * 0.5;
      const by = y + 24 + Math.max(0, (h - 56 - boxSize) * 0.5);
      const cx = bx + boxSize * 0.5;
      const cy = by + boxSize * 0.5;
      const half = boxSize * 0.44;

      // Plot inner frame
      ctx.fillStyle = '#060b16';
      ctx.fillRect(bx, by, boxSize, boxSize);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, boxSize, boxSize);

      // Crosshair axes & dashed guide circle
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.beginPath();
      ctx.moveTo(bx + 3, cy);
      ctx.lineTo(bx + boxSize - 3, cy);
      ctx.moveTo(cx, by + 3);
      ctx.lineTo(cx, by + boxSize - 3);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.1, half * 0.85), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Adaptive Y-scale across active history & steady-state so transients spiral smoothly
      // without clamping flat against box borders, while detuned ellipses remain clear
      const yEnvUm = Math.hypot(this.Yr, this.Yi);
      let maxHistY = Math.max(ss.yAmpUm, yEnvUm);
      for (let i = 0; i < this.lissHistory.length; i++) {
        const ay = Math.abs(this.lissHistory[i].y);
        if (ay > maxHistY) maxHistY = ay;
      }
      const lissYScaleUm = Math.max(0.025, maxHistY * 1.18);

      // Plot Lissajous trace clipped cleanly inside inner box
      if (this.lissHistory.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx + 1, by + 1, boxSize - 2, boxSize - 2);
        ctx.clip();

        const n = this.lissHistory.length;
        for (let i = 1; i < n; i++) {
          const p0 = this.lissHistory[i - 1];
          const p1 = this.lissHistory[i];
          const frac = i / n;
          const x0 = cx + (p0.x / Math.max(0.1, this.X0Um)) * half;
          const y0 = cy - this._clamp(p0.y / lissYScaleUm, -1.05, 1.05) * half;
          const x1 = cx + (p1.x / Math.max(0.1, this.X0Um)) * half;
          const y1 = cy - this._clamp(p1.y / lissYScaleUm, -1.05, 1.05) * half;

          ctx.strokeStyle = `rgba(255, 171, 64, ${(0.12 + 0.88 * frac).toFixed(2)})`;
          ctx.lineWidth = 1.2 + 1.1 * frac;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }

        const head = this.lissHistory[n - 1];
        const hx = cx + (head.x / Math.max(0.1, this.X0Um)) * half;
        const hy = cy - this._clamp(head.y / lissYScaleUm, -1.05, 1.05) * half;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(0.1, isCompact ? 2.6 : 3.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Bottom readouts inside card
      ctx.font = `600 ${isCompact ? 8 : 9.5}px JetBrains Mono, monospace`;
      ctx.fillStyle = '#ffab40';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`φy = ${ss.phaseDeg.toFixed(1)}° | ρ = ${this.tuning.toFixed(3)}`, x + w * 0.5, y + h - 20, w - 10);

      ctx.font = `500 ${isCompact ? 7.5 : 8.5}px JetBrains Mono, monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Scală Y: ±${Math.round(lissYScaleUm * 1000)} nm`, x + w * 0.5, y + h - 8, w - 10);
    }

    _renderOscilloscopeCard(ctx, x, y, w, h, isCompact, ss) {
      if (w < 40 || h < 40) return;

      this._drawRoundedRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = '#0b1324';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Stepped discrete Y full scale (in nm) so collapse at low Q or detuning is unmistakable
      const yEnvNm = Math.hypot(this.Yr, this.Yi) * 1000;
      const peakNm = Math.max(ss.yAmpNm, yEnvNm);
      let scopeFullNm = 350;
      if (peakNm > 800) scopeFullNm = 1850;
      else if (peakNm > 350) scopeFullNm = 800;
      const scopeFullUm = scopeFullNm / 1000;

      // Header row
      ctx.font = `700 ${isCompact ? 8.5 : 10}px Inter, sans-serif`;
      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(isCompact ? 'OSCILOSCOP' : 'OSCILOSCOP x(t) & y(t)', x + 10, y + 13);

      ctx.font = `600 ${isCompact ? 8 : 9.5}px JetBrains Mono, monospace`;
      ctx.fillStyle = '#ffab40';
      ctx.textAlign = 'right';
      ctx.fillText(`Y: ±${scopeFullNm} nm`, x + w - 10, y + 13);

      // Plot area
      const px = x + 8;
      const py = y + 22;
      const pw = w - 16;
      const ph = Math.max(24, h - 42);

      ctx.fillStyle = '#060b16';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(px, py, pw, ph);

      // Grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py + ph * 0.5);
      ctx.lineTo(px + pw, py + ph * 0.5);
      ctx.moveTo(px, py + ph * 0.25);
      ctx.lineTo(px + pw, py + ph * 0.25);
      ctx.moveTo(px, py + ph * 0.75);
      ctx.lineTo(px + pw, py + ph * 0.75);
      ctx.stroke();

      // Draw traces
      const n = this.scopeHistory.length;
      if (n > 1) {
        const midY = py + ph * 0.5;
        const ampY = ph * 0.41;

        // Drive x(t) in cyan
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = isCompact ? 1.4 : 1.7;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const sx = px + (i / (this.scopeMax - 1)) * pw;
          const sy = midY - (this.scopeHistory[i].x / Math.max(0.1, this.X0Um)) * ampY;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Sense y(t) in amber
        ctx.strokeStyle = '#ffab40';
        ctx.lineWidth = isCompact ? 1.8 : 2.2;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const sx = px + (i / (this.scopeMax - 1)) * pw;
          const yNorm = this._clamp(this.scopeHistory[i].y / scopeFullUm, -1.08, 1.08);
          const sy = midY - yNorm * ampY;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // Bottom legend
      ctx.font = `600 ${isCompact ? 8 : 9}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#cbd5e1';
      const legText = isCompact
        ? `x:±${this.X0Um.toFixed(0)}μm | y:±${Math.round(ss.yAmpNm)}nm`
        : `━ x(t): ±${this.X0Um.toFixed(1)} μm (${(this.fDriveHz / 1000).toFixed(0)} kHz)   ━ y(t): ±${ss.yAmpNm.toFixed(1)} nm`;
      ctx.fillText(legText, x + w * 0.5, y + h - 9, w - 14);
    }

    _renderVoltmeterCard(ctx, x, y, w, h, isCompact, ss) {
      if (w < 40 || h < 40) return;

      this._drawRoundedRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = '#0b1324';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 1. Header
      ctx.font = `700 ${isCompact ? 8.5 : 10}px Inter, sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isCompact ? 'VOLTMETRU ΔC' : 'VOLTMETRU CAPACITIV ΔC = C₁ − C₂', x + w * 0.5, y + 13, w - 12);

      // 2. Recessed LCD Panel for ΔC
      const lcdX = x + 8;
      const lcdY = y + 23;
      const lcdW = w - 16;
      const lcdH = Math.max(28, Math.round(h * 0.28));
      const dc = ss.deltaCapSignedFF;
      const absDc = Math.abs(dc);
      const isWeak = (this.Q < 50 || absDc < 2) && this.omegaZ !== 0;

      this._drawRoundedRect(ctx, lcdX, lcdY, lcdW, lcdH, 5);
      ctx.fillStyle = '#060b16';
      ctx.fill();
      ctx.strokeStyle = isWeak ? 'rgba(255, 82, 82, 0.55)' : 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const dcSign = dc > 0.0005 ? '+' : (dc < -0.0005 ? '-' : '');
      const dcText = `${dcSign}${absDc < 10 ? absDc.toFixed(2) : absDc.toFixed(1)} fF`;
      ctx.font = `700 ${isCompact ? 15 : 21}px JetBrains Mono, monospace`;
      ctx.fillStyle = absDc < 2 ? '#64748b' : (dc >= 0 ? '#00e5ff' : '#ffab40');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dcText, x + w * 0.5, lcdY + lcdH * 0.52, lcdW - 8);

      // Remaining vertical area below LCD
      const remTop = lcdY + lcdH + 4;
      const remBot = y + h - 16;
      const remH = Math.max(28, remBot - remTop);

      // 3. Individual Plate Capacitances C1 & C2
      ctx.font = `600 ${isCompact ? 7.5 : 9.5}px JetBrains Mono, monospace`;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`C₁: ${ss.c1FF.toFixed(1)} | C₂: ${ss.c2FF.toFixed(1)} fF`, x + w * 0.5, remTop + remH * 0.24, w - 12);

      // Divider
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.beginPath();
      ctx.moveTo(x + 12, remTop + remH * 0.48);
      ctx.lineTo(x + w - 12, remTop + remH * 0.48);
      ctx.stroke();

      // 4. Measured Ωz or Weak Signal Warning
      const omegaSign = this.omegaZ > 0 ? '+' : '';
      if (isWeak) {
        ctx.font = `700 ${isCompact ? 8.5 : 10.5}px JetBrains Mono, monospace`;
        ctx.fillStyle = '#ff5252';
        ctx.fillText('⚠ SEMNAL SLAB (SNR)', x + w * 0.5, remTop + remH * 0.78, w - 12);
      } else {
        ctx.font = `700 ${isCompact ? 9.5 : 12.5}px JetBrains Mono, monospace`;
        ctx.fillStyle = '#69f0ae';
        ctx.fillText(`Ωz măs: ${omegaSign}${this.omegaZ.toFixed(1)} °/s`, x + w * 0.5, remTop + remH * 0.78, w - 12);
      }

      // 5. Footer bar: Q and detuning Δf
      const deltaFHz = Math.abs((this.tuning - 1) * this.fDriveHz);
      ctx.font = `500 ${isCompact ? 7.5 : 8.8}px JetBrains Mono, monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Q = ${Math.round(this.Q)} | Δf = ${deltaFHz.toFixed(0)} Hz`, x + w * 0.5, y + h - 8, w - 12);
    }
  }

  window.MEMSGyroscopeSim = MEMSGyroscopeSim;
})();
