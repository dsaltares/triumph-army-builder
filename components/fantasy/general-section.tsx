'use client';

import { useTranslations } from 'next-intl';
import { findingAnchorClass } from '@/components/builder/finding-anchor';
import { generalAnchor } from '@/components/fantasy/fantasy-anchors';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { Section } from '@/components/layout/section';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { withGeneral } from '@/lib/domain/fantasy/builder';
import { unitName } from '@/lib/domain/fantasy/naming';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import type { TroopTypeNames } from '@/lib/domain/troop-types';

export function GeneralSection({
  selection,
  names,
  onEdit,
}: {
  selection: FantasySelection;
  names: TroopTypeNames;
  onEdit: SelectionEdit;
}) {
  const t = useTranslations('fantasyBuilder');
  return (
    <Section
      id={generalAnchor}
      className={findingAnchorClass}
      title={t('general')}
      description={t('generalDescription')}
    >
      <Card size="sm">
        <CardContent>
          {selection.units.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noGeneral')}</p>
          ) : (
            <RadioGroup
              aria-label={t('general')}
              className="flex flex-col gap-0"
              value={selection.general ?? ''}
              onValueChange={(id) =>
                onEdit((current) => withGeneral(current, String(id)))
              }
            >
              {selection.units.map((unit) => (
                <Label key={unit.id} className="h-11 text-sm font-normal">
                  <RadioGroupItem value={unit.id} />
                  {unitName(unit, names)}
                </Label>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>
    </Section>
  );
}
