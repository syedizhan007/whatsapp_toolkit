const fs = require('fs');
const csv = require('csv-parser');
const fetch = require('node-fetch');

async function createCampaignViaAPI() {
    console.log('📋 Reading CSV file...');

    const contacts = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream('contacts.csv')
            .pipe(csv())
            .on('data', (row) => {
                contacts.push({
                    name: row.name,
                    phone: row.phone,
                    tag: row.tag || '',
                    city: row.city || ''
                });
            })
            .on('end', async () => {
                console.log(`✓ Loaded ${contacts.length} contacts`);
                console.log('Contacts:', contacts);

                console.log('\n📤 Creating campaign via API...');

                try {
                    const response = await fetch('http://localhost:3000/api/bulk/campaigns', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: 'API Test Campaign',
                            message: 'Hello {name}! Ye test message hai from {city}.',
                            contacts: JSON.stringify(contacts)
                        })
                    });

                    const result = await response.json();
                    console.log('\n✓ Campaign created:', result);

                    if (result.success) {
                        console.log(`\n🎉 Campaign ID: ${result.campaignId}`);
                        console.log('📍 Ab dashboard mein jao aur "Start" button dabao!');
                    }

                    resolve();
                } catch (error) {
                    console.error('❌ Error:', error.message);
                    reject(error);
                }
            })
            .on('error', reject);
    });
}

createCampaignViaAPI()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
