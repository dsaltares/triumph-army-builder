import { getDatabase } from '@/lib/db/client';
import { servePhotoResponse } from '@/lib/photos/serve';
import { createPhotoStore } from '@/lib/photos/store';
import { resolveCaller } from '@/lib/trpc/context';

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string; size: string }> },
) => {
  const { id, size } = await params;
  return servePhotoResponse({
    caller: await resolveCaller(request.headers),
    db: getDatabase(),
    store: createPhotoStore(),
    id,
    size,
  });
};
