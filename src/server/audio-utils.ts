import os from "os";
import path from "path";
import fs from "fs";
import { readAudio } from "./stt.js";

export function isWavBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46    // F
  );
}

export async function bufferToFloat32(data: Buffer): Promise<Float32Array> {
  if (isWavBuffer(data)) {
    const tmpPath = path.join(os.tmpdir(), `oasis-${Date.now()}.wav`);
    fs.writeFileSync(tmpPath, data);
    try {
      return await readAudio(tmpPath, 16000);
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  }
  return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
}
