/**
 * Browser audio utilities for Oasis voice client.
 *
 * captureAndSendAudio: decode MediaRecorder blob → resample to 16kHz mono → send PCM over WebSocket
 * playWavBuffer: decode WAV bytes from server → play via Web Audio API
 */

/**
 * Decode a MediaRecorder Blob (webm/opus or ogg/opus), resample to 16kHz mono Float32Array,
 * and send as a binary WebSocket frame.
 */
export async function captureAndSendAudio(blob: Blob, ws: WebSocket): Promise<void> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    await audioCtx.close();
    throw new Error(`Failed to decode audio blob: ${err}`);
  }

  const TARGET_RATE = 16000;
  const offlineCtx = new OfflineAudioContext(
    1, // mono
    Math.ceil(decoded.duration * TARGET_RATE),
    TARGET_RATE,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();

  const resampled = await offlineCtx.startRendering();
  const pcm = resampled.getChannelData(0); // Float32Array at 16kHz mono

  ws.send(pcm.buffer); // send underlying ArrayBuffer as binary frame

  await audioCtx.close();
}

/**
 * Decode WAV bytes received from the server and play via the Web Audio API.
 * Resolves when playback ends.
 */
export async function playWavBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

  let buffer: AudioBuffer;
  try {
    buffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    await audioCtx.close();
    throw new Error(`Failed to decode server WAV: ${err}`);
  }

  return new Promise((resolve) => {
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.onended = () => {
      audioCtx.close();
      resolve();
    };
    src.start();
  });
}
