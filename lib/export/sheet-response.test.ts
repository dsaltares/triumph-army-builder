import { beforeAll, describe, expect, it } from 'vitest';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { startBuilding } from '@/lib/domain/army/builder';
import { type ArmySelection, withStands } from '@/lib/domain/army/selection';
import {
  encodeSelection,
  encodeShareCode,
  shareCodeMaxChars,
} from '@/lib/domain/army/share-codec';
import {
  armySheetResponse,
  type SheetBundle,
} from '@/lib/export/sheet-response';
import { armyUrl, externalLinks, sharedListUrl } from '@/lib/navigation';
import {
  filesOf,
  memoryBundleSource,
  sampleBundleHolding,
} from '@/test/bundle-source.ts';
import { armyDetail } from '@/test/fixtures/army.ts';
import { fantasySelection, fantasyUnit } from '@/test/fixtures/fantasy.ts';
import { sampleBundle } from '@/test/sample.ts';

const siteUrl = 'https://triumph.example';
const generatedAt = new Date('2026-09-20T00:00:00Z');
const dataVersion = '2026-09-17.abcdef01';

const armyList = buildArmyList(armyDetail());

const spearmen = armyList.main.troopOptions[0];
if (!spearmen) {
  throw new Error('the fixture army no longer has a first troop option');
}

let bundle: SheetBundle;

beforeAll(async () => {
  bundle = await sampleBundleHolding(armyDetail());
});

const filled = withStands(
  startBuilding(armyList, dataVersion),
  spearmen,
  'SPR',
  2,
);

const query = (selection: ArmySelection, extra = '') =>
  `?s=${encodeURIComponent(encodeSelection(selection))}${extra}`;

const fetchSheet = (
  armyId: string,
  search: string,
  locale: 'en' | 'es' = 'en',
) =>
  armySheetResponse({
    request: new Request(`${siteUrl}/api/armies/${armyId}/sheet${search}`),
    armyId,
    bundle,
    locale,
    siteUrl,
    generatedAt,
  });

