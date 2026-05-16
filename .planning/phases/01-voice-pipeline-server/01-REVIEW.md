---
phase: 01-voice-pipeline-server
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/server/stt.ts
  - src/server/tts.ts
  - src/server/llm.ts
  - src/server/pipeline.ts
  - src/server/index.ts
  - src/server/routes/ws.ts
  - src/server/routes/api.ts
  - src/server/routes/health.ts
  - src/shared/protocol.ts
  - src/client/index.html
  - src/client/vite.config.ts
  - src/client/src/App.tsx
  - src/client/src/audio.ts
  - src/client/src/hooks/useVoiceWS.ts
  - src/client/src/main.tsx
  - tests/modules.test.ts
  - tests/pipeline.test.ts
  - tests/protocol.test.ts
  - docs/iot-protocol.md
  - package.json
  - tsconfig.json
  - tsconfig.server.json
  - tsconfig.client.json
  - vitest.config.ts
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

The voice pipeline server and walkie-talkie frontend are structurally sound. The STT→LLM→TTS pipeline is wired correctly end-to-end, and the WebSocket protocol is well-defined. However, the review surfaced three blockers: a global `isBusy` flag that is shared across all WebSocket connections (causing one client to permanently lock out all others after it disconnects mid-pipeline), no body-size limit on the `/api/stt` raw-binary endpoint (unbounded upload on a LAN-accessible port), and the `SPEAKER_EMBEDDINGS` URL fetched from HuggingFace on every single TTS call (adding network round-trips and creating a remote-dependency failure mode). Seven warnings cover a state machine hole that can leave the client stuck in `"recording"` indefinitely, the non-array STT result path missing a `|| ""` fallback, health endpoint always reporting `pipelines: "ready"` regardless of true state, duplicated `isWavBuffer`/`bufferToFloat32` code across two files, an `AudioContext` leak in `playWavBuffer`, `TTS_MODEL` documented in `.env.example` but never consumed, and several unused production dependencies.

---

## Critical Issues

### CR-01: Global `isBusy` flag creates permanent server lockout on unexpected disconnect

**File:** `src/server/routes/ws.ts:12`

`isBusy` is a module-level singleton. If a client disconnects abnormally (TCP reset, browser crash) during `runPipeline`, the `close` and `error` handlers both reset it to `false` — but only if the WebSocket fires those events. If the underlying socket is silently dropped (e.g., half-open TCP, the `ws` library never fires `close`), `isBusy` stays `true` permanently, blocking every subsequent connection until the server restarts. Additionally, because the flag is shared across all connections, Client A being busy causes Client B to receive an immediate `"busy"` error with no queue or retry hint, even if Client A finishes milliseconds later.

More critically: there is a TOCTOU window. Two simultaneous message events both read `isBusy === false` before either writes `true`. Node.js's single-threaded event loop prevents true data races on synchronous reads, but two `message` callbacks both queued before `isBusy = true` executes at line 120 can both pass the guard at line 114. This can happen when a client sends two binary frames in rapid succession.

**Fix:**
```typescript
// Option 1: tie busy state to the connection, not the module
export function handleConnection(ws: WebSocket): void {
  let isBusy = false; // per-connection scope — eliminates cross-client lockout
  // ... rest of handler unchanged
}
```
For the TOCTOU window, move the flag set to before the first `await`:
```typescript
if (isBusy) {
  send(ws, { type: "error", message: "busy" });
  return;
}
isBusy = true; // set synchronously before any await
send(ws, { type: "processing" });
try {
  const wavBuffer = await runPipeline(data);
  // ...
```
The current code already does this (line 120 is before the `await` at line 124), so the TOCTOU is only exploitable by two rapid frames from the same client — still worth noting, but the per-connection scoping fix is the critical correction.

---

### CR-02: `/api/stt` endpoint has no request body size limit

**File:** `src/server/routes/api.ts:50-82`

