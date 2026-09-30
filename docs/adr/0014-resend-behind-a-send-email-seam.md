# 0014 — Send transactional mail through Resend, behind a `sendEmail` seam

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** #39, #41, #60, ADR [0004](0004-implicit-account-linking.md)

## Context

The app sends one email: the password reset (#41). Signup and signin send none, because email
verification is off (#40, ADR [0004](0004-implicit-account-linking.md)), and #60 turning it on is
the only thing on the roadmap that would add a second kind.

The deployment is a single container on a homelab host (ADR
[0006](0006-self-hosted-single-container.md)) behind a residential connection. Sending mail from
it directly is a deliverability problem, not a code problem: no reverse DNS we control, no
reputation, and a reset that lands in spam is a support ticket from someone who is already locked
out.

A Resend account exists on the free tier, which allows **100 emails a day and 3,000 a month** and
requires a verified sending domain. One reset per locked-out player is nowhere near that, and the
one plausible way to reach it is verification mail (#60): Better Auth re-sends the verification on
*every* signin attempt by an unverified user, so a handful of confused people can burn the daily
cap between them.

## Decision

Resend, over its HTTP API, behind a `sendEmail` seam in `lib/email/`.

`SendEmail` takes an `EmailMessage` — `to`, `subject`, `html`, `text` — and resolves to an
`EmailResult` that is either a delivered id or a failure with a reason. It never throws. Templates
are React Email components that render to HTML and plain text *before* a transport sees them, so
nothing provider-shaped reaches the seam and nothing React-shaped reaches a transport.

With no `RESEND_API_KEY` or no `EMAIL_FROM`, the transport is a log transport that prints the
message instead of sending it. Local development and tests therefore send no mail at all, and the
reset link is in the server log where a developer can click it.

## Alternatives considered

- **SMTP from the homelab.** Free, and the deliverability of a residential IP with no reputation
  makes a password reset unreliable in exactly the case where it matters.
- **A transactional SMTP relay (Postmark, SES, Mailgun).** All fine, and all a bill or an AWS
  account for the handful of messages this app sends. The seam means picking one later is a file.
- **Resend's Node SDK.** One `POST` with a bearer token is the whole integration; the SDK's value
  is in the parts we do not use (webhooks, inbound, batch). `scripts/meshwesh/client.ts` already
  sets the pattern of a small `fetch` client with an injectable `fetchImpl`, which is what makes
  the failure mapping testable without a network.
- **React Email's rendered output committed as static HTML.** Faster to send, and it puts the copy
  out of reach of review and the plain text part out of sync on the first edit.

## Consequences

- A verified sending domain and `RESEND_API_KEY` are deployment prerequisites. Neither has a
  working default: without them the app runs and logs its mail rather than failing to boot.
- The caps are a design constraint, not a footnote. #41 rate-limits the reset request per address
  and per IP; #60 cannot ship without a per-address cooldown and a resend limit.
- A failed send is a result, not an exception. The reset endpoint must answer the same way whether
  or not the mail went out — otherwise it is an account oracle — so `sendEmail` logs the failure
  itself and the caller is free to ignore it.
- No bounce or complaint handling. Resend records both, and nothing in the app reads them, so a
  dead address looks like a successful send.
- Two copies of every template, HTML and text, generated from one component. A template that
  renders badly to text is a review comment, not a broken send.

## Revisit trigger

Sustained sends approaching 100 a day — which enabling #60 alone may do — a Resend outage during a
reset, or a second product need for mail (digests, list sharing by email) that the free tier or a
single `sendEmail` cannot carry.
