import { tmpdir } from 'node:os';
import { join } from 'node:path';
import SQLite from 'better-sqlite3';
import { type CompiledQuery, Kysely, SqliteDialect } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { armyDetail, fixtureSelection } from '../../test/fixtures/army.ts';
import { createAuth } from '../auth/auth.ts';
import { credentialProviderId } from '../auth/providers.ts';
import { bundlePaths } from '../data/bundle.ts';
import type { ReferencePack } from '../data/reference-pack.ts';
import type { TroopOptionId } from '../domain/army/army-list.ts';
import { createPhotoStore } from '../photos/store.ts';
import { sweepPhotos } from '../photos/sweep.ts';
import { hasPasswordCredential } from './accounts.ts';
import {
  activeUserSeries,
  type EventWindow,
  eventSeries,
  recordEvent,
  recordThrottledEvent,
  signInSeries,
  topCities,
  topCountries,
  topFilters,
  topPages,
} from './activity-events.ts';
import { sweepAnonymousUsers } from './anonymous.ts';
import {
  countArmies,
  deleteArmy,
  findArmy,
  insertArmy,
  listArmies,
} from './armies.ts';
import {
  deleteCollectionEntry,
  findCollectionEntry,
  insertCollectionEntry,
  listCollectionEntries,
} from './collection.ts';
import {
  collectionPhotoCovers,
  deleteCollectionPhoto,
  findCollectionPhoto,
  findPhotoSlot,
  insertCollectionPhoto,
  listCollectionPhotos,
  reorderCollectionPhotos,
} from './collection-photos.ts';
import { listArmyPins, pinEntry, unpinEntries } from './collection-pins.ts';
import { migrateToLatest } from './migrator.ts';
import {
  currentReferenceVersion,
  databaseBundleSource,
  importReferencePack,
  makeReferenceCurrent,
  sameReferenceDocument,
} from './reference.ts';
import type { Database } from './schema.ts';
import { countShares, findShare, insertShare } from './shares.ts';
import { usageTotals } from './usage-totals.ts';

const oauthProviderId = 'google';
const oauthAccountId = 'google-account-1';

let database: SQLite.Database;
let db: Kysely<Database>;
let recorded: CompiledQuery[];

const planOf = ({ sql, parameters }: CompiledQuery) =>
  database
    .prepare(`explain query plan ${sql}`)
    .all(...(parameters as unknown[]))
    .map((row) => (row as { detail: string }).detail)
    .join(' | ');

const planFor = (pattern: RegExp) => {
  const matched = recorded.find(({ sql }) => pattern.test(sql));
  if (!matched) {
    throw new Error(`no statement the app ran matched ${pattern}`);
  }
  return planOf(matched);
};

const plansFor = (pattern: RegExp) =>
  recorded.filter(({ sql }) => pattern.test(sql)).map(planOf);

const at = (day: number) => new Date(Date.UTC(2026, 8, day)).toISOString();

const owner = 'user-hannibal';

const anonymousBrowser = 'user-pyrrhus';

beforeEach(async () => {
  database = new SQLite(':memory:');
  database.pragma('foreign_keys = ON');
  recorded = [];
  db = new Kysely<Database>({
    dialect: new SqliteDialect({ database }),
    log: (event) => {
      if (event.level === 'query') {
        recorded.push(event.query);
      }
    },
  });
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values(
      ['hannibal', 'scipio', 'pyrrhus'].map((name, index) => ({
        id: `user-${name}`,
        name,
        email: `${name}@example.test`,
        image: null,
        isAnonymous: index === 2 ? 1 : 0,
        createdAt: at(1),
        updatedAt: at(1),
      })),
    )
    .execute();
  await db
    .insertInto('accounts')
    .values([
      {
        id: 'account-credential',
        userId: owner,
        accountId: owner,
        providerId: credentialProviderId,
        password: 'hashed',
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
      },
      {
        id: 'account-oauth',
        userId: owner,
        accountId: oauthAccountId,
        providerId: oauthProviderId,
        password: null,
        accessToken: 'token',
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: 'email profile',
      },
    ])
    .execute();
  await db
    .insertInto('verifications')
    .values([
      {
        id: 'verification-live',
        identifier: 'verify-email:hannibal@example.test',
        value: 'live',
        expiresAt: at(30),
      },
      {
        id: 'verification-stale',
        identifier: 'verify-email:scipio@example.test',
        value: 'stale',
        expiresAt: at(2),
      },
    ])
    .execute();
  recorded = [];
});

