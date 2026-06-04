import WhatsAppClient from './whatsapp-client.js';
import fs from 'fs';

console.log('🧪 Testing Image Request Detection\n');

const client = new WhatsAppClient();

// Test messages
const testMessages = [
  'bedsheet ki pic do',
  'show me pillow photo',
  'curtain ki tasveer bhejo',
  'towel ka image dikhao',
  'sofa picture send karo',
  'table ki photo',
  'chair dikhao',
  'Hello, how are you?',  // Should not detect
  'Price kitna hai?',      // Should not detect
];

console.log('Testing image request detection:\n');
console.log('='.repeat(60));

testMessages.forEach(msg => {
  const result = client.checkImageRequest(msg);

  console.log(`\n📨 Message: "${msg}"`);
  console.log(`🔍 Is Image Request: ${result.isRequest ? '✅ YES' : '❌ NO'}`);

  if (result.isRequest && result.productName) {
    console.log(`📦 Product Name: "${result.productName}"`);

    // Check if image exists
    const imagePath = client.findProductImage(result.productName);
    if (imagePath) {
      console.log(`🖼️  Image Found: ${imagePath}`);
    } else {
      console.log(`❌ No image found for: ${result.productName}`);
    }
  }
});

console.log('\n' + '='.repeat(60));
console.log('\n✅ Image detection test complete!\n');

// Check products folder
console.log('📁 Checking products folder...\n');

if (fs.existsSync('./products')) {
  const files = fs.readdirSync('./products');

  if (files.length === 0) {
    console.log('⚠️  Products folder is empty!');
    console.log('   Add product images to test image sending.\n');
    console.log('   Example:');
    console.log('   - products/bedsheet.jpg');
    console.log('   - products/pillow.png');
    console.log('   - products/curtain.jpg\n');
  } else {
    console.log(`✅ Found ${files.length} file(s) in products folder:\n`);
    files.forEach(file => {
      console.log(`   📄 ${file}`);
    });
    console.log('');
  }
} else {
  console.log('❌ Products folder not found!');
  console.log('   Creating products folder...\n');
  fs.mkdirSync('./products');
  console.log('✅ Products folder created!\n');
}

console.log('To test with real WhatsApp:');
console.log('  1. Add images to products/ folder');
console.log('  2. Run: npm run auto-reply');
console.log('  3. Send: "bedsheet ki pic do"\n');
