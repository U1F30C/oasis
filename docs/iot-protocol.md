# Oasis IoT Protocol

This document describes how to connect a constrained IoT device (Raspberry Pi, embedded Linux,
microcontroller) to the Oasis voice pipeline server. The server handles all ML computation
(STT, LLM, TTS) — the IoT device only needs to stream audio and receive audio back.

## Requirements on the IoT Device

- Network access to the Oasis server
- A WebSocket client library (e.g., `ws` for Node.js, `websocket-client` for Python)
- Audio capture capability (e.g., ALSA `arecord` on Linux)
- Audio playback capability (e.g., ALSA `aplay` on Linux)

No ML libraries, ONNX runtime, or GPU required on the device.

## WebSocket Endpoint

```
ws://<SERVER_IP>:<PORT>/ws
```

Default: `ws://192.168.1.X:3001/ws`

Set `PORT` in the server's `.env` file (default: 3001).

## Connection Handshake

1. Client connects to `ws://SERVER_IP:3001/ws`
2. Server sends JSON: `{ "type": "ready" }` — pipelines are loaded and the server is ready
3. Client may now send audio

If the server is busy processing audio for another client, it returns:
`{ "type": "error", "message": "busy" }`

## Sending Audio

Send a single binary WebSocket frame containing the full audio recording.

### Format: Float32Array PCM (preferred — browser-compatible path)

| Property | Value |
|----------|-------|
| Encoding | IEEE 754 32-bit float (little-endian) |
| Sample rate | 16000 Hz |
| Channels | 1 (mono) |
| Container | None — raw PCM bytes only |

This is identical to what the browser client sends (after OfflineAudioContext resampling).

**Raspberry Pi recording command (raw PCM):**

```bash
# Record 5 seconds of 16kHz mono raw PCM to a file
arecord -f FLOAT_LE -r 16000 -c 1 -t raw -d 5 recording.pcm

# Or pipe directly to your WebSocket client script:
arecord -f FLOAT_LE -r 16000 -c 1 -t raw - | node iot-client.js
```

### Alternative Format: WAV file bytes (simpler for some devices)

If your device cannot produce Float32 output, record a 16-bit signed integer WAV file and
send the entire WAV file buffer as a binary frame. The server will detect the WAV header and
decode it via `readAudio()`.

```bash
# Record a WAV file (16-bit, 16kHz, mono)
arecord -f S16_LE -r 16000 -c 1 -t wav recording.wav

# Send it over WebSocket (see Node.js example below)
```

## Receiving Audio

After the server processes the pipeline, it sends a single binary frame containing a complete
16-bit WAV file (PCM, 16kHz, mono, WAV container with header).

Play it with:

```bash
# Write received bytes to a file and play
aplay response.wav

# Or pipe received bytes directly to aplay (if your WS client supports piping):
# node iot-client.js | aplay -f S16_LE -r 16000 -c 1
```

## Control Messages (JSON)

All JSON frames are UTF-8 text. All audio frames are binary.

| Direction | Message | Meaning |
|-----------|---------|---------|
| Server → Client | `{ "type": "ready" }` | Server ready, pipelines loaded |
| Server → Client | `{ "type": "processing" }` | Audio received, pipeline started |
| Server → Client | `{ "type": "error", "message": "..." }` | Error (busy, decode failed, etc.) |
| Client → Server | `{ "type": "ping" }` | Keepalive heartbeat |
| Server → Client | `{ "type": "pong" }` | Keepalive response |

## Minimal Node.js IoT Client Example

```javascript
// iot-client.js — Raspberry Pi press-to-talk using arecord + WebSocket
// Usage: node iot-client.js
// Press Ctrl+C to stop recording and send; Ctrl+\ to quit

const { WebSocket } = require("ws");
const { execSync, spawn } = require("child_process");
const fs = require("fs");

const SERVER_URL = process.env.OASIS_URL ?? "ws://192.168.1.X:3001/ws";
const RECORDING_FILE = "/tmp/oasis-recording.wav";

const ws = new WebSocket(SERVER_URL);
ws.binaryType = "nodebuffer";

ws.on("open", () => console.log("Connected to Oasis server"));

ws.on("message", (data, isBinary) => {
  if (!isBinary) {
    const msg = JSON.parse(data.toString());
    console.log("[Control]", msg);
    if (msg.type === "ready") console.log("Server ready — press Enter to record");
    return;
  }
  // Binary = WAV response — play it
  fs.writeFileSync("/tmp/oasis-response.wav", data);
  execSync("aplay /tmp/oasis-response.wav");
  console.log("Playback complete. Press Enter to record again.");
});

ws.on("error", (err) => console.error("WebSocket error:", err));

// Simple press-Enter-to-record-then-send interaction
process.stdin.resume();
process.stdin.setEncoding("utf8");
let recording = false;
let arecordProc = null;

process.stdin.on("data", () => {
  if (!recording) {
    recording = true;
    console.log("Recording... press Enter again to stop and send.");
    arecordProc = spawn("arecord", [
      "-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "wav", RECORDING_FILE
    ]);
  } else {
    recording = false;
    arecordProc.kill("SIGINT");
    arecordProc.on("exit", () => {
      const wav = fs.readFileSync(RECORDING_FILE);
      console.log(`Sending ${wav.byteLength} bytes...`);
      ws.send(wav);
    });
  }
});
```

## Pipeline Latency

| Stage | Typical Latency (first call) | Typical Latency (warm) |
|-------|------------------------------|------------------------|
| STT (Whisper tiny.en) | 1-3s | 0.5-1.5s |
| LLM (Ollama gemma3n) | 2-5s | 1-3s |
| TTS (SpeechT5) | 1-3s | 0.5-2s |
| **Total** | **4-11s** | **2-7s** |

Pipelines are initialized at server startup (5-15s one-time cost on first run; cached on
subsequent runs if model files are already downloaded).

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No `{ "type": "ready" }` after connect | Pipelines still loading | Wait 5-15s; check server logs |
| `{ "type": "error", "message": "busy" }` | Another client is processing | Wait and retry |
| `{ "type": "error", "message": "No clear input detected" }` | Audio too short or silent | Record at least 1-2 seconds of speech |
| aplay error / no audio | WAV format mismatch | Verify aplay version supports 16kHz S16_LE mono WAV |
| ECONNREFUSED | Server not running or wrong IP | Check OASIS_URL and server logs |
