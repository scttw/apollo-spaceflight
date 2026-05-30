import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------------------------------------------------------------------------
// Scene config. Each entry is one homepage section. A scene either loads a
// single `file` (orbited automatically) or several `bodies` (each with its own
// position/scale within the scene). A `focus` scene frames one body at a time in
// high orbit while it rotates underneath; clicking switches to the next body. If
// a file is missing, a labelled placeholder is shown so the page still works.
// ---------------------------------------------------------------------------
const SCENES = [
  { name: 'Saturn V', file: './models/saturn%205.glb', distance: 2.4, height: 0.15, spin: 0.04, interactive: true, zoomMin: 0.10, zoomMax: 0.5, zoomStart: 0.266 },
  { name: 'F-1 Engine', file: './models/Rockodyne.glb', distance: 2.0, height: 0.05, spin: 0.10, interactive: true, zoomMin: 0.4, zoomMax: 1.8 },
  {
    name: 'Earth & Moon',
    focus: true,            // click switches which body the camera frames; it sits
    distance: 2.0,          // in high orbit while the body rotates underneath it
    height: 0.8,            // (distance/height scale with the focused body's size)
    bodies: [
      {
        // NASA "Earth_1_12756" ships embedded diffuse + normal maps, so the
        // surface needs no code-side texturing. The cloud and atmosphere layers
        // it lacks are rebuilt here as `shells` — spheres wrapped around the
        // normalised surface (scale is relative to the surface radius).
        name: 'Earth', file: './models/Earth_1_12756.glb', position: [-1.6, 0, 0], scale: 1.7, spin: 0.04,
        shells: [
          // Clouds.png is white-on-black with no alpha, so its luminance drives
          // an alphaMap over a white layer (black → clear gaps, white → cloud).
          { type: 'clouds', alphaMap: './models/earth/Clouds.png', color: 0xffffff, scale: 1.012 },
          { type: 'atmosphere', color: 0x5b8bff, scale: 1.06, opacity: 0.32 },
        ],
      },
      { name: 'Moon', file: './models/moon.glb', position: [1.7, -0.1, -0.6], scale: 0.55, spin: 0.03, bump: './models/moon_bump.jpg', bumpScale: 5 },
    ],
  },
];

const INTRO_DURATION = 3.0;            // seconds for the cinematic fly-in
const CAMERA_LERP = 2.5;              // how quickly the camera eases to its target
const PLACEHOLDER_COLOR = 0x2a3550;

const canvas = document.getElementById('scene');
const scrollHint = document.querySelector('.scroll-hint');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

// Subtle starfield for depth.
scene.add(makeStars());

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);

// Lighting: a soft fill plus a strong key light for that hard, sunlit-in-space look.
scene.add(new THREE.AmbientLight(0xffffff, 0.12));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.position.set(5, 4, 6);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x4ea1ff, 1.0);
rimLight.position.set(-6, 2, -4);
scene.add(rimLight);

// Each scene lives in its own group, normalised to unit size and centered.
// Only the active scene's group is visible.
const groups = SCENES.map(() => new THREE.Group());
groups.forEach((g) => { g.visible = false; scene.add(g); });

const loader = new GLTFLoader();
SCENES.forEach((cfg, i) => {
  // A single-file scene is just a one-body scene.
  const bodies = cfg.bodies ?? [{ name: cfg.name, file: cfg.file }];
  bodies.forEach((body) => {
    loader.load(
      body.file,
      (gltf) => addModel(groups[i], gltf.scene, body),
      undefined,
      () => {
        console.warn(`Missing ${body.file} — showing placeholder for "${body.name}".`);
        addModel(groups[i], makePlaceholder(), body);
      }
    );
  });
});

