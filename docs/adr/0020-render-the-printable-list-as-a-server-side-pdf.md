# 0020 — Render the printable list as a PDF on the server, with `@react-pdf/renderer`

- **Status:** Accepted
- **Date:** 2026-09-20
- **Related:** #47, [0006](0006-self-hosted-single-container.md),
  [0010](0010-share-codes-are-base64url-json.md), [0016](0016-three-kinds-of-test-with-the-middle-in-rtl.md)

## Context

#47 called for a print stylesheet first, and for `@react-pdf/renderer` to be revisited only if print
CSS proved insufficient. The stated reason to prefer print CSS was that the PDF could then reuse the
app's own styling. That premise does not hold, and the requirement turned out to be tighter layout
control than a reflowed builder view.

`@react-pdf/renderer` cannot consume this app's CSS, measured against 4.9.0 as installed:

- It has its own `StyleSheet.create` object API. No Tailwind classes, no `@theme` tokens, no CSS
  variables, no cascade.
- No CSS Grid: `grid` does not appear in its `Style` type. `ArmySummary` and the troop option lists
  are all `grid`/`sm:grid-cols-*`.
- No `oklch()`. Its colour parser is `color-string` plus `hsl-to-hex` — hex, rgb, hsl and named
  only. Every token in `app/globals.css` is oklch.
- Fonts are registered from files. The app gets IBM Plex Sans from `next/font/google`.

The reuse argument only bites if the sheet mirrors the builder. A purpose-built sheet has one
implementation and nothing to drift against, which turns those four gaps into a one-time cost: six
hex tokens (they convert to Tailwind's stone palette, which is what the shadcn theme already is) and
a bundled TTF taken from the same Google Fonts source `next/font/google` uses.

Against that, react-pdf's paged-media control is strictly better than a browser's:

| Need | `@react-pdf/renderer` | Browser print |
|---|---|---|
| Fixed page size | `size`, `orientation` on `Page` | the player's print dialog |
| Keep a block off a seam | `wrap={false}` | `break-inside: avoid`, honoured unevenly |
| Orphan control | `minPresenceAhead` | none |
| Repeating header/footer | `fixed` | no real equivalent |
| "Page 2 of 3" | `render={({ pageNumber, totalPages })}` | `counter(pages)`, partial |
| No browser URL/date chrome | it is our document | cannot be suppressed from CSS |
| Same output everywhere | yes | varies by browser, margins, scale, and the "Background graphics" checkbox |

Measured cost of rendering it in the browser instead: **1.25 MB minified, 461 KB gzipped** for a
bare import of the public API (esbuild, minified, browser platform), before fonts. The entire eager
data payload budget is 150 KB gzipped, and the builder is used standing at a table.

## Decision

Render the sheet on the server, in a route handler at `/api/armies/[id]/sheet`, and stream it as a
`Content-Disposition: attachment` download. The client ships nothing.

The route's only input is a share code (ADR 0010), validated with zod at the boundary along with an
optional `name`. It reads no database and resolves no session, so there is no ownership check to get
wrong and no way to address another player's list. A code that names a different army than the path
is refused. This also means an **unsaved** draft exports, which the roadmap requires — a list is
always saveable, exportable and shareable.

The sheet's content is a pure function, `armySheet` in `lib/domain/army/sheet.ts`, returning a plain
`ArmySheet`. The react-pdf component renders that and decides nothing. Correctness stays in
`lib/domain/` under the coverage floor, per ADR 0016. `armySheetResponse` in `lib/export/` takes its
bundle source as a parameter, the way a tRPC procedure takes its context: the route hands it the
real one, and its `*.test.ts` hands it `bundleSource` over a fixture directory built from the
vendored snapshot. So the unit suite renders a real PDF without `public/data/`, which is generated
and gitignored and which the `test` CI job does not build.

## Alternatives considered

- **Print stylesheet on a dedicated sheet component.** Zero bundle, exact app styling, works
  offline. Loses deterministic pagination, our own header and footer, and the page size — all of
  which the browser's print dialog owns. Still the cheaper answer if a real file is never wanted.
- **`@react-pdf/renderer` in the browser.** A real file with no round trip, at 461 KB gzipped plus a
  TTF on a phone at a table, for no styling benefit over rendering it on the server.
- **Headless Chromium printing the page.** The only way to get both exact CSS reuse and a real file.
  Rejected: roughly 400 MB of browser in a single self-hosted container (ADR 0006).
- **A tRPC procedure.** tRPC responses are JSON envelopes, so the bytes would have to be base64'd
  (~33% larger), decoded client-side into a Blob and downloaded through `URL.createObjectURL`,
  losing `Content-Disposition` and the plain shareable URL. A route handler is the right shape for a
  binary download, and `app/api/auth/[...all]` is already a non-tRPC route. The tRPC conventions
  this departs from — context injection and `signedInProcedure` ownership — do not apply to a
  stateless endpoint with no database and no session.

## Consequences

- The container carries ~18 MB more `node_modules` (`pdfkit` 10 MB, `fontkit` 5.6 MB,
  `@react-pdf/*` 2.4 MB) and two 256 KB TTFs.
- `output: 'standalone'` traces modules, not directories, and pdfkit reads 14 `.afm` font-metric
  files at runtime with `readFileSync`. `outputFileTracingIncludes` in `next.config.ts` pins those
  and the fonts to this route. This fails in the container and not in `yarn dev`, so the build is
  the only place it is caught — the standalone output is checked to carry all 14.
- Sheet colours are hex constants in `lib/export/pdf-theme.ts`, not the oklch tokens. A theme change
  does not reach the PDF. They are the stone palette the shadcn theme already resolves to.
- `buildArmyList` now carries the invasion and manoeuvre ratings and the home topographies it
  previously dropped, and the builder loads combat factors it previously discarded.
- There is no camp in the data. "Camp" on the sheet is derived from the `FC`, `NC`, `SW` and `PT`
  battle cards, and reads "Standard" when none is taken.
- No dark mode, and no live-updating preview: the sheet is only ever a download.

## Revisit trigger

Reopen if a player asks to print without a round trip (offline at a club, a phone with no signal),
or if the sheet needs to be edited or previewed in the page rather than downloaded. Either makes the
server the wrong place for it, and a print stylesheet the cheaper answer.
