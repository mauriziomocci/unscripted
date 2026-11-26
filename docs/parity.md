# Parity with the legacy game

Every behaviour of the legacy game the web app and the artifact keep, change or fix, one row each, with the check that proves it. The legacy code is the oracle; a row that departs from it says so and says why. The count and the required rows are enforced by `scripts/test/parity.test.ts`.

| ID | Feature | Acceptance check | Web app | Artifact | Note |
|---|---|---|---|---|---|
| ARCH-001 | Markdown parser age clamp | `packages/core/test/archive/markdown.test.ts`: a novel character aged 120, written to a sheet and read back, is aged 95 | Ported verbatim (`archui.js:70`) | Ported verbatim | A legacy defect, tracked for WI-6, when the legacy retires. The scope of the fix is fixed now so WI-6 does not reopen it: the parser applies the editor's own rule (3-999 when Epoca is romanzo, 3-95 otherwise) after the whole header is read, because `Età` comes before `Epoca`. Ages stored unclamped by a game are unaffected. |
| ARCH-002 | Duplicate and out-of-range inline `v` normalised on import | `packages/core/test/archive/planners/import.test.ts`: a row whose `v` is not an integer in 1 to version - 1 is dropped, one row is kept per `v` (the last), and the last 15 stay | Normalised before writing | Normalised before writing | The legacy keeps a file's `versions` as they are, duplicates and odd numbers included (`archui.js:249`). Here a duplicate `v` would break the insert and a `v` equal to the current version would make the next versioned save collide for ever. Only hand-made files and raw dumps carry inline versions. |