The `/api/stt` handler manually collects raw binary chunks with `req.on("data")` and has no maximum size check. A caller on the LAN (or any IoT device) can stream an arbitrarily large audio file — gigabytes if desired — and the server will buffer it entirely in memory before processing. `express.json()` (line 18 of `index.ts`) does not apply here because this endpoint reads raw binary, bypassing the body parser. The WebSocket path is protected by `maxPayload: 10 * 1024 * 1024`, but the REST path is completely unguarded.

**Fix:**
```typescript
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB, match WS limit

(req: Request, res: Response, next) => {
  const chunks: Buffer[] = [];
  let received = 0;
  req.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > MAX_AUDIO_BYTES) {
      req.destroy();
      res.status(413).json({ error: "Audio payload too large (max 10 MB)" });
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
},
```

---

### CR-03: `SPEAKER_EMBEDDINGS` URL fetched from HuggingFace on every TTS invocation

**File:** `src/server/pipeline.ts:12-13`, `src/server/routes/ws.ts:87`, `src/server/routes/api.ts:122`

`SPEAKER_EMBEDDINGS` is a `https://huggingface.co/...` URL that is passed directly to the Transformers.js TTS pipeline on every call. Depending on the Transformers.js internals, this may cause an HTTP fetch to HuggingFace on each request rather than using a cached copy. This introduces: (a) added per-request latency on the critical voice path, (b) a hard dependency on external network availability — the pipeline fails entirely if HuggingFace CDN is unreachable, and (c) a potential for unexpected data retrieval.

Even if Transformers.js caches the embedding internally after the first call, the code provides no guarantee of this: passing a URL each time is semantically "fetch this URL". For a LAN-only deployment, external network dependency in the hot path is a correctness risk.

**Fix:** Download the speaker embeddings binary once at `initPipelines()` time and cache the result as a `Float32Array` or `ArrayBuffer` in the `instances` object. Pass the pre-loaded tensor to subsequent TTS calls:
```typescript
interface PipelineInstances {
  stt: Pipeline | null;
  tts: Pipeline | null;
  speakerEmbeddings: Float32Array | null;
}

// In initPipelines():
const resp = await fetch(SPEAKER_EMBEDDINGS_URL);
instances.speakerEmbeddings = new Float32Array(await resp.arrayBuffer());

// In callers:
const ttsOut = await ttsPipe(text, { speaker_embeddings: getSpeakerEmbeddings() });
```

---

## Warnings

### WR-01: Client can get stuck in `"recording"` state indefinitely

**File:** `src/client/src/hooks/useVoiceWS.ts:87-98`

After `recorder.stop()` fires, the `onstop` handler calls `captureAndSendAudio` (async). During this time, the UI state is still `"recording"`. State only transitions away from `"recording"` when:
- The server sends `{ type: "processing" }`, or
- `captureAndSendAudio` throws and the catch block calls `setState("idle")`

But there is a third scenario: `ws.send()` succeeds but the server is **silently dropped** before it can send `"processing"` (e.g., server crash, network partition). In that case, `onstop` returns without error and state stays `"recording"` until the WS `close` event fires. The `onclose` handler does call `setState("idle")`, so this is recovered — however, the `onclose` handler does not set `error`, so the user sees no explanation.

More importantly: between `recorder.stop()` and `ws.send(pcm.buffer)`, there is a synchronous gap while `captureAndSendAudio` performs `decodeAudioData` and `startRendering`. During this time, `startRecording` guards on `state !== "idle"`, so double-press is blocked — but the 30-second auto-stop timer has already been cleared by `stopRecording()`. If `captureAndSendAudio` hangs (e.g., `OfflineAudioContext` never resolves), the state is stuck with no escape.

**Fix:** Set state to `"processing"` optimistically in `onstop` before the async audio processing begins, so the button is visually correct and the user is not confused:
```typescript
recorder.current.onstop = async () => {
  stream.getTracks().forEach((t) => t.stop());
  setState("processing"); // optimistic — before async work
  const blob = new Blob(chunks.current, { type: recorder.current!.mimeType });
  try {
    await captureAndSendAudio(blob, ws.current!);
    // state will be updated to "processing" again by server msg (no-op) or to "playing"
  } catch (err) {
    setError(String(err));
    setState("idle");
  }
};
```

---

