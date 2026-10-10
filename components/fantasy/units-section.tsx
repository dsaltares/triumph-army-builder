'use client';

import { IconArrowsSplit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { Autocomplete } from '@/components/autocomplete';
import { findingAnchorClass } from '@/components/builder/finding-anchor';
import { Stepper } from '@/components/builder/stepper';
import { TagField } from '@/components/collection/tag-field';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { ChosenCard } from '@/components/fantasy/chosen-card';
import { unitAnchor } from '@/components/fantasy/fantasy-anchors';
import { PickerDialog } from '@/components/fantasy/picker-dialog';
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
import { Label } from '@/components/ui/label';
import type { BundledFantasyCard } from '@/lib/data/bundle';
import {
  type FantasyCardCode,
  type TroopTypeCode,
  troopTypeCodes,
} from '@/lib/data/schema';
import type { TagWord } from '@/lib/domain/collection/tag-words';
import {
  canSplit,
  cardCountMax,
  cardPoints,
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
  withUnitTroopType,
} from '@/lib/domain/fantasy/builder';
import { fantasyCardName, unitName } from '@/lib/domain/fantasy/naming';
import {
  delayedEntryCode,
  eventCardsOf,
  type FantasyUnitPoints,
  mobileInfantryCode,
} from '@/lib/domain/fantasy/points';
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
  tagWords: readonly TagWord[];
};

const troopTypeOptions = (catalogue: FantasyCatalogue) =>
  troopTypeCodes.filter((code) => catalogue.troopTypes.has(code));

const troopTypeLabel =
  (catalogue: FantasyCatalogue) => (code: TroopTypeCode) => {
    const name = catalogue.troopTypes.get(code)?.displayName;
    return name ? `${code} · ${name}` : code;
  };

const markCards = {
  delayedEntry: delayedEntryCode,
  transports: mobileInfantryCode,
} as const;

function CountedCard({
  code,
  card,
  cost,
  bearer,
  count,
  max,
  caption,
  removeLabel,
  addLabel,
  onCount,
}: {
  code: FantasyCardCode;
  card: BundledFantasyCard | undefined;
  cost: string;
  bearer: string;
  count: number;
  max: number;
  caption: string;
  removeLabel: string;
  addLabel: string;
  onCount: (count: number) => void;
}) {
  return (
    <ChosenCard
      code={code}
      card={card && { ...card, variants: {} }}
      choice={{}}
      cost={cost}
      bearer={bearer}
      onRemove={() => onCount(0)}
      onVariant={() => undefined}
    >
      <div className="flex items-center gap-3">
        <Stepper
          count={count}
          countLabel={caption}
          removeLabel={removeLabel}
          addLabel={addLabel}
          canRemove={count > 1}
          canAdd={count < max}
          onChange={onCount}
        />
        <p className="text-xs text-muted-foreground tabular-nums">{caption}</p>
      </div>
    </ChosenCard>
  );
}

function UnitIdentity({
  catalogue,
  troopType,
  name,
  placeholder,
  onTroopType,
  onName,
}: {
  catalogue: FantasyCatalogue;
  troopType: TroopTypeCode | null;
  name: string;
  placeholder: string;
  onTroopType: (troopType: TroopTypeCode) => void;
  onName: (name: string) => void;
}) {
  const t = useTranslations('fantasyBuilder');
  const id = useId();
  const options = useMemo(() => troopTypeOptions(catalogue), [catalogue]);
  const label = useMemo(() => troopTypeLabel(catalogue), [catalogue]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Autocomplete<TroopTypeCode>
        id={`${id}-troop-type`}
        label={t('troopType')}
        options={options}
        optionLabel={label}
        empty={t('noTroopTypes')}
        value={troopType}
        onValueChange={(code) => code && onTroopType(code)}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>{t('unitName')}</Label>
        <Input
          id={`${id}-name`}
          value={name}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 min-w-0 font-medium sm:h-9"
          onChange={(event) => onName(event.target.value)}
        />
      </div>
    </div>
  );
}

