# 0019 — Sort, filter and search saved armies in the app, not in SQLite

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** #110, #45, ADR [0007](0007-sqlite-on-a-volume.md)

## Context

My Armies (#45) offers six sort columns — name, army, points, status, created, updated — and a
search box. Two of those columns are not columns at all:

- **Points** come from `armyPoints` in `lib/domain/army/points.ts`, over the `selection` blob and
  the troop-type costs in the client bundle.
- **Status** — legal, and how many errors and warnings — comes from `validationReport`, over the
  same blob and the army list built from the bundle.

Neither can be indexed, because neither is stored. Both are functions of a row *and* of a snapshot
that lives outside the database (ADR [0001](0001-snapshot-over-live-api.md)), and a stored copy
would be wrong the moment a rebuilt bundle changed a cost — which is exactly what
`armies.data_version` exists to admit (ADR [0003](0003-one-data-version-per-army.md)).

Search is the same story from the other end. It matches the list's *army list name* as well as its
own name, and the army list name comes from the bundle, not from any column. It also folds
diacritics and matches each whitespace-separated term independently (`lib/domain/text-search.ts`),
so it is not `like '%…%'` even in principle — and `like '%…%'` would not use an index if it were.

What makes all of this affordable is scale. These are a player's own lists: anonymous browsers are
capped at 20 (`anonymousArmyLimit`), and a signed-in player accumulates tens, not thousands. #110
measured the one query that serves the page — `select * from armies where user_id = ? order by
updated_at desc, id desc` — as a `SEARCH` on `armies_user_id_updated_at` against ~12k rows.

## Decision

`army.list` returns a player's whole list, unpaginated and ordered most-recent-first, and the
client does the rest: `useSavedArmyEntries` computes points and standing per row from the bundle,
`searchSavedArmies` filters, and TanStack Table sorts. The sort and the search live in the URL
(`?sort=`, `?dir=`, `?q=`), not in the request to the server.

The database serves exactly one ordering — most recent first — and `armies_user_id_updated_at` is
the index for it. No index is added for points, status or name search, now or later.

## Alternatives considered

- **Store points and legality as columns, maintained on write.** They would be stale against any
  rebuilt bundle, and the writer would have to load the bundle to compute them — putting the
  domain layer's work on the write path, in the one process that is also the only writer (ADR
  [0007](0007-sqlite-on-a-volume.md)).
- **FTS5 over `armies.name`.** A second virtual table and its triggers, to search tens of rows per
  player that the client already holds in memory. It would also still miss the army list name,
  which is not in the database at all.
- **`armies(user_id, name)` for a server-side name sort.** A second index on the fastest-growing
  table so that SQLite can order a list the client has already downloaded.
- **Paginate `army.list`.** Pagination is what would force sorting and filtering back onto the
  server, and it buys nothing at twenty rows.

## Consequences

- The page's cost is one indexed query plus one bundle fetch per distinct army list, and every
  further interaction — sorting, searching, re-sorting — is free and instant.
- Points and status are computed for every saved list on load, not for the visible page. At tens
  of lists this is unmeasurable; at thousands it would not be.
- Sorting by points is only meaningful once the bundle has loaded, which is why the table has a
  pending state for standing rather than a zero.
- A future "search across all players' lists" feature would share nothing with this and would need
  its own decision.

## Revisit trigger

A player's saved list count reaching the low hundreds — whether because the cap is lifted, or
because a real player is observed there — or My Armies growing a view that spans more players than
the one asking.
