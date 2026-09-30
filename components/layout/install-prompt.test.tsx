import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallPrompt } from '@/components/layout/install-prompt';
import {
  installRecord,
  installRecordKey,
  pageSettleDelayMs,
  recordListSaved,
} from '@/lib/install';
import { renderUi } from '@/test/ui';

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const android =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const mac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const on = (userAgent: string, maxTouchPoints = 5) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  });
};

const hasBeenHereBefore = () =>
  localStorage.setItem(
    installRecordKey,
    JSON.stringify({ visits: 1, savedAList: false, dismissed: false }),
  );

const alreadyInstalled = () =>
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
  } as MediaQueryList);

const prompt = () => screen.queryByRole('dialog');

const settledPrompt = () =>
  screen.findByRole('dialog', {}, { timeout: pageSettleDelayMs + 1000 });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  on(iphone);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InstallPrompt', () => {
  it('says nothing on a first visit', () => {
    renderUi(<InstallPrompt />);

    expect(prompt()).toBeNull();
    expect(installRecord().visits).toBe(1);
  });

  it('points an iPhone at the share sheet on the visit after', async () => {
    hasBeenHereBefore();

    renderUi(<InstallPrompt />);

    expect(prompt()).toBeNull();
    expect(await settledPrompt()).toBeVisible();
    expect(
      screen.getByText(/Tap the share button, then Add to Home Screen/),
    ).toBeVisible();
  });

  it('points Android at the browser menu', async () => {
    hasBeenHereBefore();
    on(android);

    renderUi(<InstallPrompt />);

    expect(await settledPrompt()).toBeVisible();
    expect(
      screen.getByText(/Open the browser menu, then Install app/),
    ).toBeVisible();
  });

  it('asks on a first visit as soon as a list is saved', () => {
    renderUi(<InstallPrompt />);

    expect(prompt()).toBeNull();

    act(() => recordListSaved());

    expect(prompt()).toBeVisible();
  });

  it('says nothing on a desktop', () => {
    hasBeenHereBefore();
    on(mac, 0);

    renderUi(<InstallPrompt />);

    expect(prompt()).toBeNull();
  });

  it('says nothing to someone who already installed it', () => {
    hasBeenHereBefore();
    alreadyInstalled();

    renderUi(<InstallPrompt />);

    expect(prompt()).toBeNull();
  });

  it('counts one visit per session, however many times a page loads', () => {
    const { unmount } = renderUi(<InstallPrompt />);
    unmount();
    renderUi(<InstallPrompt />);

    expect(installRecord().visits).toBe(1);
    expect(prompt()).toBeNull();
  });

  it('stays gone once it has been turned down', async () => {
    hasBeenHereBefore();

    const { user, unmount } = renderUi(<InstallPrompt />);
    await settledPrompt();
    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(prompt()).toBeNull();

    unmount();
    sessionStorage.clear();
    renderUi(<InstallPrompt />);

    expect(prompt()).toBeNull();
  });
});
