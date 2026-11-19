# SplitMate Infrastructure Runbook

This runbook covers the infrastructure owned by Zhiyuan Diao: local Docker
Compose, Docker Swarm, DigitalOcean Block Storage, Caddy HTTPS, and production
secrets. It intentionally does not create billable cloud resources or contain
real credentials.

## Architecture

| Component | Local | Production |
|---|---|---|
| Edge | Caddy on `localhost:8080` | One Caddy service on ports 80/443 |
| API | One locally built container | Two replicas from an immutable GHCR image |
| Database | PostgreSQL with a named volume | One PostgreSQL task pinned to the volume node |
| Storage | Docker named volume | DigitalOcean Volume mounted at `/mnt/splitmate-postgres` |
| Secrets | Untracked `.env` file | Docker Swarm secrets |
| Networks | Isolated edge and internal data networks | Overlay edge and encrypted internal data networks |

The database is intentionally a single instance because a DigitalOcean Volume
can attach to one Droplet at a time. This is a documented single point of
failure, matching the project proposal.

## Local development

Requirements: Docker Engine or Docker Desktop with Compose v2.

```bash
cp .env.example .env
docker compose up --build --detach
docker compose ps
curl http://localhost:8080/api/health
curl http://localhost:8080/
```

The expected health response is:

```json
{"status":"ok","replica":"<container-hostname>"}
```

View logs and stop the stack:

```bash
docker compose logs --follow api caddy db
docker compose down
```

`docker compose down` preserves database and Caddy volumes. Do not add
`--volumes` unless deleting local data is intentional.

## Production prerequisites

1. Create Linux Droplets in one DigitalOcean VPC and install Docker Engine.
2. Reserve at least one manager and two schedulable nodes for the intended
   three-host demo topology.
3. Allow public inbound TCP 80 and 443 to the edge node and restrict SSH to
   administrators.
4. Allow Swarm traffic only inside the trusted VPC: TCP 2377, TCP/UDP 7946,
   UDP 4789, and IP protocol 50 (ESP) for encrypted overlay traffic. Never
   expose UDP 4789 to the public internet.
5. Point the domain's A record to a Swarm node reachable on ports 80 and 443.
6. Publish the API image to GHCR with an immutable version or Git SHA tag.

## Create the Swarm

On the manager, use its stable private VPC address:

```bash
docker swarm init --advertise-addr <MANAGER_PRIVATE_IP>
docker swarm join-token worker
```

Run the printed join command on each worker. Back on the manager, verify:

```bash
docker node ls
```

## Prepare the DigitalOcean Volume

Create a volume named `splitmate-postgres` in the same region as the database
Droplet, attach it to that Droplet, and enable automatic formatting/mounting at
creation time. The stack expects the resulting host path:

```text
/mnt/splitmate-postgres
```

Confirm the mount before deploying:

```bash
findmnt /mnt/splitmate-postgres
```

Give the PostgreSQL container ownership of the new empty mount:

```bash
docker run --rm \
  --mount type=bind,source=/mnt/splitmate-postgres,target=/var/lib/postgresql/data \
  postgres:16-alpine \
  chown -R postgres:postgres /var/lib/postgresql/data
```

Run this only against the confirmed DigitalOcean mount, never an unverified
directory. The volume must also be configured to mount after a Droplet reboot.

## Label persistent-service nodes

Run on a manager, replacing the node names shown by `docker node ls`:

```bash
docker node update --label-add splitmate.database=true <DATABASE_NODE>
docker node update --label-add splitmate.caddy=true <EDGE_NODE>
docker node inspect <DATABASE_NODE> --pretty
docker node inspect <EDGE_NODE> --pretty
```

The constraints in `deploy/swarm-stack.yaml` prevent PostgreSQL or Caddy from
silently moving to a node without its persistent storage.

## Create production secrets

On a manager, create three root-readable files outside the repository. The
database URL password must match the PostgreSQL password file. Hex output is
used so the password is URL-safe.

```bash
umask 077
mkdir -p /root/splitmate-secrets
openssl rand -hex 32 > /root/splitmate-secrets/postgres_password
POSTGRES_PASSWORD="$(tr -d '\n' < /root/splitmate-secrets/postgres_password)"
printf 'postgresql://splitmate:%s@db:5432/splitmate' "$POSTGRES_PASSWORD" \
  > /root/splitmate-secrets/database_url
unset POSTGRES_PASSWORD
openssl rand -hex 32 > /root/splitmate-secrets/jwt_secret

./scripts/create-swarm-secrets.sh \
  /root/splitmate-secrets/database_url \
  /root/splitmate-secrets/postgres_password \
  /root/splitmate-secrets/jwt_secret
```

The script refuses to overwrite existing secrets. Docker secrets are immutable;
rotate them with versioned names and a coordinated stack update.

## Deploy

Authenticate Docker to GHCR first if the image is private. Then export the
non-secret deployment settings:

```bash
export DOMAIN=splitmate.example.com
export API_IMAGE=ghcr.io/geoffkylin1/ece-1779-project:<git-sha>
./scripts/deploy-swarm.sh
```

The deploy script rejects `:latest`, checks that Swarm is active and all
external secrets exist, and uses rolling updates with rollback on failure.

Inspect the rollout:

```bash
docker stack services splitmate
docker stack ps splitmate --no-trunc
docker service logs --follow splitmate_api
docker service logs --follow splitmate_caddy
curl https://$DOMAIN/api/health
```

Caddy obtains and renews the public certificate when the domain resolves to the
server, inbound ports 80/443 are reachable, and `/data` is persistent.

## Required evidence checks

### Load distribution

```bash
for request in 1 2 3 4 5 6 7 8; do
  curl --silent "https://$DOMAIN/api/health"
  echo
done
```

The `replica` value should show both API task hostnames over repeated requests.

### API replica failure

```bash
docker service ps splitmate_api
docker service scale splitmate_api=1
curl --fail "https://$DOMAIN/api/health"
docker service scale splitmate_api=2
```

The request should continue to succeed with one replica, and the service should
return to `2/2` afterward.

### Database persistence

Create a known record through the application before this check. Record the
database task name, force Swarm to replace it, and verify the record afterward:

```bash
docker service ps splitmate_db
docker service update --force splitmate_db
docker service ps splitmate_db
```

This tests container replacement while retaining the mounted volume. It does
not claim database-node high availability.

## Operational notes

- Back up or snapshot the database volume before risky database migrations.
- Caddy is pinned to one labeled node because its named volume contains ACME
  state. Moving it requires migrating that volume or provisioning new state.
- If PostgreSQL does not schedule, check the database node label and mount.
- If HTTPS issuance fails, verify DNS, public ports 80/443, and Caddy logs.
- If API tasks remain at `0/N`, verify GHCR authentication, image architecture,
  and the external secret names.

## Primary references

- [Docker: deploy a stack](https://docs.docker.com/engine/swarm/stack-deploy/)
- [Docker: manage sensitive data with secrets](https://docs.docker.com/engine/swarm/secrets/)
- [Docker: Swarm ports and prerequisites](https://docs.docker.com/engine/swarm/swarm-tutorial/)
- [Docker: node labels](https://docs.docker.com/engine/swarm/manage-nodes/)
- [DigitalOcean: create and set up Volumes](https://docs.digitalocean.com/products/volumes/how-to/create/)
- [Caddy: automatic HTTPS](https://caddyserver.com/docs/automatic-https)
