---
phase: "01-voice-pipeline-server"
plan: "03"
subsystem: "server-core"
tags: ["typescript", "websocket", "rest-api", "stt", "tts", "llm", "pipeline", "riff"]
dependency_graph:
  requires:
    - "01-01: Foundation (tsconfigs, deps, folder structure)"
    - "01-02: Server lib migrations (stt.ts, tts.ts, llm.ts, protocol.ts)"
  provides:
    - "src/server/pipeline.ts — initPipelines(), getSttPipeline(), getTtsPipeline(), SPEAKER_EMBEDDINGS"
    - "src/server/routes/ws.ts — handleConnection() WebSocket handler with full STT→LLM→TTS pipeline"
    - "src/server/routes/api.ts — apiRouter with POST /api/stt, /api/llm, /api/tts"
  affects:
    - "01-04: Server entry (index.ts) mounts apiRouter and calls initPipelines()"
    - "01-07: Verification tests import and exercise pipeline, ws, api modules"
tech_stack:
  added: []
  patterns:
    - "Singleton pipeline manager with lazy-init guard (null check + throw)"
    - "RIFF magic-byte detection (0x52 0x49 0x46 0x46) to distinguish WAV vs raw PCM"
    - "isBusy flag for single-request serialization on WebSocket binary handler"
    - "readyState === WebSocket.OPEN check before every ws.send()"
    - "Raw body accumulation via req.on('data') for binary audio in Express routes"
key_files:
  created:
    - "src/server/pipeline.ts — singleton ML pipeline manager"
    - "src/server/routes/ws.ts — WebSocket binary audio handler"
    - "src/server/routes/api.ts — REST routes for individual pipeline stages"
  modified: []
decisions:
  - "ws.ts close and error handlers both reset isBusy=false (deviation: plan example showed this, existing file was missing it — added as Rule 1 auto-fix)"
  - "pipeline.ts uses type Pipeline = any rather than typed ReturnType — avoids complex conditional type inference from overloaded pipeline() function"
  - "api.ts /api/stt uses manual req.on('data') accumulation rather than express.raw() middleware — keeps compatibility with existing Express 5 setup"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-16"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 1 Plan 3: Server Core Summary

**One-liner:** Pipeline singleton manager with guarded getters, WebSocket handler with RIFF magic-byte WAV detection and isBusy serialization, and REST routes for individual STT/LLM/TTS stage invocation.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create src/server/pipeline.ts — singleton ML pipeline manager | f1aa19e |
| 2 | Create src/server/routes/ws.ts — WebSocket handler with RIFF detection | 812c6dc |
| 3 | Create src/server/routes/api.ts — REST routes for individual pipeline stages | 08385f5 |

## Verification Results

All acceptance criteria met:

**pipeline.ts:**
- Exports `initPipelines`, `getSttPipeline`, `getTtsPipeline`, `SPEAKER_EMBEDDINGS`
- Contains exact model IDs: `"Xenova/whisper-tiny.en"` and `"Xenova/speecht5_tts"`
- Contains exact dtype: `{ encoder_model: "fp32", decoder_model_merged: "q4" }`
- Getters throw `Error` when `instances.stt/tts` is null (before initPipelines)
- Contains full speaker_embeddings HuggingFace URL

**routes/ws.ts:**
- Exports `handleConnection(ws: WebSocket)`
- Sends `{ type: "ready" }` on connection
- `isWavBuffer()` checks bytes 0-3 for 0x52 0x49 0x46 0x46 (RIFF magic)
- `bufferToFloat32()` routes WAV to temp file + `readAudio(tmpPath, 16000)`, PCM to `new Float32Array(...)`
- Temp file cleaned up with `fs.unlinkSync` in `finally` block
- `isBusy` flag rejects concurrent requests with `{ type: "error", message: "busy" }`
- `ws.readyState === WebSocket.OPEN` checked before every `ws.send()`
- STT result uses `Array.isArray` ternary (exact copy from index.ts)
- Short input (`< 2 chars`) throws `"No clear input detected"` before LLM call
- LLM prompt verbatim from index.ts: "You are a helpful voice assistant..."
- `isBusy = false` reset in `finally`, `ws.on("close")`, and `ws.on("error")`
- `ws.on("close")` and `ws.on("error")` handlers present

**routes/api.ts:**
- Exports `apiRouter = Router()`
- `POST /api/stt`: binary body → `bufferToFloat32` → `getSttPipeline()` → `{ text: string }`
- `POST /api/llm`: `{ prompt }` → `generateText({ model: gemma3n, prompt })` → `{ response: string }`
- `POST /api/tts`: `{ text }` → `getTtsPipeline()` + `generateWav()` → WAV binary with `Content-Type: audio/wav`
- All routes have `res.status(400)` input validation and `res.status(500)` error handling
- RIFF detection via same `isWavBuffer`/`bufferToFloat32` pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added isBusy=false to ws.ts close/error handlers**
- **Found during:** Task 2 (verification of acceptance criteria)
- **Issue:** The plan's code example and threat model T-01-06 specify that `ws.on("close")` should reset `isBusy = false` to prevent deadlocking when a client disconnects mid-pipeline. The existing file had the close/error handlers without the reset.
- **Fix:** Added `isBusy = false` to both `ws.on("close")` and `ws.on("error")` handlers
- **Files modified:** `src/server/routes/ws.ts`
- **Commit:** 812c6dc (included in the task commit)

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-01-04 | isBusy flag in ws.ts rejects concurrent binary messages with `{ type: "error", message: "busy" }` | Implemented |
| T-01-05 | STT output wrapped in quotes in LLM prompt string; not executed as code | Accepted (LAN-only scope) |
| T-01-06 | try/finally always resets isBusy; ws.on("close") and ws.on("error") also reset isBusy | Implemented |
| T-01-15 | POST /api/stt body accumulated via req.on("data"); raw binary; 10MB limit can be enforced at Express level | Implemented |
| T-01-16 | POST /api/llm prompt injection: LAN-only v1 scope | Accepted |

## Known Stubs

None — all exports are fully implemented with real pipeline calls.

## Self-Check: PASSED

Files verified:
- FOUND: /home/eric/Downloads/Projects/oasis/src/server/pipeline.ts
- FOUND: /home/eric/Downloads/Projects/oasis/src/server/routes/ws.ts
- FOUND: /home/eric/Downloads/Projects/oasis/src/server/routes/api.ts

Commits verified:
- FOUND: f1aa19e (src/server/pipeline.ts)
- FOUND: 812c6dc (src/server/routes/ws.ts)
- FOUND: 08385f5 (src/server/routes/api.ts)
