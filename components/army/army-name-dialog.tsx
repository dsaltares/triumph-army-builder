'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useErrorMessage } from '@/components/use-error-message';
import {
  type ArmyNameForm,
  armyNameFormSchema,
} from '@/lib/domain/army/saved-army';

export type ArmyNameDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  submit: string;
  working: string;
  name: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<unknown>;
};

function NameForm({
  description,
  submit,
  working,
  name,
  onSubmit,
  onDone,
}: Pick<
  ArmyNameDialogProps,
  'description' | 'submit' | 'working' | 'name' | 'onSubmit'
> & { onDone: () => void }) {
  const t = useTranslations('armies');
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<string>();
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ArmyNameForm>({
    resolver: zodResolver(armyNameFormSchema),
    defaultValues: { name },
    mode: 'onTouched',
  });
  const error = describe(errors.name?.message);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (values) => {
        setFailure(undefined);
        try {
          await onSubmit(values.name);
          onDone();
        } catch (thrown: unknown) {
          setFailure(describe(thrown));
        }
      })}
    >
      {description && <DialogDescription>{description}</DialogDescription>}
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t('listName')}</Label>
        <Input
          id={inputId}
          className="h-11 sm:h-9"
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? messageId : undefined}
          {...register('name')}
        />
        <div className="min-h-4">
          {error && <Notice id={messageId}>{error}</Notice>}
        </div>
      </div>
      {failure && <Notice>{failure}</Notice>}
      <DialogFooter>
        <DialogClose
          render={<Button type="button" variant="outline" size="touch" />}
        >
          {t('cancel')}
        </DialogClose>
        <Button type="submit" size="touch" disabled={isSubmitting}>
          {isSubmitting ? working : submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ArmyNameDialog({
  open,
  title,
  onOpenChange,
  ...form
}: ArmyNameDialogProps) {
  const _t = useTranslations('armies');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open && (
          <NameForm
            key={form.name}
            {...form}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
