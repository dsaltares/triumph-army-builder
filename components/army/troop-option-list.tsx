import { useLocale, useTranslations } from 'next-intl';
import { BattleCardList } from '@/components/army/battle-card-list';
import { BadgeRow } from '@/components/badge-row';
import {
  StackedTable,
  StackedTableField,
  StackedTableRow,
} from '@/components/stacked-table';
import { TroopFactors } from '@/components/troop-factors';
import type { TroopOption } from '@/lib/domain/army/army-list';
import type { BattleCardNames } from '@/lib/domain/battle-cards/listing';
import type { BattleLine } from '@/lib/domain/troop-options';
import type {
  TroopTypeCosts,
  TroopTypeFactors,
  TroopTypeNames,
  TroopTypeProfiles,
} from '@/lib/domain/troop-types';
import { alternativeParts, formatRange, formatYearSpans } from '@/lib/format';

export type TroopTypeDetails = {
  troopTypeNames: TroopTypeNames;
  troopTypeCosts: TroopTypeCosts;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
};

type TroopOptionListProps = TroopTypeDetails & {
  troopOptions: readonly TroopOption[];
  battleCardNames: BattleCardNames;
};

const columns =
  'grid gap-x-4 gap-y-1 px-3 py-3 sm:grid-cols-[4.5rem_minmax(8rem,1.1fr)_5rem_minmax(9rem,1.7fr)_minmax(8rem,1.1fr)]';

const headingKeys = [
  'stands',
  'troopType',
  'battleLine',
  'description',
  'battleCardsColumn',
] as const;

type ArmiesWords = ReturnType<typeof useTranslations<'armies'>>;

type ArmiesKey = Parameters<ArmiesWords>[0];

const battleLineText = (line: BattleLine, t: ArmiesWords) => {
  const key = battleLineKeys[line];
  return key ? t(key) : '—';
};

const battleLineKeys: Readonly<Record<BattleLine, ArmiesKey | null>> = {
  all: 'battleLineAllShort',
  half: 'battleLineHalfShort',
  none: null,
};

function TroopTypeNamesWithFactors({
  troopOption,
  troopTypeNames,
  troopTypeCosts,
  troopTypeFactors,
  troopTypeProfiles,
}: TroopTypeDetails & { troopOption: TroopOption }) {
  const locale = useLocale();
  const { troopEntries } = troopOption;
  return (
    <span className="font-medium">
      {alternativeParts(troopEntries.length, locale).map((part) => {
        if (part.kind === 'separator') {
          return part.text;
        }
        const { troopType } = troopEntries[part.index] ?? {};
        if (!troopType) {
          return null;
        }
        const name = troopTypeNames[troopType];
        return (
          <span
            key={troopType}
            className="inline-flex items-center gap-1 whitespace-nowrap"
          >
            {name}
            <TroopFactors
              name={name}
              factors={troopTypeFactors[troopType]}
              profile={troopTypeProfiles[troopType]}
              pointsPerStand={troopTypeCosts[troopType]}
            />
          </span>
        );
      })}
    </span>
  );
}

export function TroopOptionList({
  troopOptions,
  battleCardNames,
  ...troopTypes
}: TroopOptionListProps) {
  const locale = useLocale();
  const t = useTranslations('armies');
  if (troopOptions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('noTroopOptions')}</p>
    );
  }
  return (
    <StackedTable columns={columns} headings={headingKeys.map((key) => t(key))}>
      {troopOptions.map((troopOption) => (
        <StackedTableRow key={troopOption.id}>
          <dl className={columns}>
            <StackedTableField label={t('stands')}>
              <span className="font-medium tabular-nums">
                {formatRange(troopOption.min, troopOption.max)}
              </span>
            </StackedTableField>
            <StackedTableField label={t('troopType')}>
              <TroopTypeNamesWithFactors
                troopOption={troopOption}
                {...troopTypes}
              />
              {troopOption.mix === 'singleType' && (
                <span className="block text-xs text-muted-foreground">
                  {t('singleType')}
                </span>
              )}
            </StackedTableField>
            <StackedTableField label={t('battleLine')}>
              {battleLineText(troopOption.battleLine, t)}
            </StackedTableField>
            <StackedTableField label={t('description')}>
              {troopOption.description && (
                <span className="text-pretty">{troopOption.description}</span>
              )}
              <BadgeRow
                className="mt-1"
                labels={[
                  troopOption.dateRanges.length > 0 &&
                    formatYearSpans(troopOption.dateRanges, locale),
                  troopOption.note,
                ]}
              />
            </StackedTableField>
            <StackedTableField label={t('battleCardsColumn')}>
              <BattleCardList
                allowances={troopOption.battleCards}
                battleCardNames={battleCardNames}
                empty="—"
              />
            </StackedTableField>
          </dl>
        </StackedTableRow>
      ))}
    </StackedTable>
  );
}
