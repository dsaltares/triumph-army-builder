import { describe, expect, it } from 'vitest';
import {
  recordingTranslator,
  translationProblems,
} from './translation-drift.ts';
import { emptyCatalogue, type TranslationCatalogue } from './translations.ts';

const catalogueWith = (
  parts: Partial<TranslationCatalogue>,
): TranslationCatalogue => ({ ...emptyCatalogue(), ...parts });

const problemsFor = (
  catalogue: TranslationCatalogue,
  ask: (
    translator: ReturnType<typeof recordingTranslator>['translator'],
  ) => void,
) => {
  const { translator, asked } = recordingTranslator('es', catalogue);
  ask(translator);
  return translationProblems({ locale: 'es', catalogue, asked: asked() });
};

describe('recordingTranslator', () => {
  it('translates exactly as the plain one does', () => {
    const catalogue = catalogueWith({
      'ally-names': {
        al0: { source: 'Pylian allies', target: 'Aliados pilios' },
      },
    });
    const { translator } = recordingTranslator('es', catalogue);

    expect(translator.allyName('Pylian allies')).toBe('Aliados pilios');
    expect(translator.allyName('Something else')).toBe('Something else');
  });

  it('asks nothing of an empty string, which has nothing to translate', () => {
    const { translator, asked } = recordingTranslator('es', emptyCatalogue());
    translator.note('');

    expect(asked()).toEqual([]);
  });
});

describe('translationProblems', () => {
  it('finds nothing when every string asked for has an entry', () => {
    const catalogue = catalogueWith({
      'army-names': {
        'army-1': {
          source: 'Sunspire Dominion',
          target: 'Dominio del Pináculo',
        },
      },
    });

    expect(
      problemsFor(catalogue, (t) => t.armyName('army-1', 'Sunspire Dominion')),
    ).toEqual([]);
  });

  it('names a source-keyed string with no entry', () => {
    const problems = problemsFor(emptyCatalogue(), (t) =>
      t.troopOption('Pylian spearmen'),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.kind).toBe('missing');
    expect(problems[0]?.detail).toContain('Pylian spearmen');
  });

  it('calls an id-keyed entry drifted when the English behind it changed', () => {
    const catalogue = catalogueWith({
      'army-names': {
        'army-1': { source: 'Goblin Warrens', target: 'Madrigueras goblin' },
      },
    });

    const problems = problemsFor(catalogue, (t) =>
      t.armyName('army-1', 'Earliest Sumerian'),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.kind).toBe('drifted');
    expect(problems[0]?.detail).toContain('Goblin Warrens');
    expect(problems[0]?.detail).toContain('Earliest Sumerian');
  });

  it('reads a reworded source-keyed string as one gap and one orphan', () => {
    const catalogue = catalogueWith({
      notes: {
        nt0: {
          source: 'Only before 300 BC',
          target: 'Solo antes del 300 a.C.',
        },
      },
    });

    const problems = problemsFor(catalogue, (t) =>
      t.note('Only before 300 AD'),
    );

    expect(problems.map(({ kind }) => kind).sort()).toEqual([
      'missing',
      'orphaned',
    ]);
  });

  it('names an entry the snapshot no longer has anything to say to', () => {
    const catalogue = catalogueWith({
      'battle-cards': {
        'XX.name': { source: 'Retired Card', target: 'Carta retirada' },
      },
    });

    const problems = problemsFor(catalogue, () => {});

    expect(problems).toHaveLength(1);
    expect(problems[0]?.kind).toBe('orphaned');
    expect(problems[0]?.detail).toContain('Retired Card');
  });

  it('keeps the two shapes of file apart, so an id survives a reword', () => {
    const catalogue = catalogueWith({
      'troop-types': {
        'SPR.name': { source: 'Spear', target: 'Lanza' },
      },
    });

    const problems = problemsFor(catalogue, (t) =>
      t.troopTypeName('SPR', 'Spearmen'),
    );

    // Still resolves to Lanza, so it is drift to fix rather than a hole.
    expect(problems.map(({ kind }) => kind)).toEqual(['drifted']);
  });
});
