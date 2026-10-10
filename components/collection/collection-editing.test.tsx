import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from '@/components/collection/collection';
import { Toaster } from '@/components/ui/sonner';
import {
  insertCollectionEntry,
  listCollectionEntries,
} from '@/lib/db/collection';
import {
  insertCollectionPhoto,
  listCollectionPhotos,
} from '@/lib/db/collection-photos';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { photoFile } from '@/test/photos';
import { renderUi, type UiOptions } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi({
  bundle: {
    'tag-words.json': [
      { word: 'hoplites', troopTypes: ['HFT', 'SPR'], options: 10 },
    ],
  },
});

const owner = 'user-hannibal';

const ownHoplites = () =>
  insertCollectionEntry(api.database(), {
    id: 'entry-hoplites',
    userId: owner,
    name: 'Hoplites',
    count: 6,
    status: 'inProgress',
    troopType: 'SPR',
    tags: ['greek'],
    notes: '',
    at: new Date(Date.UTC(2026, 8, 18, 10)).toISOString(),
  });

const ownHamilcar = () =>
  insertCollectionEntry(api.database(), {
    id: 'entry-hamilcar',
    userId: owner,
    kind: 'hero',
    name: 'Hamilcar',
    count: 1,
    status: 'unpainted',
    troopType: null,
    tags: ['carthaginian'],
    notes: '',
    at: new Date(Date.UTC(2026, 8, 19, 10)).toISOString(),
  });

const open = (options: UiOptions = {}) =>
  renderUi(<Collection />, {
    ...options,
    wrap: (children, locale) =>
      api.wrap(
        <>
          {children}
          <Toaster />
        </>,
        locale,
      ),
  });

const stored = () => listCollectionEntries(api.database(), owner);

const storedPhotos = (entryId: string) =>
  listCollectionPhotos(api.database(), { entryId, userId: owner });

const addSpartans = async (user: ReturnType<typeof open>['user']) => {
  await user.click(await screen.findByRole('button', { name: 'Add stands' }));
  await user.type(dialog().getByRole('textbox', { name: 'Name' }), 'Spartans');
  await pickTroopType(user, 'SPR');
  await waitFor(() =>
    expect(dialog().getByRole('button', { name: 'Add photo' })).toBeEnabled(),
  );
};

const dialog = () => within(screen.getByRole('dialog'));

const troopTypeInput = () =>
  dialog().getByRole('combobox', { name: 'Fields as' });

const pickTroopType = async (
  user: ReturnType<typeof open>['user'],
  code: string,
) => {
  const input = troopTypeInput();
  await user.clear(input);
  await user.type(input, code);
  await user.click(await screen.findByRole('option', { name: code }));
};

beforeEach(async () => {
  asSignedIn({ id: owner });
  await api.signIn(owner);
});

afterEach(() => {
  toast.dismiss();
});

