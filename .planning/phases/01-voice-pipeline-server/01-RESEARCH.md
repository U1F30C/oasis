# Phase 1: Voice Pipeline Server + Walkie-Talkie Frontend - Research

**Researched:** 2026-05-13
**Domain:** Node.js WebSocket server, browser MediaRecorder, @huggingface/transformers, Vite, Express
**Confidence:** HIGH

---

## Summary

This phase transforms the existing monolithic CLI (index.ts) into a client-server voice assistant. The backend is a Node.js HTTP server (Express) with a WebSocket endpoint (ws library) that runs the full STT → LLM → TTS pipeline using the existing utility modules. A Vite frontend provides the press-to-talk walkie-talkie UI using the browser's MediaRecorder API and Web Audio API.

The single most important technical insight is the **audio format mismatch**: browsers record in `audio/webm;codecs=opus` (Chrome) or `audio/ogg;codecs=opus` (Firefox) at 48kHz stereo — never directly in 16kHz mono WAV that Whisper expects. The correct resolution is a **client-side decode-and-resample** step using `AudioContext.decodeAudioData()` and `OfflineAudioContext`, producing a raw PCM `Float32Array` at 16kHz/mono which is sent as binary WebSocket frames. This avoids any server-side FFmpeg dependency.

The `@huggingface/transformers` pipeline initialization is expensive (~5–15 seconds first call, model download on first ever run). It MUST be a singleton, initialized at server startup — not per-request. The official Transformers.js docs show exactly this pattern.

**Primary recommendation:** Express HTTP server + `ws` WebSocket (noServer mode, sharing the same HTTP server), `vite` dev proxy for dev, client-side PCM resampling before sending audio, singleton pipeline initialization at boot.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | STT → LLM → TTS pipeline server using existing stt.ts, tts.ts, llm.ts | Singleton pipeline pattern verified; existing readAudio/generateWav APIs confirmed compatible |
| REQ-02 | WebSocket-based audio streaming for IoT and browser clients | ws library v8.20.1 confirmed; binary Buffer/Float32Array send verified |
| REQ-03 | Platform-agnostic client protocol (browser, IoT, mobile, CLI) | ws protocol is standard; same endpoint works from any WebSocket client |
| REQ-04 | Vite.js frontend (React or vanilla) | Vite v8.0.13 confirmed; @vitejs/plugin-react v6.0.2 confirmed |
| REQ-05 | Press-to-talk UI: hold to record, release to send, show pipeline state | MediaRecorder + mousedown/mouseup/touchstart/touchend pattern |
| REQ-06 | Browser-native audio capture — no native binaries on client | MediaRecorder API + Web Audio API; no install required |
| REQ-07 | Automatic TTS audio playback after processing | AudioContext.decodeAudioData() or Audio element with Blob URL |
| REQ-08 | IoT device compatibility — constrained device, stream audio over WS | arecord/sox → raw PCM bytes over ws; server handles all ML |
| REQ-09 | Separate modules/routes for STT, LLM, TTS stages | Express router pattern + ws message type dispatch |
| REQ-10 | Reuse utility code from stt.ts, tts.ts, mic.ts, index.ts | Confirmed: readAudio() and generateWav() functions are directly portable |
| REQ-11 | TypeScript throughout (frontend and backend) | tsx for server runtime; vite+tsc for frontend |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audio capture (browser) | Browser / Client | — | MediaRecorder + getUserMedia are browser-only APIs |
| PCM resampling (browser path) | Browser / Client | — | OfflineAudioContext resamples to 16kHz before send; avoids server FFmpeg |
| Audio capture (IoT) | IoT device | — | arecord/sox piped to WebSocket client on device |
| WebSocket transport | API / Backend | — | ws library on Node.js HTTP server |
| STT inference | API / Backend | — | @huggingface/transformers Whisper pipeline; requires Node.js ONNX runtime |
| LLM inference | API / Backend | — | Ollama remote API via ai SDK; network call to 192.168.1.6 |
| TTS inference | API / Backend | — | @huggingface/transformers SpeechT5 or MMS pipeline; requires Node.js ONNX runtime |
| Audio playback (browser) | Browser / Client | — | AudioContext.decodeAudioData() + play, or HTMLAudioElement with Blob URL |
| Pipeline state UI | Browser / Client | — | React/vanilla state machine: idle / recording / processing / playing |
| Dev proxy (WebSocket + HTTP) | Frontend Server (Vite) | — | vite server.proxy with ws:true forwards /ws and /api to Express in dev |
| Shared TypeScript types | Shared (src/shared/) | — | Single source of truth for WsMessage types imported by both server and client |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP server, REST routes | Industry standard; existing ecosystem |
| ws | 8.20.1 | WebSocket server on Node.js | Fastest, most tested WS library for Node; no framework lock-in |
| vite | 8.0.13 | Frontend dev server + build | Official recommendation from REQUIREMENTS.md; HMR, proxy built-in |
| @vitejs/plugin-react | 6.0.2 | React JSX transform for Vite | Standard React+Vite pairing |
| react + react-dom | 19.2.6 | Frontend UI | Already implied by @vitejs/plugin-react; simple enough for this UI |
| tsx | 4.22.0 | TypeScript execution for server dev | Zero-config TS runner; no tsc build step in dev |
| typescript | (installed) | Type safety throughout | REQ-11 mandates TS |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @huggingface/transformers | 4.2.0 | STT and TTS ONNX pipelines | Already installed; powers Whisper + SpeechT5/MMS |
| wavefile | 11.0.0 | WAV encoding/decoding, resampling | Already installed; required by readAudio() and generateWav() |
| ollama-ai-provider-v2 | 3.5.1 | Ollama API provider for ai SDK | Already installed |
| ai | 5.0.22 | LLM abstraction (generateText) | Already installed |
| @types/express | 5.2.1 | TypeScript types for Express | Dev dependency |
| @types/ws | 8.18.1 | TypeScript types for ws | Dev dependency |
| concurrently | 9.2.1 | Run server + vite in parallel in dev | Standard for monorepo dev scripts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws (bare) | socket.io | socket.io adds fallback polling, rooms, namespaces — unnecessary complexity for this IoT-compatible protocol |
| ws (bare) | express-ws | express-ws is a thin wrapper; adds little value and hides the upgrade event pattern needed for noServer control |
| React | Vanilla JS | React is marginal overhead for this UI but gives clean state machine with useState; vanilla is also viable |
| client-side PCM resample | server-side ffmpeg | Server FFmpeg avoids client complexity but adds a binary dependency and slower pipeline; client-side is preferred |
| tsx (dev) | ts-node | tsx is faster, ESM-compatible, no tsconfig.json tweaks needed |

