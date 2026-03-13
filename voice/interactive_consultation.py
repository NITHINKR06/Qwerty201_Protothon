"""
VaidikaAI - Auto Voice Consultation
Records 5 seconds per turn, 2 second pause between turns.
Auto-detects Doctor (English) vs Patient (Hindi).
Press Ctrl+C to end the consultation.
"""

import sys
import os
import wave
import time
import numpy as np
import sounddevice as sd
import subprocess
from sarvam_client import transcribe_audio, detect_language, translate_text, text_to_speech

SAMPLE_RATE = 16000
CHANNELS = 1
RECORD_SECONDS = 5  # Each turn records for 5 seconds
PAUSE_SECONDS = 2   # 2 second gap between turns


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


def main():
    print("=" * 60)
    print("  VaidikaAI — Auto Voice Consultation")
    print("  Patient Language: Hindi (hi-IN)")
    print(f"  Records {RECORD_SECONDS}s per turn, {PAUSE_SECONDS}s pause between.")
    print("  Press Ctrl+C to end the consultation.")
    print("=" * 60)

    conversation_log = []
    patient_language = "hi-IN"
    turn_number = 0

    try:
        while True:
            turn_number += 1
            print(f"\n--- Turn {turn_number} ---")

            audio_file = record_fixed("temp_audio.wav")

            transcript = transcribe_audio(audio_file, source_lang="unknown")

            # Skip if empty or error
            if not transcript.strip() or transcript.startswith("[STT Error]"):
                print("⚠️  No speech detected, skipping.")
                time.sleep(PAUSE_SECONDS)
                continue

            detected = detect_language(transcript)

            if detected == "en-IN":
                # Doctor spoke English
                print(f"[Doctor]: {transcript}")
                conversation_log.append(f"Doctor: {transcript}")

                translated = translate_text(transcript, source_lang="en-IN", target_lang=patient_language)
                print(f"[Hindi]: {translated}")

                tts_file = text_to_speech(translated, language=patient_language, output_file="patient_tts.wav")
                if tts_file:
                    play_audio(tts_file)
            else:
                # Patient spoke regional language
                print(f"[Patient]: {transcript}")

                translated = translate_text(transcript, source_lang=detected, target_lang="en-IN")
                print(f"[English]: {translated}")
                conversation_log.append(f"Patient: {translated}")

            # 2 second pause before next turn
            print(f"⏸️  {PAUSE_SECONDS}s pause...")
            time.sleep(PAUSE_SECONDS)

    except KeyboardInterrupt:
        pass

    # Save transcript
    print("\n\n" + "=" * 60)
    print("=== FINAL CONSULTATION TRANSCRIPT ===")
    final_text = "\n".join(conversation_log)
    print(final_text)
    print("=" * 60)

    with open("consultation_transcript.txt", "w") as f:
        f.write(final_text)
    print("💾 Saved to 'consultation_transcript.txt'")


if __name__ == "__main__":
    main()
