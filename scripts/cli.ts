import { fileURLToPath } from 'node:url';
import { describeError } from '../lib/errors.ts';

export const snapshotDirectory = fileURLToPath(
  new URL('../data/snapshot/', import.meta.url),
);

export const curationDirectory = fileURLToPath(
  new URL('../data/curation/', import.meta.url),
);

export const translationsDirectory = fileURLToPath(
  new URL('../data/translations/', import.meta.url),
);

export const run = async (command: () => Promise<void>) => {
  try {
    await command();
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  }
};
