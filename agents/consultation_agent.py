# cat > /mnt/NewVolume/protothon/agents/consultation_agent.py << 'EOF'
import ollama, json
from agents.schema import ClinicalRecord

def generate_clinical_record(transcript: str, patient_id: str) -> ClinicalRecord:

    prompt = f"""You are a clinical AI assistant. Analyze the patient symptoms and return ONLY valid JSON.

Patient ID: {patient_id}
Symptoms: {transcript}

Return this exact JSON structure with ALL fields filled:
{{
  "patient_id": "{patient_id}",
  "symptoms": ["{transcript}"],
  "diagnosis": "<your diagnosis here — required, never empty>",
  "prescriptions": ["<medicine 1>", "<medicine 2>"],
  "lab_tests": ["<test 1>"],
  "severity": "<low|medium|high>",
  "route_to": ["<lab|cardiology|general|emergency>"],
  "followup": "<followup instructions>",
  "clinical_notes": "<brief clinical reasoning — required, never empty>"
}}

Rules:
- diagnosis: must name the likely condition (e.g. "Suspected Angina", "Viral Fever")
- clinical_notes: explain your reasoning in 1-2 sentences
- prescriptions: list at least 1 medicine with dosage
- severity: chest pain + left arm pain = high, fever alone = low
- Return ONLY the JSON. No explanation. No markdown.
"""

    response = ollama.chat(
        model='llama3.2:3b',
        messages=[{'role': 'user', 'content': prompt}],
        options={'temperature': 0}
    )

    raw = response['message']['content'].strip()
    raw = raw.replace('```json', '').replace('```', '').strip()
    data = json.loads(raw)
    return ClinicalRecord(**data)

