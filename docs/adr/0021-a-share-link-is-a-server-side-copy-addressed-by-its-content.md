# 0021 — A share link is a server-side copy, addressed by the content it carries

- **Status:** Accepted, retention superseded by [0025](0025-a-share-link-lives-as-long-as-people-open-it.md)
- **Date:** 2026-09-20
- **Related:** #46, [0010](0010-share-codes-are-base64url-json.md),
  [0013](0013-anonymous-armies-in-sqlite.md), [0018](0018-the-builder-edits-a-saved-list-by-id.md),
  [0020](0020-render-the-printable-list-as-a-server-side-pdf.md)

## Context

#46 asks for server-backed short links with an OG preview image, and says what a shared link means:
a **copy**, not a live view of someone's saved list.

Three things were already decided and constrain the answer:

- ADR [0010](0010-share-codes-are-base64url-json.md) encodes a selection as versioned base64url
  JSON — 570 characters for a realistic army — and makes that encoding *canonical*: the same army
  is the same string however it was clicked together, explicitly so that a short link can be keyed
  on it.
- ADR [0013](0013-anonymous-armies-in-sqlite.md) gives a logged-out player a real user row on their
  first write, so there is no anonymous fallback to design: everyone's list already has a server id.
- ADR [0020](0020-render-the-printable-list-as-a-server-side-pdf.md) exports an *unsaved* draft,
  because the roadmap requires a list to be saveable, exportable and shareable at all times.

A link that pointed at an `armies` row would be a live view of a record its owner can edit, rename
or delete, and `army.byId` is `signedInProcedure` over `where user_id = ?` — the row is readable by
one person by design (ADR [0018](0018-the-builder-edits-a-saved-list-by-id.md)).

## Decision

A share is its own row. `shares` holds a name, an `army_list_id`, a selection blob and a
`data_version` — the same shape `armies` holds, minus the mutability. Nothing points back at the
list it was made from, so editing or deleting that list leaves the link alone.

**The id is the content.** `shareId` is the first 12 base64url characters of a SHA-256 over
`` `${name}\n${encodeSelection(selection)}` ``, which makes `share.create` idempotent: sharing the
same list twice is one row and one link, and an edited list gets a link of its own. There is no id
generator, no collision retry and no dedupe column — the canonical encoding ADR 0010 promised is
what makes the id stable.

`share.create` is a `signedInProcedure` taking a name and a selection, not a saved army id, so an
unsaved draft shares like everything else exports. The client mints an anonymous session first,
exactly as saving does. The author is kept on the row (`user_id`, `on delete set null`) to cap an
anonymous browser at `anonymousShareLimit` distinct copies; a copy outlives its author, including
the nightly retention sweep.

The page names nobody. The author on the row is bookkeeping for the cap, never a byline: a roster
page does not need to publish an email address to everyone holding the link. The author does follow
its browser into an account — the claim in `lib/auth/anonymous.ts` reassigns `shares` alongside
`armies`, extending ADR [0013](0013-anonymous-armies-in-sqlite.md)'s claim — because
`on delete set null` would otherwise orphan the row when the plugin deletes the anonymous record.

`/s/<id>` renders the copy read-only from `armySheet` — the same sheet model the PDF draws — with
the points meter, the validation report and the data-version notice the builder shows. `Save a
copy` writes it through the existing `army.create`, so a share needs no procedure of its own to
land in someone's My Armies. The OG image is a Next metadata route over the same loader, drawn with
the TTFs #47 already vendored.

## Alternatives considered

- **A link that points at the `armies` row.** A live view: the reader sees the author's later
  edits, or a 404 when they delete it. It also breaks ownership — the row is one caller's by
  construction — and would need a second read path with a different authorization rule.
- **The #25 client code in the URL.** No server, no row, works offline — and 600 characters of
  base64 with no OG preview, because there is no page to crawl until JavaScript has run. It stays
  for pasting into a chat window and for the PDF route, which is where it is at its best.
- **A random short id with a `code` column and a unique index.** The same idempotency, plus an id
  source in the context, a unique-violation path, and a second thing to keep in step with the code.
- **A public `share.create` with a per-IP rate limit.** Sharing without a session at all. Better
  Auth owns IP resolution here (`TRUSTED_PROXIES`, `IP_ADDRESS_HEADERS`), so tRPC would need a
  second implementation of it, and unauthenticated row creation is exactly what ADR 0013 rejected.
- **A share id that is a random UUID.** Longer than the link needs to be, and it makes re-sharing
  an unchanged list grow the table.

## Consequences

- Shares accumulate and are never swept: they are ~700 bytes, and a link that dies is worse than a
  row that lives. The sweep nulls the author, and the copy stays. *(Superseded by
  [0025](0025-a-share-link-lives-as-long-as-people-open-it.md): a copy nobody opens for 24 months
  is now swept. The author is still nulled, and a link still in use still never dies.)*
- The link is a `Share link` item in the builder's `Export` menu, beside the text copy and the two
  PDF items (#48), which is where that menu's own record said share links should land.
- The same short link comes back for the same list, which is a feature at the copy button and a
  surprise if you expected a fresh link per click.
- A shared list is rendered against the *current* bundle. A copy whose army list has left the data
  is a not-found page, and one built against older data says so in the notice the builder uses.
- Share pages are `noindex`: they are someone's list, not site content. Preview crawlers read the
  OG tags regardless.
- **A shared page carries the list and nothing about the player.** No name, no address: a link is
  holdable by a whole chat channel, and the recipient needs the roster, not the roster's author.
  What that costs is that a recipient cannot tell two identical links apart by who sent them.
- **The claim now moves two things.** ADR [0013](0013-anonymous-armies-in-sqlite.md) reassigns
  armies on sign-in; shares are reassigned in the same hook, or `on delete set null` would orphan
  them when the anonymous record goes. The link never breaks either way — this is about the row
  belonging to somebody, and about the cap counting it.
- There is no way to withdraw a link, since the row has no delete path: a dead link is worse than a
  live row, and the page discloses nothing but the list.
- An unknown short link renders the app's not-found page with a 200 rather than a 404. The status
  belongs to the framework — the shell has flushed by the time the page resolves — and the routes
  that do answer 404 do it at routing time through `dynamicParams = false`, which a runtime id
  cannot use.
- `lib/share/` joins `lib/export/` as a module that takes its database and its bundle as
  parameters, so the page, the OG image and the tests all drive the same loader.

## Revisit trigger

Somebody wants a link taken back — at which point the copy needs an owner-facing list and a delete,
and *a dead link is worse than a live row* stops being the whole answer. Or shares become a volume or abuse problem the per-browser cap does not contain — at which
point a retention sweep for copies nobody has opened, with a `last_seen_at`, is the next move and
it is a migration, not a redesign. Or a player asks for a link that follows their edits, which is a
different feature from this one and needs its own record.
