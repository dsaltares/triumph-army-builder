# 0006 — Self-host as a single container on the homelab

- **Status:** Accepted
- **Date:** 2026-09-17
- **Related:** #7, #8, #9, #10

## Context

The app needs a server. Accounts and saved armies (#38–#45), server-backed share links with OG
preview images (#46) and the tRPC API all rule out a static export.

It does not need much of one. The audience is a historical wargaming niche; traffic is a handful of
people building 48-point armies, most of the work is pure computation in the domain layer, and the
data is a static snapshot (ADR [0001](0001-snapshot-over-live-api.md)).

There is an existing, proven pattern to reuse: `dsaltares/finlight` and `obsidian-sync` already run
this way — a standalone Next.js image on ghcr.io, a compose entry in `dsaltares/homelab`, and a
deploy job that reaches the host over Cloudflare Access. The homelab host is not exposed to the
internet; Cloudflare Access fronts it and a service token gets CI through the policy.

## Decision

Build a multi-stage Docker image from Next.js `output: 'standalone'`, publish it to
`ghcr.io/dsaltares/triumph-army-builder` on pushes to `main` and `v*` tags (#8), and roll it out
from the same workflow on `main` pushes only, over an SSH connection whose `ProxyCommand` is
`cloudflared access ssh` (#9). The compose file that the deploy pulls lives in the homelab repo
(#10).

One container, one process, port 3013, running as a non-root user, with persistent state on a
`/data` volume. `docker-compose.yml` in this repo (#7) runs the same shape locally, so development
parity is the default rather than an exercise.

Release tags publish an image without deploying, so a rollback is a compose tag change on the host.

## Alternatives considered

- **Vercel plus a managed database.** Less operational surface and better edge performance, at the
  cost of a hosting bill, a second vendor for the database, and a deployment model unlike every
  other app on this homelab. The traffic does not justify either.
- **Static export to Pages.** Would work for Explore and even the builder, and fails the moment
  accounts, share links or OG images exist.
- **Kubernetes, or anything with a scheduler.** Operationally heavier than the thing it runs.

## Consequences

- Availability is the homelab's availability. Acceptable for a hobby app; not acceptable to build
  anything on top of that assumes uptime guarantees.
- One process means one writer, which is what makes SQLite viable (ADR
  [0007](0007-sqlite-on-a-volume.md)) and what we give up if we ever need to scale horizontally.
- Deploys are automatic on merge to `main`. There is no staging environment, so CI's four-way
  matrix plus the e2e job is the whole safety net before production.
- Five repository secrets are load-bearing (`SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`,
  `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`); the deploy fails without them, and rotating
  the Access service token is a manual step nobody will remember.
- The service must be registered in `dsaltares/homelab` before the first deploy can succeed, and
  the port must stay 3013 — 3010–3012 belong to finlight, owldigest and fitness-tracker.
- The whole app is portable by construction: it is one image and one volume, so moving to any host
  that runs containers is a compose file away.

## Revisit trigger

Sustained traffic that one box cannot serve, a need for real uptime guarantees, or the homelab
ceasing to be where these apps live.
