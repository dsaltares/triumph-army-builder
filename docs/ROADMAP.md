# Triumph! Army Builder — Roadmap

Why the app is built this way, and in what order. The work itself lives in GitHub issues and
milestones; this file deliberately does not restate them. Read `docs/DOMAIN.md` first.

## Decisions taken

| Decision | Choice |
|---|---|
| Architecture | Self-hosted server. Next.js 16 App Router, mirroring `dsaltares/finlight`. |
| Auth | Better Auth. Email/password first, then Google + Discord OAuth. **Email verification on**, which is what makes implicit account linking safe (ADR 0015). |
| Transactional email | Resend free tier (account created). Password reset only. |
| Logged-out use | Armies live in SQLite behind a Better Auth anonymous session, claimed on sign-in. No IndexedDB store. |
| Deployment | ghcr.io image → `dsaltares/homelab` via SSH over Cloudflare Access, mirroring finlight and obsidian-sync. |
| Rulebook data | Public Meshwesh data only. Rulebook-derived data gated behind M8 (WGC permission). |
| Validation | Warn, never block. A list is always saveable, exportable and shareable. |
| Game modes | Triumph! 48 points only. Grand Triumph and event profiles deferred to M9. |

The ones that are expensive to reverse are written up in full, with alternatives and a revisit
trigger, in [`docs/adr/`](adr/README.md).

## Stack

TypeScript (strict) · yarn · Biome · Next.js 16 (App Router, React 19) · Tailwind 4 + shadcn/ui ·
tRPC 11 · TanStack Query 5 · TanStack Table 9 · Kysely + SQLite (better-sqlite3) · Better Auth ·
Resend · Zod 4 · React Hook Form 7 · Fuse.js 7 · Vitest + Playwright · Docker Compose, image on
ghcr.io

## Labels

**Area** — `area:infra` `area:data` `area:domain` `area:ui` `area:api` `area:auth` `area:export`
**Type** — `type:feature` `type:chore` `type:spike` `type:docs` `type:bug`
**Size** — `size:s` (< half day) `size:m` (1–2 days) `size:l` (3+ days)
**Status** — `blocked:permission` `blocked:upstream` `good-first-issue`

## Dependency spine

```
M0 foundations
   └── M1 data pipeline ──┬── M2 domain core ──┬── M3 explore
                          │                    └── M4 builder ──┬── M6 share & export
                          │                                     └── M7 PWA
                          └── M5 accounts & persistence ────────┘
M8 (permission-gated) and M9 (future) hang off the completed app.
```

M2 is the critical path. It is pure, headless and fully testable without any UI — build it first
and the rest is presentation.

## Milestones

| Milestone | What it delivers |
|---|---|
| [M0 — Foundations](https://github.com/dsaltares/triumph-army-builder/milestone/1) | Scaffold, tooling, CI, container image, homelab deploy. Nothing user-facing. |
| [M1 — Data pipeline](https://github.com/dsaltares/triumph-army-builder/milestone/2) | Meshwesh snapshot, Zod parsing, and the curated overlays for battle card costs and sub-factions. The app's correctness rests on it — see `docs/DOMAIN.md` §1–§8. |
| [M2 — Domain core](https://github.com/dsaltares/triumph-army-builder/milestone/3) | Types, availability resolver, points engine, validator, share codec. Pure TypeScript, zero React, zero I/O. |
| [M3 — Explore](https://github.com/dsaltares/triumph-army-builder/milestone/4) | App shell, then read-only browsing: army index, army detail, enemies, thematic categories, reference pages. |
| [M4 — Builder](https://github.com/dsaltares/triumph-army-builder/milestone/5) | Required troops, optional contingents, allies, battle cards, general designation, validation panel. |
| [M5 — Accounts & persistence](https://github.com/dsaltares/triumph-army-builder/milestone/6) | Email/password first, OAuth second — the password path is the one that needs the schema, the mail transport and the rate limiting, and OAuth then layers onto a working account model. The app stays fully usable logged out. |
| [M6 — Share & export](https://github.com/dsaltares/triumph-army-builder/milestone/7) | Share links, printable list and PDF, plain-text export. |
| [M7 — PWA & mobile](https://github.com/dsaltares/triumph-army-builder/milestone/8) | Serwist, offline reading, a one-handed builder pass, offline editing queue. |
| [M8 — Permission-gated (WGC)](https://github.com/dsaltares/triumph-army-builder/milestone/9) | Rulebook-derived data, pending Washington Grand Company's permission. Movement and basing ship ahead of it (ADR 0029, 0033). |
| [M9 — Future](https://github.com/dsaltares/triumph-army-builder/milestone/10) | Grand Triumph, arbitrary points caps, event profiles, list comparison, collection tracking. |

Each item is a GitHub issue carrying its own scope and *done when*: `gh issue view <n>`, or browse a
milestone above. Open/closed state lives there, not here.