describe('rendering the sheet', () => {
  it('returns a PDF for a list the share code describes', async () => {
    const response = await fetchSheet(armyList.id, query(filled));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');

    const body = Buffer.from(await response.arrayBuffer());
    expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(body.byteLength).toBeGreaterThan(1000);
  });

  it('links back to the army list and credits the publisher', async () => {
    const response = await fetchSheet(armyList.id, query(filled));

    const body = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(body).toContain(`${siteUrl}${armyUrl(armyList.id)}`);
    expect(body).toContain(externalLinks.triumph);
  });

  it('prints the mark on the sheet', async () => {
    const response = await fetchSheet(armyList.id, query(filled));

    const body = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(body).toContain('/Subtype /Image');
  });

  it('names the download after the list', async () => {
    const response = await fetchSheet(
      armyList.id,
      query(filled, `&name=${encodeURIComponent('Kish at dawn')}`),
    );

    expect(response.headers.get('content-disposition')).toContain(
      'Kish%20at%20dawn.pdf',
    );
  });

  it('keeps the date in a default list name out of the filename path', async () => {
    const response = await fetchSheet(
      armyList.id,
      query(filled, `&name=${encodeURIComponent('Kish - 2026/09/20')}`),
    );
    const disposition = response.headers.get('content-disposition') ?? '';

    expect(disposition).toContain('filename="Kish - 2026-09-20.pdf"');
    expect(disposition).toContain(encodeURIComponent('Kish - 2026-09-20.pdf'));
  });

  it('falls back to the army name when none is given', async () => {
    const response = await fetchSheet(armyList.id, query(filled));

    expect(response.headers.get('content-disposition')).toContain(
      encodeURIComponent(`${armyList.name}.pdf`),
    );
  });

  it('serves the sheet inline when it is to be previewed', async () => {
    const response = await fetchSheet(
      armyList.id,
      query(filled, '&disposition=inline'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toMatch(/^inline;/);
  });

  it('falls back to a download when asked for a disposition it does not serve', async () => {
    const response = await fetchSheet(
      armyList.id,
      query(filled, '&disposition=sideways'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
  });

  it('prints the short link when the export carries one', async () => {
    const share = 'Ab3xK9_mQ1zT';

    const response = await fetchSheet(
      armyList.id,
      query(filled, `&share=${share}`),
    );

    const body = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(body).toContain(`${siteUrl}${sharedListUrl(share)}`);
  });

  it('leaves the short link off when the export has none', async () => {
    const response = await fetchSheet(armyList.id, query(filled));

    const body = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(body).not.toContain(`${siteUrl}/s/`);
  });

  it('ignores a share id that is not one we could have minted', async () => {
    const response = await fetchSheet(
      armyList.id,
      query(filled, '&share=../../etc/passwd'),
    );

    const body = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(response.status).toBe(200);
    expect(body).not.toContain(`${siteUrl}/s/`);
  });

  it('renders an empty list rather than refusing it', async () => {
    const response = await fetchSheet(
      armyList.id,
      query(startBuilding(armyList, dataVersion)),
    );

    expect(response.status).toBe(200);
  });
});

describe('refusing a request it cannot render', () => {
  it('asks for a list code when none is given', async () => {
    const response = await fetchSheet(armyList.id, '');
    expect(response.status).toBe(400);
  });

  it('turns down a code it cannot read', async () => {
    const response = await fetchSheet(armyList.id, '?s=not-a-code');
    expect(response.status).toBe(400);
  });

  it('turns down a code longer than any list of ours could need', async () => {
    const response = await fetchSheet(
      armyList.id,
      `?s=1.${'A'.repeat(shareCodeMaxChars)}`,
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain('too long');
  });

  it('turns down a code from a newer builder', async () => {
    const response = await fetchSheet(armyList.id, '?s=99.abcd');
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain('newer version');
  });

  it('turns down a code that belongs to another army', async () => {
    const response = await fetchSheet('army-2', query(filled));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain('different army list');
  });

  it('refuses in the language the link asked for', async () => {
    const response = await fetchSheet('army-2', query(filled), 'es');

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain(
      'pertenece a otra lista de ejército',
    );
  });

  it('has no sheet for an army the bundle does not carry', async () => {
    const response = await fetchSheet(
      'army-2',
      query({ ...filled, army: 'army-2' }),
    );

    expect(response.status).toBe(404);
  });
});

const fetchListSheet = (search: string) =>
  armySheetResponse({
    request: new Request(`${siteUrl}/api/lists/sheet${search}`),
    bundle,
    locale: 'en',
    siteUrl,
    generatedAt,
  });

describe('the sheet of any list, by its code alone', () => {
  it('renders the army list the code names', async () => {
    const response = await fetchListSheet(query(filled));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain(
      encodeURIComponent(`${armyList.name}.pdf`),
    );
  });

  it('renders a code minted before the code named its game', async () => {
    const legacy = `1.${Buffer.from(JSON.stringify(filled)).toString('base64url')}`;
    const response = await fetchListSheet(`?s=${legacy}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
  });

  it('has no sheet for an army the bundle does not carry', async () => {
    const response = await fetchListSheet(query({ ...filled, army: 'army-2' }));

    expect(response.status).toBe(404);
  });

  it('renders a Fantasy Triumph list, named after its game when the link names nothing', async () => {
    const code = encodeShareCode({
      game: 'fantasy',
      selection: fantasySelection({
        units: [fantasyUnit('wargs', 'JCV', { name: 'Warg riders' })],
        general: 'wargs',
      }),
    });

    const response = await fetchListSheet(`?s=${encodeURIComponent(code)}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain(
      encodeURIComponent('Fantasy Triumph.pdf'),
    );
  });

  it('has no sheet for a Fantasy Triumph list when the pack has no Fantasy Triumph section', async () => {
    const triumphOnly = memoryBundleSource(
      filesOf(
        (await sampleBundle()).filter(
          ({ path }) => !path.startsWith('games/fantasy/'),
        ),
      ),
    );
    const code = encodeShareCode({
      game: 'fantasy',
      selection: fantasySelection(),
    });

    const response = await armySheetResponse({
      request: new Request(
        `${siteUrl}/api/lists/sheet?s=${encodeURIComponent(code)}`,
      ),
      bundle: triumphOnly,
      locale: 'en',
      siteUrl,
      generatedAt,
    });

    expect(response.status).toBe(404);
  });

  it('turns a Fantasy Triumph code away from an army list’s own sheet link', async () => {
    const code = encodeShareCode({
      game: 'fantasy',
      selection: fantasySelection(),
    });

    const response = await fetchSheet(
      armyList.id,
      `?s=${encodeURIComponent(code)}`,
    );

    expect(response.status).toBe(400);
  });
});
