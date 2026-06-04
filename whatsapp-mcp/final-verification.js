import WhatsAppClient from './whatsapp-client.js';

async function finalVerification() {
    console.log('=== FINAL VERIFICATION TEST ===\n');
    console.log('Testing production-ready phone extraction (no debug logs)\n');

    const client = new WhatsAppClient();

    const criticalTests = [
        {
            name: '🎯 CRITICAL: Mona Kamal LID → Real Number',
            messageFrom: '208186124562527@lid',
            contact: {
                number: '923318851184',
                pushname: 'Mona Kamal',
                id: { user: '923318851184', _serialized: '923318851184@c.us' }
            },
            expected: '923318851184'
        },
        {
            name: 'Regular Pakistan number',
            messageFrom: '923001234567@c.us',
            contact: {
                number: '923001234567',
                pushname: 'Ahmed Khan',
                id: { user: '923001234567', _serialized: '923001234567@c.us' }
            },
            expected: '923001234567'
        },
        {
            name: 'Pakistan without country code',
            messageFrom: '3451234567@c.us',
            contact: {
                number: '3451234567',
                pushname: 'Sara Ali',
                id: { user: '3451234567', _serialized: '3451234567@c.us' }
            },
            expected: '923451234567'
        },
        {
            name: 'UAE number',
            messageFrom: '971501234567@c.us',
            contact: {
                number: '971501234567',
                pushname: 'Fatima',
                id: { user: '971501234567', _serialized: '971501234567@c.us' }
            },
            expected: '971501234567'
        }
    ];

    let allPassed = true;

    for (const test of criticalTests) {
        const extracted = await client.getRealPhoneNumber(test.messageFrom, test.contact);
        const passed = extracted === test.expected;

        console.log(`${passed ? '✅' : '❌'} ${test.name}`);
        console.log(`   From: ${test.messageFrom}`);
        console.log(`   Got: ${extracted} | Expected: ${test.expected}`);

        if (!passed) allPassed = false;
        console.log('');
    }

    console.log('='.repeat(60));
    if (allPassed) {
        console.log('✅ ALL TESTS PASSED - PRODUCTION READY');
    } else {
        console.log('❌ SOME TESTS FAILED - NEEDS REVIEW');
    }
    console.log('='.repeat(60));
}

finalVerification().catch(console.error);
