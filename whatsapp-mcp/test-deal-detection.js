import WhatsAppClient from './whatsapp-client.js';

async function testDealDetection() {
    console.log('=== Testing Deal Detection & Phone Cleaning ===\n');

    const client = new WhatsAppClient();

    // Test phone number cleaning
    console.log('1. Testing phone number cleaning:');
    const testPhones = [
        '923001234567@c.us',
        '923001234567@s.whatsapp.net',
        '92:3001234567@lid',
        '923001234567@lid',
        '+923001234567'
    ];

    testPhones.forEach(phone => {
        const cleaned = client.cleanPhoneNumber(phone);
        console.log(`   ${phone} → ${cleaned}`);
    });

    // Test AI deal detection
    console.log('\n2. Testing AI deal detection:');
    const testMessages = [
        'order kardo bhai',
        'le lo yaar',
        'haan kar lo',
        'done',
        'chalega',
        'theak hai confirm',
        'kitne ka hai?',
        'pic bhejo',
        'hello kaise ho',
        'mangwao isko',
        'le lunga main',
        'book kar do'
    ];

    for (const msg of testMessages) {
        const isDeal = await client.detectDealWithAI(msg);
        console.log(`   "${msg}" → ${isDeal ? '✅ DEAL' : '❌ Not a deal'}`);
    }

    console.log('\n=== Test Complete ===');
}

testDealDetection().catch(console.error);
