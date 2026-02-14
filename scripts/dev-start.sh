#!/usr/bin/env bash
# Full cold start: Docker up → wait for health → DB push + seed → start dev servers
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

cd "$(dirname "$0")/.."

echo ""
printf "${BOLD}${CYAN}  Seedling HQ — Starting${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"
echo ""

# Step 1: Docker services
printf "${BOLD}  [1/4]${NC} Starting Docker services...\n"
docker compose up -d

# Step 2: Wait for health checks
printf "${BOLD}  [2/4]${NC} Waiting for services to be healthy...\n"

printf "  ${DIM}Postgres...${NC}"
until docker compose exec -T postgres pg_isready -U fsa > /dev/null 2>&1; do sleep 1; done
printf "\r  ${GREEN}Postgres ready${NC}          \n"

printf "  ${DIM}LocalStack...${NC}"
for i in $(seq 1 30); do
  if curl -sf http://localhost:4566/_localstack/health > /dev/null 2>&1; then break; fi
  sleep 1
done
if curl -sf http://localhost:4566/_localstack/health > /dev/null 2>&1; then
  printf "\r  ${GREEN}LocalStack ready${NC}        \n"
else
  printf "\r  ${RED}LocalStack not ready${NC} (photo uploads may fail)\n"
fi

printf "  ${DIM}Mailpit...${NC}"
for i in $(seq 1 10); do
  if curl -sf http://localhost:8025 > /dev/null 2>&1; then break; fi
  sleep 1
done
if curl -sf http://localhost:8025 > /dev/null 2>&1; then
  printf "\r  ${GREEN}Mailpit ready${NC}           \n"
else
  printf "\r  ${RED}Mailpit not ready${NC} (emails won't be captured)\n"
fi

# Step 3: Database
printf "${BOLD}  [3/4]${NC} Pushing schema and seeding data...\n"
pnpm --filter @seedling/api run db:push 2>&1 | sed 's/^/  /'
pnpm --filter @seedling/api run db:seed-demo 2>&1 | sed 's/^/  /'

# Step 4: Dev servers
echo ""
printf "${BOLD}  [4/4]${NC} Starting dev servers...\n"
printf "  ${DIM}API:     http://localhost:4000${NC}\n"
printf "  ${DIM}Web:     http://localhost:5173${NC}\n"
printf "  ${DIM}Swagger: http://localhost:4000/docs${NC}\n"
printf "  ${DIM}Mailpit: http://localhost:8025${NC}\n"
echo ""

pnpm dev
