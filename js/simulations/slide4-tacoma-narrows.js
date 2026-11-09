/* ============================================================
   SLIDE 4: TACOMA NARROWS BRIDGE (1940) — AEROELASTIC FLUTTER
   Simulare avansată 3D + Tunel Aerodinamic în Secțiune:
   1. Separarea fluxului pe grinzile pline (solid plate girders) & vârtejuri
   2. Ora 10:00 AM: Alunecarea colierului central (cable band slip) -> Torsiune
   3. Auto-excitație (Aeroelastic Flutter): vântul împinge în direcția răsucirii (±45°)
   4. Forfecarea cablurilor verticale (suspenders) unul câte unul
   5. Ora 11:00 AM: Ruperea secțiunii de 600 ft (183 m), urmată la 11:09 AM de restul podului
   Autor: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  class TacomaNarrowsSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // Physical & Historical Parameters
      this.B = 11.9;               // Lățimea tablierului (m)
      this.D = 2.4;                // Înălțimea grinzii pline (m)
      this.windSpeed = (config && config.windSpeed !== undefined) ? config.windSpeed : 19.0; // 19 m/s = 68 km/h
      this.kTheta = (config && config.kTheta !== undefined) ? config.kTheta : 1.0;
      this.cTheta = (config && config.cTheta !== undefined) ? config.cTheta : 0.03;
      this.deckType = (config && config.deckType) || 'h-girder'; // 'h-girder' | 'truss' | 'aerofoil'

      // Frequencies
      this.wTors = 1.65;           // Pulsație torsională de afișare
      this.wVert = 2.10;           // Pulsație verticală (mod Galloping Gertie)

      // Number of discrete roadway segments across the 2800-ft (853 m) main span
      this.numSegments = 22;

      // Historical Timeline State
      // Phases:
      // 1 = 09:30 AM: Oscilații verticale (Vortex shedding, colier intact)
      // 2 = 10:00 AM: Colierul central alunecă -> Fluture Aeroelastic Torsional (crește spre ±45°)
      // 3 = 10:55 AM: La ±45°, cablurile verticale (suspenders) se forfecă unul câte unul
      // 4 = 11:00 AM: Secțiunea de 600 ft (segmentele 3..9) se rupe și cade în apă
      // 5 = 11:09 AM: Restul deschiderii principale cedează în cascadă și se prăbușește
      this.phase = 1;
      this.simClockMinutes = 0;    // Minutes since 09:45 AM
      this.cableBandSlipped = false;
      this.bandSlipSparkTimer = 0;

      // Torsional & Vertical state
      this.theta = 0.0;            // Peak torsional angle of main span (rad)
      this.omegaTheta = 0.0;       // Angular velocity d(theta)/dt (rad/s)
      this.maxAllowedDeg = 45.0;   // Historical 45 degree peak tilt
      this.vertPhase = 0.0;
      this.vertAmp = 0.35;

      // Segment & Suspender Cable Arrays
      this.segments = [];
      this.sparks = [];
      this.splashes = [];
      this.vortices = [];
      this.streamParticles = [];

      // Timers for progressive cable shearing and two-stage collapse
      this.cableSnapTimer = 0;
      this.stage2CollapseTimer = 0;

      // History buffer for theta(t) plot
      this.historyLength = 180;
      this.historyTheta = new Float32Array(this.historyLength);
      this.historyIndex = 0;

      // Mouse drag interaction
      this.isDragging = false;
      this.dragStartY = 0;
      this.dragStartTheta = 0;

      this._initStreamParticles();
      this._initBridgeSegments();
    }

    _initStreamParticles() {
      this.streamParticles = [];
      for (let i = 0; i < 38; i++) {
        this.streamParticles.push({
          x: Math.random(),
          y: (Math.random() - 0.5) * 1.8,
          speed: 0.75 + Math.random() * 0.45,
          size: 1.5 + Math.random() * 1.5
        });
      }
    }

    _initBridgeSegments() {
      this.segments = [];
      // 600-foot section is segments 3 through 9 (7 segments out of 22 ~ 30% of main span)
      for (let i = 0; i < this.numSegments; i++) {
        const is600ftSection = (i >= 3 && i <= 9);
        this.segments.push({
          index: i,
          is600ft: is600ftSection,
          frontCableIntact: true,
          backCableIntact: true,
          cableStress: 0.2,
          sagY: 0,                 // Local sag when cables snap
          detached: false,         // True when section tears free from roadway
          inWater: false,
          fallY: 0,
          fallVy: 0,
          fallRot: 0,
          fallVRot: 0
        });
      }
    }

    init() {
      super.init();
      this._bindControls();
      this._bindMouse();
      // Start directly in historical progression so user sees the action immediately
      this.startHistoricalSequence();
    }

    startHistoricalSequence() {
      this._initBridgeSegments();
      this.sparks = [];
      this.splashes = [];
      this.vortices = [];
      this.historyTheta.fill(0);

      if (this.deckType === 'h-girder' && this.windSpeed >= 15) {
        // Trigger the 10:00 AM cable band slip after 2.2 seconds so user sees vertical -> torsional transition
        this.phase = 1;
        this.cableBandSlipped = false;
        this.simClockMinutes = 10; // 09:55 AM
        this.theta = 0.02;
        this.omegaTheta = 0.0;
      } else {
        this.phase = 1;
        this.cableBandSlipped = false;
        this.simClockMinutes = 0;
        this.theta = 0.02;
        this.omegaTheta = 0.0;
      }

      this._resetButtonsUI();
      this._updateBadges();
    }

    rebuildBridge() {
      this.startHistoricalSequence();
    }

    _resetButtonsUI() {
      const snapBtn = document.getElementById('sim4-snap-cable');
      if (snapBtn) {
        snapBtn.classList.remove('sim-btn--danger');
        snapBtn.textContent = '⚡ 10:00 AM: Alunecă Colierul';
      }
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
        this.rebuildBridge();
      };

      if (btnH) btnH.addEventListener('click', () => setProfile('h-girder'));
      if (btnTruss) btnTruss.addEventListener('click', () => setProfile('truss'));
      if (btnAero) btnAero.addEventListener('click', () => setProfile('aerofoil'));

      // 5. Presets
      const presetCollapse = document.getElementById('sim4-preset-collapse');
      if (presetCollapse) {
        presetCollapse.addEventListener('click', () => {
          this.windSpeed = 19.0;
          this.kTheta = 1.0;
          this.cTheta = 0.03;
          this.deckType = 'h-girder';
          this._syncControlValues();
          this.rebuildBridge();
          // Immediately slip the cable band at 10:00 AM to jump straight into torsional buildup
          this._triggerCableBandSlip();
        });
      }

      const presetTruss = document.getElementById('sim4-preset-truss');
      if (presetTruss) {
        presetTruss.addEventListener('click', () => {
          this.windSpeed = 19.0;
          this.deckType = 'truss';
          this._syncControlValues();
          this.rebuildBridge();
        });
      }

      const presetSnap = document.getElementById('sim4-snap-cable');
      if (presetSnap) {
        presetSnap.addEventListener('click', () => {
          if (this.phase >= 4) {
            this.rebuildBridge();
            return;
          }
          if (!this.cableBandSlipped) {
            this._triggerCableBandSlip();
          } else {
            // Manually shear off the next suspender cable immediately
            this._shearNextSuspender(true);
          }
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

    _triggerCableBandSlip() {
      if (this.cableBandSlipped) return;
      this.cableBandSlipped = true;
      this.phase = 2;
      this.simClockMinutes = 15; // 10:00 AM
      this.bandSlipSparkTimer = 1.5;
      this.theta = 0.12;         // Initial torsional imbalance (~7 deg)
      this.omegaTheta = 0.35;

      const snapBtn = document.getElementById('sim4-snap-cable');
      if (snapBtn) {
        snapBtn.classList.add('sim-btn--danger');
        snapBtn.textContent = '✂️ Forfecă Cablu Vertical';
      }
      this._updateBadges();
    }

    _shearNextSuspender(manualForce) {
      // Find intact suspenders in the 600-ft section first (segments 3..9), then the rest
      const priorityOrder = [6, 5, 7, 4, 8, 3, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 2, 19, 1, 20, 0, 21];
      for (const idx of priorityOrder) {
        const seg = this.segments[idx];
        if (!seg) continue;
        if (seg.frontCableIntact) {
          seg.frontCableIntact = false;
          seg.sagY += 6;
          this._spawnCableSpark(idx, true);
          this._checkSectionFailure();
          this._updateBadges();
          return true;
        }
        if (seg.backCableIntact) {
          seg.backCableIntact = false;
          seg.sagY += 8;
          this._spawnCableSpark(idx, false);
          this._checkSectionFailure();
          this._updateBadges();
          return true;
        }
      }
      return false;
    }

    _checkSectionFailure() {
      // Count how many cables are broken in the 600-foot section (segments 3..9 -> 14 cables total)
      let broken600 = 0;
      for (let i = 3; i <= 9; i++) {
        if (!this.segments[i].frontCableIntact) broken600++;
        if (!this.segments[i].backCableIntact) broken600++;
      }

      // If at least 7 cables in the 600-foot section have snapped, the unsupported weight of concrete & steel tears the 600-ft section free!
      if (broken600 >= 7 && this.phase < 4) {
        this.phase = 4; // 11:00 AM: 600-ft section collapses!
        this.simClockMinutes = 75; // 11:00 AM
        this.stage2CollapseTimer = 0;
        for (let i = 3; i <= 9; i++) {
          const seg = this.segments[i];
          seg.frontCableIntact = false;
          seg.backCableIntact = false;
          seg.detached = true;
          seg.fallVy = 15 + Math.random() * 20;
          seg.fallVRot = (Math.random() - 0.5) * 2.5;
        }
        this._updateBadges();
      }
    }

    _triggerRestOfSpanCollapse() {
      if (this.phase >= 5) return;
      this.phase = 5; // 11:09 AM: Rest of main span collapses!
      this.simClockMinutes = 84; // 11:09 AM
      for (let i = 1; i < this.numSegments - 1; i++) {
        const seg = this.segments[i];
        if (!seg.detached) {
          seg.frontCableIntact = false;
          seg.backCableIntact = false;
          seg.detached = true;
          seg.fallVy = 5 + Math.abs(i - 12) * 3;
          seg.fallVRot = (Math.random() - 0.5) * 3.0;
        }
      }
      this._updateBadges();
    }

    _spawnCableSpark(segIndex, isFront) {
      this.sparks.push({
        segIndex,
        isFront,
        life: 1.0,
        particles: Array.from({ length: 10 }, () => ({
          vx: (Math.random() - 0.5) * 90,
          vy: (Math.random() - 0.5) * 90 - 20,
          x: 0,
          y: 0
        }))
      });
    }

    _countIntactCables() {
      let count = 0;
      for (const s of this.segments) {
        if (s.frontCableIntact) count++;
        if (s.backCableIntact) count++;
      }
      return count;
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

    _getClockString() {
      const totalMins = Math.floor(45 + this.simClockMinutes); // Starts at 09:45 AM
      const hrs = 9 + Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hrs < 10 ? '0' + hrs : hrs}:${mins < 10 ? '0' + mins : mins} AM`;
    }

    _updateBadges() {
      const modeBadge = document.getElementById('sim4-mode-badge');
      const dampBadge = document.getElementById('sim4-damp-badge');
      const intact = this._countIntactCables();
      const total = this.numSegments * 2;

      if (dampBadge) {
        dampBadge.textContent = `Cabluri Verticale: ${intact}/${total}`;
        dampBadge.className = intact < total * 0.6
          ? 'sim-badge sim-badge--danger'
          : (intact < total ? 'sim-badge sim-badge--amber' : 'sim-badge sim-badge--cyan');
      }

      if (modeBadge) {
        const clock = this._getClockString();
        if (this.phase === 5) {
          modeBadge.textContent = `⌚ 11:09 AM — Colaps Total Deschidere`;
          modeBadge.className = 'sim-badge sim-badge--danger';
        } else if (this.phase === 4) {
          modeBadge.textContent = `⌚ 11:00 AM — Secțiunea 600 ft Prăbușită!`;
          modeBadge.className = 'sim-badge sim-badge--danger';
        } else if (this.phase === 3) {
          modeBadge.textContent = `⌚ ${clock} — Forfecare Cabluri (±45°)`;
          modeBadge.className = 'sim-badge sim-badge--danger';
        } else if (this.phase === 2) {
          modeBadge.textContent = `⌚ ${clock} — Fluture Torsional Activ`;
          modeBadge.className = 'sim-badge sim-badge--amber';
        } else {
          modeBadge.textContent = this.deckType === 'h-girder'
            ? `⌚ ${clock} — Oscilații Verticale`
            : `🛡️ Structură Stabilă (${this.deckType === 'truss' ? 'Zăbrele' : 'Aerofoil'})`;
          modeBadge.className = this.deckType === 'h-girder' ? 'sim-badge sim-badge--cyan' : 'sim-badge sim-badge--green';
        }
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
        const pos = getPos(e);
        if (this.phase >= 5 && pos.y < this.H * 0.6) {
          this.rebuildBridge();
          return;
        }
        this.isDragging = true;
        this.dragStartY = pos.y;
        this.dragStartTheta = this.theta;
        if (!this.cableBandSlipped && this.deckType === 'h-girder') {
          this._triggerCableBandSlip();
        }
      };

      const onMove = (e) => {
        if (!this.isDragging) return;
        const pos = getPos(e);
        const dy = pos.y - this.dragStartY;
        const deg = Math.max(-45, Math.min(45, (this.dragStartTheta * 180 / Math.PI) + dy * 0.35));
        this.theta = deg * (Math.PI / 180);
        this.omegaTheta = 0;
      };

      const onUp = () => {
        this.isDragging = false;
      };

      this.canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener('touchstart', onDown, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp);
    }

    update(dt) {
      // Clamp dt for stability
      const safeDt = Math.min(dt, 0.04);

      // Advance vertical standing wave phase
      this.vertPhase += this.wVert * safeDt * (this.windSpeed / 19.0);

      // 1. Check automatic 10:00 AM Cable Band Slip transition
      if (this.phase === 1 && this.deckType === 'h-girder' && this.windSpeed >= 15.0) {
        this.simClockMinutes += safeDt * 1.6;
        if (this.simClockMinutes >= 15.0 && !this.cableBandSlipped) {
          this._triggerCableBandSlip();
        }
      }

      if (this.bandSlipSparkTimer > 0) {
        this.bandSlipSparkTimer = Math.max(0, this.bandSlipSparkTimer - safeDt);
      }

      // 2. Torsional Aeroelastic Flutter Dynamics
      if (!this.isDragging) {
        const subSteps = 5;
        const h = safeDt / subSteps;
        const w0 = this.wTors * Math.sqrt(this.kTheta);

        // Effective aerodynamic pumping rate:
        // For H-girder above 15 m/s, wind actively pumps energy into the twist!
        // For Truss or Aerofoil, aerodynamic damping is positive (decays twist to 0).
        let flutterPump = 0;
        if (this.deckType === 'h-girder') {
          flutterPump = (this.windSpeed - 12.5) * 0.055 - this.cTheta * 2.2;
        } else if (this.deckType === 'truss') {
          flutterPump = -0.35 - this.cTheta * 2.0;
        } else {
          flutterPump = -0.75 - this.cTheta * 2.0;
        }

        const maxRad = (this.maxAllowedDeg * Math.PI) / 180; // 45 deg = 0.785 rad

        for (let s = 0; s < subSteps; s++) {
          if (!this.cableBandSlipped) {
            // Before 10:00 AM: only tiny torsional tremor, mostly vertical wave
            const acc = -w0 * w0 * this.theta - 0.8 * this.omegaTheta + 0.03 * Math.sin(this.vertPhase);
            this.omegaTheta += acc * h;
            this.theta += this.omegaTheta * h;
          } else {
            // After 10:00 AM: Self-excited Van der Pol / Scanlan aeroelastic flutter
            // Wind pushes in the exact direction of omegaTheta, saturating at +/- 45 degrees!
            const normTh = this.theta / maxRad;
            const saturation = 1.0 - Math.pow(normTh, 2) * 0.92;
            const aeroMoment = flutterPump * saturation * this.omegaTheta;

            // Non-linear hardening cable restoring torque so it never spins past +/- 45 deg
            const restoring = -w0 * w0 * this.theta * (1.0 + 0.85 * normTh * normTh);

            const alpha = restoring + aeroMoment;
            this.omegaTheta += alpha * h;
            this.theta += this.omegaTheta * h;

            // Hard physical stop at +/- 46 degrees
            if (Math.abs(this.theta) > maxRad * 1.03) {
              this.theta = Math.sign(this.theta) * maxRad * 1.03;
              this.omegaTheta *= -0.4;
            }
          }
        }
      }

      const curDeg = Math.abs((this.theta * 180) / Math.PI);

      // 3. Progressive Suspender Cable Shearing at high twist (>= 34 deg)
      if (this.phase === 2 && curDeg >= 33.0 && this.deckType === 'h-girder') {
        this.phase = 3; // Enter Phase 3: Cables shearing one by one
        this.simClockMinutes = 65; // ~10:50 AM
        this._updateBadges();
      }

      if (this.phase === 2 && this.simClockMinutes < 65) {
        this.simClockMinutes += safeDt * 3.5;
      }

      if (this.phase === 3 && this.deckType === 'h-girder') {
        this.simClockMinutes = Math.min(74, this.simClockMinutes + safeDt * 1.5);
        // When twisting near peak amplitude, shear off suspender cables one by one!
        if (curDeg >= 32.0) {
          this.cableSnapTimer += safeDt;
          if (this.cableSnapTimer >= 0.55) {
            this.cableSnapTimer = 0;
            this._shearNextSuspender(false);
          }
        }
      }

      // 4. Phase 4 (11:00 AM 600-ft collapse) -> Phase 5 (11:09 AM full span collapse)
      if (this.phase === 4) {
        this.stage2CollapseTimer += safeDt;
        // Continue snapping adjacent cables during the 3.8s interval before full collapse
        this.cableSnapTimer += safeDt;
        if (this.cableSnapTimer >= 0.35) {
          this.cableSnapTimer = 0;
          this._shearNextSuspender(false);
        }
        if (this.stage2CollapseTimer >= 3.8) {
          this._triggerRestOfSpanCollapse();
        }
      }

      // 5. Update Falling Roadway Segments & Water Impact
      for (const seg of this.segments) {
        if (seg.detached) {
          if (!seg.inWater) {
            seg.fallVy += 260 * safeDt; // Gravity
            seg.fallY += seg.fallVy * safeDt;
            seg.fallRot += seg.fallVRot * safeDt;

            if (seg.fallY >= 95) {
              seg.inWater = true;
              this._spawnSplash(seg.index);
            }
          } else {
            // Sink slowly into Puget Sound
            seg.fallVy *= Math.max(0, 1 - 4 * safeDt);
            seg.fallY = Math.min(125, seg.fallY + seg.fallVy * safeDt);
          }
        } else {
          // Calculate cable stress on intact segments
          const xNorm = (seg.index + 0.5) / this.numSegments;
          const localTwist = this.theta * Math.sin(2 * Math.PI * xNorm);
          let stress = 0.25 + Math.abs(localTwist) * 1.6;
          if (!seg.frontCableIntact || !seg.backCableIntact) {
            stress += 0.65; // Neighboring cable carries double load!
          }
          seg.cableStress = stress;
        }
      }

      // 6. Update Sparks, Splashes, Streamlines & Vortices
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const sp = this.sparks[i];
        sp.life -= safeDt * 1.8;
        for (const p of sp.particles) {
          p.x += p.vx * safeDt;
          p.y += p.vy * safeDt;
          p.vy += 180 * safeDt;
        }
        if (sp.life <= 0) this.sparks.splice(i, 1);
      }

      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.life -= safeDt * 0.85;
        for (const d of s.droplets) {
          d.x += d.vx * safeDt;
          d.y += d.vy * safeDt;
          d.vy += 240 * safeDt;
        }
        if (s.life <= 0) this.splashes.splice(i, 1);
      }

      const windNorm = this.windSpeed / 19.0;
      for (const p of this.streamParticles) {
        p.x += p.speed * windNorm * safeDt * 0.95;
        if (p.x > 1.15) {
          p.x = -0.15;
          p.y = (Math.random() - 0.5) * 1.8;
        }
      }

      // Spawn vortices above and below deck in wind tunnel
      if (this.windSpeed > 5 && this.deckType === 'h-girder') {
        if (Math.random() < windNorm * 0.35) {
          const isTop = Math.sin(this.vertPhase * 2) > 0;
          this.vortices.push({
            x: 0.15,
            y: isTop ? -0.28 : 0.28,
            r: 5,
            dir: isTop ? 1 : -1,
            ang: 0,
            life: 1.0
          });
        }
      }
      for (let i = this.vortices.length - 1; i >= 0; i--) {
        const v = this.vortices[i];
        v.x += windNorm * safeDt * 0.75;
        v.r += safeDt * 18;
        v.ang += v.dir * safeDt * 6;
        v.life -= safeDt * 0.75;
        if (v.life <= 0) this.vortices.splice(i, 1);
      }

      // Record theta history
      this.historyTheta[this.historyIndex] = (this.theta * 180) / Math.PI;
      this.historyIndex = (this.historyIndex + 1) % this.historyLength;
    }

    _spawnSplash(segIndex) {
      this.splashes.push({
        segIndex,
        life: 1.0,
        droplets: Array.from({ length: 14 }, () => {
          const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.1;
          const spd = 45 + Math.random() * 110;
          return {
            x: (Math.random() - 0.5) * 16,
            y: 0,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: 1.8 + Math.random() * 2.8
          };
        })
      });
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (W < 10 || H < 10) return;

      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#060a14');
      bg.addColorStop(0.55, '#0b1326');
      bg.addColorStop(1, '#070c18');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Top Status Banner
      const bannerH = H < 320 ? 20 : 26;
      this._drawBanner(ctx, W, bannerH);

      // Layout Regions:
      // Top Region (56% of remaining height): Full 3D Isometric Bridge Span
      // Bottom Region (44% of remaining height): Left = Wind Tunnel Cross-Section, Right = Timeline & Telemetry
      const remH = H - bannerH;
      const topY = bannerH;
      const topH = remH * 0.57;
      const botY = topY + topH;
      const botH = remH * 0.43;

      this._draw3DFullBridge(ctx, 0, topY, W, topH);

      const isNarrow = W < 560;
      if (isNarrow) {
        this._drawWindTunnelInset(ctx, 4, botY + 2, W * 0.54 - 6, botH - 6);
        this._drawTimelineAndTelemetry(ctx, W * 0.54 + 2, botY + 2, W * 0.46 - 6, botH - 6);
      } else {
        this._drawWindTunnelInset(ctx, 8, botY + 4, W * 0.52 - 12, botH - 8);
        this._drawTimelineAndTelemetry(ctx, W * 0.52 + 4, botY + 4, W * 0.48 - 12, botH - 8);
      }
    }

    _drawBanner(ctx, W, h) {
      const deg = Math.abs((this.theta * 180) / Math.PI);
      const isNarrow = W < 560;
      let text, color, bg;

      if (this.phase === 5) {
        color = '#ff1744';
        bg = 'rgba(255, 23, 68, 0.28)';
        text = isNarrow
          ? '💥 11:09 AM — COLAPS TOTAL DESCHIDERE CENTRALĂ!'
          : '💥 11:09 AM — COLAPS TOTAL: După secțiunea de 600 ft, restul deschiderii principale s-a prăbușit în Tacoma Narrows!';
      } else if (this.phase === 4) {
        color = '#ff1744';
        bg = 'rgba(255, 23, 68, 0.25)';
        text = isNarrow
          ? '🌊 11:00 AM — SECȚIUNEA DE 600 FT (183m) S-A RUPT!'
          : '🌊 11:00 AM — CEDARE CATASTROFALĂ: O secțiune de 600 de picioare (183 m) s-a smuls și s-a prăbușit în apă!';
      } else if (this.phase === 3) {
        color = '#ff5252';
        bg = 'rgba(255, 82, 82, 0.22)';
        text = isNarrow
          ? `✂️ RĂSUCIRE ±${deg.toFixed(0)}° — CABLURILE SE RUP UNUL CÂTE UNUL!`
          : `✂️ RĂSUCIRE VIOLENTĂ (±${deg.toFixed(1)}° / max 45°) — Stresul forfecă cablurile verticale (suspenders) unul câte unul!`;
      } else if (this.phase === 2) {
        color = '#ffab40';
        bg = 'rgba(255, 171, 64, 0.16)';
        text = isNarrow
          ? `⚡ 10:00 AM: COLIER ALUNECAT -> FLUTTER ±${deg.toFixed(0)}°`
          : `⚡ 10:00 AM: Colierul central a alunecat! Vântul împinge în direcția răsucirii (Fluture Aeroelastic: ±${deg.toFixed(1)}°)`;
      } else {
        color = this.deckType === 'h-girder' ? '#00e5ff' : '#69f0ae';
        bg = this.deckType === 'h-girder' ? 'rgba(0, 229, 255, 0.10)' : 'rgba(105, 240, 174, 0.10)';
        text = this.deckType === 'h-girder'
          ? (isNarrow ? '🌊 09:45 AM: Vârtejuri pe grinzile pline (Mod Vertical)' : '🌊 09:45 AM: Vântul lovește grinzile pline -> separarea fluxului și vârtejuri (înainte de alunecarea colierului la 10:00)')
          : `🛡️ PROFIL STABIL (${this.deckType.toUpperCase()}): Fluxul nu pompează energie în torsiune — Podul rămâne stabil!`;
      }

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, h);
      ctx.strokeStyle = color + '66';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(W, h);
      ctx.stroke();

      ctx.font = `bold ${isNarrow ? 8.5 : 10.5}px Inter, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, h / 2);
    }

    // =========================================================================
    // TOP PANEL: FULL 3D PERSPECTIVE TACOMA NARROWS SUSPENSION BRIDGE
    // =========================================================================
    _draw3DFullBridge(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();

      const waterY = gy + gh * 0.78;

      // Puget Sound Water
      const waterGrad = ctx.createLinearGradient(0, waterY, 0, gy + gh);
      waterGrad.addColorStop(0, '#09192c');
      waterGrad.addColorStop(1, '#040b14');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(gx, waterY, gw, gy + gh - waterY);

      // Subtle water wave lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const wy = waterY + i * (( gh * 0.22 ) / 5);
        ctx.beginPath();
        ctx.moveTo(gx, wy);
        ctx.lineTo(gx + gw, wy);
        ctx.stroke();
      }

      // Bridge 3D Coordinates
      const tower1X = gx + gw * 0.16;
      const tower2X = gx + gw * 0.84;
      const spanW = tower2X - tower1X;
      const deckBaseY = gy + gh * 0.50;
      const towerTopY = gy + gh * 0.10;
      const towerBotY = waterY + 8;

      // 3D Isometric depth offset between Back (North) and Front (South) cables/girders
      const depthDX = Math.min(22, gw * 0.025);
      const depthDY = Math.min(18, gh * 0.08);

      // Draw Left & Right Side Approach Spans
      this._drawSideSpan(ctx, gx + 10, tower1X, deckBaseY, towerTopY, depthDX, depthDY);
      this._drawSideSpan(ctx, tower2X, gx + gw - 10, deckBaseY, towerTopY, depthDX, depthDY);

      // Draw Left Tower (Tower 1)
      this._draw3DTower(ctx, tower1X, towerTopY, towerBotY, depthDX, depthDY);

      // Helper for Main Parabolic Cable Y at normalized span coordinate u in [0, 1]
      const sagCenter = deckBaseY - towerTopY - 12;
      // When 600-ft section or main span collapses, main cable recoils upward!
      const cableRecoil = this.phase >= 5 ? -18 : (this.phase === 4 ? -10 : 0);
      const getMainCableY = (u, isFront) => {
        const parabola = 4 * u * (1 - u);
        const base = towerTopY + parabola * (sagCenter + cableRecoil);
        return isFront ? base + depthDY * 0.5 : base - depthDY * 0.5;
      };

      const getMainCableX = (u, isFront) => {
        const base = tower1X + u * spanW;
        return isFront ? base - depthDX * 0.5 : base + depthDX * 0.5;
      };

      // Draw Back (North) Main Suspension Cable
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const cx = getMainCableX(u, false);
        const cy = getMainCableY(u, false);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // Calculate 3D positions of all 22 roadway segments
      const segW = spanW / this.numSegments;
      const maxTwistVis = Math.min(26, gh * 0.13); // Visual vertical displacement of roadway edges at 45 deg

      for (let i = 0; i < this.numSegments; i++) {
        const seg = this.segments[i];
        const u1 = i / this.numSegments;
        const u2 = (i + 1) / this.numSegments;
        const uMid = (u1 + u2) * 0.5;

        // Longitudinal mode shape:
        // Before 10:00 AM: 3-half-wave vertical oscillation
        // After 10:00 AM: 2-lobe anti-symmetric torsional wave sin(2*pi*u) (left half twists +, right half twists -)
        const vertWave1 = Math.sin(3 * Math.PI * u1) * Math.sin(this.vertPhase) * (this.deckType === 'h-girder' ? 7 : 1.5);
        const vertWave2 = Math.sin(3 * Math.PI * u2) * Math.sin(this.vertPhase) * (this.deckType === 'h-girder' ? 7 : 1.5);

        const localTheta1 = this.theta * Math.sin(2 * Math.PI * u1);
        const localTheta2 = this.theta * Math.sin(2 * Math.PI * u2);
        const localThetaMid = this.theta * Math.sin(2 * Math.PI * uMid);

        const x1 = tower1X + u1 * spanW;
        const x2 = tower1X + u2 * spanW;
        const xMid = (x1 + x2) * 0.5;

        const yOff = seg.detached ? seg.fallY : seg.sagY;
        const y1 = deckBaseY + vertWave1 + yOff;
        const y2 = deckBaseY + vertWave2 + yOff;

        const sinT1 = Math.sin(localTheta1 + (seg.detached ? seg.fallRot : 0));
        const sinT2 = Math.sin(localTheta2 + (seg.detached ? seg.fallRot : 0));
        const sinTMid = Math.sin(localThetaMid + (seg.detached ? seg.fallRot : 0));

        // Front edge (South) and Back edge (North) 3D coordinates of this segment
        const fX1 = x1 - depthDX * 0.5;
        const fY1 = y1 + depthDY * 0.5 + sinT1 * maxTwistVis;
        const fX2 = x2 - depthDX * 0.5;
        const fY2 = y2 + depthDY * 0.5 + sinT2 * maxTwistVis;

        const bX1 = x1 + depthDX * 0.5;
        const bY1 = y1 - depthDY * 0.5 - sinT1 * maxTwistVis;
        const bX2 = x2 + depthDX * 0.5;
        const bY2 = y2 - depthDY * 0.5 - sinT2 * maxTwistVis;

        // 1. Draw Back Vertical Suspender Cable (if intact or snapped whip)
        const cabBX = getMainCableX(uMid, false);
        const cabBY = getMainCableY(uMid, false);
        const deckBX = (bX1 + bX2) * 0.5;
        const deckBY = (bY1 + bY2) * 0.5;

        this._draw3DSuspender(ctx, cabBX, cabBY, deckBX, deckBY, seg.backCableIntact, seg.cableStress, false);

        // 2. Draw Roadway Surface Ribbon (Asphalt & Steel Frame)
        if (!seg.inWater || seg.fallY < 118) {
          ctx.beginPath();
          ctx.moveTo(bX1, bY1);
          ctx.lineTo(bX2, bY2);
          ctx.lineTo(fX2, fY2);
          ctx.lineTo(fX1, fY1);
          ctx.closePath();

          // Highlight the 600-foot section (segments 3..9) subtly so user can track it
          if (seg.detached) {
            ctx.fillStyle = 'rgba(255, 23, 68, 0.55)';
          } else if (seg.is600ft && this.phase >= 2) {
            ctx.fillStyle = Math.abs(sinTMid) > 0.45 ? '#3e2738' : '#283347';
          } else {
            ctx.fillStyle = '#20293a';
          }
          ctx.fill();
          ctx.strokeStyle = seg.is600ft && this.phase >= 2 ? 'rgba(255, 171, 64, 0.5)' : 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Yellow Center Road Line
          ctx.strokeStyle = '#ffca28';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo((bX1 + fX1) * 0.5, (bY1 + fY1) * 0.5);
          ctx.lineTo((bX2 + fX2) * 0.5, (bY2 + fY2) * 0.5);
          ctx.stroke();

          // Front Girder Sidewall (Solid H-plate vs Open Truss vs Aerofoil)
          const girderH = this.deckType === 'truss' ? 8 : 5.5;
          ctx.beginPath();
          ctx.moveTo(fX1, fY1 - girderH * 0.5);
          ctx.lineTo(fX2, fY2 - girderH * 0.5);
          ctx.lineTo(fX2, fY2 + girderH * 0.5);
          ctx.lineTo(fX1, fY1 + girderH * 0.5);
          ctx.closePath();

          if (this.deckType === 'h-girder') {
            ctx.fillStyle = seg.is600ft && this.phase >= 3 ? '#5c3842' : '#455a64';
            ctx.fill();
            ctx.strokeStyle = '#90a4ae';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          } else if (this.deckType === 'truss') {
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.1;
            ctx.stroke();
            // Truss cross-diagonal
            ctx.beginPath();
            ctx.moveTo(fX1, fY1 - girderH * 0.5);
            ctx.lineTo(fX2, fY2 + girderH * 0.5);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#263238';
            ctx.fill();
            ctx.strokeStyle = '#69f0ae';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Draw Tubby's Red Car on segment 7 (inside the 600-foot section!)
          if (i === 7) {
            const carX = (fX1 + fX2 + bX1 + bX2) * 0.25;
            const carY = (fY1 + fY2 + bY1 + bY2) * 0.25 - 4;
            ctx.fillStyle = '#ff1744';
            ctx.beginPath();
            ctx.arc(carX, carY, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 3. Draw Front Vertical Suspender Cable
        const cabFX = getMainCableX(uMid, true);
        const cabFY = getMainCableY(uMid, true);
        const deckFX = (fX1 + fX2) * 0.5;
        const deckFY = (fY1 + fY2) * 0.5;

        this._draw3DSuspender(ctx, cabFX, cabFY, deckFX, deckFY, seg.frontCableIntact, seg.cableStress, true);
      }

      // Draw Front (South) Main Suspension Cable
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const cx = getMainCableX(u, true);
        const cy = getMainCableY(u, true);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // Draw Right Tower (Tower 2)
      this._draw3DTower(ctx, tower2X, towerTopY, towerBotY, depthDX, depthDY);

      // Draw Mid-Span Center Cable Band Node Marker (10:00 AM event)
      const midX = getMainCableX(0.5, true);
      const midY = getMainCableY(0.5, true);
      ctx.save();
      ctx.fillStyle = this.cableBandSlipped ? '#ff1744' : '#69f0ae';
      ctx.beginPath();
      ctx.arc(midX, midY, this.bandSlipSparkTimer > 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (this.cableBandSlipped && this.phase <= 3) {
        ctx.fillStyle = '#ffab40';
        ctx.font = 'bold 8.5px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ Colier Central Alunecat (10:00 AM)', midX, midY - 10);
      }
      ctx.restore();

      // Label for the 600-ft Section (Segments 3..9)
      if (this.phase >= 2 && this.phase <= 4) {
        const secX = tower1X + (6.5 / this.numSegments) * spanW;
        const secY = this.phase === 4 ? waterY - 18 : deckBaseY + 34;
        ctx.fillStyle = this.phase === 4 ? '#ff1744' : '#ffab40';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          this.phase === 4 ? '▼ SECȚIUNEA DE 600 FT (183m) PRĂBUȘITĂ LA 11:00 AM!' : '◄── Secțiunea Critică de 600 ft (183 m) ──►',
          secX,
          secY
        );
      }

      // Draw Cable Shearing Sparks
      for (const sp of this.sparks) {
        const u = (sp.segIndex + 0.5) / this.numSegments;
        const sx = getMainCableX(u, sp.isFront);
        const sy = deckBaseY - 12;
        ctx.fillStyle = `rgba(255, 193, 7, ${sp.life})`;
        for (const p of sp.particles) {
          ctx.beginPath();
          ctx.arc(sx + p.x * 0.25, sy + p.y * 0.25, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Water Splashes in Puget Sound
      for (const s of this.splashes) {
        const u = (s.segIndex + 0.5) / this.numSegments;
        const wx = tower1X + u * spanW;
        ctx.fillStyle = `rgba(224, 247, 250, ${s.life * 0.85})`;
        for (const d of s.droplets) {
          ctx.beginPath();
          ctx.arc(wx + d.x * 0.4, waterY + d.y * 0.35, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    _draw3DSuspender(ctx, x1, y1, x2, y2, intact, stress, isFront) {
      ctx.save();
      if (!intact) {
        // Snapped suspender cable dangling loosely from the main cable
        ctx.strokeStyle = isFront ? 'rgba(255, 82, 82, 0.65)' : 'rgba(255, 82, 82, 0.35)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const midY = y1 + (y2 - y1) * 0.45;
        ctx.quadraticCurveTo(x1 + 5, (y1 + midY) * 0.5, x1 + 3, midY);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (stress > 1.35) {
        ctx.strokeStyle = isFront ? '#ff1744' : 'rgba(255, 23, 68, 0.65)';
        ctx.lineWidth = isFront ? 1.8 : 1.2;
      } else if (stress > 0.95) {
        ctx.strokeStyle = isFront ? '#ffab40' : 'rgba(255, 171, 64, 0.55)';
        ctx.lineWidth = isFront ? 1.4 : 1.0;
      } else {
        ctx.strokeStyle = isFront ? 'rgba(0, 229, 255, 0.65)' : 'rgba(0, 229, 255, 0.30)';
        ctx.lineWidth = isFront ? 1.1 : 0.8;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    _draw3DTower(ctx, tx, topY, botY, depthDX, depthDY) {
      ctx.save();
      const fX = tx - depthDX * 0.5;
      const fTopY = topY + depthDY * 0.5;
      const bX = tx + depthDX * 0.5;
      const bTopY = topY - depthDY * 0.5;

      // Back leg
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bX, bTopY);
      ctx.lineTo(bX, botY - depthDY * 0.5);
      ctx.stroke();

      // Cross struts connecting back and front legs
      ctx.strokeStyle = '#546e7a';
      ctx.lineWidth = 2;
      for (let frac of [0.05, 0.28, 0.52, 0.76]) {
        const yF = fTopY + frac * (botY - fTopY);
        const yB = bTopY + frac * (botY - bTopY);
        ctx.beginPath();
        ctx.moveTo(bX, yB);
        ctx.lineTo(fX, yF);
        ctx.stroke();
      }

      // Front leg
      ctx.strokeStyle = '#607d8b';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(fX, fTopY);
      ctx.lineTo(fX, botY);
      ctx.stroke();

      // Concrete pier base in water
      ctx.fillStyle = '#455a64';
      ctx.fillRect(fX - 6, botY - 12, depthDX + 12, 14);
      ctx.restore();
    }

    _drawSideSpan(ctx, xStart, xEnd, deckY, towerTopY, depthDX, depthDY) {
      ctx.save();
      const fTowerX = xStart < xEnd && xStart < 100 ? xEnd - depthDX * 0.5 : xStart - depthDX * 0.5;
      const anchorX = xStart < 100 ? xStart : xEnd;

      // Main cable to anchorage
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fTowerX, towerTopY + depthDY * 0.5);
      ctx.lineTo(anchorX, deckY + depthDY * 0.5);
      ctx.stroke();

      // Side span roadway
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(xStart, deckY + depthDY * 0.5);
      ctx.lineTo(xEnd, deckY + depthDY * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // =========================================================================
    // BOTTOM-LEFT PANEL: AERODYNAMIC WIND TUNNEL CROSS-SECTION ZOOM
    // =========================================================================
    _drawWindTunnelInset(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.fillStyle = 'rgba(13, 20, 38, 0.88)';
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();
      ctx.clip();

      const isCompact = gw < 280;
      ctx.fillStyle = '#00e5ff';
      ctx.font = `bold ${isCompact ? 9 : 10}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(
        isCompact ? '🔬 Secțiune: Fluture Aeroelastic' : '🔬 Tunel Aerodinamic în Secțiune — Mecanismul de Auto-Excitație',
        gx + 10,
        gy + 15
      );

      const cx = gx + gw * 0.50;
      const cy = gy + gh * 0.54;
      const halfB = Math.min(gw * 0.28, 72);
      const girderH = Math.max(14, halfB * 0.28);

      // 1. Draw Airflow Streamlines separating around the solid plate girders
      ctx.save();
      for (const p of this.streamParticles) {
        const px = gx + p.x * gw;
        // Deflect streamlines around tilted deck
        const dx = (px - cx) / (halfB + 10);
        let deflect = 0;
        if (Math.abs(dx) < 1.3) {
          deflect = Math.sin(this.theta) * 18 * (1.3 - Math.abs(dx));
        }
        const py = cy + p.y * (gh * 0.34) + deflect;
        const len = 10 + (this.windSpeed / 25.0) * 16;

        ctx.strokeStyle = 'rgba(105, 240, 174, 0.28)';
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + len, py);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Draw Alternating Vortices Above and Below the Deck
      for (const v of this.vortices) {
        const vx = cx + v.x * gw * 0.65;
        const vy = cy + v.y * gh * 0.7;
        ctx.strokeStyle = `rgba(255, 171, 64, ${v.life * 0.65})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(vx, vy, v.r, v.ang, v.ang + Math.PI * 1.35);
        ctx.stroke();
      }

      // 3. Reference +/- 45 deg angle dial
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - halfB * 1.2, cy);
      ctx.lineTo(cx + halfB * 1.2, cy);
      ctx.stroke();
      ctx.restore();

      // 4. Draw Tilted Deck Cross-Section
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.theta);

      if (this.deckType === 'h-girder') {
        // Solid Steel Plate Girders (H-Section)
        ctx.fillStyle = '#263238';
        ctx.fillRect(-halfB, -4, halfB * 2, 8);
        ctx.fillStyle = '#455a64';
        ctx.strokeStyle = '#90a4ae';
        ctx.lineWidth = 1.5;
        // Left solid plate girder
        ctx.fillRect(-halfB - 5, -girderH / 2, 8, girderH);
        ctx.strokeRect(-halfB - 5, -girderH / 2, 8, girderH);
        // Right solid plate girder
        ctx.fillRect(halfB - 3, -girderH / 2, 8, girderH);
        ctx.strokeRect(halfB - 3, -girderH / 2, 8, girderH);
      } else if (this.deckType === 'truss') {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-halfB, -girderH * 0.6, halfB * 2, girderH * 1.2);
        for (let i = -3; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * (halfB / 3), -girderH * 0.6);
          ctx.lineTo((i + 1) * (halfB / 3), girderH * 0.6);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#1c2638';
        ctx.strokeStyle = '#69f0ae';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-halfB, 0);
        ctx.lineTo(-halfB * 0.75, -girderH * 0.35);
        ctx.lineTo(halfB * 0.75, -girderH * 0.35);
        ctx.lineTo(halfB, 0);
        ctx.lineTo(halfB * 0.75, girderH * 0.35);
        ctx.lineTo(-halfB * 0.75, girderH * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // 5. Draw Aerodynamic Lift Force Arrows pushing in the EXACT direction of twisting velocity!
      const cosT = Math.cos(this.theta);
      const sinT = Math.sin(this.theta);
      const rightEdgeX = cx + halfB * cosT;
      const rightEdgeY = cy + halfB * sinT;
      const leftEdgeX = cx - halfB * cosT;
      const leftEdgeY = cy - halfB * sinT;

      if (Math.abs(this.omegaTheta) > 0.04 && this.deckType === 'h-girder') {
        const dir = Math.sign(this.omegaTheta);
        const arrowLen = Math.min(34, 12 + Math.abs(this.omegaTheta) * 18);
        // Right edge moves vertically with sign(omegaTheta), wind lift pushes in the SAME direction!
        this.drawArrow(rightEdgeX, rightEdgeY, rightEdgeX, rightEdgeY + dir * arrowLen, '#ff5252', 2.2);
        this.drawArrow(leftEdgeX, leftEdgeY, leftEdgeX, leftEdgeY - dir * arrowLen, '#ff5252', 2.2);
      }

      // Live Angle & Energy Injection readout at bottom of wind tunnel
      const deg = (this.theta * 180) / Math.PI;
      ctx.fillStyle = Math.abs(deg) > 25 ? '#ff5252' : '#ffab40';
      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Unghi: θ = ${deg >= 0 ? '+' : ''}${deg.toFixed(1)}° (Max ±45°)`, gx + 10, gy + gh - 8);

      ctx.fillStyle = this.deckType === 'h-girder' ? '#ff5252' : '#69f0ae';
      ctx.font = '8.5px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        this.deckType === 'h-girder'
          ? '⚡ Forța aero împinge în direcția răsucirii!'
          : '🛡️ Vântul trece liber (fără auto-excitație)',
        gx + gw - 10,
        gy + gh - 8
      );

      ctx.restore();
    }

    // =========================================================================
    // BOTTOM-RIGHT PANEL: HISTORICAL TIMELINE (7 NOV 1940) & TELEMETRY
    // =========================================================================
    _drawTimelineAndTelemetry(ctx, gx, gy, gw, gh) {
      ctx.save();
      ctx.fillStyle = 'rgba(13, 20, 38, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();
      ctx.clip();

      const isCompact = gw < 280;
      ctx.fillStyle = '#ffab40';
      ctx.font = `bold ${isCompact ? 9 : 10}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(
        `⌚ Cronologia Colapsului (${this._getClockString()})`,
        gx + 10,
        gy + 15
      );

      const intact = this._countIntactCables();
      const total = this.numSegments * 2;

      const steps = [
        {
          active: this.phase >= 1,
          done: this.phase > 1,
          text: isCompact ? '1. Grinzi pline: separare flux & vârtejuri' : '09:45 — Grinzile pline separă fluxul în vârtejuri'
        },
        {
          active: this.phase >= 2,
          done: this.phase > 2,
          text: isCompact ? '2. 10:00: Colierul alunecă -> Mod torsional' : '10:00 — Colierul alunecă -> declanșează torsiunea'
        },
        {
          active: this.phase >= 2 && Math.abs(this.theta * 180 / Math.PI) > 15,
          done: this.phase > 3,
          text: isCompact ? '3. Fluture aeroelastic: vântul pompează energie' : '10:30 — Fluture aeroelastic: răsucire până la ±45°'
        },
        {
          active: this.phase >= 3,
          done: this.phase >= 4,
          text: isCompact ? `4. Forfecare cabluri (${intact}/${total} intacte)` : `10:55 — Cablurile verticale cedează unul câte unul (${intact}/${total})`
        },
        {
          active: this.phase >= 4,
          done: this.phase >= 5,
          text: isCompact ? '5. 11:00: Secțiunea de 600 ft cade în apă!' : '11:00 — Secțiunea de 600 ft (183m) se rupe, apoi tot podul!'
        }
      ];

      const startY = gy + 28;
      const availH = gh - 34;
      const rowH = Math.min(22, availH / steps.length);

      for (let i = 0; i < steps.length; i++) {
        const st = steps[i];
        const y = startY + i * rowH;

        ctx.fillStyle = st.done ? '#69f0ae' : (st.active ? '#ff5252' : '#5c5e78');
        ctx.beginPath();
        ctx.arc(gx + 14, y + 4, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${st.active ? 'bold ' : ''}${isCompact ? 8 : 8.8}px Inter, sans-serif`;
        ctx.fillStyle = st.active ? '#e8eaf6' : '#6c7086';
        ctx.textAlign = 'left';
        ctx.fillText(st.text, gx + 24, y + 7);
      }

      ctx.restore();
    }
  }

  window.TacomaNarrowsSim = TacomaNarrowsSim;
})();
