---
phase: "01-voice-pipeline-server"
plan: "05"
subsystem: "frontend-client"
tags: ["typescript", "react", "vite", "websocket", "audio", "press-to-talk", "mediarecorder", "web-audio-api"]
dependency_graph:
  requires:
    - "01-02: shared/protocol.ts — ControlMessage and PipelineState types"
  provides:
    - "src/client/vite.config.ts — Vite dev server with /ws and /api proxy to localhost:3001"
    - "src/client/index.html — Vite HTML entry with #root div"
    - "src/client/src/main.tsx — React root mount with StrictMode"
    - "src/client/src/audio.ts — captureAndSendAudio (OfflineAudioContext 16kHz resample + WS send) and playWavBuffer (decode + play)"
    - "src/client/src/hooks/useVoiceWS.ts — MediaRecorder + WebSocket hook with 30s auto-stop state machine"
    - "src/client/src/App.tsx — Press-to-talk UI with mouse and touch event handlers"
  affects:
    - "01-07: end-to-end verification uses this frontend for browser interaction testing"
tech_stack:
  added: []
  patterns:
    - "Vite proxy to forward /ws (WebSocket) and /api (HTTP) to Node.js backend on port 3001"
    - "OfflineAudioContext for browser-side PCM resampling to 16kHz mono (required by server STT)"
    - "MediaRecorder blob → decodeAudioData → OfflineAudioContext resample → Float32Array binary WS frame"
    - "30s recording auto-stop via window.setTimeout in startRecording; clearTimeout in stopRecording (T-01-12 DoS mitigation)"
    - "useVoiceWS hook: four-state machine (idle/recording/processing/playing); binary arraybuffer WS messages; text ControlMessage JSON"
    - "Press-to-talk: onMouseDown/onMouseUp/onMouseLeave + onTouchStart/onTouchEnd for desktop and mobile/IoT touchscreen support"
    - "webkitAudioContext fallback in audio.ts for Safari compatibility"
key_files:
  created:
    - "src/client/vite.config.ts — Vite defineConfig with plugins:[react()], proxy /ws (ws:true, rewriteWsOrigin:true) and /api, port 5173, build outDir dist/client"
    - "src/client/index.html — Standard Vite HTML entry with #root div and /src/main.tsx module script"
    - "src/client/src/main.tsx — createRoot(#root).render(<StrictMode><App/></StrictMode>)"
    - "src/client/src/audio.ts — captureAndSendAudio() resamples blob to 16kHz mono Float32Array via OfflineAudioContext; playWavBuffer() decodes WAV and plays via AudioBufferSourceNode with onended Promise resolution"
    - "src/client/src/hooks/useVoiceWS.ts — useVoiceWS() exports state, error, connect, startRecording, stopRecording; autoStopTimer ref with 30_000ms window.setTimeout"
    - "src/client/src/App.tsx — press-to-talk button with STATE_LABELS/STATE_COLORS for all four states; error panel; useEffect connect on mount"
  modified: []
decisions:
  - "vite.config.ts includes root:'src/client' and build.outDir:'../../dist/client' for correct Vite project layout (files already present on disk had this set)"
  - "audio.ts uses webkitAudioContext fallback in addition to standard AudioContext for Safari/iOS compatibility"
  - "useVoiceWS connect() checks both OPEN and CONNECTING states to prevent duplicate connections"
  - "useVoiceWS includes useEffect cleanup to close WebSocket and clear timer on component unmount"
  - "App.tsx handlePress/handleRelease use e.preventDefault() to prevent ghost clicks on touch devices"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-16"
  tasks_completed: 3
  files_created: 6
  files_modified: 0
---

# Phase 1 Plan 5: Frontend — Vite + React press-to-talk UI Summary

