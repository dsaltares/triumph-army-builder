'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { findingAnchorClass } from '@/components/builder/finding-anchor';
import { Stepper } from '@/components/builder/stepper';
import { ChosenCard } from '@/components/fantasy/chosen-card';
import { armyCardsAnchor } from '@/components/fantasy/fantasy-anchors';
import { PickerDialog } from '@/components/fantasy/picker-dialog';
import { usePointsWords } from '@/components/fantasy/points-words';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { Section } from '@/components/layout/section';
import { Card, CardContent } from '@/components/ui/card';
import type { FantasyCardCode } from '@/lib/data/schema';
import {
  armyCardOffers,
  cardCountMax,
  withArmyCard,
  withArmyCardCount,
  withArmyCardVariant,
  withoutArmyCard,
} from '@/lib/domain/fantasy/builder';
import { fantasyCardName } from '@/lib/domain/fantasy/naming';
import {
  type FantasyArmyLine,
  mobileInfantryCode,
  transportsMarked,
} from '@/lib/domain/fantasy/points';
import type { FantasyCatalogue } from '@/lib/domain/fantasy/reference';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';

const armyLineOf = (lines: readonly FantasyArmyLine[], code: FantasyCardCode) =>
  lines.find(
    (line): line is Extract<FantasyArmyLine, { kind: 'armyCard' }> =>
      line.kind === 'armyCard' && line.code === code,
  );

export function ArmyCardsSection({
  selection,
  lines,
  catalogue,
  onEdit,
}: {
  selection: FantasySelection;
  lines: readonly FantasyArmyLine[];
  catalogue: FantasyCatalogue;
  onEdit: SelectionEdit;
}) {
  const t = useTranslations('fantasyBuilder');
  const words = usePointsWords();
  const army = t('theArmy');
  const offers = useMemo(
    () => armyCardOffers(catalogue, selection),
    [catalogue, selection],
  );
  const transports = transportsMarked(selection.units);

  return (
    <Section
      id={armyCardsAnchor}
      className={findingAnchorClass}
      title={t('armyCards')}
      description={t('armyCardsDescription')}
    >
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          {selection.armyCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noArmyCards')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selection.armyCards.map((choice) => {
                const card = catalogue.cards.get(choice.code);
                const name = fantasyCardName(choice.code, card);
                const max = card ? cardCountMax(card) : 1;
                const count = choice.count ?? 1;
                const line = armyLineOf(lines, choice.code);
                return (
                  <ChosenCard
                    key={choice.code}
                    code={choice.code}
                    card={card}
                    choice={choice}
                    cost={words.each(line?.points ?? null)}
                    bearer={army}
                    onRemove={() =>
                      onEdit((current) => withoutArmyCard(current, choice.code))
                    }
                    onVariant={(variant, option) =>
                      onEdit((current) =>
                        withArmyCardVariant(
                          current,
                          choice.code,
                          variant,
                          option,
                        ),
                      )
                    }
                  >
                    {choice.code === mobileInfantryCode ? (
                      <p className="text-xs text-muted-foreground">
                        {t('transportsCounted', { count: transports })}
                      </p>
                    ) : (
                      max > 1 && (
                        <Stepper
                          count={count}
                          countLabel={t('copiesOf', { card: name })}
                          removeLabel={t('oneFewerCopy', { card: name })}
                          addLabel={t('oneMoreCopy', { card: name })}
                          canRemove={count > 1}
                          canAdd={count < max}
                          onChange={(next) =>
                            onEdit((current) =>
                              withArmyCardCount(current, choice.code, next),
                            )
                          }
                        />
                      )
                    )}
                  </ChosenCard>
                );
              })}
            </ul>
          )}
          <PickerDialog<FantasyCardCode>
            trigger={t('addArmyCard')}
            title={t('addArmyCard')}
            description={t('addArmyCardDescription')}
            empty={t('noCardsOffered')}
            groups={[
              {
                heading: t('armyCards'),
                options: offers.map(({ card, points }) => ({
                  value: card.code,
                  label: card.name,
                  detail: words.each(points),
                })),
              },
            ]}
            onPick={(code) => onEdit((current) => withArmyCard(current, code))}
          />
        </CardContent>
      </Card>
    </Section>
  );
}
