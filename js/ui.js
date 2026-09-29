/* ui — cursor, magnetic buttons, text roll, navigation, index preview, tilt, magnetic type, contact details */
(function () {
  'use strict';
  const APP = window.APP;
  const U = APP.u, env = APP.env, P = APP.pointer, vp = APP.vp;
  const html = document.documentElement;
  const UI = (APP.ui = {});

  UI.init = function () {
    // hints speak to fingers on touch screens
    if (!env.fine) U.qsa('[data-hint-touch]').forEach((el) => { el.textContent = el.dataset.hintTouch; });
    U.qsa('[data-roll]').forEach(APP.split.roll);
    initCursor();
    initMagnetic();
    initFills();
    initNav();
    initMenu();
    initPreview();
    initTilt();
    initMagType();
    initContact();
  };

  /* smooth scroll to a section (scenes.js knows where pinned sections really start) */
  UI.scrollTo = function (id, opts) {
    const y = APP.sectionY ? APP.sectionY(id) : (document.getElementById(id) || document.body).offsetTop;
    if (APP.lenis) APP.lenis.scrollTo(y, Object.assign({ duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) }, opts));
    else window.scrollTo({ top: y, behavior: env.reduced ? 'auto' : 'smooth' });
  };

  /* =========================================================
     CURSOR
     ========================================================= */
  function initCursor() {
    if (!env.fine) return;
    html.classList.add('has-cursor');
    const el = U.qs('.cursor'), ring = U.qs('.cursor__ring'), dot = U.qs('.cursor__dot'), label = U.qs('.cursor__label');
    const c = { x: -200, y: -200, w: 12, h: 12, r: 6, s: 1, sq: 0, ang: 0 };
    const t = { x: -200, y: -200, w: 12, h: 12, r: 6, s: 1 };
    let state = '', target = null, stickEl = null, dragging = false, down = false, dirty = true, lastLabel = '';
    let lastScrollCheck = 0, tagW = 0;

    const sizes = { '': 12, hover: 58, solid: 92, drag: 84, hint: 70, blob: 76 };

    function resolve(node) {
      target = node;
      const hit = node && node.closest ? node.closest('[data-cursor], a, button, [role="button"]') : null;
      let next = '', text = '';
      stickEl = null;
      if (hit) {
        const kind = hit.getAttribute('data-cursor');
        if (kind === 'view') { next = 'solid'; text = hit.dataset.cursorLabel || 'Смотреть'; }
        else if (kind === 'drag') { next = 'drag'; text = hit.dataset.cursorLabel || 'Вращать'; }
        else if (kind === 'hint') { next = 'hint'; text = hit.dataset.cursorLabel || ''; }
        else if (kind === 'stick') { next = 'stick'; stickEl = hit; }
        else if (kind === 'tag') { next = 'tag'; text = hit.dataset.cursorLabel || ''; }
        else next = 'hover';
      } else if (APP.stage && APP.stage.blobHover) next = 'blob';
      if (text !== lastLabel) { label.textContent = text; lastLabel = text; tagW = 0; }
      if (next !== state) {
        el.classList.remove('is-hover', 'is-solid', 'is-hint', 'is-stick', 'is-drag', 'is-blob', 'is-tag');
        tagW = 0;
        if (next === 'solid' || next === 'drag') el.classList.add('is-solid');
        if (next) el.classList.add('is-' + next);
        state = next;
      }
    }

    window.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') resolve(e.target); }, { passive: true });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      el.classList.remove('is-hidden');
      dirty = true;
    }, { passive: true });
    document.addEventListener('pointerleave', () => el.classList.add('is-hidden'));
    document.documentElement.addEventListener('mouseleave', () => el.classList.add('is-hidden'));
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') down = true; }, { passive: true });
    window.addEventListener('pointerup', () => { down = false; }, { passive: true });
    window.addEventListener('blur', () => { down = false; });
    APP.on('drag', (v) => { dragging = v; });
    APP.on('cursor:refresh', () => { resolve(document.elementFromPoint(P.x, P.y)); });

    gsap.ticker.add((time, deltaMS) => {
      const dt = Math.min(deltaMS / 1000, 1 / 20);
      // things move under a still cursor while scrolling; re-check what is under it
      if (Math.abs(APP.scrollVel || 0) > 20 && time - lastScrollCheck > 0.08 && P.moved) {
        lastScrollCheck = time;
        resolve(document.elementFromPoint(P.x, P.y));
      } else if (!target || state === '' || state === 'blob') {
        const blobOn = !!(APP.stage && APP.stage.blobHover);
        if ((state === 'blob') !== blobOn && (!target || !target.closest('[data-cursor],a,button,[role="button"]'))) resolve(target);
      }

      if (state === 'stick' && stickEl && stickEl.isConnected) {
        const r = stickEl.getBoundingClientRect();
        const cs = getComputedStyle(stickEl);
        const pad = r.height < 44 ? 10 : 6;
        t.w = r.width + pad * 2;
        t.h = r.height + pad * 2;
        const br = cs.borderTopLeftRadius;
        t.r = br.endsWith('%') ? Math.min(t.w, t.h) / 2 : Math.min(parseFloat(br) + pad || t.h / 2, t.h / 2);
        // lean slightly toward the pointer
        t.x = r.left + r.width / 2 + (P.x - (r.left + r.width / 2)) * 0.08;
        t.y = r.top + r.height / 2 + (P.y - (r.top + r.height / 2)) * 0.08;
      } else if (state === 'tag') {
        // a small label that rides beside the pointer and leaves what is under it visible
        if (!tagW) tagW = label.offsetWidth + 34;
        t.w = tagW; t.h = 36; t.r = 18;
        const right = P.x + 20 + t.w < vp.w - 10;
        t.x = right ? P.x + 20 + t.w / 2 : P.x - 20 - t.w / 2;
        t.y = P.y + 24 + t.h / 2;
      } else {
        const d = sizes[state] || 12;
        t.w = t.h = d;
        t.r = d / 2;
        t.x = P.x; t.y = P.y;
      }
      t.s = down ? 0.84 : dragging ? 0.8 : 1;

      const lam = state === 'stick' ? 16 : state === 'tag' ? 11 : 13;
      c.x = U.damp(c.x, t.x, lam, dt);
      c.y = U.damp(c.y, t.y, lam, dt);
      c.w = U.damp(c.w, t.w, 12, dt);
      c.h = U.damp(c.h, t.h, 12, dt);
      c.r = U.damp(c.r, t.r, 12, dt);
      c.s = U.damp(c.s, t.s, 14, dt);

      // squash & stretch along the direction of travel
      const speed = Math.hypot(P.vx, P.vy);
      const canSquash = state === '' || state === 'hover' || state === 'blob';
      c.sq = U.damp(c.sq, canSquash ? Math.min(speed / 3200, 0.32) : 0, 10, dt);
      if (speed > 30) c.ang = Math.atan2(P.vy, P.vx);
      const sx = c.s * (1 + c.sq), sy = c.s * (1 - c.sq * 0.6);

      ring.style.width = c.w.toFixed(2) + 'px';
      ring.style.height = c.h.toFixed(2) + 'px';
      ring.style.borderRadius = c.r.toFixed(2) + 'px';
      const a = (c.ang * 180) / Math.PI;
      ring.style.transform = 'translate3d(' + (c.x - c.w / 2).toFixed(2) + 'px,' + (c.y - c.h / 2).toFixed(2) + 'px,0) rotate(' + a.toFixed(2) + 'deg) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ') rotate(' + (-a).toFixed(2) + 'deg)';
      if (dirty) {
        dot.style.transform = 'translate3d(' + P.x + 'px,' + P.y + 'px,0)';
        dirty = false;
      }
    });
    UI.cursorRefresh = () => resolve(document.elementFromPoint(P.x, P.y));
  }

  /* =========================================================
     MAGNETIC
     ========================================================= */
  function initMagnetic() {
    if (!env.fine || env.reduced) return;
    U.qsa('[data-magnetic]').forEach((el) => {
      const k = parseFloat(el.dataset.magnetic) || 0.3;
      const inner = el.querySelector('.roll, .circle-btn__text, .nav__mark');
      const xTo = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3' });
      const ixTo = inner && gsap.quickTo(inner, 'x', { duration: 0.9, ease: 'power3' });
      const iyTo = inner && gsap.quickTo(inner, 'y', { duration: 0.9, ease: 'power3' });
      let cx = 0, cy = 0;
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        cx = r.left + r.width / 2 - (gsap.getProperty(el, 'x') || 0);
        cy = r.top + r.height / 2 - (gsap.getProperty(el, 'y') || 0);
      });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        xTo(dx * k); yTo(dy * k);
        if (inner) { ixTo(dx * k * 0.45); iyTo(dy * k * 0.45); }
      });
      el.addEventListener('pointerleave', () => {
        xTo(0); yTo(0);
        if (inner) { ixTo(0); iyTo(0); }
      });
    });
  }

  /* fill circles grow from where the pointer enters and leave where it exits */
  function initFills() {
    U.qsa('.pill, .circle-btn').forEach((el) => {
      const set = (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--fx', ((e.clientX - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--fy', ((e.clientY - r.top) / r.height) * 100 + '%');
      };
      el.addEventListener('pointerenter', set);
      el.addEventListener('pointerleave', set);
    });
  }

  /* =========================================================
     NAV
     ========================================================= */
  let nav, pill, links = [], sections = [], navTheme = '', navGroup = null, menuOpen = false;

  function initNav() {
    nav = U.qs('[data-nav]');
    pill = U.qs('.nav__pill');
    links = U.qsa('[data-nav-link]');
    sections = U.qsa('main > section, main > * > section, footer.contact');

    const go = (e) => {
      const a = e.currentTarget;
      const id = (a.getAttribute('href') || '').replace('#', '');
      if (!id) return;
      e.preventDefault();
      if (menuOpen) toggleMenu(false);
      UI.scrollTo(id === 'top' ? 'top' : id);
    };
    links.forEach((a) => a.addEventListener('click', go));
    U.qs('.nav__brand').addEventListener('click', go);
    U.qsa('.menu__links a').forEach((a) => a.addEventListener('click', go));

    APP.on('scroll', updateNav);
    APP.on('resize', () => { navGroup = null; updateNav(); });
    updateNav();
  }

  function sectionAt(y) {
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return s;
    }
    return null;
  }

  function updateNav() {
    if (!nav) return;
    const y = APP.lenis ? APP.lenis.scroll : window.scrollY;
    nav.classList.toggle('is-condensed', y > 60);
    nav.classList.toggle('is-shown', y > 40 || menuOpen);
    const probe = sectionAt(nav.offsetHeight * 0.5 + 8);
    const theme = menuOpen ? 'dark' : probe ? probe.dataset.theme || 'light' : 'light';
    if (theme !== navTheme) { navTheme = theme; nav.dataset.theme = theme; }
    const mid = sectionAt(window.innerHeight * 0.5);
    const group = mid ? mid.dataset.group || '' : '';
    if (group !== navGroup) {
      navGroup = group;
      const link = links.find((a) => a.dataset.navLink === group);
      links.forEach((a) => a.classList.toggle('is-pill', a === link));
      if (link) {
        gsap.to(pill, { x: link.offsetLeft, width: link.offsetWidth, opacity: 1, duration: 0.8, ease: 'expo.out', overwrite: true });
      } else {
        gsap.to(pill, { opacity: 0, duration: 0.4, overwrite: true });
      }
    }
  }
  UI.updateNav = updateNav;

  /* ---------- mobile menu ---------- */
  function initMenu() {
    const btn = U.qs('.nav__menu'), menu = U.qs('#menu');
    btn.addEventListener('click', () => toggleMenu(!menuOpen));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) toggleMenu(false); });
    UI.menu = { btn, menu };
  }
  function toggleMenu(open) {
    const { btn, menu } = UI.menu;
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    html.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    btn.querySelector('.nav__menu-label').textContent = open ? 'Закрыть' : 'Меню';
    if (APP.lenis) open ? APP.lenis.stop() : APP.lenis.start();
    navTheme = '';
    updateNav();
    if (open) { const first = menu.querySelector('a'); first && first.focus({ preventScroll: true }); }
  }

  /* =========================================================
     INDEX — floating preview that follows the cursor
     ========================================================= */
  function initPreview() {
    const list = U.qs('.index__list');
    const box = U.qs('.preview'), track = U.qs('.preview__track');
    const rows = U.qsa('a[data-preview]', list);
    if (!env.fine) return;
    const w = () => box.offsetWidth, h = () => box.offsetHeight;
    const xTo = gsap.quickTo(box, 'x', { duration: 0.65, ease: 'power3' });
    const yTo = gsap.quickTo(box, 'y', { duration: 0.65, ease: 'power3' });
    const rTo = gsap.quickTo(box, 'rotation', { duration: 0.8, ease: 'power3' });
    let on = false, idx = -1;
    gsap.set(box, { scale: 0.6, autoAlpha: 0 });

    const move = (e) => {
      xTo(e.clientX - w() / 2);
      yTo(e.clientY - h() / 2);
      rTo(U.clamp(P.vx * 0.006, -9, 9));
    };
    rows.forEach((a) => {
      a.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        const i = +a.dataset.preview;
        if (!on) {
          on = true;
          gsap.set(box, { x: e.clientX - w() / 2, y: e.clientY - h() / 2 });
          gsap.set(track, { yPercent: -i * 100 });
          gsap.to(box, { scale: 1, autoAlpha: 1, duration: 0.7, ease: 'expo.out', overwrite: 'auto' });
        } else if (i !== idx) {
          gsap.to(track, { yPercent: -i * 100, duration: 0.9, ease: 'expo.out', overwrite: true });
          const img = track.children[i].querySelector('img');
          gsap.fromTo(img, { scale: 1.3 }, { scale: 1.12, duration: 1.1, ease: 'expo.out', overwrite: true });
        }
        idx = i;
      });
    });
    list.addEventListener('pointermove', move);
    list.addEventListener('pointerleave', () => {
      on = false;
      gsap.to(box, { scale: 0.6, autoAlpha: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    });
    UI.previewRect = () => (on ? box.getBoundingClientRect() : null);
  }

  /* =========================================================
     TILT — project media lean toward the cursor, the image drifts inside
     ========================================================= */
  function initTilt() {
    if (!env.fine || env.reduced) return;
    U.qsa('[data-tilt]').forEach((el) => {
      const img = el.querySelector('img');
      const tag = el.querySelector('.ptag');
      gsap.set(el, { transformPerspective: 1100 });
      const q = (t, prop, d) => gsap.quickTo(t, prop, { duration: d, ease: 'power3' });
      const rx = q(el, 'rotationX', 0.9), ry = q(el, 'rotationY', 0.9);
      const ix = img && q(img, 'x', 1.1), iy = img && q(img, 'y', 1.1);
      const tx = tag && q(tag, 'x', 0.7), ty = tag && q(tag, 'y', 0.7);
      let r = null;
      el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') r = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (!r || Math.abs(APP.scrollVel || 0) > 1) r = el.getBoundingClientRect();
        const nx = U.clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
        const ny = U.clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
        rx(-ny * 7); ry(nx * 9);
        if (img) { ix(-nx * 18); iy(-ny * 14); }
        if (tag) { tx(nx * 22); ty(ny * 12); }
      });
      el.addEventListener('pointerleave', () => {
        r = null;
        rx(0); ry(0);
        if (img) { ix(0); iy(0); }
        if (tag) { tx(0); ty(0); }
      });
    });
  }

  /* =========================================================
     MAGNETIC TYPE — letters gain weight and rise as the cursor nears
     ========================================================= */
  function initMagType() {
    const el = U.qs('[data-mt]');
    if (!el) return;
    const tile = el.closest('.xp') || el.parentNode;
    const text = el.textContent.trim();
    el.textContent = '';
    const chars = [];
    for (const ch of text) {
      const c = document.createElement('span');
      c.className = 'mc';
      c.setAttribute('aria-hidden', 'true');
      c.textContent = ch;
      el.appendChild(c);
      chars.push({ el: c, w: 300, y: 0, cx: 0 });
    }
    if (env.reduced) return;
    let inView = false, hover = false, dirty = true, moved = false, t = 0;
    const m = { x: 0.5, y: 0.5, k: 0 };      // smoothed focus, tile-relative
    let tr = null, fs = 100, cy = 0;
    const measure = () => {
      tr = tile.getBoundingClientRect();
      fs = parseFloat(getComputedStyle(el).fontSize) || 100;
      cy = el.offsetTop + el.offsetHeight / 2;
      const left = el.offsetLeft;
      chars.forEach((c) => { c.cx = left + c.el.offsetLeft + c.el.offsetWidth / 2; });
    };
    new IntersectionObserver((es) => { inView = es[0].isIntersecting; if (inView) dirty = true; }, { rootMargin: '80px' }).observe(tile);
    tile.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; dirty = true; } });
    tile.addEventListener('pointerleave', () => { hover = false; });
    APP.on('resize', () => { dirty = true; });
    APP.on('scroll', () => { if (hover || P.type !== 'mouse') moved = true; });

    gsap.ticker.add((time, dms) => {
      if (!inView) return;
      const dt = Math.min(dms / 1000, 0.05);
      t += dt;
      if (dirty) { measure(); dirty = false; }
      else if (moved) tr = tile.getBoundingClientRect();
      moved = false;
      // a finger drives it while it is on the tile (even mid-scroll)
      const on = hover || (P.type !== 'mouse' && P.live() && P.x >= tr.left && P.x <= tr.right && P.y >= tr.top && P.y <= tr.bottom);
      // with no cursor a slow wave keeps the word breathing
      const tx = on ? (P.x - tr.left) / tr.width : 0.5 + Math.sin(t * 0.55) * 0.42;
      const ty = on ? (P.y - tr.top) / tr.height : 0.5;
      m.x = U.damp(m.x, tx, on ? 9 : 3, dt);
      m.y = U.damp(m.y, ty, on ? 9 : 3, dt);
      m.k = U.damp(m.k, on ? 1 : 0.55, 3, dt);
      tile.style.setProperty('--mx', (m.x * 100).toFixed(2) + '%');
      tile.style.setProperty('--my', (m.y * 100).toFixed(2) + '%');
      const px = m.x * tr.width, py = m.y * tr.height;
      const R = Math.max(fs * 2.1, tr.width * 0.16);
      const vy = U.clamp((py - cy) / (tr.height * 0.5), -1, 1);
      for (const c of chars) {
        const d = Math.abs(px - c.cx);
        const f = Math.exp(-(d * d) / (R * R)) * m.k;
        const w = 300 + f * 560;
        const y = f * vy * fs * 0.1;
        if (Math.abs(w - c.w) > 0.5 || Math.abs(y - c.y) > 0.05) {
          c.w = w; c.y = y;
          c.el.style.fontWeight = Math.round(w);
          c.el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0) scaleY(' + (1 + f * 0.06).toFixed(4) + ')';
        }
      }
    });
  }

  /* =========================================================
     CONTACT
     ========================================================= */
  function initContact() {
    // live clock
    const clock = U.qs('[data-clock]');
    if (clock) {
      const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      const tick = () => { clock.textContent = fmt.format(new Date()); };
      tick();
      setInterval(tick, 15000);
    }

    // copy the Telegram handle
    const copy = U.qs('button[data-copy]');
    if (copy) {
      const chip = copy.querySelector('[data-copy-label]');
      const idle = chip.textContent;
      let timer;
      copy.addEventListener('click', async (e) => {
        e.preventDefault();
        const text = copy.dataset.copy;
        let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; } catch (err) {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta); ta.select();
          try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
          ta.remove();
        }
        if (!ok) return;
        copy.classList.add('is-copied');
        chip.textContent = 'Скопировано — ' + text;
        clearTimeout(timer);
        timer = setTimeout(() => { copy.classList.remove('is-copied'); chip.textContent = idle; }, 2000);
      });
    }

    // back to top
    const top = U.qs('.totop');
    top && top.addEventListener('click', () => UI.scrollTo('top', { duration: 2.4 }));

    const handle = U.qs('[data-handle]');
    if (handle) initHandle(handle);

    // letters lean away from the cursor
    const title = U.qs('.contact__title');
    if (title && env.fine && !env.reduced) {
      const chars = U.qsa('.sc', title);
      const setters = chars.map((ch) => ({ el: ch, y: gsap.quickTo(ch, 'y', { duration: 0.7, ease: 'power3' }), r: gsap.quickTo(ch, 'rotation', { duration: 0.9, ease: 'power3' }), c: null }));
      let active = false;
      const measure = () => setters.forEach((s) => {
        const r = s.el.getBoundingClientRect();
        s.c = { x: r.left + r.width / 2 - (gsap.getProperty(s.el, 'x') || 0), y: r.top + r.height / 2 - (gsap.getProperty(s.el, 'y') || 0), h: r.height };
      });
      const section = U.qs('.contact');
      section.addEventListener('pointerenter', () => { measure(); active = true; });
      section.addEventListener('pointermove', (e) => {
        if (!active) return;
        // once the title starts turning into dust it belongs to the finale
        if ((APP.finaleQ || 0) > 0.06) { setters.forEach((s) => { s.y(0); s.r(0); }); return; }
        const R = Math.max(160, window.innerWidth * 0.14);
        for (const s of setters) {
          const dx = e.clientX - s.c.x, dy = e.clientY - s.c.y;
          const d = Math.hypot(dx, dy);
          const f = d < R ? Math.pow(1 - d / R, 2) : 0;
          s.y(-f * s.c.h * 0.16);
          s.r(f * U.clamp(-dx / R, -1, 1) * 8);
        }
      });
      section.addEventListener('pointerleave', () => { active = false; setters.forEach((s) => { s.y(0); s.r(0); }); });
      APP.on('scroll', () => { if (active) measure(); });
    }
  }

  /* =========================================================
     HANDLE — the letters ride a soft spring wave that follows the pointer,
     a ripple runs out from wherever it is touched, and a sheen of light
     crosses the word. Transforms only: nothing reflows, nothing jumps.
     ========================================================= */
  function initHandle(el) {
    const letters = U.qsa('.hc', el).map((node) => ({ el: node, cx: 0, y: 0, vy: 0, r: 0, vr: 0, s: 1, vs: 0, key: '' }));
    if (!letters.length) return;
    let hw = 1, fs = 100, visible = false, hovering = false, shown = false, moving = false;
    let clock = 0, nextSweep = 0;
    const m = { x: 0, k: 0 };              // pointer along the word (px) and how present it is
    const sheen = { x: -40, tween: null };  // % of the word's width
    const kicks = [];

    const measure = () => {
      hw = el.offsetWidth || 1;
      fs = parseFloat(getComputedStyle(el).fontSize) || 100;
      el.style.setProperty('--hw', hw + 'px');
      letters.forEach((l) => {
        l.cx = l.el.offsetLeft + l.el.offsetWidth / 2;
        l.el.style.setProperty('--o', l.el.offsetLeft + 'px');
      });
    };
    const setSheen = (v) => { sheen.x = v; el.style.setProperty('--sx', v.toFixed(2) + '%'); };
    measure();
    setSheen(-40);
    APP.on('resize', measure);
    if (document.fonts) document.fonts.ready.then(measure);
    if (env.reduced) return;

    const sweep = (from, to, dur) => {
      if (sheen.tween) sheen.tween.kill();
      sheen.tween = gsap.fromTo(sheen, { x: from }, {
        x: to, duration: dur, ease: 'power2.inOut',
        onUpdate: () => setSheen(sheen.x), onComplete: () => { sheen.tween = null; }
      });
    };
    // an impulse travels outward from x, reaching far letters a little later
    const ripple = (x, power) => {
      letters.forEach((l) => {
        const d = Math.abs(l.cx - x);
        kicks.push({ l, at: clock + d / (hw * 1.8), v: power * (1 - 0.35 * d / hw), dir: l.cx >= x ? 1 : -1 });
      });
    };
    const localX = (cx) => cx - el.getBoundingClientRect().left;

    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovering = true;
      m.x = localX(e.clientX);
      if (sheen.tween) { sheen.tween.kill(); sheen.tween = null; }
      ripple(m.x, 1);
    });
    el.addEventListener('pointerleave', (e) => {
      if (!hovering) return;
      hovering = false;
      // the light slides off the side the pointer left from
      sweep(sheen.x, localX(e.clientX) > hw / 2 ? 140 : -40, 0.9);
      nextSweep = clock + 6;
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const x = localX(e.clientX), px = (x / hw) * 100;
      ripple(x, 1.3);
      sweep(px - 70, px + 90, 1.1);
      nextSweep = clock + 6;
    });
    el.addEventListener('focus', () => { if (!hovering) { ripple(0, 1); sweep(-40, 140, 1.4); } });
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) measure(); }).observe(el);

    const K = 170, C = 11.5;   // spring: ~0.48 s period, a soft single overshoot
    gsap.ticker.add((time, dms) => {
      if (!visible) return;
      const dt = Math.min(dms / 1000, 1 / 30);
      clock += dt;

      // the word has just been assembled from the dust — let light pass over it, then now and then
      const op = el.style.opacity === '' ? 1 : parseFloat(el.style.opacity);
      if (!shown && op > 0.98) { shown = true; nextSweep = clock + 0.2; }
      else if (shown && op < 0.02) shown = false;
      if (shown && !hovering && !sheen.tween && clock >= nextSweep) { sweep(-40, 140, 1.9); nextSweep = clock + 7; }

      if (hovering) {
        m.x = U.damp(m.x, localX(P.x), 10, dt);
        setSheen(U.damp(sheen.x, (m.x / hw) * 100, 7, dt));
      }
      m.k = U.damp(m.k, hovering ? 1 : 0, hovering ? 6 : 4, dt);
      if (!hovering && m.k < 0.001) m.k = 0;
      if (!moving && !kicks.length && !m.k) return;

      for (let i = kicks.length - 1; i >= 0; i--) {
        const k = kicks[i];
        if (clock < k.at) continue;
        k.l.vy -= fs * 1.2 * k.v;
        k.l.vr += k.dir * 52 * k.v;
        k.l.vs += 0.5 * k.v;
        kicks.splice(i, 1);
      }
      const R = Math.max(fs * 0.95, hw * 0.13);
      const steps = Math.ceil(dt * 120), h = dt / steps;
      moving = false;
      for (const l of letters) {
        const dx = l.cx - m.x;
        const f = m.k ? Math.exp(-(dx * dx) / (R * R)) * m.k : 0;
        const ty = -f * fs * 0.1, tr = U.clamp(dx / R, -1, 1) * f * 6, ts = 1 + f * 0.045;
        for (let s = 0; s < steps; s++) {
          l.vy += ((ty - l.y) * K - l.vy * C) * h; l.y += l.vy * h;
          l.vr += ((tr - l.r) * K - l.vr * C) * h; l.r += l.vr * h;
          l.vs += ((ts - l.s) * K - l.vs * C) * h; l.s += l.vs * h;
        }
        const rest = !f && Math.abs(l.y) < 0.05 && Math.abs(l.vy) < 0.6 && Math.abs(l.r) < 0.02 && Math.abs(l.vr) < 0.3 && Math.abs(l.s - 1) < 0.0004 && Math.abs(l.vs) < 0.006;
        if (!rest) moving = true;
        else { l.y = l.vy = l.r = l.vr = l.vs = 0; l.s = 1; }
        const key = rest ? '' : 'translate3d(0,' + l.y.toFixed(2) + 'px,0) rotate(' + l.r.toFixed(2) + 'deg) scale(' + l.s.toFixed(4) + ')';
        if (key !== l.key) { l.key = key; l.el.style.transform = key; }
      }
    });
  }
})();
