# 0033 — Ship Appendix A basing before WGC answer

- **Status:** Accepted
- **Date:** 2026-09-28
- **Related:** #53, #54, ADR [0029](0029-ship-movement-before-permission.md), `docs/DOMAIN.md` §7

## Context

ADR 0029 shipped Table 5 movement ahead of Washington Grand Company's permission and kept basing
out, because nobody had asked for it. Now someone has: the troop type popover in the builder is
where a player checks what a stand is, and the next question after its factors is how to base it —
how deep the base is at the width they play and how many figures go on it. WGC still have not
answered #53.

Basing is Appendix A of the rulebook: a base depth for each of the standard widths and a figure
count per stand, for every troop type. Like movement, it says nothing
about how the rules use it, and a player still needs the book to play.

## Decision

Ship Appendix A basing as `troopTypeBasing` in `lib/domain/troop-types.ts`, transcribed from the
rulebook PDF, and show it in the troop type popover. It is a deliberate call made without
permission, not a reading of silence as consent — the same one ADR 0029 made for movement.

This supersedes the part of ADR 0029 that kept basing out. The ask in #53 stays open.

## Alternatives considered

- **Keep waiting (ADR 0029).** The popover stays without the number players reach for when they
  paint and base, for as long as WGC take to answer.
- **Ask players to type their own values.** Rejected in ADR 0005: it launders the data through the
  user and makes installs disagree.

## Consequences

- A player can base a new unit from the builder without opening the book.
- We reproduce more rulebook data without permission. If WGC object, basing comes out in one
  change: it lives in one constant, and the popover is its only reader.
- The ask in #53 now has to mention that movement and basing ship and offer to remove both.

## Revisit trigger

WGC answer #53. A refusal, or any request from WGC to stop, removes basing and movement from the
app.
