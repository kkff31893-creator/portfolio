/* baker — renders every project image as a procedural 3D studio shot at load time */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP.env.webgl) return;
  const M = APP.mat;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const B = (APP.baker = { canvases: {} });

  const SIZE = {
    hero: [1920, 1200],
    wide: [1500, 1050],
    tall: [1100, 1420],
    square: [1400, 1400],
    still: [1000, 1250]
  };
  // images the refract experiment reuses as textures
  const KEEP = ['lumen-a', 'meridian-1', 'orbit-1', 'still-hero'];

  let R = null; // renderer
  const disposables = [];

  /* ---------- materials ---------- */
  const mats = {
    plaster: (c) => new THREE.MeshStandardMaterial({ color: c || 0xe4dfd7, roughness: 0.95, metalness: 0 }),
    chrome: () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.035 }),
    black: () => new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
    glass: (o) => new THREE.MeshPhysicalMaterial(Object.assign({
      color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 1, ior: 1.5,
      dispersion: 2.5, specularIntensity: 1, envMapIntensity: 1.2
    }, o || {})),
    stone: (c, r) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r || 0.62, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 })
  };

  /* ---------- rigs ---------- */
  function studio(o) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(o.bg);
    scene.environment = M.makeEnv(R, o.env);
    scene.environmentIntensity = o.envI != null ? o.envI : 1;
    const cam = new THREE.PerspectiveCamera(o.fov || 30, 1, 0.1, 200);
    cam.position.copy(o.cam);
    cam.lookAt(o.target);
    if (o.sweep) {
      const sw = M.sweep(60, 30, 30, o.sweepR || 5, new THREE.MeshStandardMaterial({ color: o.sweep, roughness: 1, metalness: 0 }));
      sw.position.z = o.sweepZ != null ? o.sweepZ : -3;
      scene.add(sw);
    }
    if (o.sun) {
      const l = new THREE.DirectionalLight(o.sun.color || 0xffffff, o.sun.i);
      l.position.copy(o.sun.pos);
      l.target.position.copy(o.sun.target || o.target);
      l.castShadow = true;
      const lite = APP.env.mobile || APP.env.low;   // phones bake at a smaller size, so the shadows can too
      l.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
      const s = o.sun.size || 6;
      Object.assign(l.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 60 });
      l.shadow.radius = o.sun.radius || 8;
      l.shadow.blurSamples = lite ? 12 : 20;
      l.shadow.bias = -0.0004;
      scene.add(l, l.target);
    }
    return { scene, cam };
  }

  // real reflections of the set for mirror-finish objects
  function reflect(scene, mesh, size) {
    const rt = new THREE.WebGLCubeRenderTarget(size || 256, { type: THREE.HalfFloatType });
    const cc = new THREE.CubeCamera(0.05, 100, rt);
    mesh.getWorldPosition(cc.position);
    const vis = mesh.visible;
    mesh.visible = false;
    cc.update(R, scene);
    mesh.visible = vis;
    const pm = new THREE.PMREMGenerator(R);
    const env = pm.fromCubemap(rt.texture);
    pm.dispose();
    rt.dispose();
    mesh.material.envMap = env.texture;
    mesh.material.envMapIntensity = 1;
    mesh.material.needsUpdate = true;
    disposables.push(env);
  }

  // glossy black floor: a mirrored copy of the set under a translucent plane
  function mirrorFloor(scene, group, opacity) {
    const m = group.clone(true);
    m.scale.y = -1;
    scene.add(m);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: opacity || 0.8, depthWrite: false })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    return m;
  }

  function glowSprite(color, scale, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: M.glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    s.scale.setScalar(scale);
    return s;
  }
  function floorGlow(color, size, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
      map: M.glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.01;
    m.renderOrder = 2;
    return m;
  }

  /* ---------- props ---------- */
  function chromeSphere(r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 128, 96), mats.chrome());
    m.position.y = r;
    m.castShadow = true;
    return m;
  }
  function blackTorus(R0, t) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(R0, t, 96, 192), mats.black());
    m.position.y = R0 + t;
    m.castShadow = true;
    return m;
  }
  function glassCube(s) {
    const g = new THREE.Group();
    const cube = new THREE.Mesh(new THREE.RoundedBoxGeometry(s, s, s, 8, s * 0.08), mats.glass({ thickness: s, dispersion: 3, attenuationColor: new THREE.Color('#e7f0ff'), attenuationDistance: 6 }));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(s * 0.29, 96, 64), mats.chrome());
    ball.castShadow = true;
    g.add(cube, ball);
    g.position.y = s / 2;
    return g;
  }
  function stones() {
    const g = new THREE.Group();
    const spec = [
      [0.82, 0.4, 0.72, 0xbbb5ac, 0, 0.02],
      [0.6, 0.3, 0.52, 0x85807a, 0.16, -0.06],
      [0.38, 0.22, 0.34, 0x2e2c29, -0.08, 0.1]
    ];
    let y = 0;
    spec.forEach((s, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mats.stone(s[3], 0.55 + i * 0.08));
      m.scale.set(s[0], s[1], s[2]);
      m.position.set(s[4], y + s[1] * 0.96, 0);
      m.rotation.z = s[5];
      m.rotation.y = i * 0.9;
      m.castShadow = true;
      m.receiveShadow = true;
      y += s[1] * 1.9;
      g.add(m);
    });
    return g;
  }
  function roundBox(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.RoundedBoxGeometry(w, h, d, 5, Math.min(w, h, d) * 0.12), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /* ---------- LUMEN — glass slabs around a single light ---------- */
  function lumen(camPos, target, fov) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.environment = M.makeEnv(R, 'dark');
    scene.environmentIntensity = 0.75;
    const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
    cam.position.copy(camPos);
    cam.lookAt(target);

    const set = new THREE.Group();
    const glass = mats.glass({
      roughness: 0.06, thickness: 0.45, dispersion: 6, ior: 1.55,
      attenuationColor: new THREE.Color('#9fd3ff'), attenuationDistance: 2.2, envMapIntensity: 1.6
    });
    const slabGeo = new THREE.RoundedBoxGeometry(0.86, 2.5, 0.09, 4, 0.03);
    const N = 11, Rr = 2.5;
    for (let i = 0; i < N; i++) {
      const a = THREE.MathUtils.degToRad(46 + (i / (N - 1)) * (360 - 92));
      const s = new THREE.Mesh(slabGeo, glass);
      s.position.set(Math.sin(a) * Rr, 1.25, Math.cos(a) * Rr);
      s.rotation.y = a;
      set.add(s);
    }
    const warm = new THREE.Color(0xfff1dc);
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 2.1, 8, 24), new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(16) }));
    core.position.y = 1.3;
    set.add(core);
    const pl = new THREE.PointLight(0xfff0dd, 26, 0, 2);
    pl.position.set(0, 1.3, 0);
    set.add(pl);
    const g1 = glowSprite(0xffe9cc, 3.2, 0.55); g1.position.y = 1.3;
    const g2 = glowSprite(0xffd9b0, 9, 0.12); g2.position.y = 1.3;
    const g3 = glowSprite(0xffffff, 1.2, 0.8); g3.position.y = 1.3;
    g1.scale.y *= 1.8; g3.scale.y *= 2.6;
    set.add(g1, g2, g3);

    // drifting dust in the light
    const rnd = APP.u.mulberry(7);
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(rnd()) * 3.2, a = rnd() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.1 + rnd() * 2.8; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffe8cc, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    set.add(dust);

    scene.add(set);
    mirrorFloor(scene, set, 0.8);
    scene.add(floorGlow(0xffddb0, 9, 0.28));
    return { scene, cam };
  }

  /* ---------- MERIDIAN — architecture in warm daylight ---------- */
  function meridianRig(camPos, target, fov, sunPos, sunSize) {
    return studio({
      bg: '#efeeec', env: 'warm', envI: 0.55, sweep: 0xebe7e1, sweepR: 6, sweepZ: -3.2,
      cam: camPos, target, fov,
      sun: { pos: sunPos, i: 2.7, color: 0xfff0de, size: sunSize || 7, radius: 6 }
    });
  }

  /* ---------- STILL — objects on white ---------- */
  function stillRig(camPos, target, fov) {
    return studio({
      bg: '#ffffff', env: 'white', envI: 0.9, sweep: 0xf6f6f6, sweepR: 7, sweepZ: -3.5,
      cam: camPos, target, fov,
      sun: { pos: V(-3.5, 9, 5), i: 1.35, size: 6, radius: 16 }
    });
  }

  /* ---------- shot list ---------- */
  const SHOTS = [
    ['lumen-a', 'hero', () => lumen(V(0, 1.02, 7.4), V(0, 1.12, 0), 31)],
    ['lumen-b', 'tall', () => lumen(V(1.25, 0.55, 3.3), V(0.1, 1.25, 0), 40)],
    ['lumen-c', 'square', () => lumen(V(0, 6.6, 4.4), V(0, 0.55, 0), 34)],

    ['meridian-1', 'wide', () => {
      const r = meridianRig(V(1.4, 1.45, 7.8), V(0.1, 1.3, 0), 30, V(-6, 7.5, 5));
      const arch = M.arch(2.5, 3.1, 1.24, 2.25, 0.55, mats.plaster());
      arch.position.set(-0.45, 0, -0.5);
      arch.rotation.y = 0.22;
      const ball = chromeSphere(0.44);
      ball.position.x = 1.05; ball.position.z = 0.7;
      const ao = M.aoDecal(1.6, 1.6, 0.35);
      ao.position.set(1.05, 0.004, 0.7);
      r.scene.add(arch, ball, ao);
      r.pre = () => reflect(r.scene, ball);
      return r;
    }],
    ['meridian-2', 'tall', () => {
      const r = meridianRig(V(0.5, 1.35, 6.4), V(0, 0.95, 0), 27, V(6, 6.5, 3.5), 5);
      const spec = [[1.7, 0.34, 1.15, 0xd9d2c7, 0, 0], [1.3, 0.3, 0.98, 0xc8bfb1, 0.18, 0.05], [1.02, 0.36, 0.82, 0xe3ddd4, -0.14, -0.04], [0.74, 0.27, 0.62, 0xb7ac9d, 0.3, 0.06], [0.46, 0.22, 0.42, 0xdcd6cc, -0.1, -0.02]];
      let y = 0;
      spec.forEach((s) => {
        const b = roundBox(s[0], s[1], s[2], mats.plaster(s[3]));
        b.position.set(s[5], y + s[1] / 2, 0);
        b.rotation.y = s[4];
        y += s[1];
        r.scene.add(b);
      });
      return r;
    }],
    ['meridian-3', 'wide', () => {
      const r = meridianRig(V(3.8, 1.45, 6.6), V(0.2, 1.35, -0.2), 30, V(-8, 4.2, 5.5), 8);
      const col = mats.plaster(0xe6e1d9);
      const cg = new THREE.CylinderGeometry(0.17, 0.17, 2.9, 64);
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Mesh(cg, col);
        c.position.set(-3.6 + i * 0.95, 1.45, -0.4);
        c.castShadow = true; c.receiveShadow = true;
        r.scene.add(c);
      }
      const line = new THREE.Mesh(new THREE.BoxGeometry(14, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.5 }));
      line.position.set(0, 1.62, 0.05);
      line.castShadow = true;
      r.scene.add(line);
      return r;
    }],
    ['meridian-4', 'tall', () => {
      const r = meridianRig(V(0.25, 1.55, 6.6), V(0, 1.5, 0), 30, V(-4.5, 6.5, 5), 5);
      const arch = M.arch(1.9, 3.3, 1.02, 2.35, 0.65, mats.plaster(0xe2dcd3));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.43, 128, 96), mats.black());
      ball.position.set(0, 0.43, 0);
      ball.castShadow = true;
      const ao = M.aoDecal(1.4, 1.4, 0.45);
      r.scene.add(arch, ball, ao);
      return r;
    }],
    ['meridian-5', 'wide', () => {
      const r = meridianRig(V(-3.9, 1.35, 6.8), V(0.35, 1.05, -0.9), 30, V(5.5, 7, 2.5), 7);
      const pm = mats.plaster(0xe5e0d8);
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.17 * (i + 1), 0.42), pm);
        s.position.set(0, 0.085 * (i + 1), 1.2 - i * 0.42);
        s.castShadow = true; s.receiveShadow = true;
        r.scene.add(s);
      }
      const mono = roundBox(0.85, 3.1, 0.32, new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
      mono.position.set(0.15, 1.02 + 1.55, -1.5);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.02, 1.2), pm);
      top.position.set(0, 0.51, -1.35);
      top.castShadow = true; top.receiveShadow = true;
      r.scene.add(mono, top);
      return r;
    }],

    ['orbit-1', 'hero', () => orbitShot(V(0.4, 1.7, 7.4), V(0, 1.3, 0), 30, 0, -0.5)],
    ['orbit-2', 'tall', () => orbitShot(V(1.55, 0.45, 3.3), V(0, 1.0, 0), 36, 0, 0.6)],
    ['orbit-3', 'square', () => orbitShot(V(0, 1.1, 10.2), V(0, 1.15, 0), 30, 1, 0.3)],

    ['still-1', 'still', () => {
      const r = stillRig(V(0, 1.0, 6.2), V(0, 0.72, 0), 27);
      const b = chromeSphere(0.7);
      r.scene.add(b, M.aoDecal(2.2, 2.2, 0.5));
      r.pre = () => reflect(r.scene, b);
      return r;
    }],
    ['still-2', 'still', () => {
      const r = stillRig(V(0.4, 1.05, 6.2), V(0, 0.84, 0), 27);
      const t = blackTorus(0.6, 0.24);
      t.rotation.y = 0.55;
      r.scene.add(t, M.aoDecal(2.2, 1.2, 0.55));
      return r;
    }],
    ['still-3', 'still', () => {
      const r = stillRig(V(0.5, 1.5, 6.1), V(0, 0.64, 0), 27);
      const c = glassCube(1.3);
      c.rotation.y = 0.62;
      r.scene.add(c, M.aoDecal(2.6, 2.6, 0.42));
      return r;
    }],
    ['still-4', 'still', () => {
      const r = stillRig(V(0, 1.15, 6.2), V(0, 0.98, 0), 27);
      r.scene.add(stones(), M.aoDecal(2.4, 2.0, 0.5));
      return r;
    }],
    ['still-hero', 'hero', () => {
      const r = stillRig(V(0, 1.35, 10.5), V(0, 0.8, 0), 29);
      const b = chromeSphere(0.62); b.position.x = -2.7;
      const t = blackTorus(0.52, 0.21); t.position.x = -0.95; t.rotation.y = 0.5;
      const c = glassCube(1.15); c.position.x = 0.85; c.rotation.y = 0.55;
      const s = stones(); s.position.x = 2.65; s.scale.setScalar(0.9);
      const aos = [[-2.7, 2.0], [-0.95, 1.8], [0.85, 2.2], [2.65, 2.0]].map((a) => {
        const d = M.aoDecal(a[1], a[1] * 0.8, 0.45); d.position.x = a[0]; return d;
      });
      r.scene.add(b, t, c, s, ...aos);
      r.pre = () => reflect(r.scene, b);
      return r;
    }]
  ];

  function orbitShot(camPos, target, fov, explode, rotY) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.environment = M.makeEnv(R, 'dark');
    const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
    cam.position.copy(camPos);
    cam.lookAt(target);
    const o = M.buildOrbit({ coreDetail: 40 });
    o.pose(explode, 2.2);
    o.spin.rotation.y = rotY;
    const set = new THREE.Group();
    set.add(o.root);
    if (explode) {
      o.root.position.y = 1.25;
      scene.add(set);
    } else {
      o.root.position.y = 1.47;
      scene.add(set);
      mirrorFloor(scene, set, 0.84);
      scene.add(floorGlow(0xdfe8ff, 5, 0.16));
    }
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.2);
    rim.position.set(-4, 5, -5);
    scene.add(rim);
    return { scene, cam };
  }

  /* ---------- output post: grain + vignette, then JPEG ---------- */
  let grain = null;
  function grainPattern(ctx) {
    if (!grain) {
      grain = document.createElement('canvas');
      grain.width = grain.height = 256;
      const g = grain.getContext('2d');
      const img = g.createImageData(256, 256);
      const rnd = APP.u.mulberry(11);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (rnd() - 0.5) * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    return ctx.createPattern(grain, 'repeat');
  }

  function disposeScene(scene) {
    const keep = new Set(Object.values(M.envCache));
    scene.traverse((o) => {
      if (o.isLight && o.shadow && o.shadow.map) o.shadow.dispose();
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.envMap && !keep.has(m.envMap)) m.envMap = null;
          m.dispose();
        });
      }
    });
    disposables.splice(0).forEach((d) => d.dispose());
  }

  function toBlob(canvas) {
    return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9));
  }

  B.count = SHOTS.length;

  B.run = async function (renderer, onProgress) {
    R = renderer;
    const env = APP.env;
    const q = env.mobile ? 0.62 : env.low ? 0.78 : 1;
    const prevPR = R.getPixelRatio();
    const prevSize = R.getSize(new THREE.Vector2());
    R.setPixelRatio(1);
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.VSMShadowMap;

    const out = document.createElement('canvas');
    const ctx = out.getContext('2d');
    let done = 0;

    for (const [name, size, build] of SHOTS) {
      const w = Math.round(SIZE[size][0] * q), h = Math.round(SIZE[size][1] * q);
      const shot = build();
      shot.cam.aspect = w / h;
      shot.cam.updateProjectionMatrix();
      R.setSize(w, h, false);
      R.setScissorTest(false);
      R.setViewport(0, 0, w, h);
      if (shot.pre) shot.pre();
      try { await R.compileAsync(shot.scene, shot.cam); } catch (e) { /* compile lazily on render */ }
      R.setRenderTarget(null);
      R.render(shot.scene, shot.cam);
      out.width = w; out.height = h;
      ctx.drawImage(R.domElement, 0, 0, w, h, 0, 0, w, h);
      const dark = shot.scene.background.getHex() === 0;
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = dark ? 0.05 : 0.035;
      ctx.fillStyle = grainPattern(ctx);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      if (dark) {
        const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
      }
      if (KEEP.includes(name)) {
        const k = document.createElement('canvas');
        const s = Math.min(1, 1024 / w);
        k.width = Math.round(w * s); k.height = Math.round(h * s);
        k.getContext('2d').drawImage(out, 0, 0, k.width, k.height);
        B.canvases[name] = k;
      }
      const blob = await toBlob(out);
      if (blob) APP.shots[name] = URL.createObjectURL(blob);
      disposeScene(shot.scene);
      done++;
      onProgress && onProgress(done / SHOTS.length);
    }

    R.setPixelRatio(prevPR);
    R.setSize(prevSize.x, prevSize.y, false);
  };
})();
