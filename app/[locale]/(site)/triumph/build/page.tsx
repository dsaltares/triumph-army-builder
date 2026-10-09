import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  type TriumphBuilderTarget,
  TriumphBuilderPage,
  triumphBuilderMetadata,
} from '@/components/builder/triumph-builder-page';
import { getAuth } from '@/lib/auth/auth';
import { findArmy } from '@/lib/db/armies';
import { getDatabase } from '@/lib/db/client';
import { decodeShareCode } from '@/lib/domain/army/share-codec';
import { triumph } from '@/lib/domain/games/triumph';
import { onlyParam, type SearchParamsProps } from '@/lib/navigation';

const savedListTarget = async (
  id: string,
): Promise<TriumphBuilderTarget | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const saved = await findArmy(getDatabase(), {
    id,
    userId: session.user.id,
  });
  return saved?.game === triumph.game
    ? { armyId: triumph.armyListId(saved.selection) }
    : null;
};

const draftTarget = (code: string): TriumphBuilderTarget | null => {
  const decoded = decodeShareCode(code);
  return decoded.ok && decoded.list.game === triumph.game
    ? {
        armyId: triumph.armyListId(decoded.list.selection),
        draft: decoded.list.selection,
      }
    : null;
};

const builderTarget = cache(
  async (list: string | null, code: string | null) => {
    if (list !== null) {
      return savedListTarget(list);
    }
    return code === null ? null : draftTarget(code);
  },
);

const targetOf = async ({ searchParams }: SearchParamsProps) => {
  const params = await searchParams;
  return builderTarget(onlyParam(params.list), onlyParam(params.s));
};

export const generateMetadata = async (
  props: SearchParamsProps,
): Promise<Metadata> =>
  triumphBuilderMetadata((await targetOf(props))?.armyId ?? null);

export default async function TriumphBuildPage(props: SearchParamsProps) {
  const target = await targetOf(props);
  if (!target) {
    notFound();
  }
  return <TriumphBuilderPage {...target} />;
}
