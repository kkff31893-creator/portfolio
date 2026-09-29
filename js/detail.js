/* detail — a project opens by expanding its preview to fill the screen */
(function () {
  'use strict';
  const APP = window.APP;
  const U = APP.u, env = APP.env;
  const html = document.documentElement;
  const D = (APP.detail = { open: false, id: null });

  let root, backdrop, scroller, heroImg, heroText, heroShade, cue, idx, title, kind, lead, meta, gallery, next, nextTitle, nextImg, closeBtn;
  let ghost, ghostImg, ghostTop;
  let source = null, busy = false, io = null, lastFocus = null;
  const EASE = 'expo.inOut';

  D.init = function () {
    root = U.qs('.detail');
    backdrop = U.qs('.detail__backdrop', root);
    scroller = U.qs('.detail__scroller', root);
    heroImg = U.qs('.detail__hero-media img', root);
    heroShade = U.qs('.detail__hero-shade', root);
    heroText = U.qs('.detail__hero-text', root);
    cue = U.qs('.detail__cue', root);
    idx = U.qs('.detail__index', root);
    title = U.qs('.detail__title', root);
    kind = U.qs('.detail__kind', root);
    lead = U.qs('.detail__lead', root);
    meta = U.qs('.detail__meta', root);
    gallery = U.qs('.detail__gallery', root);
    next = U.qs('.detail__next', root);
    nextTitle = U.qs('.detail__next-title', root);
    nextImg = U.qs('.detail__next-media img', root);
    closeBtn = U.qs('.detail__close', root);
    ghost = U.qs('.ghost');
    ghostImg = U.qs('img', ghost);
    ghostTop = document.createElement('img');
    ghostTop.alt = '';
    ghost.appendChild(ghostTop);

    // every element that can open a project
    U.qsa('[data-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        D.show(el.dataset.open, el);
      });
      if (!el.matches('button, a') && !el.hasAttribute('role')) {
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.setAttribute('aria-label', 'Открыть проект ' + APP.projects[el.dataset.open].title);
      }
      if (el.getAttribute('role') === 'button') el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); D.show(el.dataset.open, el); }
      });
    });
    U.qsa('a[data-goto]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      D.show(a.dataset.goto, a);
    }));

    closeBtn.addEventListener('click', () => D.close());
    next.addEventListener('click', () => { if (!busy) swapTo(next.dataset.next, true); });
    document.addEventListener('keydown', (e) => {
      if (!D.open) return;
      if (e.key === 'Escape') D.close();
      if (e.key === 'Tab') trapFocus(e);
    });
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('popstate', () => {
      const m = location.hash.match(/^#project\/(\w+)/);
      if (m && APP.projects[m[1]]) { if (!D.open || D.id !== m[1]) D.show(m[1], null, true); }
      else if (D.open) D.close(true);
    });
  };

  /* ---------- content ---------- */
  function fill(id) {
    const p = APP.projects[id];
    D.id = id;
    root.dataset.theme = p.theme;
    heroImg.src = APP.shots[p.hero] || '';
    heroImg.alt = p.title;
    idx.textContent = p.index + ' — ' + (p.meta.find((m) => m[0] === 'Тип') || ['', ''])[1];
    title.textContent = p.title;
    kind.textContent = p.kind;
    lead.textContent = p.lead;
    meta.innerHTML = '';
    p.meta.forEach(([k, v]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      d.append(dt, dd);
      meta.appendChild(d);
    });
    gallery.innerHTML = '';
    p.gallery.forEach(([shot, size]) => {
      const f = document.createElement('figure');
      f.className = 'is-' + size;
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = APP.shots[shot] || '';
      f.appendChild(img);
      gallery.appendChild(f);
    });
    const order = APP.projects.order;
    const nid = order[(order.indexOf(id) + 1) % order.length];
    const np = APP.projects[nid];
    next.dataset.next = nid;
    nextTitle.textContent = np.title;
    nextImg.src = APP.shots[np.hero] || '';
    root.setAttribute('aria-label', p.title);
    scroller.scrollTop = 0;
    heroImg.style.transform = '';
    heroText.style.opacity = '';
    cue.style.opacity = '';
    observe();
  }

  function observe() {
    if (io) io.disconnect();
    const items = U.qsa('figure, .detail__lead, .detail__meta div', root);
    items.forEach((el) => el.classList.remove('is-in'));
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { root: scroller, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  }

  function onScroll() {
    const p = U.clamp(scroller.scrollTop / window.innerHeight, 0, 1);
    if (!env.reduced) heroImg.style.transform = 'scale(' + (1 + p * 0.12).toFixed(4) + ') translate3d(0,' + (p * 6).toFixed(2) + '%,0)';
    heroText.style.opacity = String(1 - U.smooth(0.05, 0.5, p));
    cue.style.opacity = String(0.75 * (1 - U.smooth(0, 0.15, p)));
  }

  /* ---------- geometry of whatever the project is opened from ----------
     r = the visible window (x, y, w, h, radius); r.i = the image's real box inside it,
     so crops, parallax and hover zoom carry into the ghost without a jump */
  function withImg(r, img) {
    r.img = img;
    if (img) {
      const b = img.getBoundingClientRect();
      if (b.width > 0) r.i = { x: b.left - r.x, y: b.top - r.y, w: b.width, h: b.height };
    }
    return r;
  }

  function sourceRect(el) {
    if (!el) return null;
    const H = window.innerHeight;
    if (el.matches('a[data-goto]')) {
      const b = APP.ui && APP.ui.previewRect ? APP.ui.previewRect() : null;
      return b ? withImg({ x: b.left, y: b.top, w: b.width, h: b.height, r: 14 }, U.qsa('.preview__item img')[+el.dataset.preview]) : null;
    }
    if (el.matches('.pfull__frame')) {
      const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const k = APP.lumenK ? APP.lumenK() : 0;
      const iy = (parseFloat(cs.getPropertyValue('--cy')) / 100) * b.height * (1 - k);
      const ix = (parseFloat(cs.getPropertyValue('--cx')) / 100) * b.width * (1 - k);
      const r = { x: b.left + ix, y: b.top + iy, w: b.width - ix * 2, h: b.height - iy * 2, r: (parseFloat(cs.getPropertyValue('--cr')) || 0) * (1 - k) };
      if (r.y + r.h < 0 || r.y > H) return null;
      return withImg(r, el.querySelector('img'));
    }
    const media = el.querySelector('.phz__media, .still__media');
    if (media) {
      const b = media.getBoundingClientRect();
      if (b.bottom < 0 || b.top > H) return null;
      return withImg({ x: b.left, y: b.top, w: b.width, h: b.height, r: parseFloat(getComputedStyle(media).borderTopLeftRadius) || 0 }, media.querySelector('img'));
    }
    return null;
  }

  function centered() {
    const W = window.innerWidth, H = window.innerHeight;
    const w = Math.min(W * 0.34, 520), h = w * 1.22;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h, r: 20, i: { x: -w * 0.06, y: -h * 0.06, w: w * 1.12, h: h * 1.12 } };
  }

  // two layers: the image you clicked, and the project hero cross-fading over it
  function placeGhost(r, src, top) {
    ghostImg.src = src;
    ghostTop.src = top || src;
    const i = r.i || { x: 0, y: 0, w: r.w, h: r.h };
    gsap.set(ghost, { x: r.x, y: r.y, width: r.w, height: r.h, borderRadius: r.r, autoAlpha: 1 });
    gsap.set([ghostImg, ghostTop], { x: i.x, y: i.y, width: i.w, height: i.h, scale: 1 });
  }
  const layers = () => [ghostImg, ghostTop];
  const refocus = () => { closeBtn.focus({ preventScroll: true }); if (APP.ui && APP.ui.cursorRefresh) APP.ui.cursorRefresh(); };
  const textIn = () => ({ yPercent: 0, autoAlpha: 1, duration: 1.1, stagger: 0.07, ease: 'expo.out' });

  /* ---------- open ---------- */
  D.show = function (id, el, fromHistory) {
    if (busy || !APP.projects[id]) return;
    if (D.open) { if (D.id !== id) swapTo(id); return; }
    busy = true;
    lastFocus = el || document.activeElement;
    source = el;
    const W = window.innerWidth, H = window.innerHeight;
    const p = APP.projects[id];
    const r = sourceRect(el) || centered();   // measure before anything moves
    fill(id);
    if (!fromHistory) try { history.pushState({ project: id }, '', '#project/' + id); } catch (e) { /* file:// may refuse */ }

    if (APP.lenis) APP.lenis.stop();
    html.classList.add('detail-open');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    D.open = true;
    APP.emit('detail', true);

    const tl = gsap.timeline({ onComplete: () => { busy = false; refocus(); } });
    if (env.reduced) {
      gsap.set([backdrop, scroller, heroShade], { opacity: 1 });
      gsap.set(heroText.children, { clearProps: 'all' });
      tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.3 }).set(closeBtn, { opacity: 1 });
      if (APP.stage) APP.stage.pause();
      return;
    }
    const fromImg = (r.img && r.img.currentSrc) || APP.shots[p.hero];
    const heroSrc = APP.shots[p.hero];
    const T = 1.15;
    gsap.set(root, { opacity: 1 });
    gsap.set([backdrop, scroller, closeBtn], { opacity: 0 });
    gsap.set(heroText.children, { yPercent: 40, autoAlpha: 0 });
    placeGhost(r, fromImg, heroSrc);
    // the ghost lands pixel-for-pixel on the project hero, then hands over to it
    tl.to(ghost, { x: 0, y: 0, width: W, height: H, borderRadius: 0, duration: T, ease: EASE }, 0)
      .to(layers(), { x: 0, y: 0, width: W, height: H, duration: T, ease: EASE }, 0)
      .fromTo(ghostTop, { opacity: 0 }, { opacity: fromImg === heroSrc ? 0 : 1, duration: 0.6, ease: 'power1.inOut' }, 0.4)
      .set([backdrop, scroller], { opacity: 1 }, T)
      .set(ghost, { autoAlpha: 0 }, T)
      .fromTo(heroShade, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out', immediateRender: false }, T)
      .to(heroText.children, textIn(), T)
      .fromTo(closeBtn, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', immediateRender: false }, T)
      .call(() => { if (APP.stage) APP.stage.pause(); }, null, T + 0.05);
  };

  /* ---------- next project: its preview grows into the new hero ---------- */
  function swapTo(id, fromNext) {
    if (busy) return;
    busy = true;
    const W = window.innerWidth, H = window.innerHeight;
    try { history.replaceState({ project: id }, '', '#project/' + id); } catch (e) { /* */ }
    source = null;
    const b = U.qs('.detail__next-media', root).getBoundingClientRect();
    const done = () => { busy = false; refocus(); };
    if (!fromNext || env.reduced || b.top >= H || b.bottom <= 0) {
      gsap.to(scroller, {
        opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: () => {
          fill(id);
          gsap.to(scroller, { opacity: 1, duration: 0.6, ease: 'power2.out', onComplete: done });
        }
      });
      return;
    }
    placeGhost(withImg({ x: b.left, y: b.top, w: b.width, h: b.height, r: 0 }, nextImg), APP.shots[APP.projects[id].hero]);
    gsap.set(ghostTop, { opacity: 0 });
    gsap.timeline({ onComplete: done })
      .to(ghost, { x: 0, y: 0, width: W, height: H, duration: 1.1, ease: EASE }, 0)
      .to(layers(), { x: 0, y: 0, width: W, height: H, duration: 1.1, ease: EASE }, 0)
      .call(() => { fill(id); gsap.set(heroText.children, { yPercent: 40, autoAlpha: 0 }); gsap.set(heroShade, { opacity: 0 }); }, null, 1.1)
      .set(ghost, { autoAlpha: 0 }, 1.12)
      .to(heroShade, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 1.12)
      .to(heroText.children, textIn(), 1.12);
  }

  /* ---------- close ---------- */
  D.close = function (fromHistory) {
    if (!D.open || busy) return;
    // let the history entry we pushed drive the close, so Back and Close agree
    if (!fromHistory && history.state && history.state.project) { history.back(); return; }
    if (!fromHistory) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    busy = true;
    const W = window.innerWidth, H = window.innerHeight;
    if (APP.stage) APP.stage.resume();
    const finish = () => {
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      html.classList.remove('detail-open');
      gsap.set(ghost, { autoAlpha: 0 });
      gsap.set([backdrop, scroller, closeBtn], { opacity: 0 });
      if (io) io.disconnect();
      D.open = false;
      busy = false;
      if (APP.lenis) APP.lenis.start();
      APP.emit('detail', false);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      if (APP.ui && APP.ui.cursorRefresh) APP.ui.cursorRefresh();
    };
    const atTop = scroller.scrollTop < H * 0.4;
    const r = atTop && !env.reduced && source && (source.dataset.open || source.dataset.goto) === D.id ? sourceRect(source) : null;
    if (!r) {
      gsap.timeline({ onComplete: finish })
        .to([scroller, closeBtn], { opacity: 0, y: env.reduced ? 0 : 30, duration: 0.45, ease: 'power2.in' }, 0)
        .to(backdrop, { opacity: 0, duration: 0.55, ease: 'power2.inOut' }, 0.15)
        .set([scroller, closeBtn], { y: 0 });
      return;
    }
    const heroSrc = heroImg.currentSrc || heroImg.src;
    const i = r.i || { x: 0, y: 0, w: r.w, h: r.h };
    placeGhost({ x: 0, y: 0, w: W, h: H, r: 0 }, (r.img && r.img.currentSrc) || heroSrc, heroSrc);
    gsap.set(layers(), { scale: 1 + U.clamp(scroller.scrollTop / H, 0, 1) * 0.12 });
    gsap.set(ghostTop, { opacity: 1 });
    gsap.set([scroller, closeBtn, backdrop], { opacity: 0 });
    gsap.timeline({ onComplete: finish })
      .to(ghost, { x: r.x, y: r.y, width: r.w, height: r.h, borderRadius: r.r, duration: 1, ease: EASE }, 0)
      .to(layers(), { x: i.x, y: i.y, width: i.w, height: i.h, scale: 1, duration: 1, ease: EASE }, 0)
      .to(ghostTop, { opacity: 0, duration: 0.55, ease: 'power1.inOut' }, 0.1);
  };

  function trapFocus(e) {
    const f = U.qsa('button, a[href], [tabindex]:not([tabindex="-1"])', root).filter((el) => el.offsetParent !== null || el === closeBtn);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
})();
