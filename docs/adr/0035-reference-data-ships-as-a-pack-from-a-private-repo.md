# 0035 — Ship the reference data as a versioned pack from a private repo

- **Status:** Accepted
- **Date:** 2026-09-29
- **Related:** #229, #231, #233, #241, #242, #246, ADR [0001](0001-snapshot-over-live-api.md), ADR
  [0006](0006-self-hosted-single-container.md), ADR
  [0034](0034-reference-data-lives-in-sqlite-served-over-trpc.md)

## Context

ADR 0034 moves the reference data into the database. It still has to come from somewhere: a
maintainer's database, production's and CI's all need the same data, at the version the code
on a branch expects, without it ever being in the public repo or in an image anyone can pull.

What has to travel is more than the Meshwesh snapshot: the curation (movement, basing, battle card
costs, the sub-faction overlay), the corrections made to match the v1.2 QRS and the Spanish
translations. The code that turns them into what the app reads — `buildBundle`, the overlay logic,
the schemas — is open.

Production's database holds users, lists and shares, so it can never be replaced: whatever carries
the data is imported into a live database, not swapped for one. Development happens in several
worktrees at once, and a `.env` does not follow a new worktree.

Every image tag pushed to `ghcr.io/dsaltares/triumph-army-builder` so far carries `public/data/`.

## Decision

The reference data is kept in a private repo, `triumph-army-builder-data`, and published as a
**pack**: one gzipped JSON file, `reference-<dataVersion>.json.gz`, holding every bundle file for
every locale and the version stamp, read through a zod schema. `yarn data:pack` builds it from the
snapshot, the curation and the translations, and the data repo publishes each one as release
`data-<dataVersion>`. `yarn db:import-reference` writes a pack into a database in one transaction,
touches no other table, and does nothing for a version it already holds.

The public repo pins the version its code expects in `reference-version.txt`. A new release opens a
pull request in the public repo that bumps it.

- **Production** never gets the pack in its image. The deploy job downloads the pinned release with
  a read-only token held as a secret, backs up the database, and copies the pack to the homelab,
  where compose mounts it read-only; the server imports it on startup when its version is new, and
  fails its health check while no version is current.
- **Development** runs `yarn db:seed:reference` from `yarn dev`. It takes the pinned version from a
  cache outside the checkout, or downloads it with `gh auth token` or a `REFERENCE_PACK_TOKEN` from
  the environment, and falls back to a synthetic sample pack committed to the public repo, which is
  also what public CI runs on. Nothing it needs lives in the worktree.

The GHCR package stays private.

## Alternatives considered

- **Bake the pack into the image.** The image becomes restricted data, so the public repo could
  never publish it, and anyone who can build it holds the data.
- **Ship a pre-seeded SQLite file.** Production's database cannot be replaced, so it would be
  imported table by table anyway, with a schema coupled to one migration.
- **Download the pack from the server at startup.** A token on the server and a network dependency
  on every restart, for a file the deploy job already has.
- **A private git submodule.** Every worktree needs its own `git submodule update`, and anyone
  without access gets an error when they clone.
- **Only the synthetic pack, for everyone.** Maintainers could never reproduce what production
  shows.

## Consequences

- Every branch, worktree and deploy reads the version its code was written against, and a data
  change is a reviewable bump in the public repo as well as a diff in the data repo.
- A contributor without access runs the app on invented armies. Anything that needs real data to
  test — snapshot counts, overlay coverage, reaching 48 points — runs in the data repo's CI, which
  also checks the public tree and image for restricted content.
- The public repo holds deploy secrets, so the deploy runs only on `main`, in a `production`
  environment, and no workflow runs untrusted code with secrets.
- The GHCR package can never be made public without first deleting every tag from before this ADR.
- The data version is the snapshot's, so a change to the curation or the translations alone
  rebuilds the pack under a version that is already released. The release workflow replaces that
  release's asset in place, and a database that already holds the version keeps the rows it
  imported, so such a change reaches a database only with the next snapshot version.

## Revisit trigger

WGC grant permission to publish the data (#53), which would let the pack live in the public repo, or
a second deployment needs the data, which would make the release download worth a proper endpoint.
