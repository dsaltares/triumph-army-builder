'use client';

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useState } from 'react';
import {
  findingAnchor,
  findingAnchorClass,
  validationAnchor,
} from '@/components/builder/finding-anchor';
import { Section } from '@/components/layout/section';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Finding, FindingSeverity } from '@/lib/domain/army/validation';
import type { ValidationReport } from '@/lib/domain/army/validation-report';
import { describeFinding } from '@/lib/findings';
import { cn } from '@/lib/utils';

type SeverityStyle = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  colour: string;
};

const severityStyles = {
  error: {
    icon: IconAlertTriangle,
    label: 'breaksRule',
    colour: 'text-destructive',
  },
  warning: {
    icon: IconAlertCircle,
    label: 'worthLook',
    colour: 'text-warning',
  },
  info: {
    icon: IconInfoCircle,
    label: 'note',
    colour: 'text-muted-foreground',
  },
} as const satisfies Record<FindingSeverity, SeverityStyle>;

type BuilderWords = ReturnType<typeof useTranslations<'builder'>>;

const describeCounts = (
  { errors, warnings, notes }: ValidationReport,
  t: BuilderWords,
) => {
  const parts = [
    errors > 0 ? t('countErrors', { count: errors }) : null,
    warnings > 0 ? t('countWarnings', { count: warnings }) : null,
    notes > 0 ? t('countNotes', { count: notes }) : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
};

const summarise = (report: ValidationReport, t: BuilderWords) =>
  describeCounts(report, t) ?? t('listValid');

const verdict = (legal: boolean, t: BuilderWords) =>
  legal ? t('legal') : t('illegal');

const noAnchors: ReadonlySet<string> = new Set();

const hoverDelayMs = 150;

export function LegalityBadge({
  report,
  anchors = noAnchors,
}: {
  report: ValidationReport;
  anchors?: ReadonlySet<string>;
}) {
  const t = useTranslations('builder');
  const [open, setOpen] = useState(false);
  const { legal } = report;
  const Icon = legal ? IconCircleCheck : IconAlertTriangle;
  const counts = describeCounts(report, t);
  const close = () => setOpen(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Badge
        variant={legal ? 'success' : 'destructive'}
        render={
          <PopoverTrigger
            openOnHover
            delay={hoverDelayMs}
            aria-label={
              counts
                ? t('showValidationCounts', {
                    verdict: verdict(legal, t),
                    counts,
                  })
                : t('showValidation', { verdict: verdict(legal, t) })
            }
          />
        }
      >
        <Icon />
        {verdict(legal, t)}
      </Badge>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] gap-3"
      >
        <PopoverTitle>
          <a
            href={`#${validationAnchor}`}
            onClick={close}
            className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
          >
            {t('validation')}
          </a>
        </PopoverTitle>
        <Verdict report={report} />
        <FindingList report={report} anchors={anchors} onFollow={close} />
      </PopoverContent>
    </Popover>
  );
}

function FindingRow({
  finding,
  anchor,
  onFollow,
}: {
  finding: Finding;
  anchor: string | null;
  onFollow?: (() => void) | undefined;
}) {
  const t = useTranslations('findings');
  const b = useTranslations('builder');
  const { icon: Icon, label, colour } = severityStyles[finding.severity];
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', colour)} />
      <span className="sr-only">{b('severityLabel', { label: b(label) })}</span>
      {anchor ? (
        <a
          className="max-w-reading text-pretty underline decoration-dotted underline-offset-4 hover:decoration-solid"
          href={`#${anchor}`}
          onClick={onFollow}
        >
          {describeFinding(finding, t)}
        </a>
      ) : (
        <span className="max-w-reading text-pretty text-muted-foreground">
          {describeFinding(finding, t)}
        </span>
      )}
    </li>
  );
}

function Verdict({
  report,
  live = false,
}: {
  report: ValidationReport;
  live?: boolean;
}) {
  const t = useTranslations('builder');
  const { legal } = report;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role={live ? 'status' : undefined}
    >
      <Badge variant={legal ? 'success' : 'destructive'}>
        {verdict(legal, t)}
      </Badge>
      <span className="text-xs text-muted-foreground tabular-nums">
        {summarise(report, t)}
      </span>
    </div>
  );
}

function FindingList({
  report,
  anchors,
  onFollow,
}: {
  report: ValidationReport;
  anchors: ReadonlySet<string>;
  onFollow?: () => void;
}) {
  if (report.findings.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-2">
      {report.findings.map((finding) => {
        const anchor = findingAnchor(finding.target);
        return (
          <FindingRow
            key={`${finding.code}/${anchor}`}
            finding={finding}
            anchor={anchors.has(anchor) ? anchor : null}
            onFollow={onFollow}
          />
        );
      })}
    </ul>
  );
}

export function ValidationPanel({
  report,
  anchors,
}: {
  report: ValidationReport;
  anchors: ReadonlySet<string>;
}) {
  const t = useTranslations('builder');
  return (
    <Section
      id={validationAnchor}
      className={findingAnchorClass}
      title={t('validation')}
    >
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <Verdict report={report} live />
          <FindingList report={report} anchors={anchors} />
        </CardContent>
      </Card>
    </Section>
  );
}
