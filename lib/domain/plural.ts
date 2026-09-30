const rules = new Intl.PluralRules('en-GB');

export const plural = (count: number, one: string, many = `${one}s`) =>
  rules.select(count) === 'one' ? one : many;

export const countOf = (count: number, one: string, many = `${one}s`) =>
  `${count} ${plural(count, one, many)}`;
