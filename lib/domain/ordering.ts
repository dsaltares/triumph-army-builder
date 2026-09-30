export const ascending = (left: string, right: string) =>
  left < right ? -1 : 1;

export const byKey = (
  [left]: readonly [string, unknown],
  [right]: readonly [string, unknown],
) => ascending(left, right);

export const by =
  <Item>(key: (item: Item) => string) =>
  (left: Item, right: Item) =>
    ascending(key(left), key(right));
