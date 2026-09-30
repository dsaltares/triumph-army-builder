'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AccountMenu } from '@/components/auth/account-menu';
import { MobileNav } from '@/components/layout/mobile-nav';
import { useNavItems } from '@/components/layout/use-nav-items';
import { LocalePicker } from '@/components/locale-picker';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { isActiveRoute, routes } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const navItems = useNavItems();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm supports-backdrop-filter:bg-background/70">
      <div className="content-container flex h-14 items-center gap-2">
        <Link
          href={routes.home}
          className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          <Image
            src="/brand/mark.png"
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0"
            priority
          />
          <span>
            Triumph!{' '}
            <span className="hidden font-normal text-muted-foreground min-[22rem]:inline">
              Army Builder
            </span>
          </span>
        </Link>
        <nav aria-label={t('primary')} className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {navItems.map(({ href, key }) => {
              const active = isActiveRoute(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'lg' }),
                      active && 'bg-muted text-foreground',
                    )}
                  >
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <AccountMenu />
          <LocalePicker className="hidden md:inline-flex" />
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