**Installation (new packages needed):**
```bash
npm install express ws
npm install --save-dev @types/express @types/ws @types/node concurrently vite @vitejs/plugin-react
```

**Version verification:** [VERIFIED: npm registry — 2026-05-13]
- `ws@8.20.1` (published current)
- `express@5.2.1` (published current)
- `vite@8.0.13` (published current)
- `@vitejs/plugin-react@6.0.2` (published current)
- `concurrently@9.2.1` (published current)
- `tsx@4.22.0` (published current)
- `react@19.2.6` (published current)

---

## Architecture Patterns

### System Architecture Diagram

```
BROWSER CLIENT                         NODE.JS SERVER                    EXTERNAL
─────────────────────────────────      ────────────────────────────────  ──────────
getUserMedia()                         Express HTTP server (port 3001)
    │                                       │
    ▼                                       ├── GET /health  ──────────► 200 OK
MediaRecorder (webm/opus)                  │
    │                                       └── WS upgrade on /ws
    ▼                                            │
AudioContext.decodeAudioData()                   │◄──── WS connect ──────┤
    │                                            │                       │
OfflineAudioContext resample→16kHz              │◄──── binary: PCM ─────┤ (browser sends Float32Array bytes)
    │                                            │                       │
Float32Array → ArrayBuffer                       │                       │
    │                                            │
    ├── ws.send(binary) ─────────────────────►  │
    │                                            │
    │                              wavefile: Buffer → WaveFile
    │                              toBitDepth("32f") + toSampleRate(16000)
    │                                            │
    │                                            ▼
    │                              STT Pipeline (Whisper singleton)
    │                                  sttPipe(audioData)
    │                                            │ text
    │                                            ▼
    │                              LLM (Ollama remote — 192.168.1.6:11434)
    │                                  generateText(prompt + userText)
    │                                            │ llmText
    │                                            ▼
    │                              TTS Pipeline (SpeechT5/MMS singleton)
    │                                  ttsPipe(llmText)
    │                                            │ Float32Array audio
    │                                            ▼
    │                              wavefile: generateWav() → WaveFile.toBuffer()
    │                                            │
    │◄── ws.send(binary: WAV bytes) ────────────┤
    │
AudioContext.decodeAudioData(wavBuffer)
    │
AudioBufferSourceNode.start()  ──► Speaker (plays TTS response)

VITE DEV SERVER (port 5173, dev only)
    ├── proxy /ws → ws://localhost:3001/ws
    └── proxy /api → http://localhost:3001/api


IoT DEVICE (Raspberry Pi)
─────────────────────────
arecord -f S16_LE -r 16000 -c 1 | node iot-client.js
    │
    ├── Read PCM chunks from stdin
    ├── Accumulate while PTT held
    ├── WebSocket.send(buffer) on release
    └── Receive WAV bytes → aplay
```

