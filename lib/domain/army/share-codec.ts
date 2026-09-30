import { byKey } from '../ordering.ts';
import type { TroopOptionId } from './army-list.ts';
import type { ArmySelection } from './selection.ts';
import { selectionSchema } from './selection-schema.ts';

export const shareCodecVersion = 1;

export const shareCodeBudgetChars = 800;

export const shareCodeMaxChars = 4000;

export type ShareDecoding =
  | { ok: true; selection: ArmySelection }
  | { ok: false; reason: 'malformed' }
  | { ok: false; reason: 'unsupportedVersion'; version: number };

const versionSeparator = '.';
const versionedCodePattern = /^(\d+)\.(.*)$/s;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...textEncoder.encode(text)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const fromBase64Url = (code: string) =>
  textDecoder.decode(
    Uint8Array.from(
      atob(code.replaceAll('-', '+').replaceAll('_', '/')),
      (character) => character.charCodeAt(0),
    ),
  );

const counts = <Code extends string>(
  entries: Readonly<Partial<Record<Code, number>>>,
) =>
  Object.fromEntries(
    Object.entries(entries)
      .filter(([, count]) => typeof count === 'number' && count > 0)
      .sort(byKey),
  ) as Readonly<Partial<Record<Code, number>>>;

const countsByOption = <Code extends string>(
  entries: Readonly<
    Record<TroopOptionId, Readonly<Partial<Record<Code, number>>>>
  >,
) =>
  Object.fromEntries(
    Object.entries(entries)
      .map(([option, entry]) => [option, counts(entry)] as const)
      .filter(([, entry]) => Object.keys(entry).length > 0)
      .sort(byKey),
  ) as Readonly<Record<TroopOptionId, Readonly<Partial<Record<Code, number>>>>>;

const canonical = (selection: ArmySelection) => ({
  army: selection.army,
  dataVersion: selection.dataVersion,
  year: selection.year,
  variant: selection.variant,
  contingentGroups: selection.contingentGroups,
  stands: countsByOption(selection.stands),
  general: selection.general && {
    option: selection.general.option,
    troopType: selection.general.troopType,
  },
  armyBattleCards: counts(selection.armyBattleCards),
  troopBattleCards: countsByOption(selection.troopBattleCards),
});

const jsonOf = (body: string): unknown => {
  try {
    return JSON.parse(fromBase64Url(body));
  } catch {
    return undefined;
  }
};

export const encodeSelection = (selection: ArmySelection) =>
  `${shareCodecVersion}${versionSeparator}${toBase64Url(
    JSON.stringify(selectionSchema.parse(canonical(selection))),
  )}`;

export const decodeSelection = (code: string): ShareDecoding => {
  if (code.length > shareCodeMaxChars) {
    return { ok: false, reason: 'malformed' };
  }
  const [, prefix, body] = versionedCodePattern.exec(code) ?? [];
  if (prefix === undefined || body === undefined) {
    return { ok: false, reason: 'malformed' };
  }
  const version = Number(prefix);
  if (version !== shareCodecVersion) {
    return { ok: false, reason: 'unsupportedVersion', version };
  }
  const selection = selectionSchema.safeParse(jsonOf(body));
  return selection.success
    ? { ok: true, selection: selection.data }
    : { ok: false, reason: 'malformed' };
};
