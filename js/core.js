/* core — shared namespace, environment, helpers, pointer, text splitting, project data */
(function () {
  'use strict';

  const APP = (window.APP = window.APP || {});
  const html = document.documentElement;

  /* ---------- environment ---------- */
  const mq = (q) => window.matchMedia(q);
  const env = (APP.env = {
    reduced: mq('(prefers-reduced-motion: reduce)').matches,
    fine: mq('(hover: hover) and (pointer: fine)').matches,
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    mobile: false,
    tablet: false,
    webgl: false,
    low: false
  });
  function measureEnv() {
    const w = window.innerWidth;
    env.mobile = w < 768;
    env.tablet = w >= 768 && w < 1100 && env.touch;
  }
  measureEnv();
  env.low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  try {
    const c = document.createElement('canvas');
    env.webgl = !!(c.getContext('webgl2'));
  } catch (e) { env.webgl = false; }
  if (typeof THREE === 'undefined') env.webgl = false;

  html.classList.add(env.webgl ? 'has-webgl' : 'no-webgl');
  if (env.reduced) html.classList.add('is-reduced');
  if (env.touch && !env.fine) html.classList.add('is-touch');

  /* ---------- math ---------- */
  const U = (APP.u = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
    smooth: (a, b, v) => {
      const t = U.clamp((v - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    rand: (a, b) => a + Math.random() * (b - a),
    qs: (s, r) => (r || document).querySelector(s),
    qsa: (s, r) => Array.from((r || document).querySelectorAll(s)),
    // deterministic PRNG so baked scenes are stable
    mulberry: (seed) => () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    hexToRgb: (hex) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    },
    rgbToCss: (c) => 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')',
    inView: (r, vh) => r.bottom > 0 && r.top < vh && r.width > 0
  });

  /* ---------- viewport ---------- */
  const vp = (APP.vp = { w: 0, h: 0, lvh: 0, dpr: 1 });
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100lvh;pointer-events:none;visibility:hidden';
  function measure() {
    vp.w = window.innerWidth;
    vp.h = window.innerHeight;
    if (!probe.isConnected) document.body.appendChild(probe);
    vp.lvh = Math.max(vp.h, probe.offsetHeight || vp.h);
    vp.dpr = Math.min(window.devicePixelRatio || 1, 3);
    measureEnv();
  }
  APP.measure = measure;

  /* ---------- tiny event bus ---------- */
  const handlers = {};
  APP.on = (n, fn) => ((handlers[n] = handlers[n] || []).push(fn), fn);
  APP.emit = (n, a, b) => (handlers[n] || []).forEach((fn) => fn(a, b));

  /* ---------- pointer ---------- */
  const P = (APP.pointer = {
    x: -9999, y: -9999, nx: 0, ny: 0, // raw px and normalized (-1..1, y up)
    sx: 0, sy: 0,                       // smoothed normalized
    vx: 0, vy: 0,                       // px / s
    down: false, moved: false, type: 'mouse',
    tt: -1e9,                           // last time a finger touched (s) — touch effects linger after it
    finger: false                       // a finger is on the glass (survives the scroll taking over)
  });
  // is there a pointer to react to right now? a mouse always is; a finger only while it touches, plus a short afterglow
  P.live = () => P.moved && (P.type === 'mouse' || P.finger || performance.now() / 1000 - P.tt < 1.1);
  let lastT = 0, lx = 0, ly = 0;
  function onMove(e) {
    const now = performance.now();
    const dt = Math.max(1, now - lastT) / 1000;
    P.x = e.clientX; P.y = e.clientY;
    if (P.moved) {
      P.vx = U.lerp(P.vx, (P.x - lx) / dt, 0.35);
      P.vy = U.lerp(P.vy, (P.y - ly) / dt, 0.35);
    }
    lx = P.x; ly = P.y; lastT = now;
    P.nx = (P.x / (vp.w || 1)) * 2 - 1;
    P.ny = -((P.y / (vp.h || 1)) * 2 - 1);
    P.moved = true;
    P.type = e.pointerType || 'mouse';
    if (P.type === 'touch' || P.type === 'pen') P.tt = now / 1000;
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', (e) => { onMove(e); P.down = true; APP.emit('down', e); }, { passive: true });
  window.addEventListener('pointerup', (e) => { P.down = false; APP.emit('up', e); }, { passive: true });
  window.addEventListener('pointercancel', () => { P.down = false; }, { passive: true });
  // once a swipe turns into a scroll the browser cancels pointer events, so the finger is followed with touch events too
  const onTouch = (e) => {
    const t = e.touches[0];
    if (t) onMove({ clientX: t.clientX, clientY: t.clientY, pointerType: 'touch' });
  };
  const offTouch = (e) => { if (!e.touches.length) { P.finger = false; P.tt = performance.now() / 1000; } };
  window.addEventListener('touchstart', (e) => { P.finger = true; onTouch(e); }, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchend', offTouch, { passive: true });
  window.addEventListener('touchcancel', offTouch, { passive: true });
  APP.tickPointer = (dt) => {
    // a lifted finger lets everything that leans toward the pointer drift home
    const rest = P.type !== 'mouse' && !P.live();
    P.sx = U.damp(P.sx, rest ? 0 : P.nx, rest ? 1.5 : 4, dt);
    P.sy = U.damp(P.sy, rest ? 0 : P.ny, rest ? 1.5 : 4, dt);
    P.vx *= Math.exp(-6 * dt);
    P.vy *= Math.exp(-6 * dt);
  };

  /* ---------- text splitting ---------- */
  function splitChars(el) {
    if (el.dataset.splitDone) return U.qsa('.sc', el);
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const words = text.split(' ');
    words.forEach((w, wi) => {
      const ws = document.createElement('span');
      ws.className = 'sw';
      ws.setAttribute('aria-hidden', 'true');
      for (const ch of w) {
        const c = document.createElement('span');
        c.className = 'sc';
        c.textContent = ch;
        ws.appendChild(c);
      }
      el.appendChild(ws);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.dataset.splitDone = '1';
    return U.qsa('.sc', el);
  }
  function splitWords(el) {
    if (el.dataset.splitDone) return U.qsa('.w', el);
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.textContent = '';
    text.split(' ').forEach((w, i, a) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      el.appendChild(s);
      if (i < a.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.dataset.splitDone = '1';
    return U.qsa('.w', el);
  }
  function rollify(el) {
    if (el.dataset.rollDone) return;
    const text = el.textContent;
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.appendChild(sr);
    const holder = document.createElement('span');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.display = 'inline-flex';
    let i = 0;
    for (const ch of text) {
      const c = document.createElement('span');
      c.className = 'roll__c';
      c.textContent = ch;
      c.setAttribute('data-c', ch);
      c.style.setProperty('--i', i++);
      holder.appendChild(c);
    }
    el.appendChild(holder);
    el.dataset.rollDone = '1';
  }
  // one inline-block per letter; the text itself stays intact for readers and for sampling
  function splitLetters(el) {
    if (el.dataset.splitDone) return U.qsa('.hc', el);
    const text = el.textContent.trim();
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
    el.textContent = '';
    for (const ch of text) {
      const c = document.createElement('span');
      c.className = 'hc';
      c.setAttribute('aria-hidden', 'true');
      const i = document.createElement('span');
      i.className = 'hc__i';
      i.textContent = ch;
      c.appendChild(i);
      el.appendChild(c);
    }
    el.dataset.splitDone = '1';
    return U.qsa('.hc', el);
  }
  APP.split = { chars: splitChars, words: splitWords, roll: rollify, letters: splitLetters };

  /* ---------- shots (baked imagery) ---------- */
  APP.shots = {};
  APP.applyShots = function () {
    U.qsa('img[data-shot]').forEach((img) => {
      const url = APP.shots[img.dataset.shot];
      if (url && img.getAttribute('src') !== url) {
        img.decoding = 'async';
        img.src = url;
      }
    });
    U.qsa('[data-shot-bg]').forEach((el) => {
      const url = APP.shots[el.dataset.shotBg];
      const target = el.firstElementChild || el;
      if (url) target.style.setProperty('--shot', 'url("' + url + '")');
    });
  };

  /* ---------- project data ---------- */
  APP.projects = {
    order: ['lumen', 'meridian', 'orbit', 'still'],
    lumen: {
      index: '01',
      title: 'Lumen',
      kind: 'Комната света, которая слушает.',
      theme: 'dark',
      hero: 'lumen-a',
      lead: 'Двенадцать плит оптического стекла вокруг одного источника. Люди движутся по комнате, и свет изгибается вместе с ними — каждый шаг меняет цвет.',
      meta: [['Год', '2026'], ['Роль', 'Дизайн, WebGL, железо'], ['Тип', 'Интерактивная инсталляция'], ['Место', 'Копенгаген']],
      gallery: [['lumen-b', 'tall'], ['lumen-c', 'tall'], ['lumen-a', 'wide']]
    },
    meridian: {
      index: '02',
      title: 'Meridian',
      kind: 'Пространственная айдентика для архитектурного бюро.',
      theme: 'light',
      hero: 'meridian-1',
      lead: 'Айдентика, выросшая из самих зданий: монолитные формы, мягкая тень и одна линия, которая проходит через каждую точку контакта.',
      meta: [['Год', '2025'], ['Роль', 'Арт-дирекшн, 3D'], ['Тип', 'Пространственная айдентика'], ['Клиент', 'Meridian Studio']],
      gallery: [['meridian-3', 'wide'], ['meridian-2', 'tall'], ['meridian-4', 'tall'], ['meridian-5', 'wide']]
    },
    orbit: {
      index: '03',
      title: 'Orbit',
      kind: 'Звуковой объект, показанный слой за слоем.',
      theme: 'dark',
      hero: 'orbit-1',
      lead: 'Промо-опыт для колонки из стекла, металла и керамики. Продукт собирается и разбирается по мере прокрутки — по одному материалу за раз.',
      meta: [['Год', '2025'], ['Роль', 'Продуктовый опыт, WebGL'], ['Тип', 'Промо-сайт'], ['Платформа', 'Веб, экраны в магазинах']],
      gallery: [['orbit-2', 'tall'], ['orbit-3', 'tall'], ['orbit-1', 'wide']]
    },
    still: {
      index: '04',
      title: 'Still',
      kind: 'Серия тихих предметов.',
      theme: 'light',
      hero: 'still-hero',
      lead: 'Личная серия о сдержанности. Один предмет, один свет, одна поверхность — отрендерено до тех пор, пока убирать стало нечего.',
      meta: [['Год', '2024'], ['Роль', 'Режиссура, 3D'], ['Тип', 'Визуальная серия'], ['Тираж', '12 отпечатков']],
      gallery: [['still-1', 'tall'], ['still-2', 'tall'], ['still-3', 'tall'], ['still-4', 'tall']]
    }
  };

  /* ---------- contact ---------- */
  APP.contact = { handle: '@doting_w', telegram: 'https://t.me/doting_w' };

  measure();
})();
