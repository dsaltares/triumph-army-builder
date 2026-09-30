'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  type StartableArmy,
  useStartList,
} from '@/components/army/use-start-list';
import { Button } from '@/components/ui/button';

export function NewListButton({ army }: { army: StartableArmy }) {
  const t = useTranslations('pages');
  const { start, starting } = useStartList();

  return (
    <Button
      size="touch"
      className="shrink-0"
      disabled={starting}
      onClick={() => start(army)}
    >
      <IconPlus data-icon="inline-start" />
      {starting ? t('newListPending') : t('newList')}
    </Button>
  );
}
