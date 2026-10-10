'use client';

import { IconPin, IconPinnedOff, IconTag } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useErrorMessage } from '@/components/use-error-message';
import type {
  CoverageLine,
  CoveragePinKey,
  CoverageSource,
} from '@/lib/domain/collection/list-coverage';
import { useTRPC } from '@/lib/trpc/client';

export type CoveredDemand = {
  armyId: string;
  pin: CoveragePinKey;
  line: CoverageLine;
};

const useRefreshAfter = () => {
  const router = useRouter();
  const describe = useErrorMessage();
  return {
    onSuccess: () => router.refresh(),
    onError: (error: unknown) => toast.error(describe(error)),
  };
};

export function CoverWith({
  armyId,
  pin: { option, troopType },
  line,
  className,
}: CoveredDemand & { className?: string }) {
  const t = useTranslations('coverage');
  const trpc = useTRPC();
  const pinEntry = useMutation(
    trpc.collection.pin.mutationOptions(useRefreshAfter()),
  );
  if (line.candidates.length === 0) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pinEntry.isPending}
        render={<Button variant="outline" size="touch" className={className} />}
      >
        <IconPin data-icon="inline-start" />
        {t('coverWith')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {line.candidates.map(({ entry, name, count }) => (
          <DropdownMenuItem
            key={entry}
            onClick={() =>
              pinEntry.mutate({
                armyId,
                option,
                troopType,
                entryId: entry,
                count: line.stands,
              })
            }
          >
            {t('coverWithEntry', { name, count })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Unpin({
  armyId,
  pin: { option, troopType },
  source,
}: Omit<CoveredDemand, 'line'> & { source: CoverageSource }) {
  const t = useTranslations('coverage');
  const trpc = useTRPC();
  const unpin = useMutation(
    trpc.collection.unpin.mutationOptions(useRefreshAfter()),
  );
  return (
    <Button
      variant="ghost"
      size="touch"
      aria-label={t('unpinEntry', { name: source.name })}
      disabled={unpin.isPending}
      onClick={() =>
        unpin.mutate({
          armyId,
          option,
          troopType,
          entryId: source.entry,
        })
      }
    >
      <IconPinnedOff data-icon="inline-start" />
      {t('unpin')}
    </Button>
  );
}

export function AddTag({ source }: { source: CoverageSource }) {
  const t = useTranslations('coverage');
  const trpc = useTRPC();
  const update = useMutation(
    trpc.collection.update.mutationOptions(useRefreshAfter()),
  );
  return source.suggestedTags.map((tag) => (
    <Button
      key={tag}
      variant="outline"
      size="touch"
      aria-label={t('addTagEntry', { name: source.name, tag })}
      disabled={update.isPending}
      onClick={() =>
        update.mutate({ id: source.entry, tags: [...source.tags, tag] })
      }
    >
      <IconTag data-icon="inline-start" />
      {t('addTag', { tag })}
    </Button>
  ));
}
