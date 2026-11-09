/* ============================================================
   PLACEHOLDER-SIM.JS — Generic Placeholder for Slides 2-15
   Shows animated particle background with slide info
   ============================================================ */

(function () {
  'use strict';

  class PlaceholderSim extends BaseSim {
    constructor(canvasId, config) {
      super(canvasId, config);
      this.icon = config.placeholderIcon || '🔧';
      this.title = config.placeholderTitle || 'Simulare în pregătire';
      this.desc = config.placeholderDesc || 'Conținut interactiv va fi adăugat aici.';

      // Animated particles
      this.particles = [];
      this.numParticles = 40;
    }

    onInit() {
      this._initParticles();
      // Auto-start the ambient animation
      this.start();
    }

    onReset() {
      this._initParticles();
    }

    _initParticles() {
      this.particles = [];
      for (let i = 0; i < this.numParticles; i++) {
        this.particles.push({
          x: Math.random() * (this.W || 400),
          y: Math.random() * (this.H || 400),
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          r: 1 + Math.random() * 2,
          alpha: 0.1 + Math.random() * 0.3,
          hue: Math.random() > 0.5 ? 186 : 36 // cyan or amber
        });
      }
    }

    update(dt) {
      const W = this.W || 400;
      const H = this.H || 400;

      for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Wrap around
        if (p.x < 0) p.x += W;
        if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H;
        if (p.y > H) p.y -= H;

        // Gentle oscillation
        p.alpha = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * 2 + p.x * 0.01));
      }
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;

      // Background
      ctx.fillStyle = '#080c18';
      ctx.fillRect(0, 0, W, H);

      // Radial glow at center
      const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.04)');
      grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.01)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Particles
      for (const p of this.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.alpha})`;
        ctx.fill();
      }

      // Connect nearby particles
      ctx.lineWidth = 0.5;
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const a = this.particles[i];
          const b = this.particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.strokeStyle = `rgba(0, 229, 255, ${0.08 * (1 - dist / 80)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Central text
      const centerY = H * 0.4;

      // Icon
      ctx.font = `${Math.min(48, W * 0.1)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.icon, W / 2, centerY - 30);

      // Title
      ctx.fillStyle = '#9e9eb8';
      ctx.font = `bold ${Math.min(16, W * 0.035)}px Inter, sans-serif`;
      ctx.fillText(this.title, W / 2, centerY + 20);

      // Description (word wrap)
      ctx.fillStyle = '#5c5e78';
      ctx.font = `${Math.min(12, W * 0.025)}px Inter, sans-serif`;
      this._wrapText(ctx, this.desc, W / 2, centerY + 45, W * 0.7, 18);

      // "Coming Soon" badge
      const badgeY = centerY + 90;
      const badgeText = 'ÎN DEZVOLTARE';
      ctx.font = 'bold 10px Inter, sans-serif';
      const tw = ctx.measureText(badgeText).width;
      const bw = tw + 24;
      const bh = 24;

      ctx.fillStyle = 'rgba(255, 171, 64, 0.1)';
      ctx.strokeStyle = 'rgba(255, 171, 64, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(W / 2 - bw / 2, badgeY - bh / 2, bw, bh, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffab40';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, W / 2, badgeY);
    }

    _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      let line = '';
      let testLine;
      let lineCount = 0;

      for (const word of words) {
        testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth && line !== '') {
          ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
          line = word + ' ';
          lineCount++;
          if (lineCount > 3) break; // max 4 lines
        } else {
          line = testLine;
        }
      }
      if (lineCount <= 3) {
        ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
      }
    }
  }

  window.PlaceholderSim = PlaceholderSim;
})();
