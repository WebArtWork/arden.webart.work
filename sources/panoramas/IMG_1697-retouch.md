# Fourth panorama retouch

Scene: `pano-4` (Коридор). Untouched source: `originals/IMG_1697.JPG`.
Editable result: `retouched/IMG_1697.png`, 8000 × 4000, lossless PNG.

Repaired the stepped central and outer column edges, column/ceiling junctions, the stepped ceiling seam above the sofa, the broken skirting and black border beside the frosted door, the door frame top edge, and displaced glass ribs. The door was processed as a wrapped crop so the image boundary remains continuous.

Built-in image generation supplied local repair crops. Only narrow feathered strips and a small glass patch were aligned into the original, with local color matching where appropriate. Signs, text, pictograms, furniture and all other image areas remain from the original. The generated column crop removed a thin line on the access panel; that area was excluded to preserve the original physical feature.

726,949 of 32,000,000 pixels changed (2.272%). All other pixels match the decoded original exactly. Only pano-4's three web variants were regenerated using existing dimensions/quality: 2048 × 1024 q90, 4096 × 2048 q100, 320 × 180 q75. Hash checks verified all 30 other web panorama assets, all 11 originals, and the 10 other editable sources remain unchanged.

## Prompts used with the built-in image tool

### sign-column

Use case: precise-object-edit. This is a native-resolution crop of a hotel panorama. Repair ONLY stitching steps on the central outside vertical corner of the gray column (near x530 at the top, x540 in the middle, x620 at the base). Make it a continuous clean architectural edge from ceiling apex to baseboard. Also smooth the jagged top ceiling/column edges. Preserve natural panoramic geometry, original endpoints and wall widths. Keep exact original grain, wall tones, lighting gradients, sign with its exact lettering and arrow, baseboard and floor. No relighting or denoising, no redesign, no crop. Return same 1024x2200 composition.

### table-column

Use case: precise-object-edit. Native-resolution crop of hotel panorama. Repair ONLY the abrupt stitching steps on central gray column corner (x495 at top, x470 middle and bottom), plus the stepped right silhouette (x860), and uneven top ceiling junctions. Make these clean continuous architectural edges joining their existing endpoints. Remove the thin black diagonal stitching slash on the gray face near x750,y1160, filling with matching gray painted wall texture. Keep original photographic grain, precise colors and lighting, column shape, baseboard, floor, table and its shadows. No global enhancement, no denoising, no crop. Return same 1024x2048 composition.

### ceiling

Use case: precise-object-edit. This wide native-resolution crop is from an equirectangular interior panorama. Repair ONLY the abrupt steps in the junction between beige wall and gray ceiling across the center, including the step at x950,y150. Make one smooth continuous gently curving wall/ceiling boundary following the existing broad curve and endpoints. Preserve natural panoramic curvature: do not flatten it to a straight line. Preserve exact photographic grain and wall textures, colors, shadows, framing, and all surrounding details. No relighting, denoising or global enhancement. Return same wide composition, no crop, no margins.

### door

Use case: precise-object-edit. Native-resolution crop of hotel panoramic photograph, wrapping the panorama seam. Repair ONLY stitching defects: broken stepped white skirting and black tile border at bottom left near x50..220,y1270; the ragged door frame top edge; and the abrupt horizontal displacement of the vertical frosted-glass ridges on the lower right door at x1050,y980. Connect the white skirting and dark floor border into continuous smooth curves joining the original endpoints. Align only displaced vertical frosted-glass ridges so they continue naturally across the stitching break. Preserve original panorama curvature, door and frame shape and size, exact no-smoking pictogram, room sign and all letters/numbers, lighting and camera grain. No global enhancement, no denoising, no crop. Return same 1360x1520 composition.

### Small glass correction

Use case: precise-object-edit. This small photo crop is translucent vertically ribbed door glass, with horizontal light bars behind it. Correct ONLY the zigzag horizontal displacement of the bright vertical ribs in the middle at x80..160, y120..160. Make each displaced bright rib continue as a smooth nearly vertical line between its existing top and bottom segments. Preserve EXACT number of ribs, exact ridge spacing, widths, positions and brightness everywhere else. Preserve blurred objects and horizontal bands behind the glass, original grain, colors and the dark right door frame. Do not replace the glass, do not add ribs, no denoising, no sharpening. Return precisely the same crop and composition.

