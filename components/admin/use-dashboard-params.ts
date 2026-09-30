'use client';

import { parseAsStringLiteral, useQueryStates } from 'nuqs';
import { statsAudiences, statsRanges } from '@/lib/domain/usage/stats-window';

export const defaultRange = '30d';

export const dashboardParsers = {
  range: parseAsStringLiteral(statsRanges).withDefault(defaultRange),
  audience: parseAsStringLiteral(statsAudiences).withDefault('all'),
};

export const useDashboardParams = () => useQueryStates(dashboardParsers);
