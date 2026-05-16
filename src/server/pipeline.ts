import { pipeline } from "@huggingface/transformers";

type Pipeline = any;

interface PipelineInstances {
  stt: Pipeline | null;
  tts: Pipeline | null;
}

const TTS_MODEL = process.env.TTS_MODEL ?? "Xenova/speecht5_tts";

// Only required for speecht5_tts; other models (mms-tts-eng, etc.) don't use it
const SPEAKER_EMBEDDINGS =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

const instances: PipelineInstances = { stt: null, tts: null };

export async function initPipelines(): Promise<void> {
  if (instances.stt && instances.tts) return;

  console.log("📝 Loading STT pipeline (Whisper tiny.en)...");
  instances.stt = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
    { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
  );

  console.log(`🗣️ Loading TTS pipeline (${TTS_MODEL})...`);
  instances.tts = await pipeline("text-to-speech", TTS_MODEL);

  console.log("✅ ML pipelines ready.");
}

export function getSttPipeline(): Pipeline {
  if (!instances.stt) throw new Error("STT pipeline not initialized — call initPipelines() first");
  return instances.stt;
}

export async function runTts(text: string): Promise<{ sampling_rate: number; audio: Float32Array }> {
  if (!instances.tts) throw new Error("TTS pipeline not initialized — call initPipelines() first");
  const opts = TTS_MODEL === "Xenova/speecht5_tts" ? { speaker_embeddings: SPEAKER_EMBEDDINGS } : {};
  return instances.tts(text, opts);
}
