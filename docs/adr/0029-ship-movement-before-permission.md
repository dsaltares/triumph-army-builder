# 0029 — Ship Table 5 movement distances before WGC answer

- **Status:** Accepted · basing superseded by [0033](0033-ship-appendix-a-basing-before-permission.md)
- **Date:** 2026-09-23
- **Related:** #150, #53, #54, ADR [0005](0005-public-data-only.md), `docs/DOMAIN.md` §7

## Context

ADR 0005 kept every rulebook-derived number out of the app until Washington Grand Company gave
permission (#53). WGC have not answered. In the meantime the closed beta asked for movement on the
exported sheet (#150): it is the one number a player reaches for at the table that the sheet did
not carry, and a tester offered to give up two combat factor columns to get it.

Movement is one small number from Table 5 per troop type. It is a fraction of the table it
comes from, it says nothing about how the rules use it, and a player still needs the book to play.
Basing — Appendix A base depths and figures per stand — is not part of this request.

## Decision

Ship the Table 5 tactical movement distance for every troop type, as `troopTypeMovement` in
`lib/domain/troop-types.ts`, and show it wherever the sheet goes: the PDF, the shared list at
`/s/[id]` and the plain-text, Markdown and BBCode exports. It is a deliberate call made without
permission, not a reading of silence as consent.

This supersedes ADR 0005. Everything else it covers still stands: basing data stays out, and the
ask in #53 stays open and gets sent.

## Alternatives considered

- **Keep waiting (ADR 0005).** The sheet stays without the number players asked for, for as long
  as WGC take to answer, which may be never.
- **Ask players to type their own values.** Rejected in ADR 0005 for the same reasons: it launders
  the data through the user and makes sheets disagree between installs.
- **Ship basing at the same time.** Nobody asked for it, and it widens what we would have to take
  down.

## Consequences

- The sheet a player carries to the table is complete for movement.
- We are reproducing rulebook data without permission. If WGC object, the values come out in one
  change: they live in one constant, and the sheet field, the column and the text suffix are the
  only readers.
- The ask in #53 now has to mention that movement already ships and offer to remove it.
- Troop type reference pages still do not show movement; that remains #54.

## Revisit trigger

WGC answer #53. A refusal, or any request from WGC to stop, removes movement from the app. An
approval closes the question and promotes basing (#54) to ordinary work.
