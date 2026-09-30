import type { Withholding } from '@/lib/domain/army/availability';

export const withholdingLabels = {
  year: 'withheldYear',
  subFaction: 'withheldSubFaction',
} as const satisfies Record<Withholding, string>;

export const withholdingNotices = {
  year: 'withheldYearRemedy',
  subFaction: 'withheldRemedy',
} as const satisfies Record<Withholding, string>;
