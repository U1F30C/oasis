/**
 * Browser audio utilities for Oasis voice client.
 *
 * captureAndSendAudio: decode MediaRecorder blob → resample to 16kHz mono → send PCM over WebSocket
 * playWavBuffer: decode WAV bytes from server → play via Web Audio API
 */

/**
 * Encode a Float32Array of mono 16kHz PCM samples as a WAV file (IEEE float, 32-bit).
 * Sending WAV lets the server use its existing readAudio() path for all clients.
 */
function encodeWav(pcm: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 4; // Float32
  const dataSize = pcm.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  // RIFF header
  view.setUint32(0, 0x52494646, false);  // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false);  // "WAVE"
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);           // IEEE_FLOAT
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 32, true);
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);
  new Float32Array(buf, 44).set(pcm);

  return buf;
}

/**
 * Decode a MediaRecorder Blob (webm/opus or ogg/opus), resample to 16kHz mono Float32Array,
 * encode as WAV, and send as a binary WebSocket frame.
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

  // Send as WAV so the server uses readAudio() for both browser and IoT paths.
  // Raw pcm.buffer is unsafe — byteOffset may be non-zero, sending garbage before the audio.
  ws.send(encodeWav(pcm, TARGET_RATE));

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
