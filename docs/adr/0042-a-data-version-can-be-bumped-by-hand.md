# 0042 — Let the curation bump the data version by hand

- **Status:** Accepted
- **Date:** 2026-10-09
- **Related:** #18, ADR [0003](0003-one-data-version-per-army.md), ADR
  [0034](0034-reference-data-lives-in-sqlite-served-over-trpc.md), ADR
  [0035](0035-reference-data-ships-as-a-pack-from-a-private-repo.md)

## Context

A reference pack carries the Meshwesh snapshot's data version, `YYYY-MM-DD.<hash8>`, and ADR 0035
accepted what follows: a change to the curation or the translations alone rebuilds the pack under a
version that is already released, the release workflow replaces that release's asset in place, and
a database that already holds the version keeps the rows it imported. That was tolerable while the
curation only adjusted Meshwesh data. Fantasy Triumph (ADR 0039) is curated end to end — its card
catalogue, costs, rules text and translations come from no snapshot — so a change to it would never
reach a database until Meshwesh happened to change.

## Decision

The curation may hold `release.json`, `{ "bumpedAt": "<ISO timestamp>" }`, written by
`yarn data:bump`. Without it, a pack's version is the snapshot's, exactly as before. With it, the
version keeps the `YYYY-MM-DD.<hash8>` shape: the date is the later of the bump and the snapshot's
fetch, and the hash is the first eight hex characters of the SHA-256 of the snapshot's content hash
and the bump's timestamp. `yarn data:version` prints the version a pack would carry, and the data
repo's release workflow names the release after it rather than reading the snapshot manifest.

## Alternatives considered

- **Hash the curation and translations into every version.** No step to forget, but every edit to
  any curated file — a typo in a Spanish card name — mints a release, a bump pull request and a new
  version every saved list is then one behind. A release should be a decision.
- **Edit the snapshot manifest's version.** `loadSnapshot` refuses a version that does not match the
  content hash, and loosening that check would let the manifest describe a snapshot it does not
  hold.
- **A free-form version suffix.** Changes the `YYYY-MM-DD.<hash8>` pattern that saved lists, share
  codes and `compareDataVersions` all read.

## Consequences

- Shipping curated data alone is `yarn data:bump`, commit, push: the release workflow publishes
  `data-<version>` and opens the pull request that pins it here, and the next deploy imports it.
- A bump without a curation change mints a version identical in content to the last; harmless, but
  every saved list then reports being one version behind.
- Forgetting to bump leaves the old behaviour: the release's asset is replaced in place and no
  database sees the change.
- A later Meshwesh refresh still mints a new version on its own, and one that differs from the
  refreshed snapshot's own version for as long as `release.json` exists.

## Revisit trigger

A curated change ships without its bump and reaches no database, or bumps come often enough that
the manual step is the bottleneck — either says to hash the curated sources instead.
