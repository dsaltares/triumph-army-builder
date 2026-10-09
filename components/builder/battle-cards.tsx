'use client';

import { IconInfoCircle } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { describeCost } from '@/components/builder/battle-card-cost';
import { BattleCardSheet } from '@/components/builder/battle-card-sheet';
import { boundsHint } from '@/components/builder/bounds-hint';
import {
  findingAnchor,
  findingAnchorClass,
} from '@/components/builder/finding-anchor';
import { Stepper } from '@/components/builder/stepper';
import { troopOptionName } from '@/components/builder/troop-option-card';
import { useBattleCardText } from '@/components/builder/use-battle-card-text';
import { withholdingLabels } from '@/components/builder/withholding';
import { Section } from '@/components/layout/section';
import { Notice } from '@/components/notice';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { BattleCardCode } from '@/lib/data/schema';
import type { TroopOption } from '@/lib/domain/army/army-list';
import type {
  BattleCardChoice,
  BattleCardChoices,
  TroopOptionBattleCards,
} from '@/lib/domain/army/battle-card-selection';
import { triumphRules } from '@/lib/domain/games/triumph-rules';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import { formatAllowance, formatPointsWithUnit } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locales';
import { cn } from '@/lib/utils';

type ArmyCardChange = (code: BattleCardCode, copies: number) => void;

type TroopCardChange = (
  option: TroopOption,
  code: BattleCardCode,
  stands: number,
) => void;

const units = {
  copies: 'unitCopies',
  stands: 'unitStands',
  purchases: 'unitPurchases',
  cards: 'unitCards',
} as const;

type Unit = keyof typeof units;

const purchaseCovers = {
  army: 'scopeArmy',
  everyStand: 'scopeEveryStand',
  eachCard: 'scopeEachCard',
} as const;

const unitOf = ({
  purchasedPer,
  appliedPerStand,
  cardsPerArmy,
}: BattleCardChoice): Unit => {
  if (appliedPerStand) {
    return 'stands';
  }
  if (purchasedPer === 'army') {
    return 'purchases';
  }
  return cardsPerArmy === null ? 'purchases' : 'cards';
};

const coverageOf = (choice: BattleCardChoice) => {
  if (choice.purchasedPer === 'army') {
    return purchaseCovers.army;
  }
  return choice.cardsPerArmy === null
    ? purchaseCovers.everyStand
    : purchaseCovers.eachCard;
};

const exceedsStandsNotice = (
  name: string,
  unit: Unit,
  t: ReturnType<typeof useTranslations<'builder'>>,
) =>
  unit === 'stands'
    ? t('exceedsStands', { name })
    : t('exceedsNoStands', { name });

const costSummary = ({ rule, points }: BattleCardChoice, locale: Locale) => {
  const price = describeCost(rule, locale);
  const cost = formatPointsWithUnit(points, locale);
  return points === 0 || price === cost ? price : `${price} · ${cost}`;
};

function ChoiceRow({
  choice,
  scope,
  anchor,
  onChange,
  onOpenRules,
}: {
  choice: BattleCardChoice;
  scope: 'army' | 'troopOption';
  anchor: string;
  onChange: (count: number) => void;
  onOpenRules: () => void;
}) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const { name, count, min, max, note, canAdd, canRemove } = choice;
  const unit = scope === 'army' ? 'copies' : unitOf(choice);
  const covers =
    unit === 'stands' || scope === 'army' ? null : coverageOf(choice);
  const one = t(units[unit], { count: 1 });
  const many = t(units[unit], { count: 2 });
  const allowance = formatAllowance(min, max, locale);
  const hint = boundsHint(choice.bounds, count, min, max, locale);
  return (
    <li id={anchor} className={cn('flex flex-col gap-2', findingAnchorClass)}>
      <div className="flex items-center gap-2">
        <Stepper
          count={count}
          countLabel={t('unitsOf', { unit: many, name })}
          removeLabel={t('oneFewer', { name, unit: one })}
          addLabel={t('oneMore', { name, unit: one })}
          canAdd={canAdd}
          canRemove={canRemove}
          onChange={onChange}
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
              onClick={onOpenRules}
            >
              {name}
              <span className="sr-only">rules</span>
              <IconInfoCircle className="size-3.5 text-muted-foreground" />
            </button>
            <span
              className={cn(
                'text-xs tabular-nums',
                hint ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {allowance
                ? t('allowanceOfUnit', { allowance, unit: many })
                : many}
              {hint && ` · ${hint}`}
            </span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {costSummary(choice, locale)}
          </p>
          {covers && (
            <p className="max-w-reading text-xs text-pretty text-muted-foreground">
              {t(covers)}
            </p>
          )}
          {note && (
            <Badge
              variant="outline"
              className="h-auto max-w-reading rounded-md py-0.5 text-left whitespace-normal"
            >
              {note}
            </Badge>
          )}
        </div>
      </div>
      {choice.exceedsStands && (
        <Notice>{exceedsStandsNotice(name, unit, t)}</Notice>
      )}
    </li>
  );
}

function ChoiceCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="h-full">
      <Card size="sm" className="h-full">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-heading text-sm font-medium">{title}</h3>
              {badge}
            </div>
            <p className="max-w-reading text-xs text-pretty text-muted-foreground">
              {description}
            </p>
          </div>
          {children}
        </CardContent>
      </Card>
    </li>
  );
}

