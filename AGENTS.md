# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single Next.js 15 / React 19 app (TypeScript) — a mind map / outline
editor ("Mind Map Editor — задачи RULI"). There is no database, backend service,
external API, or secret; all state is persisted to a local JSON file.

Standard commands live in `package.json` scripts:
- Dev server: `npm run dev` (Next.js on http://localhost:3000).
- Tests: `npm test` (Jest + ts-jest, 23 tests in `__tests__/`).
- Type check: `npx tsc --noEmit`.
- Import a `.mmap` file into data: `npm run import` (see `scripts/import-mmap.ts`).

There is no lint script and no ESLint config in this repo, so "lint" is a no-op here.

Non-obvious notes:
- Running the tests requires `ts-node` (Jest loads `jest.config.ts`). It is a
  devDependency and is installed by the update script (`npm ci`).
- Data is served/persisted through `app/api/nodes/route.ts` from
  `data/mindmap.json`. That file is listed in `.gitignore` but is intentionally
  committed on the `data/snapshots` branch (the working data snapshot). If you
  edit the map in the UI, `data/mindmap.json` changes on disk — run
  `git checkout -- data/mindmap.json` to discard test edits before committing.
- In the right-hand node card (`components/NodeCard/NodeCard.tsx`), the
  "Ответственный" and "Описание" fields commit their value on blur / Enter, not on
  every keystroke. When testing auto-save, type the value and then click away
  (e.g. on a tree node) to trigger the save; only then does the header show
  "Сохраняется..." → "Сохранено".
