/* scenes — smooth scroll, background colour, reveals and every scroll-driven scene */
(function () {
  'use strict';
  const APP = window.APP;
  const U = APP.u, env = APP.env;
  const html = document.documentElement;
  const SC = (APP.scenes = {});
  const R = env.reduced;
  const vh = () => window.innerHeight;
  const vw = () => window.innerWidth;
  const pins = {};
  let S = null;

  SC.init = function () {
    S = env.webgl && APP.stage && APP.stage.renderer ? APP.stage : null;
    gsap.registerPlugin(ScrollTrigger);
    // main.js refreshes after its own debounced resize, once measurements are fresh
    ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' });
    initScroll();
    hero();
    index();
    lumen();
    meridian();
    orbit();
    still();
    experiments();
    about();
    contact();
    initBackground();
    initReveals();
    ScrollTrigger.addEventListener('refresh', () => APP.emit('scroll'));
    ScrollTrigger.refresh();
  };

  /* where a section really starts once pin spacers are in the flow */
  APP.sectionY = function (id) {
    if (id === 'top') return 0;
    // the finale is only complete at the end of its pin
    if (id === 'contact' && pins.contact) return pins.contact.end;
    if (pins[id]) return pins[id].start;
    const el = document.getElementById(id);
    if (!el) return 0;
    const y = el.getBoundingClientRect().top + (APP.lenis ? APP.lenis.scroll : window.scrollY);
    return Math.max(0, y);
  };

  /* ---------- smooth scroll + scroll velocity ---------- */
  function initScroll() {
    if (!R) {
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.3, autoRaf: false });
      APP.lenis = lenis;
      lenis.on('scroll', () => { ScrollTrigger.update(); APP.emit('scroll'); });
      gsap.ticker.add((time) => lenis.raf(time * 1000));
    } else {
      window.addEventListener('scroll', () => APP.emit('scroll'), { passive: true });
    }
    gsap.ticker.lagSmoothing(0);
    let lastY = window.scrollY, vel = 0;
    gsap.ticker.add((time, dms) => {
      const dt = Math.max(dms / 1000, 1 / 240);
      const y = APP.lenis ? APP.lenis.animatedScroll : window.scrollY;
      vel = U.damp(vel, U.clamp((y - lastY) / dt, -12000, 12000), 12, dt);
      lastY = y;
      APP.scrollVel = vel;
    });
  }

  /* ---------- page colour: one uniform backdrop that changes per scene ---------- */
  function initBackground() {
    const st = (APP.bgState = U.hexToRgb('#f5f5f7'));
    const proxy = { r: st[0], g: st[1], b: st[2] };
    const meta = document.querySelector('meta[name="theme-color"]');
    const secs = U.qsa('[data-bg]');
    secs.forEach((s) => { s._theme = s.dataset.theme; });
    const apply = () => {
      st[0] = proxy.r; st[1] = proxy.g; st[2] = proxy.b;
      html.style.setProperty('--bg', U.rgbToCss(st));
      if (S) S.setBgRGB(st[0], st[1], st[2]);
    };
    let current = null;
    const activate = (sec) => {
      if (current === sec) return;
      current = sec;
      const [r, g, b] = U.hexToRgb(sec.dataset.bg);
      gsap.to(proxy, {
        r, g, b, duration: R ? 0.01 : 1.1, ease: 'power2.inOut', overwrite: true, onUpdate: apply,
        onComplete: () => meta && meta.setAttribute('content', sec.dataset.bg)
      });
      // text everywhere follows the backdrop, so the tail of the previous scene stays legible
      secs.forEach((s) => { s.dataset.theme = sec._theme; });
      APP.emit('theme', sec._theme);
    };
    // one marker per scene (only its start is used — a pinned section measures its end
    // without the spacer, so ranges can't be trusted); the zone is whichever marker was passed last
    const marks = secs.map((sec) => ScrollTrigger.create({ trigger: sec, start: 'top 52%', refreshPriority: -1 }));
    const pick = () => {
      const y = window.scrollY;
      let k = 0;
      for (let i = 1; i < marks.length; i++) if (y >= marks[i].start) k = i;
      activate(secs[k]);
    };
    ScrollTrigger.create({ start: 0, end: 'max', refreshPriority: -2, onUpdate: pick });
    ScrollTrigger.addEventListener('refresh', pick);
    activate(secs[0]);
    apply();
  }

  /* ---------- reveals ---------- */
  function charsIn(el, st, opts) {
    el = typeof el === 'string' ? U.qs(el) : el;
    if (!el) return null;
    const chars = U.qsa('.sc', el);
    const vars = R
      ? { from: { opacity: 0 }, to: { opacity: 1, duration: 0.8, stagger: 0.01, ease: 'power1.out' } }
      : { from: { yPercent: 118, rotation: 5 }, to: { yPercent: 0, rotation: 0, duration: 1.35, stagger: 0.028, ease: 'expo.out' } };
    return gsap.fromTo(chars, Object.assign({ transformOrigin: '0% 100%' }, vars.from), Object.assign(vars.to, opts || {}, st ? { scrollTrigger: st } : {}));
  }
  SC.charsIn = charsIn;

  function initReveals() {
    U.qsa('[data-reveal="fade"]').forEach((el) => {
      gsap.fromTo(el, { autoAlpha: 0, y: R ? 0 : 26 }, {
        autoAlpha: 1, y: 0, duration: 1.3, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
  }

  /* =========================================================
     HERO — the camera leans in: the glass grows, the headline breaks
     into grain, then the object steps aside for the work
     ========================================================= */
  function hero() {
    const sec = U.qs('.hero'), h1 = U.qs('[data-hero-title]'), foot = U.qs('.hero__foot');
    const st = { trigger: sec, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true };
    const grow = () => (env.mobile ? 1.16 : 1.3);
    if (S) {
      const k = S.kf;
      gsap.timeline({ scrollTrigger: st })
        .fromTo(k, { x: 0, y: 0, s: 1, spin: 0 }, { x: 0, y: 0.015, s: grow, spin: 0.7, ease: 'power1.in', duration: 0.42 }, 0)
        .fromTo(S.heroFx, { dis: 0 }, { dis: 1, ease: 'none', duration: 0.44 }, 0.05)
        .fromTo(k, { x: 0, y: 0.015, s: grow, spin: 0.7 }, {
          x: () => (env.mobile ? 0.17 : 0.27), y: () => (env.mobile ? -0.12 : -0.05), s: () => (env.mobile ? 0.62 : 0.6),
          spin: 1.5, ease: 'power2.inOut', duration: 0.58, immediateRender: false
        }, 0.42)
        .fromTo(k, { amp: 0 }, { amp: 0.09, ease: 'sine.inOut', duration: 0.5, yoyo: true, repeat: 1 }, 0);

      // …and lifts off as the index arrives
      gsap.timeline({ scrollTrigger: { trigger: '.index', start: 'top top', end: () => '+=' + vh() * 0.75, scrub: true, invalidateOnRefresh: true } })
        .fromTo(k, { y: () => (env.mobile ? -0.12 : -0.05), s: () => (env.mobile ? 0.62 : 0.6), spin: 1.5 }, { y: 0.82, s: 0.44, spin: 2.6, ease: 'power2.in', duration: 1 }, 0);
    }
    if (!R) {
      gsap.fromTo(h1, { y: 0, scale: 1 }, { y: () => vh() * 0.12, scale: 1.1, ease: 'none', scrollTrigger: Object.assign({}, st, { end: '55% top' }) });
      if (!S) gsap.fromTo(h1, { autoAlpha: 1, filter: 'blur(0px)' }, { autoAlpha: 0, filter: 'blur(18px)', ease: 'power1.in', immediateRender: false, scrollTrigger: Object.assign({}, st, { end: '50% top' }) });
      gsap.fromTo(foot, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, ease: 'none', immediateRender: false, scrollTrigger: { trigger: sec, start: 'top top', end: '22% top', scrub: true } });
    }
  }

  /* =========================================================
     WORK INDEX
     ========================================================= */
  function index() {
    const mask = U.qs('.index__mask span');
    if (!R) {
      gsap.fromTo(mask, { scale: 0.8 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.index__mask', start: 'top bottom', end: 'center 55%', scrub: true } });
      gsap.fromTo(mask, { '--by': '10%' }, { '--by': '90%', ease: 'none', scrollTrigger: { trigger: '.index__mask', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
    const rows = U.qsa('.index__row');
    const st = { trigger: '.index__list', start: 'top 86%', once: true };
    gsap.fromTo(rows, { '--lp': 0 }, { '--lp': 1, duration: 1.8, ease: 'expo.inOut', stagger: 0.09, scrollTrigger: st });
    gsap.fromTo(rows, { autoAlpha: 0, y: R ? 0 : 36 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'expo.out', stagger: 0.09, delay: 0.15, scrollTrigger: st });
  }

  /* =========================================================
     01 LUMEN — a framed preview grows into the whole screen
     ========================================================= */
  function lumen() {
    const sec = U.qs('.pfull');
    const frame = U.qs('.pfull__frame', sec), media = U.qs('.pfull__media', sec), img = U.qs('img', media);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + vh() * 1.6, pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true }
    });
    pins.lumen = tl.scrollTrigger;
    tl.fromTo(frame, { '--k': 0 }, { '--k': 1, duration: 1, ease: 'power2.inOut' }, 0)
      .fromTo(img, { scale: R ? 1 : 1.3 }, { scale: 1, duration: 1, ease: 'power2.inOut' }, 0)
      .fromTo(U.qs('.pfull__top', sec), { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30, duration: 0.3 }, 0)
      .fromTo(U.qs('.pfull__shade', sec), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.55)
      .fromTo(U.qsa('.pfull__title .sc', sec), R ? { opacity: 0 } : { yPercent: 118 }, R ? { opacity: 1, duration: 0.3 } : { yPercent: 0, duration: 0.36, stagger: 0.045, ease: 'power3.out' }, 0.62)
      .fromTo([U.qs('.pfull__index', sec), U.qs('.pfull__kind', sec)], { autoAlpha: 0, y: R ? 0 : 18 }, { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.06 }, 0.74)
      .to({}, { duration: 0.3 });

    // the scene leans away from the pointer
    if (env.fine && !R) {
      const xTo = gsap.quickTo(media, 'x', { duration: 1.4, ease: 'power3' });
      const yTo = gsap.quickTo(media, 'y', { duration: 1.4, ease: 'power3' });
      sec.addEventListener('pointermove', (e) => { xTo(-(e.clientX / vw() - 0.5) * 34); yTo(-(e.clientY / vh() - 0.5) * 22); });
      sec.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    }
    APP.lumenK = () => parseFloat(gsap.getProperty(frame, '--k')) || 0;
  }

  /* =========================================================
     02 MERIDIAN — horizontal gallery driven by vertical scroll
     ========================================================= */
  function meridian() {
    const sec = U.qs('.phz'), track = U.qs('.phz__track', sec);
    const dist = () => Math.max(0, track.scrollWidth - vw());
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true }
    });
    pins.meridian = tween.scrollTrigger;

    charsIn(U.qs('.phz__title', sec), { trigger: sec, start: 'top 62%', once: true });
    gsap.fromTo([U.qs('.phz__intro .eyebrow', sec), U.qs('.phz__line', sec), U.qs('.phz__hint', sec)], { autoAlpha: 0, y: R ? 0 : 22 }, {
      autoAlpha: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.08, delay: 0.25, scrollTrigger: { trigger: sec, start: 'top 62%', once: true }
    });

    const figs = U.qsa('.phz__fig', sec);
    figs.forEach((fig) => {
      const img = U.qs('img', fig), media = U.qs('.phz__media', fig);
      const st = { trigger: fig, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true };
      if (!R) {
        gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: st });
        gsap.fromTo(media, { rotationY: -9, transformPerspective: 1600 }, { rotationY: 9, ease: 'none', scrollTrigger: Object.assign({}, st) });
      }
      gsap.fromTo(U.qsa('figcaption span', fig), { autoAlpha: 0, y: 14 }, {
        autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: fig, containerAnimation: tween, start: 'left 80%', toggleActions: 'play none none reverse' }
      });
    });

    if (!R) U.qsa('[data-depth]', sec).forEach((s) => {
      const d = parseFloat(s.dataset.depth) || 0;
      gsap.fromTo(s, { x: () => -d * vw() * 0.16 }, {
        x: () => d * vw() * 0.16, ease: 'none',
        scrollTrigger: { trigger: s.parentNode, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true, invalidateOnRefresh: true }
      });
    });

    const count = U.qs('.phz__count', sec);
    let n = 1;
    const setCount = (i) => {
      if (i === n) return;
      const dir = i > n ? 1 : -1;
      n = i;
      gsap.to(count, {
        yPercent: -60 * dir, autoAlpha: 0, duration: 0.25, ease: 'power2.in', overwrite: true,
        onComplete: () => {
          count.textContent = String(i).padStart(2, '0');
          gsap.fromTo(count, { yPercent: 60 * dir, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out' });
        }
      });
    };
    figs.forEach((fig, i) => ScrollTrigger.create({
      trigger: fig, containerAnimation: tween, start: 'left 55%', end: 'right 55%',
      onToggle: (self) => self.isActive && setCount(i + 1)
    }));
  }

  /* =========================================================
     03 ORBIT — the product assembles, opens up and closes again
     ========================================================= */
  function orbit() {
    const sec = U.qs('.porb');
    const intro = U.qs('.porb__intro', sec), outro = U.qs('.porb__outro', sec);
    const callouts = U.qsa('.callout', sec), labels = U.qsa('.callout__label', sec);
    const legend = U.qsa('.porb__legend li', sec);   // phones: numbered dots, labels listed below the object
    charsIn(U.qs('.porb__title', sec), { trigger: sec, start: 'top 58%', once: true });
    gsap.fromTo([U.qs('.porb__intro .eyebrow', sec), U.qs('.porb__kind', sec)], { autoAlpha: 0, y: R ? 0 : 18 }, {
      autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, delay: 0.2, scrollTrigger: { trigger: sec, start: 'top 58%', once: true }
    });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: () => '+=' + vh() * 3, pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { if (S) S.orbit.p = self.progress; },
        onRefresh: (self) => { if (S) S.orbit.p = self.progress; }
      }
    });
    pins.orbit = tl.scrollTrigger;
    tl.fromTo(intro, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: R ? 0 : -40, duration: 0.08 }, 0.1)
      .fromTo(callouts, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05, stagger: 0.035 }, 0.33)
      .fromTo(callouts, { '--p': 0 }, { '--p': 1, duration: 0.09, stagger: 0.035, ease: 'power2.out' }, 0.33)
      .fromTo(labels, { autoAlpha: 0, x: (i) => (i === 1 ? 14 : -14) }, { autoAlpha: 1, x: 0, duration: 0.07, stagger: 0.035, ease: 'power2.out' }, 0.37)
      .fromTo(legend, { autoAlpha: 0, y: R ? 0 : 14 }, { autoAlpha: 1, y: 0, duration: 0.07, stagger: 0.035, ease: 'power2.out' }, 0.37)
      .to(callouts, { autoAlpha: 0, duration: 0.05, stagger: 0.02 }, 0.66)
      .to(legend, { autoAlpha: 0, duration: 0.05, stagger: 0.02 }, 0.66)
      .fromTo(outro, { autoAlpha: 0, y: R ? 0 : 30 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.86)
      .to({}, { duration: 0.06 }, 0.94);
  }

  /* =========================================================
     04 STILL — quiet images, each on its own depth
     ========================================================= */
  function still() {
    charsIn('.pstill__title', { trigger: '.pstill__title', start: 'top 86%', once: true });
    const figs = U.qsa('.still');
    figs.forEach((fig) => {
      const speed = parseFloat(fig.dataset.speed) || 0;
      const media = U.qs('.still__media', fig), img = U.qs('img', fig);
      if (!R) gsap.fromTo(fig, { y: () => -speed * vh() }, { y: () => speed * vh(), ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
      const st = { trigger: fig, start: 'top 88%', once: true };
      if (R) {
        gsap.fromTo(fig, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, scrollTrigger: st });
        return;
      }
      gsap.fromTo(media, { clipPath: 'inset(16% 12% 16% 12% round 14px)' }, { clipPath: 'inset(0% 0% 0% 0% round 14px)', duration: 1.7, ease: 'expo.out', scrollTrigger: st });
      gsap.fromTo(img, { scale: 1.4, filter: 'blur(16px)' }, { scale: 1, filter: 'blur(0px)', duration: 1.9, ease: 'expo.out', clearProps: 'filter', scrollTrigger: st });
    });

    // hovering a still bends it with the speed of the pointer
    if (!env.fine || R) return;
    const disp = document.querySelector('#distort feDisplacementMap');
    const P = APP.pointer;
    let hovering = false, amt = 0, last = -1;
    figs.forEach((f) => {
      f.addEventListener('pointerenter', () => { hovering = true; });
      f.addEventListener('pointerleave', () => { hovering = false; });
    });
    gsap.ticker.add((time, dms) => {
      const dt = Math.min(dms / 1000, 0.05);
      const target = hovering ? Math.min(Math.hypot(P.vx, P.vy) * 0.011, 34) : 0;
      amt = U.damp(amt, target, 5, dt);
      if (Math.abs(amt - last) > 0.05) { disp.setAttribute('scale', amt.toFixed(2)); last = amt; }
    });
  }

  /* =========================================================
     EXPERIMENTS
     ========================================================= */
  function experiments() {
    charsIn('.exp__title', { trigger: '.exp__title', start: 'top 86%', once: true });
    const X = APP.experiments && APP.experiments.list ? APP.experiments : null;
    U.qsa('.xp').forEach((el, i) => {
      const xp = X && X.list.find((x) => x.el === el);
      const st = { trigger: el, start: 'top 94%', once: true };
      const delay = (i % 2) * 0.1;
      if (!R) gsap.fromTo(el, { y: 90 }, { y: 0, duration: 1.7, ease: 'expo.out', delay, scrollTrigger: st });
      if (xp) {
        xp.fade = 0;
        const o = { f: 0 };
        gsap.to(o, { f: 1, duration: 1.3, ease: 'power2.out', delay, scrollTrigger: st, onUpdate: () => { xp.fade = o.f; } });
      } else {
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 1.2, delay, scrollTrigger: st });
      }
      gsap.fromTo(U.qsa('.xp__num, .xp__label, .xp__hint', el), { autoAlpha: 0, y: R ? 0 : 10 }, {
        autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.06, delay: delay + 0.35, scrollTrigger: st
      });
    });
  }

  /* =========================================================
     ABOUT — one sentence, then one image opens into many
     ========================================================= */
  function about() {
    const words = U.qsa('.about__statement .w');
    gsap.to(words, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: '.about__statement', start: 'top 82%', end: 'bottom 42%', scrub: true } });

    const zoom = U.qs('.zoom'), grid = U.qs('.zoom__grid'), center = U.qs('.zoom__cell--center');
    const cells = U.qsa('.zoom__cell'), others = cells.filter((c) => c !== center);
    gsap.set(grid, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
    if (R) return;
    const s0 = () => Math.max(vw() / center.offsetWidth, zoom.offsetHeight / center.offsetHeight) * 1.02;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: zoom, start: 'top top', end: () => '+=' + vh() * 1.5, pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true }
    });
    tl.fromTo(grid, { scale: s0 }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
      .fromTo(cells, { '--rk': 0 }, { '--rk': 1, ease: 'power2.in', duration: 1 }, 0)
      .fromTo(others, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power1.out', stagger: { each: 0.02, from: 'center' } }, 0.12)
      .to({}, { duration: 0.25 });
  }

  /* =========================================================
     CONTACT — the finale: the title turns to dust, the glass collapses
     into a ring of it, and the ring settles into the Telegram handle
     ========================================================= */
  function contact() {
    const sec = U.qs('.contact');
    const title = U.qs('.contact__title', sec), chars = U.qsa('.sc', title);
    const handle = U.qs('[data-handle]', sec);
    const eyebrow = U.qs('.finale__eyebrow', sec), actions = U.qsa('.finale__actions > *', sec);
    const bottom = U.qs('.contact__bottom', sec);
    const setQ = (q) => { APP.finaleQ = q; if (S) S.footer.q = q; };

    if (R) {
      // no pin, no dust: everything is simply there
      setQ(1);
      charsIn(title, { trigger: title, start: 'top 88%', once: true }, { stagger: 0.022 });
      return;
    }
    charsIn(title, { trigger: sec, start: 'top 70%', once: true }, { stagger: 0.022 });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: () => '+=' + vh() * 2.4, pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { setQ(self.progress); if (!S) typeHandle(self.progress); },
        onRefresh: (self) => { setQ(self.progress); if (!S) typeHandle(self.progress); }
      }
    });
    pins.contact = tl.scrollTrigger;

    // the glass rises beside the title as the footer arrives
    if (S) ScrollTrigger.create({
      trigger: sec, start: 'top bottom', end: 'top top', scrub: true,
      onUpdate: (self) => { S.footer.p = self.progress; },
      onRefresh: (self) => { S.footer.p = self.progress; }
    });

    const n = chars.length;
    if (S) {
      // each glyph hands over to its particles at the moment they leave it (same schedule as the shader)
      chars.forEach((ch, k) => {
        const d = (n > 1 ? k / (n - 1) : 0) * 0.85;
        tl.fromTo(ch, { opacity: 1 }, { opacity: 0, duration: 0.028, immediateRender: false }, 0.1 + 0.192 * d);
      });
      tl.fromTo(handle, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.84);
    } else {
      // no WebGL: the title evaporates, the handle types itself in and closes up
      chars.forEach((ch, k) => {
        const d = n > 1 ? k / (n - 1) : 0;
        tl.fromTo(ch, { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(14px)', duration: 0.07, immediateRender: false }, 0.1 + 0.26 * d);
      });
      tl.fromTo(handle, { autoAlpha: 0, letterSpacing: '0.42em', filter: 'blur(16px)' }, { autoAlpha: 1, letterSpacing: '-0.058em', filter: 'blur(0px)', duration: 0.34, ease: 'power3.out' }, 0.46);
    }
    tl.fromTo([eyebrow].concat(actions), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.06, stagger: 0.018, ease: 'power2.out' }, 0.86)
      .fromTo(bottom, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.06, ease: 'power2.out' }, 0.9)
      .to({}, { duration: 0.001 }, 0.999);

    // fallback typing: characters resolve left to right as the scroll advances
    const letters = U.qsa('.hc__i', handle);
    const final = letters.map((l) => l.textContent);
    const pool = 'абвгдежзиклмнопрстуфхцчшэюяabcdefghijklmnopqrstuvwxyz0123456789';
    let last = '';
    function typeHandle(q) {
      const k = U.clamp((q - 0.46) / 0.34, 0, 1);
      const out = final.map((ch, i) => (k >= (i + 1) / final.length || ch === '@' || ch === '_' ? ch : pool[(i * 7 + Math.floor(q * 90) * 13) % pool.length]));
      const key = out.join('');
      if (key === last) return;
      last = key;
      out.forEach((ch, i) => { if (letters[i].textContent !== ch) letters[i].textContent = ch; });
    }
  }
})();
