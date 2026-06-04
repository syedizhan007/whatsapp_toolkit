import WhatsAppClient from './whatsapp-client.js';
import * as dealTracker from './deal-tracker.js';

async function testContactNumberExtraction() {
    console.log('=== Testing contact.number Direct Extraction ===\n');

    const client = new WhatsAppClient();

    // Simulate the exact scenario from the user's example
    const scenarios = [
        {
            name: 'MonaKamal - Real Scenario',
            messageFrom: '208186124562527@lid',
            contact: {
                number: '923318851184',  // This is what contact.number should return
                pushname: 'MonaKamal',
                name: 'MonaKamal',
                id: {
                    user: '923318851184',
                    _serialized: '923318851184@c.us'
                }
            },
            message: 'Done kerdo',
            expectedPhone: '923318851184'
        },
        {
            name: 'Test with wrong LID number',
            messageFrom: '96718502785092@lid',
            contact: {
                number: '923001234567',  // Real number from contact
                pushname: 'Test User',
                name: 'Test User',
                id: {
                    user: '923001234567',
                    _serialized: '923001234567@c.us'
                }
            },
            message: 'order kardo',
            expectedPhone: '923001234567'
        },
        {
            name: 'Regular @c.us format',
            messageFrom: '923451234567@c.us',
            contact: {
                number: '923451234567',
                pushname: 'Ahmed',
                name: 'Ahmed',
                id: {
                    user: '923451234567',
                    _serialized: '923451234567@c.us'
                }
            },
            message: 'le lo',
            expectedPhone: '923451234567'
        }
    ];

    console.log('Testing phone extraction using contact.number:\n');

    for (const scenario of scenarios) {
        console.log(`📱 ${scenario.name}`);
        console.log(`   Message From: ${scenario.messageFrom}`);
        console.log(`   contact.number: ${scenario.contact.number}`);

        // Test the cleanAndValidatePhone method
        const cleanPhone = client.cleanAndValidatePhone(scenario.contact.number);

        const isCorrect = cleanPhone === scenario.expectedPhone;
        console.log(`   Cleaned Phone: ${cleanPhone}`);
        console.log(`   Expected: ${scenario.expectedPhone}`);
        console.log(`   Result: ${isCorrect ? '✅ PASS' : '❌ FAIL'}\n`);
    }

    console.log('\n=== Testing Full Deal Save Flow ===\n');

    // Clear old test data
    const fs = await import('fs/promises');
    try {
        await fs.unlink('./deals.json');
        await fs.unlink('./deals.csv');
        console.log('Cleared old test data\n');
    } catch (e) {
        console.log('No old test data to clear\n');
    }

    // Save a test deal
    const testContact = scenarios[0].contact;
    const cleanPhone = client.cleanAndValidatePhone(testContact.number);

    console.log('Saving test deal for MonaKamal...');
    console.log(`  Raw contact.number: ${testContact.number}`);
    console.log(`  Cleaned phone: ${cleanPhone}`);

    await dealTracker.addDeal(
        testContact.pushname,
        cleanPhone,
        'Done kerdo',
        'pending'
    );

    // Verify saved data
    console.log('\n=== Verifying Saved Data ===\n');
    const deals = await dealTracker.getDeals();

    if (deals.length > 0) {
        const deal = deals[0];
        console.log(`Deal ID: ${deal.id}`);
        console.log(`Customer: ${deal.customerName}`);
        console.log(`Phone: ${deal.phoneNumber}`);
        console.log(`Message: "${deal.message}"`);
        console.log(`Status: ${deal.status}`);

        const isCorrect = deal.phoneNumber === '923318851184';
        console.log(`\n${isCorrect ? '✅ SUCCESS' : '❌ FAILED'}: Phone number is ${isCorrect ? 'correct' : 'incorrect'}`);

        if (!isCorrect) {
            console.log(`   Expected: 923318851184`);
            console.log(`   Got: ${deal.phoneNumber}`);
        }
    }

    console.log('\n=== Test Complete ===');
}

testContactNumberExtraction().catch(console.error);
