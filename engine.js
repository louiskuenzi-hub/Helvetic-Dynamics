/* HELVETIC DYNAMICS — animation en coupe du moteur éthanol / GOX
   Géométrie reprise du plan (en mm, axe moteur sur y = 0, demi-coupe supérieure,
   la moitié inférieure est le miroir). Les cotes ne sont pas affichées. */
(function () {
  var canvas = document.getElementById('engine-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phases = document.querySelectorAll('.engine__phases li');

  /* ---------- Géométrie (mm) ---------- */
  var X_FACE = 30, X_CONV = 145, X_THROAT = 168, X_EXIT = 178;
  var R_CH = 21, R_THROAT = 7.5, R_EXIT = 10, R_CU = 30;

  // Tête inox : bloc arrière + tube central (post éthanol) / bloc avant
  var HEAD_BACK = [[0, 40], [14.4, 40], [14.4, 12.5], [10, 12.5], [10, 1.75], [30, 1.75], [30, 0.85], [0, 0.85]];
  var HEAD_FRONT = [[20.4, 40], [30, 40], [30, 3.15], [25, 3.15], [25, 12.5], [20.4, 12.5]];
  var COPPER = [[30, R_CU], [X_EXIT, R_CU], [X_EXIT, R_EXIT], [X_THROAT, R_THROAT], [X_CONV, R_CH], [30, R_CH]];

  function wallR(x) {
    if (x < X_CONV) return R_CH;
    if (x < X_THROAT) return R_CH - (x - X_CONV) * (R_CH - R_THROAT) / (X_THROAT - X_CONV);
    if (x < X_EXIT) return R_THROAT + (x - X_THROAT) * (R_EXIT - R_THROAT) / (X_EXIT - X_THROAT);
    return plumeR(x);
  }

  /* ---------- Panache et diamants de choc ---------- */
  var LAMBDA = 21;            // espacement entre diamants
  var N_DIAMONDS = 5;
  function plumeR(x) {
    var d = x - X_EXIT;
    var s = Math.sin(Math.PI * d / LAMBDA);
    return R_EXIT + 2.6 * s * s * Math.exp(-d / 90) + 0.07 * d;
  }

  /* ---------- Vue ---------- */
  var view, scale, W, H, dpr, showLabels;
  function layout() {
    W = canvas.clientWidth || canvas.parentNode.clientWidth;
    var narrow = W < 640;
    showLabels = !narrow;
    view = narrow
      ? { x0: -14, x1: 290, y: 44 }
      : { x0: -30, x1: 330, y: 58 };
    scale = W / (view.x1 - view.x0);
    H = Math.round(view.y * 2 * scale);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.height = H + 'px';
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  function px(x) { return (x - view.x0) * scale; }
  function py(y) { return H / 2 - y * scale; }

  /* ---------- Particules ---------- */
  var COL = { eth: [232, 184, 106], gox: [111, 182, 255], film: [246, 227, 184] };
  var parts = [];
  var t = 0, tIgn = 1.4, spawnAcc = { eth: 0, gox: 0, film: 0 };
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  function spawn(kind) {
    var p = { kind: kind, path: null, seg: 0, x: 0, y: 0, free: false, eta: 0, deta: 0, burn: 0, life: 0, ignAt: 3 + rnd() * 10, v: 0.75 + rnd() * 0.5 };
    var s = rnd() < 0.5 ? 1 : -1;
    if (kind === 'eth') {
      var j = (rnd() - 0.5) * 1.1;
      p.path = [[view.x0 - 2, j], [X_FACE, j]];
      p.speed = 70; p.deta = (rnd() - 0.5) * 1.6;
    } else if (kind === 'gox') {
      var jx = 15.2 + rnd() * 4.4, jr = 2.1 + rnd() * 0.9;
      p.path = [[jx, s * 52], [jx, s * (11 - rnd() * 4)], [24.5, s * jr], [X_FACE, s * jr]];
      p.speed = 85; p.deta = s * (0.15 + rnd() * 0.5);
    } else {
      var fr = 19.6 + rnd() * 0.6;
      p.path = [[24.2, s * fr], [X_FACE, s * fr]];
      p.speed = 30; p.eta = s * (0.94 + rnd() * 0.03); p.deta = 0;
    }
    p.x = p.path[0][0]; p.y = p.path[0][1];
    parts.push(p);
  }

  function flowSpeed(x) {
    var r = wallR(Math.min(x, X_EXIT));
    var u = 55 * Math.pow(R_CH / r, 2);
    if (x > X_EXIT) u = 520;
    return Math.min(u, 520);
  }

  function step(dt) {
    t += dt;
    var burning = t > tIgn;
    var rates = { eth: 90, gox: 150, film: 34 };
    for (var k in rates) {
      spawnAcc[k] += rates[k] * dt;
      while (spawnAcc[k] >= 1) { spawn(k); spawnAcc[k] -= 1; }
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life += dt;
      if (!p.free) {
        var tgt = p.path[p.seg + 1];
        var dx = tgt[0] - p.x, dy = tgt[1] - p.y, d = Math.hypot(dx, dy), mv = p.speed * dt;
        if (d <= mv) {
          p.x = tgt[0]; p.y = tgt[1]; p.seg++;
          if (p.seg >= p.path.length - 1) {
            p.free = true;
            if (p.kind !== 'film') p.eta = p.y / R_CH;
            p.fx = 0;
          }
        } else { p.x += dx / d * mv; p.y += dy / d * mv; }
      } else {
        // dans la chambre : la particule suit le contour par sa position radiale relative (eta)
        p.fx += dt;
        if (p.kind !== 'film') {
          p.eta += p.deta * dt;
          p.deta *= Math.pow(0.25, dt);
          p.eta += (rnd() - 0.5) * 0.9 * dt;   // turbulence / mélange
          if (Math.abs(p.eta) > 0.9) { p.eta = Math.sign(p.eta) * 0.9; p.deta *= -0.4; }
        }
        p.x += flowSpeed(p.x) * p.v * dt;
        if (p.x > X_EXIT && p.kind === 'film') p.eta *= Math.pow(0.4, dt);
        p.y = p.eta * wallR(p.x);
        if (burning && !p.burn && p.x > 34 + p.ignAt) p.burn = 0.001;
        if (p.burn) p.burn = Math.min(1, p.burn + dt * 2.5);
      }
      if (p.x > view.x1 + 4 || (p.x > X_EXIT && p.burn && p.x - X_EXIT > plumeLen() + 10)) parts.splice(i, 1);
    }
  }

  function plumeLen() {
    var k = Math.max(0, Math.min(1, (t - tIgn - 0.15) / 0.9));
    k = 1 - Math.pow(1 - k, 3);
    return k * (view.x1 - X_EXIT);
  }

  /* ---------- Dessin ---------- */
  function poly(pts, sgn) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var X = px(pts[i][0]), Y = py(pts[i][1] * sgn);
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath();
  }
  function innerContour() {
    ctx.beginPath();
    ctx.moveTo(px(X_FACE), py(R_CH));
    var x;
    for (x = X_FACE; x <= X_EXIT; x += 1) ctx.lineTo(px(x), py(wallR(x)));
    for (x = X_EXIT; x >= X_FACE; x -= 1) ctx.lineTo(px(x), py(-wallR(x)));
    ctx.closePath();
  }

  function noise(a) { return 0.5 + 0.25 * Math.sin(a * 13.1) + 0.15 * Math.sin(a * 29.7 + 1.3) + 0.1 * Math.sin(a * 53.3 + 2.1); }

  function drawFlame() {
    var since = t - tIgn;
    if (since < 0) return;
    var on = Math.min(1, since / 0.35);
    var flash = since < 0.5 ? Math.exp(-since * 7) : 0;
    var fl = 0.85 + 0.15 * noise(t * 2);

    ctx.save();
    innerContour(); ctx.clip();
    var g = ctx.createLinearGradient(px(X_FACE), 0, px(X_EXIT), 0);
    g.addColorStop(0, 'rgba(255,120,40,0)');
    g.addColorStop(0.08, 'rgba(255,120,45,' + 0.22 * on * fl + ')');
    g.addColorStop(0.55, 'rgba(255,150,70,' + 0.42 * on * fl + ')');
    g.addColorStop(0.86, 'rgba(255,205,140,' + 0.7 * on * fl + ')');
    g.addColorStop(1, 'rgba(255,240,215,' + 0.85 * on + ')');
    ctx.fillStyle = g;
    ctx.fillRect(px(X_FACE), py(R_CH), px(X_EXIT) - px(X_FACE), 2 * R_CH * scale);
    // coeur plus chaud au centre
    var core = ctx.createLinearGradient(0, py(R_CH), 0, py(-R_CH));
    core.addColorStop(0, 'rgba(255,90,30,0)');
    core.addColorStop(0.5, 'rgba(255,190,120,' + 0.25 * on * fl + ')');
    core.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = core;
    ctx.fillRect(px(X_FACE + 10), py(R_CH), px(X_EXIT) - px(X_FACE + 10), 2 * R_CH * scale);
    if (flash > 0.01) {
      ctx.fillStyle = 'rgba(255,235,200,' + 0.8 * flash + ')';
      ctx.fillRect(px(X_FACE), py(R_CH), px(X_EXIT) - px(X_FACE), 2 * R_CH * scale);
    }
    ctx.restore();
  }

  function drawPlume() {
    var L = plumeLen();
    if (L <= 0) return;
    var xEnd = X_EXIT + L, x;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // enveloppe bleutée
    ctx.beginPath();
    ctx.moveTo(px(X_EXIT), py(R_EXIT));
    for (x = X_EXIT; x <= xEnd; x += 1) ctx.lineTo(px(x), py(plumeR(x) * (1 + 0.03 * Math.sin(t * 40 + x))));
    for (x = xEnd; x >= X_EXIT; x -= 1) ctx.lineTo(px(x), py(-plumeR(x) * (1 + 0.03 * Math.sin(t * 37 + x))));
    ctx.closePath();
    var g = ctx.createLinearGradient(px(X_EXIT), 0, px(view.x1), 0);
    g.addColorStop(0, 'rgba(150,175,255,0.55)');
    g.addColorStop(0.35, 'rgba(110,140,255,0.22)');
    g.addColorStop(1, 'rgba(90,110,255,0)');
    ctx.fillStyle = g; ctx.fill();

    // lignes de choc (motif en X entre les diamants)
    ctx.lineWidth = Math.max(1, scale * 0.35);
    for (var k = 0; k < N_DIAMONDS; k++) {
      var xa = X_EXIT + LAMBDA * k, xb = xa + LAMBDA;
      if (xa > xEnd) break;
      var fade = (1 - k / N_DIAMONDS) * Math.min(1, (xEnd - xa) / LAMBDA);
      var ra = plumeR(xa) * 0.9, rb = plumeR(xb) * 0.9;
      ctx.strokeStyle = 'rgba(255,215,190,' + 0.35 * fade + ')';
      ctx.beginPath();
      ctx.moveTo(px(xa), py(ra)); ctx.lineTo(px(xb), py(-rb));
      ctx.moveTo(px(xa), py(-ra)); ctx.lineTo(px(xb), py(rb));
      ctx.stroke();
    }
    // diamants de choc
    for (k = 0; k < N_DIAMONDS; k++) {
      var xc = X_EXIT + LAMBDA * (k + 0.5);
      if (xc > xEnd) break;
      var appear = Math.min(1, (xEnd - xc) / (LAMBDA * 0.6));
      var a = (1 - k * 0.17) * appear * (0.85 + 0.15 * noise(t * 3 + k));
      var hl = LAMBDA * 0.36, hh = plumeR(xc) * (0.62 - k * 0.05);
      var cx = px(xc), cy = py(0);
      var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, hl * scale);
      rg.addColorStop(0, 'rgba(255,250,240,' + a + ')');
      rg.addColorStop(0.45, 'rgba(255,190,170,' + 0.75 * a + ')');
      rg.addColorStop(1, 'rgba(255,120,150,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(cx - hl * scale, cy);
      ctx.quadraticCurveTo(cx, cy - hh * scale * 1.1, cx + hl * scale, cy);
      ctx.quadraticCurveTo(cx, cy + hh * scale * 1.1, cx - hl * scale, cy);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHardware() {
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    [1, -1].forEach(function (s) {
      ctx.fillStyle = '#26272b'; ctx.strokeStyle = '#a3a5ab';
      poly(HEAD_BACK, s); ctx.fill(); ctx.stroke();
      poly(HEAD_FRONT, s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6E3B22'; ctx.strokeStyle = '#D08A5E';
      poly(COPPER, s); ctx.fill(); ctx.stroke();
      // collecteur du film de refroidissement (comme les pointillés du plan)
      ctx.save();
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(246,227,184,0.55)';
      ctx.strokeRect(px(22.4), py(s > 0 ? 21.6 : -18.2), 3.8 * scale, 3.4 * scale);
      ctx.restore();
    });
    // percement du film dans la face d'injection
    ctx.fillStyle = '#000000';
    ctx.fillRect(px(24.2), py(20.2), px(X_FACE) - px(24.2), 0.6 * scale);
    ctx.fillRect(px(24.2), py(-19.6), px(X_FACE) - px(24.2), 0.6 * scale);
    // axe
    ctx.save();
    ctx.setLineDash([10, 4, 2, 4]); ctx.strokeStyle = 'rgba(160,162,168,0.35)';
    ctx.beginPath(); ctx.moveTo(px(view.x0), py(0)); ctx.lineTo(px(X_EXIT + 6), py(0)); ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var base = Math.max(0.9, scale * 0.42);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], c = COL[p.kind], r = base, a = 0.9;
      if (p.burn) {
        var b = p.burn;
        c = [Math.round(c[0] + (255 - c[0]) * b), Math.round(c[1] + (150 - c[1]) * b), Math.round(c[2] + (60 - c[2]) * b)];
        a = 0.9 - 0.45 * b;
        if (p.x > X_THROAT) { c = [255, 230, 200]; a = 0.55; }
        if (p.x > X_EXIT) a *= 0.45 * Math.max(0, 1 - (p.x - X_EXIT) / 120);
      }
      var X = px(p.x), Y = py(p.y);
      if (p.free && p.x > X_CONV) {
        // traînée qui s'allonge avec la vitesse
        var len = Math.min(18, flowSpeed(p.x) * 0.02 * scale);
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
        ctx.lineWidth = r;
        ctx.beginPath(); ctx.moveTo(X - len, Y); ctx.lineTo(X, Y); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
        ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function label(text, x, y, ax, ay, align) {
    ctx.strokeStyle = 'rgba(160,162,168,0.6)'; ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(px(ax), py(ay)); ctx.lineTo(px(x), py(y) + (y > 0 ? 6 : -14)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f2f2f0';
    ctx.textAlign = align || 'center';
    ctx.fillText(text, px(x), py(y) + (y > 0 ? 0 : 0));
  }
  function drawLabels() {
    ctx.save();
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'alphabetic';
    // flèches d'arrivée
    ctx.fillStyle = '#E8B86A'; ctx.textAlign = 'left';
    ctx.fillText('ÉTHANOL', px(view.x0 + 2), py(4));
    ctx.fillStyle = '#6FB6FF'; ctx.textAlign = 'center';
    ctx.fillText('GOX', px(17.4), py(52.5));
    ctx.fillText('GOX', px(17.4), py(-52.5) + 10);
    label('INJECTEUR COAXIAL', 40, 50, 28, 38, 'left');
    label('CHAMBRE DE COMBUSTION', 88, 44, 88, 30);
    label('COL', X_THROAT, -44, X_THROAT, -R_CU);
    label('TUYÈRE', X_EXIT + 8, 44, X_EXIT - 4, R_CU);
    if (t > tIgn + 0.8) label('DIAMANTS DE CHOC', X_EXIT + LAMBDA * 1.5, -40, X_EXIT + LAMBDA * 1.5, -8);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawFlame();
    drawPlume();
    drawHardware();
    drawParticles();
    if (showLabels) drawLabels();
  }

  function setPhase() {
    var ph = t < tIgn ? 0 : t < tIgn + 1.2 ? 1 : 2;
    for (var i = 0; i < phases.length; i++) phases[i].classList.toggle('is-on', i === ph);
  }

  /* ---------- Boucle ---------- */
  var running = false, last = 0, visible = false;
  function loop(ts) {
    if (!running) return;
    var dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    step(dt);
    render();
    setPhase();
    requestAnimationFrame(loop);
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; }

  function restart() {
    parts = []; t = 0; spawnAcc = { eth: 0, gox: 0, film: 0 };
    if (reduce) { staticFrame(); return; }
    render(); setPhase();
  }
  function staticFrame() {
    // mouvement réduit : on simule le régime établi puis on affiche une image fixe
    parts = []; t = 0;
    for (var i = 0; i < 240; i++) step(1 / 60);
    render(); setPhase();
  }

  layout();
  if (reduce) staticFrame(); else { render(); setPhase(); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0.15 }).observe(canvas);
  } else start();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { layout(); if (!running) render(); }, 120);
  });
  document.getElementById('engine-replay').addEventListener('click', restart);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) render(); });
})();
