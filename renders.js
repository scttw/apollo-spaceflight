// ---------------------------------------------------------------------------
// The render manifest — the single list of gallery images, shared by the
// gallery grid and the making-of page. Drop your exports into renders/ and edit
// this list to match: replace the generated defaults with explicit entries,
// e.g. { src: 'renders/saturn-liftoff.jpg', alt: 'Saturn V clearing the tower' }.
// Until the real files exist, each tile shows a numbered placeholder.
// ---------------------------------------------------------------------------
export const RENDERS = Array.from({ length: 24 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { src: `renders/render-${n}.jpg`, alt: `Apollo render ${n}` };
});
