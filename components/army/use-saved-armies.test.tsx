import { renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateArmy,
  useDeleteArmy,
  useDuplicateArmy,
  useSavedArmies,
  useUndoClaim,
  useUpdateArmy,
} from '@/components/army/use-saved-armies';
import { Toaster } from '@/components/ui/sonner';
import { serveApi } from '@/test/api';
import {
  asAnonymous,
  asSignedIn,
  asSignedOut,
  startAnonymousSession,
} from '@/test/auth-client';
import { fixtureSelection } from '@/test/fixtures/army';
import { router } from '@/test/next-navigation';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'user-hannibal';

const browser = 'user-browser';

const useArmies = () => ({
  armies: useSavedArmies(),
  create: useCreateArmy(),
  update: useUpdateArmy(),
  duplicate: useDuplicateArmy(),
  remove: useDeleteArmy(),
  undoClaim: useUndoClaim(),
});

const mount = () =>
  renderHook(useArmies, {
    wrapper: ({ children }) =>
      api.wrap(
        <>
          {children}
          <Toaster />
        </>,
      ),
  });

const ready = async (result: { current: ReturnType<typeof useArmies> }) => {
  await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));
};

const save = async (
  result: { current: ReturnType<typeof useArmies> },
  name: string,
) => {
  result.current.create.mutate({ name, selection: fixtureSelection() });
  await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
};

beforeEach(() => {
  asSignedIn({ id: owner });
});

afterEach(() => {
  toast.dismiss();
});

const names = (result: { current: ReturnType<typeof useArmies> }) =>
  result.current.armies.data?.map(({ name }) => name);

describe('the saved army cache', () => {
  it('holds nothing for a caller with no session', async () => {
    const { result } = mount();

    await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));
    expect(result.current.armies.data).toEqual([]);
  });

  it('shows a new list before the server has answered, and keeps it after', async () => {
    await api.signIn(owner);
    const { result } = mount();
    await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));

    result.current.create.mutate({
      name: 'Cannae',
      selection: fixtureSelection(),
    });

    await waitFor(() => expect(names(result)).toEqual(['Cannae']));
    await waitFor(() =>
      expect(result.current.armies.data?.[0]?.id).toBe('army-1'),
    );
  });

  it('takes a new list back off the list when the server refuses it', async () => {
    await api.signIn(owner);
    const { result } = mount();
    await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));

    result.current.create.mutate({ name: '', selection: fixtureSelection() });

    await waitFor(() => expect(result.current.create.isError).toBe(true));
    await waitFor(() => expect(names(result)).toEqual([]));
  });

  it('renames a list', async () => {
    await api.signIn(owner);
    const { result } = mount();
    await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));

    result.current.create.mutate({
      name: 'Cannae',
      selection: fixtureSelection(),
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));

    result.current.update.mutate({ id: 'army-1', name: 'Zama' });

    await waitFor(() => expect(names(result)).toEqual(['Zama']));
  });

  it('duplicates a list under a copied name, newest first', async () => {
    await api.signIn(owner);
    const { result } = mount();
    await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));

    result.current.create.mutate({
      name: 'Cannae',
      selection: fixtureSelection(),
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));

    result.current.duplicate.mutate({ id: 'army-1' });

    await waitFor(() =>
      expect(names(result)).toEqual(['Cannae (copy)', 'Cannae']),
    );
  });

  it('deletes a list', async () => {
    await api.signIn(owner);
    const { result } = mount();
    await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));

    result.current.create.mutate({
      name: 'Cannae',
      selection: fixtureSelection(),
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));

    result.current.remove.mutate({ id: 'army-1' });

    await waitFor(() => expect(names(result)).toEqual([]));
  });

  it('never hands one player the lists of another', async () => {
    await api.signIn(owner);
    const { result } = mount();
    await waitFor(() => expect(result.current.armies.isSuccess).toBe(true));
    result.current.create.mutate({
      name: 'Cannae',
      selection: fixtureSelection(),
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));

    await api.signIn('user-scipio');
    const other = mount();

    await waitFor(() =>
      expect(other.result.current.armies.isSuccess).toBe(true),
    );
    expect(other.result.current.armies.data).toEqual([]);
  });
});

const prompt = () => screen.findByText('Saved within your browser');

const noPrompt = () =>
  expect(
    screen.findByText('Saved within your browser', undefined, {
      timeout: 250,
    }),
  ).rejects.toThrow();

describe('saving without an account', () => {
  beforeEach(() => {
    asSignedOut();
    startAnonymousSession.mockImplementation(() =>
      api.signInAnonymously(browser),
    );
  });

  it('starts a session for this browser on the first save, and not before', async () => {
    const { result } = mount();
    await ready(result);

    expect(startAnonymousSession).not.toHaveBeenCalled();

    await save(result, 'Cannae');

    expect(startAnonymousSession).toHaveBeenCalledTimes(1);
    expect(names(result)).toEqual(['Cannae']);
  });

  it('leaves a browser that already has one alone', async () => {
    await api.signInAnonymously(browser);
    asAnonymous(browser);
    const { result } = mount();
    await ready(result);

    await save(result, 'Cannae');

    expect(startAnonymousSession).not.toHaveBeenCalled();
  });

  it('tells the player their lists are held against this browser', async () => {
    const { result } = mount();
    await ready(result);

    await save(result, 'Cannae');

    expect(await prompt()).toBeVisible();
    expect(screen.getByText(/if you delete browsing data/)).toBeInTheDocument();
  });

  it('offers the way out of that, rather than only naming the problem', async () => {
    const user = userEvent.setup();
    const { result } = mount();
    await ready(result);
    await save(result, 'Cannae');

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(router.push).toHaveBeenCalledWith('/sign-in');
  });

  it('says nothing of the sort to a player who signed up', async () => {
    await api.signIn(owner);
    asSignedIn({ id: owner });
    const { result } = mount();
    await ready(result);

    await save(result, 'Cannae');

    await noPrompt();
  });
});

describe('undoing a claim', () => {
  it('takes back the lists it is given and leaves the rest', async () => {
    await api.signIn(owner);
    const { result } = mount();
    await ready(result);
    await save(result, 'Cannae');
    await save(result, 'Trebia');

    result.current.undoClaim.mutate({ ids: ['army-1'] });

    await waitFor(() => expect(names(result)).toEqual(['Trebia']));
  });
});
