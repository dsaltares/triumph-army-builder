# 0025 — A share link lives as long as people open it

- **Status:** Accepted
- **Date:** 2026-09-20
- **Related:** [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md),
  [0013](0013-anonymous-armies-in-sqlite.md), [0007](0007-sqlite-on-a-volume.md)

## Context

ADR [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md) accepted, in as
many words, that *shares accumulate and are never swept*, and set its own revisit trigger:

> Or shares become a volume or abuse problem the per-browser cap does not contain — at which point
> a retention sweep for copies nobody has opened, with a `last_seen_at`, is the next move and it is
> a migration, not a redesign.

A security review of the deployment fired that trigger. `share.create` is a `signedInProcedure`,
and ADR [0013](0013-anonymous-armies-in-sqlite.md) means an anonymous browser satisfies it: the cap
is `anonymousShareLimit` **per user row**, and a user row costs one `/sign-in/anonymous` call. At
the production limit of ten anonymous sessions an hour per address, one client can mint a thousand
permanent ~700-byte rows an hour, and the nightly sweep — which deletes the anonymous *user* and
their armies — never touched them. `on delete set null` orphaned the author and left the copy.

Nothing else in the schema was unbounded. `armies` go with their owner, anonymous users go after
7 days empty or 24 months idle, and `verifications` expire. `shares` were the one table with an
insert path and no delete path at all.

## Decision

`shares` gains `last_seen_at`, and the retention sweep deletes a copy **nobody has opened** for
`shareRetention.unseenAfter` — 24 months, the same window an idle anonymous record gets.

`loadSharedView` marks a copy as seen, so the page at `/s/[id]` and its `opengraph-image` both
count: a link that is still being followed never ages out, whoever follows it. The write is
throttled to `seenResolutionMs` — a day — so a busy link costs one `UPDATE` a day rather than one
per view, and the sweep reads it through `shares_last_seen_at`, which
`lib/db/query-plans.test.ts` holds to a `SEARCH`.

A browser that shared a copy is no longer swept as *empty*. `ownsNoShares` joins `ownsNoArmies` in
the 7-day branch, because a player who shared a list and saved nothing has still done something,
and reaping their author row a week later would be the cap forgetting what it was counting.

The 24-month idle branch is unchanged, and still takes the anonymous author while leaving the copy:
that is ADR 0021's "the sweep nulls the author, and the copy stays", and it is why the share
retention is counted from `last_seen_at` rather than from the owner.

## Alternatives considered

- **Delete a copy with the author the sweep reaps.** No migration, and one rule instead of two —
  but it kills links that are actively being passed around, which is the thing ADR 0021 was most
  careful to avoid, and it makes a link's life depend on a browser the reader never had.
- **A per-IP limit on `share.create`.** tRPC would need its own IP resolution; ADR 0021 already
  rejected that for the same reason, and it bounds the *rate* without ever bounding the *total*.
- **A hard cap on the table.** Cheap, and it decides which strangers' links break by insertion
  order.
- **Count views rather than dating them.** A counter says how popular a link was, never whether it
  is still alive; the sweep needs the second question.

## Consequences

- **A link can now die.** ADR 0021's "there is no way to withdraw a link" is still true — nobody
  can withdraw one on purpose — but a link nobody opens for two years stops working. The privacy
  policy says so, in the retention table and beside the sentence about sharing being forever.
- Reading a shared list writes to the database, which no other read path does. It is one throttled
  `UPDATE` by primary key, and it is why `loadSharedView` takes a clock.
- A preview crawler counts as a view. That is deliberate: an unfurl in a chat window means the link
  is still in that chat window.
- The 7-day empty branch now runs one more `EXISTS` per candidate row, against `shares_user_id`.
- `SweepResult` carries a third number, and `yarn db:sweep` prints it.

## Revisit trigger

Copies stop being the largest table, or 24 months turns out to be the wrong window — someone
complains about a link dying that they were still using, or the table still grows without bound
because the abuse rate outruns the retention. Either way the next move is the rate limit this
record declined, not a shorter window.
