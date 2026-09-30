import { useLocale, useTranslations } from 'next-intl';
import {
  TroopOptionList,
  type TroopTypeDetails,
} from '@/components/army/troop-option-list';
import { Badge } from '@/components/ui/badge';
import type { ContingentGroup } from '@/lib/domain/army/army-list';
import type { BattleCardNames } from '@/lib/domain/battle-cards/listing';
import { formatYearSpan } from '@/lib/format';

type ContingentGroupListProps = TroopTypeDetails & {
  groups: readonly ContingentGroup[];
  empty: string;
  battleCardNames: BattleCardNames;
};

const contingentKindLabels = {
  optional: 'optional contingent',
  allied: 'allied contingent',
} as const;

export function ContingentGroupList({
  groups,
  empty,
  battleCardNames,
  ...troopTypes
}: ContingentGroupListProps) {
  const locale = useLocale();
  const t = useTranslations('armies');
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-6">
      {groups.map((group) => (
        <li key={group.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-semibold">{group.name}</h3>
            {group.dateRange && (
              <Badge variant="outline">
                {formatYearSpan(group.dateRange, locale)}
              </Badge>
            )}
            {group.note && <Badge variant="outline">{group.note}</Badge>}
          </div>
          {group.contingents.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {t('pairedContingents')}
            </p>
          )}
          {group.contingents.map((contingent) => (
            <div key={contingent.id} className="flex flex-col gap-2">
              {group.contingents.length > 1 && (
                <h4 className="text-xs font-medium">
                  {contingent.name}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {contingentKindLabels[contingent.kind]}
                  </span>
                </h4>
              )}
              <TroopOptionList
                troopOptions={contingent.troopOptions}
                battleCardNames={battleCardNames}
                {...troopTypes}
              />
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}
