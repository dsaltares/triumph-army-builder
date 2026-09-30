# 0016 — Put the middle of the test suite in React Testing Library, not Playwright

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** #108, #44, #45, #107, ADR [0011](0011-prerender-army-detail-from-the-bundle.md),
  ADR [0012](0012-builder-gating-in-the-url-selection-in-state.md),
  ADR [0013](0013-anonymous-armies-in-sqlite.md)

## Context

The suite had two kinds of test and no middle. `vitest.config.mts` set `environment: 'node'`, so
the component tests rendered with `renderToStaticMarkup` and asserted on the HTML string:

```ts
expect(markup).toContain('Stands 44 · Battle cards 0<');
expect(markup).toContain('aria-valuenow="48"');
expect(markup).toContain('width:100%');
```

The trailing `<` anchored the end of a text node and `width:100%` pinned an inline style. Nothing
below Playwright could click, type, or watch a component react to its own state, so every
interaction test had to be an end-to-end test whatever it was really about.

That was the whole critical path of CI. 132 tests across 9 specs ran against `desktop-chrome` and
`mobile-chrome` with `workers: 1` and `retries: 2` — 264 test runs, 268s to 342s. The other four
jobs finished inside 100s. `e2e/builder.spec.ts` alone was 1100 lines and 52 tests, and most of
them were not about the browser: a stepper changing a number, a switch revealing a contingent, a
radio picking an ally, a card cost reaching a total. That is component behaviour over `lib/domain/`
output, and the browser was carrying it because there was nowhere else to put it.

M5 was about to double the surface — sign-in and sign-up forms, army CRUD, My Armies with
search, sort, rename, duplicate and delete (#45), claim-on-sign-in (#44) — all interaction-heavy,
all headed for Playwright by default.

## Decision

Three kinds of test, each with a name, a location and a reason to reach for it.

**Unit — `*.test.ts`, Vitest `unit` project, `environment: 'node'`, beside the module.** Pure
logic, and the modules that own I/O driven for real: `lib/db/` and `lib/trpc/` run the real
statements and the real router against `createDatabase(':memory:')`, a fresh database per test.
This is the only project coverage is measured on, so the 90% `lib/domain/` floor keeps meaning
what it meant.

**UI — `*.test.tsx`, Vitest `ui` project, `environment: 'happy-dom'`, beside the component.**
React Testing Library with `@testing-library/user-event`, through `renderUi` in `test/ui.tsx`.
Everything a player does to a component and everything the component says back: steppers,
switches, radios, their disabled and limit states, validation findings appearing and clearing,
points arithmetic reaching the screen, empty states, and the accessible names and roles the old
tests reached for by string-matching `aria-*`.

**End-to-end — `e2e/*.spec.ts`, Playwright.** Only what cannot be simulated: prerendering and App
Router routing (ADR 0011), nuqs against the real History API (ADR 0012), `metadata` and page
titles, the real bundle fetched over HTTP, real sessions and real mail, the OAuth redirects, the
mobile viewport, and one thin journey per area proving the pieces are wired together against real
Meshwesh data rather than a fixture.

Three supporting seams make the middle possible without hand-written stubs:

- `test/bundle-server.ts` serves `/data/*.json` through MSW, so a component that fetches the
  bundle is tested through its real fetch path.
- `test/api.tsx` points MSW at `fetchRequestHandler` with the real `appRouter` and a fresh
  in-memory database, so a hook that calls tRPC exercises the real procedures, the real
  serialisation and the real ownership checks. No procedure is stubbed anywhere.
- `components/builder/army-builder-view.tsx` was split out of `army-builder.tsx` so the builder's
  wiring is testable without its loader — the view takes data, the loader fetches it.

`mobile-chrome` runs `e2e/mobile.spec.ts` and nothing else; `desktop-chrome` runs everything else.
Both projects stay in CI, but neither runs the other's tests twice.

## Alternatives considered

- **Keep everything in Playwright and shard it.** Buys wall clock with runners and leaves a
  1100-line spec whose feedback loop is a browser. The cost is paid on every run, forever.
- **Raise `workers` instead of cutting tests.** It does help — and it is now on — but on its own it
  leaves the suite the same size and hides the design problem behind hardware.
- **`DATABASE_URL=:memory:` for the e2e server.** Tried, and it does not work: the instrumentation
  hook and the route handlers do not share a connection instance, so with an in-memory database
  they get two different databases and every auth page answers "Database schema mismatch". A file
  hides that; memory exposes it. `confirmAddress` in `e2e/helpers.ts` also opens its own connection
  from the Playwright process, which no server-side in-memory database could serve. It would not
  have bought isolation either — one server process is one shared database whatever backs it.
- **`renderToStaticMarkup` with better assertions.** Cannot click. The interaction tests would
  have stayed in the browser, which was the actual problem.
- **jsdom instead of happy-dom.** Both pass all 252 UI tests unchanged. happy-dom is consistently
  ~30% cheaper: 18.4s of CPU against jsdom's 27.5s on the same suite, 4.3s against 6.0s of wall
  clock on an idle machine. The gap is environment construction, so it grows with file count.
  jsdom is the more faithful implementation and the fallback if happy-dom drops something.
- **Hand-written MSW handlers for tRPC.** Faster to run, but the stubs duplicate the router and
  drift from it. Running the real router over an in-memory database costs milliseconds and cannot
  drift.

## Consequences

CI's critical path stops being e2e. 1409 Vitest tests run in 15s across the two projects; 39
Playwright tests run in 7s against a production build, down from 264 test runs in 268–342s.

`workers: 1` is gone. It looked load-bearing at first — three separate runs went flaky in parallel
— but every one of those traced to the environment rather than the suite: the SQLite file was
deleted out from under a running server (the process keeps the deleted inode, new connections open
a fresh database, and Better Auth starts failing), or the machine was at load average 31 while a
build that normally takes 90s took 6.8 minutes. On an untouched database and an idle machine the
suite is clean over eighteen consecutive runs at one, two, four and six workers. CI takes
Playwright's default.

E2e now keeps its own database at `.data/e2e.sqlite` rather than sharing `.data/db.sqlite` with
`yarn dev`, so a test run and a dev session cannot tread on each other. `playwright.config.ts`
exports the path and both the `webServer` env and `e2e/helpers.ts` read it from there — a dotenv
file would need loading on both sides and would split the e2e environment across two places, when
the config already owns the OAuth client ids the specs import.

The honest cost is fidelity. A UI test renders a component with props the test chose, so it can
pass against a component the real app never renders, or renders differently. Two things hold that
down, and neither is free:

- Every area keeps at least one Playwright journey against real bundle data, so a component that
  only works on fixtures is caught.
- The builder's UI tests go through `ArmyBuilderView`, the same component the app renders, with
  the same reducers. They do not re-wire the sections themselves. A section test that invents its
  own state handling is a test of the test.

Two smaller costs are worth naming. `yarn test` is two Vitest invocations rather than one, because
coverage is global to a run and the UI project must not touch the `lib/domain/` floor. And the
accessible name a DOM implementation computes is not always the one Chrome computes — an `sr-only`
span with no whitespace before it reads as `Fortified Camprules` under `dom-accessibility-api` and
`Fortified Camp rules` in the browser — so a few UI queries match on a tolerant pattern where the
Playwright ones did not have to.

## Revisit trigger

Reopen if a bug reaches `main` that a Playwright test would have caught and the UI tests did not —
that is the fidelity trade coming due, and the answer is another journey, not another unit test.
Reopen also if the Vitest `ui` project passes 60s, or if happy-dom fails on a component the app
ships; jsdom is one line away in `vitest.config.mts`.
