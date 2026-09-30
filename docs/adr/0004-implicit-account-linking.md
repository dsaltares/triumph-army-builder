# 0004 — Accept implicit account linking while email verification is off

- **Status:** Superseded by [0015](0015-require-a-confirmed-address-before-a-session.md)
- **Date:** 2026-09-17
- **Related:** #38, #40, #41, #42, #44, #60

## Context

Auth is Better Auth: email/password first (#40), then Google and Discord OAuth (#42). Email
verification is **off** for now — `requireEmailVerification: false`, `sendVerificationEmail`
deliberately unwired — so the only mail the app sends is the password reset (#41).

Better Auth's defaults include implicit account linking (`accountLinking.enabled: true`,
`disableImplicitLinking: false`): signing in with a social provider whose verified email matches an
existing local account attaches that provider to the account instead of erroring out.

With verification off, the two combine into a real hole. Anyone can register an address they do not
own. When the real owner later signs in with Google on that address, implicit linking attaches
their Google sign-in to the attacker's pre-existing account — which the attacker still holds a
password for.

`trustedProviders: []` does **not** close this. That setting governs whether an *incoming*
provider's email is trusted; it says nothing about how the pre-existing local account was created.
The unverified side here is the local account, not the provider.

Two things constrain the alternatives. Resend's free tier allows 100 emails/day, and Better Auth
re-sends a verification email on *every* sign-in attempt by an unverified user — an amplification
risk that has to be solved with a per-address cooldown and a resend rate limit before verification
can be turned on at all (#60).

## Decision

Keep implicit linking on and ship without email verification, accepting the risk knowingly.

Settings for #42 are therefore: `accountLinking.enabled: true`, `disableImplicitLinking: false`,
`trustedProviders: []`, `allowDifferentEmails: false`, `allowUnlinkingAll: false`, plus a
connected-accounts settings panel built on `listAccounts()` / `linkSocial()` / `unlinkAccount()`.

The protected asset is a hobby army list, not money, identity or private correspondence. The app is
fully usable logged out (#44), so an account is a convenience, and sign-up friction costs us more
than this risk does at current scale.

## Alternatives considered

- **Turn on email verification now (#60).** Closes the hole properly, and is the intended end
  state. Rejected *for now*: it needs the resend cooldown and rate limiting shipped in the same
  change, against a 100/day cap, before the first user exists.
- **Disable implicit linking** (`disableImplicitLinking: true`). Blocks the takeover path, but sends
  every social sign-in on a matching address into a manual linking detour in settings — the worst
  experience for the common case in exchange for protecting a list of toy soldiers.
- **Trusted providers.** Does not address this at all; see above. It also adds account-takeover
  surface in the other direction, so it stays empty regardless.

## Consequences

- An account's email address means "someone typed this", not "someone owns this". Nothing may treat
  it as proof of identity, and no feature that depends on address ownership may be built on top of
  it until #60 ships.
- The `emailVerified` column exists from the first migration (#38) and `sendVerificationEmail`
  stays unwired, so #60 is a config change plus rate limiting, not a schema migration.
- #60 must decide what happens to accounts created while verification was off: grandfather them as
  verified, or force a one-off verification pass. Grandfathering preserves this risk for every
  account that already exists, so the decision belongs in that change, with its own ADR.
- Google and Discord both report verified email status, so accounts arriving through those
  providers can be treated as verified on link and need not be sent through the flow again.

## Revisit trigger

Any of: #60 ships (this ADR is then superseded); sign-up abuse or a linking complaint appears; or
the app starts holding anything whose loss would matter more than a re-entered army list.
