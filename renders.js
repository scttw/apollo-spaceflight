// ---------------------------------------------------------------------------
// The render manifest — the single list of gallery images, shared by the
// gallery grid and the making-of page. Each entry is the full-size image
// (`src`) and its `alt` text; drop new exports into renders/ and add a line.
//
// The gallery grid loads a square thumbnail derived from `src`
// (renders/foo.webp → renders/thumb/foo.webp, see thumbFor() in gallery.js);
// generate those with ./make-thumbs.sh. The lightbox loads the full-size `src`.
// Until the thumb/full files exist, each tile falls back to a numbered placeholder.
// ---------------------------------------------------------------------------
export const RENDERS = [
  { src: 'renders/saturn-v.webp',          alt: 'Saturn V on the launch tower at Launch Complex 39' },
  { src: 'renders/rocketdyne-render.webp', alt: 'Rocketdyne F-1 engine hovering over its exhaust glow' },
  { src: 'renders/engine.webp',            alt: 'F-1 engine at dusk' },
  { src: 'renders/earth-render.webp',      alt: 'Earth from low orbit, a close pass over Europe, Spain and the Mediterranean with cloud banks over the Atlantic' },
  { src: 'renders/earth-render-np.webp',   alt: 'Earth centred on the North Pole, the Arctic ice cap surrounded by the northern continents' },
  { src: 'renders/earth-render-sp.webp',   alt: 'Earth from orbit with Australia near the terminator and sunglint flaring off the Pacific' },
  { src: 'renders/earth-render-sa.webp',   alt: 'Earth showing the Americas, from North America down to the tip of South America, with sunglint over the Caribbean' },
];
