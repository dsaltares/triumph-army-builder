import { serverBaseUrl } from '@/lib/base-url';
import { servedReference } from '@/lib/data/served-bundle';
import { armySheetResponse } from '@/lib/export/sheet-response';
import { defaultLocale, isLocale } from '@/lib/i18n/locales';

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const asked = new URL(request.url).searchParams.get('lang');
  const locale = isLocale(asked) ? asked : defaultLocale;
  const reference = await servedReference(locale);
  if (!reference) {
    return new Response(null, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return armySheetResponse({
    request,
    armyId: (await params).id,
    bundle: reference.bundle,
    siteUrl: serverBaseUrl(),
    generatedAt: new Date(),
    locale,
  });
};
