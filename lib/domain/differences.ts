export type Difference = {
  path: string;
  left: unknown;
  right: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const childPath = (path: string, key: string | number) =>
  typeof key === 'number'
    ? `${path}[${key}]`
    : path === ''
      ? key
      : `${path}.${key}`;

export const differences = (
  left: unknown,
  right: unknown,
  path = '',
): Difference[] => {
  if (Array.isArray(left) && Array.isArray(right)) {
    return Array.from(
      { length: Math.max(left.length, right.length) },
      (_, index) =>
        index in left && index in right
          ? differences(left[index], right[index], childPath(path, index))
          : [
              {
                path: childPath(path, index),
                left: left[index],
                right: right[index],
              },
            ],
    ).flat();
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    return keys.flatMap((key) =>
      differences(left[key], right[key], childPath(path, key)),
    );
  }
  return Object.is(left, right) ? [] : [{ path, left, right }];
};
