// ---------------------------------------------------------------------------
// Makes every figure image on the making-of page open in the shared lightbox,
// stepping through them in document order. Each image's figcaption (falling
// back to its alt text) becomes the lightbox caption.
// ---------------------------------------------------------------------------
import { createLightbox } from './lightbox.js';

const images = [...document.querySelectorAll('#content .prose img')];

const items = images.map((img) => ({
  src: img.src,
  alt: img.alt,
  caption: img.closest('figure')?.querySelector('figcaption')?.textContent.trim(),
}));

const { open } = createLightbox(items);

images.forEach((img, idx) => {
  img.classList.add('zoomable');
  img.setAttribute('role', 'button');
  img.tabIndex = 0;
  img.setAttribute('aria-label', `View full size: ${img.alt}`);
  img.addEventListener('click', () => open(idx));
  img.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(idx); }
  });
});
