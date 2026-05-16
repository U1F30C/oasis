# Oasis

Local voice assistant — press to talk, get a spoken response. Runs entirely on your machine.

## Requirements

- Node.js 22+
- Ollama running locally (or on a LAN host)
- Python 3.8+ with a virtual environment (only if using KittenTTS)

## Setup

### 1. Install Node dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example and edit:

```bash
cp .env.example .env
```

Required:

| Variable | Description |
|---|---|
| `OLLAMA_BASE_URL` | Ollama API endpoint, e.g. `http://localhost:11434/api` |

Optional:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express server port |
| `TTS_MODEL` | `onnx-community/Kokoro-82M-ONNX` | TTS model (see below) |
| `TTS_VOICE` | `af_heart` | Voice name (Kokoro/KittenTTS only) |

### 3. TTS model options

**Kokoro** (default, JS-native, no extra setup):
```
TTS_MODEL=onnx-community/Kokoro-82M-ONNX
TTS_VOICE=af_heart   # af_bella, am_eric, bm_george, bf_emma, ...
```

**KittenTTS** (Python bridge, higher quality, requires venv):
```
TTS_MODEL=KittenML/kitten-tts-nano-0.8-fp32
TTS_VOICE=Luna   # Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo
```

Set up the Python venv once:
```bash
python3 -m venv .venv
.venv/bin/pip install https://github.com/KittenML/KittenTTS/releases/download/0.8.1/kittentts-0.8.1-py3-none-any.whl
```

The server auto-detects `.venv/bin/python3` and uses it for the bridge process.

**speecht5 / mms** (JS-native, no extra setup):
```
TTS_MODEL=Xenova/speecht5_tts
# or
TTS_MODEL=Xenova/mms-tts-eng
```

### 4. Run

```bash
npm run dev
```

Open `http://localhost:5173`. Press and hold the button to speak, release to get a response.

ML models are downloaded from Hugging Face on first run and cached locally.

## Experiments

Standalone scripts for testing individual components:

```bash
npx tsx experiments/kokoro.ts      # Kokoro TTS
npx tsx experiments/kittentts.ts   # KittenTTS via transformers.js (v0.1 — limited)
python3 experiments/kittentts.py   # KittenTTS via Python (v0.8 — requires venv)
npx tsx experiments/stt.ts         # Whisper STT
npx tsx experiments/llm.ts         # Ollama LLM
npx tsx experiments/tts.ts         # speecht5 / mms TTS
```
