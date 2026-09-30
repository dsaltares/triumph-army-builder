import { notFound } from 'next/navigation';

// With `localePrefix: 'never'` every path is rewritten under `[locale]`, so an
// unmatched URL never reaches a root-level `not-found.tsx`. Catching it here
// keeps the 404 inside the locale segment, which is what gives it the site
// chrome and a translated page.
//
// It renders at request time so that `notFound()` sets the status. Prerendered,
// the same page comes back as a 200 that only looks like a 404.
export const dynamic = 'force-dynamic';

export default function CatchAll(): never {
  notFound();
}
