import { deflateSync, inflateSync } from 'fflate';
import { gameModule } from '../games/registry.ts';
import type { ArmySelection } from './selection.ts';
import {
  type SavedSelection,
  savedSelectionSchema,
} from './selection-schema.ts';

export const shareCodecVersion = 2;

const triumphOnlyCodecVersion = 1;

export const shareCodeBudgetChars = 800;

export const shareCodeMaxChars = 4000;

export const shareCodeMaxInflatedBytes = 4000;

type DecodingFailure =
  | { ok: false; reason: 'malformed' }
  | { ok: false; reason: 'unsupportedVersion'; version: number };

export type ShareCodeDecoding =
  | { ok: true; list: SavedSelection }
  | DecodingFailure;

export type ShareDecoding =
  | { ok: true; selection: ArmySelection }
  | DecodingFailure;

const versionSeparator = '.';
const versionedCodePattern = /^(\d+)\.(.*)$/s;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const fromBase64Url = (code: string) =>
  Uint8Array.from(
    atob(code.replaceAll('-', '+').replaceAll('_', '/')),
    (character) => character.charCodeAt(0),
  );

const deflated = (text: string) =>
  deflateSync(textEncoder.encode(text), { level: 9 });

const inflated = (bytes: Uint8Array) => {
  const text = inflateSync(bytes, {
    out: new Uint8Array(shareCodeMaxInflatedBytes + 1),
  });
  if (text.length > shareCodeMaxInflatedBytes) {
    throw new Error('the share code inflates past any list');
  }
  return text;
};

const payloadBytes = (version: number, body: string) =>
  version === triumphOnlyCodecVersion
    ? fromBase64Url(body)
    : inflated(fromBase64Url(body));

const jsonOf = (version: number, body: string): unknown => {
  try {
    return JSON.parse(textDecoder.decode(payloadBytes(version, body)));
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const payloadOf = ({ game, selection }: SavedSelection) => {
  const module = gameModule(game);
  return {
    game,
    ...module.selectionSchema.parse(module.canonicalise(selection)),
  };
};

const taggedPayload = (payload: unknown) => {
  if (!isRecord(payload)) {
    return payload;
  }
  const { game, ...selection } = payload;
  return { game, selection };
};

const savedSelectionOf = (version: number, payload: unknown) =>
  savedSelectionSchema.safeParse(
    version === triumphOnlyCodecVersion
      ? { game: 'triumph', selection: payload }
      : taggedPayload(payload),
  );

const decodableVersions: readonly number[] = [
  triumphOnlyCodecVersion,
  shareCodecVersion,
];

export const encodeShareCode = (list: SavedSelection) =>
  `${shareCodecVersion}${versionSeparator}${toBase64Url(
    deflated(JSON.stringify(payloadOf(list))),
  )}`;

export const decodeShareCode = (code: string): ShareCodeDecoding => {
  if (code.length > shareCodeMaxChars) {
    return { ok: false, reason: 'malformed' };
  }
  const [, prefix, body] = versionedCodePattern.exec(code) ?? [];
  if (prefix === undefined || body === undefined) {
    return { ok: false, reason: 'malformed' };
  }
  const version = Number(prefix);
  if (!decodableVersions.includes(version)) {
    return { ok: false, reason: 'unsupportedVersion', version };
  }
  const list = savedSelectionOf(version, jsonOf(version, body));
  return list.success
    ? { ok: true, list: list.data }
    : { ok: false, reason: 'malformed' };
};

export const encodeSelection = (selection: ArmySelection) =>
  encodeShareCode({ game: 'triumph', selection });

export const decodeSelection = (code: string): ShareDecoding => {
  const decoded = decodeShareCode(code);
  return decoded.ok ? { ok: true, selection: decoded.list.selection } : decoded;
};
