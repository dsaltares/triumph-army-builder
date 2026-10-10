'use client';

import { useTranslations } from 'next-intl';
import { ListNameField } from '@/components/builder/list-title';
import { useFantasySnapshot } from '@/components/fantasy/fantasy-builder-state';
import { pageHeading } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

export function FantasyListTitle() {
  const t = useTranslations('fantasyBuilder');
  const snapshot = useFantasySnapshot();

  return (
    <h1 className={cn(pageHeading, 'flex-1')}>
      {snapshot ? (
        <ListNameField listName={snapshot.listName} rename={snapshot.rename} />
      ) : (
        t('buildList')
      )}
    </h1>
  );
}
