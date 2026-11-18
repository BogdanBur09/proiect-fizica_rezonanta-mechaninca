/* ============================================================
   SLIDE13-ENERGY-HARVESTING.JS — Piezoelectric Energy Harvesting
   Coupled Electromechanical Bimorph PZT Cantilever, Nonlinear
   Bistable Duffing Potential, Schottky Bridge Rectifier, Storage
   Capacitor (3.30 V) & IoT RF Wireless Packet Transceiver
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  const TIME_SCALE = 1 / 12; // Slow-motion anti-aliasing (60 Hz -> 5 Hz visual)
  const MAX_SUBSTEP_PHYS = 0.0001; // h <= 0.10 ms for RK4 stability at R_load >= 5 kOhm
  const G_ACCEL = 9.81;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function lerpColor(r1, g1, b1, r2, g2, b2, t) {
    const u = clamp(t, 0, 1);
    const r = Math.round(r1 + (r2 - r1) * u);
    const g = Math.round(g1 + (g2 - g1) * u);
    const b = Math.round(b1 + (b2 - b1) * u);
    return `rgb(${r}, ${g}, ${b})`;
  }

  class EnergyHarvestingSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config || {});

      // --- Calibrated Physical Parameters (SI) ---
      this.m = 0.005;                          // Effective modal + tungsten tip mass (5 g)
      this.f0 = this.config.f0 || 60.0;        // Linear natural frequency (60 Hz)
      this.omega0 = 2 * Math.PI * this.f0;
      this.k = this.m * this.omega0 * this.omega0; // ~710.61 N/m
      this.zetaM = 0.020;                      // Structural damping ratio (2.0%)
      this.c = 2 * this.zetaM * Math.sqrt(this.k * this.m); // ~0.0754 N*s/m
      this.theta = 7.0e-4;                     // Electromechanical coupling (N/V)
      this.Cp = 53.05e-9;                      // PZT internal capacitance (53.05 nF -> R_opt = 50 kOhm)

      // --- Bistable Duffing Magnet Parameters ---
      this.alpha = 285.0;                      // Negative linear stiffness term (N/m)
      this.zEq = 1.20e-3;                      // Equilibrium well position (+/- 1.20 mm)
      this.beta = this.alpha / (this.zEq * this.zEq); // ~1.979e8 N/m^3

      // --- Rectifier, Storage & IoT RF Load Parameters ---
      this.vd = 0.30;                          // Schottky forward diode drop (V)
      this.rs = 2000.0;                        // Bridge series resistance (2 kOhm)
      this.rLeak = 20e6;                       // Capacitor leakage resistance (20 MOhm)
      this.cStore = 11.2e-6;                   // Storage capacitor (11.2 uF -> 36.3 uJ burst)
      this.vTxThresh = 3.30;                   // IoT transceiver wake threshold (V)
      this.vUvlo = 2.10;                       // Under-voltage lockout reset (V)

      // --- Mechanical Stops & Visual Ranges ---
      this.zStopM = 6.5e-3;                    // +/- 6.5 mm physical bumper limit
      this.zVisualMaxM = 4.5e-3;               // +/- 4.5 mm full visual beam scale

      // --- User-Adjustable Parameters ---
      this.baseFreq = 60.0;                    // Hz (20..120)
      this.accG = 1.0;                         // g (0.2..2.5)
      this.loadKOhm = 50.0;                    // kOhm (5..200)
      this.bistableMode = false;
      this.sweeping = false;
      this.sweepDir = 1;

      // --- Dynamic Simulation State ---
      this.z = 0.0;                            // Tip relative displacement (m)
      this.vz = 0.0;                           // Tip velocity (m/s)
      this.vPzt = 0.0;                         // Piezoelectric output voltage (V)
      this.vCap = 0.0;                         // Storage capacitor voltage (V)
      this.phi = 0.0;                          // Continuous excitation phase (rad)
      this.magBlend = 0.0;                     // Smooth transition [0..1] for magnets

      // --- Telemetry & Burst Animation ---
      this.instPowerMw = 0.0;
      this.avgPowerMw = 0.0;
      this.packetCount = 0;
      this.txBurstTimer = 0.0;
      this.rectFlowPhase = 0.0;
      this.isConductingPos = false;
      this.isConductingNeg = false;

      // --- History Ring Buffers ---
      this.scopeHistory = [];                  // { vPzt, pMw, vCap }
      this.scopeMax = 200;
      this.wellTrail = [];                     // { zMm, uMj }
      this.wellTrailMax = 14;
      this._scopeAccum = 0;
      this._trailAccum = 0;

      // --- Canvas Hitboxes & Pointer State (CSS Pixels) ---
      this._tipHit = null;
      this._magnetHit = null;
      this._anchorY = 0;
      this._maxDeflectPx = 40;
      this.isDraggingTip = false;

      this._bindInteractions();
    }

    onInit() {
      this._bindControls();
      this._syncControlsFromState();
      this._highlightPreset('sim13-preset-res');
      this._syncPlayButton();
      this._updateUIBadges();
    }

    onReset() {
      this.baseFreq = 60.0;
      this.accG = 1.0;
      this.loadKOhm = 50.0;
      this.bistableMode = false;
      this.sweeping = false;
      this.sweepDir = 1;

      this.z = 0.0;
      this.vz = 0.0;
      this.vPzt = 0.0;
      this.vCap = 0.0;
      this.phi = 0.0;
      this.magBlend = 0.0;

      this.instPowerMw = 0.0;
      this.avgPowerMw = 0.0;
      this.packetCount = 0;
      this.txBurstTimer = 0.0;
      this.rectFlowPhase = 0.0;
      this.isConductingPos = false;
      this.isConductingNeg = false;
      this.isDraggingTip = false;

      this.scopeHistory = [];
      this.wellTrail = [];
      this._scopeAccum = 0;
      this._trailAccum = 0;

      this._syncControlsFromState();
      this._highlightPreset('sim13-preset-res');
      const sweepBtn = document.getElementById('sim13-preset-sweep');
      if (sweepBtn) sweepBtn.classList.remove('sim-btn--preset');
      this._syncPlayButton();
      this._updateUIBadges();
    }

    requestRender() {
      if (!this.running) {
        this.render();
      }
    }

    // ------------------------------------------------------------------
    // DOM Control Bindings (strictly independent null guards)
    // ------------------------------------------------------------------

    _bindControls() {
      const freqSlider = document.getElementById('sim13-freq');
      const freqVal = document.getElementById('sim13-freq-val');
      if (freqSlider) {
        freqSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (Number.isFinite(val)) {
            this.baseFreq = clamp(val, 20, 120);
          }
          this.sweeping = false;
          const sweepBtn = document.getElementById('sim13-preset-sweep');
          if (sweepBtn) sweepBtn.classList.remove('sim-btn--preset');
          this._clearLinearPresets();
          const fOut = document.getElementById('sim13-freq-val');
          if (fOut) fOut.textContent = `${this.baseFreq.toFixed(0)} Hz`;
          this._updateUIBadges();
          this.requestRender();
        });
      } else if (freqVal) {
        freqVal.textContent = `${this.baseFreq.toFixed(0)} Hz`;
      }

      const accSlider = document.getElementById('sim13-acc');
      const accVal = document.getElementById('sim13-acc-val');
      if (accSlider) {
        accSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (Number.isFinite(val)) {
            this.accG = clamp(val, 0.2, 2.5);
          }
          const aOut = document.getElementById('sim13-acc-val');
          if (aOut) aOut.textContent = `${this.accG.toFixed(1)} g`;
          this._updateUIBadges();
          this.requestRender();
        });
      } else if (accVal) {
        accVal.textContent = `${this.accG.toFixed(1)} g`;
      }

      const loadSlider = document.getElementById('sim13-load');
      const loadVal = document.getElementById('sim13-load-val');
      if (loadSlider) {
        loadSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (Number.isFinite(val)) {
            this.loadKOhm = clamp(val, 5, 200);
          }
          const lOut = document.getElementById('sim13-load-val');
          if (lOut) lOut.textContent = `${this.loadKOhm.toFixed(0)} kΩ`;
          this._updateUIBadges();
          this.requestRender();
        });
      } else if (loadVal) {
        loadVal.textContent = `${this.loadKOhm.toFixed(0)} kΩ`;
      }

      // Preset: Resonance (60 Hz, 1.0 g, 50 kOhm, linear)
      const btnRes = document.getElementById('sim13-preset-res');
      if (btnRes) {
        btnRes.addEventListener('click', () => {
          this.baseFreq = 60.0;
          this.accG = 1.0;
          this.loadKOhm = 50.0;
          this.bistableMode = false;
          this.sweeping = false;
          this.avgPowerMw = 0.0;
          this._syncControlsFromState();
          this._highlightPreset('sim13-preset-res');
          const sweepBtn = document.getElementById('sim13-preset-sweep');
          if (sweepBtn) sweepBtn.classList.remove('sim-btn--preset');
          if (!this.running) this.start();
          this._syncPlayButton();
          this._updateUIBadges();
          this.requestRender();
        });
      }

      // Preset: Off-resonance (42 Hz, 1.0 g, 50 kOhm, linear)
      const btnOffRes = document.getElementById('sim13-preset-offres');
      if (btnOffRes) {
        btnOffRes.addEventListener('click', () => {
          this.baseFreq = 42.0;
          this.accG = 1.0;
          this.loadKOhm = 50.0;
          this.bistableMode = false;
          this.sweeping = false;
          this._syncControlsFromState();
          this._highlightPreset('sim13-preset-offres');
          const sweepBtn = document.getElementById('sim13-preset-sweep');
          if (sweepBtn) sweepBtn.classList.remove('sim-btn--preset');
          if (!this.running) this.start();
          this._syncPlayButton();
          this._updateUIBadges();
          this.requestRender();
        });
      }

      // Preset: Duffing bistable (44 Hz, 1.4 g, 50 kOhm, bistableMode = true, z = +1.2 mm)
      const btnDuffing = document.getElementById('sim13-preset-duffing');
      if (btnDuffing) {
        btnDuffing.addEventListener('click', () => {
          this.baseFreq = 44.0;
          this.accG = 1.4;
          this.loadKOhm = 50.0;
          this.bistableMode = true;
          this.sweeping = false;
          this.z = 1.20e-3;
          this.vz = 0.0;
          this.wellTrail = [];
          this._syncControlsFromState();
          this._highlightPreset('sim13-preset-duffing');
          const sweepBtn = document.getElementById('sim13-preset-sweep');
          if (sweepBtn) sweepBtn.classList.remove('sim-btn--preset');
          if (!this.running) this.start();
          this._syncPlayButton();
          this._updateUIBadges();
          this.requestRender();
        });
      }

      // Preset: Sweep toggle (30 -> 90 Hz)
      const btnSweep = document.getElementById('sim13-preset-sweep');
      if (btnSweep) {
        btnSweep.addEventListener('click', () => {
          this.sweeping = !this.sweeping;
          if (this.sweeping) {
            if (this.baseFreq < 30 || this.baseFreq >= 90) {
              this.baseFreq = 30.0;
            }
            this.sweepDir = 1;
            this._clearLinearPresets();
            this._syncControlsFromState();
            if (!this.running) this.start();
          }
          btnSweep.classList.toggle('sim-btn--preset', this.sweeping);
          this._syncPlayButton();
          this._updateUIBadges();
          this.requestRender();
        });
      }

      // Play / Pause
      const playBtn = document.getElementById('sim13-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          this._syncPlayButton();
        });
      }

      // Reset
      const resetBtn = document.getElementById('sim13-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          this.start();
          this._syncPlayButton();
        });
      }
    }

    _syncControlsFromState() {
      const freqSlider = document.getElementById('sim13-freq');
      const freqVal = document.getElementById('sim13-freq-val');
      if (freqSlider) freqSlider.value = String(Math.round(this.baseFreq));
      if (freqVal) freqVal.textContent = `${this.baseFreq.toFixed(0)} Hz`;

      const accSlider = document.getElementById('sim13-acc');
      const accVal = document.getElementById('sim13-acc-val');
      if (accSlider) accSlider.value = this.accG.toFixed(1);
      if (accVal) accVal.textContent = `${this.accG.toFixed(1)} g`;

      const loadSlider = document.getElementById('sim13-load');
      const loadVal = document.getElementById('sim13-load-val');
      if (loadSlider) loadSlider.value = String(Math.round(this.loadKOhm));
      if (loadVal) loadVal.textContent = `${this.loadKOhm.toFixed(0)} kΩ`;
    }

    _clearLinearPresets() {
      const ids = ['sim13-preset-res', 'sim13-preset-offres'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('sim-btn--preset');
      }
    }

    _highlightPreset(activeId) {
      const ids = ['sim13-preset-res', 'sim13-preset-offres', 'sim13-preset-duffing'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('sim-btn--preset');
      }
      if (activeId) {
        const activeEl = document.getElementById(activeId);
        if (activeEl) activeEl.classList.add('sim-btn--preset');
      }
    }

    _syncDuffingPresetClass() {
      const btnDuffing = document.getElementById('sim13-preset-duffing');
      if (btnDuffing) {
        btnDuffing.classList.toggle('sim-btn--preset', Boolean(this.bistableMode));
      }
      if (this.bistableMode) {
        this._clearLinearPresets();
      }
    }

    _syncPlayButton() {
      const playBtn = document.getElementById('sim13-play');
      if (playBtn) {
        playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Rulează';
      }
    }

    _updateUIBadges() {
      const bPower = document.getElementById('sim13-badge-power');
      if (bPower) {
        bPower.textContent = `Putere Medie: ${this.avgPowerMw.toFixed(2)} mW`;
        if (this.avgPowerMw >= 1.0) {
          bPower.className = 'sim-badge sim-badge--green';
        } else if (this.avgPowerMw >= 0.2) {
          bPower.className = 'sim-badge sim-badge--amber';
        } else {
          bPower.className = 'sim-badge sim-badge--cyan';
        }
      }

      const bVcap = document.getElementById('sim13-badge-vcap');
      if (bVcap) {
        bVcap.textContent = `V_cap: ${this.vCap.toFixed(2)} / 3.30 V`;
        bVcap.className = (this.vCap >= 3.10 || this.txBurstTimer > 0)
          ? 'sim-badge sim-badge--green'
          : 'sim-badge sim-badge--amber';
      }

      const bPackets = document.getElementById('sim13-badge-packets');
      if (bPackets) {
        bPackets.textContent = `Pachete IoT TX: ${this.packetCount}`;
        bPackets.className = this.txBurstTimer > 0
          ? 'sim-badge sim-badge--green'
          : 'sim-badge sim-badge--cyan';
      }

      const bMode = document.getElementById('sim13-badge-mode');
      if (bMode) {
        bMode.textContent = this.bistableMode ? 'Regim: Bistabil Duffing' : 'Regim: Monostabil';
        bMode.className = this.bistableMode
          ? 'sim-badge sim-badge--amber'
          : 'sim-badge sim-badge--cyan';
      }
    }

    // ------------------------------------------------------------------
    // Canvas Pointer & Touch Interactions (CSS-Pixel Space)
    // ------------------------------------------------------------------

    _getPointerPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      const clientX = touch ? touch.clientX : e.clientX;
      const clientY = touch ? touch.clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    _hitTip(pt) {
      if (!this._tipHit) return false;
      return Math.hypot(pt.x - this._tipHit.x, pt.y - this._tipHit.y) <= this._tipHit.r + 6;
    }

    _hitMagnet(pt) {
      if (!this._magnetHit) return false;
      const m = this._magnetHit;
      return pt.x >= m.x && pt.x <= m.x + m.w && pt.y >= m.y && pt.y <= m.y + m.h;
    }

    _applyTipDragY(py) {
      const deflectScale = Math.max(10, this._maxDeflectPx || 40);
      const relPx = py - this._anchorY;
      const zNew = (relPx / deflectScale) * this.zVisualMaxM;
      this.z = clamp(zNew, -this.zStopM, this.zStopM);
      this.vz = 0.0;
    }

    _bindInteractions() {
      if (!this.canvas) return;

      this._onPointerDown = (e) => {
        const pt = this._getPointerPos(e);
        if (this._hitTip(pt)) {
          if (e.cancelable) e.preventDefault();
          this.isDraggingTip = true;
          this._applyTipDragY(pt.y);
          this.canvas.style.cursor = 'grabbing';
          this.requestRender();
          return;
        }
        if (this._hitMagnet(pt)) {
          if (e.cancelable) e.preventDefault();
          this.bistableMode = !this.bistableMode;
          this.wellTrail = [];
          this._syncDuffingPresetClass();
          this._updateUIBadges();
          this.requestRender();
        }
      };

      this._onPointerMove = (e) => {
        const pt = this._getPointerPos(e);
        if (this.isDraggingTip) {
          if (e.cancelable) e.preventDefault();
          this._applyTipDragY(pt.y);
          this.canvas.style.cursor = 'grabbing';
          this.requestRender();
          return;
        }
        if (e.target === this.canvas) {
          if (this._hitTip(pt)) {
            this.canvas.style.cursor = 'grab';
          } else if (this._hitMagnet(pt)) {
            this.canvas.style.cursor = 'pointer';
          } else {
            this.canvas.style.cursor = 'default';
          }
        }
      };

      this._onPointerUp = (e) => {
        if (!this.isDraggingTip) return;
        this.isDraggingTip = false;
        const pt = this._getPointerPos(e);
        if (this._hitTip(pt)) {
          this.canvas.style.cursor = 'grab';
        } else if (this._hitMagnet(pt)) {
          this.canvas.style.cursor = 'pointer';
        } else {
          this.canvas.style.cursor = 'default';
        }
        this.requestRender();
      };

      this.canvas.addEventListener('mousedown', this._onPointerDown);
      this.canvas.addEventListener('touchstart', this._onPointerDown, { passive: false });
      window.addEventListener('mousemove', this._onPointerMove);
      window.addEventListener('touchmove', this._onPointerMove, { passive: false });
      window.addEventListener('mouseup', this._onPointerUp);
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

    // ------------------------------------------------------------------
    // Physics & RK4 Electromechanical ODE Integration
    // ------------------------------------------------------------------

    _restoringForce(z, blend) {
      const b = clamp(blend, 0, 1);
      const kEff = (1 - b) * this.k - b * this.alpha;
      return kEff * z + b * this.beta * z * z * z;
    }

    _potentialEnergyJ(z, blend) {
      const b = clamp(blend, 0, 1);
      const kEff = (1 - b) * this.k - b * this.alpha;
      const z2 = z * z;
      return 0.5 * kEff * z2 + 0.25 * b * this.beta * z2 * z2;
    }

    _mechanicalEnergyMj() {
      const uJ = this._potentialEnergyJ(this.z, this.magBlend);
      const keJ = 0.5 * this.m * this.vz * this.vz;
      return (uJ + keJ) * 1000.0;
    }

    _derivatives(z, vz, vPzt, vCap, phiVal, omega, f0Drive, rLoad, blend, freezeMech) {
      const fExt = f0Drive * Math.sin(phiVal);
      const fRest = this._restoringForce(z, blend);
      const az = freezeMech ? 0.0 : (-this.c * vz - fRest + this.theta * vPzt + fExt) / this.m;
      const dz = freezeMech ? 0.0 : vz;

      const dvPzt = (-this.theta * vz - vPzt / rLoad) / this.Cp;

      const thresh = 2.0 * this.vd + vCap;
      const absV = Math.abs(vPzt);
      const iRect = absV > thresh ? (absV - thresh) / (rLoad + this.rs) : 0.0;
      const dvCap = (iRect - vCap / this.rLeak) / this.cStore;

      return [dz, az, dvPzt, dvCap];
    }

    update(dt) {
      const safeDt = Math.min(Math.max(0, Number.isFinite(dt) ? dt : 0), 0.035);
      if (safeDt <= 0) return;

      // Smooth magnet transition (0 = monostable, 1 = bistable Duffing)
      const targetBlend = this.bistableMode ? 1.0 : 0.0;
      this.magBlend += (targetBlend - this.magBlend) * Math.min(1, safeDt * 6.5);
      if (Math.abs(targetBlend - this.magBlend) < 1e-4) this.magBlend = targetBlend;

      // Automatic frequency sweep (30 <-> 90 Hz)
      if (this.sweeping) {
        const sweepRate = 5.0; // Hz per wall-clock second
        this.baseFreq += this.sweepDir * sweepRate * safeDt;
        if (this.baseFreq >= 90.0) {
          this.baseFreq = 90.0;
          this.sweepDir = -1;
        } else if (this.baseFreq <= 30.0) {
          this.baseFreq = 30.0;
          this.sweepDir = 1;
        }
        const fSlider = document.getElementById('sim13-freq');
        const fVal = document.getElementById('sim13-freq-val');
        if (fSlider) fSlider.value = String(Math.round(this.baseFreq));
        if (fVal) fVal.textContent = `${this.baseFreq.toFixed(0)} Hz`;
      }

      if (this.txBurstTimer > 0) {
        this.txBurstTimer = Math.max(0, this.txBurstTimer - safeDt);
      }

      const physDt = safeDt * TIME_SCALE;
      const nSteps = Math.max(4, Math.ceil(physDt / MAX_SUBSTEP_PHYS));
      const h = physDt / nSteps;

      const omega = 2 * Math.PI * this.baseFreq;
      const f0Drive = this.m * this.accG * G_ACCEL;
      const rLoad = this.loadKOhm * 1000.0;
      const freezeMech = this.isDraggingTip;

      let z = this.z;
      let vz = freezeMech ? 0.0 : this.vz;
      let v = this.vPzt;
      let vc = this.vCap;
      let phi = this.phi;
      const blend = this.magBlend;

      let stepPowerSumMw = 0.0;

      for (let i = 0; i < nSteps; i++) {
        const phiMid = phi + 0.5 * h * omega;
        const phiEnd = phi + h * omega;

        const k1 = this._derivatives(z, vz, v, vc, phi, omega, f0Drive, rLoad, blend, freezeMech);
        const k2 = this._derivatives(
          z + 0.5 * h * k1[0],
          vz + 0.5 * h * k1[1],
          v + 0.5 * h * k1[2],
          vc + 0.5 * h * k1[3],
          phiMid, omega, f0Drive, rLoad, blend, freezeMech
        );
        const k3 = this._derivatives(
          z + 0.5 * h * k2[0],
          vz + 0.5 * h * k2[1],
          v + 0.5 * h * k2[2],
          vc + 0.5 * h * k2[3],
          phiMid, omega, f0Drive, rLoad, blend, freezeMech
        );
        const k4 = this._derivatives(
          z + h * k3[0],
          vz + h * k3[1],
          v + h * k3[2],
          vc + h * k3[3],
          phiEnd, omega, f0Drive, rLoad, blend, freezeMech
        );

        if (!freezeMech) {
          z += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
          vz += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        } else {
          vz = 0.0;
        }
        v += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        vc += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
        phi = phiEnd;

        // Mechanical bumper stop
        if (z > this.zStopM) {
          z = this.zStopM;
          if (vz > 0) vz = -0.35 * vz;
        } else if (z < -this.zStopM) {
          z = -this.zStopM;
          if (vz < 0) vz = -0.35 * vz;
        }

        // Capacitor bounds & 3.30 V IoT RF packet burst trigger
        if (vc < 0) vc = 0.0;
        if (vc >= this.vTxThresh) {
          this.packetCount += 1;
          this.txBurstTimer = 0.85;
          vc = this.vUvlo;
        }
        if (vc > 3.60) vc = 3.60;

        stepPowerSumMw += ((v * v) / rLoad) * 1000.0;
      }

      // NaN / Infinity safety guard
      if (!Number.isFinite(z) || !Number.isFinite(vz) || !Number.isFinite(v) || !Number.isFinite(vc) || !Number.isFinite(phi)) {
        z = 0.0;
        vz = 0.0;
        v = 0.0;
        vc = 0.0;
        phi = 0.0;
      }

      this.z = z;
      this.vz = vz;
      this.vPzt = v;
      this.vCap = vc;
      this.phi = phi % (2 * Math.PI);

      // Rectifier conduction state & charge-dot flow animation
      const threshNow = 2.0 * this.vd + this.vCap;
      this.isConductingPos = this.vPzt > threshNow;
      this.isConductingNeg = -this.vPzt > threshNow;
      if (this.isConductingPos || this.isConductingNeg) {
        this.rectFlowPhase = (this.rectFlowPhase + safeDt * 3.2) % 1.0;
      }

      // Instantaneous & Exponentially Smoothed RMS Power (mW)
      this.instPowerMw = stepPowerSumMw / nSteps;
      const tauAvg = 0.35;
      const alphaAvg = 1 - Math.exp(-safeDt / tauAvg);
      this.avgPowerMw += (this.instPowerMw - this.avgPowerMw) * alphaAvg;

      // Oscilloscope history (~90 Hz sample rate in visual time)
      this._scopeAccum += safeDt;
      if (this._scopeAccum >= 0.011) {
        this._scopeAccum = 0;
        this.scopeHistory.push({
          vPzt: this.vPzt,
          pMw: this.instPowerMw,
          vCap: this.vCap
        });
        if (this.scopeHistory.length > this.scopeMax) {
          this.scopeHistory.shift();
        }
      }

      // Potential-well trail (~45 Hz sample rate in visual time)
      this._trailAccum += safeDt;
      if (this._trailAccum >= 0.022) {
        this._trailAccum = 0;
        this.wellTrail.push({
          zMm: this.z * 1000.0,
          uMj: this._potentialEnergyJ(this.z, this.magBlend) * 1000.0
        });
        if (this.wellTrail.length > this.wellTrailMax) {
          this.wellTrail.shift();
        }
      }

      this._updateUIBadges();
    }

    // ------------------------------------------------------------------
    // Canvas Safety Helpers
    // ------------------------------------------------------------------

    _safeArc(ctx, x, y, r, startAngle, endAngle, ccw) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) {
        return;
      }
      const safeR = Math.max(0.1, Number.isFinite(r) ? r : 0.1);
      ctx.arc(x, y, safeR, startAngle, endAngle, Boolean(ccw));
    }

    _safeLinearGrad(ctx, x0, y0, x1, y1) {
      const sx0 = Number.isFinite(x0) ? x0 : 0;
      const sy0 = Number.isFinite(y0) ? y0 : 0;
      const sx1 = Number.isFinite(x1) ? x1 : sx0;
      let sy1 = Number.isFinite(y1) ? y1 : sy0 + 1;
      if (sx0 === sx1 && sy0 === sy1) sy1 += 1;
      return ctx.createLinearGradient(sx0, sy0, sx1, sy1);
    }

    _safeRadialGrad(ctx, x0, y0, r0, x1, y1, r1) {
      const sx0 = Number.isFinite(x0) ? x0 : 0;
      const sy0 = Number.isFinite(y0) ? y0 : 0;
      const sx1 = Number.isFinite(x1) ? x1 : sx0;
      const sy1 = Number.isFinite(y1) ? y1 : sy0;
      const sr0 = Math.max(0, Number.isFinite(r0) ? r0 : 0);
      const sr1 = Math.max(0.1, Number.isFinite(r1) ? r1 : 0.1);
      return ctx.createRadialGradient(sx0, sy0, sr0, sx1, sy1, sr1);
    }

    _roundRectPath(ctx, x, y, w, h, r) {
      const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, rad);
      } else {
        ctx.moveTo(x + rad, y);
        ctx.lineTo(x + w - rad, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
        ctx.lineTo(x + w, y + h - rad);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
        ctx.lineTo(x + rad, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
        ctx.lineTo(x, y + rad);
        ctx.quadraticCurveTo(x, y, x + rad, y);
        ctx.closePath();
      }
    }

    _drawPanelFrame(ctx, box, title, accentColor, rightText, isCompact) {
      const grad = this._safeLinearGrad(ctx, box.x, box.y, box.x, box.y + box.h);
      grad.addColorStop(0, 'rgba(13, 21, 40, 0.96)');
      grad.addColorStop(1, 'rgba(8, 13, 26, 0.96)');

      this._roundRectPath(ctx, box.x, box.y, box.w, box.h, 6);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const headerH = isCompact ? 18 : 22;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this._roundRectPath(ctx, box.x + 1, box.y + 1, box.w - 2, headerH, 5);
      ctx.fill();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.beginPath();
      ctx.moveTo(box.x + 1, box.y + headerH);
      ctx.lineTo(box.x + box.w - 1, box.y + headerH);
      ctx.stroke();

      ctx.font = `700 ${isCompact ? 8.5 : 10}px 'Inter', 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = accentColor || '#00e5ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, box.x + 8, box.y + headerH * 0.5 + 0.5);

      if (rightText) {
        ctx.font = `600 ${isCompact ? 8 : 9}px 'JetBrains Mono', 'Consolas', monospace`;
        ctx.fillStyle = '#9e9eb8';
        ctx.textAlign = 'right';
        ctx.fillText(rightText, box.x + box.w - 8, box.y + headerH * 0.5 + 0.5);
      }

      return headerH;
    }

    // ------------------------------------------------------------------
    // Master Render (4-Panel Responsive Layout)
    // ------------------------------------------------------------------

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (!Number.isFinite(W) || !Number.isFinite(H) || W < 40 || H < 40) return;

      // Global dark-theme background & subtle technical grid
      const bgGrad = this._safeLinearGrad(ctx, 0, 0, 0, H);
      bgGrad.addColorStop(0, '#050912');
      bgGrad.addColorStop(1, '#080c18');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
      ctx.lineWidth = 1;
      const gridStep = W < 520 ? 28 : 36;
      ctx.beginPath();
      for (let gx = gridStep; gx < W; gx += gridStep) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
      }
      for (let gy = gridStep; gy < H; gy += gridStep) {
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
      }
      ctx.stroke();

      const isCompact = (W < 520 || H < 460);
      const pad = isCompact ? 5 : 8;
      const gap = isCompact ? 5 : 8;
      const topH = Math.round((H - pad * 2 - gap) * 0.54);
      const botH = Math.max(40, H - pad * 2 - gap - topH);
      const leftW = Math.round((W - pad * 2 - gap) * 0.52);
      const rightW = Math.max(40, W - pad * 2 - gap - leftW);

      const tl = { x: pad, y: pad, w: leftW, h: topH };
      const tr = { x: pad + leftW + gap, y: pad, w: rightW, h: topH };
      const bl = { x: pad, y: pad + topH + gap, w: leftW, h: botH };
      const br = { x: pad + leftW + gap, y: pad + topH + gap, w: rightW, h: botH };

      this._renderMechanicalPanel(ctx, tl, isCompact);
      this._renderCircuitPanel(ctx, tr, isCompact);
      this._renderScopePanel(ctx, bl, isCompact);
      this._renderPotentialPanel(ctx, br, isCompact);
    }

    // ------------------------------------------------------------------
    // Panel 1 (Top-Left): Motor, Bimorph PZT Cantilever, Tip Mass, Magnets
    // ------------------------------------------------------------------

    _renderMechanicalPanel(ctx, tl, isCompact) {
      ctx.save();
      this._roundRectPath(ctx, tl.x, tl.y, tl.w, tl.h, 6);
      ctx.clip();

      const title = tl.w >= 285
        ? 'MOTOR INDUSTRIAL & CANTILEVER PZT BIMORF'
        : 'MOTOR & PZT BIMORF';
      const rightInfo = tl.w >= 335
        ? `${this.baseFreq.toFixed(0)} Hz • ${this.accG.toFixed(1)} g`
        : null;
      const headerH = this._drawPanelFrame(ctx, tl, title, '#00e5ff', rightInfo, isCompact);

      const hintH = isCompact ? 13 : 16;
      const inTL = {
        x: tl.x + 6,
        y: tl.y + headerH + 3,
        w: tl.w - 12,
        h: Math.max(40, tl.h - headerH - hintH - 6)
      };

      const yBaseAmp = Math.min(isCompact ? 3.5 : 5.5, Math.max(0.8, this.accG * 2.1));
      const yBasePx = Math.sin(this.phi || 0) * yBaseAmp;
      const centerY = inTL.y + inTL.h * 0.48;
      const anchorY = centerY + yBasePx;
      this._anchorY = anchorY;

      // 1. Vibrating Industrial Motor Housing
      const motorW = clamp(inTL.w * 0.25, 40, 96);
      const motorH = clamp(inTL.h * 0.44, 44, 104);
      const motorX = inTL.x + 4;
      const motorY = anchorY - motorH * 0.5;

      // Mounting base plate + bolts
      ctx.fillStyle = '#475569';
      this._roundRectPath(ctx, motorX - 2, motorY + motorH, motorW + 4, 5, 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      this._safeArc(ctx, motorX + 5, motorY + motorH + 2.5, 1.5, 0, Math.PI * 2);
      this._safeArc(ctx, motorX + motorW - 5, motorY + motorH + 2.5, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Vibration arrows above motor
      const vibArrowY = motorY - 6;
      if (vibArrowY > inTL.y + 8) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
        ctx.lineWidth = 1.2;
        const arrowSpan = 4 + this.accG * 1.6;
        const ax = motorX + motorW * 0.5;
        ctx.beginPath();
        ctx.moveTo(ax, vibArrowY - arrowSpan * 0.5);
        ctx.lineTo(ax, vibArrowY + arrowSpan * 0.5);
        ctx.stroke();
        ctx.font = `600 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`↕ ${this.accG.toFixed(1)}g`, ax, vibArrowY - arrowSpan * 0.5 - 1);
      }

      // Motor body gradient & cooling ribs
      const motorGrad = this._safeLinearGrad(ctx, motorX, motorY, motorX, motorY + motorH);
      motorGrad.addColorStop(0, '#475569');
      motorGrad.addColorStop(0.5, '#334155');
      motorGrad.addColorStop(1, '#1e293b');
      this._roundRectPath(ctx, motorX, motorY, motorW, motorH, 5);
      ctx.fillStyle = motorGrad;
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      for (let r = 0; r < 4; r++) {
        const ry = motorY + 7 + r * ((motorH - 16) / 4);
        ctx.fillRect(motorX + 4, ry, motorW * 0.42, 2);
      }

      // Spinning eccentric rotor hub
      const hubX = motorX + motorW * 0.68;
      const hubY = anchorY - 4;
      const hubR = clamp(motorW * 0.20, 7, 13);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      this._safeArc(ctx, hubX, hubY, hubR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const eccX = hubX + Math.cos(this.phi) * (hubR * 0.52);
      const eccY = hubY + Math.sin(this.phi) * (hubR * 0.52);
      ctx.fillStyle = '#ffab40';
      ctx.beginPath();
      this._safeArc(ctx, eccX, eccY, Math.max(2.2, hubR * 0.28), 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `700 ${isCompact ? 7.5 : 8.5}px 'Inter', sans-serif`;
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('MOTOR', motorX + motorW * 0.5, motorY + motorH - 3);

      // 2. Rigid Clamp + Bimorph PZT Cantilever
      const clampX = motorX + motorW + 1;
      const clampW = isCompact ? 9 : 13;
      const clampH = isCompact ? 22 : 28;
      ctx.fillStyle = '#64748b';
      this._roundRectPath(ctx, clampX, anchorY - clampH * 0.5, clampW, clampH, 2);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const magW = isCompact ? 18 : 24;
      const magH = isCompact ? 34 : 48;
      const magBaseX = inTL.x + inTL.w - magW - (isCompact ? 8 : 14);
      const beamX0 = clampX + clampW;
      const beamX1 = Math.max(beamX0 + 34, magBaseX - (isCompact ? 26 : 42));
      const beamLen = beamX1 - beamX0;

      const maxDeflect = Math.max(18, inTL.h * 0.28);
      this._maxDeflectPx = maxDeflect;
      const zPx = clamp((this.z / this.zVisualMaxM) * maxDeflect, -maxDeflect, maxDeflect);

      // Sample Euler-Bernoulli 1st mode shape w(xi) = zPx * (3*xi^2 - xi^3)/2
      const nSeg = 18;
      const pts = [];
      for (let i = 0; i <= nSeg; i++) {
        const xi = i / nSeg;
        const bx = beamX0 + xi * beamLen;
        const by = anchorY + zPx * (1.5 * xi * xi - 0.5 * xi * xi * xi);
        pts.push({ x: bx, y: by, xi });
      }

      // Compute PZT polarity color from vPzt
      const vNorm = clamp(this.vPzt / 12.0, -1, 1);
      const posColor = lerpColor(71, 85, 105, 0, 229, 255, Math.abs(vNorm));   // slate -> cyan
      const negColor = lerpColor(71, 85, 105, 255, 171, 64, Math.abs(vNorm)); // slate -> amber
      const topPztColor = vNorm >= 0 ? posColor : negColor;
      const botPztColor = vNorm >= 0 ? negColor : posColor;
      const pztOff = isCompact ? 3.0 : 4.0;

      // Top & bottom PZT layers (0.02..0.72 of beam)
      const pztPts = pts.filter((p) => p.xi <= 0.74);
      if (pztPts.length >= 2) {
        ctx.lineCap = 'butt';
        ctx.lineWidth = isCompact ? 2.6 : 3.4;

        ctx.strokeStyle = topPztColor;
        ctx.beginPath();
        for (let i = 0; i < pztPts.length; i++) {
          const p = pztPts[i];
          if (i === 0) ctx.moveTo(p.x, p.y - pztOff);
          else ctx.lineTo(p.x, p.y - pztOff);
        }
        ctx.stroke();

        ctx.strokeStyle = botPztColor;
        ctx.beginPath();
        for (let i = 0; i < pztPts.length; i++) {
          const p = pztPts[i];
          if (i === 0) ctx.moveTo(p.x, p.y + pztOff);
          else ctx.lineTo(p.x, p.y + pztOff);
        }
        ctx.stroke();

        // Electrode leads from PZT layers toward right
        ctx.lineWidth = 1;
        ctx.strokeStyle = topPztColor;
        ctx.beginPath();
        ctx.moveTo(beamX0 + 2, anchorY - pztOff);
        ctx.lineTo(beamX0 + 2, anchorY - clampH * 0.5 - 5);
        ctx.stroke();

        ctx.strokeStyle = botPztColor;
        ctx.beginPath();
        ctx.moveTo(beamX0 + 2, anchorY + pztOff);
        ctx.lineTo(beamX0 + 2, anchorY + clampH * 0.5 + 5);
        ctx.stroke();
      }

      // Brass center shim
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = isCompact ? 2.2 : 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // 3. Draggable Tungsten Tip Mass ('W')
      const tipX = pts[pts.length - 1].x;
      const tipY = pts[pts.length - 1].y;
      const massR = isCompact ? 9 : 13;

      // Grab halo
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = this.isDraggingTip ? '#ffab40' : 'rgba(0, 229, 255, 0.55)';
      ctx.lineWidth = this.isDraggingTip ? 1.8 : 1.2;
      ctx.beginPath();
      this._safeArc(ctx, tipX, tipY, massR + (this.isDraggingTip ? 6 : 4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const massGrad = this._safeRadialGrad(
        ctx, tipX - massR * 0.3, tipY - massR * 0.3, 1,
        tipX, tipY, massR
      );
      massGrad.addColorStop(0, '#94a3b8');
      massGrad.addColorStop(0.6, '#475569');
      massGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = massGrad;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      this._safeArc(ctx, tipX, tipY, massR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tip magnet N-strip when bistable magnets are visible
      if (this.magBlend > 0.05) {
        ctx.save();
        ctx.globalAlpha = clamp(this.magBlend, 0, 1);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(tipX + massR - 2, tipY - 4, 4, 8);
        ctx.restore();
      }

      ctx.font = `700 ${isCompact ? 9 : 11}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', tipX, tipY + 0.5);

      this._tipHit = {
        x: tipX,
        y: tipY,
        cx: tipX,
        cy: tipY,
        r: Math.max(20, massR + 10)
      };

      // 4. Clickable Repulsive Neodymium Magnet Assembly (Fixed Frame)
      const slideOffset = (1 - this.magBlend) * (isCompact ? 6 : 9);
      const magX = magBaseX + slideOffset;
      const magY = centerY - magH * 0.5;

      ctx.save();
      ctx.globalAlpha = 0.42 + 0.58 * this.magBlend;

      // N pole (left facing tip mass) + S pole (right)
      const poleW = magW * 0.52;
      ctx.fillStyle = '#ef4444';
      this._roundRectPath(ctx, magX, magY, poleW, magH, 3);
      ctx.fill();

      ctx.fillStyle = '#3b82f6';
      this._roundRectPath(ctx, magX + poleW - 1, magY, magW - poleW + 1, magH, 3);
      ctx.fill();

      ctx.strokeStyle = this.bistableMode ? '#69f0ae' : '#64748b';
      ctx.lineWidth = this.bistableMode ? 1.5 : 1;
      this._roundRectPath(ctx, magX, magY, magW, magH, 3);
      ctx.stroke();

      ctx.font = `700 ${isCompact ? 8 : 9.5}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', magX + poleW * 0.5, centerY);
      ctx.fillText('S', magX + poleW + (magW - poleW) * 0.5, centerY);

      // Repulsive magnetic field arcs when active
      if (this.magBlend > 0.15) {
        ctx.strokeStyle = `rgba(255, 171, 64, ${0.72 * this.magBlend})`;
        ctx.lineWidth = 1.2;
        const midGapX = (tipX + massR + magX) * 0.5;
        for (let k = -1; k <= 1; k++) {
          const yOff = k * (isCompact ? 9 : 13);
          ctx.beginPath();
          ctx.moveTo(magX - 2, centerY + yOff * 0.5);
          ctx.quadraticCurveTo(midGapX, centerY + yOff * 1.15, tipX + massR + 4, tipY + yOff * 0.45);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Magnet status pill below magnet
      const pillText = this.bistableMode
        ? (isCompact ? 'DUFFING ON' : 'MAGNEȚI: ACTIVI')
        : (isCompact ? 'MAGNEȚI OFF' : 'MAGNEȚI: OPRIȚI');
      ctx.font = `700 ${isCompact ? 7.2 : 8.2}px 'Inter', sans-serif`;
      const pillW = Math.min(inTL.w * 0.42, ctx.measureText(pillText).width + 10);
      const pillX = clamp(magBaseX + magW * 0.5 - pillW * 0.5, inTL.x + 2, inTL.x + inTL.w - pillW - 2);
      const pillY = Math.min(inTL.y + inTL.h - 14, magY + magH + 5);

      ctx.fillStyle = this.bistableMode ? 'rgba(16, 60, 40, 0.85)' : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = this.bistableMode ? '#69f0ae' : '#475569';
      ctx.lineWidth = 1;
      this._roundRectPath(ctx, pillX, pillY, pillW, 13, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.bistableMode ? '#69f0ae' : '#9e9eb8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + pillW * 0.5, pillY + 6.8);

      // Generous clickable hitbox covering magnet + pill
      const hitX = Math.min(magBaseX - 8, pillX - 2);
      this._magnetHit = {
        x: hitX,
        y: Math.max(inTL.y, magY - 6),
        w: (inTL.x + inTL.w) - hitX,
        h: (pillY + 15) - Math.max(inTL.y, magY - 6)
      };

      // Bottom interaction hint
      ctx.font = `500 ${isCompact ? 7.5 : 8.5}px 'Inter', sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const hint = tl.w >= 275
        ? '💡 Trage masa W (ciupire) • Click pe magneți (Duffing)'
        : '💡 Trage W • Click magneți';
      ctx.fillText(hint, tl.x + 8, tl.y + tl.h - 4);

      ctx.restore();
    }

    // ------------------------------------------------------------------
    // Panel 2 (Top-Right): Rectifier, C_store, LDO & IoT RF Transceiver
    // ------------------------------------------------------------------

    _renderCircuitPanel(ctx, tr, isCompact) {
      ctx.save();
      this._roundRectPath(ctx, tr.x, tr.y, tr.w, tr.h, 6);
      ctx.clip();

      const title = tr.w >= 280
        ? 'CIRCUIT REDRESOR, STOCARE & EMISIE IoT RF'
        : 'CIRCUIT REDRESOR & IoT RF';
      const headerH = this._drawPanelFrame(ctx, tr, title, '#00e5ff', null, isCompact);

      const inTR = {
        x: tr.x + 8,
        y: tr.y + headerH + 6,
        w: tr.w - 16,
        h: Math.max(40, tr.h - headerH - 12)
      };

      const cy = inTR.y + inTR.h * 0.55;
      const dR = clamp(Math.min(inTR.w * 0.115, inTR.h * 0.24), 16, 34);

      const xPzt = inTR.x + inTR.w * 0.04;
      const xBridge = inTR.x + inTR.w * 0.26;
      const xCap = inTR.x + inTR.w * 0.53;
      const xLdo = inTR.x + inTR.w * 0.72;
      const xRf = inTR.x + inTR.w * 0.89;

      const yTopRail = cy - dR;
      const yBotRail = cy + dR;

      // 1. PZT AC input terminals & leads
      const acTopY = cy - dR * 0.42;
      const acBotY = cy + dR * 0.42;
      const acColorTop = this.vPzt >= 0 ? '#00e5ff' : '#ffab40';
      const acColorBot = this.vPzt >= 0 ? '#ffab40' : '#00e5ff';

      ctx.lineWidth = 1.6;
      // Top AC lead -> left bridge node
      ctx.strokeStyle = acColorTop;
      ctx.beginPath();
      ctx.moveTo(xPzt + 6, acTopY);
      ctx.lineTo(xBridge - dR - 6, acTopY);
      ctx.lineTo(xBridge - dR, cy);
      ctx.stroke();

      // Bottom AC lead -> right bridge node (routed cleanly below top lead)
      ctx.strokeStyle = acColorBot;
      ctx.beginPath();
      ctx.moveTo(xPzt + 6, acBotY);
      ctx.lineTo(xBridge - dR - 4, acBotY);
      ctx.lineTo(xBridge, cy + dR * 0.28);
      ctx.lineTo(xBridge + dR, cy);
      ctx.stroke();

      // PZT input circles & label
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      this._safeArc(ctx, xPzt + 4, acTopY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      this._safeArc(ctx, xPzt + 4, acBotY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = `700 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#9e9eb8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('~ PZT', xPzt, acTopY - 6);

      // DC rails (+DC top, GND bottom)
      const dcActive = this.vCap > 0.2;
      const railColor = this.vCap >= 3.10 ? '#69f0ae' : (dcActive ? '#00e5ff' : '#475569');
      ctx.strokeStyle = railColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      // +DC rail from bridge top to LDO & RF
      ctx.moveTo(xBridge, yTopRail);
      ctx.lineTo(xRf, yTopRail);
      // GND rail from bridge bottom to RF
      ctx.moveTo(xBridge, yBotRail);
      ctx.lineTo(xRf, yBotRail);
      ctx.stroke();

      // 2. 4-Diode Schottky Diamond Bridge
      const vTop = { x: xBridge, y: yTopRail };
      const vBot = { x: xBridge, y: yBotRail };
      const vLeft = { x: xBridge - dR, y: cy };
      const vRight = { x: xBridge + dR, y: cy };

      const drawDiodeEdge = (p1, p2, active, activeColor) => {
        ctx.save();
        ctx.strokeStyle = active ? activeColor : '#475569';
        ctx.fillStyle = active ? activeColor : '#334155';
        ctx.lineWidth = active ? 2.0 : 1.3;
        if (active) {
          ctx.shadowColor = activeColor;
          ctx.shadowBlur = 7;
        }
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Diode triangle + cathode bar at midpoint pointing p1 -> p2
        const mx = (p1.x + p2.x) * 0.5;
        const my = (p1.y + p2.y) * 0.5;
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const sz = isCompact ? 4.2 : 5.2;

        ctx.translate(mx, my);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-sz, -sz * 0.78);
        ctx.lineTo(sz * 0.85, 0);
        ctx.lineTo(-sz, sz * 0.78);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sz * 0.9, -sz * 0.85);
        ctx.lineTo(sz * 0.9, sz * 0.85);
        ctx.stroke();
        ctx.restore();

        if (active) {
          const u = this.rectFlowPhase;
          const qx = p1.x + (p2.x - p1.x) * u;
          const qy = p1.y + (p2.y - p1.y) * u;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          this._safeArc(ctx, qx, qy, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      // Positive half-cycle: Left->Top and Bot->Right; Negative: Right->Top and Bot->Left
      drawDiodeEdge(vLeft, vTop, this.isConductingPos, '#00e5ff');
      drawDiodeEdge(vBot, vRight, this.isConductingPos, '#00e5ff');
      drawDiodeEdge(vRight, vTop, this.isConductingNeg, '#ffab40');
      drawDiodeEdge(vBot, vLeft, this.isConductingNeg, '#ffab40');

      // Bridge label below GND rail
      ctx.font = `600 ${isCompact ? 7.5 : 8.5}px 'Inter', sans-serif`;
      ctx.fillStyle = '#9e9eb8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(isCompact ? 'Punte' : 'Punte Schottky', xBridge, yBotRail + 5);

      // 3. Storage Capacitor C_store (tank between rails)
      const capW = isCompact ? 18 : 26;
      const tankH = Math.max(26, dR * 1.45);
      const tankTop = cy - tankH * 0.5;
      const tankBot = cy + tankH * 0.5;
      const capX = xCap - capW * 0.5;

      // Vertical rail leads into tank
      ctx.strokeStyle = railColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xCap, yTopRail);
      ctx.lineTo(xCap, tankTop);
      ctx.moveTo(xCap, tankBot);
      ctx.lineTo(xCap, yBotRail);
      ctx.stroke();

      // Tank background
      ctx.fillStyle = '#0b1324';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.3;
      this._roundRectPath(ctx, capX, tankTop, capW, tankH, 3);
      ctx.fill();
      ctx.stroke();

      // Charge fill
      const fillFrac = clamp(this.vCap / 3.60, 0, 1);
      const fillH = Math.max(0, (tankH - 4) * fillFrac);
      const fillColor = this.vCap >= 3.10 ? '#69f0ae' : (this.vCap >= 2.0 ? '#00e5ff' : '#ffab40');
      if (fillH > 0.5) {
        ctx.fillStyle = fillColor;
        this._roundRectPath(ctx, capX + 2, tankBot - 2 - fillH, capW - 4, fillH, 2);
        ctx.fill();
      }

      // 3.30V threshold dashed line
      const yThresh = tankBot - 2 - (this.vTxThresh / 3.60) * (tankH - 4);
      ctx.save();
      ctx.setLineDash([2.5, 2]);
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(capX - 3, yThresh);
      ctx.lineTo(capX + capW + 3, yThresh);
      ctx.stroke();
      ctx.restore();

      ctx.font = `600 ${isCompact ? 7.0 : 8.0}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#69f0ae';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('3.30V', capX + capW + 4, yThresh);

      ctx.font = `700 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(isCompact ? 'C' : 'C_store', xCap, yTopRail - 4);

      ctx.fillStyle = this.vCap >= 3.10 ? '#69f0ae' : '#00e5ff';
      ctx.textBaseline = 'top';
      ctx.fillText(`${this.vCap.toFixed(2)}V`, xCap, yBotRail + 5);

      // 4. LDO Voltage Regulator ('3.3V REG')
      const ldoW = isCompact ? 24 : 34;
      const ldoH = isCompact ? 20 : 26;
      const ldoX = xLdo - ldoW * 0.5;
      const ldoY = cy - ldoH * 0.5;
      const ldoActive = (this.txBurstTimer > 0 || this.vCap >= this.vTxThresh);

      ctx.strokeStyle = railColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(xLdo, yTopRail);
      ctx.lineTo(xLdo, ldoY);
      ctx.moveTo(xLdo, ldoY + ldoH);
      ctx.lineTo(xLdo, yBotRail);
      ctx.stroke();

      ctx.fillStyle = ldoActive ? 'rgba(16, 60, 40, 0.92)' : '#151c32';
      ctx.strokeStyle = ldoActive ? '#69f0ae' : '#475569';
      ctx.lineWidth = ldoActive ? 1.6 : 1.2;
      this._roundRectPath(ctx, ldoX, ldoY, ldoW, ldoH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = `700 ${isCompact ? 7.0 : 8.0}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = ldoActive ? '#69f0ae' : '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('3.3V', xLdo, cy - (isCompact ? 4 : 5));
      ctx.fillText('REG', xLdo, cy + (isCompact ? 4 : 5));

      // 5. IoT RF Transceiver IC + Antenna + Animated Packet Burst
      const rfW = isCompact ? 22 : 30;
      const rfH = isCompact ? 22 : 28;
      const rfX = xRf - rfW * 0.5;
      const rfY = cy - rfH * 0.5;

      // Feed line from LDO to RF
      ctx.strokeStyle = ldoActive ? '#69f0ae' : '#475569';
      ctx.lineWidth = ldoActive ? 2.0 : 1.3;
      ctx.beginPath();
      ctx.moveTo(ldoX + ldoW, cy);
      ctx.lineTo(rfX, cy);
      ctx.stroke();

      // Vertical rails at RF
      ctx.strokeStyle = railColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(xRf, yTopRail);
      ctx.lineTo(xRf, rfY);
      ctx.moveTo(xRf, rfY + rfH);
      ctx.lineTo(xRf, yBotRail);
      ctx.stroke();

      ctx.save();
      if (this.txBurstTimer > 0) {
        ctx.shadowColor = '#69f0ae';
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = this.txBurstTimer > 0 ? 'rgba(16, 65, 44, 0.95)' : '#151c32';
      ctx.strokeStyle = this.txBurstTimer > 0 ? '#69f0ae' : '#64748b';
      ctx.lineWidth = this.txBurstTimer > 0 ? 1.8 : 1.2;
      this._roundRectPath(ctx, rfX, rfY, rfW, rfH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.font = `700 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = this.txBurstTimer > 0 ? '#69f0ae' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IoT', xRf, cy - (isCompact ? 4 : 5));
      ctx.fillText('RF', xRf, cy + (isCompact ? 4 : 5));

      // Antenna mast
      const antTipY = Math.max(inTR.y + 16, yTopRail - (isCompact ? 10 : 16));
      ctx.strokeStyle = this.txBurstTimer > 0 ? '#69f0ae' : '#94a3b8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(xRf, rfY);
      ctx.lineTo(xRf, antTipY);
      ctx.stroke();

      ctx.fillStyle = this.txBurstTimer > 0 ? '#69f0ae' : '#cbd5e1';
      ctx.beginPath();
      this._safeArc(ctx, xRf, antTipY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Animated wireless RF waves & TX PKT #N pill during burst
      if (this.txBurstTimer > 0) {
        const p = clamp(1 - this.txBurstTimer / 0.85, 0, 1);
        for (let w = 0; w < 3; w++) {
          const rWave = 5 + w * 6 + p * 16;
          const alpha = clamp(1 - p - w * 0.16, 0.08, 0.95);
          ctx.strokeStyle = `rgba(105, 240, 174, ${alpha.toFixed(2)})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          this._safeArc(ctx, xRf, antTipY, rWave, -Math.PI * 0.88, -Math.PI * 0.12);
          ctx.stroke();
        }

        const burstLabel = `TX PKT #${this.packetCount}`;
        ctx.font = `700 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
        const bW = ctx.measureText(burstLabel).width + 10;
        const bX = inTR.x + inTR.w - bW;
        const bY = inTR.y + 1;
        ctx.fillStyle = 'rgba(16, 60, 40, 0.95)';
        ctx.strokeStyle = '#69f0ae';
        ctx.lineWidth = 1.2;
        this._roundRectPath(ctx, bX, bY, bW, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#69f0ae';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(burstLabel, bX + bW * 0.5, bY + 7.5);
      }

      // Bottom-right persistent TX counter
      ctx.font = `600 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = this.txBurstTimer > 0 ? '#69f0ae' : '#9e9eb8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`TX: #${this.packetCount}`, inTR.x + inTR.w, inTR.y + inTR.h);

      ctx.restore();
    }

    // ------------------------------------------------------------------
    // Panel 3 (Bottom-Left): Voltage & Power Oscilloscope
    // ------------------------------------------------------------------

    _renderScopePanel(ctx, bl, isCompact) {
      ctx.save();
      this._roundRectPath(ctx, bl.x, bl.y, bl.w, bl.h, 6);
      ctx.clip();

      const title = bl.w >= 285
        ? 'OSCILOSCOP TENSIUNE V_pzt(t) & PUTERE P(t)'
        : 'OSCILOSCOP V(t) & P(t)';
      const headerH = this._drawPanelFrame(ctx, bl, title, '#00e5ff', null, isCompact);

      // Dedicated legend strip above plot box
      const legY = bl.y + headerH + (isCompact ? 7 : 9);
      ctx.font = `600 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lx = bl.x + 8;
      if (isCompact) {
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('— V_pzt', lx, legY);
        ctx.fillStyle = '#ffab40';
        ctx.fillText('— P(mW)', lx + 54, legY);
        ctx.fillStyle = '#69f0ae';
        ctx.fillText('-- V_cap', lx + 110, legY);
      } else {
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('— V_pzt (V)', lx, legY);
        ctx.fillStyle = '#ffab40';
        ctx.fillText('— P (mW)', lx + 82, legY);
        ctx.fillStyle = '#69f0ae';
        ctx.fillText('-- V_cap', lx + 150, legY);
      }

      const topPad = headerH + (isCompact ? 14 : 18);
      const padL = isCompact ? 30 : 40;
      const padR = isCompact ? 30 : 38;
      const padB = isCompact ? 15 : 19;
      const plotX = bl.x + padL;
      const plotY = bl.y + topPad;
      const plotW = Math.max(20, bl.w - padL - padR);
      const plotH = Math.max(20, bl.h - topPad - padB);

      // Dynamic scales with clean floor
      let vMaxSeen = 15.0;
      let pMaxSeen = 2.5;
      for (let i = 0; i < this.scopeHistory.length; i++) {
        const s = this.scopeHistory[i];
        if (Math.abs(s.vPzt) > vMaxSeen) vMaxSeen = Math.abs(s.vPzt);
        if (s.pMw > pMaxSeen) pMaxSeen = s.pMw;
      }
      const vScale = vMaxSeen > 18 ? 25.0 : 16.0;
      const pScale = pMaxSeen > 4.0 ? 8.0 : (pMaxSeen > 2.2 ? 4.0 : 2.5);

      // Plot box background & grid
      ctx.fillStyle = 'rgba(5, 9, 18, 0.88)';
      ctx.fillRect(plotX, plotY, plotW, plotH);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(plotX, plotY, plotW, plotH);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        const gy = plotY + (plotH * i) / 4;
        ctx.moveTo(plotX, gy);
        ctx.lineTo(plotX + plotW, gy);
      }
      for (let j = 1; j < 5; j++) {
        const gx = plotX + (plotW * j) / 5;
        ctx.moveTo(gx, plotY);
        ctx.lineTo(gx, plotY + plotH);
      }
      ctx.stroke();

      const yZero = plotY + plotH * 0.5;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.moveTo(plotX, yZero);
      ctx.lineTo(plotX + plotW, yZero);
      ctx.stroke();

      // Left Y-axis ticks (V_pzt)
      ctx.font = `500 ${isCompact ? 7 : 8}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`+${vScale.toFixed(0)}V`, plotX - 3, plotY);
      ctx.textBaseline = 'middle';
      ctx.fillText('0V', plotX - 3, yZero);
      ctx.textBaseline = 'bottom';
      ctx.fillText(`-${vScale.toFixed(0)}V`, plotX - 3, plotY + plotH);

      // Right Y-axis ticks (Power mW)
      ctx.fillStyle = '#ffab40';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${pScale.toFixed(1)}mW`, plotX + plotW + 3, plotY);
      ctx.textBaseline = 'bottom';
      ctx.fillText('0mW', plotX + plotW + 3, plotY + plotH);

      // Traces inside clipped plot box
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotX, plotY, plotW, plotH);
      ctx.clip();

      // V_cap dashed green reference line
      const yVcap = clamp(yZero - (this.vCap / vScale) * (plotH * 0.48), plotY + 2, plotY + plotH - 2);
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(plotX, yVcap);
      ctx.lineTo(plotX + plotW, yVcap);
      ctx.stroke();
      ctx.restore();

      const n = this.scopeHistory.length;
      if (n >= 2) {
        // 1. Instantaneous Power P(t) amber area + line
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const sx = plotX + (i / (this.scopeMax - 1)) * plotW;
          const pNorm = clamp(this.scopeHistory[i].pMw / pScale, 0, 1);
          const sy = plotY + plotH - pNorm * (plotH * 0.85);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = '#ffab40';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const lastX = plotX + ((n - 1) / (this.scopeMax - 1)) * plotW;
        ctx.lineTo(lastX, plotY + plotH);
        ctx.lineTo(plotX, plotY + plotH);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 171, 64, 0.14)';
        ctx.fill();

        // 2. Piezo Voltage V_pzt(t) cyan trace
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const sx = plotX + (i / (this.scopeMax - 1)) * plotW;
          const vNorm = clamp(this.scopeHistory[i].vPzt / vScale, -1.05, 1.05);
          const sy = yZero - vNorm * (plotH * 0.46);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      ctx.restore();

      // Bottom footer readouts
      ctx.font = `500 ${isCompact ? 7.2 : 8.2}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(isCompact ? 't (ms)' : 'Timp t (ms)', plotX, bl.y + bl.h - 3);

      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'right';
      const footerRight = isCompact
        ? `P:${this.avgPowerMw.toFixed(2)}mW | ${this.vCap.toFixed(2)}V`
        : `P_med: ${this.avgPowerMw.toFixed(2)} mW • V_cap: ${this.vCap.toFixed(2)} V`;
      ctx.fillText(footerRight, plotX + plotW, bl.y + bl.h - 3);

      ctx.restore();
    }

    // ------------------------------------------------------------------
    // Panel 4 (Bottom-Right): Mechanical Potential Well U(z)
    // ------------------------------------------------------------------

    _renderPotentialPanel(ctx, br, isCompact) {
      ctx.save();
      this._roundRectPath(ctx, br.x, br.y, br.w, br.h, 6);
      ctx.clip();

      const headerAccent = this.bistableMode ? '#ffab40' : '#00e5ff';
      const title = br.w >= 265
        ? 'GROAPĂ DE POTENȚIAL MECANIC U(z)'
        : 'POTENȚIAL U(z)';
      const headerH = this._drawPanelFrame(ctx, br, title, headerAccent, null, isCompact);

      // Sub-header regime strip
      const subY = br.y + headerH + (isCompact ? 7 : 9);
      ctx.font = `600 ${isCompact ? 7.5 : 8.5}px 'Inter', sans-serif`;
      ctx.fillStyle = this.bistableMode ? '#ffab40' : '#94a3b8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const regimeStr = this.bistableMode
        ? (isCompact ? 'Bistabil (2 Gropi)' : 'Regim: Bistabil Duffing (2 Gropi)')
        : (isCompact ? 'Monostabil (1 Groapă)' : 'Regim: Monostabil Liniar (1 Groapă)');
      ctx.fillText(regimeStr, br.x + 8, subY);

      ctx.font = `600 ${isCompact ? 7.5 : 8.5}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#69f0ae';
      ctx.textAlign = 'right';
      ctx.fillText('-- E_mec', br.x + br.w - 8, subY);

      const topPad = headerH + (isCompact ? 14 : 18);
      const padL = isCompact ? 30 : 38;
      const padR = 10;
      const padB = isCompact ? 15 : 19;
      const plotX = br.x + padL;
      const plotY = br.y + topPad;
      const plotW = Math.max(20, br.w - padL - padR);
      const plotH = Math.max(20, br.h - topPad - padB);

      // Scale z-domain so bistable double-well minima (+/-1.2 mm) & central barrier are prominent
      const b = this.magBlend;
      const zPlotMaxMm = 2.4 * (1 - b) + 2.1 * b;
      const nSamples = 84;
      let uMinMj = Infinity;
      let uMaxMj = -Infinity;
      const curvePts = [];
      const monoPts = [];
      for (let i = 0; i <= nSamples; i++) {
        const zMm = -zPlotMaxMm + (2 * zPlotMaxMm * i) / nSamples;
        const zM = zMm * 1e-3;
        const uMj = this._potentialEnergyJ(zM, b) * 1000.0;
        const uMonoMj = this._potentialEnergyJ(zM, 0.0) * 1000.0;
        curvePts.push({ zMm, uMj });
        monoPts.push({ zMm, uMj: uMonoMj });
        if (uMj < uMinMj) uMinMj = uMj;
        if (uMj > uMaxMj) uMaxMj = uMj;
      }

      const eMecMj = this._mechanicalEnergyMj();
      const span = Math.max(0.25, uMaxMj - uMinMj);
      const uLow = uMinMj - span * 0.14;
      const uHigh = Math.max(uMaxMj + span * 0.08, eMecMj + span * 0.08);

      const mapX = (zMm) => plotX + ((clamp(zMm, -zPlotMaxMm, zPlotMaxMm) + zPlotMaxMm) / (2 * zPlotMaxMm)) * plotW;
      const mapY = (uMj) => {
        const norm = (uMj - uLow) / Math.max(1e-6, uHigh - uLow);
        return plotY + plotH - clamp(norm, 0, 1.02) * plotH;
      };

      // Plot box background & grid
      ctx.fillStyle = 'rgba(5, 9, 18, 0.88)';
      ctx.fillRect(plotX, plotY, plotW, plotH);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(plotX, plotY, plotW, plotH);

      // Center z = 0 line
      const xZero = mapX(0);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.beginPath();
      ctx.moveTo(xZero, plotY);
      ctx.lineTo(xZero, plotY + plotH);
      ctx.stroke();

      // Y-axis ticks
      ctx.font = `500 ${isCompact ? 7 : 8}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('U(mJ)', plotX - 3, plotY);
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${uMinMj.toFixed(2)}`, plotX - 3, plotY + plotH);

      // Clipped potential curves, energy line & state ball
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotX, plotY, plotW, plotH);
      ctx.clip();

      // Reference monostable dashed curve when bistable is active
      if (b > 0.08) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.42)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < monoPts.length; i++) {
          const px = mapX(monoPts[i].zMm);
          const py = mapY(monoPts[i].uMj);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Active potential well curve U(z)
      ctx.beginPath();
      for (let i = 0; i < curvePts.length; i++) {
        const px = mapX(curvePts[i].zMm);
        const py = mapY(curvePts[i].uMj);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = this.bistableMode ? '#ffab40' : '#00e5ff';
      ctx.lineWidth = 2.1;
      ctx.stroke();

      // E_mec green dashed horizontal line
      const yEmec = mapY(eMecMj);
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(plotX, yEmec);
      ctx.lineTo(plotX + plotW, yEmec);
      ctx.stroke();
      ctx.restore();

      // Fading state trail
      for (let i = 0; i < this.wellTrail.length; i++) {
        const tPt = this.wellTrail[i];
        const frac = (i + 1) / this.wellTrail.length;
        const tx = mapX(tPt.zMm);
        const ty = mapY(tPt.uMj);
        ctx.fillStyle = this.bistableMode
          ? `rgba(255, 171, 64, ${(frac * 0.45).toFixed(2)})`
          : `rgba(0, 229, 255, ${(frac * 0.45).toFixed(2)})`;
        ctx.beginPath();
        this._safeArc(ctx, tx, ty, 2.0 + frac * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Live glowing state ball
      const curZMm = this.z * 1000.0;
      const curUMj = this._potentialEnergyJ(this.z, b) * 1000.0;
      const bx = mapX(curZMm);
      const by = mapY(curUMj);

      const ballGlow = this._safeRadialGrad(ctx, bx, by, 1, bx, by, 11);
      ballGlow.addColorStop(0, '#ffffff');
      ballGlow.addColorStop(0.35, this.bistableMode ? '#ffab40' : '#00e5ff');
      ballGlow.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = ballGlow;
      ctx.beginPath();
      this._safeArc(ctx, bx, by, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = this.bistableMode ? '#ffab40' : '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      this._safeArc(ctx, bx, by, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // X-axis labels
      ctx.font = `500 ${isCompact ? 7 : 8}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#64748b';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillText(`-${zPlotMaxMm.toFixed(1)}`, plotX, br.y + br.h - 3);
      ctx.textAlign = 'center';
      ctx.fillText(isCompact ? 'z (mm)' : 'Deplasare z (mm)', plotX + plotW * 0.5, br.y + br.h - 3);
      ctx.textAlign = 'right';
      ctx.fillText(`+${zPlotMaxMm.toFixed(1)}`, plotX + plotW, br.y + br.h - 3);

      ctx.restore();
    }
  }

  window.EnergyHarvestingSim = EnergyHarvestingSim;
})();
