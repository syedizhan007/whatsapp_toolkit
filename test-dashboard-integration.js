/**
 * Dashboard Integration Test Script
 * Run this in the browser console when dashboard.html is loaded
 */

// Test 1: Verify API endpoint returns correct structure
async function testDashboardStatsAPI() {
    console.log('🧪 Test 1: Fetching /api/dashboard/stats...');

    try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();

        console.log('✅ API Response:', data);

        // Verify structure
        const requiredFields = [
            'totalMessages', 'messagesReceived', 'messagesSent',
            'campaignMessagesSent', 'campaignMessagesFailed', 'campaignMessagesPending',
            'activeCampaigns', 'completedCampaigns', 'totalCampaigns',
            'dealsLocked', 'numbersValidated', 'totalSent', 'totalDeals',
            'campaigns', 'dealsBreakdown'
        ];

        const missingFields = requiredFields.filter(field => !(field in data.stats));

        if (missingFields.length === 0) {
            console.log('✅ All required fields present');
        } else {
            console.log('❌ Missing fields:', missingFields);
        }

        // Check campaigns array
        if (Array.isArray(data.stats.campaigns)) {
            console.log(`✅ campaigns is an array with ${data.stats.campaigns.length} items`);
        } else {
            console.log('❌ campaigns is not an array');
        }

        // Check dealsBreakdown
        if (data.stats.dealsBreakdown && typeof data.stats.dealsBreakdown === 'object') {
            console.log('✅ dealsBreakdown exists:', data.stats.dealsBreakdown);
        } else {
            console.log('❌ dealsBreakdown missing or invalid');
        }

        return data;

    } catch (error) {
        console.error('❌ Test 1 Failed:', error);
        return null;
    }
}

// Test 2: Verify charts are initialized
function testChartsInitialized() {
    console.log('🧪 Test 2: Checking if charts are initialized...');

    const campaignCanvas = document.getElementById('campaignChart');
    const dealsCanvas = document.getElementById('dealsChart');

    if (campaignCanvas && typeof campaignChart !== 'undefined') {
        console.log('✅ Campaign chart initialized');
    } else {
        console.log('❌ Campaign chart not initialized');
    }

    if (dealsCanvas && typeof dealsChart !== 'undefined') {
        console.log('✅ Deals chart initialized');
    } else {
        console.log('❌ Deals chart not initialized');
    }
}

// Test 3: Verify stat cards are updating
function testStatCards() {
    console.log('🧪 Test 3: Checking stat card elements...');

    const elements = {
        totalMessages: document.getElementById('totalMessages'),
        totalDeals: document.getElementById('totalDeals'),
        validNumbers: document.getElementById('validNumbers')
    };

    for (const [name, element] of Object.entries(elements)) {
        if (element) {
            console.log(`✅ ${name}: ${element.textContent}`);
        } else {
            console.log(`❌ ${name}: Element not found`);
        }
    }
}

// Test 4: Verify update functions exist
function testUpdateFunctions() {
    console.log('🧪 Test 4: Checking if update functions exist...');

    const functions = [
        'fetchDashboardStats',
        'updateDashboardUI',
        'updateCampaignChart',
        'updateDealsChart',
        'animateCounter'
    ];

    functions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            console.log(`✅ ${funcName} exists`);
        } else {
            console.log(`❌ ${funcName} not found`);
        }
    });
}

// Test 5: Manually trigger a stats update
async function testManualUpdate() {
    console.log('🧪 Test 5: Manually triggering stats update...');

    try {
        if (typeof fetchDashboardStats === 'function') {
            await fetchDashboardStats();
            console.log('✅ Manual update completed');
        } else {
            console.log('❌ fetchDashboardStats function not available');
        }
    } catch (error) {
        console.error('❌ Manual update failed:', error);
    }
}

// Test 6: Check auto-refresh interval
function testAutoRefresh() {
    console.log('🧪 Test 6: Checking auto-refresh (wait 10 seconds)...');
    console.log('⏳ Monitoring console for stats updates...');
    console.log('💡 You should see "✅ Dashboard stats updated" in ~10 seconds');
}

// Run all tests
async function runAllTests() {
    console.clear();
    console.log('🚀 Starting Dashboard Integration Tests...\n');

    await testDashboardStatsAPI();
    console.log('\n');

    testChartsInitialized();
    console.log('\n');

    testStatCards();
    console.log('\n');

    testUpdateFunctions();
    console.log('\n');

    await testManualUpdate();
    console.log('\n');

    testAutoRefresh();
    console.log('\n');

    console.log('✅ All tests completed!');
    console.log('📊 Check the dashboard to verify:');
    console.log('   1. Stat cards show real numbers');
    console.log('   2. Campaign Performance chart shows campaign data');
    console.log('   3. Deals Overview chart shows deal breakdown');
    console.log('   4. Charts update every 10 seconds');
}

// Export for console use
window.testDashboard = {
    runAll: runAllTests,
    testAPI: testDashboardStatsAPI,
    testCharts: testChartsInitialized,
    testCards: testStatCards,
    testFunctions: testUpdateFunctions,
    testUpdate: testManualUpdate
};

console.log('📋 Dashboard Integration Test Script Loaded!');
console.log('💡 Run: testDashboard.runAll()');
console.log('💡 Or run individual tests: testDashboard.testAPI(), testDashboard.testCharts(), etc.');
