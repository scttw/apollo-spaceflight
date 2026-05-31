// ---------------------------------------------------------------------------
// Scene configs, keyed by page id. Each 3D page imports the one it needs and
// hands it to mountScene(). A config is either single-body (`file`) or
// multi-body (`bodies: [...]`), plus camera framing (`distance`, `height`,
// `spin`). See scene.js for how these fields drive loading and the camera.
//
// GLB filenames with spaces are URL-encoded (`saturn%205.glb`). Texture files
// must live under the served root (`models/…`) to load over HTTP.
// ---------------------------------------------------------------------------
export const SCENES = {
  'saturn-v': {
    name: 'Saturn V',
    file: './models/saturn%205.glb',
    distance: 2.4, height: 0.15, spin: 0.04,
    interactive: true, zoomMin: 0.10, zoomMax: 0.5, zoomStart: 0.266,
  },

  'f1-engine': {
    name: 'F-1 Engine',
    file: './models/Rockodyne.glb',
    distance: 2.0, height: 0.05, spin: 0.10,
    interactive: true, zoomMin: 0.4, zoomMax: 1.8,
  },

  'earth-moon': {
    name: 'Earth & Moon',
    focus: true,            // click switches which body the camera frames; it sits
    distance: 2.0,          // in high orbit while the body rotates underneath it
    height: 0.8,            // (distance/height scale with the focused body's size)
    bodies: [
      {
        // Earth_1_12756.glb ships embedded diffuse + normal maps, so the surface
        // needs no code-side texturing. The cloud and atmosphere layers it lacks
        // are rebuilt here as `shells` wrapped around the normalised surface.
        name: 'Earth', file: './models/Earth_1_12756.glb', position: [-1.6, 0, 0], scale: 1.7, spin: 0.04,
        shells: [
          // Clouds.png is white-on-black with no alpha, so its luminance drives
          // an alphaMap over a white layer (black → clear, white → cloud).
          { type: 'clouds', alphaMap: './models/earth/Clouds.png', color: 0xffffff, scale: 1.012 },
          { type: 'atmosphere', color: 0x5b8bff, scale: 1.06, opacity: 0.32 },
        ],
      },
      { name: 'Moon', file: './models/moon.glb', position: [1.7, -0.1, -0.6], scale: 0.55, spin: 0.03, bump: './models/moon_bump.jpg', bumpScale: 5 },
    ],
  },
};