**One-liner:** Vite + React walkie-talkie client with useVoiceWS hook (MediaRecorder + WebSocket + 30s auto-stop), OfflineAudioContext PCM resampling to 16kHz, and four-state press-to-talk UI with mouse and touch event support.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Vite config (/ws + /api proxy), index.html (#root), main.tsx (StrictMode + createRoot) | 85ffa84 |
| 2 | audio.ts: captureAndSendAudio (OfflineAudioContext 16kHz resample) + playWavBuffer (decode + play) | 128ac97 |
| 3 | useVoiceWS hook (30s auto-stop, full state machine) + App.tsx (press-to-talk, touch/mouse events) | d4c19ca |

## Verification Results

All acceptance criteria met:

**Task 1 — Vite infrastructure:**
- `src/client/vite.config.ts`: contains `proxy`, `/ws` with `ws: true` and `rewriteWsOrigin: true`, `/api` to `http://localhost:3001`, port 5173
- `src/client/index.html`: contains `id="root"` and `src="/src/main.tsx"`
- `src/client/src/main.tsx`: contains `createRoot` and `StrictMode`

**Task 2 — audio.ts:**
- Exports `captureAndSendAudio` and `playWavBuffer`
- Contains `OfflineAudioContext`, `TARGET_RATE = 16000`, `getChannelData(0)`, `ws.send(pcm.buffer)`
- Contains `audioCtx.decodeAudioData` in both functions
- Contains `src.onended` with resolve callback
- Both functions call `audioCtx.close()` (no leaked AudioContext)

**Task 3 — useVoiceWS + App.tsx:**
- `useVoiceWS` exported; `autoStopTimer` ref `useRef<number | null>(null)`
- `window.setTimeout` with `30_000` ms in `startRecording`
- `clearTimeout(autoStopTimer.current)` in `stopRecording` (before `recorder.stop()`)
- `captureAndSendAudio` import and call in `onstop`; `playWavBuffer` call in binary message handler
- `binaryType = "arraybuffer"` on WebSocket; state transitions verified
- `getUserMedia` in startRecording; `recorder.current.stop()` in stopRecording
- App.tsx: `export default function App`, `useVoiceWS` call, `onMouseDown`, `onMouseUp`, `onTouchStart`, `onTouchEnd`
- `STATE_LABELS` with all four states: idle, recording, processing, playing
- `useEffect(() => { connect(WS_URL); }, [connect])` on mount

## Deviations from Plan

Files already existed on disk from prior wave activity. They exceeded the plan specification in several beneficial ways:

**1. [Auto-enhancement] webkitAudioContext fallback in audio.ts**
- The existing file uses `new (window.AudioContext || (window as any).webkitAudioContext)()` instead of `new AudioContext()`
- This adds Safari/iOS compatibility, which is strictly better — no correction needed

**2. [Auto-enhancement] useVoiceWS connect() guards both OPEN and CONNECTING states**
- Plan specified checking `readyState === WebSocket.OPEN` only
- Existing implementation also guards `WebSocket.CONNECTING` to prevent duplicate connections during startup

**3. [Auto-enhancement] useVoiceWS useEffect cleanup**
- Plan did not specify cleanup; existing hook adds `useEffect(() => { return () => { ws.current?.close(); clearTimeout(autoStopTimer.current); }; }, [])` for unmount cleanup (Rule 2: missing critical functionality pre-emptively added)

**4. [Auto-enhancement] App.tsx e.preventDefault() in event handlers**
- Existing App calls `e.preventDefault()` in handlePress/handleRelease to suppress ghost clicks on touchscreens — beneficial for IoT touchscreen target use case

**5. [Cosmetic] vite.config.ts includes root and build configuration**
- Existing config has `root: "src/client"` and `build: { outDir: "../../dist/client", emptyOutDir: true }` beyond what the plan specified — necessary for correct Vite project layout

All deviations are additive enhancements; no plan requirements were removed or altered.

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-01-10 | getUserMedia audio stream — browser prompts user for mic permission; stream tracks stopped immediately in onstop via `stream.getTracks().forEach(t => t.stop())` | Addressed |
| T-01-11 | Server WAV bytes → decodeAudioData — accepted (LAN-only trusted server v1 scope) | Accepted |
| T-01-12 | Long recordings DoS — `window.setTimeout(stopRecording, 30_000)` in startRecording; `clearTimeout(autoStopTimer.current)` in stopRecording clears timer on manual release | Addressed |

## Known Stubs

None — all six files are fully implemented with real logic. No hardcoded empty values, placeholder text, or unwired props.

## Self-Check: PASSED

Files verified:
- FOUND: /home/eric/Downloads/Projects/oasis/src/client/index.html
- FOUND: /home/eric/Downloads/Projects/oasis/src/client/vite.config.ts
- FOUND: /home/eric/Downloads/Projects/oasis/src/client/src/main.tsx
- FOUND: /home/eric/Downloads/Projects/oasis/src/client/src/App.tsx
- FOUND: /home/eric/Downloads/Projects/oasis/src/client/src/hooks/useVoiceWS.ts
- FOUND: /home/eric/Downloads/Projects/oasis/src/client/src/audio.ts

Commits verified:
- FOUND: 85ffa84 (vite.config.ts, index.html, main.tsx)
- FOUND: 128ac97 (audio.ts)
- FOUND: d4c19ca (useVoiceWS.ts, App.tsx)
