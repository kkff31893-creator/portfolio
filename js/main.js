/* main — boot: bake imagery, compile, build scenes, then the intro */
(function () {
  'use strict';
  const APP = window.APP;
  const U = APP.u, env = APP.env;
  const html = document.documentElement;
  const loader = U.qs('.loader');
  const num = U.qs('.loader__num');
  const shown = { v: 0 };

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function progress(p) {
    gsap.to(shown, {
      v: p, duration: 0.9, ease: 'power2.out', overwrite: true,
      onUpdate: () => { num.textContent = String(Math.floor(shown.v * 100)); }
    });
  }

  /* ---------- WebGL path ---------- */
  async function bootGL() {
    const S = APP.stage;
    S.init();
    await Promise.all([S.fontReady(), document.fonts ? document.fonts.ready : null]);
    progress(0.04);
    await APP.baker.run(S.renderer, (p) => progress(0.04 + p * 0.8));
    APP.applyShots();
    if (APP.experiments) APP.experiments.init(S.renderer);
    await S.compile();
    progress(0.92);
    if (APP.experiments) await APP.experiments.compile(S.renderer);
  }

  /* ---------- no-WebGL: quiet studio placeholders drawn in 2D ---------- */
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h; }
  function placeholders() {
    const names = new Set();
    U.qsa('[data-shot]').forEach((e) => names.add(e.dataset.shot));
    U.qsa('[data-shot-bg]').forEach((e) => names.add(e.dataset.shotBg));
    APP.projects.order.forEach((id) => {
      const p = APP.projects[id];
      names.add(p.hero);
      p.gallery.forEach((g) => names.add(g[0]));
    });
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 1024;
    const x = c.getContext('2d');
    names.forEach((n) => {
      const dark = /^(lumen|orbit)/.test(n);
      const rnd = U.mulberry(hash(n));
      const W = c.width, H = c.height;
      const bg = x.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, dark ? '#1b1b1d' : '#f4f3f1');
      bg.addColorStop(1, dark ? '#040405' : '#d6d4d0');
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      const r = W * (0.12 + rnd() * 0.08), cx = W * (0.36 + rnd() * 0.28), cy = H * 0.5 + r * 0.2;
      const sh = x.createRadialGradient(cx, cy + r, 0, cx, cy + r, r * 1.6);
      sh.addColorStop(0, dark ? 'rgba(0,0,0,.8)' : 'rgba(0,0,0,.28)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      x.save(); x.translate(0, (cy + r) * 0.82); x.scale(1, 0.18); x.fillStyle = sh; x.beginPath(); x.arc(cx, cy + r, r * 1.6, 0, Math.PI * 2); x.fill(); x.restore();
      const g = x.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r);
      g.addColorStop(0, dark ? '#9a9aa0' : '#ffffff');
      g.addColorStop(0.55, dark ? '#2a2a2e' : '#d9d7d3');
      g.addColorStop(1, dark ? '#070708' : '#9f9c97');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      APP.shots[n] = c.toDataURL('image/jpeg', 0.86);
    });
    APP.applyShots();
    const pin = U.qs('.porb__pin');
    if (pin && !U.qs('.porb__fallback', pin)) {
      const img = document.createElement('img');
      img.className = 'porb__fallback';
      img.alt = '';
      img.src = APP.shots['orbit-1'];
      pin.prepend(img);
    }
  }

  function dropGL() {
    env.webgl = false;
    html.classList.remove('has-webgl');
    html.classList.add('no-webgl');
    if (APP.stage) APP.stage.paused = true;
    APP.experiments = null;
  }

  /* ---------- loader out, then the hero assembles ---------- */
  function exit() {
    return new Promise((resolve) => {
      gsap.to(shown, {
        v: 1, duration: 0.5, ease: 'power1.out', overwrite: true,
        onUpdate: () => { num.textContent = String(Math.floor(shown.v * 100)); },
        onComplete: () => {
          if (env.reduced) {
            gsap.to(loader, { autoAlpha: 0, duration: 0.6, onComplete: () => { loader.remove(); } });
            resolve();
            return;
          }
          gsap.timeline({ onComplete: () => loader.remove() })
            .to(num, { yPercent: -110, duration: 0.8, ease: 'expo.in' }, 0)
            .to('.loader__label', { autoAlpha: 0, y: -10, duration: 0.5, ease: 'power2.in' }, 0.1)
            .call(resolve, null, 0.72)
            .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, 0.62);
        }
      });
    });
  }

  function intro() {
    const S = env.webgl && APP.stage && APP.stage.ready ? APP.stage : null;
    const tl = gsap.timeline();
    if (S) {
      if (env.reduced) {
        S.intro.lines = [1, 1, 1];
        S.intro.blob = 1;
      } else {
        [0, 1, 2].forEach((i) => {
          const o = { v: 0 };
          tl.to(o, { v: 1, duration: 1.4, ease: 'expo.out', onUpdate: () => { S.intro.lines[i] = o.v; } }, i * 0.09);
        });
        const b = { v: 0 };
        tl.to(b, { v: 1, duration: 2.4, ease: 'expo.out', onUpdate: () => { S.intro.blob = b.v; } }, 0.3);
      }
    } else if (!env.reduced) {
      tl.fromTo('.hero__title span', { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.4, stagger: 0.09, ease: 'expo.out' }, 0);
    }
    const lift = env.reduced ? {} : { y: 24 };
    tl.fromTo('[data-intro]', Object.assign({ autoAlpha: 0 }, lift), { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out' }, 0.55);
    return tl;
  }

  /* ---------- resize: only when it matters ---------- */
  function watchResize() {
    let rw = window.innerWidth, rh = window.innerHeight, t = 0;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = window.innerWidth, h = window.innerHeight;
        const hChanged = env.fine ? h !== rh : Math.abs(h - rh) > 160;
        if (w === rw && !hChanged) return;
        rw = w; rh = h;
        APP.measure();
        if (APP.stage && APP.stage.ready) APP.stage.resize();
        ScrollTrigger.refresh();
        APP.emit('resize');
      }, 120);
    });
  }

  /* ---------- go ---------- */
  async function boot() {
    window.scrollTo(0, 0);
    U.qsa('[data-split="chars"]').forEach((el) => APP.split.chars(el));
    U.qsa('[data-words]').forEach((el) => APP.split.words(el));
    U.qsa('[data-handle]').forEach((el) => APP.split.letters(el));
    APP.measure();

    let gl = env.webgl && APP.stage && APP.baker;
    if (gl) {
      try { await bootGL(); }
      catch (e) { console.warn('[portfolio] WebGL boot failed, using fallback', e); dropGL(); gl = false; }
    } else if (env.webgl) dropGL();
    if (!gl) {
      if (document.fonts) await document.fonts.ready;
      placeholders();
    }

    APP.scenes.init();
    if (APP.lenis) APP.lenis.stop();
    if (gl) APP.stage.start();
    APP.ui.init();
    APP.detail.init();
    watchResize();

    await exit();
    html.classList.add('is-ready');
    if (APP.lenis) APP.lenis.start();
    intro();

    const m = location.hash.match(/^#project\/(\w+)/);
    if (m && APP.projects[m[1]]) gsap.delayedCall(1.2, () => APP.detail.show(m[1], null, true));
    else if (location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1));
      if (document.getElementById(id)) gsap.delayedCall(0.4, () => APP.ui.scrollTo(id));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
