const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const config = require('./config');
const Dashboard = require('./dashboard');

class WhatsAppValidator {
  constructor() {
    this.client = null;
    this.dashboard = new Dashboard();
    this.validNumbers = [];
    this.invalidNumbers = [];
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.dashboard.info('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: config.sessionPath
        }),
        puppeteer: {
          headless: true,
          protocolTimeout: 120000,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });

      this.client.on('qr', (qr) => {
        this.dashboard.info('Scan the QR code below with WhatsApp:');
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        this.dashboard.success('WhatsApp client is ready!');
        resolve(); // Resolve when client is fully ready
      });

      this.client.on('authenticated', () => {
        this.dashboard.success('Authentication successful!');
      });

      this.client.on('auth_failure', (msg) => {
        this.dashboard.error('Authentication failed!');
        reject(new Error('Authentication failed'));
      });

      this.client.on('disconnected', (reason) => {
        this.dashboard.error(`Client disconnected: ${reason}`);
      });

      this.client.initialize();
    });
  }

  validateFormat(phoneNumber, countryCode = config.defaultCountryCode) {
    try {
      if (!phoneNumber) return null;

      let numberStr = phoneNumber.toString().trim().replace(/[\s\-\(\)]/g, '');

      // Case 1: Number already has country code (starts with + or is long enough)
      if (numberStr.startsWith('+')) {
        if (isValidPhoneNumber(numberStr)) {
          const parsed = parsePhoneNumber(numberStr);
          return parsed.number;
        }
      }

      // Case 2: Number starts with 0 - try to auto-detect country
      if (numberStr.startsWith('0')) {
        const detectedNumber = this.detectCountryForZeroPrefix(numberStr);
        if (detectedNumber) return detectedNumber;
      }

      // Case 3: Try with + prefix first
      const withPlus = '+' + numberStr;
      if (isValidPhoneNumber(withPlus)) {
        const parsed = parsePhoneNumber(withPlus);
        return parsed.number;
      }

      // Case 4: Try with default country code
      if (isValidPhoneNumber(numberStr, countryCode)) {
        const parsed = parsePhoneNumber(numberStr, countryCode);
        return parsed.number;
      }

      // Case 5: Try all major countries to find a match
      const detectedNumber = this.tryMultipleCountries(numberStr);
      if (detectedNumber) return detectedNumber;

      return null;
    } catch (error) {
      return null;
    }
  }

  detectCountryForZeroPrefix(numberStr) {
    // Common patterns for numbers starting with 0
    // IMPORTANT: Order matters - more specific patterns first!
    const countryPatterns = [
      // Pakistan: 03XX XXXXXXX (11 digits total, mobile starts with 03)
      { country: 'PK', code: '92', pattern: /^03\d{9}$/, stripZero: true },
      // UK: 07XXX XXXXXX (11 digits total, mobile starts with 07)
      { country: 'GB', code: '44', pattern: /^07\d{9}$/, stripZero: true },
      // UK: 01XXX or 02XXX (landline, 11 digits)
      { country: 'GB', code: '44', pattern: /^0[12]\d{9}$/, stripZero: true },
      // India: 06/07/08/09 XXXX XXXXXX (11 digits total, mobile)
      { country: 'IN', code: '91', pattern: /^0[6-9]\d{9}$/, stripZero: true },
      // UAE: 050/052/054/055/056/058 XXX XXXX (10 digits total)
      { country: 'AE', code: '971', pattern: /^05[024568]\d{7}$/, stripZero: true },
      // Saudi Arabia: 05X XXX XXXX (10 digits total)
      { country: 'SA', code: '966', pattern: /^05\d{8}$/, stripZero: true },
      // Australia: 04XX XXX XXX (10 digits total, mobile)
      { country: 'AU', code: '61', pattern: /^04\d{8}$/, stripZero: true },
      // France: 06/07 (mobile) or 01-05/09 (landline) - 10 digits
      { country: 'FR', code: '33', pattern: /^0[1-79]\d{8}$/, stripZero: true },
      // Germany: 01XX (mobile) or other patterns (variable length)
      { country: 'DE', code: '49', pattern: /^0[1-9]\d{8,11}$/, stripZero: true },
    ];

    // Try each pattern
    for (const { country, code, pattern, stripZero } of countryPatterns) {
      if (pattern.test(numberStr)) {
        const testNumber = stripZero ? numberStr.substring(1) : numberStr;
        const fullNumber = '+' + code + testNumber;

        try {
          if (isValidPhoneNumber(fullNumber, country)) {
            const parsed = parsePhoneNumber(fullNumber, country);
            return parsed.number;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // If no pattern matched, try stripping 0 and testing with all countries
    const withoutZero = numberStr.substring(1);
    return this.tryMultipleCountries(withoutZero);
  }

  tryMultipleCountries(numberStr) {
    // List of major countries to try (ordered by population/usage)
    const countries = [
      'PK', 'IN', 'US', 'GB', 'CN', 'ID', 'BR', 'NG', 'BD', 'RU',
      'MX', 'JP', 'ET', 'PH', 'EG', 'VN', 'TR', 'IR', 'DE', 'TH',
      'FR', 'IT', 'ZA', 'ES', 'KE', 'AR', 'UA', 'CA', 'PL', 'MA',
      'SA', 'AE', 'MY', 'PE', 'GH', 'NP', 'AU', 'TW', 'KR', 'CL',
      'NL', 'SY', 'RO', 'KZ', 'LK', 'BE', 'GR', 'PT', 'CZ', 'SE',
      'JO', 'AZ', 'HU', 'TN', 'IL', 'AT', 'CH', 'BG', 'RS', 'DK',
      'FI', 'NO', 'IE', 'NZ', 'SG', 'HK', 'LB', 'LY', 'OM', 'KW',
      'QA', 'BH', 'AF', 'IQ', 'YE', 'MM', 'UZ', 'VE', 'CO', 'EC'
    ];

    // Try parsing with each country
    for (const country of countries) {
      try {
        // Try with country code
        if (isValidPhoneNumber(numberStr, country)) {
          const parsed = parsePhoneNumber(numberStr, country);
          return parsed.number;
        }

        // Try with + prefix
        const withPlus = '+' + numberStr;
        if (isValidPhoneNumber(withPlus, country)) {
          const parsed = parsePhoneNumber(withPlus, country);
          return parsed.number;
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  async checkWhatsApp(phoneNumber) {
    try {
      const formattedNumber = phoneNumber.replace('+', '') + '@c.us';
      const isRegistered = await this.client.isRegisteredUser(formattedNumber);
      return isRegistered;
    } catch (error) {
      return false;
    }
  }

  async readNumbersFromCSV() {
    return new Promise((resolve, reject) => {
      const numbers = [];

      if (!fs.existsSync(config.inputFile)) {
        reject(new Error(`Input file not found: ${config.inputFile}`));
        return;
      }

      fs.createReadStream(config.inputFile)
        .pipe(csv())
        .on('data', (row) => {
          const number = row.phone || row.number || row.Phone || row.Number || Object.values(row)[0];
          if (number) {
            numbers.push(number.toString().trim());
          }
        })
        .on('end', () => {
          resolve(numbers);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async saveResults() {
    const validWriter = createObjectCsvWriter({
      path: config.validOutputFile,
      header: [
        { id: 'number', title: 'Phone Number' },
        { id: 'formatted', title: 'Formatted Number' },
        { id: 'status', title: 'Status' }
      ]
    });

    const invalidWriter = createObjectCsvWriter({
      path: config.invalidOutputFile,
      header: [
        { id: 'number', title: 'Phone Number' },
        { id: 'reason', title: 'Reason' }
      ]
    });

    await validWriter.writeRecords(this.validNumbers);
    await invalidWriter.writeRecords(this.invalidNumbers);

    this.dashboard.success(`Valid numbers saved to: ${config.validOutputFile}`);
    this.dashboard.success(`Invalid numbers saved to: ${config.invalidOutputFile}`);
  }

  async validate() {
    try {
      await this.initialize();

      this.dashboard.info(`Reading numbers from: ${config.inputFile}`);
      const numbers = await this.readNumbersFromCSV();

      if (numbers.length === 0) {
        this.dashboard.error('No numbers found in input file!');
        return;
      }

      this.dashboard.success(`Found ${numbers.length} numbers to validate`);
      this.dashboard.init(numbers.length);

      for (const number of numbers) {
        const formattedNumber = this.validateFormat(number);

        if (!formattedNumber) {
          this.invalidNumbers.push({
            number: number,
            reason: 'Invalid phone number format'
          });
          this.dashboard.updateFormatInvalid();
          continue;
        }

        const isOnWhatsApp = await this.checkWhatsApp(formattedNumber);

        if (isOnWhatsApp) {
          this.validNumbers.push({
            number: number,
            formatted: formattedNumber,
            status: 'Active on WhatsApp'
          });
          this.dashboard.updateWhatsAppValid();
        } else {
          this.invalidNumbers.push({
            number: number,
            reason: 'Not registered on WhatsApp'
          });
          this.dashboard.updateWhatsAppInvalid();
        }

        await new Promise(resolve => setTimeout(resolve, config.delayBetweenChecks));
      }

      this.dashboard.complete();
      await this.saveResults();

      await this.client.destroy();
      process.exit(0);

    } catch (error) {
      this.dashboard.error(error.message);
      if (this.client) {
        await this.client.destroy();
      }
      process.exit(1);
    }
  }
}

module.exports = WhatsAppValidator;
