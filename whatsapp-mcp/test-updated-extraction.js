import WhatsAppClient from './whatsapp-client.js';
import * as dealTracker from './deal-tracker.js';

async function testUpdatedPhoneExtraction() {
    console.log('=== Testing Updated Phone Extraction Logic ===\n');
    console.log('New logic handles @c.us, @g.us, and message.author\n');

    const client = new WhatsAppClient();

    // Test scenarios with different message formats
    const scenarios = [
        {
            name: 'Direct message with @c.us (MonaKamal)',
            message: {
                from: '923318851184@c.us',
                author: null,
                body: 'Done kerdo'
            },
            contact: { pushname: 'MonaKamal' },
            expectedPhone: '923318851184'
        },
        {
            name: 'Direct message with @c.us (Ahmed)',
            message: {
                from: '923001234567@c.us',
                author: null,
                body: 'order kardo'
            },
            contact: { pushname: 'Ahmed Khan' },
            expectedPhone: '923001234567'
        },
        {
            name: 'Group message with @g.us and author',
            message: {
                from: '120363012345678@g.us',
                author: '923451234567@c.us',
                body: 'le lo'
            },
            contact: { pushname: 'Sara Ali' },
            expectedPhone: '923451234567'
        },
        {
            name: 'LID format without @c.us',
            message: {
                from: '96718502785092@lid',
                author: null,
                body: 'book kar do'
            },
            contact: { pushname: 'Test User' },
            expectedPhone: '96718502785092'  // Will be extracted then cleaned
        }
    ];

    console.log('Testing phone extraction with new logic:\n');

    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
        console.log(`📱 ${scenario.name}`);
        console.log(`   message.from: ${scenario.message.from}`);
        console.log(`   message.author: ${scenario.message.author || 'null'}`);

        // Apply the new extraction logic
        let phoneNumber;
        if (scenario.message.from.includes('@c.us')) {
            phoneNumber = scenario.message.from.split('@')[0];
        } else {
            phoneNumber = scenario.message.author ?
                scenario.message.author.split('@')[0] :
                scenario.message.from.split('@')[0];
        }

        const cleanPhone = client.cleanAndValidatePhone(phoneNumber);

        console.log(`   Extracted: ${phoneNumber}`);
        console.log(`   Cleaned: ${cleanPhone}`);
        console.log(`   Expected: ${scenario.expectedPhone}`);

        const isCorrect = phoneNumber === scenario.expectedPhone;
        console.log(`   Result: ${isCorrect ? '✅ PASS' : '❌ FAIL'}\n`);

        if (isCorrect) passed++;
        else failed++;
    }

    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

    // Test saving a deal with the correct number
    console.log('\n=== Testing Deal Save ===\n');

    // Clear old data
    const fs = await import('fs/promises');
    try {
        await fs.unlink('./deals.json');
        await fs.unlink('./deals.csv');
        console.log('Cleared old test data\n');
    } catch (e) {
        console.log('No old test data to clear\n');
    }

    // Save MonaKamal deal
    const monaScenario = scenarios[0];
    let monaPhone;
    if (monaScenario.message.from.includes('@c.us')) {
        monaPhone = monaScenario.message.from.split('@')[0];
    } else {
        monaPhone = monaScenario.message.author ?
            monaScenario.message.author.split('@')[0] :
            monaScenario.message.from.split('@')[0];
    }

    const monaCleanPhone = client.cleanAndValidatePhone(monaPhone);

    console.log('Saving MonaKamal deal:');
    console.log(`  message.from: ${monaScenario.message.from}`);
    console.log(`  Extracted: ${monaPhone}`);
    console.log(`  Cleaned: ${monaCleanPhone}`);

    await dealTracker.addDeal(
        monaScenario.contact.pushname,
        monaCleanPhone,
        monaScenario.message.body,
        'pending'
    );

    // Verify
    console.log('\n=== Verifying Saved Deal ===\n');
    const deals = await dealTracker.getDeals();

    if (deals.length > 0) {
        const deal = deals[0];
        console.log(`Deal ID: ${deal.id}`);
        console.log(`Customer: ${deal.customerName}`);
        console.log(`Phone: ${deal.phoneNumber}`);
        console.log(`Message: "${deal.message}"`);

        const isCorrect = deal.phoneNumber === '923318851184';
        console.log(`\n${isCorrect ? '✅ SUCCESS' : '❌ FAILED'}: ${isCorrect ? 'Correct number saved!' : 'Wrong number saved!'}`);

        if (isCorrect) {
            console.log('   Expected: 923318851184 ✅');
            console.log('   Got: ' + deal.phoneNumber + ' ✅');
        } else {
            console.log('   Expected: 923318851184');
            console.log('   Got: ' + deal.phoneNumber);
        }
    }

    console.log('\n=== Test Complete ===');
}

testUpdatedPhoneExtraction().catch(console.error);
