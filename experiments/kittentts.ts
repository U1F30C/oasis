import { pipeline } from "@huggingface/transformers";
import { WaveFile } from "wavefile";
import Speaker from "speaker";

const VOICES = ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"];

async function main() {
  console.log("Loading KittenTTS Nano v0.8...");
  const tts = await pipeline("text-to-speech", "onnx-community/kitten-tts-nano-0.1-ONNX");

  const voice = "Luna";
  const text = "Hello, this is Kitten TTS version 0.8 running in Node.js.";

  console.log(`Generating audio with voice: ${voice}`);
  const out = await tts(text, { voice });

  const wav = new WaveFile();
  wav.fromScratch(1, out.sampling_rate, "32f", out.audio);

  const speaker = new Speaker({
    channels: 1,
    bitDepth: 32,
    sampleRate: out.sampling_rate,
    // @ts-ignore
    float: true,
  });
  speaker.write(wav.toBuffer());

  console.log(`Done — sample rate: ${out.sampling_rate} Hz, samples: ${out.audio.length}`);
}

main();
