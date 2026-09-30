# 0031 — Track a collection as account-owned batches of stands, matched to lists by troop type

- **Status:** Accepted
- **Date:** 2026-09-24
- **Related:** #161, #183, `docs/DOMAIN.md` §2, §3, §7, ADR [0006](0006-self-hosted-single-container.md),
  ADR [0007](0007-sqlite-on-a-volume.md), ADR [0013](0013-anonymous-armies-in-sqlite.md)

## Context

*"What can I build with the stands I own?"* A closed beta tester asked for it in three steps: a
notepad per list, one collection across lists, and allies drawing on it. Before any of it is built,
we have to decide four things: what a player records when they record a stand, how that record
meets a list, where its photos live, and who may keep one.

**A painted stand does not have one troop type.** Across the 4,524 troop options in the snapshot,
the ones described as hoplites are Heavy Foot 49 times, Spear twice, Horde once, and a free mix of
Heavy Foot with Spear, Light Foot, Raiders or Javelin Cavalry a further 10 times, and one army
fields the same figures as Elite Foot. The same eight stands of hoplites are HFT in one army, SPR
in a second and EFT in a third, and the player owns them once.

**A troop type alone is also too coarse.** Two Successor kingdoms both field a Macedonian phalanx
as `PIK`, which is the reuse players want suggested, but a Swiss pike block is also `PIK`. What
separates the two is what the figures *are*, and upstream only says that in `description`: free
text, 2,185 distinct strings over the 4,524 options, a phalanx described one way in one list and
another way in the next. That is enough to rank a suggestion. It is not a key.

**Players paint in units.** Eight phalangites are painted, based and photographed together, and
nobody records them one stand at a time.

**A list is hypothetical.** A player keeps lists for both Successor kingdoms over one box of
phalangites, and each list asks independently whether the stands are there.

**Photos are heavy, and the app has no external storage.** A phone photo is 3–6 MB and 12
megapixels, taken at a table on venue wifi, and it carries EXIF including GPS. Everything else a
player stores is a few hundred bytes of JSON: an army row is about 600 bytes. The app is one
container with SQLite on the `/data` volume (ADRs 0006 and 0007). tRPC carries JSON, and the only
API surface outside it today is the PDF route (ADR
[0020](0020-render-the-printable-list-as-a-server-side-pdf.md)).

**A collection outlives a cookie.** ADR 0013 made the app usable logged out: a first write mints an
anonymous session, and signing in reassigns the lists. A list is worth keeping even if its author
never signs up. A collection, though, is built up over months and describes figures on a shelf, and
an anonymous session is a cookie that expires. Photos on anonymous sessions would also turn a
first-write endpoint into free image hosting that the retention sweep would have to police.
`signedInProcedure` admits anonymous callers, and AGENTS.md calls it the only authorization there is.

## Decision

### The entry

A **collection entry** is a batch of identical stands owned by one account:

| Field | Meaning |
|---|---|
| `name` | what the player calls it: *Macedonian phalangites* |
| `count` | how many stands |
| `troopType` | the one troop type code the stands field as |
| `tags` | free, lowercased words for what the figures depict: `macedonian`, `pike`, `successor` |
| `status` | `unpainted`, `inProgress` or `painted` |
| `notes` | free text |
| photos | see *Photos* below |

### How an entry meets a list

**The troop type decides whether an entry is eligible for an option. Tags decide how well it fits.**
An entry can fill a `(troop option, troop type)` demand in a list if it fields as that troop type.
It is a **match** when one of its tags appears as a word in the option's description, or when the
player has pinned it there. Otherwise it is a **stand-in**. Both count towards coverage, and the
view says which one each is.

**Coverage is an allocation, computed and never stored.** `lib/domain/collection/` takes a
selection, the resolved army list and the collection. It assigns entry stands to the selection's
demands so that each entry is spent at most `count` times *within one list*. It maximises covered
stands, then prefers matches to stand-ins, then painted to unpainted. It has to be an allocation
and not a lookup, because entries compete for options that share a troop type: six Spear hoplites
tagged *hoplites* spent on a *Levy spearmen* option leave only stand-ins for the *Hoplites* option
they match. Greedy assignment gets that wrong, so it is a small bipartite matching. A list is at most 24 stands.

**Only taken contingents are matched.** An allied or optional contingent's troop options are
demands like any other, which already covers *my Spartans as Persian allies*. A saved list is never
linked to another.

