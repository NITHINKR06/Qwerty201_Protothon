import sys
import os
import queue
import wave
import numpy as np
import sounddevice as sd
import subprocess
from sarvam_client import transcribe_audio, detect_language, translate_text, text_to_speech

SAMPLE_RATE = 16000
CHANNELS = 1

def play_audio(filename):
    """Play audio file using macOS built-in player."""
    try:
        if os.path.exists(filename):
            subprocess.run(["afplay", filename], check=True)
    except Exception as e:
        print(f"Error playing audio: {e}")

def record_until_keypress(role, filename):
    """
    Records audio until the user presses Enter.
    """
    input(f"\n[Press Enter to start recording {role}] ")
    print("🎤 Recording... [Press Enter to stop recording] ", end="", flush=True)
    
    q = queue.Queue()
    recording = [True]
    
    def callback(indata, frames, time, status):
        if status:
            print(status, file=sys.stderr)
        if recording[0]:
            q.put(indata.copy())

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, dtype='int16', callback=callback):
        input()
        recording[0] = False
        
    print("✅ Recording finished.")
    
    audio_data = []
    while not q.empty():
        audio_data.append(q.get())
        
    if not audio_data:
        return None
        
    audio_data = np.concatenate(audio_data, axis=0)
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_data.tobytes())
        
    return filename

def main():
    print("=" * 60)
    print("=== VaidikaAI Consultation (Doctor & Patient) ===")
    print("Pre-selected Patient Language: Hindi (hi-IN)")
    print("The system will auto-detect who is speaking based on language.")
    print("=" * 60)
    
    conversation_log = []
    patient_language = "hi-IN"  # As chosen from frontend
    
    while True:
        print("\n" + "-"*60)
        action = input("Press [Enter] to Start recording (or type 'q' to end consult): ").strip().lower()
        if action in ['q', 'quit', 'exit']:
            break
            
        audio_file = record_until_keypress("Conversation", "temp_audio.wav")
        if not audio_file: continue
        
        print("\n>> 📝 Analyzing speech...")
        
        # We transcribe using "unknown" so Sarvam tells us if they spoke English (Doctor) or Hindi (Patient)
        transcript = transcribe_audio(audio_file, source_lang="unknown")
        
        if not transcript.strip():
            print("⚠️ No speech detected.")
            continue
            
        detected = detect_language(transcript)
        
        if detected == "en-IN":
            # Doctor Spoke
            print(f"[Doctor]: {transcript}")
            conversation_log.append(f"Doctor: {transcript}")
            
            print(f"\n>> 🌐 Translating to Patient (hi-IN)...")
            translated = translate_text(transcript, source_lang="en-IN", target_lang=patient_language)
            print(f"[Translated]: {translated}")
            
            # Play translation instantly
            tts_file = text_to_speech(translated, language=patient_language, output_file="patient_tts.wav")
            if tts_file:
                play_audio(tts_file)
                
        else:
            # Patient Spoke (Hindi or other regional)
            print(f"[Patient (Regional)]: {transcript}")
            
            print("\n>> 🌐 Translating to English for Doctor...")
            translated = translate_text(transcript, source_lang=detected, target_lang="en-IN")
            print(f"[Patient (English)]: {translated}")
            conversation_log.append(f"Patient: {translated}")

    # Output generation for the next AI Model
    print("\n\n" + "="*60)
    print("=== FINAL CONSULTATION TRANSCRIPT ===")
    final_text = "\n".join(conversation_log)
    print(final_text)
    print("=" * 60)
    
    with open("consultation_transcript.txt", "w") as f:
        f.write(final_text)
    print("💾 Saved full conversation to 'consultation_transcript.txt' for the prescription AI model.")

if __name__ == "__main__":
    main()
