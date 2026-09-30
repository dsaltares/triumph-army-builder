import { IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const cardClassName =
  'flex flex-1 flex-col gap-1 rounded-lg bg-card p-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type CardContent = {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
};

export function LinkCardGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </ul>
  );
}

function CardBody({ title, meta, children }: CardContent) {
  return (
    <>
      <span className="font-heading text-sm font-semibold tracking-tight text-pretty">
        {title}
      </span>
      {meta && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {meta}
        </span>
      )}
      {children && (
        <span className="text-xs text-pretty text-muted-foreground">
          {children}
        </span>
      )}
    </>
  );
}

export function LinkCard({ href, ...content }: CardContent & { href: string }) {
  return (
    <li className="flex">
      <Link href={href} className={cardClassName}>
        <CardBody {...content} />
      </Link>
    </li>
  );
}

export function ExternalLinkCard({
  href,
  title,
  ...content
}: CardContent & { href: string }) {
  return (
    <li className="flex">
      <a href={href} target="_blank" rel="noreferrer" className={cardClassName}>
        <CardBody
          title={
            <span className="inline-flex items-center gap-1.5">
              {title}
              <IconExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </span>
          }
          {...content}
        />
      </a>
    </li>
  );
}
