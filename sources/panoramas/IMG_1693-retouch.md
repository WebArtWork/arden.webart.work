# First panorama retouch

Scene: `pano-1` (Холл). Source: `originals/IMG_1693.JPG`.
Editable result: `retouched/IMG_1693.png`, 8000 × 4000, lossless PNG.

Repaired the stepped vertical corner beside the door and the wavy ceiling/column junction and corner on the opposite side, as marked in the supplied screenshots. Built-in image generation produced local repair crops. Only narrow feathered strips around the repaired edges were aligned and color-matched into the original; the complete generated crops were not substituted for the photograph.

119,399 of 32,000,000 pixels changed (0.373%). All other pixels match the decoded original exactly. The original JPG is untouched. Only the default, HQ and thumbnail assets for `pano-1` were regenerated with the existing size and quality settings. Hashes verified that the 30 other generated panorama assets did not change.

## Prompts used with the built-in image tool

### Door-side corner

Use case: precise-object-edit. Edit target: this native-resolution 640x1664 crop of a real interior panorama. Repair ONLY the jagged vertical outside corner separating the warm cream wall on the left from the dark gray wall on the right. The edge currently has an obvious horizontal step roughly 600 pixels down. Make this edge one continuous clean straight vertical architectural corner from its top apex to its baseboard bottom, naturally joining the existing apex and base. Preserve original photographic grain, wall texture, lighting, exact colors. Keep door, ceiling hatch, floor, baseboard, perspective, composition and all other pixels unchanged. No general enhancement, no denoising or relighting. Return same 640x1664 crop with no margins.

### Opposite column

Use case: precise-object-edit. Edit target: native-resolution crop from a real interior panoramic photograph. Repair ONLY the rough wavy seam between the top of the dark gray column face and gray ceiling: make it a single smooth architectural straight diagonal edge from (130,350) to (505,177). Also repair the ragged right vertical corner at x500 from y177 down, making it a clean straight corner separating gray wall from cream wall. Preserve EXACT framing, geometry, original camera grain, resolution and original colors. Keep lamp and all wall markings, ceiling shadows and all other details unchanged. No new objects, no relighting, no global sharpening or enhancement. Return same composition and aspect ratio as input.