afterEach(async () => {
  await db.destroy();
});

const authFor = () =>
  createAuth({
    db,
    secret: 'a-test-secret-nobody-signs-anything-real-with',
    baseUrl: 'http://localhost:3013',
    limitRequests: false,
    socialProviders: {},
    sendEmail: () => Promise.resolve({ delivered: true, id: 'msg_1' }),
  });

describe('the paths a request takes', () => {
  it('resolves a session from its token without scanning sessions', async () => {
    const auth = authFor();
    const signedIn = await auth.api.signInAnonymous({ returnHeaders: true });
    expect(signedIn).toBeTruthy();
    const headers = new Headers({
      cookie: signedIn.headers
        .getSetCookie()
        .map((entry) => entry.split(';')[0])
        .join('; '),
    });
    recorded = [];

    await auth.api.getSession({ headers });

    expect(planFor(/from "sessions" where "sessions"\."token"/)).toContain(
      'SEARCH sessions USING INDEX sqlite_autoindex_sessions_2 (token=?)',
    );
    expect(planFor(/from "users" where "users"\."id"/)).toContain(
      'SEARCH users USING INDEX sqlite_autoindex_users_1 (id=?)',
    );
  });

  it('lists a player armies through the owner index', async () => {
    await listArmies(db, owner);

    expect(planFor(/select \* from "armies" where "user_id"/)).toContain(
      'SEARCH armies USING INDEX armies_user_id_updated_at (user_id=?)',
    );
  });

  it('counts a player armies without reading a row', async () => {
    await countArmies(db, owner);

    expect(planFor(/count\(\*\)/)).toContain(
      'SEARCH armies USING COVERING INDEX armies_user_id_updated_at (user_id=?)',
    );
  });

  it('finds one army by id and owner through the primary key', async () => {
    await findArmy(db, { id: 'army-1', userId: owner });

    expect(planFor(/where "id" = \? and "user_id" = \?/)).toContain(
      'SEARCH armies USING INDEX sqlite_autoindex_armies_1 (id=?)',
    );
  });

  it('lists a player collection through the owner index', async () => {
    await listCollectionEntries(db, owner);

    expect(
      planFor(/select \* from "collection_entries" where "user_id"/),
    ).toContain(
      'SEARCH collection_entries USING INDEX collection_entries_user_id_updated_at (user_id=?)',
    );
  });

  it('finds one collection entry by id and owner through the primary key', async () => {
    await findCollectionEntry(db, { id: 'entry-1', userId: owner });

    expect(
      planFor(/from "collection_entries" where "id" = \? and "user_id" = \?/),
    ).toContain(
      'SEARCH collection_entries USING INDEX sqlite_autoindex_collection_entries_1 (id=?)',
    );
  });

  it('finds a shared copy by its content id through the primary key', async () => {
    await findShare(db, 'nothinghere1');

    expect(planFor(/from "shares" where "id"/)).toContain(
      'SEARCH shares USING INDEX sqlite_autoindex_shares_1 (id=?)',
    );
  });

  it('counts what a browser has shared without reading a row', async () => {
    await countShares(db, anonymousBrowser);

    expect(planFor(/count\(\*\) as "shared"/)).toContain(
      'SEARCH shares USING COVERING INDEX shares_user_id (user_id=?)',
    );
  });

  it('looks an OAuth account up by provider and account id without scanning', async () => {
    const context = await authFor().$context;

    await context.internalAdapter.findAccountByKey({
      providerId: oauthProviderId,
      accountId: oauthAccountId,
    });

    expect(planFor(/"accounts"\."providerId"/)).toContain(
      'SEARCH accounts USING INDEX accounts_provider_id_account_id (providerId=? AND accountId=?)',
    );
  });

  it('checks for a password credential through the owner index', async () => {
    await hasPasswordCredential(owner, db);

    expect(planFor(/where "userId" = \? and "providerId"/)).toContain(
      'SEARCH accounts USING INDEX accounts_user_id (userId=?)',
    );
  });

  it('clears expired verifications by range, not by scanning them', async () => {
    const context = await authFor().$context;

    await context.internalAdapter.findVerificationValue(
      'verify-email:hannibal@example.test',
    );

    expect(
      planFor(/from "verifications" where "verifications"\."identifier"/),
    ).toContain(
      'SEARCH verifications USING INDEX verifications_identifier (identifier=?)',
    );
    expect(
      planFor(/delete from "verifications" where "verifications"\."expiresAt"/),
    ).toContain(
      'SEARCH verifications USING INDEX verifications_expires_at (expiresAt<?)',
    );
  });
});

