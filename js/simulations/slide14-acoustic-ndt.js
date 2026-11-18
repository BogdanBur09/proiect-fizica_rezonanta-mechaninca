/* ============================================================
   SLIDE14-ACOUSTIC-NDT.JS — Slide 14 Simulation
   Testarea Nedistructivă Acustică (ART / NDT) & Rezonatorul Helmholtz
   Author: Buruiana Bogdan-Ioan
   simType: 'acoustic-ndt'
   ============================================================ */

(function () {
  'use strict';

  // --- Physical & Modal Constants ---
  const FS = 8192;                 // Sampling frequency (Hz), Nyquist = 4096 Hz
  const N_CAP = 8192;              // Strike capture FFT size (1.0 s -> df = 1.0 Hz)
  const N_LIVE = 4096;             // Live sliding ringdown FFT size (0.5 s -> df = 2.0 Hz)
  const N_SLICE = 1024;            // Parseval Q-decay slice size (0.125 s -> df = 8.0 Hz)
  const K0_PRE = 128;              // Pre-trigger offset in capture buffer
  const F_MAX_DISP = 3500;         // FFT display upper bound (Hz)

  // Euler-Bernoulli cantilever roots & shape constants (modes 1, 2, 3)
  const BETA = [1.87510407, 4.69409113, 7.85475744];
  const SIGMA = [0.73409551, 1.01846732, 0.99922450];

  // Healthy titanium turbine blade baseline
  const F0_HEALTHY = [420.0, 1350.0, 2850.0];
  const Q0_HEALTHY = [1200, 1050, 900];
  const H_MODAL = [1.00, 0.85, 0.65];
  const U_LDV = 0.93;              // Non-nodal LDV laser spot coordinate (x/L)
  const PHI_LDV_1 = 0.9030;        // |phi_1(0.93)| normalization reference

  // Defect coefficients (Explorer 2 verified fracture-mechanics & void model)
  const CRACK_C = [0.150, 0.135, 0.120];
  const CRACK_D = [24.0, 68.0, 130.0];
  const CRACK_KAPPA = [0.004722, 0.006200, 0.007800];

  const VOID_C = [0.123, 0.220, 0.278];
  const VOID_D = [13.5, 99.0, 181.0];
  const VOID_KAPPA = [0.002392, 0.003214, 0.004017];

  // Helmholtz acoustic liner constants
  const C_SOUND = 343.0;           // Speed of sound in air (m/s)
  const Q_HELMHOLTZ = 14.0;        // Liner cavity quality factor
  const L_NECK = 0.006;            // Faceplate wall thickness (6.0 mm)
  const ALPHA_HELMHOLTZ = 0.92;    // Coupling absorption coefficient (~ -21.9 dB max)

  const PRESET_IDS = [
    'sim14-preset-healthy',
    'sim14-preset-crack',
    'sim14-preset-void',
    'sim14-preset-helmholtz'
  ];

  /**
   * Iterative in-place Cooley-Tukey Radix-2 FFT on Float64Arrays.
   * @param {Float64Array} re
   * @param {Float64Array} im
   */
  function fftRadix2(re, im) {
    const n = re.length;
    if (n <= 1 || (n & (n - 1)) !== 0) return;

    // Bit-reversal permutation
    let j = 0;
    for (let i = 1; i < n; i++) {
      let bit = n >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }

    // Butterfly stages
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const angle = -2 * Math.PI / len;
      const wStepRe = Math.cos(angle);
      const wStepIm = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wRe = 1.0;
        let wIm = 0.0;
        for (let k = 0; k < half; k++) {
          const evenIdx = i + k;
          const oddIdx = evenIdx + half;
          const oddRe = re[oddIdx];
          const oddIm = im[oddIdx];

          const tRe = oddRe * wRe - oddIm * wIm;
          const tIm = oddRe * wIm + oddIm * wRe;

          re[oddIdx] = re[evenIdx] - tRe;
          im[oddIdx] = im[evenIdx] - tIm;
          re[evenIdx] += tRe;
          im[evenIdx] += tIm;

          const nextWRe = wRe * wStepRe - wIm * wStepIm;
          wIm = wRe * wStepIm + wIm * wStepRe;
          wRe = nextWRe;
        }
      }
    }
  }

  /** Cantilever eigenmode shape phi_n(u) for mode index m (0, 1, 2) and u in [0, 1] */
  function cantileverPhi(m, u) {
    const b = BETA[m];
    const s = SIGMA[m];
    const bu = b * u;
    return 0.5 * (Math.cosh(bu) - Math.cos(bu) - s * (Math.sinh(bu) - Math.sin(bu)));
  }

  /** Normalized cantilever curvature phi''_n(u) / beta_n^2 for modal strain visualization */
  function cantileverStrainNorm(m, u) {
    const b = BETA[m];
    const s = SIGMA[m];
    const bu = b * u;
    return 0.5 * (Math.cosh(bu) + Math.cos(bu) - s * (Math.sinh(bu) + Math.sin(bu)));
  }

  /** Deterministic seeded PRNG (Mulberry32) for repeatable anechoic noise floor */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Approximate zero-mean unit-variance Gaussian sample using Irwin-Hall sum */
  function nextGaussian(rng) {
    return (rng() + rng() + rng() + rng() - 2.0) * 1.7320508;
  }

  function clamp(val, lo, hi) {
    return val < lo ? lo : (val > hi ? hi : val);
  }

  class AcousticNDTSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);

      // Core simulation parameters
      this.defectType = (config && config.defectType) || 'healthy'; // 'healthy' | 'crack' | 'void'
      this.crackLength = (config && Number.isFinite(config.crackLength)) ? config.crackLength : 0.0;
      this.hitPos = (config && Number.isFinite(config.hitPos)) ? config.hitPos : 0.70;
      this.helmholtzFreq = (config && Number.isFinite(config.helmholtzFreq)) ? config.helmholtzFreq : 1200;
      this.helmholtzMode = Boolean(config && config.helmholtzMode);

      // Animation & interaction state
      this.timeSinceStrike = 0.05;
      this.hammerAngle = 0.0;
      this.hammerPhase = 'idle'; // 'cocking' | 'swing' | 'recoil' | 'idle'
      this.hammerTimer = 0.0;
      this.strikeFlash = 0.0;
      this.shockRadius = 0.0;
      this.helmPhase = 0.0;
      this.modalPhases = [0.0, 0.0, 0.0];
      this.modalSplitPhases = [0.0, 0.0, 0.0];

      // Interactive geometry & pointer state
      this._bladeGeom = { active: false };
      this._hoverU = null;
      this._handledPointerDown = false;
      this._destroyed = false;
      this._liveFftAccum = 0.0;
      this._domListeners = [];

      // Pre-allocated DSP buffers
      this._winCap = this._buildImpactWindow(N_CAP);
      this._winLive = this._buildHannWindow(N_LIVE);
      this._yCap = new Float64Array(N_CAP);
      this._fftReCap = new Float64Array(N_CAP);
      this._fftImCap = new Float64Array(N_CAP);
      this._fftReLive = new Float64Array(N_LIVE);
      this._fftImLive = new Float64Array(N_LIVE);
      this._fftReSlice = new Float64Array(N_SLICE);
      this._fftImSlice = new Float64Array(N_SLICE);

      this._magCapDb = new Float64Array(N_CAP >> 1);
      this._magLiveDb = new Float64Array(N_LIVE >> 1);
      this._refMagDb = new Float64Array(N_CAP >> 1);

      // Helmholtz DSP buffers
      this._pInc = new Float64Array(N_LIVE);
      this._pTrans = new Float64Array(N_LIVE);
      this._vNeck = new Float64Array(N_LIVE);
      this._magIncDb = new Float64Array(N_LIVE >> 1);
      this._magTransDb = new Float64Array(N_LIVE >> 1);

      // Active modal branches & DSP telemetry
      this._modes = [];
      this._dsp = {
        fHat: [420.0, 1350.0, 2850.0],
        q1Hat: 1200,
        doubletSplitHz: 0.0,
        secFreq1: 0.0,
        deltaF1: 0.0,
        verdictType: 'healthy',
        verdictBannerDesktop: '✓ PIESĂ CONFORMĂ (Etalon OK)',
        verdictBannerCompact: '✓ PIESĂ CONFORMĂ',
        verdictBadge: 'Verdict: ✓ CONFORMĂ',
        verdictClass: 'sim-badge--green'
      };

      this._helmData = {
        rMm: 3.76,
        areaMm2: 44.4,
        leffMm: 12.39,
        volCm3: 7.45,
        fCalc: 1200.0,
        attenuationDb: -20.5,
        neckRms: 0.5
      };

      // Precompute healthy reference overlay once using authentic pipeline
      this._precomputeHealthyReference();
      this._recomputeModalParams();
      this._synthesizeStrikeBuffer();
      this._computeLiveSpectrum();
      this._computeHelmholtz();
      this._bindCanvasEvents();
    }

    // =========================================================================
    // Canvas Safety Wrappers
    // =========================================================================

    _safeArc(ctx, x, y, r, startAngle, endAngle, ccw) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r)) return;
      ctx.arc(
        x,
        y,
        Math.max(0.1, r),
        startAngle === undefined ? 0 : startAngle,
        endAngle === undefined ? Math.PI * 2 : endAngle,
        Boolean(ccw)
      );
    }

    _safeLinearGrad(ctx, x0, y0, x1, y1, fallbackColor) {
      if (!Number.isFinite(x0) || !Number.isFinite(y0) ||
          !Number.isFinite(x1) || !Number.isFinite(y1)) {
        return fallbackColor || '#0f1629';
      }
      let gx1 = x1;
      let gy1 = y1;
      if (Math.abs(gx1 - x0) < 0.5 && Math.abs(gy1 - y0) < 0.5) {
        gy1 = y0 + 1;
      }
      return ctx.createLinearGradient(x0, y0, gx1, gy1);
    }

    _safeRadialGrad(ctx, x0, y0, r0, x1, y1, r1, fallbackColor) {
      if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(r0) ||
          !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(r1)) {
        return fallbackColor || 'rgba(0, 229, 255, 0.2)';
      }
      const safeR0 = Math.max(0.1, r0);
      const safeR1 = Math.max(safeR0 + 0.1, r1);
      return ctx.createRadialGradient(x0, y0, safeR0, x1, y1, safeR1);
    }

    requestRender() {
      if (!this.running) this.render();
    }

    // =========================================================================
    // Lifecycle Hooks
    // =========================================================================

    onInit() {
      this._bindDOMControls();
      this._syncDOMFromState();
      this.triggerStrike();
      this._updateUIBadges();

      if (window.SettingsManager && typeof window.SettingsManager.onChange === 'function') {
        window.SettingsManager.onChange(() => {
          if (!this._destroyed) this.requestRender();
        });
      }
    }

    onReset() {
      this.defectType = 'healthy';
      this.crackLength = 0.0;
      this.hitPos = 0.70;
      this.helmholtzFreq = 1200;
      this.helmholtzMode = false;
      this._hoverU = null;

      this._syncDOMFromState();
      this._recomputeModalParams();
      this.triggerStrike();
      this._computeHelmholtz();
      this._updateUIBadges();
    }

    destroy() {
      this._destroyed = true;
      super.destroy();
      if (this.canvas) {
        for (let i = 0; i < this._domListeners.length; i++) {
          const item = this._domListeners[i];
          item.el.removeEventListener(item.ev, item.fn, item.opts);
        }
      }
      this._domListeners = [];
    }

    // =========================================================================
    // Window Builders & Physics / DSP Pipeline
    // =========================================================================

    _buildImpactWindow(N) {
      const w = new Float64Array(N);
      let sum = 0;
      for (let n = 0; n < N; n++) {
        let wn = 1.0;
        if (n < 128) {
          wn = 0.5 * (1.0 - Math.cos((Math.PI * n) / 128));
        } else if (n >= 6144) {
          wn = 0.5 * (1.0 + Math.cos((Math.PI * (n - 6144)) / 2048));
        }
        w[n] = wn;
        sum += wn;
      }
      this._winCapSum = sum;
      return w;
    }

    _buildHannWindow(N) {
      const w = new Float64Array(N);
      let sum = 0;
      for (let n = 0; n < N; n++) {
        const wn = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * n) / (N - 1)));
        w[n] = wn;
        sum += wn;
      }
      this._winLiveSum = sum;
      return w;
    }

    _computeModalSet(defectType, crackLen, hitPos) {
      const a = clamp(crackLen, 0.0, 3.0);
      const effectiveType = (defectType === 'void') ? 'void' : (a >= 0.05 ? 'crack' : 'healthy');
      const modes = [];

      for (let m = 0; m < 3; m++) {
        const f0 = F0_HEALTHY[m];
        const q0 = Q0_HEALTHY[m];
        const phiHit = Math.abs(cantileverPhi(m, hitPos));
        const phiLdv = Math.abs(cantileverPhi(m, U_LDV));
        const rollOff = Math.exp(-Math.pow(f0 / 4200.0, 2));
        const baseAmp = H_MODAL[m] * rollOff * ((phiHit * phiLdv) / PHI_LDV_1);

        if (effectiveType === 'healthy') {
          modes.push({
            modeIdx: m,
            fa: f0,
            fb: f0,
            qa: q0,
            qb: q0,
            aa: baseAmp,
            ab: 0.0,
            hasSplit: false
          });
        } else if (effectiveType === 'crack') {
          const ua = a / 3.0;
          const s = 0.55 * ua + 0.45 * ua * ua;
          const fa = f0 * (1.0 - CRACK_C[m] * s);
          const df = CRACK_D[m] * s;
          const fb = fa + df;
          const invQa = (1.0 / q0) + CRACK_KAPPA[m] * Math.pow(a / 1.5, 1.15);
          const qa = 1.0 / invQa;
          const qb = 0.92 * qa;
          const rSplit = 0.72 * Math.min(1.0, a / 1.0);
          const aa = baseAmp / (1.0 + 0.35 * rSplit);
          const ab = aa * rSplit;

          modes.push({
            modeIdx: m,
            fa,
            fb,
            qa,
            qb,
            aa,
            ab,
            hasSplit: rSplit > 0.04 && df >= 1.5
          });
        } else {
          // Internal casting void
          const aVoid = a >= 0.05 ? a : 1.4;
          const ua = aVoid / 3.0;
          const sVoid = 0.50 * ua + 0.50 * ua * ua;
          const fa = f0 * (1.0 - VOID_C[m] * sVoid);
          const df = VOID_D[m] * sVoid;
          const fb = fa + df;
          const invQa = (1.0 / q0) + VOID_KAPPA[m] * Math.pow(aVoid / 1.4, 1.10);
          const qa = 1.0 / invQa;
          const qb = 0.92 * qa;
          const rSplit = 0.52 * Math.min(1.0, aVoid / 1.0);
          const aa = baseAmp / (1.0 + 0.30 * rSplit);
          const ab = aa * rSplit;

          modes.push({
            modeIdx: m,
            fa,
            fb,
            qa,
            qb,
            aa,
            ab,
            hasSplit: rSplit > 0.04 && df >= 1.5
          });
        }
      }
      return modes;
    }

    _recomputeModalParams() {
      this._modes = this._computeModalSet(this.defectType, this.crackLength, this.hitPos);
    }

    _synthesizeSignalInto(buf, len, modes, tOffsetSec, seed) {
      const rng = makeRng(seed);
      const twoPi = 2.0 * Math.PI;
      const noiseStd = 2.5e-4;

      // Precompute mode angular frequencies & damping rates
      const params = [];
      for (let m = 0; m < modes.length; m++) {
        const md = modes[m];
        const wa = twoPi * md.fa;
        const za = 1.0 / (2.0 * md.qa);
        const wda = wa * Math.sqrt(Math.max(0.0, 1.0 - za * za));
        params.push({ amp: md.aa, sigma: za * wa, wd: wda });

        if (md.ab > 1e-6) {
          const wb = twoPi * md.fb;
          const zb = 1.0 / (2.0 * md.qb);
          const wdb = wb * Math.sqrt(Math.max(0.0, 1.0 - zb * zb));
          params.push({ amp: md.ab, sigma: zb * wb, wd: wdb });
        }
      }

      for (let n = 0; n < len; n++) {
        const t = tOffsetSec + n / FS;
        let val = noiseStd * nextGaussian(rng);
        if (t >= 0.0) {
          for (let p = 0; p < params.length; p++) {
            const pr = params[p];
            const env = Math.exp(-pr.sigma * t);
            if (env > 1e-6) {
              val += pr.amp * env * Math.cos(pr.wd * t);
            }
          }
        }
        buf[n] = val;
      }
    }

    _precomputeHealthyReference() {
      const refModes = this._computeModalSet('healthy', 0.0, 0.70);
      const yRef = new Float64Array(N_CAP);
      const re = new Float64Array(N_CAP);
      const im = new Float64Array(N_CAP);

      this._synthesizeSignalInto(yRef, N_CAP, refModes, -K0_PRE / FS, 14001);
      for (let n = 0; n < N_CAP; n++) {
        re[n] = yRef[n] * this._winCap[n];
      }
      fftRadix2(re, im);

      const norm = this._winCapSum * 0.5;
      const half = N_CAP >> 1;
      for (let k = 0; k < half; k++) {
        const mag = Math.hypot(re[k], im[k]) / norm;
        this._refMagDb[k] = 20.0 * Math.log10(Math.max(1e-5, mag));
      }
    }

    _synthesizeStrikeBuffer() {
      this._synthesizeSignalInto(this._yCap, N_CAP, this._modes, -K0_PRE / FS, 14042);

      // Compute N_CAP FFT magnitude spectrum
      for (let n = 0; n < N_CAP; n++) {
        this._fftReCap[n] = this._yCap[n] * this._winCap[n];
        this._fftImCap[n] = 0.0;
      }
      fftRadix2(this._fftReCap, this._fftImCap);

      const norm = this._winCapSum * 0.5;
      const half = N_CAP >> 1;
      for (let k = 0; k < half; k++) {
        const mag = Math.hypot(this._fftReCap[k], this._fftImCap[k]) / norm;
        this._magCapDb[k] = 20.0 * Math.log10(Math.max(1e-5, mag));
      }

      this._extractDSPFeatures();
    }

    _computeLiveSpectrum() {
      // Live sliding window tracking active ringdown decay
      const tStart = Math.max(-K0_PRE / FS, this.timeSinceStrike * 0.75 - 0.015);
      const yLive = new Float64Array(N_LIVE);
      this._synthesizeSignalInto(yLive, N_LIVE, this._modes, tStart, 14099);

      for (let n = 0; n < N_LIVE; n++) {
        this._fftReLive[n] = yLive[n] * this._winLive[n];
        this._fftImLive[n] = 0.0;
      }
      fftRadix2(this._fftReLive, this._fftImLive);

      const norm = this._winLiveSum * 0.5;
      const half = N_LIVE >> 1;
      for (let k = 0; k < half; k++) {
        const mag = Math.hypot(this._fftReLive[k], this._fftImLive[k]) / norm;
        this._magLiveDb[k] = 20.0 * Math.log10(Math.max(1e-5, mag));
      }
    }

    _findBandPeakHz(magDb, fMin, fMax) {
      const df = FS / N_CAP; // 1.0 Hz
      const kLo = Math.max(1, Math.floor(fMin / df));
      const kHi = Math.min((N_CAP >> 1) - 2, Math.ceil(fMax / df));
      let kMax = kLo;
      let peakVal = -Infinity;

      for (let k = kLo; k <= kHi; k++) {
        if (magDb[k] > peakVal) {
          peakVal = magDb[k];
          kMax = k;
        }
      }

      // 3-point log-parabolic interpolation
      const yL = magDb[kMax - 1];
      const yC = magDb[kMax];
      const yR = magDb[kMax + 1];
      const denom = yL - 2.0 * yC + yR;
      let delta = 0.0;
      if (denom < -1e-6) {
        delta = clamp((0.5 * (yL - yR)) / denom, -0.5, 0.5);
      }

      return {
        kMax,
        freq: (kMax + delta) * df,
        db: yC
      };
    }

    _extractDSPFeatures() {
      const p1 = this._findBandPeakHz(this._magCapDb, 310, 460);
      const p2 = this._findBandPeakHz(this._magCapDb, 1050, 1450);
      const p3 = this._findBandPeakHz(this._magCapDb, 2300, 2950);

      // Scan around Mode 1 for doublet secondary peak within 18 dB (excluding |k - kMax| < 4)
      const kLo = Math.max(310, p1.kMax - 80);
      const kHi = Math.min(460, p1.kMax + 80);
      let secK = -1;
      let secDb = -Infinity;
      for (let k = kLo + 1; k < kHi; k++) {
        if (Math.abs(k - p1.kMax) < 4) continue;
        const v = this._magCapDb[k];
        if (v >= this._magCapDb[k - 1] && v >= this._magCapDb[k + 1]) {
          if (v > secDb && v >= p1.db - 18.0 && v > -52.0) {
            secDb = v;
            secK = k;
          }
        }
      }

      let secFreq1 = 0.0;
      let doubletSplitHz = 0.0;
      if (secK > 0) {
        const yL = this._magCapDb[secK - 1];
        const yC = this._magCapDb[secK];
        const yR = this._magCapDb[secK + 1];
        const denom = yL - 2.0 * yC + yR;
        let delta = 0.0;
        if (denom < -1e-6) {
          delta = clamp((0.5 * (yL - yR)) / denom, -0.5, 0.5);
        }
        secFreq1 = secK + delta;
        doubletSplitHz = Math.abs(secFreq1 - p1.freq);
      }

      // 4-slice Parseval band-energy decay for Q_1 extraction
      const kSliceLo = Math.floor((300 * N_SLICE) / FS);
      const kSliceHi = Math.ceil((480 * N_SLICE) / FS);
      const sliceE = [];
      const sliceT = [];
      let e0 = 0;

      for (let s = 0; s < 4; s++) {
        const offset = K0_PRE + s * N_SLICE;
        for (let n = 0; n < N_SLICE; n++) {
          this._fftReSlice[n] = this._yCap[offset + n];
          this._fftImSlice[n] = 0.0;
        }
        fftRadix2(this._fftReSlice, this._fftImSlice);

        let sumSq = 0.0;
        for (let k = kSliceLo; k <= kSliceHi; k++) {
          const r = this._fftReSlice[k];
          const im = this._fftImSlice[k];
          sumSq += r * r + im * im;
        }
        const e = Math.sqrt(sumSq);
        if (s === 0) e0 = e;
        if (e0 > 1e-9 && e > 0.05 * e0) {
          sliceE.push(Math.log(e));
          sliceT.push((s + 0.5) * (N_SLICE / FS));
        }
      }

      let q1Hat = 1200;
      if (sliceE.length >= 2) {
        let sumT = 0;
        let sumY = 0;
        const mCnt = sliceE.length;
        for (let i = 0; i < mCnt; i++) {
          sumT += sliceT[i];
          sumY += sliceE[i];
        }
        const meanT = sumT / mCnt;
        const meanY = sumY / mCnt;
        let num = 0;
        let den = 0;
        for (let i = 0; i < mCnt; i++) {
          const dt = sliceT[i] - meanT;
          num += dt * (sliceE[i] - meanY);
          den += dt * dt;
        }
        const slope = den > 1e-12 ? num / den : -1.0;
        q1Hat = Math.round(clamp((Math.PI * p1.freq) / Math.max(0.5, -slope), 20, 3000));
      }

      const deltaF1 = p1.freq - F0_HEALTHY[0];
      const epsF = Math.abs(deltaF1) / F0_HEALTHY[0];

      let verdictType = 'warning';
      let verdictBannerDesktop = '⚠ ANOMALIE MODALĂ INCIPIENTĂ (INSPECȚIE SUPLIMENTARĂ)';
      let verdictBannerCompact = '⚠ ANOMALIE MODALĂ INCIPIENTĂ';
      let verdictBadge = 'Verdict: ⚠ ATENȚIE';
      let verdictClass = 'sim-badge--amber';

      if (epsF < 0.015 && q1Hat >= 600 && doubletSplitHz < 3.0) {
        verdictType = 'healthy';
        verdictBannerDesktop = '✓ PIESĂ CONFORMĂ (Etalon OK)';
        verdictBannerCompact = '✓ PIESĂ CONFORMĂ';
        verdictBadge = 'Verdict: ✓ CONFORMĂ';
        verdictClass = 'sim-badge--green';
      } else if (epsF >= 0.030 || q1Hat < 380) {
        if (this.defectType === 'void') {
          verdictType = 'void';
          verdictBannerDesktop = '❌ DEFECT DETECTAT: GOL INTERN DE TURNARE';
          verdictBannerCompact = '❌ DEFECT: GOL INTERN DE TURNARE';
          verdictBadge = 'Verdict: ❌ GOL INTERN';
          verdictClass = 'sim-badge--danger';
        } else {
          verdictType = 'crack';
          verdictBannerDesktop = '❌ DEFECT DETECTAT: FISURĂ STRUCTURALĂ CRITICĂ';
          verdictBannerCompact = '❌ DEFECT: FISURĂ STRUCTURALĂ CRITICĂ';
          verdictBadge = 'Verdict: ❌ DEFECT CRITIC';
          verdictClass = 'sim-badge--danger';
        }
      }

      this._dsp = {
        fHat: [p1.freq, p2.freq, p3.freq],
        peakDb: [p1.db, p2.db, p3.db],
        q1Hat,
        doubletSplitHz,
        secFreq1,
        deltaF1,
        verdictType,
        verdictBannerDesktop,
        verdictBannerCompact,
        verdictBadge,
        verdictClass
      };
    }

    _computeHelmholtz() {
      const fH = clamp(this.helmholtzFreq, 400, 2400);
      const r = 0.0028 + 0.0024 * ((fH - 400.0) / 2000.0);
      const S = Math.PI * r * r;
      const leff = L_NECK + 1.7 * r;
      const V = (S / leff) * Math.pow(C_SOUND / (2.0 * Math.PI * fH), 2);
      const fCalc = (C_SOUND / (2.0 * Math.PI)) * Math.sqrt(S / (V * leff));

      // Synthesize incident turbofan duct pressure (640 Hz, 1200 Hz BPF, 1850 Hz + broadband noise)
      const rng = makeRng(14400);
      const twoPi = 2.0 * Math.PI;
      for (let n = 0; n < N_LIVE; n++) {
        const t = n / FS;
        this._pInc[n] =
          0.16 * nextGaussian(rng) +
          0.35 * Math.sin(twoPi * 640.0 * t) +
          0.95 * Math.sin(twoPi * 1200.0 * t) +
          0.42 * Math.sin(twoPi * 1850.0 * t);
      }

      // Pre-warped Tustin bilinear SDOF resonator filter
      const K = Math.tan((Math.PI * fH) / FS);
      const denom = 1.0 + K / Q_HELMHOLTZ + K * K;
      const b0 = (K / Q_HELMHOLTZ) / denom;
      const a1 = (2.0 * (K * K - 1.0)) / denom;
      const a2 = (1.0 - K / Q_HELMHOLTZ + K * K) / denom;

      let sumV2 = 0.0;
      for (let n = 0; n < N_LIVE; n++) {
        const x0 = this._pInc[n];
        const x2 = n >= 2 ? this._pInc[n - 2] : 0.0;
        const y1 = n >= 1 ? this._vNeck[n - 1] : 0.0;
        const y2 = n >= 2 ? this._vNeck[n - 2] : 0.0;

        const vn = b0 * (x0 - x2) - a1 * y1 - a2 * y2;
        this._vNeck[n] = vn;
        this._pTrans[n] = x0 - ALPHA_HELMHOLTZ * vn;
        if (n >= 512) sumV2 += vn * vn;
      }
      const neckRms = Math.sqrt(sumV2 / (N_LIVE - 512));

      // FFT on p_inc
      const reInc = new Float64Array(N_LIVE);
      const imInc = new Float64Array(N_LIVE);
      const reTr = new Float64Array(N_LIVE);
      const imTr = new Float64Array(N_LIVE);
      for (let n = 0; n < N_LIVE; n++) {
        const w = this._winLive[n];
        reInc[n] = this._pInc[n] * w;
        reTr[n] = this._pTrans[n] * w;
      }
      fftRadix2(reInc, imInc);
      fftRadix2(reTr, imTr);

      const norm = this._winLiveSum * 0.5;
      const half = N_LIVE >> 1;
      for (let k = 0; k < half; k++) {
        this._magIncDb[k] = 20.0 * Math.log10(Math.max(1e-5, Math.hypot(reInc[k], imInc[k]) / norm));
        this._magTransDb[k] = 20.0 * Math.log10(Math.max(1e-5, Math.hypot(reTr[k], imTr[k]) / norm));
      }

      const kH = clamp(Math.round(fH / (FS / N_LIVE)), 1, half - 2);
      const attenuationDb = this._magTransDb[kH] - this._magIncDb[kH];

      this._helmData = {
        rMm: r * 1000.0,
        areaMm2: S * 1e6,
        leffMm: leff * 1000.0,
        volCm3: V * 1e6,
        fCalc,
        attenuationDb,
        neckRms
      };
    }

    // =========================================================================
    // Actions & State Updates
    // =========================================================================

    triggerStrike() {
      this.helmholtzMode = false;
      this.timeSinceStrike = 0.0;
      this.hammerPhase = 'swing';
      this.hammerTimer = 0.0;
      this.hammerAngle = -0.55;
      this.strikeFlash = 1.0;
      this.shockRadius = 2.0;
      this.modalPhases = [0.0, 0.0, 0.0];
      this.modalSplitPhases = [0.0, 0.0, 0.0];

      this._recomputeModalParams();
      this._synthesizeStrikeBuffer();
      this._computeLiveSpectrum();
      this._updateUIBadges();
      this.requestRender();
    }

    applyPreset(presetName) {
      if (presetName === 'healthy') {
        this.helmholtzMode = false;
        this.defectType = 'healthy';
        this.crackLength = 0.0;
        this._setActivePreset('sim14-preset-healthy');
        this._syncDOMFromState();
        this.triggerStrike();
      } else if (presetName === 'crack') {
        this.helmholtzMode = false;
        this.defectType = 'crack';
        this.crackLength = 1.5;
        this._setActivePreset('sim14-preset-crack');
        this._syncDOMFromState();
        this.triggerStrike();
      } else if (presetName === 'void') {
        this.helmholtzMode = false;
        this.defectType = 'void';
        this.crackLength = 1.4;
        this._setActivePreset('sim14-preset-void');
        this._syncDOMFromState();
        this.triggerStrike();
      } else if (presetName === 'helmholtz') {
        this.helmholtzMode = true;
        this._setActivePreset('sim14-preset-helmholtz');
        this._computeHelmholtz();
        this._syncDOMFromState();
        this._updateUIBadges();
        this.requestRender();
      }
    }

    update(dt) {
      const safeDt = Math.max(0.0, Math.min(0.05, Number.isFinite(dt) ? dt : 0.0));

      if (this.helmholtzMode) {
        this.helmPhase += safeDt * 18.0;
        if (!Number.isFinite(this.helmPhase)) this.helmPhase = 0.0;
      } else {
        this.timeSinceStrike += safeDt;
        if (!Number.isFinite(this.timeSinceStrike)) this.timeSinceStrike = 0.0;

        // Hammer swing kinematics
        if (this.hammerPhase === 'swing') {
          this.hammerTimer += safeDt;
          const p = clamp(this.hammerTimer / 0.07, 0.0, 1.0);
          this.hammerAngle = -0.55 * (1.0 - p);
          if (p >= 1.0) {
            this.hammerPhase = 'recoil';
            this.hammerTimer = 0.0;
            this.strikeFlash = 1.0;
            this.shockRadius = 2.0;
          }
        } else if (this.hammerPhase === 'recoil') {
          this.hammerTimer += safeDt;
          const p = clamp(this.hammerTimer / 0.25, 0.0, 1.0);
          this.hammerAngle = -0.55 * Math.sin(p * Math.PI * 0.5);
          if (p >= 1.0) {
            this.hammerPhase = 'idle';
            this.hammerAngle = -0.55;
          }
        } else {
          this.hammerAngle = -0.55;
        }

        // Shock ring & flash decay
        if (this.strikeFlash > 0.0) {
          this.strikeFlash = Math.max(0.0, this.strikeFlash - safeDt * 2.6);
          this.shockRadius += safeDt * 120.0;
        }

        // Visual-rate carrier phases for smooth 60 FPS blade oscillation
        const visFreq = [16.0, 38.0, 62.0];
        for (let m = 0; m < 3; m++) {
          const md = this._modes[m];
          const ratio = md ? md.fa / F0_HEALTHY[m] : 1.0;
          this.modalPhases[m] += safeDt * visFreq[m] * ratio;
          const ratioB = md ? md.fb / F0_HEALTHY[m] : 1.0;
          this.modalSplitPhases[m] += safeDt * visFreq[m] * ratioB;
        }

        // Periodically refresh sliding ringdown FFT (~25 Hz)
        this._liveFftAccum += safeDt;
        if (this._liveFftAccum >= 0.04) {
          this._liveFftAccum = 0.0;
          this._computeLiveSpectrum();
        }
      }
    }

    // =========================================================================
    // DOM Binding & Badge Sync (Null-Guarded)
    // =========================================================================

    _addListener(el, ev, fn, opts) {
      if (!el) return;
      el.addEventListener(ev, fn, opts);
      this._domListeners.push({ el, ev, fn, opts });
    }

    _setActivePreset(activeId) {
      for (let i = 0; i < PRESET_IDS.length; i++) {
        const btn = document.getElementById(PRESET_IDS[i]);
        if (btn) {
          if (PRESET_IDS[i] === activeId) {
            btn.classList.add('sim-btn--preset');
          } else {
            btn.classList.remove('sim-btn--preset');
          }
        }
      }
    }

    _syncDOMFromState() {
      const crackEl = document.getElementById('sim14-crack');
      const crackVal = document.getElementById('sim14-crack-val');
      if (crackEl) crackEl.value = this.crackLength.toFixed(1);
      if (crackVal) crackVal.textContent = `${this.crackLength.toFixed(1)} mm`;

      const hitEl = document.getElementById('sim14-hitpos');
      const hitVal = document.getElementById('sim14-hitpos-val');
      if (hitEl) hitEl.value = this.hitPos.toFixed(2);
      if (hitVal) hitVal.textContent = `${this.hitPos.toFixed(2)} L`;

      const helmEl = document.getElementById('sim14-helmholtz');
      const helmVal = document.getElementById('sim14-helmholtz-val');
      if (helmEl) helmEl.value = String(Math.round(this.helmholtzFreq));
      if (helmVal) helmVal.textContent = `${Math.round(this.helmholtzFreq)} Hz`;

      const playBtn = document.getElementById('sim14-play');
      if (playBtn) {
        playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Rulează';
      }
    }

    _updateUIBadges() {
      const bF1 = document.getElementById('sim14-badge-f1');
      const bQ = document.getElementById('sim14-badge-q');
      const bVerdict = document.getElementById('sim14-badge-verdict');

      if (this.helmholtzMode) {
        const fH = Math.round(this.helmholtzFreq);
        const att = this._helmData.attenuationDb;
        const vol = this._helmData.volCm3;

        if (bF1) {
          bF1.textContent = `f_H: ${fH} Hz`;
          bF1.className = 'sim-badge sim-badge--cyan';
        }
        if (bQ) {
          bQ.textContent = `Q_H: ${Q_HELMHOLTZ.toFixed(1)} (V=${vol.toFixed(1)} cm³)`;
          bQ.className = 'sim-badge sim-badge--amber';
        }
        if (bVerdict) {
          bVerdict.textContent = `Atenuare: ${att.toFixed(1)} dB`;
          bVerdict.className = att <= -14.0 ? 'sim-badge sim-badge--green' : 'sim-badge sim-badge--cyan';
        }
      } else {
        const d = this._dsp;
        const f1 = d.fHat[0];
        const df = d.deltaF1;
        const dfStr = df >= 0 ? `+${Math.round(df)}` : `${Math.round(df)}`;

        if (bF1) {
          bF1.textContent = `f₁: ${Math.round(f1)} Hz (Δf: ${dfStr} Hz)`;
          bF1.className = Math.abs(df) >= 12 ? 'sim-badge sim-badge--danger' :
            (Math.abs(df) >= 5 ? 'sim-badge sim-badge--amber' : 'sim-badge sim-badge--cyan');
        }
        if (bQ) {
          bQ.textContent = `Factor Q: ${d.q1Hat}`;
          bQ.className = d.q1Hat >= 600 ? 'sim-badge sim-badge--green' :
            (d.q1Hat >= 380 ? 'sim-badge sim-badge--amber' : 'sim-badge sim-badge--danger');
        }
        if (bVerdict) {
          bVerdict.textContent = d.verdictBadge;
          bVerdict.className = `sim-badge ${d.verdictClass}`;
        }
      }
    }

    _bindDOMControls() {
      const crackEl = document.getElementById('sim14-crack');
      if (crackEl) {
        this._addListener(crackEl, 'input', (e) => {
          const v = clamp(parseFloat(e.target.value) || 0.0, 0.0, 3.0);
          this.crackLength = v;
          this.defectType = v >= 0.05 ? 'crack' : 'healthy';
          this.helmholtzMode = false;
          if (v < 0.05) {
            this._setActivePreset('sim14-preset-healthy');
          } else if (Math.abs(v - 1.5) < 0.05) {
            this._setActivePreset('sim14-preset-crack');
          } else {
            this._setActivePreset('');
          }
          const valEl = document.getElementById('sim14-crack-val');
          if (valEl) valEl.textContent = `${v.toFixed(1)} mm`;
          this.triggerStrike();
        });
      }

      const hitEl = document.getElementById('sim14-hitpos');
      if (hitEl) {
        this._addListener(hitEl, 'input', (e) => {
          const v = clamp(parseFloat(e.target.value) || 0.70, 0.15, 0.95);
          this.hitPos = Math.round(v * 20) / 20;
          const valEl = document.getElementById('sim14-hitpos-val');
          if (valEl) valEl.textContent = `${this.hitPos.toFixed(2)} L`;
          this.triggerStrike();
        });
      }

      const helmEl = document.getElementById('sim14-helmholtz');
      if (helmEl) {
        this._addListener(helmEl, 'input', (e) => {
          const v = clamp(parseFloat(e.target.value) || 1200, 400, 2400);
          this.helmholtzFreq = v;
          this.helmholtzMode = true;
          this._setActivePreset('sim14-preset-helmholtz');
          const valEl = document.getElementById('sim14-helmholtz-val');
          if (valEl) valEl.textContent = `${Math.round(v)} Hz`;
          this._computeHelmholtz();
          this._updateUIBadges();
          this.requestRender();
        });
      }

      const pHealthy = document.getElementById('sim14-preset-healthy');
      if (pHealthy) this._addListener(pHealthy, 'click', () => this.applyPreset('healthy'));

      const pCrack = document.getElementById('sim14-preset-crack');
      if (pCrack) this._addListener(pCrack, 'click', () => this.applyPreset('crack'));

      const pVoid = document.getElementById('sim14-preset-void');
      if (pVoid) this._addListener(pVoid, 'click', () => this.applyPreset('void'));

      const pHelm = document.getElementById('sim14-preset-helmholtz');
      if (pHelm) this._addListener(pHelm, 'click', () => this.applyPreset('helmholtz'));

      const btnStrike = document.getElementById('sim14-btn-strike');
      if (btnStrike) {
        this._addListener(btnStrike, 'click', () => {
          if (this.defectType === 'crack') {
            this._setActivePreset(Math.abs(this.crackLength - 1.5) < 0.05 ? 'sim14-preset-crack' : '');
          } else if (this.defectType === 'void') {
            this._setActivePreset('sim14-preset-void');
          } else {
            this._setActivePreset('sim14-preset-healthy');
          }
          this.triggerStrike();
        });
      }

      const playBtn = document.getElementById('sim14-play');
      if (playBtn) {
        this._addListener(playBtn, 'click', () => {
          this.toggle();
          playBtn.textContent = this.running ? '⏸ Pauză' : '▶ Rulează';
        });
      }

      const resetBtn = document.getElementById('sim14-reset');
      if (resetBtn) {
        this._addListener(resetBtn, 'click', () => {
          this.reset();
          const pBtn = document.getElementById('sim14-play');
          if (pBtn) pBtn.textContent = '⏸ Pauză';
          this.start();
          this._setActivePreset('sim14-preset-healthy');
        });
      }
    }

    // =========================================================================
    // Canvas Pointer Click-to-Strike
    // =========================================================================

    _getCanvasPos(e) {
      if (!this.canvas) return { x: -1, y: -1 };
      const rect = this.canvas.getBoundingClientRect();
      const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      const clientX = touch ? touch.clientX : e.clientX;
      const clientY = touch ? touch.clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    _hitTestBlade(pos) {
      const g = this._bladeGeom;
      if (!g || !g.active || g.len <= 10) return null;
      if (pos.x < g.rootX - g.hitPaddingX || pos.x > g.tipX + g.hitPaddingX) return null;
      const rawU = (pos.x - g.rootX) / g.len;
      const clampedU = clamp(rawU, 0.15, 0.95);
      const localHalfH = g.halfW0 + (g.halfW1 - g.halfW0) * clamp(rawU, 0.0, 1.0);
      const maxDy = Math.max(g.hitPaddingY, localHalfH + 16);
      if (Math.abs(pos.y - g.centerY) > maxDy) return null;
      const snapped = Math.round(clampedU * 20) / 20;
      return clamp(Number(snapped.toFixed(2)), 0.15, 0.95);
    }

    _bindCanvasEvents() {
      if (!this.canvas) return;

      const applyStrikeAt = (u) => {
        this.hitPos = u;
        const hitSlider = document.getElementById('sim14-hitpos');
        const hitVal = document.getElementById('sim14-hitpos-val');
        if (hitSlider) hitSlider.value = u.toFixed(2);
        if (hitVal) hitVal.textContent = `${u.toFixed(2)} L`;
        this.triggerStrike();
      };

      const onPointerDown = (e) => {
        const pos = this._getCanvasPos(e);
        const u = this._hitTestBlade(pos);
        if (u !== null) {
          this._handledPointerDown = true;
          applyStrikeAt(u);
        }
      };

      const onClick = (e) => {
        if (this._handledPointerDown) {
          this._handledPointerDown = false;
          return;
        }
        const pos = this._getCanvasPos(e);
        const u = this._hitTestBlade(pos);
        if (u !== null) {
          applyStrikeAt(u);
        }
      };

      const onPointerMove = (e) => {
        const pos = this._getCanvasPos(e);
        const u = this._hitTestBlade(pos);
        if (u !== this._hoverU) {
          this._hoverU = u;
          this.canvas.style.cursor = u !== null ? 'pointer' : 'default';
          this.requestRender();
        }
      };

      const onMouseLeave = () => {
        if (this._hoverU !== null) {
          this._hoverU = null;
          this.canvas.style.cursor = 'default';
          this.requestRender();
        }
      };

      this._addListener(this.canvas, 'pointerdown', onPointerDown);
      this._addListener(this.canvas, 'click', onClick);
      this._addListener(this.canvas, 'pointermove', onPointerMove);
      this._addListener(this.canvas, 'mouseleave', onMouseLeave);
    }

    // =========================================================================
    // Rendering
    // =========================================================================

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      if (!Number.isFinite(W) || !Number.isFinite(H) || W < 40 || H < 40) return;

      const compact = W < 540 || H < 460;
      const tiny = W < 400 || H < 430;
      const topRatio = compact ? 0.55 : 0.58;
      const topH = Math.max(110, Math.round(H * topRatio));
      const botH = Math.max(60, H - topH);

      const showHUD = !window.SettingsManager || window.SettingsManager.get('showHUD');
      const showGraph = !window.SettingsManager || window.SettingsManager.get('showGraph');
      const showVectors = !window.SettingsManager || window.SettingsManager.get('showVectors');
      const highContrast = Boolean(window.SettingsManager && window.SettingsManager.get('highContrast'));

      const opts = { compact, tiny, showHUD, showGraph, showVectors, highContrast };

      ctx.clearRect(0, 0, W, H);
      this._renderUpperStage(ctx, 0, 0, W, topH, opts);
      this._renderLowerStage(ctx, 0, topH, W, botH, opts);
    }

    // --- Zone 1: Upper Stage ---
    _renderUpperStage(ctx, x, y, w, h, opts) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      // Background sky gradient
      const bgGrad = this._safeLinearGrad(ctx, 0, y, 0, y + h, '#080c18');
      if (typeof bgGrad !== 'string') {
        bgGrad.addColorStop(0, '#050914');
        bgGrad.addColorStop(0.55, '#0a1224');
        bgGrad.addColorStop(1, '#0d172c');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(x, y, w, h);

      // Subtle technical grid
      const gridStep = opts.compact ? 28 : 40;
      ctx.strokeStyle = opts.highContrast ? 'rgba(0, 229, 255, 0.09)' : 'rgba(0, 229, 255, 0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = x + gridStep; gx < x + w; gx += gridStep) {
        ctx.moveTo(gx, y);
        ctx.lineTo(gx, y + h);
      }
      for (let gy = y + gridStep; gy < y + h; gy += gridStep) {
        ctx.moveTo(x, gy);
        ctx.lineTo(x + w, gy);
      }
      ctx.stroke();

      if (this.helmholtzMode) {
        this._bladeGeom = { active: false };
        this._renderHelmholtzScene(ctx, x, y, w, h, opts);
      } else {
        this._renderTurbineBladeScene(ctx, x, y, w, h, opts);
      }

      ctx.restore();
    }

    _drawAnechoicWedges(ctx, w, h, compact) {
      const wedgeW = compact ? 10 : 14;
      const wedgeD = compact ? 9 : 13;

      ctx.save();
      ctx.fillStyle = '#0c1528';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
      ctx.lineWidth = 1;

      // Top wall wedges
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let px = 0; px < w; px += wedgeW) {
        ctx.lineTo(px + wedgeW * 0.5, wedgeD);
        ctx.lineTo(Math.min(w, px + wedgeW), 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bottom wall wedges
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let px = 0; px < w; px += wedgeW) {
        ctx.lineTo(px + wedgeW * 0.5, h - wedgeD);
        ctx.lineTo(Math.min(w, px + wedgeW), h);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right wall wedges
      ctx.beginPath();
      ctx.moveTo(w, 0);
      for (let py = 0; py < h; py += wedgeW) {
        ctx.lineTo(w - wedgeD, py + wedgeW * 0.5);
        ctx.lineTo(w, Math.min(h, py + wedgeW));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
      return wedgeD;
    }

    _drawRoundedRect(ctx, x, y, w, h, r) {
      const rad = Math.min(r, w * 0.5, h * 0.5);
      ctx.beginPath();
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

    _bladeDispAt(u) {
      // Visual damped modal displacement (capped smoothly)
      const t = this.timeSinceStrike;
      let disp = 0.0;
      const modeWeights = [1.0, 0.34, 0.14];
      for (let m = 0; m < 3; m++) {
        const md = this._modes[m];
        if (!md) continue;
        // Visual envelope decays slower than audio-rate for clear inspection while reflecting Q drop
        const qScale = clamp(md.qa / 1200.0, 0.10, 1.0);
        const tauVis = 0.35 + 2.4 * qScale;
        const env = Math.exp(-t / tauVis);
        const phiVal = cantileverPhi(m, u);
        const exc = Math.abs(cantileverPhi(m, this.hitPos));
        const mainOsc = md.aa * Math.cos(this.modalPhases[m]);
        const splitOsc = md.ab > 1e-4 ? md.ab * Math.cos(this.modalSplitPhases[m] + 0.6) : 0.0;
        disp += modeWeights[m] * exc * env * (mainOsc + splitOsc) * phiVal;
      }
      return disp;
    }

    _renderTurbineBladeScene(ctx, x, y, w, h, opts) {
      const { compact, tiny, showHUD, showVectors, highContrast } = opts;
      const wedgeD = this._drawAnechoicWedges(ctx, w, h, compact);
      const padX = compact ? 12 : 20;
      const wedgePad = wedgeD + 4;

      // 1. Header HUD & Automated Verdict Banner
      if (showHUD) {
        ctx.save();
        ctx.font = `700 ${tiny ? 9 : 11}px "JetBrains Mono", monospace`;
        ctx.fillStyle = highContrast ? '#67e8f9' : '#00e5ff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        const title = compact
          ? 'ART / NDT — PALETĂ TURBINĂ Ti-6Al-4V'
          : 'TESTARE ART / NDT — PALETĂ TURBINĂ Ti-6Al-4V (CAMERĂ ANECOICĂ)';
        ctx.fillText(title, padX, wedgePad + 9);

        // Verdict pill
        const dsp = this._dsp;
        let fillCol = 'rgba(16, 185, 129, 0.14)';
        let borderCol = '#69f0ae';
        let textCol = '#69f0ae';
        let glow = false;

        if (dsp.verdictType === 'crack') {
          fillCol = 'rgba(255, 82, 82, 0.18)';
          borderCol = '#ff5252';
          textCol = '#ff8a80';
          glow = true;
        } else if (dsp.verdictType === 'void') {
          fillCol = 'rgba(255, 171, 64, 0.16)';
          borderCol = '#ff5252';
          textCol = '#ffab40';
          glow = true;
        } else if (dsp.verdictType === 'warning') {
          fillCol = 'rgba(255, 171, 64, 0.16)';
          borderCol = '#ffab40';
          textCol = '#ffab40';
        }

        let bx, by, bw, bh, bText;
        if (compact) {
          bx = padX;
          by = wedgePad + 19;
          bw = w - padX * 2;
          bh = 21;
          bText = dsp.verdictBannerCompact;
        } else {
          bw = Math.min(355, w * 0.49);
          bx = w - bw - padX - wedgeD * 0.4;
          by = wedgePad - 1;
          bh = 24;
          bText = dsp.verdictBannerDesktop;
        }

        if (glow) {
          ctx.shadowColor = '#ff5252';
          ctx.shadowBlur = 5 + 4 * Math.abs(Math.sin(this.time * 4.5));
        }
        this._drawRoundedRect(ctx, bx, by, bw, bh, 6);
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = highContrast ? 1.8 : 1.25;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = `700 ${tiny ? 9.5 : 10.5}px Inter, sans-serif`;
        ctx.fillStyle = textCol;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bText, bx + bw * 0.5, by + bh * 0.5 + 0.5, bw - 12);
        ctx.restore();
      }

      // 2. Geometry anchors for turbine blade
      const rootX = compact ? 42 : Math.max(66, Math.round(w * 0.105));
      const tipX = compact ? w - 34 : Math.min(w - 86, Math.round(w * 0.79));
      const bladeLen = Math.max(100, tipX - rootX);
      const bladeCenterY = Math.round(h * (compact ? 0.65 : 0.60));
      const halfW0 = compact ? 15 : 23;
      const halfW1 = compact ? 8.5 : 13;
      const maxDeflPx = compact ? 10 : 17;

      this._bladeGeom = {
        active: true,
        rootX,
        tipX,
        len: bladeLen,
        centerY: bladeCenterY,
        halfW0,
        halfW1,
        hitPaddingX: 12,
        hitPaddingY: Math.max(24, halfW0 + 16)
      };

      // Helper to sample blade centerline & chord profiles
      const N_STATIONS = 48;
      const ptsX = new Float64Array(N_STATIONS + 1);
      const ptsCy = new Float64Array(N_STATIONS + 1);
      const ptsTop = new Float64Array(N_STATIONS + 1);
      const ptsBot = new Float64Array(N_STATIONS + 1);
      const ptsStrain = new Float64Array(N_STATIONS + 1);

      const tDecay = Math.exp(-this.timeSinceStrike / 1.8);
      for (let i = 0; i <= N_STATIONS; i++) {
        const u = i / N_STATIONS;
        const sx = rootX + u * bladeLen;
        const rawDisp = this._bladeDispAt(u);
        const dy = clamp(rawDisp * maxDeflPx, -maxDeflPx, maxDeflPx);
        const cy = bladeCenterY + dy;
        const halfW = halfW0 + (halfW1 - halfW0) * u;
        const twist = Math.sin(u * Math.PI * 0.65);

        ptsX[i] = sx;
        ptsCy[i] = cy;
        ptsTop[i] = cy - halfW * (1.0 - 0.14 * twist);
        ptsBot[i] = cy + halfW * (1.0 + 0.10 * twist);

        // Modal curvature strain magnitude for glowing overlay
        let st = 0.0;
        for (let m = 0; m < 3; m++) {
          const md = this._modes[m];
          if (!md) continue;
          const exc = Math.abs(cantileverPhi(m, this.hitPos));
          st += H_MODAL[m] * exc * Math.abs(cantileverStrainNorm(m, u));
        }
        ptsStrain[i] = clamp(st * 0.65 * (0.28 + 0.72 * tDecay), 0.0, 1.0);
      }

      const evalYAtU = (u, which) => {
        const idx = clamp(u, 0, 1) * N_STATIONS;
        const i0 = Math.min(N_STATIONS - 1, Math.floor(idx));
        const frac = idx - i0;
        const arr = which === 'top' ? ptsTop : (which === 'bot' ? ptsBot : ptsCy);
        return arr[i0] * (1.0 - frac) + arr[i0 + 1] * frac;
      };

      // 3. Clamped Steel Root Fixture (Dovetail / Fir-tree block)
      ctx.save();
      const fixX = rootX - 28;
      const fixW = 32;
      const fixY = bladeCenterY - halfW0 - 11;
      const fixH = (halfW0 + 11) * 2;
      const fixGrad = this._safeLinearGrad(ctx, fixX, fixY, fixX + fixW, fixY + fixH, '#334155');
      if (typeof fixGrad !== 'string') {
        fixGrad.addColorStop(0, '#475569');
        fixGrad.addColorStop(0.5, '#64748b');
        fixGrad.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = fixGrad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.fillRect(fixX, fixY, fixW, fixH);
      ctx.strokeRect(fixX, fixY, fixW, fixH);

      // Left ground hatch marks
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let hy = fixY + 4; hy < fixY + fixH - 2; hy += 6) {
        ctx.moveTo(fixX - 7, hy + 4);
        ctx.lineTo(fixX, hy);
      }
      ctx.stroke();

      // 4 hex clamp bolts
      const boltX = fixX + 10;
      const boltYs = [fixY + 6, fixY + fixH - 6];
      for (let bi = 0; bi < boltYs.length; bi++) {
        for (let bj = 0; bj < 2; bj++) {
          ctx.beginPath();
          this._safeArc(ctx, boltX + bj * 12, boltYs[bi], 2.4, 0, Math.PI * 2);
          ctx.fillStyle = '#cbd5e1';
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 4. 2.5D Titanium Turbine Blade Body + Modal Strain Colormap
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ptsX[0], ptsTop[0]);
      for (let i = 1; i <= N_STATIONS; i++) {
        ctx.lineTo(ptsX[i], ptsTop[i]);
      }
      // Rounded blade tip
      ctx.quadraticCurveTo(
        ptsX[N_STATIONS] + (compact ? 6 : 9),
        ptsCy[N_STATIONS],
        ptsX[N_STATIONS],
        ptsBot[N_STATIONS]
      );
      for (let i = N_STATIONS - 1; i >= 0; i--) {
        ctx.lineTo(ptsX[i], ptsBot[i]);
      }
      ctx.closePath();

      // Metallic Ti-6Al-4V gradient
      const bladeGrad = this._safeLinearGrad(
        ctx,
        rootX,
        bladeCenterY - halfW0,
        rootX,
        bladeCenterY + halfW0,
        '#475569'
      );
      if (typeof bladeGrad !== 'string') {
        bladeGrad.addColorStop(0.0, '#cbd5e1');
        bladeGrad.addColorStop(0.22, '#94a3b8');
        bladeGrad.addColorStop(0.55, '#475569');
        bladeGrad.addColorStop(1.0, '#1e293b');
      }
      ctx.fillStyle = bladeGrad;
      ctx.fill();

      // Clip interior for modal strain heatmap & standing wave lines
      ctx.save();
      ctx.clip();

      for (let i = 0; i < N_STATIONS; i++) {
        const s = (ptsStrain[i] + ptsStrain[i + 1]) * 0.5;
        if (s > 0.04) {
          let r = 0, g = 229, b = 255;
          if (s > 0.55) {
            const k = (s - 0.55) / 0.45;
            r = Math.round(255);
            g = Math.round(171 - 89 * k);
            b = Math.round(64 + 18 * k);
          } else {
            const k = s / 0.55;
            r = Math.round(255 * k);
            g = Math.round(229 - 58 * k);
            b = Math.round(255 - 191 * k);
          }
          const alpha = clamp(s * 0.52, 0.05, 0.55);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(ptsX[i], ptsTop[i] - 2);
          ctx.lineTo(ptsX[i + 1] + 1, ptsTop[i + 1] - 2);
          ctx.lineTo(ptsX[i + 1] + 1, ptsBot[i + 1] + 2);
          ctx.lineTo(ptsX[i], ptsBot[i] + 2);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 2.5D specular ridge & standing-wave contour lines
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= N_STATIONS; i++) {
        const wy = ptsTop[i] + (ptsBot[i] - ptsTop[i]) * 0.25;
        if (i === 0) ctx.moveTo(ptsX[i], wy);
        else ctx.lineTo(ptsX[i], wy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.42)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 0; i <= N_STATIONS; i++) {
        const u = i / N_STATIONS;
        const wy = ptsCy[i] + Math.sin(u * Math.PI * 3.0 + this.modalPhases[0]) * 2.5 * tDecay;
        if (i === 0) ctx.moveTo(ptsX[i], wy);
        else ctx.lineTo(ptsX[i], wy);
      }
      ctx.stroke();

      ctx.restore(); // end interior clip

      // Outer titanium edge stroke
      ctx.strokeStyle = highContrast ? '#e2e8f0' : '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      // 5. Defects on Blade (Root Fatigue Crack or Internal Casting Void)
      const isCrackActive = this.defectType !== 'void' && this.crackLength >= 0.05;
      const isVoidActive = this.defectType === 'void';

      if (isCrackActive) {
        const crackU = 0.055;
        const cx = rootX + bladeLen * crackU;
        const topY = evalYAtU(crackU, 'top');
        const botY = evalYAtU(crackU, 'bot');
        const chordH = botY - topY;
        const depth = clamp((this.crackLength / 3.0) * chordH * 0.68, 3.0, chordH * 0.85);

        ctx.save();
        const glowR = Math.max(8, depth * 1.45);
        const cGrad = this._safeRadialGrad(ctx, cx, topY + depth * 0.45, 0.5, cx, topY + depth * 0.45, glowR);
        if (typeof cGrad !== 'string') {
          cGrad.addColorStop(0, 'rgba(255, 82, 82, 0.85)');
          cGrad.addColorStop(0.5, 'rgba(255, 171, 64, 0.35)');
          cGrad.addColorStop(1, 'rgba(255, 82, 82, 0)');
        }
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        this._safeArc(ctx, cx, topY + depth * 0.45, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Jagged branching fatigue crack
        ctx.strokeStyle = '#ff5252';
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#ff5252';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(cx, topY);
        ctx.lineTo(cx + 2.5, topY + depth * 0.35);
        ctx.lineTo(cx - 2.0, topY + depth * 0.68);
        ctx.lineTo(cx + 3.2, topY + depth);
        // Micro-branch
        ctx.moveTo(cx + 2.5, topY + depth * 0.35);
        ctx.lineTo(cx + 6.5, topY + depth * 0.58);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (showHUD && this.crackLength >= 0.2) {
          ctx.font = `700 ${tiny ? 8.5 : 9.5}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#ff8a80';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`FISURĂ ${this.crackLength.toFixed(1)} mm`, fixX + 2, fixY - 3);
        }
        ctx.restore();
      } else if (isVoidActive) {
        const voidU = 0.40;
        const vx = rootX + bladeLen * voidU;
        const vy = evalYAtU(voidU, 'cy');
        const rx = compact ? 7 : 10;
        const ry = compact ? 4.5 : 6;

        ctx.save();
        const vGrad = this._safeRadialGrad(ctx, vx, vy, 0.5, vx, vy, rx * 2.2);
        if (typeof vGrad !== 'string') {
          vGrad.addColorStop(0, 'rgba(255, 171, 64, 0.85)');
          vGrad.addColorStop(0.5, 'rgba(255, 82, 82, 0.35)');
          vGrad.addColorStop(1, 'rgba(255, 171, 64, 0)');
        }
        ctx.fillStyle = vGrad;
        ctx.beginPath();
        this._safeArc(ctx, vx, vy, rx * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Irregular subsurface void silhouette
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#ffab40';
        ctx.setLineDash([3, 2]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(vx, vy, rx, ry, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        if (showHUD) {
          ctx.font = `700 ${tiny ? 8.5 : 9.5}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#ffab40';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('GOL INTERN', vx, evalYAtU(voidU, 'bot') + 3);
        }
        ctx.restore();
      }

      // 6. Spanwise Ruler (x/L)
      if (showHUD) {
        const rulerY = bladeCenterY + halfW0 + (compact ? 14 : 20);
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.38)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rootX, rulerY);
        ctx.lineTo(tipX, rulerY);
        ctx.stroke();

        const ticks = w < 400 ? [0.0, 0.5, 1.0] : [0.0, 0.25, 0.5, 0.75, 1.0];
        ctx.font = `600 ${tiny ? 8 : 9}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let ti = 0; ti < ticks.length; ti++) {
          const u = ticks[ti];
          const tx = rootX + bladeLen * u;
          ctx.beginPath();
          ctx.moveTo(tx, rulerY - 3);
          ctx.lineTo(tx, rulerY + 3);
          ctx.stroke();
          ctx.fillText(u.toFixed(2), tx, rulerY + 4);
        }

        // Cyan pointer triangle at current hitPos
        const hpX = rootX + bladeLen * this.hitPos;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(hpX, rulerY - 1);
        ctx.lineTo(hpX - 4, rulerY - 7);
        ctx.lineTo(hpX + 4, rulerY - 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Hover reticle when mouse hovers over clickable blade
      if (this._hoverU !== null) {
        const hx = rootX + bladeLen * this._hoverU;
        const hTop = evalYAtU(this._hoverU, 'top');
        const hBot = evalYAtU(this._hoverU, 'bot');
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, hTop - 12);
        ctx.lineTo(hx, hBot + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00e5ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`x/L=${this._hoverU.toFixed(2)}`, hx, hTop - 14);
        ctx.restore();
      }

      // 7. Automated Impact Hammer Assembly
      const hitX = rootX + bladeLen * this.hitPos;
      const hitY = evalYAtU(this.hitPos, 'top');
      const pivotX = Math.max(rootX + 10, hitX - (compact ? 26 : 38));
      const pivotY = bladeCenterY - (compact ? 48 : 68);
      const restHitY = bladeCenterY - (halfW0 + (halfW1 - halfW0) * this.hitPos) * 0.92;
      const armDx = hitX - pivotX;
      const armDy = restHitY - pivotY;
      const armLen = Math.hypot(armDx, armDy);
      const contactAngle = Math.atan2(armDy, armDx);
      const curAngle = contactAngle + this.hammerAngle;
      const headX = pivotX + Math.cos(curAngle) * armLen;
      const headY = pivotY + Math.sin(curAngle) * armLen;

      ctx.save();
      // Pivot mount
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      this._safeArc(ctx, pivotX, pivotY, compact ? 4 : 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hammer shaft
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = compact ? 2.2 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(headX, headY);
      ctx.stroke();

      // Hammer head + amber piezo force ring
      ctx.translate(headX, headY);
      ctx.rotate(curAngle + Math.PI * 0.5);
      const hw = compact ? 9 : 12;
      const hh = compact ? 13 : 17;
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.1;
      ctx.fillRect(-hw * 0.5, -hh * 0.5, hw, hh);
      ctx.strokeRect(-hw * 0.5, -hh * 0.5, hw, hh);
      ctx.fillStyle = '#ffab40';
      ctx.fillRect(-hw * 0.5, hh * 0.18, hw, 3);
      ctx.restore();

      // Impact shock rings & spark streaks
      if (this.strikeFlash > 0.02 && showVectors) {
        ctx.save();
        const r1 = Math.max(0.1, this.shockRadius);
        const r2 = Math.max(0.1, this.shockRadius * 0.58);
        ctx.strokeStyle = `rgba(0, 229, 255, ${(this.strikeFlash * 0.75).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        this._safeArc(ctx, hitX, hitY, r1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 171, 64, ${(this.strikeFlash * 0.65).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        this._safeArc(ctx, hitX, hitY, r2, 0, Math.PI * 2);
        ctx.stroke();

        // 6 radial impact sparks
        ctx.strokeStyle = `rgba(255, 215, 64, ${this.strikeFlash.toFixed(3)})`;
        ctx.lineWidth = 1.4;
        for (let sp = 0; sp < 6; sp++) {
          const ang = -Math.PI + (sp + 0.5) * (Math.PI / 6);
          const s0 = 4 + this.shockRadius * 0.25;
          const s1 = s0 + (compact ? 6 : 9);
          ctx.beginPath();
          ctx.moveTo(hitX + Math.cos(ang) * s0, hitY + Math.sin(ang) * s0);
          ctx.lineTo(hitX + Math.cos(ang) * s1, hitY + Math.sin(ang) * s1);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 8. Green Laser Doppler Vibrometer (LDV 532 nm)
      const ldvX = compact ? w - 34 : Math.min(w - 44, tipX + 42);
      const ldvY = wedgePad + (compact ? 48 : 42);
      const spotX = rootX + bladeLen * U_LDV;
      const spotY = evalYAtU(U_LDV, 'top') + 1.5;

      ctx.save();
      if (showVectors) {
        // Glowing 532 nm green laser beam
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = highContrast ? 2.2 : 1.5;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(ldvX - 4, ldvY + 6);
        ctx.lineTo(spotX, spotY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Bright LDV spot on blade
        const spotGrad = this._safeRadialGrad(ctx, spotX, spotY, 0.2, spotX, spotY, 8);
        if (typeof spotGrad !== 'string') {
          spotGrad.addColorStop(0, 'rgba(105, 240, 174, 0.95)');
          spotGrad.addColorStop(1, 'rgba(0, 255, 136, 0)');
        }
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        this._safeArc(ctx, spotX, spotY, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e8fff3';
        ctx.beginPath();
        this._safeArc(ctx, spotX, spotY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // LDV optical head housing
      const ldvW = compact ? 24 : 30;
      const ldvH = compact ? 13 : 16;
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 1.2;
      ctx.fillRect(ldvX - ldvW * 0.5, ldvY - ldvH * 0.5, ldvW, ldvH);
      ctx.strokeRect(ldvX - ldvW * 0.5, ldvY - ldvH * 0.5, ldvW, ldvH);

      if (showHUD) {
        ctx.font = `700 ${tiny ? 8 : 9}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#69f0ae';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(compact ? 'LDV' : 'LDV 532 nm', ldvX - ldvW * 0.5 - 5, ldvY);
      }
      ctx.restore();
    }

    // --- Helmholtz Nacelle Cutaway Scene ---
    _renderHelmholtzScene(ctx, x, y, w, h, opts) {
      const { compact, tiny, showHUD, showVectors, highContrast } = opts;
      const padX = compact ? 12 : 20;
      const fH = Math.round(this.helmholtzFreq);
      const attDb = this._helmData.attenuationDb;

      // 1. Header & Active Attenuation Banner
      if (showHUD) {
        ctx.save();
        ctx.font = `700 ${tiny ? 9 : 11}px "JetBrains Mono", monospace`;
        ctx.fillStyle = highContrast ? '#67e8f9' : '#00e5ff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        const title = compact
          ? 'REZONATOR HELMHOLTZ — NACELĂ'
          : 'MOD REZONATOR HELMHOLTZ — ATENUARE NACELĂ TURBOFAN';
        ctx.fillText(title, padX, 14);

        const isTunedBpf = Math.abs(fH - 1200) <= 60;
        const bText = isTunedBpf
          ? (compact ? `✓ ACORDAT BPF ${fH} Hz (${attDb.toFixed(1)} dB)` : `✓ LINER ACORDAT PE TONUL BPF 1200 Hz (${attDb.toFixed(1)} dB)`)
          : `✓ ATENUARE ACTIVĂ @ ${fH} Hz (${attDb.toFixed(1)} dB)`;

        let bx, by, bw, bh;
        if (compact) {
          bx = padX;
          by = 24;
          bw = w - padX * 2;
          bh = 20;
        } else {
          bw = Math.min(350, w * 0.47);
          bx = w - bw - padX;
          by = 5;
          bh = 22;
        }

        this._drawRoundedRect(ctx, bx, by, bw, bh, 6);
        ctx.fillStyle = isTunedBpf ? 'rgba(16, 185, 129, 0.16)' : 'rgba(0, 229, 255, 0.14)';
        ctx.fill();
        ctx.strokeStyle = isTunedBpf ? '#69f0ae' : '#00e5ff';
        ctx.lineWidth = 1.25;
        ctx.stroke();

        ctx.font = `700 ${tiny ? 9 : 10}px Inter, sans-serif`;
        ctx.fillStyle = isTunedBpf ? '#69f0ae' : '#00e5ff';
        ctx.textAlign = 'center';
        ctx.fillText(bText, bx + bw * 0.5, by + bh * 0.5 + 0.5, bw - 10);
        ctx.restore();
      }

      // 2. Nacelle Duct & Honeycomb Acoustic Liner Geometry
      const topOffset = compact ? 50 : 34;
      const ductTop = topOffset + (compact ? 12 : 16);
      const ductH = Math.round((h - topOffset) * (compact ? 0.36 : 0.38));
      const ductBot = ductTop + ductH;
      const linerLeft = Math.round(w * 0.25);
      const linerRight = Math.round(w * 0.78);
      const wallThick = compact ? 10 : 14;
      const cavTop = ductBot + wallThick;
      const cavBot = h - (compact ? 8 : 12);
      const cavH = Math.max(26, cavBot - cavTop);

      // Upper nacelle composite casing
      ctx.save();
      const wallGrad = this._safeLinearGrad(ctx, 0, ductTop - wallThick, 0, ductTop, '#1e293b');
      if (typeof wallGrad !== 'string') {
        wallGrad.addColorStop(0, '#334155');
        wallGrad.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = wallGrad;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.fillRect(padX, ductTop - wallThick, w - padX * 2, wallThick);
      ctx.strokeRect(padX, ductTop - wallThick, w - padX * 2, wallThick);

      // Duct interior flow tint
      const ductGrad = this._safeLinearGrad(ctx, 0, ductTop, 0, ductBot, '#091326');
      if (typeof ductGrad !== 'string') {
        ductGrad.addColorStop(0, 'rgba(15, 23, 42, 0.75)');
        ductGrad.addColorStop(0.5, 'rgba(14, 30, 56, 0.45)');
        ductGrad.addColorStop(1, 'rgba(15, 23, 42, 0.75)');
      }
      ctx.fillStyle = ductGrad;
      ctx.fillRect(padX, ductTop, w - padX * 2, ductH);

      // Formula card in upper-left duct margin
      if (showHUD) {
        const cardW = compact ? Math.min(205, w * 0.62) : Math.min(275, w * 0.42);
        const cardH = compact ? 28 : 34;
        const cardX = padX + 4;
        const cardY = ductTop + 4;
        this._drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 5);
        ctx.fillStyle = 'rgba(8, 13, 26, 0.78)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `600 ${tiny ? 8.5 : 10}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('f_H = (c / 2π) · √(S / (V · L_eff))', cardX + 7, cardY + 4, cardW - 14);
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(
          `L_eff=L+1.7r | V=${this._helmData.volCm3.toFixed(1)} cm³`,
          cardX + 7,
          cardY + (compact ? 15 : 18),
          cardW - 14
        );
      }

      // Incident vs Attenuated acoustic waves inside bypass duct
      const waveY = ductTop + ductH * (compact ? 0.56 : 0.62);
      const waveAmpIn = Math.min(ductH * 0.18, compact ? 7.5 : 14);
      const attFactor = clamp(Math.pow(10, attDb / 20), 0.14, 0.90);
      const waveK = 0.045 + (fH - 400) * 0.000025;

      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let px = padX + 4; px <= w - padX - 4; px += 3) {
        let localAmp = waveAmpIn;
        if (px > linerLeft) {
          const blend = clamp((px - linerLeft) / Math.max(40, linerRight - linerLeft), 0, 1);
          localAmp = waveAmpIn * (1.0 - blend * (1.0 - attFactor));
        }
        const wy = waveY + Math.sin(px * waveK - this.helmPhase * 1.4) * localAmp;
        if (px === padX + 4) ctx.moveTo(px, wy);
        else ctx.lineTo(px, wy);
      }
      ctx.stroke();

      if (showVectors) {
        this.drawArrow(padX + 10, ductBot - 9, padX + (compact ? 42 : 62), ductBot - 9, 'rgba(148, 163, 184, 0.65)', 1.5);
        ctx.font = `600 ${tiny ? 8 : 9}px Inter, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Flux Bypass →', padX + (compact ? 46 : 68), ductBot - 4);
      }

      // 3. Honeycomb Resonator Cavities & Oscillating Air Plugs
      const numCav = 3;
      const totalLinerW = linerRight - linerLeft;
      const cavGap = 6;
      const cavW = (totalLinerW - cavGap * (numCav - 1)) / numCav;
      const neckW = clamp(cavW * (0.22 + 0.12 * ((fH - 400) / 2000)), 10, 24);
      const plugOscAmp = clamp(this._helmData.neckRms * 10.0, 1.5, wallThick * 0.45);
      const plugDisp = Math.sin(this.helmPhase * 1.8);
      const plugVel = Math.cos(this.helmPhase * 1.8); // 90° phase lead relative to cavity pressure

      // Solid faceplate left & right of liner
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.fillRect(padX, ductBot, linerLeft - padX, wallThick);
      ctx.strokeRect(padX, ductBot, linerLeft - padX, wallThick);
      ctx.fillRect(linerRight, ductBot, w - padX - linerRight, wallThick);
      ctx.strokeRect(linerRight, ductBot, w - padX - linerRight, wallThick);

      for (let cIdx = 0; cIdx < numCav; cIdx++) {
        const cx0 = linerLeft + cIdx * (cavW + cavGap);
        const cxMid = cx0 + cavW * 0.5;
        const nx0 = cxMid - neckW * 0.5;
        const nx1 = cxMid + neckW * 0.5;

        // Perforated faceplate shoulders around neck
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#94a3b8';
        ctx.fillRect(cx0, ductBot, nx0 - cx0, wallThick);
        ctx.strokeRect(cx0, ductBot, nx0 - cx0, wallThick);
        ctx.fillRect(nx1, ductBot, cx0 + cavW - nx1, wallThick);
        ctx.strokeRect(nx1, ductBot, cx0 + cavW - nx1, wallThick);

        // Cavity backing chamber
        ctx.fillStyle = '#070d1b';
        ctx.strokeStyle = '#475569';
        ctx.fillRect(cx0, cavTop, cavW, cavH);
        ctx.strokeRect(cx0, cavTop, cavW, cavH);

        // Cavity pressure glow (90° out of phase with neck velocity)
        const pressGlow = clamp(Math.abs(plugDisp) * (0.35 + 0.5 * clamp(this._helmData.neckRms, 0, 1)), 0.15, 0.85);
        const isComp = plugDisp > 0;
        const pCol = isComp ? `rgba(255, 171, 64, ${pressGlow.toFixed(3)})` : `rgba(0, 229, 255, ${pressGlow.toFixed(3)})`;
        const pGrad = this._safeRadialGrad(
          ctx,
          cxMid,
          cavTop + cavH * 0.55,
          1,
          cxMid,
          cavTop + cavH * 0.55,
          Math.max(cavW, cavH) * 0.55
        );
        if (typeof pGrad !== 'string') {
          pGrad.addColorStop(0, pCol);
          pGrad.addColorStop(1, 'rgba(7, 13, 27, 0)');
        }
        ctx.fillStyle = pGrad;
        ctx.fillRect(cx0 + 1, cavTop + 1, cavW - 2, cavH - 2);

        // Oscillating air-plug particles inside the neck
        const numParticles = 4;
        for (let pi = 0; pi < numParticles; pi++) {
          const px = nx0 + ((pi + 0.5) / numParticles) * neckW;
          const py = ductBot + wallThick * 0.5 + plugDisp * plugOscAmp + ((pi % 2) - 0.5) * 2.5;
          ctx.fillStyle = isComp ? '#ffab40' : '#00e5ff';
          ctx.beginPath();
          this._safeArc(ctx, px, py, compact ? 1.8 : 2.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Velocity vector arrow on center hero cavity
        if (showVectors && cIdx === 1 && Math.abs(plugVel) > 0.15) {
          const arrowDir = plugVel > 0 ? 1 : -1;
          const ay0 = ductBot + wallThick * 0.5 - arrowDir * 5;
          const ay1 = ductBot + wallThick * 0.5 + arrowDir * 7;
          this.drawArrow(cxMid, ay0, cxMid, ay1, '#69f0ae', 1.4);
        }

        // Label center cavity
        if (showHUD && cIdx === 1) {
          ctx.font = `700 ${tiny ? 8 : 9}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#e2e8f0';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Cavitate V (${this._helmData.volCm3.toFixed(1)} cm³)`, cxMid, cavTop + cavH * 0.56, cavW - 8);
        }
      }

      if (showHUD) {
        ctx.font = `600 ${tiny ? 8 : 9}px Inter, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Undă incidentă', padX + 4, ductBot + wallThick * 0.5);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#69f0ae';
        ctx.fillText('Undă atenuată', w - padX - 4, ductBot + wallThick * 0.5);
      }

      ctx.restore();
    }

    // --- Zone 2: Lower Stage (FFT Spectrum + Ringdown y(t)) ---
    _renderLowerStage(ctx, x, y, w, h, opts) {
      const { compact, showGraph } = opts;

      ctx.save();
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 0.5);
      ctx.lineTo(x + w, y + 0.5);
      ctx.stroke();

      if (!showGraph) {
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Graficele de spectru FFT și ringdown sunt ascunse din Setări.', x + w * 0.5, y + h * 0.5);
        ctx.restore();
        return;
      }

      if (compact) {
        const pad = 6;
        const gap = 6;
        const fftW = w - pad * 2;
        const fftH = Math.max(40, Math.round((h - pad * 2 - gap) * 0.68));
        const ringW = fftW;
        const ringH = Math.max(24, h - pad * 2 - gap - fftH);

        this._renderFFTPanel(ctx, x + pad, y + pad, fftW, fftH, opts);
        this._renderRingdownPanel(ctx, x + pad, y + pad + fftH + gap, ringW, ringH, opts);
      } else {
        const pad = 10;
        const gap = 10;
        const fftW = Math.round((w - pad * 2 - gap) * 0.67);
        const fftH = h - pad * 2;
        const ringW = w - pad * 2 - gap - fftW;
        const ringH = fftH;

        this._renderFFTPanel(ctx, x + pad, y + pad, fftW, fftH, opts);
        this._renderRingdownPanel(ctx, x + pad + fftW + gap, y + pad, ringW, ringH, opts);
      }

      ctx.restore();
    }

    _renderFFTPanel(ctx, px, py, pw, ph, opts) {
      const { compact, tiny, showHUD, showVectors, highContrast } = opts;
      ctx.save();

      // Card container
      this._drawRoundedRect(ctx, px, py, pw, ph, 7);
      ctx.fillStyle = 'rgba(11, 20, 38, 0.94)';
      ctx.fill();
      ctx.strokeStyle = highContrast ? '#475569' : '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Header & legend
      ctx.font = `700 ${tiny ? 8.5 : 10}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const hdr = compact ? 'SPECTRUM FFT (0–3500 Hz)' : 'ANALIZOR SPECTRUM FFT (0 – 3500 Hz)';
      ctx.fillText(hdr, px + 8, py + (compact ? 10 : 12));

      if (!tiny) {
        ctx.font = '600 8.5px Inter, sans-serif';
        ctx.textAlign = 'right';
        if (this.helmholtzMode) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('--- Fără liner', px + pw - 68, py + (compact ? 10 : 12));
          ctx.fillStyle = '#00e5ff';
          ctx.fillText('— Cu liner', px + pw - 8, py + (compact ? 10 : 12));
        } else {
          ctx.fillStyle = '#69f0ae';
          ctx.fillText('--- Etalon', px + pw - 52, py + (compact ? 10 : 12));
          ctx.fillStyle = '#00e5ff';
          ctx.fillText('— Live', px + pw - 8, py + (compact ? 10 : 12));
        }
      }

      const ml = compact ? 28 : 34;
      const mr = 10;
      const mt = compact ? 18 : 22;
      const mb = compact ? 16 : 20;
      const plotX = px + ml;
      const plotY = py + mt;
      const plotW = Math.max(40, pw - ml - mr);
      const plotH = Math.max(30, ph - mt - mb);

      const dbTop = 4.0;
      const dbBot = -66.0;
      const fToX = (f) => plotX + (clamp(f, 0, F_MAX_DISP) / F_MAX_DISP) * plotW;
      const dbToY = (db) => plotY + ((dbTop - clamp(db, dbBot, dbTop)) / (dbTop - dbBot)) * plotH;

      // Grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.42)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const dbTicks = [0, -20, -40, -60];
      for (let i = 0; i < dbTicks.length; i++) {
        const gy = dbToY(dbTicks[i]);
        ctx.moveTo(plotX, gy);
        ctx.lineTo(plotX + plotW, gy);
      }
      const xTicks = compact ? [0, 1000, 2000, 3000] : [0, 500, 1000, 1500, 2000, 2500, 3000, 3500];
      for (let i = 0; i < xTicks.length; i++) {
        const gx = fToX(xTicks[i]);
        ctx.moveTo(gx, plotY);
        ctx.lineTo(gx, plotY + plotH);
      }
      ctx.stroke();

      // Axis labels
      ctx.font = `600 ${tiny ? 7.5 : 8.5}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < dbTicks.length; i++) {
        ctx.fillText(String(dbTicks[i]), plotX - 4, dbToY(dbTicks[i]));
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < xTicks.length; i++) {
        const label = xTicks[i] === 0 ? '0' : `${xTicks[i]}`;
        ctx.fillText(label, fToX(xTicks[i]), plotY + plotH + 3);
      }

      if (this.helmholtzMode) {
        this._renderHelmholtzSpectrumCurves(ctx, plotX, plotY, plotW, plotH, fToX, dbToY, opts);
      } else {
        this._renderBladeSpectrumCurves(ctx, plotX, plotY, plotW, plotH, fToX, dbToY, opts);
      }

      ctx.restore();
    }

    _renderBladeSpectrumCurves(ctx, plotX, plotY, plotW, plotH, fToX, dbToY, opts) {
      const { compact, tiny, showHUD, showVectors } = opts;

      // 1. Green dashed reference markers & curve ("Piesă Etalon Conformă")
      ctx.save();
      ctx.strokeStyle = 'rgba(105, 240, 174, 0.42)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.1;
      for (let m = 0; m < 3; m++) {
        const rx = fToX(F0_HEALTHY[m]);
        ctx.beginPath();
        ctx.moveTo(rx, plotY);
        ctx.lineTo(rx, plotY + plotH);
        ctx.stroke();
      }

      // Healthy reference FFT curve (max-hold per pixel from _refMagDb)
      ctx.strokeStyle = 'rgba(105, 240, 174, 0.48)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      const dfCap = FS / N_CAP; // 1.0 Hz
      const stepPx = 1.5;
      for (let sx = 0; sx <= plotW; sx += stepPx) {
        const f0 = (sx / plotW) * F_MAX_DISP;
        const f1 = ((sx + stepPx) / plotW) * F_MAX_DISP;
        const k0 = clamp(Math.floor(f0 / dfCap), 0, (N_CAP >> 1) - 1);
        const k1 = clamp(Math.ceil(f1 / dfCap), k0, (N_CAP >> 1) - 1);
        let peakDb = -66.0;
        for (let k = k0; k <= k1; k++) {
          if (this._refMagDb[k] > peakDb) peakDb = this._refMagDb[k];
        }
        const cy = dbToY(peakDb);
        if (sx === 0) ctx.moveTo(plotX + sx, cy);
        else ctx.lineTo(plotX + sx, cy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 2. Active FFT curve (blend captured impulse peak-hold with live ringdown spectrum)
      const strokeCol = this._dsp.verdictType === 'crack' ? '#ff5252' :
        (this._dsp.verdictType === 'void' || this._dsp.verdictType === 'warning' ? '#ffab40' : '#00e5ff');
      const liveBlend = clamp(0.28 + 0.55 * Math.exp(-this.timeSinceStrike / 1.4), 0.25, 0.85);
      const dfLive = FS / N_LIVE; // 2.0 Hz

      ctx.save();
      ctx.beginPath();
      const curvePts = [];
      for (let sx = 0; sx <= plotW; sx += stepPx) {
        const f0 = (sx / plotW) * F_MAX_DISP;
        const f1 = ((sx + stepPx) / plotW) * F_MAX_DISP;
        const k0c = clamp(Math.floor(f0 / dfCap), 0, (N_CAP >> 1) - 1);
        const k1c = clamp(Math.ceil(f1 / dfCap), k0c, (N_CAP >> 1) - 1);
        let capDb = -66.0;
        for (let k = k0c; k <= k1c; k++) {
          if (this._magCapDb[k] > capDb) capDb = this._magCapDb[k];
        }

        const k0l = clamp(Math.floor(f0 / dfLive), 0, (N_LIVE >> 1) - 1);
        const k1l = clamp(Math.ceil(f1 / dfLive), k0l, (N_LIVE >> 1) - 1);
        let liveDb = -66.0;
        for (let k = k0l; k <= k1l; k++) {
          if (this._magLiveDb[k] > liveDb) liveDb = this._magLiveDb[k];
        }

        const dispDb = Math.max(capDb - (1.0 - liveBlend) * 4.0, liveDb);
        const cy = dbToY(dispDb);
        curvePts.push({ x: plotX + sx, y: cy });
        if (sx === 0) ctx.moveTo(plotX + sx, cy);
        else ctx.lineTo(plotX + sx, cy);
      }
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 1.9;
      ctx.stroke();

      // Shaded area fill
      if (curvePts.length > 1) {
        ctx.lineTo(curvePts[curvePts.length - 1].x, plotY + plotH);
        ctx.lineTo(curvePts[0].x, plotY + plotH);
        ctx.closePath();
        const fillGrad = this._safeLinearGrad(ctx, 0, plotY, 0, plotY + plotH, 'rgba(0, 229, 255, 0.12)');
        if (typeof fillGrad !== 'string') {
          fillGrad.addColorStop(0, this._dsp.verdictType === 'crack' ? 'rgba(255, 82, 82, 0.28)' :
            (this._dsp.verdictType === 'void' ? 'rgba(255, 171, 64, 0.25)' : 'rgba(0, 229, 255, 0.28)'));
          fillGrad.addColorStop(1, 'rgba(8, 13, 26, 0.02)');
        }
        ctx.fillStyle = fillGrad;
        ctx.fill();
      }
      ctx.restore();

      // 3. Peak markers & callouts
      const dsp = this._dsp;
      for (let m = 0; m < 3; m++) {
        const fPk = dsp.fHat[m];
        const dbPk = dsp.peakDb[m];
        if (dbPk < -50.0) continue; // Mode suppressed (e.g. Mode 2 at node 0.78 L)
        const mx = fToX(fPk);
        const my = dbToY(dbPk);

        ctx.save();
        ctx.fillStyle = strokeCol;
        ctx.beginPath();
        this._safeArc(ctx, mx, my, 3.0, 0, Math.PI * 2);
        ctx.fill();

        if (showHUD) {
          ctx.font = `700 ${tiny ? 7.5 : 8.5}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#e2e8f0';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const lbl = compact ? `f${m + 1}` : `f${m + 1}=${Math.round(fPk)}`;
          ctx.fillText(lbl, mx, Math.max(plotY + 10, my - 4));
        }
        ctx.restore();
      }

      // Shift arrow (Δf) when Mode 1 shifted significantly
      if (Math.abs(dsp.deltaF1) >= 4.0 && showVectors) {
        const refX = fToX(F0_HEALTHY[0]);
        const curX = fToX(dsp.fHat[0]);
        const arrY = plotY + Math.max(10, plotH * 0.11);
        this.drawArrow(refX, arrY, curX, arrY, '#ff5252', 1.5);
        if (showHUD) {
          ctx.save();
          ctx.font = `700 ${tiny ? 8 : 8.5}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#ff8a80';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Δf=${Math.round(dsp.deltaF1)} Hz`, refX + 6, arrY);
          ctx.restore();
        }
      }

      // 4. Zoom-FFT Inset (320 - 460 Hz) positioned in spectral valley [1650..2550 Hz] on desktop
      if (!compact && plotW >= 340 && plotH >= 120) {
        const insetW = Math.min(132, plotW * 0.30);
        const insetH = Math.min(68, plotH * 0.42);
        const insetX = plotX + plotW * 0.47;
        const insetY = plotY + 4;

        ctx.save();
        this._drawRoundedRect(ctx, insetX, insetY, insetW, insetH, 5);
        ctx.fillStyle = 'rgba(6, 10, 22, 0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('ZOOM f₁ (320–460 Hz)', insetX + 5, insetY + 3);

        const ix = insetX + 5;
        const iy = insetY + 14;
        const iw = insetW - 10;
        const ih = insetH - 18;
        const zfToX = (f) => ix + ((f - 320) / 140) * iw;
        const zdbToY = (db) => iy + ((4.0 - clamp(db, -60, 4)) / 64.0) * ih;

        // Reference 420 Hz vertical tick inside zoom inset
        ctx.strokeStyle = 'rgba(105, 240, 174, 0.55)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(zfToX(420), iy);
        ctx.lineTo(zfToX(420), iy + ih);
        ctx.stroke();
        ctx.setLineDash([]);

        // Zoom curve from magCapDb bins 320..460
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let f = 320; f <= 460; f++) {
          const zx = zfToX(f);
          const zy = zdbToY(this._magCapDb[f]);
          if (f === 320) ctx.moveTo(zx, zy);
          else ctx.lineTo(zx, zy);
        }
        ctx.stroke();

        if (dsp.doubletSplitHz >= 4.0 && dsp.secFreq1 > 0) {
          ctx.fillStyle = '#ffab40';
          ctx.beginPath();
          this._safeArc(ctx, zfToX(dsp.secFreq1), zdbToY(this._magCapDb[Math.round(dsp.secFreq1)]), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    _renderHelmholtzSpectrumCurves(ctx, plotX, plotY, plotW, plotH, fToX, dbToY, opts) {
      const { tiny, showHUD, showVectors } = opts;
      const df = FS / N_LIVE; // 2.0 Hz
      const stepPx = 1.5;

      // 1. Incident spectrum (dashed reference)
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let sx = 0; sx <= plotW; sx += stepPx) {
        const f0 = (sx / plotW) * F_MAX_DISP;
        const f1 = ((sx + stepPx) / plotW) * F_MAX_DISP;
        const k0 = clamp(Math.floor(f0 / df), 0, (N_LIVE >> 1) - 1);
        const k1 = clamp(Math.ceil(f1 / df), k0, (N_LIVE >> 1) - 1);
        let peak = -66.0;
        for (let k = k0; k <= k1; k++) {
          if (this._magIncDb[k] > peak) peak = this._magIncDb[k];
        }
        const cy = dbToY(peak);
        if (sx === 0) ctx.moveTo(plotX + sx, cy);
        else ctx.lineTo(plotX + sx, cy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Transmitted attenuated spectrum (solid cyan)
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const pts = [];
      for (let sx = 0; sx <= plotW; sx += stepPx) {
        const f0 = (sx / plotW) * F_MAX_DISP;
        const f1 = ((sx + stepPx) / plotW) * F_MAX_DISP;
        const k0 = clamp(Math.floor(f0 / df), 0, (N_LIVE >> 1) - 1);
        const k1 = clamp(Math.ceil(f1 / df), k0, (N_LIVE >> 1) - 1);
        let peak = -66.0;
        for (let k = k0; k <= k1; k++) {
          if (this._magTransDb[k] > peak) peak = this._magTransDb[k];
        }
        const cy = dbToY(peak);
        pts.push({ x: plotX + sx, y: cy });
        if (sx === 0) ctx.moveTo(plotX + sx, cy);
        else ctx.lineTo(plotX + sx, cy);
      }
      ctx.stroke();

      if (pts.length > 1) {
        ctx.lineTo(pts[pts.length - 1].x, plotY + plotH);
        ctx.lineTo(pts[0].x, plotY + plotH);
        ctx.closePath();
        const fillGrad = this._safeLinearGrad(ctx, 0, plotY, 0, plotY + plotH, 'rgba(0, 229, 255, 0.14)');
        if (typeof fillGrad !== 'string') {
          fillGrad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
          fillGrad.addColorStop(1, 'rgba(8, 13, 26, 0.02)');
        }
        ctx.fillStyle = fillGrad;
        ctx.fill();
      }

      // 3. Helmholtz notch marker at f_H
      const fH = this.helmholtzFreq;
      const hx = fToX(fH);
      const kH = clamp(Math.round(fH / df), 1, (N_LIVE >> 1) - 2);
      const yInc = dbToY(this._magIncDb[kH]);
      const yTr = dbToY(this._magTransDb[kH]);

      ctx.strokeStyle = '#69f0ae';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx, plotY);
      ctx.lineTo(hx, plotY + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      if (showVectors && Math.abs(yTr - yInc) > 6) {
        this.drawArrow(hx, yInc, hx, yTr, '#69f0ae', 1.6);
      }

      if (showHUD) {
        ctx.font = `700 ${tiny ? 8 : 9}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#69f0ae';
        ctx.textAlign = hx > plotX + plotW * 0.65 ? 'right' : 'left';
        ctx.textBaseline = 'top';
        const tx = hx + (hx > plotX + plotW * 0.65 ? -6 : 6);
        ctx.fillText(`f_H=${Math.round(fH)}Hz (${this._helmData.attenuationDb.toFixed(1)}dB)`, tx, plotY + 4);
      }

      ctx.restore();
    }

    _renderRingdownPanel(ctx, px, py, pw, ph, opts) {
      const { compact, tiny, showHUD, highContrast } = opts;
      ctx.save();

      this._drawRoundedRect(ctx, px, py, pw, ph, 7);
      ctx.fillStyle = 'rgba(11, 20, 38, 0.94)';
      ctx.fill();
      ctx.strokeStyle = highContrast ? '#475569' : '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Header + Q readout
      ctx.font = `700 ${tiny ? 8.5 : 10}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const hdr = this.helmholtzMode
        ? (compact ? 'p(t) Presiune Nacelă' : 'SEMNAL ACUSTIC p(t)')
        : (compact ? 'y(t) Ringdown' : 'RĂSPUNS IMPULS y(t)');
      ctx.fillText(hdr, px + 8, py + (compact ? 9 : 12));

      if (showHUD) {
        ctx.textAlign = 'right';
        if (this.helmholtzMode) {
          ctx.fillStyle = '#69f0ae';
          ctx.fillText(`${this._helmData.attenuationDb.toFixed(1)} dB`, px + pw - 8, py + (compact ? 9 : 12));
        } else {
          const q = this._dsp.q1Hat;
          ctx.fillStyle = q >= 600 ? '#69f0ae' : (q >= 380 ? '#ffab40' : '#ff5252');
          ctx.fillText(`Q = ${q}`, px + pw - 8, py + (compact ? 9 : 12));
        }
      }

      const mt = compact ? 16 : 22;
      const mb = compact ? 6 : 12;
      const ml = 8;
      const mr = 8;
      const plotX = px + ml;
      const plotY = py + mt;
      const plotW = Math.max(30, pw - ml - mr);
      const plotH = Math.max(16, ph - mt - mb);
      const midY = plotY + plotH * 0.5;
      const ampPx = plotH * 0.42;

      // Center baseline
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, midY);
      ctx.lineTo(plotX + plotW, midY);
      ctx.stroke();

      if (this.helmholtzMode) {
        // Plot incident (dashed) vs attenuated (cyan) steady-state pressure waveform
        const nShow = 160;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i <= nShow; i++) {
          const wx = plotX + (i / nShow) * plotW;
          const idx = 1024 + i;
          const wy = midY - clamp(this._pInc[idx] / 1.8, -1, 1) * ampPx;
          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i <= nShow; i++) {
          const wx = plotX + (i / nShow) * plotW;
          const idx = 1024 + i;
          const wy = midY - clamp(this._pTrans[idx] / 1.8, -1, 1) * ampPx;
          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      } else {
        // Plot time-domain ringdown y(t) from 0 to 0.55 s + exponential decay envelope
        const tSpan = 0.55;
        const m0 = this._modes[0];
        const sigma1 = m0 ? (Math.PI * m0.fa) / m0.qa : 1.1;
        const traceCol = this._dsp.verdictType === 'crack' ? '#ff5252' :
          (this._dsp.verdictType === 'void' || this._dsp.verdictType === 'warning' ? '#ffab40' : '#00e5ff');

        // Dashed exponential decay envelope
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        for (let sign = -1; sign <= 1; sign += 2) {
          ctx.beginPath();
          for (let sx = 0; sx <= plotW; sx += 3) {
            const t = (sx / plotW) * tSpan;
            const env = Math.exp(-sigma1 * t);
            const ey = midY + sign * env * ampPx * 0.92;
            if (sx === 0) ctx.moveTo(plotX + sx, ey);
            else ctx.lineTo(plotX + sx, ey);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Synthesized y(t) trace (downsampled cleanly to pixel columns)
        const nTotal = Math.min(N_CAP - K0_PRE, Math.floor(tSpan * FS));
        let maxAbs = 0.2;
        for (let n = 0; n < nTotal; n += 2) {
          const v = Math.abs(this._yCap[K0_PRE + n]);
          if (v > maxAbs) maxAbs = v;
        }
        const scaleY = ampPx / maxAbs;

        ctx.strokeStyle = traceCol;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        const samplesPerPx = Math.max(1, Math.floor(nTotal / plotW));
        for (let sx = 0; sx < plotW; sx++) {
          const nStart = K0_PRE + Math.floor((sx / plotW) * nTotal);
          let vMin = Infinity;
          let vMax = -Infinity;
          for (let k = 0; k < samplesPerPx; k++) {
            const v = this._yCap[Math.min(N_CAP - 1, nStart + k)];
            if (v < vMin) vMin = v;
            if (v > vMax) vMax = v;
          }
          const yTop = midY - vMax * scaleY;
          const yBot = midY - vMin * scaleY;
          if (sx === 0) ctx.moveTo(plotX + sx, yTop);
          else ctx.lineTo(plotX + sx, yTop);
          ctx.lineTo(plotX + sx, yBot);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  window.AcousticNDTSim = AcousticNDTSim;
})();
