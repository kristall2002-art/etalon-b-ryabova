/* Вариант B. Буквы слова «Нотариус» влетают по одной: каждая — из случайной точки, с поворотом,
   увеличенная и размытая, затем «садится» на место с мягким отскоком. Тот же приём, что на первом
   экране сайта агентства (там это сделано на GSAP; здесь — стандартный Web Animations API, без библиотек).
   После вылета буквы слегка расступаются от курсора. Слово остаётся в разметке: у обёртки aria-label,
   текст внутри не меняется, поэтому поисковики и скринридеры читают его целиком. */
(function () {
  'use strict';
  var home = document.getElementById('home'), word = document.getElementById('heroWord');
  if (!home || !word) return;
  var hash = (location.hash || '').replace('#', '');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  function go() { home.classList.add('go'); }
  function show() { go(); word.classList.add('in'); }
  var text = (word.textContent || '').trim();
  var can = window.Element && Element.prototype.animate && window.CSS && CSS.supports &&
            CSS.supports('translate', '1px 1px') && CSS.supports('scale', '1') && CSS.supports('rotate', '1deg');
  if (!text || reduced || !can || (hash && hash !== 'home')) { show(); return; }

  var fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('500 80px "Playfair Display"', text) : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 1500); })])
    .then(function () { requestAnimationFrame(begin); }, function () { requestAnimationFrame(begin); });

  var mobile = matchMedia('(max-width:768px)').matches;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function begin() {
    // буквы в отдельных span (aria-hidden), у слова — aria-label
    word.setAttribute('aria-label', text);
    word.textContent = '';
    var chars = Array.prototype.map.call(text, function (c) {
      var s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true'); s.textContent = c;
      word.appendChild(s); return s;
    });
    word.classList.add('in');        // слово видно, отдельные буквы ждут своей очереди
    go();

    var spreadX = mobile ? 150 : 260, spreadY = mobile ? 110 : 160, base = 160, step = 95, left = chars.length;
    chars.forEach(function (el, i) {
      var delay = base + i * step;
      el.animate([
        { translate: rnd(-spreadX, spreadX) + 'px ' + rnd(-spreadY, spreadY) + 'px', rotate: rnd(-70, 70) + 'deg', opacity: 0, filter: 'blur(8px)' },
        { translate: '0px 0px', rotate: '0deg', opacity: 1, filter: 'blur(0px)' }
      ], { duration: 1000, delay: delay, easing: 'cubic-bezier(.19,1,.22,1)', fill: 'backwards' });
      var pop = el.animate([{ scale: 2.4 }, { scale: 1 }],
        { duration: 820, delay: delay, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
      pop.onfinish = function () { if (--left === 0) deflect(chars); };
    });
  }

  /* после вылета: буквы расступаются от курсора (только мышь) */
  function deflect(chars) {
    if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var R = 150, MAX = 26, S = chars.map(function () { return { x: 0, y: 0, cx: 0, cy: 0 }; });
    var mx = -1e4, my = -1e4, raf = 0, centers = [], dirty = true;
    function measure() {
      centers = chars.map(function (el, i) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - S[i].x, y: r.top + r.height / 2 - S[i].y }; });
      dirty = false;
    }
    function tick() {
      raf = 0;
      if (dirty) measure();
      var moving = false;
      chars.forEach(function (el, i) {
        var s = S[i], tx = 0, ty = 0, dx = centers[i].x - mx, dy = centers[i].y - my, d = Math.hypot(dx, dy);
        if (d < R && d > 0) { var f = 1 - d / R; f *= f; tx = dx / d * f * MAX; ty = dy / d * f * MAX; }
        s.cx += (tx - s.cx) * .16; s.cy += (ty - s.cy) * .16;
        if (Math.abs(s.cx - s.x) > .03 || Math.abs(s.cy - s.y) > .03) {
          s.x = s.cx; s.y = s.cy; el.style.translate = s.x.toFixed(2) + 'px ' + s.y.toFixed(2) + 'px';
        }
        if (Math.abs(s.cx) > .05 || Math.abs(s.cy) > .05 || Math.abs(tx - s.cx) > .05 || Math.abs(ty - s.cy) > .05) moving = true;
      });
      if (moving) raf = requestAnimationFrame(tick);
    }
    home.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    home.addEventListener('pointerleave', function () { mx = my = -1e4; if (!raf) raf = requestAnimationFrame(tick); });
    window.addEventListener('resize', function () { dirty = true; });
  }
})();
