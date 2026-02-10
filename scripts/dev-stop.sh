#!/usr/bin/env bash
# Gracefully stop all local dev services
set -euo pipefail

GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

stop_port() {
  local name="$1" port="$2"
  local pids
  pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null && printf "  ${GREEN}Stopped${NC}  ${DIM}%s (port %s)${NC}\n" "$name" "$port"
  fi
}

echo ""
printf "  Stopping dev services...\n\n"

stop_port "API server" 4000
stop_port "Vite dev server" 5173

docker compose down 2>/dev/null && printf "  ${GREEN}Stopped${NC}  ${DIM}Docker (Postgres, Mailpit)${NC}\n"

echo ""
printf "  All services stopped.\n\n"
