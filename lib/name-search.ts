import Fuse from 'fuse.js';

export type NamedItem = {
  name: string;
};

const fuseOptions = {
  keys: ['name'],
  threshold: 0.3,
  ignoreLocation: true,
};

export const nameSearch = <Item extends NamedItem>(
  items: readonly Item[],
): ((query: string) => Item[]) => {
  const fuse = new Fuse(items, fuseOptions);
  return (query) => {
    const trimmed = query.trim();
    return trimmed.length === 0
      ? [...items]
      : fuse.search(trimmed).map(({ item }) => item);
  };
};
