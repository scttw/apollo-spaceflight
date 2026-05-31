// ---------------------------------------------------------------------------
// Reusable fullscreen image lightbox, shared by the gallery grid and the
// making-of page. Build it once with an ordered list of { src, alt, caption }
// items (caption optional, falls back to alt), then call open(index). It
// injects its own overlay into <body> and wires the prev/next buttons, a
// backdrop click, and Esc / arrow keys. Stepping wraps around the list.
//
// `onMissing(index) → src` supplies a fallback image when an item fails to load
// (the gallery uses it for its numbered placeholder); omit it to leave broken
// images as-is.
// ---------------------------------------------------------------------------
export function createLightbox(items, { onMissing } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="Close">×</button>
    <button class="lightbox-prev" type="button" aria-label="Previous">←</button>
    <img class="lightbox-img" alt="" />
    <button class="lightbox-next" type="button" aria-label="Next">→</button>
    <p class="lightbox-caption"></p>`;
  document.body.appendChild(overlay);

  const img = overlay.querySelector('.lightbox-img');
  const caption = overlay.querySelector('.lightbox-caption');
  let activeIndex = 0;

  function show(idx) {
    activeIndex = (idx + items.length) % items.length;
    const item = items[activeIndex];
    img.alt = item.alt ?? '';
    img.src = item.src;
    img.onerror = onMissing ? () => { img.src = onMissing(activeIndex); } : null;
    caption.textContent = item.caption ?? item.alt ?? '';
  }

  function open(idx) {
    show(idx);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  overlay.querySelector('.lightbox-prev').addEventListener('click', () => show(activeIndex - 1));
  overlay.querySelector('.lightbox-next').addEventListener('click', () => show(activeIndex + 1));
  overlay.querySelector('.lightbox-close').addEventListener('click', close);

  // Click outside the image (on the backdrop) closes.
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(activeIndex - 1);
    else if (e.key === 'ArrowRight') show(activeIndex + 1);
  });

  return { open };
}
