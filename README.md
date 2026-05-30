# apollo-spaceflight

A no-build, scroll-driven [three.js](https://threejs.org/) homepage telling the Apollo story across three Blender-exported scenes. Pure ES modules loaded from a CDN via importmap — no bundler, no `node_modules`.

## The scenes

The homepage is a single scrolling page with one full-height section per scene. Scrolling eases the camera between them, after a one-time cinematic fly-in on load.

| # | Section | Model |
|---|---------|-------|
| 01 | Saturn V on Launch Complex 39 | `models/saturn-v.glb` |
| 02 | Rocketdyne F-1 engine | `models/f1-engine.glb` |
| 03 | Earth & Moon (hyper-real) | `models/earth-moon.glb` |

Drop your `.glb` exports into `models/` with those filenames. If a file is missing, a labelled wireframe placeholder is shown so the page still renders. To add or reorder scenes, edit the `SCENES` array at the top of `main.js`.

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

The `.nojekyll` file stops GitHub Pages from running Jekyll, so `models/*.glb` are served untouched.

## Structure

- `index.html` — entrypoint: importmap (unpkg Three.js CDN), fixed canvas, scroll sections
- `main.js` — scene/camera/lights, GLB loading, scroll-driven camera, cinematic intro
- `style.css` — dark space theme, fixed canvas behind scrolling content, title/tagline
- `models/` — your `.glb` scene exports
