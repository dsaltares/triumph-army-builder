'use client';

import { IconArrowsSplit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { findingAnchorClass } from '@/components/builder/finding-anchor';
import { Stepper } from '@/components/builder/stepper';
import { TagField } from '@/components/collection/tag-field';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { ChosenCard } from '@/components/fantasy/chosen-card';
import { unitAnchor } from '@/components/fantasy/fantasy-anchors';
import {
  PickerDialog,
  type PickerGroup,
} from '@/components/fantasy/picker-dialog';
import { usePointsWords } from '@/components/fantasy/points-words';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { Section } from '@/components/layout/section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  type FantasyCardCode,
  type TroopTypeCode,
  troopTypeCategories,
  troopTypeOrders,
} from '@/lib/data/schema';
import {
  canSplit,
  cardCountMax,
  takesNote,
  unitCardOffers,
  unitEventCardOffers,
  unitMayBeDelayed,
  unitMayRide,
  withoutUnit,
  withoutUnitCard,
  withUnitAdded,
  withUnitCard,
  withUnitCardNote,
  withUnitCardVariant,
  withUnitEventCard,
  withUnitMark,
  withUnitName,
  withUnitSplit,
  withUnitStands,
  withUnitTags,
} from '@/lib/domain/fantasy/builder';
import { fantasyCardName, unitName } from '@/lib/domain/fantasy/naming';
import type { FantasyUnitPoints } from '@/lib/domain/fantasy/points';
import type { FantasyCatalogue } from '@/lib/domain/fantasy/reference';
import type {
  FantasyListFormat,
  FantasyUnit,
} from '@/lib/domain/fantasy/selection-schema';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import { formatPoints } from '@/lib/format';

type UnitContext = {
  catalogue: FantasyCatalogue;
  names: TroopTypeNames;
  format: FantasyListFormat;
  onEdit: SelectionEdit;
  newId: () => string;
};

