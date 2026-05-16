---
phase: 01-voice-pipeline-server
verified: 2026-05-16T10:30:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "vitest unit tests pass for WS plumbing and state machine transitions (tests/ws-server.test.ts, tests/state-machine.test.ts exist and pass)"
    status: failed
    reason: "Two of five required test files were never created. tests/ws-server.test.ts and tests/state-machine.test.ts are absent. The test suite has 9 tests across 3 files instead of the required ≥15 tests across 5 files. REQ-02 and REQ-05 have no automated test coverage."
    artifacts:
      - path: "tests/ws-server.test.ts"
        issue: "File does not exist — WebSocket server integration test (REQ-02 coverage) missing"
      - path: "tests/state-machine.test.ts"
        issue: "File does not exist — useVoiceWS state transition tests (REQ-05 coverage) missing"
    missing:
      - "Create tests/ws-server.test.ts with in-process WebSocket server, mock pipeline, and tests for: connect→ready, Float32Array PCM→WAV binary response, ping→pong"
      - "Create tests/state-machine.test.ts with jsdom environment, MockWebSocket, and tests for: idle start, processing transition, binary→playing→idle, error→idle"
      - "Install @testing-library/react (required by state-machine.test.ts)"
      - "Ensure npm test outputs ≥15 passing tests after additions"
human_verification:
  - test: "End-to-end voice pipeline walkthrough"
    expected: "User presses-and-holds Talk button, speaks, releases, hears TTS audio response. Status displays idle→recording→processing→playing→idle throughout."
    why_human: "Requires live Ollama LLM server, browser microphone permission, and real audio playback — none of which can be verified programmatically"
  - test: "GET /health returns correct JSON after server startup"
    expected: "curl http://localhost:3001/health returns {\"status\":\"ok\",\"pipelines\":\"ready\"} — only verifiable after the 5-15s pipeline init completes"
    why_human: "Server startup requires ML model loading (Whisper, SpeechT5) from disk; cannot run headlessly without the model files present"
---

# Phase 1: Voice Pipeline Server + Walkie-Talkie Frontend — Verification Report

**Phase Goal:** Deliver a working client-server voice assistant: Node.js WebSocket server running the STT → LLM → TTS pipeline, and a Vite frontend with press-to-talk walkie-talkie UI that captures browser audio, sends to server, and plays back the TTS response. IoT devices can connect using the same protocol.
**Verified:** 2026-05-16T10:30:00Z
**Status:** human_needed (1 gap + 2 human verification items)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open the Vite frontend, press-and-hold to record, release to send, and hear TTS response | ? HUMAN | Browser UI and audio playback require human testing |
| 2 | Node.js server accepts WebSocket connections and runs the full STT→LLM→TTS pipeline | ✓ VERIFIED | `src/server/routes/ws.ts` exports `handleConnection` with full pipeline; wired via `wss.on("connection", handleConnection)` in `src/server/index.ts` |
| 3 | Pipeline stages exposed as independent REST endpoints | ✓ VERIFIED | `src/server/routes/api.ts` exports `apiRouter` with `POST /api/stt`, `POST /api/llm`, `POST /api/tts`; mounted via `app.use(apiRouter)` |
| 4 | IoT device can stream audio bytes over WebSocket and receive audio bytes back without ML libraries | ✓ VERIFIED | RIFF magic-byte detection in `ws.ts` routes WAV buffers to `readAudio()` and raw PCM to `Float32Array`; `docs/iot-protocol.md` with `arecord` examples exists |
| 5 | Frontend shows pipeline states: idle / recording / processing / playing | ✓ VERIFIED | `App.tsx` `STATE_LABELS` covers all four states; `useVoiceWS.ts` state machine transitions verified in code; `onMouseDown`/`onTouchStart`/`onMouseUp`/`onTouchEnd` handlers present |

