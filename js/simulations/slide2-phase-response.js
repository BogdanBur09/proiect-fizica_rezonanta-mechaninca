/* ============================================================
   SLIDE2-PHASE-RESPONSE.JS — Interactive Fresnel Phasors,
   Bode Plots (Amplitude + Phase δ) & Instantaneous Power P(t)
   ============================================================ */

(function () {
  'use strict';

  class PhaseResponseSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // System parameters
      this.m = 1.0;
      this.omega0 = config.omega0 || 4.0;
      this.gamma = config.gamma || 0.35;
      this.F0 = config.F0 || 2.0;
      this.omega = config.omega || 4.0;

      // Display toggles
      this.showForcePolygon = true;
      this.showVelocityPhasor = true;
      this.showPowerCurve = true;

      // Interactive tuning state
      this.isTuning = false;

      this._updateDerived();
      this._computeCurves();
    }

    _updateDerived() {
      this.k = this.m * this.omega0 * this.omega0;
      this.b = 2 * this.m * this.gamma;
      this.zeta = this.gamma / (this.omega0 + 1e-12);
      this.Q = this.omega0 / (2 * this.gamma + 1e-12);

      // Exact amplitude resonance frequency
      const disc = this.omega0 * this.omega0 - 2 * this.gamma * this.gamma;
      this.omegaR = disc > 0 ? Math.sqrt(disc) : 0;

      // Current amplitude, phase, velocity, power
      this.A = this._calcAmplitude(this.omega);
      this.delta = this._calcPhase(this.omega);
      this.deltaDeg = (this.delta * 180) / Math.PI;
      this.vMax = this.omega * this.A;
      this.meanPower = 0.5 * this.F0 * this.vMax * Math.sin(this.delta);

      // Force components at current omega
      this.F_elastic = this.k * this.A;
      this.F_inertial = this.m * this.omega * this.omega * this.A;
      this.F_reactive = (this.k - this.m * this.omega * this.omega) * this.A;
      this.F_damping = this.b * this.omega * this.A;
    }

    _calcAmplitude(w) {
      const d1 = this.omega0 * this.omega0 - w * w;
      const d2 = 2 * this.gamma * w;
      return (this.F0 / this.m) / Math.sqrt(d1 * d1 + d2 * d2 + 1e-12);
    }

    _calcPhase(w) {
      let d = Math.atan2(2 * this.gamma * w, this.omega0 * this.omega0 - w * w);
      if (d < 0) d += Math.PI;
      return d;
    }

    _calcMeanPower(w) {
      const A = this._calcAmplitude(w);
      const d = this._calcPhase(w);
      return 0.5 * this.F0 * w * A * Math.sin(d);
    }

    _computeCurves() {
      this.curveData = [];
      const steps = 200;
      const maxW = this.omega0 * 2.5;

      for (let i = 0; i <= steps; i++) {
        const w = (i / steps) * maxW;
        this.curveData.push({
          omega: w,
          A: this._calcAmplitude(w),
          deltaDeg: (this._calcPhase(w) * 180) / Math.PI,
          P: this._calcMeanPower(w)
        });
      }
    }

    onInit() {
      this.time = 0;
      this._bindControls();
      this._bindMouse();
      this.start();
    }

    onReset() {
      this.time = 0;
    }

    _bindControls() {
      const wSlider = document.getElementById('sim2-omega');
      const wVal = document.getElementById('sim2-omega-val');
      if (wSlider) {
        wSlider.addEventListener('input', () => {
          this._setOmega(parseFloat(wSlider.value));
        });
      }

      const gSlider = document.getElementById('sim2-gamma');
      const gVal = document.getElementById('sim2-gamma-val');
      if (gSlider) {
        gSlider.addEventListener('input', () => {
          this.gamma = parseFloat(gSlider.value);
          if (gVal) gVal.textContent = this.gamma.toFixed(2) + ' s⁻¹';
          this._updateDerived();
          this._computeCurves();
          this._updateBadges();
        });
      }

      const w0Slider = document.getElementById('sim2-omega0');
      const w0Val = document.getElementById('sim2-omega0-val');
      if (w0Slider) {
        w0Slider.addEventListener('input', () => {
          this.omega0 = parseFloat(w0Slider.value);
          if (w0Val) w0Val.textContent = this.omega0.toFixed(1) + ' rad/s';
          this._updateDerived();
          this._computeCurves();
          this._updateBadges();
        });
      }

      // Presets
      const bindPreset = (id, fn) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', fn);
      };

      bindPreset('sim2-preset-elastic', () => {
        this._setOmega(this.omega0 * 0.35);
      });

      bindPreset('sim2-preset-res', () => {
        this._setOmega(this.omega0);
      });

      bindPreset('sim2-preset-ampres', () => {
        if (this.omegaR > 0.2) this._setOmega(this.omegaR);
        else this._setOmega(this.omega0);
      });

      bindPreset('sim2-preset-inertial', () => {
        this._setOmega(this.omega0 * 1.85);
      });

      bindPreset('sim2-toggle-poly', () => {
        this.showForcePolygon = !this.showForcePolygon;
        const btn = document.getElementById('sim2-toggle-poly');
        if (btn) btn.classList.toggle('sim-btn--primary', this.showForcePolygon);
      });

      // Play / Reset
      const playBtn = document.getElementById('sim2-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          playBtn.innerHTML = this.running ? '⏸ Pauză' : '▶ Pornit';
        });
      }

      const resetBtn = document.getElementById('sim2-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.omega0 = 4.0;
          this.gamma = 0.35;
          const gS = document.getElementById('sim2-gamma');
          const gV = document.getElementById('sim2-gamma-val');
          const w0S = document.getElementById('sim2-omega0');
          const w0V = document.getElementById('sim2-omega0-val');
          if (gS) gS.value = 0.35;
          if (gV) gV.textContent = '0.35 s⁻¹';
          if (w0S) w0S.value = 4.0;
          if (w0V) w0V.textContent = '4.0 rad/s';
          this._setOmega(4.0);
          this.reset();
          this.start();
          if (playBtn) playBtn.innerHTML = '⏸ Pauză';
        });
      }

      this._updateBadges();
    }

    _setOmega(w) {
      this.omega = Math.max(0.2, Math.min(12.0, w));
      const wSlider = document.getElementById('sim2-omega');
      const wVal = document.getElementById('sim2-omega-val');
      if (wSlider) wSlider.value = this.omega.toFixed(2);
      if (wVal) wVal.textContent = this.omega.toFixed(2) + ' rad/s';
      this._updateDerived();
      this._computeCurves();
      this._updateBadges();
    }

    _updateBadges() {
      const dBadge = document.getElementById('sim2-delta-badge');
      if (dBadge) dBadge.textContent = `δ = ${this.deltaDeg.toFixed(1)}°`;
      const pBadge = document.getElementById('sim2-power-badge');
      if (pBadge) pBadge.textContent = `⟨P⟩ = ${this.meanPower.toFixed(2)} W`;
    }

    _bindMouse() {
      if (!this.canvas) return;

      const handlePointer = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Right panel Bode plots area
        const rightX = this.W * 0.48;
        const rightW = this.W * 0.50;
        const plotX = rightX + 42;
        const plotW = rightW - 56;

        if (x >= plotX && x <= plotX + plotW && y >= this.H * 0.08 && y <= this.H * 0.96) {
          const maxW = this.omega0 * 2.5;
          const targetW = ((x - plotX) / plotW) * maxW;
          this._setOmega(targetW);
        }
      };

      this.canvas.addEventListener('mousedown', (e) => {
        this.isTuning = true;
        handlePointer(e);
      });
      window.addEventListener('mousemove', (e) => {
        if (this.isTuning) handlePointer(e);
      });
      window.addEventListener('mouseup', () => {
        this.isTuning = false;
      });

      this.canvas.addEventListener('touchstart', (e) => {
        this.isTuning = true;
        handlePointer(e);
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (this.isTuning) handlePointer(e);
      }, { passive: true });
      window.addEventListener('touchend', () => {
        this.isTuning = false;
      });
    }

    update(dt) {
      // Phase rotation evolves with time
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;

      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#070a14');
      bg.addColorStop(0.5, '#0b1022');
      bg.addColorStop(1, '#080d1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Top Status Banner
      this._drawBanner(ctx, W);

      // Left Panel (45% width): Fresnel Phasors + Power Waveforms
      const leftX = W * 0.02;
      const leftW = W * 0.44;
      this._drawPhasorDiagram(ctx, leftX, H * 0.09, leftW, H * 0.48);
      this._drawPowerWaveforms(ctx, leftX, H * 0.59, leftW, H * 0.38);

      // Right Panel (50% width): Synchronized Bode Plots (Amplitude/Power + Phase)
      const rightX = W * 0.48;
      const rightW = W * 0.50;
      this._drawAmplitudePlot(ctx, rightX, H * 0.09, rightW, H * 0.43);
      this._drawPhasePlot(ctx, rightX, H * 0.54, rightW, H * 0.43);
    }

    _drawBanner(ctx, W) {
      const h = this.H < 280 ? 20 : 26;
      let text, color, bg;
      const isRes = Math.abs(this.deltaDeg - 90) < 8;
      const isNarrow = W < 540;

      if (isRes) {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 8);
        color = '#ff5252';
        bg = `rgba(255, 82, 82, ${0.15 + pulse * 0.1})`;
        text = isNarrow
          ? `⚡ REZONANȚĂ FAZĂ | δ = 90° | ⟨P⟩ = ${this.meanPower.toFixed(1)}W`
          : `⚡ REZONANȚĂ DE FAZĂ (δ = ${this.deltaDeg.toFixed(1)}° ≈ 90°) | Forța F₀ în fază cu Viteza v | Putere Maximă ⟨P⟩ = ${this.meanPower.toFixed(2)} W`;
      } else if (this.deltaDeg < 90) {
        color = '#00e5ff';
        bg = 'rgba(0, 229, 255, 0.08)';
        text = isNarrow
          ? `◄ REGIM ELASTIC | δ = ${this.deltaDeg.toFixed(0)}° (kA > mω²A)`
          : `◄ REGIM CONTROLAT DE ELASTICITATE (ω < ω₀) | Defazaj δ = ${this.deltaDeg.toFixed(1)}° | kA > mω²A`;
      } else {
        color = '#b388ff';
        bg = 'rgba(179, 136, 255, 0.08)';
        text = isNarrow
          ? `► REGIM INERȚIAL | δ = ${this.deltaDeg.toFixed(0)}° (mω²A > kA)`
          : `► REGIM CONTROLAT DE INERȚIE (ω > ω₀) | Defazaj δ = ${this.deltaDeg.toFixed(1)}° | mω²A > kA`;
      }

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, h);
      ctx.strokeStyle = color + '40';
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

    _drawPhasorDiagram(ctx, gx, gy, gw, gh) {
      // Card background
      ctx.fillStyle = 'rgba(15, 22, 41, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      const isCompact = gw < 270;

      // Title
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(isCompact ? 'Fazori & Triunghi Forțe' : 'Diagrama Fazorială Fresnel & Triunghiul Forțelor', gx + 10, gy + 14);

      const cx = isCompact ? gx + gw * 0.36 : gx + gw * 0.42;
      const cy = gy + gh * 0.55;
      const maxR = Math.min(gw * (isCompact ? 0.28 : 0.34), gh * 0.36);

      // Coordinate axes & reference circles
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.arc(cx, cy, maxR * 0.6, 0, Math.PI * 2);
      ctx.moveTo(cx - maxR - 8, cy);
      ctx.lineTo(cx + maxR + 8, cy);
      ctx.moveTo(cx, cy - maxR - 8);
      ctx.lineTo(cx, cy + maxR + 8);
      ctx.stroke();

      // Current rotation angles (counter-clockwise in math, so -angle in canvas Y)
      const wt = this.omega * this.time;
      const angF = -wt;
      const angX = -(wt - this.delta);
      const angV = -(wt - this.delta + Math.PI / 2);

      // 1. Force Phasor F₀ (Green)
      const rF = maxR * 0.85;
      const fx = cx + rF * Math.cos(angF);
      const fy = cy + rF * Math.sin(angF);
      this.drawArrow(cx, cy, fx, fy, '#69f0ae', 2.5);

      // 2. Displacement Phasor x (Cyan)
      const maxA = this._calcAmplitude(this.omegaR > 0 ? this.omegaR : this.omega0);
      const normA = Math.min(1.0, Math.max(0.22, this.A / (maxA + 1e-12)));
      const rX = maxR * 0.92 * normA;
      const xx = cx + rX * Math.cos(angX);
      const xy = cy + rX * Math.sin(angX);
      this.drawArrow(cx, cy, xx, xy, '#00e5ff', 2.5);

      // 3. Velocity Phasor v (Magenta, 90° ahead of x)
      if (this.showVelocityPhasor) {
        const rV = maxR * 0.72 * Math.min(1.0, Math.max(0.25, this.vMax / (this.omega0 * maxA + 1e-12)));
        const vx = cx + rV * Math.cos(angV);
        const vy = cy + rV * Math.sin(angV);
        this.drawArrow(cx, cy, vx, vy, '#ff4081', 2);
      }

      // 4. Force Polygon (Right Triangle: Reactive (k - mω²)A + Damping bωA = F₀)
      if (this.showForcePolygon) {
        const scaleF = rF / (this.F0 + 1e-12);
        const rReact = this.F_reactive * scaleF;
        const rx = cx + rReact * Math.cos(angX);
        const ry = cy + rReact * Math.sin(angX);

        ctx.save();
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = '#ffab40aa';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(rx, ry);
        ctx.stroke();

        ctx.strokeStyle = '#ff4081aa';
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        ctx.restore();
      }

      // Phase Angle Arc δ between F₀ and x
      const arcR = maxR * 0.34;
      ctx.save();
      ctx.strokeStyle = '#ffab40';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, angF, angX, false);
      ctx.stroke();

      const midAng = angF + (this.delta * 0.5);
      ctx.fillStyle = '#ffab40';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`δ=${this.deltaDeg.toFixed(0)}°`, cx + (arcR + 10) * Math.cos(midAng), cy + (arcR + 10) * Math.sin(midAng));
      ctx.restore();

      // Legend & Live Values Panel on the Right of Phasor Circle
      const legX = isCompact ? gx + gw * 0.65 : gx + gw * 0.74;
      let legY = gy + 32;
      const lineH = isCompact ? 16 : 18;

      ctx.font = '8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'left';

      const items = [
        { color: '#69f0ae', label: isCompact ? 'F₀' : 'F₀ (Forță)', val: `${this.F0.toFixed(1)}N` },
        { color: '#00e5ff', label: isCompact ? 'x' : 'x (Deplasare)', val: `A=${this.A.toFixed(1)}m` },
        { color: '#ff4081', label: isCompact ? 'v' : 'v (Viteză)', val: `${this.vMax.toFixed(1)}m/s` },
        { color: '#ffab40', label: isCompact ? 'F_react' : '(k-mω²)A', val: `${this.F_reactive.toFixed(1)}N` },
        { color: '#b388ff', label: isCompact ? 'F_frec' : 'bωA', val: `${this.F_damping.toFixed(1)}N` }
      ];

      for (const it of items) {
        ctx.fillStyle = it.color;
        ctx.fillRect(legX - 8, legY - 6, 5, 5);
        ctx.fillText(it.label, legX, legY);
        ctx.fillStyle = '#e8eaf6';
        ctx.fillText(it.val, legX, legY + 9);
        legY += lineH + 8;
      }
    }

    _drawPowerWaveforms(ctx, gx, gy, gw, gh) {
      ctx.fillStyle = 'rgba(15, 22, 41, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      const wTitle = gw < 320 ? 'Putere P(t) = F(t)·v(t)' : (gw < 460 ? 'Puterea Instantanee P(t) = F(t)·v(t)' : 'Puterea Instantanee P(t) = F(t)·v(t) și Alinierea Fază-Viteză');
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(wTitle, gx + 12, gy + 15);

      const padL = 32;
      const padR = 14;
      const plotX = gx + padL;
      const plotW = gw - padL - padR;
      const midY = gy + gh * 0.56;
      const ampH = gh * 0.32;

      // Zero line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(plotX, midY);
      ctx.lineTo(plotX + plotW, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw 2 full periods of (omega*t)
      const samples = 140;
      const phaseNow = this.omega * this.time;

      // 1. Shaded Instantaneous Power P(t) = cos(phi) * (-sin(phi - delta))
      for (let i = 0; i < samples; i++) {
        const phi1 = phaseNow - 4 * Math.PI + (i / samples) * 4 * Math.PI;
        const phi2 = phaseNow - 4 * Math.PI + ((i + 1) / samples) * 4 * Math.PI;

        const f1 = Math.cos(phi1);
        const v1 = -Math.sin(phi1 - this.delta);
        const p1 = f1 * v1; // in [-0.5, 1.0]

        const x1 = plotX + (i / samples) * plotW;
        const x2 = plotX + ((i + 1) / samples) * plotW;
        const y1 = midY - p1 * ampH;

        ctx.fillStyle = p1 >= 0 ? 'rgba(105, 240, 174, 0.22)' : 'rgba(255, 82, 82, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x1, midY);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y1);
        ctx.lineTo(x2, midY);
        ctx.closePath();
        ctx.fill();
      }

      // 2. Force wave F(t) (Green dashed)
      ctx.beginPath();
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      for (let i = 0; i <= samples; i++) {
        const phi = phaseNow - 4 * Math.PI + (i / samples) * 4 * Math.PI;
        const xx = plotX + (i / samples) * plotW;
        const yy = midY - Math.cos(phi) * (ampH * 0.75);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Velocity wave v(t) (Magenta solid)
      ctx.beginPath();
      ctx.strokeStyle = '#ff4081';
      ctx.lineWidth = 1.8;
      for (let i = 0; i <= samples; i++) {
        const phi = phaseNow - 4 * Math.PI + (i / samples) * 4 * Math.PI;
        const xx = plotX + (i / samples) * plotW;
        const yy = midY - (-Math.sin(phi - this.delta)) * (ampH * 0.75);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Legend at bottom
      ctx.font = '8.5px JetBrains Mono, monospace';
      if (gw < 360) {
        ctx.fillStyle = '#69f0ae';
        ctx.fillText('--- F(t)', plotX, gy + gh - 6);
        ctx.fillStyle = '#ff4081';
        ctx.fillText('─── v(t)', plotX + plotW * 0.28, gy + gh - 6);
        ctx.fillStyle = '#69f0ae';
        ctx.fillText('■ P>0', plotX + plotW * 0.54, gy + gh - 6);
        ctx.fillStyle = '#ff5252';
        ctx.fillText('■ P<0', plotX + plotW * 0.78, gy + gh - 6);
      } else {
        const seg = plotW / 4;
        ctx.fillStyle = '#69f0ae';
        ctx.fillText('--- F(t) Forța', plotX, gy + gh - 8);
        ctx.fillStyle = '#ff4081';
        ctx.fillText('─── v(t) Viteza', plotX + seg, gy + gh - 8);
        ctx.fillStyle = '#69f0ae';
        ctx.fillText('■ P(t)>0 (Absorbită)', plotX + seg * 2, gy + gh - 8);
        ctx.fillStyle = '#ff5252';
        ctx.fillText('■ P(t)<0 (Returnată)', plotX + seg * 3, gy + gh - 8);
      }
    }

    _drawAmplitudePlot(ctx, gx, gy, gw, gh) {
      const padL = 42;
      const padR = 14;
      const padT = 22;
      const padB = 24;
      const plotX = gx + padL;
      const plotY = gy + padT;
      const plotW = gw - padL - padR;
      const plotH = gh - padT - padB;

      ctx.fillStyle = 'rgba(15, 22, 41, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      const aTitle = gw < 350 ? 'Curba A(ω) & ⟨P(ω)⟩' : 'Curba de Amplitudine A(ω) & Puterea Medie ⟨P(ω)⟩';
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(aTitle, gx + 12, gy + 15);

      if (gw >= 420) {
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#00e5ffaa';
        ctx.textAlign = 'right';
        ctx.fillText('⚡ Click / Trage pe grafic pentru a schimba ω', gx + gw - 10, gy + 15);
      }

      let maxA = 0;
      let maxP = 0;
      for (const pt of this.curveData) {
        if (pt.A > maxA) maxA = pt.A;
        if (pt.P > maxP) maxP = pt.P;
      }
      maxA = Math.max(maxA, 0.5) * 1.12;
      maxP = Math.max(maxP, 0.5) * 1.15;
      const maxW = this.omega0 * 2.5;

      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 1; i <= 3; i++) {
        const yy = plotY + plotH - (i / 3) * plotH;
        ctx.beginPath();
        ctx.moveTo(plotX, yy);
        ctx.lineTo(plotX + plotW, yy);
        ctx.stroke();
      }

      // ω₀ vertical marker
      const w0X = plotX + (this.omega0 / maxW) * plotW;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 171, 64, 0.6)';
      ctx.beginPath();
      ctx.moveTo(w0X, plotY);
      ctx.lineTo(w0X, plotY + plotH);
      ctx.stroke();

      // ω_r marker (if distinct)
      if (this.omegaR > 0.2) {
        const wrX = plotX + (this.omegaR / maxW) * plotW;
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.beginPath();
        ctx.moveTo(wrX, plotY);
        ctx.lineTo(wrX, plotY + plotH);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Mean Power Curve P(ω) (Magenta/Green dashed)
      if (this.showPowerCurve) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(105, 240, 174, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        for (let i = 0; i < this.curveData.length; i++) {
          const pt = this.curveData[i];
          const xx = plotX + (pt.omega / maxW) * plotW;
          const yy = plotY + plotH - (pt.P / maxP) * plotH;
          if (i === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Amplitude Curve A(ω) (Cyan solid)
      ctx.beginPath();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < this.curveData.length; i++) {
        const pt = this.curveData[i];
        const xx = plotX + (pt.omega / maxW) * plotW;
        const yy = plotY + plotH - (pt.A / maxA) * plotH;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Current ω marker dot
      const curX = plotX + (this.omega / maxW) * plotW;
      const curY = plotY + plotH - (this.A / maxA) * plotH;
      if (curX >= plotX && curX <= plotX + plotW) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(curX, plotY);
        ctx.lineTo(curX, plotY + plotH);
        ctx.stroke();

        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(curX, curY, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Labels
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = '#ffab40';
      ctx.textAlign = 'center';
      ctx.fillText('ω₀', w0X, plotY + 9);
      if (this.omegaR > 0.2 && Math.abs(this.omegaR - this.omega0) > 0.08) {
        const wrX = plotX + (this.omegaR / maxW) * plotW;
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('ωᵣ', wrX - 8, plotY + 9);
      }

      ctx.fillStyle = '#5c5e78';
      ctx.textAlign = 'right';
      ctx.fillText(maxA.toFixed(1) + 'm', plotX - 5, plotY + 8);
      ctx.fillText('0', plotX - 5, plotY + plotH);
    }

    _drawPhasePlot(ctx, gx, gy, gw, gh) {
      const padL = 42;
      const padR = 14;
      const padT = 22;
      const padB = 26;
      const plotX = gx + padL;
      const plotY = gy + padT;
      const plotW = gw - padL - padR;
      const plotH = gh - padT - padB;

      ctx.fillStyle = 'rgba(15, 22, 41, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      const pTitle = gw < 360 ? 'Curba de Fază δ(ω)' : (gw < 500 ? 'Curba de Fază δ(ω) (0° → 90° → 180°)' : 'Curba de Fază δ(ω) — Tranziția 0° → 90° (Rezonanță) → 180°');
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(pTitle, gx + 12, gy + 15);

      const maxW = this.omega0 * 2.5;

      // Horizontal lines at 0°, 45°, 90°, 135°, 180°
      const degLevels = [0, 45, 90, 135, 180];
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'right';

      for (const deg of degLevels) {
        const yy = plotY + plotH - (deg / 180) * plotH;
        ctx.strokeStyle = deg === 90 ? 'rgba(255, 82, 82, 0.4)' : 'rgba(255, 255, 255, 0.06)';
        ctx.setLineDash(deg === 90 ? [4, 3] : []);
        ctx.beginPath();
        ctx.moveTo(plotX, yy);
        ctx.lineTo(plotX + plotW, yy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = deg === 90 ? '#ff5252' : '#5c5e78';
        ctx.fillText(deg + '°', plotX - 5, yy + 3);
      }

      // Vertical line at ω₀
      const w0X = plotX + (this.omega0 / maxW) * plotW;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 171, 64, 0.6)';
      ctx.beginPath();
      ctx.moveTo(w0X, plotY);
      ctx.lineTo(w0X, plotY + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Phase curve δ(ω)
      ctx.beginPath();
      ctx.strokeStyle = '#ffab40';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < this.curveData.length; i++) {
        const pt = this.curveData[i];
        const xx = plotX + (pt.omega / maxW) * plotW;
        const yy = plotY + plotH - (pt.deltaDeg / 180) * plotH;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Current point on phase curve
      const curX = plotX + (this.omega / maxW) * plotW;
      const curY = plotY + plotH - (this.deltaDeg / 180) * plotH;
      if (curX >= plotX && curX <= plotX + plotW) {
        const isRes = Math.abs(this.deltaDeg - 90) < 8;
        const dotColor = isRes ? '#ff5252' : '#ffab40';

        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(curX, curY, 13, 0, Math.PI * 2);
        ctx.fillStyle = isRes ? 'rgba(255, 82, 82, 0.22)' : 'rgba(255, 171, 64, 0.18)';
        ctx.fill();
      }

      // X axis ticks
      ctx.fillStyle = '#5c5e78';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const val = (i / 4) * maxW;
        const xx = plotX + (val / maxW) * plotW;
        ctx.fillText(val.toFixed(1), xx, plotY + plotH + 12);
      }
      ctx.fillText('Pulsație ω (rad/s)', plotX + plotW / 2, plotY + plotH + 22);
    }
  }

  window.PhaseResponseSim = PhaseResponseSim;
})();
