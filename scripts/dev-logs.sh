#!/usr/bin/env bash
# Tail Docker service logs (Postgres, Mailpit, LocalStack)
# Usage:
#   bash scripts/dev-logs.sh              # All services
#   bash scripts/dev-logs.sh postgres     # Postgres only
#   bash scripts/dev-logs.sh localstack   # LocalStack only
#   bash scripts/dev-logs.sh mailpit      # Mailpit only
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE="${1:-}"

if [[ -n "$SERVICE" ]]; then
  docker compose logs -f "$SERVICE"
else
  docker compose logs -f
fi
