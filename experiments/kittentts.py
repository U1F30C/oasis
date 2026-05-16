# pip install https://github.com/KittenML/KittenTTS/releases/download/0.8.1/kittentts-0.8.1-py3-none-any.whl
# pip install soundfile

from kittentts import KittenTTS
import soundfile as sf

# Models: KittenML/kitten-tts-nano-0.8-fp32 (15M), kitten-tts-micro-0.8 (40M), kitten-tts-mini-0.8 (80M)
# Voices: Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo
model = KittenTTS("KittenML/kitten-tts-nano-0.8-fp32")

text = "Hello, this is a test of Kitten TTS running without a GPU."
audio = model.generate(text, voice="Luna", speed=1.0, clean_text=True)

out = "kittentts-out.wav"
sf.write(out, audio, 24000)
print(f"Saved {out}")
