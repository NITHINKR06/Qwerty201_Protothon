from pydantic import BaseModel
from typing import List

class ClinicalRecord(BaseModel):
    patient_id: str
    symptoms: List[str]
    diagnosis: str
    prescriptions: List[str]
    lab_tests: List[str]
    severity: str        # low / medium / high / emergency
    route_to: List[str]  # ['lab', 'pharmacy']
    followup: str
    clinical_notes: str