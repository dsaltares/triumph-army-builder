# triumph-army-builder

Army builder for the Triumph! historical miniature wargame: browse the army lists, build one
within the points cap, save it, share it and print it.

Next.js 16 (App Router), React 19, TypeScript, tRPC, Better Auth and SQLite, self-hosted as a
single container.

## Development

Requires Node 24 (see `.nvmrc`) and Corepack for the pinned Yarn version.

```sh
corepack enable
yarn install
yarn dev
```

The dev server listens on [http://localhost:3013](http://localhost:3013). Every environment
variable has a working default in development, so a fresh clone needs no `.env`; `.env.example`
lists them.

`yarn dev` seeds the reference data version pinned in `reference-version.txt` into the local
database. It comes from the private data repo's releases, downloaded once with your
`gh` login and cached under `~/.cache/triumph-army-builder/`; without access, you get a sample pack
of invented armies. A token that can read the releases also works as `REFERENCE_PACK_TOKEN`, in the
environment or in `~/.config/triumph-army-builder/env`.

The scripts are in `package.json`, and `AGENTS.md` says what each one is for.

## Testing

```sh
yarn test                          # Vitest: unit, then UI
yarn playwright install            # once per machine
yarn test:e2e                      # Playwright, against its own build and database on 3099
E2E_PORT=3199 yarn test:e2e        # when port 3099 is taken, e.g. by another worktree
yarn test:e2e:dev                  # against next dev, for hot reload while writing a spec
```

The three kinds of test, and which one a change needs, are in
[ADR 0016](docs/adr/0016-three-kinds-of-test-with-the-middle-in-rtl.md) and `AGENTS.md`.

## Data

Army lists come from the public [Meshwesh](https://meshwesh.wgcwar.com/api/v1) API, by way of a
snapshot and curated overlays kept in the private data repo. `yarn data:pack` turns them into a
reference pack, `yarn db:import-reference` writes a pack into the database, and the app serves it
from there; neither the build nor the image carries reference data. `yarn db:seed:reference`,
which `yarn dev` runs, does the import for you. The reasoning is in ADRs
[0001](docs/adr/0001-snapshot-over-live-api.md), [0003](docs/adr/0003-one-data-version-per-army.md),
[0034](docs/adr/0034-reference-data-lives-in-sqlite-served-over-trpc.md) and
[0035](docs/adr/0035-reference-data-ships-as-a-pack-from-a-private-repo.md).

## Configuration

| Variable | Default | What it is |
|---|---|---|
| `DATABASE_URL` | `.data/db.sqlite`, or `/data/db.sqlite` in the container | SQLite database file |
| `REFERENCE_PACK` | unset | A reference pack for `yarn db:seed:reference` to seed instead of the pinned one. For unreleased data |
| `REFERENCE_PACK_TOKEN` | `gh auth token` | A GitHub token that can read the data repo's releases, for `yarn db:seed:reference` |
| `PHOTO_DIR` | `/data/photos` | Where collection photos are stored. Back it up with the database |
| `COLLECTION_PHOTOS_PER_ENTRY` | `6` | Most photos one collection entry may hold |
| `COLLECTION_PHOTOS_PER_ACCOUNT` | `200` | Most photos one account may hold |
| `BETTER_AUTH_SECRET` | development fallback | Signs sessions and tokens. **Required in production**: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3013` | The app's own origin, and the origin of every link it mails. **Required in production** |
| `IP_ADDRESS_HEADERS` | `x-forwarded-for` | Headers that carry the client address, for rate limiting. `cf-connecting-ip` behind Cloudflare |
| `TRUSTED_PROXIES` | unset | CIDRs of the proxies in front of the app, for a multi-hop `x-forwarded-for` |
| `GEO_DATABASE_DIR` | the installed `@ip-location-db/dbip-city-mmdb`, or `/app/geo` in the container | The DB-IP Lite City `.mmdb` files that place an address in a country, region and city |
| `ADMIN_EMAILS` | unset | Comma-separated emails of the admins. Only a verified account with one of them is an admin |
| `GOOGLE_CLIENT_ID` / `_SECRET` | unset | Enables Google sign-in. It needs both |
| `DISCORD_CLIENT_ID` / `_SECRET` | unset | Enables Discord sign-in. It needs both |
| `RESEND_API_KEY` / `EMAIL_FROM` | unset | Sends mail through Resend. Without them, mail is logged instead |
| `DISABLE_AUTH_RATE_LIMIT` | unset | `1` turns off the auth rate limits. For the e2e server only |

## Deployment

```sh
yarn data:pack --out .data/reference/pack.json.gz
docker compose up --build
```

This runs the app on port 3013, bound to `127.0.0.1`, with SQLite and the collection photos in the `/data` volume. A backup has to take the whole
volume: the rows in `db.sqlite` and the files under `photos/` are only whole together. The server
imports the reference pack mounted at `/app/reference/pack.json.gz` on startup, and `/api/health`
fails until a reference version is current.

A push to `main` publishes
[`ghcr.io/dsaltares/triumph-army-builder`](https://github.com/dsaltares/triumph-army-builder/pkgs/container/triumph-army-builder)
and rolls it out to the homelab over a Cloudflare Access SSH tunnel (`.github/workflows/docker.yaml`).
A `v*` tag publishes a versioned image without deploying it. The deploy job runs in the
`production` environment, which only `main` can deploy to, and needs its `SSH_PRIVATE_KEY`,
`SSH_HOST`, `SSH_USER`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` secrets, a
`DATA_REPO_TOKEN` that can read the data repo's contents, and the `DEPLOY_COMPOSE_DIR`,
`DEPLOY_SERVICE` and `DEPLOY_REFERENCE_DIR` repository variables: the absolute path of the compose
project on the host, the service's name in it, and the absolute path of the directory the service
mounts read-only at `/app/reference`. Each deploy downloads the reference pack
`reference-version.txt` pins from the data repo's releases, copies it there, backs up the running database to
`/data/backups/` with `scripts/backup-database.ts`, which the image carries, keeping the last ten, and restarts the service. It fails if the service is not then running
the commit it deployed. See
[ADR 0006](docs/adr/0006-self-hosted-single-container.md).

## Docs

- [`AGENTS.md`](AGENTS.md): commands, conventions and where things live
- [`docs/DOMAIN.md`](docs/DOMAIN.md): the domain model and data caveats
- [`docs/ROADMAP.md`](docs/ROADMAP.md): the delivery roadmap
- [`docs/adr/`](docs/adr/README.md): decisions that are expensive to reverse
- Scope and acceptance criteria for a piece of work live on its GitHub issue
