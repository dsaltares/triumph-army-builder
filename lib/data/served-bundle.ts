import { connection } from 'next/server';
import { getDatabase } from '../db/client.ts';
import {
  currentReferenceVersion,
  databaseBundleSource,
} from '../db/reference.ts';
import type { Locale } from '../i18n/locales.ts';
import type { BundleSource } from './bundle-source.ts';

const sources = new Map<string, BundleSource>();

export const bundleFor = (
  locale: Locale,
  dataVersion?: string,
): BundleSource => {
  const key = `${locale}:${dataVersion ?? ''}`;
  const existing = sources.get(key);
  if (existing) {
    return existing;
  }
  const source = databaseBundleSource(getDatabase(), locale, dataVersion);
  sources.set(key, source);
  return source;
};

export type ServedReference = {
  bundle: BundleSource;
  dataVersion: string;
};

export const servedReference = async (
  locale: Locale,
): Promise<ServedReference | null> => {
  await connection();
  const dataVersion = await currentReferenceVersion(getDatabase());
  return dataVersion === null
    ? null
    : { bundle: bundleFor(locale), dataVersion };
};
