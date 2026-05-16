import { useRef, useState, useCallback, useEffect } from "react";
import { captureAndSendAudio, playWavBuffer } from "../audio.js";
import type { ControlMessage, PipelineState } from "../../../shared/protocol.js";

export function useVoiceWS() {
  const ws = useRef<WebSocket | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const autoStopTimer = useRef<number | null>(null);
  const [state, setState] = useState<PipelineState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Audio streaming queue
  const audioQueue = useRef<ArrayBuffer[]>([]);
  const playbackRunning = useRef(false);
  const responseComplete = useRef(false);

  const drainQueue = useCallback(async () => {
    if (playbackRunning.current) return;
    playbackRunning.current = true;
    while (audioQueue.current.length > 0) {
      const chunk = audioQueue.current.shift()!;
      try {
        await playWavBuffer(chunk);
      } catch (err) {
        console.error("[Audio] Playback error:", err);
        setError(String(err));
      }
    }
    playbackRunning.current = false;
    if (responseComplete.current) setState("idle");
  }, []);

  const connect = useCallback((url: string) => {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) return;

    const socketUrl = url.startsWith("ws") ? url : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${url}`;

    ws.current = new WebSocket(socketUrl);
    ws.current.binaryType = "arraybuffer";

    // Pre-warm mic so first recording starts with zero acquisition latency
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(s => { streamRef.current = s; })
      .catch(() => {});

    ws.current.onopen = () => {
      console.log("[WS] Connected");
      setError(null);
    };

    ws.current.onmessage = (e: MessageEvent) => {
      if (typeof e.data === "string") {
        const msg = JSON.parse(e.data) as ControlMessage;
        if (msg.type === "processing") setState("processing");
        if (msg.type === "done") {
          responseComplete.current = true;
          if (!playbackRunning.current && audioQueue.current.length === 0) setState("idle");
        }
        if (msg.type === "error") {
          console.error("[WS] Server error:", msg.message);
          setError(msg.message);
          audioQueue.current = [];
          responseComplete.current = true;
          setState("idle");
        }
      } else {
        setState("playing");
        audioQueue.current.push(e.data as ArrayBuffer);
        drainQueue();
      }
    };

    ws.current.onerror = (e) => {
      console.error("[WS] WebSocket error:", e);
      setError("WebSocket connection error");
    };

    ws.current.onclose = () => {
      console.log("[WS] Disconnected");
      setState("idle");
    };
  }, [drainQueue]);

  const stopRecording = useCallback(() => {
    if (autoStopTimer.current !== null) {
      window.clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
    if (recorder.current && recorder.current.state === "recording") {
      recorder.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (state !== "idle") return;
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError("Not connected to server");
      return;
    }

    // Reset queue state for new response
    audioQueue.current = [];
    responseComplete.current = false;

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const stream = streamRef.current;
      chunks.current = [];
      recorder.current = new MediaRecorder(stream);

      recorder.current.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.current.onstop = async () => {
        const blob = new Blob(chunks.current, { type: recorder.current!.mimeType });
        try {
          await captureAndSendAudio(blob, ws.current!);
        } catch (err) {
          console.error("[Audio] Capture/send error:", err);
          setError(String(err));
          setState("idle");
        }
      };

      recorder.current.start();
      setState("recording");
      setError(null);

      autoStopTimer.current = window.setTimeout(() => {
        if (recorder.current && recorder.current.state === "recording") {
          console.warn("[useVoiceWS] 30s limit reached — auto-stopping");
          stopRecording();
        }
      }, 30_000);
    } catch (err) {
      console.error("[Audio] getUserMedia error:", err);
      setError("Microphone access denied");
    }
  }, [state, stopRecording]);

  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
      if (autoStopTimer.current) window.clearTimeout(autoStopTimer.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const clearHistory = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "clear" }));
    }
  }, []);

  return { state, error, connect, startRecording, stopRecording, clearHistory };
}
