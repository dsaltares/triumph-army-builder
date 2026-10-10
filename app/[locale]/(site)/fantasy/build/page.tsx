import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import {
  type FantasyBuilderTarget,
  FantasyBuilderPage,
} from '@/components/fantasy/fantasy-builder-page';
import { getAuth } from '@/lib/auth/auth';
import { findArmy } from '@/lib/db/armies';
import { getDatabase } from '@/lib/db/client';
import { decodeShareCode } from '@/lib/domain/army/share-codec';
import { fantasy } from '@/lib/domain/games/fantasy';
import { onlyParam, type SearchParamsProps } from '@/lib/navigation';

const savedListTarget = async (
  id: string,
): Promise<FantasyBuilderTarget | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const saved = await findArmy(getDatabase(), {
    id,
    userId: session.user.id,
  });
  return saved?.game === fantasy.game ? {} : null;
};

const draftTarget = (code: string): FantasyBuilderTarget | null => {
  const decoded = decodeShareCode(code);
  return decoded.ok && decoded.list.game === fantasy.game
    ? { draft: decoded.list.selection }
    : null;
};

const builderTarget = cache(
  async (
    list: string | null,
    code: string | null,
  ): Promise<FantasyBuilderTarget | null> => {
    if (list !== null) {
      return savedListTarget(list);
    }
    return code === null ? {} : draftTarget(code);
  },
);

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('pages');
  return {
    title: t('fantasyBuildTitle'),
    description: t('fantasyBuildDescription'),
  };
};

export default async function FantasyBuildPage({
  searchParams,
}: SearchParamsProps) {
  const params = await searchParams;
  const target = await builderTarget(
    onlyParam(params.list),
    onlyParam(params.s),
  );
  if (!target) {
    notFound();
  }
  return <FantasyBuilderPage {...target} />;
}
