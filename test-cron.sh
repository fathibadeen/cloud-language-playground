#!/bin/bash

# Quick test script for cron endpoints
# Usage: ./test-cron.sh <job-name>

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${LOVABLE_CRON_SECRET:-test-secret}"
JOB_NAME="${1:-webhook-retry}"

echo "🔧 Testing Cron Job: $JOB_NAME"
echo "📍 URL: $BASE_URL/api/cron/$JOB_NAME"
echo ""

# Make request
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/cron/$JOB_NAME" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

# Extract status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📦 Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""
echo "📊 Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Job executed successfully!"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "🔐 Authentication failed - check LOVABLE_CRON_SECRET"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "❌ Job not found - available jobs:"
  echo "  - webhook-retry"
  echo "  - nabrah-reconcile"
  echo "  - usage-alerts"
  echo "  - subscription-cycle"
  echo "  - sla-escalation"
  echo "  - conversation-janitor"
  echo "  - retention"
else
  echo "❌ Job failed with status $HTTP_CODE"
fi
