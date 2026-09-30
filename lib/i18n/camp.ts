import type { CampCode } from '../domain/army/sheet.ts';
import type { Words } from './translator.ts';

const campKeys: Readonly<Record<CampCode, string>> = {
  FC: 'campFortified',
  NC: 'campNone',
  SW: 'campStandardWagon',
  PT: 'campPackTrain',
};

export const campText = (camp: readonly CampCode[], w: Words) =>
  camp.length === 0
    ? w('campStandard')
    : camp.map((code) => w(campKeys[code])).join(', ');
