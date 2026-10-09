import { createTranslator } from 'next-intl';
import type { MeshweshHomeTopography, MeshweshRating } from './data/schema.ts';
import { countOf, plural } from './domain/plural.ts';
import { formattingLocales, type Locale } from './i18n/locales.ts';
import { messagesFor } from './i18n/messages.ts';

export { countOf, plural };

export type YearSpan = {
  startDate: number;
  endDate: number;
};

const perLocale = <T>(create: (tag: string) => T) => {
  const made = new Map<Locale, T>();
  return (locale: Locale) => {
    const existing = made.get(locale);
    if (existing) {
      return existing;
    }
    const created = create(formattingLocales[locale]);
    made.set(locale, created);
    return created;
  };
};

const alternatives = perLocale(
  (tag) => new Intl.ListFormat(tag, { type: 'disjunction' }),
);

const conjunctions = perLocale(
  (tag) => new Intl.ListFormat(tag, { type: 'conjunction' }),
);

const wordsFor = (() => {
  const made = new Map<
    Locale,
    (key: string, values?: Record<string, string | number>) => string
  >();
  return (locale: Locale) => {
    const existing = made.get(locale);
    if (existing) {
      return existing;
    }
    const created = createTranslator({
      locale,
      messages: messagesFor(locale),
      namespace: 'format',
    }) as unknown as (
      key: string,
      values?: Record<string, string | number>,
    ) => string;
    made.set(locale, created);
    return created;
  };
})();

const era = (year: number, locale: Locale) =>
  wordsFor(locale)(year < 0 ? 'bc' : 'ad');

export const formatYear = (year: number, locale: Locale) =>
  `${Math.abs(year)} ${era(year, locale)}`;

export const formatYearSpan = (
  { startDate, endDate }: YearSpan,
  locale: Locale,
) => {
  if (startDate === endDate) {
    return formatYear(startDate, locale);
  }
  return era(startDate, locale) === era(endDate, locale)
    ? `${Math.abs(startDate)}–${formatYear(endDate, locale)}`
    : `${formatYear(startDate, locale)} – ${formatYear(endDate, locale)}`;
};

export const formatYearSpans = (spans: readonly YearSpan[], locale: Locale) =>
  spans.map((span) => formatYearSpan(span, locale)).join(', ');

const half = '½';

export const formatPoints = (points: number) => {
  const sign = points < 0 ? '-' : '';
  const magnitude = Math.abs(points);
  const whole = Math.floor(magnitude);
  if (magnitude - whole !== 0.5) {
    return `${points}`;
  }
  return `${sign}${whole === 0 ? '' : whole}${half}`;
};

export const formatStandCount = (stands: number, troopType: string) =>
  `${stands} × ${troopType}`;

export const formatRange = (min: number, max: number) =>
  min === max ? `${min}` : `${min}–${max}`;

export const formatPointsWithUnit = (points: number, locale: Locale) =>
  wordsFor(locale)('points', {
    points: formatPoints(points),
    count: Math.abs(points) === 1 || Math.abs(points) === 0.5 ? 1 : 2,
  });

export const formatAllowance = (
  min: number | null,
  max: number | null,
  locale: Locale,
) => {
  if (min === null && max === null) {
    return null;
  }
  if (min !== null && max !== null) {
    return formatRange(min, max);
  }
  return max === null
    ? wordsFor(locale)('from', { min: min as number })
    : wordsFor(locale)('upTo', { max });
};

export const formatRatings = (ratings: readonly MeshweshRating[]) =>
  ratings
    .map(({ value, note }) => (note ? `${value} (${note})` : `${value}`))
    .join(', ');

export const formatTopographies = (
  homeTopographies: readonly MeshweshHomeTopography[],
) =>
  homeTopographies
    .map(({ values, note }) =>
      note ? `${values.join(', ')} (${note})` : values.join(', '),
    )
    .join('; ');

export const joinWithOr = (items: readonly string[], locale: Locale) =>
  alternatives(locale).format(items);

export const joinWithAnd = (items: readonly string[], locale: Locale) =>
  conjunctions(locale).format(items);

export type AlternativePart =
  | { kind: 'item'; index: number }
  | { kind: 'separator'; text: string };

export const alternativeParts = (
  count: number,
  locale: Locale,
): readonly AlternativePart[] =>
  alternatives(locale)
    .formatToParts(Array.from({ length: count }, (_, i) => String(i)))
    .map((part) =>
      part.type === 'element'
        ? { kind: 'item', index: Number(part.value) }
        : { kind: 'separator', text: part.value },
    );

export const formatArmyListCount = (count: number, locale: Locale) =>
  wordsFor(locale)('armyListCount', { count });

export const formatStands = (count: number, locale: Locale) =>
  wordsFor(locale)('stands', { count });

export const formatListCount = (count: number, locale: Locale) =>
  wordsFor(locale)('lists', { count });

export const formatStandsOfRange = (
  stands: number,
  min: number,
  max: number,
  locale: Locale,
) =>
  wordsFor(locale)('standsOfRange', {
    stands,
    range: formatRange(min, max),
    max,
  });

const longDate = perLocale(
  (tag) => new Intl.DateTimeFormat(tag, { dateStyle: 'long', timeZone: 'UTC' }),
);

export const formatDate = (iso: string, locale: Locale) =>
  longDate(locale).format(new Date(iso));

const relativeTime = perLocale(
  (tag) => new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }),
);

const second = 1;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const week = 7 * day;
const month = 30 * day;
const year = 365 * day;

type TimeDivision = {
  until: number;
  size: number;
  unit: Intl.RelativeTimeFormatUnit;
};

const timeDivisions: readonly TimeDivision[] = [
  { until: minute, size: second, unit: 'second' },
  { until: hour, size: minute, unit: 'minute' },
  { until: day, size: hour, unit: 'hour' },
  { until: week, size: day, unit: 'day' },
  { until: month, size: week, unit: 'week' },
  { until: year, size: month, unit: 'month' },
];

const years: TimeDivision = {
  until: Number.POSITIVE_INFINITY,
  size: year,
  unit: 'year',
};

export const formatTimeAgo = (
  iso: string,
  locale: Locale,
  now: number = Date.now(),
) => {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) {
    return null;
  }
  const elapsed = Math.max(0, Math.round((now - at) / 1000));
  const { size, unit } =
    timeDivisions.find(({ until }) => elapsed < until) ?? years;
  return relativeTime(locale).format(-Math.floor(elapsed / size), unit);
};

const wholeNumber = perLocale((tag) => new Intl.NumberFormat(tag));

export const formatCount = (count: number, locale: Locale) =>
  wholeNumber(locale).format(count);

const regionNames = perLocale(
  (tag) => new Intl.DisplayNames(tag, { type: 'region', fallback: 'code' }),
);

export const formatCountry = (code: string, locale: Locale) => {
  try {
    return regionNames(locale).of(code) ?? code;
  } catch {
    return code;
  }
};
