# 0028 — Creating a list is the explicit act, and keeping it is automatic

- **Status:** Accepted
- **Date:** 2026-09-21
- **Related:** #52, ADR [0017](0017-saving-is-an-explicit-act.md), ADR
  [0018](0018-the-builder-edits-a-saved-list-by-id.md), ADR
  [0023](0023-a-new-list-is-born-named.md)

## Context

ADR [0017](0017-saving-is-an-explicit-act.md) made a row the result of pressing **Save**, and
rejected autosave on one ground: `/armies/<id>/build` is one of 656 prerendered, crawled pages, and
tapping a stepper there is browsing, not saving. Every hygiene measure #44 raised — the per-IP limit
on `/sign-in/anonymous`, the 20-list cap, the retention sweep — is sized on a row meaning a player
meant to keep something.

That ground still holds. What 0017 also left standing is the cost it named in its own consequences:
*an unsaved list is still lost on reload*. A builder used standing at a table, on club wifi, with a
phone that backgrounds the tab, asks a player to remember a button for work they have already
decided to do. Nothing in the ADR argued that pressing **Save** a second, third and tenth time
carries intent — only that the first row does.

The two halves of the act can be separated. **New list** on the army detail page is already a
deliberate press, made before any browsing has happened, on a page that is *about* one army.

## Decision

**New list** creates the row. It is a mutation rather than a link, wherever it appears — on an
army's page, and on My Armies through the picker #148 added. `useStartList` is the one act behind
both: it writes a record named by `defaultListName` and seeded with `startBuilding`, then routes to
`?list=<id>` (ADR [0018](0018-the-builder-edits-a-saved-list-by-id.md)). An anonymous player's
session is minted there, on a press, exactly as 0017 required. Two controls carrying that name and
meaning different things would be worse than either rule alone, so the picker's matches are buttons
rather than links into a draft.

With `?list=` set, the builder keeps the record in step by itself. `useAutosave` writes on the
leading edge of a change and again on the trailing edge of `autosaveQuietMs` of quiet, one write in
flight at a time, and flushes on `pagehide`, on `visibilitychange` to hidden, and when the builder
unmounts. What counts as a change is what 0017's button asked: the trimmed name next to
`encodeSelection` of the selection. The **Save** button is replaced by a status — *Saving…*,
*Saved*, or *Not saved — retry* as a button that writes again.

Without `?list=` the builder is still a draft and still carries **Save**, because a crawled deep
link, a bookmark or a share is exactly the arrival 0017 was protecting. That button is the one
remaining way a row is born from the builder, and once it has fired, autosave takes over.

## Alternatives considered

- **Autosave from the first real edit, no button anywhere.** 0017 rejected this and the reason is
  unchanged: it mints a record from browsing, spends the anonymous budget on lists nobody chose,
  and leaves a player unable to say *not this one*. It also has to rule that a `?year=` folded into
  the selection by `withGating` is not an edit, or a shared link writes a row on load.
- **A draft that survives reload in `localStorage`, with the row still explicit.** 0017 named this
  as its own likely answer. It is smaller, but it puts a second store of record next to SQLite,
  which ADR [0013](0013-anonymous-armies-in-sqlite.md) refused, and it does not help the player who
  builds on a phone and opens the list on a laptop.
- **Keeping **Save** and autosaving alongside it.** Two affordances for one act, and the button
  then means *save now* — which is what the debounce already promises within a second.

## Consequences

- The detail page's header action is a client island, so the page pays for a mutation's pending and
  failure states where it used to render a link. A cap reached (`signInToKeepMore`) is a toast
  there, translated through `useErrorMessage`, rather than a wall in the builder.
- **New list** is now a write, so it mints an anonymous session, fires the *Saved within your
  browser* notice and arms the install drawer through `recordListSaved` before a single stand has
  been taken. That is the moment the row exists, which is what all three are about.
- Typing in the header title renames the row a second later. ADR
  [0023](0023-a-new-list-is-born-named.md)'s *nothing renames a row on a keystroke* no longer holds
  for a saved list; it still holds for a draft, which has no row to rename.
- A `?list=` opened with a `?year=` beside it now writes that year into the record, where before it
  only re-gated the screen. The year is part of the selection and the year control writes the URL,
  so this is the same act as moving the slider — but a link carrying both keys is no longer a
  read-only view of someone's list.
- Every write invalidates `army.*` through `cache.settle`, so an autosave costs a refetch of
  `army.byId` and `army.list` on top of the mutation. Bounded by the quiet window, not by
  keystrokes.
- A flush on the way out sends the newest payload even when a write is already in flight, so the
  older one can land last and leave the record a step behind. The window is one request against a
  page that is closing, and the next edit corrects it.
- `pagehide` carries no `keepalive` transport, so a hard close inside the quiet window can still
  lose the tail. #52 is where that is answered for good, and this decision is the use case it was
  deferred behind: a builder that writes on its own over club wifi is the queue's reason to exist.

## Revisit trigger

Anonymous rows growing faster than lists with stands in them — **New list** would then be a press
people make to look rather than to keep, and creation has to move back behind the first real edit.
Or #52 landing, at which point the debounce and the flush are the queue's front end and belong to
it rather than to this hook.
