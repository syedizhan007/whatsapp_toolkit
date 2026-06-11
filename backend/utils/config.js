module.exports = {
  // Input/Output files
  inputFile: 'numbers.csv',
  validOutputFile: 'valid.csv',
  invalidOutputFile: 'invalid.csv',

  // WhatsApp session
  sessionPath: './.wwebjs_auth',

  // Validation settings
  defaultCountryCode: 'US',
  batchSize: 10,
  delayBetweenChecks: 2000, // 2 seconds delay between checks

  // Dashboard settings
  refreshRate: 100 // milliseconds
};
