import sounddevice as sd
import numpy as np
import wave
from sarvam_client import transcribe_audio, detect_language, translate_text, text_to_speech, build_transcript

SAMPLE_RATE = 16000
CHANNELS = 1

def record_audio(filename="test_audio.wav", record_seconds=4):
    """
    Records audio from the default microphone using sounddevice and saves it to a WAV file.
    """
    print(f"\n🎤 Recording for {record_seconds} seconds... Speak now!")

    try:
        audio_data = sd.rec(
            int(record_seconds * SAMPLE_RATE),
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16"
        )
        sd.wait()
        print("✅ Recording finished.")

        with wave.open(filename, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_data.tobytes())

        return filename
    except Exception as e:
        print(f"Error recording audio: {e}")
        return None


if __name__ == "__main__":
    print("=== Sarvam AI Voice Pipeline Tester ===")
    print("Tip: Speak in ANY Indian language — it will be auto-detected!")

    # 1. Record audio
    audio_file = record_audio(record_seconds=4)

    if audio_file:
        try:
            # 2. Transcribe using auto-detection (unknown = Sarvam auto-detects)
            print("\n1. Transcribing (auto-detecting language)...")
            patient_transcript = transcribe_audio(audio_file, source_lang="unknown")
            print(f"   🗣️  Heard: {patient_transcript}")

            import sys
            if not patient_transcript or patient_transcript.strip() == "":
                print("\n⚠️  No speech detected. Skipping the rest of the pipeline.")
                sys.exit(0)

            # 3. Detect the language of the transcribed text
            print("\n2. Detecting language...")
            detected_lang = detect_language(patient_transcript)
            print(f"   🌍  Detected language: {detected_lang}")

            # 4. Translate to English for the doctor
            print("\n3. Translating to English for the doctor...")
            english_transcript = translate_text(patient_transcript, source_lang=detected_lang, target_lang="en-IN")
            print(f"   🌐  Translated: {english_transcript}")

            # 5. Build consultation transcript
            print("\n4. Building medical transcript...")
            doctor_response = "How long have you had this fever?"
            final_transcript = build_transcript(patient_text=english_transcript, doctor_text=doctor_response)
            print(f"\n{final_transcript}")

            # 6. Translate doctor's response back to patient's language and speak it
            print("\n5. Speaking doctor's response in patient's language...")
            doctor_local = translate_text(doctor_response, source_lang="en-IN", target_lang=detected_lang)
            print(f"   🔊  Speaking: {doctor_local}")
            tts_file = text_to_speech(doctor_local, language=detected_lang, output_file="doctor_response.wav")
            if tts_file:
                print(f"   🎧  Audio saved to {tts_file}")

            print("\n✅ Pipeline complete!")

        except Exception as e:
            print(f"\n❌ Error in pipeline: {e}")
            print("Did you remember to set your SARVAM_API_KEY in the .env file?")
