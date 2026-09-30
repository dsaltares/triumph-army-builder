import { parse } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json' with { type: 'json' };
import es from '../../messages/es.json' with { type: 'json' };
import { locales } from './locales.ts';

type Catalogue = Record<string, Record<string, string>>;

const catalogues: Record<string, Catalogue> = {
  en: en as Catalogue,
  es: es as Catalogue,
};

const keysOf = (catalogue: Catalogue) =>
  Object.entries(catalogue).flatMap(([namespace, messages]) =>
    Object.keys(messages).map((key) => `${namespace}.${key}`),
  );

// `messagesFor` overlays the locale onto English, so a key nobody translated
// renders in English and says nothing about it. That is the right behaviour at
// runtime and a poor one to find out about in production: this is the check
// that a whole namespace has not been forgotten.
const source = keysOf(catalogues.en as Catalogue);

// Parsed rather than matched on braces, so that the words inside a plural
// branch are read as text and not mistaken for arguments.
const placeholders = (message: string) => {
  const nodes = parse(message) as readonly {
    type: number;
    value?: unknown;
    options?: Record<string, { value: readonly unknown[] }>;
  }[];
  const argument = (list: readonly (typeof nodes)[number][]): string[] =>
    list.flatMap((node) => {
      // 0 is literal text and 7 is the `#` inside a plural branch.
      if (node.type === 0 || node.type === 7) {
        return [];
      }
      const nested = node.options
        ? Object.values(node.options).flatMap(({ value }) =>
            argument(value as typeof nodes),
          )
        : [];
      return typeof node.value === 'string' ? [node.value, ...nested] : nested;
    });
  return [...new Set(argument(nodes))].sort();
};

const messageAt = (catalogue: Catalogue, path: string) => {
  const separator = path.indexOf('.');
  const namespace = path.slice(0, separator);
  return catalogue[namespace]?.[path.slice(separator + 1)];
};

describe('the message catalogues', () => {
  it('covers every locale the app offers', () => {
    expect(Object.keys(catalogues).sort()).toEqual([...locales].sort());
  });

  for (const locale of locales.filter((one) => one !== 'en')) {
    const catalogue = catalogues[locale] as Catalogue;

    it(`says everything in ${locale} that it says in English`, () => {
      const missing = source.filter((path) => !messageAt(catalogue, path));

      expect(missing).toEqual([]);
    });

    it(`says nothing extra in ${locale} that English does not`, () => {
      const known = new Set(source);
      const extra = keysOf(catalogue).filter((path) => !known.has(path));

      expect(extra).toEqual([]);
    });

    it(`takes the same placeholders in ${locale} as in English`, () => {
      const mismatched = source
        .map((path) => ({
          path,
          english: placeholders(
            messageAt(catalogues.en as Catalogue, path) ?? '',
          ),
          translated: placeholders(messageAt(catalogue, path) ?? ''),
        }))
        .filter(
          ({ english, translated }) => english.join() !== translated.join(),
        )
        .map(({ path }) => path);

      expect(mismatched).toEqual([]);
    });
  }
});
