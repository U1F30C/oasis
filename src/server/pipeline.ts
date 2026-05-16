import { pipeline } from "@huggingface/transformers";

type Pipeline = any;

interface PipelineInstances {
  stt: Pipeline | null;
  tts: Pipeline | null;
}

const instances: PipelineInstances = { stt: null, tts: null };

export const SPEAKER_EMBEDDINGS =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

/**
 * Initializes the STT and TTS pipelines.
 * This is expensive and should be called once at server startup.
 */
export async function initPipelines(): Promise<void> {
  if (instances.stt && instances.tts) return;

  console.log("📝 Loading STT pipeline (Whisper tiny.en)...");
  instances.stt = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
    { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
  );

  console.log("🗣️ Loading TTS pipeline (SpeechT5)...");
  instances.tts = await pipeline("text-to-speech", "Xenova/speecht5_tts");

  console.log("✅ ML pipelines ready.");
}

/**
 * Returns the STT pipeline instance.
 * Throws if not initialized.
 */
export function getSttPipeline(): Pipeline {
  if (!instances.stt) {
    throw new Error("STT pipeline not initialized — call initPipelines() first");
  }
  return instances.stt;
}

/**
 * Returns the TTS pipeline instance.
 * Throws if not initialized.
 */
export function getTtsPipeline(): Pipeline {
  if (!instances.tts) {
    throw new Error("TTS pipeline not initialized — call initPipelines() first");
  }
  return instances.tts;
}
