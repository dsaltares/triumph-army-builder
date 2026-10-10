import type {
  ArmySheet,
  SheetBattleCard,
  SheetContingent,
  SheetStandLine,
  SheetTroopOption,
} from '../domain/army/sheet.ts';
import type { FantasySheet } from '../domain/fantasy/sheet-data.ts';
import { fantasyTextGroups } from '../domain/fantasy/text-export.ts';
import type { ListSheet } from '../domain/games/registry.ts';
import type { BattleLine } from '../domain/troop-options.ts';
import {
  countOf,
  formatPointsWithUnit,
  formatRatings,
  formatStandCount,
  formatTopographies,
  formatYear,
  formatYearSpan,
} from '../format.ts';
import { campText } from '../i18n/camp.ts';
import type { Locale } from '../i18n/locales.ts';
import { type Words, wordsFor } from '../i18n/translator.ts';
import { armyUrl, gameBuilderUrl } from '../navigation.ts';
import { fantasySheetWords, fantasyTextWords } from './fantasy-sheet-layout.ts';
import { noValue } from './sheet-layout.ts';

export const listTextFormats = ['plain', 'markdown', 'bbcode'] as const;

export type ListTextFormat = (typeof listTextFormats)[number];

type ListItem = {
  text: string;
  children: readonly string[];
};

type Block =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string; meta?: string }
  | { kind: 'line'; text: string; strong?: boolean }
  | { kind: 'list'; items: readonly ListItem[] };

type Renderer = (block: Block) => readonly string[];

const item = (text: string, children: readonly string[] = []): ListItem => ({
  text,
  children,
});

const withMeta = (text: string, meta: string | undefined) =>
  meta ? `${text} — ${meta}` : text;

const bbcodeList = (lines: readonly string[]) => [
  '[list]',
  ...lines,
  '[/list]',
];

const renderers: Readonly<Record<ListTextFormat, Renderer>> = {
  plain: (block) => {
    switch (block.kind) {
      case 'title':
        return [block.text];
      case 'heading':
        return [withMeta(block.text.toUpperCase(), block.meta)];
      case 'line':
        return [block.text];
      case 'list':
        return block.items.flatMap(({ text, children }) => [
          text,
          ...children.map((child) => `  ${child}`),
        ]);
    }
  },
  markdown: (block) => {
    switch (block.kind) {
      case 'title':
        return [`# ${block.text}`];
      case 'heading':
        return [`## ${withMeta(block.text, block.meta)}`];
      case 'line':
        return [block.strong ? `**${block.text}**` : block.text];
      case 'list':
        return block.items.flatMap(({ text, children }) => [
          `- ${text}`,
          ...children.map((child) => `  - ${child}`),
        ]);
    }
  },
  bbcode: (block) => {
    switch (block.kind) {
      case 'title':
        return [`[b]${block.text}[/b]`];
      case 'heading':
        return [withMeta(`[b]${block.text}[/b]`, block.meta)];
      case 'line':
        return [block.strong ? `[b]${block.text}[/b]` : block.text];
      case 'list':
        return bbcodeList(
          block.items.flatMap(({ text, children }) => [
            `[*]${text}`,
            ...(children.length > 0
              ? bbcodeList(children.map((child) => `[*]${child}`))
              : []),
          ]),
        );
    }
  },
};

const battleLineSuffixes = (
  w: Words,
): Readonly<Record<BattleLine, string>> => ({
  all: w('battleLineSuffix'),
  half: w('halfBattleLineSuffix'),
  none: '',
});

const contingentKindSuffixes = (
  w: Words,
): Readonly<Record<SheetContingent['kind'], string>> => ({
  main: '',
  optional: w('optionalContingentSuffix'),
  allied: w('alliedContingentSuffix'),
});

const standLine = (
  { stands, name, movement, points, general }: SheetStandLine,
  locale: Locale,
  w: Words,
) =>
  `${formatStandCount(stands, name)}${general ? w('standGeneral') : ''} — ${formatPointsWithUnit(points, locale)} · ${movement === null ? noValue : w('movementUnits', { distance: movement })}`;

const troopOptionItems = (
  option: SheetTroopOption,
  locale: Locale,
  w: Words,
): readonly ListItem[] => {
  const lines = option.lines.map((line) => standLine(line, locale, w));
  if (!option.description) {
    return lines.map((line) => item(line));
  }
  const note = option.note ? ` (${option.note})` : '';
  return [
    item(
      `${option.description}${note}${battleLineSuffixes(w)[option.battleLine]}`,
      lines,
    ),
  ];
};