### Recommended Project Structure

```
oasis/
├── src/
│   ├── server/
│   │   ├── index.ts          # Express + ws server entry point
│   │   ├── pipeline.ts       # Singleton pipeline init (STT + TTS)
│   │   ├── routes/
│   │   │   ├── health.ts     # GET /health
│   │   │   └── ws.ts         # WebSocket handler (STT→LLM→TTS dispatch)
│   │   ├── stt.ts            # Migrated from root stt.ts
│   │   ├── tts.ts            # Migrated from root tts.ts
│   │   └── llm.ts            # Migrated from root llm.ts
│   ├── client/
│   │   ├── index.html
│   │   ├── main.tsx          # React entry
│   │   ├── App.tsx           # Walkie-talkie UI, state machine
│   │   ├── hooks/
│   │   │   └── useVoiceWS.ts # MediaRecorder + WebSocket logic
│   │   └── vite.config.ts    # Proxy /ws and /api to server
│   └── shared/
│       └── protocol.ts       # WsMessage types shared by server and client
├── package.json              # Single package.json (not a pnpm monorepo)
├── tsconfig.json             # Base TS config
├── tsconfig.server.json      # extends base, target node22
└── tsconfig.client.json      # extends base, target esnext/dom
```

### Pattern 1: Singleton Pipeline Initialization

**What:** Initialize STT and TTS pipelines once at server startup; reuse across all WebSocket connections.
**When to use:** Any server that uses @huggingface/transformers — cold start is 5–15s; per-request init would timeout.

```typescript
// Source: https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/tutorials/next.md
// src/server/pipeline.ts

import { pipeline } from "@huggingface/transformers";

interface PipelineInstances {
  stt: Awaited<ReturnType<typeof pipeline>> | null;
  tts: Awaited<ReturnType<typeof pipeline>> | null;
}

const instances: PipelineInstances = { stt: null, tts: null };

export async function initPipelines(): Promise<void> {
  console.log("Loading STT pipeline (Whisper)...");
  instances.stt = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
    { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } }
  );

  console.log("Loading TTS pipeline...");
  instances.tts = await pipeline("text-to-speech", "Xenova/speecht5_tts");

  console.log("Pipelines ready.");
}

export function getSttPipeline() {
  if (!instances.stt) throw new Error("STT pipeline not initialized");
  return instances.stt;
}

export function getTtsPipeline() {
  if (!instances.tts) throw new Error("TTS pipeline not initialized");
  return instances.tts;
}
```

### Pattern 2: Express + ws (noServer mode, shared HTTP server)

**What:** Attach a ws WebSocketServer to the same HTTP server that Express uses, using noServer mode and the `upgrade` event.
**When to use:** Any Node.js app that needs both REST endpoints and WebSocket on the same port.

```typescript
// Source: https://github.com/websockets/ws/blob/master/README.md (noServer mode pattern)
// src/server/index.ts

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { initPipelines } from "./pipeline.js";
import { handleConnection } from "./routes/ws.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.get("/health", (_req, res) => res.json({ ok: true }));

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url!, `http://${request.headers.host}`);
  if (url.pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", handleConnection);

async function main() {
  await initPipelines(); // Block until pipelines ready
  server.listen(3001, () => console.log("Server listening on :3001"));
}

main().catch(console.error);
```

### Pattern 3: Binary WebSocket Message Protocol

**What:** A simple framed protocol: text JSON for control messages, binary for audio data.
**When to use:** Any WebSocket server mixing audio bytes with control signals.

```typescript
// Source: Context7 /websockets/ws — binary data handling
// src/shared/protocol.ts

export type ControlMessage =
  | { type: "ready" }                        // server → client: pipelines loaded
  | { type: "processing" }                   // server → client: pipeline started
  | { type: "error"; message: string }       // server → client: error
  | { type: "ping" };                        // client → server: keepalive

// Binary frames: client → server = raw PCM Float32Array bytes (16kHz mono)
// Binary frames: server → client = WAV file bytes

// ws route handler (server side)
// src/server/routes/ws.ts
export function handleConnection(ws: WebSocket) {
  ws.send(JSON.stringify({ type: "ready" }));

  ws.on("message", async (data, isBinary) => {
    if (!isBinary) {
      // JSON control message
      const msg = JSON.parse(data.toString());
      if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    // Binary = audio payload
    ws.send(JSON.stringify({ type: "processing" }));
    try {
      const wavBytes = await runPipeline(data as Buffer);
      ws.send(wavBytes); // binary WAV back to client
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: String(e) }));
    }
  });
}
```

### Pattern 4: Client-Side Audio Capture and PCM Resampling

**What:** Record audio via MediaRecorder, decode with AudioContext, resample to 16kHz mono using OfflineAudioContext, send raw PCM bytes.
**When to use:** Browser client sending audio to Whisper STT — WAV native recording is not reliably supported across Chrome/Firefox; client-side resampling eliminates server FFmpeg dependency.

```typescript
// Source: MDN Web Audio API + verified research pattern
// src/client/hooks/useVoiceWS.ts

