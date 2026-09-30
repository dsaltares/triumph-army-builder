# 0032 — A buildable army opens as an unsaved view, and Edit creates the list

- **Status:** Accepted
- **Date:** 2026-09-28
- **Related:** ADR [0028](0028-creating-a-list-is-the-explicit-act.md), ADR
  [0030](0030-a-saved-list-is-viewed-on-the-server-at-its-own-route.md), ADR
  [0031](0031-track-a-collection-of-stands.md)

## Context

*Which armies can I build?* ranks every army against the collection, and opening a result went
through `useOpenNewList`: it wrote a named row and routed to the builder. ADR 0028 made that press
the explicit act because **New list** is pressed before any browsing, on a page about one army.
A buildable result is the opposite: a player opens several to compare them, and each look left a
row in My Armies to delete and spent one of the anonymous lists the cap allows.

ADR 0030 already renders a read-only view on the server from a row. The same assembly works over a
selection that has no row, and a selection already travels in a URL as an ADR 0010 share code.

## Decision

A result is a link to `/collection/preview?s=<code>`. `loadDraftView` decodes the code, reads the
army from the bundle and, for a signed-in account, the collection, and `draftView` assembles a
`ListView` of `kind: 'draft'` named after the army. The page renders `SharedListView` with its
coverage, its export menu and **Edit**. Viewing writes nothing. **Edit** is `useOpenNewList`, so
the row is born named by `defaultListName` exactly as before, and the builder autosaves from there.

## Alternatives considered

- **Open the builder as a draft, with its Save button.** The builder is an editor, and the
  stray tap is what ADR 0030 took away from looking at a list.
- **Keep creating the row and delete it on leaving untouched.** A write for every look, and a
  cleanup that a closed tab never runs.

## Consequences

- The collection's result cards are links, so they open in a new tab and survive a reload.
- Export from the view still works: a share link or a PDF of an unsaved list mints what it
  minted for a builder draft, and nothing more.
- A draft has no row, so its coverage cannot be pinned; pins arrive once **Edit** has made one.

## Revisit trigger

A selection whose share code outgrows a URL, or players asking to open several results as lists
in one go.
