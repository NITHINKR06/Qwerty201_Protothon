"""
Sarvam AI Voice Handler
========================
Provides TTS, STT, and Translation using the Sarvam AI API.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_BASE_URL = "https://api.sarvam.ai"

HEADERS = {
    "api-subscription-key": SARVAM_API_KEY,
    "Content-Type": "application/json",
}


def text_to_speech(text: str, language_code: str = "hi-IN", speaker: str = "meera") -> bytes:
    """Convert text to speech using Sarvam AI.

    Args:
        text: The text to convert to speech.
        language_code: BCP-47 language code (default: Hindi).
        speaker: Voice model to use.

    Returns:
        Audio bytes (WAV format).
    """
    payload = {
        "inputs": [text],
        "target_language_code": language_code,
        "speaker": speaker,
        "model": "bulbul:v1",
    }
    response = requests.post(
        f"{SARVAM_BASE_URL}/text-to-speech",
        json=payload,
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def speech_to_text(audio_file_path: str, language_code: str = "hi-IN") -> str:
    """Transcribe audio to text using Sarvam AI.

    Args:
        audio_file_path: Path to the audio file.
        language_code: BCP-47 language code.

    Returns:
        Transcribed text.
    """
    with open(audio_file_path, "rb") as f:
        files = {"file": (os.path.basename(audio_file_path), f, "audio/wav")}
        data = {
            "language_code": language_code,
            "model": "saarika:v2",
        }
        response = requests.post(
            f"{SARVAM_BASE_URL}/speech-to-text",
            files=files,
            data=data,
            headers={"api-subscription-key": SARVAM_API_KEY},
            timeout=30,
        )
    response.raise_for_status()
    return response.json().get("transcript", "")


def translate_text(text: str, source_lang: str = "en-IN", target_lang: str = "hi-IN") -> str:
    """Translate text between languages using Sarvam AI.

    Args:
        text: Text to translate.
        source_lang: Source language code.
        target_lang: Target language code.

    Returns:
        Translated text.
    """
    payload = {
        "input": text,
        "source_language_code": source_lang,
        "target_language_code": target_lang,
        "model": "mayura:v1",
    }
    response = requests.post(
        f"{SARVAM_BASE_URL}/translate",
        json=payload,
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("translated_text", "")


if __name__ == "__main__":
    # Quick test
    print("🎙️  Sarvam Voice Handler loaded.")
    print(f"   API Key configured: {'✅' if SARVAM_API_KEY else '❌'}")
