import os
import json
import httpx
from dotenv import load_dotenv

# Load key from .env
load_dotenv()
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

if not SARVAM_API_KEY:
    print("[FAIL] ERROR: SARVAM_API_KEY is not set in the .env file.")
    exit(1)

print(f"[OK] Found SARVAM_API_KEY: {SARVAM_API_KEY[:5]}...{SARVAM_API_KEY[-4:] if len(SARVAM_API_KEY)>10 else ''}")
print("-" * 50)

def test_language_detection():
    print("Testing Language Detection (Hindi text)...")
    try:
        with httpx.Client(timeout=10) as http:
            resp = http.post(
                "https://api.sarvam.ai/text/identify-language",
                headers={"api-subscription-key": SARVAM_API_KEY, "Content-Type": "application/json"},
                json={"input": "नमस्ते, आप कैसे हैं?"}
            )
        if resp.status_code == 200:
            print(f"[OK] Success! Detected Language: {resp.json().get('language_code')}")
        else:
            print(f"[FAIL] Failed (Status {resp.status_code}): {resp.text}")
    except Exception as e:
        print(f"[FAIL] Exception: {e}")

def test_translation():
    print("\nTesting Translation (Hindi to English)...")
    try:
        with httpx.Client(timeout=15) as http:
            resp = http.post(
                "https://api.sarvam.ai/translate",
                headers={"api-subscription-key": SARVAM_API_KEY, "Content-Type": "application/json"},
                json={
                    "input": "नमस्ते, आप कैसे हैं?",
                    "source_language_code": "hi-IN",
                    "target_language_code": "en-IN",
                    "speaker_gender": "Male",
                    "mode": "formal",
                    "model": "mayura:v1",
                    "enable_preprocessing": True
                }
            )
        if resp.status_code == 200:
            print(f"[OK] Success! Translated Text: {resp.json().get('translated_text')}")
        else:
            print(f"[FAIL] Failed (Status {resp.status_code}): {resp.text}")
    except Exception as e:
        print(f"[FAIL] Exception: {e}")

def test_tts():
    print("\nTesting Text-to-Speech (Hindi)...")
    try:
        with httpx.Client(timeout=30) as http:
            resp = http.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"api-subscription-key": SARVAM_API_KEY, "Content-Type": "application/json"},
                json={
                    "inputs": ["नमस्ते, मैं एक एआई हूँ।"],
                    "target_language_code": "hi-IN",
                    "speaker": "meera",
                    "pitch": 0,
                    "pace": 1.0,
                    "loudness": 1.5,
                    "speech_sample_rate": 8000,
                    "enable_preprocessing": True,
                    "model": "bulbul:v1"
                }
            )
        if resp.status_code == 200:
            audios = resp.json().get("audios", [])
            if audios:
                print(f"[OK] Success! Generated base64 audio. Length: {len(audios[0])} chars")
            else:
                print("[FAIL] Failed: Returned 200 but no 'audios' array.")
        else:
            print(f"[FAIL] Failed (Status {resp.status_code}): {resp.text}")
    except Exception as e:
        print(f"[FAIL] Exception: {e}")

if __name__ == "__main__":
    print("Starting Sarvam AI API Tests...\n")
    test_language_detection()
    test_translation()
    test_tts()
    print("\n" + "-" * 50)
    print("Testing Complete.")
