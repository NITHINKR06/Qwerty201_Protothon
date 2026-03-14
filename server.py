"""
VaidikaAI — FastAPI Backend Server
Run: python server.py
"""

import os, sys, uuid, json, sqlite3, tempfile, base64, threading, subprocess, io
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import httpx, uvicorn
from voice import voice_handler as vh

load_dotenv()
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")

app = FastAPI(title="VaidikaAI Backend", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

DB_PATH = os.path.join(PROJECT_ROOT, "vaidika.db")
_db_lock = threading.Lock()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db(); c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS patients (
        patient_id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER, gender TEXT,
        language TEXT DEFAULT 'Hindi', aadhaar TEXT, allergies TEXT DEFAULT '[]',
        history TEXT DEFAULT '[]', created_at TEXT NOT NULL)""")
    c.execute("""CREATE TABLE IF NOT EXISTS visits (
        id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, token_number INTEGER NOT NULL,
        date TEXT NOT NULL, chief_complaint TEXT DEFAULT '', severity TEXT DEFAULT 'STABLE',
        status TEXT DEFAULT 'registered', assigned_doctor TEXT, assigned_room TEXT,
        vitals TEXT DEFAULT '{}', timeline TEXT DEFAULT '[]', created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, visit_id TEXT, transcript TEXT,
        symptoms TEXT DEFAULT '[]', diagnosis TEXT, prescriptions TEXT DEFAULT '[]',
        lab_tests TEXT DEFAULT '[]', severity TEXT DEFAULT 'STABLE', route_to TEXT DEFAULT '[]',
        followup TEXT, clinical_notes TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS dept_updates (
        id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, dept TEXT NOT NULL,
        action TEXT NOT NULL, data TEXT DEFAULT '{}', updated_at TEXT NOT NULL)""")
    c.execute("""CREATE TABLE IF NOT EXISTS token_counter (
        id INTEGER PRIMARY KEY CHECK (id=1), last_num INTEGER NOT NULL DEFAULT 0)""")
    c.execute("INSERT OR IGNORE INTO token_counter (id, last_num) VALUES (1, 45)")
    c.execute("""CREATE TABLE IF NOT EXISTS patient_id_counter (
        id INTEGER PRIMARY KEY CHECK (id=1), last_num INTEGER NOT NULL DEFAULT 0)""")
    c.execute("INSERT OR IGNORE INTO patient_id_counter (id, last_num) VALUES (1, 145)")
    conn.commit(); conn.close()

init_db()

def next_token():
    with _db_lock:
        conn = get_db()
        conn.execute("UPDATE token_counter SET last_num=last_num+1 WHERE id=1")
        row = conn.execute("SELECT last_num FROM token_counter WHERE id=1").fetchone()
        conn.commit(); conn.close(); return row[0]

def next_patient_id():
    with _db_lock:
        conn = get_db()
        conn.execute("UPDATE patient_id_counter SET last_num=last_num+1 WHERE id=1")
        row = conn.execute("SELECT last_num FROM patient_id_counter WHERE id=1").fetchone()
        conn.commit(); conn.close(); return f"VK-2025-{row[0]:05d}"

class PatientRegister(BaseModel):
    name: str; age: int; gender: str = "M"; language: str = "Hindi"
    aadhaar: Optional[str] = None; allergies: Optional[list] = []; history: Optional[list] = []

class VisitCreate(BaseModel):
    patient_id: str; chief_complaint: str = ""; language: str = "Hindi"
    token_number: Optional[int] = None

class VisitUpdate(BaseModel):
    status: Optional[str] = None; severity: Optional[str] = None
    assigned_doctor: Optional[str] = None; assigned_room: Optional[str] = None
    vitals: Optional[dict] = None; timeline_event: Optional[dict] = None

class TTSRequest(BaseModel):
    text: str; language: str = "hi-IN"

class ConsultationComplete(BaseModel):
    visit_id: str; patient_id: str; patient_name: str
    language: Optional[str] = "Hindi"; diagnosis: Optional[str] = None
    tests: Optional[list] = []; prescriptions: Optional[list] = []
    follow_up_date: Optional[str] = None

class DeptUpdateRequest(BaseModel):
    patient_id: str; dept: str; action: str; data: Optional[dict] = {}

class TranscribeRequest(BaseModel):
    audio_base64: str; language: str = "hi-IN"

# ─── Sarvam helpers ───────────────────────────────────────────────────────────

def sarvam_stt(wav_path: str, source_lang: str = "hi-IN") -> str:
    return vh.transcribe_audio(wav_path, source_lang=source_lang)

def sarvam_detect_lang(text: str) -> str:
    return vh.detect_language(text)

def sarvam_translate(text: str, source_lang: str, target_lang: str) -> str:
    return vh.translate_text(text, source_lang=source_lang, target_lang=target_lang)

def sarvam_tts(text: str, language: str = "hi-IN") -> str:
    # We need base64 for the frontend, so we'll do a small local read
    try:
        temp_audio = "temp_tts.wav"
        output_path = vh.text_to_speech(text, language=language, output_file=temp_audio)
        if output_path and os.path.exists(output_path):
            with open(output_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            os.remove(output_path)
            return b64
    except Exception as e:
        print(f"[TTS] SDK wrapper error: {e}")
    return ""


def to_wav(audio_bytes: bytes, suffix: str) -> Optional[str]:
    """Convert any audio bytes to 16kHz mono WAV. Returns path or None."""
    fd, in_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    wav_path = in_path + ".wav"
    try:
        with open(in_path, "wb") as f: f.write(audio_bytes)
        try:
            import imageio_ffmpeg
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg = "ffmpeg"
        result = subprocess.run(
            [ffmpeg, "-y", "-i", in_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, timeout=20)
        if result.returncode != 0:
            err = result.stderr.decode("utf-8", errors="replace")
            lines = [l for l in err.splitlines() if l.strip() and not l.startswith(" ") and not l.startswith("f")]
            print(f"[ffmpeg] FAILED: {lines[-1] if lines else err[:100]}")
            return None
        size = os.path.getsize(wav_path)
        print(f"[ffmpeg] OK -> {size} bytes WAV")
        return wav_path
    except Exception as e:
        print(f"[ffmpeg] Exception: {e}"); return None
    finally:
        if os.path.exists(in_path): os.remove(in_path)

# Languages to auto-detect if hint fails
AUTO_DETECT_LANGS = ["hi-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "bn-IN", "mr-IN", "gu-IN", "pa-IN", "od-IN", "en-IN"]

def process_audio(audio_bytes: bytes, suffix: str, lang_hint: str) -> dict:
    """
    Multi-language aware processing:
    1. Try transcribing with lang_hint first.
    2. If empty, try English.
    3. If still empty, try other Indian languages (auto-detect).
    4. Detect language -> Speaker assignment (English=Doctor, else=Patient).
    5. Translate accordingly.
    """
    src_lang = lang_hint if lang_hint not in ("unknown", "", None) else "hi-IN"
    wav_path = to_wav(audio_bytes, suffix)
    if not wav_path:
        return {"transcript": "", "detected_language": src_lang, "english_translation": "", "speaker": "unknown"}
    try:
        # Step 1: Transcribe with preferred language hint
        transcript = sarvam_stt(wav_path, source_lang=src_lang)
        
        # Step 2: Fallback — try English
        if not transcript or transcript.startswith("["):
            transcript_en = sarvam_stt(wav_path, source_lang="en-IN")
            if transcript_en and not transcript_en.startswith("["):
                transcript = transcript_en

        # Step 3: Fallback — try other languages (multi-language support)
        if not transcript or transcript.startswith("["):
            for try_lang in AUTO_DETECT_LANGS:
                if try_lang in (src_lang, "en-IN"):
                    continue  # Already tried
                attempt = sarvam_stt(wav_path, source_lang=try_lang)
                if attempt and not attempt.startswith("["):
                    transcript = attempt
                    print(f"[STT] Auto-detected language: {try_lang}")
                    break

        if not transcript or transcript.startswith("["):
            return {"transcript": "", "detected_language": src_lang, "english_translation": "", "speaker": "unknown"}

        detected = sarvam_detect_lang(transcript)
        
        # RULE: English is ALWAYS Doctor (Strict Check)
        english_keywords = ["doctor", "hello", "medicine", "problem", "fever", "tablet", "pain",
                           "patient", "symptoms", "take", "how", "what", "where", "when",
                           "blood", "pressure", "test", "report"]
        is_english = (detected in ("en-IN", "en") or 
                     any(word in transcript.lower() for word in english_keywords))
        
        speaker = "doctor" if is_english else "patient"
        
        # Patient's preferred language (the language we are translating between)
        target_native_lang = src_lang if src_lang != "en-IN" else "hi-IN"
        
        # ALWAYS build both translations so frontend strict turn-taking doesn't break
        if is_english:
            # Doctor spoke English
            eng_text = transcript
            nat_text = sarvam_translate(transcript, "en-IN", target_native_lang)
        else:
            # Patient spoke native language
            actual_lang = detected if detected and detected != "unknown" else target_native_lang
            eng_text = sarvam_translate(transcript, actual_lang, "en-IN")
            nat_text = transcript

        return {
            "transcript": transcript,
            "detected_language": "en-IN" if is_english else actual_lang,
            "english_translation": eng_text,
            "native_translation": nat_text,
            "speaker": speaker
        }
    finally:
        if wav_path and os.path.exists(wav_path): os.remove(wav_path)

# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "voice_enabled": bool(SARVAM_API_KEY),
            "agent_enabled": True, "timestamp": datetime.now().isoformat()}

# ─── VOICE ENDPOINTS ─────────────────────────────────────────────────────────

@app.post("/voice/transcribe_upload")
async def voice_transcribe_upload(file: UploadFile = File(...), language: str = Form("hi-IN")):
    """
    Main endpoint called by React every 7s.
    *** CRITICAL: Blobs under 30KB are just webm headers — no real audio. Skip them. ***
    Real 7-second speech = ~200KB. The frontend MUST accumulate for the full 7s first.
    """
    audio_bytes = await file.read()
    size = len(audio_bytes)
    print(f"[STT upload] {size} bytes, mime={file.content_type}, lang={language}")

    if size < 1000:
        print(f"[STT upload] SKIP — {size} bytes too small")
        return {"transcript": "", "detected_language": language, "english_translation": "", "speaker": "unknown"}

    ct = (file.content_type or "audio/webm").lower()
    suffix = ".ogg" if "ogg" in ct else ".mp4" if "mp4" in ct else ".wav" if "wav" in ct else ".webm"
    src_lang = language if language not in ("unknown", "") else "hi-IN"
    return process_audio(audio_bytes, suffix, src_lang)


@app.post("/voice/tts")
async def voice_tts(data: TTSRequest):
    text = data.text.strip(); lang = data.language
    if not text: return {"status": "error", "message": "No text"}
    if not SARVAM_API_KEY: return {"status": "error", "message": "No SARVAM_API_KEY"}
    translated = sarvam_translate(text, "en-IN", lang) if lang != "en-IN" else text
    audio_b64 = sarvam_tts(translated, language=lang)
    if audio_b64:
        return {"status": "success", "audio_file": f"data:audio/wav;base64,{audio_b64}",
                "text": translated, "language": lang}
    return {"status": "error", "message": "TTS failed"}


@app.post("/voice/consult")
async def voice_consult(file: UploadFile = File(...), patient_id: str = Form(...), language: str = Form("hi-IN")):
    audio_bytes = await file.read()
    ct = (file.content_type or "audio/webm").lower()
    suffix = ".ogg" if "ogg" in ct else ".wav" if "wav" in ct else ".webm"
    result = process_audio(audio_bytes, suffix, language)
    transcript = result.get("english_translation") or result.get("transcript", "")
    clinical = generate_clinical_record(transcript, patient_id)
    record_id = str(uuid.uuid4()); now = datetime.now().isoformat()
    conn = get_db()
    conn.execute("""INSERT INTO consultations
        (id,patient_id,transcript,symptoms,diagnosis,prescriptions,lab_tests,severity,route_to,followup,clinical_notes,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (record_id, patient_id, transcript,
         json.dumps(clinical.get("symptoms", [])), clinical.get("diagnosis", ""),
         json.dumps(clinical.get("prescriptions", [])), json.dumps(clinical.get("lab_tests", [])),
         clinical.get("severity", "STABLE"), json.dumps(clinical.get("route_to", [])),
         clinical.get("followup", ""), clinical.get("clinical_notes", ""), now))
    conn.commit(); conn.close()
    return {**clinical, "record_id": record_id, "patient_id": patient_id,
            "original_transcript": result.get("transcript", ""),
            "detected_language": result.get("detected_language", language),
            "english_translation": result.get("english_translation", "")}


@app.post("/voice/transcribe")
async def voice_transcribe(req: TranscribeRequest):
    b64 = req.audio_base64
    if "," in b64: b64 = b64.split(",", 1)[1]
    try: audio_bytes = base64.b64decode(b64)
    except Exception as e: return {"transcript": f"[Error]: {e}", "detected_language": req.language, "english_translation": ""}
    if len(audio_bytes) < 30000:
        return {"transcript": "", "detected_language": req.language, "english_translation": ""}
    return process_audio(audio_bytes, ".wav", req.language)

# ─── Patient endpoints ────────────────────────────────────────────────────────

@app.get("/patients")
async def list_patients():
    conn = get_db()
    rows = conn.execute("SELECT * FROM patients ORDER BY created_at DESC").fetchall()
    conn.close()
    return [{"patient_id": r["patient_id"], "name": r["name"], "age": r["age"], "gender": r["gender"],
             "language": r["language"], "aadhaar": r["aadhaar"],
             "allergies": json.loads(r["allergies"] or "[]"),
             "history": json.loads(r["history"] or "[]"), "created_at": r["created_at"]} for r in rows]

@app.get("/patient/{patient_id}")
async def get_patient(patient_id: str):
    conn = get_db()
    r = conn.execute("SELECT * FROM patients WHERE patient_id=?", (patient_id,)).fetchone()
    conn.close()
    if not r: raise HTTPException(404, "Patient not found")
    return {"patient_id": r["patient_id"], "name": r["name"], "age": r["age"],
            "gender": r["gender"], "language": r["language"]}

@app.post("/patients/register")
async def register_patient(data: PatientRegister):
    pid = next_patient_id(); now = datetime.now().isoformat()
    conn = get_db()
    conn.execute("INSERT INTO patients (patient_id,name,age,gender,language,aadhaar,allergies,history,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (pid, data.name, data.age, data.gender, data.language, data.aadhaar,
         json.dumps(data.allergies or []), json.dumps(data.history or []), now))
    conn.commit(); conn.close()
    return {"patient_id": pid, "name": data.name, "age": data.age, "gender": data.gender,
            "language": data.language, "aadhaar": data.aadhaar,
            "allergies": data.allergies, "history": data.history, "created_at": now}

@app.get("/visits")
async def list_visits():
    conn = get_db()
    rows = conn.execute("""SELECT v.*,p.name as p_name,p.age as p_age,p.gender as p_gender,p.language as p_language
        FROM visits v LEFT JOIN patients p ON v.patient_id=p.patient_id
        ORDER BY v.created_at DESC""").fetchall()
    conn.close()
    return [{"id": r["id"], "patient_id": r["patient_id"], "token_number": r["token_number"],
             "date": r["date"], "chief_complaint": r["chief_complaint"], "severity": r["severity"],
             "status": r["status"], "assigned_doctor": r["assigned_doctor"], "assigned_room": r["assigned_room"],
             "vitals": json.loads(r["vitals"] or "{}"), "timeline": json.loads(r["timeline"] or "[]"),
             "patient": {"patientId": r["patient_id"], "name": r["p_name"] or "Unknown",
                         "age": r["p_age"] or 0, "gender": r["p_gender"] or "M",
                         "language": r["p_language"] or "Hindi"}} for r in rows]

@app.post("/visits")
async def create_visit(data: VisitCreate):
    vid = f"v{uuid.uuid4().hex[:8]}"; token = data.token_number or next_token()
    now_str = datetime.now().isoformat()
    timeline = json.dumps([{"time": datetime.now().strftime("%H:%M"), "type": "registration",
                             "title": "Registration", "detail": f"Registered · {data.language}", "severity": "normal"}])
    conn = get_db()
    conn.execute("INSERT INTO visits (id,patient_id,token_number,date,chief_complaint,severity,status,timeline,created_at) VALUES (?,?,?,?,?,'STABLE','registered',?,?)",
        (vid, data.patient_id, token, datetime.now().strftime("%d %b %Y"), data.chief_complaint, timeline, now_str))
    conn.commit(); conn.close()
    return {"status": "created", "visit_id": vid, "token_number": token}

@app.patch("/visits/{visit_id}")
async def update_visit(visit_id: str, data: VisitUpdate):
    conn = get_db()
    row = conn.execute("SELECT * FROM visits WHERE id=?", (visit_id,)).fetchone()
    if not row: conn.close(); raise HTTPException(404, "Visit not found")
    updates, params = [], []
    if data.status:          updates.append("status=?");          params.append(data.status)
    if data.severity:        updates.append("severity=?");        params.append(data.severity)
    if data.assigned_doctor: updates.append("assigned_doctor=?"); params.append(data.assigned_doctor)
    if data.assigned_room:   updates.append("assigned_room=?");   params.append(data.assigned_room)
    if data.vitals:          updates.append("vitals=?");          params.append(json.dumps(data.vitals))
    if data.timeline_event:
        tl = json.loads(row["timeline"] or "[]"); tl.append(data.timeline_event)
        updates.append("timeline=?"); params.append(json.dumps(tl))
    if updates:
        params.append(visit_id)
        conn.execute(f"UPDATE visits SET {', '.join(updates)} WHERE id=?", params)
        conn.commit()
    conn.close(); return {"status": "updated"}

@app.post("/consultation/complete")
async def consultation_complete(data: ConsultationComplete):
    summary = f"{data.patient_name}, your consultation is complete."
    if data.diagnosis: summary += f" Diagnosis: {data.diagnosis}."
    if data.tests: summary += f" Tests: {', '.join(data.tests)}."
    if data.prescriptions: summary += f" Medicines: {', '.join(data.prescriptions)}."
    lang_map = {
        "Hindi": "hi-IN", "Tamil": "ta-IN", "Telugu": "te-IN", 
        "Kannada": "kn-IN", "Malayalam": "ml-IN", "English": "en-IN",
        "Marathi": "mr-IN", "Gujarati": "gu-IN", "Punjabi": "pa-IN", 
        "Bengali": "bn-IN", "Odia": "od-IN"
    }
    lang_code = lang_map.get(data.language or "Hindi", "hi-IN")
    summary_local = sarvam_translate(summary, "en-IN", lang_code) if lang_code != "en-IN" else summary
    conn = get_db()
    conn.execute("UPDATE visits SET status='complete' WHERE id=?", (data.visit_id,))
    conn.commit(); conn.close()
    return {"status": "success", "visit_id": data.visit_id, "patient_id": data.patient_id,
            "exit_summary_en": summary, "exit_summary_local": summary_local}

@app.post("/department/update")
async def dept_update(data: DeptUpdateRequest):
    conn = get_db()
    conn.execute("INSERT INTO dept_updates (id,patient_id,dept,action,data,updated_at) VALUES (?,?,?,?,?,?)",
        (str(uuid.uuid4()), data.patient_id, data.dept, data.action,
         json.dumps(data.data or {}), datetime.now().isoformat()))
    conn.commit(); conn.close(); return {"status": "updated"}

@app.get("/record/{patient_id}")
async def get_full_record(patient_id: str):
    conn = get_db()
    patient = conn.execute("SELECT * FROM patients WHERE patient_id=?", (patient_id,)).fetchone()
    if not patient: conn.close(); raise HTTPException(404, "Patient not found")
    consults = conn.execute("SELECT * FROM consultations WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    updates = conn.execute("SELECT * FROM dept_updates WHERE patient_id=? ORDER BY updated_at DESC", (patient_id,)).fetchall()
    conn.close()
    return {"patient": {"patient_id": patient["patient_id"], "name": patient["name"],
                        "age": patient["age"], "gender": patient["gender"], "language": patient["language"]},
            "consultations": [{"id": c["id"], "symptoms": json.loads(c["symptoms"] or "[]"),
                                "diagnosis": c["diagnosis"], "prescriptions": json.loads(c["prescriptions"] or "[]"),
                                "lab_tests": json.loads(c["lab_tests"] or "[]"), "severity": c["severity"],
                                "followup": c["followup"], "clinical_notes": c["clinical_notes"],
                                "created_at": c["created_at"]} for c in consults],
            "dept_updates": [{"id": u["id"], "dept": u["dept"], "action": u["action"],
                               "data": json.loads(u["data"] or "{}"), "updated_at": u["updated_at"]} for u in updates]}

OLLAMA_MODEL = "qwen2.5:7b-instruct"

def generate_clinical_record(transcript: str, patient_id: str) -> dict:
    """Use Ollama qwen2.5:7b-instruct to analyze the consultation transcript."""
    prompt = f"""You are a clinical AI assistant. Analyze this doctor-patient consultation transcript and return ONLY valid JSON (no markdown, no explanation).

Transcript:
{transcript}

Return this exact JSON structure with your analysis:
{{
  "patient_id": "{patient_id}",
  "symptoms": ["list of identified symptoms"],
  "diagnosis": "primary diagnosis",
  "prescriptions": [
    {{"drug": "medicine name", "dose": "dosage", "frequency": "how often", "duration": "how long"}}
  ],
  "lab_tests": ["list of recommended lab tests"],
  "severity": "HIGH or MEDIUM or STABLE",
  "route_to": ["lab", "pharmacy"],
  "followup": "follow-up instructions",
  "clinical_notes": "brief clinical summary"
}}"""
    try:
        import requests as req
        response = req.post("http://localhost:11434/api/chat",
            json={"model": OLLAMA_MODEL, "stream": False, "options": {"temperature": 0},
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=60)
        if response.status_code == 200:
            raw = response.json().get("message", {}).get("content", "")
            # Strip markdown fences if present
            raw = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw)
            # Normalize prescriptions to strings if they're dicts
            if parsed.get("prescriptions") and isinstance(parsed["prescriptions"][0], dict):
                parsed["prescription_details"] = parsed["prescriptions"]
                parsed["prescriptions"] = [
                    f"{p.get('drug','')} {p.get('dose','')}" for p in parsed["prescriptions"]
                ]
            print(f"[Ollama] Analysis complete: {parsed.get('diagnosis', 'N/A')}")
            return parsed
    except json.JSONDecodeError as e:
        print(f"[Ollama] JSON parse error: {e}")
    except Exception as e:
        print(f"[Ollama] Unavailable ({OLLAMA_MODEL}): {e}")

    # Keyword-based fallback
    t = transcript.lower(); symptoms = []; severity = "STABLE"
    for kw, sym in [("chest pain","Chest pain"),("fever","Fever"),("headache","Headache"),
                    ("cough","Cough"),("nausea","Nausea"),("vomiting","Vomiting"),
                    ("dizziness","Dizziness"),("breathless","Dyspnoea")]:
        if kw in t: symptoms.append(sym)
    if any(s in t for s in ["chest pain","heart attack","stroke","seizure"]): severity = "HIGH"
    elif any(s in t for s in ["fever","vomiting","breathless"]): severity = "MEDIUM"
    if "chest pain" in t:
        return {"patient_id":patient_id,"symptoms":symptoms or ["Chest pain"],"diagnosis":"Suspected ACS",
                "prescriptions":["Aspirin 325mg","Atorvastatin 40mg"],"lab_tests":["ECG","Troponin I","CBC"],
                "severity":"HIGH","route_to":["lab","pharmacy"],"followup":"Return in 1 day","clinical_notes":"Urgent cardiac evaluation required."}
    elif "fever" in t:
        return {"patient_id":patient_id,"symptoms":symptoms or ["Fever"],"diagnosis":"Fever under investigation",
                "prescriptions":["Paracetamol 650mg"],"lab_tests":["CBC","Blood Glucose"],
                "severity":severity,"route_to":["lab","pharmacy"],"followup":"Return in 3 days","clinical_notes":"Monitor temperature."}
    elif "headache" in t:
        return {"patient_id":patient_id,"symptoms":symptoms or ["Headache"],"diagnosis":"Headache/Migraine",
                "prescriptions":["Paracetamol 500mg","Domperidone 10mg"],"lab_tests":["CBC"],
                "severity":severity,"route_to":["lab","pharmacy"],"followup":"Return in 3 days","clinical_notes":"Rule out secondary causes."}
    elif "cough" in t or "cold" in t:
        return {"patient_id":patient_id,"symptoms":symptoms or ["Cough"],"diagnosis":"URTI",
                "prescriptions":["Cetirizine 10mg","Amoxicillin 500mg"],"lab_tests":[],
                "severity":"STABLE","route_to":["pharmacy"],"followup":"Return in 5 days","clinical_notes":"Symptomatic treatment."}
    return {"patient_id":patient_id,"symptoms":symptoms or ["General symptoms"],"diagnosis":"General consultation",
            "prescriptions":["Paracetamol 500mg"],"lab_tests":["CBC"],
            "severity":severity,"route_to":["lab","pharmacy"],"followup":"Return in 3 days","clinical_notes":f"{len(symptoms)} symptoms identified."}

# ─── Ollama Consultation Analysis ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    visit_id: str
    patient_id: str
    patient_name: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    language: Optional[str] = "Hindi"
    transcript_lines: list  # [{speaker, original, translated, time}]

@app.post("/consultation/analyze")
async def consultation_analyze(data: AnalyzeRequest):
    """Send full consultation transcript to Ollama for clinical analysis."""
    # Build readable transcript
    lines = []
    for line in data.transcript_lines:
        speaker = line.get("speaker", "unknown").capitalize()
        text = line.get("translated", line.get("original", ""))
        lines.append(f"[{speaker}]: {text}")
    full_transcript = "\n".join(lines)

    print(f"[Analyze] {len(data.transcript_lines)} turns for {data.patient_id}")
    print(f"[Analyze] Transcript:\n{full_transcript}")

    clinical = generate_clinical_record(full_transcript, data.patient_id)

    # Save to consultations table
    record_id = str(uuid.uuid4()); now = datetime.now().isoformat()
    conn = get_db()
    conn.execute("""INSERT INTO consultations
        (id,patient_id,visit_id,transcript,symptoms,diagnosis,prescriptions,lab_tests,severity,route_to,followup,clinical_notes,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (record_id, data.patient_id, data.visit_id, full_transcript,
         json.dumps(clinical.get("symptoms", [])), clinical.get("diagnosis", ""),
         json.dumps(clinical.get("prescriptions", [])), json.dumps(clinical.get("lab_tests", [])),
         clinical.get("severity", "STABLE"), json.dumps(clinical.get("route_to", [])),
         clinical.get("followup", ""), clinical.get("clinical_notes", ""), now))
    # Also update visit timeline
    row = conn.execute("SELECT timeline FROM visits WHERE id=?", (data.visit_id,)).fetchone()
    if row:
        tl = json.loads(row["timeline"] or "[]")
        tl.append({"time": datetime.now().strftime("%H:%M"), "type": "consultation",
                   "title": "AI Clinical Analysis", "detail": f"Ollama {OLLAMA_MODEL} · {clinical.get('diagnosis','N/A')}",
                   "severity": "normal" if clinical.get("severity") == "STABLE" else "warning"})
        conn.execute("UPDATE visits SET timeline=? WHERE id=?", (json.dumps(tl), data.visit_id))
    conn.commit(); conn.close()

    return {"status": "success", "record_id": record_id, "clinical": clinical}


# ─── PDF Clinical Record ─────────────────────────────────────────────────────

@app.get("/clinical-record/{visit_id}/pdf")
async def clinical_record_pdf(visit_id: str):
    """Generate a downloadable PDF clinical record."""
    from fpdf import FPDF

    conn = get_db()
    visit_row = conn.execute("SELECT * FROM visits WHERE id=?", (visit_id,)).fetchone()
    if not visit_row:
        conn.close(); raise HTTPException(404, "Visit not found")

    patient_row = conn.execute("SELECT * FROM patients WHERE patient_id=?", (visit_row["patient_id"],)).fetchone()
    consult_row = conn.execute(
        "SELECT * FROM consultations WHERE visit_id=? ORDER BY created_at DESC LIMIT 1",
        (visit_id,)).fetchone()
    conn.close()

    # Build PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Helper: sanitize text for Helvetica (ascii only to avoid FPDF crashes on long ????? strings)
    def safe(text):
        if not text: return "N/A"
        try:
            # drop non-ascii completely
            cleaned = str(text).encode('ascii', 'ignore').decode('ascii').strip()
            # break up any extremely long words that could cause FPDF horizontal space crash
            words = []
            for w in cleaned.split():
                if len(w) > 40: # reduced from 80 to 40 to easily fit Helvetica 10pt cell
                    words.extend([w[i:i+40] for i in range(0, len(w), 40)])
                else:
                    words.append(w)
            res = " ".join(words)
            return res if res else "N/A"
        except Exception:
            return "N/A"

    # Header
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "VaidikaAI - Clinical Record", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, f"Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    # Patient Info
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "PATIENT INFORMATION", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    p_name = patient_row["name"] if patient_row else "N/A"
    p_age = patient_row["age"] if patient_row else "N/A"
    p_gender = patient_row["gender"] if patient_row else "N/A"
    p_id = visit_row["patient_id"]
    p_lang = patient_row["language"] if patient_row else "N/A"
    pdf.cell(95, 6, safe(f"Name: {p_name}"), new_x="RIGHT", new_y="LAST")
    pdf.cell(95, 6, safe(f"Patient ID: {p_id}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(95, 6, safe(f"Age/Gender: {p_age} / {p_gender}"), new_x="RIGHT", new_y="LAST")
    pdf.cell(95, 6, safe(f"Language: {p_lang}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(95, 6, safe(f"Visit Date: {visit_row['date']}"), new_x="RIGHT", new_y="LAST")
    pdf.cell(95, 6, safe(f"Visit ID: {visit_id}"), new_x="LMARGIN", new_y="NEXT")

    # Vitals
    vitals = json.loads(visit_row["vitals"] or "{}")
    if vitals:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "VITALS", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        for k, v in vitals.items():
            pdf.cell(95, 6, safe(f"{k}: {v}"), new_x="LMARGIN", new_y="NEXT")

    # Clinical Assessment (from Ollama)
    if consult_row:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "CLINICAL ASSESSMENT", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)

        symptoms = json.loads(consult_row["symptoms"] or "[]")
        pdf.cell(0, 6, safe(f"Symptoms: {', '.join(symptoms) if symptoms else 'N/A'}"), new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, safe(f"Diagnosis: {consult_row['diagnosis'] or 'N/A'}"), new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, safe(f"Severity: {consult_row['severity'] or 'STABLE'}"), new_x="LMARGIN", new_y="NEXT")

        if consult_row["clinical_notes"]:
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, "Clinical Notes:", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 5, safe(consult_row["clinical_notes"]))

        # Prescriptions
        prescriptions = json.loads(consult_row["prescriptions"] or "[]")
        if prescriptions:
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "PRESCRIPTIONS", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            for i, rx in enumerate(prescriptions, 1):
                if isinstance(rx, str):
                    pdf.cell(0, 6, safe(f"  {i}. {rx}"), new_x="LMARGIN", new_y="NEXT")
                elif isinstance(rx, dict):
                    pdf.cell(0, 6, safe(f"  {i}. {rx.get('drug','')} {rx.get('dose','')} - {rx.get('frequency','')} x {rx.get('duration','')}"), new_x="LMARGIN", new_y="NEXT")

        # Lab Tests
        lab_tests = json.loads(consult_row["lab_tests"] or "[]")
        if lab_tests:
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "LAB INVESTIGATIONS ORDERED", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            for i, test in enumerate(lab_tests, 1):
                pdf.cell(0, 6, safe(f"  {i}. {test}"), new_x="LMARGIN", new_y="NEXT")

        # Follow-up
        if consult_row["followup"]:
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "FOLLOW-UP", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, safe(consult_row["followup"]), new_x="LMARGIN", new_y="NEXT")

    # Transcript
    if consult_row and consult_row["transcript"]:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "CONSULTATION TRANSCRIPT", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for line in consult_row["transcript"].split("\n"):
            if line.strip():
                try:
                    pdf.multi_cell(0, 5, safe(line.strip()))
                except Exception as e:
                    print(f"pdf error on line: {e}")

    # Footer
    pdf.ln(10)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(0, 6, "Attending Physician: Dr. Meera", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "This is a computer-generated clinical record by VaidikaAI.", new_x="LMARGIN", new_y="NEXT")

    # Output to bytes
    pdf_bytes = pdf.output()
    buffer = io.BytesIO(pdf_bytes)
    filename = f"ClinicalRecord_{p_id}_{visit_id}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"})


if __name__ == "__main__":
    print("[VaidikaAI] Backend starting on http://0.0.0.0:8000")
    print(f"   Sarvam AI: {'[OK] Configured' if SARVAM_API_KEY else '[MISSING] Set SARVAM_API_KEY in .env'}")
    print(f"   Ollama: {OLLAMA_MODEL}")
    print(f"   Database: {DB_PATH}")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