async function captureAndSendAudio(blob: Blob, ws: WebSocket) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  // Resample to 16kHz mono
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

  // Get Float32Array and send as binary
  const pcm = resampled.getChannelData(0);
  ws.send(pcm.buffer); // sends underlying ArrayBuffer
  await audioCtx.close();
}
```

### Pattern 5: Server-Side Buffer → STT Input

**What:** Convert the incoming WebSocket Buffer (raw PCM Float32Array bytes) into the format readAudio() would produce, feeding it directly to the STT pipeline.
**When to use:** Server receives pre-resampled 16kHz mono PCM from browser client.

```typescript
// Source: https://huggingface.co/docs/transformers.js/en/guides/node-audio-processing
// (verified pattern — existing readAudio() does the same for .wav files)
// src/server/routes/ws.ts

async function runPipeline(data: Buffer): Promise<Buffer> {
  // Browser sends raw Float32Array bytes (pre-resampled to 16kHz mono)
  const audioData = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);

  // STT
  const sttPipe = getSttPipeline();
  const sttResult = await sttPipe(audioData, { chunk_length_s: 10 });
  const userText = Array.isArray(sttResult) ? sttResult[0]?.text : sttResult.text;

  // LLM
  const { text: llmResponse } = await generateText({
    model: gemma3n,
    prompt: `You are a helpful voice assistant. Keep responses concise and short. User said: "${userText}"`,
  });

  // TTS
  const ttsPipe = getTtsPipeline();
  const SPEAKER_EMBEDDINGS = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";
  const ttsOut = await ttsPipe(llmResponse, { speaker_embeddings: SPEAKER_EMBEDDINGS });

  // Encode as WAV
  const wav = generateWav(ttsOut);
  return wav.toBuffer() as Buffer;
}
```

### Pattern 6: Vite Proxy Configuration (dev only)

**What:** Vite dev server proxies `/ws` and `/api` to the Express backend during development.
**When to use:** Dev environment only — in production, serve the Vite build from Express static middleware.

```typescript
// Source: https://vite.dev/config/server-options (verified)
// src/client/vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
});
```

### Pattern 7: IoT Client (Raspberry Pi / Linux)

**What:** Spawn `arecord` as a child process, buffer PCM during PTT hold, send over WebSocket on release.
**When to use:** Any Linux IoT device with ALSA audio support.

```bash
# arecord command for 16kHz mono 16-bit PCM (WAV container)
arecord -f S16_LE -r 16000 -c 1 -t wav recording.wav
# Or pipe raw PCM to stdout for streaming:
arecord -f S16_LE -r 16000 -c 1 -t raw -
```

```typescript
// IoT client: buffer raw PCM, convert to Float32Array, send over WebSocket
// Note: server must handle both browser PCM (Float32Array bytes) and IoT PCM (Int16 bytes)
// Simplest approach: IoT sends a complete WAV file (with header); server uses wavefile to decode
```

**IoT protocol note:** For IoT devices, the simplest path is to record to a WAV file (arecord -t wav), send the entire WAV buffer over WebSocket as binary. Server receives WAV bytes, constructs WaveFile, calls `readAudio()` exactly as in index.ts. This avoids the IoT device needing to know about Float32Array encoding.

### Anti-Patterns to Avoid

- **Per-request pipeline init:** Creating a new `pipeline()` per WebSocket message adds 5–15s latency and may exhaust memory. Always initialize once at server startup.
- **Server-side FFmpeg for browser audio decode:** Requires ffmpeg binary, adds process spawning overhead. Use client-side OfflineAudioContext resampling instead.
- **Assuming audio/wav from MediaRecorder:** Chrome produces `audio/webm;codecs=opus`, Firefox produces `audio/ogg;codecs=opus`. Never pass MediaRecorder Blob directly to STT — always decode first.
- **Sending audio as base64 JSON:** Inflates payload by ~33%. Use binary WebSocket frames for audio; JSON only for control messages.
- **Blocking the event loop during pipeline inference:** @huggingface/transformers uses ONNX Runtime which is synchronous/blocking. For a single-user server this is acceptable. For multi-user, run pipelines in a worker thread.
- **Concatenating MediaRecorder chunks with timeslice for WAV:** WAV is not designed for streaming; each dataavailable chunk is a separate self-contained file. For press-to-talk, collect all chunks into one Blob via `stop()`, then decode.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket server | Custom HTTP upgrade parser | `ws` library | RFC 6455 compliance, masking, fragmentation, ping/pong, error handling |
| WAV encoding/decoding | Manual byte manipulation | `wavefile` (already installed) | Handles bit depth conversion, sample rate, multi-channel merge |
| Audio resampling (server) | Custom sample rate converter | `wavefile.toSampleRate()` (already installed) | Correct linear interpolation; already used in readAudio() |
| Audio resampling (browser) | Custom interpolation | `OfflineAudioContext` (Web Audio API) | Browser-native, accurate, no library needed |
| TypeScript runner | Compile + run loop | `tsx` (already available) | Instant TS execution for dev |
| LLM abstraction | Direct Ollama HTTP calls | `ai` SDK + `ollama-ai-provider-v2` (already installed) | Model-agnostic, consistent API |

**Key insight:** The existing utilities (stt.ts, tts.ts, llm.ts) already encapsulate the hard parts correctly. The primary work is plumbing them behind a WebSocket endpoint and writing the browser client.

---

## Common Pitfalls

### Pitfall 1: Pipeline Race Condition on Concurrent Requests

**What goes wrong:** Two WebSocket connections send audio simultaneously; both await the singleton pipeline; they interleave and corrupt output or queue unexpectedly.
**Why it happens:** @huggingface/transformers pipelines are not designed for concurrent invocations on the same instance.
**How to avoid:** Queue pipeline requests with a simple async mutex or process one connection at a time with a "busy" flag. For v1 (single user), reject or queue incoming audio if pipeline is running.
**Warning signs:** Garbled TTS output, partial STT transcriptions, or "Cannot read properties of undefined" errors from ONNX runtime.

### Pitfall 2: WebSocket Connection Lost Before Pipeline Completes

**What goes wrong:** Pipeline runs 3–10 seconds; client navigates away or disconnects; server tries to `ws.send()` to a closed socket.
**Why it happens:** `ws.readyState` is `CLOSED` but the pipeline already started.
**How to avoid:** Check `ws.readyState === WebSocket.OPEN` before every `ws.send()`. Handle `ws.on('close', ...)` to set a cancellation flag.
**Warning signs:** `Error: WebSocket is not open: readyState 3` in server logs.

### Pitfall 3: Vite HMR WebSocket Conflict with App WebSocket

**What goes wrong:** Vite's own HMR uses WebSocket on the dev server; proxying `/ws` to the backend can interfere.
**Why it happens:** Both Vite HMR and the app use WebSocket; proxy rules may catch Vite's internal upgrade requests.
**How to avoid:** Use a distinct path for the app WebSocket (e.g., `/ws` or `/voice`). Vite's HMR path is `/__vite_hmr` by default — ensure the proxy rule only matches the app path.
**Warning signs:** HMR stops working, or Vite console shows WebSocket connection errors to wrong target.

### Pitfall 4: Ollama Remote Host Hardcoded IP

**What goes wrong:** `baseURL: "http://192.168.1.6:11434/api"` is hardcoded in llm.ts (192.168.1.4 in llm.ts, 192.168.1.6 in index.ts — two different IPs exist in the codebase).
**Why it happens:** Multiple versions of the code use different local IPs.
**How to avoid:** Move Ollama baseURL to environment variable `OLLAMA_BASE_URL`. Provide `.env.example`.
**Warning signs:** LLM calls fail with ECONNREFUSED on a different machine/network.

### Pitfall 5: Audio Playback Format Mismatch

**What goes wrong:** Server sends WAV with 32-bit float samples at the TTS model's native sample rate (16kHz for SpeechT5, 24kHz for MMS). Browser `decodeAudioData()` may not support 32-bit float WAV in all browsers.
**Why it happens:** `generateWav()` creates `"32f"` bit depth WAV. Browser support for 32-bit float PCM WAV in `decodeAudioData` is inconsistent.
**How to avoid:** Before sending, convert WAV to 16-bit signed integer (`wav.toBitDepth("16")`) — universally supported. Or send the raw Float32Array and let the client construct an AudioBuffer directly.
**Warning signs:** `decodeAudioData` throws `EncodingError` or produces silence in browser.

### Pitfall 6: Large Binary WebSocket Messages and Node.js Memory

**What goes wrong:** Long recordings produce large Float32Array buffers that stall the WebSocket receive buffer.
**Why it happens:** `ws` default `maxPayload` is 100MB; this is fine, but large messages are buffered entirely before the `message` event fires.
**How to avoid:** For press-to-talk v1, this is acceptable. Enforce a reasonable max recording time on the client (e.g., 30 seconds = ~1.9MB at 16kHz Float32). Add server-side `maxPayload` limit.
**Warning signs:** Server memory spikes on long recordings; `RangeError: Invalid array length`.

---

## Code Examples

### Server Entry Point (complete minimal version)

```typescript
// Source: ws README (noServer) + Express docs + verified pattern
// src/server/index.ts

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { initPipelines } from "./pipeline.js";
import { createWsHandler } from "./routes/ws.js";

