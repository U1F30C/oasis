import { pipeline } from "@huggingface/transformers";
import { KokoroTTS } from "kokoro-js";

type Pipeline = any;
type TtsProvider =
  | { kind: "transformers"; pipe: Pipeline }
  | { kind: "kokoro"; tts: KokoroTTS; voice: string };

const TTS_MODEL = process.env.TTS_MODEL ?? "onnx-community/Kokoro-82M-ONNX";
const TTS_VOICE = process.env.TTS_VOICE ?? "af_heart";

// Only required for speecht5_tts; other transformers models don't use it
const SPEAKER_EMBEDDINGS =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

const instances: { stt: Pipeline | null; tts: TtsProvider | null } = { stt: null, tts: null };

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
  if (instances.tts.kind === "kokoro") {
    return instances.tts.tts.generate(text, { voice: instances.tts.voice as any });
  }
  const opts = TTS_MODEL === "Xenova/speecht5_tts" ? { speaker_embeddings: SPEAKER_EMBEDDINGS } : {};
  return instances.tts.pipe(text, opts);
}
