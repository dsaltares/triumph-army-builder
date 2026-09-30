# 0023 — A new list is born named, and the header title renames it

- **Status:** Accepted
- **Date:** 2026-09-20
- **Related:** ADR [0017](0017-saving-is-an-explicit-act.md), ADR
  [0018](0018-the-builder-edits-a-saved-list-by-id.md), ADR
  [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md)

## Context

ADR [0017](0017-saving-is-an-explicit-act.md) made saving a button press and asked for a name in
the same act: **Save** opened a dialog, the dialog offered the army's own name as a default, and
only then did a row exist. Naming was therefore a question asked at the one moment a player had
already decided what they wanted — and answered, most of the time, by accepting the army name,
which is what every other list of the same army is also called.

The builder's `h1` read `Build <army>`, and the subtitle read the year span. Neither says
anything a player chose. A saved list could only be renamed from **My Armies**, one page away from
where it is built.

## Decision

A list has a name from the moment the builder opens: `defaultListName` in
`lib/domain/army/saved-army.ts` returns `<army> - YYYY/MM/DD` — the army list's name and the local
date the builder was opened on, truncated the way `copyName` truncates, so the 80-character column
always holds it. The builder's `h1` is that name in an input, and typing in it is how a list is
renamed, saved or not. The subtitle takes over what the title used to say: `<army> · <year span>`.

The name is draft state, next to the selection: `ArmyBuilderView` owns it and publishes it in the
builder snapshot, **Save** writes it with the selection, and the button's *matches the record*
check is the name and the share code together. Nothing renames a row on a keystroke, so ADR 0017
holds for a name exactly as it holds for a selection, and the save dialog is gone from the builder
— `ArmyNameDialog` stays as the rename affordance on **My Armies**.

An emptied field restores the last name the list had rather than leaving a row unnamed.

## Alternatives considered

- **Keep the dialog, pre-filled from the title.** Two naming affordances for one name, and the
  dialog is then only a confirmation step over what is already on screen.
- **Rename the record on blur, the way My Armies does.** Immediate, but it makes a write out of
  editing a field in a builder whose whole point (ADR 0017) is that browsing writes nothing — and
  an unsaved list has no record to rename anyway, so the two halves of the control would behave
  differently.
- **`Intl.DateTimeFormat` for the date.** Locale-dependent order and separators in a value that is
  stored, sorted and read back as part of a name. A fixed `YYYY/MM/DD` sorts and reads the same
  everywhere.
- **A name with no date, as before.** Every list of an army is then called the same thing, which is
  what **My Armies** has to tell apart.

## Consequences

- An export of an unsaved draft is now named after the list rather than after the army, so a
  downloaded sheet carries the date. `armySheetResponse` replaces `/`, `\` and `:` in the filename
  with `-` so a list name cannot reach into a path.
- A share link (ADR [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md))
  is addressed by a hash over its name and its selection, so an unsaved draft shared on two
  different days now makes two links where it used to make one. A saved list, whose name is its
  own, is unaffected.
- The prerendered `h1` is still `Build <army>` — the input only exists once the bundle has
  answered — so what the 656 builder pages are crawled with does not change.
- `PageHeader` takes a `ReactNode` title. A page that passes a string is unaffected.
- Two lists of the same army built on the same day share a name until one is renamed. Nothing in
  the app requires names to be unique, and **My Armies** sorts on `updatedAt`.

## Revisit trigger

Players renaming most new lists anyway — the default is then noise, and the answer is a name asked
for at the start rather than assumed. Or offline editing (#52), which queues writes and has to say
what a rename is when there is no button press.
