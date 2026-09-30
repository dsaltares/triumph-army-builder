# 0026 — The front door is My Armies, and its empty state is the pitch

- **Status:** Accepted
- **Date:** 2026-09-21
- **Related:** #138, #109, #140

## Context

`/` was a 307 to `/armies`, so the first thing anyone saw was the index: a search box, a Filters
button, `656 army lists`, and then the oldest armies first, in Meshwesh order, which is
chronological and says so nowhere.

Nothing on that screen told a new player what the app is for, that a list is 48 points, that they
can build without an account, or that Categories is the way in if they know a period but not an
army. The app's own sentence — *"Build, validate and share army lists for the Triumph! historical
miniature wargame"* — existed only in `<meta name="description">`.

A returning player has the opposite problem. They come back to carry on with a list they already
have, and the index is not where that list is.

`/my-armies` already answered both halves better than a new screen would. It is where a returning
player's work lives, and for a player with nothing saved it is already an empty state — the one
place in the app whose job is to explain what to do next. `EmptyState` is an established idiom,
and AGENTS.md already requires that every empty state offer a way out.

## Decision

`/` redirects to `/my-armies`, and the My Armies empty state carries the app's orientation: what
the app is for, that a list is 48 points drawn from one of 656 armies, that an account is optional,
and two ways into the index — **Browse armies** for a player who knows the army they want, and
**Categories** for one who knows the period, the region or the war.

A player who has lists sees those lists first, and never the pitch. `My Armies` carries no standing
description under its `h1`: the orientation belongs to the one state that needs it.

There is no separate landing page. The privacy, terms and cookie links that Google wants on the
homepage are in the footer, which is on every route.

## Alternatives considered

- **A marketing page at `/`.** Somewhere for the app to say what it is, at the cost of a screen
  every returning player has to click past, and a second front door to keep in step with the app.
- **Orientation on the index itself.** Keeps one front door and is less work, but it puts a
  standing explanation above 656 rows for everyone, forever, and still leaves a returning player
  two clicks from their own lists.
- **Redirect on the session.** Signed-in players to `/my-armies`, everyone else to `/armies`. A
  redirect that depends on a session cannot be a static `next.config.ts` rule, and it makes `/`
  uncacheable to serve two audiences the one empty state already serves.

## Consequences

- The root is a personal page, so `/` has no indexable content of its own. Link previews and
  crawlers are served by the root layout's `metadata` and OpenGraph tags, which already carry the
  app's sentence.
- The wordmark in the header now comes back to My Armies, not the index; signing out lands there
  too; and the manifest's `start_url` follows it, so an installed app opens where a browser does.
  All three named the front door, and the front door moved.
- The empty state is load-bearing copy, not a fallback. A change to it is a change to what the
  product says about itself.
- The heading flood on the index — `ArmyRow` gives every army an `<h2>`, so `/armies` publishes 656
  sibling headings — is untouched and filed as #140. It is no longer on the front door, which
  lowers its cost but does not fix it.

## Revisit trigger

A returning player cannot reach the index in one click from `/`, or the empty state grows past the
three short paragraphs it holds now — either means the front door is doing two jobs and wants a
page of its own.
