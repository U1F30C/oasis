import { KokoroTTS } from "kokoro-js";

async function main() {
  const model_id = "onnx-community/Kokoro-82M-ONNX";
  const tts = await KokoroTTS.from_pretrained(model_id, {
    dtype: "q4", // Options: "fp32", "fp16", "q8", "q4", "q4f16"
  });

  const voice = "am_eric";
  const text =
    "Life is like a box of chocolates. You never know what you're gonna get.";
  const audio = await tts.generate(text, {
    // Use `tts.list_voices()` to list all available voices
    voice,
  });
  audio.save(`kokoro-${voice}.wav`);
}

main();
