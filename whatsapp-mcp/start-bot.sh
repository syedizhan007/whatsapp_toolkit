#!/bin/bash

echo "=== Testing WhatsApp Auto-Reply Bot ==="
echo ""
echo "Starting bot in auto-reply mode..."
echo "The bot should:"
echo "  1. Show QR code for scanning"
echo "  2. Authenticate successfully"
echo "  3. Stay running and listen for messages"
echo "  4. Show status updates every 30 seconds"
echo ""
echo "Press Ctrl+C to stop the bot"
echo ""
echo "-------------------------------------------"
echo ""

cd "$(dirname "$0")"
node index.js --auto-reply
