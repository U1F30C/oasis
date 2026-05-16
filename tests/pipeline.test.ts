import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("../src/server/llm.js", () => ({
  gemma3n: "mock-model",
  qwen3wen3_8b: "mock-model",
  gemma3_270m: "mock-model",
  generateText: vi.fn().mockResolvedValue({ text: "Hello from mock LLM" }),
}));

// Mock the @huggingface/transformers pipeline
vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn().mockImplementation(async (task: string) => {
    if (task === "automatic-speech-recognition") {
      return vi.fn().mockResolvedValue({ text: "test input text" });
    }
    if (task === "text-to-speech") {
      return vi.fn().mockResolvedValue({
        sampling_rate: 16000,
        audio: new Float32Array(16000),
      });
    }
    return vi.fn();
  }),
}));

const { initPipelines, getSttPipeline, getTtsPipeline, SPEAKER_EMBEDDINGS } = await import("../src/server/pipeline.js");
const { generateWav } = await import("../src/server/tts.js");

describe("Pipeline integration (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("full pipeline flow produces WAV", async () => {
    await initPipelines();
    
    const sttPipe = getSttPipeline();
    const sttResult = await sttPipe(new Float32Array(16000));
    expect(sttResult.text).toBe("test input text");

    const ttsPipe = getTtsPipeline();
    const ttsOut = await ttsPipe("Hello", { speaker_embeddings: SPEAKER_EMBEDDINGS });
    const wav = generateWav(ttsOut as any);
    const buffer = wav.toBuffer() as Buffer;
    
    expect(buffer[0]).toBe(0x52); // R
    expect(buffer[1]).toBe(0x49); // I
    expect(buffer[2]).toBe(0x46); // F
    expect(buffer[3]).toBe(0x46); // F
  });
});
