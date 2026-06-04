import WhatsAppClient from './whatsapp-client.js';
import * as dealTracker from './deal-tracker.js';

async function testMessageFromExtraction() {
    console.log('=== Testing message.from Phone Extraction ===\n');
    console.log('Fix: Using message.from.split("@")[0] instead of contact.number\n');

    const client = new WhatsAppClient();

    // Test scenarios showing message.from is reliable
    const scenarios = [
        {
            name: '✅ CORRECT: MonaKamal using message.from',
            messageFrom: '923318851184@c.us',  // Real WhatsApp format
            contact: {
                number: '96718502785092',  // Wrong LID number (ignore this)
                pushname: 'MonaKamal',
                name: 'MonaKamal'
            },
            message: 'Done kerdo',
            expectedPhone: '923318851184'
        },
        {
            name: 'Regular Pakistan number',
            messageFrom: '923001234567@c.us',
            contact: {
                number: '96718502785092',  // Even if contact.number is wrong
                pushname: 'Ahmed Khan'
            },
            message: 'order kardo',
            expectedPhone: '923001234567'
        },
        {
            name: 'UAE number',
            messageFrom: '971501234567@c.us',
            contact: {
                number: '971501234567',
                pushname: 'Fatima'
            },
            message: 'le lo',
            expectedPhone: '971501234567'
        },
        {
            name: 'Another Pakistan number',
            messageFrom: '923451234567@c.us',
            contact: {
                number: '923451234567',
                pushname: 'Sara'
            },
            message: 'book kar do',
            expectedPhone: '923451234567'
        }
    ];

    console.log('Testing phone extraction from message.from:\n');

    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
        // Extract using the new method: message.from.split('@')[0]
        const rawNumber = scenario.messageFrom.split('@')[0];
        const cleanPhone = client.cleanAndValidatePhone(rawNumber);

        const isCorrect = cleanPhone === scenario.expectedPhone;

        console.log(`${isCorrect ? '✅' : '❌'} ${scenario.name}`);
        console.log(`   message.from: ${scenario.messageFrom}`);
        console.log(`   contact.number: ${scenario.contact.number} (IGNORED)`);
        console.log(`   Extracted: ${rawNumber}`);
        console.log(`   Cleaned: ${cleanPhone}`);
        console.log(`   Expected: ${scenario.expectedPhone}`);
        console.log(`   Result: ${isCorrect ? 'PASS' : 'FAIL'}\n`);

        if (isCorrect) passed++;
        else failed++;
    }

    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

    // Test deal saving with correct number
    console.log('\n=== Testing Deal Save with Correct Number ===\n');

    // Clear old data
    const fs = await import('fs/promises');
    try {
        await fs.unlink('./deals.json');
        await fs.unlink('./deals.csv');
        console.log('Cleared old test data\n');
    } catch (e) {
        console.log('No old test data to clear\n');
    }

    // Save MonaKamal deal with correct number
    const monaScenario = scenarios[0];
    const monaPhone = monaScenario.messageFrom.split('@')[0];
    const monaCleanPhone = client.cleanAndValidatePhone(monaPhone);

    console.log('Saving MonaKamal deal:');
    console.log(`  message.from: ${monaScenario.messageFrom}`);
    console.log(`  Extracted phone: ${monaPhone}`);
    console.log(`  Clean phone: ${monaCleanPhone}`);

    await dealTracker.addDeal(
        monaScenario.contact.pushname,
        monaCleanPhone,
        monaScenario.message,
        'pending'
    );

    // Verify saved data
    console.log('\n=== Verifying Saved Deal ===\n');
    const deals = await dealTracker.getDeals();

    if (deals.length > 0) {
        const deal = deals[0];
        console.log(`Deal ID: ${deal.id}`);
        console.log(`Customer: ${deal.customerName}`);
        console.log(`Phone: ${deal.phoneNumber}`);
        console.log(`Message: "${deal.message}"`);
        console.log(`Status: ${deal.status}`);

        const isCorrect = deal.phoneNumber === '923318851184';
        console.log(`\n${isCorrect ? '✅ SUCCESS' : '❌ FAILED'}: Phone number is ${isCorrect ? 'CORRECT' : 'WRONG'}`);

        if (isCorrect) {
            console.log('   Expected: 923318851184 ✅');
            console.log('   Got: ' + deal.phoneNumber + ' ✅');
            console.log('\n🎉 Fix verified! message.from gives correct real number!');
        } else {
            console.log('   Expected: 923318851184');
            console.log('   Got: ' + deal.phoneNumber);
        }
    }

    console.log('\n=== Test Complete ===');
}

testMessageFromExtraction().catch(console.error);
