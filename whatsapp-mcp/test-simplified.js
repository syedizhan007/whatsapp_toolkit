import WhatsAppClient from './whatsapp-client.js';
import * as dealTracker from './deal-tracker.js';
import fs from 'fs/promises';

async function testSimplified() {
    console.log('=== Simplified Phone Extraction Test ===\n');

    const client = new WhatsAppClient();

    // Clear old data
    try {
        await fs.unlink('./deals.json');
        await fs.unlink('./deals.csv');
    } catch (e) {
        // Ignore if files don't exist
    }

    // Test key scenarios
    const scenarios = [
        {
            name: 'LID with correct Pakistan number',
            messageFrom: '208186124562527@lid',
            contact: {
                number: '923318851184',
                pushname: 'Mona Kamal',
                id: { user: '923318851184', _serialized: '923318851184@c.us' }
            },
            message: 'order kardo bhai'
        },
        {
            name: 'Regular Pakistan number',
            messageFrom: '923001234567@c.us',
            contact: {
                number: '923001234567',
                pushname: 'Ahmed Khan',
                id: { user: '923001234567', _serialized: '923001234567@c.us' }
            },
            message: 'le lo yaar'
        },
        {
            name: 'Pakistan without country code',
            messageFrom: '3451234567@c.us',
            contact: {
                number: '3451234567',
                pushname: 'Sara Ali',
                id: { user: '3451234567', _serialized: '3451234567@c.us' }
            },
            message: 'done hai'
        }
    ];

    console.log('Testing and saving deals:\n');

    for (const scenario of scenarios) {
        console.log(`${scenario.name}`);
        console.log(`  From: ${scenario.messageFrom}`);

        const phone = await client.getRealPhoneNumber(scenario.messageFrom, scenario.contact);
        console.log(`  Extracted Phone: ${phone}`);
        console.log(`  Length: ${phone.length} digits`);

        // Save deal
        await dealTracker.addDeal(
            scenario.contact.pushname,
            phone,
            scenario.message,
            'pending'
        );
        console.log(`  ✅ Saved\n`);
    }

    // Verify
    console.log('=== Saved Deals ===\n');
    const deals = await dealTracker.getDeals();

    deals.forEach((deal, i) => {
        console.log(`${i + 1}. ${deal.customerName}`);
        console.log(`   Phone: ${deal.phoneNumber} (${deal.phoneNumber.length} digits)`);
        console.log(`   Message: ${deal.message}\n`);
    });

    console.log('=== Test Complete ===');
}

testSimplified().catch(console.error);
