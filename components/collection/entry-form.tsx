'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useMemo, useRef, useState } from 'react';
import {
  Controller,
  type FieldErrors,
  useForm,
  useWatch,
} from 'react-hook-form';
import { Autocomplete } from '@/components/autocomplete';
import { Stepper } from '@/components/builder/stepper';
import { TagField } from '@/components/collection/tag-field';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useErrorMessage } from '@/components/use-error-message';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import { games, type TroopTypeCode, troopTypeCodes } from '@/lib/data/schema';
import { toggledValues } from '@/lib/domain/army-index';
import {
  type CollectionEntryKind,
  type CollectionStatus,
  collectionEntryKinds,
  collectionStatuses,
  defaultGamesOf,
} from '@/lib/domain/collection/entry';
import {
  type CollectionEntryForm,
  type CollectionEntryFormInput,
  collectionEntryFormSchema,
  normaliseTags,
} from '@/lib/domain/collection/entry-schema';
import { useTRPC } from '@/lib/trpc/client';

export const blankEntry: CollectionEntryFormInput = {
  name: '',
  count: 1,
  troopType: null,
  tags: [],
  status: 'unpainted',
  notes: '',
};

export const kindLabels = {
  stands: 'kindStands',
  hero: 'hero',
} as const satisfies Record<CollectionEntryKind, string>;

const firstTagError = (errors: FieldErrors<CollectionEntryFormInput>) =>
  errors.tags?.message ??
  (Array.isArray(errors.tags)
    ? errors.tags.find((error) => error?.message)?.message
    : undefined);

function FieldMessage({
  id,
  error,
}: {
  id: string;
  error: string | undefined;
}) {
  return error ? <Notice id={id}>{error}</Notice> : null;
}

const describedBy = (id: string, error: string | undefined) =>
  error ? id : undefined;

const useTroopTypeLabel = () => {
  const trpc = useTRPC();
  const { reference } = useReference();
  const troopTypes = useQuery(
    trpc.reference.troopTypes.queryOptions(reference ?? skipToken, {
      staleTime: referenceStaleTime,
    }),
  );
  return useMemo(() => {
    const names = new Map(
      (troopTypes.data ?? []).map(({ permanentCode, displayName }) => [
        permanentCode,
        displayName,
      ]),
    );
    return (code: TroopTypeCode) => {
      const name = names.get(code);
      return name ? `${code} · ${name}` : code;
    };
  }, [troopTypes.data]);
};

