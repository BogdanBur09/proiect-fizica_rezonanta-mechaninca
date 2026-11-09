/* ============================================================
   SLIDE 9: TUNED MASS DAMPER (TMD) — TAIPEI 101 SIMULATION
   Side-by-Side Comparison + Zoomed 87-92F Pendulum Chamber + Den Hartog FRF
   - Tower A (Left): Fără TMD (1-DOF, rezonanță violentă)
   - Tower B (Center): Taipei 101 cu TMD 660t (2-DOF cuplat, atenuat ~75%)
   - Right Cutaway: Pendulul sferic de 660t în mișcare de arc real + pistoane hidraulice
   - Bottom: Grafic FRF interactiv (Peak Splitting) + Oscilogramă comparativă
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  class TunedMassDamperSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Physical & Visual Parameters ---
      this.f1Real = 0.15;                     // Real Taipei 101 fundamental frequency (0.15 Hz, T = 6.7s)
      this.omega1 = 4.6;                      // Visual simulation angular frequency (rad/s) for lively real-time response
      this.zeta1 = 0.015;                     // Structural damping of skyscraper alone (1.5% -> Q ~ 33)

      // TMD Parameters (Den Hartog)
      this.massRatio = 0.025;                 // mu = m2 / M1 (2.5% -> 660 tonnes)
      this.tmdActive = true;                  // Whether TMD on Tower B is active or locked
      this.tuningRatio = 1 / (1 + this.massRatio); // f_opt = 1 / (1 + mu)
      this.zeta2 = Math.sqrt((3 * this.massRatio) / (8 * (1 + this.massRatio))); // zeta_opt ~ 9.6%
      this.omega2 = this.tuningRatio * this.omega1;

      // Excitation Parameters
      this.freqRatio = 1.00;                  // r = omega_ext / omega1
      this.omegaExt = this.freqRatio * this.omega1;
      this.excitationMode = 'wind-resonant';   // 'wind-resonant' | 'typhoon' | 'earthquake' | 'free-impulse'
      this.extPhase = 0.0;
      this.gustTimer = 0.0;

      // --- Dynamical State Variables ---
      // 1. Unprotected Reference Tower (Fără TMD): x0, v0
      this.x0 = 0.0;
      this.v0 = 0.0;

      // 2. Protected Taipei 101 Tower (Cu TMD): x1 (building top), v1, x2 (pendulum absolute), v2
      this.x1 = 0.0;
      this.v1 = 0.0;
      this.x2 = 0.0;
      this.v2 = 0.0;

      // Ground displacement for earthquake mode
      this.groundX = 0.0;
      this.currentExtForce = 0.0;
      this.currentTmdForce = 0.0;
      this.dissipatedPowerKw = 0.0;

      // History Ring Buffers for Comparative Oscilloscope
      this.histLen = 180;
      this.histX0 = new Float32Array(this.histLen); // Unprotected (Red)
      this.histX1 = new Float32Array(this.histLen); // Protected with TMD (Cyan)
      this.histRel = new Float32Array(this.histLen); // TMD relative stroke x2 - x1 (Gold)
      this.histIdx = 0;
      this.histCount = 0;

      // Interactive Hit Regions (Golden Sphere Drag & Bode Plot Click/Drag)
      this.isDraggingBall = false;
      this.isDraggingBode = false;
      this.sphereHit = { cx: 0, cy: 0, r: 28, pivotX: 0, pivotY: 0, L: 90 };
      this.bodeRect = null;

      // Wind particles
      this.windParticles = [];
      this._initWindParticles();
      this._bindCanvasInteractions();
    }

    _initWindParticles() {
      this.windParticles = [];
      for (let i = 0; i < 28; i++) {
        this.windParticles.push({
          x: Math.random(),
          y: 0.06 + Math.random() * 0.78,
          speed: 0.45 + Math.random() * 0.55,
          len: 18 + Math.random() * 24
        });
      }
    }

    // =========================================================================
    // PARAMETER SETTERS & DEN HARTOG OPTIMIZATION
    // =========================================================================
    setFreqRatio(r) {
      this.freqRatio = Math.max(0.50, Math.min(1.50, r));
      this.omegaExt = this.freqRatio * this.omega1;

      const slider = document.getElementById('sim9-freq');
      const valDisp = document.getElementById('sim9-freq-val');
      if (slider) slider.value = this.freqRatio.toFixed(2);
      if (valDisp) {
        const realHz = (this.freqRatio * this.f1Real).toFixed(3);
        valDisp.textContent = `${this.freqRatio.toFixed(2)} (${realHz} Hz)`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setMassRatio(mu) {
      this.massRatio = Math.max(0.005, Math.min(0.07, mu));
      this.tuningRatio = 1 / (1 + this.massRatio);
      this.omega2 = this.tuningRatio * this.omega1;

      const slider = document.getElementById('sim9-mass');
      const valDisp = document.getElementById('sim9-mass-val');
      if (slider) slider.value = (this.massRatio * 100).toFixed(1);
      if (valDisp) {
        const tonnes = Math.round(this.massRatio * 26400);
        valDisp.textContent = `${(this.massRatio * 100).toFixed(1)}% (m₂ ≈ ${tonnes} t)`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setZetaTMD(zeta) {
      this.zeta2 = Math.max(0.01, Math.min(0.25, zeta));
      const slider = document.getElementById('sim9-zeta');
      const valDisp = document.getElementById('sim9-zeta-val');
      if (slider) slider.value = Math.round(this.zeta2 * 100);
      if (valDisp) {
        valDisp.textContent = `${Math.round(this.zeta2 * 100)}%`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setTMDActive(active) {
      this.tmdActive = !!active;
      if (!this.tmdActive) {
        this.x2 = this.x1;
        this.v2 = this.v1;
      }
      const btn = document.getElementById('sim9-btn-toggle-tmd');
      if (btn) {
        btn.textContent = this.tmdActive ? '🛡️ TMD: ACTIV (Absorbe)' : '🔒 TMD: BLOCAT (Risc Rezonanță)';
        btn.className = this.tmdActive ? 'sim-btn sim-btn--preset' : 'sim-btn sim-btn--danger';
      }
      this._updateUIBadges();
      this.requestRender();
    }

    applyDenHartogOptimum() {
      this.tuningRatio = 1 / (1 + this.massRatio);
      this.omega2 = this.tuningRatio * this.omega1;
      const zOpt = Math.sqrt((3 * this.massRatio) / (8 * (1 + this.massRatio)));
      this.setZetaTMD(zOpt);
      this.setTMDActive(true);
    }

    setExcitationMode(mode) {
      this.excitationMode = mode;
      const modes = ['wind-resonant', 'typhoon', 'earthquake'];
      modes.forEach((m) => {
        const btn = document.getElementById(`sim9-preset-${m}`);
        if (btn) {
          if (m === mode) btn.classList.add('sim-btn--preset');
          else btn.classList.remove('sim-btn--preset');
        }
      });

      if (mode === 'wind-resonant') {
        this.setFreqRatio(1.00);
        this.extPhase = 0.0;
        // Quadrature steady-state at resonance: F(t) = cos(w1*t) => x0(t) = A*sin(w1*t)
        this.x0 = 0.0;
        this.v0 = 0.92 * this.omega1;
        this.x1 = 0.0;
        this.v1 = 0.21 * this.omega1;
        this.x2 = -0.75;
        this.v2 = 0.0;
      } else if (mode === 'typhoon') {
        this.setFreqRatio(0.98);
        this.extPhase = 0.0;
        this.x0 = 0.0;
        this.v0 = 1.02 * this.omega1;
        this.x1 = 0.0;
        this.v1 = 0.24 * this.omega1;
        this.x2 = -0.85;
        this.v2 = 0.0;
      } else if (mode === 'earthquake') {
        this.setFreqRatio(1.00);
        this.extPhase = 0.0;
        this.x0 = -0.92;
        this.v0 = 0.0;
        this.x1 = -0.21;
        this.v1 = 0.0;
        this.x2 = 0.0;
        this.v2 = -0.75 * this.omega1;
      } else if (mode === 'free-impulse') {
        // Give both towers an identical 95 cm lateral shock impulse!
        this.x0 = 0.95;
        this.v0 = 0.0;
        this.x1 = 0.95;
        this.v1 = 0.0;
        this.x2 = 0.0;
        this.v2 = 0.0;
      }

      if (!this.running) this.start();
      this._updateUIBadges();
      this.requestRender();
    }

    onReset() {
      this.x0 = 0.0;
      this.v0 = 0.0;
      this.x1 = 0.0;
      this.v1 = 0.0;
      this.x2 = 0.0;
      this.v2 = 0.0;
      this.extPhase = 0.0;
      this.gustTimer = 0.0;
      this.groundX = 0.0;
      this.histIdx = 0;
      this.histCount = 0;
      this.histX0.fill(0);
      this.histX1.fill(0);
      this.histRel.fill(0);

      this.setMassRatio(0.025);
      this.applyDenHartogOptimum();
      this.setExcitationMode('wind-resonant');
    }

    requestRender() {
      if (!this.running) this.render();
    }

    // =========================================================================
    // CANVAS MOUSE / TOUCH INTERACTIONS
    // =========================================================================
    _bindCanvasInteractions() {
      if (!this.canvas) return;

      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: cx - rect.left, y: cy - rect.top };
      };

      const onDown = (e) => {
        const pt = getPos(e);
        // 1. Check Golden Pendulum Ball hit
        const distBall = Math.hypot(pt.x - this.sphereHit.cx, pt.y - this.sphereHit.cy);
        if (distBall <= this.sphereHit.r + 18) {
          this.isDraggingBall = true;
          return;
        }
        // 2. Check FRF Bode Plot click/drag
        if (
          this.bodeRect &&
          pt.x >= this.bodeRect.x &&
          pt.x <= this.bodeRect.x + this.bodeRect.w &&
          pt.y >= this.bodeRect.y &&
          pt.y <= this.bodeRect.y + this.bodeRect.h
        ) {
          this.isDraggingBode = true;
          const u = (pt.x - this.bodeRect.x) / this.bodeRect.w;
          this.setFreqRatio(0.50 + u * 1.00);
        }
      };

      const onMove = (e) => {
        if (!this.isDraggingBall && !this.isDraggingBode) return;
        const pt = getPos(e);

        if (this.isDraggingBall) {
          const dxPx = pt.x - this.sphereHit.pivotX;
          const relMeters = Math.max(-1.25, Math.min(1.25, dxPx / 48));
          this.x2 = this.x1 + relMeters;
          this.v2 = 0.0;
          this.requestRender();
        } else if (this.isDraggingBode && this.bodeRect) {
          const u = Math.max(0, Math.min(1, (pt.x - this.bodeRect.x) / this.bodeRect.w));
          this.setFreqRatio(0.50 + u * 1.00);
        }
      };

      const onUp = () => {
        this.isDraggingBall = false;
        this.isDraggingBode = false;
      };

      this.canvas.addEventListener('mousedown', onDown);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener('touchstart', onDown, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp);
    }

    onInit() {
      const freqSlider = document.getElementById('sim9-freq');
      const massSlider = document.getElementById('sim9-mass');
      const zetaSlider = document.getElementById('sim9-zeta');

      const toggleTmdBtn = document.getElementById('sim9-btn-toggle-tmd');
      const optBtn = document.getElementById('sim9-btn-den-hartog');
      const impulseBtn = document.getElementById('sim9-btn-impulse');

      const btnWind = document.getElementById('sim9-preset-wind-resonant');
      const btnTyphoon = document.getElementById('sim9-preset-typhoon');
      const btnQuake = document.getElementById('sim9-preset-earthquake');

      const playBtn = document.getElementById('sim9-play');
      const resetBtn = document.getElementById('sim9-reset');

      if (freqSlider) {
        freqSlider.value = this.freqRatio.toFixed(2);
        freqSlider.addEventListener('input', (e) => this.setFreqRatio(parseFloat(e.target.value)));
      }
      if (massSlider) {
        massSlider.value = (this.massRatio * 100).toFixed(1);
        massSlider.addEventListener('input', (e) => this.setMassRatio(parseFloat(e.target.value) / 100));
      }
      if (zetaSlider) {
        zetaSlider.value = Math.round(this.zeta2 * 100);
        zetaSlider.addEventListener('input', (e) => this.setZetaTMD(parseFloat(e.target.value) / 100));
      }

      if (toggleTmdBtn) toggleTmdBtn.addEventListener('click', () => this.setTMDActive(!this.tmdActive));
      if (optBtn) optBtn.addEventListener('click', () => this.applyDenHartogOptimum());
      if (impulseBtn) impulseBtn.addEventListener('click', () => this.setExcitationMode('free-impulse'));

      if (btnWind) btnWind.addEventListener('click', () => this.setExcitationMode('wind-resonant'));
      if (btnTyphoon) btnTyphoon.addEventListener('click', () => this.setExcitationMode('typhoon'));
      if (btnQuake) btnQuake.addEventListener('click', () => this.setExcitationMode('earthquake'));

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Rulează';
        });
      }
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          if (playBtn) playBtn.textContent = '⏸ Pauză';
          this.start();
        });
      }

      // Initialize at steady-state resonant response & pre-warm 3 seconds of history
      // so the oscilloscope and twin towers show the full contrast immediately on load!
      this.extPhase = 0.0;
      this.x0 = 0.0;
      this.v0 = 0.92 * this.omega1;
      this.x1 = 0.0;
      this.v1 = 0.21 * this.omega1;
      this.x2 = -0.75;
      this.v2 = 0.0;

      for (let i = 0; i < this.histLen; i++) {
        this._rk4Step(0.016);
        this.histX0[this.histIdx] = this.x0;
        this.histX1[this.histIdx] = this.x1;
        this.histRel[this.histIdx] = (this.x2 - this.x1) * 0.52;
        this.histIdx = (this.histIdx + 1) % this.histLen;
        if (this.histCount < this.histLen) this.histCount++;
      }

      this._updateUIBadges();
    }

    // =========================================================================
    // NUMERICAL RK4 SOLVER FOR BOTH TOWERS (1-DOF vs 2-DOF)
    // =========================================================================
    update(dt) {
      const safeDt = Math.min(Math.max(0, dt), 0.035);
      const subSteps = 6;
      const h = safeDt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        this._rk4Step(h);
      }

      // Store waveforms
      this.histX0[this.histIdx] = this.x0;
      this.histX1[this.histIdx] = this.x1;
      this.histRel[this.histIdx] = (this.x2 - this.x1) * 0.52;
      this.histIdx = (this.histIdx + 1) % this.histLen;
      if (this.histCount < this.histLen) this.histCount++;

      // Move wind particles
      const windMult = this.excitationMode === 'typhoon' ? 2.1 : (this.excitationMode === 'wind-resonant' ? 1.2 : 0.4);
      for (const p of this.windParticles) {
        p.x += p.speed * safeDt * 0.55 * windMult;
        if (p.x > 1.05) {
          p.x = -0.06;
          p.y = 0.06 + Math.random() * 0.78;
        }
      }

      this._updateUIBadges();
    }

    _rk4Step(dt) {
      this.extPhase += this.omegaExt * dt;
      this.gustTimer += dt;

      const w1 = this.omega1;
      const w2 = this.omega2;
      const z1 = this.zeta1;
      const z2 = this.zeta2;
      const mu = this.massRatio;

      // Excitation acceleration F_ext / M1
      // Normalized so steady-state 1-DOF peak at resonance (1 / (2*z1)) reaches ~ 0.95 m (95 cm)
      const baseDrive = 2 * z1 * (w1 * w1) * 0.88;
      let fExt = 0.0;

      if (this.excitationMode === 'wind-resonant') {
        fExt = baseDrive * Math.cos(this.extPhase);
        this.groundX = 0.0;
      } else if (this.excitationMode === 'typhoon') {
        const gust = Math.cos(this.extPhase) + 0.35 * Math.sin(this.extPhase * 1.9) + 0.25 * Math.cos(this.gustTimer * 2.1);
        fExt = baseDrive * 1.15 * gust;
        this.groundX = 0.0;
      } else if (this.excitationMode === 'earthquake') {
        fExt = baseDrive * 1.10 * Math.sin(this.extPhase);
        this.groundX = 0.35 * Math.sin(this.extPhase);
      } else {
        fExt = 0.0;
        this.groundX = 0.0;
      }

      this.currentExtForce = fExt / Math.max(0.001, baseDrive);

      // State vector: [x0, v0, x1, v1, x2, v2]
      const derivs = (x0, v0, x1, v1, x2, v2) => {
        // Tower A (Unprotected linear 1-DOF resonator)
        const a0 = fExt - 2 * z1 * w1 * v0 - (w1 * w1) * x0;

        // Tower B (Protected by 660t TMD)
        let a1, a2;
        if (this.tmdActive) {
          const relX = x2 - x1;
          const relV = v2 - v1;
          // Coupling acceleration exerted by TMD on primary building mass
          const tmdAccel = 2 * z2 * w2 * mu * relV + mu * (w2 * w2) * relX;
          a1 = fExt - 2 * z1 * w1 * v1 - (w1 * w1) * x1 + tmdAccel;
          a2 = this.isDraggingBall ? 0 : (-2 * z2 * w2 * relV - (w2 * w2) * relX);
        } else {
          // TMD locked to building
          a1 = (fExt - 2 * z1 * w1 * v1 - (w1 * w1) * x1) / (1 + mu);
          a2 = a1;
        }

        return [v0, a0, v1, a1, this.isDraggingBall ? 0 : v2, a2];
      };

      const s = [this.x0, this.v0, this.x1, this.v1, this.x2, this.v2];
      const k1 = derivs(s[0], s[1], s[2], s[3], s[4], s[5]);
      const k2 = derivs(
        s[0] + 0.5 * dt * k1[0], s[1] + 0.5 * dt * k1[1],
        s[2] + 0.5 * dt * k1[2], s[3] + 0.5 * dt * k1[3],
        s[4] + 0.5 * dt * k1[4], s[5] + 0.5 * dt * k1[5]
      );
      const k3 = derivs(
        s[0] + 0.5 * dt * k2[0], s[1] + 0.5 * dt * k2[1],
        s[2] + 0.5 * dt * k2[2], s[3] + 0.5 * dt * k2[3],
        s[4] + 0.5 * dt * k2[4], s[5] + 0.5 * dt * k2[5]
      );
      const k4 = derivs(
        s[0] + dt * k3[0], s[1] + dt * k3[1],
        s[2] + dt * k3[2], s[3] + dt * k3[3],
        s[4] + dt * k3[4], s[5] + dt * k3[5]
      );

      this.x0 += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      this.v0 += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      this.x1 += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      this.v1 += (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);

      if (!this.isDraggingBall) {
        if (this.tmdActive) {
          this.x2 += (dt / 6) * (k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4]);
          this.v2 += (dt / 6) * (k1[5] + 2 * k2[5] + 2 * k3[5] + k4[5]);
        } else {
          this.x2 = this.x1;
          this.v2 = this.v1;
        }
      }

      // Compute TMD counter-force and dissipated hydraulic power
      const relX = this.x2 - this.x1;
      const relV = this.v2 - this.v1;
      this.currentTmdForce = this.tmdActive ? (relX * 1.4 + relV * 0.25) : 0.0;
      this.dissipatedPowerKw = this.tmdActive ? Math.min(999, Math.abs(relV * relV) * 185 * this.zeta2 * 10) : 0;
    }

    _updateUIBadges() {
      const modeBadge = document.getElementById('sim9-mode-badge');
      const dispBadge = document.getElementById('sim9-disp-badge');
      const tmdBadge = document.getElementById('sim9-tmd-badge');

      if (modeBadge) {
        modeBadge.textContent = this.tmdActive ? '🛡️ TMD ACTIV' : '⚠️ TMD BLOCAT';
        modeBadge.className = this.tmdActive ? 'sim-badge sim-badge--cyan' : 'sim-badge sim-badge--danger';
      }

      if (dispBadge) {
        const amp1 = Math.hypot(this.x1, this.v1 / this.omega1);
        const amp0 = Math.hypot(this.x0, this.v0 / this.omega1);
        const cm1 = Math.round(amp1 * 100);
        const cm0 = Math.round(amp0 * 100);
        dispBadge.textContent = `Cu TMD: ±${cm1} cm (Fără: ±${cm0} cm)`;
        dispBadge.className = cm1 > 50 ? 'sim-badge sim-badge--danger' : 'sim-badge sim-badge--cyan';
      }

      if (tmdBadge) {
        const relX = (this.x2 - this.x1) * 0.52;
        const relV = (this.v2 - this.v1) * 0.52;
        const relAmp = Math.hypot(relX, relV / this.omega2);
        const relCm = Math.round(relAmp * 100);
        tmdBadge.textContent = `Cursă Bilă: ±${relCm} cm`;
      }
    }

    // =========================================================================
    // RENDERING PIPELINE
    // =========================================================================
    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (W < 40 || H < 40) return;

      ctx.clearRect(0, 0, W, H);

      // Atmospheric night sky background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#050912');
      bg.addColorStop(0.55, '#0a1426');
      bg.addColorStop(1, '#060b16');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const bannerH = H < 350 ? 22 : 26;
      this._drawBanner(ctx, W, bannerH);

      const topY = bannerH;
      const topH = (H - bannerH) * 0.60;
      const botY = topY + topH;
      const botH = H - botY;

      this._drawUpperComparisonAndCutaway(ctx, 0, topY, W, topH);
      this._drawLowerGraphs(ctx, 0, botY, W, botH);
    }

    _drawBanner(ctx, W, h) {
      const isNarrow = W < 580;
      const fOpt = (1 / (1 + this.massRatio)).toFixed(3);
      const zOpt = (Math.sqrt((3 * this.massRatio) / (8 * (1 + this.massRatio))) * 100).toFixed(1);

      ctx.fillStyle = this.tmdActive ? 'rgba(0, 229, 255, 0.13)' : 'rgba(255, 23, 68, 0.22)';
      ctx.fillRect(0, 0, W, h);
      ctx.strokeStyle = this.tmdActive ? '#00e5ff55' : '#ff174477';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(W, h);
      ctx.stroke();

      ctx.font = `bold ${isNarrow ? 8.5 : 10.5}px Inter, sans-serif`;
      ctx.fillStyle = this.tmdActive ? '#00e5ff' : '#ff5252';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = this.tmdActive
        ? (isNarrow
            ? `🛡️ TAIPEI 101 TMD ACTIV (f_opt=${fOpt}, ζ_opt=${zOpt}%): Pendulul trage în sens opus vântului!`
            : `🛡️ COMPARAȚIE ÎN TIMP REAL: Turn fără TMD (Stânga, Roșu) vs. Turnul Taipei 101 cu Pendul de 660t (Centru, Cyan) — Trage de bila de aur!`)
        : `⚠️ TMD BLOCAT: Ambele turnuri oscilează periculos în rezonanță (Q ≈ 33)! Activează TMD pentru a vedea atenuarea!`;

      ctx.fillText(text, W / 2, h / 2);
    }

    // =========================================================================
    // UPPER PANEL: LEFT = SIDE-BY-SIDE TOWERS, RIGHT = ZOOMED PENDULUM CHAMBER
    // =========================================================================
    _drawUpperComparisonAndCutaway(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();

      this._drawWindStreamlines(ctx, gx, gy, gw, gh);

      const leftW = gw * 0.48;
      const rightX = gx + leftW;
      const rightW = gw - leftW;

      this._drawTwinSkyscrapers(ctx, gx, gy, leftW, gh);
      this._drawZoomedPendulumChamber(ctx, rightX, gy, rightW, gh);

      ctx.restore();
    }

    _drawWindStreamlines(ctx, gx, gy, gw, gh) {
      if (this.excitationMode === 'free-impulse') return;
      ctx.save();
      ctx.strokeStyle = this.excitationMode === 'typhoon' ? 'rgba(251, 191, 36, 0.20)' : 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1.2;
      for (const p of this.windParticles) {
        const px = gx + p.x * gw;
        const py = gy + p.y * gh;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.len, py);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawTwinSkyscrapers(ctx, gx, gy, gw, gh) {
      ctx.save();

      const groundY = gy + gh - 20;
      const groundShift = this.excitationMode === 'earthquake' ? this.groundX * 22 : 0;

      // Ground Foundation Platform
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(gx + 6, groundY, gw - 12, 18);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx + 6, groundY);
      ctx.lineTo(gx + gw - 6, groundY);
      ctx.stroke();

      // Two Towers:
      // Tower A (Left, 26% of gw): FĂRĂ TMD (Red alert)
      // Tower B (Right, 72% of gw): CU TMD 660t (Cyan/Gold)
      const towerAX = gx + gw * 0.27 + groundShift;
      const towerBX = gx + gw * 0.73 + groundShift;
      const totalTowerH = Math.max(80, gh - 42);

      // Draw Tower A (Fără TMD)
      this._drawSingleTaipeiTower(
        ctx,
        towerAX,
        groundY,
        totalTowerH,
        gw * 0.22,
        this.x0,
        null,
        '#ff5252',
        'FĂRĂ TMD (1-DOF)'
      );

      // Draw Tower B (Taipei 101 cu TMD)
      this._drawSingleTaipeiTower(
        ctx,
        towerBX,
        groundY,
        totalTowerH,
        gw * 0.22,
        this.x1,
        this.x2,
        this.tmdActive ? '#00e5ff' : '#ff5252',
        this.tmdActive ? 'CU TMD (660 t)' : 'TMD BLOCAT'
      );

      // Draw dashed zoom callout lines from Tower B's 87-92F chamber to the right cutaway panel
      const chamberTopY = groundY - totalTowerH * 0.78;
      const chamberBotY = groundY - totalTowerH * 0.67;
      const tipShiftB = this.x1 * 26;
      const chamberShiftB = tipShiftB * Math.pow(0.72, 2);

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(towerBX + chamberShiftB + 14, chamberTopY);
      ctx.lineTo(gx + gw - 2, gy + 12);
      ctx.moveTo(towerBX + chamberShiftB + 14, chamberBotY);
      ctx.lineTo(gx + gw - 2, gy + gh - 12);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }

    _drawSingleTaipeiTower(ctx, baseX, groundY, totalH, maxW, tipMeters, ballMeters, accentColor, bottomLabel) {
      ctx.save();

      // Continuous height breakdown (sums to 1.00 * totalH — NO FLOATING GAPS!):
      // 1. Base Podium: 0.00 -> 0.16 of totalH
      // 2. 8 Pagoda Tiers: 0.16 -> 0.80 of totalH (each tier is 0.08 of totalH)
      // 3. Crown Pedestal: 0.80 -> 0.88 of totalH
      // 4. Spire Antenna: 0.88 -> 1.00 of totalH
      const maxSwayPx = tipMeters * 26;
      const deflectAt = (uNorm) => maxSwayPx * (uNorm * uNorm);

      const wBase = Math.max(24, Math.min(44, maxW));

      // Vertical reference center line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(baseX, groundY);
      ctx.lineTo(baseX, groundY - totalH - 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // 1. Base Podium (0.00 -> 0.16)
      const uPodTop = 0.16;
      const yPodTop = groundY - uPodTop * totalH;
      const dPodTop = deflectAt(uPodTop);
      const wPodBot = wBase * 1.05;
      const wPodTop = wBase * 0.76;

      ctx.fillStyle = '#162238';
      ctx.strokeStyle = accentColor + '99';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(baseX - wPodBot * 0.5, groundY);
      ctx.lineTo(baseX + wPodBot * 0.5, groundY);
      ctx.lineTo(baseX + dPodTop + wPodTop * 0.5, yPodTop);
      ctx.lineTo(baseX + dPodTop - wPodTop * 0.5, yPodTop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. 8 Contiguous Pagoda Segments (0.16 -> 0.80)
      const numTiers = 8;
      const tierUNorm = 0.64 / numTiers; // 0.08 each

      for (let i = 0; i < numTiers; i++) {
        const uBot = 0.16 + i * tierUNorm;
        const uTop = uBot + tierUNorm;
        const yBot = groundY - uBot * totalH;
        const yTop = groundY - uTop * totalH;
        const dBot = deflectAt(uBot);
        const dTop = deflectAt(uTop);

        const taper = 1 - i * 0.035;
        const wBot = wBase * 0.68 * taper;
        const wTop = wBase * 0.84 * taper; // Flared pagoda roof

        const isDamperTier = (ballMeters !== null && (i === 6 || i === 7));

        ctx.beginPath();
        ctx.moveTo(baseX + dBot - wBot * 0.5, yBot);
        ctx.lineTo(baseX + dBot + wBot * 0.5, yBot);
        ctx.lineTo(baseX + dTop + wTop * 0.5, yTop);
        ctx.lineTo(baseX + dTop - wTop * 0.5, yTop);
        ctx.closePath();

        if (isDamperTier) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.strokeStyle = '#fbbf24';
        } else {
          ctx.fillStyle = '#0f1b2d';
          ctx.strokeStyle = accentColor + '88';
        }
        ctx.fill();
        ctx.stroke();

        // Subtle horizontal floor window strip inside tier
        if (!isDamperTier) {
          const yMid = (yBot + yTop) * 0.5;
          const dMid = (dBot + dTop) * 0.5;
          const wMid = (wBot + wTop) * 0.36;
          ctx.strokeStyle = accentColor + '33';
          ctx.beginPath();
          ctx.moveTo(baseX + dMid - wMid, yMid);
          ctx.lineTo(baseX + dMid + wMid, yMid);
          ctx.stroke();
        }
      }

      // If this is Tower B, draw the mini golden pendulum inside Tiers 6-7!
      if (ballMeters !== null) {
        const uBall = 0.72;
        const yBall = groundY - uBall * totalH;
        const dTowerAtBall = deflectAt(uBall);
        const relBallPx = Math.max(-9, Math.min(9, (ballMeters - tipMeters) * 14));
        const bx = baseX + dTowerAtBall + relBallPx;

        // Suspension line from top of tier 8
        const yAnchor = groundY - 0.80 * totalH;
        const dAnchor = deflectAt(0.80);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(baseX + dAnchor, yAnchor);
        ctx.lineTo(bx, yBall);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(bx, yBall, 3.8, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 3. Crown Pedestal (0.80 -> 0.88, directly touching top of Tier 8!)
      const uCrownBot = 0.80;
      const uCrownTop = 0.88;
      const yCrownBot = groundY - uCrownBot * totalH;
      const yCrownTop = groundY - uCrownTop * totalH;
      const dCrownBot = deflectAt(uCrownBot);
      const dCrownTop = deflectAt(uCrownTop);
      const wCrownBot = wBase * 0.44;
      const wCrownTop = wBase * 0.20;

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(baseX + dCrownBot - wCrownBot * 0.5, yCrownBot);
      ctx.lineTo(baseX + dCrownBot + wCrownBot * 0.5, yCrownBot);
      ctx.lineTo(baseX + dCrownTop + wCrownTop * 0.5, yCrownTop);
      ctx.lineTo(baseX + dCrownTop - wCrownTop * 0.5, yCrownTop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 4. Spire Antenna (0.88 -> 1.00, directly mounted on Crown Pedestal!)
      const ySpireTop = groundY - totalH;
      const dSpireTop = deflectAt(1.00);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(baseX + dCrownTop, yCrownTop);
      ctx.lineTo(baseX + dSpireTop, ySpireTop);
      ctx.stroke();

      // Spire beacon dot
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(baseX + dSpireTop, ySpireTop, 2.8, 0, 2 * Math.PI);
      ctx.fill();

      // Deflection readout above spire
      const swayCm = Math.round(tipMeters * 100);
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'center';
      ctx.fillText(`${swayCm >= 0 ? '+' : ''}${swayCm} cm`, baseX + dSpireTop, ySpireTop - 7);

      // Bottom label on foundation
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = accentColor;
      ctx.fillText(bottomLabel, baseX, groundY + 12);

      ctx.restore();
    }

    // =========================================================================
    // RIGHT UPPER PANEL: ZOOMED CUTAWAY OF FLOORS 87-92 (660-TONNE PENDULUM)
    // =========================================================================
    _drawZoomedPendulumChamber(ctx, gx, gy, gw, gh) {
      ctx.save();

      const pad = 8;
      const boxX = gx + pad;
      const boxY = gy + pad;
      const boxW = gw - pad * 2;
      const boxH = gh - pad * 2;

      // Dark architectural blueprint card
      ctx.fillStyle = 'rgba(10, 19, 36, 0.94)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      // Header
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'left';
      ctx.fillText('SECȚIUNE MĂRITĂ: CAMERA PENDULULUI (ETAJELE 87 – 92)', boxX + 12, boxY + 15);

      ctx.font = '8.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Sferă din 41 plăci de oțel aurit (660 t) + amortizoare hidraulice radiale', boxX + 12, boxY + 27);

      // Chamber interior coordinates:
      // The structural frame of the chamber moves slightly with building displacement x1
      const frameCenterX = boxX + boxW * 0.50 + this.x1 * 18;
      const ceilingY = boxY + 38;
      const floorY = boxY + boxH - 22;
      const chamberH = floorY - ceilingY;

      // Draw Building Columns on Left & Right of Chamber (moving with x1)
      const colSpan = Math.min(boxW * 0.78, 290);
      const colLeftX = frameCenterX - colSpan * 0.5;
      const colRightX = frameCenterX + colSpan * 0.5;

      ctx.strokeStyle = '#38bdf866';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(colLeftX, ceilingY);
      ctx.lineTo(colLeftX, floorY);
      ctx.moveTo(colRightX, ceilingY);
      ctx.lineTo(colRightX, floorY);
      ctx.stroke();

      // Ceiling girder (Floor 92) & Floor slab (Floor 87)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(colLeftX - 6, ceilingY - 5, colSpan + 12, 6);
      ctx.fillRect(colLeftX - 6, floorY, colSpan + 12, 8);

      // True Pendulum Kinematics in Cutaway:
      // Relative displacement u = (x2 - x1)*0.52 determines pendulum angle phi
      const relMeters = (this.x2 - this.x1) * 0.52;
      const pendL = Math.max(46, chamberH * 0.52);
      const sphereR = Math.max(18, Math.min(26, chamberH * 0.18));

      // Swing angle phi (clamped for visual safety)
      const sinPhi = Math.max(-0.48, Math.min(0.48, (relMeters * 42) / pendL));
      const phi = Math.asin(sinPhi);

      const pivotX = frameCenterX;
      const pivotY = ceilingY + 2;
      const sphereCx = pivotX + pendL * Math.sin(phi);
      const sphereCy = pivotY + pendL * Math.cos(phi);

      this.sphereHit = {
        cx: sphereCx,
        cy: sphereCy,
        r: sphereR,
        pivotX: pivotX,
        pivotY: pivotY,
        L: pendL
      };

      // Draw Circular Trajectory Arc Guide
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, pendL, Math.PI * 0.5 - 0.50, Math.PI * 0.5 + 0.50);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Upper Ceiling Mount Bracket (compact realistic cable hanger, NOT a huge wide triangle)
      const hangerHalfW = sphereR * 0.55;
      ctx.fillStyle = '#475569';
      ctx.fillRect(pivotX - hangerHalfW - 4, pivotY - 3, (hangerHalfW + 4) * 2, 5);

      // Draw 4 Parallel Pairs of Steel Cables rotating naturally with the pendulum angle phi!
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      const cableOffsets = [-0.48, -0.18, 0.18, 0.48];
      for (const off of cableOffsets) {
        const ax = pivotX + off * sphereR;
        const ay = pivotY + 2;
        const bx = sphereCx + off * sphereR;
        const by = sphereCy - Math.sqrt(Math.max(1, sphereR * sphereR - (off * sphereR) ** 2));
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      // Lower Coupling Pin extending from bottom of sphere to the Hydraulic Damper Cradle
      const pinBottomX = sphereCx;
      const pinBottomY = sphereCy + sphereR + 9;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(sphereCx, sphereCy + sphereR - 2);
      ctx.lineTo(pinBottomX, pinBottomY);
      ctx.stroke();

      // Horizontal Hydraulic Viscous Damper Cradle Frame (aligned with lower bumper pin)
      const cradleY = pivotY + pendL + sphereR + 9;
      const leftAnchorX = colLeftX + 12;
      const rightAnchorX = colRightX - 12;

      // Support stanchions from Floor 87 up to the Hydraulic Cradle
      ctx.fillStyle = '#334155';
      ctx.fillRect(leftAnchorX - 3, cradleY - 5, 6, Math.max(8, floorY - cradleY + 5));
      ctx.fillRect(rightAnchorX - 3, cradleY - 5, 6, Math.max(8, floorY - cradleY + 5));

      const isDissipating = this.tmdActive && Math.abs(this.v2 - this.v1) > 0.08;
      const pistonColor = isDissipating ? '#00e5ff' : '#64748b';

      this._drawHydraulicPiston(ctx, leftAnchorX, cradleY, pinBottomX - 4, pinBottomY, pistonColor, isDissipating);
      this._drawHydraulicPiston(ctx, rightAnchorX, cradleY, pinBottomX + 4, pinBottomY, pistonColor, isDissipating);

      // Draw the Giant 660-Tonne Golden Sphere
      this._drawGoldenSphere(ctx, sphereCx, sphereCy, sphereR);

      // Relative Stroke Text on Sphere
      const relCm = Math.round(relMeters * 100);
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${relCm >= 0 ? '+' : ''}${relCm} cm`, sphereCx, sphereCy);

      // Draw Opposing Force Vectors above/below sphere to explain the physics!
      // 1. External Wind/Seismic Force on Building (Red)
      const fWindPx = this.currentExtForce * 34;
      if (Math.abs(fWindPx) > 3) {
        this._drawForceVector(
          ctx,
          frameCenterX,
          ceilingY + 14,
          frameCenterX + fWindPx,
          ceilingY + 14,
          '#ff5252',
          'F_excit'
        );
      }

      // 2. TMD Restoring Counter-Force on Building (Cyan)
      if (this.tmdActive) {
        const fTmdPx = this.currentTmdForce * 42;
        if (Math.abs(fTmdPx) > 3) {
          this._drawForceVector(
            ctx,
            sphereCx,
            sphereCy - sphereR - 10,
            sphereCx + fTmdPx,
            sphereCy - sphereR - 10,
            '#00e5ff',
            'F_TMD (Opusă)'
          );
        }
      }

      // Power dissipation badge at bottom of chamber
      ctx.font = 'bold 8.5px Inter, sans-serif';
      ctx.fillStyle = this.tmdActive ? '#34d399' : '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText(
        this.tmdActive
          ? `⚡ Putere disipată în amortizoarele hidraulice: ${this.dissipatedPowerKw.toFixed(0)} kW`
          : '🔒 Amortizoare blocate (0 kW disipați)',
        boxX + boxW * 0.5,
        boxY + boxH - 7
      );

      ctx.restore();
    }

    _drawHydraulicPiston(ctx, x1, y1, x2, y2, color, glowing) {
      ctx.save();
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 4) {
        ctx.restore();
        return;
      }
      const ang = Math.atan2(dy, dx);

      ctx.translate(x1, y1);
      ctx.rotate(ang);

      const cylLen = len * 0.52;
      // Piston rod
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(cylLen, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();

      // Hydraulic cylinder barrel
      ctx.fillStyle = glowing ? 'rgba(0, 229, 255, 0.25)' : '#1e293b';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.fillRect(0, -4.5, cylLen, 9);
      ctx.strokeRect(0, -4.5, cylLen, 9);

      // End joints
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, 2 * Math.PI);
      ctx.arc(len, 0, 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.restore();
    }

    _drawGoldenSphere(ctx, cx, cy, r) {
      ctx.save();

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(cx + 3, cy + 4, r, 0, 2 * Math.PI);
      ctx.fill();

      // Metallic gold gradient
      const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
      grad.addColorStop(0, '#fef9c3');
      grad.addColorStop(0.35, '#facc15');
      grad.addColorStop(0.75, '#ca8a04');
      grad.addColorStop(1, '#713f12');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Stacked horizontal steel plate rings (41 discs of Taipei 101 sphere)
      ctx.strokeStyle = 'rgba(113, 63, 18, 0.42)';
      ctx.lineWidth = 0.85;
      for (let i = 1; i <= 5; i++) {
        const py = cy - r + (i / 6) * (2 * r);
        const halfChord = Math.sqrt(Math.max(0, r * r - (py - cy) ** 2));
        ctx.beginPath();
        ctx.moveTo(cx - halfChord, py);
        ctx.lineTo(cx + halfChord, py);
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawForceVector(ctx, x1, y1, x2, y2, color, label) {
      const dx = x2 - x1;
      const dir = dx >= 0 ? 1 : -1;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - dir * 6, y2 - 3.5);
      ctx.lineTo(x2 - dir * 6, y2 + 3.5);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, (x1 + x2) * 0.5, y1 - 5);
      ctx.restore();
    }

    // =========================================================================
    // LOWER PANEL: LEFT = INTERACTIVE BODE FRF, RIGHT = COMPARATIVE WAVEFORMS
    // =========================================================================
    _drawLowerGraphs(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();

      const leftW = gw * 0.50;
      const rightW = gw - leftW;

      this._drawInteractiveBodePlot(ctx, gx + 8, gy + 4, leftW - 12, gh - 8);
      this._drawComparativeWaveforms(ctx, gx + leftW + 2, gy + 4, rightW - 10, gh - 8);

      ctx.restore();
    }

    _drawInteractiveBodePlot(ctx, x, y, w, h) {
      ctx.save();

      ctx.fillStyle = 'rgba(11, 20, 38, 0.94)';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, 6);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('CURBA DE RĂSPUNS |H(ω)| — DESPICAREA REZONANȚEI (CLICK)', x + 10, y + 14);

      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#ff5252';
      ctx.fillText('■ Fără TMD (Q ≈ 33)', x + 10, y + 25);
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('■ Cu TMD Den Hartog (Atenuat -78%)', x + 105, y + 25);

      const plotX = x + 28;
      const plotY = y + 32;
      const plotW = w - 38;
      const plotH = h - 46;
      if (plotW < 20 || plotH < 15) {
        ctx.restore();
        return;
      }

      this.bodeRect = { x: plotX, y: plotY, w: plotW, h: plotH };

      // Grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i <= 3; i++) {
        const ly = plotY + (i / 3) * plotH;
        ctx.beginPath();
        ctx.moveTo(plotX, ly);
        ctx.lineTo(plotX + plotW, ly);
        ctx.stroke();
      }

      const rMin = 0.50;
      const rMax = 1.50;
      const maxH = 36.0;

      const calcH2DOF = (r, mu, f, z1, z2) => {
        const num = Math.hypot(f * f - r * r, 2 * z2 * f * r);
        const t1 = (1 - r * r) * (f * f - r * r) - mu * f * f * r * r - 4 * z1 * z2 * f * r * r;
        const t2 = 2 * z2 * f * r * (1 - r * r - mu * r * r) + 2 * z1 * r * (f * f - r * r);
        return num / Math.max(0.001, Math.hypot(t1, t2));
      };

      const steps = 90;

      // 1. Unprotected 1-DOF Curve (Red Dashed)
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const r = rMin + (s / steps) * (rMax - rMin);
        const h1 = 1 / Math.hypot(1 - r * r, 2 * this.zeta1 * r);
        const px = plotX + ((r - rMin) / (rMax - rMin)) * plotW;
        const py = plotY + plotH - (Math.min(h1, maxH) / maxH) * plotH;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Protected 2-DOF TMD Curve (Cyan Solid)
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const r = rMin + (s / steps) * (rMax - rMin);
        const h2 = calcH2DOF(r, this.massRatio, this.tuningRatio, this.zeta1, this.zeta2);
        const px = plotX + ((r - rMin) / (rMax - rMin)) * plotW;
        const py = plotY + plotH - (Math.min(h2, maxH) / maxH) * plotH;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current frequency vertical cursor line & both operating dots
      const curX = plotX + ((this.freqRatio - rMin) / (rMax - rMin)) * plotW;
      const curH1 = 1 / Math.hypot(1 - this.freqRatio ** 2, 2 * this.zeta1 * this.freqRatio);
      const curH2 = this.tmdActive
        ? calcH2DOF(this.freqRatio, this.massRatio, this.tuningRatio, this.zeta1, this.zeta2)
        : curH1;

      const py1 = plotY + plotH - (Math.min(curH1, maxH) / maxH) * plotH;
      const py2 = plotY + plotH - (Math.min(curH2, maxH) / maxH) * plotH;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(curX, plotY);
      ctx.lineTo(curX, plotY + plotH);
      ctx.stroke();

      // Red dot (Fără TMD)
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.arc(curX, py1, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Cyan dot (Cu TMD)
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(curX, py2, 4.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('0.5 ω₁', plotX, plotY + plotH + 10);
      ctx.fillText('1.0 ω₁ (Rezonanță)', plotX + plotW * 0.5, plotY + plotH + 10);
      ctx.fillText('1.5 ω₁', plotX + plotW, plotY + plotH + 10);

      ctx.restore();
    }

    _drawComparativeWaveforms(ctx, x, y, w, h) {
      ctx.save();

      ctx.fillStyle = 'rgba(11, 20, 38, 0.94)';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, 6);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('OSCILOGRAMĂ COMPARATIVĂ ÎN TIMP REAL x(t)', x + 10, y + 14);

      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#ff5252';
      ctx.fillText('■ Turn Fără TMD', x + 10, y + 25);
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('■ Turn Cu TMD (Taipei 101)', x + 92, y + 25);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('■ Cursă Bilă (x₂ - x₁)', x + 215, y + 25);

      const waveX = x + 10;
      const waveY = y + 32;
      const waveW = w - 20;
      const waveH = h - 40;
      if (waveW < 20 || waveH < 16) {
        ctx.restore();
        return;
      }

      const midY = waveY + waveH * 0.5;
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.beginPath();
      ctx.moveTo(waveX, midY);
      ctx.lineTo(waveX + waveW, midY);
      ctx.stroke();

      const count = this.histCount;
      if (count > 2) {
        const startIdx = (this.histIdx - count + this.histLen) % this.histLen;

        // 1. Unprotected Tower x0(t) (Red)
        ctx.strokeStyle = 'rgba(255, 82, 82, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const idx = (startIdx + i) % this.histLen;
          const px = waveX + (i / (this.histLen - 1)) * waveW;
          const py = midY - (this.histX0[idx] / 1.15) * (waveH * 0.44);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // 2. Pendulum relative stroke (Gold dashed)
        if (this.tmdActive) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            const idx = (startIdx + i) % this.histLen;
            const px = waveX + (i / (this.histLen - 1)) * waveW;
            const py = midY - (this.histRel[idx] / 1.15) * (waveH * 0.44);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }

        // 3. Protected Taipei 101 Tower x1(t) (Bright Cyan)
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const idx = (startIdx + i) % this.histLen;
          const px = waveX + (i / (this.histLen - 1)) * waveW;
          const py = midY - (this.histX1[idx] / 1.15) * (waveH * 0.44);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  window.TunedMassDamperSim = TunedMassDamperSim;
})();
