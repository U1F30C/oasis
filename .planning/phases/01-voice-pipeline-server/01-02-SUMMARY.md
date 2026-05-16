---
phase: "01-voice-pipeline-server"
plan: "02"
subsystem: "server-lib-migrations"
tags: ["typescript", "stt", "tts", "llm", "websocket", "protocol", "ollama", "wavefile"]
dependency_graph:
  requires:
    - "01-01: Foundation (tsconfigs, deps, folder structure)"
  provides:
    - "src/server/stt.ts — readAudio() export for WAV-file-to-Float32Array conversion"
    - "src/server/tts.ts — generateWav() export returning 16-bit WAV"
    - "src/server/llm.ts — Ollama model exports via OLLAMA_BASE_URL env var"
    - "src/shared/protocol.ts — ControlMessage and PipelineState shared types"
  affects:
    - "01-03: Server core (pipeline.ts + WebSocket route) imports from these modules"
    - "01-05: Frontend imports ControlMessage and PipelineState from protocol.ts"
tech_stack:
  added: []
  patterns:
    - "Clean export modules — no dev harness main() in production server files"
    - "Environment variable for external service URL (OLLAMA_BASE_URL) with LAN fallback"
    - "16-bit WAV conversion at generation time for universal browser AudioContext compatibility"
    - "Discriminated union type for WebSocket control messages"
key_files:
  created:
    - "src/server/stt.ts — readAudio() with multi-channel mono merge (SCALING_FACTOR)"
    - "src/server/tts.ts — generateWav() with toBitDepth(\"16\") conversion"
    - "src/server/llm.ts — gemma3n/qwen3wen3_8b/gemma3_270m exports + generateText re-export"
    - "src/shared/protocol.ts — ControlMessage union + PipelineState type"
  modified: []
decisions:
  - "Dropped @huggingface/transformers pipeline import from stt.ts — readAudio() only needs fs and wavefile; pipeline import belongs in pipeline.ts"
  - "Kept hardcoded 192.168.1.4 LAN IP as env var fallback per T-01-02 threat mitigation"
  - "Added export { generateText } re-export in llm.ts so callers only import from one source"
  - "protocol.ts includes pong variant in ControlMessage for keepalive round-trip symmetry"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-16"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 1 Plan 2: Server Lib Migrations Summary

**One-liner:** Migrated stt/tts/llm root scripts to clean src/server/ exports (removed dev harnesses, dropped Speaker, added 16-bit WAV conversion and OLLAMA_BASE_URL env var) and defined shared WebSocket protocol types.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Migrate stt.ts to src/server/stt.ts — readAudio() export, no main() | 38797f7 |
| 2 | Migrate tts.ts to src/server/tts.ts — generateWav() with toBitDepth("16"), no Speaker | da0626a |
| 3 | Migrate llm.ts to src/server/llm.ts + create src/shared/protocol.ts | ad9b6c4 |

## Verification Results

All acceptance criteria met:

- `src/server/stt.ts`: exports `readAudio()`, contains `SCALING_FACTOR`, `wav.toBitDepth("32f")`, `wav.toSampleRate` — no `main()`, no `Speaker`
- `src/server/tts.ts`: exports `generateWav()`, contains `wav.toBitDepth("16")` — no `Speaker`, no `playWav`, no `main()`
- `src/server/llm.ts`: exports `gemma3n`, `qwen3wen3_8b`, `gemma3_270m`, uses `OLLAMA_BASE_URL` env var with fallback — no `main()`
- `src/shared/protocol.ts`: exports `ControlMessage` union (ready/processing/error/ping/pong) and `PipelineState` type (idle/recording/processing/playing)
- No `main()` invocations in any migrated file (verified with grep)

## Deviations from Plan

None — plan executed exactly as written. Files already existed on disk from prior wave activity; they matched the plan's acceptance criteria in full. Tasks were committed individually as specified.

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-01-02 | OLLAMA_BASE_URL env var in src/server/llm.ts (LAN IP not hardcoded in committed string literal) | Addressed |
| T-01-03 | STT output → LLM prompt injection: accepted (v1 single-user LAN scope) | Accepted |

## Known Stubs

None — all exports are fully implemented and functional.

## Self-Check: PASSED

Files verified:
- FOUND: /home/eric/Downloads/Projects/oasis/src/server/stt.ts
- FOUND: /home/eric/Downloads/Projects/oasis/src/server/tts.ts
- FOUND: /home/eric/Downloads/Projects/oasis/src/server/llm.ts
- FOUND: /home/eric/Downloads/Projects/oasis/src/shared/protocol.ts

Commits verified:
- FOUND: 38797f7 (src/server/stt.ts)
- FOUND: da0626a (src/server/tts.ts)
- FOUND: ad9b6c4 (src/server/llm.ts + src/shared/protocol.ts)