export function EntryForm({
  values,
  submit,
  working,
  onSubmit,
  actions,
  photos,
}: {
  values: CollectionEntryFormInput;
  submit: string;
  working: string;
  onSubmit: (entry: CollectionEntryForm) => Promise<unknown>;
  actions: ReactNode;
  photos?: ReactNode;
}) {
  const t = useTranslations('collection');
  const g = useTranslations('games');
  const describe = useErrorMessage();
  const troopTypeLabel = useTroopTypeLabel();
  const id = useId();
  const [failure, setFailure] = useState<string>();
  const [draftTag, setDraftTag] = useState('');
  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CollectionEntryFormInput, unknown, CollectionEntryForm>({
    resolver: zodResolver(collectionEntryFormSchema),
    defaultValues: values,
    mode: 'onTouched',
  });
  const troopType = useWatch({ control, name: 'troopType' });
  const kind = useWatch({ control, name: 'kind' }) ?? 'stands';
  const hero = kind === 'hero';
  const standsFields = useRef<Pick<
    CollectionEntryFormInput,
    'troopType' | 'games'
  > | null>(null);
  const changeKind = (next: CollectionEntryKind) => {
    if (next === 'hero') {
      standsFields.current = {
        troopType: getValues('troopType'),
        games: getValues('games'),
      };
      setValue('troopType', null);
      setValue('games', undefined);
    } else if (standsFields.current) {
      setValue('troopType', standsFields.current.troopType);
      setValue('games', standsFields.current.games);
    } else {
      setValue('games', undefined);
    }
    setValue('kind', next, { shouldValidate: true });
  };

  const nameError = describe(errors.name?.message);
  const countError = describe(errors.count?.message);
  const troopTypeError = describe(errors.troopType?.message);
  const tagsError = describe(firstTagError(errors));
  const gamesError = describe(errors.games?.message);
  const notesError = describe(errors.notes?.message);

  const save = handleSubmit(async (entry) => {
    setFailure(undefined);
    try {
      await onSubmit(entry);
    } catch (thrown: unknown) {
      setFailure(describe(thrown));
    }
  });

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        if (draftTag.trim() !== '') {
          setValue('tags', normaliseTags([...getValues('tags'), draftTag]));
          setDraftTag('');
        }
        return save(event);
      }}
    >
      <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-1">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-name`}>{t('entryName')}</Label>
          <Input
            id={`${id}-name`}
            className="h-11 sm:h-9"
            autoComplete="off"
            aria-invalid={!!nameError}
            aria-describedby={describedBy(`${id}-name-message`, nameError)}
            {...register('name')}
          />
          <FieldMessage id={`${id}-name-message`} error={nameError} />
        </div>
        {photos}

        <div className="flex flex-col gap-2">
          <span id={`${id}-kind`} className="text-xs font-medium">
            {t('kind')}
          </span>
          <RadioGroup
            aria-labelledby={`${id}-kind`}
            className="flex flex-wrap gap-x-4 gap-y-0"
            value={kind}
            onValueChange={(next) => changeKind(next as CollectionEntryKind)}
          >
            {collectionEntryKinds.map((option) => (
              <Label key={option} className="h-11 text-sm font-normal">
                <RadioGroupItem value={option} />
                {t(kindLabels[option])}
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-count`}>{t('stands')}</Label>
          <Controller
            control={control}
            name="count"
            render={({ field }) => (
              <Stepper
                count={field.value}
                countLabel={t('stands')}
                removeLabel={t('fewerStands')}
                addLabel={t('moreStands')}
                canRemove={field.value > 1}
                canAdd
                onChange={field.onChange}
                input={{
                  id: `${id}-count`,
                  invalid: !!countError,
                  describedBy: describedBy(`${id}-count-message`, countError),
                  onBlur: field.onBlur,
                }}
              />
            )}
          />
          <FieldMessage id={`${id}-count-message`} error={countError} />
        </div>

        {!hero && (
          <div className="flex flex-col gap-2">
            <Controller
              control={control}
              name="troopType"
              render={({ field }) => (
                <Autocomplete<TroopTypeCode>
                  id={`${id}-troop-type`}
                  label={t('fieldsAs')}
                  options={troopTypeCodes}
                  optionLabel={troopTypeLabel}
                  empty={t('troopTypesEmpty')}
                  value={field.value}
                  invalid={!!troopTypeError}
                  describedBy={describedBy(
                    `${id}-troop-type-message`,
                    troopTypeError,
                  )}
                  onValueChange={(code) => {
                    field.onChange(code);
                    field.onBlur();
                  }}
                  onBlur={field.onBlur}
                />
              )}
            />
            <FieldMessage
              id={`${id}-troop-type-message`}
              error={troopTypeError}
            />
          </div>
        )}

        <Controller
          control={control}
          name="games"
          render={({ field }) => {
            const chosen = field.value ?? defaultGamesOf(kind);
            return (
              <fieldset
                className="flex min-w-0 flex-col gap-2"
                aria-describedby={describedBy(
                  `${id}-games-message`,
                  gamesError ?? (hero ? t('heroGamesHint') : undefined),
                )}
              >
                <legend className="mb-2 text-xs font-medium">
                  {t('games')}
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-0">
                  {games.map((game) => (
                    <Label
                      key={game}
                      htmlFor={`${id}-game-${game}`}
                      className="h-11 text-sm font-normal"
                    >
                      <Checkbox
                        id={`${id}-game-${game}`}
                        checked={chosen.includes(game)}
                        disabled={hero}
                        onCheckedChange={() => {
                          field.onChange(toggledValues(chosen, game));
                          field.onBlur();
                        }}
                      />
                      {g(game)}
                    </Label>
                  ))}
                </div>
                {gamesError ? (
                  <FieldMessage id={`${id}-games-message`} error={gamesError} />
                ) : (
                  hero && (
                    <p
                      id={`${id}-games-message`}
                      className="text-xs text-muted-foreground"
                    >
                      {t('heroGamesHint')}
                    </p>
                  )
                )}
              </fieldset>
            );
          }}
        />

        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <TagField
              tags={field.value}
              draft={draftTag}
              troopType={troopType}
              error={tagsError}
              onDraftChange={setDraftTag}
              onTagsChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <span id={`${id}-status`} className="text-xs font-medium">
                {t('status')}
              </span>
              <RadioGroup
                aria-labelledby={`${id}-status`}
                className="flex flex-wrap gap-x-4 gap-y-0"
                value={field.value}
                onValueChange={(status) =>
                  field.onChange(status as CollectionStatus)
                }
              >
                {collectionStatuses.map((status) => (
                  <Label key={status} className="h-11 text-sm font-normal">
                    <RadioGroupItem value={status} />
                    {t(status)}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-notes`}>{t('notes')}</Label>
          <Textarea
            id={`${id}-notes`}
            aria-invalid={!!notesError}
            aria-describedby={describedBy(`${id}-notes-message`, notesError)}
            {...register('notes')}
          />
          <FieldMessage id={`${id}-notes-message`} error={notesError} />
        </div>
      </div>

      {failure && (
        <div className="pt-4">
          <Notice>{failure}</Notice>
        </div>
      )}
      <div className="-mx-4 mt-4 flex flex-col-reverse gap-2 border-t px-4 pt-4 sm:flex-row sm:justify-end">
        {actions}
        <Button type="submit" size="touch" disabled={isSubmitting}>
          {isSubmitting ? working : submit}
        </Button>
      </div>
    </form>
  );
}
