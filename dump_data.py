import sqlite3
import json
import os

DB_PATH = "vaidika.db"

def dump_all_data():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    data = {
        "patients": [],
        "visits": [],
        "consultations": []
    }

    try:
        # Patients
        patients = cursor.execute("SELECT * FROM patients").fetchall()
        for p in patients:
            p_dict = dict(p)
            p_dict["allergies"] = json.loads(p_dict["allergies"] or "[]")
            p_dict["history"] = json.loads(p_dict["history"] or "[]")
            data["patients"].append(p_dict)

        # Visits
        visits = cursor.execute("SELECT * FROM visits").fetchall()
        for v in visits:
            v_dict = dict(v)
            v_dict["vitals"] = json.loads(v_dict["vitals"] or "{}")
            v_dict["timeline"] = json.loads(v_dict["timeline"] or "[]")
            data["visits"].append(v_dict)

        # Consultations
        consults = cursor.execute("SELECT * FROM consultations").fetchall()
        for c in consults:
            c_dict = dict(c)
            c_dict["symptoms"] = json.loads(c_dict["symptoms"] or "[]")
            c_dict["prescriptions"] = json.loads(c_dict["prescriptions"] or "[]")
            c_dict["lab_tests"] = json.loads(c_dict["lab_tests"] or "[]")
            c_dict["route_to"] = json.loads(c_dict["route_to"] or "[]")
            data["consultations"].append(c_dict)

        print(json.dumps(data, indent=2))

    except Exception as e:
        print(f"Error dumping data: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    dump_all_data()
