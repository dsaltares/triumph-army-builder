# 0040 — A Fantasy Triumph list is named units of identical stands, heroes and army cards

- **Status:** Proposed
- **Date:** 2026-10-09
- **Related:** #13, ADR [0039](0039-a-saved-list-belongs-to-a-game.md), ADR
  [0031](0031-track-a-collection-of-stands.md), ADR [0002](0002-warn-dont-block.md)

## Context

Fantasy Triumph builds an army from stands of any troop type, battle cards bought for stands, for
heroes or for the army, and up to three heroes. The rulebook's unit of reasoning is the **class**:
stands of one troop type carrying identical battle cards. A stand with a different ability must be
modelled so both players can tell it apart, which is to say it is another class. Stand cards do not
stack and may not be bought twice for one stand. Some cards are bought per class (Hold the Line,
Charge Through), some mark particular stands inside the army (Delayed Entry, Mobile Infantry
transports, Marksman), and some are bought once for the army with a count or a variant (Illusion,
Prepared Defenses, Fortified Camp, Ambush). Costs depend on the troop type, the home topography and
the variant, and no stand may end below one point.

A player also needs to say what a unit *is*: *Warg riders* fielded as Javelin Cavalry with Fierce
and Slow. That name is what they bring to the table, and under ADR 0031 it is the text the
collection matches tags against, the role a Triumph! troop option description plays today. A hero
is a figure in the collection too, but it has no troop type, and ADR 0031 gives every entry exactly
one.

## Decision

A Fantasy Triumph selection is:

- the **format**: a points total the player sets, 51 unless changed, the home topography including
  the four dense ones, and the invasion and manoeuvre ratings, each 0–4 with 2 as the unpaid base;
- **units**, each with a stable id, a player-typed name, optional tags, one troop type, a stand
  count, the stand cards bought for it with their variant where the card has one and a short
  free-text note where the card asks for one (Terrain Affinity's two terrains), and the per-stand
  marks the army cards place on it (stands on Delayed Entry, stands with a transport, event cards
  bought for the class); every card on a unit applies to every stand in it;
- **heroes**, each with an id, a name, optional tags, its cards and whether it is on Delayed Entry;
- **army cards** bought for the army as a whole, with a count or a variant;
- the **general**, which names a unit and never a hero.

Tags on a unit or hero are the same short phrases a collection entry carries, and exist only so the
collection can match more than the name.

The points engine prices a unit as stands × max(1, base + Σ card modifiers), a hero as
1 + Σ card costs, and the army cards from their rules, with Delayed Entry a negative army line of
min(2, value) per marked stand or hero so a stand's victory value stays its full cost. The
validator reports the total against the format, the stand minimum (one per six points), the hero
cap (three heroes, eight points), card eligibility by troop type, order, movement and other cards,
per-army card caps and the general's own exclusions, all as findings (ADR 0002).

The collection learns about heroes and games. A collection entry is either **stands** of one troop
type, as today, or a **hero**: a stand of a figure with no troop type, added and counted like any
other stand and told apart by a kind chosen on the same form. Every entry also belongs to a set of
**games**; an entry from before this decision belongs to Triumph! alone, new stands default to
Triumph! and may be kept for either game or both, and a hero belongs to Fantasy Triumph alone.
Triumph! coverage, buildable armies and pins read only the stands that belong to Triumph!. Coverage of a Fantasy Triumph list
raises one demand per unit, matched to stand entries of its troop type whose tags appear in the
unit's name or tags, and one demand per hero, matched to hero entries whose tags appear in the
hero's name or tags. Pins, statuses and the to-buy and to-paint totals work the same for both.

Card codes, cost-rule kinds and constraint kinds are code; every number, name, eligibility list and
rules text is data in the game's pack section.

## Alternatives considered

- **Cards per stand inside a unit.** More permissive, but it adds a second level to costing,
  validation, the sheet and coverage, and the rulebook's own modelling rule says such stands are
  distinct classes anyway.
- **Unnamed units keyed by troop type and card set.** Loses the name players reason in and the
  text coverage matches on, and merges units a player wants kept apart.
- **Heroes as one-stand units of a pseudo troop type.** Breaks every troop-type keyed structure
  (coverage, costs, factors) for an entity that has no stand.
- **Heroes matched to stand entries of any troop type.** Avoids a new entry kind, but a hero figure
  is not a stand, would be double-counted against a unit's demand, and could never be painted or
  pinned as what it is.
- **A fixed 51-point total.** Simpler, but the rulebook names other totals and the stand minimum
  and victory threshold both scale with the total, so the engine has to take it as input anyway.

## Consequences

- Mixed abilities mean two units, and the builder offers *split* rather than per-stand toggles.
- A unit name and its tags travel in the share code and the sheet, so the share budget (ADR 0010)
  has to allow for a few hundred characters of names; the short link is unaffected.
- The collection entry gains a kind and a list of games: `collection_entries.troop_type` becomes
  nullable for hero entries, the trigger from migration 009 only guards stand entries, and new
  triggers keep every entry in at least one game and a hero in Fantasy Triumph alone. The entry
  form offers Stands or Hero and hides the troop type picker for a hero. Buildable armies ignore
  hero entries and stands kept only for Fantasy Triumph.
- Rolling the migration back would lose a hero or a game, so it refuses once any entry is
  anything but Triumph! stands.
- The sheet prints a stand's cost with its cards and the army-card lines separately, because
  victory counts the former and the total counts both.
- Changing the points total re-prices nothing but moves the stand minimum, the hero cap stays
  absolute, and the validator reports against whatever total the format holds.

## Revisit trigger

Fantasy Grand Triumph (#7) applying its per-command limits, which wraps this selection in a command
rather than changing it; or a rulebook edition that lets a card apply to part of a class.
