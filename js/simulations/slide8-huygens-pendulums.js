/* ============================================================
   SLIDE 8: HUYGENS' PENDULUM SYNCHRONIZATION (1665)
   "Sympathie des horloges" — 3-DOF Coupled Oscillators on Shared Beam
   1. Two pendulum clocks with anchor escapement (self-sustained limit cycle)
   2. Shared movable wooden beam (mass M, spring Kb, damper Cb)
   3. Anti-phase synchronization (Δφ -> 180°) via beam energy dissipation
   4. Interactive mouse/touch bob dragging, Lissajous portrait (θ1 vs θ2) & waveforms
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  class HuygensPendulumsSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Physical & Coupling Parameters ---
      this.omega0 = 4.2; // Natural angular frequency of pendulums (rad/s)
      this.thetaTarget = 0.42; // Limit-cycle amplitude maintained by escapement (~24 deg)
      this.escapementGain = 0.85; // Van der Pol self-sustaining escapement strength

      // User-adjustable parameters
      this.couplingMu = (config && config.couplingMu !== undefined) ? config.couplingMu : 0.12; // m / M ratio
      this.beamDamping = (config && config.beamDamping !== undefined) ? config.beamDamping : 0.55; // Support damping Cb
      this.detuningPct = (config && config.detuningPct !== undefined) ? config.detuningPct : 0.3; // Frequency mismatch %
      this.beamLocked = false; // If true, support beam is rigidly clamped (X = 0, no coupling)

      // --- 3-DOF State Variables ---
      // Pendulum 1 (Left, Cyan): angle theta1 (rad), angular velocity w1 (rad/s)
      this.theta1 = 0.42;
      this.w1 = 0.0;

      // Pendulum 2 (Right, Amber): angle theta2 (rad), angular velocity w2 (rad/s)
      // Start at ~65 deg phase difference so user sees synchronization evolve smoothly
      this.theta2 = 0.18;
      this.w2 = 0.38 * this.omega0;

      // Shared Beam horizontal displacement X (normalized units) and velocity V
      this.beamX = 0.0;
      this.beamV = 0.0;
      this.beamAcc = 0.0;

      // Instantaneous horizontal pivot forces on beam
      this.force1 = 0.0;
      this.force2 = 0.0;

      // Escapement tick visual flashes
      this.tickFlash1 = 0.0;
      this.tickFlash2 = 0.0;
      this.clockTicks1 = 0;
      this.clockTicks2 = 0;

      // Phase difference tracking (0° to 180°)
      this.phaseDiffDeg = 65.0;
      this.signedPhaseRad = 1.13;

      // Waveform & Lissajous history buffers
      this.histLen = 200;
      this.histTheta1 = new Float32Array(this.histLen);
      this.histTheta2 = new Float32Array(this.histLen);
      this.histBeamX = new Float32Array(this.histLen);
      this.histIdx = 0;
      this.histCount = 0;

      // Interactive Mouse / Touch Dragging of Pendulum Bobs
      this.draggingBob = 0; // 0 = none, 1 = pendulum 1, 2 = pendulum 2
      this.pivot1Screen = { x: 0, y: 0, L: 100 };
      this.pivot2Screen = { x: 0, y: 0, L: 100 };
      this.bob1Screen = { x: 0, y: 0, r: 18 };
      this.bob2Screen = { x: 0, y: 0, r: 18 };

      this._bindInteractionEvents();
    }

    // =========================================================================
    // PARAMETER SETTERS & SCENARIO PRESETS
    // =========================================================================
    setCouplingMu(mu) {
      this.couplingMu = Math.max(0.01, Math.min(0.30, mu));
      const slider = document.getElementById('sim8-coupling');
      const valEl = document.getElementById('sim8-coupling-val');
      if (slider) slider.value = this.couplingMu.toFixed(2);
      if (valEl) valEl.textContent = `μ = ${this.couplingMu.toFixed(2)}`;
      this._updateUIBadges();
      this.requestRender();
    }

    setBeamDamping(c) {
      this.beamDamping = Math.max(0.02, Math.min(1.80, c));
      const slider = document.getElementById('sim8-damping');
      const valEl = document.getElementById('sim8-damping-val');
      if (slider) slider.value = this.beamDamping.toFixed(2);
      if (valEl) valEl.textContent = `c_b = ${this.beamDamping.toFixed(2)}`;
      this._updateUIBadges();
      this.requestRender();
    }

    setDetuningPct(pct) {
      this.detuningPct = Math.max(0.0, Math.min(6.0, pct));
      const slider = document.getElementById('sim8-detuning');
      const valEl = document.getElementById('sim8-detuning-val');
      if (slider) slider.value = this.detuningPct.toFixed(1);
      if (valEl) valEl.textContent = `Δf = ${this.detuningPct.toFixed(1)}%`;
      this._updateUIBadges();
      this.requestRender();
    }

    setBeamLocked(locked) {
      this.beamLocked = !!locked;
      if (this.beamLocked) {
        this.beamX = 0.0;
        this.beamV = 0.0;
        this.beamAcc = 0.0;
      }
      const btn = document.getElementById('sim8-btn-lock-beam');
      if (btn) {
        btn.textContent = this.beamLocked
          ? '🔒 Grindă Fixă (Fără Cuplaj)'
          : '🔓 Grindă Mobilă pe Role (Cuplaj Activ)';
        btn.className = this.beamLocked ? 'sim-btn sim-btn--danger' : 'sim-btn sim-btn--preset';
      }
      this._updateUIBadges();
      this.requestRender();
    }

    applyPreset(mode) {
      const modes = ['random', 'inphase', 'antiphase'];
      modes.forEach((m) => {
        const b = document.getElementById(`sim8-preset-${m}`);
        if (b) {
          if (m === mode) b.classList.add('sim-btn--preset');
          else b.classList.remove('sim-btn--preset');
        }
      });

      this.setBeamLocked(false);
      this.beamX = 0.0;
      this.beamV = 0.0;

      if (mode === 'random') {
        // TRULY RANDOM initial phases:
        // Uniformly distributed, so ~50% of the time it falls into the in-phase basin (|Δφ| < 90°)
        // and ~50% of the time into the anti-phase basin (|Δφ| > 90°), as in real pendulums!
        const phi1 = Math.random() * 2 * Math.PI;
        const phi2 = Math.random() * 2 * Math.PI;
        this.theta1 = this.thetaTarget * Math.cos(phi1);
        this.w1 = -this.thetaTarget * this.omega0 * Math.sin(phi1);
        this.theta2 = this.thetaTarget * Math.cos(phi2);
        this.w2 = -this.thetaTarget * this.omega0 * Math.sin(phi2);
      } else if (mode === 'inphase') {
        // Start in the basin of attraction of in-phase (e.g. within 20 deg of 0°)
        const phi1 = Math.random() * 2 * Math.PI;
        const phi2 = phi1 + (Math.random() - 0.5) * 0.5;
        this.theta1 = this.thetaTarget * Math.cos(phi1);
        this.w1 = -this.thetaTarget * this.omega0 * Math.sin(phi1);
        this.theta2 = this.thetaTarget * Math.cos(phi2);
        this.w2 = -this.thetaTarget * this.omega0 * Math.sin(phi2);
      } else if (mode === 'antiphase') {
        // Start in the basin of attraction of anti-phase (e.g. within 20 deg of 180°)
        const phi1 = Math.random() * 2 * Math.PI;
        const phi2 = phi1 + Math.PI + (Math.random() - 0.5) * 0.5;
        this.theta1 = this.thetaTarget * Math.cos(phi1);
        this.w1 = -this.thetaTarget * this.omega0 * Math.sin(phi1);
        this.theta2 = this.thetaTarget * Math.cos(phi2);
        this.w2 = -this.thetaTarget * this.omega0 * Math.sin(phi2);
      }

      this._computePhaseDifference();
      this._updateUIBadges();
      if (!this.running) this.start();
      this.requestRender();
    }

    perturbPendulum2() {
      // Give pendulum 2 a new random phase offset (may flip the system between in-phase and anti-phase)
      const newPhi2 = Math.random() * 2 * Math.PI;
      this.theta2 = this.thetaTarget * Math.cos(newPhi2);
      this.w2 = -this.thetaTarget * this.omega0 * Math.sin(newPhi2);
      this.tickFlash2 = 1.0;
      this._computePhaseDifference();
      this._updateUIBadges();
      if (!this.running) this.start();
      this.requestRender();
    }

    onReset() {
      this.histIdx = 0;
      this.histCount = 0;
      this.histTheta1.fill(0);
      this.histTheta2.fill(0);
      this.histBeamX.fill(0);
      this.clockTicks1 = 0;
      this.clockTicks2 = 0;

      this.setCouplingMu(0.12);
      this.setBeamDamping(0.55);
      this.setDetuningPct(0.3);
      this.applyPreset('random');
    }

    requestRender() {
      if (!this.running) this.render();
    }

    // =========================================================================
    // INTERACTION & UI BINDINGS
    // =========================================================================
    _bindInteractionEvents() {
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

      const onDown = (e) => {
        const pt = getPos(e);
        const d1 = Math.hypot(pt.x - this.bob1Screen.x, pt.y - this.bob1Screen.y);
        const d2 = Math.hypot(pt.x - this.bob2Screen.x, pt.y - this.bob2Screen.y);

        if (d1 <= this.bob1Screen.r + 16) {
          this.draggingBob = 1;
        } else if (d2 <= this.bob2Screen.r + 16) {
          this.draggingBob = 2;
        }
      };

      const onMove = (e) => {
        if (!this.draggingBob) return;
        const pt = getPos(e);
        if (this.draggingBob === 1) {
          const dx = pt.x - this.pivot1Screen.x;
          const dy = Math.max(15, pt.y - this.pivot1Screen.y);
          this.theta1 = Math.max(-0.75, Math.min(0.75, Math.atan2(dx, dy)));
          this.w1 = 0;
        } else if (this.draggingBob === 2) {
          const dx = pt.x - this.pivot2Screen.x;
          const dy = Math.max(15, pt.y - this.pivot2Screen.y);
          this.theta2 = Math.max(-0.75, Math.min(0.75, Math.atan2(dx, dy)));
          this.w2 = 0;
        }
        this._computePhaseDifference();
        this._updateUIBadges();
        this.requestRender();
      };

      const onUp = () => {
        this.draggingBob = 0;
      };

      this.canvas.addEventListener('mousedown', onDown);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener('touchstart', onDown, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp);
    }

    onInit() {
      const couplingSlider = document.getElementById('sim8-coupling');
      const dampingSlider = document.getElementById('sim8-damping');
      const detuningSlider = document.getElementById('sim8-detuning');

      const btnRandom = document.getElementById('sim8-preset-random');
      const btnInPhase = document.getElementById('sim8-preset-inphase');
      const btnAntiPhase = document.getElementById('sim8-preset-antiphase');
      const btnPerturb = document.getElementById('sim8-btn-perturb');
      const btnLockBeam = document.getElementById('sim8-btn-lock-beam');

      const playBtn = document.getElementById('sim8-play');
      const resetBtn = document.getElementById('sim8-reset');

      if (couplingSlider) {
        couplingSlider.value = this.couplingMu.toFixed(2);
        couplingSlider.addEventListener('input', (e) => this.setCouplingMu(parseFloat(e.target.value)));
      }

      if (dampingSlider) {
        dampingSlider.value = this.beamDamping.toFixed(2);
        dampingSlider.addEventListener('input', (e) => this.setBeamDamping(parseFloat(e.target.value)));
      }

      if (detuningSlider) {
        detuningSlider.value = this.detuningPct.toFixed(1);
        detuningSlider.addEventListener('input', (e) => this.setDetuningPct(parseFloat(e.target.value)));
      }

      if (btnRandom) btnRandom.addEventListener('click', () => this.applyPreset('random'));
      if (btnInPhase) btnInPhase.addEventListener('click', () => this.applyPreset('inphase'));
      if (btnAntiPhase) btnAntiPhase.addEventListener('click', () => this.applyPreset('antiphase'));
      if (btnPerturb) btnPerturb.addEventListener('click', () => this.perturbPendulum2());
      if (btnLockBeam) btnLockBeam.addEventListener('click', () => this.setBeamLocked(!this.beamLocked));

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

      this._computePhaseDifference();
      this._updateUIBadges();
    }

    // =========================================================================
    // 3-DOF COUPLED PENDULUMS + BEAM PHYSICS ENGINE (RK4)
    // =========================================================================
    update(dt) {
      const safeDt = Math.min(Math.max(0, dt), 0.035);
      const subSteps = 6;
      const h = safeDt / subSteps;

      const prevTheta1 = this.theta1;
      const prevTheta2 = this.theta2;

      for (let s = 0; s < subSteps; s++) {
        this._rk4Step(h);
      }

      // Detect zero-crossing for clock escapement ticks
      if (prevTheta1 * this.theta1 <= 0 && Math.abs(this.w1) > 0.2) {
        this.tickFlash1 = 1.0;
        this.clockTicks1++;
      }
      if (prevTheta2 * this.theta2 <= 0 && Math.abs(this.w2) > 0.2) {
        this.tickFlash2 = 1.0;
        this.clockTicks2++;
      }

      this.tickFlash1 = Math.max(0, this.tickFlash1 - safeDt * 4.5);
      this.tickFlash2 = Math.max(0, this.tickFlash2 - safeDt * 4.5);

      this._computePhaseDifference();

      // Store waveform history
      this.histTheta1[this.histIdx] = this.theta1;
      this.histTheta2[this.histIdx] = this.theta2;
      this.histBeamX[this.histIdx] = this.beamX;
      this.histIdx = (this.histIdx + 1) % this.histLen;
      if (this.histCount < this.histLen) this.histCount++;

      this._updateUIBadges();
    }

    _rk4Step(dt) {
      const w0_1 = this.omega0 * (1 - 0.005 * this.detuningPct);
      const w0_2 = this.omega0 * (1 + 0.005 * this.detuningPct);
      const wBeam = this.omega0 * 1.15; // Beam support natural frequency
      const mu = this.beamLocked ? 0.0 : this.couplingMu;
      const cb = this.beamDamping * this.omega0;
      const thetaRef = this.thetaTarget;
      const escGain = this.escapementGain;

      // State vector: [theta1, w1, theta2, w2, beamX, beamV]
      const derivs = (th1, w1, th2, w2, x, v) => {
        // Van der Pol escapement torque mantener:
        // Sustains limit cycle at amplitude thetaRef
        const esc1 = escGain * (1 - (th1 * th1) / (thetaRef * thetaRef * 0.25)) * w1;
        const esc2 = escGain * (1 - (th2 * th2) / (thetaRef * thetaRef * 0.25)) * w2;

        // Uncoupled gravity + escapement angular accelerations
        const grav1 = -(w0_1 * w0_1) * Math.sin(th1) + esc1;
        const grav2 = -(w0_2 * w0_2) * Math.sin(th2) + esc2;

        if (this.beamLocked || mu <= 0.0001) {
          return [
            this.draggingBob === 1 ? 0 : w1,
            this.draggingBob === 1 ? 0 : grav1,
            this.draggingBob === 2 ? 0 : w2,
            this.draggingBob === 2 ? 0 : grav2,
            0,
            0
          ];
        }

        const c1 = Math.cos(th1);
        const s1 = Math.sin(th1);
        const c2 = Math.cos(th2);
        const s2 = Math.sin(th2);

        // Coupled 3-DOF matrix inversion:
        // (1 + 2*mu)*x'' + cb*x' + wBeam^2*x + mu*(th1''*c1 - w1^2*s1 + th2''*c2 - w2^2*s2) = 0
        // th_i'' = grav_i - x''*c_i
        // Substituting th_i'' into the beam equation gives:
        // [1 + 2*mu - mu*(c1^2 + c2^2)] * x'' = -cb*v - wBeam^2*x - mu*(grav1*c1 - w1^2*s1 + grav2*c2 - w2^2*s2)
        // Plus dissipative velocity coupling (Huygens beam friction damping out in-phase sum):
        const effMass = Math.max(0.5, 1.0 + 2 * mu - mu * (c1 * c1 + c2 * c2));
        const pForce1 = -(grav1 * c1 - w1 * w1 * s1);
        const pForce2 = -(grav2 * c2 - w2 * w2 * s2);

        const xAcc = (-cb * v - (wBeam * wBeam) * x + mu * (pForce1 + pForce2)) / effMass;

        // Bistable phase synchronization torque between the two pendulums:
        // Real coupled pendulums on a movable support possess co-existing attractors (bistability):
        // 1. In-phase mode (Δφ -> 0°) when starting closer to 0° (|Δφ| < 90°)
        // 2. Anti-phase mode (Δφ -> 180°) when starting closer to 180° (|Δφ| > 90°)
        const phi1 = Math.atan2(-w1 / w0_1, th1);
        const phi2 = Math.atan2(-w2 / w0_2, th2);
        let dPhi = phi1 - phi2;
        while (dPhi > Math.PI) dPhi -= 2 * Math.PI;
        while (dPhi < -Math.PI) dPhi += 2 * Math.PI;

        const syncStrength = mu * 2.8 * (w0_1 * w0_1);
        const bistableSync = syncStrength * Math.sin(2 * dPhi);

        const a1 = this.draggingBob === 1 ? 0 : (grav1 - xAcc * c1 + bistableSync * Math.cos(phi1));
        const a2 = this.draggingBob === 2 ? 0 : (grav2 - xAcc * c2 - bistableSync * Math.cos(phi2));

        return [
          this.draggingBob === 1 ? 0 : w1,
          a1,
          this.draggingBob === 2 ? 0 : w2,
          a2,
          v,
          xAcc
        ];
      };

      const s0 = [this.theta1, this.w1, this.theta2, this.w2, this.beamX, this.beamV];
      const k1 = derivs(s0[0], s0[1], s0[2], s0[3], s0[4], s0[5]);
      const k2 = derivs(
        s0[0] + 0.5 * dt * k1[0], s0[1] + 0.5 * dt * k1[1],
        s0[2] + 0.5 * dt * k1[2], s0[3] + 0.5 * dt * k1[3],
        s0[4] + 0.5 * dt * k1[4], s0[5] + 0.5 * dt * k1[5]
      );
      const k3 = derivs(
        s0[0] + 0.5 * dt * k2[0], s0[1] + 0.5 * dt * k2[1],
        s0[2] + 0.5 * dt * k2[2], s0[3] + 0.5 * dt * k2[3],
        s0[4] + 0.5 * dt * k2[4], s0[5] + 0.5 * dt * k2[5]
      );
      const k4 = derivs(
        s0[0] + dt * k3[0], s0[1] + dt * k3[1],
        s0[2] + dt * k3[2], s0[3] + dt * k3[3],
        s0[4] + dt * k3[4], s0[5] + dt * k3[5]
      );

      if (this.draggingBob !== 1) {
        this.theta1 += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        this.w1 += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      }
      if (this.draggingBob !== 2) {
        this.theta2 += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        this.w2 += (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      }

      if (!this.beamLocked) {
        this.beamX += (dt / 6) * (k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4]);
        this.beamV += (dt / 6) * (k1[5] + 2 * k2[5] + 2 * k3[5] + k4[5]);
        this.beamAcc = k1[5];
      } else {
        this.beamX = 0;
        this.beamV = 0;
        this.beamAcc = 0;
      }

      // Compute horizontal pivot forces for visual force arrows
      this.force1 = Math.sin(this.theta1);
      this.force2 = Math.sin(this.theta2);
    }

    _computePhaseDifference() {
      // Phase of oscillator i in state space (theta, -w / omega0)
      const phi1 = Math.atan2(-this.w1 / this.omega0, this.theta1);
      const phi2 = Math.atan2(-this.w2 / this.omega0, this.theta2);
      let diff = phi1 - phi2;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      this.signedPhaseRad = diff;
      this.phaseDiffDeg = (Math.abs(diff) * 180) / Math.PI;
    }

    _updateUIBadges() {
      const phaseBadge = document.getElementById('sim8-phase-badge');
      const stateBadge = document.getElementById('sim8-state-badge');
      const beamBadge = document.getElementById('sim8-beam-badge');

      const deg = Math.round(this.phaseDiffDeg);

      if (phaseBadge) {
        phaseBadge.textContent = `Defazaj Δφ: ${deg}°`;
      }

      if (stateBadge) {
        if (this.beamLocked) {
          stateBadge.textContent = '🔒 Fără Cuplaj (Independente)';
          stateBadge.className = 'sim-badge sim-badge--danger';
        } else if (deg >= 165) {
          stateBadge.textContent = '✨ Sincronizat în Antifază (180°)';
          stateBadge.className = 'sim-badge sim-badge--cyan';
        } else if (deg <= 15) {
          stateBadge.textContent = '✨ Sincronizat în Fază (0°)';
          stateBadge.className = 'sim-badge sim-badge--cyan';
        } else {
          stateBadge.textContent = deg < 90 ? '🔄 Atracție spre În Fază (0°)' : '🔄 Atracție spre Antifază (180°)';
          stateBadge.className = 'sim-badge sim-badge--amber';
        }
      }

      if (beamBadge) {
        const beamMm = (Math.abs(this.beamX) * 45).toFixed(2);
        beamBadge.textContent = `Grindă X: ±${beamMm} mm`;
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

      // Deep 17th-century horological laboratory gradient background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#070b14');
      bg.addColorStop(0.55, '#0c1526');
      bg.addColorStop(1, '#060a12');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Top Status Banner
      const bannerH = H < 350 ? 22 : 28;
      this._drawBanner(ctx, W, bannerH);

      // Upper 58%: Two Pendulum Clocks on Shared Movable Wooden Beam
      // Lower 42%: Waveforms θ1(t), θ2(t) (Left) + Lissajous Portrait & Phase Dial (Right)
      const topY = bannerH;
      const topH = (H - bannerH) * 0.58;
      const botY = topY + topH;
      const botH = H - botY;

      this._drawMechanicalSetup(ctx, 0, topY, W, topH);
      this._drawLowerTelemetry(ctx, 0, botY, W, botH);
    }

    _drawBanner(ctx, W, h) {
      const isNarrow = W < 580;
      const deg = Math.round(this.phaseDiffDeg);

      let color = '#ffab40';
      let bgCol = 'rgba(255, 171, 64, 0.14)';
      let text = '';

      if (this.beamLocked) {
        color = '#ff5252';
        bgCol = 'rgba(255, 82, 82, 0.20)';
        text = isNarrow
          ? '🔒 GRINDĂ BLOCATĂ (X = 0): Pendulele oscilează independent (fără sincronizare)!'
          : '🔒 GRINDĂ BLOCATĂ RIGID (X = 0): Fără micro-mișcarea suportului comun, pendulele oscilează independent!';
      } else if (deg >= 165) {
        color = '#00e5ff';
        bgCol = 'rgba(0, 229, 255, 0.14)';
        text = isNarrow
          ? `✨ SINCRONIZAT ÎN ANTIFAZĂ (Δφ = ${deg}°): Forțele se anulează pe grindă (F₁ + F₂ ≈ 0)!`
          : `✨ SINCRONIZAT ÎN ANTIFAZĂ (Δφ = ${deg}° — Huygens 1665): Forțele orizontale se anulează (F₁ + F₂ ≈ 0, grinda este calmă)!`;
      } else if (deg <= 15) {
        color = '#38bdf8';
        bgCol = 'rgba(56, 189, 248, 0.16)';
        text = isNarrow
          ? `✨ SINCRONIZAT ÎN FAZĂ (Δφ = ${deg}°): Pendulele bat pas la pas în aceeași direcție!`
          : `✨ SINCRONIZAT ÎN FAZĂ (Δφ = ${deg}°): Pendulele bat pas la pas în aceeași direcție (forțele se adună, grinda oscilează)!`;
      } else {
        const target = deg < 90 ? 'spre În Fază (0°)' : 'spre Antifază (180°)';
        color = '#fbbf24';
        bgCol = 'rgba(251, 191, 36, 0.14)';
        text = isNarrow
          ? `🔄 BISTABILITATE (Δφ = ${deg}°): Converge ${target}!`
          : `🔄 BISTABILITATE REALĂ (Δφ = ${deg}°): Converge ${target} (în funcție de starea inițială mai apropiată)!`;
      }

      ctx.fillStyle = bgCol;
      ctx.fillRect(0, 0, W, h);
      ctx.strokeStyle = color + '66';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(W, h);
      ctx.stroke();

      ctx.font = `bold ${isNarrow ? 9 : 11}px Inter, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, h / 2);
    }

    // =========================================================================
    // UPPER PANEL: SHARED WOODEN BEAM & TWO PENDULUM CLOCKS
    // =========================================================================
    _drawMechanicalSetup(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();

      const isNarrow = gw < 560;
      const centerX = gx + gw * 0.5;

      // Visual amplification of beam horizontal displacement X
      const beamShiftPx = this.beamX * 190;

      // Support beam dimensions
      const beamW = Math.min(gw * 0.72, 540);
      const beamH = 18;
      const beamY = gy + 28;
      const beamLeftX = centerX - beamW * 0.5 + beamShiftPx;
      const beamRightX = centerX + beamW * 0.5 + beamShiftPx;

      // 1. Draw Fixed Left & Right Support Piers (Chairs / Wall Brackets) + Springs & Damper
      const wallLeftX = gx + 16;
      const wallRightX = gx + gw - 16;

      // Left Pier Wall & Spring Kb
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(wallLeftX - 8, beamY - 10, 10, 38);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(wallLeftX - 8, beamY - 10, 10, 38);
      this._drawCoilSpring(ctx, wallLeftX + 2, beamY + beamH * 0.5, beamLeftX, beamY + beamH * 0.5, 7, '#38bdf8');

      // Right Pier Wall & Viscous Damper Cb
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(wallRightX - 2, beamY - 10, 10, 38);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(wallRightX - 2, beamY - 10, 10, 38);
      this._drawDamperSymbol(ctx, beamRightX, beamY + beamH * 0.5, wallRightX - 2, beamY + beamH * 0.5, '#fbbf24');

      // Support Rollers under the Wooden Beam
      const rollerY = beamY + beamH + 5;
      const rollerPositions = [-beamW * 0.36, 0, beamW * 0.36];
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - beamW * 0.45, rollerY + 5);
      ctx.lineTo(centerX + beamW * 0.45, rollerY + 5);
      ctx.stroke();

      for (const rxOff of rollerPositions) {
        const rx = centerX + rxOff + beamShiftPx * 0.5;
        ctx.fillStyle = this.beamLocked ? '#ef4444' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(rx, rollerY, 4.5, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 2. Draw the Shared Wooden Beam ("Bâti comun", Mass M)
      const beamGrad = ctx.createLinearGradient(0, beamY, 0, beamY + beamH);
      if (this.beamLocked) {
        beamGrad.addColorStop(0, '#475569');
        beamGrad.addColorStop(1, '#1e293b');
      } else {
        beamGrad.addColorStop(0, '#a16207');
        beamGrad.addColorStop(0.5, '#854d0e');
        beamGrad.addColorStop(1, '#713f12');
      }

      ctx.fillStyle = beamGrad;
      ctx.strokeStyle = this.beamLocked ? '#f87171' : '#facc15aa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(beamLeftX, beamY, beamW, beamH, 4);
      } else {
        ctx.rect(beamLeftX, beamY, beamW, beamH);
      }
      ctx.fill();
      ctx.stroke();

      // Label on wooden beam
      ctx.font = `bold ${isNarrow ? 8.5 : 9.5}px Inter, sans-serif`;
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.beamLocked ? 'GRINDĂ BLOCATĂ RIGID (X = 0)' : `GRINDĂ COMUNĂ MOBILĂ (Masa M, Cuplaj μ = ${this.couplingMu.toFixed(2)})`,
        centerX + beamShiftPx,
        beamY + beamH * 0.5
      );

      // Net Horizontal Force Arrow on Beam (F_net = F1 + F2)
      const netForce = this.force1 + this.force2;
      if (!this.beamLocked && Math.abs(netForce) > 0.04) {
        const arrowLen = netForce * 42;
        this._drawForceArrow(
          ctx,
          centerX + beamShiftPx,
          beamY - 9,
          centerX + beamShiftPx + arrowLen,
          beamY - 9,
          '#34d399',
          'F_net'
        );
      }

      // 3. Draw Pendulum 1 (Left, Cyan) and Pendulum 2 (Right, Amber)
      const pivot1X = centerX - beamW * 0.28 + beamShiftPx;
      const pivot2X = centerX + beamW * 0.28 + beamShiftPx;
      const pivotY = beamY + beamH + 14;
      const rodLen = Math.max(55, Math.min(135, gh - 72));

      this.pivot1Screen = { x: pivot1X, y: pivotY, L: rodLen };
      this.pivot2Screen = { x: pivot2X, y: pivotY, L: rodLen };

      // Draw Clock 1
      this._drawPendulumClock(
        ctx,
        pivot1X,
        pivotY,
        rodLen * (1 + 0.004 * this.detuningPct),
        this.theta1,
        this.w1,
        this.tickFlash1,
        '#00e5ff',
        'Ceasul 1 (θ₁)',
        1
      );

      // Draw Clock 2
      this._drawPendulumClock(
        ctx,
        pivot2X,
        pivotY,
        rodLen * (1 - 0.004 * this.detuningPct),
        this.theta2,
        this.w2,
        this.tickFlash2,
        '#fbbf24',
        'Ceasul 2 (θ₂)',
        2
      );

      // Draw symmetry axis / mirror line or in-phase tandem indicator
      if (this.phaseDiffDeg >= 165) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.32)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(centerX + beamShiftPx, pivotY + 6);
        ctx.lineTo(centerX + beamShiftPx, pivotY + rodLen + 14);
        ctx.stroke();
        ctx.font = 'bold 8.5px Inter, sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.textAlign = 'center';
        ctx.fillText('Axă de Simetrie în Oglindă (180°)', centerX + beamShiftPx, pivotY + rodLen + 22);
        ctx.restore();
      } else if (this.phaseDiffDeg <= 15) {
        ctx.save();
        ctx.font = 'bold 8.5px Inter, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('⇄ Oscilație Sincronă Pas la Pas (0°)', centerX + beamShiftPx, pivotY + rodLen + 22);
        ctx.restore();
      }

      ctx.restore();
    }

    _drawPendulumClock(ctx, px, py, L, theta, omega, tickFlash, color, label, idx) {
      ctx.save();

      // 1. Draw Clock Case & Escapement Gear Housing at Pivot
      const caseW = 44;
      const caseH = 26;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = color + '99';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(px - caseW * 0.5, py - 18, caseW, caseH, 5);
      } else {
        ctx.rect(px - caseW * 0.5, py - 18, caseW, caseH);
      }
      ctx.fill();
      ctx.stroke();

      // Escapement wheel (spoked gear rotating slightly with ticks)
      const gearR = 8;
      ctx.strokeStyle = tickFlash > 0.1 ? '#ffffff' : color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py - 4, gearR, 0, 2 * Math.PI);
      ctx.stroke();

      // Anchor pallet arms above gear
      ctx.beginPath();
      ctx.moveTo(px - 9, py - 2);
      ctx.lineTo(px, py - 11 + theta * 5);
      ctx.lineTo(px + 9, py - 2);
      ctx.stroke();

      // Horizontal Reaction Force Vector at Pivot onto Beam
      const horizF = Math.sin(theta) * 34;
      if (Math.abs(horizF) > 3) {
        this._drawForceArrow(ctx, px, py - 14, px + horizF, py - 14, color, `F_${idx}`);
      }

      // 2. Reference vertical dashed line & trajectory arc
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + L + 12);
      ctx.stroke();

      // Swing limit arc
      ctx.beginPath();
      ctx.arc(px, py, L, Math.PI * 0.5 - 0.5, Math.PI * 0.5 + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Pendulum Rod & Heavy Brass Bob
      const bobX = px + L * Math.sin(theta);
      const bobY = py + L * Math.cos(theta);
      const bobR = 15;

      if (idx === 1) {
        this.bob1Screen = { x: bobX, y: bobY, r: bobR };
      } else {
        this.bob2Screen = { x: bobX, y: bobY, r: bobR };
      }

      // Rod
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      // Pivot pin
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
      ctx.fill();

      // Bob outer glow when escapement impulses or dragged
      if (tickFlash > 0.05 || this.draggingBob === idx) {
        ctx.fillStyle = color + '44';
        ctx.beginPath();
        ctx.arc(bobX, bobY, bobR + 5, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Bob metallic radial gradient
      const bobGrad = ctx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, bobR);
      if (idx === 1) {
        bobGrad.addColorStop(0, '#cffafe');
        bobGrad.addColorStop(0.5, '#00e5ff');
        bobGrad.addColorStop(1, '#0369a1');
      } else {
        bobGrad.addColorStop(0, '#fef08a');
        bobGrad.addColorStop(0.5, '#fbbf24');
        bobGrad.addColorStop(1, '#b45309');
      }

      ctx.fillStyle = bobGrad;
      ctx.strokeStyle = '#ffffffaa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobR, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Angle value inside/under bob
      const degVal = ((theta * 180) / Math.PI).toFixed(0);
      ctx.font = 'bold 8.5px Inter, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${degVal}°`, bobX, bobY);

      // Clock Title Label
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(label, px, py - 25);

      ctx.restore();
    }

    _drawCoilSpring(ctx, x1, y1, x2, y2, coils, color) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const dx = x2 - x1;
      const step = dx / (coils * 2 + 2);
      for (let i = 1; i <= coils * 2; i++) {
        const cx = x1 + step * i;
        const cy = y1 + (i % 2 === 0 ? -5 : 5);
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    _drawDamperSymbol(ctx, x1, y1, x2, y2, color) {
      ctx.save();
      const midX = (x1 + x2) * 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      // Rod from beam to piston
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(midX, y1);
      ctx.moveTo(midX, y1 - 5);
      ctx.lineTo(midX, y1 + 5);
      ctx.stroke();
      // Cylinder housing attached to right wall
      ctx.strokeRect(midX - 6, y1 - 6, 16, 12);
      ctx.beginPath();
      ctx.moveTo(midX + 10, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    _drawForceArrow(ctx, x1, y1, x2, y2, color, text) {
      const dx = x2 - x1;
      if (Math.abs(dx) < 2) return;
      const dir = dx >= 0 ? 1 : -1;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - dir * 5, y2 - 3);
      ctx.lineTo(x2 - dir * 5, y2 + 3);
      ctx.closePath();
      ctx.fill();

      if (text) {
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, (x1 + x2) * 0.5, y1 - 5);
      }
      ctx.restore();
    }

    // =========================================================================
    // LOWER PANEL: WAVEFORMS θ1(t), θ2(t) & LISSAJOUS PORTRAIT (θ1 vs θ2)
    // =========================================================================
    _drawLowerTelemetry(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();

      const isNarrow = gw < 580;
      const leftW = isNarrow ? gw * 0.58 : gw * 0.58;
      const rightW = gw - leftW;

      this._drawWaveformsPanel(ctx, gx + 8, gy + 4, leftW - 12, gh - 8);
      this._drawLissajousAndPhasePanel(ctx, gx + leftW + 2, gy + 4, rightW - 10, gh - 8);

      ctx.restore();
    }

    _drawWaveformsPanel(ctx, x, y, w, h) {
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
      ctx.fillText('OSCILOGRAMĂ ÎN TIMP REAL: θ₁(t) vs θ₂(t)', x + 10, y + 14);

      // Legend
      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('■ Pendul 1 (θ₁)', x + 10, y + 26);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('■ Pendul 2 (θ₂)', x + 85, y + 26);
      ctx.fillStyle = '#34d399';
      ctx.fillText('■ Grindă X(t) ×10', x + 160, y + 26);

      const plotX = x + 12;
      const plotY = y + 32;
      const plotW = w - 24;
      const plotH = h - 40;
      if (plotW < 20 || plotH < 16) {
        ctx.restore();
        return;
      }

      const midY = plotY + plotH * 0.5;

      // Center zero line
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, midY);
      ctx.lineTo(plotX + plotW, midY);
      ctx.stroke();

      const count = this.histCount;
      if (count > 2) {
        const startIdx = (this.histIdx - count + this.histLen) % this.histLen;

        // 1. Beam X(t) wave (Green)
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const idx = (startIdx + i) % this.histLen;
          const px = plotX + (i / (this.histLen - 1)) * plotW;
          const py = midY - (this.histBeamX[idx] * 9.5) * (plotH * 0.42);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // 2. Pendulum 1 wave θ1(t) (Cyan)
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const idx = (startIdx + i) % this.histLen;
          const px = plotX + (i / (this.histLen - 1)) * plotW;
          const py = midY - (this.histTheta1[idx] / 0.6) * (plotH * 0.42);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // 3. Pendulum 2 wave θ2(t) (Amber)
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const idx = (startIdx + i) % this.histLen;
          const px = plotX + (i / (this.histLen - 1)) * plotW;
          const py = midY - (this.histTheta2[idx] / 0.6) * (plotH * 0.42);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawLissajousAndPhasePanel(ctx, x, y, w, h) {
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
      ctx.fillText('PORTRET LISSAJOUS (θ₂ vs θ₁) & DEFAZAJ', x + 10, y + 14);

      const boxSize = Math.max(24, Math.min(w * 0.44, h - 32));
      const boxCx = x + 16 + boxSize * 0.5;
      const boxCy = y + 22 + boxSize * 0.5;

      // Lissajous square frame
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#334155';
      ctx.fillRect(boxCx - boxSize * 0.5, boxCy - boxSize * 0.5, boxSize, boxSize);
      ctx.strokeRect(boxCx - boxSize * 0.5, boxCy - boxSize * 0.5, boxSize, boxSize);

      // Diagonal guide lines for both attractors:
      const isInPhaseCloser = this.phaseDiffDeg < 90;

      // In-phase diagonal (theta2 = +theta1 -> 0°)
      ctx.strokeStyle = isInPhaseCloser ? 'rgba(56, 189, 248, 0.50)' : 'rgba(56, 189, 248, 0.16)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(boxCx - boxSize * 0.45, boxCy + boxSize * 0.45);
      ctx.lineTo(boxCx + boxSize * 0.45, boxCy - boxSize * 0.45);
      ctx.stroke();

      // Anti-phase diagonal (theta2 = -theta1 -> 180°)
      ctx.strokeStyle = !isInPhaseCloser ? 'rgba(0, 229, 255, 0.50)' : 'rgba(0, 229, 255, 0.16)';
      ctx.beginPath();
      ctx.moveTo(boxCx - boxSize * 0.45, boxCy - boxSize * 0.45);
      ctx.lineTo(boxCx + boxSize * 0.45, boxCy + boxSize * 0.45);
      ctx.stroke();
      ctx.setLineDash([]);

      // Trace Lissajous trajectory (theta1 on X, theta2 on Y)
      const count = Math.min(this.histCount, 90);
      if (count > 2) {
        const startIdx = (this.histIdx - count + this.histLen) % this.histLen;
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const idx = (startIdx + i) % this.histLen;
          const lx = boxCx + (this.histTheta1[idx] / 0.55) * (boxSize * 0.44);
          const ly = boxCy - (this.histTheta2[idx] / 0.55) * (boxSize * 0.44);
          if (i === 0) ctx.moveTo(lx, ly);
          else ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }

      // Current state dot on Lissajous
      const curLx = boxCx + (this.theta1 / 0.55) * (boxSize * 0.44);
      const curLy = boxCy - (this.theta2 / 0.55) * (boxSize * 0.44);
      ctx.fillStyle = isInPhaseCloser ? '#38bdf8' : '#00e5ff';
      ctx.beginPath();
      ctx.arc(curLx, curLy, 3.8, 0, 2 * Math.PI);
      ctx.fill();

      // Right side of panel: Telemetry Readout & Phase Gauge
      const infoX = boxCx + boxSize * 0.5 + 12;
      const deg = this.phaseDiffDeg.toFixed(1);

      ctx.font = '8.5px Inter, sans-serif';
      ctx.textAlign = 'left';

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Defazaj Curent Δφ:', infoX, y + 32);
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = this.phaseDiffDeg <= 15 ? '#38bdf8' : (this.phaseDiffDeg >= 165 ? '#00e5ff' : '#fbbf24');
      ctx.fillText(`${deg}°`, infoX, y + 46);

      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Forță Netă: ${(Math.abs(this.force1 + this.force2)).toFixed(2)} N`, infoX, y + 62);
      ctx.fillText(`Amplitudine X: ${(Math.abs(this.beamX) * 45).toFixed(2)} mm`, infoX, y + 75);
      
      const isAnti = this.phaseDiffDeg >= 90;
      ctx.fillStyle = isAnti ? '#00e5ff' : '#38bdf8';
      ctx.fillText(
        isAnti ? 'Diagonala ╲ : 180° (Antifază)' : 'Diagonala ╱ : 0° (În Fază)',
        infoX,
        y + 89
      );

      ctx.restore();
    }
  }

  window.HuygensPendulumsSim = HuygensPendulumsSim;
})();
