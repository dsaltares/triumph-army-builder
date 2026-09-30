# 0002 — Validation warns, never blocks

- **Status:** Accepted
- **Date:** 2026-09-17
- **Related:** #23, #24, #37, `docs/DOMAIN.md` §4, §5

## Context

An army is legal or illegal under a dense set of rules: a 48-point cap including battle cards,
per-entry minimums and maximums, all-or-nothing optional contingents, at most one ally troop
option, exactly one general drawn from `troopEntriesForGeneral` and never an ally stand, battle
card availability bounds at both army and troop-option level.

We cannot be certain we have those rules right, and we know the upstream data is not clean:

- Three armies have a minimum point floor above 48 unless date and sub-faction gating are applied,
  and four more cannot reach 48 at maximum (`docs/DOMAIN.md` §5).
- Sub-faction restrictions exist only as 125 distinct free-text `note` strings, which we interpret
  by hand (#15).
- Undocumented values remain open: `core: "half"`, `note: "all"`, and seven `allyOptions` mixing
  both contingent kinds (#19).

A validator that blocks is a validator that must be right. Ours will not always be right, and the
cost of a false positive is that a player cannot record an army that is legal at their table —
while the cost of a false negative is a warning they were free to ignore anyway. Players also
legitimately build illegal armies: work-in-progress lists, painted-collection wishlists, house
rules, and event formats we do not model yet (#57).

## Decision

The validator (#23) returns a structured list of findings — each with
`severity: error | warning | info`, a message, and a pointer to the offending selection. It never
throws and never prevents an action. A list is always saveable, exportable and shareable.

The UI (#37) shows findings in an always-visible panel with a clear legal/illegal badge, and each
finding links to the selection that caused it. The badge states our verdict; the user decides what
to do about it.

## Alternatives considered

- **Block on errors, warn on warnings.** The obvious design, and it puts our worst bug class
  directly in the user's way: a rule we got wrong becomes a wall with no override.
- **Block with an "I know what I'm doing" override.** All of the failure mode, plus a settings
  detour and two code paths to test.
- **No validation at all.** Throws away the main reason to use a builder rather than a spreadsheet.

## Consequences

- Persistence, export and share codecs must accept any selection, including nonsensical ones. They
  serialise selections, not validated armies.
- Findings are data, not exceptions, so the same validator runs in the UI and in the CI harness
  that checks all 656 lists (#24). That harness is how we find the rules we got wrong.
- Legality is presentational state. Nothing downstream may branch on "is valid" to decide whether
  work happens.
- We must invest in message quality. A warning nobody understands is worse than no warning: it
  trains people to ignore the panel.

## Revisit trigger

Evidence that users routinely ship illegal lists to events believing them legal — at which point
the answer is louder presentation of the badge, not a block.
