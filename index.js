const WhatsAppValidator = require('./backend/utils/validator');

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        WhatsApp Number Validator v1.0                     ║
║        Powered by whatsapp-web.js                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Create validator instance and start validation
const validator = new WhatsAppValidator();

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  if (validator.client) {
    await validator.client.destroy();
  }
  process.exit(0);
});

// Start validation
validator.validate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
