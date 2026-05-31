import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------------------------------------------------------------------------
// Reusable three.js engine. Each page calls mountScene(canvas, config) once:
//   - config = a scene object (see scenes.js) → stars + that model, with the
//     cinematic fly-in and the scene's orbit / interactive / focus behaviour.
//   - config = null → stars only (splash, gallery, making-of), gently drifting.
// This is the old main.js machinery minus the scroll-driven scene switching:
// there is now exactly one scene per page, visible from load.
// ---------------------------------------------------------------------------

const INTRO_DURATION = 3.0;            // seconds for the cinematic fly-in
const CAMERA_LERP = 2.5;               // how quickly the camera eases to its target
const PLACEHOLDER_COLOR = 0x2a3550;
const ORBIT_SPEED = 0.006;             // radians of orbit per pixel of horizontal drag
const ZOOM_SPEED = 0.003;              // zoom step per pixel of vertical drag (up = closer)

export function mountScene(canvas, cfg = null) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.add(makeStars());

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);

  // Soft fill + strong key for that hard, sunlit-in-space look.
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
  keyLight.position.set(5, 4, 6);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x4ea1ff, 1.0);
  rimLight.position.set(-6, 2, -4);
  scene.add(rimLight);

  // The model(s) for this page live in one group (always visible).
  const group = new THREE.Group();
  scene.add(group);

  if (cfg) {
    const loader = new GLTFLoader();
    // A single-file scene is just a one-body scene.
    const bodies = cfg.bodies ?? [{ name: cfg.name, file: cfg.file, ground: cfg.ground }];
    bodies.forEach((body) => {
      loader.load(
        body.file,
        (gltf) => addModel(group, gltf.scene, body, renderer),
        undefined,
        () => {
          console.warn(`Missing ${body.file} — showing placeholder for "${body.name}".`);
          addModel(group, makePlaceholder(), body, renderer);
        }
      );
    });
    // Interactive scenes track their own dolly; focus scenes start on body 0.
    if (cfg.interactive) cfg.zoom = cfg.zoomStart ?? (cfg.zoomMin + cfg.zoomMax) / 2;
    if (cfg.focus) cfg.focusBody = 0;
  }

  // -------------------------------------------------------------------------
  // Pointer interaction. Interactive scenes: horizontal drag orbits, vertical
  // drag dollies; the wheel is left alone so it keeps scrolling the page. Focus
  // scenes: a click advances to the next body. Listeners are on window (the
  // page content sits above the canvas and would otherwise swallow them).
  // -------------------------------------------------------------------------
  let dragging = false;
  let lastDrag = { x: 0, y: 0 };
  let azimuth = 0;

  const setCursor = () => {
    document.body.style.cursor = cfg?.interactive ? (dragging ? 'grabbing' : 'grab')
      : cfg?.focus ? 'pointer' : '';
  };

  if (cfg?.interactive || cfg?.focus) {
    window.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (cfg.focus) { cfg.focusBody = (cfg.focusBody + 1) % cfg.bodies.length; return; }
      dragging = true;
      lastDrag = { x: e.clientX, y: e.clientY };
      setCursor();
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      azimuth -= (e.clientX - lastDrag.x) * ORBIT_SPEED;
      cfg.zoom = THREE.MathUtils.clamp(cfg.zoom + (e.clientY - lastDrag.y) * ZOOM_SPEED, cfg.zoomMin, cfg.zoomMax);
      lastDrag = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', () => { dragging = false; setCursor(); });
    window.addEventListener('pointercancel', () => { dragging = false; setCursor(); });
    setCursor();
  }

  // -------------------------------------------------------------------------
  // Camera animation: a slow orbit eased toward the scene's framing, preceded
  // by a one-time cinematic fly-in that starts further out and higher.
  // -------------------------------------------------------------------------
  const clock = new THREE.Clock();
  let introElapsed = 0;
  const camTarget = new THREE.Vector3();

  function desiredCameraPosition(intro, zoom = 1) {
    const introT = Math.min(introElapsed / INTRO_DURATION, 1);
    const ease = 1 - Math.pow(1 - introT, 3); // easeOutCubic
    const base = cfg.distance * zoom;
    const distance = intro ? THREE.MathUtils.lerp(base * 4, base, ease) : base;
    const height = intro ? THREE.MathUtils.lerp(cfg.height + 1.2, cfg.height, ease) : cfg.height;
    return new THREE.Vector3(
      Math.sin(azimuth) * distance,
      height,
      Math.cos(azimuth) * distance
    );
  }

  // Park the camera in high orbit over the focused body, looking down while it
  // spins underneath. Distance/height scale with the body's size so a click
  // glides the camera across to the (smaller) Moon and it still fills the frame.
  function focusFraming() {
    const body = cfg.bodies[cfg.focusBody];
    const s = body.scale ?? 1;
    const look = new THREE.Vector3(...body.position);
    const position = look.clone().add(new THREE.Vector3(0, cfg.height * s, cfg.distance * s));
    return { position, look };
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    // Stars-only page: drift gently through the field, looking at the origin.
    if (!cfg) {
      azimuth += dt * 0.02;
      const k = 1 - Math.exp(-CAMERA_LERP * dt);
      camera.position.lerp(new THREE.Vector3(Math.sin(azimuth) * 2.6, 0.3, Math.cos(azimuth) * 2.6), k);
      camTarget.lerp(new THREE.Vector3(0, 0, 0), k);
      camera.lookAt(camTarget);
      renderer.render(scene, camera);
      return;
    }

    introElapsed = Math.min(introElapsed + dt, INTRO_DURATION);
    const intro = introElapsed < INTRO_DURATION;

    let target, lookTarget;
    if (cfg.focus && !intro) {
      // Bodies self-rotate; the camera sits over the focused one (eases across
      // on a click). During the intro this falls through to the orbit path.
      group.children.forEach((c) => { c.rotation.y += dt * (c.userData.spin || 0); });
      const framing = focusFraming();
      target = framing.position;
      lookTarget = framing.look;
    } else if (cfg.interactive) {
      if (!dragging) azimuth += dt * (cfg.spin || 0);
      target = desiredCameraPosition(intro, cfg.zoom);
      lookTarget = new THREE.Vector3(0, (cfg.height || 0) * 0.3, 0);
    } else {
      const spin = cfg.spin || 0;
      azimuth += dt * spin;
      group.rotation.y += dt * spin;
      target = desiredCameraPosition(intro);
      lookTarget = new THREE.Vector3(0, (cfg.height || 0) * 0.3, 0);
    }

    const k = intro ? 1 : 1 - Math.exp(-CAMERA_LERP * dt);
    camera.position.lerp(target, k);
    camTarget.lerp(lookTarget, k);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

// Normalise a loaded model to unit size, then place it per the body's
// position/scale. Scaling first, then centering, keeps the body centered on its
// target position regardless of the export's origin.
function addModel(group, object, body = {}, renderer) {
  // Exported GLBs often ship punctual lights that blow out the exposure
  // alongside our own key/fill. Strip them so only our lighting applies.
  const embeddedLights = [];
  object.traverse((o) => { if (o.isLight) embeddedLights.push(o); });
  embeddedLights.forEach((l) => l.parent?.remove(l));

  // Drop stray nodes that would wreck the bounding-box normalisation below
  // (addModel measures the whole bbox, so a far-flung node shrinks the body).
  if (body.strip) {
    const drop = [];
    object.traverse((o) => { if (body.strip.includes(o.name)) drop.push(o); });
    drop.forEach((o) => o.parent?.remove(o));
  }

  // Optional whole-model bump map, e.g. the Moon's surface relief.
  if (body.bump) {
    const bumpMap = new THREE.TextureLoader().load(body.bump, (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    object.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material.bumpMap = bumpMap;
        o.material.bumpScale = body.bumpScale ?? 1;
        o.material.needsUpdate = true;
      }
    });
  }

  // Per-mesh material overrides, keyed by GLB node name. Colour maps are sRGB;
  // bump maps are linear data, so they're tagged NoColorSpace.
  if (body.parts) {
    const texLoader = new THREE.TextureLoader();
    const loadTex = (file, colorSpace) => texLoader.load(file, (t) => {
      t.colorSpace = colorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    object.traverse((o) => {
      const spec = o.isMesh && body.parts[o.name];
      if (!spec || !o.material) return;
      const m = o.material;
      if (spec.map) m.map = loadTex(spec.map, THREE.SRGBColorSpace);
      if (spec.bumpMap) { m.bumpMap = loadTex(spec.bumpMap, THREE.NoColorSpace); m.bumpScale = spec.bumpScale ?? 1; }
      if (spec.color !== undefined) m.color = new THREE.Color(spec.color);
      if (spec.roughness !== undefined) m.roughness = spec.roughness;
      if (spec.metalness !== undefined) m.metalness = spec.metalness;
      if (spec.transparent) { m.transparent = true; m.opacity = spec.opacity ?? 1; }
      if (spec.depthWrite !== undefined) m.depthWrite = spec.depthWrite;
      m.needsUpdate = true;
    });
  }

  // Measure the surface alone first, so its on-screen size matches body.scale
  // regardless of the (larger) shells added around it.
  let box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()).length() || 1;

  // Cloud / atmosphere shells wrap the surface; built before scaling so they
  // inherit the same normalisation and stay locked to the body.
  if (body.shells) addShells(object, body.shells, box, renderer);

  object.scale.setScalar((body.scale ?? 1) / size);

  box = new THREE.Box3().setFromObject(object);
  object.position.sub(box.getCenter(new THREE.Vector3()));
  if (body.position) object.position.add(new THREE.Vector3(...body.position));

  object.userData.spin = body.spin ?? 0;
  group.add(object);

  // Optional ground plane, parked at the base of the placed model to hide its
  // unfinished underside (e.g. the Saturn V stack).
  if (body.ground) addGround(group, object, body.ground);
}

// A large flat plane sitting at the bottom of the model's bounding box. It's
// sized well beyond the view (default 500 units) so its edges never appear —
// it reads as ground meeting the horizon. A tiny downward nudge avoids
// z-fighting with the model's lowest faces.
function addGround(group, object, opts = {}) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = opts.size ?? 500;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(opts.color ?? 0x3a7d44),
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  plane.rotation.x = -Math.PI / 2; // lay it flat (normal points up)
  plane.position.set(center.x, box.min.y + (opts.offset ?? -0.01), center.z);
  group.add(plane);
}

