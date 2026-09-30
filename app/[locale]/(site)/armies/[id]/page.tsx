import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArmyDetailView } from '@/components/army/army-detail';
import { NewListButton } from '@/components/army/new-list-button';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { servedReference } from '@/lib/data/served-bundle';
import { battleCardNames } from '@/lib/domain/battle-cards/listing';
import { relatedArmies } from '@/lib/domain/related-armies';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeNames,
  troopTypeProfiles,
} from '@/lib/domain/troop-types';
import { formatYearSpan } from '@/lib/format';
import { type IdRouteProps, routes } from '@/lib/navigation';

export const generateMetadata = async ({
  params,
}: IdRouteProps): Promise<Metadata> => {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  const detail = await reference?.bundle.readArmyDetail((await params).id);
  if (!detail) {
    return {};
  }
  const t = await getTranslations('pages');
  return {
    title: detail.name,
    description: t('armyDescription', {
      name: detail.name,
      span: formatYearSpan(detail, locale),
    }),
  };
};

export default async function ArmyPage({ params }: IdRouteProps) {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const { bundle } = reference;
  const t = await getTranslations('pages');
  const [detail, troopTypes, battleCards, index] = await Promise.all([
    bundle.readArmyDetail((await params).id),
    bundle.readTroopTypes(),
    bundle.readBattleCards(),
    bundle.readArmyIndex(),
  ]);
  if (!detail) {
    notFound();
  }
  return (
    <>
      <PageHeader
        back={{ href: routes.armies, label: t('allArmies') }}
        title={detail.name}
        description={t('meshweshList', {
          key: detail.key,
          span: formatYearSpan(detail, locale),
        })}
        action={<NewListButton army={detail} />}
      />
      <ArmyDetailView
        detail={detail}
        related={relatedArmies(index.armies, detail, locale)}
        troopTypeNames={troopTypeNames(troopTypes)}
        troopTypeCosts={troopTypeCosts(troopTypes)}
        troopTypeFactors={troopTypeFactors(troopTypes)}
        troopTypeProfiles={troopTypeProfiles(troopTypes)}
        battleCardNames={battleCardNames(battleCards)}
      />
    </>
  );
}
