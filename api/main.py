from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3, uuid, datetime, json
from agents.consultation_agent import generate_clinical_record

app = FastAPI(title='VaidikaAI API')

app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"])

def init_db():
    conn = sqlite3.connect('vaidika.db')
    conn.execute('''CREATE TABLE IF NOT EXISTS patients
        (patient_id TEXT, name TEXT, age INT,
         gender TEXT, language TEXT, created_at TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS consultations
        (id TEXT, patient_id TEXT, transcript TEXT,
         symptoms TEXT, diagnosis TEXT, prescriptions TEXT,
         lab_tests TEXT, severity TEXT, route_to TEXT,
         followup TEXT, created_at TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS dept_updates
        (id TEXT, patient_id TEXT, dept TEXT,
         action TEXT, data TEXT, updated_at TEXT)''')
    conn.commit()
    conn.close()

init_db()

class RegisterRequest(BaseModel):
    name: str
    age: int
    gender: str
    language: str

@app.post('/register')
def register(req: RegisterRequest):
    pid = f'VK-2025-{str(uuid.uuid4())[:5].upper()}'
    conn = sqlite3.connect('vaidika.db')
    conn.execute('INSERT INTO patients VALUES (?,?,?,?,?,?)',
        (pid, req.name, req.age, req.gender,
         req.language, datetime.datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return {'patient_id': pid, 'status': 'registered'}

@app.get('/patient/{patient_id}')
def get_patient(patient_id: str):
    conn = sqlite3.connect('vaidika.db')
    row = conn.execute(
        'SELECT * FROM patients WHERE patient_id=?',
        (patient_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, 'Patient not found')
    return {'patient_id': row[0], 'name': row[1],
            'age': row[2], 'gender': row[3], 'language': row[4]}

class ConsultRequest(BaseModel):
    patient_id: str
    transcript: str

@app.post('/consultation')
def consultation(req: ConsultRequest):
    record = generate_clinical_record(req.transcript, req.patient_id)
    conn = sqlite3.connect('vaidika.db')
    conn.execute('INSERT INTO consultations VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        (str(uuid.uuid4()), req.patient_id, req.transcript,
         json.dumps(record.symptoms), record.diagnosis,
         json.dumps(record.prescriptions),
         json.dumps(record.lab_tests), record.severity,
         json.dumps(record.route_to), record.followup,
         datetime.datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return record

class DeptUpdate(BaseModel):
    patient_id: str
    dept: str
    action: str
    data: Optional[dict] = {}

@app.post('/department/update')
def dept_update(req: DeptUpdate):
    conn = sqlite3.connect('vaidika.db')
    conn.execute('INSERT INTO dept_updates VALUES (?,?,?,?,?,?)',
        (str(uuid.uuid4()), req.patient_id, req.dept,
         req.action, json.dumps(req.data),
         datetime.datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return {'status': 'updated'}

@app.get('/record/{patient_id}')
def full_record(patient_id: str):
    conn = sqlite3.connect('vaidika.db')
    patient = conn.execute(
        'SELECT * FROM patients WHERE patient_id=?',
        (patient_id,)).fetchone()
    consult = conn.execute(
        'SELECT * FROM consultations WHERE patient_id=? ORDER BY created_at DESC LIMIT 1',
        (patient_id,)).fetchone()
    updates = conn.execute(
        'SELECT * FROM dept_updates WHERE patient_id=?',
        (patient_id,)).fetchall()
    conn.close()
    if not patient:
        raise HTTPException(404, 'Not found')
    return {
        'patient': {
            'id': patient[0], 'name': patient[1],
            'age': patient[2], 'language': patient[4]
        },
        'consultation': {
            'symptoms': json.loads(consult[3]) if consult else [],
            'diagnosis': consult[4] if consult else '',
            'prescriptions': json.loads(consult[5]) if consult else [],
            'lab_tests': json.loads(consult[6]) if consult else [],
            'severity': consult[7] if consult else '',
            'followup': consult[9] if consult else '',
        } if consult else {},
        'dept_updates': [
            {'dept': u[2], 'action': u[3],
             'data': json.loads(u[4])} for u in updates
        ]
    }

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000, reload=True)