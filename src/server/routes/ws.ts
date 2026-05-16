import os from "os";
import path from "path";
import fs from "fs";
import { WebSocket } from "ws";
import { generateText } from "ai";
import { getSttPipeline, getTtsPipeline, SPEAKER_EMBEDDINGS } from "../pipeline.js";
import { generateWav } from "../tts.js";
import { readAudio } from "../stt.js";
import { gemma3n } from "../llm.js";
import type { ControlMessage } from "../../shared/protocol.js";

let isBusy = false;

/**
 * Sends a JSON control message to the WebSocket client.
 */
function send(ws: WebSocket, msg: ControlMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Detects if a buffer contains a WAV file by checking for the "RIFF" magic bytes.
 */
function isWavBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46    // F
  );
}

/**
 * Converts a buffer (WAV or raw PCM) into a Float32Array at 16kHz mono.
 */
async function bufferToFloat32(data: Buffer): Promise<Float32Array> {
  if (isWavBuffer(data)) {
    // IoT path: WAV file bytes — write to temp file and decode via readAudio()
    const tmpPath = path.join(os.tmpdir(), `oasis-${Date.now()}.wav`);
    fs.writeFileSync(tmpPath, data);
    try {
      return await readAudio(tmpPath, 16000);
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  }
  // Browser path: raw Float32Array PCM bytes (little-endian, 16kHz, mono)
  return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
}

/**
 * Executes the full voice pipeline (STT -> LLM -> TTS).
 * Returns the final audio as a WAV buffer.
 */
async function runPipeline(data: Buffer): Promise<Buffer> {
  // 1. Decode audio
  const audioData = await bufferToFloat32(data);

  // 2. STT
  const sttPipe = getSttPipeline();
  const sttResult = await sttPipe(audioData, { chunk_length_s: 10 });
  const userText = Array.isArray(sttResult)
    ? (sttResult[0] as any)?.text || ""
    : (sttResult as any).text;

  console.log(`👤 [STT] "${userText}"`);

  if (!userText || userText.trim().length < 2) {
    throw new Error("No clear input detected");
  }

  // 3. LLM
  const { text: llmResponse } = await generateText({
    model: gemma3n,
    prompt: `You are a helpful voice assistant. Keep responses concise and conversational and very short, one or two sentences. User said: "${userText}"`,
  });

  console.log(`🤖 [LLM] "${llmResponse}"`);

  // 4. TTS
  const ttsPipe = getTtsPipeline();
  const ttsOut = await ttsPipe(llmResponse, { speaker_embeddings: SPEAKER_EMBEDDINGS });

  // 5. Encode as 16-bit WAV
  const wav = generateWav(ttsOut as { sampling_rate: number; audio: Float32Array });
  return wav.toBuffer() as Buffer;
}

/**
 * Handles an incoming WebSocket connection for the voice pipeline.
 */
export function handleConnection(ws: WebSocket): void {
  console.log("🔌 [WS] Client connected");
  send(ws, { type: "ready" });

  ws.on("message", async (data: Buffer, isBinaryFrame: boolean) => {
    if (!isBinaryFrame) {
      // JSON control message
      try {
        const msg = JSON.parse(data.toString()) as ControlMessage;
        if (msg.type === "ping") send(ws, { type: "pong" });
      } catch {
        // Ignore malformed JSON
      }
      return;
    }

    // Binary frame = audio payload
    if (isBusy) {
      console.log("⚠️ [WS] Server busy, rejecting audio");
      send(ws, { type: "error", message: "busy" });
      return;
    }

    isBusy = true;
    send(ws, { type: "processing" });

    try {
      const wavBuffer = await runPipeline(data);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(wavBuffer);
      }
    } catch (error) {
      console.error("❌ [Pipeline error]", error);
      send(ws, { type: "error", message: String(error) });
    } finally {
      isBusy = false;
    }
  });

  ws.on("close", () => {
    console.log("🔌 [WS] Client disconnected");
    isBusy = false;
  });

  ws.on("error", (err) => {
    console.error("❌ [WS] WebSocket error:", err);
    isBusy = false;
  });
}
