# 0003 — One data version per saved army

- **Status:** Accepted
- **Date:** 2026-09-17
- **Related:** #16, #18, #25, #38, #46, #47, `docs/DOMAIN.md` §8

## Context

Upstream revises army lists (`status` is `Revised` on 533 of 656). A revision can change a troop
entry's minimum or maximum, add or remove a troop option, adjust date ranges, or reword the
sub-faction note our curated overlay depends on. Our snapshot therefore changes over time (ADR
[0001](0001-snapshot-over-live-api.md)), and each change arrives as a reviewed pull request (#18).

A saved army references its list and its selections. Read against a newer snapshot, those
references may no longer mean what they meant when saved — in the worst case a selection points at
a troop option that no longer exists.

## Decision

Every data bundle carries a `dataVersion` of `YYYY-MM-DD.<hash8>` (#16). Every saved army — in the
database (#38) and in local storage — records the `dataVersion` it was built against, and that
stamp never changes on its own.

An army is always interpreted against the version it was built against. Armies are never silently
re-resolved, migrated or re-validated against a newer snapshot. When a saved army's `dataVersion`
differs from the current bundle, the UI says so and offers an explicit user-initiated upgrade;
until the user accepts, the army reads exactly as saved.

Share links and exports (#25, #46, #47) carry the `dataVersion` too, so a received army is
unambiguous. A shared link is a copy, not a live view.

## Alternatives considered

- **Always resolve against the latest snapshot.** Simplest, and it silently rewrites people's
  armies — points totals change and legality flips with no action by the user, which destroys
  trust in the points meter.
- **Migrate saved armies automatically on refresh.** Requires a correct migration for every
  possible upstream edit, written against a diff we have not seen yet. Not worth it for a hobby
  army list.
- **Pin the whole app to one version forever.** No upstream corrections ever reach users.

## Consequences

- Old bundles must remain readable. The client keeps only the current bundle, so an army on an
  older version renders from its stored selection plus whatever the current bundle can resolve, and
  anything unresolvable is shown as an explicit unknown rather than dropped.
- The validator must tolerate dangling references and report them as findings, which ADR
  [0002](0002-warn-dont-block.md) already requires.
- Comparing two armies (#58) means comparing across versions; the version is part of the identity.
- `dataVersion` is a column from the first migration (#38), not a later addition.
- The stamp has to cover everything that decides points and legality, which is the snapshot plus
  the curated overlays (#14, #15). Until the client bundle exists (#17) it covers the snapshot
  alone, as `manifest.json`'s `dataVersion` over the Meshwesh `contentHash`.
- Upgrading an army is a real feature with real UI, not a background job — it is the only place
  where a revision is allowed to change what a user saved.

## Revisit trigger

Upstream revisions turn out to be overwhelmingly additive and non-breaking in practice, or the
stale-version banner becomes noise because nearly every saved army trips it.
