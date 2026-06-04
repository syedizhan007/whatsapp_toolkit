import WhatsAppClient from './whatsapp-client.js';

async function testStrictDealDetection() {
    console.log('=== Testing Strict Deal Detection ===\n');
    console.log('Updated logic: "Ok", "Okay", "Theek hai" alone should NOT trigger deals\n');

    const client = new WhatsAppClient();

    // Test messages - should NOT trigger deal alert
    const nonDealMessages = [
        'Ok',
        'Okay',
        'Theek hai',
        'Haan',
        'Achha',
        'Thanks',
        'Shukriya',
        'Hello',
        'Kitne ka hai?',
        'Available hai?',
        'Pic bhejo'
    ];

    // Test messages - SHOULD trigger deal alert
    const dealMessages = [
        'Order kardo',
        'Order kar do',
        'Le lunga',
        'Le leti hoon',
        'Confirm kardo',
        'Book kar do',
        'Mangwao',
        'Send karo',
        'Pakka order hai',
        'Final hai le lo',
        'Done kar do',
        'Chahiye mujhe'
    ];

    console.log('❌ Messages that should NOT trigger deal alert:\n');
    for (const msg of nonDealMessages) {
        const isDeal = await client.detectDealWithAI(msg);
        const status = isDeal ? '❌ FAIL (triggered)' : '✅ PASS (not triggered)';
        console.log(`   "${msg}" → ${status}`);
    }

    console.log('\n✅ Messages that SHOULD trigger deal alert:\n');
    for (const msg of dealMessages) {
        const isDeal = await client.detectDealWithAI(msg);
        const status = isDeal ? '✅ PASS (triggered)' : '❌ FAIL (not triggered)';
        console.log(`   "${msg}" → ${status}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Summary of Changes:\n');
    console.log('✅ Simple acknowledgments excluded:');
    console.log('   - "Ok", "Okay", "Theek hai", "Haan" alone');
    console.log('   - General chat: "hello", "thanks"');
    console.log('   - Questions: "kitne ka hai?"');
    console.log('');
    console.log('✅ Only clear purchase intent triggers deals:');
    console.log('   - Action words required: "kardo", "kar do", "lunga"');
    console.log('   - Examples: "order kardo", "le lunga", "confirm kardo"');
    console.log('');
    console.log('✅ Temperature lowered: 0.3 → 0.2 (more strict)');
    console.log('');
    console.log('='.repeat(60));
    console.log('\n🚀 Ready to test with real WhatsApp!');
    console.log('   Run: node index.js --auto-reply\n');
}

testStrictDealDetection().catch(console.error);
