import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { blankEntry, EntryForm } from '@/components/collection/entry-form';
import { bundlePaths } from '@/lib/data/bundle';
import type { CollectionEntryFormInput } from '@/lib/domain/collection/entry-schema';
import type { TagWord } from '@/lib/domain/collection/tag-words';
import { serveApi } from '@/test/api';
import { bundledTroopTypes } from '@/test/bundle-source';
import { renderUi } from '@/test/ui';

const tagWords: TagWord[] = [
  { word: 'bowmen', troopTypes: ['ARC'], options: 40 },
  { word: 'phalanx', troopTypes: ['PIK'], options: 20 },
  { word: 'hoplites', troopTypes: ['HFT', 'SPR'], options: 10 },
  { word: 'macedonian', troopTypes: ['PIK'], options: 5 },
];

const api = serveApi({
  bundle: {
    'tag-words.json': tagWords,
    [bundlePaths.troopTypes]: bundledTroopTypes,
  },
});

const fill = (values: Partial<CollectionEntryFormInput> = {}) => {
  const onSubmit = vi.fn(async () => undefined);
  const rendered = renderUi(
    <EntryForm
      values={{ ...blankEntry, ...values }}
      submit="Save"
      working="Saving…"
      onSubmit={onSubmit}
      actions={null}
    />,
    { wrap: api.wrap },
  );
  return { ...rendered, onSubmit };
};

const tagsInput = () => screen.getByRole('combobox', { name: 'Tags' });

const troopTypeInput = () =>
  screen.getByRole('combobox', { name: 'Fields as' });

const suggested = () =>
  within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .map((option) => option.textContent);

const pickTroopType = async (
  user: ReturnType<typeof fill>['user'],
  code: string,
) => {
  const input = troopTypeInput();
  await user.click(input);
  await user.type(input, code);
  await user.click(
    await screen.findByRole('option', { name: new RegExp(`^${code} · `) }),
  );
};

const save = async (user: ReturnType<typeof fill>['user']) => {
  if (screen.queryByRole('listbox')) {
    await user.keyboard('{Escape}');
  }
  await user.click(screen.getByRole('button', { name: 'Save' }));
};

