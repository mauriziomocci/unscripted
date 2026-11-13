# CLAUDE.md

Guide for Claude Code — Unscripted: a stage for free-willed AI characters.

Conventions are adapted from the owner's Epocha project. Unscripted is a game,
not a scientific simulation: Epocha's scientific-rigor and citation rules do
not apply here. Everything else about workflow, quality and documentation
does.

## Project

- **Repository**: https://github.com/mauriziomocci/unscripted
- **License**: MIT
- **Owner**: Maurizio Mocci (@mauriziomocci)
- **Status**: pre-release

## Quick Reference

```bash
docker compose -f docker-compose.local.yml up --build    # web app + server, hot reload
docker compose -f docker-compose.local.yml ps
pnpm install
pnpm test                       # all workspaces (Vitest)
pnpm --filter @unscripted/core test
pnpm lint && pnpm format:check  # ESLint + Prettier
pnpm typecheck
pnpm --filter @unscripted/artifact build   # single-file Claude artifact
```

## Architecture

**Stack**: TypeScript everywhere | pnpm workspaces | React + Vite + three.js (front end) | Node + Fastify (back end) | PostgreSQL (Drizzle ORM, versioned migrations) for archive, games and event log | Vitest | ESLint + Prettier | Docker Compose

**Workspaces**:
- `packages/core` — the game engine. Pure TypeScript, no DOM, no Node APIs. Characters and archive model, island simulation, talk show, prompts, reports. Every environment lives here.
- `apps/web` — React front end. Rendering, input, panels. No game rules.
- `apps/server` — Fastify back end: LLM proxy (Anthropic, LM Studio), model listing, persistence in PostgreSQL. Holds secrets; the browser never sees an API key.
- `apps/artifact` — builds the single self-contained HTML page published as a claude.ai artifact, from the same `packages/core`.

**LLM access** goes through one interface in core:

```ts
interface LlmClient {
  complete(request: {
    prompt: string;
    tier: 'main' | 'light';     // main = character lines and decisions, light = listening, chorus, twists
    maxTokens?: number;
  }): Promise<string>;
}
```

