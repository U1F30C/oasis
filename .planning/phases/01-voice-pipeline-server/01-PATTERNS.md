# Phase 1: Voice Pipeline Server + Walkie-Talkie Frontend - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 11 new files
**Analogs found:** 9 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/server/index.ts` | server-entry | request-response | `index.ts` (main fn + pipeline init) | role-match |
| `src/server/pipeline.ts` | singleton-service | CRUD (init once, read many) | `index.ts` lines 129–141 (pipeline init block) | exact-pattern |
| `src/server/routes/ws.ts` | route-handler | event-driven | `index.ts` lines 171–239 (processRecording) | exact-pattern |
| `src/server/stt.ts` | utility | transform | `stt.ts` (entire file) | exact |
| `src/server/tts.ts` | utility | transform | `tts.ts` (entire file) | exact |
| `src/server/llm.ts` | utility | request-response | `llm.ts` (entire file) | exact |
| `src/client/src/main.ts` | frontend-entry | event-driven | no analog in codebase | none |
| `src/client/src/audio.ts` | utility | transform (file-I/O + Web Audio) | no close analog; see RESEARCH.md Pattern 4 | none |
| `src/client/src/ws.ts` | utility | event-driven | `index.ts` lines 47–80 (start/stop pattern) | partial |
| `src/client/src/ui.ts` | component | event-driven | `index.ts` lines 152–168 (keypress state machine) | partial |
| `client/index.html` | config | — | no analog | none |
| `.env.example` | config | — | no analog | none |

---

## Pattern Assignments

### `src/server/index.ts` (server-entry, request-response)

**Analog:** `index.ts` — the async `main()` pattern and sequential startup (init → listen).

**Imports pattern** (`index.ts` lines 1–11):
```typescript
import { pipeline } from "@huggingface/transformers";
import { createOllama } from "ollama-ai-provider-v2";
import { generateText } from "ai";
import { WaveFile } from "wavefile";
import * as fs from "fs";
import * as path from "path";
```
New file will swap these for:
```typescript
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { initPipelines } from "./pipeline.js";
import { handleConnection } from "./routes/ws.js";
```

**Core startup pattern** (`index.ts` lines 129–169) — async main, sequential init before accepting input:
```typescript
async function main() {
  // Initialize all expensive resources before accepting work
  const sttPipe = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
    { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
  );
  const ttsPipe = await pipeline("text-to-speech", "Xenova/speecht5_tts");

  // Only after init does the server begin handling input
  process.stdin.on("keypress", async (chunk, key) => { ... });
  process.stdin.resume();
}

main().catch(console.error);
```
Copy this exact shape: `async function main() { ... } main().catch(console.error)`. Replace stdin event attachment with `server.listen(3001, ...)`. The `await initPipelines()` call replaces the inline pipeline awaits.

**Error handling pattern** (`index.ts` lines 236–239):
```typescript
  } catch (error) {
    console.error("❌ Error processing recording:", error);
    console.log("👂 Ready for next input! Hold SPACE to record");
  }
