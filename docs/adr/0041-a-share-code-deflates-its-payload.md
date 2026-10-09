# 0041 — Deflate a share code's payload from version 2, with a synchronous codec

- **Status:** Accepted
- **Date:** 2026-10-09
- **Related:** #15, ADR [0010](0010-share-codes-are-base64url-json.md), ADR
  [0039](0039-a-saved-list-belongs-to-a-game.md), ADR
  [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md)

## Context

ADR 0039 bumps the share code to version 2 so a code names its game. That puts `"game":"triumph",`
ahead of every selection: about 23 more characters, which takes the worst real army ADR 0010
measured from 752 to about 775 against an 800 character budget.

ADR 0010 measured compression and turned it down for one reason: `CompressionStream` is
asynchronous in the browser, and `decodeSelection` sits in a layer that is otherwise synchronous
and pure. Its own numbers put brotli at 298 characters median against 570 for plain JSON.

Measured over a realistic selection for each of the eight sample armies, as URL characters:

| Encoding | Median | Worst |
|---|---|---|
| Version 2 JSON, base64url | 598 | 632 |
| Version 2 JSON, raw deflate, base64url | 350 | 357 |
| Version 2 JSON, brotli, base64url | 316 | 325 |

Version 2 has not shipped. Whatever it is when it does, it is decoded for good.

## Decision

A version 2 code is the JSON of ADR 0039, UTF-8, **raw deflate** at level 9 through `fflate`'s
synchronous `deflateSync` and `inflateSync`, base64url without padding, behind the `2.` prefix.
Version 1 codes still decode as uncompressed JSON. The decoder inflates into a buffer one byte
larger than `shareCodeMaxInflatedBytes` and calls anything that fills it malformed, so a short code
cannot expand into megabytes. `fflate` is a direct dependency pinned to an exact version.

## Alternatives considered

- **Brotli.** About 30 characters shorter again, but the browser has no synchronous brotli
  encoder, and a JavaScript one is far larger than `fflate`.
- **`CompressionStream`.** No dependency, but asynchronous: the objection ADR 0010 raised stands.
- **The hand-written binary format** ADR 0010 measured at 118. Still ~580 lines and code tables
  that may never be reordered.
- **Leave version 2 uncompressed.** Fits the budget for now, but compressing later is a version 3
  decoded forever beside 1 and 2.

## Consequences

- Codes are about 40% shorter, and the budget has room for the fields later games add.
- A code is no longer legible with a base64 decoder alone: debugging one from a bug report takes
  an inflate as well.
- The client bundle carries `fflate`'s deflate and inflate, a few kilobytes gzipped.
- Encoding stays canonical only for a given `fflate` build. An upgrade that changes its output
  changes the share id of a list shared again afterwards (ADR 0021): the old link keeps working,
  and the new share is a second copy. That is why the version is pinned.
- A code minted by version 2 does not open on a build from before it.

## Revisit trigger

A realistic selection passes the budget even compressed, or `fflate` stops being maintained.
