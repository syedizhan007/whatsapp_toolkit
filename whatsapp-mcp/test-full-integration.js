import WhatsAppClient from './whatsapp-client.js';
import * as dealTracker from './deal-tracker.js';

async function testFullIntegration() {
    console.log('=== Full Integration Test: Message → Deal Detection → Save ===\n');

    const client = new WhatsAppClient();

    // Simulate incoming messages with different phone formats
    const testScenarios = [
        {
            contactName: 'Ahmed Khan',
            phoneId: '923001234567@c.us',
            message: 'bhai order kardo 5 pieces'
        },
        {
            contactName: 'Sara Ali',
            phoneId: '923451234567@s.whatsapp.net',
            message: 'le lo yaar, final hai'
        },
        {
            contactName: 'Bilal Sheikh',
            phoneId: '92:3121234567@lid',
            message: 'kitne ka hai?' // Should NOT be saved as deal
        },
        {
            contactName: 'Fatima Malik',
            phoneId: '923331234567@c.us',
            message: 'haan kar lo confirm'
        },
        {
            contactName: 'Usman Ahmed',
            phoneId: '923211234567@lid',
            message: 'pic bhejo' // Should NOT be saved as deal
        },
        {
            contactName: 'Ayesha Tariq',
            phoneId: '923451234567@c.us',
            message: 'done bhai, book kar do'
        }
    ];

    console.log('Processing messages...\n');

    for (const scenario of testScenarios) {
        console.log(`📨 Message from ${scenario.contactName} (${scenario.phoneId})`);
        console.log(`   Message: "${scenario.message}"`);

        // Clean phone number
        const cleanPhone = client.cleanPhoneNumber(scenario.phoneId);
        console.log(`   Cleaned phone: ${cleanPhone}`);

        // Detect if it's a deal
        const isDeal = await client.detectDealWithAI(scenario.message);
        console.log(`   Deal detected: ${isDeal ? '✅ YES' : '❌ NO'}`);

        if (isDeal) {
            // Save to deal tracker
            try {
                const deal = await dealTracker.addDeal(
                    scenario.contactName,
                    cleanPhone,
                    scenario.message,
                    'pending'
                );
                console.log(`   ✅ Saved to tracker with ID: ${deal.id}`);
            } catch (error) {
                console.error(`   ❌ Error saving: ${error.message}`);
            }
        }

        console.log('');
    }

    // Show all saved deals
    console.log('\n=== All Saved Deals ===');
    const allDeals = await dealTracker.getDeals();
    console.log(`Total deals: ${allDeals.length}\n`);

    allDeals.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.customerName} (${deal.phoneNumber})`);
        console.log(`   Message: ${deal.message}`);
        console.log(`   Status: ${deal.status}`);
        console.log(`   ID: ${deal.id}\n`);
    });

    console.log('=== Test Complete ===');
}

testFullIntegration().catch(console.error);
