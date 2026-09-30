import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryPhotos } from '@/components/collection/entry-photos';
import { insertCollectionEntry } from '@/lib/db/collection';
import {
  insertCollectionPhoto,
  listCollectionPhotos,
} from '@/lib/db/collection-photos';
import { encodePhoto } from '@/lib/photos/encode';
import { serveApi } from '@/test/api';
import { photoBytes, photoFile } from '@/test/photos';
import { renderUi } from '@/test/ui';

const api = serveApi();

const owner = 'user-hannibal';

const addEntry = (id: string) =>
  insertCollectionEntry(api.database(), {
    id,
    userId: owner,
    name: id === 'entry-hoplites' ? 'Hoplites' : 'Peltasts',
    count: 6,
    status: 'painted',
    troopType: 'SPR',
    tags: [],
    notes: '',
    at: new Date(Date.UTC(2026, 8, 18, 10)).toISOString(),
  });

const seedPhoto = async (
  id: string,
  position: number,
  entryId = 'entry-hoplites',
) => {
  const encoded = await encodePhoto(await photoBytes());
  if (!encoded.encoded) {
    throw new Error('the fixture did not encode');
  }
  await api.photos().write(id, encoded.photo);
  await insertCollectionPhoto(api.database(), {
    id,
    entryId,
    userId: owner,
    position,
    width: encoded.photo.display.width,
    height: encoded.photo.display.height,
    bytes: 1000,
    at: new Date(Date.UTC(2026, 8, 18, 11)).toISOString(),
  });
};

const stored = () =>
  listCollectionPhotos(api.database(), {
    entryId: 'entry-hoplites',
    userId: owner,
  });

const open = () =>
  renderUi(<EntryPhotos entryId="entry-hoplites" name="Hoplites" />, {
    wrap: (children, locale) => api.wrap(children, locale),
  });

const addPhotoButton = () => screen.getByRole('button', { name: 'Add photo' });

const photoInput = () => screen.getByLabelText<HTMLInputElement>('Photo files');

const thumbnails = () =>
  screen
    .getAllByRole('button', { name: /^View photo/ })
    .map((button) => within(button).getByRole('img').getAttribute('src'));

