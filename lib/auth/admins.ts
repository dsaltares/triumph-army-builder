import { z } from 'zod';
import { getLogger } from '../logger.ts';

type Environment = Record<string, string | undefined>;

export type AdminEmails = ReadonlySet<string>;

export type AdminCandidate = {
  email: string;
  emailVerified: boolean;
  isAnonymous: boolean;
};

const log = getLogger('auth/admins');

const entriesSchema = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

const emailSchema = z.email();

export const adminEmails = (
  environment: Environment = process.env,
): AdminEmails => {
  const entries = entriesSchema.parse(environment.ADMIN_EMAILS);
  const rejected = entries.filter(
    (entry) => !emailSchema.safeParse(entry).success,
  );
  if (rejected.length > 0) {
    log.warn({ rejected }, 'ADMIN_EMAILS holds entries that are not emails');
  }
  return new Set(entries.filter((entry) => !rejected.includes(entry)));
};

let configured: AdminEmails | undefined;

export const configuredAdminEmails = () => {
  configured ??= adminEmails();
  return configured;
};

export const isAdmin = (candidate: AdminCandidate, admins: AdminEmails) =>
  candidate.emailVerified &&
  !candidate.isAnonymous &&
  admins.has(candidate.email.trim().toLowerCase());
