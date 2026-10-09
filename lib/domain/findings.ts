export const findingSeverities = ['error', 'warning', 'info'] as const;

export type FindingSeverity = (typeof findingSeverities)[number];

export type SeverityFinding = { severity: FindingSeverity };

export type FindingReport<Finding extends SeverityFinding> = {
  findings: readonly Finding[];
  errors: number;
  warnings: number;
  notes: number;
  legal: boolean;
};

const severityOrder: Readonly<Record<FindingSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

const countOf = (
  findings: readonly SeverityFinding[],
  severity: FindingSeverity,
) => findings.filter((finding) => finding.severity === severity).length;

export const hasNoErrors = (findings: readonly SeverityFinding[]) =>
  !findings.some(({ severity }) => severity === 'error');

export const findingReport = <Finding extends SeverityFinding>(
  unsorted: readonly Finding[],
): FindingReport<Finding> => {
  const findings = [...unsorted].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity],
  );
  return {
    findings,
    errors: countOf(findings, 'error'),
    warnings: countOf(findings, 'warning'),
    notes: countOf(findings, 'info'),
    legal: hasNoErrors(findings),
  };
};
