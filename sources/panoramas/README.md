# Panoramas

- `retouched/` — complete editable source layer used by the generator. Each original has exactly one matching file here, matched by name without extension (`IMG_1695.webp` matches `IMG_1695.JPG`). Existing retouches are preserved; photos without edits start as byte-for-byte copies of the originals.
- `originals/` — untouched source photos (equirectangular 2:1, 8000×4000 and 6080×3040). Never served; edit nothing here.
- `src/assets/sphere/` — generated web versions. Do not edit by hand.
  - `pano-<n>.webp` — default quality, 2048×1024, WebP q90
  - `hq/pano-<n>.webp` — HQ toggle in the viewer, 4096×2048, WebP q100
  - `thumbs/pano-<n>.webp` — 320×180

The pipeline is: **untouched originals → editable retouched photos → three web versions**.

Initialize missing editable sources without generating web assets:

    npm run panoramas:prepare

Edit the corresponding photo in `retouched/`, keeping its full resolution and equirectangular 2:1 projection. Do not crop or change its orientation: tour navigation depends on it. If saving in another supported format (JPG, PNG, WebP), remove the previous file with the same stem so there is only one version. Preserve detail when exporting; avoid repeated lossy compression.

Rebuild after editing photos, adding or reordering originals, or changing sizes/quality in `tools/panoramas/build.mjs`:

    npm run panoramas

This first copies any missing sources into `retouched/` without overwriting edits, then generates all three variants exclusively from that layer. To reset a photo, remove its retouched version and run the command again. Generated web assets can be rebuilt freely; editable sources are never cleared by these scripts.

For feedback, identify either the original filename or the tour scene (`pano-1` through `pano-11`). Changes belong in `retouched/`; run `npm run panoramas` afterward to apply them to all three web versions.

The n-th original (sorted by file name) becomes `pano-<n>`. Keep `SCENES` and `TOUR_LINKS` in
`src/app/pages/virtual-tour/tour.data.ts` in sync with the count and order.
