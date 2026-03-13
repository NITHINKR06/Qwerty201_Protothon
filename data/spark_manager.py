"""
Spark Manager — PySpark + Delta Lake Session
=============================================
Single entry-point that boots a PySpark session with Delta Lake
extensions enabled.  Every other data module imports `spark` from here.

Usage
-----
    from data.spark_manager import spark
"""

import os
from pyspark.sql import SparkSession  # type: ignore[import-untyped]

# ── Configuration ────────────────────────────────────────

# Where Delta tables live on disk (relative to project root)
DELTA_BASE_PATH = os.environ.get(
    "DELTA_BASE_PATH",
    os.path.join(os.path.dirname(__file__), "delta"),
)

# Spark warehouse dir (metadata)
WAREHOUSE_DIR = os.path.join(os.path.dirname(__file__), "spark-warehouse")

# Delta-Spark JAR coordinate (must match pyspark version)
_DELTA_PKG = "io.delta:delta-spark_2.12:3.1.0"


# ── Build Session ────────────────────────────────────────

def _create_spark_session() -> SparkSession:
    """
    Create and return a configured SparkSession.

    The session is set up with:
    • Delta Lake catalog + SQL extensions
    • Local master for dev / hackathon use
    • Sensible memory defaults
    """
    builder = (
        SparkSession.builder
        .appName("VaidikaAI-DeltaLake")
        .master("local[*]")
        # ── Delta Lake JARs & extensions ──
        .config("spark.jars.packages", _DELTA_PKG)
        .config(
            "spark.sql.extensions",
            "io.delta.sql.DeltaSparkSessionExtension",
        )
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        )
        # ── Warehouse & storage ──
        .config("spark.sql.warehouse.dir", WAREHOUSE_DIR)
        # ── Performance tweaks ──
        .config("spark.driver.memory", "2g")
        .config("spark.sql.shuffle.partitions", "2")  # small data → few partitions
        .config("spark.ui.enabled", "false")           # no web UI overhead
    )

    return builder.getOrCreate()


# Singleton session — imported by other modules
spark: SparkSession = _create_spark_session()


# ── Helpers ──────────────────────────────────────────────

def get_spark() -> SparkSession:
    """Return the active SparkSession (creates one if stopped)."""
    global spark
    if spark is None or spark._jsc is None or spark._jsc.sc().isStopped():
        spark = _create_spark_session()
    return spark


def stop_spark() -> None:
    """Gracefully stop the SparkSession."""
    global spark
    if spark is not None:
        spark.stop()
        print("🛑 SparkSession stopped.")


# ── Quick smoke test ─────────────────────────────────────

if __name__ == "__main__":
    print(f"✅ SparkSession active  : {spark.sparkContext.appName}")
    print(f"   Spark version        : {spark.version}")
    print(f"   Delta base path      : {DELTA_BASE_PATH}")
    print(f"   Warehouse dir        : {WAREHOUSE_DIR}")
    stop_spark()
