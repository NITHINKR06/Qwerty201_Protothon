"""
Delta Store — Delta Lake Table Manager
=======================================
Manages 4 core tables on Delta Lake:

    1. patients           — who the patient is
    2. consultations      — what the AI doctor said
    3. prescriptions      — which medicines were prescribed
    4. routing_decisions   — lab / pharmacy routing

Other members call functions like `save_consultation()` or
`get_patient_history()` to read/write data.
"""

import os
from datetime import datetime
from typing import Optional

from pyspark.sql import functions as F  # type: ignore[import-untyped]
from pyspark.sql.types import (  # type: ignore[import-untyped]
    StructType,
    StructField,
    StringType,
    IntegerType,
)

from .spark_manager import get_spark, DELTA_BASE_PATH  # type: ignore[import-not-found]

# ── Table paths ──────────────────────────────────────────

PATIENTS_PATH         = os.path.join(DELTA_BASE_PATH, "patients")
CONSULTATIONS_PATH    = os.path.join(DELTA_BASE_PATH, "consultations")
PRESCRIPTIONS_PATH    = os.path.join(DELTA_BASE_PATH, "prescriptions")
ROUTING_DECISIONS_PATH = os.path.join(DELTA_BASE_PATH, "routing_decisions")


# ── Schemas ──────────────────────────────────────────────

PATIENTS_SCHEMA = StructType([
    StructField("patient_id",   StringType(), False),
    StructField("patient_name", StringType(), False),
    StructField("age",          IntegerType(), True),
    StructField("gender",       StringType(), True),
    StructField("language",     StringType(), True),
    StructField("phone",        StringType(), True),
    StructField("created_at",   StringType(), False),
])

CONSULTATIONS_SCHEMA = StructType([
    StructField("consultation_id", StringType(), False),
    StructField("patient_id",      StringType(), False),
    StructField("symptoms",        StringType(), True),
    StructField("diagnosis",       StringType(), True),
    StructField("advice",          StringType(), True),
    StructField("severity",        StringType(), True),    # low / medium / high
    StructField("raw_json",        StringType(), True),    # full Qwen output
    StructField("created_at",      StringType(), False),
])

PRESCRIPTIONS_SCHEMA = StructType([
    StructField("prescription_id", StringType(), False),
    StructField("consultation_id", StringType(), False),
    StructField("patient_id",      StringType(), False),
    StructField("medicines",       StringType(), True),    # JSON array string
    StructField("dosage_info",     StringType(), True),
    StructField("notes",           StringType(), True),
    StructField("created_at",      StringType(), False),
])

ROUTING_SCHEMA = StructType([
    StructField("routing_id",      StringType(), False),
    StructField("consultation_id", StringType(), False),
    StructField("patient_id",      StringType(), False),
    StructField("route_to",        StringType(), False),   # "lab" | "pharmacy" | "both"
    StructField("reason",          StringType(), True),
    StructField("created_at",      StringType(), False),
])


# ── Initialise Tables (idempotent) ──────────────────────

def init_tables() -> None:
    """Create empty Delta tables if they don't already exist."""
    spark = get_spark()

    table_defs = [
        (PATIENTS_PATH,          PATIENTS_SCHEMA),
        (CONSULTATIONS_PATH,     CONSULTATIONS_SCHEMA),
        (PRESCRIPTIONS_PATH,     PRESCRIPTIONS_SCHEMA),
        (ROUTING_DECISIONS_PATH, ROUTING_SCHEMA),
    ]

    for path, schema in table_defs:
        if not os.path.exists(path):
            empty_df = spark.createDataFrame([], schema)
            empty_df.write.format("delta").mode("overwrite").save(path)
            print(f"✅ Created Delta table → {path}")
        else:
            print(f"ℹ️  Delta table exists  → {path}")


# ──────────────────────────────────────────────────────────
#  PATIENTS
# ──────────────────────────────────────────────────────────

def save_patient(patient_data: dict) -> dict:
    """
    Persist a patient record to the patients Delta table.

    Parameters
    ----------
    patient_data : dict
        Must contain at least `patient_id` and `patient_name`.

    Returns
    -------
    dict  — the saved record
    """
    spark = get_spark()
    record = {
        "patient_id":   patient_data["patient_id"],
        "patient_name": patient_data["patient_name"],
        "age":          patient_data.get("age"),
        "gender":       patient_data.get("gender"),
        "language":     patient_data.get("language", "en"),
        "phone":        patient_data.get("phone"),
        "created_at":   patient_data.get("created_at", datetime.utcnow().isoformat()),
    }

    df = spark.createDataFrame([record], PATIENTS_SCHEMA)
    df.write.format("delta").mode("append").save(PATIENTS_PATH)
    return record


