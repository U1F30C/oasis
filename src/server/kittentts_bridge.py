#!/usr/bin/env python3
# pip install https://github.com/KittenML/KittenTTS/releases/download/0.8.1/kittentts-0.8.1-py3-none-any.whl
import sys
import struct
import numpy as np
from kittentts import KittenTTS

def read_exactly(n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        chunk = sys.stdin.buffer.read(n - len(buf))
        if not chunk:
            raise EOFError
        buf += chunk
    return buf

model_name = sys.argv[1] if len(sys.argv) > 1 else "KittenML/kitten-tts-nano-0.8-fp32"
voice     = sys.argv[2] if len(sys.argv) > 2 else "Luna"

model = KittenTTS(model_name)

sys.stdout.buffer.write(b"READY\n")
sys.stdout.buffer.flush()

while True:
    try:
        text_len = struct.unpack("<I", read_exactly(4))[0]
        text = read_exactly(text_len).decode("utf-8")
        audio = model.generate(text, voice=voice, clean_text=True)
        pcm = np.array(audio, dtype=np.float32).tobytes()
        sys.stdout.buffer.write(struct.pack("<I", len(pcm)))
        sys.stdout.buffer.write(pcm)
        sys.stdout.buffer.flush()
    except EOFError:
        break
    except Exception as e:
        print(f"[kittentts_bridge] error: {e}", file=sys.stderr)
        sys.stdout.buffer.write(struct.pack("<I", 0))
        sys.stdout.buffer.flush()