async function main() {
  const app = express();
  const server = createServer(app);

  console.log("Initializing ML pipelines...");
  await initPipelines();
  console.log("Pipelines ready. Starting server.");

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", createWsHandler());

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url!, `http://${req.headers.host}`);
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  app.get("/health", (_req, res) => res.json({ status: "ok", pipelines: "ready" }));

  server.listen(3001, () => console.log("Oasis server: http://localhost:3001"));
}

main().catch(console.error);
```

### Walkie-Talkie React Hook (browser)

```typescript
// Source: MDN MediaRecorder + Web Audio API
// src/client/hooks/useVoiceWS.ts

import { useRef, useState, useCallback } from "react";

type PipelineState = "idle" | "recording" | "processing" | "playing";

export function useVoiceWS(url: string) {
  const ws = useRef<WebSocket | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [state, setState] = useState<PipelineState>("idle");

  const connect = useCallback(() => {
    ws.current = new WebSocket(url);
    ws.current.binaryType = "arraybuffer";
    ws.current.onmessage = async (e) => {
      if (typeof e.data === "string") {
        const msg = JSON.parse(e.data);
        if (msg.type === "processing") setState("processing");
        if (msg.type === "error") { setState("idle"); console.error(msg.message); }
      } else {
        // Binary = WAV response
        setState("playing");
        const audioCtx = new AudioContext();
        const buffer = await audioCtx.decodeAudioData(e.data);
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(audioCtx.destination);
        src.onended = () => { setState("idle"); audioCtx.close(); };
        src.start();
      }
    };
  }, [url]);

  const startRecording = useCallback(async () => {
    if (state !== "idle") return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    recorder.current = new MediaRecorder(stream);
    recorder.current.ondataavailable = (e) => chunks.current.push(e.data);
    recorder.current.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks.current, { type: recorder.current!.mimeType });
      await captureAndSendAudio(blob, ws.current!);
    };
    recorder.current.start();
    setState("recording");
  }, [state]);

  const stopRecording = useCallback(() => {
    recorder.current?.stop();
  }, []);

  return { state, connect, startRecording, stopRecording };
}

