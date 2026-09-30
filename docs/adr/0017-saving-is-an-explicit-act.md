# 0017 — Saving a list is an explicit act, not an autosave

- **Status:** Superseded by [0028](0028-creating-a-list-is-the-explicit-act.md)
- **Date:** 2026-09-19
- **Related:** #44, #45, ADR [0013](0013-anonymous-armies-in-sqlite.md)

## Context

The builder holds its selection in React state and persists nothing (ADR
[0012](0012-builder-gating-in-the-url-selection-in-state.md)). #45 gives it somewhere to go, which
forces the question the builder has avoided so far: when does a list become a row?

A logged-out player's first write mints an anonymous user (ADR
[0013](0013-anonymous-armies-in-sqlite.md)). That is what makes the app usable without an account,
and it is also the thing the hygiene measures in #44 exist to contain — a per-IP limit on
`/sign-in/anonymous`, a cap of 20 lists per record, and a retention sweep. Every one of those is
sized on the assumption that a row means a player meant to keep something.

The builder is a page people open to look at an army. 656 army lists are crawled and linked, and
tapping a stepper to see what a troop type costs is browsing, not saving.

## Decision

A list is saved when the player presses **Save list** and names it, and never before. The control
is a button on the page header's title line, where the army detail page puts **New list**, and it
becomes **Save changes** once the list has a record — disabled, reading **Saved**, when the record
already matches what is on screen. `encodeSelection` from the share codec is what answers that question: it is the one
canonical form of a selection the app already has, so two selections are the same when their codes
are.

Nothing about the act is different for an anonymous player. The first save mints their session, and
the per-browser prompt #44 raises is the answer to what that means.

## Alternatives considered

- **Autosave on every change.** Mints an anonymous user for anyone who taps a stepper, turns idle
  browsing into rows, and spends the 20-list cap on lists nobody chose to keep. It also needs a
  name before the player has thought of one, and a debounce on club wifi is a write queue we would
  then have to reason about.
- **Autosave once, on the first change, then save silently after that.** Still mints a record from
  browsing, and leaves the player unable to say *no, not this one*.
- **A save prompt on leaving the page.** `beforeunload` is unreliable on mobile, cannot be styled,
  and asks the question at the one moment the player has already decided to go.

## Consequences

- An unsaved list is still lost on reload, exactly as before. The builder says so, in the same
  control that fixes it.
- The dirty check is a string comparison of two share codes on every render. It is bounded by the
  codec's 800-character budget, and it means the button can never claim a list is saved when the
  record says otherwise.
- Anonymous rows stay proportional to intent, so the cap and the sweep keep the meaning #44 gave
  them.

## Revisit trigger

Offline editing (#52) queues writes and has to decide what a queued write is without a button
press. Or telemetry showing players losing work they expected to be kept — at which point the
answer is probably a draft that survives reload, not an autosaved row.