```
Server entry does not need per-request try/catch — that belongs in `routes/ws.ts`. Entry-level errors are caught by `main().catch(console.error)`.

---

### `src/server/pipeline.ts` (singleton-service, CRUD-init)

**Analog:** `index.ts` lines 129–141 — the pipeline initialization block extracted as a singleton module.

**Core singleton pattern** (`index.ts` lines 134–141):
```typescript
const sttPipe = await pipeline(
  "automatic-speech-recognition",
  "Xenova/whisper-tiny.en",
  { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
);

const ttsPipe = await pipeline("text-to-speech", "Xenova/speecht5_tts");

const speaker_embeddings =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";
```
Copy these exact model IDs, dtype options, and speaker_embeddings URL verbatim — these are verified working in the existing codebase. Wrap in module-level `let` variables guarded by an `initPipelines()` export and getter functions (`getSttPipeline()`, `getTtsPipeline()`).

**Imports pattern** (`index.ts` line 1):
```typescript
import { pipeline } from "@huggingface/transformers";
```

**Error guard pattern** — add to getter functions (no existing analog; derive from general project error style):
```typescript
export function getSttPipeline() {
  if (!instances.stt) throw new Error("STT pipeline not initialized — call initPipelines() first");
  return instances.stt;
}
```

---

### `src/server/routes/ws.ts` (route-handler, event-driven)

**Analog:** `index.ts` `processRecording()` function (lines 172–239) — the complete STT→LLM→TTS orchestration with error handling.

**Core pipeline orchestration pattern** (`index.ts` lines 194–229):
```typescript
async function processRecording(sttPipe, ttsPipe, speaker_embeddings) {
  try {
    // 1. Read audio and STT
    const audioData = await readAudio(recordingPath, 16000);
    const sttResult = await sttPipe(audioData, { chunk_length_s: 10 });
    const userText = Array.isArray(sttResult)
      ? sttResult[0]?.text || ""
      : sttResult.text;

    // 2. LLM
    const { text: llmResponse } = await generateText({
      model: gemma3n,
      prompt: `You are a helpful voice assistant. Keep responses concise and conversational and very short, one or two sentences. User said: "${userText}"`,
    });

    // 3. TTS
    const ttsOut = await ttsPipe(llmResponse, { speaker_embeddings });
    const wav = generateWav(ttsOut);
  } catch (error) {
    console.error("❌ Error processing recording:", error);
  }
}
```
The new ws route replaces file I/O (`readAudio(path)`) with in-memory Float32Array construction from the incoming WebSocket Buffer. All three stages (STT, LLM, TTS) and the try/catch structure are copied directly. The LLM prompt string is copied verbatim.

**WebSocket message dispatch pattern** (from RESEARCH.md Pattern 3 — no codebase analog exists, derive from RESEARCH.md):
```typescript
ws.on("message", async (data, isBinary) => {
  if (!isBinary) {
    const msg = JSON.parse(data.toString());
    if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
    return;
  }
  // binary = audio
  ws.send(JSON.stringify({ type: "processing" }));
  try {
    const wavBytes = await runPipeline(data as Buffer);
    if (ws.readyState === WebSocket.OPEN) ws.send(wavBytes);
  } catch (e) {
    ws.send(JSON.stringify({ type: "error", message: String(e) }));
  }
});
```

**Buffer → Float32Array conversion** (RESEARCH.md Pattern 5, no codebase analog):
```typescript
const audioData = new Float32Array(
  data.buffer,
  data.byteOffset,
  data.byteLength / 4
);
```

**Imports pattern** (`index.ts` lines 1–4 + `llm.ts` lines 1–2):
```typescript
import { generateText } from "ai";
import { getSttPipeline, getTtsPipeline } from "../pipeline.js";
import { generateWav } from "../tts.js";
```

---

### `src/server/stt.ts` (utility, transform)

**Analog:** `stt.ts` — copy this file almost verbatim. It is the direct source.

**Full file pattern** (`stt.ts` lines 1–28):
```typescript
import { pipeline } from "@huggingface/transformers";
import fs from "fs";
import { WaveFile } from "wavefile";

export async function readAudio(path: string, sampling_rate: number) {
  const buffer = fs.readFileSync(path);
  const wav = new WaveFile(buffer);
  wav.toBitDepth("32f");
  wav.toSampleRate(sampling_rate);
  let samples = wav.getSamples();
  if (Array.isArray(samples)) {
    if (samples.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);
      for (let i = 0; i < samples[0].length; ++i) {
        samples[0][i] = (SCALING_FACTOR * (samples[0][i] + samples[1][i])) / 2;
      }
    }
    samples = samples[0];
  }
  return samples;
}
```
Drop the `main()` function at the bottom (lines 31–46) — it is a dev harness, not needed in the server module. Keep only the `readAudio` export.

---

### `src/server/tts.ts` (utility, transform)

**Analog:** `tts.ts` — copy `generateWav` verbatim; drop `playWav` (server sends WAV bytes over WebSocket; Speaker is not used server-side).

**Core pattern** (`tts.ts` lines 10–13):
```typescript
function generateWav(ttsOut: { sampling_rate: number; audio: Float32Array }) {
  const wav = new WaveFile();
  wav.fromScratch(channels, ttsOut.sampling_rate, "32f", ttsOut.audio);
  return wav;
}
```
Export `generateWav`. Add a post-generation step before returning — convert to 16-bit for browser compatibility (per RESEARCH.md Pitfall 5):
```typescript
wav.toBitDepth("16"); // universal browser decodeAudioData support
return wav;
```

**Imports pattern** (`tts.ts` lines 1–3):
```typescript
import { WaveFile } from "wavefile";
// Remove: Speaker import — not needed on server
```

---

### `src/server/llm.ts` (utility, request-response)

**Analog:** `llm.ts` — copy the Ollama initialization and model exports verbatim.

**Full pattern** (`llm.ts` lines 1–9):
```typescript
import { createOllama } from "ollama-ai-provider-v2";
import { generateText } from "ai";