async function captureAndSendAudio(blob: Blob, ws: WebSocket) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const TARGET_RATE = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * TARGET_RATE), TARGET_RATE);
  const src = offlineCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offlineCtx.destination);
  src.start();
  const resampled = await offlineCtx.startRendering();
  const pcm = resampled.getChannelData(0);
  ws.send(pcm.buffer);
  await audioCtx.close();
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node for server execution | tsx (faster, ESM-native) | 2022–2023 | No tsconfig.json hacks needed; ~3x faster startup |
| express v4 | express v5 (stable) | 2024 | Async error handling built in; no need for express-async-errors |
| socket.io for real-time | ws (bare) for simple binary | Ongoing | socket.io overhead unnecessary when protocol is custom binary |
| server-side ffmpeg for audio decode | client-side OfflineAudioContext | Modern Web Audio API | Eliminates server binary dependency |
| Xenova namespace (Transformers.js v2) | Xenova still valid for whisper-tiny.en in v3/v4 | @huggingface/transformers v3+ | Xenova models still work; new onnx-community namespace also available |

**Deprecated/outdated:**
- `@xenova/transformers`: Superseded by `@huggingface/transformers` (the same package, renamed). The project already uses `@huggingface/transformers`. [VERIFIED: npm registry]
- `node-microphone` / `node-audiorecorder`: Server-side mic capture is optional for this phase — browser handles capture via MediaRecorder; these packages are IoT/server-local capture only.
- `speaker` package: Server-side audio playback not needed for this phase (browser does playback via Web Audio API). Can be removed from server path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ollama is running at either 192.168.1.6:11434 or 192.168.1.4:11434 (two different IPs in codebase) | Architecture, Code Examples | LLM calls will fail; server needs OLLAMA_BASE_URL env var |
| A2 | `Xenova/speecht5_tts` speaker_embeddings URL is still publicly accessible on HuggingFace | Pattern 5 (TTS) | TTS pipeline will fail on first run if URL is down; may need to cache locally |
| A3 | Server is single-user (no concurrency requirement in v1) | Pitfall 1 | If multi-user is needed, a request queue or worker threads are required |
| A4 | 32-bit float WAV is supported by browser `decodeAudioData` for TTS playback | Pitfall 5 | May need to convert to 16-bit before sending; test in Chrome + Firefox |
| A5 | React is preferred over vanilla JS for the frontend | Standard Stack | Either works; low risk since UI is simple |

