/* HELVETIC DYNAMICS — courbes de niveau animées (bruit + marching squares), altimètre, navigation */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- bruit déterministe ---------- */
  function hash(x, y, s) { var h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s) { var t = 0, amp = 0.5, f = 1; for (var o = 0; o < 3; o++) { t += amp * vnoise(x * f, y * f, s + o); amp *= 0.5; f *= 2.03; } return t; }

  /* ---------- une carte ---------- */
  function Topo(canvas, o) { this.c = canvas; this.o = o; this.ctx = canvas.getContext('2d'); this.visible = true; this.setup(); }
  Topo.prototype.setup = function () {
    var c = this.c, o = this.o;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = c.clientWidth; this.H = c.clientHeight;
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    this.cell = this.W < 700 ? 9 : 11;
    this.nx = Math.ceil(this.W / this.cell) + 1; this.ny = Math.ceil(this.H / this.cell) + 1;
    this.sc = o.scale / Math.max(this.W, 900);
    this.peaks = typeof o.peaks === 'function' ? o.peaks(this.W) : o.peaks;
    this.base = new Float32Array(this.nx * this.ny);
    for (var j = 0; j < this.ny; j++) for (var i = 0; i < this.nx; i++) {
      var x = i * this.cell, y = j * this.cell, v = 0, W = this.W, H = this.H;
      (this.peaks || []).forEach(function (p) { var dx = (x - p[0] * W) / (p[2] * W), dy = (y - p[1] * H) / (p[2] * W); v += p[3] * Math.exp(-(dx * dx + dy * dy)); });
      this.base[j * this.nx + i] = v;
    }
    this.F = new Float32Array(this.nx * this.ny);
    this.field(0);
    var lo = Infinity, hi = -Infinity;
    for (var k = 0; k < this.F.length; k++) { if (this.F[k] < lo) lo = this.F[k]; if (this.F[k] > hi) hi = this.F[k]; }
    var pad = (hi - lo) * 0.04; this.lo = lo - pad; this.hi = hi + pad;
    this.stroke = o.stroke(this.ctx, this.H);
  };
  Topo.prototype.field = function (t) {
    var nx = this.nx, ny = this.ny, cell = this.cell, sc = this.sc, s = this.o.seed, sp = this.o.speed;
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var x = i * cell * sc, y = j * cell * sc;
      // deux couches de relief qui glissent en sens opposés : les lignes « respirent »
      var v = 0.5 * fbm(x + t * sp, y + t * sp * 0.4, s) + 0.5 * fbm(x - t * sp * 0.7, y + 3.1 - t * sp * 0.3, s + 7);
      this.F[j * nx + i] = v * 0.55 + this.base[j * nx + i];
    }
  };
  Topo.prototype.draw = function (t) {
    var o = this.o, ctx = this.ctx, W = this.W, H = this.H, nx = this.nx, ny = this.ny, cell = this.cell, F = this.F;
    this.field(t);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.lineCap = 'round';
    var A0 = o.alt[0], A1 = o.alt[1], lo = this.lo, hi = this.hi, step = o.step, labels = [];
    for (var L = Math.ceil(A0 / step) * step; L < A1; L += step) {
      var idx = L % (step * 5) === 0, lv = lo + (L - A0) / (A1 - A0) * (hi - lo), best = null;
      ctx.beginPath(); ctx.lineWidth = idx ? o.wIdx : o.w; ctx.strokeStyle = idx ? this.stroke.idx : this.stroke.std;
      for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
        var a = F[j * nx + i], b = F[j * nx + i + 1], c = F[(j + 1) * nx + i + 1], d = F[(j + 1) * nx + i];
        var cs = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (cs === 0 || cs === 15) continue;
        var x0 = i * cell, y0 = j * cell, X1 = x0 + cell, Y1 = y0 + cell;
        var tx = x0 + cell * (lv - a) / (b - a), ry = y0 + cell * (lv - b) / (c - b), bx = x0 + cell * (lv - d) / (c - d), ly = y0 + cell * (lv - a) / (d - a);
        switch (cs) {
          case 1: case 14: ctx.moveTo(x0, ly); ctx.lineTo(bx, Y1); break;
          case 2: case 13: ctx.moveTo(bx, Y1); ctx.lineTo(X1, ry); break;
          case 3: case 12: ctx.moveTo(x0, ly); ctx.lineTo(X1, ry); break;
          case 4: case 11: ctx.moveTo(tx, y0); ctx.lineTo(X1, ry); break;
          case 5: ctx.moveTo(x0, ly); ctx.lineTo(tx, y0); ctx.moveTo(bx, Y1); ctx.lineTo(X1, ry); break;
          case 6: case 9: ctx.moveTo(tx, y0); ctx.lineTo(bx, Y1); break;
          case 7: case 8: ctx.moveTo(x0, ly); ctx.lineTo(tx, y0); break;
          case 10: ctx.moveTo(x0, ly); ctx.lineTo(bx, Y1); ctx.moveTo(tx, y0); ctx.lineTo(X1, ry); break;
        }
        if (idx && o.labels && W >= 700) {
          var dd = Math.abs(x0 - o.labels.x * W) + Math.abs(y0 - o.labels.y * H) * 0.4;
          if (!best || dd < best.d) best = { d: dd, x: x0 + cell / 2, y: y0 + cell / 2 };
        }
      }
      ctx.stroke();
      if (best) labels.push({ x: best.x, y: best.y, t: String(L).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') });
    }
    ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    labels.forEach(function (l) {
      var w = ctx.measureText(l.t).width + 8;
      ctx.fillStyle = o.labelBg; ctx.fillRect(l.x - w / 2, l.y - 7, w, 14);
      ctx.fillStyle = o.labelFg; ctx.fillText(l.t, l.x, l.y + 0.5);
    });
    if (o.summit && this.peaks) {
      var p = this.peaks[0], sx = p[0] * W, sy = p[1] * H;
      ctx.fillStyle = '#e1251b'; ctx.beginPath(); ctx.moveTo(sx, sy - 7); ctx.lineTo(sx + 6, sy + 4); ctx.lineTo(sx - 6, sy + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0d0d0e'; ctx.font = '500 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(o.summit, sx + 12, sy);
    }
    if (o.grid) {
      ctx.strokeStyle = o.grid; ctx.lineWidth = 1; ctx.setLineDash([2, 6]); var g = W < 700 ? 120 : 180;
      ctx.beginPath();
      for (var gx = g; gx < W; gx += g) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
      for (var gy = g; gy < H; gy += g) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
      ctx.stroke(); ctx.setLineDash([]);
    }
  };

  var CFG = {
    'topo-hero': { seed: 3, scale: 3.2, speed: 0.05, alt: [400, 4120], step: 100, w: 0.8, wIdx: 1.4,
      peaks: function (W) { return W < 700 ? [[0.72, 0.8, 0.35, 0.95], [0.15, 0.25, 0.3, 0.3]] : [[0.84, 0.3, 0.2, 0.95], [0.92, 0.8, 0.18, 0.4], [0.18, 0.95, 0.25, 0.25]]; },
      stroke: function () { return { std: 'rgba(13,13,14,0.13)', idx: 'rgba(13,13,14,0.32)' }; },
      labels: { x: 0.6, y: 0.62 }, labelBg: '#ffffff', labelFg: '#5d5f63', summit: '4 120', grid: 'rgba(13,13,14,0.08)' },
    'topo-descent': { seed: 11, scale: 2.4, speed: 0.04, alt: [0, 4000], step: 100, w: 0.8, wIdx: 1.4,
      peaks: [[0.3, 0.1, 0.4, 0.8]],
      stroke: function (ctx, H) {
        var a = ctx.createLinearGradient(0, 0, 0, H); a.addColorStop(0, 'rgba(13,13,14,0.16)'); a.addColorStop(0.5, 'rgba(120,120,120,0.12)'); a.addColorStop(1, 'rgba(242,242,240,0.14)');
        var b = ctx.createLinearGradient(0, 0, 0, H); b.addColorStop(0, 'rgba(13,13,14,0.34)'); b.addColorStop(0.5, 'rgba(140,140,140,0.25)'); b.addColorStop(1, 'rgba(242,242,240,0.3)');
        return { std: a, idx: b };
      } },
    'topo-dark': { seed: 21, scale: 2.8, speed: 0.04, alt: [0, 3000], step: 100, w: 0.7, wIdx: 1.2,
      peaks: [[0.85, 0.3, 0.3, 0.7]],
      stroke: function () { return { std: 'rgba(242,242,240,0.07)', idx: 'rgba(242,242,240,0.16)' }; },
      labels: { x: 0.82, y: 0.6 }, labelBg: '#000000', labelFg: '#6d6e72' },
  };
  var maps = [];
  Object.keys(CFG).forEach(function (id) { var c = document.getElementById(id); if (c) maps.push(new Topo(c, CFG[id])); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { maps.forEach(function (m) { if (m.c === e.target) m.visible = e.isIntersecting; }); }); });
    maps.forEach(function (m) { io.observe(m.c); });
  }
  var t0 = performance.now(), last = 0;
  function frame(now) {
    if (now - last > 45) { // ~22 images/s : fluide mais léger
      last = now; var t = (now - t0) / 1000;
      maps.forEach(function (m) { if (m.visible) m.draw(t); });
    }
    requestAnimationFrame(frame);
  }
  function redrawAll() { maps.forEach(function (m) { m.setup(); m.draw(reduce ? 0 : (performance.now() - t0) / 1000); }); }
  redrawAll();
  if (!reduce) requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(redrawAll, 150); });

  /* ---------- altimètre : plus on descend dans la page, plus on monte ---------- */
  var altEl = document.getElementById('alt'), altBox = document.querySelector('.altimeter'), engine = document.getElementById('moteur');
  function fmtAlt(m) {
    if (m < 1000) return Math.round(m) + ' m';
    var km = m / 1000;
    return (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)) + ' km';
  }
  function updateAlt() {
    var end = engine.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;
    var p = Math.max(0, Math.min(1, window.scrollY / Math.max(1, end)));
    altEl.textContent = p >= 1 ? 'Espace' : fmtAlt(404 * Math.pow(100000 / 404, p));
    altBox.classList.toggle('is-on', window.scrollY > 260);
  }

  /* ---------- navigation : sombre sur le blanc, claire sur le noir ---------- */
  var nav = document.querySelector('.nav'), descent = document.querySelector('.descent');
  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
    var r = descent.getBoundingClientRect();
    nav.classList.toggle('is-dark', r.top + r.height * 0.55 < 76);
    updateAlt();
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.getElementById('year').textContent = new Date().getFullYear();
})();
