'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { routeTemplate } from '@/lib/domain/usage/tracked';
import { sendUsageEvent } from '@/lib/usage/beacon';

export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const route = routeTemplate(pathname);
    if (route) {
      sendUsageEvent({ kind: 'page.viewed', props: { route } });
    }
  }, [pathname]);
  return null;
}
