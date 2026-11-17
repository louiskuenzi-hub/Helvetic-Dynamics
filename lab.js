/* HELVETIC DYNAMICS — laboratoire : une tuyère face à l'altitude
   Écoulement isentropique d'un gaz parfait (gamma = 1,2) et atmosphère standard.
   Outil pédagogique : les valeurs ne sont pas celles de notre moteur. */
(function () {
  var canvas = document.getElementById('lab-canvas');
  if (!canvas || !window.HD) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TXT = function (k) { return window.HD && window.HD.t ? window.HD.t(k) : k; };
  var G = 1.2, SEP = 0.37, E_MAX = 30;

  /* ---------- physique ---------- */
  function arat(M) { return (1 / M) * Math.pow((2 / (G + 1)) * (1 + (G - 1) / 2 * M * M), (G + 1) / (2 * (G - 1))); }
  function machFromA(e) { var lo = 1, hi = 40; for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (arat(m) < e) lo = m; else hi = m; } return (lo + hi) / 2; }
  function prat(M) { return Math.pow(1 + (G - 1) / 2 * M * M, -G / (G - 1)); }
  function machFromP(pr) { return Math.sqrt(2 / (G - 1) * (Math.pow(pr, -(G - 1) / G) - 1)); }
  function cfOf(e, pe, pa) { return Math.sqrt(2 * G * G / (G - 1) * Math.pow(2 / (G + 1), (G + 1) / (G - 1)) * (1 - Math.pow(pe, (G - 1) / G))) + (pe - pa) * e; }
  function solve(altKm, pcBar, e) {
    var pa = window.HD.atm(altKm * 1000).p, pc = pcBar * 1e5, a = pa / pc;
    var Me = machFromA(e), pe = prat(Me);                 // pe et pa rapportées à pc
    var Mj = machFromP(a), eAd = arat(Mj);                // tuyère adaptée à cette altitude
    var r = pe / a, sep = r < SEP, eEff = e, peEff = pe, Mx = Me;
    if (sep) { peEff = SEP * a; Mx = machFromP(peEff); eEff = Math.min(e, arat(Mx)); }
    var cf = cfOf(eEff, peEff, a), cfAd = cfOf(eAd, a, a);
    return { pa: pa, pc: pc, Me: Me, pe: pe * pc, r: r, sep: sep, eEff: eEff, Mj: Mj, eAd: eAd, cf: cf, eff: cf / cfAd,
      regime: sep ? 'sep' : r < 0.9 ? 'over' : r <= 1.1 ? 'fit' : 'under' };
  }
  window.HD.nozzle = solve;

  /* ---------- commandes ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var iAlt = $('lab-alt'), iPc = $('lab-pc'), iE = $('lab-e'), fit = $('lab-fit'), state = $('lab-state');
  function fr(n, d) { return window.HD && window.HD.num ? window.HD.num(n, d) : n.toFixed(d); }
  function altKm() { var v = +iAlt.value / 100; return 100 * v * v; }
  function eVal() { return 1.5 * Math.pow(E_MAX / 1.5, +iE.value / 100); }
  function eToSlider(e) { return 100 * Math.log(e / 1.5) / Math.log(E_MAX / 1.5); }
  function fmtAlt(k) { return k < 1 ? Math.round(k * 1000 / 10) * 10 + ' m' : fr(k, k < 10 ? 1 : 0) + ' km'; }
  function fmtP(pa) { // en pascals
    if (pa >= 1e5) return fr(pa / 1e5, 2) + ' bar';
    if (pa >= 1e4) return Math.round(pa / 100) + ' hPa';
    if (pa >= 100) return fr(pa / 100, 1) + ' hPa';
    if (pa >= 1) return fr(pa, 1) + ' Pa';
    return fr(pa, 2) + ' Pa';
  }
  var REG = { sep: 'js.lab.sep', over: 'js.lab.over', fit: 'js.lab.fit', under: 'js.lab.under' };
  var cur = null, S = null, lastRegime = '';
  function read() {
    var k = altKm(), pc = +iPc.value, e = eVal();
    S = solve(k, pc, e);
    var tgt = { e: e, eEff: S.eEff, rj: Math.sqrt(S.eAd), amp: Math.max(-1, Math.min(1, Math.log(S.r) / 1.6)), Mj: S.Mj, sep: S.sep ? 1 : 0, heat: (pc - 5) / 35 };
    if (!cur || reduce) cur = tgt; cur.t = tgt;
    $('lab-alt-o').textContent = fmtAlt(k); $('lab-pc-o').textContent = pc + ' bar'; $('lab-e-o').textContent = fr(e, e < 10 ? 1 : 0);
    $('lab-me').textContent = fr(S.Me, 2);
    $('lab-pe').textContent = fmtP(S.pe);
    $('lab-pa').textContent = fmtP(S.pa);
    $('lab-cf').textContent = fr(S.cf, 2);
    $('lab-eff').textContent = fr(Math.min(100, S.eff * 100), 1) + ' %';
    $('lab-ead').textContent = S.eAd > 1000 ? TXT('js.lab.over1k') : fr(S.eAd, S.eAd < 10 ? 1 : 0);
    fit.disabled = Math.abs(Math.min(E_MAX, Math.max(1.5, S.eAd)) - e) < 0.06;
    fit.textContent = TXT(S.eAd > E_MAX ? 'js.lab.maxbtn' : 'js.lab.fitbtn');
    if (S.regime !== lastRegime) { lastRegime = S.regime; state.dataset.r = S.regime; state.innerHTML = '<b>' + TXT(REG[S.regime]) + '</b><span>' + TXT(REG[S.regime] + 'd') + '</span>'; }
    kick();
  }

  /* ---------- dessin ---------- */
  var W, H, dpr;
  function layout() {
    W = canvas.clientWidth; H = Math.round(Math.max(230, Math.min(430, W * 0.54)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.height = H + 'px'; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  function geom(e) {
    var rt = Math.min(H * 0.105, H * 0.4 / Math.sqrt(e)), re = rt * Math.sqrt(e), rc = Math.min(H * 0.3, rt * 2.3);
    var xa = W * 0.025, xb = xa + W * 0.085, xt = xb + (rc - rt) / Math.tan(0.7), Ld = Math.min((re - rt) / Math.tan(0.262) * 0.8 + rt * 0.6, W * 0.34), xe = xt + Ld;
    return { rt: rt, re: re, rc: rc, xa: xa, xb: xb, xt: xt, xe: xe, cx: xt + Ld * 0.3, cr: rt + (re - rt) * 0.72 };
  }
  // paroi du divergent : courbe de Bézier quadratique (profil en cloche)
  function bell(g, u) { var a = 1 - u; return [a * a * g.xt + 2 * a * u * g.cx + u * u * g.xe, a * a * g.rt + 2 * a * u * g.cr + u * u * g.re]; }
  function noise(a) { return 0.5 + 0.25 * Math.sin(a * 13.1) + 0.15 * Math.sin(a * 29.7 + 1.3) + 0.1 * Math.sin(a * 53.3 + 2.1); }

  function draw(now) {
    var c = cur, g = geom(c.e), cy = H / 2, tt = reduce ? 0 : now / 1000, fl = 0.9 + 0.1 * noise(tt * 2), i, u, p;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);

    // point où le jet quitte la paroi (sortie, ou plus tôt s'il est décollé)
    var us = 1, rs = g.re, xs = g.xe;
    if (c.sep > 0.02) {
      var rsep = g.rt * Math.sqrt(Math.min(c.e, c.eEff));
      for (u = 0; u <= 1; u += 0.02) { p = bell(g, u); if (p[1] >= rsep) break; }
      us = 1 - (1 - Math.min(1, u)) * c.sep; p = bell(g, us); xs = p[0]; rs = p[1];
    }
    var rj = g.rt * c.rj, rjv = Math.min(rj, H * 0.46);
    var lam = Math.max(rs * 2.4, Math.min(W * 0.34, 1.43 * Math.max(rs, rjv) * Math.sqrt(Math.max(0.2, c.Mj * c.Mj - 1))));
    var thin = Math.max(0.28, Math.min(1, rs * 1.6 / rj));
    function plume(x) { var d = x - xs; return rjv + (rs - rjv) * Math.cos(6.2832 * d / lam) * Math.exp(-d / (lam * 2.6)) * (0.35 + 0.65 * Math.exp(-d / (lam * 6))) + (rs - rjv) * 0.0 + d * 0.03; }

    /* --- gaz dans la tuyère --- */
    ctx.save();
    ctx.beginPath(); ctx.moveTo(g.xa, cy - g.rc); ctx.lineTo(g.xb, cy - g.rc); ctx.lineTo(g.xt, cy - g.rt);
    for (u = 0.05; u <= us + 0.001; u += 0.05) { p = bell(g, Math.min(u, us)); ctx.lineTo(p[0], cy - p[1]); }
    ctx.lineTo(xs, cy - rs); ctx.lineTo(xs, cy + rs);
    for (u = us; u >= 0; u -= 0.05) { p = bell(g, u); ctx.lineTo(p[0], cy + p[1]); }
    ctx.lineTo(g.xt, cy + g.rt); ctx.lineTo(g.xb, cy + g.rc); ctx.lineTo(g.xa, cy + g.rc); ctx.closePath(); ctx.clip();
    var hot = 0.55 + 0.45 * c.heat, fg = ctx.createLinearGradient(g.xa, 0, xs, 0), kt = (g.xt - g.xa) / (xs - g.xa);
    fg.addColorStop(0, 'rgba(255,120,45,' + 0.3 * hot * fl + ')'); fg.addColorStop(kt * 0.8, 'rgba(255,165,85,' + 0.62 * hot * fl + ')');
    fg.addColorStop(kt, 'rgba(255,235,205,' + 0.9 * hot + ')'); fg.addColorStop(1, 'rgba(160,185,255,' + 0.62 * thin * fl + ')');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    /* --- jet --- */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.moveTo(xs - 1.5, cy - rs);
    for (i = xs; i <= W + 6; i += 3) ctx.lineTo(i, cy - plume(i) * (1 + 0.018 * Math.sin(tt * 30 + i * 0.045)));
    for (i = W + 6; i >= xs; i -= 3) ctx.lineTo(i, cy + plume(i) * (1 + 0.018 * Math.sin(tt * 27 + i * 0.045)));
    ctx.lineTo(xs - 1.5, cy + rs);
    ctx.closePath();
    var pg = ctx.createLinearGradient(xs, 0, W, 0);
    pg.addColorStop(0, 'rgba(160,185,255,' + 0.62 * thin * fl + ')'); pg.addColorStop(0.4, 'rgba(110,140,255,' + 0.26 * thin + ')'); pg.addColorStop(1, 'rgba(90,110,255,0)');
    ctx.fillStyle = pg; ctx.fill();
    // cœur chaud du jet
    var core = [];
    for (u = 0; u <= us + 0.001; u += 0.1) { p = bell(g, Math.min(u, us)); core.push([p[0], p[1] * 0.45]); }
    for (i = xs + 4; i <= W; i += 4) core.push([i, plume(i) * 0.45]);
    ctx.beginPath(); ctx.moveTo(core[0][0], cy - core[0][1]);
    for (i = 1; i < core.length; i++) ctx.lineTo(core[i][0], cy - core[i][1]);
    for (i = core.length - 1; i >= 0; i--) ctx.lineTo(core[i][0], cy + core[i][1]);
    ctx.closePath();
    var cend = xs + (W - xs) * 0.7, cg = ctx.createLinearGradient(g.xt, 0, cend, 0);
    cg.addColorStop(0, 'rgba(255,225,200,0)'); cg.addColorStop(Math.max(0.02, (xs - g.xt) / (cend - g.xt)), 'rgba(255,225,200,' + 0.42 * thin * fl + ')'); cg.addColorStop(1, 'rgba(255,150,120,0)');
    ctx.fillStyle = cg; ctx.fill();
    // disques de Mach : là où le jet se resserre
    var A = Math.abs(c.amp);
    if (A > 0.04) for (var k = 0; k < 6; k++) {
      var xc = xs + lam * (c.amp > 0 ? k + 1 : k + 0.5); if (xc > W + 20) break;
      var al = Math.min(1, A * 1.5) * Math.exp(-k * 0.55) * thin * thin * (0.85 + 0.15 * noise(tt * 3 + k)), hw = lam * 0.2, hh = Math.max(4, plume(xc) * 0.5);
      var rg = ctx.createRadialGradient(xc, cy, 0, xc, cy, hw * 1.3);
      rg.addColorStop(0, 'rgba(255,250,240,' + al + ')'); rg.addColorStop(0.5, 'rgba(255,190,170,' + 0.6 * al + ')'); rg.addColorStop(1, 'rgba(255,120,150,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(xc - hw * 1.3, cy); ctx.quadraticCurveTo(xc, cy - hh, xc + hw * 1.3, cy); ctx.quadraticCurveTo(xc, cy + hh, xc - hw * 1.3, cy); ctx.fill();
    }
    ctx.restore();

    /* --- paroi en cuivre --- */
    var th = Math.max(5, g.rt * 0.55);
    [1, -1].forEach(function (s) {
      ctx.beginPath(); ctx.moveTo(g.xa, cy - s * g.rc); ctx.lineTo(g.xb, cy - s * g.rc); ctx.lineTo(g.xt, cy - s * g.rt);
      for (var v = 0.05; v <= 1.001; v += 0.05) { var q = bell(g, v); ctx.lineTo(q[0], cy - s * q[1]); }
      ctx.lineTo(g.xe, cy - s * (g.re + th));
      for (v = 1; v >= 0; v -= 0.05) { q = bell(g, v); ctx.lineTo(q[0], cy - s * (Math.max(q[1], g.rt + (g.rc - g.rt) * 0.0) + th)); }
      ctx.lineTo(g.xt, cy - s * (g.rt + th)); ctx.lineTo(g.xb, cy - s * (g.rc + th)); ctx.lineTo(g.xa, cy - s * (g.rc + th)); ctx.closePath();
      ctx.fillStyle = '#6E3B22'; ctx.strokeStyle = '#D08A5E'; ctx.lineWidth = 1; ctx.lineJoin = 'miter'; ctx.fill(); ctx.stroke();
    });
    // air ambiant qui remonte dans le divergent quand le jet est décollé
    if (c.sep > 0.05) { ctx.save(); ctx.strokeStyle = 'rgba(160,185,255,' + 0.5 * c.sep + ')'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      [1, -1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(g.xe + 8, cy - s * (g.re - 3)); ctx.quadraticCurveTo((g.xe + xs) / 2, cy - s * (g.re + rs) / 2, xs + 4, cy - s * (rs + 2)); ctx.stroke(); }); ctx.restore(); }

    /* --- axe et repères --- */
    ctx.save(); ctx.setLineDash([10, 4, 2, 4]); ctx.strokeStyle = 'rgba(160,162,168,.3)'; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(g.xe + 10, cy); ctx.stroke(); ctx.restore();
    ctx.font = '500 ' + (W < 520 ? 10 : 11) + 'px "JetBrains Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
    function tag(text, x, r, down, far) {
      var y0 = cy + (down ? r + th + 3 : -r - th - 3), y1 = down ? Math.min(H - 16, cy + far + 16) : Math.max(16, cy - far - 16);
      ctx.strokeStyle = 'rgba(160,162,168,.6)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#f2f2f0'; ctx.fillText(text, x, y1 + (down ? 13 : -5));
    }
    tag(TXT('js.lab.throat'), Math.max(60, g.xt), g.rt, true, Math.max(g.rc, g.re * 0.5) + th + 3);
    tag(TXT('js.lab.exit') + fr(S.Me, 1), g.xe - 2, g.re, false, g.re + th + 3);
  }

  /* ---------- boucle : n'anime que si la figure est à l'écran ---------- */
  var raf = 0, visible = false, last = 0, settle = 0;
  function tick(now) {
    raf = 0; var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    var t = cur.t, a = 1 - Math.exp(-dt / 0.12), moving = false;
    ['e', 'eEff', 'rj', 'amp', 'Mj', 'sep', 'heat'].forEach(function (k) { var d = t[k] - cur[k]; if (Math.abs(d) > 1e-3) { cur[k] += d * a; moving = true; } else cur[k] = t[k]; });
    draw(now);
    if (visible && !reduce) raf = requestAnimationFrame(tick); else if (moving) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  [iAlt, iPc, iE].forEach(function (el) { el.addEventListener('input', read); });
  fit.addEventListener('click', function () { iE.value = eToSlider(Math.max(1.5, Math.min(E_MAX, S.eAd))); iE.dispatchEvent(new Event('input', { bubbles: true })); });
  layout(); read();
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: '80px 0px' }).observe(canvas);
  else { visible = true; kick(); }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); kick(); }, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick);
})();
