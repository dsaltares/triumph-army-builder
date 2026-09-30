'use client';

import { IconLanguage } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type Locale,
  localeFlags,
  localeNames,
  locales,
} from '@/lib/i18n/routing';
import { setLocale } from '@/lib/i18n/set-locale';
import { cn } from '@/lib/utils';

export function LocalePicker({ className }: { className?: string }) {
  const nav = useTranslations('nav');
  const active = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) =>
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-touch"
            className={cn('sm:size-8', className)}
            disabled={pending}
          />
        }
      >
        <IconLanguage className="size-4" />
        <span className="sr-only">{nav('changeLanguage')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => {
          const current = locale === active;
          return (
            <DropdownMenuItem
              key={locale}
              onClick={() => choose(locale)}
              aria-current={current ? 'true' : undefined}
              className={cn(current && 'bg-muted text-foreground')}
            >
              <span aria-hidden>{localeFlags[locale]}</span>
              {localeNames[locale]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
