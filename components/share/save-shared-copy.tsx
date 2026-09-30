'use client';

import { IconDeviceFloppy } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ArmyNameDialog } from '@/components/army/army-name-dialog';
import { useCreateArmy } from '@/components/army/use-saved-armies';
import { Button } from '@/components/ui/button';
import type { ArmySelection } from '@/lib/domain/army/selection';
import { savedListUrl } from '@/lib/navigation';

export function SaveSharedCopy({
  name,
  selection,
}: {
  name: string;
  selection: ArmySelection;
}) {
  const t = useTranslations('share');
  const create = useCreateArmy();
  const router = useRouter();
  const [naming, setNaming] = useState(false);

  return (
    <>
      <Button size="touch" className="shrink-0" onClick={() => setNaming(true)}>
        <IconDeviceFloppy data-icon="inline-start" />
        {t('saveACopy')}
      </Button>
      <ArmyNameDialog
        open={naming}
        title={t('saveACopy')}
        description={t('saveCopyDescription')}
        submit={t('saveCopy')}
        working={t('saving')}
        name={name}
        onOpenChange={setNaming}
        onSubmit={async (chosen) => {
          const created = await create.mutateAsync({
            name: chosen,
            selection,
          });
          router.push(savedListUrl(created.armyListId, created.id));
        }}
      />
    </>
  );
}
