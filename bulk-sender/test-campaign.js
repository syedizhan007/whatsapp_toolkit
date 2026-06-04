const CampaignManager = require('./campaign-manager');
const path = require('path');

async function createTestCampaign() {
    console.log('Creating test campaign...');
    
    const manager = new CampaignManager();
    await manager.initialize();
    
    const csvPath = path.join(__dirname, 'contacts.csv');
    const campaignId = await manager.createCampaign(
        'Test Campaign',
        'Hello {name}! Ye test message hai from Karachi.',
        csvPath
    );
    
    console.log(`Campaign created with ID: ${campaignId}`);
    
    const campaign = manager.db.getCampaign(campaignId);
    console.log('Campaign details:', campaign);
    
    process.exit(0);
}

createTestCampaign().catch(console.error);
