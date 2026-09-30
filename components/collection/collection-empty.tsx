'use client';

import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { routes } from '@/lib/navigation';

function SignInActions() {
  const t = useTranslations('collection');
  const auth = useTranslations('auth');
  return (
    <>
      <Link href={routes.signIn} className={buttonVariants({ size: 'touch' })}>
        {auth('signIn')}
      </Link>
      <Link
        href={routes.signUp}
        className={buttonVariants({ variant: 'outline', size: 'touch' })}
      >
        {t('createAccount')}
      </Link>
    </>
  );
}

function StartACollection({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations('collection');
  return (
    <>
      <Button size="touch" onClick={onAdd}>
        <IconPlus data-icon="inline-start" />
        {t('addStands')}
      </Button>
      <SeeYourLists />
    </>
  );
}

function SeeYourLists() {
  const t = useTranslations('collection');
  return (
    <Link
      href={routes.myArmies}
      className={buttonVariants({ variant: 'outline', size: 'touch' })}
    >
      {t('seeYourLists')}
    </Link>
  );
}

export function CollectionEmpty({ onAdd }: { onAdd?: () => void }) {
  const t = useTranslations('collection');
  return (
    <EmptyState
      title={onAdd ? t('emptyTitle') : t('signInTitle')}
      actions={onAdd ? <StartACollection onAdd={onAdd} /> : <SignInActions />}
    >
      <EmptyStateText>{t('whatItDoes')}</EmptyStateText>
      {!onAdd && <EmptyStateText>{t('keptWithAnAccount')}</EmptyStateText>}
    </EmptyState>
  );
}