---

## Open Questions

1. **Ollama IP discrepancy**
   - What we know: `index.ts` uses `192.168.1.6:11434`, `llm.ts` uses `192.168.1.4:11434` — two different IPs
   - What's unclear: Which is current? Is Ollama on a fixed host?
   - Recommendation: Use `process.env.OLLAMA_BASE_URL` with a `.env` file; default to one of the IPs for local dev

2. **TTS model choice**
   - What we know: `index.ts` uses `Xenova/speecht5_tts`; `tts.ts` uses `Xenova/mms-tts-eng`; `kokoro.ts` shows `onnx-community/Kokoro-82M-ONNX` via `kokoro-js`
   - What's unclear: Which TTS produces the best quality/latency for this use case?
   - Recommendation: Default to `Xenova/speecht5_tts` (matches index.ts); make model configurable via env var

3. **32-bit float WAV browser playback**
   - What we know: `generateWav()` creates 32f WAV; browser `decodeAudioData` behavior with 32f is inconsistent
   - What's unclear: Does Chrome/Firefox accept 32f WAV from `decodeAudioData`?
   - Recommendation: Convert to 16-bit integer WAV on server before send (`wav.toBitDepth("16")`) to be safe

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | ✓ | v22.15.0 | — |
| tsx | Server dev runner | ✓ | 4.22.0 | ts-node |
| tsc | TypeScript compilation | ✓ | (via tsconfig) | — |
| Ollama | LLM inference | ASSUMED (remote) | unknown | Configure OLLAMA_BASE_URL |
| arecord (ALSA) | IoT audio capture | UNKNOWN | — | sox (cross-platform) |
| Browser (Chrome/Firefox) | Frontend testing | ✓ (dev machine) | — | — |

**Missing dependencies with no fallback:**
- Ollama service at configured IP — must be running for LLM stage to function

**Missing dependencies with fallback:**
- arecord: IoT client can use sox as alternative; the IoT client is a separate concern from the main server

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must install |
| Config file | None — see Wave 0 |
| Quick run command | `npm test` (after setup) |
| Full suite command | `npm test` (after setup) |

