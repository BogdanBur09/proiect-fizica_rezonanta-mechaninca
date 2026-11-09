/* ============================================================
   SLIDE7-ROTATING-MACHINERY.JS — Jeffcott / Laval Rotor Simulation
   Critical Speeds of Rotation, Unbalance Resonance & Self-Centering
   ============================================================ */

(function () {
  'use strict';

  class RotatingMachinerySim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Rotor Physical Parameters ---
      this.m = config.m || 2.5; // Rotor disk mass (kg)
      this.f0 = config.f0 || 50.0; // Natural lateral frequency (Hz) -> 3000 RPM
      this.omega0 = 2 * Math.PI * this.f0; // rad/s
      this.nCrit = Math.round((30 / Math.PI) * this.omega0); // 3000 RPM

      // Operational state
      this.rpm = config.rpm || 3000; // Current speed in RPM
      this.omega = (this.rpm * Math.PI) / 30; // rad/s
      this.eccentricity = config.eccentricity || 0.40; // Mechanical unbalance e (mm)
      this.baseEccentricity = this.eccentricity;
      this.zeta = config.zeta || 0.04; // Damping ratio (4% standard steel/bearing)
      this.isBalanced = false; // Dynamic balancing active

      // Auto-sweep (Run-up / coast-down test)
      this.sweeping = false;
      this.sweepDir = 1;

      // Shaft deflection coordinates (geometric center C in mm)
      this.r = 0; // Radial deflection amplitude (mm)
      this.phaseLag = 0; // Defazaj delta in radians
      this.thetaSpin = 0; // Shaft instantaneous spin angle (rad)
      this.whirlHistory = []; // Trajectory buffer of C (orbit)
      this.whirlMax = 80;

      // Casing clearance (mm)
      this.clearanceRadius = 6.5; // mm (rubbing threshold)
      this.rubbing = false;

      // Interactive graph cursor
      this.bodeRect = null;
      this.isTuningBode = false;

      this._computeSteadyState();
      this._bindEvents();
    }

    _computeSteadyState() {
      const rRatio = this.omega / (this.omega0 + 1e-9);
      const eEff = this.isBalanced ? 0.02 : this.eccentricity;

      // Theoretical Jeffcott amplitude: r = e * rRatio^2 / sqrt((1 - rRatio^2)^2 + (2 * zeta * rRatio)^2)
      const num = eEff * rRatio * rRatio;
      const den = Math.sqrt(Math.pow(1 - rRatio * rRatio, 2) + Math.pow(2 * this.zeta * rRatio, 2));
      const targetR = num / (den + 1e-9);

      // Phase lag: delta = atan2(2*zeta*rRatio, 1 - rRatio^2) in [0, pi]
      const delta = Math.atan2(2 * this.zeta * rRatio, 1 - rRatio * rRatio);

      // Smooth lag response
      if (this.r === 0) {
        this.r = targetR;
        this.phaseLag = delta;
      } else {
        this.r += (targetR - this.r) * 0.18;
        this.phaseLag += (delta - this.phaseLag) * 0.18;
      }

      this.rubbing = this.r >= this.clearanceRadius;
    }

    setRPM(newRPM) {
      this.rpm = Math.max(300, Math.min(7200, Math.round(newRPM)));
      this.omega = (this.rpm * Math.PI) / 30;

      const slider = document.getElementById('sim7-rpm');
      const valDisp = document.getElementById('sim7-rpm-val');
      if (slider) slider.value = this.rpm;
      if (valDisp) {
        const ratio = (this.omega / this.omega0).toFixed(2);
        valDisp.textContent = `${this.rpm} RPM (ω/ω₀ = ${ratio})`;
      }

      this._computeSteadyState();
      this._updateUIBadges();
      this.requestRender();
    }

    setEccentricity(e) {
      this.eccentricity = Math.max(0.02, Math.min(2.0, e));
      this.baseEccentricity = this.eccentricity;
      this.isBalanced = false;
      const btnBalance = document.getElementById('sim7-preset-balance');
      if (btnBalance) btnBalance.classList.remove('sim-btn--preset');

      const slider = document.getElementById('sim7-ecc');
      const valDisp = document.getElementById('sim7-ecc-val');
      if (slider) slider.value = this.eccentricity;
      if (valDisp) valDisp.textContent = `e = ${this.eccentricity.toFixed(2)} mm`;

      this._computeSteadyState();
      this._updateUIBadges();
      this.requestRender();
    }

    setDamping(z) {
      this.zeta = Math.max(0.01, Math.min(0.25, z));
      const slider = document.getElementById('sim7-zeta');
      const valDisp = document.getElementById('sim7-zeta-val');
      if (slider) slider.value = (this.zeta * 100).toFixed(1);
      if (valDisp) {
        const note = this.zeta > 0.12 ? '(Film de ulei / Amortizor)' : '(Lagăr standard)';
        valDisp.textContent = `ζ = ${(this.zeta * 100).toFixed(1)}% ${note}`;
      }

      this._computeSteadyState();
      this._updateUIBadges();
      this.requestRender();
    }

    toggleDynamicBalancing() {
      this.isBalanced = !this.isBalanced;
      const btn = document.getElementById('sim7-preset-balance');
      if (btn) {
        btn.classList.toggle('sim-btn--preset', this.isBalanced);
        btn.textContent = this.isBalanced ? '⚖️ Rotor Echilibrat (e ≈ 0)' : '⚖️ Echilibrare Dinamică';
      }
      this._computeSteadyState();
      this._updateUIBadges();
      this.requestRender();
    }

    onReset() {
      this.rpm = 3000;
      this.omega = (this.rpm * Math.PI) / 30;
      this.eccentricity = 0.40;
      this.baseEccentricity = 0.40;
      this.zeta = 0.04;
      this.isBalanced = false;
      this.sweeping = false;
      this.thetaSpin = 0;
      this.r = 0;
      this.phaseLag = 0;
      this.whirlHistory = [];
      this.rubbing = false;

      const btnSweep = document.getElementById('sim7-preset-sweep');
      if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
      const btnBal = document.getElementById('sim7-preset-balance');
      if (btnBal) {
        btnBal.classList.remove('sim-btn--preset');
        btnBal.textContent = '⚖️ Echilibrare Dinamică';
      }

      this.setRPM(3000);
      this.setEccentricity(0.40);
      this.setDamping(0.04);
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
        if (this.bodeRect &&
            pos.x >= this.bodeRect.x && pos.x <= this.bodeRect.x + this.bodeRect.w &&
            pos.y >= this.bodeRect.y && pos.y <= this.bodeRect.y + this.bodeRect.h) {
          this.isTuningBode = true;
          this.sweeping = false;
          const ratio = (pos.x - this.bodeRect.x) / this.bodeRect.w;
          this.setRPM(400 + ratio * (7000 - 400));
        }
      };

      const onMove = (e) => {
        const pos = getPos(e);
        if (this.isTuningBode && this.bodeRect) {
          const ratio = Math.max(0, Math.min(1, (pos.x - this.bodeRect.x) / this.bodeRect.w));
          this.setRPM(400 + ratio * (7000 - 400));
        }
      };

      const onEnd = () => {
        this.isTuningBode = false;
      };

      this.canvas.addEventListener('mousedown', onStart);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
    }

    onInit() {
      const rpmSlider = document.getElementById('sim7-rpm');
      const eccSlider = document.getElementById('sim7-ecc');
      const zetaSlider = document.getElementById('sim7-zeta');

      const btnSub = document.getElementById('sim7-preset-sub');
      const btnCrit = document.getElementById('sim7-preset-crit');
      const btnSuper = document.getElementById('sim7-preset-super');
      const btnSweep = document.getElementById('sim7-preset-sweep');
      const btnBal = document.getElementById('sim7-preset-balance');

      const playBtn = document.getElementById('sim7-play');
      const resetBtn = document.getElementById('sim7-reset');

      if (rpmSlider) {
        rpmSlider.value = this.rpm;
        rpmSlider.addEventListener('input', (e) => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setRPM(parseFloat(e.target.value));
        });
      }

      if (eccSlider) {
        eccSlider.value = this.eccentricity;
        eccSlider.addEventListener('input', (e) => {
          this.setEccentricity(parseFloat(e.target.value));
        });
      }

      if (zetaSlider) {
        zetaSlider.value = (this.zeta * 100).toFixed(1);
        zetaSlider.addEventListener('input', (e) => {
          this.setDamping(parseFloat(e.target.value) / 100);
        });
      }

      if (btnSub) {
        btnSub.addEventListener('click', () => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setRPM(1200);
          if (!this.running) this.start();
        });
      }

      if (btnCrit) {
        btnCrit.addEventListener('click', () => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setRPM(3000);
          if (!this.running) this.start();
        });
      }

      if (btnSuper) {
        btnSuper.addEventListener('click', () => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setRPM(6000);
          if (!this.running) this.start();
        });
      }

      if (btnSweep) {
        btnSweep.addEventListener('click', () => {
          this.sweeping = !this.sweeping;
          btnSweep.classList.toggle('sim-btn--preset', this.sweeping);
          if (this.sweeping && !this.running) this.start();
        });
      }

      if (btnBal) {
        btnBal.addEventListener('click', () => {
          this.toggleDynamicBalancing();
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
      if (this.sweeping) {
        this.rpm += this.sweepDir * 750 * dt;
        if (this.rpm >= 6800) {
          this.rpm = 6800;
          this.sweepDir = -1;
        } else if (this.rpm <= 600) {
          this.rpm = 600;
          this.sweepDir = 1;
        }
        this.setRPM(this.rpm);
      }

      // Spin rotation: dtheta = omega * dt
      // Visual scaling to keep spin smooth and clear
      const visualOmega = Math.min(25, this.omega * 0.15);
      this.thetaSpin += visualOmega * dt;

      this._computeSteadyState();

      // Record orbit coordinates of geometric center C
      // In rotating reference frame, C is at angle (thetaSpin - phaseLag)
      const angleC = this.thetaSpin - this.phaseLag;
      const cx = this.r * Math.cos(angleC);
      const cy = this.r * Math.sin(angleC);

      this.whirlHistory.push({ x: cx, y: cy });
      if (this.whirlHistory.length > this.whirlMax) {
        this.whirlHistory.shift();
      }

      this._updateUIBadges();
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

      this._renderRotorBench(ctx, 0, 0, W, topH);
      this._renderTelemetry(ctx, 0, topH, W, botH);
    }

    _renderRotorBench(ctx, x0, y0, w, h) {
      // 1. Lab Dark Background
      const bg = ctx.createLinearGradient(x0, y0, x0, y0 + h);
      bg.addColorStop(0, '#070f1e');
      bg.addColorStop(0.65, '#0b162c');
      bg.addColorStop(1, '#081022');
      ctx.fillStyle = bg;
      ctx.fillRect(x0, y0, w, h);

      // Subtle tech grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      for (let gx = 35; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, y0);
        ctx.lineTo(gx, y0 + h);
        ctx.stroke();
      }

      // Split top area:
      // Left 62%: 3D Isometric View of Flexible Shaft and Disk between Bearings
      // Right 38%: Axial Cross-Section (O, C, G and Orbit)
      const leftW = Math.round(w * 0.62);
      const rightW = w - leftW;

      this._renderIsometricShaft(ctx, x0, y0, leftW, h);
      this._renderDivider(ctx, x0 + leftW, y0, h);
      this._renderAxialOrbit(ctx, x0 + leftW, y0, rightW, h);
    }

    _renderIsometricShaft(ctx, x0, y0, w, h) {
      const pad = 12;
      const centerY = y0 + h * 0.50;
      const spanX0 = x0 + pad + 52;
      const spanX1 = x0 + w - pad - 52;
      const spanLen = spanX1 - spanX0;
      const midX = (spanX0 + spanX1) * 0.5;

      // Baseplate / Machine Bed
      const bedY = centerY + 46;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(spanX0 - 45, bedY, spanLen + 90, 16);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(spanX0 - 45, bedY, spanLen + 90, 16);

      // Bearings Housings (Left & Right)
      for (const bx of [spanX0, spanX1]) {
        // Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(bx - 16, centerY - 18, 32, bedY - (centerY - 18));
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 16, centerY - 18, 32, bedY - (centerY - 18));

        // Bearing Pillow Block
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(bx, centerY, 15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bearing brass sleeve
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(bx, centerY, 6, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Visual shaft deflection amplitude (scale: 1 mm real deflection = 5 px visual)
      const visualR = Math.min(36, this.r * 5.0);
      const angleC = this.thetaSpin - this.phaseLag;
      const dyMid = visualR * Math.sin(angleC);

      // Shaft Centerline & Bowed Geometry
      const segs = 36;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const px = spanX0 + u * spanLen;
        // Half-sine fundamental bending mode: y(x) = r_mid * sin(pi * u)
        const mode = Math.sin(Math.PI * u);
        const py = centerY + dyMid * mode;
        pts.push({ x: px, y: py });
      }

      // Draw Flexible Steel Shaft (gradient metallic rod)
      ctx.save();
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#94a3b8';
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // Shaft chrome reflection line
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#f8fafc';
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y - 1.5);
        else ctx.lineTo(pts[i].x, pts[i].y - 1.5);
      }
      ctx.stroke();
      ctx.restore();

      // Central Rotor Disk
      const diskRadius = Math.min(42, h * 0.28);
      const diskCenterY = centerY + dyMid;

      // Draw Stator Safety Clearance Ring at midspan
      ctx.save();
      ctx.strokeStyle = this.rubbing ? 'rgba(239, 68, 68, 0.8)' : 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = this.rubbing ? 2.5 : 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(midX, centerY, diskRadius * 0.35 + this.clearanceRadius * 5.0, diskRadius + this.clearanceRadius * 5.0, 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Rotor Disk Face (Ellipse in perspective)
      ctx.save();
      const diskGrad = ctx.createLinearGradient(midX - 15, diskCenterY - diskRadius, midX + 15, diskCenterY + diskRadius);
      diskGrad.addColorStop(0, '#475569');
      diskGrad.addColorStop(0.3, '#94a3b8');
      diskGrad.addColorStop(0.7, '#64748b');
      diskGrad.addColorStop(1, '#334155');

      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.ellipse(midX, diskCenterY, diskRadius * 0.34, diskRadius, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = this.rubbing ? '#ef4444' : '#cbd5e1';
      ctx.lineWidth = this.rubbing ? 3 : 2;
      ctx.stroke();

      // Disk hub
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(midX, diskCenterY, 8, 12, 0, 0, 2 * Math.PI);
      ctx.fill();

      // Rotating Spokes / Radial lines on disk
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < 4; a++) {
        const spokeAng = this.thetaSpin + (a * Math.PI) / 2;
        const sx = midX + Math.cos(spokeAng) * (diskRadius * 0.34 * 0.85);
        const sy = diskCenterY + Math.sin(spokeAng) * (diskRadius * 0.85);
        ctx.beginPath();
        ctx.moveTo(midX, diskCenterY);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      // Unbalance heavy spot (mass G) on the disk rim
      const unbalanceRadius = diskRadius * 0.72;
      const gx = midX + Math.cos(this.thetaSpin) * (unbalanceRadius * 0.34);
      const gy = diskCenterY + Math.sin(this.thetaSpin) * unbalanceRadius;

      // Heavy spot bolt (Red)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(gx, gy, 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Counter-balancing weight (if dynamic balancing active)
      if (this.isBalanced) {
        const cbX = midX + Math.cos(this.thetaSpin + Math.PI) * (unbalanceRadius * 0.34);
        const cbY = diskCenterY + Math.sin(this.thetaSpin + Math.PI) * unbalanceRadius;
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(cbX, cbY, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ecfdf5';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();

      // Title & Telemetry Header
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('STAND INDUSTRIAL — ROTOR JEFFCOTT FLEXIBIL', x0 + pad, y0 + 16);

      ctx.font = '600 10px Inter, monospace';
      ctx.textAlign = 'right';
      const statusColor = this.rubbing ? '#ef4444' : (Math.abs(this.rpm - this.nCrit) < 250 ? '#f59e0b' : '#38bdf8');
      ctx.fillStyle = statusColor;
      ctx.fillText(`Deflexiune: ${this.r.toFixed(2)} mm ${this.rubbing ? '(FRECARE STATOR!)' : ''}`, x0 + w - pad - 10, y0 + 16);
    }

    _renderAxialOrbit(ctx, x0, y0, w, h) {
      const pad = 10;
      const centerX = x0 + w * 0.5;
      const centerY = y0 + h * 0.52;
      const scaleOrbit = Math.min(w * 0.38, h * 0.38) / this.clearanceRadius;

      // Title
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('ORBITĂ AXIALĂ (PLAN X-Y)', centerX, y0 + 16);

      // Clearance limit circle (Stator Wall)
      ctx.strokeStyle = this.rubbing ? '#ef4444' : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = this.rubbing ? 2.5 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, this.clearanceRadius * scaleOrbit, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // Bearing Center O crosshairs
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 12, centerY);
      ctx.lineTo(centerX + 12, centerY);
      ctx.moveTo(centerX, centerY - 12);
      ctx.lineTo(centerX, centerY + 12);
      ctx.stroke();

      ctx.font = '600 9px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('O (Ax Lagăre)', centerX + 4, centerY - 4);

      // Trajectory Orbit Trace of C
      if (this.whirlHistory.length > 1) {
        ctx.strokeStyle = this.rubbing ? '#ef4444' : 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < this.whirlHistory.length; i++) {
          const pt = this.whirlHistory[i];
          const px = centerX + pt.x * scaleOrbit;
          const py = centerY + pt.y * scaleOrbit;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Current positions:
      // O = (0, 0)
      // C = geometric center of shaft
      const angleC = this.thetaSpin - this.phaseLag;
      const cxPx = centerX + this.r * Math.cos(angleC) * scaleOrbit;
      const cyPx = centerY + this.r * Math.sin(angleC) * scaleOrbit;

      // G = center of mass (distance e from C at angle thetaSpin)
      const eEff = this.isBalanced ? 0.02 : this.eccentricity;
      const gxPx = cxPx + eEff * Math.cos(this.thetaSpin) * scaleOrbit * 4.0;
      const gyPx = cyPx + eEff * Math.sin(this.thetaSpin) * scaleOrbit * 4.0;

      // Vector O -> C (Shaft Deflection r)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(cxPx, cyPx);
      ctx.stroke();

      // Vector C -> G (Eccentricity e)
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cxPx, cyPx);
      ctx.lineTo(gxPx, gyPx);
      ctx.stroke();

      // Point C (Geometric center)
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cxPx, cyPx, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Point G (Center of mass)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(gxPx, gyPx, 4.5, 0, 2 * Math.PI);
      ctx.fill();

      // Labels O, C, G
      ctx.font = '700 9px Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('C', cxPx + 5, cyPx + 4);
      ctx.fillStyle = '#f87171';
      ctx.fillText('G', gxPx + 5, gyPx + 4);

      // Phase Lag Arc between O-C line and C-G line
      const degLag = Math.round((this.phaseLag * 180) / Math.PI);
      ctx.font = '600 10px Inter, monospace';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(`Defazaj δ = ${degLag}°`, centerX, y0 + h - 12);
    }

    _renderDivider(ctx, x, y, h) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }

    _renderTelemetry(ctx, x, y, w, h) {
      const leftW = Math.round(w * 0.56);
      const rightW = w - leftW;

      this._renderBodePanel(ctx, x, y, leftW, h);
      this._renderBearingLoadsPanel(ctx, x + leftW, y, rightW, h);
    }

    _renderBodePanel(ctx, x, y, w, h) {
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
      ctx.fillText('CURBELE BODE — AMPLITUDINE r(n) ȘI DEFAZAJ δ(n)', cardX + 10, cardY + 15);

      const plotX = cardX + 38;
      const plotY = cardY + 24;
      const plotW = Math.max(50, cardW - 50);
      const plotH = Math.max(30, cardH - 44);

      this.bodeRect = { x: plotX, y: plotY, w: plotW, h: plotH };

      const minRPM = 400;
      const maxRPM = 7000;
      const maxAmpPlot = 14.0; // r/e scale

      // Grid lines (RPM ticks)
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      const rpmTicks = [1000, 2000, 3000, 4000, 5000, 6000];
      ctx.font = '500 9px monospace';
      ctx.textAlign = 'center';

      for (const rt of rpmTicks) {
        const tx = plotX + ((rt - minRPM) / (maxRPM - minRPM)) * plotW;
        ctx.beginPath();
        ctx.moveTo(tx, plotY);
        ctx.lineTo(tx, plotY + plotH);
        ctx.stroke();

        ctx.fillStyle = rt === 3000 ? '#f87171' : '#64748b';
        ctx.fillText(`${rt}`, tx, plotY + plotH + 11);
      }

      // Draw Critical Speed line at n = 3000 RPM
      const critX = plotX + ((3000 - minRPM) / (maxRPM - minRPM)) * plotW;
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(critX, plotY);
      ctx.lineTo(critX, plotY + plotH);
      ctx.stroke();
      ctx.restore();

      // Plot 1: Amplitude Curve r/e
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotX, plotY, plotW, plotH);
      ctx.clip();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const testRPM = minRPM + (i / steps) * (maxRPM - minRPM);
        const rRatio = testRPM / 3000;
        const den = Math.sqrt(Math.pow(1 - rRatio * rRatio, 2) + Math.pow(2 * this.zeta * rRatio, 2));
        const amp = Math.min(maxAmpPlot, (rRatio * rRatio) / (den + 1e-9));

        const px = plotX + (i / steps) * plotW;
        const py = plotY + plotH - (amp / maxAmpPlot) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Plot 2: Phase Curve delta / 180 degrees (Dashed Yellow)
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const testRPM = minRPM + (i / steps) * (maxRPM - minRPM);
        const rRatio = testRPM / 3000;
        const delta = Math.atan2(2 * this.zeta * rRatio, 1 - rRatio * rRatio); // 0 to pi
        const frac = delta / Math.PI; // 0 to 1

        const px = plotX + (i / steps) * plotW;
        const py = plotY + plotH - frac * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Current operating dot on Amplitude Curve
      const curRatio = this.omega / this.omega0;
      const curDen = Math.sqrt(Math.pow(1 - curRatio * curRatio, 2) + Math.pow(2 * this.zeta * curRatio, 2));
      const curAmpNorm = Math.min(maxAmpPlot, (curRatio * curRatio) / (curDen + 1e-9));

      const dotX = plotX + ((this.rpm - minRPM) / (maxRPM - minRPM)) * plotW;
      const dotY = plotY + plotH - (curAmpNorm / maxAmpPlot) * plotH;

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Current RPM line
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(dotX, plotY);
      ctx.lineTo(dotX, plotY + plotH);
      ctx.stroke();
      ctx.restore();
    }

    _renderBearingLoadsPanel(ctx, x, y, w, h) {
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
      ctx.fillText('SOLICITĂRI DINAMICE ÎN LAGĂRE', cardX + 10, cardY + 15);

      // Dynamic Bearing Force: F = k * r / 2 = m * omega0^2 * r / 2
      const kShaft = this.m * this.omega0 * this.omega0; // N/m
      const rMeters = (this.r / 1000);
      const forcePerBearing = Math.round((kShaft * rMeters) * 0.5); // Newtons

      const rowH = Math.max(16, (cardH - 36) / 3);

      // Row 1: Deflexiune r
      const rFrac = Math.min(1.0, this.r / this.clearanceRadius);
      this._renderGaugeRow(ctx, cardX + 10, cardY + 24, cardW - 20, 'Deflexiune Arbore (r):', `${this.r.toFixed(2)} mm`, rFrac, rFrac > 0.85);

      // Row 2: Forță Dinamică Lagăr
      const maxForceRef = 1200; // N
      const fFrac = Math.min(1.0, forcePerBearing / maxForceRef);
      this._renderGaugeRow(ctx, cardX + 10, cardY + 24 + rowH, cardW - 20, 'Forță / Rulment:', `${forcePerBearing} N`, fFrac, fFrac > 0.85);

      // Row 3: Regim de Funcționare
      const bottomY = cardY + cardH - 12;
      ctx.font = '700 10px Inter, sans-serif';
      ctx.textAlign = 'left';

      let regimeText = 'SUB-CRITIC (Cvasistatic — Masele în fază)';
      let regimeColor = '#34d399';

      if (this.isBalanced) {
        regimeText = '🛡️ ECHILIBRAT DINAMIC (Vibrații Minime)';
        regimeColor = '#34d399';
      } else if (this.rubbing) {
        regimeText = '💥 AVARIE: FRECARE STATOR (RUBBING)!';
        regimeColor = '#ef4444';
      } else if (Math.abs(this.rpm - this.nCrit) < 250) {
        regimeText = '⚠️ REZONANȚĂ CRITICĂ (n ≈ 3000 RPM, δ = 90°)';
        regimeColor = '#ef4444';
      } else if (this.rpm > 3600) {
        regimeText = '🛡️ AUTO-CENTRARE LAVAL (δ → 180°, G pe ax)';
        regimeColor = '#38bdf8';
      }

      ctx.fillStyle = regimeColor;
      ctx.fillText(regimeText, cardX + 10, bottomY);
    }

    _renderGaugeRow(ctx, x, y, w, label, valueStr, frac, isDanger) {
      ctx.font = '600 9.5px Inter, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(label, x, y + 10);

      const barX = x + 130;
      const barW = Math.max(40, w - 195);

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
      const rpmBadge = document.getElementById('sim7-rpm-badge');
      const rBadge = document.getElementById('sim7-r-badge');
      const phaseBadge = document.getElementById('sim7-phase-badge');

      if (rpmBadge) {
        rpmBadge.textContent = `${this.rpm} RPM (${(this.omega / this.omega0).toFixed(2)}× n_cr)`;
        rpmBadge.className = Math.abs(this.rpm - this.nCrit) < 250 ? 'sim-badge sim-badge--danger' : 'sim-badge sim-badge--cyan';
      }

      if (rBadge) {
        rBadge.textContent = `Vibrație r: ${this.r.toFixed(2)} mm`;
        rBadge.className = this.rubbing ? 'sim-badge sim-badge--danger' : (this.r > 3.0 ? 'sim-badge sim-badge--amber' : 'sim-badge sim-badge--cyan');
      }

      if (phaseBadge) {
        const deg = Math.round((this.phaseLag * 180) / Math.PI);
        phaseBadge.textContent = `Defazaj δ: ${deg}°`;
      }
    }
  }

  window.RotatingMachinerySim = RotatingMachinerySim;
})();
