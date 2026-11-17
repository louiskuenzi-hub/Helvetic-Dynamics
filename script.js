/* HELVETIC DYNAMICS — courbes de niveau animées (bruit + marching squares), altimètre, navigation */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- atmosphère standard (US Standard Atmosphere 1976) : pression en Pa, température en K ---------- */
  var ISA = [[0, -6.5], [11, 0], [20, 1], [32, 2.8], [47, 0], [51, -2.8], [71, -2], [84.852, 0]];
  var HI_P = [[86, 0.3734], [90, 0.1836], [95, 0.076], [100, 0.032]], HI_T = [[86, 186.87], [91, 186.87], [95, 188.4], [100, 195.08]];
  function lerpTab(tab, x, log) {
    for (var i = 1; i < tab.length; i++) if (x <= tab[i][0] || i === tab.length - 1) {
      var a = tab[i - 1], b = tab[i], k = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return log ? Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * k) : a[1] + (b[1] - a[1]) * k;
    }
  }
  function atm(z) { // z : altitude géométrique en mètres
    var km = z / 1000;
    if (km > 86) return { p: lerpTab(HI_P, km, true), T: lerpTab(HI_T, km, false) };
    var h = 6356.766 * km / (6356.766 + km), T = 288.15, P = 101325;
    for (var i = 0; i < ISA.length - 1; i++) {
      var h0 = ISA[i][0], L = ISA[i][1], top = Math.min(h, ISA[i + 1][0]), dh = top - h0;
      if (dh <= 0) break;
      if (L) { var T1 = T + L * dh; P *= Math.pow(T1 / T, -34.1632 / L); T = T1; } else P *= Math.exp(-34.1632 * dh / T);
    }
    return { p: P, T: T };
  }
  window.HD = window.HD || {}; window.HD.atm = atm;
  var T = function (k) { return window.HD.t ? window.HD.t(k) : k; };
  var NUM = function (v, d) { return window.HD.num ? window.HD.num(v, d) : (d ? v.toFixed(d) : String(Math.round(v))); };

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
    var P = this.ptr, pa = P ? P.a : 0, R2 = P ? P.r * P.r : 1;
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var x = i * cell * sc, y = j * cell * sc;
      // deux couches de relief qui glissent en sens opposés : les lignes « respirent »
      var v = 0.5 * fbm(x + t * sp, y + t * sp * 0.4, s) + 0.5 * fbm(x - t * sp * 0.7, y + 3.1 - t * sp * 0.3, s + 7);
      var f = v * 0.55 + this.base[j * nx + i];
      // le relief se soulève sous le curseur
      if (pa > 0.002) { var dx = i * cell - P.x, dy = j * cell - P.y; f += pa * Math.exp(-(dx * dx + dy * dy) / R2); }
      this.F[j * nx + i] = f;
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
      if (best) labels.push({ x: best.x, y: best.y, t: NUM(L, 0) });
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
      ctx.fillStyle = '#f2f2f0'; ctx.font = '500 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(T(o.summit), sx + 12, sy);
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
      stroke: function () { return { std: 'rgba(242,242,240,0.12)', idx: 'rgba(242,242,240,0.3)' }; },
      labels: { x: 0.6, y: 0.62 }, labelBg: '#000000', labelFg: '#8a8b8f', summit: 'js.summit', grid: 'rgba(242,242,240,0.06)' },
    'topo-dark': { seed: 21, scale: 2.8, speed: 0.04, alt: [0, 3000], step: 100, w: 0.7, wIdx: 1.2,
      peaks: [[0.85, 0.3, 0.3, 0.7]],
      stroke: function () { return { std: 'rgba(242,242,240,0.07)', idx: 'rgba(242,242,240,0.16)' }; },
      labels: { x: 0.82, y: 0.6 }, labelBg: '#000000', labelFg: '#6d6e72' },
    'topo-contact': { seed: 34, scale: 2.8, speed: 0.04, alt: [0, 3000], step: 100, w: 0.7, wIdx: 1.2,
      peaks: [[0.2, 0.75, 0.3, 0.7]],
      stroke: function () { return { std: 'rgba(242,242,240,0.07)', idx: 'rgba(242,242,240,0.16)' }; },
      labels: { x: 0.2, y: 0.9 }, labelBg: '#000000', labelFg: '#6d6e72' },
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
      maps.forEach(function (m) { if (m.ptr) { var q = m.ptr; q.x += (q.tx - q.x) * 0.3; q.y += (q.ty - q.y) * 0.3; q.a += (q.ta - q.a) * 0.18; } if (m.visible) m.draw(t); });
    }
    requestAnimationFrame(frame);
  }
  function redrawAll() { maps.forEach(function (m) { m.setup(); m.draw(reduce ? 0 : (performance.now() - t0) / 1000); }); }
  redrawAll();
  if (!reduce) requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(redrawAll, 150); });

  /* ---------- le relief suit le curseur dans le hero ---------- */
  var hero = document.querySelector('.hero'), heroMap = maps.filter(function (m) { return m.c.id === 'topo-hero'; })[0];
  if (hero && heroMap && !reduce && window.matchMedia('(hover: hover)').matches) {
    heroMap.ptr = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0, r: 150 };
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect(), q = heroMap.ptr;
      q.tx = e.clientX - r.left; q.ty = e.clientY - r.top; q.ta = 0.2;
      if (q.a < 0.01) { q.x = q.tx; q.y = q.ty; }
    });
    hero.addEventListener('pointerleave', function () { heroMap.ptr.ta = 0; });
  }

  /* ---------- ascension : le défilement fait monter l'altitude de 404 m à 100 km ---------- */
  var asc = document.querySelector('.ascent'), stage = document.querySelector('.ascent__stage'), sky = document.getElementById('ascent-sky');
  var marks = [].slice.call(document.querySelectorAll('.ascent__marks li')), marksBox = document.querySelector('.ascent__marks');
  var vEl = document.getElementById('asc-v'), uEl = document.getElementById('asc-u');
  var pEl = document.getElementById('asc-p'), tEl = document.getElementById('asc-t'), aEl = document.getElementById('asc-a');
  function frn(n, d) { return NUM(n, d); }
  var l1 = document.querySelector('.ascent__l1'), l2 = document.querySelector('.ascent__l2');
  var A0 = 404, A1 = 100000, LN = Math.log(A1 / A0), ascQ = 0, ascOn = false, sctx = sky.getContext('2d'), SW, SH, sdpr;
  // couleur du ciel selon l'altitude : départ à l'aube, bleu nuit, puis noir de l'espace
  var SKY = [[0, 9, 20, 50], [0.25, 11, 28, 68], [0.5, 5, 13, 36], [0.75, 1, 3, 12], [1, 0, 0, 0]];
  function skyAt(q) {
    for (var i = 1; i < SKY.length; i++) if (q <= SKY[i][0]) {
      var a = SKY[i - 1], b = SKY[i], k = (q - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
    return [0, 0, 0];
  }
  function sstep(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  var stars = []; (function () { var sd = 41; function r() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; } for (var i = 0; i < 260; i++) stars.push({ x: r(), y: r(), s: 0.4 + r() * r() * 1.5, d: 0.25 + r() * 0.75, ph: r() * 6.28, tw: 0.5 + r() * 1.6 }); })();
  function skySetup() { sdpr = Math.min(window.devicePixelRatio || 1, 2); SW = sky.clientWidth; SH = sky.clientHeight; sky.width = Math.round(SW * sdpr); sky.height = Math.round(SH * sdpr); }
  function ascUpdate() {
    var r = asc.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - window.innerHeight)));
    ascQ = Math.max(0, Math.min(1, (p - 0.05) / 0.85));
    var alt = A0 * Math.exp(LN * ascQ), c = skyAt(ascQ);
    stage.style.setProperty('--bg', 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')');
    stage.style.setProperty('--fg', '#f2f2f0');
    stage.style.setProperty('--dawn', (1 - sstep(0.04, 0.5, ascQ)).toFixed(3));
    stage.style.setProperty('--sink', sstep(0, 0.4, ascQ).toFixed(3));
    stage.style.setProperty('--top', (1 - sstep(0, 0.07, p)).toFixed(3));
    stage.style.setProperty('--limb', sstep(0.8, 1, ascQ).toFixed(3));
    if (alt < 1000) { vEl.textContent = NUM(alt, 0); uEl.textContent = 'm'; }
    else { var km = alt / 1000; vEl.textContent = km < 10 ? NUM(km, 1) : NUM(km, 0); uEl.textContent = 'km'; }
    var at = atm(alt), hp = at.p / 100, sh = (1 - at.p / 101325) * 100;
    pEl.textContent = hp >= 100 ? Math.round(hp) + ' hPa' : hp >= 1 ? frn(hp, 1) + ' hPa' : at.p >= 1 ? frn(at.p, 1) + ' Pa' : frn(at.p, 2) + ' Pa';
    tEl.textContent = frn(at.T - 273.15, 0) + ' °C';
    aEl.textContent = frn(sh, sh < 99 ? 1 : sh < 99.99 ? 2 : sh < 99.9999 ? 4 : 5) + ' %';
    l1.style.setProperty('--o', (1 - sstep(0.12, 0.3, ascQ)).toFixed(3));
    l2.style.setProperty('--o', sstep(0.9, 1, ascQ).toFixed(3));
    var H = stage.clientHeight, K = H * 2.6 / LN, cy = H / 2, u = Math.log(alt);
    marks.forEach(function (li) {
      var y = cy - (Math.log(+li.dataset.alt) - u) * K, d = (y - cy) / H;
      li.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
      li.style.opacity = (d < 0 ? 1 - sstep(0.34, 0.46, -d) : 1 - sstep(0.1, 0.26, d)).toFixed(3);
    });
    return r;
  }
  function skyDraw(now) {
    var H = SH, K = H * 2.6 / LN, cy = H / 2, u = Math.log(A0) + LN * ascQ;
    sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0); sctx.clearRect(0, 0, SW, SH);
    var sa = 0.3 + 0.7 * sstep(0.15, 0.8, ascQ);
    if (sa > 0.01) {
      sctx.fillStyle = '#fff';
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], y = ((s.y + ascQ * 0.25 * s.d) % 1) * SH;
        var tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(now / 1000 * s.tw + s.ph);
        sctx.globalAlpha = sa * s.d * tw;
        sctx.beginPath(); sctx.arc(s.x * SW, y, s.s, 0, 6.2832); sctx.fill();
      }
      sctx.globalAlpha = 1;
    }
    // ce que l'on croise en montant : nuages, avion de ligne, ballon-sonde, nuages noctulescents, étoile filante, ligne de Kármán
    var tm = reduce ? 0 : now / 1000, k1 = Math.max(0.62, Math.min(1, SW / 1300));
    function yAt(a) { return cy - (Math.log(a) - u) * K; }
    function seen(y, m) { return y > -m && y < H + m; }
    var yy, xx, i2;
    // nuages bas
    [[1900, 0.3, 1.0, 190], [2500, 0.72, 0.8, 150], [5800, 0.52, 1.15, 230], [7000, 0.12, 0.7, 170]].forEach(function (c, n) {
      yy = yAt(c[0]); if (!seen(yy, 120)) return;
      xx = ((c[1] + tm * 0.004 * (1 + n * 0.3)) % 1.3 - 0.15) * SW;
      for (i2 = 0; i2 < 4; i2++) {
        var bx = xx + (i2 - 1.5) * c[3] * 0.42 * k1, by = yy + (i2 % 2 ? -9 : 5) * c[2], br = c[3] * (0.55 + (i2 % 2) * 0.2) * k1;
        var gr = sctx.createRadialGradient(bx, by, 0, bx, by, br);
        gr.addColorStop(0, 'rgba(225,232,250,' + 0.1 * c[2] + ')'); gr.addColorStop(1, 'rgba(225,232,250,0)');
        sctx.fillStyle = gr; sctx.save(); sctx.translate(bx, by); sctx.scale(1, 0.32); sctx.translate(-bx, -by); sctx.beginPath(); sctx.arc(bx, by, br, 0, 6.2832); sctx.fill(); sctx.restore();
      }
    });
    // avion de ligne et sa traînée
    yy = yAt(10300);
    if (seen(yy, 40)) {
      xx = ((tm * 0.022 + 0.38) % 1.25 - 0.12) * SW;
      var tr = sctx.createLinearGradient(xx - 420 * k1, 0, xx, 0); tr.addColorStop(0, 'rgba(242,242,240,0)'); tr.addColorStop(1, 'rgba(242,242,240,.5)');
      sctx.strokeStyle = tr; sctx.lineWidth = 2; sctx.beginPath(); sctx.moveTo(xx - 420 * k1, yy); sctx.lineTo(xx - 16 * k1, yy); sctx.stroke();
      sctx.save(); sctx.translate(xx, yy); sctx.scale(k1, k1); sctx.fillStyle = '#f2f2f0';
      sctx.beginPath(); sctx.moveTo(20, 0); sctx.lineTo(14, -2.4); sctx.lineTo(-14, -2.4); sctx.lineTo(-20, -9); sctx.lineTo(-23, -9); sctx.lineTo(-19, 0); sctx.lineTo(-14, 2.4); sctx.lineTo(14, 2.4); sctx.closePath(); sctx.fill();
      sctx.beginPath(); sctx.moveTo(4, 0); sctx.lineTo(-9, 11); sctx.lineTo(-13, 11); sctx.lineTo(-6, 0); sctx.closePath(); sctx.fill();
      sctx.restore();
    }
    // ballon-sonde : enveloppe, suspente, nacelle
    yy = yAt(33000);
    if (seen(yy, 120) && ascQ < 0.93) {
      sctx.globalAlpha = 1 - sstep(0.78, 0.93, ascQ);
      xx = SW * (SW < 760 ? 0.87 : 0.44) + Math.sin(tm * 0.35) * 10; var by2 = yy + Math.sin(tm * 0.5) * 4, R = 30 * k1;
      sctx.strokeStyle = 'rgba(242,242,240,.85)'; sctx.lineWidth = 1.2; sctx.fillStyle = 'rgba(242,242,240,.07)';
      sctx.beginPath(); sctx.moveTo(xx, by2 + R * 1.45); sctx.bezierCurveTo(xx - R * 1.5, by2 + R * 0.2, xx - R * 1.1, by2 - R, xx, by2 - R); sctx.bezierCurveTo(xx + R * 1.1, by2 - R, xx + R * 1.5, by2 + R * 0.2, xx, by2 + R * 1.45); sctx.fill(); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(xx, by2 + R * 1.45); sctx.lineTo(xx + Math.sin(tm * 0.5) * 3, by2 + R * 3.6); sctx.stroke();
      sctx.fillStyle = '#e1251b'; sctx.fillRect(xx + Math.sin(tm * 0.5) * 3 - 4, by2 + R * 3.6, 8, 7);
      sctx.globalAlpha = 1;
    }
    // nuages noctulescents : voiles bleutés très fins
    yy = yAt(82000);
    if (seen(yy, 90)) {
      for (i2 = 0; i2 < 11; i2++) {
        sctx.lineWidth = 1 + (i2 % 3) * 0.9;
        var oy = (i2 - 5) * 8 + Math.sin(i2 * 2.3) * 6, ph = i2 * 1.7 + tm * 0.08, xa = SW * (0.18 + 0.07 * Math.sin(i2 * 3.1)), xb = SW * (0.98 - 0.09 * Math.cos(i2 * 1.9));
        var ng = sctx.createLinearGradient(xa, 0, xb, 0); ng.addColorStop(0, 'rgba(140,205,255,0)'); ng.addColorStop(0.3 + 0.04 * i2, 'rgba(150,215,255,' + (0.3 + 0.3 * Math.abs(Math.sin(i2 * 1.3))) + ')'); ng.addColorStop(1, 'rgba(140,205,255,0)');
        sctx.strokeStyle = ng; sctx.beginPath();
        for (var sx = xa; sx <= xb; sx += 14) { var wy = yy + oy + Math.sin(sx * 0.011 + ph) * 7 + Math.sin(sx * 0.031 + ph * 1.7) * 2.5; sx === xa ? sctx.moveTo(sx, wy) : sctx.lineTo(sx, wy); }
        sctx.stroke();
      }
    }
    // étoile filante : les météores se consument vers 90 km
    yy = yAt(92000);
    if (!reduce && seen(yy, 60)) {
      var mc = (tm % 7) / 0.9, mn = Math.floor(tm / 7);
      if (mc < 1) {
        var mx = SW * (0.3 + 0.5 * ((mn * 0.618) % 1)), ml = 150 * k1, hx = mx + ml * mc, hy = yy - 20 + ml * 0.42 * mc, ma = Math.sin(mc * 3.1416);
        var mg = sctx.createLinearGradient(hx - ml * 0.55, hy - ml * 0.23, hx, hy); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(1, 'rgba(255,255,255,' + 0.9 * ma + ')');
        sctx.strokeStyle = mg; sctx.lineWidth = 1.6; sctx.beginPath(); sctx.moveTo(hx - ml * 0.55, hy - ml * 0.23); sctx.lineTo(hx, hy); sctx.stroke();
      }
    }
    // ligne de Kármán
    yy = Math.round(yAt(100000)) + 0.5;
    if (seen(yy, 4)) { sctx.save(); sctx.strokeStyle = 'rgba(225,37,27,.7)'; sctx.lineWidth = 1; sctx.setLineDash([10, 7]); sctx.beginPath(); sctx.moveTo(marksBox.getBoundingClientRect().left - stage.getBoundingClientRect().left + 128, yy); sctx.lineTo(SW, yy); sctx.stroke(); sctx.restore(); }

    // graduations de l'échelle (logarithmique), le long du trait vertical
    var x0 = marksBox.getBoundingClientRect().left - stage.getBoundingClientRect().left;
    sctx.strokeStyle = 'rgba(242,242,240,0.55)'; sctx.lineWidth = 1; sctx.beginPath();
    for (var d = 100; d <= 100000; d *= 10) for (var k = 1; k < 10; k++) {
      var ty = Math.round(cy - (Math.log(k * d) - u) * K) + 0.5;
      if (ty < -2 || ty > H + 2) continue;
      sctx.moveTo(x0, ty); sctx.lineTo(x0 + (k === 1 ? 16 : k === 5 ? 11 : 6), ty);
    }
    sctx.stroke();
  }
  function ascLoop(now) { if (!ascOn) return; skyDraw(now); requestAnimationFrame(ascLoop); }
  skySetup();
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
    var on = es[0].isIntersecting; if (on && !ascOn) { ascOn = true; requestAnimationFrame(ascLoop); } else if (!on) ascOn = false;
  }).observe(asc); else { ascOn = true; requestAnimationFrame(ascLoop); }
  window.addEventListener('resize', function () { skySetup(); onScroll(); });

  /* ---------- navigation : sombre sur le blanc, claire sur le noir ---------- */
  var nav = document.querySelector('.nav'), toggle = document.querySelector('.nav__toggle'), ticking = false;
  function onScroll() {
    ticking = false;
    var r = ascUpdate();
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
    nav.classList.toggle('is-clear', r.top <= 76 && r.bottom > 76);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- menu mobile ---------- */
  function setMenu(open) { nav.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', open); toggle.querySelector('.nav__toggle-txt').textContent = T(open ? 'js.close' : 'js.menu'); document.documentElement.style.overflow = open ? 'hidden' : ''; }
  toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  document.getElementById('menu').addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 760) setMenu(false); });

  /* ---------- planches techniques : le dessin se trace à l'arrivée à l'écran ---------- */
  var plates = [].slice.call(document.querySelectorAll('.plate'));
  if ('IntersectionObserver' in window) {
    var pio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); pio.unobserve(e.target); } }); }, { threshold: 0.35 });
    plates.forEach(function (p) { pio.observe(p); });
  } else plates.forEach(function (p) { p.classList.add('is-in'); });

  /* ---------- planches : survoler une ligne de la légende allume son repère sur le dessin, et inversement ---------- */
  plates.forEach(function (pl) {
    var btns = [].slice.call(pl.querySelectorAll('.legend--link button')), sc = pl.querySelector('.plate__scroll');
    if (!btns.length) return;
    function set(n, on) {
      [].forEach.call(pl.querySelectorAll('.b[data-n="' + n + '"]'), function (g) { g.classList.toggle('hot', on); });
      btns.forEach(function (b) { if (b.dataset.n === String(n)) b.classList.toggle('hot', on); });
    }
    var pinned = null;
    function pin(n) { if (pinned) set(pinned, false); pinned = n === pinned ? null : n; if (pinned) set(pinned, true); }
    btns.forEach(function (b) {
      b.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') set(b.dataset.n, true); });
      b.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && pinned !== b.dataset.n) set(b.dataset.n, false); });
      b.addEventListener('focus', function () { set(b.dataset.n, true); });
      b.addEventListener('blur', function () { if (pinned !== b.dataset.n) set(b.dataset.n, false); });
      b.addEventListener('click', function () {
        pin(b.dataset.n);
        // sur petit écran, la planche défile jusqu'au repère
        var g = pl.querySelector('.b[data-n="' + b.dataset.n + '"] .bal');
        if (g && sc.scrollWidth > sc.clientWidth + 4) { var r = g.getBoundingClientRect(), s = sc.getBoundingClientRect(); sc.scrollTo({ left: sc.scrollLeft + r.left - s.left - s.width / 2, behavior: reduce ? 'auto' : 'smooth' }); }
      });
    });
    [].forEach.call(pl.querySelectorAll('.b'), function (g) {
      g.addEventListener('pointerenter', function () { set(g.dataset.n, true); });
      g.addEventListener('pointerleave', function () { if (pinned !== g.dataset.n) set(g.dataset.n, false); });
    });
  });

  /* ---------- navigation : le lien de la section en cours est marqué ---------- */
  if ('IntersectionObserver' in window) {
    var links = {}; [].forEach.call(document.querySelectorAll('.nav__links a[href^="#"]'), function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var nio = new IntersectionObserver(function (es) { es.forEach(function (e) {
      if (!e.isIntersecting) return;
      Object.keys(links).forEach(function (id) { if (id === e.target.id) links[id].setAttribute('aria-current', 'true'); else links[id].removeAttribute('aria-current'); });
    }); }, { rootMargin: '-45% 0px -54% 0px' });
    Object.keys(links).forEach(function (id) { var el = document.getElementById(id); if (el) nio.observe(el); });
  }

  /* ---------- contact : prépare un e-mail dans la messagerie du visiteur ---------- */
  var MAIL = 'contact.polaris.industries.1@gmail.com';
  var form = document.getElementById('composer'), hint = document.getElementById('composer-hint');
  form.addEventListener('change', function (e) { if (e.target.name === 'sujet') hint.textContent = T('js.hint.' + e.target.value); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, nom = f.nom.value.trim(), msg = f.message.value.trim();
    var body = (msg || '') + (nom ? '\n\n' + nom : '');
    window.location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(T('js.subj.' + f.sujet.value) + ' \u2014 Helvetic Dynamics') + (body ? '&body=' + encodeURIComponent(body) : '');
  });

  /* =====================================================================
     MOUVEMENT : bandeau, révélations, compteurs, boutons aimantés, lettres
     ===================================================================== */
  var fine = window.matchMedia('(pointer: fine)').matches;

  /* ---------- bandeau défilant : vitesse constante de 60 px/s ---------- */
  var TICK = T('js.tick').split('|');
  var trk = document.getElementById('ticker');
  var items = TICK.map(function (t, i) { return '<span' + (i % 3 === 1 ? ' class="r"' : '') + '>' + t + '</span>'; }).join('');
  trk.innerHTML = items + items;
  function tickSpeed() { var w = trk.scrollWidth / 2; if (w > 0) trk.style.setProperty('--tdur', (w / 60).toFixed(1) + 's'); }
  tickSpeed(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(tickSpeed);

  /* ---------- titres de section : découpés mot par mot (le nom accessible reste dans aria-label) ---------- */
  if (!reduce) [].forEach.call(document.querySelectorAll('main h2:not(.ascent__line)'), function (h) {
    var t = h.textContent.trim(), i = 0; h.setAttribute('aria-label', t);
    h.innerHTML = t.split(/ +/).map(function (w) { return '<span class="w" aria-hidden="true"><span class="wi" style="--i:' + (i++) + '">' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></span>'; }).join(' ');
    h.classList.add('words');
  });

  /* ---------- chiffres clés : un rouleau par chiffre ---------- */
  [].forEach.call(document.querySelectorAll('.stat'), function (st) {
    var b = st.querySelector('b'), n = String(st.dataset.n); b.setAttribute('aria-label', n);
    if (reduce) { b.textContent = n; return; }
    var roll = ''; for (var q = 0; q < 20; q++) roll += '<span>' + (q % 10) + '</span>';
    b.className = 'odo';
    b.innerHTML = n.split('').map(function (d, k) { return '<span class="dg" aria-hidden="true"><i style="--n:' + (+d + 10) + ';--k:' + k + '">' + roll + '</i></span>'; }).join('');
  });
  [].forEach.call(document.querySelectorAll('.cascade'), function (c) { [].forEach.call(c.children, function (el, i) { el.style.setProperty('--i', i); }); });

  /* ---------- révélations au défilement ---------- */
  var revs = [].slice.call(document.querySelectorAll('.rv, .rv-l, .rv-r, .cascade, h2.words, .route__profile'));
  function show(el) { el.classList.add('in'); if (el.classList.contains('stats')) [].forEach.call(el.querySelectorAll('.stat'), function (s, i) { setTimeout(function () { s.classList.add('in'); }, i * 120); }); }
  if ('IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { show(e.target); rio.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revs.forEach(function (el) { rio.observe(el); });
    // les animations décoratives s'arrêtent hors écran
    new IntersectionObserver(function (es) { es[0].target.classList.toggle('offscr', !es[0].isIntersecting); }, { rootMargin: '120px 0px' }).observe(document.querySelector('.ticker'));
  } else revs.forEach(show);

  /* ---------- lueur qui suit le curseur ---------- */
  var glow = document.getElementById('cglow');
  if (fine && !reduce) {
    var gx = 0, gy = 0, gtx = 0, gty = 0, graf = 0;
    var gstep = function () { gx += (gtx - gx) * 0.14; gy += (gty - gy) * 0.14; glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)'; graf = Math.abs(gtx - gx) + Math.abs(gty - gy) > 0.5 ? requestAnimationFrame(gstep) : 0; };
    window.addEventListener('pointermove', function (e) { gtx = e.clientX; gty = e.clientY; if (!glow.classList.contains('on')) { gx = gtx; gy = gty; glow.classList.add('on'); } if (!graf) graf = requestAnimationFrame(gstep); }, { passive: true });
    document.addEventListener('pointerleave', function () { glow.classList.remove('on'); });
  }

  /* ---------- boutons aimantés : le bouton est attiré de quelques pixels vers le curseur, son texte un peu plus ---------- */
  if (fine && !reduce) {
    [].forEach.call(document.querySelectorAll('.hero__actions .btn, .nav__cta, .composer .btn, .lab__fit'), function (el) {
      if (!el.querySelector('span')) el.innerHTML = '<span>' + el.innerHTML + '</span>';
      el.classList.add('mag'); var lab = el.querySelector('span'), raf = 0, tx = 0, ty = 0, x = 0, y = 0, tp = 0;
      var step = function (now) {
        var a = 1 - Math.exp(-Math.min(64, now - tp) / 85); tp = now; x += (tx - x) * a; y += (ty - y) * a;
        el.style.translate = x.toFixed(2) + 'px ' + y.toFixed(2) + 'px'; lab.style.translate = (x * 0.4).toFixed(2) + 'px ' + (y * 0.4).toFixed(2) + 'px';
        if (Math.abs(tx - x) + Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(step); else { raf = 0; if (!tx && !ty) { el.style.translate = ''; lab.style.translate = ''; } }
      };
      var kick = function () { if (!raf) { tp = performance.now(); raf = requestAnimationFrame(step); } };
      el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); tx = (e.clientX - (r.left - x + r.width / 2)) * 0.32; ty = (e.clientY - (r.top - y + r.height / 2)) * 0.42; kick(); }, { passive: true });
      el.addEventListener('pointerleave', function () { tx = ty = 0; kick(); });
    });

    /* ---------- au survol, les lettres se brouillent puis se remettent en place (police à chasse fixe : rien ne bouge autour) ---------- */
    var GL = 'ABCDEFGHJKLMNPRSTUVXYZ0123456789';
    var scramble = function (el) {
      if (el.__sc) return;
      var node = null; (function find(n) { for (var i = 0; i < n.childNodes.length && !node; i++) { var k = n.childNodes[i]; if (k.nodeType === 3 && k.nodeValue.trim()) node = k; else if (k.nodeType === 1) find(k); } })(el);
      if (!node) return;
      var src = node.nodeValue, n = src.length, t0 = performance.now(), dur = Math.min(520, 160 + n * 22); el.__sc = 1;
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', src.trim());
      (function f(now) {
        var q = Math.max(0, Math.min(1, (now - t0) / dur)), done = Math.floor(q * n), o = src.slice(0, done);
        for (var i = done; i < n; i++) { var ch = src[i]; o += /[A-Za-zÀ-ÿ0-9]/.test(ch) ? GL[(Math.random() * GL.length) | 0] : ch; }
        node.nodeValue = o; if (q < 1) requestAnimationFrame(f); else { node.nodeValue = src; el.__sc = 0; }
      })(t0);
    };
    document.addEventListener('pointerover', function (e) {
      if (window.innerWidth <= 760) return;
      var el = e.target.closest && e.target.closest('.nav__links a, .btn, .engine__btn:not(.engine__snd), .lab__fit, .footer__top');
      if (el && !el.contains(e.relatedTarget)) scramble(el);
    }, { passive: true });
  }

  /* ---------- curseurs : la partie parcourue de la piste est claire ---------- */
  [].forEach.call(document.querySelectorAll('.rng input'), function (el) {
    var f = function () { el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1) + '%'); };
    el.addEventListener('input', f); f();
  });

  /* ---------- changement de langue : on reste à la même hauteur de page ---------- */
  [].forEach.call(document.querySelectorAll('.lang a'), function (a) {
    a.addEventListener('click', function () { if (location.hash) a.href = a.getAttribute('href').split('#')[0] + location.hash; });
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
