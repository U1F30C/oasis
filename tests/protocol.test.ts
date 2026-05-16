import { describe, it, expect } from "vitest";
import type { ControlMessage, PipelineState } from "../src/shared/protocol.js";

describe("Shared protocol types", () => {
  it("ControlMessage ready is valid", () => {
    const msg: ControlMessage = { type: "ready" };
    expect(msg.type).toBe("ready");
  });

  it("PipelineState covers required states", () => {
    const states: PipelineState[] = ["idle", "recording", "processing", "playing"];
    expect(states).toContain("idle");
    expect(states).toContain("recording");
    expect(states).toContain("processing");
    expect(states).toContain("playing");
  });
});
