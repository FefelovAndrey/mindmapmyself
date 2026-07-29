# AGENTS.md

## Cursor Cloud specific instructions

Single-app repo: a **Next.js 15 / React 19 / TypeScript** mind-map editor (`mindmap-editor`).
Package manager is **npm** (`package-lock.json`). Node 22 is available. No database,
containers, or external services — data is persisted to a local JSON file at
`data/mindmap.json`.

### Services

- **Next.js app (UI + API)** — the entire product. Dev: `npm run dev` (port 3000).
  Serves the UI (`app/page.tsx`) and the single API route `app/api/nodes/route.ts`
  (`GET`/`POST` reading/writing `data/mindmap.json`). `data/mindmap.json` is
  git-ignored and auto-created with a default document on the first `GET /api/nodes`,
  so no seeding is required to boot. `launch.sh` is a convenience wrapper around
  `npm run dev` that also opens a browser.

### Commands (see `package.json` scripts)

- Run (dev): `npm run dev` → http://localhost:3000
- Build: `npm run build` (also type-checks); prod start: `npm run start`
- Test: `npm test` (Jest + ts-jest, tests in `__tests__/`)
- Seed real data (optional): `npm run import` parses `TasksRULI_23062026.mmap` into
  `data/mindmap.json`. Migrate: `npm run migrate-status`.

### Non-obvious caveats

- **Tests need `ts-node`.** `jest.config.ts` is written in TypeScript, and Jest
  requires `ts-node` (in addition to `ts-jest`) just to parse that config file.
  `ts-node` is now a dev dependency, so `npm install` covers it. Without it,
  `npm test` fails with "'ts-node' is required for the TypeScript configuration files".
- **No linter is configured.** There is no ESLint config or `lint` script; running
  `npx next lint` triggers an interactive setup prompt (do not run it non-interactively).
  Type safety is enforced via `npm run build` / `tsc` instead.
- **UI editing is keyboard-driven.** In Outline view, select a node then: `Tab`
  adds a child, `Enter` adds a sibling (or edits the root), `F2` renames,
  `Delete` removes. Edits autosave (500 ms debounce) via `POST /api/nodes`;
  the header shows `Сохраняется…` → `Сохранено`.
