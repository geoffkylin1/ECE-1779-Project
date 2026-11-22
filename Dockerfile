# syntax=docker/dockerfile:1
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system --gid 10001 splitmate \
    && useradd --system --uid 10001 --gid splitmate --home-dir /app splitmate

COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt

COPY --chown=splitmate:splitmate src ./src
COPY --chown=splitmate:splitmate alembic.ini ./
COPY --chown=splitmate:splitmate migrations ./migrations
COPY --chown=splitmate:splitmate scripts/container-entrypoint.sh /usr/local/bin/container-entrypoint
RUN chmod 0555 /usr/local/bin/container-entrypoint

USER splitmate

EXPOSE 8000

ENTRYPOINT ["container-entrypoint"]
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
