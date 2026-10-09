import { servedSheetResponse } from '@/lib/export/served-sheet';

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => servedSheetResponse(request, (await params).id);
