import { renderToBuffer } from '@react-pdf/renderer';
import { z } from 'zod';
import { ArmySheetDocument } from '@/components/export/army-sheet';
import type { ArmyBundle } from '@/lib/data/bundle-source';
import { readGameReference } from '@/lib/data/game-reference';
import { summarisedIssues } from '@/lib/data/zod-issues';
import { armyNameSchema } from '@/lib/domain/army/saved-army';
import {
  decodeShareCode,
  shareCodeMaxChars,
} from '@/lib/domain/army/share-codec';
import { shareIdPattern } from '@/lib/domain/army/shared-list';
import { gameModule } from '@/lib/domain/games/registry';
import { describeError } from '@/lib/errors';
import { registerSheetFonts } from '@/lib/export/pdf-theme';
import type { Locale } from '@/lib/i18n/locales';
import { wordsFor } from '@/lib/i18n/translator';
import { getLogger } from '@/lib/logger';
import {
  type SheetDisposition,
  sharedListUrl,
  sheetDispositions,
} from '@/lib/navigation';

const log = getLogger('export');

export type SheetBundle = ArmyBundle;

export type ArmySheetRequest = {
  request: Request;
  armyId?: string | undefined;
  bundle: SheetBundle;
  siteUrl: string;
  generatedAt: Date;
  locale: Locale;
};

const sheetRequestSchema = z.object({
  s: z
    .string()
    .min(1, 'the ?s= list code is missing')
    .max(shareCodeMaxChars, 'the ?s= list code is too long to be one of ours'),
  name: armyNameSchema.optional().catch(undefined),
  share: z.string().regex(shareIdPattern).optional().catch(undefined),
  disposition: z.enum(sheetDispositions).catch('attachment'),
});

const asciiFallback = (name: string) =>
  name.replaceAll(/[^\w -]/g, '').trim() || 'army-list';

const pathSeparators = /[/\\:]/g;

const contentDisposition = (
  listName: string,
  disposition: SheetDisposition,
) => {
  const name = listName.replaceAll(pathSeparators, '-');
  return `${disposition}; filename="${asciiFallback(name)}.pdf"; filename*=UTF-8''${encodeURIComponent(`${name}.pdf`)}`;
};

const plainText = (body: string, status: number) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } });

export const armySheetResponse = async ({
  request,
  armyId,
  bundle,
  siteUrl,
  generatedAt,
  locale,
}: ArmySheetRequest) => {
  const w = wordsFor(locale, 'export');
  const parsed = sheetRequestSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return plainText(
      w('needsAList', { issues: summarisedIssues(parsed.error) }),
      400,
    );
  }

  const decoded = decodeShareCode(parsed.data.s);
  if (!decoded.ok) {
    return plainText(
      decoded.reason === 'unsupportedVersion'
        ? w('newerVersion', { version: decoded.version })
        : w('unreadableCode'),
      400,
    );
  }
  const { list } = decoded;
  const module = gameModule(list.game);
  if (armyId !== undefined && module.armyListId(list.selection) !== armyId) {
    return plainText(w('wrongArmy'), 400);
  }

  const reference = await readGameReference(bundle, list);
  if (!reference) {
    return plainText(w('noSuchArmy'), 404);
  }

  const listName = parsed.data.name ?? module.subjectName(reference);
  const shareUrl = parsed.data.share
    ? `${siteUrl}${sharedListUrl(parsed.data.share)}`
    : null;

  registerSheetFonts();

  try {
    const body = await renderToBuffer(
      <ArmySheetDocument
        locale={locale}
        sheet={module.sheetData(
          { name: listName, selection: list.selection },
          reference,
        )}
        generatedAt={generatedAt}
        siteUrl={siteUrl}
        shareUrl={shareUrl}
      />,
    );
    return new Response(new Uint8Array(body), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': contentDisposition(
          listName,
          parsed.data.disposition,
        ),
        'cache-control': 'private, no-store',
      },
    });
  } catch (thrown: unknown) {
    log.error(
      { err: thrown, game: list.game, army: module.armyListId(list.selection) },
      'army sheet PDF failed to render',
    );
    return plainText(describeError(thrown), 500);
  }
};
