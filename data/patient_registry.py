"""
Patient Registry — SQLite ID Generator
=======================================
Auto-generates unique patient IDs (VAI-000001, VAI-000002, …)
using a lightweight SQLite database as a persistent counter.

Member 1 calls `generate_patient_id()` the moment a new patient arrives.
"""

import sqlite3
import os
import threading
from datetime import datetime

# ── Configuration ────────────────────────────────────────
DB_DIR = os.path.join(os.path.dirname(__file__), "registry")
DB_PATH = os.path.join(DB_DIR, "patient_registry.db")
ID_PREFIX = "VAI"

# Thread-safety lock for concurrent ID generation
_lock = threading.Lock()


# ── Initialise DB ────────────────────────────────────────

def _init_db() -> None:
    """Create the registry database and tables if they don't exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Counter table — single row that tracks the last issued number
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS id_counter (
            id        INTEGER PRIMARY KEY CHECK (id = 1),
            last_num  INTEGER NOT NULL DEFAULT 0
        )
    """)

    # Seed the counter row if it doesn't exist
    cursor.execute("""
        INSERT OR IGNORE INTO id_counter (id, last_num) VALUES (1, 0)
    """)

    # Patient lookup table — quick reference for ID ↔ name mapping
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patient_index (
            patient_id   TEXT    PRIMARY KEY,
            patient_name TEXT    NOT NULL,
            age          INTEGER,
            gender       TEXT,
            language     TEXT    DEFAULT 'en',
            phone        TEXT,
            created_at   TEXT    NOT NULL
        )
    """)

    conn.commit()
    conn.close()


# Run on import so the DB is always ready
_init_db()


# ── Public API ───────────────────────────────────────────

def generate_patient_id() -> str:
    """
    Atomically increment the counter and return a new patient ID.

    Returns
    -------
    str
        e.g. "VAI-000001"
    """
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("UPDATE id_counter SET last_num = last_num + 1 WHERE id = 1")
        cursor.execute("SELECT last_num FROM id_counter WHERE id = 1")
        new_num = cursor.fetchone()[0]

        conn.commit()
        conn.close()

    return f"{ID_PREFIX}-{new_num:06d}"


def register_patient(
    patient_name: str,
    age: int | None = None,
    gender: str | None = None,
    language: str = "en",
    phone: str | None = None,
) -> dict:
    """
    Generate a new ID and register the patient in the index.

    Parameters
    ----------
    patient_name : str
        Full name of the patient.
    age : int, optional
    gender : str, optional
    language : str
        Preferred language code (default "en").
    phone : str, optional

    Returns
    -------
    dict
        {"patient_id": "VAI-000001", "patient_name": "...", "created_at": "..."}
    """
    patient_id = generate_patient_id()
    created_at = datetime.utcnow().isoformat()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO patient_index
            (patient_id, patient_name, age, gender, language, phone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (patient_id, patient_name, age, gender, language, phone, created_at),
    )

    conn.commit()
    conn.close()

    return {
        "patient_id": patient_id,
        "patient_name": patient_name,
        "age": age,
        "gender": gender,
        "language": language,
        "phone": phone,
        "created_at": created_at,
    }


def get_patient(patient_id: str) -> dict | None:
    """
    Look up a patient by ID.

    Returns
    -------
    dict or None
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM patient_index WHERE patient_id = ?",
        (patient_id,),
    )
    row = cursor.fetchone()
    conn.close()

    if row is None:
        return None

    return {
        "patient_id": row[0],
        "patient_name": row[1],
        "age": row[2],
        "gender": row[3],
        "language": row[4],
        "phone": row[5],
        "created_at": row[6],
    }


def patient_exists(patient_id: str) -> bool:
    """Return True if the patient ID is registered."""
    return get_patient(patient_id) is not None


def get_total_patients() -> int:
    """Return the total number of registered patients."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM patient_index")
    count = cursor.fetchone()[0]
    conn.close()
    return count


# ── Quick test ───────────────────────────────────────────

if __name__ == "__main__":
    info = register_patient("Rahul Sharma", age=34, gender="M", language="hi")
    print(f"✅ Registered: {info}")

    info2 = register_patient("Priya Nair", age=28, gender="F", language="ml")
    print(f"✅ Registered: {info2}")

    print(f"📊 Total patients: {get_total_patients()}")
    print(f"🔍 Lookup: {get_patient(info['patient_id'])}")
