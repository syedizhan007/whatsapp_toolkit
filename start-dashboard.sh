#!/bin/bash

echo "========================================"
echo "WhatsApp Toolkit - Starting Servers"
echo "========================================"
echo ""

echo "Starting Status Server (Port 3001)..."
cd whatsapp-mcp
node status-server.js &
STATUS_PID=$!
cd ..

sleep 2

echo "Starting Dashboard Server (Port 3000)..."
cd dashboard
node server.js &
DASHBOARD_PID=$!
cd ..

sleep 2

echo ""
echo "========================================"
echo "Servers Started Successfully!"
echo "========================================"
echo ""
echo "Dashboard: http://localhost:3000"
echo "Status API: http://localhost:3001"
echo ""
echo "Status Server PID: $STATUS_PID"
echo "Dashboard Server PID: $DASHBOARD_PID"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $STATUS_PID 2>/dev/null
    kill $DASHBOARD_PID 2>/dev/null
    echo "Servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
