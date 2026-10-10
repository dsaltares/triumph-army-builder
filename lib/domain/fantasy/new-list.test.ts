import { describe, expect, it } from 'vitest';
import { fantasyNewListFormSchema } from './new-list.ts';

const issues = (input: unknown) =>
  fantasyNewListFormSchema
    .safeParse(input)
    .error?.issues.map(({ message }) => message);

describe('fantasyNewListFormSchema', () => {
  it('takes a trimmed name and a points total', () => {
    expect(
      fantasyNewListFormSchema.parse({
        name: ' Goblin raid ',
        pointsTotal: 36,
      }),
    ).toEqual({ name: 'Goblin raid', pointsTotal: 36 });
  });

  it('asks for a name and a points total above nothing', () => {
    expect(issues({ name: ' ', pointsTotal: 0 })).toEqual([
      'nameYourList',
      'pointsTotalPositive',
    ]);
    expect(issues({ name: 'Goblin raid', pointsTotal: Number.NaN })).toEqual([
      'pointsTotalPositive',
    ]);
  });
});
