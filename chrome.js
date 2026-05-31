// ---------------------------------------------------------------------------
// Shared page chrome, injected at runtime so the header + nav live in one place
// (GitHub Pages has no server includes). Each page just sets
// <body data-page="..."> matching an id below; this builds:
//   - a fixed header: APOLLO wordmark + a menu linking every page
//   - a fixed footer: prev / next buttons for the linear sequence
// To add or reorder pages, edit PAGES — order here defines prev/next.
// ---------------------------------------------------------------------------
const PAGES = [
  { id: 'index',      href: 'index.html',      menu: 'Intro' },
  { id: 'saturn-v',   href: 'saturn-v.html',   menu: 'Saturn V' },
  { id: 'f1-engine',  href: 'f1-engine.html',  menu: 'F-1 Engine' },
  { id: 'earth-moon', href: 'earth-moon.html', menu: 'Earth & Moon' },
  { id: 'gallery',    href: 'gallery.html',    menu: 'Gallery' },
  { id: 'making-of',  href: 'making-of.html',  menu: 'Making Of' },
];

const current = document.body.dataset.page;
const i = PAGES.findIndex((p) => p.id === current);

// Header: wordmark + menu.
const header = document.createElement('header');
header.className = 'site-header';

const wordmark = document.createElement('a');
wordmark.className = 'wordmark';
wordmark.href = 'index.html';
wordmark.textContent = 'APOLLO';
header.appendChild(wordmark);

const nav = document.createElement('nav');
nav.className = 'site-nav';
PAGES.forEach((p) => {
  const a = document.createElement('a');
  a.href = p.href;
  a.textContent = p.menu;
  if (p.id === current) a.className = 'active';
  nav.appendChild(a);
});
header.appendChild(nav);

// Footer: prev / next. A missing neighbour leaves an invisible spacer so the
// remaining button keeps its left/right alignment.
const footer = document.createElement('footer');
footer.className = 'page-nav';
const prev = i > 0 ? PAGES[i - 1] : null;
const next = i >= 0 && i < PAGES.length - 1 ? PAGES[i + 1] : null;

footer.appendChild(navLink(prev, '←', 'prev'));
footer.appendChild(navLink(next, '→', 'next'));

function navLink(page, arrow, side) {
  if (!page) {
    const span = document.createElement('span');
    span.className = 'spacer';
    return span;
  }
  const a = document.createElement('a');
  a.href = page.href;
  a.className = side;
  a.textContent = side === 'prev' ? `${arrow} ${page.menu}` : `${page.menu} ${arrow}`;
  return a;
}

document.body.prepend(header);
document.body.appendChild(footer);
