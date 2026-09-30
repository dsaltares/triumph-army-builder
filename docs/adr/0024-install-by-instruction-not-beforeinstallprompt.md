# 0024 — Make the app installable with a manifest, and prompt by instruction

- **Status:** Accepted
- **Date:** 2026-09-20
- **Related:** #49, #50, #123, `docs/adr/0006-self-hosted-single-container.md`

## Context

The builder is used standing at a club table, on a phone, and a home-screen launch is worth more
there than anywhere else: no address bar eating a quarter of a 6-inch screen, and one tap instead
of a bookmark.

A browser asks for one thing before it will install a site: a web app manifest, served over HTTPS,
naming an icon of at least 192 px and a `display` other than `browser`. A service worker is not
part of that bar, and the caching that would justify one belongs to #50.

The Chromium way to ask for the install in-app is `beforeinstallprompt`: catch the event, stash it,
call `prompt()` from a button. It is not in any standard, it is not in Safari, and on iOS every
browser is Safari. Half the phones at a table would get a button that does nothing. Chromium also
decides on its own whether to fire the event at all, so the button's existence depends on a
heuristic we cannot see.

Neither platform lets a page install itself without the browser's own menu. What a page *can* do is
say which menu item to look for.

## Decision

`app/manifest.ts` carries the manifest, and that is the whole of installability. Its colours are
hex — the OS parses them for the splash and the task switcher, and cannot read the `oklch()` the
stylesheet is written in — so `lib/brand.ts` holds the app background in both notations and the
manifest and `viewport.themeColor` both read it from there.

`components/layout/install-prompt.tsx` prompts by instruction: a bottom drawer naming the
platform's own wording, Share → Add to Home Screen on iOS and Install app elsewhere. It renders
nothing on a desktop, nothing when `(display-mode: standalone)` matches, and nothing after it has
been turned down once.

**It asks on the second visit, or as soon as the first list is saved.** Not on the first paint of a
first visit: an install ask is a one-shot — a dismissal is remembered forever — and spending it on
someone who has not yet seen what the app does buys a reflex. A visit is a browser session, so a
reload is not a second one.

No service worker, no `beforeinstallprompt`, no push notifications.

## Alternatives considered

- **`beforeinstallprompt` with an iOS fallback.** Two code paths, one of them dead on half the
  devices, and the live one at the mercy of a Chromium heuristic. The instructions have to exist
  either way; this only adds a button beside them.
- **No prompt at all.** The browser's own install affordance is three taps deep in a menu nobody
  opens. A player who would want the app on their home screen would never learn it was possible.
- **A banner in the page, above the footer.** What #141 shipped, and unseen: on the army index or
  a full builder page it sits below the fold, and a prompt you have to scroll to find is not one.
  The drawer replaced it before either reached a release.
- **A modal on app open.** Same drawer, on the first paint of the first visit. Maximum reach and
  the worst moment: nothing has been shown yet, so the answer is reflexive, and the reflex is
  permanent.
- **A service worker now, to be safe about Chrome's installability criteria.** Chrome dropped the
  worker requirement, and shipping one before there is caching to put in it means a cache
  invalidation problem with no feature behind it. #50 owns it.

## Consequences

Installability is testable from the outside — the manifest is a route, and `e2e/root.spec.ts`
reads it — but the install itself is not: nothing tells the app it was installed, and the only
later signal is `(display-mode: standalone)` matching on a visit that may never come.

The drawer's copy names a menu item we do not control. Browsers word it differently, so it names
both wordings and stops short of a screenshot-level walkthrough.

Saving a list now has a second meaning, and `useCreateArmy` carries it: one call to
`recordListSaved`, which the drawer hears as an event. It is a thread between two unrelated
features, and it is the price of asking at the moment the app has proved itself.

A modal that opens mid-hydration mutates `aria-hidden` on nodes React is still hydrating, which it
reports as a mismatch and repairs by re-rendering that subtree. The drawer waits for the page to
settle first, which is a delay rather than a guarantee: a page whose data resolves later than that
could still race it.

`X-Frame-Options: DENY` now applies to every route, so nothing here may be embedded in an iframe.
No feature does.

## Revisit trigger

A standard, cross-browser install API — or `beforeinstallprompt` landing in Safari. Also #50: if a
real device turns out to need a service worker before Chrome will offer the install, the worker
arrives there and this record is amended to say so.
