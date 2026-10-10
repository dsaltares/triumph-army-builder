'use client';

import { IconCrown, IconCrownFilled } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { findingAnchorClass } from '@/components/builder/finding-anchor';
import { generalAnchor } from '@/components/fantasy/fantasy-anchors';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { Section } from '@/components/layout/section';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { withGeneral } from '@/lib/domain/fantasy/builder';
import { unitName } from '@/lib/domain/fantasy/naming';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import type { TroopTypeNames } from '@/lib/domain/troop-types';

type GeneralProps = {
  selection: FantasySelection;
  names: TroopTypeNames;
  onEdit: SelectionEdit;
};

function GeneralChoices({
  selection,
  names,
  onEdit,
  onChosen,
}: GeneralProps & { onChosen?: () => void }) {
  const t = useTranslations('fantasyBuilder');
  if (selection.units.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noGeneral')}</p>;
  }
  return (
    <RadioGroup
      aria-label={t('general')}
      className="flex flex-col gap-0"
      value={selection.general ?? ''}
      onValueChange={(id) => {
        onEdit((current) => withGeneral(current, String(id)));
        onChosen?.();
      }}
    >
      {selection.units.map((unit) => (
        <Label key={unit.id} className="h-11 text-sm font-normal">
          <RadioGroupItem value={unit.id} />
          {unitName(unit, names)}
        </Label>
      ))}
    </RadioGroup>
  );
}

export function GeneralSection(props: GeneralProps) {
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
          <GeneralChoices {...props} />
        </CardContent>
      </Card>
    </Section>
  );
}

export function GeneralChip(props: GeneralProps) {
  const t = useTranslations('fantasyBuilder');
  const [open, setOpen] = useState(false);
  const { selection, names } = props;
  const general = selection.units.find(({ id }) => id === selection.general);
  const leader = general ? unitName(general, names) : null;
  const Crown = leader ? IconCrownFilled : IconCrown;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Badge
        variant={leader ? 'secondary' : 'outline'}
        render={
          <PopoverTrigger
            aria-label={
              leader ? t('showGeneral', { unit: leader }) : t('showNoGeneral')
            }
          />
        }
      >
        <Crown />
        {leader ?? t('noGeneralChosen')}
      </Badge>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] gap-3"
      >
        <div className="flex flex-col gap-1">
          <PopoverTitle>{t('general')}</PopoverTitle>
          <p className="text-xs text-pretty text-muted-foreground">
            {t('generalDescription')}
          </p>
        </div>
        <GeneralChoices {...props} onChosen={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
