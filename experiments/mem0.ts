import { Memory } from "mem0ai/oss";

// Bug fixes vs the original branch attempt:
// 1. Use `baseURL` not `ollama_base_url` — the JS library ignores the Python-style key
// 2. No `/api` suffix — ollama-js appends its own path segments
// 3. search() returns { results: MemoryItem[] }, not a plain array
// 4. search() options use `filters: { user_id }`, not top-level `userId`

const OLLAMA_HOST = "http://192.168.1.4:11434";

const config = {
  llm: {
    provider: "ollama",
    config: {
      model: "gemma3:270m",
      baseURL: OLLAMA_HOST,
    },
  },
  embedder: {
    provider: "ollama",
    config: {
      model: "nomic-embed-text",
      baseURL: OLLAMA_HOST,
    },
  },
};

// @ts-ignore — config is Partial<MemoryConfig>, TS doesn't narrow it perfectly
const memory = new Memory(config);

async function main() {
  try {
    console.log("=== mem0 + ollama experiment ===\n");

    console.log("[1] Adding memory: 'My favorite color is blue.'");
    const addResult = await memory.add("My favorite color is blue.", {
      userId: "test-user",
    });
    console.log("    add result:", JSON.stringify(addResult, null, 2));

    console.log("\n[2] Searching: 'What is my favorite color?'");
    const searchResult = await memory.search("What is my favorite color?", {
      filters: { user_id: "test-user" },
    });
    // searchResult is { results: MemoryItem[] }
    console.log("    hits:", searchResult.results.length);
    for (const hit of searchResult.results) {
      console.log("   ", hit.memory, `(score: ${hit.score?.toFixed(3)})`);
    }

    console.log("\n[3] Adding memory: 'I live in Paris.'");
    await memory.add("I live in Paris.", { userId: "test-user" });

    console.log("\n[4] Searching again: 'What is my favorite color?'");
    const searchResult2 = await memory.search("What is my favorite color?", {
      filters: { user_id: "test-user" },
    });
    console.log("    hits:", searchResult2.results.length);
    for (const hit of searchResult2.results) {
      console.log("   ", hit.memory, `(score: ${hit.score?.toFixed(3)})`);
    }

    console.log("\n=== done ===");
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
