'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import {
  type BuilderSnapshot,
  useBuilderSnapshot,
} from '@/components/builder/builder-state';
import { pageHeading } from '@/components/layout/page-header';
import { armyNameMaxLength } from '@/lib/domain/army/saved-army';
import { cn } from '@/lib/utils';

export function ListNameField({
  listName,
  rename,
}: Pick<BuilderSnapshot, 'listName' | 'rename'>) {
  const t = useTranslations('builder');
  const named = useRef(listName);

  return (
    <input
      aria-label={t('listName')}
      value={listName}
      maxLength={armyNameMaxLength}
      autoComplete="off"
      spellCheck={false}
      className="-mx-2 min-h-11 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-0.5 transition-colors outline-none hover:border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
      onChange={(event) => {
        const next = event.target.value;
        if (next.trim()) {
          named.current = next;
        }
        rename(next);
      }}
      onBlur={() => {
        if (!listName.trim()) {
          rename(named.current);
        }
      }}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
    />
  );
}

export function ListTitle({ armyName }: { armyName: string }) {
  const t = useTranslations('builder');
  const snapshot = useBuilderSnapshot();

  return (
    <h1 className={cn(pageHeading, 'flex-1')}>
      {snapshot ? (
        <ListNameField listName={snapshot.listName} rename={snapshot.rename} />
      ) : (
        t('buildArmy', { army: armyName })
      )}
    </h1>
  );
}
