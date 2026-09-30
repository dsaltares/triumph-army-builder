import type { z } from 'zod';

const root = '<root>';

const maxSummarisedIssues = 3;

const issuePath = (path: readonly PropertyKey[]) =>
  path.reduce<string>((formatted, key) => {
    if (typeof key === 'number') {
      return `${formatted}[${key}]`;
    }
    return formatted ? `${formatted}.${String(key)}` : String(key);
  }, '') || root;

export const describedIssues = ({ issues }: z.ZodError): readonly string[] =>
  issues.map((issue) => `${issuePath(issue.path)}: ${issue.message}`);

export const summarisedIssues = (error: z.ZodError) =>
  describedIssues(error).slice(0, maxSummarisedIssues).join(', ');
