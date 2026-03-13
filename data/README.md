# Data — Spark + Delta Lake

This directory holds data assets processed by **Apache Spark** and stored in **Delta Lake** format.

## Structure

```
data/
├── raw/                 # Raw ingested data
├── processed/           # Transformed / cleaned data
├── delta/               # Delta Lake tables (gitignored)
└── spark_jobs/          # PySpark job scripts
    └── example_job.py
```
