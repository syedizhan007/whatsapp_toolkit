import WhatsAppClient from './whatsapp-client.js';
import * as dealTracker from './deal-tracker.js';

async function testRealWorldScenarios() {
    console.log('=== Real-World Phone Number Extraction Test ===\n');

    const client = new WhatsAppClient();

    // Simulate different WhatsApp contact scenarios
    const scenarios = [
        {
            name: 'Scenario 1: LID with real number in contact',
            messageFrom: '208186124562527@lid',
            contact: {
                number: '923318851184',
                pushname: 'Mona Kamal',
                id: {
                    user: '923318851184',
                    _serialized: '923318851184@c.us'
                }
            },
            expectedPhone: '923318851184'
        },
        {
            name: 'Scenario 2: LID with duplicate country code',
            messageFrom: '208186124562527@lid',
            contact: {
                number: '96792318851184',
                pushname: 'Ahmed Khan',
                id: {
                    user: '96792318851184',
                    _serialized: '96792318851184@c.us'
                }
            },
            expectedPhone: '923318851184'
        },
        {
            name: 'Scenario 3: Regular @c.us format',
            messageFrom: '923001234567@c.us',
            contact: {
                number: '923001234567',
                pushname: 'Sara Ali',
                id: {
                    user: '923001234567',
                    _serialized: '923001234567@c.us'
                }
            },
            expectedPhone: '923001234567'
        },
        {
            name: 'Scenario 4: UAE number',
            messageFrom: '971501234567@c.us',
            contact: {
                number: '971501234567',
                pushname: 'Fatima UAE',
                id: {
                    user: '971501234567',
                    _serialized: '971501234567@c.us'
                }
            },
            expectedPhone: '971501234567'
        },
        {
            name: 'Scenario 5: Pakistan number without country code',
            messageFrom: '3318851184@c.us',
            contact: {
                number: '3318851184',
                pushname: 'Local Contact',
                id: {
                    user: '3318851184',
                    _serialized: '3318851184@c.us'
                }
            },
            expectedPhone: '923318851184'
        }
    ];

    console.log('Testing phone extraction from different scenarios:\n');

    for (const scenario of scenarios) {
        console.log(`${scenario.name}`);
        console.log(`  Message From: ${scenario.messageFrom}`);
        console.log(`  Contact Number: ${scenario.contact.number}`);

        const extractedPhone = await client.getRealPhoneNumber(
            scenario.messageFrom,
            scenario.contact
        );

        const isCorrect = extractedPhone === scenario.expectedPhone;
        console.log(`  Extracted: ${extractedPhone}`);
        console.log(`  Expected: ${scenario.expectedPhone}`);
        console.log(`  Result: ${isCorrect ? '✅ PASS' : '❌ FAIL'}\n`);
    }

    console.log('\n=== Testing Full Deal Saving Flow ===\n');

    // Clear previous test data
    console.log('Clearing previous test data...');
    const fs = await import('fs/promises');
    try {
        await fs.unlink('./whatsapp-mcp/deals.json');
        await fs.unlink('./whatsapp-mcp/deals.csv');
    } catch (e) {
        // Files might not exist
    }

    // Test saving deals with extracted phone numbers
    console.log('\nSaving test deals...\n');

    for (const scenario of scenarios.slice(0, 3)) {
        const phone = await client.getRealPhoneNumber(
            scenario.messageFrom,
            scenario.contact
        );

        await dealTracker.addDeal(
            scenario.contact.pushname,
            phone,
            'Test order message',
            'pending'
        );

        console.log(`✅ Saved deal for ${scenario.contact.pushname} with phone: ${phone}`);
    }

    // Verify saved data
    console.log('\n=== Verifying Saved Data ===\n');

    const allDeals = await dealTracker.getDeals();
    console.log(`Total deals saved: ${allDeals.length}\n`);

    allDeals.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.customerName}`);
        console.log(`   Phone: ${deal.phoneNumber}`);
        console.log(`   Length: ${deal.phoneNumber.length} digits`);
        console.log(`   Valid: ${deal.phoneNumber.length === 12 ? '✅' : '❌'}\n`);
    });

    console.log('=== Test Complete ===');
}

testRealWorldScenarios().catch(console.error);
