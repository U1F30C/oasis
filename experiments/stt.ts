import { pipeline } from "@huggingface/transformers";
import fs from "fs";

import { WaveFile } from "wavefile";

export async function readAudio(path: string, sampling_rate: number) {
  const buffer = fs.readFileSync(path);

  // Read .wav file and convert it to required format
  const wav = new WaveFile(buffer);
  wav.toBitDepth("32f");
  wav.toSampleRate(sampling_rate);
  let samples = wav.getSamples();
  if (Array.isArray(samples)) {
    if (samples.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);

      // Merge channels (into first channel to save memory)
      for (let i = 0; i < samples[0].length; ++i) {
        samples[0][i] = (SCALING_FACTOR * (samples[0][i] + samples[1][i])) / 2;
      }
    }

    // Select first channel
    samples = samples[0];
  }
  return samples;
}

// "openai/whisper-large-v3"
async function main() {
  const sttPipe = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
    { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } }
  );

  const readFile = await readAudio("kokoro.wav", 16000);

  const sttOut = await sttPipe(readFile, {
    chunk_length_s: 10,
  });
  console.log(sttOut);
}

main();

// rec rec-test.wav