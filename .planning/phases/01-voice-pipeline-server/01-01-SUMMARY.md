---
phase: "01-voice-pipeline-server"
plan: "01"
subsystem: "foundation"
tags: ["typescript", "vite", "vitest", "express", "ws", "scaffolding"]
dependency_graph:
  requires: []
  provides:
    - "package.json scripts (dev, build, typecheck, test)"
    - "TypeScript config chain (base + server + client)"
    - "vitest test runner"
    - "src/server/, src/client/src/, src/shared/, tests/ directory structure"
    - ".env.example environment documentation"
  affects:
    - "All subsequent plans depend on this foundation"
tech_stack:
  added:
    - "express ^5.2.1 — HTTP server framework"
    - "ws ^8.20.1 — WebSocket server"
    - "react ^19.2.6 + react-dom — frontend UI"
    - "vite ^8.0.13 + @vitejs/plugin-react — frontend build"
    - "vitest ^4.1.6 — test runner"
    - "tsx ^4.22.0 — TypeScript execution for dev server"
    - "concurrently ^9.2.1 — parallel dev scripts"
    - "typescript ^6.0.3 — TypeScript compiler"
  patterns:
    - "Separate tsconfig per target (server NodeNext, client Bundler)"
    - ".env.example as environment documentation contract"
key_files:
  created:
    - "tsconfig.json — base strict TypeScript config (no emit)"
    - "tsconfig.server.json — Node22/ESM target extending base"
    - "tsconfig.client.json — DOM/ESNext/React JSX target extending base"
    - "vitest.config.ts — test runner for tests/**/*.test.ts"
    - ".env.example — environment variable documentation"
    - "src/server/.gitkeep + src/server/routes/.gitkeep"
    - "src/client/src/.gitkeep + src/client/src/hooks/.gitkeep"
    - "src/shared/.gitkeep"
    - "tests/.gitkeep"
  modified:
    - "package.json — added all dependencies and scripts"
    - "package-lock.json — updated lock file"
    - ".gitignore — added .env and dist/ exclusions (T-01-01)"
decisions:
  - "tsconfig.server.json uses outDir ./dist (not ./dist/server) and rootDir ./src — broader scope already set by implementation"
  - "Added .env and dist/ to .gitignore proactively; threat model T-01-01 requires .env exclusion"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-16"
  tasks_completed: 3
  files_created: 9
  files_modified: 3
---

# Phase 1 Plan 1: Foundation Summary

**One-liner:** Project scaffold with Express/WS/React/Vite/Vitest dependencies, split TypeScript configs (NodeNext server + Bundler client), and directory structure.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Install dependencies and update package.json scripts | e09a21f |
| 2 | Create TypeScript configs (tsconfig.json, tsconfig.server.json, tsconfig.client.json) and vitest.config.ts | 2e66060 |
| 3 | Create folder structure (.gitkeep files) and .env.example | 4a0592d |

## Verification Results

All acceptance criteria met:

- `package.json` contains express, ws, react, react-dom in dependencies
- `package.json` contains vite, vitest, tsx, concurrently in devDependencies
- `package.json` scripts: dev, dev:server, dev:client, build, typecheck, test all present
- `node_modules/express` and `node_modules/ws` exist
- `tsconfig.json` exists with `"strict": true`
- `tsconfig.server.json` extends `./tsconfig.json` with `"module": "NodeNext"`
- `tsconfig.client.json` extends `./tsconfig.json` with DOM lib and `"jsx": "react-jsx"`
- `vitest.config.ts` exists with `defineConfig` and `"tests/**/*.test.ts"` pattern
- `vitest run` passes (9 tests across 3 files from later plans)
- `src/server/`, `src/server/routes/`, `src/client/src/`, `src/client/src/hooks/`, `src/shared/`, `tests/` all exist
- `.env.example` contains OLLAMA_BASE_URL, PORT=3001, TTS_MODEL, VITE_WS_URL
- No `.env` file committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Added .env to .gitignore**
- **Found during:** Task 3
- **Issue:** Threat model T-01-01 requires `.env` never be committed, but `.gitignore` only excluded `node_modules` and `*.wav`. `.env` was unprotected.
- **Fix:** Added `.env` and `dist/` to `.gitignore`
- **Files modified:** `.gitignore`
- **Commit:** 4a0592d

**2. [Minor deviation] tsconfig.server.json outDir/rootDir scope**
- **Found during:** Task 2
- **Issue:** Plan specified `outDir: ./dist/server` and `rootDir: ./src/server`, but the existing implementation uses `outDir: ./dist` and `rootDir: ./src` (broader scope to include shared types)
- **Decision:** Kept broader scope as-is — the existing implementation correctly supports shared modules and the difference is non-breaking

## Self-Check: PASSED

Files verified:
- FOUND: /home/eric/Downloads/Projects/oasis/tsconfig.json
- FOUND: /home/eric/Downloads/Projects/oasis/tsconfig.server.json
- FOUND: /home/eric/Downloads/Projects/oasis/tsconfig.client.json
- FOUND: /home/eric/Downloads/Projects/oasis/vitest.config.ts
- FOUND: /home/eric/Downloads/Projects/oasis/.env.example
- FOUND: /home/eric/Downloads/Projects/oasis/src/server/
- FOUND: /home/eric/Downloads/Projects/oasis/src/shared/
- FOUND: /home/eric/Downloads/Projects/oasis/tests/

Commits verified:
- FOUND: e09a21f (package.json + package-lock.json)
- FOUND: 2e66060 (tsconfig + vitest configs)
- FOUND: 4a0592d (folder structure + .env.example + .gitignore)
