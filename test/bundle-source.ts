import type { ArmyDetail, BundleFile } from '@/lib/data/bundle.ts';
import { bundlePaths } from '@/lib/data/bundle.ts';
import {
  type BundleSource,
  documentBundleSource,
} from '@/lib/data/bundle-source.ts';
import type { BundleFiles } from '@/test/reference.ts';
import { sampleBundle, sampleBundledTroopTypes } from '@/test/sample.ts';

export const memoryBundleSource = (files: BundleFiles): BundleSource =>
  documentBundleSource({
    read: async (path) =>
      Object.hasOwn(files, path) ? JSON.stringify(files[path]) : null,
    missing: (path) => `${path} is not in the test bundle`,
  });

export const filesOf = (files: readonly BundleFile[]): BundleFiles =>
  Object.fromEntries(files.map(({ path, contents }) => [path, contents]));

export const sampleBundleHolding = async (...armies: ArmyDetail[]) =>
  memoryBundleSource({
    ...filesOf(
      (await sampleBundle()).filter(({ path }) => !path.startsWith('armies/')),
    ),
    ...Object.fromEntries(
      armies.map((detail) => [bundlePaths.army(detail.id), detail]),
    ),
  });

export const absentBundles = () => () => memoryBundleSource({});

export const bundledTroopTypes = sampleBundledTroopTypes;