**Recommended framework:** Vitest (co-located with Vite stack; ESM-native; works with tsx imports)

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | Pipeline executes STT→LLM→TTS end-to-end with a WAV file input | integration | `vitest run tests/pipeline.test.ts` | ❌ Wave 0 |
| REQ-02 | WebSocket server accepts binary audio and returns binary WAV | integration | `vitest run tests/ws-server.test.ts` | ❌ Wave 0 |
| REQ-03 | Protocol handles both WAV-file binary (IoT) and Float32Array binary (browser) inputs | unit | `vitest run tests/protocol.test.ts` | ❌ Wave 0 |
| REQ-04 | Vite config is valid and builds frontend | smoke | `vite build --outDir dist-test` | ❌ Wave 0 |
| REQ-05 | Press-to-talk state machine transitions: idle→recording→processing→playing→idle | unit | `vitest run tests/state-machine.test.ts` | ❌ Wave 0 |
| REQ-06 | Browser capture hook returns PCM Float32Array in valid range | manual-only | User must test in browser | N/A |
| REQ-07 | Server returns valid WAV that browser can decode | integration | `vitest run tests/ws-server.test.ts` | ❌ Wave 0 |
| REQ-08 | IoT path: WAV Buffer input → full pipeline → WAV Buffer output | integration | `vitest run tests/pipeline.test.ts` | ❌ Wave 0 |
| REQ-09 | STT, LLM, TTS modules export functions independently callable | unit | `vitest run tests/modules.test.ts` | ❌ Wave 0 |
| REQ-10 | readAudio() and generateWav() functions are importable from server/stt.ts and server/tts.ts | unit | `vitest run tests/modules.test.ts` | ❌ Wave 0 |
| REQ-11 | TypeScript compilation succeeds for both server and client | smoke | `tsc --project tsconfig.server.json --noEmit && tsc --project tsconfig.client.json --noEmit` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run typecheck` (tsc --noEmit)
- **Per wave merge:** `vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest` and `@vitest/coverage-v8` not installed
- [ ] `tests/pipeline.test.ts` — covers REQ-01, REQ-07, REQ-08
- [ ] `tests/ws-server.test.ts` — covers REQ-02, REQ-07
- [ ] `tests/protocol.test.ts` — covers REQ-03
- [ ] `tests/modules.test.ts` — covers REQ-09, REQ-10
- [ ] `tests/state-machine.test.ts` — covers REQ-05
- [ ] `tsconfig.server.json` and `tsconfig.client.json` — covers REQ-11
- [ ] `vitest.config.ts` — shared test config

---

## Security Domain

Security enforcement is enabled (ASVS Level 1). This is a local LAN voice assistant with no authentication requirement in v1.0 scope.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (out of scope per REQUIREMENTS.md) | — |
| V3 Session Management | No | — |
| V4 Access Control | Low — bind server to localhost/LAN only | `server.listen(3001, '0.0.0.0')` is fine for LAN; avoid exposing to internet |
| V5 Input Validation | Yes — audio payload size limit | Enforce `maxPayload` on ws WebSocketServer; reject oversized messages |
| V6 Cryptography | No — no secrets stored | — |

### Known Threat Patterns for WebSocket + Express

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized audio payload (DoS) | Denial of Service | `new WebSocketServer({ maxPayload: 10 * 1024 * 1024 })` — 10MB limit |
| Prompt injection via STT output | Tampering | LLM prompt wraps user text in quotes; do not execute STT output as code |
| CORS on REST endpoints | Spoofing | Add `cors()` middleware scoped to known origins; for LAN use, `origin: true` is acceptable |
| Unbounded pipeline concurrency | Denial of Service | Single-user v1: reject new audio if pipeline is busy; return `{ type: "error", message: "busy" }` |

---

## Sources

### Primary (HIGH confidence)

- Context7 `/websockets/ws` — binary data types, noServer mode, handleUpgrade pattern
- Context7 `/huggingface/transformers.js` — singleton pipeline pattern, Float32Array audio input, node audio processing guide
- Context7 `/websites/vite_dev` — server.proxy configuration with `ws: true`, middlewareMode
- `npm view` (2026-05-13) — all package versions verified live against npm registry

### Secondary (MEDIUM confidence)

- [Vite server proxy docs](https://vite.dev/config/server-options) — WebSocket proxy configuration
- [HuggingFace node-audio-processing guide](https://huggingface.co/docs/transformers.js/en/guides/node-audio-processing) — wavefile + Float32Array pipeline input pattern
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — MIME type behavior per browser
- [Chrome for Developers: MediaRecorder](https://developer.chrome.com/blog/mediarecorder) — WAV streaming limitations

### Tertiary (LOW confidence)

- WebSearch results on IoT audio streaming patterns (arecord → WebSocket) — multiple community sources consistent; no single official reference
- WebSearch results on `express-ws` vs bare `ws` tradeoffs — community consensus consistent with ws README

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-05-13
- Architecture: HIGH — ws noServer + Express pattern verified in Context7; client-side resampling verified via MDN + HuggingFace docs
- Pitfalls: HIGH — audio format pitfall (MediaRecorder webm vs WAV) is documented in multiple official sources; pipeline singleton is canonical Transformers.js pattern
- IoT path: MEDIUM — arecord/sox pattern verified from multiple community sources; no official HuggingFace IoT guide

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable stack; Vite/ws/express don't change rapidly)
