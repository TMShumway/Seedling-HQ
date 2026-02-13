#!/usr/bin/env bash
# Dev status dashboard — checks all local services
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    printf "  ${GREEN}%-14s${NC} ${DIM}%s${NC}\n" "UP" "$name  →  $url"
  else
    printf "  ${RED}%-14s${NC} ${DIM}%s${NC}\n" "DOWN ($code)" "$name  →  $url"
  fi
}

check_docker() {
  local name="$1" container="$2"
  local state
  state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not found")
  if [[ "$state" == "running" ]]; then
    printf "  ${GREEN}%-14s${NC} ${DIM}%s${NC}\n" "UP" "$name  →  $container"
  else
    printf "  ${RED}%-14s${NC} ${DIM}%s${NC}\n" "DOWN ($state)" "$name  →  $container"
  fi
}

check_port() {
  local name="$1" port="$2"
  if lsof -iTCP:"$port" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
    printf "  ${GREEN}%-14s${NC} ${DIM}%s${NC}\n" "UP" "$name  →  :$port"
  else
    printf "  ${RED}%-14s${NC} ${DIM}%s${NC}\n" "DOWN" "$name  →  :$port"
  fi
}

echo ""
printf "${BOLD}${CYAN}  Seedling HQ — Dev Status${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"
echo ""

printf "${BOLD}  Docker${NC}\n"
check_docker "Postgres"    "seedling-hq-postgres-1"
check_docker "Mailpit"     "seedling-hq-mailpit-1"
check_docker "LocalStack"  "seedling-hq-localstack-1"
echo ""

printf "${BOLD}  Services${NC}\n"
check "API"          "http://localhost:4000/health"
check "Web (Vite)"   "http://localhost:5173"
check "Swagger UI"   "http://localhost:4000/docs"
check "Mailpit UI"   "http://localhost:8025"
check "LocalStack"   "http://localhost:4566/_localstack/health"
echo ""

printf "${BOLD}  Ports${NC}\n"
check_port "Postgres (5432)" 5432
check_port "SMTP (1025)"     1025
check_port "S3 (4566)"       4566
echo ""
