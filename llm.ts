import { createOllama } from "ollama-ai-provider-v2";
import { generateText } from "ai";

const ollama = createOllama({
  baseURL: "http://192.168.1.4:11434/api",
});
export const qwen3wen3_8b = ollama("qwen3:8b");
export const gemma3n = ollama("gemma3n:latest");
export const gemma3_270m = ollama("gemma3:270m");

async function main() {
  const { text } = await generateText({
    model: gemma3_270m,
    tools: {},
    // providerOptions: { ollama: { think: false· } },
    prompt: "Hi",
  });
  console.log(text);
}

main();

// # works
// curl http://192.168.1.4:11434/api/chat -d '{
//     "model": "gemma3n",
//     "messages": [
//       {
//         "role": "user",
//         "content": "why is the sky blue?"
//       }
//     ]
//   }'
