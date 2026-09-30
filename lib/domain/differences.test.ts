import { describe, expect, it } from 'vitest';
import { differences } from './differences.ts';

describe('differences', () => {
  it('finds none between equal values', () => {
    expect(
      differences(
        { name: 'Cannae', lines: [{ stands: 4 }], general: null },
        { name: 'Cannae', lines: [{ stands: 4 }], general: null },
      ),
    ).toEqual([]);
  });

  it('names the path to every value that differs', () => {
    expect(
      differences(
        { name: 'Cannae', lines: [{ stands: 4 }, { stands: 2 }] },
        { name: 'Zama', lines: [{ stands: 4 }, { stands: 3 }] },
      ),
    ).toEqual([
      { path: 'name', left: 'Cannae', right: 'Zama' },
      { path: 'lines[1].stands', left: 2, right: 3 },
    ]);
  });

  it('reports a key only one side has', () => {
    expect(differences({ total: 400 }, { total: 400, cap: 48 })).toEqual([
      { path: 'cap', left: undefined, right: 48 },
    ]);
  });

  it('reports an element only one side has', () => {
    expect(differences({ lines: [1] }, { lines: [1, 2] })).toEqual([
      { path: 'lines[1]', left: undefined, right: 2 },
    ]);
  });

  it('reports a value whose shape changed as a whole', () => {
    expect(differences({ general: null }, { general: { stands: 1 } })).toEqual([
      { path: 'general', left: null, right: { stands: 1 } },
    ]);
  });

  it('reports a difference at the root with an empty path', () => {
    expect(differences(1, 2)).toEqual([{ path: '', left: 1, right: 2 }]);
  });
});
