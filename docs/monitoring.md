# SplitMate Monitoring and Resilience

This document describes the local Docker Swarm monitoring and failure-recovery
tests for SplitMate.

The monitoring stack checks the public application health endpoint without
changing the frontend or backend business logic.

## Components

| Component | Purpose | Local URL |
|---|---|---|
| Blackbox Exporter | Probes the SplitMate health endpoint | Internal only |
| Prometheus | Collects probe metrics and evaluates alert rules | http://localhost:9090 |
| Alertmanager | Receives and displays active alerts | http://localhost:9093 |
| Grafana | Displays service status, availability, and response time | http://localhost:3000 |

Prometheus checks:

```text
http://caddy/api/health
```

The probe runs every five seconds.

## Alert rules

Two alert rules are defined in `deploy/monitoring/alerts.yml`:

- `SplitMateUnavailable`: fires when the health endpoint fails continuously for
  20 seconds.
- `SplitMateSlowResponse`: fires when the health probe takes more than two
  seconds for one minute.

The alerts are forwarded from Prometheus to Alertmanager.

## Local deployment

The monitoring services are included in:

```text
deploy/swarm-local.yaml
```

The stack requires an external Grafana administrator password secret. Create it
with a temporary file:

```powershell
$secretFile = Join-Path $env:TEMP ("splitmate-grafana-" + [Guid]::NewGuid().ToString("N") + ".txt")
$password = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
[IO.File]::WriteAllText($secretFile, $password)
docker secret create splitmate_local_grafana_admin_password $secretFile
Remove-Item -Force $secretFile
```

Validate and deploy the stack:

```powershell
docker stack config -c deploy\swarm-local.yaml > $null
docker stack deploy -c deploy\swarm-local.yaml splitmate
Start-Sleep -Seconds 30
docker stack services splitmate
```

The expected service state is:

```text
splitmate_api            2/2
splitmate_caddy          1/1
splitmate_db             1/1
splitmate_blackbox       1/1
splitmate_prometheus     1/1
splitmate_alertmanager   1/1
splitmate_grafana        1/1
```

`splitmate_migrate` is a one-time migration service. It may display `0/1` after
finishing successfully.

## Normal monitoring check

Query the current probe result:

```powershell
curl.exe -s "http://localhost:9090/api/v1/query?query=probe_success"
```

A value of `1` means the application is reachable.

Open the provisioned Grafana dashboard:

```powershell
start http://localhost:3000/d/splitmate-service-monitoring/splitmate-service-monitoring
```

During normal operation, the dashboard shows:

- Service Status: `HEALTHY`
- HTTP Status Code: `200`
- Availability: `100%` when there has been no recent outage
- Health endpoint response time in milliseconds

## Alert test

Temporarily stop the Caddy entry service:

```powershell
docker service scale splitmate_caddy=0
Start-Sleep -Seconds 35
```

This does not delete the database or its persistent volume.

After the alert delay:

- Grafana shows `DOWN`.
- The HTTP status becomes `0`.
- Prometheus shows `SplitMateUnavailable` as `FIRING`.
- Alertmanager receives a critical alert for the SplitMate health endpoint.

Open the alert pages:

```powershell
start http://localhost:9090/alerts
start http://localhost:9093
```

## Service recovery

Restore the Caddy service:

```powershell
docker service scale splitmate_caddy=1
Start-Sleep -Seconds 20
docker stack services splitmate
```

Grafana should return to `HEALTHY` with HTTP status `200`. The recent
availability percentage may remain below 100% temporarily because the
five-minute window still includes the test outage.

The alert automatically resolves after Prometheus observes successful probes
again.

## API replica failure test

The API runs with two replicas. Repeated health requests should show two
different replica hostnames:

```powershell
1..12 | ForEach-Object {
    curl.exe -s http://localhost:8001/api/health
    Write-Host ""
}
```

To test automatic recovery, terminate one API task container:

```powershell
$victim = docker ps --filter "label=com.docker.swarm.service.name=splitmate_api" --format "{{.ID}}" | Select-Object -First 1
docker kill $victim
```

The remaining replica continues serving requests, and Docker Swarm creates a
replacement task automatically.

## Database persistence test

Create demo data before restarting the database service:

```powershell
python scripts\seed_demo.py
```

Force Swarm to replace the PostgreSQL task:

```powershell
docker service update --force splitmate_db
Start-Sleep -Seconds 20
docker service ps splitmate_db
```

After replacement, signing in with the existing demo credentials and requesting
the group balances should return the same records. This confirms that the
PostgreSQL named volume survives container replacement.

## Evidence checklist

The following screenshots were captured during testing:

- `swarm-load-balancing.png`
- `swarm-failure-recovery.png`
- `swarm-end-to-end-workflow.png`
- `postgres-persistence-after-restart.png`
- `monitoring-dashboard-healthy.png`
- `monitoring-dashboard-down.png`
- `prometheus-alert-firing.png`
- `alertmanager-critical-alert.png`
- `monitoring-dashboard-recovered.png`

## CI validation

GitHub Actions validates both the regular Compose configuration and the local
Swarm monitoring configuration:

```yaml
docker compose config --quiet
docker stack config -c deploy/swarm-local.yaml
```

Backend tests, frontend checks, container builds, and Swarm configuration
validation must all pass before integration.

## Production note

The Grafana, Prometheus, and Alertmanager ports in `swarm-local.yaml` are for
local testing and presentation evidence. A production deployment should not
expose administrative monitoring ports publicly without authentication,
firewall restrictions, and TLS.