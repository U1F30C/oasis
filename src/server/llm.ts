import { createOllama } from "ollama-ai-provider-v2";
import { generateText } from "ai";

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://192.168.1.4:11434/api",
});

export const qwen3wen3_8b = ollama("qwen3:8b");
export const gemma3n = ollama("gemma3n:latest");
export const gemma3_270m = ollama("gemma3:270m");

export { generateText };
