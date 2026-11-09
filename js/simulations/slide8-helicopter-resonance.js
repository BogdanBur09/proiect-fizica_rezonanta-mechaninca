/* ============================================================
   SLIDE8-HELICOPTER-RESONANCE.JS — Helicopter Ground Resonance Sim
   Coleman's Instability, Blade Lead-Lag Dynamics & Airframe Coupling
   ============================================================ */

(function () {
  'use strict';

  class HelicopterResonanceSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Physical Parameters of Helicopter System ---
      this.rpm = config.rpm || 320; // Rotor RPM (operating zone: 200 - 450 RPM)
      this.omega = (this.rpm * Math.PI) / 30; // Rotor angular speed (rad/s)
      this.omegaGear = 18.85; // Fuselage rocking frequency on landing gear (~3.0 Hz, ~18.85 rad/s)
      this.omegaLag = 8.5; // Natural lead-lag blade frequency (~1.35 Hz)
      
      // Airframe state
      this.onGround = true; // On tarmac vs. in-flight (lift-off)
      this.xFus = 0; // Fuselage lateral rocking displacement (mm visual)
      this.vFus = 0;
      this.aFus = 0;
      this.gearDamping = 0.06; // Landing gear damping (6%)

      // 3 Articulated Rotor Blades with lead-lag hinges
      this.damperHealth = 1.0; // 1.0 = healthy (20% lag damping), 0.05 = punctured/failed damper
      this.blades = [
        { id: 0, nominalAngle: 0, lag: 0, vLag: 0, color: '#38bdf8' },
        { id: 1, nominalAngle: (2 * Math.PI) / 3, lag: 0, vLag: 0, color: '#fbbf24' },
        { id: 2, nominalAngle: (4 * Math.PI) / 3, lag: 0, vLag: 0, color: '#34d399' }
      ];

      // Rotor center of mass offset (eccentricity)
      this.rG = 0;
      this.thetaSpin = 0;

      // Telemetry
      this.peakGFus = 0;
      this.destroyed = false;
      this.destructTimer = 0;

      // Interactive Coleman diagram rect
      this.colemanRect = null;
      this.isTuningColeman = false;

      this._bindEvents();
    }

    setRPM(newRPM) {
      this.rpm = Math.max(160, Math.min(500, Math.round(newRPM)));
      this.omega = (this.rpm * Math.PI) / 30;

      const slider = document.getElementById('sim8-rpm');
      const valDisp = document.getElementById('sim8-rpm-val');
      if (slider) slider.value = this.rpm;
      if (valDisp) {
        const fRotor = (this.rpm / 60).toFixed(2);
        valDisp.textContent = `${this.rpm} RPM (${fRotor} Hz)`;
      }

      this._updateUIBadges();
      this.requestRender();
    }

    setDamperHealth(h) {
      this.damperHealth = Math.max(0.04, Math.min(1.0, h));
      const slider = document.getElementById('sim8-damper');
      const valDisp = document.getElementById('sim8-damper-val');
      if (slider) slider.value = Math.round(this.damperHealth * 100);
      if (valDisp) {
        valDisp.textContent = this.damperHealth > 0.6
          ? `${Math.round(this.damperHealth * 100)}% (Funcțional)`
          : `${Math.round(this.damperHealth * 100)}% (DEFECT / Scurs)`;
      }

      this._updateUIBadges();
      this.requestRender();
    }

    triggerHardBump() {
      // Perturb blade 0 with an abrupt lead-lag offset
      this.blades[0].lag = 0.22; // ~12 degrees lag shock
      this.blades[0].vLag = 1.2;
      this.xFus = 14;
      this.destroyed = false;
      this.destructTimer = 0;
      if (!this.running) this.start();
      this.requestRender();
    }

    emergencyLiftoff() {
      // Pilot pulls collective: helicopter leaves the ground!
      // In flight, landing gear spring constraint disappears -> ground resonance ceases instantly!
      this.onGround = false;
      this.destroyed = false;
      const btn = document.getElementById('sim8-btn-liftoff');
      if (btn) {
        btn.classList.add('sim-btn--preset');
        btn.textContent = '🚁 În Zbor (Fără Rezonanță)';
      }
      this._updateUIBadges();
      this.requestRender();
    }

    landOnGround() {
      this.onGround = true;
      const btn = document.getElementById('sim8-btn-liftoff');
      if (btn) {
        btn.classList.remove('sim-btn--preset');
        btn.textContent = '🚁 Decolare de Urgență (Lift-off)';
      }
      this._updateUIBadges();
      this.requestRender();
    }

    onReset() {
      this.rpm = 320;
      this.omega = (this.rpm * Math.PI) / 30;
      this.onGround = true;
      this.xFus = 0;
      this.vFus = 0;
      this.aFus = 0;
      this.thetaSpin = 0;
      this.rG = 0;
      this.damperHealth = 1.0;
      this.destroyed = false;
      this.destructTimer = 0;
      this.peakGFus = 0;

      for (let i = 0; i < 3; i++) {
        this.blades[i].lag = 0;
        this.blades[i].vLag = 0;
      }

      this.setRPM(320);
      this.setDamperHealth(1.0);
      this.landOnGround();
      this._updateUIBadges();
    }

    requestRender() {
      if (!this.running) {
        this.render();
      }
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
        if (this.colemanRect &&
            pos.x >= this.colemanRect.x && pos.x <= this.colemanRect.x + this.colemanRect.w &&
            pos.y >= this.colemanRect.y && pos.y <= this.colemanRect.y + this.colemanRect.h) {
          this.isTuningColeman = true;
          const ratio = (pos.x - this.colemanRect.x) / this.colemanRect.w;
          this.setRPM(180 + ratio * (480 - 180));
        }
      };

      const onMove = (e) => {
        const pos = getPos(e);
        if (this.isTuningColeman && this.colemanRect) {
          const ratio = Math.max(0, Math.min(1, (pos.x - this.colemanRect.x) / this.colemanRect.w));
          this.setRPM(180 + ratio * (480 - 180));
        }
      };

      const onEnd = () => {
        this.isTuningColeman = false;
      };

      this.canvas.addEventListener('mousedown', onStart);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
    }

    onInit() {
      const rpmSlider = document.getElementById('sim8-rpm');
      const damperSlider = document.getElementById('sim8-damper');

      const btnHealthy = document.getElementById('sim8-preset-healthy');
      const btnFailed = document.getElementById('sim8-preset-failed');
      const btnBump = document.getElementById('sim8-btn-bump');
      const btnLiftoff = document.getElementById('sim8-btn-liftoff');
      const btnBrake = document.getElementById('sim8-btn-brake');

      const playBtn = document.getElementById('sim8-play');
      const resetBtn = document.getElementById('sim8-reset');

      if (rpmSlider) {
        rpmSlider.value = this.rpm;
        rpmSlider.addEventListener('input', (e) => {
          this.setRPM(parseFloat(e.target.value));
        });
      }

      if (damperSlider) {
        damperSlider.value = Math.round(this.damperHealth * 100);
        damperSlider.addEventListener('input', (e) => {
          this.setDamperHealth(parseFloat(e.target.value) / 100);
        });
      }

      if (btnHealthy) {
        btnHealthy.addEventListener('click', () => {
          this.setDamperHealth(1.0);
          this.landOnGround();
          this.triggerHardBump();
        });
      }

      if (btnFailed) {
        btnFailed.addEventListener('click', () => {
          this.setDamperHealth(0.06); // Punctured hydraulic damper
          this.landOnGround();
          this.triggerHardBump();
        });
      }

      if (btnBump) {
        btnBump.addEventListener('click', () => {
          this.triggerHardBump();
        });
      }

      if (btnLiftoff) {
        btnLiftoff.addEventListener('click', () => {
          if (this.onGround) this.emergencyLiftoff();
          else this.landOnGround();
        });
      }

      if (btnBrake) {
        btnBrake.addEventListener('click', () => {
          // Emergency throttle cut & rotor brake
          this.setRPM(180);
          this.blades[0].lag *= 0.3;
          this.blades[1].lag *= 0.3;
          this.blades[2].lag *= 0.3;
        });
      }

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

    update(dt) {
      const subSteps = 4;
      const subDt = Math.min(dt, 0.033) / subSteps;

      for (let s = 0; s < subSteps; s++) {
        this._physicsStep(subDt);
      }

      this._updateUIBadges();
    }

    _physicsStep(dt) {
      if (this.destroyed) return;

      this.thetaSpin += this.omega * dt;

      // 1. Compute Center of Mass (G) offset of the 3 rotor blades
      let sumGx = 0;
      let sumGy = 0;
      const bladeRadius = 1.0; // normalized

      for (let i = 0; i < 3; i++) {
        const b = this.blades[i];
        // Total instantaneous blade azimuthal angle
        const psi = this.thetaSpin + b.nominalAngle + b.lag;
        sumGx += Math.cos(psi);
        sumGy += Math.sin(psi);
      }

      // Rotor Center of Mass displacement relative to mast (G)
      this.rG = Math.hypot(sumGx, sumGy) / 3;
      const phiG = Math.atan2(sumGy, sumGx);

      // 2. Airframe lateral motion equation:
      // When on ground, landing gear acts as spring-damper:
      // M_fus * x'' + C_gear * x' + K_gear * x = F_unbalance_x
      if (this.onGround) {
        const gearOmegaSq = this.omegaGear * this.omegaGear;
        const twoZetaOmega = 2 * this.gearDamping * this.omegaGear;

        // Dynamic unbalance force from offset rotor center of mass
        const unbalanceForce = 850 * this.rG * (this.omega * this.omega);
        const fLateral = unbalanceForce * Math.cos(phiG);

        const accelFus = fLateral - twoZetaOmega * this.vFus - gearOmegaSq * this.xFus;
        this.vFus += accelFus * dt;
        this.xFus += this.vFus * dt;
        this.xFus = Math.max(-55, Math.min(55, this.xFus));
        this.aFus = accelFus;

        // 3. Coleman Coupling Feedback onto the Blades:
        // Lateral acceleration of the mast aFus pumps energy into the blade lead-lag motion:
        // b''_i + 2*zeta_lag*omega_lag * b'_i + omega_lag^2 * b_i = (aFus / R) * sin(psi_i)
        const lagZeta = 0.02 + 0.22 * this.damperHealth;
        const omegaLagSq = this.omegaLag * this.omegaLag;
        const twoZetaLag = 2 * lagZeta * this.omegaLag;

        for (let i = 0; i < 3; i++) {
          const b = this.blades[i];
          const psi = this.thetaSpin + b.nominalAngle + b.lag;
          // Inertial excitation from shaking mast onto blade lag hinge
          const couplingDrive = -0.0085 * this.aFus * Math.sin(psi);
          const lagAccel = couplingDrive - twoZetaLag * b.vLag - omegaLagSq * b.lag;

          b.vLag += lagAccel * dt;
          b.lag += b.vLag * dt;
          b.lag = Math.max(-0.45, Math.min(0.45, b.lag)); // hard stops at +-25 deg
        }
      } else {
        // In-flight: landing gear constraint eliminated
        this.xFus *= 0.92;
        this.vFus *= 0.92;
        this.aFus = 0;

        // Lead-lag oscillations damp out rapidly in air
        for (let i = 0; i < 3; i++) {
          this.blades[i].lag *= 0.94;
          this.blades[i].vLag *= 0.94;
        }
      }

      // Check destruction threshold
      const gEquivalent = Math.abs(this.aFus) / 9.81;
      if (gEquivalent > this.peakGFus) this.peakGFus = gEquivalent;

      if (Math.abs(this.xFus) > 42 && this.damperHealth < 0.25 && this.onGround) {
        this.destructTimer += dt;
        if (this.destructTimer > 1.8) {
          this.destroyed = true;
        }
      }
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (W < 40 || H < 40) return;

      ctx.clearRect(0, 0, W, H);

      const topH = Math.max(90, Math.round(H * 0.58));
      const botH = Math.max(60, H - topH);

      this._renderHelicopterBench(ctx, 0, 0, W, topH);
      this._renderTelemetryAndColeman(ctx, 0, topH, W, botH);
    }

    _renderHelicopterBench(ctx, x0, y0, w, h) {
      // Background Airfield Tarmac
      const bg = ctx.createLinearGradient(x0, y0, x0, y0 + h);
      bg.addColorStop(0, '#091322');
      bg.addColorStop(0.6, '#0f1c32');
      bg.addColorStop(1, '#0b1628');
      ctx.fillStyle = bg;
      ctx.fillRect(x0, y0, w, h);

      // Split top area:
      // Left 44%: Rotor Disk Top-Down View (Articulated blades & center of mass G)
      // Right 56%: Fuselage Front View on Tarmac Landing Gear
      const leftW = Math.round(w * 0.44);
      const rightW = w - leftW;

      this._renderRotorTopDown(ctx, x0, y0, leftW, h);
      this._renderDivider(ctx, x0 + leftW, y0, h);
      this._renderFuselageFrontView(ctx, x0 + leftW, y0, rightW, h);
    }

    _renderRotorTopDown(ctx, x0, y0, w, h) {
      const centerX = x0 + w * 0.5;
      const centerY = y0 + h * 0.52;
      const rotorR = Math.min(w * 0.42, h * 0.42);

      // Title
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('ROTOR ARTICULAT (VEDERE DE SUS)', centerX, y0 + 16);

      // Circular tip-path plane track
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, rotorR, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotor Mast Center (O)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 8, centerY);
      ctx.lineTo(centerX + 8, centerY);
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX, centerY + 8);
      ctx.stroke();

      // Draw the 3 Articulated Blades
      for (let i = 0; i < 3; i++) {
        const b = this.blades[i];
        const psi = this.thetaSpin + b.nominalAngle + b.lag;

        const tipX = centerX + Math.cos(psi) * rotorR;
        const tipY = centerY + Math.sin(psi) * rotorR;

        // Blade lead-lag hinge point (at 20% span)
        const hingeR = rotorR * 0.22;
        const hx = centerX + Math.cos(this.thetaSpin + b.nominalAngle) * hingeR;
        const hy = centerY + Math.sin(this.thetaSpin + b.nominalAngle) * hingeR;

        // Hub arm
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        // Lead-lag hinge pin (Yellow)
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(hx, hy, 3.2, 0, 2 * Math.PI);
        ctx.fill();

        // Lead-Lag Damper piston indicator
        const isDamperBroken = (i === 0 && this.damperHealth < 0.25);
        ctx.strokeStyle = isDamperBroken ? '#ef4444' : '#34d399';
        ctx.lineWidth = 2.0;
        const dampOffset = 7;
        const dx = Math.cos(psi + Math.PI / 2) * dampOffset;
        const dy = Math.sin(psi + Math.PI / 2) * dampOffset;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + dx + (tipX - hx) * 0.35, hy + dy + (tipY - hy) * 0.35);
        ctx.stroke();

        // Blade Aerodynamic Airfoil Body
        ctx.strokeStyle = isDamperBroken ? '#f87171' : b.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Blade tip marker
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 2.8, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Center Hub Cap
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dynamic Center of Mass (G) indicator of the rotor
      // Scale visual offset for clarity: 1 unit = 45 px
      const scaleG = 55;
      let sumGx = 0;
      let sumGy = 0;
      for (let b of this.blades) {
        const psi = this.thetaSpin + b.nominalAngle + b.lag;
        sumGx += Math.cos(psi);
        sumGy += Math.sin(psi);
      }
      const gx = centerX + (sumGx / 3) * scaleG;
      const gy = centerY + (sumGy / 3) * scaleG;

      if (this.rG > 0.02) {
        // Vector O -> G (Center of Mass eccentricity)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(gx, gy);
        ctx.stroke();

        // G marker dot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(gx, gy, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fee2e2';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '700 9.5px Inter, sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('G (Centru Masă)', gx + 8, gy + 3);
      }

      // Legend note
      ctx.font = '600 9px Inter, monospace';
      ctx.fillStyle = this.rG > 0.05 ? '#f87171' : '#38bdf8';
      ctx.textAlign = 'center';
      const unbalanceText = this.rG > 0.05 ? `⚠️ DEZECHILIBRU ROTOR: ${(this.rG * 100).toFixed(0)}%` : 'Rotor Simetric Echilibrat';
      ctx.fillText(unbalanceText, centerX, y0 + h - 10);
    }

    _renderFuselageFrontView(ctx, x0, y0, w, h) {
      const pad = 12;
      const centerX = x0 + w * 0.50;
      const groundY = y0 + h - 34;

      // Title
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('ELICOPTER PE SOL (VEDERE FRONTALĂ)', centerX, y0 + 16);

      // Tarmac Ground / Runway
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x0 + pad, groundY, w - pad * 2, 14);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 + pad, groundY, w - pad * 2, 14);

      // Runway markings
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let mx = x0 + pad + 25; mx < x0 + w - pad - 25; mx += 40) {
        ctx.fillRect(mx, groundY + 5, 18, 3.5);
      }

      // Fuselage horizontal offset:
      // If destroyed, helicopter tips over violently!
      const lateralShift = this.destroyed ? 48 : this.xFus;
      const tipAngle = this.destroyed ? 0.35 : (lateralShift * 0.012);
      const fuseCenterY = groundY - 60 - (this.onGround ? 0 : 25);
      const fuseCenterX = centerX + lateralShift;

      ctx.save();
      ctx.translate(fuseCenterX, fuseCenterY);
      ctx.rotate(tipAngle);

      // Rotor Mast & Spinning Rotor Blades Front View
      ctx.fillStyle = '#475569';
      ctx.fillRect(-4, -42, 8, 22);

      // Spinning rotor disk front plane (blur lines)
      ctx.strokeStyle = this.rG > 0.06 ? 'rgba(239, 68, 68, 0.65)' : 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(-110, -42);
      ctx.lineTo(110, -42);
      ctx.stroke();

      // Fuselage Body (Aerodynamic Pod)
      const fuseGrad = ctx.createLinearGradient(-35, -20, 35, 20);
      fuseGrad.addColorStop(0, '#334155');
      fuseGrad.addColorStop(0.5, '#64748b');
      fuseGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = fuseGrad;

      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 26, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = this.destroyed ? '#ef4444' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cockpit Windshield (Cyan Tint)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, -6, 26, 14, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Skid Landing Gear Struts
      const gearLeftX = -32;
      const gearRightX = 32;
      const skidBottomY = 48;

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3.5;

      // Left leg strut
      ctx.beginPath();
      ctx.moveTo(-20, 18);
      ctx.lineTo(gearLeftX, skidBottomY);
      ctx.stroke();

      // Right leg strut
      ctx.beginPath();
      ctx.moveTo(20, 18);
      ctx.lineTo(gearRightX, skidBottomY);
      ctx.stroke();

      // Oleo Shock Absorbers / Spring Dampers on Struts
      ctx.strokeStyle = this.onGround && Math.abs(this.xFus) > 25 ? '#ef4444' : '#fbbf24';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-26, 30);
      ctx.lineTo(-29, 38);
      ctx.moveTo(26, 30);
      ctx.lineTo(29, 38);
      ctx.stroke();

      // Left & Right Horizontal Skids
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(gearLeftX - 16, skidBottomY);
      ctx.lineTo(gearLeftX + 16, skidBottomY);
      ctx.moveTo(gearRightX - 16, skidBottomY);
      ctx.lineTo(gearRightX + 16, skidBottomY);
      ctx.stroke();

      ctx.restore();

      // Sparks & Dust Eruption if in violent resonance on tarmac
      if (this.onGround && Math.abs(this.xFus) > 26) {
        ctx.save();
        ctx.fillStyle = '#fbbf24';
        for (let sp = 0; sp < 12; sp++) {
          const sparkX = fuseCenterX + (Math.random() - 0.5) * 80;
          const sparkY = groundY - Math.random() * 22;
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, Math.random() * 2.5 + 1, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();
      }

      // Status Tag above Helicopter
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      if (this.destroyed) {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('💥 COLAPS STRUCTURAL: ELICOPTER RĂSTURNAT!', centerX, y0 + 38);
      } else if (!this.onGround) {
        ctx.fillStyle = '#34d399';
        ctx.fillText('🚁 ZBOR LIBER: DECUPAT DE LA SOL (STABIL)', centerX, y0 + 38);
      } else if (Math.abs(this.xFus) > 24) {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('⚠️ REZONANȚĂ LA SOL: VIBRAȚIE DIVERGENTĂ!', centerX, y0 + 38);
      } else {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('ELICOPTER LA SOL — REGIM STABIL', centerX, y0 + 38);
      }
    }

    _renderDivider(ctx, x, y, h) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }

    _renderTelemetryAndColeman(ctx, x, y, w, h) {
      const leftW = Math.round(w * 0.55);
      const rightW = w - leftW;

      this._renderColemanPanel(ctx, x, y, leftW, h);
      this._renderFlightTelemetryPanel(ctx, x + leftW, y, rightW, h);
    }

    _renderColemanPanel(ctx, x, y, w, h) {
      const pad = 10;
      const cardX = x + pad;
      const cardY = y + pad;
      const cardW = w - pad * 2;
      const cardH = h - pad * 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Title
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('DIAGRAMA COLEMAN — INSTABILITATE REZONANȚĂ LA SOL', cardX + 10, cardY + 15);

      const plotX = cardX + 38;
      const plotY = cardY + 24;
      const plotW = Math.max(50, cardW - 50);
      const plotH = Math.max(30, cardH - 44);

      this.colemanRect = { x: plotX, y: plotY, w: plotW, h: plotH };

      const minRPM = 180;
      const maxRPM = 480;
      const maxFreq = 6.0; // Hz

      // Instability Band: where (Omega - omegaLag) / 2pi ≈ omegaGear / 2pi (~3.0 Hz)
      // Critical RPM ≈ (3.0 + 1.35) * 60 ≈ 260 - 350 RPM
      const critRPM0 = 260;
      const critRPM1 = 360;
      const bandX0 = plotX + ((critRPM0 - minRPM) / (maxRPM - minRPM)) * plotW;
      const bandX1 = plotX + ((critRPM1 - minRPM) / (maxRPM - minRPM)) * plotW;

      // Shaded Coleman Instability Zone
      ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
      ctx.fillRect(bandX0, plotY, bandX1 - bandX0, plotH);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(bandX0, plotY, bandX1 - bandX0, plotH);
      ctx.setLineDash([]);

      // Label inside instability band
      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText('ZONĂ INSTABILĂ COLEMAN', (bandX0 + bandX1) * 0.5, plotY + 14);

      // Plot Line 1: Fuselage Natural Rocking Frequency (omegaGear / 2pi ≈ 3.0 Hz) - Horizontal
      const fGearHz = this.omegaGear / (2 * Math.PI);
      const yGear = plotY + plotH - (fGearHz / maxFreq) * plotH;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plotX, yGear);
      ctx.lineTo(plotX + plotW, yGear);
      ctx.stroke();

      ctx.font = '600 8.5px Inter, monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'left';
      ctx.fillText('f_tren = 3.0 Hz (Balans Fuselaj)', plotX + 4, yGear - 4);

      // Plot Line 2: Backward Lag Mode Frequency (Omega - omegaLag) / 2pi
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const testRPM = minRPM + (i / steps) * (maxRPM - minRPM);
        const testOmega = (testRPM * Math.PI) / 30;
        const fBackHz = Math.max(0, (testOmega - this.omegaLag) / (2 * Math.PI));
        const px = plotX + (i / steps) * plotW;
        const py = plotY + plotH - (fBackHz / maxFreq) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current Operating Point Dot
      const curBackHz = Math.max(0, (this.omega - this.omegaLag) / (2 * Math.PI));
      const dotX = plotX + ((this.rpm - minRPM) / (maxRPM - minRPM)) * plotW;
      const dotY = plotY + plotH - (curBackHz / maxFreq) * plotH;

      ctx.fillStyle = Math.abs(curBackHz - fGearHz) < 0.45 && this.damperHealth < 0.35 ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // RPM cursor line
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(dotX, plotY);
      ctx.lineTo(dotX, plotY + plotH);
      ctx.stroke();
      ctx.restore();
    }

    _renderFlightTelemetryPanel(ctx, x, y, w, h) {
      const pad = 10;
      const cardX = x + pad;
      const cardY = y + pad;
      const cardW = w - pad * 2;
      const cardH = h - pad * 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Title
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('TELEMETRIE VIBRAȚIE ȘI AMORTIZOR', cardX + 10, cardY + 15);

      const rowH = Math.max(16, (cardH - 36) / 3);

      // Row 1: Accelerație G Fuselaj
      const gEq = Math.abs(this.aFus) / 9.81;
      const gFrac = Math.min(1.0, gEq / 2.5);
      this._renderGaugeRow(ctx, cardX + 10, cardY + 24, cardW - 20, 'Accelerație Fuselaj:', `${gEq.toFixed(2)} g`, gFrac, gFrac > 0.65);

      // Row 2: Sănătate Amortizoare Pale
      const dFrac = this.damperHealth;
      this._renderGaugeRow(ctx, cardX + 10, cardY + 24 + rowH, cardW - 20, 'Amortizor Pală 1:', `${Math.round(dFrac * 100)}%`, 1.0 - dFrac, dFrac < 0.25);

      // Row 3: Status Diagnostic
      const bottomY = cardY + cardH - 12;
      ctx.font = '700 10px Inter, sans-serif';
      ctx.textAlign = 'left';

      let statusText = 'STABIL (Amortizoare Optime)';
      let statusColor = '#34d399';

      if (this.destroyed) {
        statusText = '💥 AVARIE CATALISMICĂ: TREN DISTRUS!';
        statusColor = '#ef4444';
      } else if (!this.onGround) {
        statusText = '🚁 ÎN ZBOR (Fără Cuplaj Elastic Sol)';
        statusColor = '#38bdf8';
      } else if (Math.abs(this.xFus) > 25) {
        statusText = '⚠️ REZONANȚĂ LA SOL DIVERGENTĂ!';
        statusColor = '#ef4444';
      } else if (this.damperHealth < 0.3) {
        statusText = '🟡 AMORTIZOR DEFECT: RISC REZONANȚĂ!';
        statusColor = '#fbbf24';
      }

      ctx.fillStyle = statusColor;
      ctx.fillText(statusText, cardX + 10, bottomY);
    }

    _renderGaugeRow(ctx, x, y, w, label, valueStr, frac, isDanger) {
      ctx.font = '600 9.5px Inter, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(label, x, y + 10);

      const barX = x + 125;
      const barW = Math.max(40, w - 185);

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.fillRect(barX, y + 2, barW, 10);

      ctx.fillStyle = isDanger ? '#ef4444' : (frac > 0.5 ? '#fbbf24' : '#38bdf8');
      ctx.fillRect(barX, y + 2, barW * frac, 10);

      ctx.font = '600 9.5px Inter, monospace';
      ctx.fillStyle = isDanger ? '#f87171' : '#cbd5e1';
      ctx.textAlign = 'right';
      ctx.fillText(valueStr, x + w, y + 10);
    }

    _updateUIBadges() {
      const rpmBadge = document.getElementById('sim8-rpm-badge');
      const gBadge = document.getElementById('sim8-g-badge');
      const damperBadge = document.getElementById('sim8-damper-badge');

      if (rpmBadge) {
        rpmBadge.textContent = `${this.rpm} RPM`;
      }

      if (gBadge) {
        const gVal = (Math.abs(this.aFus) / 9.81).toFixed(2);
        gBadge.textContent = `Fuselaj: ${gVal} g`;
        gBadge.className = gVal > 1.2 ? 'sim-badge sim-badge--danger' : (gVal > 0.4 ? 'sim-badge sim-badge--amber' : 'sim-badge sim-badge--cyan');
      }

      if (damperBadge) {
        damperBadge.textContent = this.damperHealth > 0.5 ? 'Amortizoare: 100%' : 'Amortizor: DEFECT';
        damperBadge.className = this.damperHealth > 0.5 ? 'sim-badge sim-badge--cyan' : 'sim-badge sim-badge--danger';
      }
    }
  }

  window.HelicopterResonanceSim = HelicopterResonanceSim;
})();
