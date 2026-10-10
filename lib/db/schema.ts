import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely';
import type {
  CollectionEntryKind,
  CollectionStatus,
} from '../domain/collection/entry.ts';

type Timestamp = ColumnType<string, string | undefined, string>;

export type UsersTable = {
  id: string;
  name: string;
  email: string;
  emailVerified: Generated<number>;
  image: string | null;
  isAnonymous: Generated<number | null>;
  locale: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type SessionsTable = {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AccountsTable = {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scope: string | null;
  password: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type VerificationsTable = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ArmiesTable = {
  id: string;
  user_id: string;
  name: string;
  game: Generated<string>;
  army_list_id: string | null;
  selection: string;
  data_version: string;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type SharesTable = {
  id: string;
  user_id: string | null;
  name: string;
  game: Generated<string>;
  army_list_id: string | null;
  selection: string;
  data_version: string;
  created_at: Timestamp;
  last_seen_at: string;
};

export type CollectionEntriesTable = {
  id: string;
  user_id: string;
  name: string;
  count: number;
  kind: Generated<CollectionEntryKind>;
  troop_type: string | null;
  tags: string;
  games: Generated<string>;
  status: CollectionStatus;
  notes: string;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CollectionPhotosTable = {
  id: string;
  entry_id: string;
  user_id: string;
  position: number;
  width: number;
  height: number;
  bytes: number;
  created_at: Timestamp;
};

export type ArmyCollectionPinsTable = {
  army_id: string;
  troop_option: string;
  troop_type: string;
  entry_id: string;
  count: number;
};

export type ReferenceVersionsTable = {
  data_version: string;
  source: string;
  built_at: string;
  imported_at: string;
};

export type ReferenceCurrentTable = {
  id: number;
  data_version: string;
};

export type ReferenceDocumentsTable = {
  data_version: string;
  locale: string;
  path: string;
  body: string;
};

export type ActivityEventsTable = {
  id: Generated<number>;
  occurred_at: string;
  kind: string;
  user_id: string | null;
  is_anonymous: number;
  subject_id: string | null;
  props: string;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

export type Database = {
  users: UsersTable;
  sessions: SessionsTable;
  accounts: AccountsTable;
  verifications: VerificationsTable;
  armies: ArmiesTable;
  shares: SharesTable;
  collection_entries: CollectionEntriesTable;
  collection_photos: CollectionPhotosTable;
  army_collection_pins: ArmyCollectionPinsTable;
  reference_versions: ReferenceVersionsTable;
  reference_current: ReferenceCurrentTable;
  reference_documents: ReferenceDocumentsTable;
  activity_events: ActivityEventsTable;
};

export type Share = Selectable<SharesTable>;
export type NewShare = Insertable<SharesTable>;

export type Army = Selectable<ArmiesTable>;
export type NewArmy = Insertable<ArmiesTable>;
export type ArmyUpdate = Updateable<ArmiesTable>;

export type CollectionEntryRow = Selectable<CollectionEntriesTable>;

export type CollectionPhotoRow = Selectable<CollectionPhotosTable>;
export type NewCollectionPhotoRow = Insertable<CollectionPhotosTable>;

export type ArmyCollectionPinRow = Selectable<ArmyCollectionPinsTable>;

export type ReferenceVersionRow = Selectable<ReferenceVersionsTable>;

export type ActivityEventRow = Selectable<ActivityEventsTable>;
