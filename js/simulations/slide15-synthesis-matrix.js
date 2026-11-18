/* ============================================================
   SLIDE15-SYNTHESIS-MATRIX.JS — Sinteză Tehnologică Globală
   Matricea Log-Log de Rezonanță (0.1 Hz – 1 MHz vs Factor Q: 5 – 10⁶),
   14 Fenomene Interactive, Mod Baleiaj Universal SDOF/Bode și
   Consolă de Laborator cu 14 Mini-Simulări Live
   Author: Buruiana Bogdan-Ioan
   ============================================================ */

(function () {
  'use strict';

  const LOG_F_MIN = Math.log10(0.08);
  const LOG_F_MAX = Math.log10(1.5e6);
  const LOG_Q_MIN = Math.log10(3.5);
  const LOG_Q_MAX = Math.log10(1.5e6);

  const SLIDER_LOG_MIN = -1.0; // 0.1 Hz
  const SLIDER_LOG_MAX = 6.0;  // 1 MHz
  const UNIVERSAL_SDOF_Q = 25;

  const CATEGORY_META = {
    risk: { label: 'Pericol Catastrofic', color: '#ff5252', bg: 'rgba(255, 82, 82, 0.16)', border: 'rgba(255, 82, 82, 0.48)' },
    control: { label: 'Control & Amortizare', color: '#ffab40', bg: 'rgba(255, 171, 64, 0.16)', border: 'rgba(255, 171, 64, 0.48)' },
    hightech: { label: 'Aplicație High-Tech', color: '#00e5ff', bg: 'rgba(0, 229, 255, 0.16)', border: 'rgba(0, 229, 255, 0.48)' }
  };

  const LABEL_PRIORITY = [
    'afm-uhv', 'mems-gyro', 'art-ndt', 'millennium', 'energy-harv',
    'tacoma', 'huygens', 'helmholtz', 'rotor-jeffcott', 'seismic-10',
    'lithotripsy', 'tmd-taipei', 'bridge-dampers', 'lrb-isolation'
  ];

  const PHENOMENA = [
    {
      id: 'tacoma',
      slideRef: 'Slide 4',
      title: 'Podul Tacoma Narrows (1940)',
      shortLabel: '1. Tacoma',
      category: 'risk',
      color: '#ff5252',
      f0: 0.20,
      Q: 40,
      miniSimKey: 'tacoma',
      eqUnicode: 'I·θ̈ + c_θ·θ̇ + k_θ·θ = M_aero(θ, θ̇, v)   [c_eff < 0]',
      regimeDesc: 'Fluture aeroelastic auto-excitat (amortizare efectivă negativă)',
      metricLabel: 'Vânt critic: 19 m/s (68 km/h) • Torsiune: ±45° • Colaps 1940',
      anchor: { dx: 10, dy: -34, align: 'left' }
    },
    {
      id: 'millennium',
      slideRef: 'Slide 5',
      title: 'Pasarela Millennium (2000)',
      shortLabel: '2. Millennium',
      category: 'risk',
      color: '#ff5252',
      f0: 0.90,
      Q: 100,
      miniSimKey: 'millennium',
      eqUnicode: 'M·Ÿ + 2ζMω₀·Ẏ + Mω₀²·Y = Σ F_lat·sin(θᵢ)',
      regimeDesc: 'Sincronizare laterală Kuramoto a pietonilor (N > N_crit)',
      metricLabel: 'N_crit ≈ 160 pietoni • ζ₀ = 0.5% • Balans lateral ±75 mm',
      anchor: { dx: 12, dy: -32, align: 'left' }
    },
    {
      id: 'seismic-10',
      slideRef: 'Slide 6',
      title: 'Seisme & Clădiri (10 Etaje)',
      shortLabel: '3. Seisme 10E',
      category: 'risk',
      color: '#ff5252',
      f0: 1.00,
      Q: 10,
      miniSimKey: 'seismic10',
      eqUnicode: 'm·ü + c·u̇ + k·u = −m·ẍ_g(t)   [T₀ ≈ 0.1·N]',
      regimeDesc: 'Rezonanță seismică selectivă pe mod fundamental (beton ζ = 5%)',
      metricLabel: 'T₀ = 1.0 s • Amplificare drift: 10× • Vrancea / Mexico City',
      anchor: { dx: 20, dy: -30, align: 'left' }
    },
    {
      id: 'rotor-jeffcott',
      slideRef: 'Slide 7',
      title: 'Rotor Jeffcott / Mașini Rotative',
      shortLabel: '4. Rotor 50Hz',
      category: 'risk',
      color: '#ff5252',
      f0: 50.0,
      Q: 12.5,
      miniSimKey: 'rotor',
      eqUnicode: 'm·ẍ + c·ẋ + k·x = m·e·ω²·cos(ωt)   [ω_cr = √(k/m)]',
      regimeDesc: 'Turație critică de încovoiere și auto-centrare super-critică',
      metricLabel: 'n_cr = 3000 RPM • ζ = 4% • Auto-centrare δ → 180°',
      anchor: { dx: 10, dy: 10, align: 'left' }
    },
    {
      id: 'tmd-taipei',
      slideRef: 'Slide 9',
      title: 'TMD Taipei 101 (660 t)',
      shortLabel: '5. TMD Taipei',
      category: 'control',
      color: '#ffab40',
      f0: 0.15,
      Q: 6,
      miniSimKey: 'tmd',
      eqUnicode: 'M₁·ẍ₁ + (C₁+c₂)ẋ₁ + (K₁+k₂)x₁ − c₂ẋ₂ − k₂x₂ = F(t)',
      regimeDesc: 'Amortizor acordat Den Hartog (peak splitting −75% balans)',
      metricLabel: 'Masă 660 t (μ = 2.5%) • ζ_opt = 9.6% • Cursă ±100 cm',
      anchor: { dx: 10, dy: -24, align: 'left' }
    },
    {
      id: 'lrb-isolation',
      slideRef: 'Slide 6',
      title: 'Izolare Seismică la Bază (LRB)',
      shortLabel: '6. Izolare LRB',
      category: 'control',
      color: '#ffab40',
      f0: 0.24,
      Q: 5,
      miniSimKey: 'lrb',
      eqUnicode: 'm·ü + c_LRB·u̇ + k_LRB·u = −m·ẍ_g(t)   [ω ≫ ω_iz]',
      regimeDesc: 'Izolare supra-rezonantă a bazei cu reazeme elastomerice LRB',
      metricLabel: 'T_iz ≈ 4.2 s • Reducere accelerație: −80% • Miez Pb disipativ',
      anchor: { dx: 10, dy: 4, align: 'left' }
    },
    {
      id: 'bridge-dampers',
      slideRef: 'Slide 5',
      title: 'Amortizoare Vâscoase Pasarelă',
      shortLabel: '7. Pasarelă Dmp',
      category: 'control',
      color: '#ffab40',
      f0: 0.90,
      Q: 5.5,
      miniSimKey: 'dampers',
      eqUnicode: 'M·Ÿ + (C₀+C_visc)Ẏ + K·Y = F_crowd(t)   [ζ_ef ≫ ζ₀]',
      regimeDesc: 'Disipare vâsco-hidraulică retrofit sub tablier (2002)',
      metricLabel: '37 amortizoare + 52 TMD • ζ_ef ≈ 9.1% (până la 22% local)',
      anchor: { dx: 20, dy: -10, align: 'left' }
    },
    {
      id: 'helmholtz',
      slideRef: 'Slide 14',
      title: 'Rezonator Acustic Helmholtz',
      shortLabel: '8. Helmholtz',
      category: 'control',
      color: '#ffab40',
      f0: 1200,
      Q: 15,
      miniSimKey: 'helmholtz',
      eqUnicode: 'm_a·ẍ + R_a·ẋ + (ρc²S²/V)·x = S·p_ext(t)   [f_H = (c/2π)√(S/VL_ef)]',
      regimeDesc: 'Atenuare acustică de bandă prin cavitate rezonantă (nacelă)',
      metricLabel: 'Atenuare: −18 dB la 1.2 kHz • Bandă Δf = 80 Hz',
      anchor: { dx: 10, dy: -10, align: 'left' }
    },
    {
      id: 'art-ndt',
      slideRef: 'Slide 14',
      title: 'Testare Nedistructivă (ART / NDT)',
      shortLabel: '9. ART / NDT',
      category: 'control',
      color: '#ffab40',
      f0: 1350,
      Q: 1200,
      miniSimKey: 'artndt',
      eqUnicode: 'EI·∂⁴w/∂x⁴ + c·∂w/∂t + ρA·∂²w/∂t² = F·δ(x−x₀)δ(t)',
      regimeDesc: 'Spectroscopie rezonantă acustică & vibrometrie laser Doppler',
      metricLabel: 'Mod f₂ = 1.35 kHz • Fisură → Δf < 0, scădere Q (1200→180)',
      anchor: { dx: 10, dy: 0, align: 'left' }
    },
    {
      id: 'huygens',
      slideRef: 'Slide 8',
      title: 'Pendulele lui Huygens (1665)',
      shortLabel: '10. Huygens',
      category: 'hightech',
      color: '#00e5ff',
      f0: 0.67,
      Q: 35,
      miniSimKey: 'huygens',
      eqUnicode: 'θ̈ᵢ + γ(θᵢ²−θ₀²)θ̇ᵢ + (g/L)sinθᵢ + (Ẍ/L)cosθᵢ = 0',
      regimeDesc: 'Sincronizare neliniară în antifază (180°) pe grindă comună',
      metricLabel: 'Cuplaj μ = m/M • Bistabilitate 0° / 180° • „Sympathie” 1665',
      anchor: { dx: 20, dy: -24, align: 'left' }
    },
    {
      id: 'energy-harv',
      slideRef: 'Slide 13',
      title: 'Energy Harvesting Piezo (Duffing)',
      shortLabel: '11. Harv. 60Hz',
      category: 'hightech',
      color: '#69f0ae',
      f0: 60.0,
      Q: 45,
      miniSimKey: 'harvester',
      eqUnicode: 'm·z̈ + c·ż + kz − αz + βz³ − θV = −m·ÿ_base',
      regimeDesc: 'Recoltare piezoelectrică bistabilă Duffing & nod IoT autonom',
      metricLabel: 'Putere: 0.5–4.5 mW • Prag TX: 3.30 V • Bandă lărgită',
      anchor: { dx: 10, dy: -14, align: 'left' }
    },
    {
      id: 'mems-gyro',
      slideRef: 'Slide 11',
      title: 'Giroscop MEMS Coriolis',
      shortLabel: '12. MEMS Gyro',
      category: 'hightech',
      color: '#00e5ff',
      f0: 20000,
      Q: 50000,
      miniSimKey: 'mems',
      eqUnicode: 'm·ÿ + (mω_y/Q)ẏ + k_y·y = −2m·Ω_z·ẋ   [F_Coriolis]',
      regimeDesc: 'Giroscop Coriolis cu acord modal și citire capacitivă diferențială',
      metricLabel: 'Amplificare Q = 5×10⁴ (vid) • Sensibilitate ΔC ≈ fF / (°/s)',
      anchor: { dx: -10, dy: 2, align: 'right' }
    },
    {
      id: 'afm-uhv',
      slideRef: 'Slide 10',
      title: 'Microscop AFM (Tapping / UHV)',
      shortLabel: '13. AFM (UHV)',
      category: 'hightech',
      color: '#00e5ff',
      f0: 150000,
      Q: 500000,
      miniSimKey: 'afm',
      eqUnicode: 'm*·z̈ + (m*ω₀/Q)ż + k·z = F_p·cos(ωt) + F_vdW(z)',
      regimeDesc: 'Microscopie cu gradient de forță van der Waals (rezoluție pm)',
      metricLabel: 'Deviație Δf ≈ −(f₀/2k)·∂F/∂z • Q_UHV = 5×10⁵ (aer: 450)',
      anchor: { dx: -10, dy: 12, align: 'right' }
    },
    {
      id: 'lithotripsy',
      slideRef: 'Slide 12',
      title: 'Litotriție ESWL & Bisturiu CUSA',
      shortLabel: '14. Litotriție',
      category: 'hightech',
      color: '#69f0ae',
      f0: 650000,
      Q: 8,
      miniSimKey: 'eswl',
      eqUnicode: 'R·R̈ + 1.5·Ṙ² = (1/ρ)[p_g(R₀/R)^3γ + p_v − p_∞(t) − 2σ/R − 4μṘ/R]',
      regimeDesc: 'Cavitație inerțială Rayleigh-Plesset & spallation calcul renal',
      metricLabel: 'Presiune: +40 / −10 MPa • Fragmentare < 1 mm • CUSA 23 kHz',
      anchor: { dx: -10, dy: -16, align: 'right' }
    }
  ];

  // --- Formatting Helpers ---
  function formatFreq(hz) {
    if (!Number.isFinite(hz) || hz <= 0) return '0.0 Hz';
    if (hz < 0.001) return (hz * 1e6).toFixed(1) + ' µHz';
    if (hz < 0.1) return (hz * 1000).toFixed(1) + ' mHz';
    if (hz < 1.0) return hz.toFixed(2) + ' Hz';
    if (hz < 100) return hz.toFixed(1) + ' Hz';
    if (hz < 1000) return hz.toFixed(0) + ' Hz';
    if (hz < 1e4) return (hz / 1000).toFixed(2) + ' kHz';
    if (hz < 1e6) return (hz / 1000).toFixed(1) + ' kHz';
    return (hz / 1e6).toFixed(2) + ' MHz';
  }

  function formatBw(hz) {
    if (!Number.isFinite(hz) || hz <= 0) return '0.0 Hz';
    if (hz < 0.001) return (hz * 1e6).toFixed(1) + ' µHz';
    if (hz < 1.0) return (hz * 1000).toFixed(1) + ' mHz';
    if (hz < 100) return hz.toFixed(2) + ' Hz';
    if (hz < 1000) return hz.toFixed(0) + ' Hz';
    if (hz < 1e4) return (hz / 1000).toFixed(2) + ' kHz';
    if (hz < 1e6) return (hz / 1000).toFixed(1) + ' kHz';
    return (hz / 1e6).toFixed(2) + ' MHz';
  }

  function formatQ(q) {
    if (!Number.isFinite(q)) return '1.0';
    if (q < 20) return Math.abs(q - Math.round(q)) < 0.05 ? String(Math.round(q)) : q.toFixed(1);
    if (q < 10000) return Math.round(q).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const exp = Math.floor(Math.log10(q));
    const mant = q / Math.pow(10, exp);
    const supMap = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶' };
    const expStr = String(exp).split('').map((c) => supMap[c] || c).join('');
    return mant.toFixed(1).replace(/\.0$/, '') + '×10' + expStr;
  }

  // --- Canvas Safety Helpers ---
  function safeArc(ctx, x, y, r, sAngle, eAngle, ccw) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r)) return;
    ctx.arc(x, y, Math.max(0.1, r), sAngle, eAngle, !!ccw);
  }

  function safeLinearGrad(ctx, x0, y0, x1, y1) {
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
      return null;
    }
    return ctx.createLinearGradient(x0, y0, x1, y1);
  }

  function safeRadialGrad(ctx, x0, y0, r0, x1, y1, r1) {
    if (
      !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(r0) ||
      !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(r1)
    ) {
      return null;
    }
    return ctx.createRadialGradient(x0, y0, Math.max(0.1, r0), x1, y1, Math.max(0.1, r1));
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r || 0, Math.min(w, h) * 0.5));
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rr);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  class SynthesisMatrixSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      this.phenomena = PHENOMENA.map((p) => Object.assign({}, p, {
        logF: Math.log10(Math.max(1e-6, p.f0)),
        logQ: Math.log10(Math.max(1e-6, p.Q)),
        _sx: 0,
        _sy: 0,
        _sr: 6
      }));

      this.logFreq = 1.78;     // Default ~60.3 Hz (Energy Harvesting 60 Hz)
      this.dampingMult = 1.0;  // Damping multiplier [0.2 .. 3.0]
      this.filterCategory = 'all'; // 'all' | 'risk' | 'control' | 'hightech'
      this.selectedId = 'energy-harv';
      this.hoverId = null;
      this.sweeping = false;
      this.sweepDir = 1;

      this._plotRect = { x: 0, y: 0, w: 0, h: 0 };
      this._isDraggingPlot = false;
      this._isTouchMode = false;
      this._eventsBound = false;
      this._lastBadgeKey = '';

      // Bound event handlers for clean destroy()
      this._onMouseDown = this._handleMouseDown.bind(this);
      this._onMouseMove = this._handleMouseMove.bind(this);
      this._onMouseUp = this._handleMouseUp.bind(this);
      this._onMouseLeave = this._handleMouseLeave.bind(this);
      this._onTouchStart = this._handleTouchStart.bind(this);
      this._onTouchMove = this._handleTouchMove.bind(this);
      this._onTouchEnd = this._handleTouchEnd.bind(this);
    }

    _el(id) {
      return document.getElementById(id);
    }

    onInit() {
      if (!this._eventsBound) {
        this._bindDOMControls();
        this._bindCanvasControls();
        this._eventsBound = true;
      }
      this._syncDOMFromState(true);
    }

    onReset() {
      this.logFreq = 1.78;
      this.dampingMult = 1.0;
      this.filterCategory = 'all';
      this.selectedId = 'energy-harv';
      this.hoverId = null;
      this.sweeping = false;
      this.sweepDir = 1;
      this._isDraggingPlot = false;
      this._syncDOMFromState(true);
      this._syncPlayButton();
    }

    start() {
      super.start();
      this._syncPlayButton();
    }

    stop() {
      super.stop();
      this._syncPlayButton();
    }

    destroy() {
      super.destroy();
      if (this.canvas) {
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        this.canvas.removeEventListener('mousemove', this._onMouseMove);
        this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
        this.canvas.removeEventListener('touchstart', this._onTouchStart);
      }
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseup', this._onMouseUp);
      window.removeEventListener('touchmove', this._onTouchMove);
      window.removeEventListener('touchend', this._onTouchEnd);
      window.removeEventListener('touchcancel', this._onTouchEnd);
    }

    requestRender() {
      if (!this.running) this.render();
    }

    _syncPlayButton() {
      const playBtn = this._el('sim15-play');
      if (playBtn) {
        playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Rulează';
      }
    }

    _bindDOMControls() {
      const freqSlider = this._el('sim15-freq');
      if (freqSlider) {
        freqSlider.addEventListener('input', (e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) {
            this.sweeping = false;
            this.setLogFreq(v, false);
          }
        });
      }

      const dampSlider = this._el('sim15-damping');
      if (dampSlider) {
        dampSlider.addEventListener('input', (e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) {
            this.setDampingMult(v);
          }
        });
      }

      const presetMap = [
        { id: 'sim15-preset-all', cat: 'all' },
        { id: 'sim15-preset-risks', cat: 'risk' },
        { id: 'sim15-preset-control', cat: 'control' },
        { id: 'sim15-preset-hightech', cat: 'hightech' }
      ];
      presetMap.forEach((entry) => {
        const btn = this._el(entry.id);
        if (btn) {
          btn.addEventListener('click', () => {
            this.setCategory(entry.cat);
          });
        }
      });

      const sweepBtn = this._el('sim15-preset-sweep');
      if (sweepBtn) {
        sweepBtn.addEventListener('click', () => {
          this.toggleSweep();
        });
      }

      const playBtn = this._el('sim15-play');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.toggle();
          this._syncPlayButton();
        });
      }

      const resetBtn = this._el('sim15-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          this.start();
        });
      }
    }

    _bindCanvasControls() {
      if (!this.canvas) return;
      this.canvas.addEventListener('mousedown', this._onMouseDown);
      this.canvas.addEventListener('mousemove', this._onMouseMove);
      this.canvas.addEventListener('mouseleave', this._onMouseLeave);
      this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });

      window.addEventListener('mousemove', this._onMouseMove);
      window.addEventListener('mouseup', this._onMouseUp);
      window.addEventListener('touchmove', this._onTouchMove, { passive: false });
      window.addEventListener('touchend', this._onTouchEnd);
      window.addEventListener('touchcancel', this._onTouchEnd);
    }

    _getPointerPos(e) {
      if (!this.canvas) return { x: 0, y: 0 };
      const rect = this.canvas.getBoundingClientRect();
      const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
      const cx = Number.isFinite(src.clientX) ? src.clientX : 0;
      const cy = Number.isFinite(src.clientY) ? src.clientY : 0;
      return { x: cx - rect.left, y: cy - rect.top };
    }

    _isInsidePlot(pt) {
      const r = this._plotRect;
      return r.w > 10 && r.h > 10 && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
    }

    _findHitNode(pt, isTouch) {
      const hitRadius = isTouch ? 24 : 18;
      let best = null;
      let bestDist = Infinity;
      const visible = this._getVisiblePhenomena();
      // First check visible category nodes, then dimmed ones only if 'all'
      const pool = this.filterCategory === 'all' ? this.phenomena : visible;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        const d = Math.hypot(pt.x - p._sx, pt.y - p._sy);
        if (d <= hitRadius && d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return best;
    }

    _handleMouseDown(e) {
      this._isTouchMode = false;
      const pt = this._getPointerPos(e);
      if (!this._isInsidePlot(pt)) return;
      const hit = this._findHitNode(pt, false);
      if (hit) {
        this.sweeping = false;
        this.selectPhenomenon(hit.id);
        return;
      }
      this.sweeping = false;
      this._isDraggingPlot = true;
      this._sweepFromPoint(pt.x);
      if (this.canvas) this.canvas.style.cursor = 'grabbing';
    }

    _handleMouseMove(e) {
      if (!this.canvas) return;
      const pt = this._getPointerPos(e);
      if (this._isDraggingPlot) {
        this._sweepFromPoint(pt.x);
        this.canvas.style.cursor = 'grabbing';
        return;
      }
      // Only update hover if target is canvas or inside plot
      if (e.target !== this.canvas) {
        if (this.hoverId !== null) {
          this.hoverId = null;
          this.requestRender();
        }
        return;
      }
      if (this._isInsidePlot(pt)) {
        const hit = this._findHitNode(pt, false);
        const nextHover = hit ? hit.id : null;
        this.canvas.style.cursor = hit ? 'pointer' : 'ew-resize';
        if (nextHover !== this.hoverId) {
          this.hoverId = nextHover;
          this.requestRender();
        }
      } else {
        this.canvas.style.cursor = 'default';
        if (this.hoverId !== null) {
          this.hoverId = null;
          this.requestRender();
        }
      }
    }

    _handleMouseUp() {
      if (this._isDraggingPlot) {
        this._isDraggingPlot = false;
        if (this.canvas) this.canvas.style.cursor = 'ew-resize';
      }
    }

    _handleMouseLeave() {
      if (!this._isDraggingPlot && this.hoverId !== null) {
        this.hoverId = null;
        this.requestRender();
      }
    }

    _handleTouchStart(e) {
      this._isTouchMode = true;
      const pt = this._getPointerPos(e);
      if (!this._isInsidePlot(pt)) return;
      if (e.cancelable) e.preventDefault();
      const hit = this._findHitNode(pt, true);
      if (hit) {
        this.sweeping = false;
        this.selectPhenomenon(hit.id);
        return;
      }
      this.sweeping = false;
      this._isDraggingPlot = true;
      this._sweepFromPoint(pt.x);
    }

    _handleTouchMove(e) {
      if (!this._isDraggingPlot) return;
      if (e.cancelable) e.preventDefault();
      const pt = this._getPointerPos(e);
      this._sweepFromPoint(pt.x);
    }

    _handleTouchEnd() {
      this._isDraggingPlot = false;
    }

    _sweepFromPoint(px) {
      const r = this._plotRect;
      if (r.w <= 1) return;
      const u = Math.max(0, Math.min(1, (px - r.x) / r.w));
      const logF = LOG_F_MIN + u * (LOG_F_MAX - LOG_F_MIN);
      this.setLogFreq(Math.max(SLIDER_LOG_MIN, Math.min(SLIDER_LOG_MAX, logF)), false);
    }

    // --- Public State Mutators ---
    setLogFreq(logF, keepSelected) {
      const clamped = Math.max(SLIDER_LOG_MIN, Math.min(SLIDER_LOG_MAX, Number.isFinite(logF) ? logF : 1.78));
      this.logFreq = clamped;

      if (!keepSelected && this.selectedId) {
        const cur = this._getPhenomenonById(this.selectedId);
        if (!cur || Math.abs(this.logFreq - cur.logF) > 0.08) {
          this.selectedId = null;
        }
      }
      this._syncDOMFromState(false);
      this.requestRender();
    }

    setDampingMult(mult) {
      const clamped = Math.max(0.2, Math.min(3.0, Number.isFinite(mult) ? mult : 1.0));
      this.dampingMult = clamped;
      this._syncDOMFromState(false);
      this.requestRender();
    }

    selectPhenomenon(id) {
      const node = this._getPhenomenonById(id);
      if (!node) return;
      this.selectedId = node.id;
      this.logFreq = Math.max(SLIDER_LOG_MIN, Math.min(SLIDER_LOG_MAX, node.logF));
      if (this.filterCategory !== 'all' && node.category !== this.filterCategory) {
        this.filterCategory = 'all';
      }
      this._syncDOMFromState(true);
      this.requestRender();
    }

    setCategory(cat) {
      const valid = (cat === 'all' || cat === 'risk' || cat === 'control' || cat === 'hightech') ? cat : 'all';
      this.filterCategory = valid;
      this.sweeping = false;
      this.hoverId = null;

      if (valid !== 'all') {
        const cur = this.selectedId ? this._getPhenomenonById(this.selectedId) : null;
        if (!cur || cur.category !== valid) {
          const first = this.phenomena.find((p) => p.category === valid);
          if (first) {
            this.selectedId = first.id;
            this.logFreq = Math.max(SLIDER_LOG_MIN, Math.min(SLIDER_LOG_MAX, first.logF));
          }
        }
      } else if (!this.selectedId) {
        const nearest = this._findNearestPhenomenon(this.logFreq, 'all');
        if (nearest && Math.abs(this.logFreq - nearest.logF) <= 0.06) {
          this.selectedId = nearest.id;
        }
      }
      this._syncDOMFromState(true);
      this.requestRender();
    }

    toggleSweep(forceState) {
      this.sweeping = typeof forceState === 'boolean' ? forceState : !this.sweeping;
      if (this.sweeping) {
        this.selectedId = null;
        if (!this.running) this.start();
      }
      this._syncDOMFromState(true);
      this.requestRender();
    }

    _getPhenomenonById(id) {
      for (let i = 0; i < this.phenomena.length; i++) {
        if (this.phenomena[i].id === id) return this.phenomena[i];
      }
      return null;
    }

    _getVisiblePhenomena() {
      if (this.filterCategory === 'all') return this.phenomena;
      return this.phenomena.filter((p) => p.category === this.filterCategory);
    }

    _findNearestPhenomenon(logF, catFilter) {
      const pool = (!catFilter || catFilter === 'all')
        ? this.phenomena
        : this.phenomena.filter((p) => p.category === catFilter);
      let best = null;
      let bestDiff = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const d = Math.abs(logF - pool[i].logF);
        if (d < bestDiff) {
          bestDiff = d;
          best = pool[i];
        }
      }
      return best;
    }

    _getActiveContext() {
      if (this.selectedId) {
        const node = this._getPhenomenonById(this.selectedId);
        if (node && (this.filterCategory === 'all' || node.category === this.filterCategory)) {
          return { node, isSnapped: true, isUniversal: false };
        }
      }
      const nearest = this._findNearestPhenomenon(this.logFreq, this.filterCategory);
      if (nearest && Math.abs(this.logFreq - nearest.logF) <= 0.06) {
        return { node: nearest, isSnapped: false, isUniversal: false };
      }
      return { node: nearest, isSnapped: false, isUniversal: true };
    }

    _syncDOMFromState(syncPresets) {
      const freqSlider = this._el('sim15-freq');
      const freqVal = this._el('sim15-freq-val');
      const hz = Math.pow(10, this.logFreq);
      if (freqSlider) freqSlider.value = this.logFreq.toFixed(2);
      if (freqVal) freqVal.textContent = formatFreq(hz);

      const dampSlider = this._el('sim15-damping');
      const dampVal = this._el('sim15-damping-val');
      if (dampSlider) dampSlider.value = this.dampingMult.toFixed(1);
      if (dampVal) dampVal.textContent = this.dampingMult.toFixed(1) + '×';

      if (syncPresets) {
        const btns = [
          { id: 'sim15-preset-all', active: this.filterCategory === 'all' && !this.sweeping },
          { id: 'sim15-preset-risks', active: this.filterCategory === 'risk' },
          { id: 'sim15-preset-control', active: this.filterCategory === 'control' },
          { id: 'sim15-preset-hightech', active: this.filterCategory === 'hightech' },
          { id: 'sim15-preset-sweep', active: this.sweeping }
        ];
        btns.forEach((b) => {
          const el = this._el(b.id);
          if (el) el.classList.toggle('sim-btn--preset', !!b.active);
        });
      }

      this._updateBadges();
    }

    _updateBadges() {
      const ctxInfo = this._getActiveContext();
      const cursorHz = Math.pow(10, this.logFreq);
      const node = ctxInfo.node;
      const baseQ = ctxInfo.isUniversal ? UNIVERSAL_SDOF_Q : (node ? node.Q : UNIVERSAL_SDOF_Q);
      const qEff = Math.max(0.5, baseQ / this.dampingMult);
      const bwHz = ctxInfo.isUniversal ? (cursorHz / qEff) : (node.f0 / qEff);

      const phenomText = ctxInfo.isUniversal
        ? (this.sweeping ? 'Baleiaj SDOF' : 'Spectru SDOF')
        : node.shortLabel;
      const freqText = ctxInfo.isUniversal
        ? formatFreq(cursorHz)
        : formatFreq(node.f0);
      const qText = 'Q = ' + formatQ(qEff);
      const bwText = 'Δf = ' + formatBw(bwHz);

      const key = phenomText + '|' + freqText + '|' + qText + '|' + bwText + '|' + (node ? node.category : 'u');
      if (key === this._lastBadgeKey) return;
      this._lastBadgeKey = key;

      const bPhenom = this._el('sim15-badge-phenom');
      const bFreq = this._el('sim15-badge-freq');
      const bQ = this._el('sim15-badge-q');
      const bBw = this._el('sim15-badge-bw');

      if (bPhenom) {
        bPhenom.textContent = phenomText;
        let cls = 'sim-badge sim-badge--cyan';
        if (!ctxInfo.isUniversal && node) {
          if (node.category === 'risk') cls = 'sim-badge sim-badge--danger';
          else if (node.category === 'control') cls = 'sim-badge sim-badge--amber';
          else cls = 'sim-badge sim-badge--green';
        }
        bPhenom.className = cls;
      }
      if (bFreq) bFreq.textContent = freqText;
      if (bQ) bQ.textContent = qText;
      if (bBw) bBw.textContent = bwText;
    }

    update(dt) {
      const safeDt = Math.min(Math.max(0, Number.isFinite(dt) ? dt : 0), 0.05);
      if (this.sweeping) {
        // Sweep smoothly across 7 decades in ~14 seconds (0.50 decades/sec)
        const speed = 0.52;
        this.logFreq += this.sweepDir * speed * safeDt;
        if (this.logFreq >= SLIDER_LOG_MAX) {
          this.logFreq = SLIDER_LOG_MAX;
          this.sweepDir = -1;
        } else if (this.logFreq <= SLIDER_LOG_MIN) {
          this.logFreq = SLIDER_LOG_MIN;
          this.sweepDir = 1;
        }
        this._syncDOMFromState(false);
      } else {
        this._updateBadges();
      }
    }

    // --- Coordinate Projections ---
    _freqToX(logF, plot) {
      const u = (logF - LOG_F_MIN) / (LOG_F_MAX - LOG_F_MIN);
      return plot.x + u * plot.w;
    }

    _qToY(logQ, plot) {
      const v = (logQ - LOG_Q_MIN) / (LOG_Q_MAX - LOG_Q_MIN);
      return plot.y + plot.h - v * plot.h;
    }

    // --- Main Render ---
    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (W < 40 || H < 40) return;

      ctx.save();

      // Background gradient
      const bg = safeLinearGrad(ctx, 0, 0, 0, H);
      if (bg) {
        bg.addColorStop(0, '#060a14');
        bg.addColorStop(0.55, '#0b1324');
        bg.addColorStop(1, '#060a12');
        ctx.fillStyle = bg;
      } else {
        ctx.fillStyle = '#060a14';
      }
      ctx.fillRect(0, 0, W, H);

      const isNarrow = W < 540;
      const isPortraitStack = W < 540 && H > 460;
      const isCompactH = H < 350;
      const pad = isNarrow ? 6 : 10;
      const bannerH = isCompactH ? 22 : 26;

      this._drawBanner(ctx, W, bannerH, isNarrow);

      // Compute layout rectangles
      const availH = Math.max(60, H - bannerH - pad * 1.6);
      const upperRatio = isPortraitStack ? 0.50 : (isCompactH ? 0.54 : 0.57);
      const upperH = Math.max(70, Math.round(availH * upperRatio));
      const upperY = bannerH + 4;
      const matrixCard = { x: pad, y: upperY, w: W - pad * 2, h: upperH };

      const consoleY = upperY + upperH + 6;
      const consoleH = Math.max(40, H - consoleY - pad * 0.6);

      // Draw Upper Log-Log Resonance Matrix
      this._drawMatrixPanel(ctx, matrixCard, isNarrow, isCompactH);

      // Draw Lower Laboratory Console
      if (consoleH >= 48) {
        if (isPortraitStack) {
          const miniH = Math.max(40, Math.floor((consoleH - 6) * 0.45));
          const infoH = Math.max(40, consoleH - miniH - 6);
          const miniCard = { x: pad, y: consoleY, w: W - pad * 2, h: miniH };
          const infoCard = { x: pad, y: consoleY + miniH + 6, w: W - pad * 2, h: infoH };
          this._drawMiniSimCard(ctx, miniCard, true);
          this._drawTelemetryCard(ctx, infoCard, true);
        } else {
          const gap = isNarrow ? 6 : 10;
          const leftW = Math.round((W - pad * 2 - gap) * 0.47);
          const rightW = Math.max(60, W - pad * 2 - gap - leftW);
          const miniCard = { x: pad, y: consoleY, w: leftW, h: consoleH };
          const infoCard = { x: pad + leftW + gap, y: consoleY, w: rightW, h: consoleH };
          this._drawMiniSimCard(ctx, miniCard, isNarrow);
          this._drawTelemetryCard(ctx, infoCard, isNarrow);
        }
      }

      ctx.restore();
    }

    _drawBanner(ctx, W, bannerH, isNarrow) {
      const grad = safeLinearGrad(ctx, 0, 0, W, 0);
      if (grad) {
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.14)');
        grad.addColorStop(0.5, 'rgba(255, 171, 64, 0.08)');
        grad.addColorStop(1, 'rgba(105, 240, 174, 0.12)');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.14)';
      }
      ctx.fillRect(0, 0, W, bannerH);

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, bannerH);
      ctx.lineTo(W, bannerH);
      ctx.stroke();

      ctx.font = `700 ${isNarrow ? 9 : 10.5}px Inter, sans-serif`;
      ctx.fillStyle = '#e8eaf6';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const title = isNarrow
        ? 'MATRICEA REZONANȚEI • 0.1 Hz–1 MHz vs Q'
        : 'MATRICEA TEHNOLOGICĂ GLOBALĂ A REZONANȚEI (0.1 Hz – 1 MHz vs Q)';
      ctx.fillText(title, 10, bannerH / 2);

      // Legend on right
      const legendItems = isNarrow
        ? [
            { label: 'Risc', color: '#ff5252' },
            { label: 'Control', color: '#ffab40' },
            { label: 'Tech', color: '#00e5ff' }
          ]
        : [
            { label: 'Pericol', color: '#ff5252' },
            { label: 'Control', color: '#ffab40' },
            { label: 'High-Tech', color: '#00e5ff' }
          ];

      ctx.font = `600 ${isNarrow ? 8 : 9.5}px Inter, sans-serif`;
      let rx = W - 10;
      for (let i = legendItems.length - 1; i >= 0; i--) {
        const item = legendItems[i];
        const tw = ctx.measureText(item.label).width;
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'right';
        ctx.fillText(item.label, rx, bannerH / 2);
        rx -= tw + 7;
        ctx.beginPath();
        safeArc(ctx, rx, bannerH / 2, isNarrow ? 3 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        rx -= (isNarrow ? 10 : 14);
      }
    }

    _drawPanelFrame(ctx, box, accentBorder) {
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, box.x, box.y, box.w, box.h, 7);
      ctx.fillStyle = 'rgba(11, 20, 38, 0.94)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = accentBorder || '#1e293b';
      ctx.stroke();
      ctx.restore();
    }

    _drawMatrixPanel(ctx, card, isNarrow, isCompactH) {
      this._drawPanelFrame(ctx, card, '#1e293b');
      if (card.w < 60 || card.h < 50) return;

      const leftM = isNarrow ? 32 : 42;
      const rightM = isNarrow ? 10 : 16;
      const topM = isCompactH ? 10 : 14;
      const botM = isCompactH ? 18 : 24;

      const plot = {
        x: card.x + leftM,
        y: card.y + topM,
        w: Math.max(30, card.w - leftM - rightM),
        h: Math.max(30, card.h - topM - botM)
      };
      this._plotRect = plot;

      // Inner plot background
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, plot.x, plot.y, plot.w, plot.h, 4);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.clip();

      // 1. Shaded Engineering Regime Bands
      this._drawRegimeBands(ctx, plot, isNarrow);

      // 2. Log-Log Grid Lines
      this._drawLogGrid(ctx, plot);

      // 3. Universal Frequency Cursor
      const activeCtx = this._getActiveContext();
      const cursorX = this._freqToX(this.logFreq, plot);
      const cursorColor = activeCtx.isUniversal
        ? '#38bdf8'
        : (activeCtx.node ? activeCtx.node.color : '#00e5ff');

      ctx.save();
      const cGrad = safeLinearGrad(ctx, cursorX - 18, plot.y, cursorX + 18, plot.y);
      if (cGrad) {
        cGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
        cGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.14)');
        cGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.fillStyle = cGrad;
        ctx.fillRect(cursorX - 18, plot.y, 36, plot.h);
      }
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorX, plot.y);
      ctx.lineTo(cursorX, plot.y + plot.h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Cursor top tag
      const cursorLabel = formatFreq(Math.pow(10, this.logFreq));
      ctx.font = '600 8px "JetBrains Mono", monospace';
      const tagW = ctx.measureText(cursorLabel).width + 8;
      const tagX = Math.max(plot.x + 2, Math.min(plot.x + plot.w - tagW - 2, cursorX - tagW / 2));
      ctx.fillStyle = 'rgba(8, 12, 24, 0.90)';
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundRectPath(ctx, tagX, plot.y + 3, tagW, 13, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8eaf6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cursorLabel, tagX + tagW / 2, plot.y + 9.5);

      // 4. Compute Screen Coordinates for all 14 nodes & Draw Nodes
      const activeId = activeCtx.isUniversal ? null : (activeCtx.node ? activeCtx.node.id : null);
      for (let i = 0; i < this.phenomena.length; i++) {
        const p = this.phenomena[i];
        p._sx = this._freqToX(p.logF, plot);
        p._sy = this._qToY(p.logQ, plot);
        p._sr = isNarrow ? 5 : 6;
      }

      // Draw dimmed nodes first, then active/visible nodes
      for (let i = 0; i < this.phenomena.length; i++) {
        const p = this.phenomena[i];
        const isMatch = this.filterCategory === 'all' || p.category === this.filterCategory;
        if (!isMatch) {
          this._drawNodeMarker(ctx, p, false, false, 0.22);
        }
      }
      for (let i = 0; i < this.phenomena.length; i++) {
        const p = this.phenomena[i];
        const isMatch = this.filterCategory === 'all' || p.category === this.filterCategory;
        if (!isMatch) continue;
        const isActive = p.id === activeId;
        const isHover = p.id === this.hoverId;
        this._drawNodeMarker(ctx, p, isActive, isHover, 1.0);
      }

      // 5. Collision-Resolved Labels
      this._drawResolvedLabels(ctx, plot, isNarrow, activeId);

      // 6. Bounded Hover Tooltip (only when hovering a visible node)
      if (this.hoverId) {
        const hNode = this._getPhenomenonById(this.hoverId);
        if (hNode && (this.filterCategory === 'all' || hNode.category === this.filterCategory)) {
          this._drawHoverTooltip(ctx, hNode, plot);
        }
      }

      ctx.restore(); // end plot clip

      // 7. Axis Tick Labels (outside clip, inside card)
      this._drawAxisLabels(ctx, plot, isNarrow, isCompactH);
    }

    _drawRegimeBands(ctx, plot, isNarrow) {
      const bands = [
        {
          f1: 0.09, f2: 5.0, q1: 3.6, q2: 14,
          fill: 'rgba(255, 171, 64, 0.06)',
          text: isNarrow ? 'Civil & Amort.' : 'Structuri Civile & Amortizare',
          tColor: 'rgba(255, 171, 64, 0.45)',
          tx: isNarrow ? 2.5 : 2.3, tq: 5.2
        },
        {
          f1: 0.14, f2: 3.5, q1: 18, q2: 160,
          fill: 'rgba(255, 82, 82, 0.06)',
          text: isNarrow ? 'Aeroelastic' : 'Zonă Pericol Aeroelastic',
          tColor: 'rgba(255, 82, 82, 0.45)',
          tx: 0.45, tq: 120
        },
        {
          f1: 20, f2: 4500, q1: 4, q2: 3000,
          fill: 'rgba(0, 229, 255, 0.04)',
          text: isNarrow ? 'Rotative/Acust.' : 'Mașini Rotative, Energie & Acustică',
          tColor: 'rgba(56, 189, 248, 0.40)',
          tx: 320, tq: 1800
        },
        {
          f1: 10000, f2: 500000, q1: 5000, q2: 1.2e6,
          fill: 'rgba(0, 229, 255, 0.07)',
          text: isNarrow ? 'MEMS & UHV' : 'MEMS & Nanotehnologie Vidată',
          tColor: 'rgba(0, 229, 255, 0.48)',
          tx: 65000, tq: 1.0e6
        },
        {
          f1: 120000, f2: 1.3e6, q1: 3.6, q2: 35,
          fill: 'rgba(105, 240, 174, 0.06)',
          text: isNarrow ? 'Med. US' : 'Ultrasunete Medicale',
          tColor: 'rgba(105, 240, 174, 0.45)',
          tx: 400000, tq: 26
        }
      ];

      ctx.save();
      ctx.font = `600 ${isNarrow ? 7 : 8}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (let i = 0; i < bands.length; i++) {
        const b = bands[i];
        const x1 = this._freqToX(Math.log10(b.f1), plot);
        const x2 = this._freqToX(Math.log10(b.f2), plot);
        const y2 = this._qToY(Math.log10(b.q1), plot);
        const y1 = this._qToY(Math.log10(b.q2), plot);
        ctx.fillStyle = b.fill;
        ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
        if (plot.h >= 120) {
          const lx = Math.max(plot.x + 42, Math.min(plot.x + plot.w - 42, this._freqToX(Math.log10(b.tx), plot)));
          const ly = Math.max(plot.y + 18, Math.min(plot.y + plot.h - 10, this._qToY(Math.log10(b.tq), plot)));
          ctx.fillStyle = b.tColor;
          ctx.fillText(b.text, lx, ly);
        }
      }
      ctx.restore();
    }

    _drawLogGrid(ctx, plot) {
      ctx.save();
      // Minor frequency log grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.22)';
      ctx.lineWidth = 0.7;
      for (let dec = -1; dec <= 5; dec++) {
        const base = Math.pow(10, dec);
        for (let m = 2; m <= 9; m++) {
          const f = base * m;
          if (f > 1.4e6) break;
          const x = this._freqToX(Math.log10(f), plot);
          if (x > plot.x && x < plot.x + plot.w) {
            ctx.beginPath();
            ctx.moveTo(x, plot.y);
            ctx.lineTo(x, plot.y + plot.h);
            ctx.stroke();
          }
        }
      }

      // Major frequency decade lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.13)';
      ctx.lineWidth = 1;
      for (let dec = -1; dec <= 6; dec++) {
        const x = this._freqToX(dec, plot);
        if (x >= plot.x && x <= plot.x + plot.w) {
          ctx.beginPath();
          ctx.moveTo(x, plot.y);
          ctx.lineTo(x, plot.y + plot.h);
          ctx.stroke();
        }
      }

      // Major Q decade lines + Q=5
      const qVals = [5, 10, 100, 1e3, 1e4, 1e5, 1e6];
      for (let i = 0; i < qVals.length; i++) {
        const y = this._qToY(Math.log10(qVals[i]), plot);
        if (y >= plot.y && y <= plot.y + plot.h) {
          ctx.strokeStyle = i === 0 ? 'rgba(51, 65, 85, 0.45)' : 'rgba(56, 189, 248, 0.13)';
          ctx.beginPath();
          ctx.moveTo(plot.x, y);
          ctx.lineTo(plot.x + plot.w, y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawAxisLabels(ctx, plot, isNarrow, isCompactH) {
      ctx.save();
      ctx.font = `600 ${isNarrow ? 7.5 : 8.5}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#94a3b8';

      // X-axis frequency ticks
      const fTicks = [
        { dec: -1, text: '0.1Hz' },
        { dec: 0, text: '1Hz' },
        { dec: 1, text: '10Hz' },
        { dec: 2, text: '100Hz' },
        { dec: 3, text: '1kHz' },
        { dec: 4, text: '10kHz' },
        { dec: 5, text: '100kHz' },
        { dec: 6, text: '1MHz' }
      ];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < fTicks.length; i++) {
        if (isNarrow && (i === 1 || i === 3 || i === 5)) continue;
        const x = this._freqToX(fTicks[i].dec, plot);
        if (x >= plot.x + 2 && x <= plot.x + plot.w - 4) {
          ctx.fillText(fTicks[i].text, x, plot.y + plot.h + (isCompactH ? 3 : 5));
        }
      }

      // Y-axis Q ticks
      const qTicks = [
        { val: 5, text: '5' },
        { val: 10, text: '10' },
        { val: 100, text: '10²' },
        { val: 1e3, text: '10³' },
        { val: 1e4, text: '10⁴' },
        { val: 1e5, text: '10⁵' },
        { val: 1e6, text: '10⁶' }
      ];
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < qTicks.length; i++) {
        if (isCompactH && i === 0) continue;
        const y = this._qToY(Math.log10(qTicks[i].val), plot);
        if (y >= plot.y + 4 && y <= plot.y + plot.h - 4) {
          ctx.fillText(qTicks[i].text, plot.x - 5, y);
        }
      }

      // Small axis titles
      ctx.fillStyle = '#64748b';
      ctx.font = `700 ${isNarrow ? 7 : 8}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Q', plot.x - (isNarrow ? 28 : 34), plot.y + 8);
      ctx.restore();
    }

    _drawNodeMarker(ctx, p, isActive, isHover, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const pulse = isActive ? (1 + 0.18 * Math.sin(this.time * 4.5)) : 1;
      const r = p._sr * (isActive ? 1.32 : (isHover ? 1.2 : 1.0));

      if (isActive || isHover) {
        const haloR = (r + 8) * pulse;
        const rad = safeRadialGrad(ctx, p._sx, p._sy, 1, p._sx, p._sy, haloR);
        if (rad) {
          rad.addColorStop(0, p.color + '88');
          rad.addColorStop(0.6, p.color + '33');
          rad.addColorStop(1, p.color + '00');
          ctx.fillStyle = rad;
          ctx.beginPath();
          safeArc(ctx, p._sx, p._sy, haloR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        safeArc(ctx, p._sx, p._sy, r + 3.5 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color + '33';
        ctx.beginPath();
        safeArc(ctx, p._sx, p._sy, r + 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main sphere
      const sphere = safeRadialGrad(ctx, p._sx - r * 0.3, p._sy - r * 0.3, 0.5, p._sx, p._sy, r);
      if (sphere) {
        sphere.addColorStop(0, '#ffffff');
        sphere.addColorStop(0.35, p.color);
        sphere.addColorStop(1, '#0b1324');
        ctx.fillStyle = sphere;
      } else {
        ctx.fillStyle = p.color;
      }
      ctx.beginPath();
      safeArc(ctx, p._sx, p._sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isActive ? '#ffffff' : p.color;
      ctx.lineWidth = isActive ? 1.6 : 1.1;
      ctx.stroke();
      ctx.restore();
    }

    _drawResolvedLabels(ctx, plot, isNarrow, activeId) {
      const visible = this._getVisiblePhenomena();
      const byId = {};
      for (let i = 0; i < visible.length; i++) {
        byId[visible[i].id] = visible[i];
      }

      const ordered = [];
      for (let i = 0; i < LABEL_PRIORITY.length; i++) {
        if (byId[LABEL_PRIORITY[i]]) ordered.push(byId[LABEL_PRIORITY[i]]);
      }

      const fontSize = isNarrow ? 7.5 : (plot.h >= 190 ? 8.5 : 8.0);
      const pillH = plot.h >= 200 ? 13 : 11;
      const padX = isNarrow ? 5 : 8;
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;

      const placed = [];
      const padMargin = 2;

      function overlapsAny(box, list) {
        for (let k = 0; k < list.length; k++) {
          const o = list[k];
          if (
            box.x < o.x + o.w + padMargin &&
            box.x + box.w + padMargin > o.x &&
            box.y < o.y + o.h + padMargin &&
            box.y + box.h + padMargin > o.y
          ) {
            return true;
          }
        }
        return false;
      }

      function overlapsNodeDot(box, nodes, selfId) {
        for (let k = 0; k < nodes.length; k++) {
          const n = nodes[k];
          if (n.id === selfId) continue;
          const nr = n._sr + 2;
          if (
            box.x < n._sx + nr &&
            box.x + box.w > n._sx - nr &&
            box.y < n._sy + nr &&
            box.y + box.h > n._sy - nr
          ) {
            return true;
          }
        }
        return false;
      }

      for (let i = 0; i < ordered.length; i++) {
        const p = ordered[i];
        const labelText = p.shortLabel;
        const w = Math.ceil(ctx.measureText(labelText).width + padX);
        const h = pillH;

        const prefX = p.anchor.align === 'right'
          ? (p._sx + p.anchor.dx - w)
          : (p._sx + p.anchor.dx);
        const prefY = p._sy + p.anchor.dy - h / 2;

        const clampBox = (bx, by) => ({
          x: Math.max(plot.x + 3, Math.min(plot.x + plot.w - w - 3, bx)),
          y: Math.max(plot.y + 18, Math.min(plot.y + plot.h - h - 3, by)),
          w,
          h
        });

        const xCandidates = [
          prefX,
          p._sx + 10,
          p._sx - w - 10,
          p._sx + 56,
          p._sx + 105,
          p._sx - w - 56
        ];

        const candidates = [clampBox(prefX, prefY)];
        for (let r = 0; r <= 9; r++) {
          const dyStep = r * (h + 2);
          const signs = r === 0 ? [0] : [-1, 1];
          for (let s = 0; s < signs.length; s++) {
            const cy = prefY + signs[s] * dyStep;
            for (let xc = 0; xc < xCandidates.length; xc++) {
              candidates.push(clampBox(xCandidates[xc], cy));
            }
          }
        }

        let chosen = null;
        // Pass 1: avoid both placed labels AND other node circles
        for (let c = 0; c < candidates.length; c++) {
          const cand = candidates[c];
          if (!overlapsAny(cand, placed) && !overlapsNodeDot(cand, visible, p.id)) {
            chosen = cand;
            break;
          }
        }
        // Pass 2: avoid placed labels only
        if (!chosen) {
          for (let c = 0; c < candidates.length; c++) {
            const cand = candidates[c];
            if (!overlapsAny(cand, placed)) {
              chosen = cand;
              break;
            }
          }
        }
        if (!chosen) chosen = candidates[0];
        placed.push(chosen);

        const isActive = p.id === activeId;
        const isHover = p.id === this.hoverId;

        // Leader line if label center is > 16px from node
        const cx = chosen.x + chosen.w / 2;
        const cy = chosen.y + chosen.h / 2;
        const dist = Math.hypot(cx - p._sx, cy - p._sy);
        if (dist > 16) {
          const edgeX = Math.max(chosen.x, Math.min(chosen.x + chosen.w, p._sx));
          const edgeY = Math.max(chosen.y, Math.min(chosen.y + chosen.h, p._sy));
          ctx.save();
          ctx.globalAlpha = isActive ? 0.78 : 0.42;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(p._sx, p._sy);
          ctx.lineTo(edgeX, edgeY);
          ctx.stroke();
          ctx.restore();
        }

        // Pill background
        ctx.save();
        ctx.beginPath();
        roundRectPath(ctx, chosen.x, chosen.y, chosen.w, chosen.h, 3);
        ctx.fillStyle = isActive ? 'rgba(15, 23, 42, 0.96)' : 'rgba(8, 12, 24, 0.84)';
        ctx.fill();
        ctx.lineWidth = isActive || isHover ? 1.2 : 0.8;
        ctx.strokeStyle = isActive ? '#ffffff' : (p.color + '88');
        ctx.stroke();

        ctx.fillStyle = isActive ? '#ffffff' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, chosen.x + chosen.w / 2, chosen.y + chosen.h / 2 + 0.5);
        ctx.restore();
      }
    }

    _drawHoverTooltip(ctx, node, plot) {
      const cat = CATEGORY_META[node.category] || CATEGORY_META.hightech;
      const line1 = node.title;
      const line2 = `f₀ = ${formatFreq(node.f0)}  •  Q = ${formatQ(node.Q)}  •  ${cat.label}`;

      ctx.save();
      ctx.font = '700 10px Inter, sans-serif';
      const w1 = ctx.measureText(line1).width;
      ctx.font = '500 8.5px "JetBrains Mono", monospace';
      const w2 = ctx.measureText(line2).width;

      const tipW = Math.min(plot.w - 12, Math.max(w1, w2) + 18);
      const tipH = 36;
      let tx = node._sx + 12;
      if (tx + tipW > plot.x + plot.w - 4) tx = node._sx - tipW - 12;
      tx = Math.max(plot.x + 4, Math.min(plot.x + plot.w - tipW - 4, tx));
      let ty = node._sy - tipH - 10;
      if (ty < plot.y + 4) ty = node._sy + 14;
      ty = Math.max(plot.y + 4, Math.min(plot.y + plot.h - tipH - 4, ty));

      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      roundRectPath(ctx, tx, ty, tipW, tipH, 5);
      ctx.fillStyle = 'rgba(8, 12, 24, 0.95)';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = node.color;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 9.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(line1, tx + 8, ty + 6, tipW - 16);

      ctx.fillStyle = node.color;
      ctx.font = '500 8px "JetBrains Mono", monospace';
      ctx.fillText(line2, tx + 8, ty + 20, tipW - 16);
      ctx.restore();
    }

    // --- Lower Console: Left Mini-Sim Card ---
    _drawMiniSimCard(ctx, card, isNarrow) {
      const activeCtx = this._getActiveContext();
      const node = activeCtx.node;
      const borderCol = activeCtx.isUniversal
        ? 'rgba(56, 189, 248, 0.40)'
        : (node ? node.color + '66' : '#1e293b');
      this._drawPanelFrame(ctx, card, borderCol);
      if (card.w < 50 || card.h < 40) return;

      const headerH = card.h < 120 ? 18 : 22;

      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, card.x, card.y, card.w, card.h, 7);
      ctx.clip();

      // Header bar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(card.x, card.y, card.w, headerH);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(card.x, card.y + headerH);
      ctx.lineTo(card.x + card.w, card.y + headerH);
      ctx.stroke();

      ctx.font = `700 ${isNarrow ? 8.5 : 9.5}px Inter, sans-serif`;
      ctx.fillStyle = activeCtx.isUniversal ? '#38bdf8' : (node ? node.color : '#00e5ff');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const headerTitle = activeCtx.isUniversal
        ? 'RĂSPUNS UNIVERSAL SDOF & CURBĂ BODE (BALEIAJ)'
        : `MINI-SIMULARE LIVE: ${node.shortLabel.toUpperCase()}`;
      ctx.fillText(headerTitle, card.x + 8, card.y + headerH / 2, card.w - 16);

      const simBox = {
        x: card.x + 6,
        y: card.y + headerH + 4,
        w: Math.max(20, card.w - 12),
        h: Math.max(20, card.h - headerH - 8)
      };

      const t = this.time;
      if (activeCtx.isUniversal) {
        this._drawUniversalSDOFSweep(ctx, simBox, t, node);
      } else {
        const ampFactor = Math.min(2.2, Math.max(0.25, 1.0 / this.dampingMult));
        this._drawMiniSim(ctx, simBox, node.miniSimKey, t, ampFactor, node.color);
      }

      ctx.restore();
    }

    // --- Lower Console: Right Engineering Telemetry & ODE Card ---
    _drawTelemetryCard(ctx, card, isNarrow) {
      const activeCtx = this._getActiveContext();
      const node = activeCtx.node;
      const borderCol = activeCtx.isUniversal
        ? 'rgba(56, 189, 248, 0.35)'
        : (node ? node.color + '55' : '#1e293b');
      this._drawPanelFrame(ctx, card, borderCol);
      if (card.w < 60 || card.h < 40) return;

      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, card.x, card.y, card.w, card.h, 7);
      ctx.clip();

      const pad = card.h < 130 ? 7 : 10;
      const innerW = Math.max(20, card.w - pad * 2);
      const compact = card.h < 155;
      let y = card.y + pad;

      const cursorHz = Math.pow(10, this.logFreq);
      const refNode = node;
      const baseQ = activeCtx.isUniversal ? UNIVERSAL_SDOF_Q : refNode.Q;
      const qEff = Math.max(0.5, baseQ / this.dampingMult);
      const fDisplay = activeCtx.isUniversal ? cursorHz : refNode.f0;
      const bwEff = fDisplay / qEff;

      // 1. Title + Category Badge + Slide Reference
      const titleText = activeCtx.isUniversal
        ? `Baleiaj Universal SDOF (${formatFreq(cursorHz)})`
        : refNode.title;
      const slideTag = activeCtx.isUniversal
        ? (refNode ? `Cel mai apropiat: ${refNode.shortLabel}` : 'SDOF')
        : refNode.slideRef;
      const catMeta = activeCtx.isUniversal
        ? { label: 'Mod Baleiaj', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.45)' }
        : (CATEGORY_META[refNode.category] || CATEGORY_META.hightech);

      ctx.font = `700 ${compact ? 10 : 11.5}px Inter, sans-serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(titleText, card.x + pad, y, innerW - 72);

      // Slide / Category pill on right
      ctx.font = `700 ${compact ? 7.5 : 8}px "JetBrains Mono", monospace`;
      const pillTxt = slideTag;
      const pillW = Math.min(110, ctx.measureText(pillTxt).width + 10);
      const pillH = compact ? 14 : 16;
      ctx.beginPath();
      roundRectPath(ctx, card.x + card.w - pad - pillW, y, pillW, pillH, 4);
      ctx.fillStyle = catMeta.bg;
      ctx.fill();
      ctx.strokeStyle = catMeta.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = catMeta.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillTxt, card.x + card.w - pad - pillW / 2, y + pillH / 2, pillW - 4);

      y += (compact ? 17 : 21);

      // Category sub-tag (only if enough vertical space)
      if (!compact && card.h >= 175) {
        ctx.font = '600 8.5px Inter, sans-serif';
        ctx.fillStyle = catMeta.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`● ${catMeta.label}`, card.x + pad, y);
        y += 14;
      }

      // 2. Governing ODE Box
      const eqStr = activeCtx.isUniversal
        ? 'm·ẍ + (mω₀/Q_ef)·ẋ + k·x = F₀·cos(ωt)   [|H(ω)| = 1/√((1−r²)² + (r/Q_ef)²)]'
        : refNode.eqUnicode;
      ctx.font = `600 ${compact ? 8 : (isNarrow ? 8.5 : 9.5)}px "JetBrains Mono", monospace`;
      const eqLines = this._wrapText(ctx, eqStr, innerW - 14).slice(0, 2);
      const eqLineH = compact ? 11 : 13;
      const eqBoxH = eqLines.length * eqLineH + (compact ? 8 : 10);

      ctx.beginPath();
      roundRectPath(ctx, card.x + pad, y, innerW, eqBoxH, 5);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let i = 0; i < eqLines.length; i++) {
        ctx.fillText(eqLines[i], card.x + pad + 7, y + (compact ? 4 : 5) + i * eqLineH, innerW - 14);
      }
      y += eqBoxH + (compact ? 5 : 8);

      // 3. Three Live Metric Tiles: f0, Q_eff, Bandwidth df_eff
      const tileGap = 6;
      const tileW = (innerW - tileGap * 2) / 3;
      const tileH = compact ? 28 : 36;
      const tiles = [
        {
          lbl: activeCtx.isUniversal ? 'Frecvență Cursor' : 'Frecvență f₀',
          val: formatFreq(fDisplay),
          col: '#00e5ff'
        },
        {
          lbl: this.dampingMult !== 1.0 ? 'Factor Q_ef' : 'Factor Q tipic',
          val: formatQ(qEff),
          col: '#ffab40'
        },
        {
          lbl: 'Bandă Δf = f₀/Q',
          val: formatBw(bwEff),
          col: '#69f0ae'
        }
      ];

      for (let i = 0; i < 3; i++) {
        const tx = card.x + pad + i * (tileW + tileGap);
        ctx.beginPath();
        roundRectPath(ctx, tx, y, tileW, tileH, 4);
        ctx.fillStyle = 'rgba(21, 28, 50, 0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `500 ${compact ? 6.8 : 7.5}px Inter, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(tiles[i].lbl, tx + 6, y + (compact ? 3 : 4), tileW - 10);

        ctx.font = `700 ${compact ? 8.5 : 10}px "JetBrains Mono", monospace`;
        ctx.fillStyle = tiles[i].col;
        ctx.fillText(tiles[i].val, tx + 6, y + (compact ? 14 : 18), tileW - 10);
      }
      y += tileH + (compact ? 5 : 8);

      // 4. Regime & Engineering Metrics
      const remH = card.y + card.h - y - 4;
      if (remH >= 14) {
        const regimeStr = activeCtx.isUniversal
          ? `Regim: Răspuns SDOF variabil • Multiplicator amortizare ${this.dampingMult.toFixed(1)}× (Q_ef = ${formatQ(qEff)})`
          : `Regim: ${refNode.regimeDesc}`;
        const metricStr = activeCtx.isUniversal
          ? `Cel mai apropiat nod: ${refNode ? refNode.title + ' (' + formatFreq(refNode.f0) + ')' : '—'}`
          : `Metrici: ${refNode.metricLabel}`;

        const bodyFontSize = compact ? 7.5 : 8.5;
        const lineH = compact ? 10 : 12;
        ctx.font = `500 ${bodyFontSize}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const rLines = this._wrapText(ctx, regimeStr, innerW);
        ctx.fillStyle = '#cbd5e1';
        for (let i = 0; i < rLines.length && y + lineH <= card.y + card.h - 2; i++) {
          ctx.fillText(rLines[i], card.x + pad, y, innerW);
          y += lineH;
        }

        const mLines = this._wrapText(ctx, metricStr, innerW);
        ctx.fillStyle = '#94a3b8';
        for (let i = 0; i < mLines.length && y + lineH <= card.y + card.h - 2; i++) {
          ctx.fillText(mLines[i], card.x + pad, y, innerW);
          y += lineH;
        }
      }

      ctx.restore();
    }

    _wrapText(ctx, text, maxWidth) {
      if (!text) return [];
      const words = String(text).split(/\s+/);
      const lines = [];
      let current = '';
      for (let i = 0; i < words.length; i++) {
        const test = current ? current + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width <= maxWidth || !current) {
          current = test;
        } else {
          lines.push(current);
          current = words[i];
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    // --- Universal SDOF / Bode Resonance Sweep Mode ---
    _drawUniversalSDOFSweep(ctx, box, t, nearestNode) {
      const splitX = Math.round(box.w * 0.42);
      const oscBox = { x: box.x, y: box.y, w: splitX - 4, h: box.h };
      const bodeBox = { x: box.x + splitX + 2, y: box.y, w: box.w - splitX - 2, h: box.h };

      // Left: Driven SDOF mass-spring-damper
      const qEff = Math.max(0.5, UNIVERSAL_SDOF_Q / this.dampingMult);
      const refLog = nearestNode ? nearestNode.logF : 1.78;
      const ratio = Math.pow(10, this.logFreq - refLog);
      const rClamped = Math.max(0.2, Math.min(2.5, ratio));
      const gain = 1.0 / Math.sqrt(Math.pow(1 - rClamped * rClamped, 2) + Math.pow(rClamped / qEff, 2));
      const normAmp = Math.min(1.0, gain / Math.max(1.5, qEff * 0.65));

      const wallY = oscBox.y + 12;
      const eqY = oscBox.y + oscBox.h * 0.56;
      const maxDisp = Math.max(6, oscBox.h * 0.24);
      const visualFreq = 1.6 + ((this.logFreq - SLIDER_LOG_MIN) / (SLIDER_LOG_MAX - SLIDER_LOG_MIN)) * 5.0;
      const disp = maxDisp * (0.25 + 0.75 * normAmp) * Math.sin(visualFreq * t * Math.PI);
      const massY = eqY + disp;
      const cx = oscBox.x + oscBox.w * 0.5;

      // Support beam
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 26, wallY);
      ctx.lineTo(cx + 26, wallY);
      ctx.stroke();

      // Spring + Damper using BaseSim helpers
      this.drawSpring(cx - 10, wallY, massY - 11, 6, 5, '#00e5ff', 1.4);
      this.drawDamper(cx + 12, wallY, massY - 11, 10, '#ffab40');

      // Mass block
      const bw = 34;
      const bh = 22;
      ctx.beginPath();
      roundRectPath(ctx, cx - bw / 2, massY - bh / 2, bw, bh, 4);
      ctx.fillStyle = normAmp > 0.65 ? '#ff5252' : '#00e5ff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#060a14';
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('m', cx, massY);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 7.5px "JetBrains Mono", monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`|H| = ${gain.toFixed(1)}×`, cx, oscBox.y + oscBox.h - 2);

      // Right: Live Bode Amplitude Curve |H(r)|
      const padL = 22;
      const padR = 8;
      const padT = 10;
      const padB = 16;
      const px = bodeBox.x + padL;
      const py = bodeBox.y + padT;
      const pw = Math.max(20, bodeBox.w - padL - padR);
      const ph = Math.max(20, bodeBox.h - padT - padB);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundRectPath(ctx, px, py, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Resonance peak curve
      const maxPeakPlot = Math.max(2.0, qEff);
      ctx.beginPath();
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const r = 0.2 + u * 2.3;
        const mag = 1.0 / Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / qEff, 2));
        const normH = Math.min(1.0, mag / maxPeakPlot);
        const gx = px + u * pw;
        const gy = py + ph - 3 - normH * (ph - 8);
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Cursor point on Bode
      const curU = Math.max(0, Math.min(1, (rClamped - 0.2) / 2.3));
      const curX = px + curU * pw;
      const curY = py + ph - 3 - Math.min(1.0, gain / maxPeakPlot) * (ph - 8);
      ctx.strokeStyle = 'rgba(255, 171, 64, 0.55)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(curX, py);
      ctx.lineTo(curX, py + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      safeArc(ctx, curX, curY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffab40';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`Curbă Bode • Q_ef = ${formatQ(qEff)}`, px + pw / 2, py + ph + 3, pw);
    }

    // --- 14 Distinct Live Animated Mini-Simulations ---
    _drawMiniSim(ctx, box, key, t, ampFactor, color) {
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;

      switch (key) {
        case 'tacoma': {
          // Twisting H-girder deck + Karman vortex swirls
          const theta = 0.42 * ampFactor * Math.sin(3.4 * t);
          // Wind arrows from left
          for (let i = -1; i <= 1; i++) {
            const wy = cy + i * Math.min(18, box.h * 0.18);
            const wx = box.x + 8 + ((t * 45 + (i + 1) * 14) % 36);
            this.drawArrow(wx, wy, wx + 18, wy, 'rgba(56, 189, 248, 0.55)', 1.3);
          }
          // Shedding Karman vortices downwind
          for (let v = 0; v < 4; v++) {
            const phase = (t * 1.4 + v * 0.25) % 1;
            const vx = cx + 32 + phase * (box.w * 0.36);
            const vy = cy + Math.sin(phase * 10 + v * 3) * 14 * (v % 2 === 0 ? 1 : -1);
            ctx.strokeStyle = `rgba(255, 82, 82, ${(1 - phase) * 0.65})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            safeArc(ctx, vx, vy, 5 + phase * 8, 0, Math.PI * 1.6);
            ctx.stroke();
          }
          // H-girder cross section
          ctx.save();
          ctx.translate(cx - 8, cy);
          ctx.rotate(theta);
          const deckW = Math.min(82, box.w * 0.34);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-deckW / 2, -4, deckW, 8);
          ctx.fillStyle = '#ff5252';
          ctx.fillRect(-deckW / 2, -16, 6, 32);
          ctx.fillRect(deckW / 2 - 6, -16, 6, 32);
          ctx.restore();
          this._miniLabel(ctx, box, `Torsiune θ = ${(theta * 57.3).toFixed(0)}°`, '#ff5252');
          break;
        }

        case 'millennium': {
          // Top-view curved bridge deck swaying laterally + synchronized pedestrians
          const sway = Math.min(14, box.h * 0.12) * ampFactor * Math.sin(2.9 * t);
          const deckH = Math.min(34, box.h * 0.34);
          ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
          ctx.strokeStyle = '#ff5252';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          roundRectPath(ctx, box.x + 16, cy - deckH / 2 + sway, box.w - 32, deckH, 6);
          ctx.fill();
          ctx.stroke();

          // Synchronized pedestrians walking & swaying laterally
          const count = 9;
          for (let i = 0; i < count; i++) {
            const px = box.x + 28 + (i / (count - 1)) * (box.w - 56);
            const py = cy + sway + Math.sin(2.9 * t + i * 0.15) * 4 * ampFactor;
            ctx.beginPath();
            safeArc(ctx, px, py, 4.2, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 === 0 ? '#ffab40' : '#ff5252';
            ctx.fill();
          }
          this._miniLabel(ctx, box, 'Sincronizare Kuramoto • Balans lateral', '#ff5252');
          break;
        }

        case 'seismic10': {
          // 10-story frame swaying in 1st bending mode over shaking ground
          const baseX = Math.sin(5.0 * t) * 5;
          const topU = Math.min(24, box.w * 0.11) * ampFactor * Math.sin(3.1 * t);
          const bW = Math.min(48, box.w * 0.24);
          const bH = Math.max(40, box.h - 32);
          const botY = box.y + box.h - 14;
          const stories = 10;

          // Shaking ground
          ctx.fillStyle = '#334155';
          ctx.fillRect(cx - bW * 0.9 + baseX, botY, bW * 1.8, 7);

          let prevL = cx - bW / 2 + baseX;
          let prevR = cx + bW / 2 + baseX;
          let prevY = botY;
          for (let s = 1; s <= stories; s++) {
            const frac = s / stories;
            const mode = Math.sin(frac * Math.PI * 0.5);
            const u = baseX * (1 - frac * 0.3) + topU * mode;
            const sy = botY - frac * (bH - 6);
            const lx = cx - bW / 2 + u;
            const rx = cx + bW / 2 + u;
            const stress = Math.min(1, Math.abs(topU) / 18);
            ctx.strokeStyle = stress > 0.65 ? '#ff5252' : '#ffab40';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(prevL, prevY); ctx.lineTo(lx, sy);
            ctx.moveTo(prevR, prevY); ctx.lineTo(rx, sy);
            ctx.moveTo(lx, sy); ctx.lineTo(rx, sy);
            ctx.stroke();
            prevL = lx; prevR = rx; prevY = sy;
          }
          this._miniLabel(ctx, box, 'Mod fundamental 10 etaje • T₀ = 1.0 s', '#ff5252');
          break;
        }

        case 'rotor': {
          // End-view bearing clearance + orbiting Jeffcott shaft + eccentric mass
          const R = Math.min(box.w, box.h) * 0.34;
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.beginPath();
          safeArc(ctx, cx, cy - 4, R, 0, Math.PI * 2);
          ctx.stroke();

          const orbitR = R * 0.44 * Math.min(1.2, ampFactor);
          const w = 5.5;
          const sx = cx + orbitR * Math.cos(w * t);
          const sy = cy - 4 + orbitR * Math.sin(w * t);

          // Whirl trail
          ctx.strokeStyle = 'rgba(255, 82, 82, 0.45)';
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          safeArc(ctx, cx, cy - 4, orbitR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Shaft disk
          ctx.beginPath();
          safeArc(ctx, sx, sy, Math.max(6, R * 0.34), 0, Math.PI * 2);
          ctx.fillStyle = '#1e293b';
          ctx.fill();
          ctx.strokeStyle = '#ff5252';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Eccentric mass G lagging 90 deg at resonance
          const gx = sx + Math.max(5, R * 0.25) * Math.cos(w * t - Math.PI * 0.5);
          const gy = sy + Math.max(5, R * 0.25) * Math.sin(w * t - Math.PI * 0.5);
          ctx.beginPath();
          safeArc(ctx, gx, gy, 3.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffab40';
          ctx.fill();
          this._miniLabel(ctx, box, 'Orbită critică 50 Hz • Defazaj δ = 90°', '#ff5252');
          break;
        }

        case 'tmd': {
          // Skyscraper silhouette + anti-phase 660t golden spherical pendulum
          const bSway = 5 * ampFactor * Math.sin(2.4 * t);
          const pSway = -16 * ampFactor * Math.sin(2.4 * t);
          const bW = Math.min(54, box.w * 0.26);
          const bH = Math.max(44, box.h - 26);
          const botY = box.y + box.h - 10;

          // Tapered Taipei 101 frame
          ctx.strokeStyle = '#38bdf8';
          ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cx - bW / 2, botY);
          ctx.lineTo(cx - bW * 0.38 + bSway, botY - bH);
          ctx.lineTo(cx + bW * 0.38 + bSway, botY - bH);
          ctx.lineTo(cx + bW / 2, botY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // TMD Pendulum in upper chamber
          const pivX = cx + bSway * 0.85;
          const pivY = botY - bH * 0.82;
          const bobX = pivX + pSway;
          const bobY = pivY + Math.min(28, bH * 0.42);
          ctx.strokeStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(pivX, pivY);
          ctx.lineTo(bobX, bobY);
          ctx.stroke();

          ctx.beginPath();
          safeArc(ctx, bobX, bobY, 8.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffab40';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
          this._miniLabel(ctx, box, 'Pendul 660 t în antifază (−75% balans)', '#ffab40');
          break;
        }

        case 'lrb': {
          // Rapidly shaking ground slab decoupled from calm upper structure via LRB pads
          const xg = 11 * Math.sin(5.2 * t);
          const xb = 2.0 * ampFactor * Math.sin(5.2 * t - 2.6);
          const w = Math.min(100, box.w * 0.48);
          const slabY = box.y + box.h - 22;

          // Shaking base slab
          ctx.fillStyle = '#475569';
          ctx.fillRect(cx - w / 2 + xg, slabY, w, 9);

          // Upper calm building
          const bH = Math.max(26, box.h * 0.38);
          const bBot = slabY - 14;
          ctx.fillStyle = 'rgba(255, 171, 64, 0.18)';
          ctx.strokeStyle = '#ffab40';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          roundRectPath(ctx, cx - w * 0.42 + xb, bBot - bH, w * 0.84, bH, 4);
          ctx.fill();
          ctx.stroke();

          // Shearing LRB elastomeric bearings
          [-w * 0.28, w * 0.28].forEach((ox) => {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx + ox + xg, slabY);
            ctx.lineTo(cx + ox + xb, bBot);
            ctx.stroke();
          });
          this._miniLabel(ctx, box, 'Izolare la bază LRB • −80% accelerație', '#ffab40');
          break;
        }

        case 'dampers': {
          // Bridge deck underside + telescopic hydraulic damper pistons
          const yOff = 4 * ampFactor * Math.sin(3.2 * t);
          const deckW = Math.min(130, box.w * 0.62);
          ctx.fillStyle = '#334155';
          ctx.fillRect(cx - deckW / 2, box.y + 18 + yOff, deckW, 10);

          // Two diagonal viscous dampers to abutment piers
          this.drawDamper(cx - 28, box.y + 28 + yOff, box.y + box.h - 20, 10, '#ffab40');
          this.drawDamper(cx + 28, box.y + 28 + yOff, box.y + box.h - 20, 10, '#ffab40');

          ctx.fillStyle = '#475569';
          ctx.fillRect(cx - deckW * 0.45, box.y + box.h - 20, deckW * 0.9, 6);
          this._miniLabel(ctx, box, 'Amortizoare vâscoase • ζ_ef ≈ 9.1%', '#ffab40');
          break;
        }

        case 'helmholtz': {
          // Cavity resonator bottle: strong red waves left -> attenuated cyan waves inside
          const neckW = 28;
          const neckH = 16;
          const cavW = Math.min(68, box.w * 0.34);
          const cavH = Math.min(54, box.h * 0.56);
          const x0 = cx - (neckW + cavW) / 2 + 12;

          // Bottle contour
          ctx.strokeStyle = '#ffab40';
          ctx.fillStyle = 'rgba(255, 171, 64, 0.12)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x0, cy - neckH / 2);
          ctx.lineTo(x0 + neckW, cy - neckH / 2);
          ctx.lineTo(x0 + neckW, cy - cavH / 2);
          ctx.lineTo(x0 + neckW + cavW, cy - cavH / 2);
          ctx.lineTo(x0 + neckW + cavW, cy + cavH / 2);
          ctx.lineTo(x0 + neckW, cy + cavH / 2);
          ctx.lineTo(x0 + neckW, cy + neckH / 2);
          ctx.lineTo(x0, cy + neckH / 2);
          ctx.stroke();
          ctx.fill();

          // Incident sound waves (left)
          for (let i = 0; i < 3; i++) {
            const r = 10 + ((t * 28 + i * 12) % 36);
            ctx.strokeStyle = `rgba(255, 82, 82, ${1 - r / 48})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            safeArc(ctx, x0 - 4, cy, r, -0.7, 0.7);
            ctx.stroke();
          }
          // Oscillating air plug in neck
          const plugX = x0 + neckW * 0.5 + 5 * ampFactor * Math.sin(6.5 * t);
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(plugX - 4, cy - neckH / 2 + 2, 8, neckH - 4);
          this._miniLabel(ctx, box, 'Cavitate Helmholtz • Atenuare −18 dB', '#ffab40');
          break;
        }

        case 'artndt': {
          // Turbine blade mode 2 vibration + green Doppler laser + mini Lorentzian FFT
          const bladeW = Math.min(110, box.w * 0.48);
          const bx = box.x + 18;
          const by = cy - 4;
          const amp = 7 * ampFactor * Math.sin(7.0 * t);

          // Clamped root
          ctx.fillStyle = '#475569';
          ctx.fillRect(bx - 8, by - 14, 8, 28);

          // Bending blade
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 4;
          ctx.beginPath();
          for (let s = 0; s <= 20; s++) {
            const u = s / 20;
            const px = bx + u * bladeW;
            const py = by + amp * Math.sin(u * Math.PI * 1.5) * u;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();

          // Green LDV laser beam
          const lx = bx + bladeW * 0.72;
          const ly = by + amp * Math.sin(0.72 * Math.PI * 1.5) * 0.72;
          ctx.strokeStyle = '#69f0ae';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(lx, box.y + 8);
          ctx.lineTo(lx, ly);
          ctx.stroke();
          ctx.beginPath();
          safeArc(ctx, lx, ly, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = '#69f0ae';
          ctx.fill();

          // Mini Lorentzian peak on right
          const fx = box.x + box.w - 48;
          const fy = box.y + box.h - 22;
          ctx.strokeStyle = '#ffab40';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          const gamma = 0.14 * this.dampingMult;
          for (let i = -18; i <= 18; i++) {
            const d = i / 18;
            const h = (gamma * gamma) / (d * d + gamma * gamma);
            const gx = fx + 18 + i;
            const gy = fy - h * 26;
            if (i === -18) ctx.moveTo(gx, gy);
            else ctx.lineTo(gx, gy);
          }
          ctx.stroke();
          this._miniLabel(ctx, box, 'Laser LDV + Spectru FFT • f₂ = 1.35 kHz', '#ffab40');
          break;
        }

        case 'huygens': {
          // Common beam + two pendulums in 180° anti-phase
          const beamW = Math.min(120, box.w * 0.56);
          const beamY = box.y + 20;
          const beamX = 2.5 * Math.sin(3.0 * t);
          ctx.strokeStyle = '#ffab40';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx - beamW / 2 + beamX, beamY);
          ctx.lineTo(cx + beamW / 2 + beamX, beamY);
          ctx.stroke();

          const len = Math.min(44, box.h - 42);
          const th1 = 0.42 * ampFactor * Math.sin(3.0 * t);
          const th2 = -th1; // Anti-phase 180 deg
          const p1x = cx - beamW * 0.25 + beamX;
          const p2x = cx + beamW * 0.25 + beamX;

          [
            { px: p1x, th: th1, col: '#00e5ff' },
            { px: p2x, th: th2, col: '#69f0ae' }
          ].forEach((pend) => {
            const bx = pend.px + len * Math.sin(pend.th);
            const by = beamY + len * Math.cos(pend.th);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(pend.px, beamY);
            ctx.lineTo(bx, by);
            ctx.stroke();
            ctx.beginPath();
            safeArc(ctx, bx, by, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = pend.col;
            ctx.fill();
          });
          this._miniLabel(ctx, box, 'Sincronizare în antifază (180°)', '#00e5ff');
          break;
        }

        case 'harvester': {
          // Vibrating motor block + PZT cantilever + Duffing magnet + bridge rectifier + cap -> RF packet
          const bx = box.x + Math.max(12, box.w * 0.06);
          const cantLen = Math.min(82, box.w * 0.25);
          const vib = Math.min(14, box.h * 0.12) * ampFactor * Math.sin(5.2 * t);
          const motorY = cy + vib * 0.15;

          // Motor clamp block
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.2;
          ctx.fillRect(bx, motorY - 14, 20, 28);
          ctx.strokeRect(bx, motorY - 14, 20, 28);

          // Bending PZT bimorph beam
          ctx.strokeStyle = '#69f0ae';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(bx + 20, motorY);
          ctx.quadraticCurveTo(bx + 20 + cantLen * 0.5, motorY + vib * 0.35, bx + 20 + cantLen, motorY + vib);
          ctx.stroke();

          // Tungsten tip mass + repulsive magnet indicator
          const tipX = bx + 20 + cantLen;
          const tipY = motorY + vib;
          ctx.fillStyle = '#ffab40';
          ctx.fillRect(tipX - 4, tipY - 6, 10, 12);
          ctx.fillStyle = '#ff5252';
          ctx.fillRect(tipX + 12, cy - 5, 5, 10);

          // Connecting wires to rectifier + storage cap
          const rectX = tipX + 28;
          const capX = Math.min(box.x + box.w - 78, rectX + 34);
          if (capX > rectX + 14) {
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bx + 22, motorY - 3);
            ctx.lineTo(rectX, cy - 8);
            ctx.moveTo(bx + 22, motorY + 3);
            ctx.lineTo(rectX, cy + 8);
            ctx.stroke();

            // Bridge rectifier diamond
            ctx.strokeStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(rectX, cy - 11);
            ctx.lineTo(rectX + 11, cy);
            ctx.lineTo(rectX, cy + 11);
            ctx.lineTo(rectX - 11, cy);
            ctx.closePath();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(rectX + 11, cy);
            ctx.lineTo(capX, cy);
            ctx.stroke();
          }

          // Storage capacitor bar charging 0 -> 3.3V
          const cycle = (t * 0.45 * Math.max(0.5, ampFactor)) % 1;
          const capW = Math.max(36, Math.min(72, box.w * 0.22));
          const capY = cy - 12;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          roundRectPath(ctx, capX, capY, capW, 24, 3);
          ctx.stroke();
          ctx.fillStyle = cycle > 0.85 ? '#69f0ae' : '#00e5ff';
          ctx.fillRect(capX + 2, capY + 2, Math.max(2, (capW - 4) * cycle), 20);

          // IoT Antenna & RF packet arc on TX
          const antX = capX + capW + 12;
          if (antX < box.x + box.w - 10) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(capX + capW, cy);
            ctx.lineTo(antX, cy);
            ctx.lineTo(antX, cy - 14);
            ctx.stroke();
            if (cycle > 0.78) {
              const p = (cycle - 0.78) / 0.22;
              ctx.strokeStyle = `rgba(105, 240, 174, ${1 - p})`;
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              safeArc(ctx, antX + 2, cy - 12, 4 + p * 16, -0.9, 0.9);
              ctx.stroke();
            }
          }
          this._miniLabel(ctx, box, `Nod IoT Duffing • V_cap = ${(cycle * 3.3).toFixed(2)} V`, '#69f0ae');
          break;
        }

        case 'mems': {
          // MEMS proof mass moving in 2D Lissajous ellipse inside serpentine springs + comb fingers
          const frameW = Math.min(126, box.w * 0.44);
          const frameH = Math.min(74, box.h * 0.62);
          const fcx = box.x + box.w * 0.36;
          const fcy = cy - 4;
          const mx = fcx + Math.min(10, frameW * 0.10) * ampFactor * Math.cos(4.2 * t);
          const my = fcy + Math.min(8, frameH * 0.12) * ampFactor * Math.sin(4.2 * t);

          // Outer fixed silicon frame
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.6;
          ctx.strokeRect(fcx - frameW / 2, fcy - frameH / 2, frameW, frameH);

          // 4 Folded-flexure serpentine tethers
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(fcx - frameW / 2, fcy); ctx.lineTo(mx - 16, my);
          ctx.moveTo(fcx + frameW / 2, fcy); ctx.lineTo(mx + 16, my);
          ctx.moveTo(fcx, fcy - frameH / 2); ctx.lineTo(mx, my - 13);
          ctx.moveTo(fcx, fcy + frameH / 2); ctx.lineTo(mx, my + 13);
          ctx.stroke();

          // Capacitive comb fingers (left/right)
          ctx.strokeStyle = '#ffab40';
          ctx.lineWidth = 1.1;
          for (let f = -1; f <= 1; f++) {
            ctx.beginPath();
            ctx.moveTo(mx - 16, my + f * 6); ctx.lineTo(mx - 23, my + f * 6);
            ctx.moveTo(mx + 16, my + f * 6); ctx.lineTo(mx + 23, my + f * 6);
            ctx.stroke();
          }

          // Proof mass
          ctx.fillStyle = 'rgba(0, 229, 255, 0.24)';
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1.5;
          ctx.fillRect(mx - 16, my - 13, 32, 26);
          ctx.strokeRect(mx - 16, my - 13, 32, 26);

          // Lissajous scope box on right
          const lx = box.x + box.w * 0.78;
          const ly = cy - 4;
          const lr = Math.min(26, box.w * 0.12, box.h * 0.28);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.strokeRect(lx - lr - 6, ly - lr - 4, (lr + 6) * 2, (lr + 4) * 2);
          ctx.strokeStyle = '#69f0ae';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(lx, ly, lr * 0.85, Math.max(2, lr * 0.55 * Math.min(1.3, ampFactor)), 0.35, 0, Math.PI * 2);
          ctx.stroke();
          this._miniLabel(ctx, box, 'Elipsă Coriolis • Q_vid = 5×10⁴', '#00e5ff');
          break;
        }

        case 'afm': {
          // Silicon cantilever tapping over sinusoidal Si(111) atomic hills
          const atomY = box.y + box.h - 22;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let x = box.x + 14; x <= box.x + box.w - 14; x += 3) {
            const y = atomY - 5 * Math.sin((x + t * 24) * 0.22);
            if (x === box.x + 14) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          const tipDefl = 7 * ampFactor * Math.sin(7.2 * t);
          const cantX = cx - 34;
          const cantY = cy - 10;
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cantX, cantY);
          ctx.lineTo(cx + 6, cantY + tipDefl);
          ctx.stroke();
          // Tip
          ctx.beginPath();
          ctx.moveTo(cx, cantY + tipDefl);
          ctx.lineTo(cx + 6, cantY + tipDefl);
          ctx.lineTo(cx + 3, cantY + tipDefl + 11);
          ctx.closePath();
          ctx.fillStyle = '#00e5ff';
          ctx.fill();

          // Laser reflection to photodiode
          ctx.strokeStyle = '#ff5252';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(cx - 12, box.y + 8);
          ctx.lineTo(cx + 3, cantY + tipDefl);
          ctx.lineTo(cx + 34, box.y + 12 + tipDefl * 0.6);
          ctx.stroke();
          this._miniLabel(ctx, box, 'Cantilever 150 kHz • Forță van der Waals', '#00e5ff');
          break;
        }

        case 'eswl':
        default: {
          // Ellipsoidal reflector focusing converging shockwaves onto stone inside kidney + cavitation
          const rx = box.x + box.w * 0.16;
          const stoneX = box.x + box.w * 0.70;
          const stoneY = cy - 4;
          const refR = Math.min(34, box.h * 0.34);

          // Ellipsoidal transducer cup
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          safeArc(ctx, rx + 14, stoneY, refR, Math.PI * 0.65, Math.PI * 1.35);
          ctx.stroke();

          // Stylized kidney cross-section contour around F2
          ctx.strokeStyle = 'rgba(255, 82, 82, 0.45)';
          ctx.fillStyle = 'rgba(255, 82, 82, 0.08)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(stoneX, stoneY, Math.min(46, box.w * 0.16), Math.min(34, box.h * 0.32), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Converging wavefronts toward stone F2
          for (let i = 0; i < 3; i++) {
            const p = (t * 1.4 + i * 0.33) % 1;
            const wx = rx + p * (stoneX - rx);
            const r = Math.max(4, refR * 0.9 * (1 - p * 0.72));
            ctx.strokeStyle = `rgba(105, 240, 174, ${1 - p * 0.6})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            safeArc(ctx, wx - r * 0.5, stoneY, r, -0.5, 0.5);
            ctx.stroke();
          }

          // Kidney stone + micro-cracks
          ctx.beginPath();
          safeArc(ctx, stoneX, stoneY, 12, 0, Math.PI * 2);
          ctx.fillStyle = '#ffab40';
          ctx.fill();
          ctx.strokeStyle = '#ff5252';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(stoneX - 5, stoneY - 4);
          ctx.lineTo(stoneX + 1, stoneY + 1);
          ctx.lineTo(stoneX + 6, stoneY - 3);
          ctx.stroke();

          // Pulsing Rayleigh-Plesset cavitation bubbles
          for (let b = 0; b < 5; b++) {
            const br = 2.0 + 2.4 * Math.abs(Math.sin(t * 6 + b * 1.4)) * Math.min(1.4, ampFactor);
            ctx.beginPath();
            safeArc(ctx, stoneX + Math.cos(b * 1.25) * 19, stoneY + Math.sin(b * 1.25) * 16, br, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.stroke();
          }
          this._miniLabel(ctx, box, 'Cavitație Rayleigh-Plesset • +40/−10 MPa', '#69f0ae');
          break;
        }
      }
    }

    _miniLabel(ctx, box, text, col) {
      ctx.save();
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.fillStyle = col || '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, box.x + box.w / 2, box.y + box.h - 2, box.w - 10);
      ctx.restore();
    }
  }

  window.SynthesisMatrixSim = SynthesisMatrixSim;
})();
