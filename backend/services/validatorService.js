const path = require('path');
const fs = require('fs').promises;
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { createReadStream } = require('fs');
const whatsappService = require('./whatsappService');

// Import existing validator logic
const ValidatorClass = require(path.join(__dirname, '..', '..', 'validator.js'));

class ValidatorService {
  constructor() {
    this.activeJobs = new Map();
  }

  async startValidation(jobId, csvFilePath, progressCallback, userId) {
    try {
      console.log(`\n🚀 VALIDATOR SERVICE - Starting validation job ${jobId} for user ${userId}`);

      // Get Baileys client for the user
      const client = whatsappService.getClient(userId);

      if (!client) {
        console.error(`❌ VALIDATOR SERVICE - No WhatsApp client found for user ${userId}`);
        throw new Error(`WhatsApp client not ready for user ${userId}. Please connect WhatsApp first.`);
      }

      console.log(`✓ WhatsApp client retrieved for user ${userId}`);
      console.log(`   Client User ID: ${client.user?.id || 'Unknown'}`);

      // Read numbers from CSV
      console.log(`📄 Reading numbers from CSV: ${csvFilePath}`);
      const numbers = await this.readNumbersFromCSV(csvFilePath);
      console.log(`✓ Loaded ${numbers.length} numbers from CSV\n`);

      const job = {
        id: jobId,
        status: 'running',
        total: numbers.length,
        processed: 0,
        valid: 0,
        invalid: 0,
        results: [],
        startTime: new Date()
      };

      this.activeJobs.set(jobId, job);

      // Create validator instance
      const validator = new ValidatorClass();
      validator.client = client;

      console.log(`🔄 Starting validation loop for ${numbers.length} numbers...\n`);

      // Process numbers
      for (let i = 0; i < numbers.length; i++) {
        const number = numbers[i];

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[${i + 1}/${numbers.length}] Validating: ${number}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const formattedNumber = validator.validateFormat(number);

        if (!formattedNumber) {
          console.log(`❌ Format validation failed for: ${number}`);
          job.results.push({
            number,
            formatted: null,
            status: 'invalid',
            reason: 'Invalid format'
          });
          job.invalid++;
        } else {
          console.log(`✓ Format validation passed: ${number} → ${formattedNumber}`);

          try {
            // checkWhatsApp now includes retry logic (500ms delay + 1 retry)
            const isOnWhatsApp = await validator.checkWhatsApp(formattedNumber);

            if (isOnWhatsApp) {
              console.log(`✅ VALID - ${number} is on WhatsApp\n`);
              job.results.push({
                number,
                formatted: formattedNumber,
                status: 'valid',
                reason: 'Active on WhatsApp'
              });
              job.valid++;
            } else {
              console.log(`❌ INVALID - ${number} not on WhatsApp\n`);
              job.results.push({
                number,
                formatted: formattedNumber,
                status: 'invalid',
                reason: 'Not on WhatsApp'
              });
              job.invalid++;
            }
          } catch (error) {
            console.error(`❌ Error validating ${number}:`, error.message);
            job.results.push({
              number,
              formatted: formattedNumber,
              status: 'invalid',
              reason: error.message
            });
            job.invalid++;
          }
        }

        job.processed++;

        if (progressCallback) {
          progressCallback(job);
        }

        // Delay between checks to avoid rate limiting (8-15 seconds)
        if (i < numbers.length - 1) {
          const delay = Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000;
          console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before next validation...\n`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      job.status = 'completed';
      job.endTime = new Date();

      console.log(`\n✅ VALIDATION JOB COMPLETE`);
      console.log(`   Job ID: ${jobId}`);
      console.log(`   Total: ${job.total}`);
      console.log(`   Valid: ${job.valid}`);
      console.log(`   Invalid: ${job.invalid}`);
      console.log(`   Success Rate: ${((job.valid / job.total) * 100).toFixed(1)}%\n`);

      // Save results to CSV
      await this.saveResults(jobId, job.results);

      return job;
    } catch (error) {
      console.error(`❌ VALIDATOR SERVICE - Fatal error in job ${jobId}:`, error);
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
      }
      throw error;
    }
  }

  async readNumbersFromCSV(filePath) {
    return new Promise((resolve, reject) => {
      const numbers = [];

      createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const number = row.phone || row.number || row.Phone || row.Number || Object.values(row)[0];
          if (number) {
            numbers.push(number.toString().trim());
          }
        })
        .on('end', () => resolve(numbers))
        .on('error', reject);
    });
  }

  async saveResults(jobId, results) {
    const validResults = results.filter(r => r.status === 'valid');
    const invalidResults = results.filter(r => r.status === 'invalid');

    const validPath = path.join(process.env.UPLOAD_DIR || './uploads', `${jobId}_valid.csv`);
    const invalidPath = path.join(process.env.UPLOAD_DIR || './uploads', `${jobId}_invalid.csv`);

    // Save valid numbers
    if (validResults.length > 0) {
      const validWriter = createObjectCsvWriter({
        path: validPath,
        header: [
          { id: 'number', title: 'Original Number' },
          { id: 'formatted', title: 'Formatted Number' },
          { id: 'status', title: 'Status' }
        ]
      });
      await validWriter.writeRecords(validResults);
    }

    // Save invalid numbers
    if (invalidResults.length > 0) {
      const invalidWriter = createObjectCsvWriter({
        path: invalidPath,
        header: [
          { id: 'number', title: 'Original Number' },
          { id: 'reason', title: 'Reason' }
        ]
      });
      await invalidWriter.writeRecords(invalidResults);
    }

    return { validPath, invalidPath };
  }

  getJob(jobId) {
    return this.activeJobs.get(jobId);
  }

  getAllJobs() {
    return Array.from(this.activeJobs.values());
  }
}

module.exports = new ValidatorService();
