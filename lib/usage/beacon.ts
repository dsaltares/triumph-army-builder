import type { UsageEvent } from '../domain/usage/tracked.ts';

export const usageEventsPath = '/api/events';

type PrivacySignals = Navigator & { globalPrivacyControl?: boolean };

const optedOut = (navigator: PrivacySignals) =>
  navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';

export const sendUsageEvent = (event: UsageEvent) => {
  if (typeof navigator === 'undefined' || optedOut(navigator)) {
    return;
  }
  navigator.sendBeacon?.(usageEventsPath, JSON.stringify(event));
};
