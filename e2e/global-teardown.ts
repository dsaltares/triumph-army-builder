import { rm } from 'node:fs/promises';
import { e2ePhotoDir } from '../playwright.config.ts';

export default async function globalTeardown() {
  await rm(e2ePhotoDir, { recursive: true, force: true });
}