function SplitDialog({
  unit,
  name,
  open,
  onOpenChange,
  onSplit,
}: {
  unit: FantasyUnit;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSplit: (stands: number) => void;
}) {
  const t = useTranslations('fantasyBuilder');
  const [moved, setMoved] = useState(1);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('splitTitle', { unit: name })}</DialogTitle>
          <DialogDescription>{t('splitDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <Stepper
            count={moved}
            countLabel={t('standsToMove')}
            removeLabel={t('moveFewer')}
            addLabel={t('moveMore')}
            canRemove={moved > 1}
            canAdd={moved < unit.stands - 1}
            onChange={setMoved}
          />
          <p className="text-sm text-muted-foreground">
            {t('splitLeaves', { moved, kept: unit.stands - moved })}
          </p>
        </div>
        <DialogFooter>
          <Button
            size="touch"
            onClick={() => {
              onSplit(moved);
              onOpenChange(false);
            }}
          >
            {t('splitConfirm', { moved })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepperRow({
  title,
  detail,
  count,
  min = 0,
  max,
  removeLabel,
  addLabel,
  onChange,
}: {
  title: string;
  detail: string;
  count: number;
  min?: number;
  max: number;
  removeLabel: string;
  addLabel: string;
  onChange: (count: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Stepper
        count={count}
        countLabel={title}
        removeLabel={removeLabel}
        addLabel={addLabel}
        canRemove={count > min}
        canAdd={count < max}
        onChange={onChange}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
      </div>
    </div>
  );
}

function UnitCard({
  unit,
  priced,
  general,
  context,
}: {
  unit: FantasyUnit;
  priced: FantasyUnitPoints | undefined;
  general: boolean;
  context: UnitContext;
}) {
  const t = useTranslations('fantasyBuilder');
  const words = usePointsWords();
  const { catalogue, names, format, onEdit, newId } = context;
  const [draftTag, setDraftTag] = useState('');
  const [splitting, setSplitting] = useState(false);
  const name = unitName(unit, names);
  const troopTypeName = names[unit.troopType];
  const offers = useMemo(
    () => unitCardOffers(catalogue, unit, format),
    [catalogue, unit, format],
  );
  const eventOffers = useMemo(
    () => unitEventCardOffers(catalogue, unit, format),
    [catalogue, unit, format],
  );
  const delayable = unitMayBeDelayed(catalogue, unit);
  const rides = unitMayRide(catalogue, unit);
  const edit = (change: Parameters<SelectionEdit>[0]) => onEdit(change);

  return (
    <li id={unitAnchor(unit.id)} className={findingAnchorClass}>
      <Card size="sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                aria-label={t('unitName')}
                value={unit.name}
                placeholder={troopTypeName}
                className="h-11 min-w-0 flex-1 font-medium sm:h-9"
                onChange={(event) =>
                  edit((selection) =>
                    withUnitName(selection, unit.id, event.target.value),
                  )
                }
              />
              {general && <Badge variant="secondary">{t('general')}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('unitCost', {
                troopType: troopTypeName,
                stands: unit.stands,
                perStand: formatPoints(priced?.pointsPerStand ?? 0),
                points: formatPoints(priced?.points ?? 0),
              })}
            </p>
          </div>

          <TagField
            tags={unit.tags}
            draft={draftTag}
            troopType={unit.troopType}
            error={undefined}
            onDraftChange={setDraftTag}
            onTagsChange={(tags) =>
              edit((selection) => withUnitTags(selection, unit.id, tags))
            }
            onBlur={() => undefined}
          />

          <StepperRow
            title={t('stands')}
            detail={t('standsDetail', {
              perStand: formatPoints(priced?.pointsPerStand ?? 0),
            })}
            count={unit.stands}
            min={1}
            max={Number.POSITIVE_INFINITY}
            removeLabel={t('oneFewerStand', { unit: name })}
            addLabel={t('oneMoreStand', { unit: name })}
            onChange={(stands) =>
              edit((selection) => withUnitStands(selection, unit.id, stands))
            }
          />

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t('cards')}</h3>
            {unit.cards.length > 0 && (
              <ul className="flex flex-col gap-2">
                {unit.cards.map((choice, index) => (
                  <ChosenCard
                    key={choice.code}
                    code={choice.code}
                    card={catalogue.cards.get(choice.code)}
                    choice={choice}
                    cost={words.perStand(priced?.cards[index]?.points ?? null)}
                    bearer={name}
                    onRemove={() =>
                      edit((selection) =>
                        withoutUnitCard(selection, unit.id, choice.code),
                      )
                    }
                    onVariant={(variant, option) =>
                      edit((selection) =>
                        withUnitCardVariant(
                          selection,
                          unit.id,
                          choice.code,
                          variant,
                          option,
                        ),
                      )
                    }
                    onNote={
                      takesNote(choice.code)
                        ? (note) =>
                            edit((selection) =>
                              withUnitCardNote(
                                selection,
                                unit.id,
                                choice.code,
                                note,
                              ),
                            )
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
            <PickerDialog<FantasyCardCode>
              trigger={t('addCard')}
              title={t('addCardTo', { bearer: name })}
              description={t('addCardDescription')}
              empty={t('noCardsOffered')}
              groups={[
                {
                  heading: t('standCards'),
                  options: offers.map(({ card, points }) => ({
                    value: card.code,
                    label: card.name,
                    detail: words.perStand(points),
                  })),
                },
              ]}
              onPick={(code) =>
                edit((selection) => withUnitCard(selection, unit.id, code))
              }
            />
          </div>

          {eventOffers.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium">{t('eventCards')}</h3>
              {eventOffers.map(({ card, points }) => (
                <StepperRow
                  key={card.code}
                  title={card.name}
                  detail={words.each(points)}
                  count={unit.marks.eventCards[card.code] ?? 0}
                  max={cardCountMax(card)}
                  removeLabel={t('oneFewerCard', {
                    card: card.name,
                    unit: name,
                  })}
                  addLabel={t('oneMoreCard', { card: card.name, unit: name })}
                  onChange={(count) =>
                    edit((selection) =>
                      withUnitEventCard(selection, unit.id, card.code, count),
                    )
                  }
                />
              ))}
            </div>
          )}

          {(delayable || rides) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium">{t('markedStands')}</h3>
              {delayable && (
                <StepperRow
                  title={fantasyCardName(
                    'delayedEntry',
                    catalogue.cards.get('delayedEntry'),
                  )}
                  detail={t('delayedEntryHint')}
                  count={unit.marks.delayedEntry}
                  max={unit.stands}
                  removeLabel={t('oneFewerDelayed', { unit: name })}
                  addLabel={t('oneMoreDelayed', { unit: name })}
                  onChange={(count) =>
                    edit((selection) =>
                      withUnitMark(selection, unit.id, 'delayedEntry', count),
                    )
                  }
                />
              )}
              {rides && (
                <StepperRow
                  title={t('transports')}
                  detail={t('transportsHint', {
                    card: fantasyCardName(
                      'mobileInfantry',
                      catalogue.cards.get('mobileInfantry'),
                    ),
                  })}
                  count={unit.marks.transports}
                  max={unit.stands}
                  removeLabel={t('oneFewerTransport', { unit: name })}
                  addLabel={t('oneMoreTransport', { unit: name })}
                  onChange={(count) =>
                    edit((selection) =>
                      withUnitMark(selection, unit.id, 'transports', count),
                    )
                  }
                />
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="touch"
              disabled={!canSplit(unit)}
              onClick={() => setSplitting(true)}
            >
              <IconArrowsSplit data-icon="inline-start" />
              {t('split')}
            </Button>
            <Button
              variant="outline"
              size="touch"
              aria-label={t('removeUnit', { unit: name })}
              onClick={() =>
                edit((selection) => withoutUnit(selection, unit.id))
              }
            >
              <IconTrash data-icon="inline-start" />
              {t('remove')}
            </Button>
          </div>
        </CardContent>
      </Card>
      {splitting && (
        <SplitDialog
          open
          unit={unit}
          name={name}
          onOpenChange={setSplitting}
          onSplit={(moved) => {
            const id = newId();
            edit((selection) => withUnitSplit(selection, unit.id, moved, id));
          }}
        />
      )}
    </li>
  );
}

const troopTypeGroups = (
  catalogue: FantasyCatalogue,
  heading: (category: string, order: string) => string,
  cost: (points: number) => string,
): readonly PickerGroup<TroopTypeCode>[] =>
  troopTypeCategories.flatMap((category) =>
    troopTypeOrders.map((order) => ({
      heading: heading(category, order),
      options: [...catalogue.troopTypes.values()]
        .filter(
          (troopType) =>
            troopType.category === category && troopType.order === order,
        )
        .map((troopType) => ({
          value: troopType.permanentCode,
          label: troopType.displayName,
          detail: cost(troopType.cost),
        })),
    })),
  );

export function UnitsSection({
  units,
  priced,
  general,
  context,
}: {
  units: readonly FantasyUnit[];
  priced: readonly FantasyUnitPoints[];
  general: string | null;
  context: UnitContext;
}) {
  const t = useTranslations('fantasyBuilder');
  const { catalogue, onEdit, newId } = context;
  const groups = useMemo(
    () =>
      troopTypeGroups(
        catalogue,
        (category, order) => t('troopTypeGroup', { category, order }),
        (points) => t('baseCost', { points: formatPoints(points) }),
      ),
    [catalogue, t],
  );
  const addUnit = (
    <PickerDialog<TroopTypeCode>
      trigger={t('addUnit')}
      title={t('addUnit')}
      description={t('addUnitDescription')}
      empty={t('noTroopTypes')}
      groups={groups}
      onPick={(troopType) => {
        const id = newId();
        onEdit((selection) => withUnitAdded(selection, id, troopType));
      }}
    />
  );

  return (
    <Section title={t('units')} description={t('unitsDescription')}>
      {units.length === 0 ? (
        <EmptyState title={t('noUnits')} actions={addUnit}>
          <EmptyStateText>{t('noUnitsBody')}</EmptyStateText>
        </EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {units.map((unit) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                priced={priced.find((candidate) => candidate.unit === unit.id)}
                general={unit.id === general}
                context={context}
              />
            ))}
          </ul>
          {addUnit}
        </>
      )}
    </Section>
  );
}
