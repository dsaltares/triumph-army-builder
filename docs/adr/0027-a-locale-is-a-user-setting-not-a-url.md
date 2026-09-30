# 0027 — A locale is a user setting, not a URL

- **Status:** Accepted
- **Date:** 2026-09-21
- **Related:** #120, #53, [0005](0005-public-data-only.md),
  [0008](0008-sub-faction-overlay-keyed-on-the-note-string.md),
  [0011](0011-prerender-army-detail-from-the-bundle.md), [0013](0013-anonymous-armies-in-sqlite.md),
  [0020](0020-render-the-printable-list-as-a-server-side-pdf.md)

## Context

The app was English by construction. `<html lang="en">` was hard-coded, roughly 620 string
literals sat inline at their point of use across 102 components, six `Intl` formatters were
module-level singletons pinned to `en-GB`, and the whole Meshwesh snapshot was English prose
rendered straight through. Issue #120 asks for Spanish, and for a shape that takes a third
language without a restructure.

Three constraints shaped everything:

- **The language follows the player, not the browser.** A list built on a phone and opened on a
  laptop should read the same. That makes it account state, not a device preference.
- **It must not change the URL.** One set of paths, whatever the language, so a link pasted into
  a forum opens for everyone and every share link keeps working.
- **Prerendering has to survive.** ADR 0011 prerenders every army list, and the reason it gave
  still holds.

"A cookie decides the language" and "pages are static files" are normally incompatible: a static
HTML file cannot vary on a cookie. next-intl resolves this with `localePrefix: 'never'`, which is
documented for exactly this case — every request is rewritten to a locale prefix *internally*,
pages live under `app/[locale]/`, and `generateStaticParams` cross-products locale × id.

## Decision

**The locale is a column on `users`, carried by a cookie, and never in the URL.**

- `users.locale`, added by migration `005-user-locale`, is the source of truth. The cookie is the
  carrier, because ADR 0013 means a logged-out visitor has no row until their first write, and
  because the proxy has to resolve a locale without a database read on every request.
- Resolution order in `proxy.ts`: cookie, then `Accept-Language`, then `en`.
- On sign-in the account wins and rewrites the cookie, reconciled next to the claim logic that
  already runs there. If that reconcile fails, the cookie is left alone and the failure is logged:
  the wrong language is a worse read, not a broken session.
- Pages sit under `app/[locale]/`; the proxy rewrites `/armies/66c` to `/es/armies/66c`
  internally. The build goes from 1,352 to 2,737 prerendered pages.
- App copy lives in `messages/<locale>.json`, namespaced by area. A missing key falls back to the
  English catalogue rather than rendering the key.
- Game data is translated as an ADR 0008 overlay: `data/translations/<locale>/`, every entry
  storing the English it was translated from, merged where the curated overlays already merge, and
  falling back to English when it does not match.

Two things follow that are worth stating rather than discovering:

- **`Vary: Cookie` does not protect this.** Cloudflare ignores `Vary` except for
  `Accept-Encoding`, and Next overwrites it on prerendered routes and serves
  `Cache-Control: s-maxage=31536000`. One URL now returns two HTMLs, so the proxy sets
  `Cache-Control: private, no-cache`. Without that, a Spanish visitor warms the cache for
  everyone.
- **hreflang alternates are off** in this mode, because URLs are not unique per locale. Spanish is
  not separately indexable. That is the price of the no-URL-change requirement, paid knowingly.

## Alternatives considered

- **`/es/armies/…` path prefixes.** The default, the best for search, and the one thing the
  requirement rules out: every existing link would need a locale, and a share link would carry the
  language of whoever sent it.
- **A cookie alone, no database column.** Simpler, and wrong across devices — the whole point is
  that the setting follows the player.
- **A database column alone.** Needs a read on every request before the first byte, and has
  nothing to say about a visitor who has never signed in.
- **`Vary: Cookie`.** Tried first and measured; see above.
- **Runtime-fetched catalogues.** The test harness runs MSW with `onUnhandledRequest: 'error'`, so
  a catalogue fetched at runtime would fail every UI test. Static imports, then.

## Consequences

- One URL, two renderings, so nothing may cache a page publicly. The `Cache-Control` in `proxy.ts`
  is load-bearing and has a comment saying so.
- The build roughly doubles in page count, and the data bundle doubles in file count — 661 files
  per locale, each locale measured against the 150 KB budget on its own. Spanish is 26.5 KB eager.
- Text that used to be assembled from fragments cannot be. `validateArmy` produces
  `{ code, severity, target, params }` and is rendered outside `lib/domain/`; `plural(n, one)` no
  longer defaults to `one + 's'`; the camp codes, the battle card costs and the bounds hints all
  render through the catalogue.
- Anything that cannot reach a translator carries a *key* instead of a sentence: the tRPC errors,
  the Better Auth error codes, the zod schemas. The client renders them, and passes an
  unrecognised message through unchanged so a dropped connection still says something.
- The PDF route stays sessionless per ADR 0020, so it cannot read the cookie: the language travels
  in `?lang=`, which `armySheetUrl` sets.
- Emails read the locale from the account they are being sent to, since an email has no cookie.
- **404s had to be rebuilt around the rewrite**, and this cost a loading state. Two things broke
  quietly when the pages moved under `[locale]`, and only `yarn test:e2e` caught them:
  - A root `app/not-found.tsx` never runs, because every path is rewritten into the segment. An
    unmatched URL now hits `app/[locale]/[...rest]/page.tsx`, which does nothing but call
    `notFound()` — that is what keeps the 404 inside the locale, with the chrome and in Spanish.
  - `app/(site)/loading.tsx` made every route in the group stream, and a streamed response has
    already committed `200` before `notFound()` runs. Every 404 under `(site)` was a soft one:
    the right page, the wrong status. The segment-level loading state is gone; the four routes
    that actually wait already stream their own skeleton through `<Suspense>`, so what was lost
    is a generic fallback and what was regained is `dynamicParams = false` meaning what ADR 0011
    says it means.
- **Machine translation is the starting point, not the end.** Every entry keeps its English source,
  so a reviewed translation can replace it file by file, and `yarn refresh:report` names anything
  missing, drifted or orphaned after an upstream refresh. That report never fails the build: a
  stale translation falls back to English, which reads worse but works. `validate:snapshot` keeps
  throwing for the curated overlays, where a mismatch is a bug rather than a gap.

## On rules text and #53

Army names are largely historical fact, but battle card rules text is the Washington Grand
Company's published wording, and a translation of it is a derivative work. ADR 0005 restricts this
app to publicly available data, and #53 is open on exactly this question. The decision here is to
include the rules text, and to keep it in `battle-cards.json` and nowhere else — so if #53 comes
back unfavourable, deleting one file drops rules-text translation and nothing else, and every card
falls back to English on its own.

## Revisit trigger

Any of:

- A third locale is added and the `messages/<locale>.json` plus `data/translations/<locale>/`
  layout stops being enough — most likely if a language needs different plural categories or
  right-to-left layout.
- Spanish search traffic is worth indexing, which means paying for path prefixes and the URL
  change they force.
- Cloudflare gains honest `Vary: Cookie` support, or the app moves off it, at which point the
  blanket `private, no-cache` could become a cookie-varying public cache.
