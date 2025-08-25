import { WaveFile } from "wavefile";
import { pipeline } from "@huggingface/transformers";
import Speaker from "speaker";
import fs from "fs";

// import { play } from "node-wav-player";

const channels = 1;

function generateWav(ttsOut: { sampling_rate: number; audio: Float32Array }) {
  const wav = new WaveFile();
  wav.fromScratch(channels, ttsOut.sampling_rate, "32f", ttsOut.audio);
  return wav;
}

function playWav(wav: WaveFile, sampleRate: number) {
  const speaker = new Speaker({
    channels,
    bitDepth: 32,
    sampleRate,
    // @ts-ignore
    float: true,
  });
  speaker.write(wav.toBuffer());
}

//remove comments to use
async function main() {
  console.log("Initializing TTS pipeline...");
  // Xenova/speecht5_tts
  // Xenova/mms-tts-eng
  // onnx-community/Kokoro-82M-ONNX
  // onnx-community/Kokoro-82M-v1.1-zh-ONNX

  // onnx-community/kitten-tts-nano-0.1-ONNX
  const model_id = "Xenova/mms-tts-eng";
  const ttsPipe = await pipeline("text-to-speech", model_id);

  const speaker_embeddings =
    "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

  console.log("Generating audio...");
  const ttsOut = await ttsPipe("hello this is a test", { speaker_embeddings });
  console.log(
    "Generated audio, sample rate: ",
    ttsOut.sampling_rate,
    "length: ",
    ttsOut.audio.length
  );

  console.log("Generating wav...");
  const wav = generateWav(ttsOut);
  const readFile = fs.readFileSync("out.wav");
  // const wav = new WaveFile(readFile);

  console.log("Playing wav...");

  playWav(wav, ttsOut.sampling_rate);

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

main();