const contingentBlocks = (
  contingent: SheetContingent,
  locale: Locale,
  w: Words,
): readonly Block[] => [
  {
    kind: 'heading',
    text: `${contingent.kind === 'main' ? w('mainContingent') : contingent.name}${contingentKindSuffixes(w)[contingent.kind]}`,
    meta: `${countOf(contingent.stands, 'stand')}, ${formatPointsWithUnit(contingent.points, locale)}`,
  },
  {
    kind: 'list',
    items: contingent.options.flatMap((option) =>
      troopOptionItems(option, locale, w),
    ),
  },
];

const battleCardItem = (
  { name, purchases, stands, points, attachedTo }: SheetBattleCard,
  locale: Locale,
  _w: Words,
) => {
  const copies = purchases > 1 ? ` ×${purchases}` : '';
  const added = stands > 0 ? `, ${countOf(stands, 'stand')}` : '';
  const attached = attachedTo.length > 0 ? ` (${attachedTo.join(', ')})` : '';
  return item(
    `${name}${copies} — ${formatPointsWithUnit(points, locale)}${added}${attached}`,
  );
};

const factItems = (
  sheet: ArmySheet,
  _locale: Locale,
  w: Words,
): readonly ListItem[] => [
  ...(sheet.subFaction
    ? [
        item(
          `${sheet.subFaction.label}: ${sheet.subFaction.name ?? w('notChosenInline')}`,
        ),
      ]
    : []),
  item(
    `${w('general')}: ${sheet.general ? `${sheet.general.name} (${sheet.general.option})` : w('notChosenInline')}`,
  ),
  item(`${w('camp')}: ${campText(sheet.camp, w)}`),
  item(`${w('invasionRating')}: ${formatRatings(sheet.invasionRatings)}`),
  item(`${w('manoeuvreRating')}: ${formatRatings(sheet.maneuverRatings)}`),
  item(`${w('homeTopography')}: ${formatTopographies(sheet.homeTopographies)}`),
];

const documentGroups = (
  sheet: ArmySheet,
  siteUrl: string,
  locale: Locale,
  w: Words,
): readonly (readonly Block[])[] => [
  [
    { kind: 'title', text: sheet.listName },
    {
      kind: 'line',
      text: [
        sheet.armyName,
        w('list', { key: sheet.key }),
        formatYearSpan(sheet.dateRange, locale),
      ].join(' · '),
    },
    {
      kind: 'line',
      strong: true,
      text: [
        formatPointsWithUnit(sheet.totals.total, locale),
        countOf(sheet.totals.stands, 'stand'),
        formatYear(sheet.year, locale),
      ].join(' · '),
    },
  ],
  [{ kind: 'list', items: factItems(sheet, locale, w) }],
  ...(sheet.contingents.length === 0
    ? [[{ kind: 'line', text: w('emptyList') } satisfies Block]]
    : sheet.contingents.map((contingent) =>
        contingentBlocks(contingent, locale, w),
      )),
  [
    { kind: 'heading', text: w('battleCards') },
    ...(sheet.battleCards.length === 0
      ? [{ kind: 'line', text: w('noBattleCards') } satisfies Block]
      : [
          {
            kind: 'list',
            items: sheet.battleCards.map((card) =>
              battleCardItem(card, locale, w),
            ),
          } satisfies Block,
        ]),
  ],
  [
    {
      kind: 'line',
      text: w('builtWith', { url: `${siteUrl}${armyUrl(sheet.armyId)}` }),
    },
    {
      kind: 'line',
      text: w('dataFrom', { version: sheet.dataVersion }),
    },
  ],
];

export type ListTextOptions = {
  format: ListTextFormat;
  siteUrl: string;
  locale: Locale;
};

export const armyListText = (
  sheet: ArmySheet,
  { format, siteUrl, locale }: ListTextOptions,
) => {
  const w = wordsFor(locale, 'sheet');
  const render = renderers[format];
  return documentGroups(sheet, siteUrl, locale, w)
    .map((group) => group.flatMap(render).join('\n'))
    .join('\n\n');
};

export const fantasyListText = (
  sheet: FantasySheet,
  { format, siteUrl, locale }: ListTextOptions,
) => {
  const w = fantasySheetWords(locale);
  const render = renderers[format];
  return [
    ...fantasyTextGroups(sheet, fantasyTextWords(locale)),
    [
      {
        kind: 'line',
        text: w('builtWith', { url: `${siteUrl}${gameBuilderUrl('fantasy')}` }),
      },
      { kind: 'line', text: w('dataFrom', { version: sheet.dataVersion }) },
    ] satisfies readonly Block[],
  ]
    .map((group) => group.flatMap(render).join('\n'))
    .join('\n\n');
};

export const listText = (list: ListSheet, options: ListTextOptions) => {
  switch (list.game) {
    case 'triumph':
      return armyListText(list.sheet, options);
    case 'fantasy':
      return fantasyListText(list.sheet, options);
  }
};