describe('EntryForm', () => {
  it('takes the number of stands typed in', async () => {
    const { user, onSubmit } = fill({ name: 'Hoplites', troopType: 'HFT' });
    const stands = screen.getByRole('spinbutton', { name: 'Stands' });

    await user.clear(stands);
    await user.type(stands, '12');
    await user.click(screen.getByRole('button', { name: 'One stand more' }));
    await save(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ count: 13 }),
    );
  });

  it('says under the stands field when none are typed in', async () => {
    const { user, onSubmit } = fill({ name: 'Hoplites', troopType: 'HFT' });
    const stands = screen.getByRole('spinbutton', { name: 'Stands' });

    await user.clear(stands);
    await save(user);

    expect(stands).toHaveAccessibleDescription(
      'An entry holds at least one stand',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers troop types by code or name, and keeps the one picked', async () => {
    const { user, onSubmit } = fill({ name: 'Hoplites' });
    const input = troopTypeInput();

    await user.type(input, 'spear');
    await user.click(
      await screen.findByRole('option', { name: 'SPR · Spear' }),
    );
    await save(user);

    expect(input).toHaveValue('SPR · Spear');
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ troopType: 'SPR' }),
    );
  });

  it('keeps the tags and the troop type when the player presses Escape', async () => {
    const { user, onSubmit } = fill({
      name: 'Hoplites',
      troopType: 'HFT',
      tags: ['greek'],
    });

    await user.click(tagsInput());
    await user.keyboard('{Escape}{Escape}');
    await user.click(troopTypeInput());
    await user.keyboard('{Escape}{Escape}');
    await save(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ troopType: 'HFT', tags: ['greek'] }),
    );
  });

  it('adds a tag with a comma', async () => {
    const { user, onSubmit } = fill({ name: 'Hoplites', troopType: 'HFT' });

    await user.type(tagsInput(), 'greek,mercenary{Enter}');
    await save(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['greek', 'mercenary'] }),
    );
  });

  it('sends what the player filled in, tags lowercased', async () => {
    const { user, onSubmit } = fill();

    await user.type(
      screen.getByRole('textbox', { name: 'Name' }),
      'Macedonian phalangites',
    );
    await user.click(screen.getByRole('button', { name: 'One stand more' }));
    await user.click(screen.getByRole('button', { name: 'One stand more' }));
    await pickTroopType(user, 'PIK');
    await user.type(tagsInput(), 'Pike{Enter}');
    await user.click(screen.getByRole('radio', { name: 'Painted' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Notes' }),
      'Shields in bronze',
    );
    await save(user);

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Macedonian phalangites',
      count: 3,
      troopType: 'PIK',
      tags: ['pike'],
      status: 'painted',
      notes: 'Shields in bronze',
    });
  });

  it('says under the field what is missing, and sends nothing', async () => {
    const { user, onSubmit } = fill();

    await save(user);

    expect(
      screen.getByText('Name the entry so you can find it again'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Name' }),
    ).toHaveAccessibleDescription('Name the entry so you can find it again');
    expect(
      screen.getByText('Pick the troop type these stands field as'),
    ).toBeInTheDocument();
    expect(troopTypeInput()).toHaveAccessibleDescription(
      'Pick the troop type these stands field as',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('checks the name when the player leaves it', async () => {
    const { user } = fill();

    await user.click(screen.getByRole('textbox', { name: 'Name' }));
    await user.tab();

    expect(
      await screen.findByText('Name the entry so you can find it again'),
    ).toBeInTheDocument();
  });

  it('clears the troop type notice once one is picked', async () => {
    const { user } = fill({ name: 'Hoplites' });

    await save(user);
    await pickTroopType(user, 'HFT');

    expect(
      screen.queryByText('Pick the troop type these stands field as'),
    ).toBeNull();
  });

  it('says how long a tag may be', async () => {
    const { user, onSubmit } = fill({ name: 'Hoplites', troopType: 'HFT' });

    await user.type(tagsInput(), `${'a'.repeat(41)}{Enter}`);
    await save(user);

    expect(
      screen.getByText('Keep each tag under 40 characters'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a tag still being typed when the form is sent', async () => {
    const { user, onSubmit } = fill({
      name: 'Hoplites',
      troopType: 'HFT',
      tags: ['greek'],
    });

    await user.type(tagsInput(), 'Mercenary');
    await save(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['greek', 'mercenary'] }),
    );
  });

  it('removes a tag', async () => {
    const { user, onSubmit } = fill({
      name: 'Hoplites',
      troopType: 'HFT',
      tags: ['greek', 'mercenary'],
    });

    await user.click(screen.getByRole('button', { name: 'Remove tag greek' }));
    await save(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['mercenary'] }),
    );
  });

  it('suggests the words troop option descriptions use, those of its troop types first', async () => {
    const { user } = fill();

    await user.click(tagsInput());

    expect(
      await screen.findByRole('option', { name: 'bowmen' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await pickTroopType(user, 'PIK');
    await user.click(tagsInput());

    expect(suggested()).toEqual([
      'phalanx',
      'macedonian',
      'bowmen',
      'hoplites',
    ]);
  });

  it('narrows the suggestions to what is typed, and adds one in a tap', async () => {
    const { user, onSubmit } = fill({ name: 'Hoplites', troopType: 'HFT' });

    await user.type(tagsInput(), 'ho');

    expect(
      await screen.findByRole('option', { name: 'hoplites' }),
    ).toBeInTheDocument();
    expect(suggested()).toEqual(['Add “ho”', 'hoplites']);

    await user.click(screen.getByRole('option', { name: 'hoplites' }));

    expect(tagsInput()).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Remove tag hoplites' }),
    ).toBeInTheDocument();
    await user.click(tagsInput());
    expect(screen.queryByRole('option', { name: 'hoplites' })).toBeNull();

    await save(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['hoplites'] }),
    );
  });

  it('still takes tags when the suggestions do not load', async () => {
    await api.missing('tag-words.json');
    const { user, onSubmit } = fill({ name: 'Hoplites', troopType: 'HFT' });

    await user.type(tagsInput(), 'greek{Enter}');
    await save(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['greek'] }),
    );
  });
});
