# renders

Full-size gallery images live here (`.webp`, `.jpg`, `.jpeg`, or `.png`). Drop
the Blender render exports in, then list each one in `renders.js` with its alt
text.

Then generate the square grid thumbnails (needs ImageMagick):

```bash
./make-thumbs.sh          # writes renders/thumb/<name>, 600x600 centre-crop
THUMB_PX=800 ./make-thumbs.sh   # bigger thumbs if you want
```

The gallery grid loads `renders/thumb/<name>`; the lightbox loads the full-size
original from here. Both the originals and the generated `thumb/` files must be
committed, since GitHub Pages serves them as-is (no build step). Until the files
exist, the grid falls back: thumbnail → full-size → numbered placeholder.
