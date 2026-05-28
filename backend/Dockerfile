FROM python:3.11-slim

WORKDIR /app

# Install pre-built binary wheels only — no gcc/g++ needed
COPY requirements.txt .
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.txt || \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Create cache directory
RUN mkdir -p data/cache

EXPOSE 8000

# Health check so Render knows when the container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
