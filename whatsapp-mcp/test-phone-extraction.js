import WhatsAppClient from './whatsapp-client.js';

async function testPhoneExtraction() {
    console.log('=== Testing Phone Number Extraction & Validation ===\n');

    const client = new WhatsAppClient();

    // Test scenarios with different phone formats
    const testCases = [
        {
            name: 'LID format (wrong)',
            input: '208186124562527@lid',
            expected: 'Should extract real number, not LID'
        },
        {
            name: 'Pakistan number with @c.us',
            input: '923318851184@c.us',
            expected: '923318851184'
        },
        {
            name: 'Duplicate country code (Yemen+Pakistan)',
            input: '96792318851184',
            expected: '923318851184'
        },
        {
            name: 'Duplicate country code (UAE+Pakistan)',
            input: '97192318851184',
            expected: '923318851184'
        },
        {
            name: 'Pakistan number without country code',
            input: '3318851184',
            expected: '923318851184'
        },
        {
            name: 'UAE number',
            input: '971501234567@c.us',
            expected: '971501234567'
        },
        {
            name: 'Yemen number',
            input: '967771234567@s.whatsapp.net',
            expected: '967771234567'
        },
        {
            name: 'Pakistan with leading zero',
            input: '03318851184',
            expected: '923318851184'
        }
    ];

    console.log('1. Testing cleanPhoneNumber():');
    testCases.forEach(test => {
        const cleaned = client.cleanPhoneNumber(test.input);
        console.log(`   ${test.name}`);
        console.log(`      Input: ${test.input}`);
        console.log(`      Output: ${cleaned}`);
        console.log(`      Expected: ${test.expected}\n`);
    });

    console.log('\n2. Testing fixDuplicateCountryCodes():');
    const duplicateCases = [
        '96792318851184',
        '97192318851184',
        '923318851184',
        '03318851184'
    ];

    duplicateCases.forEach(phone => {
        const fixed = client.fixDuplicateCountryCodes(phone);
        console.log(`   ${phone} → ${fixed}`);
    });

    console.log('\n3. Testing validatePhoneNumber():');
    const validationCases = [
        '923318851184',    // Pakistan - valid
        '971501234567',    // UAE - valid
        '967771234567',    // Yemen - valid
        '3318851184',      // Pakistan without code - should add 92
        '92331885118',     // Pakistan - too short
        '9233188511844',   // Pakistan - too long
    ];

    validationCases.forEach(phone => {
        const validated = client.validatePhoneNumber(phone);
        console.log(`   ${phone} (len: ${phone.length}) → ${validated} (len: ${validated.length})`);
    });

    console.log('\n=== Test Complete ===');
}

testPhoneExtraction().catch(console.error);
