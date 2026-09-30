import { screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimNotice } from '@/components/auth/claim-notice';
import { Toaster } from '@/components/ui/sonner';
import { claimCookieName } from '@/lib/auth/claim';
import { insertArmy } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { asAnonymous, asSignedIn, asSignedOut } from '@/test/auth-client';
import { fixtureSelection } from '@/test/fixtures/army';
import { renderUi } from '@/test/ui';

vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'user-hannibal';

const holding = async (...names: string[]) => {
  await api.signIn(owner);
  for (const [index, name] of names.entries()) {
    await insertArmy(api.database(), {
      id: `army-${index + 1}`,
      userId: owner,
      name,
      selection: fixtureSelection(),
      at: new Date(Date.UTC(2026, 8, 18, 10, index)).toISOString(),
    });
  }
  return names.map((_name, index) => `army-${index + 1}`);
};

const claimed = (ids: string[]) => {
  // biome-ignore lint/suspicious/noDocumentCookie: standing in for the cookie the claim sets on the sign-in response
  document.cookie = `${claimCookieName}=${ids.join(',')}`;
};

const remaining = async () =>
  (await api.database().selectFrom('armies').select('name').execute()).map(
    ({ name }) => name,
  );

const show = () =>
  renderUi(
    <>
      <ClaimNotice />
      <Toaster />
    </>,
    { wrap: api.wrap },
  );

const notice = () =>
  screen.findByText(/from this browser (was|were) added to your account/);

const noNotice = () =>
  expect(
    screen.findByText(/added to your account/, undefined, { timeout: 250 }),
  ).rejects.toThrow();

beforeEach(() => {
  asSignedOut();
  claimed([]);
});

afterEach(() => {
  toast.dismiss();
});

describe('ClaimNotice', () => {
  it('names how many lists moved, and offers to undo it', async () => {
    const ids = await holding('Cannae', 'Trebia');
    asSignedIn({ id: owner });
    claimed(ids);

    show();

    expect(await notice()).toHaveTextContent(
      '2 lists from this browser were added to your account',
    );
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeVisible();
  });

  it('counts one list in the singular, because a player reads it', async () => {
    const ids = await holding('Cannae');
    asSignedIn({ id: owner });
    claimed(ids);

    show();

    expect(await notice()).toHaveTextContent(
      '1 list from this browser was added to your account',
    );
  });

  it('takes the lists back off the account when the undo is pressed', async () => {
    const ids = await holding('Cannae', 'Trebia');
    asSignedIn({ id: owner });
    claimed(ids);
    const { user } = show();

    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('2 lists removed again')).toBeVisible();
    await waitFor(async () => expect(await remaining()).toEqual([]));
  });

  it('says nothing when this browser was holding nothing', async () => {
    await holding();
    asSignedIn({ id: owner });

    show();

    await noNotice();
  });

  it('says nothing to a browser that has not signed in yet', async () => {
    const ids = await holding('Cannae');
    asAnonymous();
    claimed(ids);

    show();

    await noNotice();
    expect(document.cookie).toContain(claimCookieName);
  });
});
