/* ============================================================
   SLIDE 4: TACOMA NARROWS BRIDGE (1940) — TORSIONAL FLUTTER
   Fizică: Rezonanță aeroelastică, desprinderea vârtejurilor Kármán,
           amortizare aeroelastică negativă (self-excited flutter),
           limită structurală și colaps mecanic în apă.
   Autor: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  class TacomaNarrowsSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Physical Parameters (Tacoma Narrows historical scale) ---
      this.B = 11.9;               // Deck width (meters)
      this.D = 2.4;                // Girder height (meters)
      this.mass = 8500;            // Deck mass per unit length (kg/m)
      this.I = (1 / 12) * this.mass * this.B * this.B; // Moment of inertia ~ 100,000 kg*m^2/m

      // Configurable properties
      this.windSpeed = (config && config.windSpeed !== undefined) ? config.windSpeed : 19.0; // m/s (19 m/s = 68 km/h on Nov 7, 1940)
      this.kTheta = (config && config.kTheta !== undefined) ? config.kTheta : 1.0;           // Torsional stiffness factor
      this.cTheta = (config && config.cTheta !== undefined) ? config.cTheta : 0.03;          // Structural damping ratio
      this.deckType = (config && config.deckType) || 'h-girder';                              // 'h-girder' | 'truss' | 'aerofoil'

      // Natural frequencies
      this.wTors = 1.26;           // Base torsional frequency ~ 0.20 Hz (f = 0.2 Hz => w = 1.26 rad/s)
      this.wVert = 0.88;           // Base vertical heaving frequency ~ 0.14 Hz

      // Dynamic states (when intact)
      this.theta = 0.04;           // Torsion angle (rad)
      this.omegaTheta = 0.0;       // Angular velocity d(theta)/dt (rad/s)
      this.y = 0.0;                // Vertical displacement (m)
      this.vy = 0.0;               // Vertical velocity (m/s)

      // Disaster / Collapse state
      this.critThetaDeg = 38.0;    // Collapse threshold angle (degrees)
      this.cableSnapped = false;   // Central or hanger cable snapped
      this.isCollapsed = false;    // Structural failure reached
      this.collapseTime = 0;       // Seconds since collapse

      // Falling fractured debris and water splashes
      this.leftWreck = null;
      this.centerWreck = null;
      this.fallingCar = null;
      this.splashes = [];
      this.debris = [];

      // History buffers for real-time phase & time graphs
      this.historyLength = 220;
      this.historyTheta = new Float32Array(this.historyLength);
      this.historyTime = new Float32Array(this.historyLength);
      this.historyIndex = 0;

      // Phase plane trajectory buffer (theta vs omega_theta)
      this.orbitPoints = [];
      this.maxOrbitPoints = 140;

      // Wind particles simulation
      this.particles = [];
      this.numParticles = 45;
      this._initParticles();

      // Vortices behind the bridge
      this.vortices = [];

      // Drag interaction
      this.isDragging = false;
      this.dragStartY = 0;
      this.dragStartTheta = 0;
    }

    _initParticles() {
      this.particles = [];
      for (let i = 0; i < this.numParticles; i++) {
        this.particles.push({
          x: Math.random(),
          y: Math.random(),
          speed: 0.6 + Math.random() * 0.8,
          size: 1.5 + Math.random() * 2.0,
          opacity: 0.15 + Math.random() * 0.45
        });
      }
    }

    init() {
      super.init();
      this._bindControls();
      this._bindMouse();
      this._updateBadges();
    }

    _bindControls() {
      // 1. Wind Speed slider
      const windSlider = document.getElementById('sim4-wind');
      const windVal = document.getElementById('sim4-wind-val');
      if (windSlider) {
        windSlider.addEventListener('input', () => {
          this.windSpeed = parseFloat(windSlider.value);
          if (windVal) {
            const kmh = (this.windSpeed * 3.6).toFixed(0);
            windVal.textContent = `${this.windSpeed.toFixed(1)} m/s (${kmh} km/h)`;
          }
          this._updateBadges();
        });
      }

      // 2. Torsional Stiffness slider
      const kSlider = document.getElementById('sim4-k');
      const kVal = document.getElementById('sim4-k-val');
      if (kSlider) {
        kSlider.addEventListener('input', () => {
          this.kTheta = parseFloat(kSlider.value);
          if (kVal) kVal.textContent = `k_θ = ${this.kTheta.toFixed(1)}×`;
          this._updateBadges();
        });
      }

      // 3. Structural Damping slider
      const cSlider = document.getElementById('sim4-c');
      const cVal = document.getElementById('sim4-c-val');
      if (cSlider) {
        cSlider.addEventListener('input', () => {
          this.cTheta = parseFloat(cSlider.value);
          if (cVal) cVal.textContent = `c_θ = ${this.cTheta.toFixed(2)}`;
          this._updateBadges();
        });
      }

      // 4. Deck Profile Selector Buttons
      const btnH = document.getElementById('sim4-profile-h');
      const btnTruss = document.getElementById('sim4-profile-truss');
      const btnAero = document.getElementById('sim4-profile-aero');

      const setProfile = (profile) => {
        this.deckType = profile;
        if (btnH) btnH.classList.toggle('sim-btn--primary', profile === 'h-girder');
        if (btnTruss) btnTruss.classList.toggle('sim-btn--primary', profile === 'truss');
        if (btnAero) btnAero.classList.toggle('sim-btn--primary', profile === 'aerofoil');
        this._updateBadges();
      };

      if (btnH) btnH.addEventListener('click', () => setProfile('h-girder'));
      if (btnTruss) btnTruss.addEventListener('click', () => setProfile('truss'));
      if (btnAero) btnAero.addEventListener('click', () => setProfile('aerofoil'));

      // 5. Presets
      const presetCollapse = document.getElementById('sim4-preset-collapse');
      if (presetCollapse) {
        presetCollapse.addEventListener('click', () => {
          this.rebuildBridge();
          this.windSpeed = 19.0;
          this.kTheta = 1.0;
          this.cTheta = 0.03;
          this.deckType = 'h-girder';
          this.theta = 0.08;
          this.omegaTheta = 0.15;
          this._syncControlValues();
          this._updateBadges();
        });
      }

      const presetTruss = document.getElementById('sim4-preset-truss');
      if (presetTruss) {
        presetTruss.addEventListener('click', () => {
          this.rebuildBridge();
          this.windSpeed = 19.0;
          this.deckType = 'truss';
          this._syncControlValues();
          this._updateBadges();
        });
      }

      const presetSnap = document.getElementById('sim4-snap-cable');
      if (presetSnap) {
        presetSnap.addEventListener('click', () => {
          if (this.isCollapsed) {
            this.rebuildBridge();
            return;
          }
          this.cableSnapped = true;
          presetSnap.classList.add('sim-btn--danger');
          presetSnap.textContent = '💥 Cablu Rupt!';
          // Asymmetric shock impulse induces immediate violent flutter
          this.omegaTheta += (this.theta >= 0 ? 0.6 : -0.6);
          this._updateBadges();
        });
      }

      // Actions
      const playBtn = document.getElementById('sim4-play');
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

      const resetBtn = document.getElementById('sim4-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.rebuildBridge();
        });
      }
    }

    rebuildBridge() {
      this.isCollapsed = false;
      this.collapseTime = 0;
      this.theta = 0.03;
      this.omegaTheta = 0.0;
      this.y = 0.0;
      this.vy = 0.0;
      this.cableSnapped = false;
      this.orbitPoints = [];
      this.historyTheta.fill(0);
      this.leftWreck = null;
      this.centerWreck = null;
      this.fallingCar = null;
      this.splashes = [];
      this.debris = [];

      const resetBtn = document.getElementById('sim4-reset');
      if (resetBtn) {
        resetBtn.textContent = '↺ Reset';
        resetBtn.classList.remove('sim-btn--primary');
      }

      const snapB = document.getElementById('sim4-snap-cable');
      if (snapB) {
        snapB.classList.remove('sim-btn--danger');
        snapB.textContent = '✂️ Rupe Cablu Centru';
      }

      this._updateBadges();
    }

    _syncControlValues() {
      const windSlider = document.getElementById('sim4-wind');
      const windVal = document.getElementById('sim4-wind-val');
      if (windSlider) {
        windSlider.value = this.windSpeed;
        if (windVal) windVal.textContent = `${this.windSpeed.toFixed(1)} m/s (${(this.windSpeed * 3.6).toFixed(0)} km/h)`;
      }

      const kSlider = document.getElementById('sim4-k');
      const kVal = document.getElementById('sim4-k-val');
      if (kSlider) {
        kSlider.value = this.kTheta;
        if (kVal) kVal.textContent = `k_θ = ${this.kTheta.toFixed(1)}×`;
      }

      const cSlider = document.getElementById('sim4-c');
      const cVal = document.getElementById('sim4-c-val');
      if (cSlider) {
        cSlider.value = this.cTheta;
        if (cVal) cVal.textContent = `c_θ = ${this.cTheta.toFixed(2)}`;
      }

      const btnH = document.getElementById('sim4-profile-h');
      const btnTruss = document.getElementById('sim4-profile-truss');
      const btnAero = document.getElementById('sim4-profile-aero');
      if (btnH) btnH.classList.toggle('sim-btn--primary', this.deckType === 'h-girder');
      if (btnTruss) btnTruss.classList.toggle('sim-btn--primary', this.deckType === 'truss');
      if (btnAero) btnAero.classList.toggle('sim-btn--primary', this.deckType === 'aerofoil');
    }

    _updateBadges() {
      const modeBadge = document.getElementById('sim4-mode-badge');
      const dampBadge = document.getElementById('sim4-damp-badge');

      // Calculate effective aerodynamic damping coefficient
      const aeroDeriv = this._getFlutterDerivativeA1();
      const cAero = 0.5 * 1.225 * this.windSpeed * Math.pow(this.B, 3) * aeroDeriv / this.I;
      const cEffective = this.cTheta * 2 * this.wTors - cAero;

      if (dampBadge) {
        if (this.isCollapsed) {
          dampBadge.textContent = '💥 RUPTURĂ FINALĂ';
          dampBadge.className = 'sim-badge sim-badge--danger';
        } else if (cEffective < 0) {
          dampBadge.textContent = `c_eff = ${cEffective.toFixed(2)} (Amortizare Negativă ⚠️)`;
          dampBadge.className = 'sim-badge sim-badge--danger';
        } else {
          dampBadge.textContent = `c_eff = +${cEffective.toFixed(2)} (Amortizare Pozitivă)`;
          dampBadge.className = 'sim-badge sim-badge--cyan';
        }
      }

      if (modeBadge) {
        if (this.isCollapsed) {
          modeBadge.textContent = '🌊 PRĂBUȘIT ÎN APĂ';
          modeBadge.className = 'sim-badge sim-badge--danger';
        } else if (cEffective < 0 && Math.abs(this.theta * (180 / Math.PI)) > 12) {
          modeBadge.textContent = '⚡ FLUTTER TORSIONAL DIVERGENT';
          modeBadge.className = 'sim-badge sim-badge--danger';
        } else if (this.windSpeed > 8 && this.deckType === 'h-girder') {
          modeBadge.textContent = '🌪️ Vârtejuri Kármán';
          modeBadge.className = 'sim-badge sim-badge--amber';
        } else {
          modeBadge.textContent = '🛡️ Regim Stabil';
          modeBadge.className = 'sim-badge sim-badge--green';
        }
      }
    }

    _getFlutterDerivativeA1() {
      const f = (this.wTors * Math.sqrt(this.kTheta)) / (2 * Math.PI);
      const Vr = this.windSpeed / (f * this.B + 1e-6);

      if (this.deckType === 'h-girder') {
        if (Vr < 2.0) return -0.05;
        return 0.14 * (Vr - 2.0); // Positive flutter derivative -> self-excitation!
      } else if (this.deckType === 'truss') {
        return -0.28; // Constant positive damping
      } else {
        return -0.85; // High aerodynamic stability
      }
    }

    _bindMouse() {
      if (!this.canvas) return;

      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const onDown = (e) => {
        if (this.isCollapsed) {
          // If clicked anywhere near the water/wreck, trigger rebuild
          this.rebuildBridge();
          return;
        }

        const pos = getPos(e);
        const cx = (this.W < 640 ? this.W : this.W * 0.61) * 0.44;
        const cy = (this.H < 640 ? this.H * 0.62 : this.H) * 0.46;
        const r = Math.min(this.W * 0.35, 150);

        if (Math.hypot(pos.x - cx, pos.y - cy) < r) {
          this.isDragging = true;
          this.dragStartY = pos.y;
          this.dragStartTheta = this.theta;
          e.preventDefault();
        }
      };

      const onMove = (e) => {
        if (!this.isDragging || this.isCollapsed) return;
        const pos = getPos(e);
        const dy = pos.y - this.dragStartY;
        // Limit manual drag between +/- 35 deg
        const targetDeg = (this.dragStartTheta * 180 / Math.PI) + (dy / 4.0);
        const clampedDeg = Math.max(-36, Math.min(36, targetDeg));
        this.theta = clampedDeg * (Math.PI / 180);
        this.omegaTheta = 0;
        e.preventDefault();
      };

      const onUp = () => {
        this.isDragging = false;
      };

      this.canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    }

    _triggerCollapse() {
      if (this.isCollapsed) return;
      this.isCollapsed = true;
      this.collapseTime = 0;

      const mainW = this.W < 640 ? this.W : this.W * 0.61;
      const mainH = this.H < 640 ? this.H * 0.62 : this.H;
      const cx = mainW * 0.44;
      const cy = mainH * 0.46;
      const deckScale = Math.min(mainW * 0.65, 260);
      const halfB = deckScale / 2;

      // 1. Left damaged segment (hangs and swings from left hanger)
      this.leftWreck = {
        pivotX: cx - halfB * 0.9,
        pivotY: cy - 10,
        length: halfB * 0.9,
        angle: this.theta,
        vAngle: this.omegaTheta * 0.4,
        targetAngle: Math.PI * 0.45 // Dangles almost vertically downward
      };

      // 2. Center & Right fractured roadway section (snaps and free-falls into water)
      this.centerWreck = {
        x: cx + halfB * 0.25,
        y: cy + 10,
        vx: (this.windSpeed / 19.0) * 45,
        vy: 20,
        angle: this.theta,
        vAngle: this.omegaTheta * 0.8 + (Math.random() - 0.5) * 1.5,
        w: halfB * 1.3,
        h: deckScale * 0.22,
        hitWater: false
      };

      // 3. Abandoned Car (Tubby's car falls from the roadway)
      this.fallingCar = {
        x: cx + halfB * 0.15,
        y: cy - 15,
        vx: (this.windSpeed / 19.0) * 55 + 20,
        vy: -30,
        angle: this.theta,
        vAngle: 4.5,
        hitWater: false
      };

      // 4. Fracture Debris (twisted steel plates, concrete chunks)
      this.debris = [];
      for (let i = 0; i < 35; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 160;
        this.debris.push({
          x: cx + (Math.random() - 0.5) * 30,
          y: cy + (Math.random() - 0.5) * 20,
          vx: Math.cos(ang) * spd + (this.windSpeed * 1.5),
          vy: Math.sin(ang) * spd - 60,
          size: 2.5 + Math.random() * 5.0,
          angle: Math.random() * Math.PI,
          vAngle: (Math.random() - 0.5) * 12,
          color: Math.random() > 0.5 ? '#78909c' : '#37474f',
          life: 1.0
        });
      }

      // 5. Water splashes
      this.splashes = [];

      // Update control buttons to show Rebuild option
      const resetBtn = document.getElementById('sim4-reset');
      if (resetBtn) {
        resetBtn.textContent = '🔨 Reconstruiește Podul';
        resetBtn.classList.add('sim-btn--primary');
      }

      this._updateBadges();
    }

    _updateCollapsePhysics(dt) {
      this.collapseTime += dt;
      const H = this.H;
      const waterY = H - (H * 0.16);

      // 1. Left segment damped swinging to vertical dangle
      if (this.leftWreck) {
        const diff = this.leftWreck.targetAngle - this.leftWreck.angle;
        const acc = diff * 7.0 - this.leftWreck.vAngle * 2.5;
        this.leftWreck.vAngle += acc * dt;
        this.leftWreck.angle += this.leftWreck.vAngle * dt;
      }

      // 2. Falling center deck chunk
      if (this.centerWreck) {
        if (this.centerWreck.y < waterY) {
          // Free fall in air
          this.centerWreck.vy += 420 * dt; // gravity
          this.centerWreck.y += this.centerWreck.vy * dt;
          this.centerWreck.x += this.centerWreck.vx * dt;
          this.centerWreck.angle += this.centerWreck.vAngle * dt;
        } else {
          // Hit water!
          if (!this.centerWreck.hitWater) {
            this.centerWreck.hitWater = true;
            this._spawnWaterSplashes(this.centerWreck.x, waterY, 28);
          }
          // Sinking / water buoyancy drag
          this.centerWreck.vy *= Math.max(0, 1 - 4 * dt);
          this.centerWreck.vAngle *= Math.max(0, 1 - 3 * dt);
          this.centerWreck.y = Math.min(H - 10, this.centerWreck.y + this.centerWreck.vy * dt);
        }
      }

      // 3. Falling Car
      if (this.fallingCar) {
        if (this.fallingCar.y < waterY) {
          this.fallingCar.vy += 450 * dt;
          this.fallingCar.y += this.fallingCar.vy * dt;
          this.fallingCar.x += this.fallingCar.vx * dt;
          this.fallingCar.angle += this.fallingCar.vAngle * dt;
        } else {
          if (!this.fallingCar.hitWater) {
            this.fallingCar.hitWater = true;
            this._spawnWaterSplashes(this.fallingCar.x, waterY, 18);
          }
          this.fallingCar.vy *= Math.max(0, 1 - 4.5 * dt);
          this.fallingCar.vAngle *= Math.max(0, 1 - 4 * dt);
          this.fallingCar.y = Math.min(H - 12, this.fallingCar.y + this.fallingCar.vy * dt);
        }
      }

      // 4. Debris particles
      for (let i = this.debris.length - 1; i >= 0; i--) {
        const d = this.debris[i];
        d.vy += 480 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.angle += d.vAngle * dt;
        d.life -= dt * 0.35;
        if (d.y >= waterY && Math.random() < 0.2) {
          this._spawnWaterSplashes(d.x, waterY, 2);
        }
        if (d.life <= 0 || d.y > H + 20) {
          this.debris.splice(i, 1);
        }
      }

      // 5. Water Splashes
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 380 * dt; // gravity
        s.life -= dt * 0.9;
        if (s.life <= 0) {
          this.splashes.splice(i, 1);
        }
      }

      // History recording in collapsed state (flatlines at collapsed angle)
      this.historyTheta[this.historyIndex] = 0;
      this.historyIndex = (this.historyIndex + 1) % this.historyLength;
    }

    _spawnWaterSplashes(x, y, count) {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.3;
        const spd = 60 + Math.random() * 190;
        this.splashes.push({
          x: x + (Math.random() - 0.5) * 24,
          y: y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          radius: 2 + Math.random() * 3.5,
          color: Math.random() > 0.4 ? 'rgba(0, 229, 255, 0.75)' : 'rgba(255, 255, 255, 0.9)',
          life: 1.0
        });
      }
    }

    update(dt) {
      // If already collapsed, simulate the debris falling into the sound
      if (this.isCollapsed) {
        this._updateCollapsePhysics(dt);
        return;
      }

      if (this.isDragging) return;

      // Integration sub-stepping for smooth, accurate RK4 simulation
      const subSteps = 6;
      const h = dt / subSteps;

      const w0Tors = this.wTors * Math.sqrt(this.kTheta);
      const A1 = this._getFlutterDerivativeA1();
      const rho = 1.225;
      const B = this.B;
      const I = this.I;

      // Kármán vortex shedding frequency Strouhal relation: fs = St * v / D
      const St = 0.13;
      const fK = (St * this.windSpeed) / this.D;
      const wK = 2 * Math.PI * fK;

      for (let s = 0; s < subSteps; s++) {
        const tCur = this.time - dt + s * h;

        // Equations of motion with non-linear physical cable limits:
        const derivFn = (th, wth, t) => {
          // Structural damping
          const dampStruct = 2 * this.cTheta * w0Tors * wth;

          // Non-linear cubic hardening restoring torque of suspension cables:
          // The suspension cables stiffen non-linearly under geometric tension.
          // This prevents unphysical infinite 360-degree rotation!
          const kRestoring = Math.pow(w0Tors, 2) * (th + 1.4 * Math.pow(th, 3));

          // Asymmetric cable snap effect: if cable snapped, heavy bias pulls bridge into twist
          const asymBias = this.cableSnapped ? 0.45 * Math.sin(w0Tors * 0.9 * t) : 0;

          // Aerodynamic moment with aerodynamic stall saturation:
          // Above ~20 degrees, airflow separates (dynamic stall), diminishing aerodynamic moment
          const stallFactor = 1.0 / (1.0 + 2.8 * Math.pow(th, 2));
          const aeroDamping = (0.5 * rho * this.windSpeed * Math.pow(B, 3) * A1 * wth * stallFactor) / I;
          const aeroStiffness = (0.5 * rho * Math.pow(this.windSpeed, 2) * Math.pow(B, 2) * 0.20 * th * stallFactor) / I;

          // Vortex shedding lift moment (periodic wake forcing)
          const vortexAmp = this.deckType === 'h-girder' ? 0.45 : (this.deckType === 'truss' ? 0.05 : 0.02);
          const vortexForcing = vortexAmp * Math.sin(wK * t) * (this.windSpeed / 19.0);

          // Net angular acceleration
          const alpha = -dampStruct - kRestoring + aeroDamping + aeroStiffness + vortexForcing + asymBias;
          return alpha;
        };

        // RK4 step for theta and omegaTheta
        const k1_th = this.omegaTheta;
        const k1_w = derivFn(this.theta, this.omegaTheta, tCur);

        const k2_th = this.omegaTheta + 0.5 * h * k1_w;
        const k2_w = derivFn(this.theta + 0.5 * h * k1_th, this.omegaTheta + 0.5 * h * k1_w, tCur + 0.5 * h);

        const k3_th = this.omegaTheta + 0.5 * h * k2_w;
        const k3_w = derivFn(this.theta + 0.5 * h * k2_th, this.omegaTheta + 0.5 * h * k2_w, tCur + 0.5 * h);

        const k4_th = this.omegaTheta + h * k3_w;
        const k4_w = derivFn(this.theta + h * k3_th, this.omegaTheta + h * k3_w, tCur + h);

        this.theta += (h / 6) * (k1_th + 2 * k2_th + 2 * k3_th + k4_th);
        this.omegaTheta += (h / 6) * (k1_w + 2 * k2_w + 2 * k3_w + k4_w);

        // Bounded vertical heaving oscillation (coupled to torsion)
        const accY = -Math.pow(this.wVert, 2) * this.y - 0.20 * this.vy + 0.18 * Math.sin(wK * tCur) * (this.windSpeed / 19.0) * (this.deckType === 'h-girder' ? 1.0 : 0.1);
        this.vy += accY * h;
        this.y += this.vy * h;
        // Clamp vertical heaving strictly to [-1.5m, 1.5m]
        this.y = Math.max(-1.5, Math.min(1.5, this.y));
      }

      // Check structural collapse threshold:
      // When twist reaches critical threshold (+/- 38 degrees), the bridge actually snaps!
      const deg = Math.abs(this.theta * (180 / Math.PI));
      if (deg >= this.critThetaDeg || (this.cableSnapped && deg >= 28.0)) {
        this._triggerCollapse();
        return;
      }

      // Update history buffer for oscilloscope
      this.historyTheta[this.historyIndex] = this.theta;
      this.historyTime[this.historyIndex] = this.time;
      this.historyIndex = (this.historyIndex + 1) % this.historyLength;

      // Orbit points for phase portrait (theta vs omega_theta)
      if (Math.random() < 0.35) {
        this.orbitPoints.push({ th: this.theta, w: this.omegaTheta });
        if (this.orbitPoints.length > this.maxOrbitPoints) {
          this.orbitPoints.shift();
        }
      }

      // Update wind particles
      const speedScale = (this.windSpeed / 19.0) * 0.7;
      for (const p of this.particles) {
        p.x += p.speed * speedScale * dt * 1.5;
        if (p.x > 1.05) {
          p.x = -0.05;
          p.y = Math.random();
        }
      }

      // Update vortices
      if (this.windSpeed > 4) {
        if (Math.random() < (this.windSpeed / 25.0) * 0.3) {
          const side = Math.sin(wK * this.time) > 0 ? 1 : -1;
          this.vortices.push({
            x: 0,
            y: side * (12 + Math.random() * 8),
            radius: 8 + Math.random() * 6,
            rotation: 0,
            rotSpeed: side * 4.0,
            opacity: 0.6,
            life: 1.0
          });
        }
      }

      for (let i = this.vortices.length - 1; i >= 0; i--) {
        const v = this.vortices[i];
        v.x += (this.windSpeed * 3.5) * dt;
        v.rotation += v.rotSpeed * dt;
        v.radius += 10 * dt;
        v.life -= dt * 0.65;
        v.opacity = Math.max(0, v.life * 0.5);
        if (v.life <= 0) {
          this.vortices.splice(i, 1);
        }
      }
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;

      ctx.clearRect(0, 0, W, H);

      // 1. Background (Stormy Puget Sound Sky & Mist)
      this._drawAtmosphere(ctx, W, H);

      // 2. Top Warning Banner
      this._drawBanner(ctx, W);

      // Layout split: Left 62% Main Bridge 3D View, Right 38% Diagnostic Graphs
      const isNarrow = W < 640;
      const mainW = isNarrow ? W : W * 0.61;
      const mainH = isNarrow ? H * 0.62 : H;
      const sideX = isNarrow ? 0 : W * 0.61;
      const sideY = isNarrow ? H * 0.62 : 0;
      const sideW = isNarrow ? W : W * 0.39;
      const sideH = isNarrow ? H * 0.38 : H;

      // 3. Main Bridge Visualization (Cross-Section & Suspension perspective)
      this._drawBridgeSection(ctx, mainW, mainH);

      // 4. Diagnostic Instruments Panel (Oscilloscope & Phase Plane)
      this._drawDiagnostics(ctx, sideX, sideY, sideW, sideH, isNarrow);
    }

    _drawAtmosphere(ctx, W, H) {
      const stormGrad = ctx.createLinearGradient(0, 0, 0, H);
      stormGrad.addColorStop(0, '#060912');
      stormGrad.addColorStop(0.5, '#0b1122');
      stormGrad.addColorStop(1, '#070b16');
      ctx.fillStyle = stormGrad;
      ctx.fillRect(0, 0, W, H);

      // Water body at bottom
      const waterH = H * 0.16;
      const waterY = H - waterH;
      const waterGrad = ctx.createLinearGradient(0, waterY, 0, H);
      waterGrad.addColorStop(0, '#0a1728');
      waterGrad.addColorStop(0.5, '#07101e');
      waterGrad.addColorStop(1, '#030810');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, waterY, W, waterH);

      // Water reflection lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const wy = waterY + 6 + i * (waterH / 6);
        ctx.beginPath();
        ctx.moveTo(0, wy);
        ctx.lineTo(W, wy);
        ctx.stroke();
      }

      // Wind Flow Streak Particles
      ctx.save();
      for (const p of this.particles) {
        const px = p.x * W;
        const py = p.y * (H * 0.82);
        const len = 14 + (this.windSpeed / 35.0) * 45;

        ctx.strokeStyle = `rgba(105, 240, 174, ${p.opacity * (this.windSpeed / 25.0)})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + len, py);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawBanner(ctx, W) {
      const h = this.H < 300 ? 20 : 26;
      let text, color, bg;

      const deg = Math.abs(this.theta * (180 / Math.PI));
      const isNarrow = W < 540;

      if (this.isCollapsed) {
        color = '#ff1744';
        bg = 'rgba(255, 23, 68, 0.28)';
        text = isNarrow
          ? `💥 COLAPS TOTAL! Podul s-a rupt la ±${this.critThetaDeg}°!`
          : `💥 COLAPS STRUCTURAL TOTAL! Torsiunea a rupt cablurile și niturile de oțel — Tablierul a căzut în apă!`;
      } else if (deg > 14) {
        color = '#ff5252';
        bg = 'rgba(255, 82, 82, 0.22)';
        text = isNarrow
          ? `⚠️ FLUTTER DIVERGENT! Torsiune = ±${deg.toFixed(1)}° | Amortizare Negativă`
          : `⚠️ FLUTTER AEROELASTIC DIVERGENT! Torsiune extremă = ±${deg.toFixed(1)}° (Auto-excitație structurală distructivă)`;
      } else if (this.windSpeed > 14 && this.deckType === 'h-girder') {
        color = '#ffab40';
        bg = 'rgba(255, 171, 64, 0.15)';
        text = isNarrow
          ? `🌪️ VÂNT CRITIC: ${this.windSpeed.toFixed(1)} m/s | Începe instabilitatea`
          : `🌪️ VÂNT ÎN ZONA CRITICĂ: v = ${this.windSpeed.toFixed(1)} m/s (68 km/h) — Generare intensă de vârtejuri Kármán`;
      } else {
        color = '#69f0ae';
        bg = 'rgba(105, 240, 174, 0.10)';
        text = isNarrow
          ? `🛡️ REGIM STABIL: ${this.deckType.toUpperCase()} | v = ${this.windSpeed.toFixed(1)} m/s`
          : `🛡️ REGIM STABIL | Structură: ${this.deckType === 'truss' ? 'Grindă cu Zăbrele (Nou 1950)' : (this.deckType === 'aerofoil' ? 'Profil Aerodinamic Casetat' : 'Grindă H')} | Amortizare pozitivă`;
      }

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, h);
      ctx.strokeStyle = color + '55';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(W, h);
      ctx.stroke();

      const fontSize = isNarrow ? 9 : (W < 750 ? 10 : 11);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, h / 2);
    }

    _drawBridgeSection(ctx, mainW, mainH) {
      const cx = mainW * 0.44;
      const cy = mainH * 0.46 + this.y * 12;

      // Suspension Towers on background
      const towerX1 = cx - mainW * 0.38;
      const towerX2 = cx + mainW * 0.38;
      const towerTopY = mainH * 0.08;
      const towerBotY = mainH * 0.88;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 4;
      // Tower 1
      ctx.strokeRect(towerX1 - 8, towerTopY, 16, towerBotY - towerTopY);
      // Tower 2
      ctx.strokeRect(towerX2 - 8, towerTopY, 16, towerBotY - towerTopY);

      // Cross-bracings on towers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1.5;
      for (let tX of [towerX1, towerX2]) {
        for (let i = 0; i < 4; i++) {
          const y1 = towerTopY + i * ((towerBotY - towerTopY) / 4);
          const y2 = towerTopY + (i + 1) * ((towerBotY - towerTopY) / 4);
          ctx.beginPath();
          ctx.moveTo(tX - 8, y1);
          ctx.lineTo(tX + 8, y2);
          ctx.moveTo(tX + 8, y1);
          ctx.lineTo(tX - 8, y2);
          ctx.stroke();
        }
      }

      // Main Suspension Cables (Parabolic Catenary)
      const cableY = mainH * 0.12;
      const recoilOffset = this.isCollapsed
        ? -26 * Math.exp(-1.4 * this.collapseTime) * Math.cos(5.0 * this.collapseTime)
        : 0;

      ctx.save();
      ctx.strokeStyle = this.isCollapsed ? 'rgba(0, 229, 255, 0.5)' : '#00e5ff88';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(towerX1, cableY);
      ctx.quadraticCurveTo(cx, cy - 70 + recoilOffset, towerX2, cableY);
      ctx.stroke();
      ctx.restore();

      const deckScale = Math.min(mainW * 0.65, 260);
      const halfB = deckScale / 2;
      const girderH = deckScale * 0.22;

      // ==========================================
      // CASE 1: COLLAPSED POST-FAILURE VIEW
      // ==========================================
      if (this.isCollapsed) {
        this._drawCollapsedScene(ctx, cx, cy, halfB, girderH, towerX1, towerX2, cableY, recoilOffset, mainW, mainH);
        return;
      }

      // ==========================================
      // CASE 2: INTACT OSCILLATING BRIDGE VIEW
      // ==========================================
      const cosTh = Math.cos(this.theta);
      const sinTh = Math.sin(this.theta);

      const xL = cx - halfB * cosTh;
      const yL = cy - halfB * sinTh;
      const xR = cx + halfB * cosTh;
      const yR = cy + halfB * sinTh;

      // Vertical Suspender Hangers
      const hangerTopYL = cableY + Math.pow((xL - cx) / (towerX2 - cx), 2) * (cy - 70 - cableY);
      const hangerTopYR = cableY + Math.pow((xR - cx) / (towerX2 - cx), 2) * (cy - 70 - cableY);

      const stressL = Math.max(0.1, 1.0 - (sinTh * 1.6));
      const stressR = Math.max(0.1, 1.0 + (sinTh * 1.6));

      this._drawSuspenderCable(ctx, xL, hangerTopYL, xL, yL, stressL, this.cableSnapped);
      this._drawSuspenderCable(ctx, xR, hangerTopYR, xR, yR, stressR, false);

      // Kármán Vortices emanating downwind
      ctx.save();
      for (const v of this.vortices) {
        const vx = xR + v.x;
        const vy = yR + v.y;
        ctx.strokeStyle = `rgba(255, 171, 64, ${v.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(vx, vy, v.radius, v.rotation, v.rotation + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();

      // Draw the Rotated Deck Structure
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.theta);

      if (this.deckType === 'h-girder') {
        this._drawHGirderDeck(ctx, halfB, girderH);
      } else if (this.deckType === 'truss') {
        this._drawTrussDeck(ctx, halfB, girderH);
      } else {
        this._drawAerofoilDeck(ctx, halfB, girderH);
      }

      // Draw Abandoned Car (Tubby's car on the tilting roadway!)
      this._drawAbandonedCar(ctx, halfB * 0.15, -girderH * 0.5);

      ctx.restore();

      // Rotation Angle Arc HUD
      this._drawAngleArc(ctx, cx, cy, halfB * 0.75);

      // Wind Vector Arrow at Left
      this._drawWindIndicator(ctx, 16, mainH * 0.40, mainW * 0.18);
    }

    _drawCollapsedScene(ctx, cx, cy, halfB, girderH, towerX1, towerX2, cableY, recoilOffset, mainW, mainH) {
      const waterY = mainH - (mainH * 0.16);

      // 1. Left damaged dangling segment (swings from left hanger)
      if (this.leftWreck) {
        ctx.save();
        ctx.translate(this.leftWreck.pivotX, this.leftWreck.pivotY);
        ctx.rotate(this.leftWreck.angle);

        ctx.fillStyle = '#263238';
        ctx.fillRect(0, -5, this.leftWreck.length, 10);

        // Solid girder on outer side
        ctx.fillStyle = '#37474f';
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, -girderH * 0.4, this.leftWreck.length, girderH * 0.8);

        // Jagged broken fracture edge at the end
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.moveTo(this.leftWreck.length, -girderH * 0.4);
        ctx.lineTo(this.leftWreck.length + 8, -girderH * 0.1);
        ctx.lineTo(this.leftWreck.length - 4, 0);
        ctx.lineTo(this.leftWreck.length + 6, girderH * 0.2);
        ctx.lineTo(this.leftWreck.length, girderH * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Left suspender cable holding the dangling wreckage
        const hangerTopYL = cableY + Math.pow((this.leftWreck.pivotX - cx) / (towerX2 - cx), 2) * (cy - 70 - cableY);
        ctx.strokeStyle = '#ff5252';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(this.leftWreck.pivotX, hangerTopYL);
        ctx.lineTo(this.leftWreck.pivotX, this.leftWreck.pivotY);
        ctx.stroke();
      }

      // 2. Right Suspender Cable (SNAPPED IN HALF)
      const xR = cx + halfB * 0.9;
      const hangerTopYR = cableY + Math.pow((xR - cx) / (towerX2 - cx), 2) * (cy - 70 - cableY);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 82, 82, 0.7)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xR, hangerTopYR);
      // Dangles curled down halfway
      const swingX = Math.sin(this.collapseTime * 3) * 12;
      ctx.quadraticCurveTo(xR - 10 + swingX, hangerTopYR + 60, xR + swingX, hangerTopYR + 110);
      ctx.stroke();
      ctx.restore();

      // 3. Falling / Sunk Center Roadway Slab
      if (this.centerWreck) {
        ctx.save();
        ctx.translate(this.centerWreck.x, this.centerWreck.y);
        ctx.rotate(this.centerWreck.angle);

        ctx.fillStyle = '#1c2430';
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 2;
        ctx.fillRect(-this.centerWreck.w / 2, -girderH / 2, this.centerWreck.w, girderH);
        ctx.strokeRect(-this.centerWreck.w / 2, -girderH / 2, this.centerWreck.w, girderH);

        // Asphalt lane line
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(-this.centerWreck.w / 2 + 10, 0);
        ctx.lineTo(this.centerWreck.w / 2 - 10, 0);
        ctx.stroke();

        ctx.restore();
      }

      // 4. Falling / Sunk Car
      if (this.fallingCar) {
        this._drawAbandonedCar(ctx, this.fallingCar.x, this.fallingCar.y, this.fallingCar.angle);
      }

      // 5. Debris shards flying through air
      ctx.save();
      for (const d of this.debris) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.fillStyle = d.color;
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
        ctx.restore();
      }
      ctx.restore();

      // 6. Water Splashes erupting from Puget Sound
      ctx.save();
      for (const s of this.splashes) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Disaster Announcement Card on Canvas
      ctx.save();
      const cardW = Math.min(mainW * 0.72, 310);
      const cardH = 54;
      const cardX = cx - cardW / 2;
      const cardY = mainH * 0.24;

      ctx.fillStyle = 'rgba(255, 23, 68, 0.16)';
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💥 CEDARE STRUCTURALĂ CATASTROFALĂ', cx, cardY + 20);

      ctx.fillStyle = '#e8eaf6';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('Click pe ecran sau „Reset” pentru reconstrucție', cx, cardY + 38);
      ctx.restore();
    }

    _drawSuspenderCable(ctx, x1, y1, x2, y2, stress, isSnapped) {
      if (isSnapped) {
        // Draw snapped, slack, curled cable
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 82, 82, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(x1 - 18, (y1 + y2) * 0.5, x1 - 6, (y1 + y2) * 0.5 + 20);
        ctx.stroke();
        ctx.restore();
        return;
      }

      ctx.save();
      let color = '#00e5ff';
      let lw = 2.0;

      if (stress > 1.6) {
        color = '#ff1744';
        lw = 3.5;
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 10;
      } else if (stress > 1.25) {
        color = '#ffab40';
        lw = 2.8;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    _drawHGirderDeck(ctx, halfB, girderH) {
      const roadwayThick = 10;

      // 1. Roadway Asphalt Slab
      ctx.fillStyle = '#222938';
      ctx.fillRect(-halfB, -roadwayThick / 2, halfB * 2, roadwayThick);

      // Roadway lines (yellow center lane stripes)
      ctx.strokeStyle = '#ffc107';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(-halfB + 8, 0);
      ctx.lineTo(halfB - 8, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Solid Steel H-Girders on Left and Right edges
      const gThick = 12;
      ctx.fillStyle = '#37474f';
      ctx.strokeStyle = '#78909c';
      ctx.lineWidth = 1.5;

      // Left solid girder
      ctx.fillRect(-halfB - gThick, -girderH / 2, gThick, girderH);
      ctx.strokeRect(-halfB - gThick, -girderH / 2, gThick, girderH);

      // Right solid girder
      ctx.fillRect(halfB, -girderH / 2, gThick, girderH);
      ctx.strokeRect(halfB, -girderH / 2, gThick, girderH);

      // Girder Flanges (H profile caps)
      ctx.fillStyle = '#455a64';
      ctx.fillRect(-halfB - gThick - 4, -girderH / 2 - 3, gThick + 8, 6);
      ctx.fillRect(-halfB - gThick - 4, girderH / 2 - 3, gThick + 8, 6);
      ctx.fillRect(halfB - 4, -girderH / 2 - 3, gThick + 8, 6);
      ctx.fillRect(halfB - 4, girderH / 2 - 3, gThick + 8, 6);

      // Structural label
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GRINDĂ PLINĂ „H” (Bluff Body)', 0, girderH / 2 + 18);
    }

    _drawTrussDeck(ctx, halfB, girderH) {
      const deepH = girderH * 1.5;
      const roadwayThick = 8;

      // Roadway Slab
      ctx.fillStyle = '#263238';
      ctx.fillRect(-halfB, -roadwayThick / 2, halfB * 2, roadwayThick);

      // Open Truss Lattice (diagonals allow wind to pass freely)
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-halfB, -deepH / 2, halfB * 2, deepH);

      const numBays = 8;
      const bayW = (halfB * 2) / numBays;

      ctx.beginPath();
      for (let i = 0; i < numBays; i++) {
        const bx1 = -halfB + i * bayW;
        const bx2 = bx1 + bayW;
        ctx.moveTo(bx1, -deepH / 2);
        ctx.lineTo(bx2, deepH / 2);
        ctx.moveTo(bx2, -deepH / 2);
        ctx.lineTo(bx1, deepH / 2);
      }
      ctx.stroke();

      ctx.fillStyle = '#69f0ae';
      ctx.font = 'bold 8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ZĂBRELE DESCHISE (Permeabil la Vânt)', 0, deepH / 2 + 18);
    }

    _drawAerofoilDeck(ctx, halfB, girderH) {
      const aeroH = girderH * 0.7;

      ctx.fillStyle = '#1c2638';
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(-halfB, 0);
      ctx.lineTo(-halfB * 0.8, -aeroH / 2);
      ctx.lineTo(halfB * 0.8, -aeroH / 2);
      ctx.lineTo(halfB, 0);
      ctx.lineTo(halfB * 0.8, aeroH / 2);
      ctx.lineTo(-halfB * 0.8, aeroH / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Road surface
      ctx.strokeStyle = '#ffab40';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(-halfB * 0.75, -aeroH / 2 + 3);
      ctx.lineTo(halfB * 0.75, -aeroH / 2 + 3);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#69f0ae';
      ctx.font = 'bold 8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CASETĂ AERODINAMICĂ (Flux Ataşat)', 0, aeroH / 2 + 18);
    }

    _drawAbandonedCar(ctx, x, y, angle) {
      ctx.save();
      ctx.translate(x, y - 6);
      if (angle !== undefined) {
        ctx.rotate(angle);
      }

      // Car body (1930s coupe style)
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.roundRect(-12, -7, 24, 7, 2);
      ctx.fill();

      // Cabin roof
      ctx.fillStyle = '#b71c1c';
      ctx.beginPath();
      ctx.roundRect(-6, -13, 12, 6, 2);
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(-8, 0, 3, 0, Math.PI * 2);
      ctx.arc(8, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Historical tag
      ctx.fillStyle = '#e8eaf6';
      ctx.font = '7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Tubby', 0, -16);
      ctx.restore();
    }

    _drawAngleArc(ctx, cx, cy, radius) {
      const deg = this.theta * (180 / Math.PI);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - radius - 15, cy);
      ctx.lineTo(cx + radius + 15, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Torsion arc
      ctx.strokeStyle = Math.abs(deg) > 15 ? '#ff5252' : '#ffab40';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, this.theta, this.theta < 0);
      ctx.stroke();

      ctx.fillStyle = Math.abs(deg) > 15 ? '#ff5252' : '#ffab40';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`θ = ${deg.toFixed(1)}°`, cx, cy - radius - 8);
      ctx.restore();
    }

    _drawWindIndicator(ctx, x, y, maxW) {
      const arrowLen = Math.min(maxW, 14 + (this.windSpeed / 35.0) * 65);
      ctx.save();
      ctx.fillStyle = '#69f0ae';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`VÂNT: ${this.windSpeed.toFixed(1)} m/s`, x, y - 8);

      // Arrow
      this.drawArrow(x, y, x + arrowLen, y, '#69f0ae', 2.5);
      ctx.restore();
    }

    _drawDiagnostics(ctx, gx, gy, gw, gh, isNarrow) {
      // 1. Upper Half: Real-time Torsional Waveform theta(t)
      const oscY = gy + 6;
      const oscH = gh * 0.49 - 8;
      this._drawOscilloscope(ctx, gx + 6, oscY, gw - 12, oscH);

      // 2. Lower Half: Phase Plane Portrait (theta vs omega_theta)
      const phaseY = gy + gh * 0.51;
      const phaseH = gh * 0.48 - 6;
      this._drawPhasePortrait(ctx, gx + 6, phaseY, gw - 12, phaseH);
    }

    _drawOscilloscope(ctx, gx, gy, gw, gh) {
      ctx.fillStyle = 'rgba(15, 22, 41, 0.82)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      const title = gw < 280 ? 'Oscilație θ(t)' : 'Osciloscop Torsional θ(t) & Prag Critic';
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(title, gx + 10, gy + 14);

      const plotX = gx + 34;
      const plotW = gw - 44;
      const midY = gy + gh * 0.52;
      const maxAngle = this.critThetaDeg * (Math.PI / 180) * 1.15;
      const scaleY = (gh * 0.38) / maxAngle;

      // Center reference
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(plotX, midY);
      ctx.lineTo(plotX + plotW, midY);
      ctx.stroke();

      // Critical Collapse Thresholds (+/- 38 deg)
      const critPix = (this.critThetaDeg * (Math.PI / 180)) * scaleY;
      ctx.save();
      ctx.strokeStyle = '#ff1744aa';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;

      // Top threshold
      ctx.beginPath();
      ctx.moveTo(plotX, midY - critPix);
      ctx.lineTo(plotX + plotW, midY - critPix);
      ctx.stroke();

      // Bottom threshold
      ctx.beginPath();
      ctx.moveTo(plotX, midY + critPix);
      ctx.lineTo(plotX + plotW, midY + critPix);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#ff1744';
      ctx.font = '7.5px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`+${this.critThetaDeg}°`, plotX - 3, midY - critPix + 3);
      ctx.fillText(`-${this.critThetaDeg}°`, plotX - 3, midY + critPix + 3);
      ctx.fillText('0°', plotX - 3, midY + 3);

      // Plot waveform history
      ctx.beginPath();
      ctx.strokeStyle = this.isCollapsed ? '#ff1744' : (Math.abs(this.theta * 180 / Math.PI) > 14 ? '#ff5252' : '#00e5ff');
      ctx.lineWidth = 2.0;

      for (let i = 0; i < this.historyLength; i++) {
        const idx = (this.historyIndex + i) % this.historyLength;
        const val = this.historyTheta[idx];
        const xx = plotX + (i / this.historyLength) * plotW;
        const yy = midY - val * scaleY;

        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }

    _drawPhasePortrait(ctx, gx, gy, gw, gh) {
      ctx.fillStyle = 'rgba(15, 22, 41, 0.82)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      const title = gw < 280 ? 'Portret Fază (θ, ω)' : 'Portret de Fază (θ vs dθ/dt) — Ciclu Limită / Divergență';
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(title, gx + 10, gy + 14);

      const cx = gx + gw * 0.50;
      const cy = gy + gh * 0.54;
      const maxTh = this.critThetaDeg * (Math.PI / 180) * 1.1;
      const maxW = 5.0; // rad/s
      const scaleX = (gw * 0.38) / maxTh;
      const scaleY = (gh * 0.34) / maxW;

      // Axes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(cx - gw * 0.42, cy);
      ctx.lineTo(cx + gw * 0.42, cy);
      ctx.moveTo(cx, cy - gh * 0.38);
      ctx.lineTo(cx, cy + gh * 0.38);
      ctx.stroke();

      ctx.fillStyle = '#5c5e78';
      ctx.font = '7.5px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('dθ/dt', cx - 4, cy - gh * 0.34);
      ctx.fillText('θ', cx + gw * 0.42, cy - 4);

      // Draw Phase Orbit
      if (this.orbitPoints.length > 2) {
        ctx.beginPath();
        ctx.strokeStyle = this.isCollapsed ? 'rgba(255, 23, 68, 0.65)' : 'rgba(255, 171, 64, 0.65)';
        ctx.lineWidth = 1.6;

        for (let i = 0; i < this.orbitPoints.length; i++) {
          const pt = this.orbitPoints[i];
          const px = cx + pt.th * scaleX;
          const py = cy - pt.w * scaleY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Current operating dot
      const curDotX = cx + this.theta * scaleX;
      const curDotY = cy - this.omegaTheta * scaleY;

      ctx.fillStyle = this.isCollapsed ? '#ff1744' : '#00e5ff';
      ctx.beginPath();
      ctx.arc(curDotX, curDotY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Legend note
      ctx.fillStyle = '#5c5e78';
      ctx.font = '8px Inter, sans-serif';
      ctx.textAlign = 'center';
      const statusNote = this.isCollapsed ? 'COLAPS TOTAL (PRĂBUȘIT)' : (this._getFlutterDerivativeA1() > 0 ? 'SPIRALĂ EXPANSIVĂ (FLUTTER DIVERGENT)' : 'CICLU STABIL / ATRASĂ LA ZERO');
      ctx.fillText(statusNote, cx, gy + gh - 6);
    }
  }

  window.TacomaNarrowsSim = TacomaNarrowsSim;
})();
