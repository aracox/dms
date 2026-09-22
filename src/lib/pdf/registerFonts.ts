import { Font } from '@react-pdf/renderer';

import { SARABUN_BOLD_BASE64, SARABUN_REGULAR_BASE64 } from './fonts/sarabun';

let counter = 0;

/**
 * Registers the Thai-capable Sarabun font under a fresh, uniquely-named
 * family on every call, and returns that family's name for the caller to
 * use as the document's `fontFamily`.
 *
 * The uniqueness matters: react-pdf/fontkit keeps a registered family's
 * loaded font -- and the glyph subset it builds while embedding -- alive
 * across calls in a long-lived process (the Next.js dev/prod server reuses
 * the same process for many requests). Reusing the same family name lets
 * later renders reuse that same cached font object, which eventually
 * corrupts the subset's glyph mapping -- observed as specific Thai
 * characters (e.g. "บ") silently rendering as the wrong glyph after several
 * contract/receipt PDFs had already been generated in the same process,
 * while a fresh process rendered the exact same text correctly.
 *
 * Two more direct fixes were tried and rejected:
 * - `Font.reset()` nulls the cached font data but leaves the FontSource's
 *   already-resolved load promise in place, so the next render reuses that
 *   promise, sees the nulled data, and crashes reading `unitsPerEm` off null.
 * - `Font.clear()` wipes react-pdf's *entire* font registry, including the
 *   standard fonts (Helvetica, etc.) it registers internally at startup --
 *   anything relying on those crashes with "Font family not registered".
 *
 * Registering under a new name each time sidesteps both: nothing is ever
 * reused, and nothing global is torn down.
 */
export function registerContractFonts(): string {
  counter += 1;
  const family = `Sarabun-${counter}`;

  Font.register({
    family,
    fonts: [
      { src: `data:font/ttf;base64,${SARABUN_REGULAR_BASE64}`, fontWeight: 'normal' },
      { src: `data:font/ttf;base64,${SARABUN_BOLD_BASE64}`, fontWeight: 'bold' },
    ],
  });

  return family;
}
