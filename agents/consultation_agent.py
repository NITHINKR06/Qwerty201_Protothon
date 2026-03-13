import ollama, json
from agents.schema import ClinicalRecord

def generate_clinical_record(transcript: str, patient_id: str) -> ClinicalRecord:

    prompt = f"""
You are a clinical AI assistant.
Read this doctor-patient consultation transcript.
Return ONLY valid JSON — no explanation, no markdown.

JSON format:
{{
  "patient_id": "{patient_id}",
  "symptoms": ["symptom 1", "symptom 2"],
  "diagnosis": "primary diagnosis here",
  "prescriptions": ["Medicine 1 dose", "Medicine 2 dose"],
  "lab_tests": ["Test 1", "Test 2"],
  "severity": "low or medium or high or emergency",
  "route_to": ["lab", "pharmacy"],
  "followup": "follow up instruction",
  "clinical_notes": "any additional notes"
}}

TRANSCRIPT:
{transcript}
"""

    response = ollama.chat(
        model='qwen2.5:7b',
        messages=[{'role': 'user', 'content': prompt}],
        options={'temperature': 0}
    )

    raw = response['message']['content'].strip()
    raw = raw.replace('```json', '').replace('```', '').strip()
    data = json.loads(raw)
    return ClinicalRecord(**data)