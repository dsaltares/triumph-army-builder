'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceFloppy,
  IconLoader,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useCreateArmy } from '@/components/army/use-saved-armies';
import type { BuilderSnapshot } from '@/components/builder/builder-state';
import type {
  AutosaveStatus as Status,
  useAutosave,
} from '@/components/builder/use-autosave';
import { useSavedListId } from '@/components/builder/use-saved-list';
import { HeaderActionLabel, iconOnlyBelowMd } from '@/components/header-action';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/components/use-error-message';
import { cn } from '@/lib/utils';

export function SaveDraftAction({
  listName,
  selection,
}: Pick<BuilderSnapshot, 'listName' | 'selection'>) {
  const t = useTranslations('builder');
  const create = useCreateArmy();
  const describe = useErrorMessage();
  const [, setListId] = useSavedListId();
  const name = listName.trim();

  const save = async () => {
    try {
      const created = await create.mutateAsync({ name, selection });
      await setListId(created.id);
    } catch (thrown: unknown) {
      toast.error(describe(thrown));
    }
  };

  return (
    <Button
      size="touch"
      className={cn('shrink-0', iconOnlyBelowMd)}
      disabled={!name || create.isPending}
      onClick={save}
    >
      <IconDeviceFloppy data-icon="inline-start" />
      <HeaderActionLabel>
        {create.isPending ? t('saving') : t('save')}
      </HeaderActionLabel>
    </Button>
  );
}

const savedTickMs = 2500;

const useSavedTick = (status: Status) => {
  const [showing, setShowing] = useState(false);
  const previous = useRef(status);

  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (was !== 'saving' || status !== 'saved') {
      setShowing(false);
      return;
    }
    setShowing(true);
    const timer = setTimeout(() => setShowing(false), savedTickMs);
    return () => clearTimeout(timer);
  }, [status]);

  return showing;
};

export function AutosaveStatus({
  status,
  retry,
}: ReturnType<typeof useAutosave>) {
  const t = useTranslations('builder');
  const tickShowing = useSavedTick(status);

  if (status === 'failed') {
    return (
      <Button
        size="touch"
        variant="destructive"
        className="shrink-0"
        onClick={retry}
      >
        <IconAlertTriangle data-icon="inline-start" />
        {t('notSaved')}
      </Button>
    );
  }

  return (
    <p
      role="status"
      aria-label={t('saveStatus')}
      className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
    >
      {status === 'saving' ? (
        <IconLoader className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <IconCheck
          className={cn(
            'size-4 transition-opacity duration-500',
            tickShowing ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden="true"
        />
      )}
      <span className="sr-only">
        {status === 'saving' ? t('saving') : t('saved')}
      </span>
    </p>
  );
}