// Build cloud / atmosphere shells for a body and parent them to its surface (so
// they share its spin and normalisation). `surfaceBox` is the pre-scale surface
// box; shell `scale` is a multiple of the surface radius.
function addShells(parent, shells, surfaceBox, renderer) {
  const s = surfaceBox.getSize(new THREE.Vector3());
  const radius = Math.max(s.x, s.y, s.z) / 2;
  const center = surfaceBox.getCenter(new THREE.Vector3());
  shells.forEach((shell) => {
    const geo = new THREE.SphereGeometry(radius * (shell.scale ?? 1.01), 64, 48);
    let mat;
    if (shell.type === 'atmosphere') {
      mat = atmosphereMaterial(shell.color ?? 0x5b8bff, shell.opacity ?? 1);
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shell.color ?? 0xffffff),
        transparent: true,
        depthWrite: false,
        opacity: shell.opacity ?? 1,
      });
      const tex = new THREE.TextureLoader();
      const wire = (file, space, slot) => mat[slot] = tex.load(file, (t) => {
        t.colorSpace = space;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      });
      if (shell.map) wire(shell.map, THREE.SRGBColorSpace, 'map');
      if (shell.alphaMap) wire(shell.alphaMap, THREE.NoColorSpace, 'alphaMap');
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);
    parent.add(mesh);
  });
}

// Classic fresnel limb-glow: a back-faced sphere whose alpha ramps toward the
// silhouette, additively blended so it reads as atmosphere around the planet.
function atmosphereMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(uColor, clamp(intensity, 0.0, 1.0) * uOpacity);
      }`,
  });
}

function makePlaceholder() {
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: PLACEHOLDER_COLOR,
    metalness: 0.1,
    roughness: 0.6,
    wireframe: true,
  });
  return new THREE.Mesh(geo, mat);
}

function makeStars() {
  const count = 1500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Fixed pseudo-random distribution (no Math.random at module load).
    const r = 60 + (i % 40);
    const theta = i * 2.399963229; // golden angle
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}