### WR-02: STT non-array result path missing `|| ""` fallback — can return `undefined` to callers

**File:** `src/server/routes/api.ts:73-74`, `src/server/routes/ws.ts:69`

In both files the STT result is handled identically:
```typescript
const text = Array.isArray(sttResult)
  ? (sttResult[0] as any)?.text || ""   // safe: has || ""
  : (sttResult as any).text;            // unsafe: no fallback
```
If `sttResult` is a non-array object and `.text` is `undefined` (e.g., a Whisper model that returns a different schema), the variable is `undefined`. In `ws.ts`, `!userText` catches this and throws `"No clear input detected"` — harmless. In `api.ts`, `res.json({ text: undefined })` serializes to `{}` (JSON drops `undefined` values), so the caller receives a response with no `text` field, silently breaking the API contract.

**Fix:**
```typescript
: (sttResult as any).text ?? "";
```
Apply the same `?? ""` (or `|| ""`) fallback in both files for consistency.

---

### WR-03: `GET /health` always returns `pipelines: "ready"` regardless of actual state

**File:** `src/server/routes/health.ts:9-11`

The health endpoint is hardcoded to report `{ status: "ok", pipelines: "ready" }`. It does not check whether `instances.stt` or `instances.tts` are actually initialized. If pipelines fail to load but the server somehow continues (e.g., the `process.exit(1)` in `index.ts` is removed, or the health endpoint is called during the startup window before `initPipelines` is awaited), it will falsely report healthy. For monitoring and IoT readiness checks, a misleading health endpoint is a reliability hazard.

**Fix:**
```typescript
import { getSttPipeline, getTtsPipeline } from "../pipeline.js";

healthRouter.get("/health", (_req, res) => {
  let pipelineStatus: "ready" | "not_ready";
  try {
    getSttPipeline();
    getTtsPipeline();
    pipelineStatus = "ready";
  } catch {
    pipelineStatus = "not_ready";
  }
  const isReady = pipelineStatus === "ready";
  res.status(isReady ? 200 : 503).json({ status: isReady ? "ok" : "degraded", pipelines: pipelineStatus });
});
```

---

### WR-04: `isWavBuffer` and `bufferToFloat32` duplicated verbatim across two files

**File:** `src/server/routes/ws.ts:26-53`, `src/server/routes/api.ts:16-42`

Both `isWavBuffer` and `bufferToFloat32` are copy-pasted identically (down to the comment text) in both route files. Any bug fix or behavior change must be applied in two places. The only difference is the temp file prefix (`oasis-` vs `oasis-stt-`), which is not a meaningful distinction.

**Fix:** Extract both functions into `src/server/audio-utils.ts` and import from there in both route files.

---

### WR-05: `AudioContext` leak in `playWavBuffer` when `src.start()` errors

**File:** `src/client/src/audio.ts:59-68`

`playWavBuffer` creates an `AudioContext` and then wraps playback in a `Promise`. The `onended` callback closes the context and resolves. If `src.start()` throws (e.g., invalid audio buffer state), the exception propagates out of the `Promise` constructor, the promise rejects, and `audioCtx` is never closed. The context remains open indefinitely — browsers have a limit on concurrent `AudioContext` instances.

**Fix:**
```typescript
return new Promise((resolve, reject) => {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(audioCtx.destination);
  src.onended = () => {
    audioCtx.close();
    resolve();
  };
  try {
    src.start();
  } catch (err) {
    audioCtx.close();
    reject(err);
  }
});
```

---

### WR-06: `TTS_MODEL` env var is documented in `.env.example` but never consumed

**File:** `.env.example:7-9`, `src/server/pipeline.ts:30`

`.env.example` documents a `TTS_MODEL` environment variable with two valid options (`Xenova/speecht5_tts` and `Xenova/mms-tts-eng`) and notes that `mms-tts-eng` does not require speaker embeddings. However, `pipeline.ts` hardcodes `"Xenova/speecht5_tts"` and ignores `process.env.TTS_MODEL` entirely. Operators who set `TTS_MODEL=Xenova/mms-tts-eng` will not see any effect, and if they also omit the speaker embeddings, the pipeline will still work by accident (because the env var is ignored). This is a silent misconfiguration: the env var has no effect, which is deceptive documentation.