Implementations: `HttpLlmClient` (web app, calls `apps/server`), `ArtifactLlmClient` (artifact, calls the artifact runtime's `sample` capability). Providers on the server: `anthropic`, `lmstudio` (OpenAI-compatible, `LMSTUDIO_BASE_URL`, default `http://host.docker.internal:1234/v1`). Model names come from configuration or from the provider's model list, never hard-coded in core.

**Storage** goes through one interface in core (`Store`): server-backed (PostgreSQL) in the web app, IndexedDB in the artifact. Both persist the same data model: versioned characters, games, an append-only event log, periodic state snapshots, reports and LLM call records.

---

## Agent Rules

### CRITICAL: Web app and artifact stay aligned

The web app and the Claude artifact are two builds of the same game. They must never drift apart.

1. All game rules, prompts, data models and report logic live in `packages/core`. Nothing game-related is written in `apps/web` or `apps/artifact`.
2. A change to core is followed, in the same work item, by rebuilding the artifact and checking it still runs (test page with the mock LLM).
3. Platform differences are allowed only behind the `LlmClient` and `Store` interfaces and in rendering.
4. A feature added to one form is added to the other in the same work item, or recorded as an explicit, temporary gap in `docs/alignment.md` with a reason.

### CRITICAL: Three-Step Design Process

Before producing any design document, follow three mandatory steps. Skipping is forbidden regardless of perceived simplicity.

1. **Initial proposal**: present a first complete design (models, interfaces, data flow, trade-offs, dependencies). Do not write the spec file yet.
2. **First critical self-review**: deep adversarial self-review. Look for anti-patterns, missing edge cases, architectural smells, performance issues, race conditions, security gaps. Write categorized findings (critical / important / minor / what works) with proposed fixes.
3. **Second self-review and consolidation**: review the fixes with fresh eyes, look for problems they introduced, produce the final consolidated design. Only then write the spec.

### CRITICAL: Every Spec Includes a FAQ Section

Every design specification ends with a FAQ covering: design decisions (why X and not Y), integration with existing systems, performance and limits (latency, LLM calls per minute, cost), determinism and reproducibility, alternatives considered, operational concerns (failure modes, recovery, privacy), security (attack surface, secrets). Written in the voice of a critical reviewer; each answer 2-5 sentences.

### CRITICAL: Development Workflow

Every new environment, major feature or refactor follows this workflow.

```
1. IDEATION (natural-language user input)
2. REQUIREMENTS
   - Clarifying questions, then spec in specs/<branch>/spec.md (Spec Kit)
   - Three-step design process, FAQ, known limitations
   HEAVY GATE: adversarial review of the spec + explicit human validation
3. ARCHITECTURAL PLAN     LIGHT GATE: human validation
4. TASK BREAKDOWN         LIGHT GATE: human validation + post-validation re-read
5. IMPLEMENTATION, task by task: code, tests, 8-point review, flag, next
6. GENERAL TEST
   - Full test suite, end-to-end check of web app AND artifact
   HEAVY GATE: adversarial review of the code + explicit human validation
7. CLOSURE: merge to develop (--no-ff), push, update docs
```

Adversarial review fires twice per work item: on the spec, and on the code before merge. It is done by a separate reviewer (subagent) with a hostile mandate, and repeats until no critical or important finding is left.

### CRITICAL: Task Breakdown and Sequential Execution

- Tasks of 2-5 minutes, one atomic modification or a tightly coupled file group.
- Checkbox syntax: `- [ ] **Step N**: ...`. Never vague tasks such as "implement feature X": always name files, functions, tests and the commit message.
- Execute one task at a time, flag it `- [x]`, then move on. Never batch without flagging.

### Model Selection Policy

| Phase | Model |
|---|---|
| Ideation, requirements, architecture, task breakdown | Opus (extended thinking for requirements) |
| Per-task implementation and per-task review | Sonnet |
| Cross-task integration review, final adversarial review | Opus |
| Closure | Sonnet |

During implementation, if a task needs a strategic decision that the spec does not settle, escalate to Opus instead of improvising.

### Evidence-Based Verification

Never claim something works without evidence from the running environment. Report one of: "verified in the running app", "tests passing, manual check pending", "unit tests only". Every bug or failing test found during a session is fixed in that session. No skipped tests without a traceable reason, no swallowed exceptions, no "fix later" comments.

### Mandatory 8-Point Code Review (before every commit)

1. **Correctness**: does what the task says, edge cases handled.
2. **DRY**: no duplicated logic; shared logic in `packages/core` or a shared module.
3. **Types**: strict TypeScript, no `any` without a comment explaining why.
4. **Security**: no secrets in the front end or in the artifact; input validated on the server; LLM output treated as untrusted data (parsed, validated, never executed or injected as HTML).
5. **Performance**: rendering loop allocation-free; no LLM call in a render path; concurrency and backoff respected.
6. **Tests**: unit tests for core logic, regression test for every bug fixed.
7. **Documentation**: English TSDoc on every exported function, class and type; comments explain why, not what.
8. **Documentation sync**: README.md and README.it.md updated together when setup, architecture, environments or public behavior change; `docs/alignment.md` updated when the two forms differ.

### Language

- **English only**: code, identifiers, comments, TSDoc, logs, commit messages, PRs, specs, plans, tests, CLAUDE.md, README.md.
- **Italian**: README.it.md (kept in sync with README.md), and the in-game Italian locale.
- In-game text goes through the i18n layer (Italian first, English second); never hard-coded in components.

### Code Comments and Docstrings

- English, professional, precise. No emoji or emoticons in code, comments, docs, logs or commits. (Emoji inside in-game UI strings are content, not code, and are allowed in the locale files.)
- TSDoc on every exported symbol. Module headers explain responsibility and boundaries.
- Comment every non-obvious game rule and every tunable constant: value, unit, and why that value (e.g. call budgets, timing of speech bubbles, probabilities of interruptions).
- No magic numbers: name constants and keep tunables together per environment.

### Documentation Sync — Bilingual README

README.md (English, primary) and README.it.md (Italian, companion) change together, in the same commit, whenever architecture, stack, setup, environments, LLM configuration or project rules change. Bug fixes, internal refactors and test-only commits do not trigger a README update.

---

## Mandatory Rules

### Code Quality Standards

1. **DRY** — no duplicated logic, no exceptions.
2. **Single responsibility** — small modules, one reason to change.
3. **Pure core** — `packages/core` has no side effects beyond the injected `LlmClient` and `Store`; time and randomness are injectable for tests.
4. **Reusable by design** — shared pieces extracted where it makes sense, without over-abstraction.
5. **React** — function components and hooks; state that drives the game lives in core, components render it; three.js scene objects created once and updated, never rebuilt per frame.
6. **Back end** — Fastify with schema validation on every route; idempotent handlers; configuration only from environment variables.

**Reference standards**: TypeScript handbook (strict), React docs, Fastify docs, OWASP ASVS for the server.

### Docker

- `docker-compose.local.yml` (development, hot reload, source mounted) and `docker-compose.production.yml` (built images, no source mounts).
- Dockerfiles and entrypoints under `compose/<service>/`. Multi-stage builds, non-root user, pinned base image versions, health checks.
- Environment files: `.envs/.local/` and `.envs/.production/` (git-ignored), with committed `.env.example` templates.
- LM Studio runs on the host, not in Docker; containers reach it via `host.docker.internal` (`extra_hosts: host-gateway` on Linux).

### Git Commits

Conventional Commits. **No reference to Claude or AI** in commits, comments, docs or logs. **Never auto-push.**

Scopes: `core`, `island`, `talkshow`, `archive`, `reports`, `web`, `server`, `llm`, `artifact`, `docker`, `docs`, `ci`.

```
feat(talkshow): let guests interrupt each other
CHANGE: A guest can now reply with "interrupt", which cuts the line being shown and lets the interrupting guest speak at once. The cut line stays briefly visible as a faded bubble.
```

### Git Workflow

**Branch naming**: timestamped `<YYYYMMDD-HHMMSS>-<slug>`, produced by Spec Kit (`/speckit-specify`). Never hand-crafted names.

| Work item | Base branch | PR target |
|---|---|---|
| Feature / fix | `develop` | `develop` |
| Large feature with subtasks | feature branch from `develop` | feature branch, then `develop` |
| Release | `develop` | `main` |

Pull requests: title and description in English, complete; Draft until ready; never force-push shared branches.

### Spec-Driven Development (GitHub Spec Kit)

Every new work item uses Spec Kit: `/speckit-specify` (branch + `specs/<branch>/spec.md`), `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`. Specs are written in English. The constitution, when added, lives at `.specify/memory/constitution.md`.

## Key Documents

| Document | When to consult |
|---|---|
| `README.md` / `README.it.md` | What the game is, how to run it |
| `docs/alignment.md` | Known, temporary differences between the web app and the artifact |
| `specs/` | Specs, plans and tasks of each work item |

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