**Entries are never reserved.** One entry satisfies any number of lists. Allocation happens within
one list at a time.

**A pin is the player's override, stored against the saved list and not in its selection.** The
table `army_collection_pins` holds `army_id`, `troop_option`, `troop_type`, `entry_id` and `count`.
A pin is fixed first, and the allocation fills the rest around it. The selection is left alone
because it travels: into share codes (ADR [0010](0010-share-codes-are-base64url-json.md)) and share
copies (ADR [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md)), which must
never carry another account's entry ids. A pin to a deleted entry, or to an option a newer
`dataVersion` no longer has, is ignored rather than reported, and cleaned up when the list is next
saved.

**Missing is split by what it takes.** A demand the collection cannot cover is *to buy*. A demand
covered only by unpainted or in-progress stands is *to paint*.

**The builder's steppers are untouched.** Coverage is its own *Can I build it* view, on the saved
list and as a panel in the builder. It never caps a stepper and adds no validation findings (ADR
[0002](0002-warn-dont-block.md)).

### Photos

**Both ends compress, and the server's bytes are the only ones stored.** The client decodes the
image with `createImageBitmap` (which honours EXIF orientation), draws it onto a canvas no larger
than 2048 px on the long edge and uploads it as WebP. That makes the upload a few hundred KB, and a
canvas carries no EXIF. The server never trusts those bytes. It re-encodes them with `sharp` —
`.rotate()`, bounded by `limitInputPixels`, metadata stripped — into two files:

| Size | Long edge | Target |
|---|---|---|
| `display` | 1600 px | ~250 KB, WebP q80 |
| `thumb` | 400 px | ~30 KB, WebP q75 |

**Files on the volume, rows in SQLite.** The files live under `PHOTO_DIR`, `/data/photos` by
default, as `<id>-display.webp` and `<id>-thumb.webp`, where `<id>` is random. A
`collection_photos` row holds `id`, `entry_id`, `user_id`, `position`, `width`, `height`, `bytes`
and `created_at`. An upload writes the files and then the row. A delete removes the row and then
the files. The daily retention sweep reconciles the directory against the table in both directions,
so a crash between the two steps leaves a stray file that the next sweep removes, and never a row
without its file for more than a day.

**Two route handlers, outside tRPC.** `POST /api/collection/photos` takes one multipart image,
capped at 10 MB. `GET /api/collection/photos/<id>/<size>` streams a file. Both take the caller from
the session and filter with `where user_id = ?` on the statement. A photo that is not the caller's
is a 404. The response is `Cache-Control: private, max-age=31536000, immutable`, because an id is
never reused for other bytes. Listing, reordering and deleting photos are ordinary tRPC procedures.

**Quotas are configuration.** `COLLECTION_PHOTOS_PER_ENTRY` defaults to 6 and
`COLLECTION_PHOTOS_PER_ACCOUNT` to 200, about 56 MB for a full account. Uploads are counted per user
through the `{ window, max }` seam in `lib/auth/rate-limit.ts`. A request over quota is refused with
a message that says which limit it hit, because unlike the mail guards there is no address oracle
to protect.

`lib/photos/` is the only module that touches `PHOTO_DIR` or imports `sharp`, and it takes the
directory as a parameter, so a test drives it over a temporary directory.

### Accounts

**A collection needs an account.** Every collection procedure and both photo routes require a
caller who is signed in and not anonymous. That is a second tRPC middleware, `accountProcedure`,
beside `signedInProcedure`. It refuses an anonymous caller with its own error key, so the client
can offer sign-in rather than a generic failure. Ownership is still the `where user_id = ?` on the
statement.

A logged-out or anonymous player sees `/collection` as its empty state, and the empty state is the
pitch: what a collection does, and sign in to start one. The *Can I build it* view shows the same
prompt in place of its coverage. There is no claim on sign-in for collections, because no anonymous
user can own one.

## Alternatives considered

The entry and matching:

- **One record per stand.** Precise, since it can name the general's stand, but forty taps to enter
  one army and a painting status nobody keeps up per stand. A batch can be split later if that is
  ever wanted.
- **A curated vocabulary of figure kinds** (*Hoplite*, *Phalangite*, *Legionary*) mapped to troop
  options. The best suggestions, but it means 4,524 options to curate and an overlay to keep in step
  with upstream, larger than the sub-faction overlay (ADR
  [0008](0008-sub-faction-overlay-keyed-on-the-note-string.md)) by two orders of magnitude.
