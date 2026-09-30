'use client';

import {
  IconFileText,
  IconLogout,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { signOut, useSession } from '@/lib/auth/client';
import { authUrl } from '@/lib/auth/redirect';
import { isSignedIn } from '@/lib/auth/session';
import { legalDocuments, routes } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function AccountMenu() {
  const nav = useTranslations('nav');
  const t = useTranslations('auth');
  const { data, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (isPending) {
    return <Skeleton className="h-11 w-16 rounded-md sm:h-8 sm:w-14" />;
  }

  if (!isSignedIn(data)) {
    return (
      <Link
        href={authUrl(routes.signIn, pathname)}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'touch' }),
          'sm:h-8 sm:px-2.5 sm:text-xs',
        )}
      >
        {t('signIn')}
      </Link>
    );
  }

  const onSignOut = async () => {
    await signOut();
    router.replace(routes.myArmies);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon-touch" className="sm:size-8" />
        }
      >
        <IconUser className="size-4" />
        <span className="sr-only">{t('account')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">
            {data.user.email}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={routes.myArmies} />}>
          <IconUser className="size-4" />
          {nav('myArmies')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={routes.account} />}>
          <IconSettings className="size-4" />
          {t('account')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut}>
          <IconLogout className="size-4" />
          {t('signOut')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground">
            {t('legal')}
          </DropdownMenuLabel>
          {legalDocuments.map(({ href, key }) => (
            <DropdownMenuItem key={href} render={<Link href={href} />}>
              <IconFileText className="size-4" />
              {nav(key)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
