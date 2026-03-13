"""
Example Airflow DAG
====================
A starter DAG that demonstrates Spark + Delta Lake integration.
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

# ── Default Args ──────────────────────────────────────

default_args = {
    "owner": "hackathon-team",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

# ── DAG Definition ────────────────────────────────────

with DAG(
    dag_id="hackathon_data_pipeline",
    default_args=default_args,
    description="Main data pipeline — ingest → transform → serve",
    schedule_interval="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["hackathon", "spark", "delta-lake"],
) as dag:

    def _extract(**kwargs):
        """Extract data from source."""
        print("📥 Extracting data...")
        # TODO: Add your data extraction logic here
        return {"status": "extracted", "records": 0}

    def _transform(**kwargs):
        """Transform data using PySpark."""
        print("⚙️  Transforming data with Spark...")
        # TODO: Add your Spark transformation logic here
        return {"status": "transformed"}

    def _load(**kwargs):
        """Load data into Delta Lake."""
        print("💾 Loading data into Delta Lake...")
        # TODO: Add your Delta Lake write logic here
        return {"status": "loaded"}

    # ── Tasks ─────────────────────────────────────────

    extract = PythonOperator(
        task_id="extract_data",
        python_callable=_extract,
    )

    transform = PythonOperator(
        task_id="transform_data",
        python_callable=_transform,
    )

    load = PythonOperator(
        task_id="load_to_delta_lake",
        python_callable=_load,
    )

    # ── Task Dependencies ─────────────────────────────

    extract >> transform >> load
