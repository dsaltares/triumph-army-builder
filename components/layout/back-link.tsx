import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <IconArrowLeft className="size-3.5" />
      {children}
    </Link>
  );
}