// Normalise a loaded model to unit size, then place it within the scene group
// per the body's position/scale. Scaling first, then centering, keeps the body
// exactly centered on its target position regardless of the export's origin.
function addModel(group, object, body = {}) {
  // Exported GLBs often ship their own punctual lights; combined with the
  // scene's key/fill lights they blow out the exposure. Strip them so only our
  // lighting applies (same fix as ../three-js-demo). No-op for models without
  // embedded lights, e.g. the Saturn V.
  const embeddedLights = [];
  object.traverse((o) => { if (o.isLight) embeddedLights.push(o); });
  embeddedLights.forEach((l) => l.parent?.remove(l));

  // Some exports bundle stray helper meshes that wreck the bounding-box
  // normalisation below — the Earth model ships a "sun" mesh parked ~3900 units
  // from the origin, which would otherwise blow the bbox out and shrink the
  // visible planet to a few pixels. Drop any nodes named in body.strip first.
  if (body.strip) {
    const drop = [];
    object.traverse((o) => { if (body.strip.includes(o.name)) drop.push(o); });
    drop.forEach((o) => o.parent?.remove(o));
  }

  // Optional surface relief, e.g. the Moon's bump map (matches ../three-js-demo).
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

  // Per-mesh material overrides (body.parts), keyed by node name. The Earth GLB
  // ships untextured, with separate surface / clouds / atmosphere shells — this
  // hangs the right texture (or tint) on each. Colour maps are sRGB; bump maps
  // are linear data, so they're tagged NoColorSpace.
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

  // Measure the surface alone first, so its on-screen size still matches
  // `body.scale` regardless of the (larger) shells added around it.
  let box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()).length() || 1;

  // Cloud / atmosphere shells wrap the surface (see body.shells). Built before
  // scaling so they inherit the same normalisation and stay locked to the body.
  if (body.shells) addShells(object, body.shells, box);

  object.scale.setScalar((body.scale ?? 1) / size);

  box = new THREE.Box3().setFromObject(object);
  object.position.sub(box.getCenter(new THREE.Vector3()));
  if (body.position) object.position.add(new THREE.Vector3(...body.position));

  object.userData.spin = body.spin ?? 0;
  group.add(object);
}