const ollama = createOllama({
  baseURL: "http://192.168.1.4:11434/api",
});
export const qwen3wen3_8b = ollama("qwen3:8b");
export const gemma3n = ollama("gemma3n:latest");
export const gemma3_270m = ollama("gemma3:270m");
```
Replace hardcoded `baseURL` with:
```typescript
baseURL: process.env.OLLAMA_BASE_URL ?? "http://192.168.1.4:11434/api",
```
The default IP `192.168.1.4` matches `llm.ts` (the index.ts IP `192.168.1.6` is a discrepancy — use the one from `llm.ts` as the modular default; `.env.example` will document both). Drop `main()` (lines 11–20) — dev harness only.

---

### `src/client/src/audio.ts` (utility, transform — Web Audio)

**Analog:** None in codebase. Use RESEARCH.md Pattern 4 (lines 334–360) as the source pattern.

**Core pattern** (RESEARCH.md lines 338–360):
```typescript
async function captureAndSendAudio(blob: Blob, ws: WebSocket) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const TARGET_RATE = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * TARGET_RATE),
    TARGET_RATE
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const resampled = await offlineCtx.startRendering();

  const pcm = resampled.getChannelData(0);
  ws.send(pcm.buffer); // ArrayBuffer of Float32 at 16kHz mono
  await audioCtx.close();
}
```
Export as named `captureAndSendAudio`. Also export a `playWavBuffer(arrayBuffer: ArrayBuffer): Promise<void>` for TTS playback (using AudioContext.decodeAudioData + AudioBufferSourceNode — see RESEARCH.md Code Examples lines 591–598).

---

### `src/client/src/ws.ts` (utility, event-driven)

**Analog:** `index.ts` lines 152–168 — the keypress state machine is the closest analog for the "event triggers state transition + async work" pattern. Direct WebSocket code has no analog.

**State machine shape** (`index.ts` lines 152–168):
```typescript
process.stdin.on("keypress", async (chunk, key) => {
  if (key && key.name === "space") {
    if (!isRecording) {
      startRecording();        // transition: idle → recording
    } else {
      await stopRecording();   // transition: recording → processing
      await processRecording(sttPipe, ttsPipe, speaker_embeddings);
    }
  }
});
```
Map this shape to browser WebSocket events: connect/disconnect replaces process lifecycle; `ws.onmessage` replaces the process audio callback; state transitions are identical (`idle → recording → processing → playing → idle`).

**WebSocket construction pattern** (RESEARCH.md Code Examples lines 583–599):
```typescript
ws.current = new WebSocket(url);
ws.current.binaryType = "arraybuffer";
ws.current.onmessage = async (e) => {
  if (typeof e.data === "string") {
    const msg = JSON.parse(e.data);
    if (msg.type === "processing") setState("processing");
    if (msg.type === "error") { setState("idle"); console.error(msg.message); }
  } else {
    // binary = WAV response → play it
    setState("playing");
    // ... AudioContext playback
    src.onended = () => setState("idle");
  }
};
```

---

### `src/client/src/ui.ts` (component, event-driven)

**Analog:** `index.ts` lines 152–168 (keypress PTT) and lines 47–80 (`startRecording`/`stopRecording` pair).

**Press-to-talk shape** (`index.ts` lines 47–60, 63–81):
```typescript
function startRecording(): void {
  if (isRecording) return;         // guard: only one recording at a time
  isRecording = true;
  currentWriteStream = fs.createWriteStream(outputPath);
  currentRecorder = new AudioRecorder(audioOptions, console);
  currentRecorder.start();
  currentRecorder.stream().pipe(currentWriteStream);
}

