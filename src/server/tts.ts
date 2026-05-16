import { WaveFile } from "wavefile";

const channels = 1;

/**
 * Generates a 16-bit WAV file from the TTS output.
 * 16-bit is used for universal browser compatibility with AudioContext.decodeAudioData().
 */
export function generateWav(ttsOut: { sampling_rate: number; audio: Float32Array }): WaveFile {
  const wav = new WaveFile();
  wav.fromScratch(channels, ttsOut.sampling_rate, "32f", ttsOut.audio);
  wav.toBitDepth("16");
  return wav;
}
