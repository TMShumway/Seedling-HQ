#!/usr/bin/env bash
# Clear all emails from Mailpit
set -euo pipefail

curl -s -X DELETE http://localhost:8025/api/v1/messages > /dev/null && echo "Mailpit inbox cleared."
