import type { ReactNode } from 'react';

export const iconOnlyBelowMd = 'max-md:w-11';

export function HeaderActionLabel({ children }: { children: ReactNode }) {
  return <span className="max-md:sr-only">{children}</span>;
}
