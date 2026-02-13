#!/usr/bin/env bash
# List LocalStack S3 bucket contents
# Usage:
#   bash scripts/s3-ls.sh              # List all objects in seedling-uploads
#   bash scripts/s3-ls.sh photos       # List objects matching "photos" prefix
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

ENDPOINT="http://localhost:4566"
BUCKET="seedling-uploads"
PREFIX="${1:-}"

# Check LocalStack is running
if ! curl -sf "$ENDPOINT/_localstack/health" > /dev/null 2>&1; then
  printf "${RED}LocalStack is not running.${NC} Start it with: pnpm services:up\n"
  exit 1
fi

echo ""
printf "${BOLD}${CYAN}  S3 Bucket: ${BUCKET}${NC}\n"
printf "${DIM}  ────────────────────────────────────────────${NC}\n"

if [[ -n "$PREFIX" ]]; then
  printf "  ${DIM}Prefix: ${PREFIX}${NC}\n"
fi
echo ""

# Use the S3 REST API directly (no aws CLI dependency)
if [[ -n "$PREFIX" ]]; then
  RESPONSE=$(curl -sf "${ENDPOINT}/${BUCKET}?prefix=${PREFIX}" 2>/dev/null || echo "")
else
  RESPONSE=$(curl -sf "${ENDPOINT}/${BUCKET}" 2>/dev/null || echo "")
fi

if [[ -z "$RESPONSE" ]]; then
  printf "  ${RED}Could not list bucket. Is the bucket created?${NC}\n"
  echo ""
  exit 1
fi

# Parse XML response for Key and Size elements
KEYS=$(echo "$RESPONSE" | grep -oP '<Key>\K[^<]+' 2>/dev/null || echo "$RESPONSE" | sed -n 's/.*<Key>\([^<]*\)<\/Key>.*/\1/p')
SIZES=$(echo "$RESPONSE" | grep -oP '<Size>\K[^<]+' 2>/dev/null || echo "$RESPONSE" | sed -n 's/.*<Size>\([^<]*\)<\/Size>.*/\1/p')

if [[ -z "$KEYS" ]]; then
  printf "  ${DIM}(empty — no objects)${NC}\n"
else
  # Combine keys and sizes
  paste <(echo "$KEYS") <(echo "$SIZES") | while IFS=$'\t' read -r key size; do
    if [[ -n "$size" ]]; then
      # Format size
      if (( size > 1048576 )); then
        human="$((size / 1048576)) MB"
      elif (( size > 1024 )); then
        human="$((size / 1024)) KB"
      else
        human="${size} B"
      fi
      printf "  ${GREEN}%8s${NC}  ${DIM}%s${NC}\n" "$human" "$key"
    else
      printf "  ${DIM}%s${NC}\n" "$key"
    fi
  done
fi

echo ""
TOTAL=$(echo "$KEYS" | grep -c . 2>/dev/null || echo "0")
printf "  ${DIM}%s object(s)${NC}\n" "$TOTAL"
echo ""