describe('the nightly retention sweep', () => {
  beforeEach(async () => {
    await insertArmy(db, {
      id: 'army-1',
      userId: owner,
      name: 'Cannae',
      selection: fixtureSelection(),
      at: at(1),
    });
    await insertShare(db, {
      userId: anonymousBrowser,
      name: 'Cannae',
      selection: fixtureSelection(),
      at: at(1),
    });
    await insertCollectionEntry(db, {
      id: 'entry-1',
      userId: owner,
      name: 'Libyan spearmen',
      count: 8,
      troopType: 'SPR',
      tags: ['libyan'],
      status: 'painted',
      notes: '',
      at: at(1),
    });
    recorded = [];
  });

  it('reaches a swept user armies and sessions through their owner indexes', async () => {
    await sweepAnonymousUsers(db, { now: () => new Date(at(800)) });

    const plan = planFor(/where "isAnonymous" = \?/);
    expect(plan).toContain(
      'SEARCH armies USING INDEX armies_user_id_updated_at (user_id=?)',
    );
    expect(plan).toContain(
      'SEARCH sessions USING INDEX sessions_user_id (userId=?)',
    );
  });

  it('reads users itself with a scan, which is the plan we accepted', async () => {
    await sweepAnonymousUsers(db, { now: () => new Date(at(800)) });

    expect(planFor(/where "isAnonymous" = \?/)).toContain('SCAN users');
  });

  it('checks the armies of a deleted user through the leading user_id column', async () => {
    await sweepAnonymousUsers(db, { now: () => new Date(at(800)) });

    expect(planFor(/delete from "users"/)).toContain(
      'SEARCH armies USING COVERING INDEX armies_user_id_updated_at (user_id=?)',
    );
  });

  it('cascades to a deleted user collection through the leading user_id column', async () => {
    await sweepAnonymousUsers(db, { now: () => new Date(at(800)) });

    expect(planFor(/delete from "users"/)).toContain(
      'SEARCH collection_entries USING COVERING INDEX collection_entries_user_id_updated_at (user_id=?)',
    );
  });

  it('cascades to a deleted user collection photos through their owner index', async () => {
    await sweepAnonymousUsers(db, { now: () => new Date(at(800)) });

    expect(planFor(/delete from "users"/)).toContain(
      'SEARCH collection_photos USING COVERING INDEX collection_photos_user_id (user_id=?)',
    );
  });

  it('orphans the copies a deleted user shared through the author index', async () => {
    await sweepAnonymousUsers(db, { now: () => new Date(at(800)) });

    expect(planFor(/delete from "users"/)).toContain(
      'SEARCH shares USING COVERING INDEX shares_user_id (user_id=?)',
    );
  });

  it('finds the copies nobody has opened through the last seen index', async () => {
    await sweepAnonymousUsers(db, { now: () => new Date(at(800)) });

    expect(planFor(/delete from "shares"/)).toContain(
      'SEARCH shares USING COVERING INDEX shares_last_seen_at (last_seen_at<?)',
    );
  });
});

