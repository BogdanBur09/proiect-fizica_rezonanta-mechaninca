/* ============================================================
   SLIDE3-QUALITY-FACTOR.JS — 3-Oscillator Q-Factor Laboratory,
   -3dB Bandwidth (Δω) Visualizer & Auto-Frequency Sweep
   ============================================================ */

(function () {
  'use strict';

  class QualityFactorSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      this.omega0 = config.omega0 || 4.0;
      this.omega = config.omega || 4.0;
      this.m = 1.0;
      this.k = this.m * this.omega0 * this.omega0;
      this.Y0 = 0.25; // Shaker amplitude (m)

      // 3 Oscillators with distinct Q factors
      this.oscillators = [
        {
          id: 0,
          name: 'High-Q (Selectiv)',
          color: '#00e5ff',
          Q: config.qHigh || 10.0,
          x: 0,
          v: 0,
          energy: 0
        },
        {
          id: 1,
          name: 'Med-Q (Standard)',
          color: '#ffab40',
          Q: config.qMed || 3.0,
          x: 0,
          v: 0,
          energy: 0
        },
        {
          id: 2,
          name: 'Low-Q (Amortizat)',
          color: '#69f0ae',
          Q: config.qLow || 0.65,
          x: 0,
          v: 0,
          energy: 0
        }
      ];

      this.ys = 0;
      this.vs = 0;

      // Auto-sweep mode
      this.sweeping = false;
      this.sweepDir = 1;

      // Dragging state
      this.draggedOsc = null;
      this.isTuningGraph = false;

      this._computeAllCurves();
    }

    _ampAt(w, Q) {
      const r = w / (this.omega0 + 1e-12);
      const zeta = 1 / (2 * Q + 1e-12);
      const num = 1 + Math.pow(2 * zeta * r, 2);
      const den = Math.pow(1 - r * r, 2) + Math.pow(2 * zeta * r, 2);
      return this.Y0 * Math.sqrt(num / (den + 1e-12));
    }

    _computeAllCurves() {
      const steps = 180;
      const maxW = this.omega0 * 2.4;

      for (const osc of this.oscillators) {
        osc.b = (this.m * this.omega0) / (osc.Q + 1e-12);
        osc.bandwidth = this.omega0 / (osc.Q + 1e-12);
        osc.curve = [];
        osc.maxA = 0;

        for (let i = 0; i <= steps; i++) {
          const w = (i / steps) * maxW;
          const A = this._ampAt(w, osc.Q);
          osc.curve.push({ omega: w, A: A });
          if (A > osc.maxA) osc.maxA = A;
        }
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
      this.sweeping = false;
      const sweepBtn = document.getElementById('sim3-sweep');
      if (sweepBtn) {
        sweepBtn.classList.remove('sim-btn--primary');
        sweepBtn.innerHTML = '🌊 Baleiaj Frecvență (Auto-Sweep)';
      }
      for (const osc of this.oscillators) {
        osc.x = 0;
        osc.v = 0;
        osc.energy = 0;
      }
    }

    _bindControls() {
      const wSlider = document.getElementById('sim3-omega');
      if (wSlider) {
        wSlider.addEventListener('input', () => {
          this.sweeping = false;
          this._setOmega(parseFloat(wSlider.value));
        });
      }

      const q1Slider = document.getElementById('sim3-q1');
      const q1Val = document.getElementById('sim3-q1-val');
      if (q1Slider) {
        q1Slider.addEventListener('input', () => {
          this.oscillators[0].Q = parseFloat(q1Slider.value);
          if (q1Val) q1Val.textContent = 'Q₁ = ' + this.oscillators[0].Q.toFixed(1);
          this._computeAllCurves();
          this._updateBadges();
        });
      }

      const q2Slider = document.getElementById('sim3-q2');
      const q2Val = document.getElementById('sim3-q2-val');
      if (q2Slider) {
        q2Slider.addEventListener('input', () => {
          this.oscillators[1].Q = parseFloat(q2Slider.value);
          if (q2Val) q2Val.textContent = 'Q₂ = ' + this.oscillators[1].Q.toFixed(1);
          this._computeAllCurves();
        });
      }

      const q3Slider = document.getElementById('sim3-q3');
      const q3Val = document.getElementById('sim3-q3-val');
      if (q3Slider) {
        q3Slider.addEventListener('input', () => {
          this.oscillators[2].Q = parseFloat(q3Slider.value);
          if (q3Val) q3Val.textContent = 'Q₃ = ' + this.oscillators[2].Q.toFixed(2);
          this._computeAllCurves();
        });
      }

      // Sweep button
      const sweepBtn = document.getElementById('sim3-sweep');
      if (sweepBtn) {
        sweepBtn.addEventListener('click', () => {
          this.sweeping = !this.sweeping;
          sweepBtn.classList.toggle('sim-btn--primary', this.sweeping);
          sweepBtn.innerHTML = this.sweeping ? '⏹ Oprește Baleiajul' : '🌊 Baleiaj Frecvență (Auto-Sweep)';
          if (this.sweeping && this.omega > this.omega0 * 2.0) {
            this._setOmega(0.6);
          }
        });
      }

      // Presets
      const resBtn = document.getElementById('sim3-preset-res');
      if (resBtn) {
        resBtn.addEventListener('click', () => {
          this.sweeping = false;
          this._setOmega(this.omega0);
        });
      }

      const impulseBtn = document.getElementById('sim3-preset-impulse');
      if (impulseBtn) {
        impulseBtn.addEventListener('click', () => {
          // Give all 3 masses an identical initial displacement impulse
          for (const osc of this.oscillators) {
            osc.x = 1.2;
            osc.v = 0;
          }
        });
      }

      // Play / Reset
      const playBtn = document.getElementById('sim3-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          playBtn.innerHTML = this.running ? '⏸ Pauză' : '▶ Pornit';
        });
      }

      const resetBtn = document.getElementById('sim3-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          this.start();
          if (playBtn) playBtn.innerHTML = '⏸ Pauză';
        });
      }

      this._updateBadges();
    }

    _setOmega(w) {
      this.omega = Math.max(0.3, Math.min(this.omega0 * 2.3, w));
      const wSlider = document.getElementById('sim3-omega');
      const wVal = document.getElementById('sim3-omega-val');
      if (wSlider) wSlider.value = this.omega.toFixed(2);
      if (wVal) wVal.textContent = this.omega.toFixed(2) + ' rad/s';
      this._updateBadges();
    }

    _updateBadges() {
      const bwBadge = document.getElementById('sim3-bw-badge');
      if (bwBadge) {
        const bw = this.omega0 / (this.oscillators[0].Q + 1e-12);
        bwBadge.textContent = `Δω₁ = ${bw.toFixed(2)} rad/s`;
      }
    }

    _bindMouse() {
      if (!this.canvas) return;

      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: cx - rect.left, y: cy - rect.top };
      };

      const onDown = (e) => {
        const pos = getPos(e);
        const mechW = this.W * 0.45;

        // Check if dragging one of the 3 oscillator masses
        if (pos.x <= mechW) {
          const restY = this.H * 0.56;
          const scaleY = this.H * 0.14;
          const colW = (mechW - 30) / 3;

          for (let i = 0; i < 3; i++) {
            const osc = this.oscillators[i];
            const cx = 20 + colW * (i + 0.5);
            const cy = restY + osc.x * scaleY;
            if (Math.abs(pos.x - cx) < 34 && Math.abs(pos.y - cy) < 34) {
              this.draggedOsc = osc;
              e.preventDefault();
              return;
            }
          }
        }

        // Check if clicking on resonance graph
        const rightX = this.W * 0.47;
        const rightW = this.W * 0.51;
        const plotX = rightX + 42;
        const plotW = rightW - 56;
        if (pos.x >= plotX && pos.x <= plotX + plotW && pos.y >= this.H * 0.08 && pos.y <= this.H * 0.62) {
          this.sweeping = false;
          this.isTuningGraph = true;
          const maxW = this.omega0 * 2.4;
          this._setOmega(((pos.x - plotX) / plotW) * maxW);
        }
      };

      const onMove = (e) => {
        const pos = getPos(e);
        if (this.draggedOsc) {
          const restY = this.H * 0.56;
          const scaleY = this.H * 0.14;
          this.draggedOsc.x = Math.max(-2.2, Math.min(2.2, (pos.y - restY) / scaleY));
          this.draggedOsc.v = 0;
          e.preventDefault();
        } else if (this.isTuningGraph) {
          const rightX = this.W * 0.47;
          const rightW = this.W * 0.51;
          const plotX = rightX + 42;
          const plotW = rightW - 56;
          const maxW = this.omega0 * 2.4;
          this._setOmega(((pos.x - plotX) / plotW) * maxW);
        }
      };

      const onUp = () => {
        this.draggedOsc = null;
        this.isTuningGraph = false;
      };

      this.canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    }

    update(dt) {
      // Auto-sweep logic
      if (this.sweeping) {
        const sweepSpeed = 0.75; // rad/s per second
        let nextW = this.omega + this.sweepDir * sweepSpeed * dt;
        if (nextW >= this.omega0 * 2.1) {
          nextW = this.omega0 * 2.1;
          this.sweepDir = -1;
        } else if (nextW <= 0.5) {
          nextW = 0.5;
          this.sweepDir = 1;
        }
        this._setOmega(nextW);
      }

      // Common shaker motion
      this.ys = this.Y0 * Math.cos(this.omega * this.time);
      this.vs = -this.Y0 * this.omega * Math.sin(this.omega * this.time);

      // Integrate each of the 3 oscillators with RK4
      const subSteps = 5;
      const h = dt / subSteps;

      for (const osc of this.oscillators) {
        if (this.draggedOsc === osc) continue;

        for (let s = 0; s < subSteps; s++) {
          const tSub = this.time - dt + s * h;

          const accFn = (x, v, t) => {
            const ys_t = this.Y0 * Math.cos(this.omega * t);
            const vs_t = -this.Y0 * this.omega * Math.sin(this.omega * t);
            const Fk = -this.k * (x - ys_t);
            const Fb = -osc.b * (v - vs_t);
            return (Fk + Fb) / this.m;
          };

          const k1x = osc.v;
          const k1v = accFn(osc.x, osc.v, tSub);

          const k2x = osc.v + 0.5 * h * k1v;
          const k2v = accFn(osc.x + 0.5 * h * k1x, osc.v + 0.5 * h * k1v, tSub + 0.5 * h);

          const k3x = osc.v + 0.5 * h * k2v;
          const k3v = accFn(osc.x + 0.5 * h * k2x, osc.v + 0.5 * h * k2v, tSub + 0.5 * h);

          const k4x = osc.v + h * k3v;
          const k4v = accFn(osc.x + h * k3x, osc.v + h * k3v, tSub + h);

          osc.x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
          osc.v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
        }

        // Instantaneous mechanical energy
        const stretch = osc.x - this.ys;
        osc.energy = 0.5 * this.k * stretch * stretch + 0.5 * this.m * osc.v * osc.v;
      }
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

      this._drawBanner(ctx, W);

      // Left Panel: 3 Parallel Oscillators
      const mechW = W * 0.45;
      this._drawThreeOscillators(ctx, mechW, H);

      // Right Panel: Multi-Q Curves + Energy Comparison
      const rightX = W * 0.47;
      const rightW = W * 0.51;
      this._drawMultiQGraph(ctx, rightX, H * 0.09, rightW, H * 0.53);
      this._drawEnergyComparison(ctx, rightX, H * 0.64, rightW, H * 0.33);
    }

    _drawBanner(ctx, W) {
      const h = this.H < 280 ? 20 : 26;
      const r = this.omega / (this.omega0 + 1e-12);
      const isRes = Math.abs(r - 1.0) < 0.08;
      const q1 = this.oscillators[0].Q;
      const bw1 = this.omega0 / (q1 + 1e-12);
      const isNarrow = W < 540;

      let color = isRes ? '#ff5252' : '#00e5ff';
      let bg = isRes ? 'rgba(255, 82, 82, 0.16)' : 'rgba(0, 229, 255, 0.08)';
      let text;

      if (isRes) {
        text = isNarrow
          ? `⚡ REZONANȚĂ! High-Q amplifică de ${q1.toFixed(0)}× față de Low-Q`
          : `⚡ REZONANȚĂ ACTIVĂ (ω ≈ ω₀) | Oscilatorul High-Q (Q₁=${q1.toFixed(1)}) amplifică de ${q1.toFixed(1)}× față de cel amortizat!`;
      } else {
        text = isNarrow
          ? `🔬 COMPARATOR Q | ω = ${this.omega.toFixed(1)} | Δω₁ = ${bw1.toFixed(1)} rad/s`
          : `🔬 COMPARATOR FACTOR Q | ω = ${this.omega.toFixed(2)} rad/s | Lățime Bandă High-Q: Δω₁ = ω₀/Q₁ = ${bw1.toFixed(2)} rad/s`;
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

    _drawThreeOscillators(ctx, W, H) {
      const scaleY = Math.min(H * 0.14, 45);
      const shakerRestY = Math.min(H * 0.16, 52);
      const shakerY = shakerRestY + this.ys * scaleY;
      const restY = H * 0.56;
      const colW = (W - 14) / 3;

      // Common Shaker Beam at top
      const beamLeft = 10;
      const beamW = W - 20;
      const beamGrad = ctx.createLinearGradient(beamLeft, shakerY, beamLeft + beamW, shakerY + 10);
      beamGrad.addColorStop(0, '#253050');
      beamGrad.addColorStop(0.5, '#3d4f80');
      beamGrad.addColorStop(1, '#253050');

      ctx.fillStyle = beamGrad;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(beamLeft, shakerY, beamW, 10, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e8eaf6';
      ctx.font = 'bold 8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`EXCITAȚIE: ω = ${this.omega.toFixed(2)} rad/s`, beamLeft + beamW / 2, shakerY - 4);

      // Equilibrium Line
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(10, restY);
      ctx.lineTo(W - 10, restY);
      ctx.stroke();
      ctx.restore();

      // Draw each of the 3 oscillators
      for (let i = 0; i < 3; i++) {
        const osc = this.oscillators[i];
        const cx = 7 + colW * (i + 0.5);
        const massY = Math.max(shakerY + 38, Math.min(H - 30, restY + osc.x * scaleY));
        const massW = Math.min(colW * 0.82, 68);
        const massH = Math.min(H * 0.15, 38);

        // Spring (left of column center)
        this.drawSpring(cx - 10, shakerY + 10, massY - massH / 2, 8, 6, osc.color, 1.5);

        // Damper (right of column center)
        const damperW = i === 0 ? 8 : (i === 1 ? 12 : 18);
        this.drawDamper(cx + 10, shakerY + 10, massY - massH / 2, damperW, '#9e9eb8');

        // Mass block
        ctx.save();
        if (Math.abs(osc.x) > 0.8) {
          ctx.shadowColor = osc.color;
          ctx.shadowBlur = 14;
        }

        ctx.fillStyle = '#151c32';
        ctx.strokeStyle = osc.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx - massW / 2, massY - massH / 2, massW, massH, 5);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Mass text
        ctx.fillStyle = osc.color;
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Q=${osc.Q.toFixed(1)}`, cx, massY - 4);

        ctx.fillStyle = '#e8eaf6';
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.fillText(`x=${osc.x.toFixed(2)}m`, cx, massY + 9);

        // Label at bottom of column
        ctx.fillStyle = osc.color;
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText(W < 480 ? (i === 0 ? 'High-Q' : (i === 1 ? 'Med-Q' : 'Low-Q')) : osc.name, cx, H - 10);
      }
    }

    _drawMultiQGraph(ctx, gx, gy, gw, gh) {
      const padL = 42;
      const padR = 14;
      const padT = 24;
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

      const gTitle = gw < 340 ? 'Curbe A(ω) & Δω (-3dB)' : (gw < 480 ? 'Curbele A(ω) & Lățimea Δω' : 'Curbele de Rezonanță A(ω) & Lățimea de Bandă Δω (-3 dB)');
      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(gTitle, gx + 12, gy + 15);

      const maxW = this.omega0 * 2.4;
      let globalMaxA = Math.max(this.oscillators[0].maxA, this.oscillators[1].maxA, 1.0) * 1.1;

      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 1; i <= 4; i++) {
        const yy = plotY + plotH - (i / 4) * plotH;
        ctx.beginPath();
        ctx.moveTo(plotX, yy);
        ctx.lineTo(plotX + plotW, yy);
        ctx.stroke();
      }

      // -3 dB Bandwidth Bracket on Oscillator 0 (High-Q)
      const osc0 = this.oscillators[0];
      const peakA = osc0.maxA;
      const halfPowerA = peakA / Math.SQRT2;
      const y3dB = plotY + plotH - (halfPowerA / globalMaxA) * plotH;
      const w1 = Math.max(0, this.omega0 - osc0.bandwidth / 2);
      const w2 = this.omega0 + osc0.bandwidth / 2;
      const x1 = plotX + (w1 / maxW) * plotW;
      const x2 = plotX + (w2 / maxW) * plotW;

      if (y3dB > plotY && y3dB < plotY + plotH) {
        // Shaded bandwidth zone
        ctx.fillStyle = 'rgba(0, 229, 255, 0.09)';
        ctx.fillRect(x1, y3dB, x2 - x1, plotY + plotH - y3dB);

        // Horizontal -3dB line
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#00e5ffaa';
        ctx.beginPath();
        ctx.moveTo(x1, y3dB);
        ctx.lineTo(x2, y3dB);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        const txt = gw < 360 ? `Δω=${osc0.bandwidth.toFixed(1)}` : `Δω = ${osc0.bandwidth.toFixed(2)} rad/s (-3dB)`;
        const txtW = ctx.measureText(txt).width;
        const textX = (x2 + 6 + txtW > plotX + plotW) ? Math.max(plotX + 6, x1 - txtW - 6) : x2 + 6;
        ctx.fillText(txt, textX, y3dB - 4);
      }

      // Draw all 3 curves (reverse order so High-Q is on top)
      for (let idx = 2; idx >= 0; idx--) {
        const osc = this.oscillators[idx];
        ctx.beginPath();
        ctx.strokeStyle = osc.color;
        ctx.lineWidth = idx === 0 ? 2.5 : 2.0;

        for (let i = 0; i < osc.curve.length; i++) {
          const pt = osc.curve[i];
          const xx = plotX + (pt.omega / maxW) * plotW;
          const yy = plotY + plotH - (pt.A / globalMaxA) * plotH;
          if (i === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();

        // Current operating dot on each curve
        const curX = plotX + (this.omega / maxW) * plotW;
        const curA = this._ampAt(this.omega, osc.Q);
        const curY = plotY + plotH - (curA / globalMaxA) * plotH;

        if (curX >= plotX && curX <= plotX + plotW) {
          ctx.beginPath();
          ctx.arc(curX, curY, 5, 0, Math.PI * 2);
          ctx.fillStyle = osc.color;
          ctx.fill();
        }
      }

      // Current ω vertical line
      const curX = plotX + (this.omega / maxW) * plotW;
      if (curX >= plotX && curX <= plotX + plotW) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(curX, plotY);
        ctx.lineTo(curX, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Axes labels
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = '#5c5e78';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const val = (i / 4) * maxW;
        const xx = plotX + (val / maxW) * plotW;
        ctx.fillText(val.toFixed(1), xx, plotY + plotH + 12);
      }
      ctx.fillText('Pulsație ω (rad/s)', plotX + plotW / 2, plotY + plotH + 22);

      ctx.textAlign = 'right';
      ctx.fillText(globalMaxA.toFixed(1) + 'm', plotX - 5, plotY + 8);
      ctx.fillText('0', plotX - 5, plotY + plotH);
    }

    _drawEnergyComparison(ctx, gx, gy, gw, gh) {
      ctx.fillStyle = 'rgba(15, 22, 41, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 8);
      ctx.fill();
      ctx.stroke();

      const isCompact = gw < 280;

      ctx.fillStyle = '#9e9eb8';
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(isCompact ? 'Energie Stocată & Selectivitate' : 'Energie Stocată Instantanee & Selectivitate', gx + 10, gy + 14);

      const startY = gy + 28;
      const rowH = (gh - 34) / 3;
      const labelW = Math.min(100, gw * 0.32);
      const barStartX = gx + labelW + 8;
      const statsW = Math.min(105, gw * 0.30);
      const maxBarW = Math.max(30, gw - labelW - statsW - 24);
      const maxEnergy = Math.max(15, this.oscillators[0].energy * 1.1);

      for (let i = 0; i < 3; i++) {
        const osc = this.oscillators[i];
        const y = startY + i * rowH;

        // Label
        ctx.fillStyle = osc.color;
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(isCompact ? `Q=${osc.Q.toFixed(1)}` : `${osc.name}`, gx + 8, y + 10);

        // Bar track
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(barStartX, y + 1, maxBarW, 11, 3);
        ctx.fill();

        // Active Energy bar
        const fillW = Math.min(maxBarW, Math.max(3, (osc.energy / maxEnergy) * maxBarW));
        ctx.fillStyle = osc.color;
        ctx.beginPath();
        ctx.roundRect(barStartX, y + 1, fillW, 11, 3);
        ctx.fill();

        // Stats on the right
        ctx.fillStyle = '#e8eaf6';
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.fillText(isCompact ? `${osc.energy.toFixed(1)}J` : `E=${osc.energy.toFixed(1)}J | Δω=${osc.bandwidth.toFixed(1)}`, barStartX + maxBarW + 6, y + 10);
      }
    }
  }

  window.QualityFactorSim = QualityFactorSim;
})();
