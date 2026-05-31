# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A no-build, multi-page three.js site telling the Apollo story. Each topic is its own HTML page; a three.js starfield (plus, on the story pages, one 3D model) renders on a fixed `<canvas>` behind the page content. Pure ES modules loaded from a CDN via importmap — there is no `package.json`, no bundler, and no `node_modules`. Editing the source files is the entire workflow; there is nothing to compile.

## Commands

ES modules and GLB loading require HTTP — opening a page over `file://` will fail. Serve the project root:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

There are no tests, linters, or build steps.

## Pages & navigation

Six static HTML pages, in linear order: `index.html` (splash), `saturn-v.html`, `f1-engine.html`, `earth-moon.html`, `gallery.html`, `making-of.html`. The first four are full-viewport panels (stars or a 3D scene behind a text well); the last two are scrolling content pages (stars behind a `.scroll-page` of wells / a gallery grid / prose).

- **`PAGES` (top of `chrome.js`) is the nav's single source of truth.** It defines page order, hrefs, and menu labels. `chrome.js` runs on every page, reads `document.body.dataset.page` (each page sets `<body data-page="…">`), and injects two fixed bars: a **header** (APOLLO wordmark + a menu linking every page, current one marked `.active`) and a **footer** (`← prev` / `next →` from the neighbours in `PAGES`; a missing neighbour leaves an invisible `.spacer`). To add or reorder pages, edit `PAGES` and add a matching HTML file with the right `data-page`.
- Because there are no server includes (GitHub Pages, Jekyll disabled), the shared chrome is injected by JS rather than duplicated into each file. The per-page HTML is a thin shell: importmap, canvas, content, and a `<script type="module">` that calls `mountScene` (and, on the gallery, `gallery.js`), plus `chrome.js`.

## 3D engine (`scene.js` + `scenes.js`)

`scene.js` exports `mountScene(canvas, config)`, called once per page:

- **`config = null` → stars only** (splash, gallery, making-of): the camera drifts gently through a golden-angle starfield.
- **`config = a scene object` → stars + that model** with a one-time cinematic fly-in (`INTRO_DURATION`) and the scene's camera behaviour. There is exactly one scene per page (no scroll-driven switching).

`scenes.js` holds the scene configs in a **`SCENES` map keyed by page id**; each 3D page imports the one it needs (`SCENES['saturn-v']` etc.). A config is single-body (`file`) or multi-body (`bodies: [...]`), plus framing (`distance`, `height`, `spin`). Models: `saturn%205.glb` (note the literal space, URL-encoded `%20`), `Rockodyne.glb` (the F-1 engine), `Earth_1_12756.glb`, `moon.glb`. `models/earth model.glb` and `models/Rockodyne.blend1` are leftovers, not loaded.

- **`addModel` normalises every body the same way**: strip embedded lights, drop `body.strip` nodes, apply textures, scale to unit size *then* re-center (order matters — keeps a body centered on its target `position` regardless of the export's origin), then apply per-body `position`/`scale`/`spin`. So `distance`/`height` are comparable across scenes regardless of source scale.
- **`body.strip` guards bounding-box normalisation.** `addModel` measures the whole bbox, so a stray far-flung node shrinks the visible body to a few pixels (scaling up just scales the oversized box, camera and all). `strip: ['nodeName']` drops nodes *before* measuring. `Earth_1_12756.glb` needs no strip, but the legacy `earth model.glb` shipped a `sun` mesh ~3900 units out — keep in mind when swapping in a new export.
- **Earth is layered: embedded surface + code-built shells.** `Earth_1_12756.glb` ships its own diffuse + normal maps, so the *surface* needs no code-side texturing. The cloud and atmosphere layers it lacks are rebuilt in `addShells` as spheres wrapped around the normalised surface (`body.shells`), sized relative to the surface radius and parented to it so they share its spin. `Clouds.png` (in `models/earth/`) is white-on-black with no alpha, so its luminance drives an `alphaMap` over a white layer; the atmosphere is a back-faced fresnel limb-glow `ShaderMaterial` (`atmosphereMaterial`), additively blended. Shells are built from the *pre-scale* surface box so they stay locked to the body.
- **Other texturing paths.** `addModel` also supports a whole-model `bump` map (the Moon) and per-mesh `body.parts` overrides keyed by GLB node name. Across all paths, colour maps are tagged sRGB and bump/alpha maps `NoColorSpace`. Texture files must live under the served root (`models/…`) to load over HTTP.
- **Camera modes** (`animate()` branches on the config). Default: continuous spherical orbit (`azimuth`) eased toward the framing. `focus: true` (Earth & Moon): parks the camera in high orbit over one body (`focusFraming`) looking down while the body self-rotates (`userData.spin`); a click advances `cfg.focusBody` cyclically (modulo `bodies.length`) and the camera eases across. `interactive: true` (Saturn V, F-1): click-drag orbit + vertical-drag dolly within `zoomMin`/`zoomMax` (start `zoomStart`); the wheel is left alone so it keeps scrolling. Pointer listeners are on `window`, not the canvas, because the content layer sits above it.
- **Procedural, not keyframed.** Framing is eased each frame via exponential lerp; the intro starts further out/higher and eases in. During the intro even a `focus` scene falls back to the orbit path.
- **Missing models degrade gracefully.** `GLTFLoader`'s error callback routes a wireframe placeholder (`makePlaceholder`) through `addModel` so a page renders even when a `models/*.glb` is absent.
- **Determinism at module load.** `makeStars` uses a golden-angle distribution rather than `Math.random()`, so the starfield is identical every load.

## Gallery (`gallery.js` + `renders.js`)

`renders.js` is the **render manifest** (`RENDERS`: an array of `{ src, alt }`), shared by the gallery grid and the making-of page (currently the seven `.webp` exports in `renders/`). `gallery.js` builds a square-tile grid and a lightbox (arrow keys / on-screen buttons step through, Esc or backdrop click closes).

- **Thumbnails are pre-generated, not done in the browser.** The grid loads a square thumb derived from each `src` (`renders/foo.webp` → `renders/thumb/foo.webp`, via `thumbFor()` — extension preserved); the lightbox loads the full-size original. `make-thumbs.sh` (ImageMagick `mogrify`) builds `renders/thumb/` as 600×600 centre-crops from any `.jpg`/`.jpeg`/`.png`/`.webp` source, skipping up-to-date files. **Both the originals and the generated thumbs must be committed** — GitHub Pages serves them as-is, there is no build step. Run it after adding/replacing renders.
- **Grid fallback chain: thumb → full-size → numbered SVG placeholder** (`gallery.js`). So tiles still render if thumbs haven't been generated (just heavier), and the gallery stays reviewable before any real renders land. Drop files into `renders/` matching the manifest, or edit `renders.js` to list real filenames.

## Styling

One shared `style.css`. Key pieces: `.site-header` / `.page-nav` (the injected chrome — `pointer-events: none` on the bars, `auto` on the links, so canvas drag still works in the gaps); `.well` (the semi-opaque dark mask + blur that keeps text legible over the stars); `.scroll-page` (top/bottom padding clears the fixed chrome); `.gallery-grid` / `.tile` (1:1 tiles); `.lightbox`. The splash hides the small header wordmark (`body[data-page="index"] .wordmark`) since the giant hero title serves that role.

## Deploying

GitHub Pages from `main` / root. The empty `.nojekyll` file disables Jekyll so `models/*.glb` and `renders/*` are served untouched.
