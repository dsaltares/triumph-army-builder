import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';

export const sheetColors = {
  foreground: '#0c0a09',
  mutedForeground: '#79716b',
  border: '#e7e5e4',
  muted: '#f5f5f4',
  primary: '#1c1917',
  background: '#ffffff',
} as const;

export const sheetFontFamily = 'IBM Plex Sans';

export const sheetMarkFile = join(process.cwd(), 'public', 'brand', 'mark.png');

const fontFile = (weight: string) =>
  join(process.cwd(), 'public', 'fonts', `IBMPlexSans-${weight}.ttf`);

let registered = false;

export const registerSheetFonts = () => {
  if (registered) {
    return;
  }
  Font.register({
    family: sheetFontFamily,
    fonts: [
      { src: fontFile('Regular'), fontWeight: 400 },
      { src: fontFile('SemiBold'), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
};
