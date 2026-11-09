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
      this._wrapper = document.getElementById('slide-wrapper');
      this._select = document.getElementById('slide-select');
      this._counter = document.querySelector('.topbar__slide-counter');
      this._prevBtn = document.getElementById('prev-btn');
      this._nextBtn = document.getElementById('next-btn');

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
