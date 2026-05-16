import { Router, Request, Response } from "express";
import { generateText } from "ai";
import { getSttPipeline, runTts } from "../pipeline.js";
import { generateWav } from "../tts.js";
import { bufferToFloat32 } from "../audio-utils.js";
import { gemma3n } from "../llm.js";

export const apiRouter = Router();

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
        ? (sttResult[0] as any)?.text ?? ""
        : (sttResult as any).text;
      res.json({ text });
    } catch (err) {
      console.error("[/api/stt]", err);
      res.status(500).json({ error: String(err) });
    }
  },
);

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

apiRouter.post("/api/tts", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body as { text: string };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing or invalid 'text' field" });
      return;
    }
    const ttsOut = await runTts(text);
    const buffer = generateWav(ttsOut).toBuffer() as Buffer;
    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", String(buffer.length));
    res.send(buffer);
  } catch (err) {
    console.error("[/api/tts]", err);
    res.status(500).json({ error: String(err) });
  }
});
