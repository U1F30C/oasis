import { WebSocket } from "ws";
import { generateText } from "ai";
import { getSttPipeline, runTts } from "../pipeline.js";
import { generateWav } from "../tts.js";
import { bufferToFloat32 } from "../audio-utils.js";
import { gemma3n } from "../llm.js";
import type { ControlMessage } from "../../shared/protocol.js";

function send(ws: WebSocket, msg: ControlMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

async function runPipeline(data: Buffer): Promise<Buffer> {
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

  const { text: llmResponse } = await generateText({
    model: gemma3n,
    prompt: `You are a helpful voice assistant. Keep responses concise and conversational and very short, one or two sentences. User said: "${userText}"`,
  });

  console.log(`🤖 [LLM] "${llmResponse}"`);

  const ttsOut = await runTts(llmResponse);
  return generateWav(ttsOut).toBuffer() as Buffer;
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
      const wavBuffer = await runPipeline(data);
      if (ws.readyState === WebSocket.OPEN) ws.send(wavBuffer);
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
