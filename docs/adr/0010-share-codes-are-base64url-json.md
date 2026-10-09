# 0010 — Encode a shared army as versioned base64url JSON

- **Status:** Accepted · no compression superseded by [0041](0041-a-share-code-deflates-its-payload.md)
- **Date:** 2026-09-17
- **Related:** #25, #45, #47, ADR [0003](0003-one-data-version-per-army.md)

## Context

A share link carries an `ArmySelection` — the army, the `dataVersion` it was built against, the
year, the sub-faction variant, the contingent groups taken, stand counts per troop option and
troop type, the general, and battle cards army-wide and per troop option. Signed-in users will get
a server-backed short link (#45); anonymous users get the client-encoded form, so for them the
link *is* the payload.

The payload is dominated by identifiers we do not control. The army and every ally contingent are
Mongo ObjectIds — 24 hex characters each — and a troop option id is `<contingent>/<index>`, so a
selection naming three contingents spells 72 characters of hex before it says anything about
stands.

Measured over a realistic selection for each of the 656 snapshot armies (eight main troop options
at two stands each, the first contingent group with two options per contingent, a general, an army
battle card and a troop battle card), as URL characters, against the size of the codec each needs:

| Encoding | Median | Worst | Codec |
|---|---|---|---|
| `JSON.stringify`, base64url | 570 | 752 | ~150 lines, a zod schema |
| Compact JSON — short keys, tuple rows — base64url | 419 | 588 | ~230 lines, a zod schema and a wire schema |
| JSON, brotli, base64url | 298 | 335 | small, but `CompressionStream` is asynchronous |
| Hand-written binary format, base64url | 118 | 170 | ~580 lines |

The roadmap's estimate for this item — "~128 chars compressed + base64url" — turns out to be
reachable only by the last row. Compression does not get JSON close to it: brotli stops at 298.

## Decision

`lib/domain/army/share-codec.ts` encodes a selection as `JSON.stringify`, UTF-8, base64url without
padding, behind a decimal version prefix: `1.eyJhcm15Ijoi…`. There is no compression and no bespoke
binary format. A realistic army is 570 characters, the worst in the snapshot is 752, and a unit
test holds every army under an 800 character budget.

Decoding is a zod parse, because a share code is external data arriving at a boundary, which is
where this codebase validates. `decodeSelection` never throws: a version this build does not
implement comes back as `{ ok: false, reason: 'unsupportedVersion', version }`, and anything that
does not read comes back `malformed`. Encoding validates against the same schema, so what we emit
always decodes.

Encoding is canonical — record keys sorted, counts of zero dropped, object keys in schema order —
so the same army is the same string however it was clicked together. That is what lets #45 key a
server-side short link on the code.

## Alternatives considered

- **A hand-written binary format** (varints, ObjectIds packed into 12 bytes, a byte per troop type
  and battle card). Written and measured: 118 characters median, and 580 lines. It also needs its
  own code-to-byte tables that may never be reordered, which is a silent-corruption hazard nobody
  can see in review, and a second reader kept forever per version. Not worth it for a string that
  is mostly consumed by being pasted into a chat window.
- **Compact JSON with short keys and tuple rows.** A third of the size win for most of the wire
  schema burden — the worst of both.
- **JSON plus compression.** Asynchronous in the browser, which would make `decodeSelection` async
  in a layer that is otherwise synchronous and pure, and still 2.5× the binary format it loses to.
- **Put the version inside the JSON.** It works, but the prefix lets the version be checked before
  a byte is decoded, and it is legible in the URL.

## Consequences

- The codec is small enough to read in one sitting, and a link can be decoded by anyone with a
  base64 decoder — including us, debugging a bug report with only the URL in hand.
- Validation is a zod schema rather than a hand-rolled parser, so it is the same kind of thing as
  every other boundary in the repo, and it rejects ids the army list model would not have minted.
- Forward compatibility is cheap: an added field is additive, and old links keep parsing. A change
  that breaks the shape bumps the prefix to `2.` and keeps the version 1 schema alongside.
- Share links are long — around 570 characters, ~600 with the origin and path. Fine in a URL bar,
  in a chat client and in a QR code; ugly when printed in full.
- Nothing about the link is secret or tamper-proof; it never was. A decoded selection is validated,
  then still warned about by the validator like any other army (ADR
  [0002](0002-warn-dont-block.md)).
- A link carries its `dataVersion` (ADR [0003](0003-one-data-version-per-army.md)), so a received
  army is interpreted against the data it was built against, never silently re-resolved.

## Revisit trigger

Link length starts costing something real — a share surface that has to fit a QR code on printed
paper, or a client that truncates what it will link — or a realistic selection passes the 800
character budget because the selection grew a field. The binary encoding measured above is the
answer if that day comes, and the version prefix is what makes switching to it a `2.`.
