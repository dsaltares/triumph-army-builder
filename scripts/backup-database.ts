import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import SQLite from 'better-sqlite3';

const backupsKept = 10;

const backupPattern = /^db-\d{8}T\d{6}Z\.sqlite$/;

const timestamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');

const backupDatabase = async () => {
  const databaseFile = process.env.DATABASE_URL;
  if (!databaseFile) {
    throw new Error('DATABASE_URL is not set, so there is nothing to back up.');
  }
  if (!existsSync(databaseFile)) {
    throw new Error(
      `${databaseFile} does not exist, so there is nothing to back up.`,
    );
  }
  const directory =
    process.env.BACKUP_DIR || join(dirname(databaseFile), 'backups');
  mkdirSync(directory, { recursive: true });
  const target = join(directory, `db-${timestamp(new Date())}.sqlite`);
  const database = new SQLite(databaseFile, { fileMustExist: true });
  try {
    await database.backup(target);
  } finally {
    database.close();
  }
  console.log(`Backed up ${databaseFile} to ${target}`);
  const stale = readdirSync(directory)
    .filter((name) => backupPattern.test(name))
    .sort()
    .reverse()
    .slice(backupsKept);
  for (const name of stale) {
    rmSync(join(directory, name));
  }
};

try {
  await backupDatabase();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
