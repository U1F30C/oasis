import { Router } from "express";

export const healthRouter = Router();

/**
 * GET /health
 * Simple health check endpoint to verify server and pipeline status.
 */
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", pipelines: "ready" });
});