**Score:** 4/5 truths verified (1 requires human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Updated scripts and all deps | ✓ VERIFIED | Contains express, ws, vite, vitest, concurrently, tsx; all 10 scripts present |
| `tsconfig.json` | Base TypeScript config (strict) | ✓ VERIFIED | `"strict": true` present |
| `tsconfig.server.json` | Server config (NodeNext, ESM) | ✓ VERIFIED | Extends `./tsconfig.json`; `"module": "NodeNext"` present |
| `tsconfig.client.json` | Client config (DOM, ESNext) | ✓ VERIFIED | Extends `./tsconfig.json`; `"lib": ["ESNext", "DOM", "DOM.Iterable"]`; `"jsx": "react-jsx"` |
| `vitest.config.ts` | Vitest configuration | ✓ VERIFIED | `defineConfig` present; `tests/**/*.test.ts` include pattern |
| `.env.example` | Environment variable docs | ✓ VERIFIED | Contains `OLLAMA_BASE_URL`, `PORT=3001`, `TTS_MODEL`, `VITE_WS_URL` |
| `src/server/stt.ts` | `readAudio()` export | ✓ VERIFIED | Exports `async function readAudio`; no `main()`; no Speaker; `SCALING_FACTOR` present |
| `src/server/tts.ts` | `generateWav()` export with 16-bit | ✓ VERIFIED | Exports `generateWav`; `wav.toBitDepth("16")` present; no Speaker |
| `src/server/llm.ts` | Ollama models via env var | ✓ VERIFIED | `OLLAMA_BASE_URL` env var fallback; exports `gemma3n`, `qwen3wen3_8b`, `gemma3_270m`; no `main()` |
| `src/shared/protocol.ts` | `ControlMessage` + `PipelineState` types | ✓ VERIFIED | Both types exported; all 5 ControlMessage variants present |
| `src/server/pipeline.ts` | Singleton ML pipeline manager | ✓ VERIFIED | `initPipelines`, `getSttPipeline`, `getTtsPipeline`, `SPEAKER_EMBEDDINGS` exported; guarded getters throw before init; exact model IDs `Xenova/whisper-tiny.en` and `Xenova/speecht5_tts` present |
| `src/server/routes/ws.ts` | WebSocket handler with full pipeline | ✓ VERIFIED | `handleConnection` exported; `isWavBuffer` with `0x52` RIFF check; `isBusy` guard; `readyState` checks; `finally` resets `isBusy`; "No clear input detected" guard |
| `src/server/routes/api.ts` | REST routes for pipeline stages | ✓ VERIFIED | `apiRouter` exported; 3 POST routes; `isWavBuffer` RIFF detection; `audio/wav` content-type on TTS; 400/500 error handling |
| `src/server/routes/health.ts` | GET /health route | ✓ VERIFIED | `healthRouter` exported; returns `{ status: "ok", pipelines: "ready" }` |
| `src/server/index.ts` | Express + ws server entry | ✓ VERIFIED | `initPipelines` awaited at line 34 before `server.listen` at line 60; `noServer: true`; `maxPayload: 10MB`; `socket.destroy()` for non-`/ws` upgrades |
| `src/client/index.html` | Vite entry HTML | ✓ VERIFIED | `id="root"` div; `src="/src/main.tsx"` script |
| `src/client/vite.config.ts` | Vite config with proxy | ✓ VERIFIED | `/ws` proxy with `ws: true`; `/api` proxy to `http://localhost:3001`; `rewriteWsOrigin: true`; `root: "src/client"` |
| `src/client/src/main.tsx` | React entry point | ✓ VERIFIED | `createRoot`; `StrictMode` |
| `src/client/src/App.tsx` | Press-to-talk UI | ✓ VERIFIED | `export default function App`; `useVoiceWS` call; `onMouseDown`, `onMouseUp`, `onTouchStart`, `onTouchEnd`; `STATE_LABELS` with 4 states; `useEffect` connects WS on mount |
| `src/client/src/audio.ts` | PCM resampling + WAV playback | ✓ VERIFIED | `captureAndSendAudio` (OfflineAudioContext at 16kHz, `ws.send(pcm.buffer)`); `playWavBuffer` (`decodeAudioData` + `onended`); both close AudioContext |
| `src/client/src/hooks/useVoiceWS.ts` | MediaRecorder + WS hook | ✓ VERIFIED | `autoStopTimer` ref; `window.setTimeout(..., 30_000)`; `clearTimeout` in `stopRecording`; full state machine; `getUserMedia`; `binaryType = "arraybuffer"` |
| `docs/iot-protocol.md` | IoT integration guide | ✓ VERIFIED | Contains `arecord`, `Float32`, `{ "type": "ready" }`, 9 `##` sections |
| `tests/modules.test.ts` | Unit tests for server lib exports | ✓ VERIFIED | 6 tests; `readAudio`, `generateWav`, LLM models, pipeline guards |
| `tests/protocol.test.ts` | Unit tests for shared types | ✓ VERIFIED | 2 tests; `ControlMessage`, `PipelineState` |
| `tests/pipeline.test.ts` | End-to-end pipeline with mocked LLM | ✓ VERIFIED | 1 test; `vi.mock` for LLM and HF transformers; RIFF header assertion |
| `tests/ws-server.test.ts` | WS integration test | ✗ MISSING | File does not exist |
| `tests/state-machine.test.ts` | useVoiceWS state transition tests | ✗ MISSING | File does not exist |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tsconfig.server.json` | `tsconfig.json` | extends | ✓ WIRED | `"extends": "./tsconfig.json"` confirmed |
| `tsconfig.client.json` | `tsconfig.json` | extends | ✓ WIRED | `"extends": "./tsconfig.json"` confirmed |
| `src/server/routes/ws.ts` | `src/server/pipeline.ts` | `getSttPipeline`, `getTtsPipeline` | ✓ WIRED | Imported and called in `runPipeline` |
| `src/server/routes/ws.ts` | `src/server/tts.ts` | `generateWav` | ✓ WIRED | Imported and called in `runPipeline` |
| `src/server/routes/ws.ts` | `src/server/llm.ts` | `gemma3n` | ✓ WIRED | Imported and used in `generateText` call |
| `src/server/routes/ws.ts` | `src/shared/protocol.ts` | `ControlMessage` | ✓ WIRED | Imported as type; used in `send()` helper and `JSON.parse` cast |
| `src/server/routes/api.ts` | `src/server/stt.ts` | `readAudio` | ✓ WIRED | Imported and called in `bufferToFloat32` |
| `src/server/routes/api.ts` | `src/server/tts.ts` | `generateWav` | ✓ WIRED | Imported and called in `/api/tts` handler |
| `src/server/routes/api.ts` | `src/server/llm.ts` | `gemma3n`, `generateText` | ✓ WIRED | Imported and called in `/api/llm` handler |
| `src/server/index.ts` | `src/server/pipeline.ts` | `await initPipelines()` | ✓ WIRED | Called at line 34, before `server.listen` at line 60 |
| `src/server/index.ts` | `src/server/routes/ws.ts` | `wss.on("connection", handleConnection)` | ✓ WIRED | Confirmed in index.ts |
| `src/server/index.ts` | `src/server/routes/health.ts` | `app.use(healthRouter)` | ✓ WIRED | Confirmed in index.ts |
| `src/server/index.ts` | `src/server/routes/api.ts` | `app.use(apiRouter)` | ✓ WIRED | Confirmed in index.ts |
| `src/client/src/App.tsx` | `useVoiceWS.ts` | `useVoiceWS('/ws')` hook call | ✓ WIRED | `useVoiceWS()` called; `connect(WS_URL)` in `useEffect` |
| `src/client/src/hooks/useVoiceWS.ts` | `src/client/src/audio.ts` | `captureAndSendAudio` on onstop | ✓ WIRED | Imported and called in `recorder.current.onstop` |
| `src/client/vite.config.ts` | `localhost:3001` | `/ws` and `/api` proxy | ✓ WIRED | `ws://localhost:3001` proxy confirmed |
| `tests/modules.test.ts` | `src/server/stt.ts` | `import readAudio` | ✓ WIRED | Imported and `typeof` checked |
| `tests/protocol.test.ts` | `src/shared/protocol.ts` | `import ControlMessage` | ✓ WIRED | Type imported and used in test assertions |
| `tests/pipeline.test.ts` | `src/server/llm.ts` | `vi.mock('../src/server/llm.js')` | ✓ WIRED | Mock registered; `initPipelines` then pipeline flow verified |
| `tests/ws-server.test.ts` | `src/server/routes/ws.ts` | `handleConnection` | ✗ NOT_WIRED | Test file missing |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/server/routes/ws.ts` | `wavBuffer` | `runPipeline(data)` → STT → LLM → TTS → `generateWav().toBuffer()` | Yes — real ML pipeline data flow | ✓ FLOWING |
| `src/client/src/App.tsx` | `state`, `error` | `useVoiceWS()` hook (useState) | Yes — driven by WS messages | ✓ FLOWING |
| `src/client/src/hooks/useVoiceWS.ts` | audio blob | `recorder.current.onstop` → `captureAndSendAudio` | Yes — MediaRecorder chunks | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles (server) | `npm run typecheck:server` | Exit 0, no errors | ✓ PASS |
| TypeScript compiles (client) | `npm run typecheck:client` | Exit 0, no errors | ✓ PASS |
| vitest runs all tests | `npm test` | 9 tests, 3 files passed | ✓ PASS (but below required 15) |
| Module exports exist | `tests/modules.test.ts` | All 6 tests green | ✓ PASS |
| Protocol types correct | `tests/protocol.test.ts` | 2 tests green | ✓ PASS |
| Pipeline mocked e2e with RIFF header | `tests/pipeline.test.ts` | 1 test green | ✓ PASS |
| WS integration (connect→ready→PCM→WAV) | `tests/ws-server.test.ts` | File missing | ✗ FAIL |
| useVoiceWS state machine | `tests/state-machine.test.ts` | File missing | ✗ FAIL |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-01 | 01-03, 01-04, 01-07 | STT→LLM→TTS pipeline server | ✓ SATISFIED | `runPipeline` in ws.ts; pipeline.ts; `pipeline.test.ts` mocked e2e test |
| REQ-02 | 01-03, 01-04, 01-07 | WebSocket-based audio streaming | ✓ SATISFIED (partial test) | `handleConnection` in ws.ts; wired in index.ts; no automated WS integration test |
| REQ-03 | 01-02, 01-06, 01-07 | Platform-agnostic client protocol | ✓ SATISFIED | `protocol.ts` defines types; `iot-protocol.md` documents protocol; RIFF WAV detection for IoT path |
| REQ-04 | 01-05 | Vite frontend | ✓ SATISFIED | `src/client/vite.config.ts`; `src/client/index.html`; React app |
| REQ-05 | 01-05, 01-07 | Press-to-talk UI + state display | ✓ SATISFIED (no test) | App.tsx with all 4 states; `useVoiceWS` state machine; no automated test for transitions |
| REQ-06 | 01-05 | Browser-native audio capture | ✓ SATISFIED | `getUserMedia` + `MediaRecorder` in `useVoiceWS.ts`; no native binaries |
| REQ-07 | 01-05, 01-07 | Audio playback of TTS response | ✓ SATISFIED | `playWavBuffer` in audio.ts with `decodeAudioData` + `AudioBufferSourceNode` |
| REQ-08 | 01-03, 01-06 | IoT device compatibility | ✓ SATISFIED | RIFF magic-byte detection routes WAV bytes to `readAudio()`; `docs/iot-protocol.md` with `arecord` examples |
| REQ-09 | 01-02, 01-03 | Separation of concerns | ✓ SATISFIED | stt.ts, tts.ts, llm.ts as independent modules; REST endpoints for each stage |
| REQ-10 | 01-02 | Reuse existing utilities | ✓ SATISFIED | stt.ts, tts.ts, llm.ts migrated from root-level with cleanup |
| REQ-11 | 01-01 | TypeScript throughout | ✓ SATISFIED | Both typecheck:server and typecheck:client exit 0; all .ts/.tsx files |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/server/pipeline.ts` | 3 | `type Pipeline = any` — type safety bypassed | ⚠️ Warning | Loses TypeScript guarantees for ML pipeline return types; does not block functionality |
| `src/server/routes/ws.ts` | 68 | `(sttResult as any)` cast in userText extraction | ℹ️ Info | Safe workaround for untyped HF transformers output; consistent with original index.ts pattern |
| No `.env` committed | — | `.env` absent; `.gitignore` has `.env` entry | ✓ Good | Security requirement met |

---

### Human Verification Required

#### 1. End-to-End Voice Pipeline

**Test:** Start server with `npm run dev:server` (wait for "Pipelines ready."), then start frontend with `npm run dev:client`, navigate to `http://localhost:5173`, press-and-hold the "Talk" button, speak a sentence, release.
**Expected:** Status text cycles idle→recording→processing→playing→idle. Audio plays back from speakers.
**Why human:** Requires live Ollama LLM server (configured via `.env`), real browser microphone permission, and subjective audio playback verification. ML model loading (5-15s first run) and Ollama network availability cannot be mocked.

#### 2. GET /health After Startup

**Test:** After server startup completes pipeline init, run `curl http://localhost:3001/health`.
**Expected:** `{"status":"ok","pipelines":"ready"}`
**Why human:** Requires ML model files to be present on disk and pipeline initialization to succeed — this cannot be run headlessly in CI without model downloads.

---

### Gaps Summary

**1 gap blocks plan 07's own acceptance criteria:**

`tests/ws-server.test.ts` and `tests/state-machine.test.ts` were specified in plan 01-07 as required artifacts covering REQ-02 and REQ-05. Both files are absent. The test suite has 9 tests (3 files) instead of the required ≥15 tests (5 files). The SUMMARY acknowledged "9 Vitest tests" — this is a documented shortfall, not an oversight in the SUMMARY.

**Impact assessment:** The gap does NOT block the **phase goal** at the implementation level. The WebSocket pipeline and state machine implementations are correct and fully wired — the gap is exclusively at the automated testing layer. REQ-02 and REQ-05 are satisfied by the implementation; they are only unverified by automation.

---

_Verified: 2026-05-16T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
