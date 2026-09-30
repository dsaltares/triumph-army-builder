'use client';

import { useCurrentDataVersion } from '@/components/use-current-data-version';

// A span, not `Skeleton`'s div: the footer holds this inside a <p>, which no div may be in.
export function FooterDataVersion() {
  const { data } = useCurrentDataVersion();
  return data ? (
    <span className="font-medium tabular-nums">{data}</span>
  ) : (
    <span
      data-slot="skeleton"
      className="inline-block h-3 w-28 animate-pulse rounded-md bg-muted align-middle"
    />
  );
}
