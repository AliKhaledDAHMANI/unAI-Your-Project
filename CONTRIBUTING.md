# Contributing to unAI your project

Thanks for wanting to help! This project aims to be small, dependable, and safe.
Please read this guide before opening a pull request.

## Getting started

```bash
git clone https://github.com/<you>/unAI-your-project.git
cd unAI-your-project
npm install
npm run build
npm test
```

Requirements: Node.js 18+.

## Project layout

```
src/
  cli.ts         Argument parsing and command dispatch.
  engine.ts      Orchestrates scanning, cleaning, and restoring on disk.
  walker.ts      Recursive directory traversal and ignore rules.
  languages.ts   Per-language syntax definitions and extension mapping.
  parser.ts      Comment extraction and body normalization.
  detector.ts    Rule compilation and AI-comment scoring.
  cleaner.ts     Surgical comment removal and syntax guards.
  backup.ts      Timestamped backups and restore.
  config.ts      Config file loading and defaults.
  report.ts      Human-readable and JSON report rendering.
  types.ts       Shared types.
tests/           Vitest suites mirroring src/.
```

The pipeline is: `walker` → `languages` (detect) → `parser` (extract) → `detector`
(score) → `cleaner` (remove) → `backup` (record) → `report` (display).

## Guiding principles

1. **Safety over aggressiveness.** When detection is uncertain, keep the comment.
   Never risk changing code.
2. **Zero runtime dependencies.** The CLI must stay dependency-free and local.
3. **Deterministic output.** Same input, same result — no randomness, no network.
4. **Small, focused modules.** Each file has one clear responsibility.

## Making changes

- Add or update tests for every behavior change. New language support needs parser tests
  for both real comments and tricky string/comment interactions.
- Run the full suite before pushing:

  ```bash
  npm run typecheck
  npm test
  ```

- Keep public API changes documented in `README.md`.
- Follow the existing code style: strict TypeScript, explicit types at module
  boundaries, no inline comments unless they explain non-obvious *why*.

## Adding a language

1. Add a `LanguageSpec` to `LANGUAGES` in `src/languages.ts`.
2. Add parser tests in `tests/parser.test.ts` covering:
   - line comments,
   - block comments,
   - comment markers inside strings,
   - any language-specific quirks.
3. Mention the language in the README support list.

## Reporting bugs

Please include:

- the `unai` version (`unai --version`),
- the OS and Node version,
- a minimal source snippet that reproduces the issue,
- the command you ran and the observed vs. expected result.

If `unai` ever modifies code, that is a **critical bug** — please file it immediately
with the exact input file.

## Pull requests

- Keep PRs focused; one topic per PR.
- Reference the issue it addresses.
- Ensure CI (typecheck + tests) is green.
- Use clear commit messages in the imperative mood.

## Code of conduct

Be respectful, assume good intent, and keep discussion constructive.
