# 0007 — SQLite on a local volume, with Kysely

- **Status:** Accepted
- **Date:** 2026-09-17
- **Related:** #38, #43, #45

## Context

What we store is small and simple: Better Auth's `users`, `sessions`, `accounts` and
`verifications`, plus an `armies` table holding an owner, a name, a list reference, a selection blob
and the `dataVersion` it was built against (ADR [0003](0003-one-data-version-per-army.md)).

Everything expensive — availability resolution, the points engine, validation — is pure computation
over a static snapshot in the domain layer, not queries. The database is a filing cabinet, not the
product.

The deployment is a single container on a single host (ADR
[0006](0006-self-hosted-single-container.md)), which already gives us exactly one writer.

## Decision

SQLite via `better-sqlite3`, one file at `DATABASE_URL=/data/db.sqlite` on the container's volume,
with Kysely for typed queries and migrations (#38).

Queries stay ordinary SQL through Kysely — no ORM, no query abstraction layer of our own — so the
schema is legible and moving to Postgres later is a dialect change rather than a rewrite.

## Alternatives considered

- **Postgres in a second container.** The obvious default, and it doubles the moving parts,
  the backup story and the local setup for a workload that is a few thousand rows.
- **A hosted database (Turso, Neon, Supabase).** Adds a vendor, a network hop and a bill, and takes
  the data out of the volume that the homelab already backs up.
- **An ORM (Prisma, Drizzle).** Prisma's engine is heavy for this; the value of either is mostly in
  migrations, which Kysely does adequately.

## Consequences

- One writer, no horizontal scaling. This is the same constraint ADR
  [0006](0006-self-hosted-single-container.md) already accepts, and the two must be revisited
  together.
- Backups are volume backups. There is no point-in-time recovery, so the volume must actually be in
  the homelab's backup set — and `docker compose down -v` destroys the database.
- `better-sqlite3` is a native module: the image's dependency stage needs `python3`, `make` and
  `g++`, and the build stays pinned to the Node version the runner uses.
- Synchronous queries. Fine at this scale, and a genuine hazard if any request ever does something
  long-running against the database — that work belongs elsewhere.
- Tests get a real database cheaply: an in-memory or temp-file SQLite instance per suite, no
  container, no fixtures server.
- WAL mode and a busy timeout should be set explicitly at connection time rather than inherited by
  accident.

## Revisit trigger

Concurrent-write contention showing up as busy timeouts, a need to run more than one app process,
or storage growing past what a single file and a volume snapshot handle comfortably.
