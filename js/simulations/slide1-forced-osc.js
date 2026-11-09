/* ============================================================
   SLIDE1-FORCED-OSC.JS — Advanced Interactive Simulation
   Features:
     - Real physical shaker mechanism (motor + flywheel + connecting rod)
     - Realistic 3D-styled metallic spring & hydraulic fluid damper
     - Interactive drag & drop on the mass
     - Interactive click/drag on the A(ω) response curve
     - Real-time Phase Lag & Phasor diagram (showing 90° lag at resonance)
     - Dual-trace oscilloscope: Shaker y(t) vs Mass x(t)
     - Resonance Overload warning effects & energy gauge
     - Audio feedback (Web Audio API, muted by default)
     - Auto-starts immediately
   ============================================================ */

(function () {
  'use strict';

  class ForcedOscillationSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // Physical parameters
      this.mass = config.mass || 1.0;          // kg
      this.k = config.springK || 16.0;         // N/m
      this.b = config.damping || 0.35;         // Ns/m
      this.Y0 = 0.40;                          // Shaker amplitude (m)
      this.omega = config.driveOmega || 4.0;   // rad/s

      // Physical state
      this.x = 0;       // Mass displacement from rest (m)
      this.v = 0;       // Mass velocity (m/s)
      this.ys = 0;      // Shaker displacement (m)
      this.vs = 0;      // Shaker velocity (m/s)

      // Mouse drag state
      this.isDragging = false;
      this.dragStartY = 0;
      this.dragStartX = 0;

      // Audio state
      this.audioCtx = null;
      this.oscillator = null;
      this.gainNode = null;
      this.soundEnabled = false;

      // History buffers for oscilloscope
      this.historyLength = 260;
      this.historyTime = [];
      this.historyMass = [];
      this.historyShaker = [];

      // Bubbles in damper
      this.bubbles = [];
      for (let i = 0; i < 12; i++) {
        this.bubbles.push({
          x: (Math.random() - 0.5) * 14,
          y: Math.random() * 60,
          r: 1 + Math.random() * 2,
          speed: 8 + Math.random() * 12
        });
      }

      // Derived values & precomputed response curve
      this._updateDerived();
      this._computeResponseCurve();
    }

    _updateDerived() {
      this.omega0 = Math.sqrt(this.k / this.mass);
      this.gamma = this.b / (2 * this.mass);
      this.zeta = this.b / (2 * Math.sqrt(this.k * this.mass) + 1e-12); // damping ratio
      this.Q = 1 / (2 * this.zeta + 1e-12);

      // Frequency ratio
      this.r = this.omega / (this.omega0 + 1e-12);

      // Transmissibility & analytical amplitude
      const r = this.r;
      const z = this.zeta;
      const num = 1 + Math.pow(2 * z * r, 2);
      const den = Math.pow(1 - r * r, 2) + Math.pow(2 * z * r, 2);
      this.transmissibility = Math.sqrt(num / (den + 1e-12));
      this.theoreticalA = this.Y0 * this.transmissibility;

      // Phase lag of mass relative to shaker: delta in [0, pi]
      // tan(delta) = 2*z*r^3 / (1 + (4*z^2 - 1)*r^2) or standard relative phase
      this.phaseLag = Math.atan2(2 * z * r, 1 - r * r);
      if (this.phaseLag < 0) this.phaseLag += Math.PI; // normalize to [0, pi]
      this.phaseDegrees = (this.phaseLag * 180 / Math.PI);

      // Check if within resonance band
      this.isAtResonance = Math.abs(this.r - 1.0) < 0.08;
      this.isNearResonance = Math.abs(this.r - 1.0) < 0.22;
    }

    _computeResponseCurve() {
      this.responseCurve = [];
      const steps = 180;
      const maxW = this.omega0 * 2.8;
      const z = this.zeta;

      for (let i = 0; i <= steps; i++) {
        const w = (i / steps) * maxW;
        const r = w / (this.omega0 + 1e-12);
        const num = 1 + Math.pow(2 * z * r, 2);
        const den = Math.pow(1 - r * r, 2) + Math.pow(2 * z * r, 2);
        const T = Math.sqrt(num / (den + 1e-12));
        this.responseCurve.push({
          omega: w,
          amplitude: this.Y0 * T
        });
      }
    }

    onInit() {
      this.x = 0;
      this.v = 0;
      this.time = 0;
      this._bindControls();
      this._bindMouseEvents();

      // Automatically start animation loop
      this.start();
    }

    onReset() {
      this.x = 0;
      this.v = 0;
      this.time = 0;
      this.historyTime = [];
      this.historyMass = [];
      this.historyShaker = [];
      if (this.soundEnabled && this.gainNode) {
        this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
      }
    }

    _bindControls() {
      // Frequency slider ω
      const wSlider = document.getElementById('sim1-omega');
      const wVal = document.getElementById('sim1-omega-val');
      if (wSlider) {
        wSlider.addEventListener('input', () => {
          this.omega = parseFloat(wSlider.value);
          this._updateDerived();
          this._computeResponseCurve();
          if (wVal) wVal.textContent = this.omega.toFixed(2) + ' rad/s';
          this._updateAudio();
        });
      }

      // Spring constant slider k
      const kSlider = document.getElementById('sim1-k');
      const kVal = document.getElementById('sim1-k-val');
      if (kSlider) {
        kSlider.addEventListener('input', () => {
          this.k = parseFloat(kSlider.value);
          this._updateDerived();
          this._computeResponseCurve();
          if (kVal) kVal.textContent = this.k.toFixed(1) + ' N/m';
          this._updateDynamicDisplays();
          this._updateAudio();
        });
      }

      // Damping slider b
      const bSlider = document.getElementById('sim1-b');
      const bVal = document.getElementById('sim1-b-val');
      if (bSlider) {
        bSlider.addEventListener('input', () => {
          this.b = parseFloat(bSlider.value);
          this._updateDerived();
          this._computeResponseCurve();
          if (bVal) bVal.textContent = this.b.toFixed(2) + ' Ns/m';
          this._updateDynamicDisplays();
        });
      }

      // Play/Pause button
      const playBtn = document.getElementById('sim1-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          playBtn.innerHTML = this.running ? '⏸ Pauză' : '▶ Pornit';
          if (!this.running && this.soundEnabled && this.gainNode) {
            this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
          }
        });
      }

      // Reset button
      const resetBtn = document.getElementById('sim1-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          this.start();
          if (playBtn) playBtn.innerHTML = '⏸ Pauză';
        });
      }

      // Preset: Exact Resonance
      const presetRes = document.getElementById('sim1-preset-res');
      if (presetRes) {
        presetRes.addEventListener('click', () => {
          this._setFrequency(this.omega0);
        });
      }

      // Preset: Sub-resonance
      const presetSub = document.getElementById('sim1-preset-sub');
      if (presetSub) {
        presetSub.addEventListener('click', () => {
          this._setFrequency(this.omega0 * 0.45);
        });
      }

      // Preset: Super-resonance
      const presetSuper = document.getElementById('sim1-preset-super');
      if (presetSuper) {
        presetSuper.addEventListener('click', () => {
          this._setFrequency(this.omega0 * 1.85);
        });
      }

      // Preset: Low damping (High Q)
      const presetLowB = document.getElementById('sim1-preset-lowb');
      if (presetLowB) {
        presetLowB.addEventListener('click', () => {
          this._setDamping(0.08);
          this._setFrequency(this.omega0);
        });
      }

      // Preset: Critical damping
      const presetCrit = document.getElementById('sim1-preset-crit');
      if (presetCrit) {
        presetCrit.addEventListener('click', () => {
          const critB = 2 * Math.sqrt(this.k * this.mass);
          this._setDamping(critB);
        });
      }

      // Sound toggle
      const soundBtn = document.getElementById('sim1-sound');
      if (soundBtn) {
        soundBtn.addEventListener('click', () => {
          this._toggleAudio(soundBtn);
        });
      }

      this._updateDynamicDisplays();
    }

    _setFrequency(w) {
      this.omega = Math.max(0.2, Math.min(16.0, w));
      const slider = document.getElementById('sim1-omega');
      const valDisp = document.getElementById('sim1-omega-val');
      if (slider) slider.value = this.omega.toFixed(2);
      if (valDisp) valDisp.textContent = this.omega.toFixed(2) + ' rad/s';
      this._updateDerived();
      this._computeResponseCurve();
      this._updateAudio();
    }

    _setDamping(b) {
      this.b = Math.max(0.02, Math.min(3.5, b));
      const slider = document.getElementById('sim1-b');
      const valDisp = document.getElementById('sim1-b-val');
      if (slider) slider.value = this.b.toFixed(2);
      if (valDisp) valDisp.textContent = this.b.toFixed(2) + ' Ns/m';
      this._updateDerived();
      this._computeResponseCurve();
      this._updateDynamicDisplays();
    }

    _updateDynamicDisplays() {
      const w0Disp = document.getElementById('sim1-w0-badge');
      if (w0Disp) w0Disp.textContent = `ω₀ = ${this.omega0.toFixed(2)} rad/s`;
      const qDisp = document.getElementById('sim1-q-badge');
      if (qDisp) qDisp.textContent = `Q = ${this.Q.toFixed(1)}`;
    }

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

      const onDown = (e) => {
        const pos = getCoords(e);

        // Check if clicked in mechanical area (on/near mass)
        const mechW = this.W * 0.44;
        if (pos.x <= mechW) {
          const centerY = this.H * 0.52;
          const pxPerMeter = this.H * 0.22;
          const currentMassY = centerY + this.x * pxPerMeter;
          if (Math.abs(pos.y - currentMassY) < 45) {
            this.isDragging = true;
            this.dragStartY = pos.y;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
          }
        }

        // Check if clicked in response curve graph area (interactive frequency tuning)
        const graphX = this.W * 0.48;
        const graphW = this.W * 0.50;
        const graphY = this.H * 0.08;
        const graphH = this.H * 0.38;

        if (pos.x >= graphX && pos.x <= graphX + graphW && pos.y >= graphY && pos.y <= graphY + graphH) {
          const maxW = this.omega0 * 2.8;
          const clickedW = ((pos.x - (graphX + 40)) / (graphW - 50)) * maxW;
          if (clickedW >= 0.2 && clickedW <= 16.0) {
            this._setFrequency(clickedW);
          }
          this.isTuningGraph = true;
          e.preventDefault();
        }
      };

      const onMove = (e) => {
        const pos = getCoords(e);

        if (this.isDragging) {
          const centerY = this.H * 0.52;
          const pxPerMeter = this.H * 0.22;
          this.x = (pos.y - centerY) / pxPerMeter;
          this.x = Math.max(-1.8, Math.min(1.8, this.x));
          this.v = 0; // zero velocity while held
          e.preventDefault();
        } else if (this.isTuningGraph) {
          const graphX = this.W * 0.48;
          const graphW = this.W * 0.50;
          const maxW = this.omega0 * 2.8;
          const clickedW = ((pos.x - (graphX + 40)) / (graphW - 50)) * maxW;
          if (clickedW >= 0.2 && clickedW <= 16.0) {
            this._setFrequency(clickedW);
          }
        } else {
          // Hover cursor update
          const mechW = this.W * 0.44;
          const centerY = this.H * 0.52;
          const pxPerMeter = this.H * 0.22;
          const currentMassY = centerY + this.x * pxPerMeter;
          if (pos.x <= mechW && Math.abs(pos.y - currentMassY) < 45) {
            this.canvas.style.cursor = 'grab';
          } else {
            this.canvas.style.cursor = 'default';
          }
        }
      };

      const onUp = () => {
        if (this.isDragging) {
          this.isDragging = false;
          this.canvas.style.cursor = 'default';
        }
        this.isTuningGraph = false;
      };

      this.canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    }

    _toggleAudio(button) {
      if (!this.soundEnabled) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!this.audioCtx) {
            this.audioCtx = new AudioContext();
            this.oscillator = this.audioCtx.createOscillator();
            this.gainNode = this.audioCtx.createGain();

            this.oscillator.type = 'sine';
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            this.gainNode.gain.value = 0.05;
            this.oscillator.start();
          } else if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
          }

          this.soundEnabled = true;
          button.innerHTML = '🔊 Sunet: Pornit';
          button.classList.add('sim-btn--primary');
          this._updateAudio();
        } catch (e) {
          console.warn('Audio not allowed:', e);
        }
      } else {
        this.soundEnabled = false;
        if (this.gainNode) {
          this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        }
        button.innerHTML = '🔇 Sunet: Oprit';
        button.classList.remove('sim-btn--primary');
      }
    }

    _updateAudio() {
      if (!this.soundEnabled || !this.oscillator || !this.gainNode || !this.audioCtx) return;
      // Map mechanical omega (rad/s) to audible acoustic frequency (Hz)
      const baseFreq = 120 * (this.omega / (this.omega0 + 1e-12));
      const targetFreq = Math.max(55, Math.min(600, baseFreq));

      // Volume swells near resonance
      const ampRatio = Math.min(3.5, this.theoreticalA / (this.Y0 + 1e-12));
      const targetVol = 0.02 + 0.08 * (ampRatio / 3.5);

      this.oscillator.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.05);
      this.gainNode.gain.setTargetAtTime(targetVol, this.audioCtx.currentTime, 0.05);
    }

    update(dt) {
      // Shaker kinematics
      this.ys = this.Y0 * Math.cos(this.omega * this.time);
      this.vs = -this.Y0 * this.omega * Math.sin(this.omega * this.time);

      if (!this.isDragging) {
        // RK4 Numerical Integration for high physical fidelity
        const subSteps = 6;
        const h = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
          const t_sub = this.time - dt + h * s;

          const deriv = (x, v, t) => {
            const ys_t = this.Y0 * Math.cos(this.omega * t);
            const vs_t = -this.Y0 * this.omega * Math.sin(this.omega * t);

            // Base excitation forces
            const F_spring = -this.k * (x - ys_t);
            const F_damping = -this.b * (v - vs_t);
            const acc = (F_spring + F_damping) / this.mass;
            return { dx: v, dv: acc };
          };

          const k1 = deriv(this.x, this.v, t_sub);
          const k2 = deriv(this.x + 0.5 * h * k1.dx, this.v + 0.5 * h * k1.dv, t_sub + 0.5 * h);
          const k3 = deriv(this.x + 0.5 * h * k2.dx, this.v + 0.5 * h * k2.dv, t_sub + 0.5 * h);
          const k4 = deriv(this.x + h * k3.dx, this.v + h * k3.dv, t_sub + h);

          this.x += (h / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
          this.v += (h / 6) * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv);
        }
      }

      // Record oscilloscope history
      this.historyTime.push(this.time);
      this.historyMass.push(this.x);
      this.historyShaker.push(this.ys);
      if (this.historyTime.length > this.historyLength) {
        this.historyTime.shift();
        this.historyMass.shift();
        this.historyShaker.shift();
      }

      // Update fluid bubbles in dashpot
      for (const b of this.bubbles) {
        b.y -= (b.speed + Math.abs(this.v - this.vs) * 15) * dt;
        if (b.y < 5) b.y = 55;
      }
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;

      ctx.clearRect(0, 0, W, H);

      // Deep sci-tech background
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#070a14');
      bgGrad.addColorStop(0.5, '#0b1022');
      bgGrad.addColorStop(1, '#080d1a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Top status alert banner
      this._drawStatusBanner(ctx, W);

      // Left Panel: Mechanical Rig (44% width)
      const mechW = W * 0.44;
      this._drawMechanicalRig(ctx, mechW, H);

      // Right Panel: Scientific Visualizers
      const rightX = W * 0.46;
      const rightW = W * 0.52;

      // 1. Response Curve Graph (Top)
      const graphH = H * 0.38;
      this._drawResonanceGraph(ctx, rightX, H * 0.09, rightW, graphH);

      // 2. Phasor & Phase Lag Gauge (Middle)
      const phasorY = H * 0.49;
      const phasorH = H * 0.20;
      this._drawPhasorGauge(ctx, rightX, phasorY, rightW, phasorH);

      // 3. Dual Oscilloscope (Bottom)
      const oscY = H * 0.71;
      const oscH = H * 0.26;
      this._drawOscilloscope(ctx, rightX, oscY, rightW, oscH);
    }

    _drawStatusBanner(ctx, W) {
      const bannerH = 28;
      let text, color, bg;

      if (this.isAtResonance) {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 8);
        color = '#ff5252';
        bg = `rgba(255, 82, 82, ${0.15 + pulse * 0.12})`;
        text = `⚡ REZONANȚĂ EXACTĂ ACTIVĂ | ω ≈ ω₀ | Amplitudine Amplificată de ${this.transmissibility.toFixed(1)}× | Defazaj: ${this.phaseDegrees.toFixed(0)}°`;
      } else if (this.isNearResonance) {
        color = '#ffab40';
        bg = 'rgba(255, 171, 64, 0.12)';
        text = `⚠️ ZONĂ DE REZONANȚĂ | Amplificare ${this.transmissibility.toFixed(1)}× | Defazaj: ${this.phaseDegrees.toFixed(0)}°`;
      } else if (this.r < 1.0) {
        color = '#00e5ff';
        bg = 'rgba(0, 229, 255, 0.08)';
        text = `◄ REGIM SUB-REZONANT (Forța elastică domină | Mișcare în fază cu excitația, δ = ${this.phaseDegrees.toFixed(0)}°)`;
      } else {
        color = '#b388ff';
        bg = 'rgba(179, 136, 255, 0.08)';
        text = `► REGIM SUPRA-REZONANT (Inerția domină | Mișcare în opoziție de fază, δ = ${this.phaseDegrees.toFixed(0)}°)`;
      }

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, bannerH);
      ctx.strokeStyle = color + '40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, bannerH);
      ctx.lineTo(W, bannerH);
      ctx.stroke();

      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, bannerH / 2);
    }

    _drawMechanicalRig(ctx, W, H) {
      const centerX = W * 0.52;
      const pxPerMeter = H * 0.22;

      // Shaker base position
      const shakerRestY = H * 0.18;
      const shakerY = shakerRestY + this.ys * pxPerMeter * 0.5;

      // Mass position
      const massRestY = H * 0.56;
      const massY = massRestY + this.x * pxPerMeter;
      const massW = 92;
      const massH = 46;

      // --- Vertical Ruler on Left Edge ---
      this._drawRuler(ctx, 24, H * 0.12, H * 0.78, massRestY, pxPerMeter);

      // --- Shaker Mechanism (Motor + Flywheel + Crossbar) ---
      this._drawMotorShaker(ctx, centerX, H * 0.08, shakerY);

      // --- Coiled Spring (Left of mass) ---
      const springX = centerX - 26;
      this._drawCoiledSpring(ctx, springX, shakerY + 12, massY - massH / 2);

      // --- Hydraulic Damper (Right of mass) ---
      const damperX = centerX + 26;
      this._drawHydraulicDamper(ctx, damperX, shakerY + 12, massY - massH / 2);

      // --- Equilibrium Reference Line ---
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, massRestY);
      ctx.lineTo(W - 20, massRestY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#5c5e78';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Echilibru (x = 0)', 44, massRestY - 4);

      // --- Mass Block ---
      this._drawMassBlock(ctx, centerX, massY, massW, massH);

      // --- Real-time Force Vectors ---
      const showVectors = !window.SettingsManager || window.SettingsManager.get('showVectors');
      if (showVectors) {
        this._drawForceVectors(ctx, centerX, massY, massW, massH, pxPerMeter);
      }
    }

    _drawRuler(ctx, x, topY, height, zeroY, scale) {
      ctx.fillStyle = '#0f1629';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.fillRect(x - 14, topY, 26, height);
      ctx.strokeRect(x - 14, topY, 26, height);

      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = '#5c5e78';
      ctx.textAlign = 'right';

      // 0.2m increments
      const range = 1.4;
      for (let m = -range; m <= range; m += 0.2) {
        const y = zeroY + m * scale;
        if (y < topY + 5 || y > topY + height - 5) continue;

        const isMajor = Math.abs(Math.round(m * 10) % 4) === 0;
        const tickW = isMajor ? 10 : 5;

        ctx.strokeStyle = isMajor ? '#00e5ff60' : 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(x + 12 - tickW, y);
        ctx.lineTo(x + 12, y);
        ctx.stroke();

        if (isMajor) {
          ctx.fillText(( -m ).toFixed(1), x + 2, y + 3);
        }
      }
    }

    _drawMotorShaker(ctx, cx, motorY, barY) {
      // Motor casing
      const rMotor = 18;
      ctx.save();
      ctx.fillStyle = '#1c2440';
      ctx.strokeStyle = '#00e5ff80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, motorY, rMotor, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Spinning flywheel with crank pin
      const angle = this.omega * this.time;
      const crankR = 9;
      const pinX = cx + crankR * Math.cos(angle);
      const pinY = motorY + crankR * Math.sin(angle);

      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, motorY);
      ctx.lineTo(pinX, pinY);
      ctx.stroke();

      ctx.fillStyle = '#69f0ae';
      ctx.beginPath();
      ctx.arc(pinX, pinY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Connecting rod to shaker crossbar
      ctx.strokeStyle = '#9e9eb8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pinX, pinY);
      ctx.lineTo(cx, barY);
      ctx.stroke();

      // Shaker Crossbar (The vibrating ceiling)
      const barW = 100;
      const barH = 10;
      const barGrad = ctx.createLinearGradient(cx - barW / 2, barY, cx + barW / 2, barY + barH);
      barGrad.addColorStop(0, '#2a3556');
      barGrad.addColorStop(0.5, '#405284');
      barGrad.addColorStop(1, '#2a3556');

      ctx.fillStyle = barGrad;
      ctx.strokeStyle = this.isAtResonance ? '#ff5252' : '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - barW / 2, barY, barW, barH, 4);
      ctx.fill();
      ctx.stroke();

      // Label on shaker bar
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = '#e8eaf6';
      ctx.textAlign = 'center';
      ctx.fillText('SHAKER: y(t)', cx, barY - 4);

      ctx.restore();
    }

    _drawCoiledSpring(ctx, x, y1, y2) {
      const len = y2 - y1;
      const coils = 12;
      const r = 11;
      const step = len / coils;

      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(x, y1);

      for (let i = 0; i < coils; i++) {
        const cy = y1 + (i + 0.5) * step;
        const cp1x = (i % 2 === 0) ? x + r : x - r;
        const cp2x = (i % 2 === 0) ? x - r : x + r;
        ctx.bezierCurveTo(cp1x, cy - step * 0.25, cp2x, cy + step * 0.25, x, y1 + (i + 1) * step);
      }

      ctx.stroke();

      // Metallic highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    _drawHydraulicDamper(ctx, x, y1, y2) {
      const cylW = 20;
      const cylH = 65;
      const cylY = y2 - cylH;

      ctx.save();

      // Glass Cylinder
      ctx.fillStyle = 'rgba(15, 30, 60, 0.7)';
      ctx.strokeStyle = '#9e9eb8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - cylW / 2, cylY, cylW, cylH);
      ctx.fillRect(x - cylW / 2, cylY, cylW, cylH);

      // Viscous Blue Fluid inside
      ctx.fillStyle = 'rgba(0, 150, 255, 0.25)';
      ctx.fillRect(x - cylW / 2 + 1, cylY + 12, cylW - 2, cylH - 13);

      // Bubbles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (const b of this.bubbles) {
        if (b.y > 10 && b.y < cylH - 5) {
          ctx.beginPath();
          ctx.arc(x + b.x, cylY + b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Piston Rod from shaker
      const pistonHeadY = Math.min(cylY + cylH - 8, Math.max(cylY + 8, y1 + (y2 - y1) * 0.5));
      ctx.strokeStyle = '#e8eaf6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, pistonHeadY);
      ctx.stroke();

      // Piston Head
      ctx.fillStyle = '#ffab40';
      ctx.fillRect(x - cylW / 2 + 2, pistonHeadY - 4, cylW - 4, 8);

      // Bottom mounting to mass
      ctx.strokeStyle = '#9e9eb8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, cylY + cylH);
      ctx.lineTo(x, y2);
      ctx.stroke();

      ctx.restore();
    }

    _drawMassBlock(ctx, cx, cy, w, h) {
      ctx.save();

      // Pulsing glow at resonance
      if (this.isAtResonance) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 12);
        ctx.shadowColor = '#ff5252';
        ctx.shadowBlur = 24 + pulse * 18;
      } else if (this.isNearResonance) {
        ctx.shadowColor = '#ffab40';
        ctx.shadowBlur = 12;
      }

      // Brushed metal body
      const grad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
      if (this.isAtResonance) {
        grad.addColorStop(0, '#4a1515');
        grad.addColorStop(0.5, '#2b0d0d');
        grad.addColorStop(1, '#5c1a1a');
      } else {
        grad.addColorStop(0, '#1c2440');
        grad.addColorStop(0.5, '#151c32');
        grad.addColorStop(1, '#242f50');
      }

      ctx.fillStyle = grad;
      ctx.strokeStyle = this.isAtResonance ? '#ff5252' : '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0; // reset shadow

      // Laser pointer line to ruler
      ctx.strokeStyle = this.isAtResonance ? 'rgba(255, 82, 82, 0.8)' : 'rgba(0, 229, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, cy);
      ctx.lineTo(36, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Mass Info Label
      ctx.fillStyle = '#e8eaf6';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`m = ${this.mass.toFixed(1)} kg`, cx, cy - 6);

      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillStyle = this.isAtResonance ? '#ff8a80' : '#00e5ff';
      ctx.fillText(`x = ${(this.x).toFixed(2)} m`, cx, cy + 9);

      ctx.restore();
    }

    _drawForceVectors(ctx, cx, cy, w, h, scale) {
      const Fk = -this.k * (this.x - this.ys);
      const Fb = -this.b * (this.v - this.vs);
      const vScale = 1.6;

      // Spring force (Left)
      const fkLen = Math.max(-45, Math.min(45, Fk * vScale));
      if (Math.abs(fkLen) > 3) {
        this.drawArrow(cx - w / 2 - 12, cy, cx - w / 2 - 12, cy - fkLen, '#00e5ff', 2);
        ctx.fillStyle = '#00e5ff';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Fₖ: ${(-Fk).toFixed(1)}N`, cx - w / 2 - 16, cy - fkLen / 2);
      }

      // Damping force (Right)
      const fbLen = Math.max(-45, Math.min(45, Fb * vScale));
      if (Math.abs(fbLen) > 3) {
        this.drawArrow(cx + w / 2 + 12, cy, cx + w / 2 + 12, cy - fbLen, '#ffab40', 2);
        ctx.fillStyle = '#ffab40';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`F_b: ${(-Fb).toFixed(1)}N`, cx + w / 2 + 16, cy - fbLen / 2);
      }
    }

    _drawResonanceGraph(ctx, gx, gy, gw, gh) {
      const padL = 40;
      const padB = 26;
      const padT = 20;
      const padR = 15;
      const plotX = gx + padL;
      const plotY = gy + padT;
      const plotW = gw - padL - padR;
      const plotH = gh - padT - padB;

      // Container background
      ctx.fillStyle = 'rgba(15, 22, 41, 0.75)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      // Title & Interactive hint
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('A(ω) — Răspunsul în Frecvență (Transmisibilitate)', gx + 10, gy + 14);

      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#00e5ffaa';
      ctx.textAlign = 'right';
      ctx.fillText('⚡ Click / Trage pe grafic pentru a acorda ω', gx + gw - 10, gy + 14);

      // Max scale computation
      let maxA = 0;
      for (const pt of this.responseCurve) {
        if (pt.amplitude > maxA && isFinite(pt.amplitude)) maxA = pt.amplitude;
      }
      maxA = Math.max(maxA, 1.2) * 1.15;
      const maxW = this.omega0 * 2.8;

      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const yy = plotY + plotH - (i / 3) * plotH;
        ctx.beginPath();
        ctx.moveTo(plotX, yy);
        ctx.lineTo(plotX + plotW, yy);
        ctx.stroke();
      }

      // Vertical line at natural frequency ω₀
      const w0X = plotX + (this.omega0 / maxW) * plotW;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 171, 64, 0.6)';
      ctx.beginPath();
      ctx.moveTo(w0X, plotY);
      ctx.lineTo(w0X, plotY + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffab40';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ω₀', w0X, plotY - 4);

      // Response curve path
      ctx.beginPath();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;

      let first = true;
      for (const pt of this.responseCurve) {
        if (!isFinite(pt.amplitude)) continue;
        const xx = plotX + (pt.omega / maxW) * plotW;
        const yy = plotY + plotH - (pt.amplitude / maxA) * plotH;
        if (first) { ctx.moveTo(xx, yy); first = false; }
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Glow fill under curve
      ctx.lineTo(plotX + plotW, plotY + plotH);
      ctx.lineTo(plotX, plotY + plotH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
      ctx.fill();

      // Current operating point on curve
      const curX = plotX + (this.omega / maxW) * plotW;
      const curY = plotY + plotH - (this.theoreticalA / maxA) * plotH;

      if (curX >= plotX && curX <= plotX + plotW) {
        const pulse = 0.7 + 0.3 * Math.sin(this.time * 8);
        const dotColor = this.isAtResonance ? '#ff5252' : '#69f0ae';

        // Vertical line to current frequency
        ctx.strokeStyle = dotColor + '60';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(curX, plotY);
        ctx.lineTo(curX, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsating dot
        ctx.beginPath();
        ctx.arc(curX, curY, 6 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(curX, curY, 14 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.isAtResonance ? 'rgba(255, 82, 82, 0.2)' : 'rgba(105, 240, 174, 0.15)';
        ctx.fill();
      }

      // X Axis Ticks
      ctx.fillStyle = '#5c5e78';
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const val = (i / 4) * maxW;
        const xx = plotX + (val / maxW) * plotW;
        ctx.fillText(val.toFixed(1), xx, plotY + plotH + 12);
      }
      ctx.fillText('Pulsație ω (rad/s)', plotX + plotW / 2, plotY + plotH + 22);

      // Y Axis Ticks
      ctx.textAlign = 'right';
      ctx.fillText((maxA).toFixed(1) + 'm', plotX - 6, plotY + 8);
      ctx.fillText('0', plotX - 6, plotY + plotH);
    }

    _drawPhasorGauge(ctx, gx, gy, gw, gh) {
      // Container
      ctx.fillStyle = 'rgba(15, 22, 41, 0.7)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      // Title
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Diagramă Fazorială & Defazaj δ', gx + 10, gy + 14);

      const cx = gx + 60;
      const cy = gy + gh / 2 + 6;
      const R = gh * 0.36;

      // Dial circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Shaker phase vector (Green)
      const thetaS = this.omega * this.time;
      const xs = cx + R * Math.cos(thetaS);
      const ys = cy + R * Math.sin(thetaS);
      this.drawArrow(cx, cy, xs, ys, '#69f0ae', 2);

      // Mass phase vector (Cyan, lagging by delta)
      const thetaM = thetaS - this.phaseLag;
      const rM = R * Math.min(1.0, this.transmissibility / 2.5);
      const xm = cx + rM * Math.cos(thetaM);
      const ym = cy + rM * Math.sin(thetaM);
      this.drawArrow(cx, cy, xm, ym, '#00e5ff', 2);

      // Phase arc
      ctx.strokeStyle = '#ffab40';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.45, thetaM, thetaS, false);
      ctx.stroke();

      // Info Texts on right of dial
      const textX = gx + 130;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';

      ctx.fillStyle = '#69f0ae';
      ctx.fillText('→ Vector Shaker (Excitație F₀)', textX, gy + 28);

      ctx.fillStyle = '#00e5ff';
      ctx.fillText('→ Vector Masă (Răspuns X)', textX, gy + 44);

      ctx.fillStyle = this.isAtResonance ? '#ff5252' : '#ffab40';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillText(`Unghi Defazaj: δ = ${this.phaseDegrees.toFixed(1)}° (${(this.phaseLag / Math.PI).toFixed(2)}π rad)`, textX, gy + 64);
    }

    _drawOscilloscope(ctx, gx, gy, gw, gh) {
      if (this.historyTime.length < 2) return;

      // Container
      ctx.fillStyle = 'rgba(10, 16, 32, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      // Title & Legend
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Osciloscop: Semnal Excitație y(t) vs Răspuns Masă x(t)', gx + 10, gy + 14);

      // Zero baseline
      const midY = gy + gh * 0.55;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(gx + 10, midY);
      ctx.lineTo(gx + gw - 10, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      const plotW = gw - 30;
      const scaleY = (gh * 0.35) / Math.max(0.6, this.theoreticalA * 1.1);

      // Trace 1: Shaker (Dashed green)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(105, 240, 174, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);

      for (let i = 0; i < this.historyShaker.length; i++) {
        const xx = gx + 15 + (i / this.historyLength) * plotW;
        const yy = midY - this.historyShaker[i] * scaleY;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Trace 2: Mass (Solid Cyan)
      ctx.beginPath();
      ctx.strokeStyle = this.isAtResonance ? '#ff5252' : '#00e5ff';
      ctx.lineWidth = 2.0;

      for (let i = 0; i < this.historyMass.length; i++) {
        const xx = gx + 15 + (i / this.historyLength) * plotW;
        const yy = midY - this.historyMass[i] * scaleY;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  }

  window.ForcedOscillationSim = ForcedOscillationSim;
})();
