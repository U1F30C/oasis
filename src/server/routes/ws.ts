import { WebSocket } from "ws";
import { streamText } from "ai";
import { getSttPipeline, runTts } from "../pipeline.js";
import { generateWav } from "../tts.js";
import { bufferToFloat32 } from "../audio-utils.js";
import { gemma3n } from "../llm.js";
import type { ControlMessage } from "../../shared/protocol.js";

function send(ws: WebSocket, msg: ControlMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

async function* streamSentences(textStream: AsyncIterable<string>): AsyncGenerator<string> {
  let buf = "";
  for await (const token of textStream) {
    buf += token;
    const m = /[.!?]\s+/.exec(buf);
    if (m) {
      const sentence = buf.slice(0, m.index + 1).trim();
      if (sentence.length >= 3) yield sentence;
      buf = buf.slice(m.index + m[0].length);
    }
  }
  if (buf.trim().length >= 3) yield buf.trim();
}

async function runPipeline(data: Buffer, ws: WebSocket): Promise<void> {
  const audioData = await bufferToFloat32(data);

  const sttPipe = getSttPipeline();
  const sttResult = await sttPipe(audioData, { chunk_length_s: 10 });
  const userText = Array.isArray(sttResult)
    ? (sttResult[0] as any)?.text ?? ""
    : (sttResult as any).text;

  console.log(`👤 [STT] "${userText}"`);

  if (!userText || userText.trim().length < 2) {
    throw new Error("No clear input detected");
  }

  const result = streamText({
    model: gemma3n,
    prompt: `You are a helpful voice assistant. Keep responses concise and conversational and very short, one or two sentences. User said: "${userText}"`,
  });

  for await (const sentence of streamSentences(result.textStream)) {
    console.log(`🤖 [LLM] "${sentence}"`);
    const ttsOut = await runTts(sentence);
    const wavBuffer = generateWav(ttsOut).toBuffer() as Buffer;
    if (ws.readyState === WebSocket.OPEN) ws.send(wavBuffer);
  }

  send(ws, { type: "done" });
}

export function handleConnection(ws: WebSocket): void {
  console.log("🔌 [WS] Client connected");
  send(ws, { type: "ready" });

  let isBusy = false;

  ws.on("message", async (data: Buffer, isBinaryFrame: boolean) => {
    if (!isBinaryFrame) {
      try {
        const msg = JSON.parse(data.toString()) as ControlMessage;
        if (msg.type === "ping") send(ws, { type: "pong" });
      } catch { /* ignore malformed JSON */ }
      return;
    }

    if (isBusy) {
      console.log("⚠️ [WS] Server busy, rejecting audio");
      send(ws, { type: "error", message: "busy" });
      return;
    }

    isBusy = true;
    send(ws, { type: "processing" });

    try {
      await runPipeline(data, ws);
    } catch (error) {
      console.error("❌ [Pipeline error]", error);
      send(ws, { type: "error", message: String(error) });
    } finally {
      isBusy = false;
    }
  });

  ws.on("close", () => { console.log("🔌 [WS] Client disconnected"); });
  ws.on("error", (err) => { console.error("❌ [WS] WebSocket error:", err); });
}
