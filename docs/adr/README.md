# Architecture Decision Records

Decisions that are expensive to reverse, or that a future reader would otherwise have to
reconstruct from the code. Everything else belongs in `docs/DOMAIN.md` (how the data behaves) or
`docs/ROADMAP.md` (what we are building next).

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-snapshot-over-live-api.md) | Vendor a build-time Meshwesh snapshot instead of calling the API at runtime | Superseded in part by 0034 | 2026-09-17 |
| [0002](0002-warn-dont-block.md) | Validation warns, never blocks | Accepted | 2026-09-17 |
| [0003](0003-one-data-version-per-army.md) | One data version per saved army | Accepted | 2026-09-17 |
| [0004](0004-implicit-account-linking.md) | Accept implicit account linking while email verification is off | Superseded by 0015 | 2026-09-17 |
| [0005](0005-public-data-only.md) | Ship only publicly available data until WGC grants permission | Superseded by 0029 | 2026-09-17 |
| [0006](0006-self-hosted-single-container.md) | Self-host as a single container on the homelab | Accepted | 2026-09-17 |
| [0007](0007-sqlite-on-a-volume.md) | SQLite on a local volume, with Kysely | Accepted | 2026-09-17 |
| [0008](0008-sub-faction-overlay-keyed-on-the-note-string.md) | Curate sub-factions as an overlay keyed on the upstream note string | Accepted | 2026-09-17 |
| [0009](0009-generated-static-bundle-with-an-eager-index.md) | Serve the client a generated static bundle, eager index and lazy detail | Superseded by 0034 | 2026-09-17 |
| [0010](0010-share-codes-are-base64url-json.md) | Encode a shared army as versioned base64url JSON | Superseded in part by 0041 | 2026-09-17 |
| [0011](0011-prerender-army-detail-from-the-bundle.md) | Prerender the army detail pages from the bundle at build time | Superseded by 0034 | 2026-09-17 |
| [0012](0012-builder-gating-in-the-url-selection-in-state.md) | Keep the builder's gating in the URL and its selection in component state | Accepted | 2026-09-18 |
| [0013](0013-anonymous-armies-in-sqlite.md) | Store anonymous armies in SQLite behind an anonymous session | Accepted | 2026-09-18 |
| [0014](0014-resend-behind-a-send-email-seam.md) | Send transactional mail through Resend, behind a `sendEmail` seam | Accepted | 2026-09-18 |
| [0015](0015-require-a-confirmed-address-before-a-session.md) | Require a confirmed email address before a session | Accepted | 2026-09-19 |
| [0016](0016-three-kinds-of-test-with-the-middle-in-rtl.md) | Put the middle of the test suite in React Testing Library, not Playwright | Accepted | 2026-09-19 |
| [0017](0017-saving-is-an-explicit-act.md) | Saving a list is an explicit act, not an autosave | Superseded by 0028 | 2026-09-19 |
| [0018](0018-the-builder-edits-a-saved-list-by-id.md) | The builder edits a saved list named by `?list=` | Accepted | 2026-09-19 |
| [0019](0019-sort-and-search-saved-armies-in-the-app.md) | Sort, filter and search saved armies in the app, not in SQLite | Accepted | 2026-09-19 |
| [0020](0020-render-the-printable-list-as-a-server-side-pdf.md) | Render the printable list as a PDF on the server, with `@react-pdf/renderer` | Accepted | 2026-09-20 |
| [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md) | A share link is a server-side copy, addressed by the content it carries | Accepted | 2026-09-20 |
| [0022](0022-a-qr-code-encodes-the-short-link-and-nothing-else.md) | A QR code encodes the short link, and nothing else | Accepted | 2026-09-20 |
| [0023](0023-a-new-list-is-born-named.md) | A new list is born named, and the header title renames it | Accepted | 2026-09-20 |
| [0024](0024-install-by-instruction-not-beforeinstallprompt.md) | Make the app installable with a manifest, and prompt by instruction | Accepted | 2026-09-20 |
| [0025](0025-a-share-link-lives-as-long-as-people-open-it.md) | A share link lives as long as people open it | Accepted | 2026-09-20 |
| [0026](0026-the-front-door-is-my-armies.md) | The front door is My Armies, and its empty state is the pitch | Accepted | 2026-09-21 |
| [0027](0027-a-locale-is-a-user-setting-not-a-url.md) | A locale is a user setting, not a URL | Accepted | 2026-09-21 |
| [0028](0028-creating-a-list-is-the-explicit-act.md) | Creating a list is the explicit act, and keeping it is automatic | Accepted | 2026-09-21 |
| [0029](0029-ship-movement-before-permission.md) | Ship Table 5 movement distances before WGC answer | Superseded in part by 0033 | 2026-09-23 |
| [0030](0030-a-saved-list-is-viewed-on-the-server-at-its-own-route.md) | A saved list is viewed on the server, at `/my-armies/<id>` | Accepted | 2026-09-23 |
| [0031](0031-track-a-collection-of-stands.md) | Track a collection as account-owned batches of stands, matched to lists by troop type | Accepted | 2026-09-24 |
| [0032](0032-a-buildable-army-opens-as-an-unsaved-view.md) | A buildable army opens as an unsaved view, and Edit creates the list | Accepted | 2026-09-28 |
| [0033](0033-ship-appendix-a-basing-before-permission.md) | Ship Appendix A basing before WGC answer | Accepted | 2026-09-28 |
| [0034](0034-reference-data-lives-in-sqlite-served-over-trpc.md) | Keep the reference data in SQLite, and serve it over tRPC | Accepted | 2026-09-29 |
| [0035](0035-reference-data-ships-as-a-pack-from-a-private-repo.md) | Ship the reference data as a versioned pack from a private repo | Accepted | 2026-09-29 |
| [0036](0036-the-public-repo-starts-from-one-squashed-commit.md) | Start the public repo from one squashed commit | Accepted | 2026-09-29 |
| [0037](0037-usage-is-a-first-party-event-log.md) | Record usage as a first-party event log, viewed in aggregate by admins | Accepted | 2026-09-29 |
| [0038](0038-an-account-without-a-password-can-add-one-by-email.md) | Let an account without a password add one through the reset link | Accepted | 2026-09-30 |
| [0039](0039-a-saved-list-belongs-to-a-game.md) | A saved list belongs to a game, and each game owns its selection shape | Proposed | 2026-10-09 |
| [0040](0040-a-fantasy-triumph-list-is-named-units-of-identical-stands.md) | A Fantasy Triumph list is named units of identical stands, heroes and army cards | Proposed | 2026-10-09 |
| [0041](0041-a-share-code-deflates-its-payload.md) | Deflate a share code's payload from version 2, with a synchronous codec | Accepted | 2026-10-09 |
| [0042](0042-a-data-version-can-be-bumped-by-hand.md) | Let the curation bump the data version by hand | Accepted | 2026-10-09 |
| [0043](0043-an-unchanged-army-reads-at-the-current-version.md) | Read a list at the current data version when nothing it reads has changed | Accepted | 2026-10-09 |

## How to add one

1. Copy [`template.md`](template.md) to `NNNN-kebab-case-title.md`, taking the next free number.
2. Write it before or alongside the change, not after — an ADR that documents a decision nobody
   can still argue with is a changelog entry.
3. Add a row to the index above.

## Conventions

- **One decision per record.** If the title needs an "and", it is two ADRs.
- **Status** is `Proposed`, `Accepted`, `Superseded by NNNN` or `Deprecated`. Records are
  append-only: supersede them, never rewrite history. Correcting a typo is fine; changing what was
  decided is a new ADR.
- **Revisit trigger** is mandatory. A decision with no stated trigger is a decision nobody will
  ever reopen, which is how accepted risks quietly become permanent ones.
- **`#N` here is a GitHub issue number**, unlike `docs/ROADMAP.md`, whose `#N` refs are
  roadmap-local and sit one below the issue they became.
