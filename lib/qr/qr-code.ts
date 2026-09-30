import qrcode from 'qrcode-generator';

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export const sheetErrorCorrection: QrErrorCorrection = 'Q';

export const quietZoneModules = 4;

export type QrCode = {
  version: number;
  moduleCount: number;
  size: number;
  path: string;
};

const utf8Bytes = (value: string) =>
  Array.from(new TextEncoder().encode(value));

qrcode.stringToBytes = utf8Bytes;

const versionFromModuleCount = (moduleCount: number) => (moduleCount - 17) / 4;

const horizontalRuns = (
  isDark: (row: number, column: number) => boolean,
  moduleCount: number,
) => {
  const runs: string[] = [];
  for (let row = 0; row < moduleCount; row += 1) {
    let runStart = -1;
    for (let column = 0; column <= moduleCount; column += 1) {
      const dark = column < moduleCount && isDark(row, column);
      if (dark && runStart < 0) {
        runStart = column;
      }
      if (!dark && runStart >= 0) {
        const width = column - runStart;
        const x = runStart + quietZoneModules;
        const y = row + quietZoneModules;
        runs.push(
          `M${x} ${y}L${x + width} ${y}L${x + width} ${y + 1}L${x} ${y + 1}Z`,
        );
        runStart = -1;
      }
    }
  }
  return runs.join('');
};

export const encodeQr = (
  text: string,
  errorCorrection: QrErrorCorrection = sheetErrorCorrection,
): QrCode => {
  const code = qrcode(0, errorCorrection);
  code.addData(text);
  code.make();
  const moduleCount = code.getModuleCount();
  return {
    version: versionFromModuleCount(moduleCount),
    moduleCount,
    size: moduleCount + quietZoneModules * 2,
    path: horizontalRuns(
      (row, column) => code.isDark(row, column),
      moduleCount,
    ),
  };
};
