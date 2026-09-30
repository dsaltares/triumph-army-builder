# 0008 — Curate sub-factions as an overlay keyed on the upstream note string

- **Status:** Accepted
- **Date:** 2026-09-17
- **Related:** #15, #21, #24, `docs/DOMAIN.md` §5

## Context

Meshwesh expresses sub-faction restrictions as free text in `troopOptions[].note`: 125 distinct
strings across 77 army lists, and the same strings again on the `allyArmyLists` records derived
from those armies. There is no structured field, no vocabulary, and no identifier — only prose
aimed at a human reading a printed list. The shapes vary, and the sample pack's invented armies
(`test/fixtures/reference/`) reproduce each: positive (`"Summer or Winter Court"`), negative
(`"not Twilight Court"`, `"all except Summer or Winter Court"`), and mixed with dates
(`"only Ashen after 1400; or Cinder after 1455"`, `"before 800, or except in the Deeps"`).

They are load-bearing. Summing `min × cheapest troop type` over every required troop option gives a
point floor above the 48-point budget for three armies, by 3 to 6 points. A builder that ignores
the notes rejects legal armies for those three and accepts illegal ones everywhere else, because it
never asks which sub-faction is being fielded.

Upstream revises lists continuously (ADR [0003](0003-one-data-version-per-army.md)), and a revision
can reword a note without changing anything else.

## Decision

`lib/data/sub-factions.ts` holds a hand-curated overlay, keyed by list number and sublist letter
(`"66c"`). Each entry declares the army's name, a label for what the choice is (sub-faction,
theatre, campaign, commander, period), an ordered list of variants with stable ids, and one rule
per distinct note string on that army. A rule is `only` — the variants the note admits, each
optionally bounded by `from` / `to` years — or `except`, the variants it rules out. Variant ids are
checked against the entry's own variants at compile time.

The note string is the key. A rule is looked up by the exact trimmed text upstream sends.

`yarn validate:snapshot`, which `yarn build` runs first, fails when a note has no rule, when a rule
matches no note, when a curated army has been renamed or dropped, or when an ally contingent's note
is not curated on the army it derives from.

## Alternatives considered

- **Parse the notes with a grammar at build time.** The 125 strings have no consistent grammar —
  a commander handing over to his son at a given year, with a doubled space, and a plain list of
  places ruled out are not the same language. A parser would need per-string exceptions anyway, and would fail silently on a
  reworded note instead of loudly.
- **Key rules by troop option position.** Terser, but an upstream insertion silently re-points
  every rule after it, and nothing in the data would say so.
- **Ask Meshwesh for a structured field.** Worth asking, but it does not exist today and we
  cannot ship against a promise.
- **Ignore sub-factions, warn on the three broken armies.** ADR
  [0002](0002-warn-dont-block.md) permits warning rather than blocking, but three armies would be
  permanently unbuildable and the remaining 74 would silently offer illegal troops.

## Consequences

- A reworded note is a red build on the refresh pull request (#18), with the army and the old and
  new text in the message. That is the intended failure mode: someone re-reads the note and decides
  what it now means.
- The 125 strings are the audit surface. Re-auditing an army means reading its rules next to the
  upstream list, and the curated army name in each entry is checked against the snapshot so the
  table cannot drift into naming a different list.
- Variant ids become part of a saved army's identity, so they may not be renamed freely; a rename
  is a data version change under ADR [0003](0003-one-data-version-per-army.md).
- Ally contingents carry their parent army's notes, so they resolve against the parent's variants,
  not against a set of their own.
- An uncurated note leaves its troop option available rather than hiding it, so a drifted overlay
  degrades to today's ungated behaviour instead of removing troops from a user's army.
- Armies with no notes have no entry and no variant question, which is 579 of the 656.

## Revisit trigger

Meshwesh publishes a structured sub-faction field, or upstream note churn breaks the build on most
refreshes rather than occasionally.
