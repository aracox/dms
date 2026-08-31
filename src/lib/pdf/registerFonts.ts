import { Font } from '@react-pdf/renderer';

import { SARABUN_BOLD_BASE64, SARABUN_REGULAR_BASE64 } from './fonts/sarabun';

let registered = false;

/** Registers the Thai-capable Sarabun font with react-pdf. Safe to call repeatedly. */
export function registerContractFonts() {
  if (registered) return;

  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: `data:font/ttf;base64,${SARABUN_REGULAR_BASE64}`, fontWeight: 'normal' },
      { src: `data:font/ttf;base64,${SARABUN_BOLD_BASE64}`, fontWeight: 'bold' },
    ],
  });

  registered = true;
}