- **Troop type only.** Suggests Swiss pikes for a Successor phalanx with the same confidence as
  Macedonian phalangites.
- **Pin entries to specific troop options in specific armies.** Every new army means pinning again.
  That is the notepad-per-list ask, and it does not answer *what else could I build?*
- **Tags gate eligibility.** Free text against free text misses too often (a player's
  *pezhetairoi* against a list that says *phalanx*), and a stand the player knows fits would
  silently not count.
- **An entry that fields as several troop types.** Models a stand a player would put down as either
  Heavy Foot or Spear. It was the first design, and the entry form asked for a set of chips. It went
  because a player records what a stand *is*, and a stand is based for one troop type; the same
  figures based twice are two entries. One type makes the form a single pick and every coverage
  line unambiguous about which type an entry was counted as.
- **Exclusive allocation across lists.** Bookkeeping for a question players do not ask until they
  pack for an event.
- **Owned counts on the builder's steppers, or a cap at them.** It crowds the control a player uses
  most, and a cap breaks warn, never block.

Photos:

- **BLOBs in SQLite.** One file to back up, transactional with its row. But the database grows by
  megabytes per player, the WAL and the online backup carry image bytes, and every query plan test
  runs over a heavier file.
- **Object storage (R2 or S3).** It scales and takes the bandwidth off the homelab. It is also the
  first external storage dependency, with credentials, a bill and a second thing to back up, for a
  hobby app with a few hundred players.
- **Client-only compression.** No native dependency, but the server would store bytes it did not
  encode, and EXIF stripping would depend on the browser.
- **Server-only compression.** A 5 MB upload on venue wifi, and a larger body limit on a public
  endpoint.
- **Public, unguessable photo URLs.** Cacheable by a CDN, but a URL that leaks shows the photo to
  anyone. Worth revisiting only together with a public collection share.

Accounts:

- **The same first-write anonymous session as lists.** It has parity with ADR 0013, but a collection
  is exactly the kind of long-lived record an expiring cookie should not be the only home of. It
  would also need quotas and sweep rules for anonymous photos.
- **Anonymous entries, photos only with an account.** Two tiers of one feature, and the same
  fragility for the months of entries.

## Consequences

- No curation. The quality of a *match* is the quality of the player's tags, and the view has to
  make adding a tag from a suggestion one tap.
- Description word matching is tested against the snapshot, as the markdown subset is, so a change
  to how upstream words descriptions shows up in CI and not in production.
- Share codes, share copies and the PDF sheet are unaffected by the collection.
- The allocation lives in `lib/domain/` under the 90% coverage floor, with the flexible-entry
  starvation case pinned in a test. *Which armies can I build?* reuses it, run against a filled
  selection per gating bucket (`feasibility.ts`) with the collection's stands as the limit on what
  may be taken.
- `sharp` becomes a production dependency. The image is `node:24-alpine`, so it needs the
  `linuxmusl` prebuilt binaries, and Yarn's `supportedArchitectures` must include `musl` so that
  `yarn install --immutable` on a glibc CI runner still resolves them. `output: 'standalone'`
  traces `sharp`, so the Dockerfile needs no change beyond checking it.
- The homelab backup must include `/data/photos`. A SQLite online backup does not cover it.
- Deleting an account deletes its entries, pins and photo rows, and the sweep removes the files.
- `AGENTS.md` changes in three places:
  - `signedInProcedure` is no longer the only authorization. Anonymous or not is decided in the
    middleware, never inside a procedure.
  - The PDF route is no longer the only API surface outside tRPC.
  - `lib/photos/` joins the modules that own one kind of I/O.
- Collection tracking is the first reason to sign up that is not keeping a list across devices.

## Revisit trigger

- Players ask to pack for an event, meaning two lists on one weekend that must not share stands.
  That is reservation, and a second allocation across lists.
- Stand-ins crowd out matches in the view often enough to be reported. The fix is then a curated
  vocabulary for the most common figure kinds, not stricter tags.
- Grand Triumph (#55) or linked ally lists need two lists pooled over one collection.
- `/data/photos` passes 5 GB, photo bandwidth becomes a noticeable share of homelab egress, or
  collections become shareable publicly. Any of these makes object storage, public URLs and a CDN
  worth their cost.
- The app runs as more than one instance, so a local volume is no longer shared.
- Players drop off at the sign-in prompt on `/collection` at a rate the funnel makes visible, or
  beta testers ask to try a collection before creating an account.
