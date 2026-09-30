# 0015 — Require a confirmed email address before a session

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** #38, #39, #40, #41, #42, #60; supersedes [0004](0004-implicit-account-linking.md)

## Context

ADR [0004](0004-implicit-account-linking.md) accepted a known account-takeover path: with email
verification off, anyone could register an address they did not own, and implicit account linking
would later attach the real owner's Google or Discord sign-in to that pre-existing account. It was
accepted because the protected asset is a hobby army list and sign-up friction seemed the larger
cost.

Three things have changed since.

**Better Auth closed the door itself, at the price of the flow #42 wanted.** Version 1.7.5 added
`account.accountLinking.requireLocalEmailVerified`, defaulting to `true`: implicit linking is
refused unless the *local* account has already confirmed its address. With verification off, that
is every account, so every social sign-in on a known address would land in a manual linking detour
in settings — the outcome 0004 explicitly rejected. Keeping 0004's behaviour meant setting the
option to `false`. Better Auth documents it as deprecated and **to be removed on the next minor,
with the gate becoming unconditional**, so that was a reprieve with a date on it.

**The amplification risk 0004 named is smaller than it looked.** `emailVerification.sendOnSignIn`
defaults to `false` in this version, so Better Auth no longer re-sends a verification email on
every sign-in attempt by an unverified user. The remaining exposure is the public
`/send-verification-email` endpoint, which is a bounded problem — and #41 has since landed the
shape of the answer: a per-address counter in `lib/auth/rate-limit.ts` behind a `hooks.before`,
beside Better Auth's own per-IP rule. Resend's free tier is still 100 emails a day (ADR
[0014](0014-resend-behind-a-send-email-seam.md)).

**There is nothing to grandfather.** Accounts exist only in development. The decision about what to
do with addresses registered while verification was off, which 0004 deferred to #60, costs nothing
to take correctly now and would cost real users later.

## Decision

Turn email verification on. `emailAndPassword.requireEmailVerification: true`, with
`sendVerificationEmail` wired to the Resend seam (#39), and
`account.accountLinking.requireLocalEmailVerified` left at its default rather than overridden.

An address on an account now means "someone proved they can read mail here".

## Alternatives considered

- **Keep 0004 and set `requireLocalEmailVerified: false`.** What #42 originally shipped. Rejected:
  it buys one Better Auth minor version, and the risk it preserves is the one this change is
  cheapest to fix now, before the first real account exists.
- **Disable implicit linking** (`disableImplicitLinking: true`) and leave verification off. Blocks
  the takeover path, but sends every social sign-in on a matching address into a settings detour —
  the worst experience for the common case, and it still leaves addresses unproven.
- **Grandfather the accounts that exist.** Rejected: they are development accounts, and
  grandfathering would preserve exactly the risk this record closes.
- **A durable per-address counter in SQLite.** Rejected for now: it is a migration and a table for
  a counter that Better Auth's own limiter — and #41's — already keep in memory, on one container
  (ADR [0006](0006-self-hosted-single-container.md)).

## Consequences

- **Sign-up no longer produces a session.** It produces a *Check your inbox* screen, and the link
  in the mail both confirms the address and signs the player in
  (`emailVerification.autoSignInAfterVerification`). Signing in before confirming is refused with
  `EMAIL_NOT_VERIFIED` and the same screen, with a resend button.
- **Sign-up is still not an address oracle.** Better Auth returns its synthetic-account response
  for a taken address and sends no mail, so a duplicate sign-up and a real one are indistinguishable
  — the duplicate simply never receives anything.
- **Implicit linking now works the way #42 wanted, safely.** A confirmed password account picks up
  Google or Discord with no detour, because the local address is proven. An unconfirmed one does
  not, which is the hole 0004 accepted, now closed.
- **Provider accounts are confirmed on arrival.** Google and Discord report verified email status,
  so an account created or linked through them is not sent through the flow again.
- **Mail volume has to stay inside 100/day.** `/send-verification-email` gets the same pair of
  limits #41 gave the reset request — three per address per hour through `lib/auth/rate-limit.ts`,
  five per IP per 15 minutes through Better Auth — plus a **daily budget of 80 confirmations**,
  which reset does not need: a reset can only be asked for on an address that already exists, and
  a sign-up needs no existing address at all. All of it is in memory, which is sound for one
  container and would not be for two.
- **A completed password reset confirms the address.** Whoever followed a reset link has proved
  they can read that mailbox, which is the same proof the confirmation link asks for. Without it,
  an unconfirmed player could reset their password and still be unable to sign in — a dead end
  with no way out, since the reset flow hands back no confirmation link.
- **A send that is refused is logged, never surfaced.** The endpoint answers identically whether or
  not mail went out, because saying otherwise would rebuild the oracle.
- **#60 is done**, ahead of its milestone, as part of #42.
- **No migration.** `users.emailVerified` has existed since #38 and existing rows simply stay at
  `0` until their owner confirms.

## Revisit trigger

Any of: the daily budget is reached in normal use, which means the free tier no longer fits the
traffic; a second container is deployed, which makes both in-memory limits wrong; or confirmation
mail stops arriving reliably enough that sign-up completion drops.
