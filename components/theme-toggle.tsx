'use client';

import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: 'light', key: 'light', Icon: IconSun },
  { value: 'dark', key: 'dark', Icon: IconMoon },
  { value: 'system', key: 'system', Icon: IconDeviceDesktop },
] as const;

export function ThemeToggle() {
  const t = useTranslations('theme');
  const nav = useTranslations('nav');
  const { theme, setTheme } = useTheme();
  const [chosen, setChosen] = useState<string | undefined>(undefined);

  useEffect(() => setChosen(theme), [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon-touch" className="sm:size-8" />
        }
      >
        <IconSun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <IconMoon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        <span className="sr-only">{nav('changeTheme')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map(({ value, key, Icon }) => {
          const current = value === chosen;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              aria-current={current ? 'true' : undefined}
              className={cn(current && 'bg-muted text-foreground')}
            >
              <Icon className="size-4" />
              {t(key)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
