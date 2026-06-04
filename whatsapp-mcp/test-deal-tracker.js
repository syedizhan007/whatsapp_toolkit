import * as dealTracker from './deal-tracker.js';

async function testDealTracker() {
    console.log('=== Testing Deal Tracker ===\n');

    // Add some sample deals
    console.log('1. Adding deals...');
    const deal1 = await dealTracker.addDeal(
        'John Doe',
        '+1234567890',
        'Interested in Product A - wants pricing info',
        'pending'
    );

    const deal2 = await dealTracker.addDeal(
        'Jane Smith',
        '+0987654321',
        'Asked about delivery times for bulk order',
        'pending'
    );

    const deal3 = await dealTracker.addDeal(
        'Mike Johnson',
        '+1122334455',
        'Ready to purchase - needs invoice',
        'pending'
    );

    // Add another deal for John Doe (same phone number)
    const deal4 = await dealTracker.addDeal(
        'John Doe',
        '+1234567890',
        'Follow-up: wants to see demo',
        'pending'
    );

    // Get all deals
    console.log('\n2. Getting all deals...');
    const allDeals = await dealTracker.getDeals();
    console.log('Total deals:', allDeals.length);
    console.log(JSON.stringify(allDeals, null, 2));

    // Update a deal status using deal ID
    console.log('\n3. Updating deal status using ID...');
    await dealTracker.updateDealStatus(deal1.id, 'completed');
    console.log(`Updated deal ${deal1.id} to completed`);

    // Get deal by ID
    console.log('\n4. Getting deal by ID...');
    const foundDeal = await dealTracker.getDealById(deal1.id);
    console.log('Found deal:', foundDeal);

    // Get deals by phone number
    console.log('\n5. Getting deals by phone number (+1234567890)...');
    const johnDeals = await dealTracker.getDealsByPhone('+1234567890');
    console.log('Deals for John Doe:', johnDeals.length);
    console.log(JSON.stringify(johnDeals, null, 2));

    // Get deals by status
    console.log('\n6. Getting pending deals...');
    const pendingDeals = await dealTracker.getDealsByStatus('pending');
    console.log('Pending deals:', pendingDeals.length);

    console.log('\n7. Getting completed deals...');
    const completedDeals = await dealTracker.getDealsByStatus('completed');
    console.log('Completed deals:', completedDeals.length);

    // Delete a deal
    console.log('\n8. Deleting a deal...');
    await dealTracker.deleteDeal(deal3.id);
    console.log(`Deleted deal ${deal3.id}`);

    // Verify deletion
    console.log('\n9. Verifying deletion...');
    const finalDeals = await dealTracker.getDeals();
    console.log('Total deals after deletion:', finalDeals.length);

    console.log('\n=== Test Complete ===');
}

testDealTracker().catch(console.error);
