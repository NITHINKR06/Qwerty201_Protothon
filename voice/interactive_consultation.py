"""
VaidikaAI - Auto Voice Consultation
Records 5 seconds per turn, 2 second pause between turns.
Auto-detects Doctor (English) vs Patient (regional language).
Saves structured JSON transcript for the prescription AI model.
Press Ctrl+C to end the consultation.
"""

import sys
import os
import wave
import time
import json
import numpy as np
import sounddevice as sd
import subprocess
from datetime import datetime
from sarvam_client import transcribe_audio, detect_language, translate_text, text_to_speech

SAMPLE_RATE = 16000
CHANNELS = 1
RECORD_SECONDS = 5
PAUSE_SECONDS = 2

SUPPORTED_LANGUAGES = {
    "hi": ("hi-IN", "Hindi"),
    "ta": ("ta-IN", "Tamil"),
    "te": ("te-IN", "Telugu"),
    "bn": ("bn-IN", "Bengali"),
    "kn": ("kn-IN", "Kannada"),
    "ml": ("ml-IN", "Malayalam"),
    "mr": ("mr-IN", "Marathi"),
    "gu": ("gu-IN", "Gujarati"),
    "pa": ("pa-IN", "Punjabi"),
    "od": ("od-IN", "Odia"),
}


def play_audio(filename):
    """Play audio file using macOS built-in player."""
    try:
        if os.path.exists(filename):
            subprocess.run(["afplay", filename], check=True)
    except Exception as e:
        print(f"Error playing audio: {e}")


def record_fixed(filename="temp_audio.wav", duration=RECORD_SECONDS):
    """Record audio for a fixed duration."""
    print(f"🎤 Recording for {duration}s...", end="", flush=True)
    audio_data = sd.rec(
        int(duration * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16"
    )
    sd.wait()
    print(" ✅")

    with wave.open(filename, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_data.tobytes())

    return filename


def format_timestamp(seconds):
    """Convert seconds to [HH:MM:SS] format."""
    mins, secs = divmod(int(seconds), 60)
    hrs, mins = divmod(mins, 60)
    return f"[{hrs:02d}:{mins:02d}:{secs:02d}]"


def select_language():
    """Prompt user to select the patient's preferred language."""
    print("\n📋 Select Patient's Preferred Language:")
    for code, (_, name) in SUPPORTED_LANGUAGES.items():
        print(f"   {code} → {name}")

    while True:
        choice = input("\nEnter language code (e.g. hi, ta, te): ").strip().lower()
        if choice in SUPPORTED_LANGUAGES:
            lang_code, lang_name = SUPPORTED_LANGUAGES[choice]
            print(f"✅ Selected: {lang_name} ({lang_code})")
            return lang_code, lang_name
        else:
            print("❌ Invalid choice. Try again.")


def main():
    print("=" * 60)
    print("  VaidikaAI — Auto Voice Consultation")
    print("=" * 60)

    patient_lang_code, patient_lang_name = select_language()

    print(f"\n  Patient Language: {patient_lang_name} ({patient_lang_code})")
    print(f"  Records {RECORD_SECONDS}s per turn, {PAUSE_SECONDS}s pause between.")
    print("  Press Ctrl+C to end the consultation.")
    print("=" * 60)

    conversation_log = []     # For JSON output
    readable_log = []         # For printed transcript
    start_time = time.time()
    turn_number = 0

    try:
        while True:
            turn_number += 1
            elapsed = time.time() - start_time
            timestamp = format_timestamp(elapsed)

            print(f"\n--- Turn {turn_number} {timestamp} ---")

            audio_file = record_fixed("temp_audio.wav")

            transcript = transcribe_audio(audio_file, source_lang="unknown")

            if not transcript.strip() or transcript.startswith("[STT Error]"):
                print("⚠️  No speech detected, skipping.")
                time.sleep(PAUSE_SECONDS)
                continue

            detected = detect_language(transcript)

            if detected == "en-IN":
                # Doctor spoke English
                print(f"[Doctor]: {transcript}")

                translated = translate_text(transcript, source_lang="en-IN", target_lang=patient_lang_code)
                print(f"[{patient_lang_name}]: {translated}")

                conversation_log.append({
                    "turn": turn_number,
                    "role": "doctor",
                    "text": transcript,
                    "translated": translated,
                    "language": "en-IN",
                    "timestamp": timestamp,
                })
                readable_log.append(f"{timestamp} [Doctor]: {transcript}")

                tts_file = text_to_speech(translated, language=patient_lang_code, output_file="patient_tts.wav")
                if tts_file:
                    play_audio(tts_file)
            else:
                # Patient spoke regional language
                print(f"[Patient ({detected})]: {transcript}")

                translated = translate_text(transcript, source_lang=detected, target_lang="en-IN")
                print(f"[English]: {translated}")

                conversation_log.append({
                    "turn": turn_number,
                    "role": "patient",
                    "text": transcript,
                    "translated": translated,
                    "language": detected,
                    "timestamp": timestamp,
                })
                readable_log.append(f"{timestamp} [Patient]: {translated}")

            print(f"⏸️  {PAUSE_SECONDS}s pause...")
            time.sleep(PAUSE_SECONDS)

    except KeyboardInterrupt:
        pass

    # Print readable transcript
    print("\n\n" + "=" * 60)
    print("=== CONSULTATION TRANSCRIPT ===")
    for line in readable_log:
        print(line)
    print("=" * 60)

    # Save structured JSON for prescription AI
    output = {
        "consultation_date": datetime.now().isoformat(),
        "patient_language": patient_lang_code,
        "total_turns": len(conversation_log),
        "transcript": conversation_log,
    }

    with open("consultation_transcript.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print("💾 Saved JSON → consultation_transcript.json")

    # Also save readable text version
    with open("consultation_transcript.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(readable_log))
    print("💾 Saved text → consultation_transcript.txt")


if __name__ == "__main__":
    main()
