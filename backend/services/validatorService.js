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

  async startValidation(jobId, csvFilePath, progressCallback) {
    try {
      // Initialize WhatsApp client for validator
      const client = await whatsappService.initializeClient(
        'validator',
        process.env.VALIDATOR_SESSION_PATH || './.wwebjs_auth_validator'
      );

      // Read numbers from CSV
      const numbers = await this.readNumbersFromCSV(csvFilePath);

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

      // Process numbers
      for (const number of numbers) {
        const formattedNumber = validator.validateFormat(number);

        if (!formattedNumber) {
          job.results.push({
            number,
            formatted: null,
            status: 'invalid',
            reason: 'Invalid format'
          });
          job.invalid++;
        } else {
          try {
            const isOnWhatsApp = await validator.checkWhatsApp(formattedNumber);

            if (isOnWhatsApp) {
              job.results.push({
                number,
                formatted: formattedNumber,
                status: 'valid',
                reason: 'Active on WhatsApp'
              });
              job.valid++;
            } else {
              job.results.push({
                number,
                formatted: formattedNumber,
                status: 'invalid',
                reason: 'Not on WhatsApp'
              });
              job.invalid++;
            }
          } catch (error) {
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

        // Delay between checks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      job.status = 'completed';
      job.endTime = new Date();

      // Save results to CSV
      await this.saveResults(jobId, job.results);

      return job;
    } catch (error) {
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
