# 0038 — Let an account without a password add one through the reset link

- **Status:** Accepted
- **Date:** 2026-09-30
- **Related:** #41, #42, #111; builds on [0015](0015-require-a-confirmed-address-before-a-session.md)

## Context

Password reset (#111) sent nothing to an account with no password credential, so a player who
signed up with Google or Discord (#42) could never add a password: asking for a reset was answered
with the same "check your email" as everyone else, and no email came. The reason given was that
such a player "must not be walked into a password by someone else typing their address", because
Better Auth's `resetPassword` *creates* a credential when the account has none.

That creation is only reachable through the link, and the link only goes to the account's own
address, which ADR 0015 guarantees is confirmed: Google and Discord vouch for theirs, and an address
sign-up is confirmed before it has a session. Whoever can follow the link already controls the
mailbox, and whoever controls the mailbox can already sign in through the provider's own recovery.
Someone else typing the address can only cause an email the owner is free to ignore.

## Decision

`sendResetPassword` mails every account the link. An account with a password gets the reset
wording; one without gets the same link worded as setting a password, and following it adds the
credential beside the connected providers. The account page's *Ways to sign in* lists
*Email and password* for every account and, where there is none, offers *Set a password*, which
asks for that same link to the signed-in address.

## Alternatives considered

- **Keep sending nothing.** Leaves provider-only players with no way to a password, and a reset
  request that silently goes nowhere.
- **Set the password in place from the account page** (Better Auth's `setPassword`). No round trip
  through email, but a borrowed or left-open session could then add a password nobody can take
  back, since the credential is never offered for disconnecting. The email proves the mailbox as
  well as the session.

## Consequences

- The per-address and per-IP reset limits now cover these requests too, and spend a Resend email
  on each.
- The request endpoint's answer stays the same for every address; its copy no longer says a
  password is needed.
- Following the link revokes every session on the account (`revokeSessionsOnPasswordReset`), so a
  player who sets a password from the account page signs in again afterwards.

## Revisit trigger

A report of an unwanted password added to a provider-only account, or a provider whose address the
app accepts without it being verified.
