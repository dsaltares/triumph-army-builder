import { describe, expect, it } from 'vitest';
import {
  encodeQr,
  type QrCode,
  quietZoneModules,
  sheetErrorCorrection,
} from './qr-code.ts';

const shortLink = 'https://triumph-army-builder.fly.dev/s/Ab3xK9_mQ1zT';

const runPattern = /M(\d+) (\d+)L(\d+) \d+L\d+ \d+L\d+ \d+Z/g;

const readBack = ({ path, size }: QrCode) => {
  const dark = new Set<string>();
  for (const [, left, top, right] of path.matchAll(runPattern)) {
    for (let column = Number(left); column < Number(right); column += 1) {
      dark.add(`${top},${column}`);
    }
  }
  return {
    isDark: (row: number, column: number) => dark.has(`${row},${column}`),
    rowIsBlank: (row: number) =>
      Array.from({ length: size }, (_, column) => column).every(
        (column) => !dark.has(`${row},${column}`),
      ),
    columnIsBlank: (column: number) =>
      Array.from({ length: size }, (_, row) => row).every(
        (row) => !dark.has(`${row},${column}`),
      ),
  };
};

const finderPattern = (
  isDark: (row: number, column: number) => boolean,
  top: number,
  left: number,
) =>
  Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: 7 }, (_, column) =>
      isDark(top + row, left + column) ? '#' : '.',
    ).join(''),
  ).join('\n');

const expectedFinder = [
  '#######',
  '#.....#',
  '#.###.#',
  '#.###.#',
  '#.###.#',
  '#.....#',
  '#######',
].join('\n');

describe('encodeQr', () => {
  it('keeps a short link to a small symbol at the sheet error correction level', () => {
    const qr = encodeQr(shortLink, sheetErrorCorrection);

    expect(sheetErrorCorrection).toBe('Q');
    expect(qr.version).toBe(5);
    expect(qr.moduleCount).toBe(37);
  });

  it('grows the symbol as the error correction level rises', () => {
    const versions = (['L', 'M', 'Q', 'H'] as const).map(
      (level) => encodeQr(shortLink, level).version,
    );

    expect(versions).toEqual([3, 4, 5, 6]);
  });

  it('needs a far denser symbol for a client-encoded share code', () => {
    const builderUrl = `https://triumph-army-builder.fly.dev/armies/${'a'.repeat(24)}/build?s=1.${'e'.repeat(568)}`;

    const qr = encodeQr(builderUrl, sheetErrorCorrection);

    expect(qr.version).toBe(24);
    expect(qr.moduleCount).toBe(113);
  });

  it('surrounds the symbol with a quiet zone', () => {
    const qr = encodeQr(shortLink);
    const { rowIsBlank, columnIsBlank } = readBack(qr);

    expect(qr.size).toBe(qr.moduleCount + quietZoneModules * 2);
    for (let edge = 0; edge < quietZoneModules; edge += 1) {
      expect(rowIsBlank(edge)).toBe(true);
      expect(rowIsBlank(qr.size - 1 - edge)).toBe(true);
      expect(columnIsBlank(edge)).toBe(true);
      expect(columnIsBlank(qr.size - 1 - edge)).toBe(true);
    }
  });

  it('draws the three finder patterns in the corners', () => {
    const qr = encodeQr(shortLink);
    const { isDark } = readBack(qr);
    const far = qr.size - quietZoneModules - 7;

    expect(finderPattern(isDark, quietZoneModules, quietZoneModules)).toBe(
      expectedFinder,
    );
    expect(finderPattern(isDark, quietZoneModules, far)).toBe(expectedFinder);
    expect(finderPattern(isDark, far, quietZoneModules)).toBe(expectedFinder);
  });

  it('counts a non-latin-1 character as its UTF-8 bytes', () => {
    const twentyGreekCharacters = 'Ω'.repeat(20);

    expect(encodeQr(twentyGreekCharacters, 'Q').version).toBe(
      encodeQr('a'.repeat(40), 'Q').version,
    );
    expect(encodeQr(twentyGreekCharacters, 'Q').version).not.toBe(
      encodeQr('a'.repeat(20), 'Q').version,
    );
  });
});
