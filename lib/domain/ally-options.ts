export type ContingentKind = 'optional' | 'allied';

export type AllyOptionKind = 'optionalContingent' | 'allyTroopOption';

export type AllyEntry = {
  name: string;
  internalContingent: boolean;
};

export type AllyOption = {
  allyEntries: readonly AllyEntry[];
};

export type AllyOptionContingent = {
  name: string;
  kind: ContingentKind;
};

export const contingentKind = ({
  internalContingent,
}: Pick<AllyEntry, 'internalContingent'>): ContingentKind =>
  internalContingent ? 'optional' : 'allied';

export const allyOptionContingents = ({
  allyEntries,
}: AllyOption): readonly AllyOptionContingent[] =>
  allyEntries.map((entry) => ({
    name: entry.name,
    kind: contingentKind(entry),
  }));

export const allyOptionKind = (option: AllyOption): AllyOptionKind =>
  allyOptionContingents(option).some(({ kind }) => kind === 'allied')
    ? 'allyTroopOption'
    : 'optionalContingent';