const troopOptionDescription = (
  stands: number,
  t: ReturnType<typeof useTranslations<'builder'>>,
) =>
  stands === 0 ? t('takeStandsFirst') : t('putOnStands', { count: stands });

function TroopOptionCards({
  group,
  troopTypeNames,
  onTroopCardChange,
  onOpenRules,
}: {
  group: TroopOptionBattleCards;
  troopTypeNames: TroopTypeNames;
  onTroopCardChange: TroopCardChange;
  onOpenRules: (code: BattleCardCode) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('builder');
  const { option, stands, withheldBy, choices } = group;
  return (
    <ChoiceCard
      title={troopOptionName(option, troopTypeNames, locale)}
      description={troopOptionDescription(stands, t)}
      badge={
        withheldBy && (
          <Badge variant="destructive" className="mt-0.5 shrink-0">
            {t(withholdingLabels[withheldBy])}
          </Badge>
        )
      }
    >
      <ul className="flex flex-col gap-3">
        {choices.map((choice) => (
          <ChoiceRow
            key={choice.code}
            choice={choice}
            scope="troopOption"
            anchor={findingAnchor({
              kind: 'troopBattleCard',
              code: choice.code,
              option: option.id,
            })}
            onChange={(count) => onTroopCardChange(option, choice.code, count)}
            onOpenRules={() => onOpenRules(choice.code)}
          />
        ))}
      </ul>
      {withheldBy && <Notice>{t('cardsStillCount')}</Notice>}
    </ChoiceCard>
  );
}

export function BattleCardsSection({
  choices,
  troopTypeNames,
  onArmyCardChange,
  onTroopCardChange,
}: {
  choices: BattleCardChoices;
  troopTypeNames: TroopTypeNames;
  onArmyCardChange: ArmyCardChange;
  onTroopCardChange: TroopCardChange;
}) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const [opened, setOpened] = useState<BattleCardCode | null>(null);
  const text = useBattleCardText(opened !== null);
  const { army, troopOptions, offered, taken, points } = choices;

  return (
    <Section
      title={t('battleCards')}
      description={t('battleCardsDescription', {
        cap: triumphRules.pointsCap,
      })}
    >
      {offered === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('noBattleCardsOffered')}
        </p>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {army.length > 0 && (
              <ChoiceCard
                title={t('armyAsWhole')}
                description={t('armyAsWholeDescription')}
              >
                <ul className="flex flex-col gap-3">
                  {army.map((choice) => (
                    <ChoiceRow
                      key={choice.code}
                      choice={choice}
                      scope="army"
                      anchor={findingAnchor({
                        kind: 'armyBattleCard',
                        code: choice.code,
                      })}
                      onChange={(copies) =>
                        onArmyCardChange(choice.code, copies)
                      }
                      onOpenRules={() => setOpened(choice.code)}
                    />
                  ))}
                </ul>
              </ChoiceCard>
            )}
            {troopOptions.map((group) => (
              <TroopOptionCards
                key={group.option.id}
                group={group}
                troopTypeNames={troopTypeNames}
                onTroopCardChange={onTroopCardChange}
                onOpenRules={setOpened}
              />
            ))}
          </ul>

          <p className="text-xs text-muted-foreground tabular-nums">
            {t('cardsSummary', {
              taken,
              offered,
              points: formatPointsWithUnit(points, locale),
            })}
          </p>
        </>
      )}

      <BattleCardSheet
        card={
          [...army, ...troopOptions.flatMap((group) => group.choices)].find(
            ({ code }) => code === opened,
          ) ?? null
        }
        state={text}
        onClose={() => setOpened(null)}
      />
    </Section>
  );
}