beforeEach(async () => {
  await api.signIn(owner);
  await addEntry('entry-hoplites');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('EntryPhotos', () => {
  it('uploads a photo and shows it in the gallery', async () => {
    const { user } = open();

    expect(
      await screen.findByText(
        'No photos yet · add one of these stands, painted or not',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(addPhotoButton()).toBeEnabled());
    expect(photoInput()).toHaveAttribute('accept', 'image/*');

    await user.upload(photoInput(), await photoFile('hoplites.jpg'));

    expect(
      await screen.findByRole('img', { name: 'Hoplites · photo 1 of 1' }),
    ).toHaveAttribute('src', '/api/collection/photos/photo-1/thumb');
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
    expect(
      screen.getByText('The first photo is the thumbnail on your collection'),
    ).toBeInTheDocument();
    expect(await stored()).toEqual([
      expect.objectContaining({ id: 'photo-1', width: 1200, height: 900 }),
    ]);
    expect(await api.photos().read('photo-1', 'display')).toBeDefined();
  });

  it('shrinks a photo to 2048 px on the long edge and sends it as WebP', async () => {
    const drawn: number[][] = [];
    const sent: string[] = [];
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4032, height: 3024, close: () => {} })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: (_bitmap: unknown, ...box: number[]) => drawn.push(box),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (this: HTMLCanvasElement, done, type) {
        sent.push(String(type));
        void photoBytes({
          width: this.width,
          height: this.height,
          format: 'webp',
        }).then((bytes) => done(new Blob([bytes], { type: 'image/webp' })));
      },
    );
    const { user } = open();
    await waitFor(() => expect(addPhotoButton()).toBeEnabled());

    await user.upload(
      photoInput(),
      await photoFile('phone.jpg', { width: 4032, height: 3024 }),
    );

    await screen.findByRole('img', { name: 'Hoplites · photo 1 of 1' });
    expect(drawn).toEqual([[0, 0, 2048, 1536]]);
    expect(sent).toEqual(['image/webp']);
    expect(await stored()).toEqual([
      expect.objectContaining({ width: 1600, height: 1200 }),
    ]);
  });

  it('says the entry is full before an upload is attempted', async () => {
    api.limitPhotos({ perEntry: 2, perAccount: 200 });
    await seedPhoto('photo-a', 0);
    await seedPhoto('photo-b', 1);
    open();

    expect(
      await screen.findByText(
        'An entry holds up to 2 photos · delete one to add another',
      ),
    ).toBeInTheDocument();
    expect(addPhotoButton()).toBeDisabled();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('says the collection is full before an upload is attempted', async () => {
    api.limitPhotos({ perEntry: 6, perAccount: 1 });
    await addEntry('entry-peltasts');
    await seedPhoto('photo-peltasts', 0, 'entry-peltasts');
    open();

    expect(
      await screen.findByText(
        'Your collection holds up to 1 photos · delete one to add another',
      ),
    ).toBeInTheDocument();
    expect(addPhotoButton()).toBeDisabled();
  });

  it('says so when the server refuses a photo over the limit', async () => {
    api.limitPhotos({ perEntry: 1, perAccount: 200 });
    const { user } = open();
    await waitFor(() => expect(addPhotoButton()).toBeEnabled());
    await seedPhoto('photo-elsewhere', 0);

    await user.upload(photoInput(), await photoFile('hoplites.jpg'));

    expect(
      await screen.findByText(
        'An entry holds up to 1 photos · delete one to add another',
      ),
    ).toBeInTheDocument();
    expect((await stored()).map(({ id }) => id)).toEqual(['photo-elsewhere']);
    await waitFor(() => expect(addPhotoButton()).toBeDisabled());
  });

  it('stops at the limit when more photos are picked than the entry has room for', async () => {
    api.limitPhotos({ perEntry: 1, perAccount: 200 });
    const { user } = open();
    await waitFor(() => expect(addPhotoButton()).toBeEnabled());

    await user.upload(photoInput(), [
      await photoFile('first.jpg'),
      await photoFile('second.jpg'),
    ]);

    expect(
      await screen.findByText(
        'An entry holds up to 1 photos · delete one to add another',
      ),
    ).toBeInTheDocument();
    expect((await stored()).map(({ id }) => id)).toEqual(['photo-1']);
  });

  it('views a photo large and moves it earlier, which makes it the thumbnail', async () => {
    await seedPhoto('photo-a', 0);
    await seedPhoto('photo-b', 1);
    const { user } = open();

    await user.click(
      await screen.findByRole('button', { name: 'View photo 2 of 2' }),
    );
    const viewer = within(await screen.findByRole('dialog'));
    expect(
      viewer.getByRole('heading', { name: 'Photo 2 of 2' }),
    ).toBeInTheDocument();
    expect(
      viewer.getByRole('img', { name: 'Hoplites · photo 2 of 2' }),
    ).toHaveAttribute('src', '/api/collection/photos/photo-b/display');
    expect(viewer.getByRole('button', { name: 'Move later' })).toBeDisabled();

    await user.click(viewer.getByRole('button', { name: 'Move earlier' }));

    expect(
      await viewer.findByRole('heading', { name: 'Photo 1 of 2' }),
    ).toBeInTheDocument();
    expect(viewer.getByRole('button', { name: 'Move earlier' })).toBeDisabled();
    await waitFor(async () =>
      expect((await stored()).map(({ id }) => id)).toEqual([
        'photo-b',
        'photo-a',
      ]),
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(thumbnails()).toEqual([
      '/api/collection/photos/photo-b/thumb',
      '/api/collection/photos/photo-a/thumb',
    ]);
  });

  it('deletes a photo only once the player confirms', async () => {
    await seedPhoto('photo-a', 0);
    await seedPhoto('photo-b', 1);
    const { user } = open();

    await user.click(
      await screen.findByRole('button', { name: 'View photo 1 of 2' }),
    );
    const viewer = within(await screen.findByRole('dialog'));
    await user.click(viewer.getByRole('button', { name: 'Delete photo' }));
    expect(
      viewer.getByText('Deleting a photo cannot be undone'),
    ).toBeInTheDocument();
    await user.click(viewer.getByRole('button', { name: 'Keep it' }));
    expect(await stored()).toHaveLength(2);

    await user.click(viewer.getByRole('button', { name: 'Delete photo' }));
    await user.click(viewer.getByRole('button', { name: 'Delete for good' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(thumbnails()).toEqual(['/api/collection/photos/photo-b/thumb']),
    );
    expect((await stored()).map(({ id }) => id)).toEqual(['photo-b']);
    expect(await api.photos().read('photo-a', 'display')).toBeUndefined();
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
  });
});
