'use client';

import { useEffect } from 'react';

export const hydratedAttribute = 'data-hydrated';

export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.setAttribute(hydratedAttribute, '');
    return () => document.documentElement.removeAttribute(hydratedAttribute);
  }, []);
  return null;
}