// Build the cloud / atmosphere shells for a body and parent them to its surface
// (so they share its spin and normalisation). `surfaceBox` is the surface's
// pre-scale bounding box; shell `scale` is a multiple of the surface radius.
function addShells(parent, shells, surfaceBox) {
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
    // Fixed pseudo-random distribution (no Math.random dependency at module load).
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

// ---------------------------------------------------------------------------
// Scroll → active scene. The page leads with HERO_PANELS full-height hero
// section(s) that show no model (just the starfield), then one section per
// scene. While the hero is on screen activeIndex is -1 and every model group
// is hidden, so the launch complex only appears once the header scrolls away.
// ---------------------------------------------------------------------------
const HERO_PANELS = 1;
let activeIndex = -1;
function currentSceneIndex() {
  const panel = Math.round(window.scrollY / window.innerHeight);
  return Math.max(-1, Math.min(SCENES.length - 1, panel - HERO_PANELS));
}
window.addEventListener('scroll', () => {
  activeIndex = currentSceneIndex();
  if (scrollHint) scrollHint.style.opacity = window.scrollY > 40 ? '0' : '';
  updateCursor();
}, { passive: true });

// ---------------------------------------------------------------------------
// Click-drag orbit/zoom for `interactive` scenes: horizontal drag orbits the
// camera, vertical drag zooms (dollies) it. The wheel is left alone so it keeps
// scrolling the page between sections.
// ---------------------------------------------------------------------------
const ORBIT_SPEED = 0.006;   // radians of orbit per pixel of horizontal drag
const ZOOM_SPEED = 0.003;    // zoom step per pixel of vertical drag (up = closer)
let dragging = false;
let lastDrag = { x: 0, y: 0 };

// Each interactive scene tracks its own dolly (cfg.zoom) within its own
// zoomMin/zoomMax range, starting at zoomStart (or the midpoint if unset).
SCENES.forEach((cfg) => { if (cfg.interactive) cfg.zoom = cfg.zoomStart ?? (cfg.zoomMin + cfg.zoomMax) / 2; });

// A focus scene starts on its first body (Earth); clicking advances to the next.
SCENES.forEach((cfg) => { if (cfg.focus) cfg.focusBody = 0; });

// Listen on window, not the canvas: the #content layer sits above the canvas
// and would otherwise swallow these events.
function updateCursor() {
  const cfg = SCENES[activeIndex];
  document.body.style.cursor = cfg?.interactive ? (dragging ? 'grabbing' : 'grab')
    : cfg?.focus ? 'pointer' : '';
}

window.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const cfg = SCENES[activeIndex];
  // Focus scenes aren't draggable — a click just switches to the next body.
  if (cfg?.focus) { cfg.focusBody = (cfg.focusBody + 1) % cfg.bodies.length; return; }
  if (!cfg?.interactive) return;
  dragging = true;
  lastDrag = { x: e.clientX, y: e.clientY };
  updateCursor();
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const cfg = SCENES[activeIndex];
  azimuth -= (e.clientX - lastDrag.x) * ORBIT_SPEED;
  cfg.zoom = THREE.MathUtils.clamp(cfg.zoom + (e.clientY - lastDrag.y) * ZOOM_SPEED, cfg.zoomMin, cfg.zoomMax);
  lastDrag = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', () => { dragging = false; updateCursor(); });
window.addEventListener('pointercancel', () => { dragging = false; updateCursor(); });

// ---------------------------------------------------------------------------
// Camera animation: a slow orbit, eased toward the active scene's framing,
// preceded by a one-time cinematic fly-in.
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let azimuth = 0;
let introElapsed = INTRO_DURATION; // intro is "done" until the first scene is revealed
let introArmed = true;             // becomes false once the intro has been triggered
const camTarget = new THREE.Vector3();

function desiredCameraPosition(cfg, intro, zoom = 1) {
  // Spherical orbit around the origin; the intro starts further out and higher.
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

// Focus framing: park the camera in high orbit over the focused body, looking
// down at it while it spins underneath. Distance/height scale with the body's
// size so Earth and the (smaller) Moon both fill the frame. The camera eases
// between bodies when the focus switches, so a click glides across to the other.
function focusFraming(cfg) {
  const body = cfg.bodies[cfg.focusBody];
  const s = body.scale ?? 1;
  const look = new THREE.Vector3(...body.position);
  const position = look.clone().add(
    new THREE.Vector3(0, cfg.height * s, cfg.distance * s)
  );
  return { position, look };
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  // Hero (header) on screen: hide every model, drift gently through the stars.
  if (activeIndex < 0) {
    groups.forEach((g) => { g.visible = false; });
    azimuth += dt * 0.02;
    const k = 1 - Math.exp(-CAMERA_LERP * dt);
    camera.position.lerp(new THREE.Vector3(Math.sin(azimuth) * 2.6, 0.3, Math.cos(azimuth) * 2.6), k);
    camTarget.lerp(new THREE.Vector3(0, 0, 0), k);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
    return;
  }

  // Arm the one-time cinematic fly-in the first time a scene is revealed.
  if (introArmed) { introElapsed = 0; introArmed = false; }
  introElapsed = Math.min(introElapsed + dt, INTRO_DURATION);

  const cfg = SCENES[activeIndex];
  const intro = introElapsed < INTRO_DURATION;

  // Show only the active group.
  groups.forEach((g, i) => { g.visible = (i === activeIndex); });

  let target, lookTarget;
  if (cfg.focus && !intro) {
    // Bodies self-rotate in place; the camera sits in high orbit over the
    // focused one and eases across when a click switches the focus.
    groups[activeIndex].children.forEach((c) => { c.rotation.y += dt * (c.userData.spin || 0); });
    const framing = focusFraming(cfg);
    target = framing.position;
    lookTarget = framing.look;
  } else if (cfg.interactive) {
    // User orbits/zooms by dragging; idle auto-orbit continues when not dragging.
    if (!dragging) azimuth += dt * (cfg.spin || 0);
    target = desiredCameraPosition(cfg, intro, cfg.zoom);
    lookTarget = new THREE.Vector3(0, (cfg.height || 0) * 0.3, 0);
  } else {
    // Gentle continuous orbit + per-scene model spin.
    const spin = cfg.spin || 0;
    azimuth += dt * spin;
    groups[activeIndex].rotation.y += dt * spin;
    target = desiredCameraPosition(cfg, intro);
    lookTarget = new THREE.Vector3(0, (cfg.height || 0) * 0.3, 0);
  }

  // Ease camera toward the desired framing.
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

// Start at the top on (re)load: the hero is shown first and the cinematic
// fly-in plays when the user scrolls down to reveal the first scene.
window.scrollTo(0, 0);
updateCursor();
animate();
