// ─── VaidikaAI — Centralised API Client ──────────────────────
// All calls go to /api/* which Vite proxies to FastAPI on :8000

export interface HealthStatus {
  status: string;
  voice_enabled: boolean;
  agent_enabled: boolean;
  timestamp: string;
}

export interface TranscriptionResult {
  transcript: string;
  detected_language: string;
  english_translation: string;
}

export interface ConsultationResult {
  record_id: string;
  patient_id: string;
  symptoms: string[];
  diagnosis: string;
  prescriptions: string[];
  lab_tests: string[];
  severity: string;
  route_to: string[];
  followup: string;
  clinical_notes?: string;
  original_transcript: string;
  detected_language: string;
  english_translation: string;
}

export interface TTSResult {
  status: string;
  audio_file?: string;
  message?: string;
  text: string;
  language: string;
}

export interface ConsultationCompleteResult {
  status: string;
  visit_id: string;
  patient_id: string;
  exit_summary_en: string;
  exit_summary_local: string;
  language: string;
}

export interface PatientRecord {
  patient_id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  language: string;
  aadhaar?: string;
  allergies?: string[];
  history?: any[];
  created_at?: string;
}

export interface VisitRecord {
  id: string;
  patient_id: string;
  token_number: number;
  date: string;
  chief_complaint: string;
  severity: string;
  status: string;
  assigned_doctor?: string;
  assigned_room?: string;
  vitals?: any;
  timeline?: any[];
  patient: {
    patientId: string;
    name: string;
    age: number;
    gender: string;
    language: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────

async function safeFetch<T>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────

export async function checkHealth(): Promise<HealthStatus | null> {
  return safeFetch<HealthStatus>('/api/health');
}

export async function transcribeAudio(
  audioBlob: Blob,
  language: string = 'unknown',
): Promise<TranscriptionResult | null> {
  const fd = new FormData();
  fd.append('file', audioBlob, 'recording.webm');
  fd.append('language', language);
  return safeFetch<TranscriptionResult>('/api/voice/transcribe_upload', {
    method: 'POST',
    body: fd,
  });
}

export async function voiceConsult(
  audioBlob: Blob,
  patientId: string,
  language: string = 'unknown',
): Promise<ConsultationResult | null> {
  const fd = new FormData();
  fd.append('file', audioBlob, 'recording.webm');
  fd.append('patient_id', patientId);
  fd.append('language', language);
  return safeFetch<ConsultationResult>('/api/voice/consult', {
    method: 'POST',
    body: fd,
  });
}

export async function textToSpeech(
  text: string,
  language: string = 'hi-IN',
): Promise<TTSResult | null> {
  return safeFetch<TTSResult>('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
}

export async function completeConsultation(data: {
  visit_id: string;
  patient_id: string;
  patient_name: string;
  language?: string;
  diagnosis?: string;
  tests?: string[];
  prescriptions?: string[];
  follow_up_date?: string;
}): Promise<ConsultationCompleteResult | null> {
  return safeFetch<ConsultationCompleteResult>('/api/consultation/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
export async function getPatients(): Promise<PatientRecord[] | null> {
  return safeFetch<PatientRecord[]>('/api/patients');
}

export async function registerPatient(data: Omit<PatientRecord, 'patient_id' | 'created_at'>): Promise<PatientRecord | null> {
  return safeFetch<PatientRecord>('/api/patients/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getVisits(): Promise<VisitRecord[] | null> {
  return safeFetch<VisitRecord[]>('/api/visits');
}

export async function createVisit(data: {
  patient_id: string;
  chief_complaint: string;
  language: string;
  token_number?: number;
}): Promise<{ status: string; visit_id: string; token_number: number } | null> {
  return safeFetch<{ status: string; visit_id: string; token_number: number }>('/api/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateVisit(visitId: string, data: {
  status?: string;
  severity?: string;
  assigned_doctor?: string;
  assigned_room?: string;
  vitals?: any;
  timeline_event?: any;
}): Promise<{ status: string } | null> {
  return safeFetch<{ status: string }>(`/api/visits/${visitId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ─── Ollama Clinical Analysis ────────────────────────────────

export interface ClinicalAnalysis {
  patient_id: string;
  symptoms: string[];
  diagnosis: string;
  prescriptions: string[];
  prescription_details?: Array<{ drug: string; dose: string; frequency: string; duration: string }>;
  lab_tests: string[];
  severity: string;
  route_to: string[];
  followup: string;
  clinical_notes: string;
}

export async function analyzeConsultation(data: {
  visit_id: string;
  patient_id: string;
  patient_name: string;
  patient_age?: number;
  patient_gender?: string;
  language?: string;
  transcript_lines: Array<{ speaker: string; original: string; translated: string; time: string }>;
}): Promise<{ status: string; record_id: string; clinical: ClinicalAnalysis } | null> {
  return safeFetch('/api/consultation/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getClinicalPDFUrl(visitId: string): string {
  return `/api/clinical-record/${visitId}/pdf`;
}
