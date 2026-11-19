# SplitMate

SplitMate is a cloud-native shared-expense tracker for students, roommates, and
small groups. The planned application uses FastAPI, React, PostgreSQL, Caddy,
Docker Compose, and Docker Swarm on DigitalOcean.

## Current repository state

The repository currently contains the API and deployment foundation. The
business APIs, schema/migrations, and React frontend are developed by their
respective owners and will integrate with these containers.

```text
.
├── compose.yaml                 # Local Caddy/API/PostgreSQL stack
├── Dockerfile                   # Non-root FastAPI runtime image
├── deploy/
│   ├── caddy/Caddyfile          # Local HTTP / production automatic HTTPS
│   ├── swarm-stack.yaml         # Replicated production stack
│   └── swarm.env.example        # Non-secret deployment settings
├── docs/
│   ├── api-contract.md
│   └── infrastructure.md        # DigitalOcean and Swarm runbook
├── scripts/
│   ├── container-entrypoint.sh  # Loads Docker secret files
│   ├── create-swarm-secrets.sh
│   └── deploy-swarm.sh
├── src/
└── tests/
```

## Run locally with Docker

```bash
cp .env.example .env
docker compose up --build --detach
curl http://localhost:8080/api/health
```

Open <http://localhost:8080>. View or stop the stack with:

```bash
docker compose ps
docker compose logs --follow
docker compose down
```

The named PostgreSQL volume survives `docker compose down`.

## Run tests without Docker

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest
```

## Deploy to DigitalOcean

Follow [the infrastructure runbook](docs/infrastructure.md). It covers Swarm
ports and initialization, the DigitalOcean Volume, node labels, external
secrets, Caddy HTTPS, deployment, and the required failure/persistence demos.

## Collaboration

Do not push directly to `main`. Create a `feature/`, `fix/`, `docs/`, or
`chore/` branch, use Conventional Commit messages, run tests, and open a pull
request for teammate review. Never commit `.env` files or production secrets.
