export const dataVersionFormat = 'YYYY-MM-DD.<hash8>';

export const dataVersionPattern = /^(\d{4}-\d{2}-\d{2})\.([0-9a-f]{8})$/;

export type ParsedDataVersion = {
  date: string;
  hash: string;
};

export type DataVersionComparison = 'current' | 'older' | 'newer' | 'unknown';

const hashLength = 8;
const dateLength = 10;

export const parseDataVersion = (value: string): ParsedDataVersion | null => {
  const [, date, hash] = dataVersionPattern.exec(value) ?? [];
  return date && hash ? { date, hash } : null;
};

export const isDataVersion = (value: string) =>
  parseDataVersion(value) !== null;

export const formatDataVersion = ({
  fetchedAt,
  contentHash,
}: {
  fetchedAt: string;
  contentHash: string;
}) => {
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.getTime())) {
    throw new Error(
      `${fetchedAt} is not a timestamp a data version can be built from`,
    );
  }
  const version = `${fetched.toISOString().slice(0, dateLength)}.${contentHash.slice(0, hashLength)}`;
  if (!isDataVersion(version)) {
    throw new Error(
      `${contentHash} is not a content hash a data version can be built from, expected at least ${hashLength} hex characters`,
    );
  }
  return version;
};

export const dataVersionMatchesContentHash = (
  version: string,
  contentHash: string,
) => parseDataVersion(version)?.hash === contentHash.slice(0, hashLength);

export const compareDataVersions = (
  saved: string,
  current: string,
): DataVersionComparison => {
  const savedVersion = parseDataVersion(saved);
  const currentVersion = parseDataVersion(current);
  if (!savedVersion || !currentVersion) {
    return 'unknown';
  }
  if (saved === current) {
    return 'current';
  }
  return savedVersion.date > currentVersion.date ? 'newer' : 'older';
};
