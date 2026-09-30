import { formattingLocales, type Locale } from '../i18n/locales.ts';

export type RelatedArmy = {
  id: string;
  key: string;
  name: string;
  startDate: number;
  endDate: number;
};

export type RelatedArmies = {
  enemies: readonly RelatedArmy[];
  sublists: readonly RelatedArmy[];
  facesItself: boolean;
};

type Army = {
  id: string;
  key: string;
  enemies: readonly string[];
};

export const listNumber = (key: string) => key.replace(/[a-z]+$/, '');

const byName = (locale: Locale) => (left: RelatedArmy, right: RelatedArmy) =>
  left.name.localeCompare(right.name, formattingLocales[locale]);

export const relatedArmies = (
  armies: readonly RelatedArmy[],
  army: Army,
  locale: Locale,
): RelatedArmies => {
  const byId = new Map(armies.map((candidate) => [candidate.id, candidate]));
  const enemyIds = new Set(army.enemies);
  const number = listNumber(army.key);
  return {
    enemies: [...enemyIds]
      .filter((id) => id !== army.id)
      .flatMap((id) => {
        const enemy = byId.get(id);
        return enemy ? [enemy] : [];
      })
      .sort(byName(locale)),
    sublists: armies.filter(
      (candidate) =>
        candidate.id !== army.id && listNumber(candidate.key) === number,
    ),
    facesItself: enemyIds.has(army.id),
  };
};
