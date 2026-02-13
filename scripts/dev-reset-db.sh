#!/usr/bin/env bash
# Reset database to clean state without stopping servers
# Truncates all tables, re-pushes schema, and re-seeds demo data
set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

cd "$(dirname "$0")/.."

echo ""
printf "${BOLD}${CYAN}  Seedling HQ — Database Reset${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"
echo ""

printf "  ${DIM}Truncating all tables...${NC}\n"
pnpm --filter @seedling/api run db:reset 2>&1 | sed 's/^/  /'

printf "  ${DIM}Pushing schema...${NC}\n"
pnpm --filter @seedling/api run db:push 2>&1 | sed 's/^/  /'

printf "  ${DIM}Seeding demo data...${NC}\n"
pnpm --filter @seedling/api run db:seed 2>&1 | sed 's/^/  /'

echo ""
printf "  ${GREEN}Database reset complete.${NC}\n"
printf "  ${DIM}If the web app is open, clear localStorage and reload:${NC}\n"
printf "  ${DIM}  localStorage.clear(); location.reload();${NC}\n"
echo ""
