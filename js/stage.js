/* stage — the single WebGL renderer: page background, hero glass + refracted headline, Orbit showcase, finale particles, render loop */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP.env.webgl) return;
  const U = APP.u, M = APP.mat, env = APP.env, vp = APP.vp, P = APP.pointer;

  const S = (APP.stage = {
    paused: false,
    ready: false,
    // scroll-driven targets written by scenes.js (viewport fractions)
    kf: { x: 0, y: 0, s: 1, spin: 0, amp: 0 },
    footer: { p: 0, q: 0 },   // p: the footer arriving, q: progress through the pinned finale
    heroFx: { dis: 0 },       // the headline breaking apart as the camera leans in
    orbit: { p: 0, e: 0 },
    intro: { blob: 0, lines: [0, 0, 0] },
    blobHover: false
  });

  const FOV = 30;
  let renderer, scene, camera, W = 0, H = 0, D = 1;
  let dpr = 1, dprMax = 1.75, dprMin = 1;
  let envLight, envDark;
  let heroTitle, heroLines, textCanvas, textCtx, textTex, textMesh, textKey = '', textDirty = true;
  let blob, blobMat;
  let orbit, orbitEl, callouts = [];
  let textU;
  let fin = null;
  const finC = { x: 0, y: 0 };   // ring centre, viewport fractions (y up)
  const cur = { x: 0, y: 0, s: 1, spin: 0, amp: 0, footer: 0, metal: 0 };
  const rot = { x: 0, y: 0, idle: 0 };
  const orb = { rotY: 0, vel: 0, tiltT: 0, tilt: 0, dragging: false, lastX: 0, lastY: 0 };
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  let elapsed = 0;
  let idle = 0, idleBg = -1;             // frames in a row with nothing but the backdrop on screen

  /* ---------- init ---------- */
  S.init = function () {
    const canvas = document.querySelector('canvas.stage');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.autoClear = false;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    // the glass refracts a lower-res copy of the scene on phones — invisible through the distortion, much cheaper
    if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = env.mobile || env.low ? 0.5 : 1;
    S.renderer = renderer;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); S.lost = true; }, false);
    canvas.addEventListener('webglcontextrestored', restore, false);

    dprMax = env.mobile ? 1.5 : 1.75;
    dpr = Math.min(vp.dpr, dprMax);
    dprMin = Math.min(1, dpr);
    renderer.setPixelRatio(dpr);
    W = vp.w; H = vp.lvh;
    renderer.setSize(W, H, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#f5f5f7');
    camera = new THREE.PerspectiveCamera(FOV, W / H, 10, 10000);
    S.scene = scene;
    S.camera = camera;

    envLight = M.makeEnv(renderer, 'light');
    envDark = M.makeEnv(renderer, 'dark');
    scene.environment = envLight;

    buildHero();
    buildOrbit();
    buildFinale();
    layout();
  };

  S.setBgRGB = function (r, g, b) {
    if (scene) scene.background.setRGB(r, g, b, THREE.SRGBColorSpace);
  };

  /* ---------- hero: headline plane + liquid glass ---------- */
  function buildHero() {
    heroTitle = document.querySelector('[data-hero-title]');
    heroLines = Array.from(heroTitle.children);
    textCanvas = document.createElement('canvas');
    textCtx = textCanvas.getContext('2d');
    textTex = new THREE.CanvasTexture(textCanvas);
    textTex.colorSpace = THREE.SRGBColorSpace;
    textTex.generateMipmaps = false;
    textTex.minFilter = THREE.LinearFilter;
    const textMat = new THREE.MeshBasicMaterial({ map: textTex, toneMapped: false });
    textU = { uDis: { value: 0 }, uAsp: { value: 1 }, uBg: { value: new THREE.Color('#f5f5f7') } };
    textMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, textU);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + DISSOLVE_HEAD)
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + DISSOLVE_BODY);
    };
    textMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), textMat);
    textMesh.renderOrder = -1;
    scene.add(textMesh);

    const detail = env.mobile ? 28 : env.low ? 40 : 56;
    blobMat = M.blob({
      color: 0xffffff, metalness: 0, roughness: 0.05,
      transmission: 1, thickness: 1.6, ior: 1.42, dispersion: 4.5,
      iridescence: 0.55, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 520],
      clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.25,
      attenuationColor: new THREE.Color('#e7ecff'), attenuationDistance: 2.6
    }, { amp: 0.17, freq: 1.1, speed: 0.22 });
    blob = new THREE.Mesh(M.blobGeometry(detail), blobMat);
    blob.frustumCulled = false;
    scene.add(blob);

    // press the glass to send a ripple through it
    APP.on('down', (e) => {
      if (!blob.visible || S.paused || !S.ready) return;
      if (e.target && e.target.closest && e.target.closest('a,button,[data-xp],[data-open],.porb__pin')) return;
      if (hoverDist() < 1.08) pulse();
    });
  }

  // letters break into grain along a sweep: top line first, left to right
  const DISSOLVE_HEAD = `
    uniform float uDis;
    uniform float uAsp;
    uniform vec3 uBg;
    float dzH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float dzN(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(dzH(i), dzH(i + vec2(1.0, 0.0)), f.x), mix(dzH(i + vec2(0.0, 1.0)), dzH(i + vec2(1.0, 1.0)), f.x), f.y);
    }`;
  const DISSOLVE_BODY = `
    if (uDis > 0.0) {
      vec2 dq = vMapUv * vec2(uAsp, 1.0);
      float dn = dzN(dq * 3.1) * 0.58 + dzN(dq * 8.7 + 7.1) * 0.24 + dzH(floor(dq * 190.0)) * 0.18;
      float dg = mix(dn, vMapUv.x * 0.62 + (1.0 - vMapUv.y) * 0.38, 0.46);
      float th = uDis * 1.12 - 0.06;
      diffuseColor.rgb = mix(uBg, diffuseColor.rgb, smoothstep(th - 0.03, th + 0.03, dg));
    }`;

  function pulse() {
    const u = blobMat.userData.u;
    u.uPulse.value = 1;
    u.uPulseT.value = 0;
    u.uPulseDir.value.copy(u.uMouseDir.value);
  }

  const fontReady = () => {
    const fam = getComputedStyle(heroTitle).fontFamily;
    return document.fonts && document.fonts.load ? document.fonts.load('600 100px ' + fam).catch(() => {}) : Promise.resolve();
  };
  S.fontReady = fontReady;

  function drawText() {
    const lw = heroTitle.offsetWidth, lh = heroTitle.offsetHeight;
    if (!lw || !lh) return;
    const s = Math.min(dpr * 1.1, 2, 4096 / lw, 4096 / lh);
    const cw = Math.round(lw * s), ch = Math.round(lh * s);
    if (textCanvas.width !== cw || textCanvas.height !== ch) {
      textCanvas.width = cw; textCanvas.height = ch;
      textTex.dispose();
    }
    const ctx = textCtx;
    const cs = getComputedStyle(heroTitle);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(0, 0, lw, lh);
    ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const ls = parseFloat(cs.letterSpacing) || 0;
    const native = 'letterSpacing' in ctx;
    if (native) ctx.letterSpacing = ls + 'px';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1d1d1f';
    const m = ctx.measureText('Hg');
    const A = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.93;
    const Dd = m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.24;
    heroLines.forEach((span, i) => {
      const L = span.offsetHeight, top = span.offsetTop, left = span.offsetLeft;
      const base = top + (L - (A + Dd)) / 2 + A;
      const p = S.intro.lines[i];
      if (p <= 0) return;
      const off = (1 - p) * L * 1.25;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-L, top - L * 0.04, lw + 2 * L, L * 1.24);
      ctx.clip();
      const text = span.textContent;
      if (native) ctx.fillText(text, left, base + off);
      else {
        let x = left;
        for (const c of text) { ctx.fillText(c, x, base + off); x += ctx.measureText(c).width + ls; }
      }
      ctx.restore();
    });
    textTex.needsUpdate = true;
  }
  S.redrawText = () => { textDirty = true; };

  function syncText() {
    const r = heroTitle.getBoundingClientRect();
    const vis = r.bottom > 0 && r.top < H && S.intro.lines[0] > 0 && S.heroFx.dis < 0.999;
    textMesh.visible = vis;
    if (!vis) return;
    const key = heroTitle.offsetWidth + 'x' + heroTitle.offsetHeight + ':' + S.intro.lines.map((v) => v.toFixed(4)).join(',');
    if (textDirty || key !== textKey) {
      textKey = key;
      textDirty = false;
      drawText();
    }
    textU.uDis.value = S.heroFx.dis;
    textU.uAsp.value = r.width / Math.max(r.height, 1);
    textMesh.scale.set(r.width, r.height, 1);
    textMesh.position.set(r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2), 0);
  }

  function blobBase() {
    return env.mobile ? Math.min(W * 0.36, H * 0.21) : Math.min(W * 0.205, H * 0.3);
  }
  let blobScreen = { x: 0, y: 0, r: 1 };
  function hoverDist() {
    return Math.hypot(P.x - blobScreen.x, P.y - blobScreen.y) / (blobScreen.r || 1);
  }

  function updateBlob(dt, t) {
    const k = S.kf, f = S.footer.p;
    const lam = env.reduced ? 20 : 5.5;
    cur.x = U.damp(cur.x, k.x, lam, dt);
    cur.y = U.damp(cur.y, k.y, lam, dt);
    cur.s = U.damp(cur.s, k.s, lam, dt);
    cur.spin = U.damp(cur.spin, k.spin, lam, dt);
    cur.amp = U.damp(cur.amp, k.amp, 4, dt);
    cur.footer = U.damp(cur.footer, f, lam, dt);

    let fx, fy, fs, collapse = 0;
    if (cur.footer > 0.001) {
      const e = cur.footer, q = S.footer.q;
      const g = U.smooth(0.05, 0.44, q);
      collapse = U.smooth(0.36, 0.58, q);
      fx = U.lerp(env.mobile ? 0.2 : 0.31, finC.x, g);
      fy = U.lerp(U.lerp(-0.95, env.mobile ? -0.24 : 0.02, e), finC.y, g);
      fs = (env.mobile ? 0.62 : 0.84) * U.lerp(1, 0.56, g) * (1 - collapse * collapse);
    } else {
      fx = cur.x; fy = cur.y; fs = cur.s;
    }
    const base = blobBase();
    const intro = S.intro.blob;
    const R0 = base * fs * (0.001 + intro);
    const z = base * 1.3;
    const kd = (D - z) / D;
    const bob = env.reduced ? 0 : Math.sin(t * 0.8) * H * 0.006;
    const px = fx * W + P.sx * W * 0.014;
    const py = fy * H + P.sy * H * 0.012 + bob;
    blob.position.set(px * kd, py * kd, z);
    blob.scale.setScalar(R0 * kd);
    blobMat.attenuationDistance = 2.6 * Math.max(R0 * kd, 1e-3);
    blobScreen = { x: W / 2 + px, y: H / 2 - py, r: R0 };
    blob.visible = intro > 0 && R0 > 0.5 && Math.abs(py) < H / 2 + R0 * 1.4 && Math.abs(px) < W / 2 + R0 * 1.4;
    if (!blob.visible) return;

    // rotation: idle spin + scroll spin + pointer lean
    rot.idle += dt * (env.reduced ? 0.03 : 0.11 + Math.min(Math.abs(APP.scrollVel || 0) * 0.0006, 0.6));
    rot.x = U.damp(rot.x, -P.sy * 0.32, 3, dt);
    rot.y = U.damp(rot.y, P.sx * 0.5, 3, dt);
    blob.rotation.set(rot.x + 0.2, rot.idle + rot.y + cur.spin, 0);

    const u = blobMat.userData.u;
    u.uTime.value = t;
    u.uAmp.value = 0.165 + cur.amp + Math.min(Math.abs(APP.scrollVel || 0) * 0.00005, 0.05) + Math.sin(collapse * Math.PI) * 0.14;
    // cursor attraction: bulge toward the pointer, stronger when close
    const dist = hoverDist();
    const near = P.live() ? U.smooth(2.6, 0.55, dist) : 0;
    S.blobHover = dist < 1 && P.live() && !S.paused;
    u.uMouseAmt.value = U.damp(u.uMouseAmt.value, env.reduced ? 0 : 0.035 + near * 0.13, 4, dt);
    tmpV.set(P.x - blobScreen.x, blobScreen.y - P.y, R0 * 0.85).normalize();
    tmpQ.copy(blob.quaternion).invert();
    tmpV.applyQuaternion(tmpQ);
    u.uMouseDir.value.lerp(tmpV, 1 - Math.exp(-8 * dt)).normalize();
    u.uPulseT.value += dt;
    u.uPulse.value *= Math.exp(-1.1 * dt);

    // footer: glass turns into liquid chrome on black
    cur.metal = U.damp(cur.metal, cur.footer > 0.001 ? 1 : 0, 3, dt);
    blobMat.metalness = cur.metal;
    blobMat.roughness = 0.05 + cur.metal * 0.03;
    blobMat.iridescence = 0.55 * (1 - cur.metal);
  }

  /* ---------- Orbit — 3D product showcase ---------- */
  function buildOrbit() {
    orbitEl = document.querySelector('.porb__pin');
    callouts = Array.from(document.querySelectorAll('[data-callout]'));
    orbit = M.buildOrbit({ coreDetail: env.mobile ? 20 : 32, detail: env.mobile ? 0.7 : 1 });
    orbit.root.visible = false;
    scene.add(orbit.root);
    S.orbitModel = orbit;

    orbitEl.addEventListener('pointerdown', (e) => {
      orb.dragging = true;
      orb.lastX = e.clientX; orb.lastY = e.clientY;
      APP.emit('drag', true);
    });
    window.addEventListener('pointermove', (e) => {
      if (!orb.dragging) return;
      const dx = e.clientX - orb.lastX, dy = e.clientY - orb.lastY;
      orb.lastX = e.clientX; orb.lastY = e.clientY;
      orb.vel = U.lerp(orb.vel, dx * 0.006, 0.6);
      orb.rotY += dx * 0.006;
      orb.tiltT = U.clamp(orb.tiltT + dy * 0.003, -0.35, 0.35);
    }, { passive: true });
    const end = () => { if (orb.dragging) { orb.dragging = false; APP.emit('drag', false); } };
    window.addEventListener('pointerup', end, { passive: true });
    window.addEventListener('pointercancel', end, { passive: true });
  }

  function updateOrbit(dt, t) {
    const r = orbitEl.getBoundingClientRect();
    const vis = r.bottom > -H * 0.1 && r.top < H * 1.1;
    orbit.root.visible = vis;
    if (!vis) return false;
    const p = S.orbit.p;
    const e = U.smooth(0.16, 0.42, p) * (1 - U.smooth(0.72, 0.9, p));
    const eased = e * e * (3 - 2 * e);
    S.orbit.e = eased;
    orbit.pose(eased, t);

    const enter = U.smooth(-0.35, 0.1, p + (r.top > 0 ? -r.top / H * 0.4 : 0));
    const unit = (env.mobile ? Math.min(W * 0.27, H * 0.17) : Math.min(H * 0.215, W * 0.15)) * U.lerp(1, 0.74, eased) * U.lerp(0.86, 1, enter);
    const mid = (orbit.extents.top + orbit.extents.bottom) / 2;
    const cx = r.left + r.width / 2 - W / 2;
    const cy = H / 2 - (r.top + r.height * (env.mobile ? 0.42 : 0.45));
    orbit.root.position.set(cx, cy - mid * unit, 0);
    orbit.root.scale.setScalar(unit);
    orbit.setUnit(unit);

    if (!orb.dragging) {
      orb.rotY += orb.vel;
      orb.vel *= Math.exp(-3 * dt);
      orb.rotY += dt * (env.reduced ? 0.05 : 0.22);
      orb.tiltT *= Math.exp(-1.2 * dt);
    }
    orb.tilt = U.damp(orb.tilt, orb.tiltT, 6, dt);
    orbit.spin.rotation.y = orb.rotY - (1 - enter) * 1.4;
    orbit.spin.rotation.x = 0.14 + orb.tilt + P.sy * -0.05;
    orbit.spin.rotation.z = P.sx * 0.03;
    // turning the studio with the object makes the highlights sweep across the metal
    scene.environmentRotation.y = -orb.rotY * 0.35;
    scene.environmentRotation.x = orb.tilt * 0.4;

    orbit.root.updateMatrixWorld(true);
    for (let i = 0; i < callouts.length; i++) {
      tmpV.setFromMatrixPosition(orbit.anchors[i].matrixWorld).project(camera);
      const sx = (tmpV.x + 1) / 2 * W - r.left;
      const sy = (1 - tmpV.y) / 2 * H - r.top;
      callouts[i].style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
    }
    return true;
  }

  /* ---------- finale: the title turns to dust, the dust to a ring, the ring to the handle ---------- */
  const FIN_VS = `
    attribute vec3 aB;       // handle point (section px) + assembly delay
    attribute vec4 aR;       // randoms
    uniform vec2 uOrigin;    // world position of the section's top-left corner
    uniform float uP1, uP2, uP3, uOut, uTime, uDpr, uD, uSizeA, uSizeB;
    uniform vec3 uRing;      // centre (section px) + radius
    uniform vec3 uMouse;     // pointer (section px) + strength
    varying float vA;
    varying float vM;
    float eio(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5; }
    void main() {
      vec3 A = vec3(position.xy, 0.0);
      float s1 = clamp((uP1 - position.z * 0.6) / 0.4, 0.0, 1.0);
      float s2 = clamp((uP2 - aR.x * 0.35) / 0.65, 0.0, 1.0);
      float s3 = clamp((uP3 - aB.z * 0.45) / 0.55, 0.0, 1.0);
      float ph = aR.y * 6.2831853;
      float e1 = s1 * s1 * (3.0 - 2.0 * s1), e2 = eio(s2), e3 = eio(s3);

      // 1 — dust: lifted and curled off the letters, spread in depth
      vec3 dust = A + vec3(
        sin(A.y * 0.021 + uTime * 0.7 + ph) * 64.0 + (aR.z - 0.5) * 240.0,
        cos(A.x * 0.017 + uTime * 0.6 + ph) * 52.0 - 50.0 - aR.w * 180.0,
        (aR.x - 0.5) * 520.0
      ) * e1;

      // 2 — a tilted ring, turning
      float ang = ph + uTime * (0.32 + aR.z * 0.22) + s2 * 1.6;
      float rad = uRing.z * (0.8 + aR.w * 0.4);
      vec2 rc = vec2(cos(ang), sin(ang)) * rad;
      vec3 ring = vec3(rc.x, rc.y * 0.3 + (aR.x - 0.5) * 14.0, rc.y * 0.95);
      float cr = 0.978, sr = -0.208;   // a slight roll
      ring.xy = vec2(ring.x * cr - ring.y * sr, ring.x * sr + ring.y * cr) + uRing.xy;

      // 3 — the handle, reached on an arc toward the camera
      vec3 B = vec3(aB.xy, 0.0);
      vec3 p = mix(dust, ring, e2);
      p = mix(p, B, e3);
      p.z += sin(s3 * 3.14159) * (140.0 + aR.z * 280.0);
      p.xy += vec2(sin(uTime * 2.1 + ph * 3.0), cos(uTime * 1.7 + ph * 2.0)) * (0.5 + (1.0 - e3) * 2.5);

      // the pointer parts the particles
      vec2 dm = p.xy - uMouse.xy;
      float md = length(dm);
      float push = exp(-md * md / 12000.0) * uMouse.z * (0.45 + aR.w * 0.55);
      p.xy += dm / (md + 1.0) * push * 78.0;

      vec3 w = vec3(uOrigin.x + p.x, uOrigin.y - p.y, p.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
      float motion = e1 * (1.0 - e3);
      float size = mix(uSizeA, uSizeB, e3) * (1.0 + motion * (aR.w * 1.3 - 0.2)) * (1.0 + push * 0.8);
      gl_PointSize = max(size * uD / max(uD - w.z, 1.0), 0.5) * uDpr;
      float tw = 0.62 + 0.38 * sin(uTime * 3.3 + ph * 5.0);
      vA = smoothstep(0.0, 0.08, s1) * (1.0 - uOut) * mix(1.0, tw, motion);
      vM = motion;
    }`;
  const FIN_FS = `
    varying float vA;
    varying float vM;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.12, d) * vA;
      if (a < 0.004) discard;
      gl_FragColor = vec4(mix(vec3(0.97, 0.97, 0.98), vec3(0.74, 0.78, 0.88), vM * 0.55), a);
    }`;

  function buildFinale() {
    const sec = document.querySelector('.contact');
    const title = sec && sec.querySelector('.contact__title');
    const handle = sec && sec.querySelector('[data-handle]');
    if (!title || !handle) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uOrigin: { value: new THREE.Vector2() },
        uP1: { value: 0 }, uP2: { value: 0 }, uP3: { value: 0 }, uOut: { value: 0 },
        uTime: { value: 0 }, uDpr: { value: 1 }, uD: { value: 1 },
        uSizeA: { value: 2 }, uSizeB: { value: 2 },
        uRing: { value: new THREE.Vector3() },
        uMouse: { value: new THREE.Vector3(-1e4, -1e4, 0) }
      },
      vertexShader: FIN_VS, fragmentShader: FIN_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const geo = new THREE.BufferGeometry();
    setFinAttrs(geo, new Float32Array(3), new Float32Array(3), new Float32Array(4));
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    points.renderOrder = 3;
    scene.add(points);
    fin = {
      sec, title, handle, text: handle.textContent.trim(), mat, u: mat.uniforms, geo, points,
      key: '', ring: { x: 0, y: 0 }, mouse: { x: -1e4, y: -1e4, k: 0 }, canvas: document.createElement('canvas')
    };
    APP.on('resize', () => { fin.key = ''; });
  }

  function setFinAttrs(geo, a, b, r) {
    geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
    geo.setAttribute('aB', new THREE.BufferAttribute(b, 3));
    geo.setAttribute('aR', new THREE.BufferAttribute(r, 4));
  }

  // rasterise text exactly where the DOM lays it out and keep every lit pixel (section px)
  function finSample() {
    const sr = fin.sec.getBoundingClientRect();
    const tr = fin.title.getBoundingClientRect();
    const hr = fin.handle.getBoundingClientRect();
    if (!tr.width || !hr.width) return false;
    const key = [W, H, tr.width, tr.height, tr.left - sr.left, tr.top - sr.top, hr.width, hr.left - sr.left, hr.top - sr.top].map(Math.round).join(',');
    if (key === fin.key) return true;
    fin.key = key;

    const c = fin.canvas, ctx = c.getContext('2d', { willReadFrequently: true });
    const STEP = 2, pad = 24;
    const metrics = (cs) => {
      ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const m = ctx.measureText('Hg');
      return { A: m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.93, D: m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.24 };
    };
    const grab = (w, h, draw) => {
      c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(h + pad * 2);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.textBaseline = 'alphabetic';
      draw();
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };

    // title — each glyph tagged with its index through the red channel
    const tcs = getComputedStyle(fin.title);
    const chars = Array.from(fin.title.querySelectorAll('.sc'));
    const n = Math.max(chars.length, 1), band = Math.floor(250 / (n + 1));
    const tm = metrics(tcs);
    const offIn = (el) => {
      let x = 0, y = 0, e = el;
      while (e && e !== fin.title) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      if (e !== fin.title) { const r = el.getBoundingClientRect(); return [r.left - tr.left, r.top - tr.top]; }
      return [x, y];
    };
    const tData = grab(tr.width, tr.height, () => {
      ctx.font = tcs.fontWeight + ' ' + tcs.fontSize + ' ' + tcs.fontFamily;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      chars.forEach((ch, k) => {
        const [x, y] = offIn(ch);
        const L = ch.offsetHeight;
        ctx.fillStyle = 'rgb(' + (k + 1) * band + ',0,0)';
        ctx.fillText(ch.textContent, pad + x, pad + y + (L - (tm.A + tm.D)) / 2 + tm.A);
      });
    });
    const tPts = [];
    for (let y = 0; y < c.height; y += STEP) for (let x = 0; x < c.width; x += STEP) {
      const i = (y * c.width + x) * 4;
      if (tData[i + 3] > 110) tPts.push(x - pad + tr.left - sr.left, y - pad + tr.top - sr.top, U.clamp(Math.round(tData[i] / band) - 1, 0, n - 1));
    }

    // handle — every letter exactly where the DOM lays it out (layout offsets ignore the hover motion)
    const hcs = getComputedStyle(fin.handle);
    const hm = metrics(hcs);
    const letters = Array.from(fin.handle.querySelectorAll('.hc'));
    const hData = grab(hr.width, hr.height, () => {
      ctx.font = hcs.fontWeight + ' ' + hcs.fontSize + ' ' + hcs.fontFamily;
      ctx.fillStyle = '#fff';
      if (letters.length && letters[0].offsetParent === fin.handle) {
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        const lcs = getComputedStyle(letters[0]);
        const pl = parseFloat(lcs.paddingLeft) || 0, pt = parseFloat(lcs.paddingTop) || 0, pb = parseFloat(lcs.paddingBottom) || 0;
        letters.forEach((el) => {
          const L = el.offsetHeight - pt - pb;
          ctx.fillText(el.textContent, pad + el.offsetLeft + pl, pad + el.offsetTop + pt + (L - (hm.A + hm.D)) / 2 + hm.A);
        });
      } else {
        if ('letterSpacing' in ctx) ctx.letterSpacing = hcs.letterSpacing === 'normal' ? '0px' : hcs.letterSpacing;
        const pl = parseFloat(hcs.paddingLeft) || 0, pt = parseFloat(hcs.paddingTop) || 0, pb = parseFloat(hcs.paddingBottom) || 0;
        const L = hr.height - pt - pb;
        ctx.fillText(fin.text, pad + pl, pad + pt + (L - (hm.A + hm.D)) / 2 + hm.A);
      }
    });
    const hPts = [];
    for (let y = 0; y < c.height; y += STEP) for (let x = 0; x < c.width; x += STEP) {
      if (hData[(y * c.width + x) * 4 + 3] > 110) hPts.push(x - pad + hr.left - sr.left, y - pad + hr.top - sr.top);
    }
    const nA = tPts.length / 3, nB = hPts.length / 2;
    if (!nA || !nB) return false;

    const N = env.mobile ? 4200 : env.low ? 6500 : 11000;
    const rnd = U.mulberry(7);
    const perm = (m) => { const a = new Uint32Array(N); for (let i = 0; i < N; i++) a[i] = (rnd() * m) | 0; return a; };
    const pa = perm(nA), pb = perm(nB);
    const a = new Float32Array(N * 3), b = new Float32Array(N * 3), r = new Float32Array(N * 4);
    const hx0 = hr.left - sr.left, hw = hr.width;
    for (let i = 0; i < N; i++) {
      const ia = pa[i] * 3, ib = pb[i] * 2;
      a[i * 3] = tPts[ia] + (rnd() - 0.5) * STEP;
      a[i * 3 + 1] = tPts[ia + 1] + (rnd() - 0.5) * STEP;
      a[i * 3 + 2] = (n > 1 ? tPts[ia + 2] / (n - 1) : 0) * 0.85 + rnd() * 0.15;
      b[i * 3] = hPts[ib] + (rnd() - 0.5) * STEP;
      b[i * 3 + 1] = hPts[ib + 1] + (rnd() - 0.5) * STEP;
      b[i * 3 + 2] = U.clamp((hPts[ib] - hx0) / hw, 0, 1) * 0.7 + rnd() * 0.3;
      r[i * 4] = rnd(); r[i * 4 + 1] = rnd(); r[i * 4 + 2] = rnd(); r[i * 4 + 3] = rnd();
    }
    fin.geo.dispose();
    setFinAttrs(fin.geo, a, b, r);
    // each particle covers its share of the lit area
    const area = STEP * STEP;
    fin.u.uSizeA.value = U.clamp(Math.sqrt((nA * area) / N) * 1.5, 1.3, 5);
    fin.u.uSizeB.value = U.clamp(Math.sqrt((nB * area) / N) * 1.5, 1.3, 5);
    fin.ring.x = hx0 + hw / 2;
    fin.ring.y = hr.top - sr.top + hr.height / 2;
    fin.u.uRing.value.set(fin.ring.x, fin.ring.y, env.mobile ? Math.min(W * 0.4, H * 0.28) : Math.min(W * 0.3, H * 0.36));
    return true;
  }

  function updateFinale(dt, t) {
    if (!fin) return;
    const q = S.footer.q;
    const u = fin.u;
    u.uP1.value = U.clamp((q - 0.1) / 0.32, 0, 1);
    u.uP2.value = U.clamp((q - 0.34) / 0.24, 0, 1);
    u.uP3.value = U.clamp((q - 0.56) / 0.26, 0, 1);
    u.uOut.value = U.clamp((q - 0.84) / 0.06, 0, 1);
    const active = cur.footer > 0.5 || q > 0;
    if (!active) { fin.points.visible = false; return; }
    const sr = fin.sec.getBoundingClientRect();
    if (!finSample()) { fin.points.visible = false; return; }
    finC.x = (sr.left + fin.ring.x - W / 2) / W;
    finC.y = (H / 2 - (sr.top + fin.ring.y)) / H;
    fin.points.visible = u.uP1.value > 0 && u.uOut.value < 1;
    if (!fin.points.visible) return;
    u.uOrigin.value.set(sr.left - W / 2, H / 2 - sr.top);
    u.uTime.value = t;
    u.uDpr.value = renderer.getPixelRatio();
    u.uD.value = D;
    const m = fin.mouse;
    const live = P.live() && !env.reduced;
    if (live) {
      m.x = U.damp(m.x < -1e3 ? P.x - sr.left : m.x, P.x - sr.left, 10, dt);
      m.y = U.damp(m.y < -1e3 ? P.y - sr.top : m.y, P.y - sr.top, 10, dt);
    }
    m.k = U.damp(m.k, live ? 1 : 0, 4, dt);
    u.uMouse.value.set(m.x, m.y, m.k);
  }

  /* ---------- layout & resize ---------- */
  function layout() {
    D = (H / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.aspect = W / H;
    camera.near = D * 0.12;
    camera.far = D * 3;
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    textDirty = true;
  }

  S.resize = function () {
    if (!renderer) return;
    idle = 0;
    const w = vp.w, h = vp.lvh;
    if (w !== W || h !== H) {
      W = w; H = h;
      renderer.setSize(W, H, false);
      layout();
    } else textDirty = true;
    APP.experiments && APP.experiments.resize();
  };

  /* ---------- adaptive resolution ---------- */
  const perf = { acc: 0, n: 0, slow: 0, fast: 0, warm: 0 };
  function adapt(dt) {
    if (perf.warm < 2) { perf.warm += dt; return; }
    perf.acc += dt; perf.n++;
    if (perf.acc < 1) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0; perf.n = 0;
    if (avg > 1 / 45) { perf.slow++; perf.fast = 0; } else if (avg < 1 / 58) { perf.fast++; perf.slow = 0; } else { perf.slow = 0; perf.fast = 0; }
    const target = Math.min(vp.dpr, dprMax);
    if (perf.slow >= 2 && dpr > dprMin) {
      dpr = Math.max(dprMin, dpr - 0.25);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      perf.slow = 0; idle = 0;          // a resized buffer is blank until drawn again
    } else if (perf.fast >= 6 && dpr < target) {
      dpr = Math.min(target, dpr + 0.25);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      perf.fast = 0; idle = 0;
    }
  }

  /* ---------- lost context (phones drop it under memory pressure or in the background) ---------- */
  function restore() {
    const swap = M.rebuildEnvs(renderer);
    envLight = swap.get(envLight) || envLight;
    envDark = swap.get(envDark) || envDark;
    const scenes = [scene].concat(APP.experiments ? APP.experiments.list.map((x) => x.scene) : []);
    scenes.forEach((sc) => { if (sc && swap.has(sc.environment)) sc.environment = swap.get(sc.environment); });
    textDirty = true;
    if (fin) fin.key = '';
    idle = 0;
    S.lost = false;
  }

  /* ---------- loop ---------- */
  function tick(time, deltaMS) {
    const dt = Math.min(deltaMS / 1000, 1 / 20);
    APP.tickPointer(dt);
    if (S.paused || S.lost) return;
    elapsed += dt;
    const t = elapsed;

    syncText();
    updateFinale(dt, t);
    updateBlob(dt, t);
    const orbitOn = updateOrbit(dt, t);
    const dark = orbitOn || cur.footer > 0.001;
    scene.environment = dark ? envDark : envLight;
    if (!orbitOn) scene.environmentRotation.set(0, 0, 0);

    // only the backdrop colour on screen and it has already been drawn: leave the last frame up
    const quiet = !textMesh.visible && !blob.visible && !orbitOn && !(fin && fin.points.visible) &&
      !(APP.experiments && APP.experiments.peek(W, H));
    const bg = scene.background.getHex();
    idle = quiet && bg === idleBg ? idle + 1 : 0;
    idleBg = bg;
    if (idle > 2) return;

    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
    if (APP.experiments) APP.experiments.render(renderer, dt, t, W, H);
    adapt(dt);
  }

  S.start = function () {
    S.ready = true;
    gsap.ticker.add(tick);
  };
  S.pause = function () { S.paused = true; };
  S.resume = function () { S.paused = false; };

  // compile every program up-front so nothing hitches on first scroll
  S.compile = async function () {
    const was = [blob.visible, orbit.root.visible, textMesh.visible, fin ? fin.points.visible : false];
    blob.visible = orbit.root.visible = textMesh.visible = true;
    if (fin) fin.points.visible = true;
    blob.scale.setScalar(100);
    orbit.root.scale.setScalar(100);
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* fall back to lazy compile */ }
    scene.environment = envDark;
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* */ }
    scene.environment = envLight;
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
    blob.visible = was[0]; orbit.root.visible = was[1]; textMesh.visible = was[2];
    if (fin) fin.points.visible = was[3];
  };

  S.drawTextNow = () => { textDirty = true; syncText(); };
})();
