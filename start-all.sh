#!/bin/bash

echo "========================================"
echo " WhatsApp Tool - Start All Servers"
echo "========================================"
echo ""

echo "[1/4] Starting Root Server (Port 3000)..."
node server.js &
ROOT_PID=$!
sleep 3

echo "[2/4] Starting Backend Server (Port 3001)..."
cd backend && node server.js &
BACKEND_PID=$!
cd ..
sleep 3

echo "[3/4] Starting Dashboard Server (Port 3002)..."
cd dashboard && node server.js &
DASHBOARD_PID=$!
cd ..
sleep 2

echo "[4/4] All servers started!"
echo ""
echo "========================================"
echo " Server URLs:"
echo "========================================"
echo " Root Server:      http://localhost:3000 (PID: $ROOT_PID)"
echo " Backend Server:   http://localhost:3001 (PID: $BACKEND_PID)"
echo " Dashboard Server: http://localhost:3002 (PID: $DASHBOARD_PID)"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to kill all servers on exit
cleanup() {
    echo ""
    echo "Stopping all servers..."
    kill $ROOT_PID $BACKEND_PID $DASHBOARD_PID 2>/dev/null
    echo "All servers stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Wait for all background processes
wait
