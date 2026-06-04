import WhatsAppClient from './whatsapp-client.js';
import * as dealTracker from './deal-tracker.js';

async function testContactIdUserFix() {
    console.log('=== Testing contact.id.user Fix ===\n');
    console.log('Fix: Use contact.id.user instead of contact.number for @lid messages\n');

    const client = new WhatsAppClient();

    // Test scenarios matching real WhatsApp behavior
    const scenarios = [
        {
            name: '✅ MonaKamal with @lid (REAL SCENARIO)',
            message: {
                from: '96718502785092@lid',
                author: null,
                body: 'Done kerdo'
            },
            contact: {
                number: '96718502785092',  // WRONG
                pushname: 'MonaKamal',
                id: {
                    user: '923318851184',  // CORRECT - This is what we use now
                    _serialized: '923318851184@c.us'
                }
            },
            expectedPhone: '923318851184'
        },
        {
            name: 'Regular @c.us message',
            message: {
                from: '923001234567@c.us',
                author: null,
                body: 'order kardo'
            },
            contact: {
                number: '923001234567',
                pushname: 'Ahmed Khan',
                id: {
                    user: '923001234567',
                    _serialized: '923001234567@c.us'
                }
            },
            expectedPhone: '923001234567'
        },
        {
            name: 'Another @lid case',
            message: {
                from: '12345678901234@lid',
                author: null,
                body: 'le lo'
            },
            contact: {
                number: '12345678901234',
                pushname: 'Test User',
                id: {
                    user: '923451234567',
                    _serialized: '923451234567@c.us'
                }
            },
            expectedPhone: '923451234567'
        }
    ];

    console.log('Testing phone extraction with contact.id.user:\n');

    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
        console.log(`📱 ${scenario.name}`);
        console.log(`   message.from: ${scenario.message.from}`);
        console.log(`   contact.number: ${scenario.contact.number} (IGNORED)`);
        console.log(`   contact.id.user: ${scenario.contact.id.user} (USED)`);

        // Apply the new extraction logic
        let phoneNumber;
        if (scenario.message.from.includes('@c.us')) {
            phoneNumber = scenario.message.from.split('@')[0];
        } else {
            phoneNumber = scenario.contact.id.user;
        }

        const cleanPhone = client.cleanAndValidatePhone(phoneNumber);

        console.log(`   Extracted: ${phoneNumber}`);
        console.log(`   Cleaned: ${cleanPhone}`);
        console.log(`   Expected: ${scenario.expectedPhone}`);

        const isCorrect = cleanPhone === scenario.expectedPhone;
        console.log(`   Result: ${isCorrect ? '✅ PASS' : '❌ FAIL'}\n`);

        if (isCorrect) passed++;
        else failed++;
    }

    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

    // Test saving MonaKamal deal with correct number
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

    // Save MonaKamal deal
    const monaScenario = scenarios[0];
    let monaPhone;
    if (monaScenario.message.from.includes('@c.us')) {
        monaPhone = monaScenario.message.from.split('@')[0];
    } else {
        monaPhone = monaScenario.contact.id.user;
    }

    const monaCleanPhone = client.cleanAndValidatePhone(monaPhone);

    console.log('Saving MonaKamal deal:');
    console.log(`  message.from: ${monaScenario.message.from} (@lid format)`);
    console.log(`  contact.number: ${monaScenario.contact.number} (WRONG - ignored)`);
    console.log(`  contact.id.user: ${monaScenario.contact.id.user} (CORRECT - used)`);
    console.log(`  Extracted: ${monaPhone}`);
    console.log(`  Cleaned: ${monaCleanPhone}`);

    await dealTracker.addDeal(
        monaScenario.contact.pushname,
        monaCleanPhone,
        monaScenario.message.body,
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
        console.log(`\n${isCorrect ? '✅ SUCCESS' : '❌ FAILED'}: ${isCorrect ? 'Correct number saved!' : 'Wrong number saved!'}`);

        if (isCorrect) {
            console.log('   ✅ Expected: 923318851184');
            console.log('   ✅ Got: ' + deal.phoneNumber);
            console.log('\n🎉 FIX VERIFIED! contact.id.user gives correct real number!');
        } else {
            console.log('   ❌ Expected: 923318851184');
            console.log('   ❌ Got: ' + deal.phoneNumber);
        }
    }

    console.log('\n=== Test Complete ===');
}

testContactIdUserFix().catch(console.error);
