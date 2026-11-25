#!/usr/bin/env bash
# Deploys an already built image tag to the production stack and verifies it.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <commit-sha>" >&2
  exit 2
fi

IMAGE_TAG="$1"
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{7,40}$ ]] || {
  echo "IMAGE_TAG muss ein Git-Commit-SHA sein, bekommen: $IMAGE_TAG" >&2
  exit 2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${DEPLOY_ENV_FILE:-/srv/throwoff/shared/env/.env.prod}"
LOCAL_URL="http://127.0.0.1:${THROWOFF_APP_PORT:-3003}"

compose() {
  IMAGE_TAG="$IMAGE_TAG" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose config -q

echo "Deploying image tag $IMAGE_TAG"
compose up -d db
compose run --rm migrate
compose up -d --no-deps app worker
compose ps app worker

for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 "$LOCAL_URL/api/health" >/dev/null; then
    echo "Deploy verification passed: $LOCAL_URL/api/health"
    exit 0
  fi
  echo "Waiting for app health ($attempt/30)..."
  sleep 2
done

echo "Verification failed. Logs:" >&2
docker logs throwoff-app --tail=80 >&2 || true
exit 1
