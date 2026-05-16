---
phase: 1
slug: voice-pipeline-server
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (ESM-native, co-located with Vite stack) |
| **Config file** | `vitest.config.ts` — Wave 0 (plan 01-01) installs |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15–30 seconds (unit/smoke only); integration tests require live Ollama |

---

## Sampling Rate

- **After every task commit:** `npm run typecheck` (tsc --noEmit, both tsconfigs)
- **After every plan wave:** `npm test` (full vitest suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01-01 | 1 | REQ-11 | smoke | `tsc --project tsconfig.server.json --noEmit && tsc --project tsconfig.client.json --noEmit` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01-01 | 1 | REQ-11 | smoke | `npm install --dry-run` (deps check) | ❌ W0 | ⬜ pending |
| 1-01-03 | 01-01 | 1 | REQ-11 | smoke | `npx vitest run --passWithNoTests` | ❌ W0 | ⬜ pending |
| 1-02-01 | 01-02 | 2 | REQ-10 | unit | `vitest run tests/modules.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 01-02 | 2 | REQ-09, REQ-10 | unit | `vitest run tests/modules.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-03 | 01-02 | 2 | REQ-03 | unit | `vitest run tests/protocol.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 01-03 | 3 | REQ-01, REQ-02 | integration | `vitest run tests/ws-server.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 01-03 | 3 | REQ-08 | integration | `vitest run tests/pipeline.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 01-04 | 4 | REQ-01, REQ-02 | integration | `vitest run tests/ws-server.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-02 | 01-04 | 4 | REQ-09 | unit | `vitest run tests/modules.test.ts` | ❌ W0 | ⬜ pending |
| 1-05-01 | 01-05 | 5 | REQ-04 | smoke | `vite build --outDir dist-test` | ❌ W0 | ⬜ pending |
| 1-05-02 | 01-05 | 5 | REQ-05 | unit | `vitest run tests/state-machine.test.ts` | ❌ W0 | ⬜ pending |
| 1-05-03 | 01-05 | 5 | REQ-06, REQ-07 | manual | Browser test — hold button, speak, hear response | N/A | ⬜ pending |
| 1-06-01 | 01-06 | 6 | REQ-03, REQ-08 | manual | Read docs/iot-protocol.md and verify completeness | N/A | ⬜ pending |
| 1-07-01 | 01-07 | 7 | REQ-09, REQ-10 | unit | `vitest run tests/modules.test.ts tests/protocol.test.ts` | ❌ W0 | ⬜ pending |
| 1-07-02 | 01-07 | 7 | REQ-01–REQ-08 | manual | Human E2E checkpoint — press talk, speak, hear response | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` and `@vitest/coverage-v8` not installed → plan 01-01 installs
- [ ] `tests/pipeline.test.ts` — covers REQ-01, REQ-07, REQ-08 → plan 01-07
- [ ] `tests/ws-server.test.ts` — covers REQ-02, REQ-07 → plan 01-07
- [ ] `tests/protocol.test.ts` — covers REQ-03 → plan 01-07
- [ ] `tests/modules.test.ts` — covers REQ-09, REQ-10 → plan 01-07
- [ ] `tests/state-machine.test.ts` — covers REQ-05 → plan 01-07
- [ ] `tsconfig.server.json` and `tsconfig.client.json` → plan 01-01
- [ ] `vitest.config.ts` → plan 01-01

*All Wave 0 gaps are created in plan 01-01 (infrastructure) and plan 01-07 (tests).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser audio capture works | REQ-06 | Requires getUserMedia browser API — not testable in Node.js vitest | Open frontend, grant mic permission, verify no console errors |
| Full E2E voice round-trip | REQ-01, REQ-07 | Requires live Ollama + STT/TTS model downloads (~100MB+) | Press talk button, speak a sentence, verify TTS response plays within ~10s |
| IoT device connectivity | REQ-08 | Requires physical IoT device or arecord simulation | Connect via wscat or run iot-client.js example from docs/iot-protocol.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
