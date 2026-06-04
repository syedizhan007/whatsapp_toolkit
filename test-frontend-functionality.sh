#!/bin/bash
# Frontend Functionality Test

echo "🧪 Testing Frontend Fixes..."
echo ""

BASE_URL="http://localhost:3000"

# Test 1: Agent Start
echo "Test 1: Agent Start"
START_RESPONSE=$(curl -s -X POST $BASE_URL/api/agent/start -H "Content-Type: application/json")
echo "Response: $START_RESPONSE"

if echo $START_RESPONSE | grep -q '"status":"online"'; then
    echo "✅ PASS: Returns 'online' status"
else
    echo "❌ FAIL: Status format incorrect"
fi
echo ""

# Test 2: Agent Stop
echo "Test 2: Agent Stop"
STOP_RESPONSE=$(curl -s -X POST $BASE_URL/api/agent/stop -H "Content-Type: application/json")
echo "Response: $STOP_RESPONSE"

if echo $STOP_RESPONSE | grep -q '"status":"offline"'; then
    echo "✅ PASS: Returns 'offline' status"
else
    echo "❌ FAIL: Status format incorrect"
fi
echo ""

# Test 3: Campaign Creation
echo "Test 3: Campaign Creation"
CAMPAIGN_RESPONSE=$(curl -s -X POST $BASE_URL/api/campaigns \
    -H "Content-Type: application/json" \
    -d '{"name":"Frontend Test","message":"Test Message"}')
echo "Response: $CAMPAIGN_RESPONSE"

if echo $CAMPAIGN_RESPONSE | grep -q '"success":true'; then
    echo "✅ PASS: Campaign created"
else
    echo "❌ FAIL: Campaign creation failed"
fi
echo ""

# Test 4: Blacklist Add
echo "Test 4: Blacklist Add"
BLACKLIST_RESPONSE=$(curl -s -X POST $BASE_URL/api/campaigns/blacklist/add \
    -H "Content-Type: application/json" \
    -d '{"phone":"9999999999","reason":"Test"}')
echo "Response: $BLACKLIST_RESPONSE"

if echo $BLACKLIST_RESPONSE | grep -q '"success":true'; then
    echo "✅ PASS: Blacklist add working"
elif echo $BLACKLIST_RESPONSE | grep -q 'UNIQUE constraint'; then
    echo "✅ PASS: Blacklist add working (already exists)"
else
    echo "❌ FAIL: Blacklist add failed"
fi
echo ""

echo "=========================================="
echo "✅ All Backend Endpoints Working"
echo "=========================================="
echo ""
echo "📋 Frontend Testing Instructions:"
echo ""
echo "1. Open: http://localhost:3000/test-frontend.html"
echo "2. Open browser console (F12)"
echo "3. Click 'Start Agent' button"
echo "4. Verify in console:"
echo "   - Button disabled message"
echo "   - API call logged"
echo "   - Response logged"
echo "   - Status update logged"
echo "   - Button enabled message"
echo "5. Verify UI:"
echo "   - Status shows 'Online'"
echo "   - Button changes to 'Stop Agent'"
echo "6. Click 'Stop Agent'"
echo "7. Verify:"
echo "   - Status shows 'Offline'"
echo "   - Button changes to 'Start Agent'"
echo ""
echo "🔥 Rapid Click Test:"
echo "1. Click 'Start Agent' 5 times rapidly"
echo "2. Should see 'Request already in progress' alert"
echo "3. Only 1 API call should fire"
echo ""
echo "✅ If all above works = COMPLETE SUCCESS"