describe('collection photos', () => {
  beforeEach(async () => {
    await insertCollectionEntry(db, {
      id: 'entry-1',
      userId: owner,
      name: 'Libyan spearmen',
      count: 8,
      troopType: 'SPR',
      tags: ['libyan'],
      status: 'painted',
      notes: '',
      at: at(1),
    });
    await insertCollectionPhoto(db, {
      id: 'photo-1',
      entryId: 'entry-1',
      userId: owner,
      position: 0,
      width: 1600,
      height: 1200,
      bytes: 280_000,
      at: at(1),
    });
    recorded = [];
  });

  it('cascades a deleted entry to its photos through the entry index', async () => {
    await deleteCollectionEntry(db, { id: 'entry-1', userId: owner });

    expect(planFor(/delete from "collection_entries"/)).toContain(
      'SEARCH collection_photos USING COVERING INDEX collection_photos_entry_id_position (entry_id=?)',
    );
  });

  it('checks an upload against both limits through the entry and owner indexes', async () => {
    await findPhotoSlot(
      db,
      { entryId: 'entry-1', userId: owner },
      { perEntry: 6, perAccount: 200 },
    );

    expect(
      planFor(/from "collection_entries" where "id" = \? and "user_id" = \?/),
    ).toContain(
      'SEARCH collection_entries USING INDEX sqlite_autoindex_collection_entries_1 (id=?)',
    );
    expect(planFor(/max\("position"\)/)).toContain(
      'SEARCH collection_photos USING COVERING INDEX collection_photos_entry_id_position (entry_id=?)',
    );
    expect(
      planFor(
        /count\(\*\) as "photos" from "collection_photos" where "user_id"/,
      ),
    ).toContain(
      'SEARCH collection_photos USING COVERING INDEX collection_photos_user_id (user_id=?)',
    );
  });

  it('lists an entry photos in order through the entry index', async () => {
    await listCollectionPhotos(db, { entryId: 'entry-1', userId: owner });

    const plan = planFor(/select \* from "collection_photos" where "entry_id"/);
    expect(plan).toContain(
      'SEARCH collection_photos USING INDEX collection_photos_entry_id_position (entry_id=?)',
    );
    expect(plan).not.toContain('USE TEMP B-TREE');
  });

  it('finds every entry’s first photo through the owner index', async () => {
    await collectionPhotoCovers(db, owner);

    expect(
      planFor(
        /select "id", "entry_id", "position", "width", "height" from "collection_photos"/,
      ),
    ).toContain(
      'SEARCH collection_photos USING INDEX collection_photos_user_id (user_id=?)',
    );
  });

  it('finds, moves and deletes one photo by id and owner through the primary key', async () => {
    await findCollectionPhoto(db, { id: 'photo-1', userId: owner });
    await reorderCollectionPhotos(db, { entryId: 'entry-1', userId: owner }, [
      'photo-1',
    ]);
    await deleteCollectionPhoto(db, { id: 'photo-1', userId: owner });

    const primaryKey =
      'SEARCH collection_photos USING INDEX sqlite_autoindex_collection_photos_1 (id=?)';
    expect(
      planFor(
        /select \* from "collection_photos" where "id" = \? and "user_id"/,
      ),
    ).toContain(primaryKey);
    expect(planFor(/update "collection_photos"/)).toContain(primaryKey);
    expect(
      planFor(/delete from "collection_photos" where "id" = \?/),
    ).toContain(primaryKey);
  });

  it('reads every photo id with a scan, which the daily sweep accepts', async () => {
    await sweepPhotos(db, createPhotoStore(join(tmpdir(), 'triumph-absent')));

    expect(planFor(/select "id" from "collection_photos"/)).toContain(
      'SCAN collection_photos',
    );
  });

  it('deletes the rows the sweep found without files through the primary key', async () => {
    await sweepPhotos(db, createPhotoStore(join(tmpdir(), 'triumph-absent')));

    expect(planFor(/delete from "collection_photos"/)).toContain(
      'SEARCH collection_photos USING INDEX sqlite_autoindex_collection_photos_1 (id=?)',
    );
  });
});

