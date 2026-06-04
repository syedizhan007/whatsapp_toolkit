#!/bin/bash
# Complete Frontend + Data Sync Test

echo "🧪 Testing Complete Frontend Implementation..."
echo ""

BASE_URL="http://localhost:3000"

# Test 1: Health Check
echo "Test 1: Server Health Check"
HEALTH=$(curl -s $BASE_URL/api/health)
echo "Response: $HEALTH"
if echo $HEALTH | grep -q '"success":true'; then
    echo "✅ PASS: Server is healthy"
else
    echo "❌ FAIL: Server health check failed"
    exit 1
fi
echo ""

# Test 2: Agent Status Check
echo "Test 2: Agent Status Check"
STATUS=$(curl -s $BASE_URL/api/agent/status)
echo "Response: $STATUS"
if echo $STATUS | grep -q '"success":true'; then
    echo "✅ PASS: Agent status endpoint working"
else
    echo "❌ FAIL: Agent status check failed"
fi
echo ""

# Test 3: Agent Start (Returns 'online')
echo "Test 3: Agent Start (Returns 'online')"
START=$(curl -s -X POST $BASE_URL/api/agent/start -H "Content-Type: application/json")
echo "Response: $START"
if echo $START | grep -q '"status":"online"'; then
    echo "✅ PASS: Agent start returns 'online' status"
else
    echo "❌ FAIL: Agent start status format incorrect"
fi
echo ""

# Test 4: Agent Stop (Returns 'offline')
echo "Test 4: Agent Stop (Returns 'offline')"
STOP=$(curl -s -X POST $BASE_URL/api/agent/stop -H "Content-Type: application/json")
echo "Response: $STOP"
if echo $STOP | grep -q '"status":"offline"'; then
    echo "✅ PASS: Agent stop returns 'offline' status"
else
    echo "❌ FAIL: Agent stop status format incorrect"
fi
echo ""

# Test 5: Campaigns List
echo "Test 5: Campaigns List"
CAMPAIGNS=$(curl -s $BASE_URL/api/campaigns)
echo "Response: $CAMPAIGNS"
if echo $CAMPAIGNS | grep -q '"success":true'; then
    echo "✅ PASS: Campaigns endpoint working"
else
    echo "❌ FAIL: Campaigns endpoint failed"
fi
echo ""

# Test 6: Blacklist List
echo "Test 6: Blacklist List"
BLACKLIST=$(curl -s $BASE_URL/api/campaigns/blacklist/all)
echo "Response: $BLACKLIST"
if echo $BLACKLIST | grep -q '"success":true'; then
    echo "✅ PASS: Blacklist endpoint working"
else
    echo "❌ FAIL: Blacklist endpoint failed"
fi
echo ""

# Test 7: Add to Blacklist
echo "Test 7: Add to Blacklist"
ADD_BLACKLIST=$(curl -s -X POST $BASE_URL/api/campaigns/blacklist/add \
    -H "Content-Type: application/json" \
    -d '{"phone":"1234567890","reason":"Test"}')
echo "Response: $ADD_BLACKLIST"
if echo $ADD_BLACKLIST | grep -q '"success":true' || echo $ADD_BLACKLIST | grep -q 'UNIQUE constraint'; then
    echo "✅ PASS: Blacklist add working"
else
    echo "❌ FAIL: Blacklist add failed"
fi
echo ""

# Test 8: Create Campaign
echo "Test 8: Create Campaign"
CREATE_CAMPAIGN=$(curl -s -X POST $BASE_URL/api/campaigns \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Campaign","message":"Test Message","delay_min":3,"delay_max":8,"batch_size":50,"batch_delay":300}')
echo "Response: $CREATE_CAMPAIGN"
if echo $CREATE_CAMPAIGN | grep -q '"success":true'; then
    echo "✅ PASS: Campaign creation working"
else
    echo "❌ FAIL: Campaign creation failed"
fi
echo ""

# Test 9: Deals Endpoint
echo "Test 9: Deals Endpoint"
DEALS=$(curl -s $BASE_URL/api/deals)
echo "Response: $DEALS"
if echo $DEALS | grep -q '"success":true'; then
    echo "✅ PASS: Deals endpoint working"
else
    echo "❌ FAIL: Deals endpoint failed"
fi
echo ""

# Test 10: Frontend File Exists
echo "Test 10: Frontend Files Check"
if [ -f "frontend/dashboard.html" ] && [ -f "frontend/dashboard.js" ]; then
    echo "✅ PASS: Frontend files exist"
else
    echo "❌ FAIL: Frontend files missing"
fi
echo ""

echo "=========================================="
echo "✅ All Backend Tests Complete"
echo "=========================================="
echo ""
echo "📋 Frontend Manual Testing Instructions:"
echo ""
echo "1. Open: http://localhost:3000/dashboard.html"
echo "2. Open browser console (F12)"
echo ""
echo "✅ Test Agent Status Sync:"
echo "   - Check status shows 'OFFLINE' on load"
echo "   - Click 'Stop Agent' button"
echo "   - Verify status changes to 'ONLINE'"
echo "   - Verify button changes to 'Stop Agent'"
echo "   - Click 'Stop Agent'"
echo "   - Verify status changes to 'OFFLINE'"
echo "   - Verify button changes to 'Start Agent'"
echo ""
echo "✅ Test Data Loading:"
echo "   - Check console for '✅ Blacklist loaded' message"
echo "   - Check console for '✅ Campaigns loaded' message"
echo "   - Check console for '✅ Deals loaded' message"
echo "   - Check console for '✅ Agent status loaded' message"
echo ""
echo "✅ Test Blacklist Sync:"
echo "   - Add a number to blacklist"
echo "   - Verify it appears in list immediately"
echo "   - Click delete button"
echo "   - Verify it's removed immediately"
echo ""
echo "✅ Test Campaign Sync:"
echo "   - Create a new campaign"
echo "   - Verify it appears in table immediately"
echo "   - Click pause button"
echo "   - Verify status changes and buttons update"
echo ""
echo "✅ Test Group Extract CSV:"
echo "   - Enter a group link"
echo "   - Click 'Extract Contacts'"
echo "   - Verify CSV file downloads"
echo ""
echo "🎯 If all above works = COMPLETE SUCCESS"