describe('Collection entries', () => {
  it('adds the first entry from the empty collection', async () => {
    const { user } = open();

    await user.click(await screen.findByRole('button', { name: 'Add stands' }));
    await user.type(
      dialog().getByRole('textbox', { name: 'Name' }),
      'Spartans',
    );
    await user.click(dialog().getByRole('button', { name: 'One stand more' }));
    await pickTroopType(user, 'EFT');
    const tags = dialog().getByRole('combobox', { name: 'Tags' });
    await user.type(tags, 'hop');
    await user.click(await screen.findByRole('option', { name: 'hoplites' }));
    await user.click(dialog().getByRole('radio', { name: 'Painted' }));
    await user.click(
      dialog().getByRole('button', { name: 'Add to collection' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Spartans')).toBeInTheDocument();
    expect(
      screen.getByText('2 stands · 2 painted · 0 to paint'),
    ).toBeInTheDocument();
    expect(await stored()).toEqual([
      expect.objectContaining({
        name: 'Spartans',
        count: 2,
        troopType: 'EFT',
        tags: ['hoplites'],
        status: 'painted',
        notes: '',
      }),
    ]);
  });

  it('opens the form with the troop type a link asks for, and forgets the link on cancel', async () => {
    await ownHoplites();
    const onUrlUpdate = vi.fn();
    const { user } = open({ searchParams: '?new=SPR', onUrlUpdate });

    await screen.findByRole('dialog');
    expect(troopTypeInput()).toHaveValue('SPR');

    await user.click(dialog().getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('');
  });

  it('edits an entry with what it already holds filled in', async () => {
    await ownHoplites();
    const { user } = open();

    await user.click(
      await screen.findByRole('button', { name: 'Edit Hoplites' }),
    );

    const name = dialog().getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Hoplites');
    expect(troopTypeInput()).toHaveValue('SPR');
    expect(
      dialog().getByRole('button', { name: 'Remove tag greek' }),
    ).toBeInTheDocument();
    expect(dialog().getByRole('radio', { name: 'In progress' })).toBeChecked();

    await user.clear(name);
    await user.type(name, 'Theban hoplites');
    await pickTroopType(user, 'HFT');
    await user.click(dialog().getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Theban hoplites')).toBeInTheDocument();
    expect(await stored()).toEqual([
      expect.objectContaining({
        id: 'entry-hoplites',
        name: 'Theban hoplites',
        troopType: 'HFT',
        tags: ['greek'],
      }),
    ]);
  });

  it('adds a hero from the stands form, with no troop type and Fantasy Triumph alone', async () => {
    await ownHoplites();
    const { user } = open();

    await user.click(await screen.findByRole('button', { name: 'Add stands' }));
    await user.type(
      dialog().getByRole('textbox', { name: 'Name' }),
      'Hamilcar',
    );
    await pickTroopType(user, 'ELE');
    await user.click(dialog().getByRole('radio', { name: 'Hero' }));

    expect(
      dialog().queryByRole('combobox', { name: 'Fields as' }),
    ).not.toBeInTheDocument();
    const games = within(dialog().getByRole('group', { name: 'Games' }));
    expect(
      games.getByRole('checkbox', { name: 'Fantasy Triumph' }),
    ).toBeChecked();
    expect(games.getByRole('checkbox', { name: 'Triumph!' })).not.toBeChecked();
    expect(
      dialog().getByRole('group', { name: 'Games' }),
    ).toHaveAccessibleDescription('A hero belongs to Fantasy Triumph alone');
    await user.click(
      dialog().getByRole('button', { name: 'Add to collection' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Hamilcar')).toBeInTheDocument();
    expect(
      screen.getByText('7 stands · 0 painted · 7 to paint'),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(
      rows.map((row) => within(row).getByRole('rowheader').textContent),
    ).toEqual(['Hoplitesgreek', 'Hamilcar']);
    expect(
      within(rows[1] as HTMLElement).getByText('Hero'),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText('Fantasy Triumph'),
    ).toBeInTheDocument();
    expect(await stored()).toEqual([
      expect.objectContaining({
        kind: 'hero',
        name: 'Hamilcar',
        games: ['fantasy'],
      }),
      expect.objectContaining({ kind: 'stands', name: 'Hoplites' }),
    ]);
  });

  it('gives back the troop type picked when the player turns a hero back into stands', async () => {
    const { user } = open();

    await user.click(await screen.findByRole('button', { name: 'Add stands' }));
    await pickTroopType(user, 'ELE');
    await user.click(dialog().getByRole('radio', { name: 'Hero' }));
    await user.click(dialog().getByRole('radio', { name: 'Stands' }));

    expect(troopTypeInput()).toHaveValue('ELE');
    expect(dialog().getByRole('checkbox', { name: 'Triumph!' })).toBeChecked();
  });

  it('keeps stands for the games the player picks', async () => {
    const { user } = open();

    await user.click(await screen.findByRole('button', { name: 'Add stands' }));
    await user.type(dialog().getByRole('textbox', { name: 'Name' }), 'Wargs');
    await pickTroopType(user, 'JCV');
    await user.click(
      dialog().getByRole('checkbox', { name: 'Fantasy Triumph' }),
    );
    await user.click(dialog().getByRole('checkbox', { name: 'Triumph!' }));
    await user.click(
      dialog().getByRole('button', { name: 'Add to collection' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await stored()).toEqual([
      expect.objectContaining({ name: 'Wargs', games: ['fantasy'] }),
    ]);
  });

  it('says a stand needs a game', async () => {
    const { user } = open();

    await user.click(await screen.findByRole('button', { name: 'Add stands' }));
    await user.click(dialog().getByRole('checkbox', { name: 'Triumph!' }));

    expect(
      await dialog().findByText('Pick at least one game these stands are for'),
    ).toBeInTheDocument();
  });

  it('opens the hero form from a link', async () => {
    await ownHoplites();
    open({ searchParams: '?new=hero' });

    await screen.findByRole('dialog');
    expect(dialog().getByRole('radio', { name: 'Hero' })).toBeChecked();
    expect(
      dialog().queryByRole('combobox', { name: 'Fields as' }),
    ).not.toBeInTheDocument();
  });

  it('edits a hero, keeping it a hero', async () => {
    await ownHamilcar();
    const { user } = open();

    await user.click(
      await screen.findByRole('button', { name: 'Edit Hamilcar' }),
    );

    expect(dialog().getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Hamilcar',
    );
    expect(
      dialog().queryByRole('combobox', { name: 'Fields as' }),
    ).not.toBeInTheDocument();
    await user.click(dialog().getByRole('radio', { name: 'Painted' }));
    await user.click(dialog().getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await stored()).toEqual([
      expect.objectContaining({
        id: 'entry-hamilcar',
        kind: 'hero',
        status: 'painted',
      }),
    ]);
  });

  it('deletes a hero straight from its row', async () => {
    await ownHamilcar();
    const { user } = open();

    await user.click(
      await screen.findByRole('button', { name: 'Delete Hamilcar' }),
    );

    expect(await screen.findByText('Hamilcar deleted')).toBeInTheDocument();
    toast.dismiss();
    await waitFor(async () => expect(await stored()).toEqual([]));
  });

  it('keeps the dialog open and says why when the save fails', async () => {
    await ownHoplites();
    const { user } = open();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Hoplites' }),
    );
    api.fails('collection.update');

    await user.click(dialog().getByRole('button', { name: 'Save changes' }));

    expect(
      await dialog().findByText(
        'Something went wrong on our side. Try again in a moment.',
      ),
    ).toBeInTheDocument();
  });

  it('deletes an entry once the undo has passed', async () => {
    await ownHoplites();
    const { user } = open();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Hoplites' }),
    );

    await user.click(dialog().getByRole('button', { name: 'Delete entry' }));

    expect(await screen.findByText('Hoplites deleted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Hoplites' })).toBeNull();
    expect(
      await screen.findByText('Your collection is empty'),
    ).toBeInTheDocument();
    expect(await stored()).toHaveLength(1);

    toast.dismiss();

    await waitFor(async () => expect(await stored()).toEqual([]));
    expect(screen.getByText('Your collection is empty')).toBeInTheDocument();
  });

  it('deletes an entry straight from its row', async () => {
    await ownHoplites();
    const { user } = open();

    await user.click(
      await screen.findByRole('button', { name: 'Delete Hoplites' }),
    );

    expect(await screen.findByText('Hoplites deleted')).toBeInTheDocument();
    expect(
      await screen.findByText('Your collection is empty'),
    ).toBeInTheDocument();
    toast.dismiss();
    await waitFor(async () => expect(await stored()).toEqual([]));
  });

  it('brings a deleted entry back on undo, and never deletes it', async () => {
    await ownHoplites();
    const { user } = open();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Hoplites' }),
    );
    await user.click(dialog().getByRole('button', { name: 'Delete entry' }));

    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(
      await screen.findByRole('button', { name: 'Edit Hoplites' }),
    ).toBeInTheDocument();
    toast.dismiss();
    expect(await stored()).toHaveLength(1);
  });

  it('makes a photo added in the dialog the entry’s thumbnail on the collection', async () => {
    await ownHoplites();
    const { user } = open();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Hoplites' }),
    );
    expect(screen.queryByRole('img', { name: 'Photo of Hoplites' })).toBeNull();
    await waitFor(() =>
      expect(dialog().getByRole('button', { name: 'Add photo' })).toBeEnabled(),
    );
    await user.upload(
      dialog().getByLabelText('Photo files'),
      await photoFile('hoplites.jpg'),
    );
    await dialog().findByRole('img', { name: 'Hoplites · photo 1 of 1' });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      await screen.findByRole('img', { name: 'Photo of Hoplites' }),
    ).toHaveAttribute('src', '/api/collection/photos/photo-1/thumb');
  });

  it('opens an entry’s photos larger from its thumbnail, and pages through them', async () => {
    await ownHoplites();
    for (const [position, id, width] of [
      [0, 'photo-front', 1200],
      [1, 'photo-back', 900],
    ] as const) {
      await insertCollectionPhoto(api.database(), {
        id,
        entryId: 'entry-hoplites',
        userId: owner,
        position,
        width,
        height: 1000,
        bytes: 1000,
        at: new Date(Date.UTC(2026, 8, 18, 11)).toISOString(),
      });
    }
    const { user } = open();

    await user.click(
      await screen.findByRole('button', { name: 'View photos of Hoplites' }),
    );

    expect(dialog().getByRole('heading', { name: 'Hoplites' })).toBeVisible();
    expect(
      dialog().getByRole('img', { name: 'Hoplites · photo 1 of 2' }),
    ).toHaveAttribute('src', '/api/collection/photos/photo-front/display');
    expect(
      await dialog().findByRole('button', { name: 'Previous photo' }),
    ).toBeDisabled();
    await user.click(dialog().getByRole('button', { name: 'Next photo' }));
    expect(
      dialog().getByRole('img', { name: 'Hoplites · photo 2 of 2' }),
    ).toHaveAttribute('src', '/api/collection/photos/photo-back/display');
    expect(dialog().getByRole('button', { name: 'Next photo' })).toBeDisabled();
  });

  it('adds an entry with the photos picked on the form, in the order they were picked', async () => {
    const { user } = open();
    await addSpartans(user);

    await user.upload(dialog().getByLabelText('Photo files'), [
      await photoFile('front.jpg', { width: 1200, height: 900 }),
      await photoFile('blurry.jpg', { width: 800, height: 600 }),
      await photoFile('back.jpg', { width: 900, height: 1200 }),
    ]);
    expect(
      await dialog().findByRole('img', { name: 'New photo 3 of 3' }),
    ).toBeInTheDocument();
    expect(dialog().getByText('3 of 6')).toBeInTheDocument();
    await user.click(
      dialog().getByRole('button', { name: 'Remove photo 2 of 3' }),
    );
    expect(dialog().getByText('2 of 6')).toBeInTheDocument();
    await user.click(
      dialog().getByRole('button', { name: 'Add to collection' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [spartans] = await stored();
    expect(
      (await storedPhotos(spartans?.id ?? '')).map(({ width }) => width),
    ).toEqual([1200, 900]);
    expect(
      await screen.findByRole('img', { name: 'Photo of Spartans' }),
    ).toHaveAttribute('src', '/api/collection/photos/photo-1/thumb');
  });

  it('takes only as many photos as the entry has room for', async () => {
    api.limitPhotos({ perEntry: 1, perAccount: 200 });
    const { user } = open();
    await addSpartans(user);

    await user.upload(dialog().getByLabelText('Photo files'), [
      await photoFile('first.jpg'),
      await photoFile('second.jpg'),
    ]);

    expect(
      await dialog().findByText(
        'An entry holds up to 1 photos · delete one to add another',
      ),
    ).toBeInTheDocument();
    expect(dialog().getAllByRole('img', { name: /^New photo/ })).toHaveLength(
      1,
    );
    expect(dialog().getByRole('button', { name: 'Add photo' })).toBeDisabled();
  });

  it('keeps the entry and opens it for editing when a photo does not go up', async () => {
    api.limitPhotos({ perEntry: 6, perAccount: 1 });
    await ownHoplites();
    const { user } = open();
    await addSpartans(user);
    await user.upload(
      dialog().getByLabelText('Photo files'),
      await photoFile('spartans.jpg'),
    );
    await dialog().findByRole('img', { name: 'New photo 1 of 1' });
    await insertCollectionPhoto(api.database(), {
      id: 'photo-elsewhere',
      entryId: 'entry-hoplites',
      userId: owner,
      position: 0,
      width: 1200,
      height: 900,
      bytes: 1000,
      at: new Date(Date.UTC(2026, 8, 18, 11)).toISOString(),
    });

    await user.click(
      dialog().getByRole('button', { name: 'Add to collection' }),
    );

    expect(
      await dialog().findByRole('heading', { name: 'Edit Spartans' }),
    ).toBeInTheDocument();
    expect(
      dialog().getByText(
        'Your collection holds up to 1 photos · delete one to add another',
      ),
    ).toBeInTheDocument();
    expect((await stored()).map(({ name }) => name).sort()).toEqual([
      'Hoplites',
      'Spartans',
    ]);
  });
});