describe('collection pins', () => {
  const pin = {
    option: 'main/0' as TroopOptionId,
    troopType: 'SPR' as const,
    entry: 'entry-1',
    count: 4,
  };

  const pins = { armyId: 'army-1', userId: owner };

  beforeEach(async () => {
    await insertArmy(db, {
      id: 'army-1',
      userId: owner,
      name: 'Cannae',
      selection: fixtureSelection(),
      at: at(1),
    });
    await insertCollectionEntry(db, {
      id: 'entry-1',
      userId: owner,
      name: 'Libyan spearmen',
      count: 8,
      troopType: 'SPR',
      tags: ['libyan'],
      status: 'painted',
      notes: '',
      at: at(1),
    });
    await pinEntry(db, pins, pin);
    recorded = [];
  });

  it('pins an entry after checking both owners through their primary keys', async () => {
    await pinEntry(db, pins, pin);

    const plan = planFor(/insert into "army_collection_pins"/);
    expect(plan).toContain(
      'SEARCH armies USING INDEX sqlite_autoindex_armies_1 (id=?)',
    );
    expect(plan).toContain(
      'SEARCH collection_entries USING INDEX sqlite_autoindex_collection_entries_1 (id=?)',
    );
  });

  it('reads and unpins a list pins through the leading army_id of the primary key', async () => {
    await listArmyPins(db, pins);
    await unpinEntries(db, pins, [pin]);

    const primaryKey =
      'SEARCH army_collection_pins USING INDEX sqlite_autoindex_army_collection_pins_1 (army_id=?';
    expect(
      planFor(/select \* from "army_collection_pins" where "army_id"/),
    ).toContain(primaryKey);
    expect(planFor(/delete from "army_collection_pins"/)).toContain(primaryKey);
  });

  it('cascades a deleted entry to its pins through the entry index', async () => {
    await deleteCollectionEntry(db, { id: 'entry-1', userId: owner });

    expect(planFor(/delete from "collection_entries"/)).toContain(
      'SEARCH army_collection_pins USING COVERING INDEX army_collection_pins_entry_id (entry_id=?)',
    );
  });

  it('cascades a deleted list to its pins through the primary key', async () => {
    await deleteArmy(db, { id: 'army-1', userId: owner });

    expect(planFor(/delete from "armies"/)).toContain(
      'SEARCH army_collection_pins USING COVERING INDEX sqlite_autoindex_army_collection_pins_1 (army_id=?)',
    );
  });
});

describe('reference data', () => {
  const dataVersion = '2026-09-17.a1b2c3d4';

  const armyFile = {
    path: bundlePaths.army('army-1'),
    eager: false,
    contents: armyDetail(),
  };

  const pack: ReferencePack = {
    dataVersion,
    source: 'https://meshwesh.example.test',
    builtAt: at(1),
    locales: { en: [armyFile], es: [armyFile] },
  };

  beforeEach(async () => {
    await importReferencePack(db, pack, { now: () => new Date(at(2)) });
    recorded = [];
  });

  it('reads the current version through its primary key', async () => {
    await currentReferenceVersion(db);

    expect(planFor(/from "reference_current" where "id"/)).toContain(
      'SEARCH reference_current USING INTEGER PRIMARY KEY (rowid=?)',
    );
  });

  it('reads one file of one version and locale through the primary key', async () => {
    await databaseBundleSource(db, 'es').readArmyDetail('army-1');

    expect(planFor(/from "reference_documents"/)).toContain(
      'SEARCH reference_documents USING INDEX sqlite_autoindex_reference_documents_1 (data_version=? AND locale=? AND path=?)',
    );
  });

  it('compares one file across two versions through the primary key', async () => {
    await sameReferenceDocument(db, {
      path: bundlePaths.army('army-1'),
      from: dataVersion,
      to: '2026-10-09.0badf00d',
    });

    const plan = planFor(/from "reference_documents" as "before"/);
    expect(plan).toContain(
      'SEARCH before USING INDEX sqlite_autoindex_reference_documents_1 (data_version=? AND locale=? AND path=?)',
    );
    expect(plan).toContain(
      'SEARCH after USING INDEX sqlite_autoindex_reference_documents_1 (data_version=? AND locale=? AND path=?)',
    );
  });

  it('checks a version before making it current through its primary key', async () => {
    await makeReferenceCurrent(db, dataVersion);

    expect(planFor(/from "reference_versions" where "data_version"/)).toContain(
      'SEARCH reference_versions USING COVERING INDEX sqlite_autoindex_reference_versions_1 (data_version=?)',
    );
  });
});

