import type { MeshweshArmyList, MeshweshBattleCard } from './schema.ts';

export type CanarySource = {
  armyLists: readonly Pick<MeshweshArmyList, 'name'>[];
  battleCards: readonly Pick<MeshweshBattleCard, 'mdText'>[];
  fantasyCardText?: readonly string[];
};

export type Canaries = {
  armyNames: readonly string[];
  battleCardLines: readonly string[];
};

export type CanaryHit = { path: string; line: number; canary: string };

export type RestrictedContentBaseline = Record<string, readonly string[]>;

const minimumBattleCardLineWords = 6;

const markdownMarker = /^(?:#+|[-*+]|\d+\.)\s+|[*_`]/g;

const collapsedWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

const battleCardLine = (line: string) =>
  collapsedWhitespace(line.replace(markdownMarker, ''));

const wordCount = (line: string) => line.split(' ').length;

const byLengthDescending = (a: string, b: string) => b.length - a.length;

export const restrictedCanaries = ({
  armyLists,
  battleCards,
  fantasyCardText = [],
}: CanarySource): Canaries => ({
  armyNames: [
    ...new Set(armyLists.map(({ name }) => collapsedWhitespace(name))),
  ]
    .filter((name) => name.length > 0)
    .sort(byLengthDescending),
  battleCardLines: [
    ...new Set(
      [...battleCards.map(({ mdText }) => mdText), ...fantasyCardText]
        .flatMap((text) => text.split('\n'))
        .map(battleCardLine)
        .filter((line) => wordCount(line) >= minimumBattleCardLineWords),
    ),
  ].sort(byLengthDescending),
});

const escapedForRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wholeWords = (alternatives: readonly string[]) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.map(escapedForRegExp).join('|')})(?![\\p{L}\\p{N}])`,
    'gu',
  );

const lineAt = (text: string) => {
  const lineStarts = [0];
  for (let index = text.indexOf('\n'); index !== -1; ) {
    lineStarts.push(index + 1);
    index = text.indexOf('\n', index + 1);
  }
  return (offset: number) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((lineStarts[middle] ?? 0) <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low + 1;
  };
};

const withCollapsedWhitespace = (text: string) => {
  const offsets: number[] = [];
  let collapsed = '';
  for (let index = 0; index < text.length; index++) {
    const character = text.charAt(index);
    if (/\s/.test(character)) {
      if (collapsed.endsWith(' ')) {
        continue;
      }
      collapsed += ' ';
    } else {
      collapsed += character;
    }
    offsets.push(index);
  }
  return {
    collapsed,
    originalOffset: (offset: number) => offsets[offset] ?? 0,
  };
};

export const canaryScanner = ({ armyNames, battleCardLines }: Canaries) => {
  const names = armyNames.length > 0 ? wholeWords(armyNames) : undefined;
  const lines =
    battleCardLines.length > 0 ? wholeWords(battleCardLines) : undefined;
  return (path: string, text: string): CanaryHit[] => {
    const line = lineAt(text);
    const nameHits = names
      ? [...text.matchAll(names)].map((match) => ({
          path,
          line: line(match.index),
          canary: match[0],
        }))
      : [];
    if (!lines) {
      return nameHits;
    }
    const { collapsed, originalOffset } = withCollapsedWhitespace(text);
    const lineHits = [...collapsed.matchAll(lines)].map((match) => ({
      path,
      line: line(originalOffset(match.index)),
      canary: match[0],
    }));
    return [...nameHits, ...lineHits].sort((a, b) => a.line - b.line);
  };
};

const pairKey = (path: string, canary: string) => `${path}\u0000${canary}`;

export const baselineOf = (
  hits: readonly CanaryHit[],
): RestrictedContentBaseline => {
  const canariesByPath = new Map<string, Set<string>>();
  for (const { path, canary } of hits) {
    canariesByPath.set(
      path,
      (canariesByPath.get(path) ?? new Set()).add(canary),
    );
  }
  return Object.fromEntries(
    [...canariesByPath.keys()]
      .sort()
      .map((path) => [path, [...(canariesByPath.get(path) ?? [])].sort()]),
  );
};

export const compareToBaseline = (
  hits: readonly CanaryHit[],
  baseline: RestrictedContentBaseline,
) => {
  const allowed = new Set(
    Object.entries(baseline).flatMap(([path, canaries]) =>
      canaries.map((canary) => pairKey(path, canary)),
    ),
  );
  const found = new Set(hits.map(({ path, canary }) => pairKey(path, canary)));
  return {
    unexpected: hits.filter(
      ({ path, canary }) => !allowed.has(pairKey(path, canary)),
    ),
    cleared: Object.entries(baseline).flatMap(([path, canaries]) =>
      canaries
        .filter((canary) => !found.has(pairKey(path, canary)))
        .map((canary) => ({ path, canary })),
    ),
  };
};
