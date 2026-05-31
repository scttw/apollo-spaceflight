#!/usr/bin/env bash
#
# Generate 1:1 gallery thumbnails from the full-size renders.
#
#   renders/<name>.jpg   →   renders/thumb/<name>.jpg   (square, centre-cropped)
#
# The gallery grid loads the small thumbs; the lightbox loads the full-size
# original (untouched). Run this after dropping new renders into renders/, or
# after changing THUMB_PX. Up-to-date thumbs are skipped, so reruns are cheap.
#
# Requires ImageMagick (mogrify). Install:  sudo apt install imagemagick
#
set -euo pipefail

SRC_DIR="renders"
THUMB_DIR="renders/thumb"
THUMB_PX="${THUMB_PX:-600}"      # override e.g. THUMB_PX=800 ./make-thumbs.sh
QUALITY="${QUALITY:-82}"

# IM7 ships `magick mogrify`; IM6 ships a bare `mogrify`. Support both.
if command -v magick >/dev/null 2>&1; then
  MOGRIFY=(magick mogrify)
elif command -v mogrify >/dev/null 2>&1; then
  MOGRIFY=(mogrify)
else
  echo "error: ImageMagick not found. Install it with: sudo apt install imagemagick" >&2
  exit 1
fi

mkdir -p "$THUMB_DIR"

# Collect sources whose thumb is missing or older than the source, so reruns
# only touch what changed. (-nt is true when the thumb is absent too.)
shopt -s nullglob nocaseglob
stale=()
for src in "$SRC_DIR"/*.{jpg,jpeg,png,webp}; do
  thumb="$THUMB_DIR/$(basename "$src")"
  if [[ ! -f "$thumb" || "$src" -nt "$thumb" ]]; then
    stale+=("$src")
  fi
done
shopt -u nullglob nocaseglob

if [[ ${#stale[@]} -eq 0 ]]; then
  echo "All thumbnails up to date (${THUMB_DIR}/)."
  exit 0
fi

echo "Generating ${#stale[@]} thumbnail(s) at ${THUMB_PX}x${THUMB_PX} → ${THUMB_DIR}/"

# -auto-orient : honour EXIF rotation before cropping
# NNNxNNN^     : scale so the SHORTER side fills the square
# -extent +repage with centre gravity : crop the overflow to an exact square
# -strip       : drop metadata to keep thumbs tiny
"${MOGRIFY[@]}" \
  -path "$THUMB_DIR" \
  -auto-orient \
  -thumbnail "${THUMB_PX}x${THUMB_PX}^" \
  -gravity center \
  -extent "${THUMB_PX}x${THUMB_PX}" \
  +repage \
  -strip \
  -interlace JPEG \
  -quality "$QUALITY" \
  "${stale[@]}"

echo "Done."
