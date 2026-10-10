# Triumph! Army Builder — Domain Reference

Ground truth for implementers: the shape of the Meshwesh data (`https://meshwesh.wgcwar.com/api/v1/`),
the traps in it, and what the domain layer does about each one.

Read this before touching the domain layer. Several fields are misleadingly named.

The app builds lists for two games. §1–§9 are **Triumph!**, the historical game, whose lists are
drawn from Meshwesh army lists. §10 is what a game is to the app, §11 is **Fantasy Triumph**, which
keeps Triumph!'s troop types and builds an army freely from them, and §12 is the collection, which
covers a list of either game.

The examples are the sample pack's invented armies (`test/fixtures/reference/`), which is built so
that each trap below has one army that shows it. Nothing here quotes the rulebook or a real army
list: a rule is described in our own words, with its section number where that helps. Where this
says the data never or always does something, a `*.test.ts` pins it on the sample pack and its
`*.real-data.test.ts` twin under `real-data/` pins it over the real snapshot, so a refresh that
breaks it fails CI in the data repo.

## 1. Data sources

All endpoints are public, unauthenticated, and return JSON. **None send CORS headers**, so the
browser cannot call them directly — the data repo vendors a snapshot, and the app reads it from
its database (ADR [0034](adr/0034-reference-data-lives-in-sqlite-served-over-trpc.md)).

| Endpoint | Notes |
|---|---|
| `/api/v1/armyLists` | Full list bodies, a few megabytes. |
| `/api/v1/armyLists/:id` | Same shape as a collection entry. No enemies. |
| `/api/v1/armyLists/:id/enemyArmyLists` | Enemies, **only** available per army. |
| `/api/v1/allyArmyLists` | Contingent bodies referenced by `allyOptions`. |
| `/api/v1/battleCards` | 27 cards, full rules text as `mdText` + `htmlText`. |
| `/api/v1/troopTypes` | 26 troop types: cost, combat factors, category, order. |
| `/api/v1/thematicCategories` | Name + id only. |
| `/api/v1/thematicCategories/:id/armyLists` | Category membership, **only** available per category. |

## 2. The army list shape

```
ArmyList
├── name, listId, sublistId, status, keywords[]
├── derivedData { extendedName, listStartDate, listEndDate }
├── dateRanges[]              exactly 1 per army
├── invasionRatings[]         usually 1, up to 3 (each with an optional note)
├── maneuverRatings[]         usually 1, up to 3
├── homeTopographies[]        values[] — Arable|Dry|Delta|Hilly|Forest|Steppe|Marsh
├── troopOptions[]            ← "Required Troops" section
├── troopEntriesForGeneral[]  ← which troop types may be the general
├── allyOptions[]             ← BOTH Optional Contingents AND Ally Troop Options
└── battleCardEntries[]       ← army-wide battle cards
```

### TroopOption

```
TroopOption
├── min, max                  number of STANDS
├── troopEntries[]            1..3 troop types
│   └── note                  ← "all" CANCELS THE FREE MIX, free text otherwise
├── dateRanges[]              empty = always available
├── description               flavour text, no rules effect
├── note                      ← SUB-FACTION RESTRICTION, free text
├── core                      ← BATTLE LINE, not "core troops"
└── battleCardEntries[]       cards attachable to these stands
```

## 3. Naming traps

**`core` is the Battle Line column.** Appendix E of the rulebook defines the column as whether the
stands from a troop entry are part of the battle line: all of them, or none.

| `core` value | `battleLine()` | Meaning |
|---|---|---|
| `"all"` | `'all'` | All stands are battle line |
| `""` | `'none'` | None are battle line |
| `"half"` | `'half'` | Half the stands are battle line — rare, see below |

Battle line matters at deployment only (9.2). It does not restrict army construction — but it
**must appear on the exported list**, because the player needs it at deployment time.

What consumes it is centre deployment (27.1, 27.2): a player must put a minimum of points in the
centre third, drawn in a fixed priority order that starts with the battle line. So the marking
decides what a player is *forced* to put in the centre. It can never make an army legal or illegal,
which is why the builder carries it without computing on it. Some battle line options list
Skirmishers among their troop types, and the rulebook drops those stands down the priority order.

### `core: "half"`

Upstream uses it once. In the sample pack it is Mammoth Clans' *Tusker outriders*, 4–10 Horse Bow,
and it propagates to the Mammoth Clans ally list.

