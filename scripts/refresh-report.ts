import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildBundle } from '../lib/data/bundle.ts';
import { curatedOverlayProblems } from '../lib/data/curated-overlays.ts';
import { loadCuration } from '../lib/data/curation.ts';
import type { MeshweshManifest } from '../lib/data/schema.ts';
import { loadManifest, loadSnapshot } from '../lib/data/snapshot.ts';
import {
  recordingTranslator,
  type TranslationProblem,
  translationProblems,
} from '../lib/data/translation-drift.ts';
import { loadTranslations } from '../lib/data/translation-source.ts';
import { countOf } from '../lib/domain/plural.ts';
import { describeError } from '../lib/errors.ts';
import { defaultLocale, locales } from '../lib/i18n/locales.ts';
import { withOverflow } from '../lib/overflow.ts';
import { curationDirectory, run, snapshotDirectory } from './cli.ts';

const maxReportedProblems = 20;

const translationsDirectory = fileURLToPath(
  new URL('../data/translations/', import.meta.url),
);

const recordChange = (
  previous: MeshweshManifest,
  file: MeshweshManifest['files'][number],
) => {
  const before = previous.files.find(({ name }) => name === file.name);
  if (!before) {
    return 'new';
  }
  const delta = file.records - before.records;
  if (delta === 0) {
    return '—';
  }
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const fileTable = (previous: MeshweshManifest, current: MeshweshManifest) =>
  [
    '| File | Records | Change |',
    '| --- | ---: | ---: |',
    ...current.files.map(
      (file) =>
        `| \`${file.name}\` | ${file.records} | ${recordChange(previous, file)} |`,
    ),
  ].join('\n');

const validationProblems = async (directory: string) => {
  try {
    return curatedOverlayProblems(
      await loadCuration(curationDirectory),
      await loadSnapshot(directory),
    );
  } catch (error) {
    return [describeError(error)];
  }
};

// A snapshot that no longer parses is the overlay section's problem to
// report, not this one's; saying it twice helps nobody.
const translationDrift = async (directory: string) => {
  const problems: TranslationProblem[] = [];
  try {
    const snapshot = await loadSnapshot(directory);
    const curation = await loadCuration(curationDirectory);
    for (const locale of locales.filter((one) => one !== defaultLocale)) {
      const catalogue = await loadTranslations(translationsDirectory, locale);
      const { translator, asked } = recordingTranslator(locale, catalogue);
      buildBundle(snapshot, curation, translator);
      problems.push(
        ...translationProblems({ locale, catalogue, asked: asked() }),
      );
    }
  } catch {
    return [];
  }
  return problems;
};

const counted = (
  problems: readonly TranslationProblem[],
  kind: TranslationProblem['kind'],
) => problems.filter((problem) => problem.kind === kind).length;

// Deliberately not a failure. A missing or drifted translation falls back to
// English, which reads worse but works; only `drift=true` on the workflow asks
// a human to look. See ADR 0027.
const translationSection = (problems: readonly TranslationProblem[]) => {
  if (problems.length === 0) {
    return [
      '### Translations',
      '',
      'Every translated string still matches the snapshot.',
    ].join('\n');
  }
  return [
    '### Translations',
    '',
    `${counted(problems, 'missing')} missing, ${counted(problems, 'drifted')} drifted and ${counted(problems, 'orphaned')} orphaned. Each one falls back to English until it is retranslated, so this does not block the merge:`,
    '',
    '```',
    ...withOverflow(
      problems.map(({ detail }) => detail),
      maxReportedProblems,
      (remaining) => `and ${remaining} more`,
    ),
    '```',
  ].join('\n');
};

const overlaySection = (problems: readonly string[]) => {
  if (problems.length === 0) {
    return [
      '### Curated overlays',
      '',
      'The snapshot still parses and both overlays still describe it — `yarn validate:snapshot` passes.',
    ].join('\n');
  }
  return [
    '### Curated overlays',
    '',
    `\`yarn validate:snapshot\` fails with ${countOf(problems.length, 'problem')}. Re-audit \`data/curation/sub-factions.json\` and \`data/curation/battle-card-costs.json\` against the diff before merging:`,
    '',
    '```',
    ...withOverflow(
      problems,
      maxReportedProblems,
      (remaining) => `and ${remaining} more`,
    ),
    '```',
  ].join('\n');
};

const writeOutputs = async (outputs: Record<string, string>) => {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) {
    return;
  }
  await appendFile(
    path,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
};

const report = async () => {
  const previousDirectory = process.argv[2];
  if (!previousDirectory) {
    throw new Error(
      'Usage: refresh-report <previous snapshot directory> [current snapshot directory]',
    );
  }
  const currentDirectory = process.argv[3] ?? snapshotDirectory;
  const previous = await loadManifest(previousDirectory);
  const current = await loadManifest(currentDirectory);
  const changed = previous.contentHash !== current.contentHash;

  if (!changed) {
    await writeOutputs({
      changed: 'false',
      drift: 'false',
      version: current.dataVersion,
    });
    console.log(
      [
        '## Meshwesh refresh',
        '',
        `No upstream change: the snapshot is still \`${current.dataVersion}\`.`,
      ].join('\n'),
    );
    return;
  }

  const problems = await validationProblems(currentDirectory);
  const translations = await translationDrift(currentDirectory);
  await writeOutputs({
    changed: 'true',
    drift: problems.length + translations.length > 0 ? 'true' : 'false',
    version: current.dataVersion,
  });
  console.log(
    [
      '## Meshwesh refresh',
      '',
      `\`${previous.dataVersion}\` → \`${current.dataVersion}\`, fetched ${current.fetchedAt} from ${current.source}.`,
      '',
      fileTable(previous, current),
      '',
      overlaySection(problems),
      '',
      translationSection(translations),
    ].join('\n'),
  );
};

await run(report);
