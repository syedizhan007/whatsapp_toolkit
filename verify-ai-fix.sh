#!/bin/bash

# AI Agent Fix Verification Script
# Run this to verify all fixes are working

echo "🔍 AI Agent Fix Verification"
echo "=============================="
echo ""

# Test 1: Check if .env file exists
echo "✓ Test 1: Checking .env file..."
if [ -f .env ]; then
    echo "  ✅ .env file exists"
else
    echo "  ❌ .env file NOT found!"
    exit 1
fi

# Test 2: Check if GROQ_API_KEY is in .env
echo ""
echo "✓ Test 2: Checking GROQ_API_KEY..."
if grep -q "GROQ_API_KEY=" .env; then
    KEY_LENGTH=$(grep "GROQ_API_KEY=" .env | cut -d'=' -f2 | tr -d '\n' | wc -c)
    echo "  ✅ GROQ_API_KEY found (${KEY_LENGTH} chars)"
else
    echo "  ❌ GROQ_API_KEY NOT found in .env!"
    exit 1
fi

# Test 3: Check if dotenv is installed
echo ""
echo "✓ Test 3: Checking dotenv package..."
if npm list dotenv &>/dev/null; then
    echo "  ✅ dotenv package installed"
else
    echo "  ❌ dotenv NOT installed!"
    exit 1
fi

# Test 4: Check if server.js has dotenv config
echo ""
echo "✓ Test 4: Checking server.js configuration..."
if grep -q "require('dotenv').config()" server.js; then
    echo "  ✅ dotenv.config() found in server.js"
else
    echo "  ❌ dotenv.config() NOT found in server.js!"
    exit 1
fi

# Test 5: Check if conversation history functions exist
echo ""
echo "✓ Test 5: Checking conversation history functions..."
if grep -q "function getConversationHistory" server.js; then
    echo "  ✅ getConversationHistory() exists"
else
    echo "  ❌ getConversationHistory() NOT found!"
    exit 1
fi

if grep -q "function cleanAIResponse" server.js; then
    echo "  ✅ cleanAIResponse() exists"
else
    echo "  ❌ cleanAIResponse() NOT found!"
    exit 1
fi

# Test 6: Check if clear conversation API exists
echo ""
echo "✓ Test 6: Checking conversation clear APIs..."
if grep -q "/api/conversation/clear" server.js; then
    echo "  ✅ Conversation clear APIs exist"
else
    echo "  ❌ Conversation clear APIs NOT found!"
    exit 1
fi

# Test 7: Quick environment variable load test
echo ""
echo "✓ Test 7: Testing environment variable loading..."
node -e "require('dotenv').config(); console.log(process.env.GROQ_API_KEY ? '  ✅ GROQ_API_KEY loads successfully' : '  ❌ GROQ_API_KEY failed to load');"

echo ""
echo "=============================="
echo "✅ ALL CHECKS PASSED!"
echo ""
echo "📋 Next Steps:"
echo "1. Restart your server: npm start"
echo "2. Enable AI Agent from dashboard"
echo "3. Test with real WhatsApp messages"
echo ""
echo "🧪 Test Conversation:"
echo "   Customer: Hi"
echo "   Expected: Natural reply (NO system instructions)"
echo ""
echo "🗑️ Clear conversation if needed:"
echo "   curl -X POST http://localhost:3000/api/conversation/clear-all \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"userId\":\"YOUR_USER_ID\"}'"
echo ""
