/**
 * WhatsApp Validator - Baileys Compatible
 *
 * This class provides phone number validation and WhatsApp registration checking
 * using the Baileys library. It no longer manages its own WhatsApp client -
 * instead it receives a Baileys socket instance from the caller.
 */

const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const config = require('./config');
const Dashboard = require('./dashboard');

class WhatsAppValidator {
  constructor() {
    this.client = null; // Will be set to Baileys socket by caller
    this.dashboard = new Dashboard();
    this.validNumbers = [];
    this.invalidNumbers = [];
  }

  /**
   * Set the Baileys socket client for WhatsApp operations
   * @param {Object} baileysSocket - Baileys socket instance from server.js
   */
  setClient(baileysSocket) {
    this.client = baileysSocket;
  }

  /**
   * Validate and format phone number
   * @param {string} phoneNumber - Phone number to validate
   * @param {string} countryCode - Default country code (e.g., 'PK')
   * @returns {string|null} Formatted phone number or null if invalid
   */
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

  /**
   * Detect country for numbers starting with 0
   * @param {string} numberStr - Phone number string
   * @returns {string|null} Formatted number or null
   */
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

  /**
   * Try validating number with multiple country codes
   * @param {string} numberStr - Phone number string
   * @returns {string|null} Formatted number or null
   */
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

  /**
   * Check if a phone number is registered on WhatsApp using Baileys
   * @param {string} phoneNumber - Phone number in international format (e.g., +923001234567)
   * @returns {Promise<boolean>} True if registered on WhatsApp
   */
  async checkWhatsApp(phoneNumber) {
    try {
      if (!this.client) {
        throw new Error('Baileys client not set. Call setClient() first.');
      }

      // Format number for Baileys: remove + and add @s.whatsapp.net
      const cleanNumber = phoneNumber.replace('+', '');
      const jid = cleanNumber + '@s.whatsapp.net';

      console.log(`\n🔍 validator.js checkWhatsApp()`);
      console.log(`   Input: ${phoneNumber}`);
      console.log(`   Clean: ${cleanNumber}`);
      console.log(`   JID: ${jid}`);

      // Check if client has user property (indicates connection state)
      const clientReady = !!(this.client.user && this.client.user.id);
      console.log(`   Client Ready: ${clientReady} ⬅️ CRITICAL STATUS`);
      console.log(`   Client User ID: ${this.client.user?.id || 'Unknown'}`);

      if (!clientReady) {
        console.error(`   ❌ Client not ready - no user info available`);
        throw new Error('WhatsApp client not ready');
      }

      // ===== ATTEMPT 1 =====
      console.log(`   📡 Calling onWhatsApp (Attempt 1)...`);
      let startTime = Date.now();

      // CRITICAL FIX: onWhatsApp() expects an ARRAY of JIDs, not a single string
      // Baileys API: onWhatsApp(jids: string[]): Promise<{exists: boolean, jid: string}[]>
      let result = await this.client.onWhatsApp([jid]);
      let duration = Date.now() - startTime;

      console.log(`   ✅ API call completed in ${duration}ms`);
      console.log(`   Raw Response:`, JSON.stringify(result, null, 2));
      console.log(`   Result[0].exists: ${result?.[0]?.exists}`);

      // ===== RETRY LOGIC: If exists=false, wait 500ms and try once more =====
      if (result && result.length > 0 && result[0].exists === false) {
        console.log(`   ⚠️  RETRY TRIGGERED - First attempt returned exists=false`);
        console.log(`   Waiting 500ms for socket to stabilize...`);
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`   📡 Calling onWhatsApp (Attempt 2 - RETRY)...`);

        // Re-check client readiness
        const clientStillReady = !!(this.client.user && this.client.user.id);
        console.log(`   Client Ready (retry check): ${clientStillReady}`);

        if (!clientStillReady) {
          console.error(`   ❌ Client disconnected during retry`);
          return false;
        }

        startTime = Date.now();
        result = await this.client.onWhatsApp([jid]);
        duration = Date.now() - startTime;

        console.log(`   ✅ Retry completed in ${duration}ms`);
        console.log(`   Retry Result[0].exists: ${result?.[0]?.exists}`);
      } else {
        console.log(`   ✓ First attempt succeeded - no retry needed`);
      }

      const finalResult = result && result.length > 0 && result[0].exists === true;
      console.log(`   🎯 Final Result: ${finalResult ? 'VALID' : 'INVALID'}\n`);

      return finalResult;
    } catch (error) {
      console.error(`❌ Error checking WhatsApp for ${phoneNumber}:`, error.message);
      console.error(`   Stack:`, error.stack);
      return false;
    }
  }

  /**
   * Read phone numbers from CSV file
   * @returns {Promise<Array<string>>} Array of phone numbers
   */
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

  /**
   * Save validation results to CSV files
   */
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

    if (this.validNumbers.length > 0) {
      await validWriter.writeRecords(this.validNumbers);
      this.dashboard.success(`Valid numbers saved to: ${config.validOutputFile}`);
    }

    if (this.invalidNumbers.length > 0) {
      await invalidWriter.writeRecords(this.invalidNumbers);
      this.dashboard.success(`Invalid numbers saved to: ${config.invalidOutputFile}`);
    }
  }

  /**
   * DEPRECATED: Initialize method no longer creates its own client
   * The Baileys client must be provided via setClient()
   */
  async initialize() {
    throw new Error(
      'initialize() is deprecated. ' +
      'WhatsApp clients are now managed by server.js. ' +
      'Use setClient(baileysSocket) to provide a client instance.'
    );
  }

  /**
   * Run validation process
   * NOTE: This method requires a Baileys client to be set via setClient() first
   */
  async validate() {
    try {
      if (!this.client) {
        this.dashboard.error('No WhatsApp client provided. Call setClient() before validate().');
        return;
      }

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

      this.dashboard.success('Validation complete!');

    } catch (error) {
      this.dashboard.error(error.message);
      throw error;
    }
  }
}

module.exports = WhatsAppValidator;
