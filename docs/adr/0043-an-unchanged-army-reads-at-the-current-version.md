# 0043 — Read a list at the current data version when nothing it reads has changed

- **Status:** Accepted
- **Date:** 2026-10-09
- **Related:** ADR [0003](0003-one-data-version-per-army.md), ADR
  [0034](0034-reference-data-lives-in-sqlite-served-over-trpc.md), ADR
  [0042](0042-a-data-version-can-be-bumped-by-hand.md)

## Context

ADR 0003 stamps every saved list with the data version it was built against and flags a list whose
stamp differs from the current version. A data version covers the whole pack, so any change — one
army revised upstream, a curated Fantasy Triumph card, a translation bumped by hand (ADR 0042) —
flags every saved list as built against older list data, though almost none of them read anything
that changed. The notice was turning into the noise ADR 0003's revisit trigger warned about.

Every imported version stays in the database (ADR 0034), so the documents a list was built against
can be compared with the current ones.

## Decision

When a list is read — `army.list`, `army.byId`, the lists `army.update` and `army.duplicate`
return, a saved list's page and a share — and its stamp is older than the current version, the
server compares, in every locale, the documents its game reads: for Triumph! its army's detail,
the troop types and the battle cards. When every one is identical, the list is served stamped with
the current version, so it carries no notice. The row keeps its stamp until the list is next saved,
and the builder then saves the current stamp with it.

A list any of those documents changed for, or whose version is no longer imported, keeps its stamp
and its notice, as ADR 0003 decided.

## Alternatives considered

- **Rewrite the stamps of unchanged lists on import.** A write to every player's rows on a deploy,
  for a change nobody made, and shares are content-addressed copies that should not be rewritten.
- **A per-army content hash in the pack.** Cheaper to compare, but a pack format change for what one
  indexed join answers.

## Consequences

- A change to translations alone still flags the lists whose army it touched, since the sheet reads
  translated names.
- A new document a game reads has to join `referencePaths` in `lib/data/list-data-version.ts`, or a
  change to it goes unflagged.

## Revisit trigger

A list read as unchanged prices or validates differently from how it did at its stamped version.
