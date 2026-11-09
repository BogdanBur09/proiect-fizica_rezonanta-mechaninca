/* ============================================================
   SLIDE 9: TUNED MASS DAMPER (TMD) — TAIPEI 101 SIMULATION
   2-DOF Coupled Dynamic Equations with Den Hartog Optimization
   Upper Panel: Taipei 101 Skyscraper Cutaway & 660-Tonne Golden Pendulum
   Lower Panel: Dynamic Amplification Frequency Response (FRF) & Telemetry
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  class TunedMassDamperSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Physical Parameters of Skyscraper (Taipei 101) ---
      this.f1 = 0.15;                         // Frecvență proprie turn f1 ~ 0.15 Hz (T1 ~ 6.7 secunde)
      this.omega1 = 2 * Math.PI * this.f1;     // Pulsație proprie clădire (rad/s)
      this.zeta1 = 0.012;                     // Amortizare structurală intrinsecă clădire (1.2% - foarte joasă)

      // --- TMD (660-Tonne Golden Pendulum) Parameters ---
      this.massRatio = 0.025;                 // mu = m2 / M1 (~ 2.5% din masa modală efectivă)
      this.tmdActive = true;                  // true = TMD liber cu amortizoare hidraulice; false = blocat rigid
      this.zeta2 = 0.10;                      // Factor de amortizare amortizoare hidraulice TMD (10%)
      this.tuningRatio = 1 / (1 + this.massRatio); // f = omega2 / omega1 (Den Hartog optim)
      this.omega2 = this.tuningRatio * this.omega1;

      // --- Excitation Source ---
      this.freqRatio = 1.0;                   // r = omega_ext / omega1 (1.0 = rezonanță perfectă cu vântul)
      this.omegaExt = this.freqRatio * this.omega1;
      this.forceAmp = 1.0;                    // Forță modală normalizată
      this.excitationMode = 'wind-resonant';   // 'wind-resonant' | 'typhoon' | 'earthquake' | 'free-impulse'

      // --- 2-DOF Dynamic State Vectors (RK4 Numerical Integration) ---
      // x1: Deplasare vârf turn (m)
      // v1: Viteză vârf turn (m/s)
      // x2: Deplasare pendul TMD (m)
      // v2: Viteză pendul TMD (m/s)
      this.x1 = 0.0;
      this.v1 = 0.0;
      this.x2 = 0.0;
      this.v2 = 0.0;

      // Internal excitation phases
      this.extPhase = 0.0;
      this.gustTimer = 0.0;
      this.gustAmp = 0.0;
      this.quakeGroundX = 0.0;

      // Energy dissipation tracking
      this.dissipatedPower = 0.0;
      this.maxRecordedX1 = 0.05;
      this.maxRecordedX2 = 0.05;

      // History buffers for real-time deflection waveforms
      this.historyLen = 160;
      this.histX1 = new Float32Array(this.historyLen);
      this.histX2 = new Float32Array(this.historyLen);
      this.histIdx = 0;

      // Interactive mouse/touch dragging
      this.isDraggingBall = false;
      this.dragStartX = 0;
      this.sphereScreenPos = { x: 0, y: 0, r: 24 };

      // Streamline particles for wind animation
      this.windParticles = [];
      this._initWindParticles();
      this._bindMouseEvents();
    }

    _initWindParticles() {
      this.windParticles = [];
      for (let i = 0; i < 35; i++) {
        this.windParticles.push({
          x: Math.random(),
          y: Math.random() * 0.75,
          speed: 0.6 + Math.random() * 0.8,
          len: 15 + Math.random() * 25
        });
      }
    }

    // =========================================================================
    // PARAMETER SETTERS & DEN HARTOG CALCULATIONS
    // =========================================================================
    setFreqRatio(r) {
      this.freqRatio = Math.max(0.4, Math.min(1.6, r));
      this.omegaExt = this.freqRatio * this.omega1;
      const slider = document.getElementById('sim9-freq');
      const valDisp = document.getElementById('sim9-freq-val');
      if (slider) slider.value = this.freqRatio.toFixed(2);
      if (valDisp) {
        const extF = (this.freqRatio * this.f1).toFixed(3);
        valDisp.textContent = `${this.freqRatio.toFixed(2)} (${extF} Hz)`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setMassRatio(mu) {
      this.massRatio = Math.max(0.005, Math.min(0.08, mu));
      this.omega2 = this.tuningRatio * this.omega1;
      const slider = document.getElementById('sim9-mass');
      const valDisp = document.getElementById('sim9-mass-val');
      if (slider) slider.value = (this.massRatio * 100).toFixed(1);
      if (valDisp) {
        valDisp.textContent = `${(this.massRatio * 100).toFixed(1)}% (m₂ ≈ ${(this.massRatio * 26400).toFixed(0)} t)`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setZetaTMD(zeta) {
      this.zeta2 = Math.max(0.01, Math.min(0.28, zeta));
      const slider = document.getElementById('sim9-zeta');
      const valDisp = document.getElementById('sim9-zeta-val');
      if (slider) slider.value = (this.zeta2 * 100).toFixed(0);
      if (valDisp) {
        valDisp.textContent = `${(this.zeta2 * 100).toFixed(0)}%`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setTMDActive(active) {
      this.tmdActive = !!active;
      if (!this.tmdActive) {
        // Locked to building
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
      // Den Hartog Optimal Tuning Formula:
      // f_opt = 1 / (1 + mu)
      // zeta_opt = sqrt( 3*mu / (8*(1 + mu)) )
      this.tuningRatio = 1 / (1 + this.massRatio);
      this.omega2 = this.tuningRatio * this.omega1;
      this.zeta2 = Math.sqrt((3 * this.massRatio) / (8 * (1 + this.massRatio)));

      this.setZetaTMD(this.zeta2);
      this.setTMDActive(true);
      this._updateUIBadges();
      this.requestRender();
    }

    setExcitationMode(mode) {
      this.excitationMode = mode;
      const modes = ['wind-resonant', 'typhoon', 'earthquake', 'free-impulse'];
      modes.forEach((m) => {
        const btn = document.getElementById(`sim9-preset-${m}`);
        if (btn) {
          if (m === mode) btn.classList.add('sim-btn--preset');
          else btn.classList.remove('sim-btn--preset');
        }
      });

      if (mode === 'wind-resonant') {
        this.setFreqRatio(1.0);
        this.forceAmp = 1.0;
      } else if (mode === 'typhoon') {
        // Super Typhoon Soudelor 2015 conditions
        this.setFreqRatio(0.96);
        this.forceAmp = 1.65;
      } else if (mode === 'earthquake') {
        this.setFreqRatio(1.04);
        this.forceAmp = 1.35;
      } else if (mode === 'free-impulse') {
        this.forceAmp = 0.0;
        this.x1 = 0.85; // 85 cm initial push
        this.x2 = 0.0;
        this.v1 = 0;
        this.v2 = 0;
      }

      this._updateUIBadges();
      this.requestRender();
    }

    onReset() {
      this.x1 = 0.0;
      this.v1 = 0.0;
      this.x2 = 0.0;
      this.v2 = 0.0;
      this.extPhase = 0.0;
      this.gustTimer = 0.0;
      this.gustAmp = 0.0;
      this.quakeGroundX = 0.0;
      this.dissipatedPower = 0.0;
      this.maxRecordedX1 = 0.05;
      this.maxRecordedX2 = 0.05;

      this.setFreqRatio(1.0);
      this.setMassRatio(0.025);
      this.applyDenHartogOptimum();
      this.setExcitationMode('wind-resonant');
    }

    requestRender() {
      if (!this.running) this.render();
    }

    // =========================================================================
    // EVENT BINDINGS
    // =========================================================================
    _bindMouseEvents() {
      if (!this.canvas) return;

      const getCoords = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      };

      const onStart = (e) => {
        const pt = getCoords(e);
        const dist = Math.hypot(pt.x - this.sphereScreenPos.x, pt.y - this.sphereScreenPos.y);
        if (dist <= this.sphereScreenPos.r + 14) {
          this.isDraggingBall = true;
          this.dragStartX = pt.x;
        }
      };

      const onMove = (e) => {
        if (!this.isDraggingBall) return;
        const pt = getCoords(e);
        const dxPixels = pt.x - this.dragStartX;
        // 1 meter visual ~ 100 pixels
        const deltaMeters = dxPixels / 90;
        this.x2 = Math.max(-1.5, Math.min(1.5, this.x2 + deltaMeters * 0.2));
        this.v2 = 0;
        this.dragStartX = pt.x;
        this.requestRender();
      };

      const onEnd = () => {
        this.isDraggingBall = false;
      };

      this.canvas.addEventListener('mousedown', onStart);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
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
        zetaSlider.value = (this.zeta2 * 100).toFixed(0);
        zetaSlider.addEventListener('input', (e) => this.setZetaTMD(parseFloat(e.target.value) / 100));
      }

      if (toggleTmdBtn) {
        toggleTmdBtn.addEventListener('click', () => this.setTMDActive(!this.tmdActive));
      }

      if (optBtn) {
        optBtn.addEventListener('click', () => this.applyDenHartogOptimum());
      }

      if (impulseBtn) {
        impulseBtn.addEventListener('click', () => this.setExcitationMode('free-impulse'));
      }

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

      this._updateUIBadges();
    }

    // =========================================================================
    // 2-DOF NUMERICAL PHYSICS ENGINE (RUNGE-KUTTA 4)
    // =========================================================================
    update(dt) {
      const subSteps = 6;
      const subDt = Math.min(dt, 0.04) / subSteps;

      for (let s = 0; s < subSteps; s++) {
        this._rk4Step(subDt);
      }

      // Record peak telemetry
      if (Math.abs(this.x1) > this.maxRecordedX1) this.maxRecordedX1 = Math.abs(this.x1);
      if (Math.abs(this.x2 - this.x1) > this.maxRecordedX2) this.maxRecordedX2 = Math.abs(this.x2 - this.x1);

      // Save wave history
      this.histX1[this.histIdx] = this.x1;
      this.histX2[this.histIdx] = this.x2;
      this.histIdx = (this.histIdx + 1) % this.historyLen;

      // Update wind particles
      for (const p of this.windParticles) {
        const gustBonus = (this.excitationMode === 'typhoon' ? 1.6 : 1.0);
        p.x += p.speed * subDt * 0.35 * gustBonus;
        if (p.x > 1.05) {
          p.x = -0.05;
          p.y = Math.random() * 0.75;
        }
      }

      this._updateUIBadges();
    }

    _rk4Step(dt) {
      this.extPhase += this.omegaExt * dt;

      // Compute External Modal Forcing F(t) / M1
      let fExt = 0.0;
      if (this.excitationMode === 'wind-resonant') {
        fExt = this.forceAmp * 0.28 * Math.cos(this.extPhase);
      } else if (this.excitationMode === 'typhoon') {
        // Multi-frequency wind gust spectrum simulating Typhoon Soudelor (2015)
        this.gustTimer += dt;
        const turbulentFluc = Math.sin(this.extPhase) * 0.7 + Math.sin(this.extPhase * 2.3) * 0.35 + Math.cos(this.gustTimer * 0.6) * 0.25;
        fExt = this.forceAmp * 0.32 * (1.1 + turbulentFluc);
      } else if (this.excitationMode === 'earthquake') {
        // Ground acceleration shaking
        fExt = this.forceAmp * 0.36 * Math.sin(this.extPhase);
        this.quakeGroundX = 14 * Math.sin(this.extPhase);
      } else if (this.excitationMode === 'free-impulse') {
        fExt = 0.0;
        this.quakeGroundX = 0.0;
      }

      // Coupled 2-DOF Equations:
      // Primary: x1'' + 2*zeta1*w1*x1' + w1^2*x1 - [2*zeta2*w2*mu*(x2' - x1') + mu*w2^2*(x2 - x1)] = fExt
      // Secondary: x2'' + 2*zeta2*w2*(x2' - x1') + w2^2*(x2 - x1) = 0
      const getDerivs = (x1, v1, x2, v2) => {
        const w1 = this.omega1;
        const w2 = this.omega2;
        const mu = this.massRatio;
        const z1 = this.zeta1;
        const z2 = this.zeta2;

        let a1, a2;
        if (this.tmdActive) {
          const relDisp = x2 - x1;
          const relVel = v2 - v1;
          // Damper and spring coupling force per unit primary mass
          const coupling = 2 * z2 * w2 * mu * relVel + mu * (w2 * w2) * relDisp;
          a1 = fExt - 2 * z1 * w1 * v1 - (w1 * w1) * x1 + coupling;
          a2 = -2 * z2 * w2 * relVel - (w2 * w2) * relDisp;
        } else {
          // TMD is locked to the structure: effective combined single DOF
          // (1 + mu) * x1'' + (c1)*x1' + k1*x1 = fExt
          a1 = (fExt - 2 * z1 * w1 * v1 - (w1 * w1) * x1) / (1 + mu);
          a2 = a1;
        }

        return [v1, a1, v2, a2];
      };

      // RK4 step
      const [v1_k1, a1_k1, v2_k1, a2_k1] = getDerivs(this.x1, this.v1, this.x2, this.v2);

      const [v1_k2, a1_k2, v2_k2, a2_k2] = getDerivs(
        this.x1 + 0.5 * dt * v1_k1,
        this.v1 + 0.5 * dt * a1_k1,
        this.x2 + 0.5 * dt * v2_k1,
        this.v2 + 0.5 * dt * a2_k1
      );

      const [v1_k3, a1_k3, v2_k3, a2_k3] = getDerivs(
        this.x1 + 0.5 * dt * v1_k2,
        this.v1 + 0.5 * dt * a1_k2,
        this.x2 + 0.5 * dt * v2_k2,
        this.v2 + 0.5 * dt * a2_k2
      );

      const [v1_k4, a1_k4, v2_k4, a2_k4] = getDerivs(
        this.x1 + dt * v1_k3,
        this.v1 + dt * a1_k3,
        this.x2 + dt * v2_k3,
        this.v2 + dt * a2_k3
      );

      this.x1 += (dt / 6) * (v1_k1 + 2 * v1_k2 + 2 * v1_k3 + v1_k4);
      this.v1 += (dt / 6) * (a1_k1 + 2 * a1_k2 + 2 * a1_k3 + a1_k4);

      if (this.tmdActive) {
        this.x2 += (dt / 6) * (v2_k1 + 2 * v2_k2 + 2 * v2_k3 + v2_k4);
        this.v2 += (dt / 6) * (a2_k1 + 2 * a2_k2 + 2 * a2_k3 + a2_k4);
        // Instantaneous power dissipated in dampers = c2 * (v2 - v1)^2
        const relV = this.v2 - this.v1;
        this.dissipatedPower = (2 * this.zeta2 * this.omega2 * (this.massRatio * 26000000)) * (relV * relV) / 1000; // kW
      } else {
        this.x2 = this.x1;
        this.v2 = this.v1;
        this.dissipatedPower = 0.0;
      }
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
        const x1Cm = (Math.abs(this.x1) * 100).toFixed(0);
        dispBadge.textContent = `Vârf Turn: ±${x1Cm} cm`;
        dispBadge.className = x1Cm > 55 ? 'sim-badge sim-badge--danger' : (x1Cm > 25 ? 'sim-badge sim-badge--amber' : 'sim-badge sim-badge--cyan');
      }

      if (tmdBadge) {
        const xTmdRel = (Math.abs(this.x2 - this.x1) * 100).toFixed(0);
        tmdBadge.textContent = `Cursă Bilă: ${xTmdRel} cm`;
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

      // Deep atmospheric twilight gradient background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#060a14');
      skyGrad.addColorStop(0.55, '#0b162a');
      skyGrad.addColorStop(1, '#070d18');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Top Status Banner (4% of height)
      const bannerH = H < 360 ? 22 : 28;
      this._drawStatusBanner(ctx, W, bannerH);

      // Layout split:
      // Upper 62% = Taipei 101 Tower & Giant Pendulum Cutaway
      // Lower 38% = Frequency Response FRF (Left) & Telemetry / Waveform (Right)
      const topY = bannerH;
      const topH = (H - bannerH) * 0.62;
      const botY = topY + topH;
      const botH = H - botY;

      this._drawTowerAndPendulum(ctx, 0, topY, W, topH);
      this._drawLowerDashboard(ctx, 0, botY, W, botH);
    }

    _drawStatusBanner(ctx, W, h) {
      const isNarrow = W < 580;
      const optF = (1 / (1 + this.massRatio)).toFixed(3);
      const optZ = (Math.sqrt((3 * this.massRatio) / (8 * (1 + this.massRatio))) * 100).toFixed(1);

      ctx.fillStyle = this.tmdActive ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 23, 68, 0.22)';
      ctx.fillRect(0, 0, W, h);
      ctx.strokeStyle = this.tmdActive ? '#00e5ff44' : '#ff174466';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(W, h);
      ctx.stroke();

      ctx.font = `bold ${isNarrow ? 9 : 11}px Inter, sans-serif`;
      ctx.fillStyle = this.tmdActive ? '#00e5ff' : '#ff5252';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let msg = '';
      if (!this.tmdActive) {
        msg = isNarrow
          ? '⚠️ TMD BLOCAT: Turnul oscilează liber fără absorbant inerțial (Q ≈ 45, rezonanță violentă)!'
          : '⚠️ TMD BLOCAT: Fără amortizor inerțial acordat, turnul intră în rezonanță violentă (Q ≈ 45, risc structural masiv)!';
      } else {
        msg = isNarrow
          ? `🛡️ TMD ACTIV (Taipei 101): f_opt=${optF}, ζ_opt=${optZ}% — Oscilațiile sunt reduse cu 75%! Drag pe bilă pentru test!`
          : `🛡️ AMORTIZOR ACORDAT OPTIM (DEN HARTOG): f_opt = ${optF}, ζ_opt = ${optZ}% — Energia cinetică este absorbită și disipată în căldură! (Trage de bilă)`;
      }

      ctx.fillText(msg, W / 2, h / 2);
    }

    // =========================================================================
    // UPPER PANEL: TAIPEI 101 TOWER & CUTAWAY PENDULUM CHAMBER
    // =========================================================================
    _drawTowerAndPendulum(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();

      const isNarrow = gw < 560;

      // Draw flowing wind streamlines across sky
      this._drawWindStreamlines(ctx, gx, gy, gw, gh);

      // Ground tarmac baseline
      const groundY = gy + gh - 10;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(gx, groundY, gw, 10);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx + gw, groundY);
      ctx.stroke();

      // Horizontal layout:
      // Left side (38% of width): Whole Taipei 101 skyscraper silhouette swaying
      // Right side (62% of width): Zoomed-in cutaway of the 87th–92nd floor sphere chamber
      const towerAreaW = isNarrow ? gw * 0.34 : gw * 0.36;
      const chamberAreaX = gx + towerAreaW;
      const chamberAreaW = gw - towerAreaW;

      this._drawWholeSkyscraper(ctx, gx, gy, towerAreaW, gh, groundY);
      this._drawCutawaySphereChamber(ctx, chamberAreaX, gy, chamberAreaW, gh);

      ctx.restore();
    }

    _drawWindStreamlines(ctx, gx, gy, gw, gh) {
      ctx.save();
      const windSpeedMult = this.excitationMode === 'typhoon' ? 2.0 : 1.0;
      ctx.strokeStyle = this.excitationMode === 'typhoon' ? 'rgba(255, 171, 64, 0.22)' : 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1.2;

      for (const p of this.windParticles) {
        const px = gx + p.x * gw;
        const py = gy + p.y * gh;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.len * windSpeedMult, py);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawWholeSkyscraper(ctx, gx, gy, gw, gh, groundY) {
      ctx.save();

      // Tower base coordinate
      const baseX = gx + gw * 0.52 + (this.excitationMode === 'earthquake' ? this.quakeGroundX * 0.25 : 0);
      const towerHeight = gh * 0.88;
      const topY = groundY - towerHeight;

      // Cantilever bending deflection: tip moves by this.x1 (scaled to pixels)
      // Visual scale: 1 meter top sway ~ 38 pixels on full tower view
      const tipDeflectPx = this.x1 * 38;

      // Draw background ambient city silhouette
      ctx.fillStyle = '#08101e';
      ctx.fillRect(gx + 6, groundY - 22, 28, 22);
      ctx.fillRect(gx + 38, groundY - 34, 32, 34);
      ctx.fillRect(gx + gw - 42, groundY - 28, 36, 28);

      // Taipei 101 distinctive silhouette:
      // Base podium + 8 inverted trapezoid pagoda segments + crown + spire
      const numSegments = 8;
      const segH = (towerHeight * 0.68) / numSegments;
      const basePodiumH = towerHeight * 0.14;
      const crownH = towerHeight * 0.18;

      ctx.lineWidth = 1.2;

      // Draw cantilever segmented tower
      for (let s = 0; s < numSegments; s++) {
        const segBottomNorm = (basePodiumH + s * segH) / towerHeight;
        const segTopNorm = (basePodiumH + (s + 1) * segH) / towerHeight;

        // Quadratic bending profile: y(h) = (h/H)^2
        const deflBot = tipDeflectPx * Math.pow(segBottomNorm, 2);
        const deflTop = tipDeflectPx * Math.pow(segTopNorm, 2);

        const yBot = groundY - (basePodiumH + s * segH);
        const yTop = groundY - (basePodiumH + (s + 1) * segH);

        // Pagoda inverted flared trapezoid shape
        const wBot = Math.max(14, gw * 0.18 - s * 1.0);
        const wTop = wBot + 6;

        ctx.beginPath();
        ctx.moveTo(baseX + deflBot - wBot / 2, yBot);
        ctx.lineTo(baseX + deflBot + wBot / 2, yBot);
        ctx.lineTo(baseX + deflTop + wTop / 2, yTop);
        ctx.lineTo(baseX + deflTop - wTop / 2, yTop);
        ctx.closePath();

        // Highlighting segment 8 (levels 87-92 where the TMD is housed)
        if (s === 6 || s === 7) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.strokeStyle = '#fbbf24';
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = '#38bdf866';
        }
        ctx.fill();
        ctx.stroke();

        // Horizontal architectural accents
        ctx.strokeStyle = '#38bdf833';
        ctx.beginPath();
        ctx.moveTo(baseX + deflTop - wTop / 2, yTop + segH * 0.5);
        ctx.lineTo(baseX + deflTop + wTop / 2, yTop + segH * 0.5);
        ctx.stroke();
      }

      // Base Podium
      ctx.beginPath();
      ctx.moveTo(baseX - gw * 0.14, groundY);
      ctx.lineTo(baseX + gw * 0.14, groundY);
      ctx.lineTo(baseX + gw * 0.10, groundY - basePodiumH);
      ctx.lineTo(baseX - gw * 0.10, groundY - basePodiumH);
      ctx.closePath();
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#38bdf888';
      ctx.fill();
      ctx.stroke();

      // Top Crown & Spire Antenna
      const deflTop = tipDeflectPx;
      const spireTopY = topY - crownH;
      ctx.beginPath();
      ctx.moveTo(baseX + deflTop - 7, topY);
      ctx.lineTo(baseX + deflTop + 7, topY);
      ctx.lineTo(baseX + deflTop + 2, topY - crownH * 0.4);
      ctx.lineTo(baseX + deflTop - 2, topY - crownH * 0.4);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      // Needle spire antenna with red beacon light
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(baseX + deflTop, topY - crownH * 0.4);
      ctx.lineTo(baseX + deflTop, spireTopY);
      ctx.stroke();

      // Red flashing beacon
      ctx.fillStyle = (Math.sin(this.extPhase * 3) > 0) ? '#ff1744' : '#ff8a80';
      ctx.beginPath();
      ctx.arc(baseX + deflTop, spireTopY, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      // Micro golden sphere visible in 87th-92nd floor of silhouette
      const tmdFloorY = groundY - (basePodiumH + 6.5 * segH);
      const deflTmd = tipDeflectPx * Math.pow(6.5 / 8, 2);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(baseX + deflTmd + (this.x2 - this.x1) * 16, tmdFloorY, 3.5, 0, 2 * Math.PI);
      ctx.fill();

      // Label below tower
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('TAIPEI 101 (508 m)', baseX, groundY - 6);

      ctx.restore();
    }

    _drawCutawaySphereChamber(ctx, cx, cy, cw, ch) {
      ctx.save();

      // Frame background of the cutaway chamber
      const margin = 10;
      const innerX = cx + margin;
      const innerY = cy + margin;
      const innerW = cw - margin * 2;
      const innerH = ch - margin * 2;

      ctx.fillStyle = 'rgba(10, 18, 36, 0.92)';
      ctx.strokeStyle = '#38bdf844';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(innerX, innerY, innerW, innerH, 8);
      } else {
        ctx.rect(innerX, innerY, innerW, innerH);
      }
      ctx.fill();
      ctx.stroke();

      // Title header of chamber cutaway
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('CAMERA PENDULULUI (ETAJELE 87 - 92)', innerX + 12, innerY + 16);

      ctx.font = '8.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('8 cabluri de oțel (42 mm) + 8 amortizoare hidraulice radiale', innerX + 12, innerY + 28);

      // Coordinates within cutaway chamber:
      // The chamber structure itself sways with the skyscraper tip deflection x1!
      // In local pixels:
      const chamberMidX = innerX + innerW * 0.50;
      const chamberCeilY = innerY + 40;
      const chamberFloorY = innerY + innerH - 24;

      // Building top sway shifts the chamber cradle:
      const bShiftPx = this.x1 * 32;
      // Pendulum sphere sway (absolute displacement x2)
      const pShiftPx = this.x2 * 32;

      const sphereCenterY = chamberCeilY + (chamberFloorY - chamberCeilY) * 0.58;
      const sphereCenterX = chamberMidX + pShiftPx;
      const sphereRadius = Math.max(16, Math.min(32, innerW * 0.085));

      // Store screen position for mouse/touch hit testing
      this.sphereScreenPos = {
        x: sphereCenterX,
        y: sphereCenterY,
        r: sphereRadius
      };

      // Draw Chamber Upper Ring Anchor Points (8 steel cable suspension points)
      const anchorW = innerW * 0.42;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(chamberMidX + bShiftPx - anchorW / 2, chamberCeilY);
      ctx.lineTo(chamberMidX + bShiftPx + anchorW / 2, chamberCeilY);
      ctx.stroke();

      // Draw 8 Steel Suspension Cables from ceiling anchor to sphere top
      const numCables = 6;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.75)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < numCables; i++) {
        const u = (i / (numCables - 1)) - 0.5;
        const anchorX = chamberMidX + bShiftPx + u * anchorW;
        const ballAttachX = sphereCenterX + u * (sphereRadius * 0.7);
        ctx.beginPath();
        ctx.moveTo(anchorX, chamberCeilY);
        ctx.lineTo(ballAttachX, sphereCenterY - sphereRadius * 0.85);
        ctx.stroke();
      }

      // Draw Chamber Floor & Circular Tourist Observation Balcony
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(innerX + 8, chamberFloorY, innerW - 16, innerH - (chamberFloorY - innerY) - 4);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(innerX + 8, chamberFloorY);
      ctx.lineTo(innerX + innerW - 8, chamberFloorY);
      ctx.stroke();

      // Tourist Balcony Guardrail
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.beginPath();
      ctx.moveTo(innerX + 16, chamberFloorY - 14);
      ctx.lineTo(innerX + innerW - 16, chamberFloorY - 14);
      ctx.stroke();

      // Draw 8 Hydraulic Viscous Dampers connected between sphere bottom and cradle
      // Left damper and Right damper
      const cradleLeftX = chamberMidX + bShiftPx - innerW * 0.34;
      const cradleRightX = chamberMidX + bShiftPx + innerW * 0.34;
      const damperBaseY = chamberFloorY - 4;

      this._drawHydraulicPiston(ctx, cradleLeftX, damperBaseY, sphereCenterX - sphereRadius * 0.5, sphereCenterY + sphereRadius * 0.7, '#38bdf8');
      this._drawHydraulicPiston(ctx, cradleRightX, damperBaseY, sphereCenterX + sphereRadius * 0.5, sphereCenterY + sphereRadius * 0.7, '#38bdf8');

      // Draw Giant Golden 660-Tonne Sphere
      this._drawGoldenSphere(ctx, sphereCenterX, sphereCenterY, sphereRadius);

      // Deflection relative text badge on sphere
      const relCm = ((this.x2 - this.x1) * 100).toFixed(0);
      ctx.font = 'bold 8.5px Inter, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(`${relCm > 0 ? '+' : ''}${relCm} cm`, sphereCenterX, sphereCenterY + 3);

      // Hydraulic Damping Energy Glow / Sparkles when active
      if (this.tmdActive && Math.abs(this.v2 - this.v1) > 0.08) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(cradleLeftX + (sphereCenterX - cradleLeftX) * 0.5, damperBaseY - 10, 3, 0, 2 * Math.PI);
        ctx.arc(cradleRightX + (sphereCenterX - cradleRightX) * 0.5, damperBaseY - 10, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.restore();
    }

    _drawHydraulicPiston(ctx, x1, y1, x2, y2, color) {
      ctx.save();
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);

      ctx.translate(x1, y1);
      ctx.rotate(ang);

      // Cylinder body (outer barrel)
      const cylLen = len * 0.55;
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, -4.5, cylLen, 9);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(0, -4.5, cylLen, 9);

      // Piston rod (inner sliding chrome bar)
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(cylLen - 2, -2.5, len - cylLen + 2, 5);

      // Pin attachments
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, 2 * Math.PI);
      ctx.arc(len, 0, 3.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.restore();
    }

    _drawGoldenSphere(ctx, cx, cy, r) {
      ctx.save();

      // Shadow behind ball
      ctx.beginPath();
      ctx.arc(cx + 4, cy + 4, r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Radial metallic golden gradient
      const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.35, '#facc15');
      grad.addColorStop(0.75, '#ca8a04');
      grad.addColorStop(1, '#854d0e');

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#fef08a88';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Authentic Taipei 101 sphere circular layered plate rings (41 circular steel plates)
      ctx.strokeStyle = 'rgba(113, 63, 18, 0.45)';
      ctx.lineWidth = 0.8;
      const numPlates = 7;
      for (let p = 1; p < numPlates; p++) {
        const py = cy - r + (p / numPlates) * (2 * r);
        const wHalf = Math.sqrt(Math.max(0, r * r - (py - cy) * (py - cy)));
        ctx.beginPath();
        ctx.moveTo(cx - wHalf, py);
        ctx.lineTo(cx + wHalf, py);
        ctx.stroke();
      }

      // Specular highlight glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.36, cy - r * 0.36, r * 0.22, 0, 2 * Math.PI);
      ctx.fill();

      ctx.restore();
    }

    // =========================================================================
    // LOWER PANEL: FRF BODE PLOT & LIVE ENERGY TELEMETRY
    // =========================================================================
    _drawLowerDashboard(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();

      const isNarrow = gw < 580;
      const splitW = isNarrow ? gw : gw * 0.55;

      // Sub-Panel 1: Dynamic Amplification FRF Curve (Left)
      this._drawFRFBodePlot(ctx, gx + 8, gy + 4, splitW - 14, gh - 8);

      // Sub-Panel 2: Real-time Waveforms & Den Hartog Telemetry (Right)
      if (!isNarrow) {
        this._drawTelemetryAndWaveforms(ctx, gx + splitW + 4, gy + 4, gw - splitW - 12, gh - 8);
      }

      ctx.restore();
    }

    _drawFRFBodePlot(ctx, x, y, w, h) {
      ctx.save();

      // Box container
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

      // Title & Legend
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('RĂSPUNS ÎN FRECVENȚĂ |H(ω)| (AMPLIFICARE DINAMICĂ)', x + 8, y + 14);

      // Legend items
      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#ff5252';
      ctx.fillText('■ Fără TMD (Q ≈ 42)', x + 8, y + 26);
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('■ Cu TMD Den Hartog (Atenuat)', x + 105, y + 26);

      // Plotting area
      const plotX = x + 34;
      const plotY = y + 34;
      const plotW = w - 44;
      const plotH = h - 50;

      if (plotW < 20 || plotH < 20) {
        ctx.restore();
        return;
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i <= 4; i++) {
        const gyLine = plotY + (i / 4) * plotH;
        ctx.beginPath();
        ctx.moveTo(plotX, gyLine);
        ctx.lineTo(plotX + plotW, gyLine);
        ctx.stroke();
      }

      // Axis labels
      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText('40', plotX - 4, plotY + 6);
      ctx.fillText('20', plotX - 4, plotY + plotH * 0.5);
      ctx.fillText('0', plotX - 4, plotY + plotH);

      // Frequency domain: r in [0.5, 1.5]
      const rMin = 0.5;
      const rMax = 1.5;
      const maxHVal = 44.0;

      // Helper: compute steady-state 2-DOF magnification |H(r)|
      const calcH = (r, mu, f, z1, z2) => {
        // Den Hartog 2-DOF analytical formula:
        // H(r) = sqrt( (f^2 - r^2)^2 + (2*z2*f*r)^2 ) / sqrt( delta_real^2 + delta_imag^2 )
        const num = Math.hypot((f * f - r * r), 2 * z2 * f * r);
        const term1 = (1 - r * r) * (f * f - r * r) - mu * f * f * r * r - 4 * z1 * z2 * f * r * r;
        const term2 = 2 * z2 * f * r * (1 - r * r - mu * r * r) + 2 * z1 * r * (f * f - r * r);
        const denom = Math.hypot(term1, term2);
        return num / Math.max(0.001, denom);
      };

      // 1. Draw Red Dashed Curve: Fără TMD (Single 1-DOF peak)
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      const steps = 80;
      for (let s = 0; s <= steps; s++) {
        const r = rMin + (s / steps) * (rMax - rMin);
        // Single DOF: 1 / sqrt( (1 - r^2)^2 + (2*zeta1*r)^2 )
        const hVal = 1 / Math.hypot(1 - r * r, 2 * this.zeta1 * r);
        const px = plotX + ((r - rMin) / (rMax - rMin)) * plotW;
        const py = plotY + plotH - (Math.min(hVal, maxHVal) / maxHVal) * plotH;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Draw Cyan Curve: Cu TMD Den Hartog (Twin flattened side peaks)
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const r = rMin + (s / steps) * (rMax - rMin);
        const fOpt = 1 / (1 + this.massRatio);
        const zOpt = Math.sqrt((3 * this.massRatio) / (8 * (1 + this.massRatio)));
        const hVal = calcH(r, this.massRatio, fOpt, this.zeta1, zOpt);
        const px = plotX + ((r - rMin) / (rMax - rMin)) * plotW;
        const py = plotY + plotH - (Math.min(hVal, maxHVal) / maxHVal) * plotH;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 3. Current Operating Excitation Point Dot
      const currentR = this.freqRatio;
      const currentH = this.tmdActive
        ? calcH(currentR, this.massRatio, this.tuningRatio, this.zeta1, this.zeta2)
        : (1 / Math.hypot(1 - currentR * currentR, 2 * this.zeta1 * currentR));

      const dotX = plotX + ((currentR - rMin) / (rMax - rMin)) * plotW;
      const dotY = plotY + plotH - (Math.min(currentH, maxHVal) / maxHVal) * plotH;

      ctx.fillStyle = this.tmdActive ? '#00e5ff' : '#ff1744';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Operating ratio text on bottom axis
      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('0.5 ω₁', plotX, plotY + plotH + 11);
      ctx.fillText('1.0 ω₁ (Rezonanță)', plotX + plotW * 0.5, plotY + plotH + 11);
      ctx.fillText('1.5 ω₁', plotX + plotW, plotY + plotH + 11);

      ctx.restore();
    }

    _drawTelemetryAndWaveforms(ctx, x, y, w, h) {
      ctx.save();

      // Container
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
      ctx.fillText('TELEMETRIE DINAMICĂ & DISIPARE', x + 10, y + 14);

      // Digital Meters Table
      const x1Cm = (Math.abs(this.x1) * 100).toFixed(1);
      const relCm = (Math.abs(this.x2 - this.x1) * 100).toFixed(1);
      const optF = (1 / (1 + this.massRatio)).toFixed(3);
      const powerKw = this.dissipatedPower.toFixed(0);

      const rows = [
        { label: 'Deplasare Vârf Clădire (x₁):', val: `±${x1Cm} cm`, color: this.x1 > 0.45 ? '#ff5252' : '#38bdf8' },
        { label: 'Cursă Pendul 660 t (x₂ - x₁):', val: `±${relCm} cm`, color: '#fbbf24' },
        { label: 'Putere Disipată în Pistoane:', val: `${powerKw} kW`, color: '#34d399' },
        { label: 'Acordare Optimă Den Hartog (f_opt):', val: `${optF}`, color: '#a78bfa' }
      ];

      let rowY = y + 28;
      ctx.font = '8.5px Inter, sans-serif';
      for (const r of rows) {
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText(r.label, x + 10, rowY);
        ctx.fillStyle = r.color;
        ctx.textAlign = 'right';
        ctx.fillText(r.val, x + w - 10, rowY);
        rowY += 13;
      }

      // Mini-oscilloscope waveform of x1(t) vs x2(t) at bottom
      const waveX = x + 10;
      const waveY = rowY + 4;
      const waveW = w - 20;
      const waveH = (y + h) - waveY - 8;

      if (waveW > 20 && waveH > 16) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(waveX, waveY, waveW, waveH);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(waveX, waveY + waveH * 0.5);
        ctx.lineTo(waveX + waveW, waveY + waveH * 0.5);
        ctx.stroke();

        // Draw x1 wave (Cyan)
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < this.historyLen; i++) {
          const idx = (this.histIdx + i) % this.historyLen;
          const px = waveX + (i / this.historyLen) * waveW;
          const py = waveY + waveH * 0.5 - (this.histX1[idx] / 1.2) * (waveH * 0.45);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Draw x2 wave (Golden yellow)
        if (this.tmdActive) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          for (let i = 0; i < this.historyLen; i++) {
            const idx = (this.histIdx + i) % this.historyLen;
            const px = waveX + (i / this.historyLen) * waveW;
            const py = waveY + waveH * 0.5 - (this.histX2[idx] / 1.2) * (waveH * 0.45);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  window.TunedMassDamperSim = TunedMassDamperSim;
})();
