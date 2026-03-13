FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY voice/ ./voice/

EXPOSE 8001

CMD ["python", "-m", "voice.voice_handler"]
