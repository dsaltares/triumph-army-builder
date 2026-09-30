import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { FooterDataVersion } from '@/components/layout/footer-data-version';
import { externalLinks, legalDocuments } from '@/lib/navigation';

const linkClass = 'underline underline-offset-4 hover:text-foreground';

const external = (href: string) => (chunks: ReactNode) => (
  <a className={linkClass} href={href} target="_blank" rel="noreferrer">
    {chunks}
  </a>
);

export function SiteFooter() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');

  return (
    <footer className="border-t">
      <div className="content-container flex flex-col gap-2 py-6 text-xs/relaxed text-muted-foreground">
        <p>
          {t.rich('dataFrom', {
            meshwesh: external(externalLinks.meshwesh),
            version: () => <FooterDataVersion />,
          })}
        </p>
        <p>
          {t.rich('unofficial', {
            triumph: external(externalLinks.triumph),
          })}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {legalDocuments.map(({ href, key }) => (
            <Link key={href} className={linkClass} href={href}>
              {nav(key)}
            </Link>
          ))}
          <a
            className={linkClass}
            href={externalLinks.repository}
            target="_blank"
            rel="noreferrer"
          >
            {t('source')}
          </a>
        </p>
      </div>
    </footer>
  );
}
