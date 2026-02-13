#!/usr/bin/env bash
# Run all test tiers: unit → integration → E2E
# Stops on first failure unless --continue is passed
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

cd "$(dirname "$0")/.."

CONTINUE_ON_FAIL=false
if [[ "${1:-}" == "--continue" ]]; then
  CONTINUE_ON_FAIL=true
fi

UNIT_RESULT=0
INTEGRATION_RESULT=0
E2E_RESULT=0

echo ""
printf "${BOLD}${CYAN}  Seedling HQ — Full Test Suite${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"
echo ""

# Unit tests
printf "${BOLD}  [1/3] Unit Tests${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"
if pnpm test 2>&1; then
  UNIT_RESULT=0
else
  UNIT_RESULT=1
  if [[ "$CONTINUE_ON_FAIL" == false ]]; then
    echo ""
    printf "  ${RED}Unit tests failed. Stopping.${NC} Use --continue to run all tiers.\n\n"
    exit 1
  fi
fi
echo ""

# Integration tests
printf "${BOLD}  [2/3] Integration Tests${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"
if pnpm test:integration 2>&1; then
  INTEGRATION_RESULT=0
else
  INTEGRATION_RESULT=1
  if [[ "$CONTINUE_ON_FAIL" == false ]]; then
    echo ""
    printf "  ${RED}Integration tests failed. Stopping.${NC} Use --continue to run all tiers.\n\n"
    exit 1
  fi
fi
echo ""

# E2E tests
printf "${BOLD}  [3/3] E2E Tests${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"
if pnpm test:e2e 2>&1; then
  E2E_RESULT=0
else
  E2E_RESULT=1
fi
echo ""

# Summary
printf "${BOLD}${CYAN}  Summary${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"

print_result() {
  local name="$1" result="$2"
  if [[ "$result" == "0" ]]; then
    printf "  ${GREEN}PASS${NC}  %s\n" "$name"
  else
    printf "  ${RED}FAIL${NC}  %s\n" "$name"
  fi
}

print_result "Unit tests" "$UNIT_RESULT"
print_result "Integration tests" "$INTEGRATION_RESULT"
print_result "E2E tests" "$E2E_RESULT"
echo ""

if (( UNIT_RESULT + INTEGRATION_RESULT + E2E_RESULT > 0 )); then
  printf "  ${RED}Some test tiers failed.${NC}\n\n"
  exit 1
else
  printf "  ${GREEN}All test tiers passed.${NC}\n\n"
fi
