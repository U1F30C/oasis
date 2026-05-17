import { Memory } from "mem0ai/oss";

// Bug fixes vs the original branch attempt:
// 1. Use `baseURL` not `ollama_base_url` — the JS library ignores the Python-style key
// 2. No `/api` suffix — ollama-js appends its own path segments
// 3. search() returns { results: MemoryItem[] }, not a plain array
// 4. search() options use `filters: { user_id }`, not top-level `userId`

// mem0's ollama client appends /api itself — strip it if OLLAMA_BASE_URL has it
const OLLAMA_HOST = process.env.OLLAMA_BASE_URL!.replace(/\/api$/, "");

interface EmbeddingModel {
  dims: number;
  id: string;
}

const _quen3Embedding0_6b: EmbeddingModel = {
  id: "qwen3-embedding:0.6b",
  dims: 1024,
};

const embeddingGemma: EmbeddingModel = {
  id: "embeddinggemma",
  // 128, 256, 512, 768
  dims: 768,
};

const embeddingModel = embeddingGemma;

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
      model: embeddingModel.id,
      baseURL: OLLAMA_HOST,
      embeddingDims: embeddingModel.dims, // explicit — skips the auto-detect probe
    },
  },
  vectorStore: {
    provider: "memory",
    config: {
      dimension: embeddingModel.dims,
      dbPath: "./mem0.db", // persists to disk (SQLite)
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
