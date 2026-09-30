import type { Kysely } from 'kysely';

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createIndex('accounts_provider_id_account_id')
    .on('accounts')
    .columns(['providerId', 'accountId'])
    .execute();

  await db.schema
    .createIndex('verifications_expires_at')
    .on('verifications')
    .column('expiresAt')
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropIndex('verifications_expires_at').execute();
  await db.schema.dropIndex('accounts_provider_id_account_id').execute();
};
