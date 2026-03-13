"""
data — Storage Backbone
========================
Patient registry (SQLite), PySpark session, and Delta Lake tables.

Quick imports:
    from data.patient_registry import register_patient, get_patient
    from data.spark_manager import spark, get_spark
    from data.delta_store import (
        init_tables,
        save_patient, save_consultation, save_prescription, save_routing_decision,
        get_patient_history, get_table_counts,
    )
"""
