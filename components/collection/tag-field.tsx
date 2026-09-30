'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useId, useMemo } from 'react';
import { Autocomplete } from '@/components/autocomplete';
import { Notice } from '@/components/notice';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import type { TroopTypeCode } from '@/lib/data/schema';
import { normaliseTags } from '@/lib/domain/collection/entry-schema';
import { suggestTags } from '@/lib/domain/collection/tag-words';
import { useTRPC } from '@/lib/trpc/client';

const typedTag = (draft: string) => draft.trim().toLowerCase();

export function TagField({
  tags,
  draft,
  troopType,
  error,
  onDraftChange,
  onTagsChange,
  onBlur,
}: {
  tags: readonly string[];
  draft: string;
  troopType: TroopTypeCode | null;
  error: string | undefined;
  onDraftChange: (draft: string) => void;
  onTagsChange: (tags: string[]) => void;
  onBlur: () => void;
}) {
  const t = useTranslations('collection');
  const trpc = useTRPC();
  const { reference } = useReference();
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const messageId = `${inputId}-message`;
  const words = useQuery(
    trpc.reference.tagWords.queryOptions(reference ?? skipToken, {
      staleTime: referenceStaleTime,
    }),
  );
  const suggestions = useMemo(
    () =>
      words.data
        ? suggestTags(words.data, { typed: draft, tags, troopType })
        : [],
    [words.data, draft, tags, troopType],
  );
  const typed = typedTag(draft);
  const typedIsNew =
    typed !== '' && !tags.includes(typed) && !suggestions.includes(typed);
  const options = typedIsNew ? [typed, ...suggestions] : suggestions;
  const optionLabel = (tag: string) =>
    typedIsNew && tag === typed ? t('addTypedTag', { tag }) : tag;

  const change = (next: readonly string[]) => {
    onTagsChange(normaliseTags(next));
    onDraftChange('');
  };

  const addOnComma = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === ',') {
      event.preventDefault();
      if (typedTag(draft) !== '') {
        change([...tags, draft]);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Autocomplete
        multiple
        id={inputId}
        label={t('tags')}
        options={options}
        optionLabel={optionLabel}
        empty={t('tagsEmpty')}
        filtered={false}
        value={tags}
        removeLabel={(tag) => t('removeTag', { tag })}
        inputValue={draft}
        invalid={!!error}
        describedBy={[error && messageId, hintId].filter(Boolean).join(' ')}
        onValueChange={change}
        onInputValueChange={(typed, reason) => {
          if (reason === 'input-change') {
            onDraftChange(typed);
          }
        }}
        onInputKeyDown={addOnComma}
        onBlur={onBlur}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        {t('tagsHint')}
      </p>
      {error && <Notice id={messageId}>{error}</Notice>}
    </div>
  );
}
