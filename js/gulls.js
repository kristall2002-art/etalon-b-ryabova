/* Чайки над видео первого экрана.
   Две-четыре небольшие чайки проплывают по небу плавными дугами на разной высоте и с разной скоростью:
   несколько взмахов, потом планирование, лёгкий крен на поворотах; иногда небо пустеет. Рисуются на canvas 2D (никаких библиотек и запросов),
   лежат под плашкой с текстом и сами обходят её: высота полёта пересчитывается так, чтобы чайка всегда
   оставалась выше плашки, а на телефоне держится в верхней части неба. Идут только пока виден первый экран и
   вкладка активна. На слабых телефонах чаек меньше; при prefers-reduced-motion летит одна, медленно. */
(function () {
  'use strict';
  var home = document.getElementById('home');
  var bg = home && home.querySelector('.hero-bg');
  if (!bg) return;
  var plq = home.querySelector('.hero-plq');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  var mqMob = window.matchMedia && matchMedia('(max-width:768px)');
  var weak = ((navigator.hardwareConcurrency || 4) <= 4 && mqMob && mqMob.matches) || (navigator.deviceMemory || 4) <= 2;

  var cv = document.createElement('canvas');
  cv.className = 'hero-gulls';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:0;pointer-events:none';
  var ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return;
  bg.appendChild(cv);

  var W = 0, H = 0, BAND = 0, mobile = false, plqL = 0, plqR = 0, plqT = 0, dpr = 1;
  var gulls = [], clock = 0, nextSpawn = 3.2, lastTs = 0, raf = 0, lastDraw = 0, maxGulls = 3, sMin = 24, sMax = 40;
  var fps = reduced ? 20 : (weak ? 24 : 30), frameMs = 1000 / fps - 4;
  var TAU = Math.PI * 2;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

  function measure() {
    W = Math.max(2, home.clientWidth); H = Math.max(2, home.clientHeight);
    mobile = W <= 768;
    BAND = Math.round(H * (mobile ? .40 : .46));
    dpr = Math.min(window.devicePixelRatio || 1, weak ? 1.5 : 2);
    var cw = Math.round(W * dpr), ch = Math.round(BAND * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    cv.style.height = BAND + 'px';
    if (mobile) { sMin = 16; sMax = 26; maxGulls = weak ? 2 : 3; }
    else { sMin = 24; sMax = 40; maxGulls = 4; }
    if (reduced) maxGulls = 1;
    /* плашка с текстом: чайки идут над её верхней кромкой */
    var hr = home.getBoundingClientRect();
    if (plq) {
      var r = plq.getBoundingClientRect();
      plqL = r.left - hr.left; plqR = r.right - hr.left; plqT = r.top - hr.top;
    } else { plqL = plqR = W; plqT = H; }
  }

  /* нижняя граница полёта в точке x: либо низ полосы неба, либо верх плашки с запасом */
  function floorAt(x, S) {
    var lim = BAND - S, over = plqT - 30 - S;
    var k = smooth(plqL - 70, plqL + 30, x) * (1 - smooth(plqR - 30, plqR + 70, x));  /* 1 над плашкой, 0 правее и левее */
    return Math.max(S * 2.2, lim + (Math.min(lim, over) - lim) * k);
  }
  function yAt(g, x) {
    var top = Math.max(H * .05, g.S * .8), fl = floorAt(x, g.S);
    var u = clamp(g.ub + g.ua * Math.sin(TAU * (x - g.x0) / g.lam + g.ph0), .03, .97);
    return top + (Math.max(fl, top + 4) - top) * u;
  }

  function spawn(dir, lag) {
    var S = rnd(sMin, sMax);
    var big = (S - sMin) / (sMax - sMin);                         /* крупнее = ближе = быстрее и ярче */
    var v = S * (mobile ? 1.9 : 3.1) * rnd(.85, 1.2) * (reduced ? .5 : 1);
    var x = dir > 0 ? -S - lag : W + S + lag;
    gulls.push({
      S: S, dir: dir, v: v, x: x, x0: x,
      ub: rnd(.12, .85), ua: rnd(.07, .17), lam: rnd(.9, 1.7) * (mobile ? W * 1.1 : W * .55), ph0: rnd(0, TAU),
      alpha: .72 + .28 * big, phase: rnd(0, TAU), amp: 0, mode: 0, left: rnd(.4, 1.2),
      freq: rnd(2.0, 2.9) * (reduced ? .55 : 1), t: 0, fade: 0
    });
  }

  function schedule() {
    /* группа из 1-3 чаек, потом пауза; иногда подолгу пусто */
    var r = Math.random();
    nextSpawn = clock + (r < .3 ? rnd(11, 18) : rnd(4.5, 9)) * (reduced ? 1.6 : 1);
  }

  function step(dt) {
    clock += dt;
    if (clock >= nextSpawn) {
      var rr = Math.random(), n = reduced ? 1 : (rr < .62 ? 1 : (rr < .9 ? 2 : 3));
      n = Math.min(n, maxGulls - gulls.length);
      var d0 = Math.random() < .5 ? 1 : -1;
      for (var i = 0; i < n; i++) spawn(d0, i * rnd(70, 170));
      schedule();
    }
    for (var k = gulls.length - 1; k >= 0; k--) {
      var g = gulls[k];
      g.t += dt; g.fade = Math.min(1, g.fade + dt * 1.2);
      g.x += g.dir * g.v * dt;
      /* взмахи и планирование */
      g.left -= dt;
      if (g.left <= 0) {
        if (g.mode === 0) { g.mode = 1; g.left = rnd(1.1, 2.4) * (reduced ? 1.3 : 1); }
        else { g.mode = 0; g.left = rnd(1.4, 3.6); }
      }
      g.amp += ((g.mode === 1 ? 1 : 0) - g.amp) * Math.min(1, dt * (g.mode === 1 ? 5 : 1.6));
      g.phase += TAU * g.freq * dt * (.35 + .65 * g.amp);
      if ((g.dir > 0 && g.x > W + g.S * 2) || (g.dir < 0 && g.x < -g.S * 2)) gulls.splice(k, 1);
    }
  }

  /* ---------- форма чайки ----------
     Упрощённая 3D-модель: тело, голова с клювом, хвост, крыло из двух звеньев (плечо и кисть с изгибом в «запястье»),
     вид с трёх четвертей снизу. Кончики крыльев чёрные, верх крыла светло-серый, снизу мягкая тень.
     Координаты птицы: x вперёд, y вверх, z к зрителю; единица длины — размах крыльев. */
  var AZ = -.62, EL = .2, CA = Math.cos(AZ), SA = Math.sin(AZ), CE = Math.cos(EL), SE = Math.sin(EL);
  var PX = 0, PY = 0;
  function pr(x, y, z) { PX = x * CA + z * SA; PY = -y * CE - (z * CA - x * SA) * SE; }
  function arm(len, sweep, phi) {            /* звено: назад на sweep, вверх на угол phi */
    var n = Math.sqrt(sweep * sweep + 1);
    return [-sweep / n * len, Math.sin(phi) / n * len, Math.cos(phi) / n * len];
  }
  var LX = [], LY = [], TX = [], TY = [];
  function wing(s, a, h, fill, tip, shade, mono) {
    var sh = [.05, 0, .035 * s], A = arm(.2, .16, a), H = arm(.3, .5, h);
    A[2] *= s; H[2] *= s;
    var W = [sh[0] + A[0], sh[1] + A[1], sh[2] + A[2]], T = [W[0] + H[0], W[1] + H[1], W[2] + H[2]];
    var C = [2 * W[0] - (sh[0] + T[0]) / 2, 2 * W[1] - (sh[1] + T[1]) / 2, 2 * W[2] - (sh[2] + T[2]) / 2];
    var N = 9, i, u, q, x, y, z, ch;
    for (i = 0; i <= N; i++) {
      u = i / N; q = 1 - u;
      x = q * q * sh[0] + 2 * q * u * C[0] + u * u * T[0];
      y = q * q * sh[1] + 2 * q * u * C[1] + u * u * T[1];
      z = q * q * sh[2] + 2 * q * u * C[2] + u * u * T[2];
      ch = .03 + .22 * Math.pow(q, 1.15) * (1 + .55 * Math.sin(u * 3.14));   /* хорда сужается к кончику */
      pr(x, y, z); LX[i] = PX; LY[i] = PY;
      pr(x - ch, y - ch * .1 - .006, z); TX[i] = PX; TY[i] = PY;
    }
    ctx.beginPath(); ctx.moveTo(LX[0], LY[0]);
    for (i = 1; i <= N; i++) ctx.lineTo(LX[i], LY[i]);
    for (i = N; i >= 0; i--) ctx.lineTo(TX[i], TY[i]);
    ctx.closePath();
    if (mono) { ctx.fillStyle = mono; ctx.fill(); return; }
    var gr = ctx.createLinearGradient(0, Math.min(LY[N], LY[0]) - .02, 0, Math.max(TY[0], TY[N]) + .02);
    gr.addColorStop(0, fill); gr.addColorStop(1, shade);
    ctx.fillStyle = gr; ctx.fill();
    ctx.beginPath(); ctx.moveTo(LX[7], LY[7]);
    for (i = 8; i <= N; i++) ctx.lineTo(LX[i], LY[i]);
    for (i = N; i >= 7; i--) ctx.lineTo(TX[i], TY[i]);
    ctx.closePath(); ctx.fillStyle = tip; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((LX[8] + TX[8]) / 2, (LY[8] + TY[8]) / 2, .007, 0, TAU); ctx.fill();   /* белое пятнышко на чёрном */
  }
  function body(mono) {
    pr(-.14, 0, .03); var x1 = PX, y1 = PY; pr(-.3, -.008, .05); var x2 = PX, y2 = PY; pr(-.3, -.008, -.05); var x3 = PX, y3 = PY; pr(-.14, 0, -.03); var x4 = PX, y4 = PY;
    ctx.fillStyle = mono || '#e6eaee';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();   /* хвост */
    pr(0, 0, 0); var cx = PX, cy = PY;
    if (mono) ctx.fillStyle = mono;
    else { var gr = ctx.createLinearGradient(0, cy - .05, 0, cy + .06); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#d3dae1'); ctx.fillStyle = gr; }
    ctx.beginPath(); ctx.ellipse(cx - .005, cy + .006, .185, .045, -.04, 0, TAU); ctx.fill();
    pr(.235, .014, 0); var hx = PX, hy = PY;
    ctx.fillStyle = mono || '#fff'; ctx.beginPath(); ctx.ellipse(hx, hy, .046, .034, 0, 0, TAU); ctx.fill();
    if (!mono) {
      ctx.fillStyle = '#e9b43a'; ctx.beginPath(); ctx.moveTo(hx + .035, hy - .008); ctx.lineTo(hx + .09, hy + .006); ctx.lineTo(hx + .035, hy + .016); ctx.closePath(); ctx.fill();
    }
  }
  /* a, h — углы плеча и кисти, bank — крен (дальнее крыло ниже, ближнее выше) */
  function gullShape(a, h, bank, mono) {
    wing(-1, a - bank, h - bank, '#d9dfe5', '#2b2f35', '#bcc5ce', mono);
    body(mono);
    wing(1, a + bank, h + bank, '#fbfcfd', '#23272c', '#d5dce3', mono);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < gulls.length; i++) {
      var g = gulls[i], K = g.S * 1.45, sp = Math.sin(g.phase), sq = Math.sin(g.phase - .75), gl = Math.sin(g.t * 1.1 + g.ph0);
      var m = g.amp, gm = 1 - m;
      /* взмах: плечо ходит вверх-вниз, кисть запаздывает и сильнее изгибается; в планировании — «чаячье крыло» с изломом */
      var a = gm * (.5 + .06 * gl) + m * (.18 + .62 * sp);
      var hh = gm * (.0 + .07 * gl) + m * (-.08 + .8 * sq);
      var y = yAt(g, g.x) - m * sp * K * .05;
      var s1 = (yAt(g, g.x + 8 * g.dir) - yAt(g, g.x)) / 8, s2 = (yAt(g, g.x + 24 * g.dir) - yAt(g, g.x + 16 * g.dir)) / 8;
      var tilt = clamp(Math.atan(s1) * .45, -.3, .3), bank = clamp((s2 - s1) * g.dir * 9, -.3, .3);   /* наклон по траектории и крен на повороте */
      ctx.globalAlpha = g.alpha * g.fade;
      /* мягкая тень-ореол: чайка не теряется на светлых облаках */
      ctx.setTransform(dpr * K * g.dir, 0, 0, dpr * K, (g.x + .012 * K * g.dir) * dpr, (y + .035 * K) * dpr);
      ctx.rotate(tilt * g.dir); gullShape(a, hh, bank, 'rgba(45,65,100,.2)');
      ctx.setTransform(dpr * K * g.dir, 0, 0, dpr * K, g.x * dpr, y * dpr);
      ctx.rotate(tilt * g.dir); gullShape(a, hh, bank, null);
    }
    ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (ts - lastDraw < frameMs) return;
    var dt = lastTs ? Math.min((ts - lastTs) / 1000, .1) : 0;
    lastTs = ts; lastDraw = ts;
    step(dt);
    draw();
  }
  function shouldRun() { return !document.hidden && document.body.getAttribute('data-sec') === '0'; }
  function sync() {
    if (shouldRun()) { if (!raf) { lastTs = 0; raf = requestAnimationFrame(loop); } }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  measure();
  sync();
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-sec'] });
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { measure(); draw(); }, 160); });
  /* плашка встаёт на место уже после анимации входа: пересчитать, когда она осела */
  setTimeout(measure, 2600);
})();
