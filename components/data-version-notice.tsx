import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  compareDataVersions,
  type DataVersionComparison,
} from '@/lib/domain/data-version';

type DataVersionNoticeProps = {
  savedVersion: string;
  currentVersion: string;
};

const noticeKeys = {
  older: ['olderVersion', 'olderVersionDescription'],
  newer: ['newerVersion', 'newerVersionDescription'],
  unknown: ['unknownVersion', 'unknownVersionDescription'],
} as const;

const describe = (
  comparison: Exclude<DataVersionComparison, 'current'>,
  { savedVersion, currentVersion }: DataVersionNoticeProps,
  t: ReturnType<typeof useTranslations<'armies'>>,
) => {
  const [title, description] = noticeKeys[comparison];
  return {
    title: t(title),
    description: t(description, {
      saved: savedVersion,
      current: currentVersion,
    }),
  };
};

export function DataVersionNotice({
  savedVersion,
  currentVersion,
}: DataVersionNoticeProps) {
  const t = useTranslations('armies');
  const comparison = compareDataVersions(savedVersion, currentVersion);
  if (comparison === 'current') {
    return null;
  }
  const { title, description } = describe(
    comparison,
    { savedVersion, currentVersion },
    t,
  );
  return (
    <Alert variant="warning">
      <IconAlertTriangle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
