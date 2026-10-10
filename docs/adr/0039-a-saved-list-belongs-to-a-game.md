# 0039 — A saved list belongs to a game, and each game owns its selection shape

- **Status:** Accepted
- **Date:** 2026-10-09
- **Related:** #13, #4, #5, #7, ADR [0002](0002-warn-dont-block.md), ADR
  [0003](0003-one-data-version-per-army.md), ADR [0010](0010-share-codes-are-base64url-json.md),
  ADR [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md),
  `docs/DOMAIN.md` §4

## Context

Everything the app saves, shares, prints and covers is a Triumph! list: `armies.army_list_id` and
`shares.army_list_id` are `NOT NULL`, `ArmySelection` starts with an `army`, a `year` and a
`variant`, the builder lives under `/armies/<armyListId>/build`, the sheet route is
`/api/armies/<armyListId>/sheet`, the share code is the selection and nothing else, and
`triumphRules = { pointsCap: 48 }` is the only thing that knows there is a ruleset at all.

Fantasy Triumph (#13) is a second game on the same engine. It keeps the 26 troop types, their costs
and factors, but has **no army lists**: a player fields any troop types in any numbers, names the
units, adds up to three heroes, and buys from a different set of 39 battle cards whose costs depend
on the troop type, the home topography and a variant chosen at purchase. It is built to 51 points
by default and the rulebook allows other totals. Its invasion rating, manoeuvre rating and home
topography are chosen and paid for, not read from a list. Washington Grand Company have given
permission for its card content to ship.

Grand Triumph (#7) and an arbitrary cap (#5) are further formats of the Triumph! game, and the
open-list idea (#4) is a third game that Fantasy Triumph largely replaces. None of them fits in
`ArmySelection` without making every field that is mandatory today optional.

## Decision

A **game** is a first-class concept: a closed enum, `'triumph' | 'fantasy'` to start. A saved list,
a share and a share code carry their game, and the selection JSON is a discriminated union keyed on
it. The Triumph! branch is `ArmySelection` unchanged; `army_list_id` becomes nullable and is `NULL`
for every game that has no army list. Existing rows default to `'triumph'` in the migration.

Each game is a module under `lib/domain/<game>/` that owns its selection schema, its points engine,
its validator, its sheet data and its share canonicalisation, and exposes them through one
`GameModule` shape, collected in a registry under `lib/domain/games/`. A generic surface — the
saved-lists table, the builder route, the sheet route, the text exports, the share page, the saved
view and collection coverage — reaches a game's behaviour through one dispatch point that switches
on the list's `game`: `listSheet`, `listText`, `listSheetDocument`, `readGameData`,
`SharedListView`. The switches are exhaustive, so a new game fails to compile until every one of
them handles it; a surface never re-derives a game's rules. What is shared lives outside the game
modules: troop types, findings and their severities, the points meter contract, the sheet renderer
and the coverage solver, which only needs demands matched by troop type or, for a hero, by name.

The reference pack gains a per-game section. Troop types stay one shared collection; a game may
overlay display names on them (Fantasy Triumph calls Archers *Shooters* and Elephants *Behemoths*)
and carries its own battle card catalogue, costs, selection constraints and rules text, all curated
in the data repo under ADR 0035 and translated the same way.

Every game's builder follows one URL pattern, `/<game>/build?list=<id>`: `/triumph/build?list=<id>`
and `/fantasy/build?list=<id>`. The existing `/armies/<armyListId>/build` keeps working as the
entry from an army page and for every saved or bookmarked Triumph! link, and resolves to the same
builder. The sheet route becomes `/api/lists/sheet?s=<code>` with the game inside the code, and the
old `/api/armies/<armyListId>/sheet` stays as an alias. No URL the app has ever minted stops
working.

## Alternatives considered

- **A mode flag that relaxes validation.** Fantasy Triumph is not Triumph! with the list rules
  switched off: different cards, different cost model, heroes, a different general rule. A flag
  would leave every Triumph! field optional and every reader checking it.
- **One generic selection for every game** — units of troop type plus cards, with Triumph! troop
  options mapped onto it. The Triumph! model is load-bearing: contingent groups, per-option bounds,
  gating by year and variant, whole-entry cards. Flattening it would re-derive all of
  `docs/DOMAIN.md` §3–§6 from the other side.
- **A second table and a second app surface.** Keeps the Triumph! path untouched, but doubles the
  saved-lists page, the share store, retention, pins and the exports, each of which only needs to
  know the game to dispatch.
- **Only the new game gets a game-named route.** Leaves two URL shapes for one concept and makes
  the army-list id look load-bearing when it is only an entry point.

## Consequences

- One migration: `game` on `armies` and `shares`, `army_list_id` nullable. The share codec version
  bumps so an old code without a game decodes as Triumph! (ADR 0010).
- Nothing that exists today stops working. The stored selection JSON of every current row has no
  game in it, so the column is the discriminator and the JSON is parsed with the branch the column
  names, never rewritten. The share decoder accepts the old and the new code version for good,
  because codes already copied carry the old one. The pack's per-game section is optional: a pack
  without it imports, and a game whose section is missing is simply not offered, so the pinned pack
  keeps working until the data lands and a rollback to an older pack still imports. The create and
  share inputs default the game to Triumph! so a tab opened before a deploy still saves. The only
  one-way step is the migration itself once a list without an army list exists; rolling back past
  it means restoring the pre-deploy backup.
- The first stage ships with Triumph! as the only member of the registry and changes no behaviour:
  the golden exports, the e2e journeys and every existing test pass unchanged, which is the proof
  the seams are in the right place. New Triumph! links are minted under `/triumph/build` from then
  on; old ones keep resolving.
- A new game is a module, a pack section, a builder and its messages, not a change to the generic
  surfaces. Open lists (#4) become a cheap third game if anyone still wants them once Fantasy
  Triumph exists.
- The data version a list pins (ADR 0003) now covers the game's card catalogue too, which matters
  because Fantasy Triumph is an early-access rulebook whose costs may change between editions.
- Buildable armies and the army index remain Triumph!-only because they depend on army lists.
  Coverage of a Fantasy Triumph list is a demand per unit matched on troop type and on the name
  and tags the player typed, plus a demand per hero matched on name and tags alone (ADR 0040).

## Revisit trigger

A third game whose shared surface wants something the `GameModule` shape does not expose, or Grand
Triumph (#7) needing a list to hold several commands, at which point the union gains a format
dimension rather than a third game.
