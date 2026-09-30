# 0037 — Record usage as a first-party event log, viewed in aggregate by admins

- **Status:** Accepted
- **Date:** 2026-09-29
- **Related:** #254, #255, #257, #258, #259, #262, #263, ADR
  [0006](0006-self-hosted-single-container.md), ADR [0007](0007-sqlite-on-a-volume.md), ADR
  [0013](0013-anonymous-armies-in-sqlite.md), ADR [0028](0028-creating-a-list-is-the-explicit-act.md)

## Context

Nobody can see how the app is used. How many accounts there are, how many lists get created and
edited, who signs in and how, which pages and filters players reach for — none of it is recorded
anywhere, and the tables that do exist hold only current state: an `armies` row says a list
exists, not how often it has been touched, and a deleted list leaves nothing behind.

The privacy policy promises *no analytics of any kind*, and the cookie policy that every cookie is
strictly necessary and that the site loads no third-party scripts. Anything we add changes the
first; a third-party script breaks the second.

The budget is zero. The app is one container with one SQLite file on the homelab (ADR 0006, 0007),
and it already knows who is asking: Better Auth resolves the client IP from `IP_ADDRESS_HEADERS`
behind `TRUSTED_PROXIES` for its rate limits, and every write goes through a tRPC procedure or a
Better Auth endpoint with the caller in hand.

An anonymous session is minted on a player's first write and never on page load (ADR 0013). A
list keeps itself on every change (ADR 0028), so "a list was edited" fires far more often than a
player would say they edited it.

## Decision

Every write, every page view and every filter use is a row in `activity_events`, in the app's own
database. There is no analytics platform, no third-party script and no new cookie.

- A write's event is recorded in the **same transaction** as the write, by `recordEvent` in
  `lib/db/`. A failed write records nothing, and a recorded event always describes a write that
  happened.
- `kind` is a closed union in code, validated with zod. A new kind is a code change, never a
  string a client makes up.
- An event carries `user_id` and whether that user was anonymous, the **IP address**, and the
  country, region and city it resolves to. `lib/geo/` does the lookup, in-process, over DB-IP
  Lite City (CC BY 4.0, no licence key), so the address never leaves the server.
- Page views and filter use arrive through a first-party `sendBeacon` endpoint. It records the
  route template, never the full URL or its query; it never mints a session; it honours `Sec-GPC`
  and `DNT`.
- `list.edited` is throttled per list and per user, so autosave records an edit, not a keystroke.
- Events are **kept with no expiry**.
- The log is read only through `admin.stats`, which returns **aggregates**: counts, series and
  top-N breakdowns, split by account and anonymous. No procedure returns a user id, an email or
  an IP, and the dashboard cannot show one player's activity.
- Admins are the verified, non-anonymous accounts whose email is in `ADMIN_EMAILS`.
  `adminProcedure` is the third authorization middleware, beside `signedInProcedure` and
  `accountProcedure`, and refuses everyone else with `NOT_FOUND`, so the dashboard does not reveal
  that it exists.

## Alternatives considered

- **PostHog, free tier.** Funnels, retention and session replay for nothing, and the most capable
  option. It sets cookies, so it needs a consent banner and a rewrite of both legal pages, and it
  sends every player's behaviour to a third party.
- **Cloudflare Web Analytics.** Free and cookieless, and we are already behind Cloudflare. It
  counts page views and nothing else — no writes, no filters, no split by account — and it is a
  third-party script and a second dashboard.
- **Self-hosted Umami or Plausible.** Cookieless custom events on our own hardware, but a second
  service and a second database to run, back up and upgrade, for queries SQLite already answers.
- **Derive the charts from the existing tables.** Totals, yes — and `admin.stats` counts totals
  that way, so they are right from day one. But current state cannot say when something was
  edited, or that it was deleted, or who signed in.
- **Store only the location, or a truncated address.** Less personal data for nearly the same
  charts. We keep the full address so a region can be re-derived with a newer database and abuse
  can be traced; see the revisit trigger.

## Consequences

- One source of truth, in one file, under the same backups as the lists it describes. A chart is a
  `GROUP BY`, and every index on the table has to earn its place in `query-plans.test.ts`.
- Recording is part of every write path. A new write that forgets its event is a gap in the
  charts, so each write's router test asserts its event.
- The privacy policy has to say, before any of this ships, what is recorded, why, for how long and
  who sees it, and credit DB-IP (#263). The cookie policy does not change.
- An IP address and a location, tied to a `user_id` and kept indefinitely, is personal data. We
  hold it on a legitimate interest in running and improving the service, and an erasure request
  has to be served by hand until account deletion exists.
- The table only grows. At the app's scale that is years of headroom, not a problem to solve now.
- The DB-IP database ships in the image and ages with it; a stale one resolves fewer addresses,
  never wrong ones.
- No funnels, cohorts, replay or bot scoring beyond a user-agent check. What we cannot chart from
  a `GROUP BY`, we do not have.

## Revisit trigger

An erasure request arrives, account deletion ships, `activity_events` becomes a noticeable share of
the database file or of a stats query's time, or a question comes up that needs funnels or
cohorts a `GROUP BY` cannot answer.
