'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateArmy } from '@/components/army/use-saved-armies';
import { useFantasyReference } from '@/components/fantasy/use-fantasy-reference';
import { LoadFailure } from '@/components/load-failure';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorMessage } from '@/components/use-error-message';
import { defaultListName } from '@/lib/domain/army/saved-army';
import type { FantasyFormat } from '@/lib/domain/fantasy/battle-cards';
import { startFantasyList } from '@/lib/domain/fantasy/builder';
import {
  type FantasyNewListForm,
  fantasyNewListFormSchema,
} from '@/lib/domain/fantasy/new-list';
import { fantasy, fantasyGameName } from '@/lib/domain/games/fantasy';
import { savedListUrl } from '@/lib/navigation';

function NewFantasyListForm({
  format,
  dataVersion,
}: {
  format: FantasyFormat;
  dataVersion: string;
}) {
  const t = useTranslations('fantasyBuilder');
  const a = useTranslations('armies');
  const router = useRouter();
  const create = useCreateArmy();
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<string>();
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FantasyNewListForm>({
    resolver: zodResolver(fantasyNewListFormSchema),
    defaultValues: {
      name: defaultListName(fantasyGameName, new Date()),
      pointsTotal: format.points,
    },
    mode: 'onTouched',
  });
  const nameError = describe(errors.name?.message);
  const pointsError = describe(errors.pointsTotal?.message);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async ({ name, pointsTotal }) => {
        setFailure(undefined);
        try {
          const created = await create.mutateAsync({
            name,
            game: fantasy.game,
            selection: startFantasyList(format, dataVersion, pointsTotal),
          });
          router.push(savedListUrl(created));
        } catch (thrown: unknown) {
          setFailure(describe(thrown));
        }
      })}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>{a('listName')}</Label>
        <Input
          id={`${id}-name`}
          className="h-11 sm:h-9"
          autoComplete="off"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? `${id}-name-message` : undefined}
          {...register('name')}
        />
        {nameError && <Notice id={`${id}-name-message`}>{nameError}</Notice>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-points`}>{t('pointsTotal')}</Label>
        <Input
          id={`${id}-points`}
          type="number"
          inputMode="decimal"
          min={1}
          step={1}
          className="h-11 w-28 tabular-nums sm:h-9"
          aria-invalid={!!pointsError}
          aria-describedby={
            pointsError ? `${id}-points-message` : `${id}-points-hint`
          }
          {...register('pointsTotal', { valueAsNumber: true })}
        />
        {pointsError ? (
          <Notice id={`${id}-points-message`}>{pointsError}</Notice>
        ) : (
          <p id={`${id}-points-hint`} className="text-xs text-muted-foreground">
            {t('pointsTotalHint', { points: format.points })}
          </p>
        )}
      </div>
      {failure && <Notice>{failure}</Notice>}
      <Button
        type="submit"
        size="touch"
        className="self-end"
        disabled={isSubmitting}
      >
        {isSubmitting ? t('startingList') : t('startList')}
      </Button>
    </form>
  );
}

export function NewFantasyList() {
  const t = useTranslations('fantasyBuilder');
  const describe = useErrorMessage();
  const state = useFantasyReference();

  if (state.status === 'failed') {
    return (
      <LoadFailure
        title={t('packLoadFailed')}
        message={describe(state.error) ?? ''}
      />
    );
  }

  return state.status === 'loading' ? (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <Skeleton className="h-11" />
      <Skeleton className="h-11 w-28" />
    </div>
  ) : (
    <NewFantasyListForm
      format={state.reference.format}
      dataVersion={state.dataVersion}
    />
  );
}
