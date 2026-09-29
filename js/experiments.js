/* experiments — four WebGL studies (the fifth, magnetic type, lives in the DOM, see ui.js), drawn through scissored viewports of the shared renderer */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP.env.webgl) return;
  const U = APP.u, M = APP.mat, env = APP.env, P = APP.pointer;

  const X = (APP.experiments = { list: [] });
  const TILE = '#141415';
  let renderer;
  let maskScene, maskCam, maskU;

  /* ---------- rounded-corner mask drawn over each viewport ---------- */
  function buildMask() {
    maskU = {
      uSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 24 },
      uBg: { value: new THREE.Vector3(0.04, 0.04, 0.043) },
      uPx: { value: 1 },
      uFade: { value: 1 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: maskU,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform vec2 uSize; uniform float uRadius; uniform vec3 uBg; uniform float uPx; uniform float uFade;
        float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){
          vec2 p = (vUv - 0.5) * uSize;
          float d = sdRound(p, uSize * 0.5, uRadius);
          float outside = smoothstep(-uPx, 0.0, d);
          float line = smoothstep(-1.6, -0.6, d) * (1.0 - outside);
          vec3 col = mix(vec3(1.0), uBg, max(outside, 1.0 - uFade));
          float a = max(max(outside, line * 0.085), 1.0 - uFade);
          if (a < 0.002) discard;
          gl_FragColor = vec4(col, a);
        }`
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    q.frustumCulled = false;
    maskScene = new THREE.Scene();
    maskScene.add(q);
    maskCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  function baseScene(bg) {
    const s = new THREE.Scene();
    s.background = new THREE.Color(bg || TILE);
    return s;
  }
  // world-space half extents of a perspective camera at z=0
  function frustumHalf(cam) {
    const hh = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
    return { x: hh * cam.aspect, y: hh };
  }

  /* =========================================================
     01 FIELD — a grid of points lifted by the cursor
     ========================================================= */
  function Field() {
    const scene = baseScene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 5.4, 7.4);
    camera.lookAt(0, -0.4, 0);
    const nx = env.mobile ? 96 : 160, nz = env.mobile ? 64 : 100;
    const pos = new Float32Array(nx * nz * 3);
    let k = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      pos[k++] = -11 + (i / (nx - 1)) * 22;
      pos[k++] = 0;
      pos[k++] = -9 + (j / (nz - 1)) * 14;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rips = [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -99, 0));
    const u = {
      uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0, 0) }, uHover: { value: 0 },
      uPR: { value: 1 }, uSize: { value: 30 }, uRip: { value: rips }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uHover, uPR, uSize; uniform vec2 uMouse; uniform vec4 uRip[4];
        varying float vA;
        void main(){
          vec3 p = position;
          float d = distance(p.xz, uMouse);
          float bump = exp(-d * d * 0.5) * uHover;
          float w = sin(p.x * 0.55 + uTime * 0.7) * 0.09 + sin(p.z * 0.8 - uTime * 0.55 + p.x * 0.2) * 0.08;
          float rip = 0.0;
          for (int i = 0; i < 4; i++) {
            vec4 r = uRip[i];
            float rt = uTime - r.z;
            if (rt > 0.0 && rt < 5.0) {
              float rd = distance(p.xz, r.xy);
              float front = rt * 3.4;
              rip += sin((rd - front) * 2.4) * exp(-abs(rd - front) * 1.1) * exp(-rt * 0.8) * r.w;
            }
          }
          p.y += bump * 1.1 + w + rip * 0.38;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uPR * (1.0 + bump * 1.1 + abs(rip) * 0.5) / -mv.z;
          float fog = smoothstep(17.0, 5.0, -mv.z);
          vA = (0.2 + bump * 0.9 + abs(rip) * 0.45) * fog;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.15, d) * vA;
          gl_FragColor = vec4(vec3(1.0), a);
        }`
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    scene.add(pts);

    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), nd = new THREE.Vector2();
    const target = new THREE.Vector2();
    let ri = 0, lastRip = 0, lastTouch = -10;
    function ripple(x, z, amp, t) { rips[ri].set(x, z, t, amp); ri = (ri + 1) % 4; lastRip = t; }

    return {
      scene, camera,
      resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
      update(dt, t, lp) {
        u.uTime.value = t;
        u.uPR.value = renderer.getPixelRatio();
        if (lp.inside) {
          nd.set(lp.nx, lp.ny);
          ray.setFromCamera(nd, camera);
          if (ray.ray.intersectPlane(plane, hit)) target.set(hit.x, hit.z);
          lastTouch = t;
        } else {
          target.set(Math.sin(t * 0.35) * 3.2, Math.cos(t * 0.27) * 1.6 - 1);
        }
        u.uMouse.value.lerp(target, 1 - Math.exp(-6 * dt));
        u.uHover.value = U.damp(u.uHover.value, lp.inside ? 1 : 0.55, 3, dt);
        if (t - lastRip > 4.5 && t - lastTouch > 3) ripple(U.rand(-3, 3), U.rand(-3, 1), 0.7, t);
      },
      down(lp, t) { ripple(u.uMouse.value.x, u.uMouse.value.y, 1.2, t); }
    };
  }

  /* =========================================================
     02 LIQUID — chrome that bulges toward the cursor
     ========================================================= */
  function Liquid() {
    const scene = baseScene();
    scene.environment = M.makeEnv(renderer, 'dark');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 8);
    const mat = M.blob({
      color: 0xffffff, metalness: 1, roughness: 0.055, envMapIntensity: 1.6,
      iridescence: 0.5, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 620]
    }, { amp: 0.2, freq: 1.25, speed: 0.34 });
    const mesh = new THREE.Mesh(M.blobGeometry(env.mobile ? 26 : 44), mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const u = mat.userData.u;
    const dir = new THREE.Vector3(), q = new THREE.Quaternion();
    let agitate = 0, held = false, half = { x: 1, y: 1 };
    return {
      scene, camera,
      resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); half = frustumHalf(camera); },
      update(dt, t, lp) {
        u.uTime.value = t;
        const r = Math.min(half.x, half.y) * 0.6;
        mesh.scale.setScalar(r);
        const tx = lp.inside ? lp.nx * half.x * 0.12 : 0, ty = lp.inside ? lp.ny * half.y * 0.12 : 0;
        mesh.position.x = U.damp(mesh.position.x, tx, 3, dt);
        mesh.position.y = U.damp(mesh.position.y, ty, 3, dt);
        mesh.rotation.y += dt * 0.18;
        mesh.rotation.x = U.damp(mesh.rotation.x, lp.inside ? -lp.ny * 0.4 : 0, 2, dt);
        agitate = U.damp(agitate, held ? 1 : 0, held ? 3 : 1.5, dt);
        u.uAmp.value = 0.18 + agitate * 0.22;
        u.uSpeed.value = 0.34 + agitate * 0.5;
        const px = lp.inside ? lp.nx * half.x : Math.sin(t * 0.6) * half.x * 0.5;
        const py = lp.inside ? lp.ny * half.y : Math.cos(t * 0.45) * half.y * 0.4;
        dir.set(px - mesh.position.x, py - mesh.position.y, r * 0.9).normalize();
        q.copy(mesh.quaternion).invert();
        dir.applyQuaternion(q);
        u.uMouseDir.value.lerp(dir, 1 - Math.exp(-7 * dt)).normalize();
        u.uMouseAmt.value = U.damp(u.uMouseAmt.value, lp.inside ? 0.3 : 0.08, 3, dt);
        u.uPulseT.value += dt;
        u.uPulse.value *= Math.exp(-0.9 * dt);
        scene.environmentRotation.y = t * 0.12;
      },
      down() {
        held = true;
        u.uPulse.value = 1.6; u.uPulseT.value = 0; u.uPulseDir.value.copy(u.uMouseDir.value);
      },
      up() { held = false; }
    };
  }

  /* =========================================================
     05 PHYSICS — spheres drawn to the cursor, colliding
     ========================================================= */
  function Gravity() {
    const scene = baseScene();
    scene.environment = M.makeEnv(renderer, 'dark');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 14);
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(-4, 6, 8);
    scene.add(key);
    const N = env.mobile ? 11 : 15;
    const rnd = U.mulberry(3);
    const types = [
      new THREE.MeshPhysicalMaterial({ color: 0xf4f4f4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 }),
      new THREE.MeshPhysicalMaterial({ color: 0x0d0d0e, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 })
    ];
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const balls = [];
    const counts = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      const ty = i % 3;
      balls.push({ ty, idx: counts[ty]++, r: 0.28 + rnd() * 0.42, p: new THREE.Vector2(U.rand(-3, 3), U.rand(-2, 2)), v: new THREE.Vector2() });
    }
    const meshes = types.map((m, i) => {
      const im = new THREE.InstancedMesh(geo, m, counts[i]);
      im.frustumCulled = false;
      scene.add(im);
      return im;
    });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v3 = new THREE.Vector3();
    const att = new THREE.Vector2(), tmp = new THREE.Vector2();
    let half = { x: 1, y: 1 };
    return {
      scene, camera,
      resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); half = frustumHalf(camera); },
      update(dt, t, lp) {
        const k = Math.min(half.x, half.y) / 3.8;
        if (lp.inside) att.set(lp.nx * half.x, lp.ny * half.y);
        else att.set(Math.cos(t * 0.5) * half.x * 0.25, Math.sin(t * 0.7) * half.y * 0.2);
        const steps = 2, h = dt / steps;
        for (let st = 0; st < steps; st++) {
          for (const b of balls) {
            tmp.subVectors(att, b.p);
            const d = tmp.length() + 0.0001;
            const f = Math.min(d, 3.5) * (lp.inside ? 7 : 3.5);
            b.v.addScaledVector(tmp, (f / d) * h);
            b.v.multiplyScalar(Math.exp(-1.8 * h));
          }
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
            const a = balls[i], c = balls[j];
            tmp.subVectors(c.p, a.p);
            const d = tmp.length(), min = (a.r + c.r) * k;
            if (d < min && d > 0.0001) {
              tmp.divideScalar(d);
              const o = (min - d) * 0.5;
              a.p.addScaledVector(tmp, -o); c.p.addScaledVector(tmp, o);
              const rv = (c.v.x - a.v.x) * tmp.x + (c.v.y - a.v.y) * tmp.y;
              if (rv < 0) {
                const imp = -rv * 0.7;
                a.v.addScaledVector(tmp, -imp); c.v.addScaledVector(tmp, imp);
              }
            }
          }
          for (const b of balls) {
            b.p.addScaledVector(b.v, h);
            const rr = b.r * k;
            if (b.p.x < -half.x + rr) { b.p.x = -half.x + rr; b.v.x = Math.abs(b.v.x) * 0.6; }
            if (b.p.x > half.x - rr) { b.p.x = half.x - rr; b.v.x = -Math.abs(b.v.x) * 0.6; }
            if (b.p.y < -half.y + rr) { b.p.y = -half.y + rr; b.v.y = Math.abs(b.v.y) * 0.6; }
            if (b.p.y > half.y - rr) { b.p.y = half.y - rr; b.v.y = -Math.abs(b.v.y) * 0.6; }
          }
        }
        for (const b of balls) {
          s.setScalar(b.r * k);
          m4.compose(v3.set(b.p.x, b.p.y, 0), q, s);
          meshes[b.ty].setMatrixAt(b.idx, m4);
        }
        meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
      },
      down(lp) {
        const px = lp.nx * half.x, py = lp.ny * half.y;
        for (const b of balls) {
          tmp.set(b.p.x - px, b.p.y - py);
          const d = tmp.length() + 0.3;
          b.v.addScaledVector(tmp.normalize(), 26 / d);
        }
      }
    };
  }

  /* =========================================================
     04 DISTORTION — a lens that bends an image, click to change it
     ========================================================= */
  function Refract() {
    const scene = baseScene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const names = ['still-hero', 'lumen-a', 'meridian-1', 'orbit-1'].filter((n) => APP.baker.canvases[n]);
    const texs = names.map((n) => {
      const t = new THREE.CanvasTexture(APP.baker.canvases[n]);
      t.colorSpace = THREE.NoColorSpace;
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      return t;
    });
    const size = (i) => new THREE.Vector2(APP.baker.canvases[names[i]].width, APP.baker.canvases[names[i]].height);
    let cur = 0;
    const u = {
      uTex0: { value: texs[0] }, uTex1: { value: texs[1 % texs.length] },
      uImg0: { value: size(0) }, uImg1: { value: size(1 % texs.length) },
      uMix: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uVel: { value: new THREE.Vector2() },
      uHover: { value: 0 }, uTime: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D uTex0, uTex1; uniform vec2 uImg0, uImg1, uRes, uMouse, uVel;
        uniform float uMix, uHover, uTime;
        ${M.NOISE}
        vec2 cover(vec2 uv, vec2 img){
          float rs = uRes.x / uRes.y, ri = img.x / img.y;
          vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
          return (uv - 0.5) * s * 0.94 + 0.5;
        }
        vec3 sampleRGB(sampler2D t, vec2 img, vec2 uv, vec2 sh){
          return vec3(texture2D(t, cover(uv + sh, img)).r, texture2D(t, cover(uv, img)).g, texture2D(t, cover(uv - sh, img)).b);
        }
        void main(){
          vec2 asp = vec2(uRes.x / uRes.y, 1.0);
          vec2 d = (vUv - uMouse) * asp;
          float r = length(d);
          float R = 0.34;
          float lens = smoothstep(R, R * 0.2, r) * uHover;
          float n = snoise(vec3(vUv * 3.2, uTime * 0.25));
          vec2 uv = vUv - (d / asp) * lens * 0.38 + vec2(n, -n) * 0.012 * lens;
          float tn = snoise(vec3(vUv * 2.4, 3.0)) * 0.5 + 0.5;
          float m = smoothstep(tn, tn + 0.22, uMix * 1.25);
          float wob = m * (1.0 - m);
          uv += vec2(snoise(vec3(vUv * 4.0, uTime)), snoise(vec3(vUv * 4.0 + 7.0, uTime))) * wob * 0.06;
          vec2 sh = uVel * (0.5 * lens + 0.04) + vec2(lens * 0.004, 0.0);
          vec3 a = sampleRGB(uTex0, uImg0, uv, sh);
          vec3 b = sampleRGB(uTex1, uImg1, uv, sh);
          vec3 col = mix(a, b, m);
          float rim = smoothstep(0.012, 0.0, abs(r - R * 0.62)) * uHover * 0.07;
          col += rim;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    q.frustumCulled = false;
    scene.add(q);
    const target = new THREE.Vector2(0.5, 0.5), last = new THREE.Vector2(0.5, 0.5), vel = new THREE.Vector2();
    let busy = false, lastInteract = 0;
    function next(t) {
      if (busy || texs.length < 2) return;
      busy = true;
      lastInteract = t;
      gsap.to(u.uMix, {
        value: 1, duration: 1.5, ease: 'power2.inOut',
        onComplete() {
          cur = (cur + 1) % texs.length;
          u.uTex0.value = texs[cur]; u.uImg0.value = size(cur);
          const n = (cur + 1) % texs.length;
          u.uTex1.value = texs[n]; u.uImg1.value = size(n);
          u.uMix.value = 0;
          busy = false;
        }
      });
    }
    return {
      scene, camera,
      resize(w, h) { u.uRes.value.set(w, h); },
      update(dt, t, lp) {
        u.uTime.value = t;
        if (lp.inside) { target.set(lp.x / u.uRes.value.x, 1 - lp.y / u.uRes.value.y); lastInteract = t; }
        const m = u.uMouse.value;
        m.lerp(target, 1 - Math.exp(-7 * dt));
        vel.set(m.x - last.x, m.y - last.y).multiplyScalar(1 / Math.max(dt, 1e-3) * 0.02);
        u.uVel.value.lerp(vel, 1 - Math.exp(-8 * dt));
        last.copy(m);
        u.uHover.value = U.damp(u.uHover.value, lp.inside ? 1 : 0, 4, dt);
        if (t - lastInteract > 6) next(t);
      },
      down(lp, t) { next(t); }
    };
  }

  const FACTORY = { field: Field, liquid: Liquid, gravity: Gravity, refract: Refract };

  /* ---------- manager ---------- */
  X.init = function (r) {
    renderer = r;
    buildMask();
    U.qsa('[data-xp]').forEach((el) => {
      const make = FACTORY[el.dataset.xp];
      if (!make) return;
      const xp = make();
      xp.el = el;
      xp.w = 0; xp.h = 0;
      xp.ptr = { x: 0, y: 0, nx: 0, ny: 0, inside: false };
      xp.visible = false;
      xp.fade = 1;
      el.addEventListener('pointerdown', () => {
        if (!xp.visible) return;
        updatePtr(xp, el.getBoundingClientRect());
        xp.ptr.inside = true;
        xp.down && xp.down(xp.ptr, X.time || 0);
      });
      const up = () => xp.up && xp.up();
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointercancel', up);
      X.list.push(xp);
    });
  };

  function updatePtr(xp, r) {
    const lp = xp.ptr;
    lp.x = P.x - r.left;
    lp.y = P.y - r.top;
    lp.inside = P.live() && lp.x >= 0 && lp.y >= 0 && lp.x <= r.width && lp.y <= r.height;
    lp.nx = (lp.x / r.width) * 2 - 1;
    lp.ny = -((lp.y / r.height) * 2 - 1);
  }

  X.resize = function () { X.list.forEach((xp) => { xp.w = 0; }); };

  // is any study on screen? (lets the stage stop drawing when only the backdrop shows)
  X.peek = function (W, H) {
    for (const xp of X.list) {
      if (xp.fade <= 0.001) continue;
      const b = xp.el.getBoundingClientRect();
      if (b.bottom > 0 && b.top < H && b.right > 0 && b.left < W && b.width >= 2) return true;
    }
    return false;
  };

  X.render = function (r, dt, t, W, H) {
    X.time = t;
    let any = false;
    const radius = U.clamp(W * 0.019, 18, 30);
    for (const xp of X.list) {
      const b = xp.el.getBoundingClientRect();
      if (b.bottom <= 0 || b.top >= H || b.right <= 0 || b.left >= W || b.width < 2 || xp.fade <= 0.001) { xp.visible = false; continue; }
      xp.visible = true;
      any = true;
      if (Math.abs(b.width - xp.w) > 1 || Math.abs(b.height - xp.h) > 1) { xp.w = b.width; xp.h = b.height; xp.resize(b.width, b.height); }
      updatePtr(xp, b);
      xp.update(dt, t, xp.ptr);
      const x = b.left, y = H - b.bottom;
      r.setViewport(x, y, b.width, b.height);
      r.setScissor(x, y, b.width, b.height);
      r.setScissorTest(true);
      r.render(xp.scene, xp.camera);
      maskU.uSize.value.set(b.width, b.height);
      maskU.uRadius.value = radius;
      maskU.uPx.value = 1 / r.getPixelRatio();
      maskU.uFade.value = xp.fade;
      const c = APP.bgState;
      maskU.uBg.value.set(c[0], c[1], c[2]);
      r.render(maskScene, maskCam);
    }
    if (any) {
      r.setScissorTest(false);
      r.setViewport(0, 0, W, H);
    }
  };

  // warm up every program so the first reveal is instant
  X.compile = async function (r) {
    const tmp = { x: 0, y: 0, nx: 0, ny: 0, inside: false };
    for (const xp of X.list) {
      xp.resize(400, 400);
      xp.update(1 / 60, 0, tmp);
      try { await r.compileAsync(xp.scene, xp.camera); } catch (e) { /* lazy */ }
      xp.w = 0;
    }
    r.setScissorTest(true);
    r.setViewport(0, 0, 1, 1);
    r.setScissor(0, 0, 1, 1);
    for (const xp of X.list) r.render(xp.scene, xp.camera);
    r.render(maskScene, maskCam);
    r.setScissorTest(false);
  };
})();
