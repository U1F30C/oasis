import { describe, it, expect } from "vitest";
import { readAudio } from "../src/server/stt.js";
import { generateWav } from "../src/server/tts.js";
import { gemma3n, qwen3wen3_8b, gemma3_270m } from "../src/server/llm.js";
import {
  getSttPipeline,
  getTtsPipeline,
  SPEAKER_EMBEDDINGS,
} from "../src/server/pipeline.js";

describe("Server lib exports", () => {
  it("readAudio is an exported async function", () => {
    expect(typeof readAudio).toBe("function");
  });

  it("generateWav is an exported function", () => {
    expect(typeof generateWav).toBe("function");
  });

  it("generateWav produces a WaveFile with 16-bit samples", () => {
    const sampleRate = 16000;
    const audio = new Float32Array(sampleRate);
    const wav = generateWav({ sampling_rate: sampleRate, audio });
    expect(typeof wav.toBuffer).toBe("function");
    const buffer = wav.toBuffer() as Buffer;
    expect(buffer.length).toBeGreaterThan(44);
  });

  it("llm.ts exports models", () => {
    expect(gemma3n).toBeDefined();
    expect(qwen3wen3_8b).toBeDefined();
    expect(gemma3_270m).toBeDefined();
  });
});

describe("Pipeline guards", () => {
  it("Pipeline getters throw before initialization", () => {
    expect(() => getSttPipeline()).toThrow();
    expect(() => getTtsPipeline()).toThrow();
  });

  it("SPEAKER_EMBEDDINGS is a valid URL", () => {
    expect(typeof SPEAKER_EMBEDDINGS).toBe("string");
    expect(SPEAKER_EMBEDDINGS).toContain("huggingface.co");
  });
});
