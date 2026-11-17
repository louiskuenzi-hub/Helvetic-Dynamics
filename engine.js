/* HELVETIC DYNAMICS — animation en coupe du moteur éthanol / GOX
   Géométrie reprise du plan (en mm, axe moteur sur y = 0, demi-coupe supérieure,
   la moitié inférieure est le miroir). Les cotes ne sont pas affichées. */
(function () {
  var canvas = document.getElementById('engine-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TXT = function (k) { return window.HD && window.HD.t ? window.HD.t(k) : k; };
  var NUM = function (v, d) { return window.HD && window.HD.num ? window.HD.num(v, d) : v.toFixed(d); };
  var phases = document.querySelectorAll('.engine__phases li');
  var viz = document.getElementById('engine-viz'), clock = document.getElementById('engine-clock'), lit = false;

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
  var T_FLOW = 1.6;            // ouverture des vannes (s), l'allumage suit à tIgn
  var t = 0, tIgn = 3, spawnAcc = { eth: 0, gox: 0, film: 0 };
  var tCut = Infinity;         // arrêt moteur demandé par le visiteur
  var thr = 1, thrCur = 1;     // régime demandé / régime réel (0,6 à 1)
  var pc = 0, thrust = 0, samples = [], sAcc = 0;   // télémesure simulée, en fraction du nominal
  function cutK() { return t < tCut ? 1 : Math.max(0, 1 - (t - tCut) / 0.55); }
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
    thrCur += (thr - thrCur) * (1 - Math.exp(-dt / 0.25));
    var burning = t > tIgn && t < tCut;
    var rates = { eth: 90, gox: 150, film: 34 };
    if (t > T_FLOW && t < tCut) for (var k in rates) {
      spawnAcc[k] += rates[k] * thrCur * dt;
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
    telemetry(dt);
  }

  /* ---------- Télémesure simulée : pression chambre et poussée, en fraction du régime nominal ---------- */
  function telemetry(dt) {
    var since = t - tIgn, target = 0;
    if (t >= tCut) target = 0;
    else if (since >= 0) target = thrCur * (1 - Math.exp(-since / 0.05)) * (1 + 0.17 * Math.exp(-since / 0.13)) * (1 + 0.016 * (noise(t * 9) - 0.5) * 2);
    else if (t > T_FLOW) target = 0.06 * thrCur * Math.min(1, (t - T_FLOW) / 0.4);
    pc += (target - pc) * (1 - Math.exp(-dt / (t >= tCut ? 0.11 : 0.025)));
    var fT = since >= 0 || t >= tCut ? pc * (0.985 + 0.03 * (noise(t * 6 + 4) - 0.5)) : pc * 0.15;
    thrust += (fT - thrust) * (1 - Math.exp(-dt / 0.06));
    sAcc += dt;
    if (sAcc >= 1 / 40) { sAcc = 0; samples.push([t, pc, thrust]); if (samples.length > 900) samples.shift(); }
  }

  function plumeLen() {
    var k = Math.max(0, Math.min(1, (t - tIgn - 0.15) / 0.9));
    k = 1 - Math.pow(1 - k, 3);
    return k * cutK() * (0.45 + 0.55 * thrCur) * (view.x1 - X_EXIT);
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
    var on = Math.min(1, since / 0.35) * cutK() * (0.5 + 0.5 * thrCur);
    if (on <= 0) return;
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
    var pa = cutK() * (0.55 + 0.45 * thrCur);
    g.addColorStop(0, 'rgba(150,175,255,' + 0.55 * pa + ')');
    g.addColorStop(0.35, 'rgba(110,140,255,' + 0.22 * pa + ')');
    g.addColorStop(1, 'rgba(90,110,255,0)');
    ctx.fillStyle = g; ctx.fill();

    // lignes de choc (motif en X entre les diamants)
    ctx.lineWidth = Math.max(1, scale * 0.35);
    for (var k = 0; k < N_DIAMONDS; k++) {
      var xa = X_EXIT + LAMBDA * k, xb = xa + LAMBDA;
      if (xa > xEnd) break;
      var fade = (1 - k / N_DIAMONDS) * Math.min(1, (xEnd - xa) / LAMBDA);
      var ra = plumeR(xa) * 0.9, rb = plumeR(xb) * 0.9;
      ctx.strokeStyle = 'rgba(255,215,190,' + 0.35 * fade * pa + ')';
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
      var a = (1 - k * 0.17) * appear * pa * (0.85 + 0.15 * noise(t * 3 + k));
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
    ctx.fillText(TXT('js.eng.eth'), px(view.x0 + 2), py(4));
    ctx.fillStyle = '#6FB6FF'; ctx.textAlign = 'center';
    ctx.fillText('GOX', px(17.4), py(52.5));
    ctx.fillText('GOX', px(17.4), py(-52.5) + 10);
    label(TXT('js.eng.inj'), 40, 50, 28, 38, 'left');
    label(TXT('js.eng.cham'), 88, 44, 88, 30);
    label(TXT('js.eng.throat'), X_THROAT, -44, X_THROAT, -R_CU);
    label(TXT('js.eng.noz'), X_EXIT + 8, 44, X_EXIT - 4, R_CU);
    if (t > tIgn + 0.8 && t < tCut) label(TXT('js.eng.diam'), X_EXIT + LAMBDA * 1.5, -40, X_EXIT + LAMBDA * 1.5, -8);
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
    drawTm();
  }

  /* ---------- Tracé de la télémesure : fenêtre de 12 s qui défile ---------- */
  var tm = document.getElementById('engine-tm'), tctx = tm.getContext('2d'), TW, TH;
  var vPc = document.getElementById('tm-pc'), vF = document.getElementById('tm-f'), vAcc = 0;
  function tmLayout() {
    TW = tm.clientWidth; TH = tm.clientHeight;
    tm.width = Math.round(TW * dpr); tm.height = Math.round(TH * dpr);
  }
  function drawTm() {
    var SPAN = 12, t1 = Math.max(SPAN, t), t0 = t1 - SPAN, L = 44, R = 10, T = 12, B = 22, w = TW - L - R, h = TH - T - B, i;
    function X(a) { return L + (a - t0) / SPAN * w; }
    function Y(v) { return T + h - v / 1.25 * h; }
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, TW, TH);
    tctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace'; tctx.lineWidth = 1; tctx.textBaseline = 'middle';
    // grille : 0, 50 et 100 % du nominal
    [0, 0.5, 1].forEach(function (v) {
      tctx.strokeStyle = v === 1 ? 'rgba(242,242,240,.28)' : 'rgba(242,242,240,.12)'; tctx.setLineDash(v === 1 ? [4, 4] : []);
      tctx.beginPath(); tctx.moveTo(L, Math.round(Y(v)) + 0.5); tctx.lineTo(TW - R, Math.round(Y(v)) + 0.5); tctx.stroke();
      tctx.fillStyle = '#9a9b9f'; tctx.textAlign = 'right'; tctx.fillText(Math.round(v * 100) + ' %', L - 8, Y(v));
    });
    tctx.setLineDash([]);
    // axe du temps, en secondes par rapport à l'allumage
    tctx.textAlign = 'center'; tctx.textBaseline = 'alphabetic';
    for (var s = Math.ceil(t0 - tIgn); s <= t1 - tIgn; s++) {
      var x = Math.round(X(s + tIgn)) + 0.5; if (x < L + 2) continue;
      tctx.strokeStyle = 'rgba(242,242,240,.25)'; tctx.beginPath(); tctx.moveTo(x, T + h); tctx.lineTo(x, T + h + (s % 3 === 0 ? 6 : 3)); tctx.stroke();
      if (s % 3 === 0 && x < TW - R - 12) { tctx.fillStyle = '#9a9b9f'; tctx.fillText((s > 0 ? '+' : s < 0 ? '\u2212' : '') + Math.abs(s) + ' s', x, TH - 3); }
    }
    // événements de la séquence
    [[T_FLOW, 'js.eng.valves'], [tIgn, 'js.eng.ign'], [tCut, 'js.eng.stop']].forEach(function (ev) {
      if (!(ev[0] <= t) || ev[0] < t0) return;
      var x = Math.round(X(ev[0])) + 0.5;
      tctx.strokeStyle = ev[1] === 'js.eng.valves' ? 'rgba(242,242,240,.4)' : '#e1251b'; tctx.setLineDash([2, 3]);
      tctx.beginPath(); tctx.moveTo(x, T); tctx.lineTo(x, T + h); tctx.stroke(); tctx.setLineDash([]);
      if (TW > 520) { tctx.fillStyle = '#f2f2f0'; tctx.textAlign = 'left'; tctx.fillText(TXT(ev[1]), x + 6, T + 9); }
    });
    // courbes
    function trace(idx, col, lw) {
      tctx.strokeStyle = col; tctx.lineWidth = lw; tctx.lineJoin = 'round'; tctx.beginPath(); var st = false;
      for (i = 0; i < samples.length; i++) { var sm = samples[i]; if (sm[0] < t0) continue; var px2 = X(sm[0]), py2 = Y(sm[idx]); st ? tctx.lineTo(px2, py2) : tctx.moveTo(px2, py2); st = true; }
      tctx.stroke();
      if (samples.length) { tctx.fillStyle = col; tctx.beginPath(); tctx.arc(X(t), Y(idx === 1 ? pc : thrust), 3, 0, 6.2832); tctx.fill(); }
    }
    trace(2, '#FF8A3D', 1.5); trace(1, '#f2f2f0', 1.5);
  }
  function fmtPct(v) { return Math.round(Math.max(0, v) * 100) + ' %'; }

  function setPhase() {
    var ph = t < T_FLOW ? -1 : t < tIgn ? 0 : t >= tCut ? 3 : t < tIgn + 1.2 ? 1 : 2;
    for (var i = 0; i < phases.length; i++) phases[i].classList.toggle('is-on', i === ph);
    // horloge de séquence et lueur de la flamme autour du dessin
    var T = Math.min(t, tCut) - tIgn;
    vPc.textContent = fmtPct(pc); vF.textContent = fmtPct(thrust);
    cutBtn.disabled = reduce || !(t > tIgn && t < tCut);
    audio();
    clock.textContent = 'T ' + (T < 0 ? '\u2212' : '+') + ' ' + NUM(Math.abs(T), 1) + ' s';
    var burn = T < 0 ? 0 : (Math.min(1, T / 0.35) * (0.8 + 0.2 * noise(t * 2)) + (T < 0.5 ? Math.exp(-T * 7) : 0)) * cutK() * (0.45 + 0.55 * thrCur);
    viz.style.setProperty('--burn', Math.min(1, burn).toFixed(3));
    viz.classList.toggle('is-cut', t >= tCut);
    if (T >= 0 && !lit) { lit = true; viz.classList.add('is-lit', 'is-ignite'); }
    else if (T < 0 && lit) { lit = false; viz.classList.remove('is-lit', 'is-ignite'); }
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
    if (t > tCut + 3.5) { running = false; idle = true; audio(); return; }   // moteur éteint et purgé : on arrête de dessiner
    requestAnimationFrame(loop);
  }
  var idle = false;
  function start() { if (running || reduce || idle) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; audio(); }

  /* ---------- Son (coupé par défaut) : grondement synthétisé, piloté par la pression chambre ---------- */
  var cutBtn = document.getElementById('engine-cut'), sndBtn = document.getElementById('engine-snd'), thrIn = document.getElementById('engine-thr'), thrOut = document.getElementById('engine-thr-o');
  var ac = null, gRumble, gHiss, lp, sndOn = false;
  function audioInit() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC();
    var n = ac.sampleRate * 3, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0), b = 0, i;
    for (i = 0; i < n; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }       // bruit brun
    for (i = 0; i < 2000; i++) { var k = i / 2000; d[n - 2000 + i] = d[n - 2000 + i] * (1 - k) + d[i] * k; }  // raccord de boucle
    var src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120;
    gRumble = ac.createGain(); gRumble.gain.value = 0;
    src.connect(lp); lp.connect(gRumble); gRumble.connect(ac.destination);
    var wb = ac.createBuffer(1, n, ac.sampleRate), wd = wb.getChannelData(0); for (i = 0; i < n; i++) wd[i] = Math.random() * 2 - 1;
    var ws = ac.createBufferSource(); ws.buffer = wb; ws.loop = true;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
    gHiss = ac.createGain(); gHiss.gain.value = 0;
    ws.connect(bp); bp.connect(gHiss); gHiss.connect(ac.destination);
    src.start(); ws.start(); return true;
  }
  function audio() {
    if (!ac) return;
    var live = sndOn && running, now = ac.currentTime;
    var flow = live && t > T_FLOW && t < tCut ? 1 : 0;
    gRumble.gain.setTargetAtTime(live ? Math.min(1.2, pc) * 0.5 : 0, now, 0.04);
    lp.frequency.setTargetAtTime(90 + 520 * Math.min(1.2, pc), now, 0.05);
    gHiss.gain.setTargetAtTime(live ? 0.012 * flow + 0.03 * Math.min(1, pc) : 0, now, 0.05);
  }
  sndBtn.addEventListener('click', function () {
    if (!ac && !audioInit()) { sndBtn.disabled = true; return; }
    sndOn = !sndOn; if (sndOn && ac.state === 'suspended') ac.resume();
    sndBtn.setAttribute('aria-pressed', sndOn); sndBtn.lastElementChild.textContent = TXT(sndOn ? 'js.snd.on' : 'js.snd.off');
    audio();
  });
  cutBtn.addEventListener('click', function () { if (t > tIgn && t < tCut) tCut = t; });
  function setThr() { thr = +thrIn.value / 100; thrOut.textContent = thrIn.value + ' %'; if (reduce) staticFrame(); }
  thrIn.addEventListener('input', setThr);

  function restart() {
    parts = []; t = 0; spawnAcc = { eth: 0, gox: 0, film: 0 }; tCut = Infinity; pc = 0; thrust = 0; samples = []; thrCur = thr;
    if (reduce) { staticFrame(); return; }
    render(); setPhase();
    if (idle) { idle = false; start(); }
  }
  function staticFrame() {
    // mouvement réduit : on simule le régime établi puis on affiche une image fixe
    parts = []; t = 0; tCut = Infinity; pc = 0; thrust = 0; samples = []; thrCur = thr;
    for (var i = 0; i < 420; i++) step(1 / 60);
    render(); setPhase();
  }

  layout(); tmLayout(); thr = thrCur = +thrIn.value / 100;
  if (reduce) staticFrame(); else { render(); setPhase(); }

  if ('IntersectionObserver' in window) {
    // la séquence démarre quand le moteur est bien à l'écran, et se met en pause dès qu'il en sort
    new IntersectionObserver(function (entries) {
      var r = entries[0].intersectionRatio;
      if (r >= 0.3) start(); else if (!entries[0].isIntersecting) stop();
    }, { threshold: [0, 0.3] }).observe(viz);
  } else start();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { layout(); tmLayout(); if (!running) render(); }, 120);
  });
  document.getElementById('engine-replay').addEventListener('click', restart);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) render(); });
})();
