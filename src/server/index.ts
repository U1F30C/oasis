import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { initPipelines } from "./pipeline.js";
import { handleConnection } from "./routes/ws.js";
import { healthRouter } from "./routes/health.js";
import { apiRouter } from "./routes/api.js";

const PORT = Number(process.env.PORT) || 3001;

/**
 * Main server entry point.
 */
async function main(): Promise<void> {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Routes
  app.use(healthRouter);
  app.use(apiRouter);

  const server = createServer(app);

  // Initialize ML pipelines before accepting connections
  console.log("📝 Initializing ML pipelines (this takes 5-15s on first run)...");
  try {
    await initPipelines();
    console.log("✅ Pipelines ready.");
  } catch (err) {
    console.error("❌ Failed to initialize pipelines:", err);
    process.exit(1);
  }

  // WebSocket server — noServer mode shares the HTTP server
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 10 * 1024 * 1024, // 10MB max audio payload
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url!, `http://${req.headers.host}`);
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", handleConnection);

  server.listen(PORT, () => {
    console.log(`🚀 Oasis server running at http://localhost:${PORT}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
    console.log(`🛠️ REST API: POST /api/stt | POST /api/llm | POST /api/tts`);
  });
}

main().catch((err) => {
  console.error("💥 Fatal server error:", err);
  process.exit(1);
});
