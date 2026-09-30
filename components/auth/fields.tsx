'use client';

import { IconAlertTriangle, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, type ReactNode, useId, useState } from 'react';
import { Notice } from '@/components/notice';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type FieldProps = ComponentProps<'input'> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export function TextField({
  label,
  error,
  hint,
  trailing,
  className,
  ...input
}: FieldProps & { trailing?: ReactNode }) {
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          className={cn('h-11 sm:h-9', trailing && 'pr-12 sm:pr-10', className)}
          aria-invalid={!!error}
          aria-describedby={error || hint ? messageId : undefined}
          {...input}
        />
        {trailing}
      </div>
      <div className="min-h-4">
        {error ? (
          <Notice id={messageId}>{error}</Notice>
        ) : hint ? (
          <p id={messageId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PasswordField(props: FieldProps) {
  const t = useTranslations('auth');
  const [revealed, setRevealed] = useState(false);
  const Icon = revealed ? IconEyeOff : IconEye;

  return (
    <TextField
      type={revealed ? 'text' : 'password'}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="absolute top-1/2 right-1 size-9 -translate-y-1/2 text-muted-foreground sm:size-7"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setRevealed(!revealed)}
        >
          <Icon className="size-4" />
          <span className="sr-only">
            {revealed ? t('hidePassword') : t('showPassword')}
          </span>
        </Button>
      }
      {...props}
    />
  );
}

export function FormError({ children }: { children: string }) {
  return (
    <Alert variant="destructive">
      <IconAlertTriangle />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