describe('the admin stats', () => {
  const windows: EventWindow[] = [
    { range: { from: at(1), to: at(30) }, audience: 'all' },
    { range: { from: at(1), to: at(30) }, audience: 'anonymous' },
  ];

  beforeEach(async () => {
    await recordEvent(db, {
      event: { kind: 'list.created' },
      actor: { userId: owner, isAnonymous: false },
      subjectId: 'army-1',
      origin: {
        ip: '203.0.113.7',
        location: { country: 'TN', region: 'Tunis', city: 'Carthage' },
      },
      now: () => at(20),
    });
    recorded = [];
  });

  it('looks for a recent event to throttle through the kind and time index', async () => {
    await recordThrottledEvent(
      db,
      {
        event: { kind: 'list.edited' },
        actor: { userId: owner, isAnonymous: false },
        subjectId: 'army-1',
        origin: { ip: null, location: null },
        now: () => at(20),
      },
      10 * 60 * 1000,
    );

    expect(planFor(/select "id" from "activity_events"/)).toContain(
      'SEARCH activity_events USING INDEX activity_events_kind_occurred_at_is_anonymous (kind=? AND occurred_at>?)',
    );
  });

  it('counts one kind over a range without reading a row', async () => {
    for (const window of windows) {
      await eventSeries(db, {
        ...window,
        kind: 'list.created',
        bucket: 'week',
      });
    }

    const plans = plansFor(/count\(\*\) as "events" from "activity_events"/);
    expect(plans).toHaveLength(windows.length);
    for (const plan of plans) {
      expect(plan).toContain(
        'SEARCH activity_events USING COVERING INDEX activity_events_kind_occurred_at_is_anonymous (kind=? AND occurred_at>? AND occurred_at<?)',
      );
    }
  });

  it('counts active players over a range without reading a row', async () => {
    for (const window of windows) {
      await activeUserSeries(db, { ...window, bucket: 'day' });
    }

    const plans = plansFor(/count\(distinct "user_id"\)/);
    expect(plans).toHaveLength(windows.length);
    for (const plan of plans) {
      expect(plan).toContain(
        'SEARCH activity_events USING COVERING INDEX activity_events_occurred_at_is_anonymous_user_id (occurred_at>? AND occurred_at<?)',
      );
    }
  });

  it('ranks countries and cities over a range through the time index', async () => {
    for (const window of windows) {
      await topCountries(db, { ...window, limit: 10 });
      await topCities(db, { ...window, limit: 10 });
    }

    const plans = plansFor(/select "country"/);
    expect(plans).toHaveLength(windows.length * 2);
    for (const plan of plans) {
      expect(plan).toContain(
        'SEARCH activity_events USING INDEX activity_events_occurred_at_is_anonymous_user_id (occurred_at>? AND occurred_at<?)',
      );
    }
  });

  it('splits sign-ins by method through the kind index', async () => {
    for (const window of windows) {
      await signInSeries(db, { ...window, bucket: 'day' });
    }

    const plans = plansFor(/json_extract\(props, '\$\.method'\) as "method"/);
    expect(plans).toHaveLength(windows.length);
    for (const plan of plans) {
      expect(plan).toContain(
        'SEARCH activity_events USING INDEX activity_events_kind_occurred_at_is_anonymous (kind=? AND occurred_at>? AND occurred_at<?)',
      );
    }
  });

  it('ranks pages and filters over a range through the kind index', async () => {
    for (const window of windows) {
      await topPages(db, { ...window, limit: 10 });
      await topFilters(db, { ...window, limit: 10 });
    }

    const plans = plansFor(
      /json_extract\(props, '\$\.(route|key)'\) as "(route|key)"/,
    );
    expect(plans).toHaveLength(windows.length * 2);
    for (const plan of plans) {
      expect(plan).toContain(
        'SEARCH activity_events USING INDEX activity_events_kind_occurred_at_is_anonymous (kind=? AND occurred_at>? AND occurred_at<?)',
      );
    }
  });

  it('counts the totals by reading each table once, which a dashboard accepts', async () => {
    await usageTotals(db, 'all');

    expect(
      Object.fromEntries(
        ['users', 'armies', 'shares', 'collection_entries'].map((table) => [
          table,
          planFor(new RegExp(`from "${table}"`)),
        ]),
      ),
    ).toEqual({
      users: 'SCAN users',
      armies:
        'SCAN armies USING COVERING INDEX armies_user_id_updated_at | SEARCH users USING INDEX sqlite_autoindex_users_1 (id=?)',
      shares:
        'SCAN shares USING COVERING INDEX shares_user_id | SEARCH users USING INDEX sqlite_autoindex_users_1 (id=?) LEFT-JOIN',
      collection_entries:
        'SCAN collection_entries USING COVERING INDEX collection_entries_user_id_updated_at | SEARCH users USING INDEX sqlite_autoindex_users_1 (id=?)',
    });
  });
});
