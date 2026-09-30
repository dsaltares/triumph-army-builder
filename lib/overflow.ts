export const withOverflow = (
  items: readonly string[],
  limit: number,
  overflow: (remaining: number) => string,
): readonly string[] => {
  const reported = items.slice(0, limit);
  const remaining = items.length - reported.length;
  return remaining > 0 ? [...reported, overflow(remaining)] : reported;
};
