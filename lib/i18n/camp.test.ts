import { describe, expect, it } from 'vitest';
import { campText } from './camp.ts';
import { wordsFor } from './translator.ts';

const named = (camp: Parameters<typeof campText>[0], locale: 'en' | 'es') =>
  campText(camp, wordsFor(locale, 'sheet'));

describe('naming the camp a list took', () => {
  it('calls an untouched camp standard', () => {
    expect(named([], 'en')).toBe('Standard');
    expect(named([], 'es')).toBe('Estándar');
  });

  it('names one camp card', () => {
    expect(named(['FC'], 'en')).toBe('Fortified camp');
    expect(named(['FC'], 'es')).toBe('Campamento fortificado');
  });

  it('joins every camp card the army took', () => {
    expect(named(['FC', 'PT'], 'es')).toBe(
      'Campamento fortificado, Recua y rebaños',
    );
  });
});
