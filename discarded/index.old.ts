import { pipeline } from "@huggingface/transformers";
import { createOllama } from "ollama-ai-provider-v2";
import { generateText } from "ai";
import { WaveFile } from "wavefile";
import Speaker from "speaker";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const AudioRecorder = require("node-audiorecorder");

// Initialize Ollama LLM
const ollama = createOllama({
  baseURL: "http://192.168.1.6:11434/api",
});
// const gemma3_270m = ollama("gemma3:270m");
const gemma3n = ollama("gemma3n");

// Audio recorder configuration
const audioOptions = {
  program: "rec",
  device: null,
  bits: 16,
  channels: 1,
  encoding: "signed-integer",
  rate: 16000,
  type: "wav",
  silence: 0,
  thresholdStart: 0.5,
  thresholdStop: 0.5,
  keepSilence: true,
};

const audioRecorder = new AudioRecorder(audioOptions, console);

// Keyboard input handling
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

let isRecording = false;
let currentRecorder: any = null;
let currentWriteStream: fs.WriteStream | null = null;

// Function to start recording
function startRecording(): void {
  if (isRecording) return;

  isRecording = true;
  const outputPath = path.join(__dirname, "recording.wav");
  currentWriteStream = fs.createWriteStream(outputPath);

  console.log("🎤 Recording started... (hold space bar)");

  currentRecorder = new AudioRecorder(audioOptions, console);
  currentRecorder.start();
  const audioStream = currentRecorder.stream();
  audioStream.pipe(currentWriteStream);
}

// Function to stop recording
function stopRecording(): Promise<void> {
  return new Promise((resolve) => {
    if (!isRecording || !currentRecorder || !currentWriteStream) {
      resolve();
      return;
    }

    isRecording = false;
    console.log("🛑 Recording stopped");

    currentRecorder.stop();
    currentWriteStream.end();

    currentWriteStream.on("finish", () => {
      console.log("✅ Recording saved");
      resolve();
    });
  });
}

// Function to read audio file for STT
async function readAudio(path: string, sampling_rate: number) {
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
  return samples;
}

// Function to generate and play TTS
function generateWav(ttsOut: { sampling_rate: number; audio: Float32Array }) {
  const wav = new WaveFile();
  wav.fromScratch(1, ttsOut.sampling_rate, "32f", ttsOut.audio);
  return wav;
}

function playWav(wav: WaveFile, sampleRate: number): Promise<void> {
  return new Promise((resolve) => {
    const speaker = new Speaker({
      channels: 1,
      bitDepth: 32,
      sampleRate,
      // @ts-ignore
      float: true,
    });

    speaker.on("close", () => {
      resolve();
    });

    speaker.write(wav.toBuffer());
    speaker.end();
  });
}

async function main() {
  console.log("🚀 Initializing Voice Assistant...");

  // Initialize pipelines
  console.log("📝 Loading STT pipeline...");
  const sttPipe = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
    { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
  );

  console.log("🗣️ Loading TTS pipeline...");
  const ttsPipe = await pipeline("text-to-speech", "Xenova/speecht5_tts");

  const speaker_embeddings =
    "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

  console.log("✅ Voice Assistant ready!");
  console.log(
    "📋 Instructions: Press SPACE to start recording, press SPACE again to stop and process\n",
  );

  // Set up keyboard event handlers
  process.stdin.on("keypress", async (chunk, key) => {
    if (key && key.name === "space") {
      if (!isRecording) {
        startRecording();
      } else {
        await stopRecording();
        await processRecording(sttPipe, ttsPipe, speaker_embeddings);
      }
    } else if (key && key.name === "q" && key.ctrl) {
      console.log("\n👋 Goodbye!");
      process.exit(0);
    }
  });

  // Keep the process alive
  console.log("👂 Ready to listen! Hold SPACE to record, Ctrl+Q to quit");
  process.stdin.resume();
}

// Function to process the recorded audio
async function processRecording(
  sttPipe: any,
  ttsPipe: any,
  speaker_embeddings: string,
) {
  try {
    // Check if recording file exists and has content
    const recordingPath = path.join(__dirname, "recording.wav");
    if (!fs.existsSync(recordingPath)) {
      console.log("⚠️ No recording found");
      return;
    }

    const stats = fs.statSync(recordingPath);
    if (stats.size < 1000) {
      // Less than 1KB, likely empty
      console.log("⚠️ Recording too short, try again");
      return;
    }

    // 2. Convert speech to text
    console.log("🔄 Converting speech to text...");
    const audioData = await readAudio(recordingPath, 16000);
    const sttResult = await sttPipe(audioData, { chunk_length_s: 10 });
    const userText = Array.isArray(sttResult)
      ? sttResult[0]?.text || ""
      : sttResult.text;

    console.log(`👤 User said: "${userText}"`);

    // Skip if no meaningful input
    if (!userText || userText.trim().length < 2) {
      console.log("⏭️ No clear input detected, try again...\n");
      return;
    }

    // Check for exit command
    if (
      userText.toLowerCase().includes("goodbye") ||
      userText.toLowerCase().includes("exit")
    ) {
      console.log("👋 Goodbye!");
      process.exit(0);
    }

    // 3. Get LLM response
    console.log("🤖 Generating response...");
    const { text: llmResponse } = await generateText({
      model: gemma3n,
      prompt: `You are a helpful voice assistant. Keep responses concise and conversational and very short, one or two sentences. User said: "${userText}"`,
    });

    console.log(`🤖 Assistant: "${llmResponse}"`);

    // 4. Convert response to speech and play
    console.log("🔊 Converting to speech...");
    const ttsOut = await ttsPipe(llmResponse, { speaker_embeddings });
    const wav = generateWav(ttsOut);

    console.log("▶️ Playing response...");
    await playWav(wav, ttsOut.sampling_rate);

    console.log("✅ Response played\n");
    console.log("👂 Ready for next input! Hold SPACE to record");
  } catch (error) {
    console.error("❌ Error processing recording:", error);
    console.log("👂 Ready for next input! Hold SPACE to record");
  }
}

main().catch(console.error);
