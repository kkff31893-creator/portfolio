/* materials — GLSL noise, liquid blob material, studio environments, shared geometry, Orbit product model */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP.env.webgl) return;

  const M = (APP.mat = {});

  /* ---------- 3D simplex noise (Ashima / Stefan Gustavson, MIT) ---------- */
  M.NOISE = /* glsl */ `
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0);
      const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy));
      vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);
      vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);
      vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;
      vec3 x2=x0-i2+C.yyy;
      vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857;
      vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z);
      vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy;
      vec4 y=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy);
      vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0;
      vec4 s1=floor(b1)*2.0+1.0;
      vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
      vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);
      vec3 p1=vec3(a0.zw,h.y);
      vec3 p2=vec3(a1.xy,h.z);
      vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
      m=m*m;
      return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
  `;

  /* ---------- liquid blob: physical material + vertex displacement ---------- */
  const BLOB_HEAD = /* glsl */ `
    uniform float uTime;
    uniform float uAmp;
    uniform float uFreq;
    uniform float uSpeed;
    uniform vec3  uMouseDir;
    uniform float uMouseAmt;
    uniform float uPulse;
    uniform float uPulseT;
    uniform vec3  uPulseDir;
    ${M.NOISE}
    float blobField(vec3 n){
      float t = uTime * uSpeed;
      float d = snoise(n * uFreq + vec3(0.0, t, t * 0.6)) * uAmp;
      d += snoise(n * uFreq * 2.3 + vec3(t * 0.8, -t * 0.45, 1.7)) * uAmp * 0.32;
      float m = smoothstep(0.15, 1.0, dot(n, uMouseDir));
      d += m * m * uMouseAmt;
      float a = 1.0 - dot(n, uPulseDir);
      d += sin(a * 9.0 - uPulseT * 15.0) * exp(-a * 1.6) * uPulse * 0.09 * smoothstep(0.0, 0.15, uPulseT);
      return d;
    }
    vec3 blobPos(vec3 n){ return n * (1.0 + blobField(n)); }
  `;
  const BLOB_NORMAL = /* glsl */ `
    vec3 bN = normalize(position);
    vec3 bT = normalize(cross(bN, abs(bN.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bB = cross(bN, bT);
    vec3 blobP = blobPos(bN);
    vec3 bP1 = blobPos(normalize(bN + bT * 0.01));
    vec3 bP2 = blobPos(normalize(bN + bB * 0.01));
    vec3 objectNormal = normalize(cross(bP1 - blobP, bP2 - blobP));
    #ifdef USE_TANGENT
      vec3 objectTangent = vec3(tangent.xyz);
    #endif
  `;

  M.blob = function (params, opts) {
    opts = opts || {};
    const u = {
      uTime: { value: 0 },
      uAmp: { value: opts.amp != null ? opts.amp : 0.16 },
      uFreq: { value: opts.freq != null ? opts.freq : 1.15 },
      uSpeed: { value: opts.speed != null ? opts.speed : 0.22 },
      uMouseDir: { value: new THREE.Vector3(0, 0, 1) },
      uMouseAmt: { value: 0 },
      uPulse: { value: 0 },
      uPulseT: { value: 10 },
      uPulseDir: { value: new THREE.Vector3(0, 0, 1) }
    };
    const m = new THREE.MeshPhysicalMaterial(params);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + BLOB_HEAD)
        .replace('#include <beginnormal_vertex>', BLOB_NORMAL)
        .replace('#include <begin_vertex>', 'vec3 transformed = blobP;');
    };
    m.customProgramCacheKey = () => 'liquid-blob-1';
    m.userData.u = u;
    return m;
  };

  M.blobGeometry = function (detail) {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = THREE.mergeVertices(g, 1e-4);
    const p = g.attributes.position;
    const n = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const l = Math.hypot(x, y, z) || 1;
      n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
    return g;
  };

  /* ---------- procedural studio environments (PMREM) ---------- */
  function roomSphere(stops) {
    const g = new THREE.SphereGeometry(20, 64, 32);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 20; // -1 bottom .. 1 top
      let v;
      if (y < 0) v = THREE.MathUtils.lerp(stops[1], stops[0], Math.pow(-y, 0.6));
      else v = THREE.MathUtils.lerp(stops[1], stops[2], Math.pow(y, 0.8));
      c.setScalar(v);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  }
  function panel(scene, w, h, intensity, x, y, z, tint) {
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    mat.color.set(tint || 0xffffff).multiplyScalar(intensity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
    return m;
  }

  const PRESETS = {
    // soft gray studio: reads as defined glass on light backgrounds
    light: {
      room: [0.05, 0.32, 0.55],
      panels: [
        [9, 9, 3.2, 0, 14, 0],          // overhead softbox
        [2.2, 12, 6.0, -13, 3, 4],      // key strip
        [1.6, 10, 2.4, 13, 2, 3],       // fill strip
        [14, 1.4, 4.0, 0, 2, -14],      // rim
        [7, 3, 1.0, 0, -1, 14]          // front bounce
      ]
    },
    // black studio with strip lights: product shots on black
    dark: {
      room: [0.0, 0.006, 0.015],
      panels: [
        [8, 8, 2.2, 0, 14, 0],
        [1.4, 14, 9.0, -13, 2, 3],
        [1.2, 12, 4.5, 13, 1, 5],
        [16, 1.0, 6.0, 0, 3, -14],
        [4, 1.2, 1.4, 4, -3, 13]
      ]
    },
    // warm, bright daylight studio
    warm: {
      room: [0.18, 0.5, 0.75],
      panels: [
        [12, 12, 2.5, 0, 14, 0, 0xfff4e6],
        [3, 10, 3.2, -13, 4, 6, 0xfff1dc],
        [2, 8, 1.4, 13, 2, 4],
        [14, 2, 1.8, 0, 3, -14]
      ]
    },
    // white seamless: chrome reflects a bright room with a soft horizon
    white: {
      room: [0.12, 0.62, 0.9],
      panels: [
        [12, 12, 3.0, 0, 14, 0],
        [2.4, 12, 4.0, -13, 3, 5],
        [2.4, 12, 2.5, 13, 3, 5],
        [14, 1.2, 0.35, 0, 0.5, -14, 0x222222]
      ]
    }
  };

  M.envCache = {};
  M.makeEnv = function (renderer, name) {
    if (M.envCache[name]) return M.envCache[name];
    const pr = PRESETS[name];
    const scene = new THREE.Scene();
    scene.add(roomSphere(pr.room));
    pr.panels.forEach((p) => panel(scene, p[0], p[1], p[2], p[3], p[4], p[5], p[6]));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(scene, 0.035, 0.1, 100);
    pmrem.dispose();
    scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    M.envCache[name] = rt.texture;
    return rt.texture;
  };

  // after a lost WebGL context the prefiltered maps are gone: rebuild each one, return old → new
  M.rebuildEnvs = function (renderer) {
    const swap = new Map();
    Object.keys(M.envCache).forEach((name) => {
      const old = M.envCache[name];
      delete M.envCache[name];
      swap.set(old, M.makeEnv(renderer, name));
    });
    return swap;
  };

  /* ---------- soft radial sprite texture ---------- */
  let glowTex = null;
  M.glowTexture = function () {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.14)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    return glowTex;
  };
  // luminance falloff used as an alpha map for soft contact shadows
  let aoTex = null;
  M.aoTexture = function () {
    if (aoTex) return aoTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.22, 'rgba(255,255,255,0.62)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    aoTex = new THREE.CanvasTexture(c);
    aoTex.colorSpace = THREE.NoColorSpace;
    return aoTex;
  };

  /* ---------- Orbit — the product used live and in baked shots ---------- */
  M.buildOrbit = function (opts) {
    opts = opts || {};
    const detail = opts.detail || 1;
    const root = new THREE.Group();   // positioned & scaled by the caller
    const spin = new THREE.Group();   // rotated by drag / auto-spin
    root.add(spin);

    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.04,
      transmission: 1, thickness: 0.55, ior: 1.52, dispersion: 1.6,
      specularIntensity: 1, envMapIntensity: 1.35,
      attenuationColor: new THREE.Color('#dfe8ff'), attenuationDistance: 3.5
    });
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f4, metalness: 1, roughness: 0.2, envMapIntensity: 1.25, clearcoat: 0.4, clearcoatRoughness: 0.1 });
    const ceramic = new THREE.MeshPhysicalMaterial({ color: 0x2c2c30, metalness: 0, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.1 });

    const orb = new THREE.Mesh(new THREE.SphereGeometry(1, 96 * detail | 0, 64 * detail | 0), glass);
    const coreMat = M.blob({ color: 0xffffff, metalness: 1, roughness: 0.07, envMapIntensity: 1.6 }, { amp: 0.14, freq: 1.4, speed: 0.35 });
    const core = new THREE.Mesh(M.blobGeometry(opts.coreDetail || 24), coreMat);
    core.scale.setScalar(0.36);
    const orbGroup = new THREE.Group();
    orbGroup.add(orb, core);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.075, 48, 180), chrome);
    ring.rotation.x = Math.PI / 2;
    const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 6, 16), chrome);
    knob.position.set(0, 1.08 + 0.07, 0);
    knob.rotation.z = Math.PI / 2;
    const ringGroup = new THREE.Group();
    ringGroup.add(ring);
    ring.add(knob);

    const profile = [
      [0.0, -0.27], [0.66, -0.27], [0.75, -0.262], [0.81, -0.235], [0.845, -0.19], [0.862, -0.12],
      [0.868, 0.08], [0.858, 0.16], [0.83, 0.215], [0.78, 0.25], [0.7, 0.265], [0.52, 0.262],
      [0.42, 0.235], [0.28, 0.215], [0.0, 0.21]
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const base = new THREE.Mesh(new THREE.LatheGeometry(profile, 160), ceramic);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfdcff).multiplyScalar(3) }));
    led.position.set(0, 0.02, 0.868);
    const baseGroup = new THREE.Group();
    baseGroup.add(base, led);

    const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(1.1), transparent: true, opacity: 0.4, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.006, 8, 256), haloMat);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), chrome);
    const haloGroup = new THREE.Group();
    haloGroup.add(halo, moon);
    halo.rotation.x = Math.PI / 2;
    haloGroup.rotation.set(0.38, 0, -0.22);

    spin.add(orbGroup, ringGroup, baseGroup, haloGroup);

    // anchors in root space (not rotated) for callouts
    const anchors = [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()];
    anchors.forEach((a) => root.add(a));

    const api = {
      root, spin, orb, core, ring: ringGroup, base: baseGroup, halo: haloGroup, moon, anchors,
      materials: [glass, chrome, ceramic, coreMat, haloMat],
      extents: { top: 1.02, bottom: -1.47 },
      // attenuation is measured in world units along a ray already scaled by the model matrix
      setUnit(u) { glass.attenuationDistance = 3.5 * u; },
      pose(e, t) {
        const orbY = 0.02 + e * 1.0;
        const ringY = -0.95 - e * 0.12;
        const baseY = -1.2 - e * 0.82;
        orbGroup.position.y = orbY;
        ringGroup.position.y = ringY;
        ringGroup.rotation.x = e * 0.42;
        ringGroup.rotation.z = e * 0.16;
        baseGroup.position.y = baseY;
        haloGroup.position.y = orbY * 0.5 - 0.3;
        haloGroup.scale.setScalar(1 + e * 0.22);
        const a = t * 0.45;
        moon.position.set(Math.cos(a) * 1.75 * 1, 0, Math.sin(a) * 1.75);
        core.rotation.y = t * 0.4;
        coreMat.userData.u.uTime.value = t;
        anchors[0].position.set(0.74, orbY + 0.52, 0.2);
        anchors[1].position.set(-1.1, ringY + e * 0.05, 0.1);
        anchors[2].position.set(0.84, baseY + 0.04, 0.2);
        this.extents.top = orbY + 1.0;
        this.extents.bottom = baseY - 0.27;
      }
    };
    api.pose(0, 0);
    return api;
  };

  /* ---------- geometry helpers for baked scenes ---------- */
  // seamless studio sweep (cyclorama): floor -> quarter cove -> back wall
  M.sweep = function (w, depth, height, radius, material) {
    const pts = [];
    const floorSteps = 6;
    for (let i = 0; i <= floorSteps; i++) pts.push([depth * (1 - i / floorSteps), 0]);
    const arc = 28;
    for (let i = 1; i <= arc; i++) {
      const f = (i / arc) * Math.PI / 2;
      pts.push([-radius * Math.sin(f), radius - radius * Math.cos(f)]);
    }
    pts.push([-radius, height]);
    const pos = [], idx = [];
    pts.forEach((p) => { pos.push(-w / 2, p[1], p[0], w / 2, p[1], p[0]); });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  };

  // plaster arch: rectangle with a round-topped opening, extruded with soft bevel
  M.arch = function (w, h, openW, openH, depth, material) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
    const r = openW / 2;
    const hole = new THREE.Path();
    hole.moveTo(-r, 0);
    hole.lineTo(-r, openH - r);
    hole.absarc(0, openH - r, r, Math.PI, 0, true);
    hole.lineTo(r, 0);
    hole.lineTo(-r, 0);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4, curveSegments: 48 });
    g.translate(0, 0, -depth / 2);
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  M.aoDecal = function (sx, sz, opacity, y) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sz),
      new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: M.aoTexture(), transparent: true, opacity, depthWrite: false, toneMapped: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = y || 0.004;
    m.renderOrder = 1;
    return m;
  };
})();
