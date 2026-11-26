# Architecture

This page shows how the workspaces depend on each other and which ports connect `packages/core` to the outside world.

## Workspaces

Dependencies point one way: `core` is read by `ui`, `ui` by the apps, and the golden harness reads `core` only. ESLint enforces it (`boundaries/dependencies`).

```text
                 +-----------------------+
                 |     packages/core     |   pure TypeScript: rules, planners, prompts,
                 |   (no DOM, no Node)   |   parser, shared contract suites
                 +-----------------------+
                  ^          ^          ^
                  |          |          |
   tools/golden --+          |          +-- packages/ui   (React screens of both forms)
                             |                  ^      ^
                             |                  |      |
                       apps/server          apps/web  apps/artifact
                  (Fastify, PostgreSQL,    (Vite, the web form)   (single HTML file for claude.ai)
                   holds the API keys)
```

## Ports of core

Core owns no clock, no randomness, no network and no storage. Each effect arrives through a port that the app on top implements, and the shared suites in `@unscripted/core/testing` prove that every implementation behaves the same.

| Port | Declared in | Implemented by | Proved by |
|---|---|---|---|
| `CharacterStore` | `src/store/characterStore.ts` | `PgCharacterStore` (server), `IndexedDbStore` (artifact), the in-memory store of `@unscripted/core/testing` | `describeCharacterStore` |
| `ArchiveClient` | `src/archive/archiveClient.ts` | `StoreArchive` (core, over any store), `HttpStore` (web) | `describeArchiveClient` |
| `LlmClient` | `src/llm/request.ts` | `HttpLlmClient` (web), `ArtifactLlmClient` (artifact) | `describeLlmClient` |
| `Clock`, `Scheduler` | `src/time/ports.ts` | the platform, or a fake in tests | unit tests |

Every archive rule lives in the planners under `src/archive/planners/`; `StoreArchive` is the only code that applies their batches to a store, so the server and the artifact cannot drift apart.