function stopRecording(): Promise<void> {
  return new Promise((resolve) => {
    if (!isRecording || !currentRecorder || !currentWriteStream) {
      resolve(); return;
    }
    isRecording = false;
    currentRecorder.stop();
    currentWriteStream.end();
    currentWriteStream.on("finish", () => resolve());
  });
}
```
The browser version replaces `AudioRecorder`/`WriteStream` with `MediaRecorder`/`Blob` chunks. The guard (`if (isRecording) return`), the async stop-with-callback pattern, and the clear state flag on stop are all copied. Event bindings become `button.addEventListener("mousedown", startRecording)` / `"mouseup"` / `"touchstart"` / `"touchend"`.

---

### `client/index.html` (config)

**Analog:** None. Standard Vite entry HTML. Minimal template:
```html
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Oasis</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

### `src/client/src/main.ts` (frontend-entry)

**Analog:** None. Standard Vite+React entry. Mounts React tree into `#root`. No special patterns to copy from the existing codebase.

---

### `.env.example` (config)

**Analog:** None. Derive variable names from `llm.ts` and `index.ts`.

Variables to document:
```bash
# Ollama LLM service (index.ts uses 192.168.1.6, llm.ts uses 192.168.1.4 — confirm which is current)
OLLAMA_BASE_URL=http://192.168.1.4:11434/api

# Server port
PORT=3001

# TTS model (tts.ts line 36 shows Xenova/mms-tts-eng; index.ts line 141 shows Xenova/speecht5_tts)
TTS_MODEL=Xenova/speecht5_tts
```

---

## Shared Patterns

### Async main() with .catch

**Source:** `index.ts` line 242
**Apply to:** `src/server/index.ts`
```typescript
main().catch(console.error);
```
Every server entry point follows this exact pattern. Do not use top-level await at the module root — wrap in named async function.

---

### Pipeline Initialization (two-stage: load then use)

**Source:** `index.ts` lines 134–141
**Apply to:** `src/server/pipeline.ts`, referenced by `src/server/routes/ws.ts`
```typescript
const sttPipe = await pipeline(
  "automatic-speech-recognition",
  "Xenova/whisper-tiny.en",
  { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
);
const ttsPipe = await pipeline("text-to-speech", "Xenova/speecht5_tts");
const speaker_embeddings =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";
```
These exact strings — model IDs, dtype options, speaker_embeddings URL — are the verified working values. Copy verbatim.

---

### STT Result Extraction

**Source:** `index.ts` lines 196–198
**Apply to:** `src/server/routes/ws.ts`
```typescript
const sttResult = await sttPipe(audioData, { chunk_length_s: 10 });
const userText = Array.isArray(sttResult)
  ? sttResult[0]?.text || ""
  : sttResult.text;
```
The ternary handles both `Array` and `object` return shapes from the Whisper pipeline. Copy verbatim — this guards against the pipeline returning either shape.

---

### LLM Call + Prompt Template

**Source:** `index.ts` lines 219–222
**Apply to:** `src/server/routes/ws.ts`
```typescript
const { text: llmResponse } = await generateText({
  model: gemma3n,
  prompt: `You are a helpful voice assistant. Keep responses concise and conversational and very short, one or two sentences. User said: "${userText}"`,
});
```
Import `gemma3n` from `src/server/llm.ts`. The prompt is the production-tested wording — copy verbatim.

---

### generateWav Utility

