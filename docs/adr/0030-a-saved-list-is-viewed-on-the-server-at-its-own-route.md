# 0030 — A saved list is viewed on the server, at `/my-armies/<id>`

- **Status:** Accepted
- **Date:** 2026-09-23
- **Related:** #171, ADR [0018](0018-the-builder-edits-a-saved-list-by-id.md), ADR
  [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md)

## Context

A saved list opened only in the builder, so looking at your own list meant looking at an editor,
one stray tap from changing it. The only read-only view was the shared one at `/s/<id>`, and
reaching it meant minting a share link, which is a frozen copy rather than the list itself.

ADR 0018 turned down `/my-armies/<id>` *for the builder*, because the builder is prerendered from
the bundle and a saved list's army is only known after a query the crawler cannot make. A view
does not have that constraint: `/s/<id>` is already rendered on demand, from one loader that takes
its database and its bundle as parameters.

## Decision

A saved list has a read-only view at `/my-armies/<id>`, rendered on the server by the same
`SharedListView` the share page uses. `loadSavedView` reads the row with `findArmy`, so ownership
is the `where user_id = ?` on the statement. The page takes the caller from the session cookie,
anonymous or not. With no session, or a row that is not the caller's, the page is a 404.

`sharedView` and `savedView` in `lib/domain/army/shared-view.ts` assemble one `ListView`, tagged
with its `kind`. Only the share page carries a badge, *Shared copy*, because a copy is the one that
stops following its author's edits; a saved list's own view needs no badge to say it is yours, and
says instead, in a closing line, that it follows its edits. A saved list is never offered *Save a
copy*.

In My Armies a row's name still opens the builder, because editing is what a player opens a list
to do most; a View link beside it opens the read-only page. The builder's
View link waits for any outstanding autosave before it navigates, because the server renders the
view from the row, not from the builder's draft.

Viewing mints nothing. Share and PDF go through `useSheetExport` as they do everywhere else, and a
short link exists only once someone asks for one.

## Alternatives considered

- **Render the view on the client, through `army.byId`.** A loading skeleton on a page that is
  only data, a second assembly path beside the share page's, and no server 404 for a list that is
  not yours.
- **Mint a share and redirect to `/s/<id>`.** A copy that stops following the list the moment it
  is made, a row in `shares` for every look, and the wrong answer to *is this my list?*
- **A read-only mode inside the builder.** It keeps the editor's controls on screen, and the stray
  tap is exactly what the issue asked to take away.

## Consequences

- The page reads a cookie, so it must never be cached publicly. `proxy.ts` already marks every page
  `Cache-Control: private`.
- A link to `/my-armies/<id>` works only for its owner. Anyone else gets a 404, never a hint that
  the list exists.
- The view and the share page cannot drift apart, because both draw the one component from the one
  assembly. Anything added to the sheet shows up on both.

## Revisit trigger

A saved list needs to be readable by someone other than its owner without a share, say a club or a
tournament organiser. Ownership is then no longer a single `user_id`.
