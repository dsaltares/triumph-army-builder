'use client';

import { IconFilter } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Autocomplete } from '@/components/autocomplete';
import { ChipGroup } from '@/components/chip-group';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { TroopTypeCode } from '@/lib/data/schema';
import { toggledValues } from '@/lib/domain/army-index';
import {
  activeCollectionFilterCount,
  type CollectionFilters,
  noCollectionFilters,
} from '@/lib/domain/collection/collection-index';
import {
  type CollectionStatus,
  collectionStatuses,
} from '@/lib/domain/collection/entry';

export function CollectionFiltersSheet({
  troopTypes,
  tags,
  filters,
  matches,
  onChange,
}: {
  troopTypes: readonly TroopTypeCode[];
  tags: readonly string[];
  filters: CollectionFilters;
  matches: number;
  onChange: (filters: CollectionFilters) => void;
}) {
  const t = useTranslations('collection');
  const tagsId = useId();
  const active = activeCollectionFilterCount(filters);
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" size="touch" className="shrink-0" />}
      >
        <IconFilter data-icon="inline-start" />
        {t('filters')}
        {active > 0 && <Badge className="ml-0.5">{active}</Badge>}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle>{t('filters')}</SheetTitle>
          <SheetDescription>{t('filtersDescription')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 pb-2">
          <ChipGroup<TroopTypeCode>
            label={t('troopType')}
            options={troopTypes}
            selected={filters.troopTypes}
            onToggle={(code) =>
              onChange({
                ...filters,
                troopTypes: toggledValues(filters.troopTypes, code),
              })
            }
          />
          <ChipGroup<CollectionStatus>
            label={t('status')}
            options={collectionStatuses}
            selected={filters.statuses}
            labelFor={(status) => t(status)}
            onToggle={(status) =>
              onChange({
                ...filters,
                statuses: toggledValues(filters.statuses, status),
              })
            }
          />
          {tags.length > 0 && (
            <Autocomplete
              multiple
              id={tagsId}
              label={t('tags')}
              options={tags}
              empty={t('tagFilterEmpty')}
              value={filters.tags}
              removeLabel={(tag) => t('removeTag', { tag })}
              onValueChange={(chosen) => onChange({ ...filters, tags: chosen })}
            />
          )}
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            disabled={active === 0}
            onClick={() =>
              onChange({ ...noCollectionFilters, search: filters.search })
            }
          >
            {t('clearFilters')}
          </Button>
          <SheetClose render={<Button size="touch" className="flex-1" />}>
            {t('showEntries', { count: matches })}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
