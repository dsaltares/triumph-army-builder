import { servedSheetResponse } from '@/lib/export/served-sheet';

export const GET = (request: Request) => servedSheetResponse(request);
