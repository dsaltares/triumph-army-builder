# 0013 — Store anonymous armies in SQLite behind an anonymous session

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** #38, #43, #44, #45, #46, #52, ADR [0007](0007-sqlite-on-a-volume.md), ADR [0012](0012-builder-gating-in-the-url-selection-in-state.md)

## Context

The app must be fully usable logged out (#44): signup is not on the critical path of someone trying
the builder for the first time. That requirement said nothing about *where* a logged-out player's
lists live, and the original plan answered IndexedDB, with an import prompt on first sign-in.

That answer costs two implementations of the same thing. An IndexedDB store and a tRPC/SQLite store
both have to satisfy the same CRUD surface (#43) and the same My Armies screen (#45) — search,
sort, rename, duplicate, delete — behind an abstraction that exists only to hide which one is in
play. On top of that sits an import flow: pick which local lists to bring, decide what a duplicate
is, resolve name collisions, and describe all of it in a dialog shown exactly once per user.

ADR [0007](0007-sqlite-on-a-volume.md) already commits to a server with a database on a volume, and
an army is roughly 600 bytes of selection blob. The second store is not buying storage we lack.

Better Auth ships an [anonymous plugin](https://www.better-auth.com/docs/plugins/anonymous):
`signIn.anonymous()` creates a user row flagged `isAnonymous` with an ordinary session cookie, and
when that user later signs up *or* signs into an existing account, `onLinkAccount({ anonymousUser,
newUser })` fires and the anonymous record is then deleted. The plugin's after-hook matches
`/sign-in`, `/sign-up`, `/callback` and `/magic-link/verify` and does not branch on whether the
credential is new, so both directions run the same callback.

Armies are independent documents. They hold an owner, a name, a list reference, a selection blob
and a `dataVersion` (ADR [0003](0003-one-data-version-per-army.md)); nothing references another
army. Merging two sets of them is therefore a reassignment, not a reconciliation.

## Decision

One store. Every army row lives in SQLite, owned by a `users` row, and the client reaches it
through tRPC in both signed-in and logged-out states. There is no IndexedDB store of record.

A logged-out player gets an anonymous user on their **first write**, not on page load. Reads with no
session cookie return an empty list without touching the database.

Claim on sign-in is `onLinkAccount` reassigning every army from the anonymous user to the
authenticated one. No dedupe, no selection UI, no conflict resolution — the lists are moved and the
player is told so, with an undo. Two lists that end up sharing a name are two lists sharing a name,
consistent with ADR [0002](0002-warn-dont-block.md).

`armies.user_id` is `on delete restrict`, so a reassignment that fails blocks the plugin's deletion
of the anonymous user rather than cascading the lists away with it.

## Alternatives considered

- **IndexedDB with claim-on-sign-in**, the original #44. Two implementations of one CRUD surface
  plus an import UX, to avoid writing rows for people who have not signed up — on a server we are
  already running, for data we are already storing for everyone else.
- **Local-first: IndexedDB is the store of record and syncs to the server.** The only option that
  genuinely improves on both, and explicitly out of scope — #44 rules out CRDTs and a sync engine,
  and that is still the right call for a single-writer hobby app.
- **Anonymous session on page load rather than first write.** Uniform — every request has a session
  and no branch exists anywhere. Rejected because it turns an unauthenticated endpoint into
  unbounded row creation, reachable by a `curl` loop and by every JS-rendering crawler walking the
  prerendered army pages (ADR [0011](0011-prerender-army-detail-from-the-bundle.md)).

## Consequences

- **Logged-out players lose offline editing until #52.** This is the real cost and it is accepted
  deliberately: club venues have bad wifi, and under the rejected plan anonymous editing worked
  offline for free. Against it, #52 has to exist anyway for signed-in players, and it is now one
  replay queue over one store of record instead of a queue beside a second store with its own
  semantics. #50 still caches the snapshot and the player's own lists for reading.
- #43's ownership check is `session.user.id owns the row`, with no anonymous special case. #45 has
  one implementation. #46 can give an anonymous player a real short link with an OG image, because
  their army has a server id; the #25 client codec stays for paste-into-Discord and offline, not as
  the anonymous fallback.
- Exactly one branch survives: no session cookie means an empty list, not a query.
- The app holds content for people who never signed up, which obliges a retention sweep, a cap on
  armies per anonymous user, a per-IP rate limit on the anonymous sign-in endpoint, and a line in
  the privacy page. That work is what #44 now is.
- Anonymous sessions must outlive a browsing session by a wide margin — Better Auth's 7-day default
  would silently eat a player's lists inside a week.
- Losing the cookie loses the lists, as clearing site data would have lost the IndexedDB rows. The
  mitigation is a prompt to sign in after the first save, not a storage choice.
- Anonymous lists are per-browser: a phone and a laptop stay separate until sign-in. This is the
  sentence that makes signing in worth doing, so it belongs in the UI copy rather than in a FAQ.
- Signing out must not immediately mint a fresh anonymous session, or the player lands on an empty
  My Armies indistinguishable from data loss. Signed out with no anonymous session is a third state.
- `users` carries `isAnonymous` from the first migration (#38), so this needs no later migration.

## Revisit trigger

#52 needing a local store of record anyway — at which point the local-first design rejected above
is back on the table and this ADR is superseded rather than amended. Or anonymous rows becoming an
abuse or volume problem that the rate limit and the retention sweep do not contain.