def get_patient_by_id(patient_id: str) -> Optional[dict]:
    """Retrieve a single patient record by ID."""
    spark = get_spark()
    df = spark.read.format("delta").load(PATIENTS_PATH)
    rows = df.filter(F.col("patient_id") == patient_id).collect()
    return rows[0].asDict() if rows else None


def get_all_patients() -> list[dict]:
    """Return every patient record."""
    spark = get_spark()
    df = spark.read.format("delta").load(PATIENTS_PATH)
    return [row.asDict() for row in df.collect()]


# ──────────────────────────────────────────────────────────
#  CONSULTATIONS
# ──────────────────────────────────────────────────────────

def save_consultation(consultation_data: dict) -> dict:
    """
    Save the AI-generated consultation record.

    Parameters
    ----------
    consultation_data : dict
        Must include `consultation_id` and `patient_id`.
        Typically contains: symptoms, diagnosis, advice, severity, raw_json.

    Returns
    -------
    dict  — the saved record
    """
    spark = get_spark()
    record = {
        "consultation_id": consultation_data["consultation_id"],
        "patient_id":      consultation_data["patient_id"],
        "symptoms":        consultation_data.get("symptoms"),
        "diagnosis":       consultation_data.get("diagnosis"),
        "advice":          consultation_data.get("advice"),
        "severity":        consultation_data.get("severity"),
        "raw_json":        consultation_data.get("raw_json"),
        "created_at":      consultation_data.get("created_at", datetime.utcnow().isoformat()),
    }

    df = spark.createDataFrame([record], CONSULTATIONS_SCHEMA)
    df.write.format("delta").mode("append").save(CONSULTATIONS_PATH)
    return record


def get_consultations_by_patient(patient_id: str) -> list[dict]:
    """Return all consultations for a given patient (newest first)."""
    spark = get_spark()
    df = spark.read.format("delta").load(CONSULTATIONS_PATH)
    rows = (
        df.filter(F.col("patient_id") == patient_id)
          .orderBy(F.col("created_at").desc())
          .collect()
    )
    return [r.asDict() for r in rows]


def get_consultation_by_id(consultation_id: str) -> Optional[dict]:
    """Retrieve a single consultation by its ID."""
    spark = get_spark()
    df = spark.read.format("delta").load(CONSULTATIONS_PATH)
    rows = df.filter(F.col("consultation_id") == consultation_id).collect()
    return rows[0].asDict() if rows else None


# ──────────────────────────────────────────────────────────
#  PRESCRIPTIONS
# ──────────────────────────────────────────────────────────

def save_prescription(prescription_data: dict) -> dict:
    """
    Save a prescription extracted by the prescription agent.

    Parameters
    ----------
    prescription_data : dict
        Must include `prescription_id`, `consultation_id`, `patient_id`.
        Typically contains: medicines (JSON string), dosage_info, notes.

    Returns
    -------
    dict  — the saved record
    """
    spark = get_spark()
    record = {
        "prescription_id": prescription_data["prescription_id"],
        "consultation_id": prescription_data["consultation_id"],
        "patient_id":      prescription_data["patient_id"],
        "medicines":       prescription_data.get("medicines"),      # JSON string
        "dosage_info":     prescription_data.get("dosage_info"),
        "notes":           prescription_data.get("notes"),
        "created_at":      prescription_data.get("created_at", datetime.utcnow().isoformat()),
    }

    df = spark.createDataFrame([record], PRESCRIPTIONS_SCHEMA)
    df.write.format("delta").mode("append").save(PRESCRIPTIONS_PATH)
    return record


def get_prescriptions_by_patient(patient_id: str) -> list[dict]:
    """Return all prescriptions for a patient."""
    spark = get_spark()
    df = spark.read.format("delta").load(PRESCRIPTIONS_PATH)
    rows = (
        df.filter(F.col("patient_id") == patient_id)
          .orderBy(F.col("created_at").desc())
          .collect()
    )
    return [r.asDict() for r in rows]


def get_prescription_by_id(prescription_id: str) -> Optional[dict]:
    """Retrieve a single prescription by its ID."""
    spark = get_spark()
    df = spark.read.format("delta").load(PRESCRIPTIONS_PATH)
    rows = df.filter(F.col("prescription_id") == prescription_id).collect()
    return rows[0].asDict() if rows else None


# ──────────────────────────────────────────────────────────
#  ROUTING DECISIONS
# ──────────────────────────────────────────────────────────

