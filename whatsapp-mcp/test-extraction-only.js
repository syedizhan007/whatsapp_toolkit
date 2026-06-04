import WhatsAppClient from './whatsapp-client.js';

async function testPhoneExtractionOnly() {
    console.log('=== Phone Extraction Test (No File Saving) ===\n');

    const client = new WhatsAppClient();

    const testCases = [
        {
            name: '✅ MAIN TEST: LID with Mona Kamal real number',
            messageFrom: '208186124562527@lid',
            contact: {
                number: '923318851184',
                pushname: 'Mona Kamal',
                id: { user: '923318851184', _serialized: '923318851184@c.us' }
            },
            expected: '923318851184'
        },
        {
            name: 'LID with duplicate country code (967+92)',
            messageFrom: '208186124562527@lid',
            contact: {
                number: '96792318851184',
                pushname: 'Test User',
                id: { user: '96792318851184', _serialized: '96792318851184@c.us' }
            },
            expected: '923318851184'
        },
        {
            name: 'Regular Pakistan @c.us',
            messageFrom: '923001234567@c.us',
            contact: {
                number: '923001234567',
                pushname: 'Ahmed',
                id: { user: '923001234567', _serialized: '923001234567@c.us' }
            },
            expected: '923001234567'
        },
        {
            name: 'Pakistan without country code',
            messageFrom: '3451234567@c.us',
            contact: {
                number: '3451234567',
                pushname: 'Sara',
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

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        console.log(`\n${test.name}`);
        console.log(`  Message From: ${test.messageFrom}`);
        console.log(`  Contact Number: ${test.contact.number}`);

        const extracted = await client.getRealPhoneNumber(test.messageFrom, test.contact);

        const isCorrect = extracted === test.expected;
        console.log(`  Extracted: ${extracted}`);
        console.log(`  Expected:  ${test.expected}`);
        console.log(`  Result: ${isCorrect ? '✅ PASS' : '❌ FAIL'}`);

        if (isCorrect) passed++;
        else failed++;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`${'='.repeat(50)}\n`);
}

testPhoneExtractionOnly().catch(console.error);
