# 🚀 Hackathon Project

> AI-powered hackathon project built with Google ADK, Sarvam AI, Apache Airflow, Apache Spark, and Delta Lake.

## Tech Stack

| Component          | Technology                  | Directory      |
| ------------------ | --------------------------- | -------------- |
| **AI Agents**      | Google ADK + Gemini         | `agents/`      |
| **Voice**          | Sarvam AI (TTS/STT)        | `voice/`       |
| **Orchestration**  | Apache Airflow              | `pipelines/`   |
| **Data Processing**| Apache Spark + Delta Lake   | `data/`        |
| **Infrastructure** | Docker Compose              | root           |

## Quick Start

### 1. Configure Environment
```bash
cp .env.example .env   # or edit .env directly
# Fill in your API keys
```

### 2. Run Everything with Docker
```bash
docker-compose up --build
```

### 3. Access Services

| Service              | URL                        |
| -------------------- | -------------------------- |
| Agent API            | http://localhost:8000       |
| Voice API            | http://localhost:8001       |
| Airflow UI           | http://localhost:8080       |
| Spark Master UI      | http://localhost:8082       |

### 4. Local Development (without Docker)
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Project Structure

```
hackathon-project/
├── .env                 # API keys (never push!)
├── .gitignore
├── requirements.txt
├── docker-compose.yml
├── agents/              # Google ADK agents
│   ├── main_agent.py    #   └─ Root orchestrator
│   ├── tools/           #   └─ Custom agent tools
│   └── Dockerfile
├── voice/               # Sarvam AI voice
│   ├── voice_handler.py #   └─ TTS / STT / Translate
│   └── Dockerfile
├── pipelines/           # Airflow DAGs
│   ├── dags/
│   │   └── example_dag.py
│   └── logs/
└── data/                # Spark + Delta Lake
    ├── raw/
    ├── processed/
    ├── delta/           # (gitignored)
    └── spark_jobs/
        └── example_job.py
```

## Team

_Add your team members here._

## License

MIT
