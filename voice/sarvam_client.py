import os
import base64
from sarvamai import SarvamAI
from dotenv import load_dotenv

load_dotenv()

# Initialize the Sarvam AI SDK Client
api_key = os.getenv("SARVAM_API_KEY")
if not api_key:
    print("Warning: No SARVAM_API_KEY found in environment variables.")

client = SarvamAI(api_subscription_key=api_key) if api_key else None


def transcribe_audio(audio_file_path: str, source_lang: str = "hi-IN") -> str:
    """
    Speech-to-text using Sarvam Saarika v2.5.
    Converts a local audio file to text.
    """
    if not client:
        return "[Mock STT]: Sarvam Client Not Initialized"

    try:
        with open(audio_file_path, "rb") as f:
            response = client.speech_to_text.transcribe(
                file=f,
                model="saarika:v2.5",
                language_code=source_lang,
            )
        return response.transcript
    except Exception as e:
        print(f"Error in transcribe_audio: {e}")
        return f"[STT Error]: {str(e)}"


def detect_language(text: str) -> str:
    """
    Language detection using Sarvam text.identify_language.
    Returns a BCP-47 language code (e.g., 'hi-IN').
    """
    if not client:
        return "en-IN"

    try:
        response = client.text.identify_language(input=text)
        # Response has .language_code
        return response.language_code
    except Exception as e:
        print(f"Error in detect_language: {e}")
        return "unknown"


def translate_text(text: str, source_lang: str = "hi-IN", target_lang: str = "en-IN") -> str:
    """
    Translation from regional languages to English using Sarvam.
    """
    if not client:
        return f"[Mock Translation {source_lang}->{target_lang}]: {text}"

    try:
        response = client.text.translate(
            input=text,
            source_language_code=source_lang,
            target_language_code=target_lang,
        )
        return response.translated_text
    except Exception as e:
        print(f"Error in translate_text: {e}")
        return text


def build_transcript(patient_text: str, doctor_text: str) -> str:
    """
    Builds a unified consultation transcript combining patient and doctor strings.
    """
    transcript = f"""--- CONSULTATION TRANSCRIPT ---
[Doctor]: {doctor_text}
[Patient]: {patient_text}
--------------------------------"""
    return transcript


def text_to_speech(text: str, language: str = "hi-IN", output_file: str = "output_tts.wav") -> str:
    """
    Text-to-speech using Sarvam Bulbul v2.
    Generates audio for the provided text and saves it to a WAV file.
    """
    if not client:
        print("[Mock TTS]: Sarvam Client Not Initialized. Skipping audio generation.")
        return ""

    try:
        response = client.text_to_speech.convert(
            text=text,
            target_language_code=language,
            speaker="anushka",  # bulbul:v2 female voice
            model="bulbul:v2",
        )

        # Response contains a list of base64-encoded audio chunks in `audios`
        if response.audios and len(response.audios) > 0:
            audio_bytes = base64.b64decode(response.audios[0])
            with open(output_file, "wb") as f:
                f.write(audio_bytes)
            return output_file
        else:
            print("TTS returned no audio data.")
            return ""
    except Exception as e:
        print(f"Error in text_to_speech: {e}")
        return ""
