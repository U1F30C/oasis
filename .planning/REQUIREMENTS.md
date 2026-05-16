# Requirements: Oasis Voice Assistant

**Project:** Oasis — Platform-Agnostic Voice Pipeline Server
**Version:** 1.0.0
**Date:** 2026-05-13

---

## Functional Requirements

### REQ-01: STT → LLM → TTS Pipeline Server
The system SHALL expose a backend Node.js server that executes the full voice pipeline (audio-in → text → LLM response → audio-out) using the existing utilities in stt.ts, tts.ts, and llm.ts.

### REQ-02: WebSocket-Based Audio Streaming
The server SHALL support real-time audio streaming via WebSocket so that IoT devices and browser clients can stream audio data without requiring a thick client installation.

### REQ-03: Platform-Agnostic Client Protocol
The server SHALL accept audio data over a documented protocol (WebSocket or HTTP multipart) so that any platform (browser, IoT device, mobile, CLI) can connect and use the pipeline without platform-specific server code.

### REQ-04: Vite Frontend
The project SHALL include a Vite.js frontend (React or vanilla JS) that connects to the backend server and provides the user interface.

### REQ-05: Press-to-Talk (Walkie-Talkie) Interface
The frontend SHALL implement a press-to-talk UI: the user presses/holds a button to record audio, and releases to send the recording for processing. The UI SHALL display the pipeline state (idle, recording, processing, playing).

### REQ-06: Browser-Native Audio Capture
The frontend SHALL capture microphone audio using the browser's Web Audio API / MediaRecorder API — no native binaries required on the client side.

### REQ-07: Audio Playback of TTS Response
The frontend SHALL play back the TTS-generated audio response automatically after processing completes.

### REQ-08: IoT Device Compatibility
The server protocol SHALL be simple enough that a constrained IoT device (e.g., Raspberry Pi) can stream audio to the server and receive audio back, delegating all ML computation to the server.

---

## Non-Functional Requirements

### REQ-09: Separation of Concerns
The STT, LLM, and TTS pipeline stages SHALL be implemented as separate modules/routes so they can be called independently or as a pipeline.

### REQ-10: Reuse Existing Utilities
The backend SHALL reuse the utility code from stt.ts, tts.ts, mic.ts, and index.ts rather than rewriting from scratch.

### REQ-11: TypeScript Throughout
Both frontend and backend SHALL use TypeScript.

---

## Out of Scope (v1.0)

- Authentication/authorization
- Multi-user sessions
- Conversation history/memory
- Custom wake word detection
- Mobile native apps
