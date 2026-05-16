# Roadmap: Oasis Voice Assistant

## Overview

Transform the existing Oasis voice assistant CLI (index.ts) into a platform-agnostic client-server architecture. The backend Node.js server runs the STT → LLM → TTS pipeline using existing utility modules, while a Vite.js frontend provides a walkie-talkie press-to-talk interface. IoT devices can stream audio to the server using the same WebSocket protocol as the browser client.

## Phases

- [ ] **Phase 1: Voice Pipeline Server + Walkie-Talkie Frontend** - Platform-agnostic Node.js server exposing STT/LLM/TTS pipeline over WebSocket with Vite frontend press-to-talk UI

## Phase Details

### Phase 1: Voice Pipeline Server + Walkie-Talkie Frontend
**Goal**: Deliver a working client-server voice assistant: Node.js WebSocket server running the STT → LLM → TTS pipeline, and a Vite frontend with press-to-talk walkie-talkie UI that captures browser audio, sends to server, and plays back the TTS response. IoT devices can connect using the same protocol.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11
**Success Criteria** (what must be TRUE):
  1. User can open the Vite frontend in a browser, press-and-hold the talk button to record audio, release to send, and hear the TTS response play back
  2. The Node.js server accepts WebSocket connections and processes the full STT → LLM → TTS pipeline server-side
  3. Pipeline stages (STT, LLM, TTS) are exposed as independent endpoints so IoT devices can call them separately or as a chain
  4. A Raspberry Pi or other constrained device can stream audio bytes over WebSocket and receive audio bytes back without any ML libraries installed
  5. Frontend shows pipeline state: idle / recording / processing / playing
**Plans**: 7 plans

Plans:
- [ ] 01-01-PLAN.md — Foundation: install deps, tsconfigs, folder structure, .env.example, vitest
- [ ] 01-02-PLAN.md — Server lib migrations: stt.ts, tts.ts, llm.ts + shared protocol types
- [ ] 01-03-PLAN.md — Server core: pipeline singleton + WebSocket route handler (full STT→LLM→TTS)
- [ ] 01-04-PLAN.md — Server entry: Express + ws wired together (health route, pipeline gating)
- [ ] 01-05-PLAN.md — Frontend: Vite config, React app, press-to-talk UI, audio utilities
- [ ] 01-06-PLAN.md — IoT protocol documentation (docs/iot-protocol.md)
- [ ] 01-07-PLAN.md — Verification: unit tests + human end-to-end checkpoint

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Voice Pipeline Server + Walkie-Talkie Frontend | 0/7 | Not started | - |
