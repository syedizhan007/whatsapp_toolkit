const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const Utils = require('./utils');

class CSVHandler {
  // Import contacts from CSV
  static async importContacts(filePath) {
    return new Promise((resolve, reject) => {
      const contacts = [];

      if (!fs.existsSync(filePath)) {
        reject(new Error(`File not found: ${filePath}`));
        return;
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const contact = {
            name: row.name || row.Name || '',
            phone: row.phone || row.Phone || '',
            tag: row.tag || row.Tag || '',
            city: row.city || row.City || '',
            custom_image: row.custom_image || row.image || '',
            custom_doc: row.custom_doc || row.document || ''
          };

          if (contact.phone) {
            contact.phone = Utils.formatPhone(contact.phone);
            contacts.push(contact);
          }
        })
        .on('end', () => {
          // Remove duplicates
          const uniqueContacts = Utils.removeDuplicates(contacts);
          resolve(uniqueContacts);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  // Export results to CSV
  static async exportResults(filePath, results) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'phone', title: 'Phone' },
        { id: 'status', title: 'Status' },
        { id: 'sent_at', title: 'Sent At' },
        { id: 'error_message', title: 'Error Message' }
      ]
    });

    await csvWriter.writeRecords(results);
  }

  // Export group members to CSV
  static async exportGroupMembers(filePath, members) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'phone', title: 'Phone' },
        { id: 'isAdmin', title: 'Is Admin' },
        { id: 'isSuperAdmin', title: 'Is Super Admin' }
      ]
    });

    await csvWriter.writeRecords(members);
  }

  // Create sample CSV template
  static createTemplate(filePath) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: 'name' },
        { id: 'phone', title: 'phone' },
        { id: 'tag', title: 'tag' },
        { id: 'city', title: 'city' },
        { id: 'custom_image', title: 'custom_image' },
        { id: 'custom_doc', title: 'custom_doc' }
      ]
    });

    const sampleData = [
      {
        name: 'John Doe',
        phone: '+1234567890',
        tag: 'customer',
        city: 'New York',
        custom_image: 'uploads/john_image.jpg',
        custom_doc: 'uploads/john_doc.pdf'
      },
      {
        name: 'Jane Smith',
        phone: '+9876543210',
        tag: 'lead',
        city: 'London',
        custom_image: '',
        custom_doc: ''
      }
    ];

    return csvWriter.writeRecords(sampleData);
  }
}

module.exports = CSVHandler;
