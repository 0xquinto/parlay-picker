#!/bin/bash

# Monitoring script for NFL Prediction Aggregator
# Run this periodically to check system health

set -e

PORT=${PORT:-3000}
BASE_URL="http://localhost:${PORT}"
LOG_DIR="logs"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 NFL PREDICTION AGGREGATOR - SYSTEM MONITOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Server Status
echo "1️⃣  Server Status:"
if lsof -ti:${PORT} > /dev/null 2>&1; then
    echo "   ✅ Server is running on port ${PORT}"
else
    echo "   ❌ Server is NOT running"
    echo ""
    echo "   Start with: npm run dev"
    exit 1
fi

# 2. Health Check
echo ""
echo "2️⃣  Health Check:"
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health" || echo "")
if [ -z "$HEALTH_RESPONSE" ]; then
    echo "   ❌ Cannot reach health endpoint"
    exit 1
fi

HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null || echo "error")
DB_OK=$(echo "$HEALTH_RESPONSE" | jq -r '.db.ok' 2>/dev/null || echo "false")

if [ "$HEALTH_STATUS" = "ok" ]; then
    echo "   ✅ Health check PASSED"
else
    echo "   ❌ Health check FAILED (status: $HEALTH_STATUS)"
fi

# 3. Database Connection
echo ""
echo "3️⃣  Database Connection:"
if [ "$DB_OK" = "true" ]; then
    echo "   ✅ Database connection OK"
else
    DB_ERROR=$(echo "$HEALTH_RESPONSE" | jq -r '.db.error' 2>/dev/null || echo "Unknown error")
    echo "   ❌ Database connection FAILED: $DB_ERROR"
fi

# 4. Sources Status
echo ""
echo "4️⃣  Sources Status:"
SOURCES_RESPONSE=$(curl -s "${BASE_URL}/sources" || echo "[]")
SOURCES_COUNT=$(echo "$SOURCES_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
ACTIVE_COUNT=$(echo "$SOURCES_RESPONSE" | jq '[.[] | select(.activeFlag == true)] | length' 2>/dev/null || echo "0")

echo "   Total sources: $SOURCES_COUNT"
echo "   Active sources: $ACTIVE_COUNT"

if [ "$ACTIVE_COUNT" -gt 0 ]; then
    echo "   ✅ Sources configured"
else
    echo "   ⚠️  No active sources (run: npm run import:sources)"
fi

# 5. Ingestion State
echo ""
echo "5️⃣  Ingestion State:"
INGESTION=$(echo "$HEALTH_RESPONSE" | jq -r '.ingestion' 2>/dev/null || echo "{}")
INGESTION_STATUS=$(echo "$INGESTION" | jq -r '.status' 2>/dev/null || echo "unknown")
LAST_RUN=$(echo "$INGESTION" | jq -r '.lastRun' 2>/dev/null || echo "never")
LAST_SUCCESS=$(echo "$INGESTION" | jq -r '.lastSuccess' 2>/dev/null || echo "never")

echo "   Status: $INGESTION_STATUS"
if [ "$LAST_RUN" != "null" ] && [ "$LAST_RUN" != "never" ]; then
    echo "   Last run: $LAST_RUN"
fi
if [ "$LAST_SUCCESS" != "null" ] && [ "$LAST_SUCCESS" != "never" ]; then
    echo "   Last success: $LAST_SUCCESS"
fi

if [ "$INGESTION_STATUS" = "idle" ] || [ "$INGESTION_STATUS" = "success" ]; then
    echo "   ✅ Ingestion system ready"
elif [ "$INGESTION_STATUS" = "running" ]; then
    echo "   ⏳ Ingestion in progress"
else
    echo "   ⚠️  Ingestion status: $INGESTION_STATUS"
fi

# 6. Recent Activity
echo ""
echo "6️⃣  Recent Logs (last 5 info/warn/error):"
if [ -f "${LOG_DIR}/combined.log" ]; then
    tail -n 50 "${LOG_DIR}/combined.log" 2>/dev/null | grep -E '"(level":"(info|warn|error))' | tail -5 | while read line; do
        LEVEL=$(echo "$line" | jq -r '.level' 2>/dev/null || echo "unknown")
        MESSAGE=$(echo "$line" | jq -r '.message' 2>/dev/null || echo "$line")
        TIMESTAMP=$(echo "$line" | jq -r '.timestamp' 2>/dev/null || echo "")
        echo "   [$LEVEL] $MESSAGE"
    done || echo "   No recent log entries"
else
    echo "   No log file found"
fi

# 7. Error Check
echo ""
echo "7️⃣  Error Log Check:"
if [ -f "${LOG_DIR}/error.log" ]; then
    ERROR_COUNT=$(tail -n 100 "${LOG_DIR}/error.log" 2>/dev/null | grep -c '"level":"error"' || echo "0")
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "   ⚠️  Found $ERROR_COUNT recent error(s)"
        echo "   Recent errors:"
        tail -n 20 "${LOG_DIR}/error.log" 2>/dev/null | grep '"level":"error"' | tail -3 | while read line; do
            MESSAGE=$(echo "$line" | jq -r '.message' 2>/dev/null || echo "$line")
            TIMESTAMP=$(echo "$line" | jq -r '.timestamp' 2>/dev/null || echo "")
            echo "      [$TIMESTAMP] $MESSAGE"
        done
    else
        echo "   ✅ No recent errors"
    fi
else
    echo "   ✅ No error log file (no errors yet)"
fi

# 8. Predictions Count
echo ""
echo "8️⃣  Data Status:"
PREDICTIONS_RESPONSE=$(curl -s "${BASE_URL}/predictions" || echo "[]")
PREDICTIONS_COUNT=$(echo "$PREDICTIONS_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
echo "   Predictions in database: $PREDICTIONS_COUNT"

if [ "$PREDICTIONS_COUNT" -gt 0 ]; then
    echo "   ✅ Predictions available"
else
    echo "   ℹ️  No predictions yet (run ingestion to collect)"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ALL_OK=true

if ! lsof -ti:${PORT} > /dev/null 2>&1; then
    echo "❌ Server not running"
    ALL_OK=false
fi

if [ "$HEALTH_STATUS" != "ok" ]; then
    echo "❌ Health check failed"
    ALL_OK=false
fi

if [ "$DB_OK" != "true" ]; then
    echo "❌ Database connection failed"
    ALL_OK=false
fi

if [ "$ACTIVE_COUNT" -eq 0 ]; then
    echo "⚠️  No active sources"
fi

if [ "$ALL_OK" = true ] && [ "$ACTIVE_COUNT" -gt 0 ]; then
    echo "✅ All systems operational"
    echo ""
    echo "Quick commands:"
    echo "  Health: curl ${BASE_URL}/health | jq"
    echo "  Trigger ingestion: curl -X POST ${BASE_URL}/ingest | jq"
    echo "  View logs: tail -f ${LOG_DIR}/combined.log"
else
    echo "⚠️  Some issues detected - check details above"
fi

echo ""