**Fix:** Either consume the env var in `pipeline.ts`:
```typescript
const TTS_MODEL = process.env.TTS_MODEL ?? "Xenova/speecht5_tts";
instances.tts = await pipeline("text-to-speech", TTS_MODEL);
```
Or remove `TTS_MODEL` from `.env.example` entirely if model selection is intentionally not runtime-configurable.

---

### WR-07: Large unused dependency surface in `package.json`

**File:** `package.json:27-36`

The following packages are listed as production dependencies but are not imported anywhere in `src/`:
- `kokoro-js`
- `mic`
- `node-audiorecorder`
- `node-microphone`
- `node-wav-player`
- `play-sound`
- `speaker`

These appear to be abandoned exploration artifacts. Unused production dependencies increase install time, attack surface, and binary size. Some of these packages (`mic`, `speaker`) have native bindings that may fail to compile on some platforms, breaking `npm install` unnecessarily.

**Fix:** Remove all unused production dependencies:
```bash
npm uninstall kokoro-js mic node-audiorecorder node-microphone node-wav-player play-sound speaker
```

---

## Info

### IN-01: RIFF magic-byte check is not WAV-specific

**File:** `src/server/routes/ws.ts:26-34`, `src/server/routes/api.ts:16-24`

The `isWavBuffer` function checks for `RIFF` at bytes 0-3, which is common to WAV, AVI, WebP, and other RIFF-based formats. A valid AVI file would pass this check and be routed to `readAudio()`, which would likely throw or return garbage audio data. Given LAN-only scope this is low risk, but the function name `isWavBuffer` overstates the check's accuracy.

**Fix:** Also verify the WAVE four-CC at bytes 8-11:
```typescript
function isWavBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45   // WAVE
  );
}
```

---

### IN-02: `qwen3wen3_8b` and `gemma3_270m` are exported from `llm.ts` but never used

**File:** `src/server/llm.ts:8,10`

`qwen3wen3_8b` and `gemma3_270m` are exported model instances that are imported nowhere in the server code (both route files import only `gemma3n`). The `generateText` re-export from `llm.ts` is also unused by callers — both `ws.ts` and `api.ts` import `generateText` directly from `"ai"`.

**Fix:** Remove the unused exports from `llm.ts`, or add a comment indicating they are reserved for future use. The `generateText` re-export is harmless but confusing since no callers use it.

---

### IN-03: No WebSocket reconnection — UI shows "Connected and ready" after disconnect

**File:** `src/client/src/App.tsx:123`, `src/client/src/hooks/useVoiceWS.ts:55-58`

After the WebSocket closes (server restart, network blip), `onclose` sets state to `"idle"`. App.tsx line 123 then displays `"Connected and ready"` because `state === "idle"`. The user sees no indication that the connection is lost and may press the button repeatedly with no response. `connect()` is only called once from `useEffect` on mount.

**Fix:** Add a `connected` boolean to the hook's state and display a distinct "Disconnected — reconnecting..." message in the UI. Optionally add exponential-backoff reconnect logic in the `onclose` handler.

---

### IN-04: `pipeline.ts` partial initialization leaves `instances.stt` re-created on retry

**File:** `src/server/pipeline.ts:20-31`

The idempotency guard `if (instances.stt && instances.tts) return;` only short-circuits when both are initialized. If STT loads but TTS throws, `instances.stt` is non-null and `instances.tts` is null. On the next `initPipelines()` call, the guard does not return early, and the STT pipeline is re-created from scratch (re-downloading the model, re-allocating memory). In practice, `initPipelines` is only called once at startup (and `process.exit(1)` follows failure), so this is low-impact — but the guard is semantically misleading.

**Fix:** Guard each pipeline independently:
```typescript
if (!instances.stt) {
  instances.stt = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", { ... });
}
if (!instances.tts) {
  instances.tts = await pipeline("text-to-speech", "Xenova/speecht5_tts");
}
```

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
