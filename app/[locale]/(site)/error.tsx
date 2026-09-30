'use client';

import { IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { routes } from '@/lib/navigation';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('pages');
  return (
    <>
      <PageHeader
        title={t('somethingWentWrong')}
        description={t('renderFailed')}
      />

      {error.digest && (
        <Alert variant="info">
          <IconInfoCircle />
          <AlertTitle>{t('errorReference')}</AlertTitle>
          <AlertDescription>
            <span className="font-medium">{error.digest}</span>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="touch" onClick={reset}>
          {t('tryAgain')}
        </Button>
        <Link
          href={routes.armies}
          className={buttonVariants({ size: 'touch', variant: 'outline' })}
        >
          {t('browseArmyLists')}
        </Link>
      </div>
    </>
  );
}
