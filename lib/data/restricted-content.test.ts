import { describe, expect, it } from 'vitest';
import {
  baselineOf,
  canaryScanner,
  compareToBaseline,
  restrictedCanaries,
} from './restricted-content.ts';

const canaries = restrictedCanaries({
  armyLists: [
    { name: 'Goblin Warrens' },
    { name: 'Goblin' },
    { name: 'Sylvan  Courts ' },
    { name: 'Goblin Warrens' },
  ],
  battleCards: [
    {
      mdText: [
        '#### Choosing this card',
        '1 point',
        '- The camp may be *garrisoned* by a single stand of goblins.',
        'Palisades of rune-carved oak, ditches seeded with iron caltrops.',
      ].join('\n'),
    },
  ],
});

const scan = canaryScanner(canaries);

describe('restrictedCanaries', () => {
  it('takes every army name once, longest first, with its whitespace collapsed', () => {
    expect(canaries.armyNames).toEqual([
      'Goblin Warrens',
      'Sylvan Courts',
      'Goblin',
    ]);
  });

  it('takes the battle card lines long enough to be the card’s own words, without their markdown', () => {
    expect(canaries.battleCardLines).toEqual([
      'Palisades of rune-carved oak, ditches seeded with iron caltrops.',
      'The camp may be garrisoned by a single stand of goblins.',
    ]);
  });
});

describe('canaryScanner', () => {
  it('finds an army name as a whole word, on the line it is on', () => {
    expect(
      scan('e2e/builder.spec.ts', "const a = 1;\nopen('Sylvan Courts');\n"),
    ).toEqual([
      { path: 'e2e/builder.spec.ts', line: 2, canary: 'Sylvan Courts' },
    ]);
  });

  it('prefers the longest name, and ignores one inside a longer word or in another case', () => {
    expect(
      scan('a.ts', 'Goblin Warrens · Goblinoid · goblin warrens').map(
        ({ canary }) => canary,
      ),
    ).toEqual(['Goblin Warrens']);
  });

  it('finds a battle card line however it is wrapped or indented', () => {
    const text = [
      '# Camps',
      '',
      'Palisades of rune-carved oak, ditches',
      '   seeded with iron caltrops.',
    ].join('\n');

    expect(scan('docs/DOMAIN.md', text)).toEqual([
      {
        path: 'docs/DOMAIN.md',
        line: 3,
        canary:
          'Palisades of rune-carved oak, ditches seeded with iron caltrops.',
      },
    ]);
  });

  it('finds nothing in text that shares only short, generic lines with a card', () => {
    expect(scan('a.md', '## Choosing this card\n\n1 point')).toEqual([]);
  });

  it('finds nothing when there is nothing to look for', () => {
    expect(
      canaryScanner({ armyNames: [], battleCardLines: [] })('a.ts', 'Goblin'),
    ).toEqual([]);
  });
});

describe('compareToBaseline', () => {
  const known = scan('docs/DOMAIN.md', 'Goblin Warrens\nSylvan Courts\n');
  const baseline = baselineOf(known);

  it('records each file’s canaries once, sorted', () => {
    expect(baselineOf([...known, ...scan('a.ts', 'Goblin Goblin')])).toEqual({
      'a.ts': ['Goblin'],
      'docs/DOMAIN.md': ['Goblin Warrens', 'Sylvan Courts'],
    });
  });

  it('passes what the baseline already holds', () => {
    expect(compareToBaseline(known, baseline)).toEqual({
      unexpected: [],
      cleared: [],
    });
  });

  it('flags a canary in a new file, and a new canary in a baselined one', () => {
    const added = [
      ...known,
      ...scan('README.md', 'Goblin'),
      ...scan('docs/DOMAIN.md', '\n\nGoblin'),
    ];

    expect(compareToBaseline(added, baseline).unexpected).toEqual([
      { path: 'README.md', line: 1, canary: 'Goblin' },
      { path: 'docs/DOMAIN.md', line: 3, canary: 'Goblin' },
    ]);
  });

  it('names what has been cleaned up, so the baseline only shrinks', () => {
    expect(compareToBaseline(known.slice(1), baseline).cleared).toEqual([
      { path: 'docs/DOMAIN.md', canary: 'Goblin Warrens' },
    ]);
  });
});
