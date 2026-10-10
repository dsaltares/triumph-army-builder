'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { findingAnchorClass } from '@/components/builder/finding-anchor';
import { Stepper } from '@/components/builder/stepper';
import { ChipGroup } from '@/components/chip-group';
import { formatAnchor } from '@/components/fantasy/fantasy-anchors';
import { usePointsWords } from '@/components/fantasy/points-words';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { Section } from '@/components/layout/section';
import { Notice } from '@/components/notice';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useErrorMessage } from '@/components/use-error-message';
import { fantasyTopographies } from '@/lib/data/schema';
import type { FantasyFormat } from '@/lib/domain/fantasy/battle-cards';
import {
  type FantasyRating,
  fantasyRatings,
  ratingPoints,
  withFormat,
} from '@/lib/domain/fantasy/builder';
import type { FantasyListFormat } from '@/lib/domain/fantasy/selection-schema';
import { formatPoints } from '@/lib/format';

const ratingOf = (rating: number): FantasyRating =>
  fantasyRatings.find((candidate) => candidate === rating) ?? 0;

const highestRating = fantasyRatings[fantasyRatings.length - 1] ?? 0;

function PointsTotalField({
  pointsTotal,
  onChange,
}: {
  pointsTotal: number;
  onChange: (pointsTotal: number) => void;
}) {
  const t = useTranslations('fantasyBuilder');
  const describe = useErrorMessage();
  const id = useId();
  const [typed, setTyped] = useState(String(pointsTotal));

  useEffect(() => {
    setTyped((current) =>
      Number(current) === pointsTotal ? current : String(pointsTotal),
    );
  }, [pointsTotal]);

  const valid = Number(typed) > 0 && Number.isFinite(Number(typed));

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{t('pointsTotal')}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={1}
        step={1}
        value={typed}
        aria-invalid={!valid}
        aria-describedby={valid ? undefined : `${id}-message`}
        className="h-11 w-28 tabular-nums sm:h-9"
        onChange={(event) => {
          setTyped(event.target.value);
          const next = Number(event.target.value);
          if (event.target.value !== '' && next > 0) {
            onChange(next);
          }
        }}
        onBlur={() => setTyped(String(pointsTotal))}
      />
      {!valid && (
        <Notice id={`${id}-message`}>{describe('pointsTotalPositive')}</Notice>
      )}
    </div>
  );
}

function RatingStepper({
  kind,
  rating,
  packFormat,
  onChange,
}: {
  kind: 'invasion' | 'maneuver';
  rating: number;
  packFormat: FantasyFormat;
  onChange: (rating: FantasyRating) => void;
}) {
  const t = useTranslations('fantasyBuilder');
  const words = usePointsWords();
  const label = t(kind === 'invasion' ? 'invasion' : 'maneuver');
  const current = ratingOf(rating);
  return (
    <div className="flex items-center gap-3">
      <Stepper
        count={current}
        countLabel={label}
        removeLabel={t('lowerRating', { rating: label })}
        addLabel={t('raiseRating', { rating: label })}
        canRemove={current > 0}
        canAdd={current < highestRating}
        onChange={(next) => onChange(ratingOf(next))}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {words.rating(ratingPoints(packFormat, kind, current))}
        </p>
      </div>
    </div>
  );
}

export function FormatSection({
  format,
  packFormat,
  denseCards,
  onEdit,
}: {
  format: FantasyListFormat;
  packFormat: FantasyFormat;
  denseCards: readonly string[];
  onEdit: SelectionEdit;
}) {
  const t = useTranslations('fantasyBuilder');
  const change = (next: Partial<FantasyListFormat>) =>
    onEdit((selection) => withFormat(selection, next));
  const dense = packFormat.denseTopographies.includes(format.topography);
  const cards = denseCards.join(', ');

  return (
    <Section
      id={formatAnchor}
      className={findingAnchorClass}
      title={t('format')}
      description={t('formatDescription', {
        stands: formatPoints(packFormat.pointsPerRequiredStand),
      })}
    >
      <Card size="sm">
        <CardContent className="flex flex-col gap-4">
          <PointsTotalField
            pointsTotal={format.pointsTotal}
            onChange={(pointsTotal) => change({ pointsTotal })}
          />
          <ChipGroup
            label={t('homeTopography')}
            options={fantasyTopographies}
            selected={[format.topography]}
            onToggle={(topography) => change({ topography })}
          />
          {cards !== '' && (
            <p className="text-xs text-pretty text-muted-foreground">
              {dense
                ? t('denseTopography', { topography: format.topography, cards })
                : t('openTopography', { cards })}
            </p>
          )}
          <RatingStepper
            kind="invasion"
            rating={format.invasion}
            packFormat={packFormat}
            onChange={(invasion) => change({ invasion })}
          />
          <RatingStepper
            kind="maneuver"
            rating={format.maneuver}
            packFormat={packFormat}
            onChange={(maneuver) => change({ maneuver })}
          />
        </CardContent>
      </Card>
    </Section>
  );
}