It is deliberate, not a typo. Meshwesh imports its lists from a spreadsheet whose Core column takes
exactly `Core`, `Half Core` or blank, mapped to `all`, `half` and `""`; anything else logs a
warning and is discarded (`troopOptionsImportController.js` in
[ElJocko/meshwesh](https://github.com/ElJocko/meshwesh)). The Meshwesh explorer renders the three
as `all`, `half` and an en dash. Meshwesh's **PDF export does not** — it prints `-` for everything
that is not `all`, so upstream's own PDF silently understates that one army. We follow the
explorer.

It means half the stands taken from that entry are battle line. Nothing else fits: Appendix E
documents only all and none, and on a horse-archer army *all* would force its light horse wholesale
into the centre third and leave it no flanks.

**Open question, deliberately unresolved:** what happens on an odd number of stands. Neither the
rulebook nor Meshwesh specifies the rounding, and inventing one would be inventing a rule. Since
battle line has no construction effect, nothing in the builder needs the number — we print "half"
and leave the arithmetic to the player at the table.

**Multi-type troop entries are a free mix, not an either/or.** Appendix E: when an entry lists two
or more troop types, any mix of them may be taken, and the minimum and maximum apply to all of them
together. Most entries have one troop type, a few hundred have two, and a handful have three.

### `troopEntries[].note === "all"`

The entry note is a per-alternative annotation, and `"all"` cancels that free mix: every stand
taken from the option must be the same one of the listed types. The import splits a spreadsheet
cell like `[all] Pikes or [all] Light Spears or [all] Heavy Foot` on `" or "` and lifts each
`[…]` into the entry's `note`; the PDF prints it straight back as `Pikes [all]`. The field is free
text, and `all` is the only value upstream has ever used, on a couple of dozen entries.

Two properties of the data make the reading hard to argue with, and `troop-options.test.ts` asserts
both, so that a new annotation vocabulary fails CI:

- it never lands on a single-type option, where there would be nothing to cancel;
- it is never on a subset of an option's entries — every annotated option carries it on *all* of
  its entries, which is exactly what splitting one annotated cell produces.

The descriptions agree: each annotated option is one body of troops modelled one way or the other,
not a blend of the two. Sylvan Courts' *Glade wardens, with bow or with tall shield* (Archers or
Pavisiers) is the sample's.

`troopTypeMix()` returns `'singleType'` for these and `'anyMix'` for everything else;
`troopTypeChoices()` turns that into the sets a selection may draw from.

**`allyOptions` holds two different rules concepts,** discriminated by `internalContingent` on the
referenced `allyArmyLists` record:

| `internalContingent` | Rulebook concept | Selection rule |
|---|---|---|
| `true` | **Optional Contingent** | All-or-nothing set. **Any number** may be taken. Troops are part of the main army. |
| `false` | **Allied Contingent** | All-or-nothing set. **At most ONE** Ally Troop Option across the whole army. |

The reading is verified against the rulebook's own worked example, whose army prints no optional
contingents and two Ally Troop Options, and whose data has exactly two `allyOptions`, both
`internalContingent: false`. In the sample pack, Hollow Necropolis offers two optional contingents
and Goblin Warrens one Ally Troop Option.

The flag sits on the *entry*, the selection rule on the *option*. `allyOptionKind()` bridges them:
an option naming at least one allied contingent is an **Ally Troop Option** and spends the army's
single ally slot; an option naming only optional contingents does not. Ally troop options
outnumber optional contingents by about twenty to one.

An `allyOption` with 2 `allyEntries` means **both are taken together**. Where both are allied,
each still counts as its own allied contingent: Appendix E says a pair taken together is still two
distinct allied contingents. Iron Crown Knights' *Stonehold dwarf allies* with *Goblin allies* is
the sample's.

### `allyOptions` that mix both flags

A few options name one of each, all in a couple of armies. The sample's is Iron Crown Knights,
which pairs *Sylvan allies* with its own *Crown militia*.

They are not a third concept. The import emits one option per element of the Cartesian product of
the row's two ally columns, so a two-entry option means "both of these together" whatever the two
turn out to be. Classify each entry on its own and the rule above already covers them: a mixed
option is an Ally Troop Option that also hands over an optional contingent.

They also carry no information. Every one is **redundant** — each component is offered again as
its own single-entry option over a date range that contains the mixed option's, and because an
optional contingent does not compete for the ally slot, taking the two singles is equivalent to
taking the pair. Upstream leans on this: the Meshwesh explorer lifts any internal contingent into
the Optional Contingents panel and then drops the whole option from Ally Troop Options, discarding
the ally half — which is why it lists the same optional contingent several times over. The builder
offers contingents and allies separately and does not surface the pairs, which is what
`optionalContingentGroups` and `allyTroopOptionGroups` in `lib/domain/army/army-list.ts` do.

`ally-options.test.ts` asserts the redundancy rather than a count, so a mixed option that is *not*
reachable from the single-entry options fails CI.

The two-entry options where both entries are allies are the opposite case: a second allied
contingent is unreachable any other way, so those options are the only thing authorising it and
must be kept as a unit.

A few of those name the **same** contingent twice — Iron Crown Knights' *Goblin allies* with
*Goblin allies* in the sample. A contingent is identified by the ally list it derives from, so
`contingentsOf` and `selectedContingents` key on that id and both entries resolve to one
contingent with one set of troop options. Upstream means two distinct allied contingents drawn
from the same list; the second is unreachable, because a selection records stands per troop option
and the same option cannot be filled twice. None of the real armies that offer one needs it: all
of them build to 48 points without it (§9).

## 4. Army construction rules

- **48 points total, battle cards included** (5.1, 10.2).
- Each stand costs 2, 3 or 4 points by troop type (12.1).
- **One stand must be designated the general** (8.1), chosen from `troopEntriesForGeneral`.
- **Allied contingent stands may not be the general, and may not garrison the camp** (11.2).
- Every army has **one camp** (16.1).
- Optional Contingent troops are treated exactly like Required Troops once selected.
- Selecting an Optional Contingent or Ally Option **does not** change Required Troops min/max.
- **A saved list, a share and a share code name their game** (ADR 0039, §10). Everything in this
  section and the next is the Triumph! game's; Fantasy Triumph builds differently (§11).

### 4.1 What the validator reports

`validateArmy(armyList, selection, costs, names, rules)` in `lib/domain/army/validation.ts` answers
with findings and nothing else: it never throws, never rejects a selection and never blocks an
action (ADR [0002](adr/0002-warn-dont-block.md)). Each finding carries a `code`, a `severity`, a
message and a `target` pointing at the selection that caused it — the army, the year and
sub-faction, a contingent group, a troop option, the general, or one battle card at either scope.
It resolves the army list itself, from the year and variant the selection already carries (§5), so
nothing can validate against different gating than it displays. It takes `names` as well as
`costs` because the message is read by a player rather than parsed: a finding says *Chariots needs
at least 2 stands*, the name the rest of the app prints, never the `CHT` the data carries.

| Finding | Severity | Rule |
|---|---|---|
| `overPointsCap` | error | the total, battle cards included, is above the cap |
| `underPointsCap` | warning | points left unspent |
| `yearOutsideArmyDateRange` | error | the army was not around in the year it is being built in |
| `subFactionNotChosen` | warning | the army asks a sub-faction question the selection has not answered, so every option depending on it stays withheld |
| `unknownSubFaction` | warning | the variant is not one this army declares |
| `unknownContingentGroup` | warning | the selection takes a contingent the army does not offer |
| `contingentGroupUnavailable` | error | the contingent is not offered in the chosen year |
| `multipleAllyTroopOptions` | error | more than one Ally Troop Option, reported against each of them |
| `troopOptionBelowMin`, `troopOptionAboveMax` | error | stands outside an option's min and max, counted across all of its troop types together |
| `troopOptionMixedTypes` | error | an option whose entries are annotated `all` (§3) drawn from more than one troop type |
| `troopOptionUnavailable` | error | stands in an option the year or the sub-faction has gated away |
| `contingentNotTaken` | info | stands or cards left against a contingent the army has not taken |
| `unknownTroopOption` | warning | the selection fills an option the army does not have |
| `generalMissing`, `generalStandMissing` | error | no general, or a general that is not one of the army's stands |
| `generalFromAlliedContingent` | error | 11.2 — an allied stand can never be the general |
| `generalTroopTypeNotAllowed` | error | the general's troop type is not one of `troopEntriesForGeneral` |
| `battleCardUnavailable` | error | a card the army, or that troop option, is not offered |
| `battleCardBelowMin`, `battleCardAboveMax` | error | the allowance bounds — copies army-wide, stands per troop option, one purchase for a card bought for the whole entry (§6.1) |
| `battleCardStandsExceedOption` | error | a card applied to more stands than the option holds, or bought for an option holding none |
| `battleCardPurchaseLimit` | error | Hold the Line's card text caps how many an army may buy |
| `battleCardNeedsPairsOfStands` | error | Separated Valets goes on pairs of stands, so an odd number is wrong |
| `battleCardForbidsTroopType` | error | an army with Elephant Screen may field no elephant stands |

Six readings are ours rather than the rulebook's:

- **Over the cap is an error, under it a warning.** An army short of 48 points breaks no rule; it
  is almost always a list still being built, and a builder that shouts at every intermediate state
  is a builder people stop reading.
- **A dangling reference is never an error.** Stands against an untaken contingent are `info`
  because the points engine does not count them (§6.2) and the army is legal as it stands; an
  option or a group the army does not have at all is a `warning`, because it means the selection
  was built against another `dataVersion` (ADR [0003](adr/0003-one-data-version-per-army.md)) and
  something the player chose is missing from what they see.
- **All-or-nothing is not a finding.** A selection takes a contingent *group*, never a contingent
  out of one, so a half-taken group cannot be represented. What the validator checks instead is
  that a taken group's own troop option minimums are met, and it checks nothing at all about an
  untaken one.
- **The ally slot counts groups, not contingents.** An option bundling two allied contingents (§3)
  is one group and spends one slot: the two stay distinct, but they arrive in one choice.
- **An optional contingent stand may be the general.** Its troops are part of the main army, so the
  only checks that apply are the troop type and the allied-contingent ban.
- **The cap is a rule, not a constant.** `triumphRules` in `lib/domain/games/triumph-rules.ts` is
  `{ pointsCap: 48 }`, the Triumph! module's `rules`, and the fourth argument takes any other, which is the seam Grand Triumph (#55) and event profiles (#57) extend.

## 5. Gating: date and sub-faction

Both are mandatory. Without them the builder cannot correctly construct a large fraction of armies.

**Date gating** — `troopOptions[].dateRanges`. About two armies in five have at least one
date-gated option, and an army's span runs from a single year to millennia. The user must pick a
year.

**Sub-faction gating** — `troopOptions[].note`, free text only, on about one army in eight. The
sample's are `"Summer or Winter Court"`, `"all except Summer or Winter Court"`,
`"not Twilight Court"`, `"only in the Deeps"` and `"only at the Moonfall"`. The same strings
reappear on the `allyArmyLists` records derived from those armies, where they mean the same thing.

The curated overlay under `curation/sub-factions.json` turns them into a choice (ADR
[0008](adr/0008-sub-faction-overlay-keyed-on-the-note-string.md)). Each curated army declares an
ordered set of variants and one rule per note string:

| Form | Note | Rule |
|---|---|---|
| Positive | `"Summer or Winter Court"` | `{ only: ['summer', 'winter'] }` |
| Negative | `"all except Summer or Winter Court"` | `{ except: ['summer', 'winter'] }` |
| Positive, dated | `"only Ashen after 1400; or Cinder after 1455"` | `{ only: [{ variant: 'ashen', from: 1401 }, { variant: 'cinder', from: 1456 }] }` |
| Mixed | `"before 800, or except in the Deeps"` | `{ only: [{ variant: 'deeps', to: 799 }, 'other'] }` |

What the choice *is* varies — sub-faction (Sylvan Courts' court), theatre (Tidewrack Corsairs'
`"only in the Deeps"`), campaign (`"only at the Moonfall"`), commander (Mammoth Clans'
`"only if  Grask before 1405 or his son Urm after"`) or period — so each entry carries a label for
the question to ask. Armies whose notes do not exhaust the list get a residual variant, which is
what the negative forms select.

The overlay is keyed on the note text, so an upstream rewording fails `yarn data:pack` rather than
silently dropping a restriction. An uncurated note leaves its option available.

### Proof these are load-bearing

Computing the minimum point floor (sum of `min × cheapest troop type`) for every list:

| Army | Ungated floor | Resolved by | Gated floor |
|---|---|---|---|
| Sylvan Courts | **56 pts** | sub-faction only — the Summer Court (`"Summer or Winter Court"` vs `"all except Summer or Winter Court"`) | 36 pts |
| Sunspire Dominion | **58 pts** | date gating — 2150 BC | 46 pts |
| Tidewrack Corsairs | **56 pts** | date + sub-faction — any other anchorage in 750 AD | 34 pts |

The real snapshot has one army of each kind. With both mechanisms applied, no variant of any army
at any year has a floor above 48, which `sub-factions.test.ts` asserts over every combination. A
validator that ignores gating will reject legal armies and accept illegal ones.

A few armies still cannot reach 48 points from required troops at their maximum. Gating does not
fix that and is not meant to: they reach 48 through optional contingents, which the harness in §9
builds for them. Hollow Necropolis is the sample's — its required troops top out at 36, and its
*Grave-wight retinue* makes up the rest.

More than half the armies need neither mechanism and are "simple".

### Resolving availability

`lib/domain/army/availability.ts` turns `(armyList, year, variant)` into what the army may
actually take. `resolveArmyList` returns the same `ArmyList` with everything the pair rules out
removed, so the points engine, the validator and the UI never re-derive gating.

| Subject | Gated on |
|---|---|
| Required troop options | `dateRanges` (empty = always) and the sub-faction rule keyed on `note` |
| Ally options | `allyOptions[].dateRange` (null = always) |
| A contingent's own troop options | their `dateRanges`, and nothing else |
| Army-wide battle cards | nothing — they carry no dates |
| Troop option battle cards | the troop option they hang off |

A noted option whose rule is curated stays withheld until a variant is chosen, which is why the
year and sub-faction pickers are first-class controls rather than advanced options (#31). An
uncurated note leaves its option available, as above.

**A contingent's own `dateRange` never gates it.** That range is the span of the army list the
contingent derives from, not of the alliance: most ally entries disagree with the range on the
option that offers them, and some are disjoint from it. Upstream says as much in the name of at
least one entry, which notes that going beyond its ally's end date is deliberate.

**A contingent's sub-faction is never asked for.** The notes on a contingent's troop options
belong to the army it derives from, not to the army taking it — the Sylvan Courts ally list carries
both `"Summer or Winter Court"` and `"all except Summer or Winter Court"`, which are a question
about the Sylvan Courts, not about whoever takes them as allies. Nothing asks which sub-faction an
ally is, so every one of those options stays available and the validator (§4.1) may see two
options offered together that upstream means as alternatives. Asking the question per contingent
is a builder decision, not an availability one.

`allyOptions[].note` is empty in every option, so an ally option needs no sub-faction rule; a test
asserts it stays empty rather than assuming it.

**One upstream slip, asserted rather than worked around.** One real contingent may be taken for a
year after its only troop option ends, so in that year it has nothing to offer. It is the only
contingent that empties out inside the years it may be taken, and `availability.test.ts` pins that,
so a refresh that introduces a second one fails CI. The sample reproduces it: Hollow Necropolis may
take *Bog-risen or Barrow-kin* until 70 BC, but its one troop option ends in 71 BC.

## 6. Battle cards

27 cards: 7 `category: "army"`, 20 `category: "troop"`.

Availability is expressed twice:
- `armyList.battleCardEntries[]` — army-wide cards
- `troopOption.battleCardEntries[]` — cards attachable to specific stands

Both carry optional `min`/`max`. Most are `(null, null)` meaning unbounded; where set, min is
always 0.

**`mdText` uses four constructs and no more.** Across all 27 cards the rules text is paragraphs,
`####` headings, `-` bullets and `*single-asterisk*` emphasis — no links, tables, code, block
quotes or numbered lists, and never a heading at another level. `lib/markdown.ts` parses exactly
that subset, and its tests assert against the snapshot both that nothing else appears and that no
line is dropped, so an upstream card that starts using a fifth construct fails CI rather than
quietly rendering as literal text.

**Costs are prose, not data.** There is no cost field anywhere in the API. Read from the
`#### Cost` section of `mdText`, the 27 cards come in these shapes:

| Shape | Cards |
|---|---|
| Flat, one point | AM, FC, PT, CF, DD |
| Flat, two or three points | ES, ET, MD, SC, NC |
| Per stand | SS, PL |
| Per card, fractional | PD |
| Per card, capped | CT |
| First free, then flat | HL, MI |
| Free | SW, CH, HD, LC, SV |
| **Modifies stand cost** | AC, CC, SF |
| Conditional, from what the card lets the army do | DC |
| Zero for the card, the cost paid elsewhere | SB, SP |

The last three shapes mean **the cost engine cannot be a lookup table** — battle cards can change
the cost of stands. `lib/domain/battle-cards/cost-rules.ts` holds the typed rules and
`costRulePoints`; `curation/battle-card-costs.json` holds one entry per card, and `buildBundle`
puts its `purchasedPer` and `rule` on `battle-cards.json`, where `battleCardCosts` in
`lib/domain/battle-cards/costs.ts` reads them. Every entry quotes the `mdText` lines it was derived
from, and a test asserts those lines are still present in the snapshot — an upstream reword fails
CI instead of silently going stale.

`costRulePoints` returns the points a card adds to the **army** total, so it is negative for the
three stand-cost modifiers: AC and CC take a point off each stand they are applied to, SF sets
theirs to 3½. `flat` and `perCard` evaluate identically; they are kept apart because the rulebook
phrases them differently and only the per-card form is ever fractional.

Six things in the `#### Cost` prose are deliberately *not* priced the way they read:

- **Hold the Line caps how many cards an army may buy.** CT's cap is on points and is part of its
  rule; HL's is on cards and belongs to the validator (§4.1).
- **SB and SP cost nothing.** The bowman stands that must be exchanged are already counted in the
  army total, so the exchange is an availability rule, not a price.
- **DD and MD say to count a dismounting stand as the dearer of its two troop types.** Uncomputable:
  `dismountTypeCode` is null in every occurrence (§7).
- **MI is priced per troop entry** — nothing for one stand, a point for two or more. The rule
  counts the stands it is handed, so it is the points engine that hands it one troop option at a
  time (§6.2).
- **SF can make a stand dearer.** It sets every stand it is on to 3½, and it is all-or-none, so an
  entry mixing a 4-point and a 2-point stand pays *more* for the cheap one. That is the rule as
  written; the card is offered to cavalry, where it never bites.
- **ET costs nothing; ES carries the price.** Both halves of the elephant screen repeat the same
  `#### Cost` prose, exactly as SB and SP do, because the pair describes one purchase: the cards
  label which elephants screen and which troops may be screened. Every army that offers either
  offers both, so pricing both would charge an elephant screen twice.

### 6.1 What one purchase covers

`purchasedPer` on each curated entry says what a single purchase buys, because the cost rules count
purchases and the rulebook does not put them all in the same place:

| `purchasedPer` | Cards | Reading |
|---|---|---|
| `army` | the 7 army cards, and DD, MD, ES, ET | one purchase covers the army, however many troop options it is applied to |
| `troopOption` | the other 16 troop cards | one purchase per troop option it is applied to |

DD and MD say outright that one purchase lets every eligible troop entry in the army dismount, and
the elephant screen is offered to the army rather than to a troop entry. HL and CT are the
opposite: each is bought for every stand in one troop entry, never for a single stand, so an army
buying HL on three entries has bought three cards and pays 0 + 1 + 1.

`purchasedPer` says how many purchases a selection makes; `boughtForTheWholeTroopEntry` says what
the number recorded against a troop option **counts**, and seven cards say in their own text that
one of them covers a whole entry (#130):

| Cards | What their text says | What the number counts |
|---|---|---|
| HL, CT | the card is bought for every stand in the entry, not for one stand | battle cards, each covering the entry |
| SS, AC, CC, SF, CH | the card goes on every stand of the entry or on none of them | one purchase, covering the entry |

`wholeTroopEntryCardsPerArmy` separates the two: a cap per army for HL and CT, and `null` for the
all-or-none five, which are bought once per entry and may be bought on as many entries as offer
them. Both kinds cover **every stand the option holds**, so the points engine reads the entry's
stand count rather than the number in the selection — which is what makes all-or-none a rule the
selection cannot break rather than a finding, the same way a half-taken contingent group cannot be
represented (§4.1). Every other troop card counts stands, and `appliedPerStand` is the question the
builder asks to pick the stepper's unit, its limit and the words a `battleCardStandsExceedOption`
finding uses.

Because a whole-entry card is priced from the stands the entry holds rather than the stands it was
bought with, changing a troop option's stands reprices its cards; nothing needs to be kept in step
by hand. `feasibility.ts` knows this too: a per-stand card it can top an army up with is an
all-or-nothing lump of the entry's stands, not a stand at a time.

### 6.2 Order of operations

`lib/domain/army/points.ts` totals an army in a fixed order, and its test asserts the breakdown is
identical however the selection was assembled:

1. **Stands.** Every stand in a *selected* contingent costs its troop type's cost. Stands and cards
   recorded against a contingent the army has not taken are not priced, so deselecting an ally
   contingent cannot leave points behind.
2. **Stand-cost modifiers.** AC, CC and SF are allocated to the stands of the troop option they are
   applied to, dearest stand first, in card-code order, and **each stand is modified at most
   once** — a stand carrying both camelry cards is a point cheaper, not two. A card applied to more
   stands than the option holds modifies only the stands that are there. The allocation is needed
   because the selection records how many stands a card is applied to, not which ones, and a troop
   option may mix troop types of different costs.
3. **Battle cards.** Every other card is priced from its purchases. A rule that counts *cards* — PD,
   CT and HL — is evaluated once over the army's purchases of that card; every other rule is
   evaluated per purchase and summed, which is what prices MI per troop entry. DC counts one
   declared deception per army-level copy and one per stand it is applied to.

The total is the stand points plus the battle card points, so a stand-cost modifier appears as a
negative battle card line rather than as a cheaper stand. Nothing here caps the total at 48; that
is the validator's job (§4.1).

Some cards also carry exclusions in prose — Fortified Camp and Pack Train and Herds may both be
bought, but only one used in a battle. That is a play-time restriction, not a construction one, and
the builder does not check it.

## 7. Troop types

All 26, with cost and combat factors, are public API data. Movement is **not** — it comes from the
rulebook and ships ahead of WGC's permission (ADR [0029](adr/0029-ship-movement-before-permission.md))
as `curation/movement.json`. Appendix A basing — a base depth at each standard width and the
figures per stand — ships the same way (ADR [0033](adr/0033-ship-appendix-a-basing-before-permission.md))
as `curation/basing.json`. `buildBundle` puts both on `troop-types.json`, and both are optional: a
troop type without them reads `—` on the sheet, in the text exports and in its popover, which is
also how they come out if WGC refuse (#53).

| Code | Name | Cost | Category | Order |
|---|---|---|---|---|
| ARC | Archers | 4 | foot | Open |
| ART | Artillery | 3 | foot | Close |
| BLV | Bow Levy | 2 | foot | Open |
| EFT | Elite Foot | 4 | foot | Close |
| HFT | Heavy Foot | 3 | foot | Close |
| HRD | Horde | 2 | foot | Close |
| LFT | Light Foot | 3 | foot | Open |
| LSP | Light Spear | 3 | foot | Open |
| PAV | Pavisiers | 4 | foot | Close |
| PIK | Pikes | 3 | foot | Close |
| RBL | Rabble | 2 | foot | Open |
| RDR | Raiders | 4 | foot | Open |
| SKM | Skirmishers | 3 | foot | Open |
| SPR | Spear | 4 | foot | Close |
| WBD | Warband | 3 | foot | Open |
| WRR | Warriors | 3 | foot | Close |
| WWG | War Wagons | 3 | foot | Close |
| BAD | Bad Horse | 3 | mounted | Open |
| BTX | Battle Taxi | 3 | mounted | Open |
| CAT | Cataphracts | 4 | mounted | Close |
| CHT | Chariots | 4 | mounted | Open |
| ECV | Elite Cavalry | 4 | mounted | Open |
| ELE | Elephants | 4 | mounted | Close |
| HBW | Horse Bow | 4 | mounted | Open |
| JCV | Javelin Cavalry | 4 | mounted | Open |
| KNT | Knights | 4 | mounted | Open |

`dismountTypeCode` exists on every troop entry but is **null in every occurrence**. Dismounting is
handled by the Deployment Dismounting / Mid-Battle Dismounting battle cards instead. Keep the field
in the schema, ignore it in the UI.

## 8. Data hygiene issues

- `homeTopographies[].values` have inconsistent whitespace: `" Arable"`, `"Arable"`, `"Hilly "`,
  `" Hilly "`. Normalise on ingest.
- `status` is `Revised`, `Ready` or, on at least one list, `DRAFT`.
- Some `allyArmyLists` records have no `armyListId` — standalone contingents with a `sublistId`
  late in the alphabet, not derived from a playable army list. The key is absent, not null; the
  sample pack sends `null` for Stonehold Dwarves and its internal contingents, which ingest treats
  the same.
- `listId` and `sortId` are **not integers**. A few army and ally lists carry fractional values,
  such as `42.5`, which is how upstream inserts a list between two existing ones without
  renumbering. They order the lists; `id` identifies them.
- The enemy graph is symmetric — every edge appears from both ends — and **more than half the lists
  name themselves as an enemy**, which is a legitimate pairing, not a data error. A few lists have
  no enemies at all.
- Some army-level `battleCardEntries` omit `min` and `max` entirely rather than sending `null`. The
  troop-option-level entries always carry both keys.
- Upstream lists are revised over time. Every saved army must record the data snapshot version it
  was built against — `dataVersion`, `YYYY-MM-DD.<hash8>`, stamped into the snapshot's
  `manifest.json` by the sync and only ever changed by a change in the data itself. See ADR
  [0003](adr/0003-one-data-version-per-army.md).

Ingest (`lib/data/`) parses every collection through Zod and is where these are dealt with: `_id`
and `htmlText` are dropped, topography values and free text are trimmed, absent keys become `null`,
and anything that no longer matches the schema fails `yarn data:pack`.

## 9. Reaching 48 points

`lib/domain/army/feasibility.ts` answers one question over the whole corpus: can this army be
built to exactly 48 legal points, at this year and under this sub-faction?

`gatingBuckets(armyList)` enumerates the combinations to ask it about. Availability changes only
in the year a troop option's, an ally option's or a sub-faction clause's range opens or closes, so
those years are the bucket boundaries; neighbouring buckets offering the same options are merged,
and the whole span is walked once per variant the army declares. The sample pack's eight armies
come to 36 buckets; the real snapshot comes to a few thousand.

`fillToCap(armyList, selection, costs, rules)` builds one. It is a subset sum over the points each
choice can add, carrying the selection that realises it: every required troop option between its
min and max, each optional contingent group taken or left, at most one Ally Troop Option, and a
battle card top-up when the stands alone land short. A state is keyed on the running total **and**
on whether a stand the general may be drawn from is among them, so an army that reaches 48 only
without a legal general is reported rather than passed. What comes back is an `ArmySelection`, and
`feasibility.test.ts` hands it straight to `armyPoints` and `validateArmy` rather than trusting the
solver's own arithmetic: every bucket it fills comes back at exactly 48 points with no error
finding.

The solver keeps the first selection it finds for each running total, so the order it walks its
choices in decides *which* legal army comes back, never *whether* one does. `fillToCap` takes that
order as a parameter, and `randomFill` passes a shuffle — which is what the builder's **Randomize**
draws from. The harness runs the shuffled solver over every buildable bucket too, and it builds
all of them.

Only part of the battle card model is priced for a top-up — the rules whose cost is a fixed,
non-negative integer the rest of the army cannot move (`flat`, `perStand`, and the stands form of
`firstFreeThenFlat`). `perCard` and `perCardCapped` are priced off how many cards the army bought,
`modifiesStandCost` is fractional and can only take points off, and none of them is needed: few
buckets buy a card at all, and gating already brings every floor under the cap (§5). A card the
solver skips can only cost it a fill it did not need.

### 9.1 The buckets that cannot be built

A small share of the real buckets cannot be built, every one of them because of upstream, and the
real-data harness pins the exact list — a refresh that fixes one, or introduces another, fails CI.
They come in a few shapes:

- **The general has nowhere to come from.** `troopEntriesForGeneral` names troop types whose only
  options close before the army's span does, open after it starts, or leave a gap between them; a
  variant fields a new troop type in place of the one the general is drawn from; or the general's
  troop type is not offered at any date.
- **The arithmetic misses 48.** When every stand but one small option costs the same, the totals
  reachable skip 48 — say 3-point stands beside one or two 4-point ones, where 48 needs the 4-point
  stands in a multiple of three.
- **The required troops top out short**, and the battle cards on offer do not make up the rest.

Sunspire Dominion shows the first two, and `feasibility.test.ts` pins both as the sample's only
gaps:

| Bucket | Why |
|---|---|
| 2200–2151 BC | The general is Elite Cavalry, and the only Elite Cavalry option opens in 2150 BC. |
| 2050–2000 BC | Once the chariots and the levies close, every stand costs 3 points but the one to two Elite Cavalry at 4, so 48 needs a multiple of 3 of them. The closest is 47. |

Most of the real ones are the general; a couple are points problems, and a couple of armies have
no buildable bucket at all. None of it is ours, and none of it changes what the builder does: it
still shows these armies, still lets them be built, and says what is wrong through the validator
(§4.1) rather than hiding a year or a variant the data offers.

## 10. Games

A **game** is the ruleset a list is built under: `'triumph' | 'fantasy'`, `games` in
`lib/data/schema.ts` (ADR [0039](adr/0039-a-saved-list-belongs-to-a-game.md)). A game is not a
mode of another game. Triumph! builds from an army list, and Fantasy Triumph has none; each has its
own selection, its own points engine and its own validator, and neither relaxes the other's rules.

- **A saved list, a share and a share code name their game.** The `game` column on `armies` and
  `shares` says which branch of `SavedSelection` the stored JSON is, so the JSON itself carries no
  game and nothing written before games existed is rewritten. `army_list_id` is mandatory for a
  Triumph! list and empty for a Fantasy Triumph one. A version 2 share code puts `game` ahead of
  the selection and deflates it (ADR [0041](adr/0041-a-share-code-deflates-its-payload.md)); a
  version 1 code still decodes, as Triumph!.
- **The registry, not the caller, knows the game.** `gameModule(game)` in
  `lib/domain/games/registry.ts` hands out a `GameModule` (`lib/domain/game.ts`): the selection
  schema, its canonical form, the points meter, the validation report, the sheet data, the name of
  what the list is built from and the default list title. The saved-lists table, the sheet route,
  the text exports, the share page and the saved view ask the registry and never branch on the
  game themselves.
- **Every game's builder is `/<game>/build`**, opened on `?list=<id>` for a saved list or
  `?s=<code>` for a draft. `/armies/<id>/build` stays as the Triumph! entry from an army page.
- **What is shared stays outside the modules:** the troop types, findings and their severities,
  the points meter contract, the sheet renderer and the coverage solver.
- **A game's reference data is a section of the pack.** Troop types are one collection for every
  game; Fantasy Triumph overlays display names on two of them and brings its own card catalogue,
  format and rules text, curated under `data/curation/games/fantasy/` in the data repo. The section
  is optional: a pack without it imports, and `reference.games` then offers Triumph! alone. The
  data version a list pins (ADR [0003](adr/0003-one-data-version-per-army.md)) covers the section
  too.
- **Saving comes before viewing.** `savableGames` is both games; `viewableGames`, which the share
  router accepts and the share page, the saved view and the sheet render, is Triumph! alone until
  the Fantasy Triumph sheet, share and saved view land (#20).

## 11. Fantasy Triumph

A Fantasy Triumph list is an army the player designs, not one drawn from a list (ADR
[0040](adr/0040-a-fantasy-triumph-list-is-named-units-of-identical-stands.md)). It keeps the 26
troop types with their costs and factors, calls two of them by other names, and buys from a
catalogue of its own cards whose prices depend on who carries them, the home topography and a
choice made at purchase. Every number below — the points total, the stands per point, the hero
limits, the rating costs — is in the pack's `format`, never a constant under `lib/` (§4.1's
`triumphRules` is the Triumph! equivalent).

### 11.1 What a list holds

`fantasySelectionSchema` in `lib/domain/fantasy/selection-schema.ts`:

```
FantasySelection
├── dataVersion
├── format        pointsTotal, topography, invasion, maneuver
├── units[]       id, name, tags[], troopType, stands, cards[], marks
│   └── marks     delayedEntry, transports, eventCards { code: count }
├── heroes[]      id, name, tags[], cards[], delayedEntry
├── armyCards[]   code, count?, variants?
└── general       a unit id, or null
```

- **The format** is chosen by the player and paid for. The **points total** is 51 unless the player
  sets another, because the rulebook names other totals and the stand minimum moves with it. The
  **home topography** is any of Triumph!'s seven or one of four **dense** ones, which only Fantasy
  Triumph has and which some cards price differently. The **invasion and manoeuvre ratings** run
  0–4, start at 2 for nothing, and cost or give back points either side of it.
- **A unit** is stands of one troop type carrying the same cards — the rulebook's *class*, given a
  name. The name is what the player calls it at the table (*Warg riders*), and it and the tags are
  what the collection matches on (§12). Every card on a unit applies to every stand in it, so
  stands that differ are two units, and the builder offers **split** rather than a toggle per
  stand. A card is bought for a unit once; a variant is recorded where the card offers a choice,
  and a short note where the card asks the player to name something.
- **Marks** are the exception to *every stand*: three army-level effects say *how many* of a unit's
  stands they touch, never which. `delayedEntry` counts stands arriving late, `transports` counts
  stands given a transport, and `eventCards` counts the event cards bought for the unit.
- **A hero** is a single figure with a name, tags and its own cards, and is never a stand: it has
  no troop type, never counts toward the stand minimum and is never the general.
- **Army cards** are bought once for the army, with a count where the card is priced per copy and
  a variant where it offers a choice.
- **The general** names a unit, and so stands for one of that unit's stands.

`canonicalFantasySelection` in `share.ts` orders cards, tags and army cards and drops empty
fields, so two lists that mean the same thing encode to the same share code.

### 11.2 Cards

`category` on each card says what it is bought for, and the builder offers it there and nowhere
else:

| Category | Bought for |
|---|---|
| `stand` | a unit, carried by every stand in it |
| `hero` | a hero |
| `standOrHero` | either |
| `event` | a unit, as a count of cards held for its stands |
| `army` | the army as a whole |

Delayed Entry and Mobile Infantry are army cards the player never buys directly: the builder marks
stands (and, for Delayed Entry, heroes), and the points engine prices the card from the marks.

A card's **cost** is one of seven rule kinds in `lib/domain/fantasy/battle-cards.ts`, and
`cardCostPoints` in `card-pricing.ts` evaluates it against the bearer:

| Kind | Price |
|---|---|
| `flat` | a fixed number of points, which may be negative |
| `byTroopType` | a default, overridden for stands matching a selector (troop type, order, category, movement) |
| `byTopography` | one price in a dense home topography and another elsewhere |
| `byVariant` | the price of the option chosen at purchase; unpriced until one is chosen |
| `perCount` | a price per copy, up to a maximum count |
| `perMarkedCappedAtValue` | a price per marked stand or hero, never more than that bearer's own cost |
| `byBearer` | one price on a stand and another on a hero |

A card's **constraints** are nine kinds: eligible or ineligible bearers by the same selectors,
cards it excludes or requires, a cap on how many stands or heroes in the army carry it, once per
army, never on the general, never on a hero, and on one unit only. Codes, cost kinds and constraint
kinds are code; every price, selector, name and line of rules text is data in the pack.

### 11.3 Points

`fantasyPoints` in `lib/domain/fantasy/points.ts` returns a breakdown in three parts:

1. **Units.** A stand costs its troop type's cost plus every card on the unit, and never less than
   the format's minimum stand cost of 1. The unit costs that times its stands. A card whose price
   is not yet known — a variant not chosen — counts as nothing.
2. **Heroes.** A hero costs the format's hero cost plus its cards.
3. **Army lines.** The invasion and manoeuvre ratings, each army card priced from its count or
   variant, each unit's event cards, Mobile Infantry priced on the stands marked with a transport,
   and one **Delayed Entry** line per marked unit or hero. Delayed Entry is a refund: a negative
   line per marked stand or hero, never larger than what that stand or hero costs.

The **victory value** is units plus heroes, the figure victory is reckoned on, which is why a
Delayed Entry refund is a separate line and not a cheaper stand: a delayed stand is still worth its
full cost. The **total** is the
victory value plus the army lines, and it is the total that is held against the format's points
total. The points meter shows both.

### 11.4 What the validator reports

`validateFantasyList` in `lib/domain/fantasy/validation.ts` follows §4.1: findings only, each with
a code, a severity and a target — the army, the format, the general, a unit, a hero, or one card on
a unit, a hero or the army.

| Finding | Severity | Rule |
|---|---|---|
| `overPointsTotal` | error | the total is above the format's points total |
| `underPointsTotal` | warning | points left unspent |
| `tooFewStands` | error | fewer than one stand per six points of the total |
| `tooManyHeroes`, `heroPointsAboveMax` | error | more than three heroes, or heroes costing more than eight points together |
| `generalMissing`, `generalIsHero` | error | no unit is the general, or a hero has been named |
| `standCostRaisedToMinimum` | info | a unit's cards would take a stand below the minimum stand cost |
| `marksExceedStands` | warning | more stands marked than the unit holds |
| `cardNotInPack` | warning | the card is not in this data version's pack |
| `cardNotForPlacement` | error | the card's category does not allow it where it was bought |
| `cardMarkedNotBought` | warning | Delayed Entry bought for the army instead of marked |
| `cardBoughtTwice` | error | the same card twice on one unit, hero or army |
| `variantNotChosen` | warning | a card offering a choice has none made |
| `cardCountAboveMax` | error | more copies than the card allows |
| `cardNotEligible`, `cardsExcludeEachOther`, `cardRequiresCard` | error | the card's own eligibility, exclusions and requirements |
| `cardAboveArmyMax`, `cardMoreThanOncePerArmy`, `cardOnSeveralUnits` | error | the card's per-army caps |
| `cardOnGeneral`, `cardOnHero`, `negativeCardOnHero` | error | a card the general's unit or a hero may not carry, or a negative card that would cheapen a hero |

Three readings are ours rather than the rulebook's:

- **"Not on the general" on part of a unit.** The general is one stand of its unit. A card that
  marks some stands, such as Delayed Entry, is only on the general when every stand in the
  general's unit is marked, because otherwise the general may be one of the unmarked ones. A stand
  card such as Unreliable applies to every stand, so on the general's unit it is always on the
  general.
- **Illusion's "not on heroes or generals" cannot be checked.** Illusions are a count bought for
  the army, not marks on stands or heroes, so nothing records where they go. Only the cap on the
  count applies.
- **The total is a rule, not a constant.** The format's points total is the player's, the stand
  minimum scales with it, and the hero limits do not.

## 12. The collection

A collection records what a player owns (ADR [0031](adr/0031-track-a-collection-of-stands.md)), and
`lib/domain/collection/` works out how much of a list it covers. An **entry** is a batch of stands
that fields as one troop type, with a name, a count, tags, a painting status and notes. Coverage is
a min-cost flow over one list at a time, computed and never stored, so one entry serves any number
of lists.

For a Triumph! list, each troop option is a demand: the troop type decides whether an entry may
fill it, and the entry's tags against the option's description decide whether it is a *match* or a
*stand-in*. A Fantasy Triumph list makes each unit a demand matched to stand entries of its troop
type, with the unit's name and tags playing the description's part (ADR 0040, #22). Each game
reads only the entries kept for it: stands kept for Triumph! alone never cover a Fantasy Triumph
unit, and an entry added from a Fantasy Triumph list's coverage is kept for Fantasy Triumph.

**Hero entries.** A hero is a figure, not a stand, and has no troop type, so it cannot be a stand
entry. ADR 0040 gives an entry a kind: **stands**, as above, or a **hero**, with a count of figures
and no troop type (#21). A hero in a Fantasy Triumph list is matched to hero entries alone, on the
hero's name and tags, and never to stand entries, where it would be counted twice against a unit
or never painted as what it is. Statuses and the to-buy and to-paint totals treat both kinds the
same, and a pin is Triumph! only until #45 gives a Fantasy unit or hero a key to pin against.
Which armies a collection can build ignores hero entries, because no Triumph! army list has heroes.
