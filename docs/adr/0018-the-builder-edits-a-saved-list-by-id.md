# 0018 — The builder edits a saved list named by `?list=`

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** #45, ADR [0012](0012-builder-gating-in-the-url-selection-in-state.md)

## Context

ADR [0012](0012-builder-gating-in-the-url-selection-in-state.md) kept the builder's gating in the
URL and its selection in component state, and named its own revisit trigger: *#44 gives an army a
home: the builder then edits a saved list by id, the year and the variant belong to that record,
and the URL becomes a deep link into it rather than the state itself.* #44 landed, #45 lists what it
saved, and every row needs somewhere to lead.

There is one builder route, `/armies/<armyListId>/build`, prerendered from the eager index and
crawled. A saved list is a row under a different id, owned by a caller, and readable only through
`army.byId`.

## Decision

`?list=<savedArmyId>` on the builder route is the deep link into a saved list. With it,
`ArmyBuilder` reads the record through `army.byId`, seeds the draft from `selection`, and the save
control writes back to that id. Without it, the builder opens the same way it always has.

The gating stays where ADR 0012 put it, with the record behind it: `useBuilderGating` reads
`?year=` and `?variant=` first and falls back to the saved selection's year and variant, so opening
a list reproduces the year it was built at without writing two keys into the address bar, and a
link that names a year still wins over the record.

Saving a new list replaces the URL with its `?list=`, so the page the player is on becomes the page
that edits what they just saved.

## Alternatives considered

- **A route of its own, `/my-armies/<id>`.** A second builder route to keep in step with the first,
  and a page that cannot be prerendered from the bundle because the army list it needs is only
  known after a query the crawler cannot make.
- **Writing the year and variant into the URL when a list opens.** Two keys rewritten on load,
  a history entry nobody asked for, and a share link that carries someone else's list id next to
  the gating.
- **Loading the record into the builder without the id in the URL.** A reload then loses the list,
  which is exactly what the record was for.

## Consequences

- The builder waits for two loads, not one, when `?list=` is set — the bundle and the record — and
  says which of the two failed.
- A `?list=` the caller does not own is a `NOT_FOUND` from `army.byId` and reads as *That saved
  list could not be opened*, never as an empty builder.
- Share links (#46) now have two things in the address bar to reconcile: this key and whatever the
  share code turns out to be. A share link is not a list id and must not be read as one.

## Revisit trigger

#46 needs the full selection in the address bar for anonymous sharing, or a saved list needs to be
readable by someone who does not own it — at which point `?list=` is no longer only a pointer to a
row of the caller's.
