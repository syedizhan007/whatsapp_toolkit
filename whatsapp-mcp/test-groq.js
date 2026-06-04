import fetch from 'node-fetch';
import config from './config.js';

console.log('🧪 Testing Groq AI Integration\n');

// Test if API key is configured
if (!config.GROQ_API_KEY || config.GROQ_API_KEY === 'your-groq-api-key-here') {
  console.log('❌ ERROR: Groq API key not configured!');
  console.log('\nPlease set your API key in one of these ways:');
  console.log('1. Environment variable: export GROQ_API_KEY="your-key"');
  console.log('2. Edit config.js and replace "your-groq-api-key-here"');
  console.log('\nGet free API key from: https://console.groq.com\n');
  process.exit(1);
}

console.log('✅ API Key configured');
console.log(`📡 API URL: ${config.GROQ_API_URL}`);
console.log(`🤖 Model: ${config.GROQ_MODEL}\n`);

// Test messages in different languages
const testMessages = [
  {
    lang: 'English',
    messages: [
      { role: 'user', content: 'Hello, do you have this product in stock?' }
    ]
  },
  {
    lang: 'Roman Urdu',
    messages: [
      { role: 'user', content: 'Salam bhai, yeh product available hai?' }
    ]
  },
  {
    lang: 'Urdu',
    messages: [
      { role: 'user', content: 'السلام علیکم، قیمت کیا ہے؟' }
    ]
  },
  {
    lang: 'Mixed Conversation',
    messages: [
      { role: 'user', content: 'Price kitna hai?' },
      { role: 'assistant', content: 'Price 2500 hai. Interested hain?' },
      { role: 'user', content: 'Theek hai le leta hoon' }
    ]
  }
];

async function testGroqAPI(messages, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${testName}`);
  console.log('='.repeat(60));

  const apiMessages = [
    { role: 'system', content: config.SYSTEM_PROMPT },
    ...messages
  ];

  console.log('\n📨 Input:');
  messages.forEach(msg => {
    console.log(`  ${msg.role}: ${msg.content}`);
  });

  try {
    const startTime = Date.now();

    const response = await fetch(config.GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: config.GROQ_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 150,
        top_p: 1,
        stream: false
      })
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const aiReply = data.choices[0]?.message?.content?.trim();

    console.log('\n💬 AI Reply:');
    console.log(`  ${aiReply}`);
    console.log(`\n⏱️  Response time: ${responseTime}ms`);
    console.log('✅ Test passed!');

    return true;

  } catch (error) {
    console.log('\n❌ Test failed!');
    console.log(`Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting Groq AI tests...\n');

  let passed = 0;
  let failed = 0;

  for (const test of testMessages) {
    const result = await testGroqAPI(test.messages, test.lang);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec between tests
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Your Groq AI integration is working perfectly!');
    console.log('\nYou can now run the auto-reply bot:');
    console.log('  npm run auto-reply');
  } else {
    console.log('\n⚠️  Some tests failed. Please check your API key and internet connection.');
  }
}

runAllTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
