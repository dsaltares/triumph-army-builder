import { screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { FantasyCardReference } from '@/components/reference/fantasy-card-reference';
import {
  type FantasyCardCatalogue,
  readFantasyCardCatalogue,
} from '@/lib/data/fantasy-reference';
import { parseReferencePack } from '@/lib/data/reference-pack';
import type { Locale } from '@/lib/i18n/routing';
import { filesOf, memoryBundleSource } from '@/test/bundle-source';
import samplePackJson from '@/test/fixtures/reference/sample-pack.json';
import { renderUi } from '@/test/ui';

let catalogues: Record<Locale, FantasyCardCatalogue>;

beforeAll(async () => {
  const pack = parseReferencePack(samplePackJson);
  const catalogue = async (locale: Locale) => {
    const read = await readFantasyCardCatalogue(
      memoryBundleSource(filesOf(pack.locales[locale])),
    );
    if (!read) {
      throw new Error(`the sample pack has no Fantasy cards in ${locale}`);
    }
    return read;
  };
  catalogues = { en: await catalogue('en'), es: await catalogue('es') };
});

const show = (locale: Locale = 'en') =>
  renderUi(<FantasyCardReference {...catalogues[locale]} />, { locale });

const card = (name: string) => {
  const found = screen
    .getByRole('heading', { name, level: 3 })
    .closest('details');
  if (!found) {
    throw new Error(`the ${name} card is not inside a disclosure`);
  }
  return found;
};

const facts = (name: string, label: string) => {
  const term = within(card(name)).getByText(label, { selector: 'dt' });
  const definition = term.nextElementSibling;
  if (!(definition instanceof HTMLElement)) {
    throw new Error(`${name} has no ${label}`);
  }
  return within(definition)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
};

describe('FantasyCardReference', () => {
  it('groups the cards by what they are bought for', () => {
    show();

    for (const heading of [
      'Army cards',
      'Event cards',
      'Stand cards',
      'Hero cards',
      'Stand or hero cards',
    ]) {
      expect(
        screen.getByRole('heading', { name: heading, level: 2 }),
      ).toBeInTheDocument();
    }
    expect(
      within(
        screen.getByRole('heading', { name: 'Hero cards', level: 2 })
          .parentElement?.parentElement as HTMLElement,
      )
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Champion', 'Subcommander']);
  });

  it.each(['en', 'es'] as const)(
    'renders every card in the pack with its cost and rules text in %s',
    (locale) => {
      show(locale);
      const { naming, text } = catalogues[locale];

      for (const { code, name } of naming.cards) {
        const entry = card(name);
        expect(entry).toHaveAttribute('id', code);
        expect(within(entry).getAllByRole('listitem').length).toBeGreaterThan(
          0,
        );
        const firstLine = text[code].split('\n')[0] as string;
        expect(within(entry).getByText(firstLine)).toBeInTheDocument();
      }
    },
  );

  it('puts the cost of a card on its closed summary, as a range when it varies', () => {
    show();

    const summary = (name: string) =>
      card(name).querySelector('summary') as HTMLElement;

    expect(within(summary('Deadly')).getByText('2 points')).toBeInTheDocument();
    expect(
      within(summary('Brittle')).getByText('-2 to 0 points'),
    ).toBeInTheDocument();
    expect(within(summary('Armored')).getByText('½ point')).toBeInTheDocument();
  });

  it('spells out a cost by troop type under the Fantasy names, override by override', () => {
    show();

    expect(facts('Brittle', 'Cost')).toEqual([
      'Artillery: 0 points',
      'Bow Levy or Shooters: -1 point',
      'Carrying Mindblast or Spellblast: -1 point',
      'Anything else: -2 points',
    ]);
  });

  it('spells out a cost by variant, by count, by topography, by bearer and per marked stand', () => {
    show();

    expect(facts('Mobile Infantry', 'Cost')).toEqual([
      'Ground transport: ½ point each, up to 8',
      'Flying transport: 1 point each, up to 8',
    ]);
    expect(facts('Prepared Defenses', 'Cost')).toEqual([
      'Dense home topography (Dense Forest, Dense Marsh, Dense Wasteland, Dense Underground): 1 point each, up to 6',
      'Any other home topography: ½ point each, up to 6',
    ]);
    expect(facts('Away', 'Cost')).toEqual([
      'On a stand: ½ point',
      'On a hero: 1 point',
    ]);
    expect(facts('Delayed Entry', 'Cost')).toEqual([
      '-2 points for each stand or hero it marks, never more than that one costs',
    ]);
  });

  it('lists who may take a card, and what it cannot be combined with', () => {
    show();

    expect(facts('Supporting Shooters', 'Who may take it')).toEqual([
      'Only close order, foot or Light Foot, Raiders or Light Spear',
      'Never Artillery, Pavisiers, Horde or War Wagons',
      'Cannot be combined with Ranged Attack',
    ]);
    expect(facts('Fast', 'Who may take it')).toEqual([
      'Never moving 8 MU or more',
      'Cannot be combined with Flying or Slow',
    ]);
    expect(facts('Marksman', 'Who may take it')).toEqual([
      'Only Shooters, Pavisiers, Artillery or War Wagons or carrying Ranged Attack',
      'A hero needs Ranged Attack as well',
      'At most 4 stands in the army',
      'At most 1 hero in the army',
    ]);
    expect(facts('Delayed Entry', 'Who may take it')).toEqual([
      'At most 4 stands in the army',
      'At most 1 hero in the army',
      'Never on the general’s unit',
    ]);
    expect(facts('Illusion', 'Who may take it')).toEqual([
      'Never on a hero',
      'Never on the general’s unit',
    ]);
    expect(facts('Fortified Camp', 'Who may take it')).toEqual([
      'Once per army',
    ]);
    expect(facts('Charge Through', 'Who may take it')).toEqual([
      'On one unit only',
    ]);
  });

  it('leaves out restrictions on a card anyone may take', () => {
    show();

    expect(
      within(card('Deadly')).queryByText('Who may take it'),
    ).not.toBeInTheDocument();
  });

  it('offers the choices that do not change the cost', () => {
    show();

    expect(facts('Ranged Attack', 'Choose one')).toEqual([
      'Physical or Magical',
    ]);
    expect(
      within(card('Flying')).queryByText('Choose one'),
    ).not.toBeInTheDocument();
  });

  it('speaks Spanish, with the troop names and card names the pack translates', () => {
    show('es');

    expect(
      screen.getByRole('heading', { name: 'Cartas de héroe', level: 2 }),
    ).toBeInTheDocument();
    expect(facts('Emboscada', 'Coste')).toEqual([
      'Solo en su topografía · Topografía propia densa (Dense Forest, Dense Marsh, Dense Wasteland, Dense Underground): 2 puntos',
      'Solo en su topografía · Cualquier otra topografía propia: 1 punto',
      'En cualquier topografía: 2 puntos',
    ]);
    expect(facts('Acorazado', 'Quién puede tomarla')[0]).toMatch(/^Nunca /);
  });

  it('leaves every card closed so the list stays scannable', () => {
    show();

    for (const { name } of catalogues.en.naming.cards) {
      expect(card(name)).not.toHaveAttribute('open');
    }
  });
});
