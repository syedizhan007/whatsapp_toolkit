import WhatsAppClient from './whatsapp-client.js';

console.log('🧪 Testing Auto-Reply Response Generator\n');

const client = new WhatsAppClient();

// Test different message types
const testMessages = [
  'Salam bhai kaise ho',
  'Thanks for the help',
  'Price kitna hai?',
  'Available hai stock?',
  'Theek hai le leta hoon',
  'Order confirm kar do',
  'Random message testing',
  'Hello, kya rate hai?',
  'Shukriya bhai',
  'Deal final hai'
];

console.log('Testing response generation:\n');
testMessages.forEach(msg => {
  const reply = client.generateReply(msg.toLowerCase());
  const isDeal = client.checkDealKeywords(msg.toLowerCase());

  console.log(`📨 Message: "${msg}"`);
  console.log(`💬 Reply: "${reply}"`);
  if (isDeal) {
    console.log('🔔 DEAL ALERT!');
  }
  console.log('');
});

console.log('✅ Response generator test complete!');
console.log('\nTo run the actual bot:');
console.log('  npm run auto-reply');
console.log('  or');
console.log('  node index.js --standalone');
