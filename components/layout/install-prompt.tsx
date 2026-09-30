'use client';

import { IconDeviceMobilePlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  countInstallVisit,
  dismissInstallPrompt,
  type InstallPlatform,
  installPlatform,
  installRecord,
  listSavedEvent,
  pageSettleDelayMs,
  shouldPromptInstall,
} from '@/lib/install';

const standaloneQuery = '(display-mode: standalone)';

const howToInstall = {
  ios: 'installIos',
  android: 'installAndroid',
} as const satisfies Record<InstallPlatform, string>;

export function InstallPrompt() {
  const t = useTranslations('nav');
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);

  useEffect(() => {
    if (window.matchMedia(standaloneQuery).matches) {
      return;
    }
    const device = installPlatform(navigator);
    if (!device) {
      return;
    }
    const ask = () => {
      if (shouldPromptInstall(installRecord())) {
        setPlatform(device);
      }
    };
    const record = countInstallVisit();
    const settling = shouldPromptInstall(record)
      ? setTimeout(ask, pageSettleDelayMs)
      : undefined;
    window.addEventListener(listSavedEvent, ask);
    return () => {
      clearTimeout(settling);
      window.removeEventListener(listSavedEvent, ask);
    };
  }, []);

  if (!platform) {
    return null;
  }

  const dismiss = () => {
    dismissInstallPrompt();
    setPlatform(null);
  };

  return (
    <Sheet open onOpenChange={dismiss}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconDeviceMobilePlus className="size-4 shrink-0" />
            {t('installTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('installDescription', { how: t(howToInstall[platform]) })}
          </SheetDescription>
        </SheetHeader>
        <SheetFooter className="pt-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <Button variant="outline" size="touch" onClick={dismiss}>
            {t('notNow')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
