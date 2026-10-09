import { IconChevronRight } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { Section } from '@/components/layout/section';
import { MarkdownProse } from '@/components/reference/markdown-prose';
import { Badge } from '@/components/ui/badge';
import type { FantasyCardText } from '@/lib/data/bundle';
import type { TroopTypeCategory, TroopTypeOrder } from '@/lib/data/schema';
import type { FantasyCardCategory } from '@/lib/domain/fantasy/battle-cards';
import {
  type CostLine,
  type CostQualifier,
  type DescribedConstraint,
  type DescribedSelector,
  type DescribedSelectorTerm,
  type FantasyCardNaming,
  type FantasyReferenceCard,
  type FantasyReferenceCardGroup,
  fantasyCardReference,
} from '@/lib/domain/fantasy/card-reference';
import { formatPoints, formatPointsWithUnit, joinWithOr } from '@/lib/format';
import type { Locale } from '@/lib/i18n/routing';
import { parseMarkdown } from '@/lib/markdown';

type Words = ReturnType<typeof useTranslations<'fantasyCards'>>;

const categoryLabels = {
  army: 'army',
  event: 'event',
  stand: 'stand',
  hero: 'hero',
  standOrHero: 'standOrHero',
} as const satisfies Record<FantasyCardCategory, string>;

const categoryDescriptions = {
  army: 'armyDescription',
  event: 'eventDescription',
  stand: 'standDescription',
  hero: 'heroDescription',
  standOrHero: 'standOrHeroDescription',
} as const satisfies Record<FantasyCardCategory, string>;

const orderLabels = {
  Close: 'closeOrder',
  Open: 'openOrder',
} as const satisfies Record<TroopTypeOrder, string>;

const troopCategoryLabels = {
  foot: 'foot',
  mounted: 'mounted',
} as const satisfies Record<TroopTypeCategory, string>;

const capitalised = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1);

const termText = (term: DescribedSelectorTerm, t: Words, locale: Locale) => {
  switch (term.kind) {
    case 'order':
      return t(orderLabels[term.order]);
    case 'category':
      return t(troopCategoryLabels[term.category]);
    case 'troopTypes':
      return joinWithOr(term.names, locale);
    case 'minMovement':
      return t('minMovement', { distance: term.distance });
    case 'cards':
      return t('carrying', { cards: joinWithOr(term.names, locale) });
  }
};

const selectorText = (selector: DescribedSelector, t: Words, locale: Locale) =>
  selector.map((term) => termText(term, t, locale)).join(', ');

const selectorsText = (
  selectors: readonly DescribedSelector[],
  t: Words,
  locale: Locale,
) =>
  joinWithOr(
    selectors.map((selector) => selectorText(selector, t, locale)),
    locale,
  );

const qualifierText = (qualifier: CostQualifier, t: Words, locale: Locale) => {
  switch (qualifier.kind) {
    case 'variant':
      return qualifier.name;
    case 'bearer':
      return qualifier.bearer === 'hero' ? t('onHero') : t('onStand');
    case 'denseTopography':
      return t('denseTopography', {
        topographies: qualifier.topographies.join(', '),
      });
    case 'otherTopography':
      return t('otherTopography');
    case 'stand':
      return capitalised(selectorText(qualifier.when, t, locale));
    case 'otherwise':
      return t('otherwise');
  }
};

const amountText = ({ points, basis }: CostLine, t: Words, locale: Locale) => {
  const amount = formatPointsWithUnit(points, locale);
  switch (basis.kind) {
    case 'once':
      return amount;
    case 'perCount':
      return t('perCount', { points: amount, max: basis.max });
    case 'perMarked':
      return t('perMarked', { points: amount });
  }
};

const costSummary = (lines: readonly CostLine[], locale: Locale, t: Words) => {
  const points = lines.map((line) => line.points);
  const min = Math.min(...points);
  const max = Math.max(...points);
  return min === max
    ? formatPointsWithUnit(min, locale)
    : t('pointsRange', { min: formatPoints(min), max: formatPoints(max) });
};

const constraintText = (
  constraint: DescribedConstraint,
  t: Words,
  locale: Locale,
) => {
  switch (constraint.kind) {
    case 'eligible':
    case 'ineligible':
      return t(constraint.kind, {
        who: selectorsText(constraint.anyOf, t, locale),
      });
    case 'excludedWith':
      return t('excludedWith', { cards: joinWithOr(constraint.cards, locale) });
    case 'requires':
      return t('requires', {
        bearer: constraint.bearer ?? 'any',
        cards: constraint.cards.join(', '),
      });
    case 'maxStandsPerArmy':
    case 'maxHeroesPerArmy':
      return t(constraint.kind, { max: constraint.max });
    case 'oncePerArmy':
    case 'notOnGeneral':
    case 'notOnHeroes':
    case 'oneClassPerArmy':
      return t(constraint.kind);
  }
};

function CardFacts({
  label,
  items,
}: {
  label: string;
  items: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>
        <ul className="flex flex-col gap-0.5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function FantasyCardEntry({ card }: { card: FantasyReferenceCard }) {
  const t = useTranslations('fantasyCards');
  const locale = useLocale();
  const cost = card.cost.map((line) => {
    const amount = amountText(line, t, locale);
    return line.qualifiers.length === 0
      ? amount
      : `${line.qualifiers.map((qualifier) => qualifierText(qualifier, t, locale)).join(' · ')}: ${amount}`;
  });
  return (
    <li>
      <details
        id={card.code}
        className="group scroll-mt-20 rounded-lg border bg-card"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
          <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <h3 className="font-heading text-sm font-semibold tracking-tight">
            {card.name}
          </h3>
          <Badge variant="outline" className="tabular-nums">
            {costSummary(card.cost, locale, t)}
          </Badge>
        </summary>
        <div className="flex flex-col gap-3 px-3 pb-3 pl-9">
          <dl className="flex max-w-reading flex-col gap-3">
            <CardFacts label={t('cost')} items={cost} />
            {card.choices.length > 0 && (
              <CardFacts
                label={t('choices')}
                items={card.choices.map((options) =>
                  joinWithOr(options, locale),
                )}
              />
            )}
            {card.constraints.length > 0 && (
              <CardFacts
                label={t('restrictions')}
                items={card.constraints.map((constraint) =>
                  constraintText(constraint, t, locale),
                )}
              />
            )}
          </dl>
          <MarkdownProse blocks={parseMarkdown(card.text)} headingLevel={4} />
        </div>
      </details>
    </li>
  );
}

function FantasyCardGroupSection({
  group,
}: {
  group: FantasyReferenceCardGroup;
}) {
  const t = useTranslations('fantasyCards');
  return (
    <Section
      title={t(categoryLabels[group.category])}
      description={t(categoryDescriptions[group.category])}
    >
      <ul className="flex flex-col gap-2">
        {group.cards.map((card) => (
          <FantasyCardEntry key={card.code} card={card} />
        ))}
      </ul>
    </Section>
  );
}

export function FantasyCardReference({
  naming,
  text,
}: {
  naming: FantasyCardNaming;
  text: Readonly<FantasyCardText>;
}) {
  return fantasyCardReference(naming, text).map((group) => (
    <FantasyCardGroupSection key={group.category} group={group} />
  ));
}
