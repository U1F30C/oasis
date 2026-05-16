---
phase: 1
reviewers: [gemini]
reviewed_at: 2026-05-13T00:00:00Z
plans_reviewed:
  - 01-01-PLAN.md
  - 01-02-PLAN.md
  - 01-03-PLAN.md
  - 01-04-PLAN.md
  - 01-05-PLAN.md
  - 01-06-PLAN.md
  - 01-07-PLAN.md
---

# Cross-AI Plan Review — Phase 1

## Gemini Review

### Summary
The implementation plans for Phase 1 are exceptionally high quality, demonstrating a deep understanding of the technical challenges inherent in a real-time voice pipeline. By proactively addressing the "audio format mismatch" (browser webm/opus vs. Whisper 16kHz mono) through client-side resampling, the architecture avoids heavy server-side dependencies like FFmpeg. The use of a singleton pattern for the heavy ML pipelines and the inclusion of a "busy guard" directly mitigate the most common performance and concurrency pitfalls identified in the research. The plan successfully balances browser-native features with a platform-agnostic IoT protocol, making it a robust foundation for the project.

### Strengths
- **Architectural Efficiency:** Client-side PCM resampling (OfflineAudioContext) is a significant win, reducing server CPU load and binary dependencies.
- **Robust Pipeline Management:** Singleton initialization gated by the server's `listen` call ensures zero cold-start latency for the first user connection.
- **IoT-First Design:** The inclusion of RIFF magic-byte detection in both WebSocket and REST endpoints allows IoT devices to stream simple WAV files, lowering the barrier for integration on constrained hardware.
- **Security & Stability:** Implementation of `maxPayload` (10MB), a 30-second recording auto-stop, and global busy guards protects the server from memory exhaustion and pipeline race conditions.
- **Comprehensive Testing:** The strategy of mocking ML pipelines (Wave 7) allows for fast, deterministic CI/CD verification of the complex state machine and networking logic.
- **Modular REST API:** Exposing STT, LLM, and TTS as individual endpoints (REQ-09) provides excellent flexibility for debugging and external integrations.

### Concerns

- **[LOW] Global concurrency:** The `isBusy` flag in `ws.ts` is a module-level variable, limiting the server to processing exactly one voice request at a time across all connected clients. Acceptable for a single-user LAN assistant, but may cause frustration if multiple IoT devices/users are active simultaneously — there is no queuing or "busy" feedback to a second caller.

- **[LOW] AudioContext lifecycle on mobile:** In `audio.ts`, `new AudioContext()` is created within async functions. On some mobile browsers, if the very first `AudioContext` isn't created directly within a synchronous event handler (like the `mousedown` part of `handlePress`), it may remain "suspended." The `onstop` handler (which triggers the first `decodeAudioData` call) may not be recognized as a valid user gesture on all mobile browsers.

- **[LOW] Temp file orphaning on crash:** The WAV decoding path in `ws.ts` and `api.ts` uses `fs.unlinkSync` in a `finally` block. This is safe under normal operation, but if the server crashes unexpectedly during the STT phase, temp WAV files accumulate in `os.tmpdir()`.

### Suggestions

- **"Server Busy" UI state:** Update the frontend to explicitly show a "Server Busy" or "Unavailable" state if a WebSocket connection is attempted while `isBusy` is true. Currently the server rejects silently; the UI should reflect this.
- **Pre-warm AudioContext:** In `useVoiceWS.connect`, consider initializing a suspended `AudioContext` on the first user interaction to ensure all subsequent `decodeAudioData` calls work seamlessly across all mobile browsers — resume it on the first press event.
- **Temp file naming:** Use a specific prefix for temp WAV files (e.g., `oasis-stt-`) to make it easy for a startup script to purge orphaned recordings (`rm /tmp/oasis-stt-*.wav`).

### Risk Assessment
**Overall Risk: LOW**

The technical risks are well-managed. The most significant external dependency is the Ollama service IP; however, the plan mitigates this by using environment variables with fallbacks. The core ML pipelines are local and their initialization is properly guarded. The clear separation of concerns between server, client, and protocol types minimizes regression risk during future phases.

---

## Consensus Summary

*Single reviewer — consensus not applicable. Key findings:*

### Agreed Strengths
- Client-side OfflineAudioContext resampling eliminates server-side FFmpeg dependency
- Pipeline singleton gated before `server.listen()` prevents cold-start race conditions
- RIFF magic-byte detection enables seamless dual-path support (browser PCM + IoT WAV)
- 30s auto-stop + 10MB `maxPayload` + busy guard form a solid safety layer
- Mocked vitest suite enables deterministic CI without live Ollama/HuggingFace

### Agreed Concerns (HIGH priority first)
- None HIGH severity
- [LOW] Global `isBusy` flag — no queuing or busy feedback to second caller
- [LOW] AudioContext may suspend on mobile if not initialized in synchronous event handler
- [LOW] Temp file orphaning on unexpected server crash

### Divergent Views
N/A — single reviewer

### Actionable Before Execution
None blocking. All concerns are LOW severity and can be addressed during or after execution. The review confirms plans are ready to execute.
