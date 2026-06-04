import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEALS_JSON = path.join(__dirname, 'deals.json');
const DEALS_CSV = path.join(__dirname, 'deals.csv');

async function ensureCSVHeader() {
    try {
        await fs.access(DEALS_CSV);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const header = 'Deal ID,Customer Name,Phone Number,Message,Date and Time,Status\n';
            await fs.writeFile(DEALS_CSV, header);
        }
    }
}

async function addDeal(customerName, phoneNumber, message, status = 'pending') {
    try {
        const dealId = crypto.randomBytes(8).toString('hex');
        const deal = {
            id: dealId,
            customerName,
            phoneNumber,
            message,
            dateTime: new Date().toISOString(),
            status
        };

        let deals = [];
        try {
            const data = await fs.readFile(DEALS_JSON, 'utf8');
            deals = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        deals.push(deal);
        await fs.writeFile(DEALS_JSON, JSON.stringify(deals, null, 2));
        await rebuildCSV(deals);

        console.log('Deal added successfully:', deal);
        return deal;
    } catch (error) {
        console.error('Error adding deal:', error);
        throw error;
    }
}

async function getDeals() {
    try {
        const data = await fs.readFile(DEALS_JSON, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function updateDealStatus(dealId, newStatus) {
    try {
        const deals = await getDeals();
        const dealIndex = deals.findIndex(d => d.id === dealId);

        if (dealIndex === -1) {
            throw new Error(`Deal not found with ID: ${dealId}`);
        }

        deals[dealIndex].status = newStatus;
        deals[dealIndex].updatedAt = new Date().toISOString();

        await fs.writeFile(DEALS_JSON, JSON.stringify(deals, null, 2));
        await rebuildCSV(deals);

        console.log('Deal status updated:', deals[dealIndex]);
        return deals[dealIndex];
    } catch (error) {
        console.error('Error updating deal status:', error);
        throw error;
    }
}

async function rebuildCSV(deals) {
    const header = 'Deal ID,Customer Name,Phone Number,Message,Date and Time,Status\n';
    const rows = deals.map(d =>
        `"${d.id}","${d.customerName}","${d.phoneNumber}","${d.message.replace(/"/g, '""')}","${d.dateTime}","${d.status}"`
    ).join('\n');

    await fs.writeFile(DEALS_CSV, header + rows);
}

async function getDealsByStatus(status) {
    const deals = await getDeals();
    return deals.filter(d => d.status === status);
}

async function getDealById(dealId) {
    const deals = await getDeals();
    return deals.find(d => d.id === dealId);
}

async function getDealsByPhone(phoneNumber) {
    const deals = await getDeals();
    return deals.filter(d => d.phoneNumber === phoneNumber);
}

async function deleteDeal(dealId) {
    try {
        const deals = await getDeals();
        const filteredDeals = deals.filter(d => d.id !== dealId);

        if (deals.length === filteredDeals.length) {
            throw new Error(`Deal not found with ID: ${dealId}`);
        }

        await fs.writeFile(DEALS_JSON, JSON.stringify(filteredDeals, null, 2));
        await rebuildCSV(filteredDeals);

        console.log('Deal deleted successfully:', dealId);
        return true;
    } catch (error) {
        console.error('Error deleting deal:', error);
        throw error;
    }
}

export {
    addDeal,
    getDeals,
    getDealById,
    getDealsByPhone,
    updateDealStatus,
    getDealsByStatus,
    deleteDeal
};
