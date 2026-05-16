import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { pipeline } from "@huggingface/transformers";
import { KokoroTTS } from "kokoro-js";

type Pipeline = any;
type TtsProvider =
  | { kind: "transformers"; pipe: Pipeline }
  | { kind: "kokoro"; tts: KokoroTTS; voice: string }
  | { kind: "kittentts"; proc: ChildProcess };

const TTS_MODEL = process.env.TTS_MODEL ?? "onnx-community/Kokoro-82M-ONNX";
const TTS_VOICE = process.env.TTS_VOICE ?? "af_heart";

// Only required for speecht5_tts; other transformers models don't use it
const SPEAKER_EMBEDDINGS =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

const instances: { stt: Pipeline | null; tts: TtsProvider | null } = { stt: null, tts: null };

function spawnKittenBridge(model: string, voice: string): Promise<ChildProcess> {
  return new Promise((res, rej) => {
    const bridgePath = join(__dirname, "kittentts_bridge.py");
    const venvPython = join(process.cwd(), ".venv", "bin", "python3");
    const python = existsSync(venvPython) ? venvPython : "python3";
    const proc = spawn(python, [bridgePath, model, voice], { stdio: ["pipe", "pipe", "inherit"] });

    let buf = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const nl = buf.indexOf(0x0a);
      if (nl !== -1) {
        proc.stdout!.removeListener("data", onData);
        buf.slice(0, nl).toString().trim() === "READY" ? res(proc) : rej(new Error("KittenTTS bridge failed to start"));
      }
    };
    proc.stdout!.on("data", onData);
    proc.on("error", rej);
    proc.once("exit", (code) => rej(new Error(`KittenTTS bridge exited with code ${code}`)));
  });
}

function runKittenTts(proc: ChildProcess, text: string): Promise<{ sampling_rate: number; audio: Float32Array }> {
  return new Promise((res, rej) => {
    const textBuf = Buffer.from(text, "utf-8");
    const header = Buffer.allocUnsafe(4);
    header.writeUInt32LE(textBuf.length, 0);
    proc.stdin!.write(Buffer.concat([header, textBuf]));

    let buf = Buffer.alloc(0);
    let expectedLen: number | null = null;

    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      if (expectedLen === null && buf.length >= 4) {
        expectedLen = buf.readUInt32LE(0);
        buf = buf.subarray(4);
      }
      if (expectedLen !== null && buf.length >= expectedLen) {
        proc.stdout!.removeListener("data", onData);
        const raw = Buffer.allocUnsafe(expectedLen);
        buf.copy(raw, 0, 0, expectedLen);
        res({ sampling_rate: 24000, audio: new Float32Array(raw.buffer) });
      }
    };
    proc.stdout!.on("data", onData);
    proc.once("error", rej);
  });
}

export async function initPipelines(): Promise<void> {
  if (instances.stt && instances.tts) return;

  console.log("📝 Loading STT pipeline (Whisper tiny.en)...");
  instances.stt = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
    { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
  );

  console.log(`🗣️ Loading TTS pipeline (${TTS_MODEL})...`);
  if (TTS_MODEL.toLowerCase().includes("kokoro")) {
    const tts = await KokoroTTS.from_pretrained(TTS_MODEL, { dtype: "q4" });
    instances.tts = { kind: "kokoro", tts, voice: TTS_VOICE };
  } else if (TTS_MODEL.toLowerCase().includes("kitten-tts") || TTS_MODEL.startsWith("KittenML/")) {
    instances.tts = { kind: "kittentts", proc: await spawnKittenBridge(TTS_MODEL, TTS_VOICE) };
  } else {
    instances.tts = { kind: "transformers", pipe: await pipeline("text-to-speech", TTS_MODEL) };
  }

  console.log("✅ ML pipelines ready.");
}

export function getSttPipeline(): Pipeline {
  if (!instances.stt) throw new Error("STT pipeline not initialized — call initPipelines() first");
  return instances.stt;
}

export async function runTts(text: string): Promise<{ sampling_rate: number; audio: Float32Array }> {
  if (!instances.tts) throw new Error("TTS pipeline not initialized — call initPipelines() first");
  switch (instances.tts.kind) {
    case "kokoro":
      return instances.tts.tts.generate(text, { voice: instances.tts.voice as any });
    case "kittentts":
      return runKittenTts(instances.tts.proc, text);
    case "transformers": {
      const opts = TTS_MODEL === "Xenova/speecht5_tts" ? { speaker_embeddings: SPEAKER_EMBEDDINGS } : {};
      return instances.tts.pipe(text, opts);
    }
  }
}
