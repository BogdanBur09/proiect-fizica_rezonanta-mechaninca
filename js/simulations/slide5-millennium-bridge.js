/* ============================================================
   SLIDE5-MILLENNIUM-BRIDGE.JS — London Millennium Footbridge (2000)
   Synchronous Lateral Excitation (SLE) & Kuramoto Crowd Synchronization
   ============================================================ */

(function () {
  'use strict';

  class MillenniumBridgeSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Physical Parameters of Millennium Footbridge (South Span / Center Span) ---
      this.f0 = config.f0 || 0.90; // Natural lateral frequency (Hz)
      this.omega0 = 2 * Math.PI * this.f0; // ~5.65 rad/s
      this.modalMass = 113000; // Modal mass (kg)
      this.baseZeta = 0.005; // 0.5% natural structural damping (extremely low!)
      this.zeta = this.baseZeta; // Current damping ratio
      this.damperActive = false; // 2002 viscous dampers retrofit

      // --- Bridge Modal State ---
      this.Y = 0; // Lateral modal displacement at midspan (m)
      this.vY = 0; // Lateral modal velocity (m/s)
      this.aY = 0; // Lateral modal acceleration (m/s^2)
      this.bridgePhase = 0; // Phase of bridge velocity

      // --- Pedestrian Population (Kuramoto model) ---
      this.N = config.N || 180; // Default pedestrian count (Ncrit ≈ 160)
      this.Ncrit = 160; // Theoretical critical threshold for south span
      this.couplingK = config.couplingK || 2.2; // Coupling sensitivity to bridge motion
      this.lateralForceG = 30; // Lateral force per pedestrian (N) ~ 4% body weight
      this.pedestrians = [];

      // --- Order Parameter (Kuramoto R) ---
      this.orderR = 0; // 0 (random) to 1 (perfectly locked)
      this.meanPhase = 0;

      // --- Telemetry & History Buffer ---
      this.history = [];
      this.historyMax = 260;
      this.peakAmplitudeMm = 0;

      // --- Interaction State ---
      this.isDraggingBridge = false;
      this.mousePos = { x: 0, y: 0 };

      // Initialize pedestrian pool
      this._initPedestrians();
      this._bindEvents();
    }

    _initPedestrians() {
      this.pedestrians = [];
      const bridgeLen = 1.0; // normalized [0, 1]

      const colors = [
        '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb7185',
        '#34d399', '#fbbf24', '#f97316', '#e2e8f0', '#94a3b8'
      ];

      for (let i = 0; i < this.N; i++) {
        // Walking direction: +1 (South to North) or -1 (North to South)
        const dir = Math.random() < 0.5 ? 1 : -1;
        // Position along bridge length [0.05, 0.95]
        const u = 0.05 + Math.random() * 0.90;
        // Lateral lane on walkway [-0.75, 0.75]
        const lane = (Math.random() - 0.5) * 1.5;
        // Walking velocity along bridge (m/s) ~ 1.1 to 1.4 m/s
        const speed = 0.0016 + Math.random() * 0.0008;
        // Natural lateral walking frequency (Hz): Gaussian-like around 0.90 Hz
        const fWalk = 0.82 + Math.random() * 0.16 + (Math.random() - 0.5) * 0.04;
        const omegaWalk = 2 * Math.PI * fWalk;
        // Random initial phase
        const phase = Math.random() * 2 * Math.PI;

        this.pedestrians.push({
          id: i,
          u: u,
          dir: dir,
          lane: lane,
          speed: speed,
          fWalk: fWalk,
          omega: omegaWalk,
          phase: phase,
          color: colors[i % colors.length],
          locked: false,
          waddleAmp: 0
        });
      }
    }

    setPedestrianCount(newCount) {
      this.N = Math.max(10, Math.min(400, Math.round(newCount)));
      if (this.pedestrians.length < this.N) {
        const colors = [
          '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb7185',
          '#34d399', '#fbbf24', '#f97316', '#e2e8f0', '#94a3b8'
        ];
        while (this.pedestrians.length < this.N) {
          const i = this.pedestrians.length;
          const dir = Math.random() < 0.5 ? 1 : -1;
          const u = 0.05 + Math.random() * 0.90;
          const lane = (Math.random() - 0.5) * 1.5;
          const speed = 0.0016 + Math.random() * 0.0008;
          const fWalk = 0.82 + Math.random() * 0.16;
          this.pedestrians.push({
            id: i,
            u: u,
            dir: dir,
            lane: lane,
            speed: speed,
            fWalk: fWalk,
            omega: 2 * Math.PI * fWalk,
            phase: Math.random() * 2 * Math.PI,
            color: colors[i % colors.length],
            locked: false,
            waddleAmp: 0
          });
        }
      } else if (this.pedestrians.length > this.N) {
        this.pedestrians.length = this.N;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    setDamperRetrofit(active) {
      this.damperActive = !!active;
      // When dampers are installed, damping ratio jumps from 0.5% to 22%!
      this.zeta = this.damperActive ? 0.22 : this.baseZeta;
      this._updateUIBadges();
      this.requestRender();
    }

    forceSynchronization() {
      // Force all pedestrians into exact lockstep with bridge velocity phase
      const targetPhase = Math.atan2(this.vY, -this.omega0 * this.Y + 1e-6);
      for (let p of this.pedestrians) {
        p.phase = targetPhase + (Math.random() - 0.5) * 0.15;
      }
      this.requestRender();
    }

    scatterCrowd() {
      // Randomize all phases completely
      for (let p of this.pedestrians) {
        p.phase = Math.random() * 2 * Math.PI;
      }
      this.requestRender();
    }

    requestRender() {
      if (!this.running) {
        this.render();
      }
    }

    onInit() {
      // Connect to GUI inputs
      const nSlider = document.getElementById('sim5-pedestrians');
      const nVal = document.getElementById('sim5-pedestrians-val');
      const f0Slider = document.getElementById('sim5-f0');
      const f0Val = document.getElementById('sim5-f0-val');
      const zetaSlider = document.getElementById('sim5-zeta');
      const zetaVal = document.getElementById('sim5-zeta-val');

      const btnSub = document.getElementById('sim5-preset-sub');
      const btn2000 = document.getElementById('sim5-preset-2000');
      const btnDamper = document.getElementById('sim5-preset-damper');
      const btnSync = document.getElementById('sim5-preset-sync');
      const btnScatter = document.getElementById('sim5-preset-scatter');

      const playBtn = document.getElementById('sim5-play');
      const resetBtn = document.getElementById('sim5-reset');
      const damperBtn = document.getElementById('sim5-damper-btn');

      if (nSlider) {
        nSlider.value = this.N;
        nSlider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          this.setPedestrianCount(val);
          if (nVal) nVal.textContent = `${val} pietoni`;
        });
      }

      if (f0Slider) {
        f0Slider.value = this.f0;
        f0Slider.addEventListener('input', (e) => {
          this.f0 = parseFloat(e.target.value);
          this.omega0 = 2 * Math.PI * this.f0;
          if (f0Val) f0Val.textContent = `${this.f0.toFixed(2)} Hz`;
          this.requestRender();
        });
      }

      if (zetaSlider) {
        zetaSlider.value = (this.zeta * 100).toFixed(1);
        zetaSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.zeta = val / 100;
          this.baseZeta = this.zeta;
          this.damperActive = this.zeta > 0.15;
          if (zetaVal) zetaVal.textContent = `${val.toFixed(1)}% ${this.damperActive ? '(cu amortizoare)' : '(fără amortizoare)'}`;
          this._updateUIBadges();
          this.requestRender();
        });
      }

      if (btnSub) {
        btnSub.addEventListener('click', () => {
          this.setDamperRetrofit(false);
          this.setPedestrianCount(50);
          this.zeta = 0.005;
          this.baseZeta = 0.005;
          this.scatterCrowd();
          if (nSlider) nSlider.value = 50;
          if (nVal) nVal.textContent = '50 pietoni';
          if (zetaSlider) zetaSlider.value = 0.5;
          if (zetaVal) zetaVal.textContent = '0.5% (fără amortizoare)';
          if (!this.running) this.start();
        });
      }

      if (btn2000) {
        btn2000.addEventListener('click', () => {
          this.setDamperRetrofit(false);
          this.setPedestrianCount(250);
          this.zeta = 0.005;
          this.baseZeta = 0.005;
          if (nSlider) nSlider.value = 250;
          if (nVal) nVal.textContent = '250 pietoni';
          if (zetaSlider) zetaSlider.value = 0.5;
          if (zetaVal) zetaVal.textContent = '0.5% (fără amortizoare)';
          if (!this.running) this.start();
        });
      }

      if (btnDamper) {
        btnDamper.addEventListener('click', () => {
          this.setDamperRetrofit(!this.damperActive);
          if (zetaSlider) zetaSlider.value = (this.zeta * 100).toFixed(1);
          if (zetaVal) zetaVal.textContent = `${(this.zeta * 100).toFixed(1)}% ${this.damperActive ? '(cu amortizoare)' : '(fără amortizoare)'}`;
        });
      }

      if (btnSync) {
        btnSync.addEventListener('click', () => {
          this.forceSynchronization();
          if (!this.running) this.start();
        });
      }

      if (btnScatter) {
        btnScatter.addEventListener('click', () => {
          this.scatterCrowd();
        });
      }

      if (damperBtn) {
        damperBtn.addEventListener('click', () => {
          this.setDamperRetrofit(!this.damperActive);
          if (zetaSlider) zetaSlider.value = (this.zeta * 100).toFixed(1);
          if (zetaVal) zetaVal.textContent = `${(this.zeta * 100).toFixed(1)}% ${this.damperActive ? '(cu amortizoare)' : '(fără amortizoare)'}`;
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
          if (nSlider) nSlider.value = this.N;
          if (nVal) nVal.textContent = `${this.N} pietoni`;
          if (zetaSlider) zetaSlider.value = (this.zeta * 100).toFixed(1);
          if (zetaVal) zetaVal.textContent = `${(this.zeta * 100).toFixed(1)}% (fără amortizoare)`;
          this.start();
        });
      }

      this._updateUIBadges();
    }

    onReset() {
      this.Y = 0;
      this.vY = 0;
      this.aY = 0;
      this.history = [];
      this.peakAmplitudeMm = 0;
      this.damperActive = false;
      this.zeta = this.baseZeta;
      this._initPedestrians();
      this._updateUIBadges();
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
        this.mousePos = pos;
        const topH = this.H * 0.58;
        // Check if clicked in bridge area
        if (pos.y < topH && pos.y > 40) {
          this.isDraggingBridge = true;
        }
      };

      const onMove = (e) => {
        const pos = getPos(e);
        this.mousePos = pos;
        if (this.isDraggingBridge) {
          const bridgeCenterY = this.H * 0.58 * 0.50;
          const dy = (pos.y - bridgeCenterY);
          // 1 px = 0.001 m lateral deflection
          this.Y = Math.max(-0.12, Math.min(0.12, dy * 0.0015));
          this.vY = 0;
          this.requestRender();
        }
      };

      const onEnd = () => {
        this.isDraggingBridge = false;
      };

      this.canvas.addEventListener('mousedown', onStart);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
    }

    update(dt) {
      // Numerical sub-stepping for smooth physics
      const subSteps = 4;
      const subDt = Math.min(dt, 0.033) / subSteps;

      for (let step = 0; step < subSteps; step++) {
        this._physicsStep(subDt);
      }

      // Record telemetry in history buffer
      const ampMm = this.Y * 1000;
      if (Math.abs(ampMm) > this.peakAmplitudeMm) {
        this.peakAmplitudeMm = Math.abs(ampMm);
      }

      this.history.push({
        y: ampMm,
        r: this.orderR,
        damper: this.damperActive
      });
      if (this.history.length > this.historyMax) {
        this.history.shift();
      }

      this._updateUIBadges();
    }

    _physicsStep(dt) {
      if (this.isDraggingBridge) return;

      const omega0Sq = this.omega0 * this.omega0;
      const twoZetaOmega0 = 2 * this.zeta * this.omega0;

      // Calculate bridge phase based on phase plane (Y, vY / omega0)
      this.bridgePhase = Math.atan2(this.vY, -this.omega0 * this.Y);

      // Order parameter vector sum (Kuramoto)
      let sumCos = 0;
      let sumSin = 0;
      let totalModalForce = 0;

      const deckSpeedMm = Math.abs(this.vY * 1000); // mm/s
      // Waddling adaptation factor: higher sway velocity triggers stronger lock-in
      // Humans perceive sway when velocity > 10 mm/s; at 50 mm/s lock-in is near total
      const perceptionScale = Math.min(1.0, deckSpeedMm / 40);

      for (let i = 0; i < this.pedestrians.length; i++) {
        const p = this.pedestrians[i];

        // 1. Move pedestrian along bridge length
        p.u += p.dir * p.speed * dt * 60;
        if (p.u > 0.96) {
          p.u = 0.96;
          p.dir = -1;
          p.lane = (Math.random() - 0.5) * 1.5;
        } else if (p.u < 0.04) {
          p.u = 0.04;
          p.dir = 1;
          p.lane = (Math.random() - 0.5) * 1.5;
        }

        // 2. Spatial mode shape factor at pedestrian location: phi(x) = sin(pi * u)
        const phiX = Math.sin(Math.PI * p.u);

        // 3. Kuramoto phase adaptation:
        // People sync to the lateral deck movement (bridgePhase) to keep footing!
        // dθ_i/dt = Ω_i + K * perceptionScale * sin(bridgePhase - θ_i)
        const phaseDiff = this.bridgePhase - p.phase;
        const syncDrift = this.couplingK * perceptionScale * Math.sin(phaseDiff);
        p.phase += (p.omega + syncDrift) * dt;
        p.phase = (p.phase + 2 * Math.PI) % (2 * Math.PI);

        // Pedestrian waddling amplitude adapts to bridge sway
        p.waddleAmp = 0.2 + 0.8 * perceptionScale;
        p.locked = Math.abs(Math.sin(phaseDiff)) < 0.35 && deckSpeedMm > 15;

        // 4. Force exerted by pedestrian:
        // Positive foot force pushes lateral deck: F_i = G * sin(theta_i) * phi(x_i)
        const fLat = this.lateralForceG * Math.sin(p.phase);
        totalModalForce += fLat * phiX;

        // Sum for order parameter R
        sumCos += Math.cos(p.phase);
        sumSin += Math.sin(p.phase);
      }

      // Compute Kuramoto Order Parameter R in [0, 1]
      const len = this.pedestrians.length || 1;
      this.orderR = Math.hypot(sumCos, sumSin) / len;
      this.meanPhase = Math.atan2(sumSin, sumCos);

      // Equation of Motion for Bridge Midspan:
      // Y'' + 2*zeta*omega0*Y' + omega0^2*Y = F_modal / M_modal
      // Add non-linear cubic cable geometric stiffening to cap at physical limits
      const nonlinStiffness = 1.0 + 35.0 * (this.Y * this.Y);
      const accel = (totalModalForce / this.modalMass) - (twoZetaOmega0 * this.vY) - (omega0Sq * nonlinStiffness * this.Y);

      // Velocity Verlet / RK2 integration
      this.vY += accel * dt;
      // Physical hard clamp at extreme amplitude (+- 120 mm)
      this.vY = Math.max(-0.45, Math.min(0.45, this.vY));
      this.Y += this.vY * dt;
      this.Y = Math.max(-0.12, Math.min(0.12, this.Y));
      this.aY = accel;
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;

      ctx.clearRect(0, 0, W, H);

      // Layout:
      // Top 58%: River Thames & 2.5D Millennium Bridge Deck with moving crowd
      // Bottom 42%: Telemetry (Left: Oscillation Waveform Y(t); Right: Kuramoto Phase Circle)
      const topH = Math.round(H * 0.58);
      const botH = H - topH;

      this._renderThamesBridge(ctx, 0, 0, W, topH);
      this._renderDivider(ctx, 0, topH, W);
      this._renderTelemetry(ctx, 0, topH, W, botH);
    }

    _renderThamesBridge(ctx, x0, y0, w, h) {
      // 1. Water Background (River Thames)
      const waterGrad = ctx.createLinearGradient(x0, y0, x0, y0 + h);
      waterGrad.addColorStop(0, '#061a29');
      waterGrad.addColorStop(0.5, '#0b2940');
      waterGrad.addColorStop(1, '#071d2e');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(x0, y0, w, h);

      // Shimmering wave lines on water
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1.2;
      const t = this.time * 1.5;
      for (let wy = y0 + 15; wy < y0 + h - 15; wy += 22) {
        ctx.beginPath();
        for (let wx = x0; wx <= x0 + w; wx += 25) {
          const dy = Math.sin((wx * 0.02) + t + wy * 0.05) * 3;
          if (wx === x0) ctx.moveTo(wx, wy + dy);
          else ctx.lineTo(wx, wy + dy);
        }
        ctx.stroke();
      }
      ctx.restore();

      // 2. River Banks (Piers of London: North City at right, Southwark at left)
      const bankW = Math.max(40, w * 0.07);
      const bankGradL = ctx.createLinearGradient(x0, y0, x0 + bankW, y0);
      bankGradL.addColorStop(0, '#1e293b');
      bankGradL.addColorStop(1, '#0f172a');
      ctx.fillStyle = bankGradL;
      ctx.fillRect(x0, y0, bankW, h);

      const bankGradR = ctx.createLinearGradient(x0 + w - bankW, y0, x0 + w, y0);
      bankGradR.addColorStop(0, '#0f172a');
      bankGradR.addColorStop(1, '#1e293b');
      ctx.fillStyle = bankGradR;
      ctx.fillRect(x0 + w - bankW, y0, bankW, h);

      // Bank labels
      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAL SUD (TATE MODERN)', x0 + bankW * 0.5, y0 + 18);
      ctx.fillText('MAL NORD (ST. PAUL\'S)', x0 + w - bankW * 0.5, y0 + 18);
      ctx.restore();

      // 3. Bridge Geometry
      const spanX0 = x0 + bankW;
      const spanX1 = x0 + w - bankW;
      const spanLen = spanX1 - spanX0;
      const bridgeCenterY = y0 + h * 0.50;
      const deckWidth = Math.max(34, Math.min(50, h * 0.22));

      // Visual lateral deflection scale: 1 mm real = 0.55 px on canvas
      const scaleLateral = 0.55;
      const lateralShiftMid = this.Y * 1000 * scaleLateral;

      // Calculate path points for deformed bridge
      const segments = 48;
      const ptsTop = [];
      const ptsBot = [];
      const ptsCenter = [];

      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const px = spanX0 + u * spanLen;
        // Fundamental lateral bending mode: Y(x) = Y_mid * sin(pi * u)
        const latOffset = lateralShiftMid * Math.sin(Math.PI * u);
        const py = bridgeCenterY + latOffset;

        ptsCenter.push({ x: px, y: py, latOffset: latOffset });
        ptsTop.push({ x: px, y: py - deckWidth * 0.5 });
        ptsBot.push({ x: px, y: py + deckWidth * 0.5 });
      }

      // 4. Draw Viscous Dampers underneath the deck (if active or retrofit shown)
      this._renderDampers(ctx, ptsCenter, bridgeCenterY, deckWidth);

      // 5. Draw Bridge Shadow on Water
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ptsTop[0].x, ptsTop[0].y + 14);
      for (let p of ptsTop) ctx.lineTo(p.x, p.y + 14);
      for (let i = ptsBot.length - 1; i >= 0; i--) ctx.lineTo(ptsBot[i].x, ptsBot[i].y + 14);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.filter = 'blur(4px)';
      ctx.fill();
      ctx.restore();

      // 6. Draw Bridge Deck Surface (Metallic Aluminum / Steel Planking)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ptsTop[0].x, ptsTop[0].y);
      for (let p of ptsTop) ctx.lineTo(p.x, p.y);
      for (let i = ptsBot.length - 1; i >= 0; i--) ctx.lineTo(ptsBot[i].x, ptsBot[i].y);
      ctx.closePath();

      const deckGrad = ctx.createLinearGradient(0, bridgeCenterY - deckWidth, 0, bridgeCenterY + deckWidth);
      deckGrad.addColorStop(0, '#334155');
      deckGrad.addColorStop(0.2, '#64748b');
      deckGrad.addColorStop(0.5, '#475569');
      deckGrad.addColorStop(0.8, '#64748b');
      deckGrad.addColorStop(1, '#334155');
      ctx.fillStyle = deckGrad;
      ctx.fill();

      // Walkway border rails
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center walkway dividing line (dashed)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < ptsCenter.length; i++) {
        if (i === 0) ctx.moveTo(ptsCenter[i].x, ptsCenter[i].y);
        else ctx.lineTo(ptsCenter[i].x, ptsCenter[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 7. Suspension Cables (Characteristic shallow side-cables of Millennium Bridge)
      this._renderCables(ctx, spanX0, spanX1, bridgeCenterY, deckWidth, lateralShiftMid);

      // 8. Render Pedestrians on Walkway
      this._renderPedestrians(ctx, spanX0, spanLen, bridgeCenterY, deckWidth, lateralShiftMid);

      // 9. Midspan Deflection Marker & Dimension Arrow
      this._renderDeflectionHUD(ctx, spanX0 + spanLen * 0.5, bridgeCenterY, lateralShiftMid);
    }

    _renderDampers(ctx, ptsCenter, baseY, deckWidth) {
      // 37 Viscous Dampers were retrofitted beneath the deck chevron brackets
      // We draw 7 representative damper pistons under the deck
      const damperIndices = [6, 12, 18, 24, 30, 36, 42];
      ctx.save();

      for (let idx of damperIndices) {
        if (!ptsCenter[idx]) continue;
        const pt = ptsCenter[idx];
        const anchorY = baseY + (pt.y > baseY ? -deckWidth * 0.65 : deckWidth * 0.65);

        // Cylinder Body
        ctx.strokeStyle = this.damperActive ? '#fbbf24' : 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = this.damperActive ? 3.5 : 2;
        ctx.beginPath();
        ctx.moveTo(pt.x, baseY);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        // Piston Head
        ctx.fillStyle = this.damperActive ? '#f59e0b' : '#475569';
        ctx.beginPath();
        ctx.arc(pt.x, (baseY + pt.y) * 0.5, this.damperActive ? 4.5 : 3, 0, 2 * Math.PI);
        ctx.fill();

        // Active glowing aura
        if (this.damperActive && Math.abs(this.vY) > 0.01) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(pt.x, baseY);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _renderCables(ctx, x0, x1, baseY, deckWidth, shiftMid) {
      // Shallow steel suspension cables flanking the deck
      const cableYOffset = deckWidth * 0.62;
      ctx.save();
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.75)';
      ctx.lineWidth = 2.2;

      // North side cable
      ctx.beginPath();
      ctx.moveTo(x0, baseY - cableYOffset);
      ctx.quadraticCurveTo((x0 + x1) * 0.5, baseY - cableYOffset + shiftMid * 0.6, x1, baseY - cableYOffset);
      ctx.stroke();

      // South side cable
      ctx.beginPath();
      ctx.moveTo(x0, baseY + cableYOffset);
      ctx.quadraticCurveTo((x0 + x1) * 0.5, baseY + cableYOffset + shiftMid * 0.6, x1, baseY + cableYOffset);
      ctx.stroke();

      // Transverse cable outriggers (arms supporting the deck)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      const count = 12;
      for (let i = 1; i < count; i++) {
        const u = i / count;
        const cx = x0 + u * (x1 - x0);
        const lat = shiftMid * Math.sin(Math.PI * u);
        const cy = baseY + lat;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cableYOffset);
        ctx.lineTo(cx, cy + cableYOffset);
        ctx.stroke();
      }
      ctx.restore();
    }

    _renderPedestrians(ctx, spanX0, spanLen, baseY, deckWidth, shiftMid) {
      ctx.save();

      for (let p of this.pedestrians) {
        const px = spanX0 + p.u * spanLen;
        const deckLatOffset = shiftMid * Math.sin(Math.PI * p.u);
        const laneOffset = p.lane * (deckWidth * 0.35);
        const py = baseY + deckLatOffset + laneOffset;

        // Step alternation (waddling motion)
        // When sin(phase) > 0, left foot pushes left; when < 0, right foot pushes right
        const stepSway = Math.sin(p.phase);
        const footSpread = 3.5 * (1 + (p.waddleAmp || 0) * 0.8);
        const footOffsetLat = stepSway * footSpread;

        // Draw synchronized halo glow if locked into collective sway
        if (p.locked && this.orderR > 0.45) {
          ctx.fillStyle = stepSway > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.35)';
          ctx.beginPath();
          ctx.arc(px, py, 9, 0, 2 * Math.PI);
          ctx.fill();
        }

        // 1. Two Feet / Shoes
        ctx.fillStyle = '#0f172a';
        // Left foot
        ctx.beginPath();
        ctx.ellipse(px - 2.5 * p.dir, py - footOffsetLat - 2, 2.2, 1.2, 0, 0, 2 * Math.PI);
        ctx.fill();
        // Right foot
        ctx.beginPath();
        ctx.ellipse(px + 2.5 * p.dir, py + footOffsetLat + 2, 2.2, 1.2, 0, 0, 2 * Math.PI);
        ctx.fill();

        // 2. Shoulders / Body
        ctx.fillStyle = p.locked ? (stepSway > 0 ? '#ef4444' : '#0284c7') : p.color;
        ctx.beginPath();
        ctx.ellipse(px, py, 4.2, 2.6, (stepSway * 0.25), 0, 2 * Math.PI);
        ctx.fill();

        // 3. Head
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, 2 * Math.PI);
        ctx.fill();

        // 4. If synchronized, show lateral push force arrow
        if (p.locked && this.orderR > 0.55 && Math.abs(stepSway) > 0.4) {
          ctx.strokeStyle = stepSway > 0 ? '#ef4444' : '#38bdf8';
          ctx.lineWidth = 1.5;
          const arrowLen = stepSway * 7;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + arrowLen);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    _renderDeflectionHUD(ctx, midX, baseY, shiftMid) {
      const ampMm = Math.round(this.Y * 1000);
      const absMm = Math.abs(ampMm);

      ctx.save();
      // Midline reference
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(midX, baseY - 35);
      ctx.lineTo(midX, baseY + 35);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dynamic arrow showing current displacement
      if (absMm > 2) {
        ctx.strokeStyle = absMm > 45 ? '#ef4444' : (absMm > 18 ? '#fbbf24' : '#38bdf8');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(midX, baseY);
        ctx.lineTo(midX, baseY + shiftMid);
        ctx.stroke();

        // Arrow tip
        const dir = shiftMid > 0 ? 1 : -1;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(midX, baseY + shiftMid);
        ctx.lineTo(midX - 3.5, baseY + shiftMid - dir * 5);
        ctx.lineTo(midX + 3.5, baseY + shiftMid - dir * 5);
        ctx.closePath();
        ctx.fill();
      }

      // Measurement tag
      ctx.font = '600 11px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = absMm > 45 ? '#f87171' : (absMm > 18 ? '#fcd34d' : '#e2e8f0');
      const tagText = `ΔY = ${ampMm > 0 ? '+' : ''}${ampMm} mm`;
      ctx.fillText(tagText, midX, baseY - 24);

      ctx.restore();
    }

    _renderDivider(ctx, x, y, w) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    }

    _renderTelemetry(ctx, x, y, w, h) {
      // Split bottom area:
      // Left 56%: Real-time Waveform Y(t) in mm
      // Right 44%: Kuramoto Phase Dial & Sincronizare Mulțime
      const leftW = Math.round(w * 0.56);
      const rightW = w - leftW;

      this._renderWaveformPanel(ctx, x, y, leftW, h);
      this._renderKuramotoPanel(ctx, x + leftW, y, rightW, h);
    }

    _renderWaveformPanel(ctx, x, y, w, h) {
      const pad = 12;
      const plotX = x + pad + 38;
      const plotY = y + pad + 18;
      const plotW = w - pad * 2 - 44;
      const plotH = h - pad * 2 - 24;
      const midY = plotY + plotH * 0.5;

      // Background card
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);

      // Title
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('OSCILOGRAMĂ BALANS LATERAL Y(t) [mm]', x + pad + 10, y + pad + 14);

      // Zone bands
      // Danger zone (> +- 45 mm)
      // Max Y scale: +- 100 mm
      const maxScaleMm = 100;
      const dangerPx = (45 / maxScaleMm) * (plotH * 0.5);
      const safePx = (15 / maxScaleMm) * (plotH * 0.5);

      // Danger band fill
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fillRect(plotX, plotY, plotW, (plotH * 0.5) - dangerPx);
      ctx.fillRect(plotX, midY + dangerPx, plotW, (plotH * 0.5) - dangerPx);

      // Caution band fill
      ctx.fillStyle = 'rgba(251, 191, 36, 0.07)';
      ctx.fillRect(plotX, midY - dangerPx, plotW, dangerPx - safePx);
      ctx.fillRect(plotX, midY + safePx, plotW, dangerPx - safePx);

      // Safe band fill
      ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
      ctx.fillRect(plotX, midY - safePx, plotW, safePx * 2);

      // Grid lines & Axis labels
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;

      const levels = [-80, -45, 0, 45, 80];
      ctx.font = '500 9px monospace';
      ctx.textAlign = 'right';

      for (let lvl of levels) {
        const ly = midY - (lvl / maxScaleMm) * (plotH * 0.5);
        ctx.beginPath();
        ctx.moveTo(plotX, ly);
        ctx.lineTo(plotX + plotW, ly);
        ctx.stroke();

        ctx.fillStyle = lvl === 0 ? '#94a3b8' : (Math.abs(lvl) >= 45 ? '#f87171' : '#64748b');
        ctx.fillText(`${lvl > 0 ? '+' : ''}${lvl}`, plotX - 5, ly + 3);
      }

      // Plot waveform history
      if (this.history.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(plotX, plotY, plotW, plotH);
        ctx.clip();

        ctx.lineWidth = 2.2;
        const stepX = plotW / (this.historyMax - 1);

        for (let i = 0; i < this.history.length; i++) {
          const pt = this.history[i];
          const px = plotX + i * stepX;
          const py = midY - (pt.y / maxScaleMm) * (plotH * 0.5);

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        const curMm = Math.abs(this.Y * 1000);
        ctx.strokeStyle = curMm > 45 ? '#ef4444' : (curMm > 18 ? '#fbbf24' : '#38bdf8');
        ctx.stroke();
        ctx.restore();
      }

      // Live Telemetry Pill
      const curAmp = Math.round(this.Y * 1000);
      ctx.font = '600 10px Inter, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = Math.abs(curAmp) > 45 ? '#f87171' : (Math.abs(curAmp) > 18 ? '#fcd34d' : '#38bdf8');
      ctx.fillText(`Amplitudine: ${curAmp > 0 ? '+' : ''}${curAmp} mm  (Vârf: ±${Math.round(this.peakAmplitudeMm)} mm)`, x + w - pad - 10, y + pad + 14);
    }

    _renderKuramotoPanel(ctx, x, y, w, h) {
      const pad = 12;
      const cardX = x + pad;
      const cardY = y + pad;
      const cardW = w - pad * 2;
      const cardH = h - pad * 2;

      // Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Title
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('DIAGRAMĂ DE FAZĂ KURAMOTO', cardX + 10, cardY + 14);

      // Circle Dial geometry
      const dialR = Math.min(cardH * 0.32, cardW * 0.22);
      const dialCX = cardX + dialR + 18;
      const dialCY = cardY + cardH * 0.54;

      // Draw Unit Circle
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dialCX, dialCY, dialR, 0, 2 * Math.PI);
      ctx.stroke();

      // Cardinal axes
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dialCX - dialR - 4, dialCY);
      ctx.lineTo(dialCX + dialR + 4, dialCY);
      ctx.moveTo(dialCX, dialCY - dialR - 4);
      ctx.lineTo(dialCX, dialCY + dialR + 4);
      ctx.stroke();

      // Draw pedestrian phase points on circle: e^(i * theta_j)
      for (let p of this.pedestrians) {
        const dotX = dialCX + dialR * Math.cos(p.phase);
        const dotY = dialCY + dialR * Math.sin(p.phase);

        ctx.fillStyle = p.locked ? '#f87171' : 'rgba(148, 163, 184, 0.65)';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.0, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Draw Collective Synchronization Order Vector R
      const vecLen = dialR * this.orderR;
      const vecX = dialCX + vecLen * Math.cos(this.meanPhase);
      const vecY = dialCY + vecLen * Math.sin(this.meanPhase);

      ctx.save();
      ctx.strokeStyle = this.orderR > 0.55 ? '#ef4444' : (this.orderR > 0.30 ? '#fbbf24' : '#38bdf8');
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(dialCX, dialCY);
      ctx.lineTo(vecX, vecY);
      ctx.stroke();

      // Vector head
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(vecX, vecY, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Metrics and Order Parameter Bar on the right side of dial
      const barX = dialCX + dialR + 18;
      const barW = Math.max(70, cardW - (barX - cardX) - 14);
      const barY = cardY + 34;

      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(`Parametru Ordine R: ${(this.orderR * 100).toFixed(1)}%`, barX, barY);

      // Order Progress Bar
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.fillRect(barX, barY + 6, barW, 9);

      const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      fillGrad.addColorStop(0, '#38bdf8');
      fillGrad.addColorStop(0.4, '#fbbf24');
      fillGrad.addColorStop(1, '#ef4444');
      ctx.fillStyle = fillGrad;
      ctx.fillRect(barX, barY + 6, barW * Math.min(1.0, this.orderR), 9);
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.strokeRect(barX, barY + 6, barW, 9);

      // Status text
      let statusText = 'STABIL (Mers Haotic)';
      let statusColor = '#34d399';
      if (this.damperActive) {
        statusText = '🛡️ AMORTIZOARE ACTIVE';
        statusColor = '#fbbf24';
      } else if (this.orderR > 0.55) {
        statusText = '⚠️ REACȚIE POZITIVĂ (SLE)';
        statusColor = '#f87171';
      } else if (this.orderR > 0.28) {
        statusText = '🟡 TRANZIȚIE SINCRONĂ';
        statusColor = '#fbbf24';
      }

      ctx.font = '700 10px Inter, sans-serif';
      ctx.fillStyle = statusColor;
      ctx.fillText(`Stare: ${statusText}`, barX, barY + 30);

      // Critical count note
      ctx.font = '500 9.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Pietoni: ${this.N} (Prag Ncrit ≈ ${this.Ncrit})`, barX, barY + 46);
      ctx.fillText(`Amortizare: ${(this.zeta * 100).toFixed(1)}%`, barX, barY + 60);
    }

    _updateUIBadges() {
      const nBadge = document.getElementById('sim5-n-badge');
      const ampBadge = document.getElementById('sim5-amp-badge');
      const rBadge = document.getElementById('sim5-r-badge');
      const damperBtn = document.getElementById('sim5-damper-btn');

      const ampMm = Math.round(this.Y * 1000);

      if (nBadge) {
        nBadge.textContent = `Pietoni: ${this.N} / N_crit ≈ ${this.Ncrit}`;
        nBadge.className = this.N >= this.Ncrit ? 'sim-badge sim-badge--danger' : 'sim-badge sim-badge--cyan';
      }

      if (ampBadge) {
        ampBadge.textContent = `Balans: ${ampMm > 0 ? '+' : ''}${ampMm} mm`;
        if (Math.abs(ampMm) > 45) {
          ampBadge.className = 'sim-badge sim-badge--danger';
        } else if (Math.abs(ampMm) > 18) {
          ampBadge.className = 'sim-badge sim-badge--amber';
        } else {
          ampBadge.className = 'sim-badge sim-badge--cyan';
        }
      }

      if (rBadge) {
        rBadge.textContent = `Sincronizare R: ${(this.orderR * 100).toFixed(0)}%`;
      }

      if (damperBtn) {
        if (this.damperActive) {
          damperBtn.textContent = '🛡️ Amortizoare Active (2002)';
          damperBtn.classList.add('sim-btn--preset');
        } else {
          damperBtn.textContent = '⚙️ Activează Amortizoare (2002)';
          damperBtn.classList.remove('sim-btn--preset');
        }
      }
    }
  }

  // Export to global scope
  window.MillenniumBridgeSim = MillenniumBridgeSim;
})();
