/**
 * WebSocket message protocol for Oasis voice pipeline.
 *
 * Control flow (JSON text frames):
 *   server → client: ready       — pipelines loaded, server ready to accept audio
 *   server → client: processing  — binary audio received, pipeline started
 *   server → client: done        — all audio chunks sent, response complete
 *   server → client: error       — pipeline error (message field contains reason)
 *   client → server: ping        — keepalive heartbeat
 *   server → client: pong        — keepalive response
 *
 * Audio frames (binary):
 *   client → server: WAV file bytes (IEEE float 32-bit, 16kHz mono)
 *   server → client: one or more 16-bit WAV chunks, followed by a "done" message
 */

export type ControlMessage =
  | { type: "ready" }
  | { type: "processing" }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "ping" }
  | { type: "pong" };

export type PipelineState = "idle" | "recording" | "processing" | "playing";
