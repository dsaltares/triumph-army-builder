import { useLocale, useTranslations } from 'next-intl';
import { Fact } from '@/components/fact';
import { Card, CardContent } from '@/components/ui/card';
import type { ArmyDetail } from '@/lib/data/bundle';
import type { ArmyList } from '@/lib/domain/army/army-list';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import {
  formatRatings,
  formatTopographies,
  formatYearSpan,
  joinWithOr,
} from '@/lib/format';

type ArmySummaryProps = {
  detail: ArmyDetail;
  armyList: ArmyList;
  troopTypeNames: TroopTypeNames;
};

export function ArmySummary({
  detail,
  armyList,
  troopTypeNames,
}: ArmySummaryProps) {
  const locale = useLocale();
  const t = useTranslations('armies');
  const { subFactions } = armyList;
  return (
    <Card>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label={t('years')}>
            {formatYearSpan(armyList.dateRange, locale)}
          </Fact>
          <Fact label={t('invasionRating')}>
            {formatRatings(detail.invasionRatings)}
          </Fact>
          <Fact label={t('manoeuvreRating')}>
            {formatRatings(detail.maneuverRatings)}
          </Fact>
          <Fact label={t('homeTopography')}>
            {formatTopographies(detail.homeTopographies)}
          </Fact>
          <Fact label={t('general')}>
            {joinWithOr(
              armyList.generalTroopTypes.map(
                (troopType) => troopTypeNames[troopType],
              ),
              locale,
            )}
          </Fact>
          {subFactions && (
            <Fact label={subFactions.label}>
              {joinWithOr(
                subFactions.variants.map(({ name }) => name),
                locale,
              )}
              <span className="block text-xs text-muted-foreground">
                {t('subFactionHint')}
              </span>
            </Fact>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
