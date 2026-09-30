export type Bounds = 'belowMin' | 'met' | 'aboveMax';

export const boundsOf = (
  count: number,
  min: number | null,
  max: number | null,
): Bounds => {
  if (min !== null && count < min) {
    return 'belowMin';
  }
  return max !== null && count > max ? 'aboveMax' : 'met';
};