function PendingUnitCard({
  name,
  catalogue,
  onName,
  onTroopType,
  onRemove,
}: {
  name: string;
  catalogue: FantasyCatalogue;
  onName: (name: string) => void;
  onTroopType: (troopType: TroopTypeCode) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('fantasyBuilder');
  return (
    <li>
      <Card size="sm">
        <CardContent className="flex flex-col gap-4">
          <UnitIdentity
            catalogue={catalogue}
            troopType={null}
            name={name}
            placeholder={t('unitNamePending')}
            onTroopType={onTroopType}
            onName={onName}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {t('pickTroopType')}
            </p>
            <Button
              variant="outline"
              size="touch"
              aria-label={t('discardUnit')}
              onClick={onRemove}
            >
              <IconTrash data-icon="inline-start" />
              {t('remove')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

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
  const { catalogue, names, format, onEdit, newId, tagWords } = context;
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
  const boughtEvents = eventCardsOf(unit);
  const transportCard = fantasyCardName(
    mobileInfantryCode,
    catalogue.cards.get(mobileInfantryCode),
  );
  const edit = (change: Parameters<SelectionEdit>[0]) => onEdit(change);

  return (
    <li id={unitAnchor(unit.id)} className={findingAnchorClass}>
      <Card size="sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <UnitIdentity
              catalogue={catalogue}
              troopType={unit.troopType}
              name={unit.name}
              placeholder={troopTypeName}
              onTroopType={(troopType) =>
                edit((selection) =>
                  withUnitTroopType(selection, unit.id, troopType),
                )
              }
              onName={(next) =>
                edit((selection) => withUnitName(selection, unit.id, next))
              }
            />
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
              {t('unitCost', {
                troopType: troopTypeName,
                stands: unit.stands,
                perStand: formatPoints(priced?.pointsPerStand ?? 0),
                points: formatPoints(priced?.points ?? 0),
              })}
              {general && <Badge variant="secondary">{t('general')}</Badge>}
            </p>
          </div>

          <TagField
            ownWords={tagWords}
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
            title={t('standsTitle', { count: unit.stands })}
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
            {(unit.cards.length > 0 ||
              boughtEvents.length > 0 ||
              unit.marks.delayedEntry > 0 ||
              unit.marks.transports > 0) && (
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
                {boughtEvents.map(([code, count]) => {
                  const card = catalogue.cards.get(code);
                  const cardName = fantasyCardName(code, card);
                  return (
                    <CountedCard
                      key={code}
                      code={code}
                      card={card}
                      cost={words.each(
                        card ? cardPoints(card, null, format, catalogue) : null,
                      )}
                      bearer={name}
                      count={count}
                      max={card ? cardCountMax(card) : count}
                      caption={t('cardsBought', { count })}
                      removeLabel={t('oneFewerCard', {
                        card: cardName,
                        unit: name,
                      })}
                      addLabel={t('oneMoreCard', {
                        card: cardName,
                        unit: name,
                      })}
                      onCount={(next) =>
                        edit((selection) =>
                          withUnitEventCard(selection, unit.id, code, next),
                        )
                      }
                    />
                  );
                })}
                {(['delayedEntry', 'transports'] as const)
                  .filter((mark) => unit.marks[mark] > 0)
                  .map((mark) => {
                    const code = markCards[mark];
                    const card = catalogue.cards.get(code);
                    return (
                      <CountedCard
                        key={mark}
                        code={code}
                        card={card}
                        cost={
                          mark === 'delayedEntry'
                            ? t('delayedEntryHint')
                            : t('transportsHint', { card: transportCard })
                        }
                        bearer={name}
                        count={unit.marks[mark]}
                        max={unit.stands}
                        caption={t('standsMarked', {
                          count: unit.marks[mark],
                          stands: unit.stands,
                        })}
                        removeLabel={t(
                          mark === 'delayedEntry'
                            ? 'oneFewerDelayed'
                            : 'oneFewerTransport',
                          { unit: name },
                        )}
                        addLabel={t(
                          mark === 'delayedEntry'
                            ? 'oneMoreDelayed'
                            : 'oneMoreTransport',
                          { unit: name },
                        )}
                        onCount={(next) =>
                          edit((selection) =>
                            withUnitMark(selection, unit.id, mark, next),
                          )
                        }
                      />
                    );
                  })}
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
                {
                  heading: t('eventCards'),
                  options: eventOffers
                    .filter(({ card }) => !unit.marks.eventCards[card.code])
                    .map(({ card, points }) => ({
                      value: card.code,
                      label: card.name,
                      detail: words.each(points),
                    })),
                },
                {
                  heading: t('markedStands'),
                  options: (['delayedEntry', 'transports'] as const)
                    .filter(
                      (mark) =>
                        unit.marks[mark] === 0 &&
                        (mark === 'delayedEntry' ? delayable : rides),
                    )
                    .map((mark) => ({
                      value: markCards[mark],
                      label: fantasyCardName(
                        markCards[mark],
                        catalogue.cards.get(markCards[mark]),
                      ),
                      detail:
                        mark === 'delayedEntry'
                          ? t('delayedEntryHint')
                          : t('transportsHint', { card: transportCard }),
                    })),
                },
              ]}
              onPick={(code) =>
                edit((selection) => {
                  if (code === delayedEntryCode) {
                    return withUnitMark(selection, unit.id, 'delayedEntry', 1);
                  }
                  if (code === mobileInfantryCode) {
                    return withUnitMark(selection, unit.id, 'transports', 1);
                  }
                  return catalogue.cards.get(code)?.category === 'event'
                    ? withUnitEventCard(selection, unit.id, code, 1)
                    : withUnitCard(selection, unit.id, code);
                })
              }
            />
          </div>

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

type PendingUnit = { id: string; name: string };

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
  const [pending, setPending] = useState<readonly PendingUnit[]>([]);
  const drop = (id: string) =>
    setPending((current) => current.filter((unit) => unit.id !== id));
  const addUnit = (
    <Button
      variant="outline"
      size="touch"
      className="self-start"
      onClick={() =>
        setPending((current) => [...current, { id: newId(), name: '' }])
      }
    >
      <IconPlus data-icon="inline-start" />
      {t('addUnit')}
    </Button>
  );

  return (
    <Section title={t('units')} description={t('unitsDescription')}>
      {units.length === 0 && pending.length === 0 ? (
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
            {pending.map((unit) => (
              <PendingUnitCard
                key={unit.id}
                name={unit.name}
                catalogue={catalogue}
                onName={(name) =>
                  setPending((current) =>
                    current.map((candidate) =>
                      candidate.id === unit.id
                        ? { ...candidate, name }
                        : candidate,
                    ),
                  )
                }
                onTroopType={(troopType) => {
                  onEdit((selection) =>
                    withUnitName(
                      withUnitAdded(selection, unit.id, troopType),
                      unit.id,
                      unit.name,
                    ),
                  );
                  drop(unit.id);
                }}
                onRemove={() => drop(unit.id)}
              />
            ))}
          </ul>
          {addUnit}
        </>
      )}
    </Section>
  );
}
