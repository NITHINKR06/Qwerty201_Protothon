# ─── Voice endpoints (Member 3 — Sarvam integration) ─────────
import sys
import os
import tempfile
import shutil
import uuid
import sqlite3
import json
import datetime
from fastapi import UploadFile, File, HTTPException, FastAPI

# Robust path handling to find 'voice' and 'agents' modules
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

# Fallback definitions to avoid NameErrors if import fails
sarvam_stt = None
translate_text = None
detect_language = None

try:
    from voice.voice_handler import transcribe_audio as sarvam_stt, translate_text, detect_language
    VOICE_ENABLED = True
except ImportError:
    VOICE_ENABLED = False

from agents.consultation_agent import generate_clinical_record

app = FastAPI()

@app.post('/voice/transcribe')
async def voice_transcribe(file: UploadFile = File(...), language: str = 'unknown'):
    if not VOICE_ENABLED:
        raise HTTPException(503, 'Voice module not available')
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    transcript = sarvam_stt(tmp_path, source_lang=language)
    detected = detect_language(transcript)
    english = translate_text(transcript, source_lang=detected, target_lang='en-IN') if detected != 'en-IN' else transcript
    os.unlink(tmp_path)
    return {'transcript': transcript, 'detected_language': detected, 'english_translation': english}

@app.post('/voice/consult')
async def voice_consult(file: UploadFile = File(...), patient_id: str = '', language: str = 'unknown'):
    if not VOICE_ENABLED:
        raise HTTPException(503, 'Voice module not available')
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    transcript = sarvam_stt(tmp_path, source_lang=language)
    detected = detect_language(transcript)
    english = translate_text(transcript, source_lang=detected, target_lang='en-IN') if detected != 'en-IN' else transcript
    os.unlink(tmp_path)
    record = generate_clinical_record(english, patient_id)
    record_id = str(uuid.uuid4())
    conn = sqlite3.connect('vaidika.db')
    conn.execute('INSERT INTO consultations VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        (record_id, patient_id, english, json.dumps(record.symptoms), record.diagnosis,
         json.dumps(record.prescriptions), json.dumps(record.lab_tests), record.severity,
         json.dumps(record.route_to), record.followup, datetime.datetime.now().isoformat()))
    conn.commit(); conn.close()
    return {**record.model_dump(), 'record_id': record_id, 'original_transcript': transcript, 'detected_language': detected, 'english_translation': english}
