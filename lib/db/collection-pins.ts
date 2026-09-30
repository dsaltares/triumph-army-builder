import type { Kysely } from 'kysely';
import { z } from 'zod';
import { troopTypeCodes } from '../data/schema.ts';
import { troopOptionIdSchema } from '../domain/army/selection-schema.ts';
import type { CollectionPin } from '../domain/collection/coverage.ts';
import type { ArmyCollectionPinRow, Database } from './schema.ts';

export type ArmyPinsOwner = { armyId: string; userId: string };

export type PinKey = Omit<CollectionPin, 'count'>;

const storedTroopTypeSchema = z.enum(troopTypeCodes);

export const toCollectionPin = (row: ArmyCollectionPinRow): CollectionPin => ({
  option: troopOptionIdSchema.parse(row.troop_option),
  troopType: storedTroopTypeSchema.parse(row.troop_type),
  entry: row.entry_id,
  count: row.count,
});

const ownedArmy = (db: Kysely<Database>, { armyId, userId }: ArmyPinsOwner) =>
  db
    .selectFrom('armies')
    .select('id')
    .where('id', '=', armyId)
    .where('user_id', '=', userId);

export const listArmyPins = async (
  db: Kysely<Database>,
  owner: ArmyPinsOwner,
) =>
  (
    await db
      .selectFrom('army_collection_pins')
      .selectAll()
      .where('army_id', '=', owner.armyId)
      .where('army_id', 'in', ownedArmy(db, owner))
      .execute()
  ).map(toCollectionPin);

export const pinEntry = async (
  db: Kysely<Database>,
  { armyId, userId }: ArmyPinsOwner,
  { option, troopType, entry, count }: CollectionPin,
) => {
  const row = await db
    .insertInto('army_collection_pins')
    .columns(['army_id', 'troop_option', 'troop_type', 'entry_id', 'count'])
    .expression((eb) =>
      eb
        .selectFrom(['armies', 'collection_entries'])
        .select([
          'armies.id',
          eb.val(option).as('troop_option'),
          eb.val(troopType).as('troop_type'),
          'collection_entries.id as entry_id',
          eb.val(count).as('count'),
        ])
        .where('armies.id', '=', armyId)
        .where('armies.user_id', '=', userId)
        .where('collection_entries.id', '=', entry)
        .where('collection_entries.user_id', '=', userId),
    )
    .onConflict((conflict) =>
      conflict
        .columns(['army_id', 'troop_option', 'troop_type', 'entry_id'])
        .doUpdateSet((eb) => ({ count: eb.ref('excluded.count') })),
    )
    .returningAll()
    .executeTakeFirst();
  return row ? toCollectionPin(row) : null;
};

export const unpinEntries = async (
  db: Kysely<Database>,
  owner: ArmyPinsOwner,
  pins: readonly PinKey[],
) => {
  if (pins.length === 0) {
    return 0;
  }
  const { numDeletedRows } = await db
    .deleteFrom('army_collection_pins')
    .where('army_id', '=', owner.armyId)
    .where('army_id', 'in', ownedArmy(db, owner))
    .where((eb) =>
      eb.or(
        pins.map(({ option, troopType, entry }) =>
          eb.and({
            troop_option: option,
            troop_type: troopType,
            entry_id: entry,
          }),
        ),
      ),
    )
    .executeTakeFirst();
  return Number(numDeletedRows);
};
