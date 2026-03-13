from agents.consultation_agent import generate_clinical_record

transcript = """
Doctor: What brings you in today?
Patient: I have chest pain for 2 days and fever.
Doctor: Any arm pain?
Patient: Yes left arm pain also.
Doctor: Need ECG and blood tests.
"""

result = generate_clinical_record(transcript, "VK-2025-TEST")
print(result.model_dump_json(indent=2))