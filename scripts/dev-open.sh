#!/usr/bin/env bash
# Open all dev URLs in the default browser
set -euo pipefail

GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

# Detect OS and set open command
if [[ "$OSTYPE" == "darwin"* ]]; then
  OPEN_CMD="open"
elif command -v xdg-open &> /dev/null; then
  OPEN_CMD="xdg-open"
elif command -v wslview &> /dev/null; then
  OPEN_CMD="wslview"
else
  echo "Could not detect a browser open command. Open these URLs manually:"
  echo "  http://localhost:5173/login"
  echo "  http://localhost:4000/docs"
  echo "  http://localhost:8025"
  exit 0
fi

echo ""
printf "  ${GREEN}Opening${NC}  ${DIM}Login page     → http://localhost:5173/login${NC}\n"
$OPEN_CMD "http://localhost:5173/login"

printf "  ${GREEN}Opening${NC}  ${DIM}Swagger UI     → http://localhost:4000/docs${NC}\n"
$OPEN_CMD "http://localhost:4000/docs"

printf "  ${GREEN}Opening${NC}  ${DIM}Mailpit        → http://localhost:8025${NC}\n"
$OPEN_CMD "http://localhost:8025"

echo ""
