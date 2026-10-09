import type { Metadata } from 'next';
import {
  TriumphBuilderPage,
  triumphBuilderMetadata,
} from '@/components/builder/triumph-builder-page';
import type { IdRouteProps } from '@/lib/navigation';

export const generateMetadata = async ({
  params,
}: IdRouteProps): Promise<Metadata> =>
  triumphBuilderMetadata((await params).id);

export default async function BuildArmyPage({ params }: IdRouteProps) {
  return <TriumphBuilderPage armyId={(await params).id} />;
}
