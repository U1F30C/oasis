import { useEffect, useCallback } from "react";
import { useVoiceWS } from "./hooks/useVoiceWS.js";

const WS_URL = "/ws"; // Vite proxy routes this to ws://localhost:3001/ws in dev

const STATE_LABELS: Record<string, string> = {
  idle: "Hold to Talk",
  recording: "Recording...",
  processing: "Processing...",
  playing: "Playing...",
};

const STATE_COLORS: Record<string, string> = {
  idle: "#4a9eff",
  recording: "#ff4a4a",
  processing: "#ffa04a",
  playing: "#4aff7a",
};

export default function App() {
  const { state, error, connect, startRecording, stopRecording } = useVoiceWS();

  useEffect(() => {
    connect(WS_URL);
  }, [connect]);

  const handlePress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    startRecording();
  }, [startRecording]);

  const handleRelease = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    stopRecording();
  }, [stopRecording]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        width: "100vw",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        background: "#1a1a2e",
        color: "#eee",
        gap: "32px",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "2.5rem", letterSpacing: "2px" }}>OASIS</h1>
        <p style={{ margin: "8px 0 0", opacity: 0.6, fontSize: "0.9rem" }}>Voice Assistant</p>
      </div>

      <div
        style={{
          fontSize: "1.2rem",
          fontWeight: 500,
          color: STATE_COLORS[state],
          minHeight: "1.6rem",
          transition: "color 0.3s ease",
        }}
      >
        {STATE_LABELS[state] ?? state}
      </div>

      <button
        onMouseDown={handlePress}
        onMouseUp={handleRelease}
        onMouseLeave={handleRelease}
        onTouchStart={handlePress}
        onTouchEnd={handleRelease}
        disabled={state === "processing" || state === "playing"}
        style={{
          width: "160px",
          height: "160px",
          borderRadius: "50%",
          border: "none",
          background: STATE_COLORS[state],
          cursor: state === "idle" || state === "recording" ? "pointer" : "not-allowed",
          fontSize: "1.1rem",
          color: "#fff",
          fontWeight: "bold",
          boxShadow:
            state === "recording"
              ? "0 0 0 15px rgba(255,74,74,0.3), 0 8px 32px rgba(0,0,0,0.5)"
              : "0 4px 24px rgba(0,0,0,0.4)",
          transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          transform: state === "recording" ? "scale(1.05)" : "scale(1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: "none",
        }}
      >
        <div style={{ pointerEvents: "none" }}>
          {state === "recording" ? "Release" : "Talk"}
        </div>
      </button>

      {error && (
        <div
          style={{
            color: "#ff6b6b",
            fontSize: "0.9rem",
            maxWidth: "80%",
            textAlign: "center",
            padding: "12px",
            background: "rgba(255, 107, 107, 0.1)",
            borderRadius: "8px",
            border: "1px solid rgba(255, 107, 107, 0.2)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ position: "fixed", bottom: "24px", opacity: 0.3, fontSize: "0.8rem" }}>
        {state === "idle" ? "Connected and ready" : ""}
      </div>
    </div>
  );
}
