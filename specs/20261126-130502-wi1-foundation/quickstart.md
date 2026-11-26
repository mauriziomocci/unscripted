STATUS: DONE (approved provisionally, D-26-5)

# Quickstart: WI-1 Foundation

This page tells a developer how to run, test and build WI-1 once its tasks have landed; none of these commands exists before then. It follows FR-002 (containers by default), FR-060 to FR-062 (Docker), US5 (artifact build) and US6 (goldens). The README.md and README.it.md sections that replace it are written in the same commits as the code (FR-102).

## Prerequisites

- Docker with Compose v2. Nothing else on the host: Node 22 and pnpm 12.20.0 live in the images, Python 3 only in the dev stage of the server image (for the `build.py` comparison, FR-082), the browsers in the Playwright image of the `e2e` service. The owner's host has Node 26 and no corepack, which `engine-strict` refuses by design (FR-002).
- For real model calls: an Anthropic key, or LM Studio running on the host with a model loaded. Containers reach LM Studio at `http://host.docker.internal:1234/v1` (L-02).

## First start

```bash
cp .envs/.local/server.env.example .envs/.local/server.env    # every variable has a safe default or a placeholder (FR-062)
cp .envs/.local/web.env.example .envs/.local/web.env
docker compose -f docker-compose.local.yml up --build
```

The `server` waits for PostgreSQL, runs the migrations under `pg_advisory_lock`, seeds the two packs once (FR-024), writes the session token into the `session-token` volume, and only then reports healthy; `web` starts after that (FR-041). Open `http://localhost:5173`. Only the web port is published, on `127.0.0.1` (FR-040); SC-001 expects every service healthy in under 3 minutes after the images are pulled.

If every page shows the "restart the stack" message, the token volume was removed while the stack ran (US3 scenario 2): `docker compose -f docker-compose.local.yml down && docker compose -f docker-compose.local.yml up`.

## Every pnpm command runs in a container

```bash
alias dc='docker compose -f docker-compose.local.yml'
dc run --rm server pnpm install
dc run --rm server pnpm lint && dc run --rm server pnpm format:check
dc run --rm server pnpm typecheck
dc run --rm server pnpm test                                  # unit tests, every workspace, with coverage floors (FR-004)
dc run --rm server pnpm --filter @unscripted/server test:integration   # against the unscripted_test database
dc run --rm --profile e2e e2e pnpm test:e2e                   # Playwright: web pages, axe in both themes, artifact smoke
```

Parallel sessions do not share a database: set `DATABASE_URL_TEST` to a database of your own before running the integration tests (owner's isolation rule; the init script creates `unscripted_test` only).

## Tooling notes

- ESLint loads `eslint.config.ts` through Node's native TypeScript support. The dev image sets `ESLINT_FLAGS=unstable_native_nodejs_ts_config`, so `dc run --rm server pnpm exec eslint <file>` works inside the container; outside it a bare `eslint` call exits 2 ("Oops! Something went wrong").
- `pnpm lint` runs ESLint, `scripts/check-taste-exemptions.ts` (every `eslint-disable` and `jscpd:ignore-start` needs `taste-exempt: <reason>`) and `jscpd`.
- pnpm 12 reads its settings from `pnpm-workspace.yaml`, not from `.npmrc`; `engineStrict: true` is why an install on Node 26 is refused.

## Artifact (US5)

```bash
dc run --rm server pnpm --filter @unscripted/artifact build   # writes apps/artifact/dist/index.html and dist/test.html
dc run --rm server pnpm --filter @unscripted/artifact test    # manifest, byte identity, build.py comparison, size check
```

The byte test compares with SC-003: `dist/index.html` md5 `2374c745827c2b2e57fd6dd493d32e03`, `dist/test.html` md5 `90f56d4a5c50ac646fba52cb2748157e`. The `build.py` comparison runs `python3 build.py x` in a temporary copy, inside the server's dev image, with `PYTHONUTF8=1` added to the inherited environment (FR-082, research R-01, R-14). The smoke test plays a short island game, talk show, Venture mission and novel on `test.html` with the mock and fails on any console error (FR-083).

**Before every work item and before every vendoring** (section 1, AM2-01), check the external reference against the committed md5 manifest, on the Mac:

```bash
M=../../unscripted/specs/20261113-111328-v1-port/reference-2026-11-23.md5
cd ../unscripted-reference/2026-11-17
grep -v '^#' "$M" | awk '{print $2}' | xargs md5 -r | awk '{print $1"  "$2}' | diff - <(grep -v '^#' "$M")
```

The manifest's own header says `md5sum -c` (Linux) or `md5 -r` (macOS); its lines are `<md5>  <path>` with two spaces, which the `awk` reproduces. An empty diff means the reference is the pinned one (41 files). The first vendoring task runs this command and records its output.

## Goldens (US6)

```bash
dc run --rm server pnpm --filter @unscripted/artifact build   # the harness reads dist/index.html from disk (R-13)
dc run --rm server pnpm golden:record island --seed 777 --ticks 300
dc run --rm server pnpm golden:check
```

Goldens are written to `tools/golden/goldens/` (not `data/` or `build/`, which `.gitignore` ignores). The check refuses to run on a Node major other than the header's (FR-097). The header records the seed, setup fixture, speed rule, tick order, mock latencies, fake-clock start values, Node major and the vendored manifest hash (FR-096).

## Backup and restore (FR-062)

```bash
dc --profile backup run --rm backup                           # pg_dump into ./backups/ (git-ignored)
dc exec -T db psql -U unscripted unscripted < backups/<file>.sql
```

The archive can also be exported from the archive page as an `archivio/1` file, which both forms import.

## Production compose (FR-061)

```bash
cp .envs/.production/server.env.example .envs/.production/server.env
docker compose -f docker-compose.production.yml up --build -d
```

Built images, no source mounts, nginx-unprivileged serving the build and proxying `/api` with the token, the same health checks and `127.0.0.1` bindings.

## Branches

All WI-1 work is committed on `20261126-130502-wi1-foundation`, which is pushable: decision D-26-8 closed Q-26-1 (`qualita.js` vendored with the names in its comment redacted) and Q-17-2 (the 45 sheets published as they are), so there is no held work and CI runs on every push.
