# 0022 — A QR code encodes the short link, and nothing else

- **Status:** Accepted
- **Date:** 2026-09-20
- **Related:** #119, [0010](0010-share-codes-are-base64url-json.md),
  [0020](0020-render-the-printable-list-as-a-server-side-pdf.md),
  [0021](0021-a-share-link-is-a-server-side-copy-addressed-by-its-content.md)

## Context

Two payloads could go in a QR code: the short link from ADR 0021 (`/s/` plus a twelve-character
id), or the client-encoded share code from ADR 0010, which that ADR measured at **570 characters
for a realistic army and 752 for the worst in the snapshot**. Both are base64url, so both force
byte mode.

Symbol version and module count, measured with the encoder as shipped:

| Payload | Chars | L | M | Q | H |
|---|---:|---:|---:|---:|---:|
| short link, `http://localhost:3013` | 36 | v3 · 29² | v3 · 29² | v4 · 33² | v5 · 37² |
| short link, a 36-character origin | 51 | v3 · 29² | v4 · 33² | **v5 · 37²** | v6 · 41² |
| ADR 0010 realistic code in a builder URL | 647 | v18 · 89² | v20 · 97² | v24 · 113² | v28 · 129² |
| ADR 0010 worst code in a builder URL | 829 | v20 · 97² | v23 · 109² | v28 · 129² | v32 · 145² |

The sheet prints the symbol at 68pt — 24 mm, quiet zone included. That is 0.53 mm per module for
the short link at level Q, and 0.20 mm for the realistic ADR 0010 code.

Rendered and decoded for real (rasterised with sharp, read back with `jsQR`), which is the part
arithmetic will not tell you:

| Payload | Symbol | 400px | 250px | 160px | 160px, blurred |
|---|---|---|---|---|---|
| short link | v5 · 37² · 0.53 mm/module | scans | scans | scans | scans |
| ADR 0010 code | v24 · 113² · 0.20 mm/module | scans | no read | no read | no read |

A 24 mm symbol photographed at 160 px across is roughly a phone at arm's length in a club. The
short link survives that and a blur on top; the long code needs about 3.5 pixels per module and
gets none of them.

## Decision

The QR code encodes the short link, at **error correction level Q**, drawn as vector paths from
`lib/qr/`. It appears in the share dialog and in the masthead of the printed sheet, in both cases
with the URL beside it as selectable text and as a real anchor.

Level Q (25% recovery) over M (15%): a printed army list gets folded, and a crease through the
symbol is exactly the block-spanning damage error correction exists for. It costs four modules over
M — 37² against 33², 0.53 mm against 0.59 mm per module — which the measurements above say is free
at this size. H buys another 5% for another four modules and is meant for industrial marking; Q is
the deliberate middle.

The sheet route takes the share id as an optional `?share=`, validated against `shareIdPattern`. It
still reads no database and resolves no session (ADR 0020): the id is a twelve-character string it
prints into a URL, and an id that is not one we could have minted is dropped, not refused. The
builder's Export menu mints the short link first and stamps it on the sheet URL; if that fails —
offline, rate limited, over the anonymous cap — the sheet renders without a QR rather than not at
all (ADR 0002).

**Offline (M7) gets no QR.** With no server there is no short link, and the measurements above are
the reason: the only payload available offline is the one that does not scan at print size.

## Alternatives considered

- **Encode the ADR 0010 share code.** The only option that works with no server, and the table
  above is why it loses: v24–v28, a fifth of a millimetre per module, unreadable at 24 mm by
  anything but a macro shot. Printing it at a scannable 0.5 mm/module needs ~60 mm — a quarter of
  the page width — for a link that is a dead end if the phone gives up on it.
- **Level M, or level H.** M is the common web default and H the common print reflex. Neither is
  wrong here; Q is chosen because the artefact is a sheet of paper that gets folded, and the size
  difference between all three is immaterial at this payload.
- **A rasterised image scaled by the print stylesheet.** ADR 0020 already renders the sheet as a
  PDF, where a path is exact at any output resolution and a PNG is not.
- **`qrcode` (node-qrcode).** 8.7× the downloads of what we shipped and the de-facto standard, and
  it produces the same symbol version and module count at every level (checked L/M/Q/H against both
  payloads). It loses on weight and maintenance: `pngjs`, `yargs` and `dijkstrajs` — 29 packages,
  ~1.8 MB — in a container ADR 0006 keeps to one image, all of it for a CLI and a PNG renderer we
  never call, plus a DefinitelyTyped stub; and its last commit was August 2024 against 125 open
  issues. `qrcode-generator` is the reference implementation node-qrcode descends from, has no
  dependencies, ships its own types, and is 7.6 KB gzipped in the browser against 9.6 KB.
- **Invert the code in dark mode.** Plenty of scanners will not read light-on-dark. The symbol
  carries its own white field and quiet zone in the SVG, so it is dark-on-light in both themes and
  stays that way if it is dragged out of the page.

## Consequences

- The encoder is lazy: `components/share/list-qr.tsx` is reached through `React.lazy`, so the 7.6 KB
  gzipped chunk is absent from the build manifest and loads when a link is first shown. Browsing
  armies never pays for it.
- **Exporting a PDF now writes.** It mints a short link first, which means an anonymous session on
  a player who only wanted a file. The write is idempotent — ADR 0021 names the row by its content —
  so re-exporting the same list costs nothing and creates no second row.
- Both PDF menu items became buttons, because the sheet URL is not known until the link is. The
  preview reserves its tab before awaiting, or a popup blocker eats it.
- The QR is on page one only, not in the running footer, which already carries the army list URL on
  every page.
- `shareIdLength` and `shareIdPattern` moved to `lib/domain/army/shared-list.ts`, so `lib/export/`
  can validate an id without importing `lib/db/`.

## Revisit trigger

Reopen if the deployed origin grows past ~60 characters, which pushes the short link to v6 and
beyond at level Q and makes the 24 mm print size worth re-measuring; or if a player reports a code
that will not scan from paper, in which case the trade between Q and a larger symbol is the thing
to change, not the payload.
