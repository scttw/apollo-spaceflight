# apollo-spaceflight

A no-build [three.js](https://threejs.org/) site telling the Apollo story across several pages. Each page renders a starfield (and, on the story pages, one Blender-exported model) on a fixed canvas behind the content. Pure ES modules loaded from a CDN via importmap — no bundler, no `node_modules`.

## The pages

Six static pages, navigated by a shared header menu and prev/next buttons:

| Page | What's on it |
|------|--------------|
| `index.html` | Splash — APOLLO title + intro, over the stars |
| `saturn-v.html` | Saturn V on Launch Complex 39 (`models/saturn 5.glb`) |
| `f1-engine.html` | Rocketdyne F-1 engine (`models/Rockodyne.glb`) |
| `earth-moon.html` | Earth & Moon (`models/Earth_1_12756.glb` + `models/moon.glb`) |
| `gallery.html` | Grid of render images with a lightbox |
| `making-of.html` | How it was done (prose + images) |

The 3D scenes self-orbit with a cinematic fly-in; Saturn V and the F-1 are drag-to-orbit / drag-to-zoom, and the Earth & Moon page switches body on click. If a model file is missing, a wireframe placeholder is shown so the page still renders.

## Editing

- **Scenes & models** — `scenes.js` (the `SCENES` map, keyed by page) holds filenames and per-scene framing. The engine that consumes it is `scene.js`.
- **Navigation** — `chrome.js` (the `PAGES` array) defines page order, menu labels, and prev/next. To add a page, add an HTML file with a matching `<body data-page="…">` and a `PAGES` entry.
- **Gallery images** — drop renders into `renders/` named to match `renders.js` (`render-01.jpg`, …), or edit `renders.js` to list your own filenames. Numbered placeholders show until the files exist.

## Local preview

ES modules and model loading require HTTP (not `file://`). From the project root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploying to GitHub Pages

1. Push to `main`.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main` / root.
3. Served at `https://<user>.github.io/apollo-spaceflight/`.

The `.nojekyll` file stops GitHub Pages from running Jekyll, so `models/*.glb` and `renders/*` are served untouched.

## Structure

- `*.html` — one thin shell per page (importmap, canvas, content); shared chrome is injected by JS
- `scene.js` — the three.js engine: `mountScene(canvas, config)` (stars, model loading, camera, intro)
- `scenes.js` — scene/model configs, keyed by page
- `chrome.js` — injects the shared header menu + prev/next nav
- `gallery.js` / `renders.js` — gallery grid + lightbox, and the render manifest
- `style.css` — dark space theme, fixed canvas, content wells, gallery, lightbox
- `models/` — `.glb` exports and their loose textures (e.g. `models/earth/`)
- `renders/` — gallery render images
