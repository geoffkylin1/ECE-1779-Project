#!/bin/sh
set -eu

: "${DOMAIN:?Set DOMAIN to the public DNS name before deploying}"
: "${API_IMAGE:?Set API_IMAGE to an immutable registry image tag before deploying}"
: "${CADDY_IMAGE:?Set CADDY_IMAGE to an immutable registry image tag before deploying}"

for image in "$API_IMAGE" "$CADDY_IMAGE"; do
    case "$image" in
        *:latest)
            echo "Refusing to deploy a mutable :latest tag ($image). Use a version or Git SHA." >&2
            exit 1
            ;;
    esac
done

swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}')"
if [ "$swarm_state" != "active" ]; then
    echo "This Docker engine is not an active Swarm node." >&2
    exit 1
fi

for secret_name in splitmate_database_url splitmate_postgres_password splitmate_jwt_secret; do
    if ! docker secret inspect "$secret_name" >/dev/null 2>&1; then
        echo "Missing Docker secret: $secret_name" >&2
        echo "Create secrets with scripts/create-swarm-secrets.sh first." >&2
        exit 1
    fi
done

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
project_dir="$(dirname "$script_dir")"

cd "$project_dir/deploy"
docker stack deploy --with-registry-auth --prune --compose-file swarm-stack.yaml splitmate

echo "Deployment submitted. Inspect it with:"
echo "  docker stack services splitmate"
echo "  docker stack ps splitmate --no-trunc"
