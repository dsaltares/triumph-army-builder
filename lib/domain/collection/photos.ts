export const uploadLongEdge = 2048;

export type Dimensions = { width: number; height: number };

export const shrunkDimensions = (
  { width, height }: Dimensions,
  longEdge = uploadLongEdge,
): Dimensions => {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export type PhotoRoom = {
  onEntry: number;
  onAccount: number;
  perEntry: number;
  perAccount: number;
};

export type PhotoLimit = {
  reason: 'photosPerEntryReached' | 'photosPerAccountReached';
  limit: number;
};

export const photoLimitReached = ({
  onEntry,
  onAccount,
  perEntry,
  perAccount,
}: PhotoRoom): PhotoLimit | null => {
  if (onEntry >= perEntry) {
    return { reason: 'photosPerEntryReached', limit: perEntry };
  }
  if (onAccount >= perAccount) {
    return { reason: 'photosPerAccountReached', limit: perAccount };
  }
  return null;
};

export const movedPhoto = (
  ids: readonly string[],
  id: string,
  offset: -1 | 1,
) => {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from === -1 || to < 0 || to >= ids.length) {
    return [...ids];
  }
  const moved = [...ids];
  [moved[from], moved[to]] = [moved[to] as string, moved[from] as string];
  return moved;
};

export const photoSpace = ({
  onEntry,
  onAccount,
  perEntry,
  perAccount,
}: PhotoRoom) =>
  Math.max(0, Math.min(perEntry - onEntry, perAccount - onAccount));
