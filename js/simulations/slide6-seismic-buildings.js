/* ============================================================
   SLIDE6-SEISMIC-BUILDINGS.JS — Earthquake Shake Table &
   Selective Resonance of Buildings of Different Heights (N = 3, 10, 20)
   ============================================================ */

(function () {
  'use strict';

  class SeismicBuildingsSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // --- Ground Motion (Seismic Excitation) ---
      this.fSeism = config.fSeism || 1.00; // Dominant seismic frequency (Hz)
      this.pga = config.pga || 0.35; // Peak Ground Acceleration scale (in g, 0.05 to 0.80)
      this.zeta = config.zeta || 0.05; // Structural damping ratio (5% standard reinforced concrete)
      this.baseIsolated = false; // Base Isolation (LRB elastomeric bearings)

      // Auto-sweep across seismic frequencies
      this.sweeping = false;
      this.sweepDir = 1;

      // Ground state
      this.xg = 0; // Ground horizontal displacement (px visual)
      this.vg = 0;
      this.ag = 0;

      // --- 3 Buildings on Shake Table (T_0 ≈ 0.1 * N seconds => f_0 ≈ 10 / N Hz) ---
      this.buildings = [
        {
          id: 'low',
          name: 'Clădire Joasă (3 Etaje)',
          shortName: '3 Etaje (Joasă)',
          floors: 3,
          T0: 0.30,
          f0: 3.33, // Hz
          color: '#38bdf8',
          u: 0, // Relative roof displacement
          v: 0,
          a: 0,
          peakDrift: 0,
          damaged: false,
          cracks: []
        },
        {
          id: 'med',
          name: 'Clădire Medie (10 Etaje)',
          shortName: '10 Etaje (Medie)',
          floors: 10,
          T0: 1.00,
          f0: 1.00, // Hz
          color: '#fbbf24',
          u: 0,
          v: 0,
          a: 0,
          peakDrift: 0,
          damaged: false,
          cracks: []
        },
        {
          id: 'high',
          name: 'Zgârie-Nori (20 Etaje)',
          shortName: '20 Etaje (Înaltă)',
          floors: 20,
          T0: 2.00,
          f0: 0.50, // Hz
          color: '#c084fc',
          u: 0,
          v: 0,
          a: 0,
          peakDrift: 0,
          damaged: false,
          cracks: []
        }
      ];

      // Seismograph history buffer
      this.history = [];
      this.historyMax = 220;

      // Mouse interaction
      this.draggedBuilding = null;
      this.isTuningSpectrum = false;
      this.spectrumRect = null;

      this._bindEvents();
    }

    onInit() {
      const fSlider = document.getElementById('sim6-freq');
      const fVal = document.getElementById('sim6-freq-val');
      const pgaSlider = document.getElementById('sim6-pga');
      const pgaVal = document.getElementById('sim6-pga-val');
      const zetaSlider = document.getElementById('sim6-zeta');
      const zetaVal = document.getElementById('sim6-zeta-val');

      const btnHighF = document.getElementById('sim6-preset-3fl');
      const btnVrancea = document.getElementById('sim6-preset-10fl');
      const btnMexico = document.getElementById('sim6-preset-20fl');
      const btnSweep = document.getElementById('sim6-preset-sweep');
      const btnIso = document.getElementById('sim6-preset-iso');

      const playBtn = document.getElementById('sim6-play');
      const resetBtn = document.getElementById('sim6-reset');

      if (fSlider) {
        fSlider.value = this.fSeism;
        fSlider.addEventListener('input', (e) => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setFrequency(parseFloat(e.target.value));
        });
      }

      if (pgaSlider) {
        pgaSlider.value = this.pga;
        pgaSlider.addEventListener('input', (e) => {
          this.pga = parseFloat(e.target.value);
          if (pgaVal) pgaVal.textContent = `${this.pga.toFixed(2)} g`;
          this.requestRender();
        });
      }

      if (zetaSlider) {
        zetaSlider.value = (this.zeta * 100).toFixed(1);
        zetaSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.zeta = val / 100;
          if (zetaVal) zetaVal.textContent = `ζ = ${val.toFixed(1)}%`;
          this.requestRender();
        });
      }

      if (btnHighF) {
        btnHighF.addEventListener('click', () => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setFrequency(3.33);
          if (!this.running) this.start();
        });
      }

      if (btnVrancea) {
        btnVrancea.addEventListener('click', () => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setFrequency(1.00);
          if (!this.running) this.start();
        });
      }

      if (btnMexico) {
        btnMexico.addEventListener('click', () => {
          this.sweeping = false;
          if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
          this.setFrequency(0.50);
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

      if (btnIso) {
        btnIso.addEventListener('click', () => {
          this.baseIsolated = !this.baseIsolated;
          btnIso.classList.toggle('sim-btn--preset', this.baseIsolated);
          btnIso.textContent = this.baseIsolated
            ? '🛡️ Izolare la Bază: ACTIVĂ'
            : '🛡️ Izolare la Bază (LRB)';
          if (this.baseIsolated) {
            // Heal structural damage indicators when retrofitted
            for (const b of this.buildings) {
              b.damaged = false;
            }
          }
          this._updateUIBadges();
          this.requestRender();
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

    setFrequency(f) {
      this.fSeism = Math.max(0.20, Math.min(4.20, f));
      const fSlider = document.getElementById('sim6-freq');
      const fVal = document.getElementById('sim6-freq-val');
      if (fSlider) fSlider.value = this.fSeism;
      if (fVal) {
        const T = (1 / this.fSeism).toFixed(2);
        fVal.textContent = `${this.fSeism.toFixed(2)} Hz (T=${T}s)`;
      }
      this._updateUIBadges();
      this.requestRender();
    }

    requestRender() {
      if (!this.running) {
        this.render();
      }
    }

    onReset() {
      this.xg = 0;
      this.vg = 0;
      this.ag = 0;
      this.sweeping = false;
      this.baseIsolated = false;
      this.history = [];
      for (const b of this.buildings) {
        b.u = 0;
        b.v = 0;
        b.a = 0;
        b.peakDrift = 0;
        b.damaged = false;
      }
      const btnIso = document.getElementById('sim6-preset-iso');
      if (btnIso) {
        btnIso.classList.remove('sim-btn--preset');
        btnIso.textContent = '🛡️ Izolare la Bază (LRB)';
      }
      const btnSweep = document.getElementById('sim6-preset-sweep');
      if (btnSweep) btnSweep.classList.remove('sim-btn--preset');
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
        // Check if clicking in spectrum plot to tune frequency
        if (this.spectrumRect &&
            pos.x >= this.spectrumRect.x && pos.x <= this.spectrumRect.x + this.spectrumRect.w &&
            pos.y >= this.spectrumRect.y && pos.y <= this.spectrumRect.y + this.spectrumRect.h) {
          this.isTuningSpectrum = true;
          this.sweeping = false;
          const ratio = (pos.x - this.spectrumRect.x) / this.spectrumRect.w;
          this.setFrequency(0.20 + ratio * 4.00);
          return;
        }

        // Check if dragging a building roof
        if (this._buildingHitBoxes) {
          for (const box of this._buildingHitBoxes) {
            if (pos.x >= box.x - 35 && pos.x <= box.x + 35 &&
                pos.y >= box.topY - 15 && pos.y <= box.baseY) {
              this.draggedBuilding = box.building;
              this.dragAnchorX = box.baseX;
              break;
            }
          }
        }
      };

      const onMove = (e) => {
        const pos = getPos(e);
        if (this.isTuningSpectrum && this.spectrumRect) {
          const ratio = Math.max(0, Math.min(1, (pos.x - this.spectrumRect.x) / this.spectrumRect.w));
          this.setFrequency(0.20 + ratio * 4.00);
          return;
        }

        if (this.draggedBuilding) {
          const dx = pos.x - this.dragAnchorX;
          this.draggedBuilding.u = Math.max(-65, Math.min(65, dx));
          this.draggedBuilding.v = 0;
          this.requestRender();
        }
      };

      const onEnd = () => {
        this.isTuningSpectrum = false;
        this.draggedBuilding = null;
      };

      this.canvas.addEventListener('mousedown', onStart);
      this.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      this.canvas.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
    }

    /** Theoretical dynamic amplification factor for relative roof response */
    _transmissibility(f, f0, zeta) {
      const effectiveF0 = this.baseIsolated ? Math.min(f0, 0.24) : f0;
      const effectiveZeta = this.baseIsolated ? Math.max(zeta, 0.25) : zeta;
      const r = f / (effectiveF0 + 1e-9);
      const num = r * r;
      const den = Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(2 * effectiveZeta * r, 2));
      // When base-isolated, the isolator absorbs relative deformation so superstructure drift is tiny
      const isoFactor = this.baseIsolated ? 0.18 : 1.0;
      return (num / (den + 1e-9)) * isoFactor;
    }

    update(dt) {
      if (this.sweeping) {
        this.fSeism += this.sweepDir * 0.42 * dt;
        if (this.fSeism >= 4.0) {
          this.fSeism = 4.0;
          this.sweepDir = -1;
        } else if (this.fSeism <= 0.25) {
          this.fSeism = 0.25;
          this.sweepDir = 1;
        }
        this.setFrequency(this.fSeism);
      }

      const subSteps = 4;
      const subDt = Math.min(dt, 0.033) / subSteps;

      for (let s = 0; s < subSteps; s++) {
        this._physicsStep(subDt);
      }

      // Record history for seismograph
      this.history.push({
        xg: this.xg,
        u0: this.buildings[0].u,
        u1: this.buildings[1].u,
        u2: this.buildings[2].u
      });
      if (this.history.length > this.historyMax) {
        this.history.shift();
      }

      this._updateUIBadges();
    }

    _physicsStep(dt) {
      const omega = 2 * Math.PI * this.fSeism;
      // Visual ground displacement amplitude (scaled so Shake Table movement is clear at all frequencies)
      const groundAmpPx = 14 * (this.pga / 0.35);
      this.xg = groundAmpPx * Math.sin(omega * this.time);
      this.vg = groundAmpPx * omega * Math.cos(omega * this.time);

      // Effective driving force on relative building coordinates
      // To keep resonance peaks realistic across 0.5 Hz, 1.0 Hz, and 3.33 Hz:
      // At resonance (omega = omega0), steady-state amplitude U_max = F_eff / (2 * zeta * omega0^2)
      // Setting F_eff = omega0 * omega * baseScale gives U_max = baseScale / (2 * zeta) at omega = omega0 for ALL buildings!
      const baseExcitationScale = 5.2 * (this.pga / 0.35);

      for (const b of this.buildings) {
        if (this.draggedBuilding === b) continue;

        const f0Eff = this.baseIsolated ? 0.24 : b.f0;
        const zetaEff = this.baseIsolated ? Math.max(this.zeta, 0.26) : this.zeta;
        const isoAttenuation = this.baseIsolated ? 0.22 : 1.0;

        const omega0 = 2 * Math.PI * f0Eff;
        const omega0Sq = omega0 * omega0;
        const driveTerm = -baseExcitationScale * isoAttenuation * omega0 * omega * Math.sin(omega * this.time);

        // Non-linear hardening to prevent infinite blowup at ultra-low damping
        const nonLin = 1 + 0.00025 * b.u * b.u;
        const accel = driveTerm - 2 * zetaEff * omega0 * b.v - omega0Sq * nonLin * b.u;

        b.v += accel * dt;
        b.u += b.v * dt;
        b.u = Math.max(-72, Math.min(72, b.u));
        b.a = accel;

        // Inter-story drift ratio (%) metric
        const driftPct = (Math.abs(b.u) / 38) * 2.5;
        if (driftPct > b.peakDrift) b.peakDrift = driftPct;
        if (driftPct > 2.2 && !this.baseIsolated) {
          b.damaged = true;
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

      const topH = Math.max(80, Math.round(H * 0.58));
      const botH = Math.max(60, H - topH);

      this._renderShakeTableAndBuildings(ctx, 0, 0, W, topH);
      this._renderTelemetryPanels(ctx, 0, topH, W, botH);
    }

    _renderShakeTableAndBuildings(ctx, x0, y0, w, h) {
      // 1. Sky / Lab Background
      const skyGrad = ctx.createLinearGradient(x0, y0, x0, y0 + h);
      skyGrad.addColorStop(0, '#070d19');
      skyGrad.addColorStop(0.75, '#0f172a');
      skyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(x0, y0, w, h);

      // Subtle background grid
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.22)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < w; gx += 45) {
        ctx.beginPath();
        ctx.moveTo(gx, y0);
        ctx.lineTo(gx, y0 + h);
        ctx.stroke();
      }
      for (let gy = 30; gy < h; gy += 35) {
        ctx.beginPath();
        ctx.moveTo(x0, gy);
        ctx.lineTo(x0 + w, gy);
        ctx.stroke();
      }

      // 2. Geological Subsurface & Shake Table Geometry
      const tableY = y0 + h - 38;
      const tableW = Math.max(140, Math.min(w - 60, 680));
      const tableXBase = x0 + Math.max(10, (w - tableW) * 0.5 + 16);
      const tableX = tableXBase + this.xg;

      // Subsurface soil strata with propagating S-wave ripples
      ctx.fillStyle = '#090f1d';
      ctx.fillRect(x0, tableY + 14, w, Math.max(10, h - (tableY - y0) - 14));

      // Propagating seismic wave rings in ground
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)';
      ctx.lineWidth = 1.5;
      for (let r = 0; r < 4; r++) {
        const wavePhase = ((this.time * this.fSeism * 80) + r * 45) % 180;
        ctx.beginPath();
        ctx.arc(x0 + w * 0.5, tableY + 35, wavePhase * 2.2, Math.PI, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();

      // Hydraulic Actuator on Left Wall
      const wallX = x0 + 14;
      ctx.fillStyle = '#334155';
      ctx.fillRect(wallX, tableY - 10, 12, 28);
      // Cylinder
      ctx.fillStyle = '#475569';
      ctx.fillRect(wallX + 12, tableY - 4, Math.max(16, (tableX - wallX - 30) * 0.55), 16);
      // Piston rod connected to Shake Table
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(wallX + 20, tableY + 4);
      ctx.lineTo(tableX, tableY + 4);
      ctx.stroke();

      // Shake Table Rollers
      const numRollers = 6;
      for (let i = 0; i < numRollers; i++) {
        const rx = tableXBase + (i + 0.5) * (tableW / numRollers) + this.xg * 0.5;
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(rx, tableY + 18, 5, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Shake Table Platform Slab
      const slabGrad = ctx.createLinearGradient(tableX, tableY, tableX, tableY + 14);
      slabGrad.addColorStop(0, '#64748b');
      slabGrad.addColorStop(1, '#334155');
      ctx.fillStyle = slabGrad;
      ctx.fillRect(tableX, tableY, tableW, 13);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tableX, tableY, tableW, 13);

      // Platform motion arrows & label
      ctx.font = '700 10px Inter, monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(
        `PLATFORMĂ SEISMICĂ: f = ${this.fSeism.toFixed(2)} Hz (T = ${(1 / this.fSeism).toFixed(2)} s) | a_max = ${this.pga.toFixed(2)}g`,
        tableX + tableW * 0.5,
        tableY + 32
      );

      // 3. Render the 3 Buildings on the Shake Table
      const maxAvailH = Math.max(60, tableY - (y0 + 44));
      const heights = [
        Math.max(25, Math.round(maxAvailH * 0.26)), // 3 floors
        Math.max(50, Math.round(maxAvailH * 0.56)), // 10 floors
        Math.max(75, Math.round(maxAvailH * 0.94))  // 20 floors
      ];
      const widths = [
        Math.max(30, Math.min(68, tableW * 0.14)),
        Math.max(34, Math.min(72, tableW * 0.15)),
        Math.max(38, Math.min(76, tableW * 0.16))
      ];
      const xPositions = [
        tableX + tableW * 0.19,
        tableX + tableW * 0.50,
        tableX + tableW * 0.81
      ];

      this._buildingHitBoxes = [];

      for (let i = 0; i < 3; i++) {
        const b = this.buildings[i];
        const bW = widths[i];
        const bH = heights[i];
        const baseCenterX = xPositions[i];
        const baseY = tableY;

        this._renderSingleBuilding(ctx, b, baseCenterX, baseY, bW, bH);

        this._buildingHitBoxes.push({
          building: b,
          baseX: baseCenterX,
          x: baseCenterX + b.u,
          topY: baseY - bH,
          baseY: baseY
        });
      }
    }

    _renderSingleBuilding(ctx, b, baseCenterX, baseY, bW, bH) {
      const floors = b.floors;
      const uTop = b.u;
      const absU = Math.abs(uTop);
      const isResonant = Math.abs(this.fSeism - b.f0) / b.f0 < 0.22 && !this.baseIsolated;

      // Base Isolator Bearing (if active)
      let structBaseY = baseY;
      let structBaseX = baseCenterX;

      if (this.baseIsolated) {
        const isoH = 12;
        structBaseY = baseY - isoH;
        // When isolated, the building stays nearly still in absolute space while the ground moves under it!
        structBaseX = baseCenterX - this.xg * 0.78;

        // Draw Left & Right LRB Elastomeric Bearings (layered rubber + steel + lead core)
        for (const side of [-0.36, 0.36]) {
          const bx = baseCenterX + side * bW;
          const tx = structBaseX + side * bW;
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(bx, baseY);
          ctx.lineTo(tx, structBaseY);
          ctx.stroke();

          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - 5, (baseY + structBaseY) * 0.5);
          ctx.lineTo(tx + 5, (baseY + structBaseY) * 0.5);
          ctx.stroke();
        }
      }

      // Draw Resonant Warning Aura behind building if in strong resonance
      if (absU > 22 || isResonant) {
        ctx.save();
        ctx.strokeStyle = absU > 35 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(251, 191, 36, 0.35)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        for (let s = 0; s <= floors; s++) {
          const frac = s / floors;
          const shape = 1 - Math.cos((Math.PI * frac) * 0.5);
          const cx = structBaseX + uTop * shape;
          const cy = structBaseY - frac * bH;
          if (s === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw each story (columns + floor slabs + windows)
      for (let f = 0; f < floors; f++) {
        const frac0 = f / floors;
        const frac1 = (f + 1) / floors;

        // Fundamental cantilever bending mode shape: phi(y) = 1 - cos(pi * y / (2H))
        const shape0 = 1 - Math.cos(Math.PI * frac0 * 0.5);
        const shape1 = 1 - Math.cos(Math.PI * frac1 * 0.5);

        const cx0 = structBaseX + uTop * shape0;
        const cy0 = structBaseY - frac0 * bH;
        const cx1 = structBaseX + uTop * shape1;
        const cy1 = structBaseY - frac1 * bH;

        // Story background fill
        ctx.beginPath();
        ctx.moveTo(cx0 - bW * 0.5, cy0);
        ctx.lineTo(cx1 - bW * 0.5, cy1);
        ctx.lineTo(cx1 + bW * 0.5, cy1);
        ctx.lineTo(cx0 + bW * 0.5, cy0);
        ctx.closePath();

        // Stress color shift based on inter-story drift
        let fillAlpha = 0.25;
        if (absU > 34) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
        } else if (absU > 20) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
        } else {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.78)';
        }
        ctx.fill();

        // Structural Columns (Left, Center, Right)
        const colColor = absU > 34 ? '#ef4444' : b.color;
        ctx.strokeStyle = colColor;
        ctx.lineWidth = 2.2;

        // Left column
        ctx.beginPath();
        ctx.moveTo(cx0 - bW * 0.5, cy0);
        ctx.lineTo(cx1 - bW * 0.5, cy1);
        ctx.stroke();

        // Right column
        ctx.beginPath();
        ctx.moveTo(cx0 + bW * 0.5, cy0);
        ctx.lineTo(cx1 + bW * 0.5, cy1);
        ctx.stroke();

        // Floor Slab at top of story
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = f === floors - 1 ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(cx1 - bW * 0.5, cy1);
        ctx.lineTo(cx1 + bW * 0.5, cy1);
        ctx.stroke();

        // Illuminated Windows (if story height >= 7 px)
        const storyH = cy0 - cy1;
        if (storyH >= 7) {
          const winY = (cy0 + cy1) * 0.5 - 1.5;
          const winX = (cx0 + cx1) * 0.5;
          ctx.fillStyle = absU > 34 ? 'rgba(254, 202, 202, 0.85)' : 'rgba(253, 224, 71, 0.55)';
          for (const wOffset of [-0.28, 0, 0.28]) {
            ctx.fillRect(winX + wOffset * bW - 3, winY, 6, Math.min(5, storyH * 0.45));
          }
        }

        // Diagonal X-cracks on lower/mid floors if damaged
        if (b.damaged && f < Math.ceil(floors * 0.5)) {
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cx0 - bW * 0.3, cy0 - 1);
          ctx.lineTo(cx1 + bW * 0.3, cy1 + 1);
          ctx.moveTo(cx0 + bW * 0.3, cy0 - 1);
          ctx.lineTo(cx1 - bW * 0.3, cy1 + 1);
          ctx.stroke();
        }
      }

      // Roof Header & Telemetry Tag
      const roofX = structBaseX + uTop;
      const roofY = structBaseY - bH;

      // Roof Accelerometer Sensor Node
      ctx.fillStyle = absU > 34 ? '#ef4444' : b.color;
      ctx.beginPath();
      ctx.arc(roofX, roofY - 5, 4.5, 0, 2 * Math.PI);
      ctx.fill();

      // Label above roof
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = absU > 34 ? '#f87171' : b.color;
      ctx.fillText(`${b.floors} Etaje (f₀ = ${b.f0.toFixed(2)} Hz)`, roofX, roofY - 22);

      ctx.font = '600 9.5px Inter, monospace';
      ctx.fillStyle = absU > 34 ? '#fca5a5' : '#cbd5e1';
      const statusTag = absU > 32
        ? '⚠️ REZONANȚĂ!'
        : (this.baseIsolated ? '🛡️ IZOLAT' : `T₀ = ${b.T0.toFixed(1)}s`);
      ctx.fillText(statusTag, roofX, roofY - 11);
    }

    _renderTelemetryPanels(ctx, x, y, w, h) {
      const leftW = Math.round(w * 0.55);
      const rightW = w - leftW;

      this._renderSpectrumPanel(ctx, x, y, leftW, h);
      this._renderDriftAndSeismographPanel(ctx, x + leftW, y, rightW, h);
    }

    _renderSpectrumPanel(ctx, x, y, w, h) {
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
      ctx.fillText('SPECTRU DE RĂSPUNS SEISMIC (Click pe grafic pentru a schimba f)', cardX + 10, cardY + 15);

      const plotX = cardX + 34;
      const plotY = cardY + 24;
      const plotW = Math.max(50, cardW - 46);
      const plotH = Math.max(30, cardH - 44);

      this.spectrumRect = { x: plotX, y: plotY, w: plotW, h: plotH };

      // Frequency domain: 0.20 Hz to 4.20 Hz
      const fMin = 0.20;
      const fMax = 4.20;
      const maxAmp = 10.5;

      // Grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      const fTicks = [0.5, 1.0, 2.0, 3.0, 3.33, 4.0];
      ctx.font = '500 9px Inter, monospace';
      ctx.textAlign = 'center';

      for (const ft of fTicks) {
        const tx = plotX + ((ft - fMin) / (fMax - fMin)) * plotW;
        ctx.beginPath();
        ctx.moveTo(tx, plotY);
        ctx.lineTo(tx, plotY + plotH);
        ctx.stroke();

        ctx.fillStyle = (ft === 0.5 || ft === 1.0 || ft === 3.33) ? '#e2e8f0' : '#64748b';
        ctx.fillText(`${ft}Hz`, tx, plotY + plotH + 12);
      }

      // Draw response curve for each of the 3 buildings
      for (const b of this.buildings) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(plotX, plotY, plotW, plotH);
        ctx.clip();

        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2.0;
        const steps = 140;
        for (let i = 0; i <= steps; i++) {
          const f = fMin + (i / steps) * (fMax - fMin);
          const amp = Math.min(maxAmp, this._transmissibility(f, b.f0, this.zeta));
          const px = plotX + (i / steps) * plotW;
          const py = plotY + plotH - (amp / maxAmp) * plotH;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Draw current operating dot on curve
        const curAmp = Math.min(maxAmp, this._transmissibility(this.fSeism, b.f0, this.zeta));
        const dotX = plotX + ((this.fSeism - fMin) / (fMax - fMin)) * plotW;
        const dotY = plotY + plotH - (curAmp / maxAmp) * plotH;

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Current seismic frequency vertical cursor line
      const curX = plotX + ((this.fSeism - fMin) / (fMax - fMin)) * plotW;
      ctx.save();
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(curX, plotY);
      ctx.lineTo(curX, plotY + plotH);
      ctx.stroke();
      ctx.restore();
    }

    _renderDriftAndSeismographPanel(ctx, x, y, w, h) {
      const pad = 10;
      const cardX = x + pad;
      const cardY = y + pad;
      const cardW = w - pad * 2;
      const cardH = h - pad * 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('DRIFT INTER-ETAJ & DEPLASARE VÂRF |u(t)|', cardX + 10, cardY + 15);

      const barStartX = cardX + 115;
      const barMaxW = Math.max(40, cardW - 175);
      const rowH = Math.max(14, Math.min(26, (cardH - 32) / 3));

      for (let i = 0; i < 3; i++) {
        const b = this.buildings[i];
        const ry = cardY + 26 + i * rowH;

        // Building label
        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillStyle = b.color;
        ctx.textAlign = 'left';
        ctx.fillText(b.shortName, cardX + 10, ry + 11);

        // Bar track
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.fillRect(barStartX, ry + 2, barMaxW, 11);

        // Live amplitude fill
        const frac = Math.min(1.0, Math.abs(b.u) / 55);
        ctx.fillStyle = frac > 0.62 ? '#ef4444' : b.color;
        ctx.fillRect(barStartX, ry + 2, barMaxW * frac, 11);

        // Danger threshold tick on bar
        const critX = barStartX + barMaxW * 0.62;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(critX, ry);
        ctx.lineTo(critX, ry + 15);
        ctx.stroke();

        // Numeric readout
        const cmVal = Math.round(Math.abs(b.u) * 1.2);
        ctx.font = '600 9.5px Inter, monospace';
        ctx.fillStyle = frac > 0.62 ? '#f87171' : '#cbd5e1';
        ctx.textAlign = 'right';
        ctx.fillText(`${cmVal} cm`, cardX + cardW - 10, ry + 11);
      }

      // Bottom status note inside card
      const bottomY = cardY + cardH - 10;
      ctx.font = '600 9.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      if (this.baseIsolated) {
        ctx.fillStyle = '#34d399';
        ctx.fillText('🛡️ Izolare Seismică LRB Activă: Perioada decalată la T ≈ 4.1 s (Toate clădirile sigure)', cardX + 10, bottomY);
      } else {
        // Find which building is closest to resonance
        let activeRes = 'Niciuna în vârful critic';
        let resColor = '#94a3b8';
        for (const b of this.buildings) {
          if (Math.abs(this.fSeism - b.f0) / b.f0 < 0.22) {
            activeRes = `⚠️ Rezonanță pe ${b.name} (f ≈ ${b.f0} Hz)`;
            resColor = '#f87171';
          }
        }
        ctx.fillStyle = resColor;
        ctx.fillText(activeRes, cardX + 10, bottomY);
      }
    }

    _updateUIBadges() {
      const fVal = document.getElementById('sim6-freq-val');
      if (fVal) {
        fVal.textContent = `${this.fSeism.toFixed(2)} Hz (T=${(1 / this.fSeism).toFixed(2)}s)`;
      }

      const tBadge = document.getElementById('sim6-period-badge');
      const resBadge = document.getElementById('sim6-res-badge');

      if (tBadge) {
        tBadge.textContent = `T_seism = ${(1 / this.fSeism).toFixed(2)} s`;
      }

      if (resBadge) {
        if (this.baseIsolated) {
          resBadge.textContent = '🛡️ Izolare la Bază Activă';
          resBadge.className = 'sim-badge sim-badge--cyan';
        } else if (Math.abs(this.fSeism - 3.33) < 0.55) {
          resBadge.textContent = '⚠️ Rezonanță: 3 Etaje (Joasă)';
          resBadge.className = 'sim-badge sim-badge--danger';
        } else if (Math.abs(this.fSeism - 1.00) < 0.22) {
          resBadge.textContent = '⚠️ Rezonanță: 10 Etaje (Vrancea 1977)';
          resBadge.className = 'sim-badge sim-badge--danger';
        } else if (Math.abs(this.fSeism - 0.50) < 0.14) {
          resBadge.textContent = '⚠️ Rezonanță: 20 Etaje (Mexico 1985)';
          resBadge.className = 'sim-badge sim-badge--danger';
        } else {
          resBadge.textContent = 'Regim Nerezonant';
          resBadge.className = 'sim-badge sim-badge--amber';
        }
      }
    }
  }

  window.SeismicBuildingsSim = SeismicBuildingsSim;
})();
