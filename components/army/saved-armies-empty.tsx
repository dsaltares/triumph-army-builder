'use client';

import { IconCategory, IconListSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { NewListDialog } from '@/components/army/new-list-dialog';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { triumphRules } from '@/lib/domain/army/validation';
import { routes } from '@/lib/navigation';

export function SavedArmiesEmpty({
  signedIn,
  armyCount,
}: {
  signedIn: boolean;
  armyCount: number;
}) {
  const t = useTranslations('armies');
  const nav = useTranslations('nav');
  const auth = useTranslations('auth');
  return (
    <EmptyState
      title={t('noListsSaved')}
      actions={
        <>
          <NewListDialog label={t('startFirstList')} />
          <Link
            href={routes.armies}
            className={buttonVariants({ variant: 'outline', size: 'touch' })}
          >
            <IconListSearch data-icon="inline-start" />
            {t('browseArmies')}
          </Link>
          <Link
            href={routes.categories}
            className={buttonVariants({ variant: 'outline', size: 'touch' })}
          >
            <IconCategory data-icon="inline-start" />
            {nav('categories')}
          </Link>
          {!signedIn && (
            <Link
              href={routes.signIn}
              className={buttonVariants({ variant: 'ghost', size: 'touch' })}
            >
              {auth('signIn')}
            </Link>
          )}
        </>
      }
    >
      <EmptyStateText>
        {t('emptyIntro', {
          cap: triumphRules.pointsCap,
          count: armyCount,
        })}
      </EmptyStateText>
      <EmptyStateText>{t('emptyBrowse')}</EmptyStateText>
      {!signedIn && <EmptyStateText>{t('emptyAnonymous')}</EmptyStateText>}
    </EmptyState>
  );
}
