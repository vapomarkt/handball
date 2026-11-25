#!/usr/bin/env bash
# Builds the two images the production stack needs for exactly one commit.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SHA="${1:-$(git rev-parse HEAD)}"

[[ -z "$(git status --porcelain)" ]] || {
  echo "Worktree nicht sauber - Images wuerden nicht zum SHA passen." >&2
  exit 1
}
[[ "$SHA" == "$(git rev-parse HEAD)" ]] || {
  echo "Nur den aktuellen HEAD bauen (bekommen: $SHA)." >&2
  exit 1
}

docker build --target runner \
  --build-arg NEXT_PUBLIC_APP_URL=https://throwoff.app \
  -t "throwoff-app:$SHA" .

docker build --target worker \
  -t "throwoff-worker:$SHA" .

echo "Gebaut: throwoff-app:$SHA, throwoff-worker:$SHA"
