import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPhotoStore } from '@/lib/photos/store.ts';

export const absentPhotoStore = () =>
  createPhotoStore(join(tmpdir(), 'triumph-absent'));
