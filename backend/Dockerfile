FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.txt || \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p data/cache

RUN adduser --disabled-password --no-create-home appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=10)" || exit 1

ENV APP_ENV=production

CMD ["sh", "-c", "if [ \"$APP_ENV\" = \"production\" ]; then exec gunicorn app.main:app -c gunicorn.conf.py; else exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload; fi"]
