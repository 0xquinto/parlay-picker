#!/bin/bash

# Health check script for NFL Prediction Aggregator
# This script starts the server, checks health, optionally triggers ingestion, and shows logs

set -e

PORT=${PORT:-3000}
BASE_URL="http://localhost:${PORT}"
LOG_DIR="logs"
MAX_WAIT=30

echo "🔍 Checking NFL Prediction Aggregator..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "   Please create a .env file with required environment variables."
    echo "   See README.md for required variables."
    exit 1
fi

echo "✅ .env file found"
echo ""

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "⚠️  node_modules not found. Running npm install..."
    npm install
fi

# Check if dist exists (build)
if [ ! -d dist ]; then
    echo "⚠️  dist folder not found. Building..."
    npm run build
fi

echo "🚀 Starting server on port ${PORT}..."
echo ""

# Start server in background
npm run dev > /tmp/parlay-picker-server.log 2>&1 &
SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
for i in $(seq 1 $MAX_WAIT); do
    if curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
        echo "✅ Server is ready!"
        break
    fi
    if [ $i -eq $MAX_WAIT ]; then
        echo "❌ Server failed to start within ${MAX_WAIT} seconds"
        echo "   Check /tmp/parlay-picker-server.log for errors"
        exit 1
    fi
    sleep 1
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 HEALTH CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Health check
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")

echo "HTTP Status: ${HTTP_STATUS}"
echo ""
echo "Response:"
echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
echo ""

# Check if health is OK
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed (status: ${HTTP_STATUS})"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 RECENT LOGS (last 20 lines)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "${LOG_DIR}/combined.log" ]; then
    tail -n 20 "${LOG_DIR}/combined.log"
else
    echo "No log file found at ${LOG_DIR}/combined.log"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask if user wants to trigger ingestion
read -p "🤔 Trigger ingestion? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Triggering ingestion..."
    INGEST_RESPONSE=$(curl -s -X POST "${BASE_URL}/ingest")
    echo ""
    echo "Response:"
    echo "$INGEST_RESPONSE" | jq '.' 2>/dev/null || echo "$INGEST_RESPONSE"
    echo ""
    echo "⏳ Waiting 5 seconds for ingestion to start..."
    sleep 5
    echo ""
    echo "📊 Updated health check:"
    curl -s "${BASE_URL}/health" | jq '.' 2>/dev/null || curl -s "${BASE_URL}/health"
    echo ""
fi

echo ""
echo "✅ Verification complete!"
echo "   Server PID: ${SERVER_PID}"
echo "   Server logs: /tmp/parlay-picker-server.log"
echo "   Application logs: ${LOG_DIR}/combined.log"
echo ""
echo "   To stop the server, press Ctrl+C or run: kill ${SERVER_PID}"

