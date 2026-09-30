# 0001 — Vendor a build-time Meshwesh snapshot instead of calling the API at runtime

- **Status:** Accepted · shipping the snapshot with the app superseded by [0034](0034-reference-data-lives-in-sqlite-served-over-trpc.md)
- **Date:** 2026-09-17
- **Related:** #12, #13, #17, #18, `docs/DOMAIN.md` §1, §8

## Context

All army list data comes from the public Meshwesh API (`https://meshwesh.wgcwar.com/api/v1/`):
656 army lists, 727 ally lists, 27 battle cards, 26 troop types, 40 thematic categories.

Three properties of that API decide this:

- **No CORS headers.** The browser cannot call it directly. Any runtime use means proxying every
  read through our own server.
- **Enemies are per-army only.** There is no bulk endpoint, so a complete picture costs 656
  requests against someone else's hobby-scale server.
- **Lists are revised over time**, with no versioning, no changelog and no ETag discipline we can
  rely on. Shape drift and content drift both arrive silently.

The app must also work offline (#50): club venues have bad wifi, and the builder is used standing
at a table.

## Decision

Fetch upstream data at build time with `scripts/sync-meshwesh.ts`, commit the result to
`data/snapshot/*.json` with a `manifest.json` recording the fetch timestamp and a content hash, and
ship that snapshot with the app. Nothing in the running application — server or client — ever
calls Meshwesh.

Upstream changes reach us through the scheduled refresh workflow (#18), which re-runs the sync and
opens a pull request when the hash changes. Upstream revisions therefore arrive as a reviewable
diff, and every schema violation fails our build (#13) rather than a user's session.

## Alternatives considered

- **Server-side proxy with a cache.** Solves CORS, keeps data fresh. Rejected: it makes our
  availability depend on theirs, puts our traffic on a volunteer-run server, and still needs a
  vendored fallback for offline use — so it is the snapshot plus a proxy, not instead of one.
- **Client fetch.** Impossible today (no CORS) and undesirable anyway: 2.3 MB of army lists per
  visitor.
- **Periodic sync into our own database.** Same freshness as the snapshot, but upstream changes
  land unreviewed in production and the data is no longer in git where it can be diffed and blamed.

## Consequences

- Data is only as fresh as the last merged sync PR. Acceptable: army lists change on the scale of
  months, and a deliberate human diff is a feature, given #13 fails the build on shape drift.
- We are responsible for the payload budget (#17): the raw snapshot is ~2.6 MB, so the client gets
  a compact index eagerly and per-army detail lazily, under 150 KB gzipped for the initial route.
- Offline reading (#50) and PWA caching become straightforward — the data is a static asset.
- The snapshot is the audit trail. The curated overlays (battle card costs, sub-factions) cite the
  `mdText` lines they were derived from, so a refresh diff shows exactly what needs re-auditing.
- We carry a hard dependency on Meshwesh remaining publicly readable at build time. If it
  disappears, the committed snapshot keeps the app working indefinitely.

## Revisit trigger

Meshwesh starts sending CORS headers **and** offers bulk enemy data, or upstream revisions become
frequent enough that merging sync PRs is a chore rather than an event.
