# 0011 — Prerender the army detail pages from the bundle at build time

- **Status:** Superseded by [0034](0034-reference-data-lives-in-sqlite-served-over-trpc.md)
- **Date:** 2026-09-17
- **Related:** #27, #26, #46, #50, ADR [0009](0009-generated-static-bundle-with-an-eager-index.md)

## Context

ADR [0009](0009-generated-static-bundle-with-an-eager-index.md) generates `public/data/` from the
snapshot and describes `armies/<id>.json` as a per-route fetch, so that "a detail page is one
request". It says that in the context of the payload budget, and leaves open who makes that
request.

An army detail page (#27) has no state. It shows everything the list offers at every year and
every sub-faction, annotated with the dates and restrictions each option carries, because a reader
comparing lists wants to see the gating rather than have it applied — the year and sub-faction
pickers belong to the builder (#31). Nothing on the page reacts to input, so nothing on it needs
to run in the browser.

The two shapes available were a client component fetching its own JSON, and a server component
reading the generated file. Measured on this data, prerendering all 656 detail routes adds 2.5s to
`yarn build` (12s total) and no runtime data path at all.

## Decision

`app/(site)/armies/[id]` is a server component. `lib/data/bundle-source.ts` reads the generated
bundle off disk, parses it through the Zod schemas in `lib/data/bundle-schema.ts`, and memoises the
files every route shares. `generateStaticParams` walks `index.json`, and `dynamicParams = false`,
so all 656 pages are static HTML and an id the bundle does not hold is a 404 without touching the
filesystem.

The bundle stays exactly what ADR 0009 made it: the builder (#31–#35) fetches the same
`armies/<id>.json` from the browser, because it has a year, a sub-faction and a selection to react
to.

## Alternatives considered

- **Fetch the JSON from a client component.** Pays a request and a loading state on every
  navigation to render text that never changes, and leaves `generateMetadata` with no army name —
  which is the title of the page a share link (#46) opens.
- **Read the snapshot rather than the bundle.** 5.8 MB of build-time input parsed to render one
  army, and the page would no longer see what the client sees.
- **Render on demand instead of prerendering.** Keeps a filesystem read on the request path of a
  page that cannot change between deploys, for a build that is 2.5s shorter.

## Consequences

- The detail route ships no data JavaScript, renders on the first paint and is indexable.
- `public/data/` becomes a build-time input to the app, not only a runtime asset. `yarn dev` and
  `yarn build` already generate it first, and `bundle-source.ts` says to run `yarn build:bundle`
  when a file is missing.
- The bundle is parsed on the way in, so a schema drift between `lib/data/bundle.ts` and what a
  route expects fails the build rather than rendering a hole.
- Adding an army means a new route, so the data version and the deploy move together — which is
  what ADR [0003](0003-one-data-version-per-army.md) already assumes.
- Offline reading (#50) caches the pages as well as the JSON, and both come from the same origin.

## Revisit trigger

The detail route grows a control that changes what it shows — a year picker on the explore screen,
say — or prerendering the lists passes a minute of build time, at which point on-demand rendering
with a cache becomes the cheaper shape.
