# 0005 — Ship only publicly available data until WGC grants permission

- **Status:** Superseded by [0029](0029-ship-movement-before-permission.md)
- **Date:** 2026-09-17
- **Related:** #47, #53, #54, `docs/DOMAIN.md` §7

## Context

TRIUMPH! is a commercial rulebook published by the Washington Grand Company. Two kinds of data
exist and they are not the same kind of thing:

- **Public API data.** Everything the Meshwesh API serves — army lists, ally lists, battle card
  rules text, troop type costs, combat factors, categories and orders — is published by WGC
  themselves at `meshwesh.wgcwar.com`, unauthenticated and without a paywall.
- **Rulebook-derived data.** Table 5 tactical movement distances and Appendix A base depths and
  figures per stand appear only in the book. They are not in any API response.

Movement rates matter to players, and we already hold a verified transcription of all 26 of them
(roadmap M8). Transcribing them is a few minutes of work; the question is whether we may publish
them, which is not ours to answer.

## Decision

Ship only what upstream publishes. No rulebook-derived data enters the app — not in the bundle, not
in the UI, not in exports — until WGC say yes (#53).

Schema fields for movement and basing exist from day one and stay unpopulated, so approval is a
data change rather than a refactor (#54). Printed and exported lists omit movement rates and say
nothing about where they went (#47).

The ask is a real ask, not a formality: explain the app, offer attribution and a link to the
rulebook store page, and take no for an answer.

## Alternatives considered

- **Ship the transcription and wait to be told off.** Cheap, and exactly the behaviour that gets a
  hobby project shut down and sours a relationship with a small publisher we would like to work
  with.
- **Ask users to type their own movement values in.** Launders the same data through the user,
  adds UI, and produces an app whose reference tables disagree between installs.
- **Never use rulebook data at all.** Leaves a permanently worse export for no gain if permission
  turns out to be available for the asking.

## Consequences

- The exported list — the thing a player carries to a table — is missing movement rates until this
  is resolved. That is a known, accepted gap, not an oversight.
- The committed snapshot (ADR [0001](0001-snapshot-over-live-api.md)) redistributes WGC's own
  published data. We attribute it and link the rulebook; if WGC ask us to stop, we stop.
- The app is useless without the rulebook, which is the intended relationship: it helps people who
  own the book build armies faster, and it is not a substitute for buying it.
- M8 stays a milestone that may never ship, and nothing on the critical path may depend on it.
- The same conversation is the natural place to ask the Meshwesh maintainers the open data
  questions in #19.

## Revisit trigger

WGC answer #53, either way. A refusal makes this permanent and M8 gets closed; an approval promotes
#54 to ordinary work.
