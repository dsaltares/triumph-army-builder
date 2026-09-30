import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageViewBeacon } from '@/components/usage/page-view-beacon';
import { sentBeacons } from '@/test/beacons';
import { atPathname } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const privacySignals = ['globalPrivacyControl', 'doNotTrack'] as const;

const signal = (name: (typeof privacySignals)[number], value: unknown) =>
  Object.defineProperty(window.navigator, name, {
    configurable: true,
    value,
  });

beforeEach(() => {
  signal('globalPrivacyControl', undefined);
  signal('doNotTrack', null);
  atPathname('/');
});

describe('the page view beacon', () => {
  it('sends the route a page was served from, never its ids', () => {
    atPathname('/armies/5fb1b71fe1af060017701922/build');

    renderUi(<PageViewBeacon />);

    expect(sentBeacons()).toEqual([
      {
        url: '/api/events',
        body: { kind: 'page.viewed', props: { route: '/armies/[id]/build' } },
      },
    ]);
  });

  it('sends nothing for a path that is not a page', () => {
    atPathname('/no/such/page');

    renderUi(<PageViewBeacon />);

    expect(sentBeacons()).toEqual([]);
  });

  it.each([
    ['Global Privacy Control', 'globalPrivacyControl', true],
    ['Do Not Track', 'doNotTrack', '1'],
  ] as const)(
    'sends nothing when the browser asks for %s',
    (_, name, value) => {
      signal(name, value);
      atPathname('/armies');

      renderUi(<PageViewBeacon />);

      expect(sentBeacons()).toEqual([]);
    },
  );
});