**Source:** `tts.ts` lines 10–13; also `index.ts` lines 104–108
**Apply to:** `src/server/tts.ts`, called from `src/server/routes/ws.ts`
```typescript
function generateWav(ttsOut: { sampling_rate: number; audio: Float32Array }) {
  const wav = new WaveFile();
  wav.fromScratch(1, ttsOut.sampling_rate, "32f", ttsOut.audio);
  return wav;
}
```
`tts.ts` uses a module-level `const channels = 1` (line 8); `index.ts` inlines `1`. Use inline `1` in the new server module for clarity. Add `wav.toBitDepth("16")` before returning (browser compatibility fix — no existing analog for this step).

---

### Error Handling (try/catch + console.error)

**Source:** `index.ts` lines 235–239
**Apply to:** `src/server/routes/ws.ts` (runPipeline function)
```typescript
  } catch (error) {
    console.error("Error processing audio:", error);
    // Send error back to client:
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "error", message: String(error) }));
    }
  }
```
The existing pattern uses `console.error` only (no client feedback). The new route must also send `{ type: "error" }` JSON back to the WebSocket client before returning. Always guard `ws.send` with `readyState === WebSocket.OPEN` (RESEARCH.md Pitfall 2).

---

### Guard Against Empty/Short STT Output

**Source:** `index.ts` lines 203–207
**Apply to:** `src/server/routes/ws.ts`
```typescript
if (!userText || userText.trim().length < 2) {
  // Return early — send a control message, not an error
  ws.send(JSON.stringify({ type: "error", message: "No clear input detected" }));
  return;
}
```

---

## No Analog Found

Files where no close codebase match exists — use RESEARCH.md patterns as primary source:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/client/src/audio.ts` | utility | transform (Web Audio) | No browser Web Audio API code in the codebase; server-only project currently |
| `src/client/src/main.ts` | frontend-entry | — | No frontend code exists at all; standard Vite+React boilerplate |
| `client/index.html` | config | — | No HTML in codebase |
| `.env.example` | config | — | No .env files exist; derive variable names from llm.ts and index.ts |

For `audio.ts` and `ws.ts` (browser-side WebSocket), use RESEARCH.md Code Examples section verbatim (lines 566–638).

---

## Key Observations for Planner

1. **The pipeline is fully implemented** — `stt.ts`, `tts.ts`, `llm.ts`, and `index.ts:processRecording()` are the reference implementation. Server files copy these with minimal transformation (remove file I/O → use in-memory buffers; add exports; remove `main()` harnesses).

2. **Two conflicting Ollama IPs** — `index.ts` line 14 uses `192.168.1.6`; `llm.ts` line 5 uses `192.168.1.4`. The planner must use `process.env.OLLAMA_BASE_URL` with a `.env.example` that documents both. Default to `192.168.1.4` (from the modular `llm.ts`).

3. **TTS model inconsistency** — `tts.ts` line 36 uses `Xenova/mms-tts-eng`; `index.ts` line 141 uses `Xenova/speecht5_tts`. The `speecht5_tts` path requires the speaker_embeddings URL; `mms-tts-eng` does not. Default to `Xenova/speecht5_tts` (matches `index.ts` which is the full working pipeline).

4. **Speaker import must be dropped** from the server `tts.ts` — `speaker` npm package requires native binaries and is server-local playback only. Browser clients use Web Audio API instead.

5. **No test infrastructure exists** — `package.json` scripts section has only the placeholder `"test": "echo \"Error: no test specified\" && exit 1"`. Wave 0 must install vitest and create test scaffolding before any test-reliant tasks run.

6. **No tsconfig.json exists** — the project runs via `tsx` directly. The planner must create `tsconfig.json` (base), `tsconfig.server.json`, and `tsconfig.client.json` as Wave 0 tasks.

---

## Metadata

**Analog search scope:** `/home/eric/Downloads/Projects/oasis/` root (all `.ts` files — 5 source files total)
**Files scanned:** 6 (`index.ts`, `stt.ts`, `tts.ts`, `llm.ts`, `mic.ts`, `kokoro.ts`)
**Pattern extraction date:** 2026-05-13
