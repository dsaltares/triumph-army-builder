'use client';

import { IconMenu2 } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useNavItems } from '@/components/layout/use-nav-items';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  type Locale,
  localeFlags,
  localeNames,
  locales,
} from '@/lib/i18n/routing';
import { setLocale } from '@/lib/i18n/set-locale';
import { isActiveRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';

// The header has no room for a fourth control on a phone, so the language
// belongs in here — where it can also be a named choice rather than an icon.
function LanguageChoices({ onChosen }: { onChosen: () => void }) {
  const t = useTranslations('nav');
  const active = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) =>
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
      onChosen();
    });

  return (
    <div className="flex flex-col gap-1 pt-2">
      <p className="px-3 text-xs font-medium text-muted-foreground">
        {t('changeLanguage')}
      </p>
      <ul className="flex flex-col gap-1">
        {locales.map((locale) => {
          const current = locale === active;
          return (
            <li key={locale}>
              <button
                type="button"
                disabled={pending}
                aria-current={current ? 'true' : undefined}
                onClick={() => choose(locale)}
                className={cn(
                  'flex min-h-12 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted',
                  current
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                <span aria-hidden>{localeFlags[locale]}</span>
                {localeNames[locale]}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MobileNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const navItems = useNavItems();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon-touch" className="md:hidden" />
        }
      >
        <IconMenu2 />
        <span className="sr-only">{t('openMenu')}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader className="pb-0">
          <SheetTitle>{t('menu')}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('menuDescription')}
          </SheetDescription>
        </SheetHeader>
        <nav
          aria-label={t('primary')}
          className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <ul className="flex flex-col gap-1">
            {navItems.map(({ href, key }) => {
              const active = isActiveRoute(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted',
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <LanguageChoices onChosen={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
