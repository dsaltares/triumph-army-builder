import { useTranslations } from 'next-intl';
import { ArmySummary } from '@/components/army/army-summary';
import { BattleCardList } from '@/components/army/battle-card-list';
import { ContingentGroupList } from '@/components/army/contingent-group-list';
import { RelatedArmyList } from '@/components/army/related-army-list';
import {
  TroopOptionList,
  type TroopTypeDetails,
} from '@/components/army/troop-option-list';
import { Section } from '@/components/layout/section';
import type { ArmyDetail } from '@/lib/data/bundle';
import {
  allyTroopOptionGroups,
  buildArmyList,
  optionalContingentGroups,
} from '@/lib/domain/army/army-list';
import type { BattleCardNames } from '@/lib/domain/battle-cards/listing';
import { listNumber, type RelatedArmies } from '@/lib/domain/related-armies';

type ArmyDetailViewProps = TroopTypeDetails & {
  detail: ArmyDetail;
  related: RelatedArmies;
  battleCardNames: BattleCardNames;
};

export function ArmyDetailView({
  detail,
  related,
  battleCardNames,
  ...troopTypes
}: ArmyDetailViewProps) {
  const t = useTranslations('armies');
  const armyList = buildArmyList(detail);
  return (
    <>
      <ArmySummary
        detail={detail}
        armyList={armyList}
        troopTypeNames={troopTypes.troopTypeNames}
      />

      <Section
        title={t('requiredTroops')}
        description={t('requiredTroopsDescription')}
      >
        <TroopOptionList
          troopOptions={armyList.main.troopOptions}
          battleCardNames={battleCardNames}
          {...troopTypes}
        />
      </Section>

      <Section
        title={t('optionalContingents')}
        description={t('optionalContingentsDescription')}
      >
        <ContingentGroupList
          groups={optionalContingentGroups(armyList)}
          empty={t('noOptionalContingents')}
          battleCardNames={battleCardNames}
          {...troopTypes}
        />
      </Section>

      <Section
        title={t('allyTroopOptions')}
        description={t('allyTroopOptionsDescription')}
      >
        <ContingentGroupList
          groups={allyTroopOptionGroups(armyList)}
          empty={t('noAllyTroopOptions')}
          battleCardNames={battleCardNames}
          {...troopTypes}
        />
      </Section>

      <Section
        title={t('battleCards')}
        description={t('armyBattleCardsListDescription')}
      >
        <div className="text-sm">
          <BattleCardList
            allowances={armyList.battleCards}
            battleCardNames={battleCardNames}
            empty={t('noArmyBattleCards')}
            className="sm:grid sm:grid-cols-2 sm:gap-x-6"
          />
        </div>
      </Section>

      <Section title={t('enemies')} description={t('enemiesDescription')}>
        {related.facesItself && (
          <p className="text-xs text-muted-foreground">{t('facesItself')}</p>
        )}
        <RelatedArmyList armies={related.enemies} empty={t('noEnemies')} />
      </Section>

      <Section
        title={t('relatedLists')}
        description={t('relatedListsDescription', {
          number: listNumber(detail.key),
        })}
      >
        <RelatedArmyList
          armies={related.sublists}
          empty={t('noRelatedLists')}
        />
      </Section>
    </>
  );
}
