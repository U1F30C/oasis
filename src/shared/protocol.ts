/**
 * WebSocket message protocol for Oasis voice pipeline.
 *
 * Control flow (JSON text frames):
 *   server → client: ready       — pipelines loaded, server ready to accept audio
 *   server → client: processing  — binary audio received, pipeline started
 *   server → client: error       — pipeline error (message field contains reason)
 *   client → server: ping        — keepalive heartbeat
 *   server → client: pong        — keepalive response
 *
 * Audio frames (binary):
 *   client → server: Float32Array PCM at 16kHz mono (little-endian)
 *   server → client: 16-bit WAV file bytes
 */

export type ControlMessage =
  | { type: "ready" }
  | { type: "processing" }
  | { type: "error"; message: string }
  | { type: "ping" }
  | { type: "pong" };

export type PipelineState = "idle" | "recording" | "processing" | "playing";
