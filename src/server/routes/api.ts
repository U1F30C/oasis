import os from "os";
import path from "path";
import fs from "fs";
import { Router, Request, Response } from "express";
import { generateText } from "ai";
import { getSttPipeline, getTtsPipeline, SPEAKER_EMBEDDINGS } from "../pipeline.js";
import { generateWav } from "../tts.js";
import { readAudio } from "../stt.js";
import { gemma3n } from "../llm.js";

export const apiRouter = Router();

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
    const tmpPath = path.join(os.tmpdir(), `oasis-stt-${Date.now()}.wav`);
    fs.writeFileSync(tmpPath, data);
    try {
      return await readAudio(tmpPath, 16000);
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  }
  return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
}

/**
 * POST /api/stt
 * Body: raw binary audio (WAV file bytes or Float32Array PCM)
 * Content-Type: application/octet-stream
 * Response: { text: string }
 */
apiRouter.post(
  "/api/stt",
  (req: Request, res: Response, next) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
      next();
    });
    req.on("error", next);
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawBody = (req as Request & { rawBody: Buffer }).rawBody;
      if (!rawBody || rawBody.length === 0) {
        res.status(400).json({ error: "Empty audio body" });
        return;
      }

      const audioData = await bufferToFloat32(rawBody);
      const sttPipe = getSttPipeline();
      const sttResult = await sttPipe(audioData, { chunk_length_s: 10 });
      const text = Array.isArray(sttResult)
        ? (sttResult[0] as any)?.text || ""
        : (sttResult as any).text;

      res.json({ text });
    } catch (err) {
      console.error("[/api/stt]", err);
      res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * POST /api/llm
 * Body: { prompt: string }
 * Content-Type: application/json
 * Response: { response: string }
 */
apiRouter.post("/api/llm", async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt } = req.body as { prompt: string };
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "Missing or invalid 'prompt' field" });
      return;
    }

    const { text } = await generateText({ model: gemma3n, prompt });
    res.json({ response: text });
  } catch (err) {
    console.error("[/api/llm]", err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/tts
 * Body: { text: string }
 * Content-Type: application/json
 * Response: 16-bit WAV binary
 * Content-Type: audio/wav
 */
apiRouter.post("/api/tts", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body as { text: string };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing or invalid 'text' field" });
      return;
    }

    const ttsPipe = getTtsPipeline();
    const ttsOut = await ttsPipe(text, { speaker_embeddings: SPEAKER_EMBEDDINGS });
    const wav = generateWav(ttsOut as { sampling_rate: number; audio: Float32Array });
    const buffer = wav.toBuffer() as Buffer;

    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", String(buffer.length));
    res.send(buffer);
  } catch (err) {
    console.error("[/api/tts]", err);
    res.status(500).json({ error: String(err) });
  }
});
