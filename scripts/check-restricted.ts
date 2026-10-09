import { execFile } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { loadCuration } from '../lib/data/curation.ts';
import {
  baselineOf,
  type CanaryHit,
  canaryScanner,
  compareToBaseline,
  type RestrictedContentBaseline,
  restrictedCanaries,
} from '../lib/data/restricted-content.ts';
import { loadSnapshot } from '../lib/data/snapshot.ts';
import { countOf } from '../lib/domain/plural.ts';
import { curationDirectory, run, snapshotDirectory } from './cli.ts';

const skippedDirectories = new Set(['.git', 'node_modules']);

const nulByte = 0;

const walked = async (path: string): Promise<string[]> => {
  if (!(await stat(path)).isDirectory()) {
    return [path];
  }
  const entries = await readdir(path, { recursive: true, withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !relative(path, entry.parentPath)
          .split('/')
          .some((segment) => skippedDirectories.has(segment)),
    )
    .map((entry) => relative('.', join(entry.parentPath, entry.name)));
};

const tracked = async (paths: readonly string[]) => {
  const { stdout } = await promisify(execFile)(
    'git',
    ['ls-files', '-z', '--', ...paths],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout.split('\0').filter(Boolean);
};

const readBaseline = async (
  path: string | undefined,
): Promise<RestrictedContentBaseline> =>
  path ? JSON.parse(await readFile(path, 'utf8')) : {};

const describeHit = ({ path, line, canary }: CanaryHit) =>
  `  ${path}:${line}  ${canary}`;

const check = async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      snapshot: { type: 'string', default: snapshotDirectory },
      curation: { type: 'string', default: curationDirectory },
      baseline: { type: 'string' },
      'update-baseline': { type: 'boolean', default: false },
      tracked: { type: 'boolean', default: false },
      exclude: { type: 'string', multiple: true, default: [] },
    },
  });
  const roots = positionals.length > 0 ? positionals : ['.'];
  const { fantasy } = (await loadCuration(values.curation)).games;
  const scan = canaryScanner(
    restrictedCanaries({
      ...(await loadSnapshot(values.snapshot)),
      fantasyCardText: fantasy ? Object.values(fantasy.text) : [],
    }),
  );
  const listed = values.tracked
    ? await tracked(roots)
    : (await Promise.all(roots.map(walked))).flat();
  const files = listed.filter(
    (path) => !values.exclude.some((prefix) => path.startsWith(prefix)),
  );
  const hits: CanaryHit[] = [];
  for (const path of files) {
    const contents = await readFile(path);
    if (!contents.includes(nulByte)) {
      hits.push(...scan(path, contents.toString('utf8')));
    }
  }
  console.log(
    `Scanned ${countOf(files.length, 'file')} for restricted content`,
  );

  if (values['update-baseline']) {
    if (!values.baseline) {
      throw new Error('--update-baseline needs --baseline <file>.');
    }
    const baseline = baselineOf(hits);
    await writeFile(values.baseline, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(
      `Wrote ${values.baseline}: ${countOf(Object.keys(baseline).length, 'file')} still carry restricted content`,
    );
    return;
  }

  const { unexpected, cleared } = compareToBaseline(
    hits,
    await readBaseline(values.baseline),
  );
  if (unexpected.length > 0) {
    console.error(
      `${countOf(unexpected.length, 'hit')} of restricted content, which must not be published:`,
    );
    console.error(unexpected.map(describeHit).join('\n'));
  }
  if (cleared.length > 0) {
    console.error(
      `${countOf(cleared.length, 'baselined canary', 'baselined canaries')} no longer appear, so the baseline can shrink:`,
    );
    console.error(
      cleared.map(({ path, canary }) => `  ${path}  ${canary}`).join('\n'),
    );
    console.error('Rerun with --update-baseline to record it.');
  }
  if (unexpected.length > 0 || cleared.length > 0) {
    process.exitCode = 1;
    return;
  }
  const baselined = hits.length;
  console.log(
    baselined > 0
      ? `No new restricted content · ${countOf(baselined, 'baselined hit')} left to clear`
      : 'No restricted content',
  );
};

await run(check);
