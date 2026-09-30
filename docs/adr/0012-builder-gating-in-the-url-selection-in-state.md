# 0012 — Keep the builder's gating in the URL and its selection in component state

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** #31, #44, #46, `docs/DOMAIN.md` §5, ADR [0010](0010-share-codes-are-base64url-json.md)

## Context

The builder cannot show an army until it knows a year and a sub-faction. Both are mandatory rather
than advanced (`docs/DOMAIN.md` §5): 267 of 656 lists have a date-gated troop option, 77 ask a
sub-faction question, and three armies have an ungated minimum above 48 points that only gating
brings under the cap. A builder that opens without them is a builder showing options the army may
not take.

That makes them the two pieces of builder state a player wants to keep and to send: "the Gauls at
60 BC as Belgae" is a starting point worth linking to, and a reload that forgets the sub-faction
throws away the answer everything else was gated on.

The rest of the selection is different. It changes on every tap of a stepper, it already has an
encoding of its own — a versioned base64url share code, 570 characters for a realistic army and 752
for the worst in the snapshot (ADR [0010](0010-share-codes-are-base64url-json.md)) — and it has a
home coming: IndexedDB with claim-on-sign-in (#44) and server-backed short links (#46). Neither
exists yet, and #31 has nothing to select.

The army index already keeps its filters in search params with nuqs, `shallow` and `history:
'replace'`, so the mechanism is in the app and its defaults are understood.

## Decision

`?year=` and `?variant=` hold the gating, through nuqs, in
`components/builder/use-builder-gating.ts`. A bare `/armies/<id>/build` is the army at the first
year it fielded with the sub-faction question unanswered, so neither key appears until the player
touches a control.

Everything else — stands, contingent groups, the general, battle cards — lives in React state in
`components/builder/army-builder.tsx`, and is not persisted at all. The two are composed at read
time by `withGating`, so what the points engine, the validator and the codec see is one
`ArmySelection` carrying its own year and variant, exactly as `lib/domain/army/` defines it.

A `?variant=` the army does not declare is carried into the selection rather than dropped. The
picker treats it as unanswered, and the validator gets to say `unknownSubFaction` (#37).

## Alternatives considered

- **The whole selection in the URL as a share code.** Puts a 600-character base64 blob in the
  address bar and rewrites it on every stepper tap, and the URL would then hold two encodings of
  the year — its own and the one inside the code. #46 wants a short link anyway.
- **Nothing in the URL.** A builder nobody can link to at a year, and a reload that loses the one
  answer the player was asked to give. The pickers are mandatory; losing exactly the mandatory part
  is the worst of the three.
- **Persist to localStorage now.** Invents a persistence model ahead of #44, which decides what a
  saved army is and how an anonymous one is claimed into an account — and would have to be migrated
  to it.

## Consequences

- A builder link reproduces its gating and nothing else, which is what the pickers being
  first-class controls means in practice.
- The selection is lost on reload until #44. There is nothing to lose while #32–#37 are open, and
  the loss is one reload, not one saved army.
- #32–#37 add sections that set the same piece of state. None of them touches the URL.
- Typing in the year field writes an out-of-range year rather than clamping it, so the year can be
  a year the army never fielded — reported, never blocked, per ADR
  [0002](0002-warn-dont-block.md).

## Revisit trigger

#44 gives an army a home: the builder then edits a saved list by id, the year and the variant
belong to that record, and the URL becomes a deep link into it rather than the state itself. Or
#46 needs the full selection in the address bar for anonymous sharing, at which point the code and
these two keys have to be reconciled.
