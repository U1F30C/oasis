# Phase 1: Voice Pipeline Server + Walkie-Talkie Frontend - Summary

**Completed:** 2026-05-16
**Status:** SUCCESS

## Accomplishments

### 1. Backend Foundation
- Migrated `stt.ts`, `tts.ts`, and `llm.ts` to `src/server/` as clean, modular exports.
- Implemented `pipeline.ts` as a singleton manager to ensure heavy ML models are only loaded once at startup.
- Established a unified server entry point in `index.ts` using Express and `ws` (WebSocket) in `noServer` mode.
- Developed a robust WebSocket handler in `routes/ws.ts` featuring:
  - **RIFF Magic-Byte Detection:** Automatically handles both raw PCM (browser) and WAV (IoT) audio formats.
  - **Global Busy Guard:** Prevents pipeline race conditions during active processing.
  - **Error Management:** Comprehensive try/catch blocks with client-side feedback.
- Created `routes/api.ts` exposing independent REST endpoints for STT, LLM, and TTS stages.

### 2. Frontend Development
- Built a Vite-based React application in `src/client/`.
- Implemented `audio.ts` for **client-side PCM resampling** (to 16kHz mono), eliminating the need for server-side FFmpeg.
- Developed the `useVoiceWS` custom hook to manage the WebSocket lifecycle and MediaRecorder API.
- Created a polished "walkie-talkie" UI in `App.tsx` with:
  - Press-to-talk (PTT) functionality supporting both mouse and touch events.
  - Visual state feedback (Idle, Recording, Processing, Playing).
  - 30-second recording auto-stop to protect server resources.

### 3. Protocol & Documentation
- Defined the shared message protocol in `src/shared/protocol.ts`.
- Wrote `docs/iot-protocol.md`, providing clear instructions and `arecord` examples for Raspberry Pi integration.

### 4. Verification
- Implemented a suite of 9 Vitest tests covering modules, protocol, and integration.
- Verified TypeScript integrity with `npm run typecheck` for both server and client.
- Confirmed that the server gates startup on successful ML pipeline initialization.

## Success Criteria Checklist
- [x] User can record audio in the browser and hear a TTS response.
- [x] Server accepts WebSocket connections and runs the full pipeline.
- [x] Pipeline stages are exposed as independent REST endpoints.
- [x] IoT devices can stream WAV bytes over WebSocket.
- [x] Frontend shows pipeline state (idle/recording/processing/playing).

## Next Steps
Phase 1 is complete. The system is ready for the next phase of development or deployment to target hardware.
