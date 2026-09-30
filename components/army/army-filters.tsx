'use client';

import { IconFilter } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { ChipGroup } from '@/components/chip-group';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { MeshweshThematicCategory, Topography } from '@/lib/data/schema';
import { topographies } from '@/lib/data/schema';
import {
  type ArmyFilters,
  activeArmyFilterCount,
  noArmyFilters,
  type Rating,
  ratingValues,
  toggledValues,
} from '@/lib/domain/army-index';

type ArmyFiltersProps = {
  filters: ArmyFilters;
  categories: readonly MeshweshThematicCategory[];
  matches: number;
  onChange: (filters: ArmyFilters) => void;
};

const parseYear = (value: string) => {
  const year = Number(value);
  return value.trim() === '' || Number.isNaN(year) ? null : Math.trunc(year);
};

export function ArmyFiltersSheet({
  filters,
  categories,
  matches,
  onChange,
}: ArmyFiltersProps) {
  const t = useTranslations('armies');
  const fromId = useId();
  const toId = useId();
  const categoryId = useId();
  const active = activeArmyFilterCount(filters);

  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" size="touch" className="shrink-0" />}
      >
        <IconFilter data-icon="inline-start" />
        Filters
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
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">{t('dateRange')}</p>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={fromId} className="text-muted-foreground">
                  From
                </Label>
                <Input
                  id={fromId}
                  type="number"
                  inputMode="numeric"
                  className="h-11"
                  placeholder="-3000"
                  value={filters.from ?? ''}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      from: parseYear(event.target.value),
                    })
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={toId} className="text-muted-foreground">
                  To
                </Label>
                <Input
                  id={toId}
                  type="number"
                  inputMode="numeric"
                  className="h-11"
                  placeholder="1880"
                  value={filters.to ?? ''}
                  onChange={(event) =>
                    onChange({ ...filters, to: parseYear(event.target.value) })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('negativeYearsAreBc')}
            </p>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium">{t('thematicCategory')}</p>
              <ul className="max-h-56 overflow-y-auto rounded-md border border-border">
                {categories.map((category) => {
                  const inputId = `${categoryId}-${category.id}`;
                  return (
                    <li key={category.id}>
                      <Label
                        htmlFor={inputId}
                        className="min-h-11 px-3 text-xs font-normal"
                      >
                        <Checkbox
                          id={inputId}
                          checked={filters.categories.includes(category.id)}
                          onCheckedChange={() =>
                            onChange({
                              ...filters,
                              categories: toggledValues(
                                filters.categories,
                                category.id,
                              ),
                            })
                          }
                        />
                        {category.name}
                      </Label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <ChipGroup<Topography>
            label={t('homeTopography')}
            options={topographies}
            selected={filters.topographies}
            onToggle={(topography) =>
              onChange({
                ...filters,
                topographies: toggledValues(filters.topographies, topography),
              })
            }
          />

          <ChipGroup<Rating>
            label={t('invasionRating')}
            options={ratingValues}
            selected={filters.invasion}
            onToggle={(value) =>
              onChange({
                ...filters,
                invasion: toggledValues(filters.invasion, value),
              })
            }
          />

          <ChipGroup<Rating>
            label={t('manoeuvreRating')}
            options={ratingValues}
            selected={filters.maneuver}
            onToggle={(value) =>
              onChange({
                ...filters,
                maneuver: toggledValues(filters.maneuver, value),
              })
            }
          />
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            disabled={active === 0}
            onClick={() =>
              onChange({ ...noArmyFilters, search: filters.search })
            }
          >
            {t('clearFilters')}
          </Button>
          <SheetClose render={<Button size="touch" className="flex-1" />}>
            {t('showArmies', { count: matches })}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
