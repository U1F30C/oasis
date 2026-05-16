import fs from "fs";
import { WaveFile } from "wavefile";

/**
 * Reads a WAV file and converts it to a Float32Array at the specified sampling rate.
 * Merges multi-channel audio into a single mono channel.
 */
export async function readAudio(path: string, sampling_rate: number): Promise<Float32Array> {
  const buffer = fs.readFileSync(path);

  const wav = new WaveFile(buffer);
  wav.toBitDepth("32f");
  wav.toSampleRate(sampling_rate);
  let samples = wav.getSamples();

  if (Array.isArray(samples)) {
    if (samples.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);
      for (let i = 0; i < samples[0].length; ++i) {
        samples[0][i] = (SCALING_FACTOR * (samples[0][i] + samples[1][i])) / 2;
      }
    }
    samples = samples[0];
  }

  return samples as any as Float32Array;
}
