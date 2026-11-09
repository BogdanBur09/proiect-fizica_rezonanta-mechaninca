/* ============================================================
   APP.JS — Main Application Controller
   Initializes all systems, manages slide navigation,
   creates slides from SlidesData, binds keyboard shortcuts
   ============================================================ */

(function () {
  'use strict';

  const App = {
    currentSlide: 0,
    totalSlides: 0,
    simulations: {},    // slideId -> sim instance
    _wrapper: null,
    _select: null,
    _counter: null,
    _prevBtn: null,
    _nextBtn: null,

    init() {
      // Init subsystems
      ScaleManager.init();
      SettingsManager.init();

      // Cache DOM refs
      this._appContainer = document.getElementById('app-container');
      this._wrapper = document.getElementById('slide-wrapper');
      this._select = document.getElementById('slide-select');
      this._counter = document.querySelector('.topbar__slide-counter');
      this._prevBtn = document.getElementById('prev-btn');
      this._nextBtn = document.getElementById('next-btn');
      this._tabBtnSim = document.getElementById('tab-btn-sim');
      this._tabBtnTheory = document.getElementById('tab-btn-theory');

      // Default mobile view: simulation active
      this.currentMobileTab = 'simulation';
      if (this._appContainer) {
        this._appContainer.classList.add('view-sim');
      }

      if (this._tabBtnSim && this._tabBtnTheory) {
        this._tabBtnSim.addEventListener('click', () => this.setMobileTab('simulation'));
        this._tabBtnTheory.addEventListener('click', () => this.setMobileTab('theory'));
      }

      // Orientation change / window resize handler for active simulation
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          const sim = this.simulations[this.currentSlide];
          if (sim) { sim.resize(); sim.render(); }
        }, 120);
      });

      this.totalSlides = SlidesData.length;

      // Build slide elements
      this._buildSlides();

      // Populate select dropdown
      this._buildSelect();

      // Navigation events
      this._prevBtn.addEventListener('click', () => this.prev());
      this._nextBtn.addEventListener('click', () => this.next());
      this._select.addEventListener('change', () => {
        this.goTo(parseInt(this._select.value, 10));
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        // Don't capture when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
          case 'ArrowRight':
          case ' ':
            e.preventDefault();
            this.next();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.prev();
            break;
          case 'Home':
            e.preventDefault();
            this.goTo(0);
            break;
          case 'End':
            e.preventDefault();
            this.goTo(this.totalSlides - 1);
            break;
          case 'Escape':
            // Settings modal handles its own Escape
            break;
        }
      });

      // Show first slide
      this.goTo(0);

      // Render KaTeX in all slides
      this._renderMath();

      console.log(`[App] Initialized with ${this.totalSlides} slides.`);
    },

    setMobileTab(tab) {
      this.currentMobileTab = tab;
      if (!this._appContainer) return;

      if (tab === 'simulation') {
        this._appContainer.classList.remove('view-theory');
        this._appContainer.classList.add('view-sim');
        if (this._tabBtnSim) this._tabBtnSim.classList.add('active');
        if (this._tabBtnTheory) this._tabBtnTheory.classList.remove('active');

        const sim = this.simulations[this.currentSlide];
        if (sim) {
          setTimeout(() => {
            sim.resize();
            sim.render();
          }, 40);
        }
      } else {
        this._appContainer.classList.remove('view-sim');
        this._appContainer.classList.add('view-theory');
        if (this._tabBtnTheory) this._tabBtnTheory.classList.add('active');
        if (this._tabBtnSim) this._tabBtnSim.classList.remove('active');
        this._renderMathForSlide(this.currentSlide);
      }
    },

    _buildSlides() {
      for (let i = 0; i < SlidesData.length; i++) {
        const data = SlidesData[i];
        const catInfo = SlidesData.getCategoryInfo(data.category);
        const isPlaceholder = data.simType === 'placeholder';

        const slideEl = document.createElement('div');
        slideEl.className = 'slide';
        slideEl.dataset.slide = data.id;
        slideEl.dataset.index = i;

        // Build theory panel
        const theoryHTML = `
          <div class="slide__theory">
            <div class="slide__theory-header">
              <span class="slide__category ${catInfo.cssClass}">${catInfo.label}</span>
              <h2 class="slide__theory-title">${data.title}</h2>
              ${isPlaceholder ? '<span class="placeholder-badge">Slide în dezvoltare</span>' : ''}
            </div>
            <div class="slide__theory-content">
              ${data.theoryHTML}
            </div>
          </div>
        `;

        // Build simulation panel
        let simHTML;
        if (data.simType === 'forced-oscillation') {
          simHTML = this._buildSlide1SimPanel(data);
        } else if (data.simType === 'phase-response') {
          simHTML = this._buildSlide2SimPanel(data);
        } else if (data.simType === 'quality-factor') {
          simHTML = this._buildSlide3SimPanel(data);
        } else if (data.simType === 'tacoma-narrows') {
          simHTML = this._buildSlide4SimPanel(data);
        } else {
          simHTML = this._buildPlaceholderSimPanel(data);
        }

        slideEl.innerHTML = `
          ${theoryHTML}
          <div class="slide__divider"></div>
          ${simHTML}
        `;

        this._wrapper.appendChild(slideEl);
      }
    },

    _buildSlide1SimPanel(data) {
      const w0 = Math.sqrt(data.simConfig.springK / data.simConfig.mass);
      return `
        <div class="slide__simulation">
          <div class="sim-canvas-wrap">
            <canvas class="sim-canvas" id="sim-canvas-1"></canvas>
          </div>
          <div class="sim-controls">
            <!-- Row 1: Sliders -->
            <div class="sim-controls__row">
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">ω (pulsație)</span>
                <input type="range" id="sim1-omega" min="0.2" max="16.0" step="0.05" value="${data.simConfig.driveOmega}">
                <span class="sim-slider-group__value" id="sim1-omega-val">${data.simConfig.driveOmega.toFixed(2)} rad/s</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">k (elasticitate)</span>
                <input type="range" id="sim1-k" min="2" max="40" step="0.5" value="${data.simConfig.springK}">
                <span class="sim-slider-group__value" id="sim1-k-val">${data.simConfig.springK.toFixed(1)} N/m</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">b (amortizare)</span>
                <input type="range" id="sim1-b" min="0.02" max="3.5" step="0.02" value="${data.simConfig.damping}">
                <span class="sim-slider-group__value" id="sim1-b-val">${data.simConfig.damping.toFixed(2)} Ns/m</span>
              </div>
            </div>

            <!-- Row 2: Presets & Quick Regimes -->
            <div class="sim-controls__row sim-controls__row--presets">
              <span class="sim-controls__tag">Regimuri:</span>
              <button class="sim-btn sim-btn--preset" id="sim1-preset-res" title="Setează ω = ω₀ pentru amplificare maximă">⚡ Rezonanță (ω = ω₀)</button>
              <button class="sim-btn" id="sim1-preset-sub" title="Regim cvasistatic: mișcare sincronă">◄ Sub-rezonanță</button>
              <button class="sim-btn" id="sim1-preset-super" title="Regim inerțial: opoziție de fază">► Supra-rezonanță</button>
              <button class="sim-btn" id="sim1-preset-lowb" title="Amortizare minimă (Q uriaș)">💎 Q Mare</button>
              <button class="sim-btn" id="sim1-preset-crit" title="Amortizare critică (fără oscilații)">🛑 Amortizare Critică</button>
            </div>

            <!-- Row 3: Action Buttons & Live Indicators -->
            <div class="sim-controls__actions">
              <button class="sim-btn sim-btn--primary" id="sim1-play">⏸ Pauză</button>
              <button class="sim-btn sim-btn--danger" id="sim1-reset">↺ Reset</button>
              <button class="sim-btn" id="sim1-sound" title="Activează/dezactivează sunetul frecvenței">🔇 Sunet: Oprit</button>
              
              <div class="sim-controls__badges">
                <span class="sim-badge sim-badge--amber" id="sim1-w0-badge">ω₀ = ${w0.toFixed(2)} rad/s</span>
                <span class="sim-badge sim-badge--cyan" id="sim1-q-badge">Q = ${(w0 / (data.simConfig.damping / data.simConfig.mass)).toFixed(1)}</span>
              </div>

              <span class="sim-controls__hint">💡 Trage masa cu mouse-ul sau click direct pe grafic!</span>
            </div>
          </div>
        </div>
      `;
    },

    _buildSlide2SimPanel(data) {
      const cfg = data.simConfig;
      return `
        <div class="slide__simulation">
          <div class="sim-canvas-wrap">
            <canvas class="sim-canvas" id="sim-canvas-2"></canvas>
          </div>
          <div class="sim-controls">
            <!-- Row 1: Sliders -->
            <div class="sim-controls__row">
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">ω (pulsație)</span>
                <input type="range" id="sim2-omega" min="0.2" max="10.0" step="0.05" value="${cfg.omega}">
                <span class="sim-slider-group__value" id="sim2-omega-val">${cfg.omega.toFixed(2)} rad/s</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">ω₀ (proprie)</span>
                <input type="range" id="sim2-omega0" min="2.0" max="6.0" step="0.1" value="${cfg.omega0}">
                <span class="sim-slider-group__value" id="sim2-omega0-val">${cfg.omega0.toFixed(1)} rad/s</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">γ (amortizare)</span>
                <input type="range" id="sim2-gamma" min="0.05" max="2.5" step="0.05" value="${cfg.gamma}">
                <span class="sim-slider-group__value" id="sim2-gamma-val">${cfg.gamma.toFixed(2)} s⁻¹</span>
              </div>
            </div>

            <!-- Row 2: Presets -->
            <div class="sim-controls__row sim-controls__row--presets">
              <span class="sim-controls__tag">Regimuri Fază:</span>
              <button class="sim-btn" id="sim2-preset-elastic" title="ω ≪ ω₀: Deplasare în fază cu forța">◄ Regim Elastic (δ → 0°)</button>
              <button class="sim-btn sim-btn--preset" id="sim2-preset-res" title="ω = ω₀: Defazaj exact 90°, putere maximă">⚡ Rezonanță Putere (δ = 90°)</button>
              <button class="sim-btn" id="sim2-preset-ampres" title="ω = ωᵣ: Vârful strict de amplitudine">📈 Vârf Amplitudine (ωᵣ)</button>
              <button class="sim-btn" id="sim2-preset-inertial" title="ω ≫ ω₀: Opoziție de fază">► Regim Inerțial (δ → 180°)</button>
              <button class="sim-btn sim-btn--primary" id="sim2-toggle-poly" title="Afișează triunghiul fazorial al forțelor">📐 Triunghiul Forțelor</button>
            </div>

            <!-- Row 3: Actions & Badges -->
            <div class="sim-controls__actions">
              <button class="sim-btn sim-btn--primary" id="sim2-play">⏸ Pauză</button>
              <button class="sim-btn sim-btn--danger" id="sim2-reset">↺ Reset</button>

              <div class="sim-controls__badges">
                <span class="sim-badge sim-badge--amber" id="sim2-delta-badge">δ = 90.0°</span>
                <span class="sim-badge sim-badge--cyan" id="sim2-power-badge">⟨P⟩ = 5.71 W</span>
              </div>

              <span class="sim-controls__hint">💡 Click pe oricare din graficele din dreapta pentru a schimba ω!</span>
            </div>
          </div>
        </div>
      `;
    },

    _buildSlide3SimPanel(data) {
      const cfg = data.simConfig;
      return `
        <div class="slide__simulation">
          <div class="sim-canvas-wrap">
            <canvas class="sim-canvas" id="sim-canvas-3"></canvas>
          </div>
          <div class="sim-controls">
            <!-- Row 1: Sliders -->
            <div class="sim-controls__row">
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">ω (excitație)</span>
                <input type="range" id="sim3-omega" min="0.4" max="9.2" step="0.05" value="${cfg.omega}">
                <span class="sim-slider-group__value" id="sim3-omega-val">${cfg.omega.toFixed(2)} rad/s</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label" style="color:var(--accent-cyan)">Q₁ (High)</span>
                <input type="range" id="sim3-q1" min="4.0" max="25.0" step="0.5" value="${cfg.qHigh}">
                <span class="sim-slider-group__value" id="sim3-q1-val">Q₁ = ${cfg.qHigh.toFixed(1)}</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label" style="color:var(--accent-amber)">Q₂ (Med)</span>
                <input type="range" id="sim3-q2" min="1.5" max="8.0" step="0.2" value="${cfg.qMed}">
                <span class="sim-slider-group__value" id="sim3-q2-val">Q₂ = ${cfg.qMed.toFixed(1)}</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label" style="color:var(--accent-green)">Q₃ (Low)</span>
                <input type="range" id="sim3-q3" min="0.3" max="1.5" step="0.05" value="${cfg.qLow}">
                <span class="sim-slider-group__value" id="sim3-q3-val">Q₃ = ${cfg.qLow.toFixed(2)}</span>
              </div>
            </div>

            <!-- Row 2: Actions & Presets -->
            <div class="sim-controls__actions">
              <button class="sim-btn sim-btn--primary" id="sim3-play">⏸ Pauză</button>
              <button class="sim-btn sim-btn--danger" id="sim3-reset">↺ Reset</button>
              <button class="sim-btn sim-btn--preset" id="sim3-sweep" title="Mătură automat frecvența de la mic la mare">🌊 Baleiaj Frecvență (Auto-Sweep)</button>
              <button class="sim-btn" id="sim3-preset-res" title="Setează ω = ω₀">⚡ La Rezonanță (ω₀)</button>
              <button class="sim-btn" id="sim3-preset-impulse" title="Aplică un impuls identic celor 3 mase">💥 Test Impuls</button>

              <div class="sim-controls__badges">
                <span class="sim-badge sim-badge--cyan" id="sim3-bw-badge">Δω₁ = 0.40 rad/s</span>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    _buildSlide4SimPanel(data) {
      const cfg = data.simConfig;
      const kmh = (cfg.windSpeed * 3.6).toFixed(0);
      return `
        <div class="slide__simulation">
          <div class="sim-canvas-wrap">
            <canvas class="sim-canvas" id="sim-canvas-4"></canvas>
          </div>
          <div class="sim-controls">
            <!-- Row 1: Sliders -->
            <div class="sim-controls__row">
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">v (vânt)</span>
                <input type="range" id="sim4-wind" min="0" max="35" step="0.5" value="${cfg.windSpeed}">
                <span class="sim-slider-group__value" id="sim4-wind-val">${cfg.windSpeed.toFixed(1)} m/s (${kmh} km/h)</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">k_θ (rigiditate)</span>
                <input type="range" id="sim4-k" min="0.4" max="3.5" step="0.1" value="${cfg.kTheta}">
                <span class="sim-slider-group__value" id="sim4-k-val">k_θ = ${cfg.kTheta.toFixed(1)}×</span>
              </div>
              <div class="sim-slider-group">
                <span class="sim-slider-group__label">c_θ (amortizare)</span>
                <input type="range" id="sim4-c" min="0.01" max="0.25" step="0.01" value="${cfg.cTheta}">
                <span class="sim-slider-group__value" id="sim4-c-val">c_θ = ${cfg.cTheta.toFixed(2)}</span>
              </div>
            </div>

            <!-- Row 2: Profile Selection & Historical Stages -->
            <div class="sim-controls__row sim-controls__row--presets">
              <span class="sim-controls__tag">Profil & Etape:</span>
              <button class="sim-btn sim-btn--primary" id="sim4-profile-h" title="Grinzi pline din oțel (Tacoma 1940) — separă fluxul și creează flutter">⚠️ Grinzi Pline H (1940)</button>
              <button class="sim-btn" id="sim4-profile-truss" title="Grindă deschisă cu zăbrele (Tacoma 1950) — vântul trece liber">🛡️ Zăbrele (1950)</button>
              <button class="sim-btn" id="sim4-profile-aero" title="Casetă aerodinamică modernă">✈️ Profil Aerodinamic</button>
              <button class="sim-btn sim-btn--preset" id="sim4-preset-collapse" title="Simulează cronologia completă 10:00 AM -> 11:09 AM">🎬 Cronologia Colapsului (10:00–11:09)</button>
              <button class="sim-btn" id="sim4-preset-truss" title="Testează podul reconstruit în 1950 la același vânt">🛡️ Test Modernizare 1950</button>
            </div>

            <!-- Row 3: Action Buttons & Live Indicators -->
            <div class="sim-controls__actions">
              <button class="sim-btn sim-btn--primary" id="sim4-play">⏸ Pauză</button>
              <button class="sim-btn sim-btn--danger" id="sim4-reset">↺ Reconstruiește Podul</button>
              <button class="sim-btn" id="sim4-snap-cable" title="Ora 10:00 AM: Alunecă colierul central / Forfecă cablu vertical">⚡ 10:00 AM: Alunecă Colierul</button>

              <div class="sim-controls__badges">
                <span class="sim-badge sim-badge--danger" id="sim4-damp-badge">Cabluri: 48/48</span>
                <span class="sim-badge sim-badge--amber" id="sim4-mode-badge">⌚ 10:00 AM — Flutter ±45°</span>
              </div>

              <span class="sim-controls__hint">💡 Trage de pod sau urmărește cum se rup cablurile unul câte unul la ±45°!</span>
            </div>
          </div>
        </div>
      `;
    },

    _buildPlaceholderSimPanel(data) {
      const cfg = data.simConfig || {};
      return `
        <div class="slide__simulation">
          <div class="sim-canvas-wrap">
            <canvas class="sim-canvas" id="sim-canvas-${data.id}"></canvas>
          </div>
        </div>
      `;
    },

    _buildSelect() {
      this._select.innerHTML = '';
      for (let i = 0; i < SlidesData.length; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = (i + 1);
        this._select.appendChild(opt);
      }
      if (this._counter) {
        this._counter.textContent = '/ ' + this.totalSlides;
      }
    },

    goTo(index) {
      if (index < 0 || index >= this.totalSlides) return;

      // Stop previous simulation
      const prevSim = this.simulations[this.currentSlide];
      if (prevSim) prevSim.stop();

      // Hide all slides
      const slides = this._wrapper.querySelectorAll('.slide');
      slides.forEach(s => s.classList.remove('active'));

      // Show target slide
      this.currentSlide = index;
      slides[index].classList.add('active');

      // Update navigation
      this._select.value = index;
      this._prevBtn.disabled = (index === 0);
      this._nextBtn.disabled = (index === this.totalSlides - 1);

      // Init or resume simulation for this slide
      this._ensureSimulation(index);

      // Re-render math for this slide if needed
      this._renderMathForSlide(index);
    },

    next() {
      if (this.currentSlide < this.totalSlides - 1) {
        this.goTo(this.currentSlide + 1);
      }
    },

    prev() {
      if (this.currentSlide > 0) {
        this.goTo(this.currentSlide - 1);
      }
    },

    _ensureSimulation(index) {
      if (this.simulations[index]) {
        // Already created, resume and resize
        this.simulations[index].resize();
        this.simulations[index].start();
        this.simulations[index].render();
        return;
      }

      const data = SlidesData[index];
      const canvasId = `sim-canvas-${data.id}`;
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      let sim;
      if (data.simType === 'forced-oscillation') {
        sim = new ForcedOscillationSim(canvasId, data.simConfig);
      } else if (data.simType === 'phase-response') {
        sim = new PhaseResponseSim(canvasId, data.simConfig);
      } else if (data.simType === 'quality-factor') {
        sim = new QualityFactorSim(canvasId, data.simConfig);
      } else if (data.simType === 'tacoma-narrows') {
        sim = new TacomaNarrowsSim(canvasId, data.simConfig);
      } else {
        sim = new PlaceholderSim(canvasId, data.simConfig || {});
      }

      sim.init();
      sim.start();
      this.simulations[index] = sim;
    },

    _renderMath(targetEl) {
      const el = targetEl || document.body;
      const tryRender = () => {
        if (typeof renderMathInElement !== 'undefined') {
          renderMathInElement(el, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
              { left: '$', right: '$', display: false }
            ],
            throwOnError: false,
            trust: true
          });
        } else {
          setTimeout(tryRender, 100);
        }
      };
      tryRender();
    },

    _renderMathForSlide(index) {
      const slides = this._wrapper.querySelectorAll('.slide');
      const slideEl = slides[index];
      if (slideEl) {
        this._renderMath(slideEl);
      }
    }
  };

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

  window.App = App;
})();
