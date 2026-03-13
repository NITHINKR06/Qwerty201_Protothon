"""
Example PySpark + Delta Lake Job
=================================
Demonstrates reading, transforming, and writing data with Delta Lake.
"""

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

# ── Spark Session with Delta Lake ─────────────────────

spark = (
    SparkSession.builder
    .appName("HackathonDeltaJob")
    .config("spark.jars.packages", "io.delta:delta-spark_2.12:3.1.0")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config(
        "spark.sql.catalog.spark_catalog",
        "org.apache.spark.sql.delta.catalog.DeltaCatalog",
    )
    .getOrCreate()
)


def run_example_job():
    """Run an example ETL job with Delta Lake."""

    # 1️⃣  Create sample data
    data = [
        ("Alice", 28, "Engineering"),
        ("Bob", 35, "Marketing"),
        ("Carol", 42, "Engineering"),
        ("Dave", 31, "Sales"),
    ]
    df = spark.createDataFrame(data, ["name", "age", "department"])

    print("📊 Sample data:")
    df.show()

    # 2️⃣  Transform
    df_transformed = df.withColumn(
        "age_group",
        F.when(F.col("age") < 30, "Junior")
        .when(F.col("age") < 40, "Mid")
        .otherwise("Senior"),
    )

    print("⚙️  Transformed data:")
    df_transformed.show()

    # 3️⃣  Write to Delta Lake
    delta_path = "/data/delta/employees"
    df_transformed.write.format("delta").mode("overwrite").save(delta_path)
    print(f"💾 Written to Delta Lake at: {delta_path}")

    # 4️⃣  Read back from Delta Lake
    df_read = spark.read.format("delta").load(delta_path)
    print("📖 Read back from Delta Lake:")
    df_read.show()


if __name__ == "__main__":
    run_example_job()
    spark.stop()
