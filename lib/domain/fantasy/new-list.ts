import { z } from 'zod';
import { armyNameSchema } from '../army/saved-army.ts';

export const fantasyNewListFormSchema = z.object({
  name: armyNameSchema,
  pointsTotal: z.number('pointsTotalPositive').positive('pointsTotalPositive'),
});

export type FantasyNewListForm = z.infer<typeof fantasyNewListFormSchema>;