def save_routing_decision(routing_data: dict) -> dict:
    """
    Save a routing decision (lab / pharmacy / both).

    Parameters
    ----------
    routing_data : dict
        Must include `routing_id`, `consultation_id`, `patient_id`, `route_to`.

    Returns
    -------
    dict  — the saved record
    """
    spark = get_spark()
    record = {
        "routing_id":      routing_data["routing_id"],
        "consultation_id": routing_data["consultation_id"],
        "patient_id":      routing_data["patient_id"],
        "route_to":        routing_data["route_to"],        # "lab" | "pharmacy" | "both"
        "reason":          routing_data.get("reason"),
        "created_at":      routing_data.get("created_at", datetime.utcnow().isoformat()),
    }

    df = spark.createDataFrame([record], ROUTING_SCHEMA)
    df.write.format("delta").mode("append").save(ROUTING_DECISIONS_PATH)
    return record


def get_routing_by_patient(patient_id: str) -> list[dict]:
    """Return all routing decisions for a patient."""
    spark = get_spark()
    df = spark.read.format("delta").load(ROUTING_DECISIONS_PATH)
    rows = (
        df.filter(F.col("patient_id") == patient_id)
          .orderBy(F.col("created_at").desc())
          .collect()
    )
    return [r.asDict() for r in rows]


def get_routing_by_consultation(consultation_id: str) -> Optional[dict]:
    """Get the routing decision for a specific consultation."""
    spark = get_spark()
    df = spark.read.format("delta").load(ROUTING_DECISIONS_PATH)
    rows = df.filter(F.col("consultation_id") == consultation_id).collect()
    return rows[0].asDict() if rows else None


# ──────────────────────────────────────────────────────────
#  COMPOSITE QUERIES
# ──────────────────────────────────────────────────────────

def get_patient_history(patient_id: str) -> dict:
    """
    Full history for a patient — pulls from all 4 tables.

    Returns
    -------
    dict
        {
            "patient": {...},
            "consultations": [...],
            "prescriptions": [...],
            "routing_decisions": [...]
        }
    """
    return {
        "patient":           get_patient_by_id(patient_id),
        "consultations":     get_consultations_by_patient(patient_id),
        "prescriptions":     get_prescriptions_by_patient(patient_id),
        "routing_decisions": get_routing_by_patient(patient_id),
    }


def get_recent_consultations(limit: int = 20) -> list[dict]:
    """Return the N most recent consultations across all patients."""
    spark = get_spark()
    df = spark.read.format("delta").load(CONSULTATIONS_PATH)
    rows = df.orderBy(F.col("created_at").desc()).limit(limit).collect()
    return [r.asDict() for r in rows]


def get_table_counts() -> dict:
    """Return row counts for all 4 tables (useful for dashboards)."""
    spark = get_spark()
    counts = {}
    for name, path in [
        ("patients",          PATIENTS_PATH),
        ("consultations",     CONSULTATIONS_PATH),
        ("prescriptions",     PRESCRIPTIONS_PATH),
        ("routing_decisions", ROUTING_DECISIONS_PATH),
    ]:
        try:
            counts[name] = spark.read.format("delta").load(path).count()
        except Exception:
            counts[name] = 0
    return counts


# ── Quick test ───────────────────────────────────────────

if __name__ == "__main__":
    import json

    # Initialise tables
    init_tables()

    # Save a patient
    patient = save_patient({
        "patient_id":   "VAI-000099",
        "patient_name": "Test Patient",
        "age":          30,
        "gender":       "M",
        "language":     "hi",
    })
    print(f"✅ Patient saved: {patient}")

    # Save a consultation
    consult_id = "test-con1"
    consultation = save_consultation({
        "consultation_id": consult_id,
        "patient_id":      "VAI-000099",
        "symptoms":        "fever, headache",
        "diagnosis":       "Viral fever",
        "advice":          "Rest and hydration",
        "severity":        "low",
        "raw_json":        json.dumps({"model": "qwen", "output": "..."}),
    })
    print(f"✅ Consultation saved: {consultation}")

    # Save a prescription
    prescription = save_prescription({
        "prescription_id": "test-rx01",
        "consultation_id": consult_id,
        "patient_id":      "VAI-000099",
        "medicines":       json.dumps(["Paracetamol 500mg", "Cetirizine 10mg"]),
        "dosage_info":     "Twice daily after meals",
    })
    print(f"✅ Prescription saved: {prescription}")

    # Save a routing decision
    routing = save_routing_decision({
        "routing_id":      "test-rt01",
        "consultation_id": consult_id,
        "patient_id":      "VAI-000099",
        "route_to":        "pharmacy",
        "reason":          "No lab tests required",
    })
    print(f"✅ Routing saved: {routing}")

    # Full history
    history = get_patient_history("VAI-000099")
    print(f"\n📋 Patient history:\n{json.dumps(history, indent=2)}")

    # Table counts
    print(f"\n📊 Table counts: {get_table_counts()}")
