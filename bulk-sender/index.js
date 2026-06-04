const inquirer = require('inquirer');
const CampaignManager = require('./campaign-manager');
const Scheduler = require('./scheduler');
const CSVHandler = require('./csv-handler');
const Utils = require('./utils');
const config = require('./config');
const chalk = require('chalk');
const Table = require('cli-table3');
const path = require('path');

class BulkSenderCLI {
  constructor() {
    this.campaignManager = null;
    this.scheduler = null;
  }

  async start() {
    console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          WhatsApp Bulk Sender v1.0                        ║
║          Campaign Management System                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `));

    // Ensure directories exist
    Utils.ensureDir(config.uploadsDir);
    Utils.ensureDir(config.resultsDir);

    // Initialize
    console.log(chalk.blue('\nInitializing WhatsApp connection...\n'));
    this.campaignManager = new CampaignManager();
    await this.campaignManager.initialize();

    // Show main menu
    await this.showMainMenu();
  }

  async showMainMenu() {
    const choices = [
      { name: '📤 Create New Campaign', value: 'create' },
      { name: '▶️  Start Campaign', value: 'start' },
      { name: '⏸️  Pause Campaign', value: 'pause' },
      { name: '▶️  Resume Campaign', value: 'resume' },
      { name: '📋 View All Campaigns', value: 'list' },
      { name: '🗑️  Delete Campaign', value: 'delete' },
      { name: '⏰ Schedule Campaign', value: 'schedule' },
      { name: '👥 Extract Group Members', value: 'extract' },
      { name: '🚫 Manage Blacklist', value: 'blacklist' },
      { name: '📊 Export Results', value: 'export' },
      { name: '📝 Create CSV Template', value: 'template' },
      { name: '❌ Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: choices
      }
    ]);

    await this.handleAction(action);
  }

  async handleAction(action) {
    try {
      switch (action) {
        case 'create':
          await this.createCampaign();
          break;
        case 'start':
          await this.startCampaign();
          break;
        case 'pause':
          await this.pauseCampaign();
          break;
        case 'resume':
          await this.resumeCampaign();
          break;
        case 'list':
          await this.listCampaigns();
          break;
        case 'delete':
          await this.deleteCampaign();
          break;
        case 'schedule':
          await this.scheduleCampaign();
          break;
        case 'extract':
          await this.extractGroupMembers();
          break;
        case 'blacklist':
          await this.manageBlacklist();
          break;
        case 'export':
          await this.exportResults();
          break;
        case 'template':
          await this.createTemplate();
          break;
        case 'exit':
          await this.exit();
          return;
      }

      // Return to main menu
      await this.showMainMenu();
    } catch (error) {
      console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
      await this.showMainMenu();
    }
  }

  async createCampaign() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Campaign name:',
        validate: (input) => input.length > 0 || 'Name is required'
      },
      {
        type: 'input',
        name: 'csvFile',
        message: 'CSV file path (with contacts):',
        default: 'contacts.csv',
        validate: (input) => input.length > 0 || 'CSV file is required'
      },
      {
        type: 'editor',
        name: 'message',
        message: 'Message template (use {name}, {city}, {date}, {time}):',
        validate: (input) => input.length > 0 || 'Message is required'
      }
    ]);

    // Import contacts
    console.log(chalk.blue('\nImporting contacts...'));
    const contacts = await CSVHandler.importContacts(answers.csvFile);

    console.log(chalk.green(`✓ Imported ${contacts.length} contacts`));

    // Create campaign
    const campaignId = await this.campaignManager.createCampaign(
      answers.name,
      answers.message,
      contacts
    );

    console.log(chalk.green(`\n✓ Campaign created with ID: ${campaignId}\n`));
  }

  async startCampaign() {
    const campaigns = this.campaignManager.getCampaigns();

    if (campaigns.length === 0) {
      console.log(chalk.yellow('\nNo campaigns found. Create one first.\n'));
      return;
    }

    const choices = campaigns
      .filter(c => c.status !== 'completed')
      .map(c => ({
        name: `${c.name} (${c.status}) - ${c.pending_count} pending`,
        value: c.id
      }));

    if (choices.length === 0) {
      console.log(chalk.yellow('\nNo campaigns available to start.\n'));
      return;
    }

    const { campaignId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'campaignId',
        message: 'Select campaign to start:',
        choices: choices
      }
    ]);

    await this.campaignManager.startCampaign(campaignId);
  }

  async pauseCampaign() {
    this.campaignManager.pauseCampaign();
  }

  async resumeCampaign() {
    const campaigns = this.campaignManager.getCampaigns();
    const pausedCampaigns = campaigns.filter(c => c.status === 'paused');

    if (pausedCampaigns.length === 0) {
      console.log(chalk.yellow('\nNo paused campaigns found.\n'));
      return;
    }

    const choices = pausedCampaigns.map(c => ({
      name: `${c.name} - ${c.pending_count} pending`,
      value: c.id
    }));

    const { campaignId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'campaignId',
        message: 'Select campaign to resume:',
        choices: choices
      }
    ]);

    await this.campaignManager.resumeCampaign(campaignId);
  }

  async listCampaigns() {
    const campaigns = this.campaignManager.getCampaigns();

    if (campaigns.length === 0) {
      console.log(chalk.yellow('\nNo campaigns found.\n'));
      return;
    }

    const table = new Table({
      head: ['ID', 'Name', 'Status', 'Total', 'Sent', 'Failed', 'Pending', 'Created'],
      colWidths: [5, 20, 12, 8, 8, 8, 10, 20]
    });

    campaigns.forEach(c => {
      table.push([
        c.id,
        c.name,
        c.status,
        c.total_contacts,
        c.sent_count,
        c.failed_count,
        c.pending_count,
        c.created_at
      ]);
    });

    console.log('\n' + table.toString() + '\n');
  }

  async deleteCampaign() {
    const campaigns = this.campaignManager.getCampaigns();

    if (campaigns.length === 0) {
      console.log(chalk.yellow('\nNo campaigns found.\n'));
      return;
    }

    const choices = campaigns.map(c => ({
      name: `${c.name} (${c.status})`,
      value: c.id
    }));

    const { campaignId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'campaignId',
        message: 'Select campaign to delete:',
        choices: choices
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete this campaign?',
        default: false
      }
    ]);

    if (confirm) {
      this.campaignManager.deleteCampaign(campaignId);
    }
  }

  async scheduleCampaign() {
    const campaigns = this.campaignManager.getCampaigns();

    if (campaigns.length === 0) {
      console.log(chalk.yellow('\nNo campaigns found.\n'));
      return;
    }

    const choices = campaigns.map(c => ({
      name: `${c.name} (${c.status})`,
      value: c.id
    }));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'campaignId',
        message: 'Select campaign to schedule:',
        choices: choices
      },
      {
        type: 'input',
        name: 'cron',
        message: 'Cron expression (e.g., "0 9 * * *" for 9 AM daily):',
        validate: (input) => Utils.isValidCron(input) || 'Invalid cron expression'
      }
    ]);

    if (!this.scheduler) {
      this.scheduler = new Scheduler();
      await this.scheduler.initialize();
    }

    const jobId = this.scheduler.createScheduledCampaign(answers.campaignId, answers.cron);
    console.log(chalk.green(`\n✓ Campaign scheduled with job ID: ${jobId}\n`));
  }

  async extractGroupMembers() {
    console.log(chalk.blue('\nFetching groups...\n'));
    const groups = await this.campaignManager.getAllGroups();

    if (groups.length === 0) {
      console.log(chalk.yellow('No groups found.\n'));
      return;
    }

    const choices = groups.map(g => ({
      name: `${g.name} (${g.participantsCount} members)`,
      value: g.id
    }));

    const { groupId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'groupId',
        message: 'Select group:',
        choices: choices
      }
    ]);

    const members = await this.campaignManager.extractGroupMembers(groupId);

    const outputFile = path.join(config.resultsDir, `group_members_${Date.now()}.csv`);
    await CSVHandler.exportGroupMembers(outputFile, members);

    console.log(chalk.green(`\n✓ Exported to: ${outputFile}\n`));
  }

  async manageBlacklist() {
    const choices = [
      { name: 'View Blacklist', value: 'view' },
      { name: 'Add to Blacklist', value: 'add' },
      { name: 'Remove from Blacklist', value: 'remove' },
      { name: 'Back', value: 'back' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Blacklist Management:',
        choices: choices
      }
    ]);

    if (action === 'back') return;

    if (action === 'view') {
      const blacklist = this.campaignManager.getBlacklist();

      if (blacklist.length === 0) {
        console.log(chalk.yellow('\nBlacklist is empty.\n'));
        return;
      }

      const table = new Table({
        head: ['Phone', 'Reason', 'Added At'],
        colWidths: [20, 30, 25]
      });

      blacklist.forEach(b => {
        table.push([b.phone, b.reason, b.added_at]);
      });

      console.log('\n' + table.toString() + '\n');
    } else if (action === 'add') {
      const { phone, reason } = await inquirer.prompt([
        {
          type: 'input',
          name: 'phone',
          message: 'Phone number:',
          validate: (input) => input.length > 0 || 'Phone is required'
        },
        {
          type: 'input',
          name: 'reason',
          message: 'Reason:',
          default: 'Manually added'
        }
      ]);

      this.campaignManager.addToBlacklist(Utils.formatPhone(phone), reason);
    } else if (action === 'remove') {
      const { phone } = await inquirer.prompt([
        {
          type: 'input',
          name: 'phone',
          message: 'Phone number to remove:',
          validate: (input) => input.length > 0 || 'Phone is required'
        }
      ]);

      this.campaignManager.removeFromBlacklist(Utils.formatPhone(phone));
    }
  }

  async exportResults() {
    const campaigns = this.campaignManager.getCampaigns();

    if (campaigns.length === 0) {
      console.log(chalk.yellow('\nNo campaigns found.\n'));
      return;
    }

    const choices = campaigns.map(c => ({
      name: `${c.name} (${c.status})`,
      value: c.id
    }));

    const { campaignId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'campaignId',
        message: 'Select campaign to export:',
        choices: choices
      }
    ]);

    const history = this.campaignManager.db.getMessageHistory(campaignId);
    const outputFile = path.join(config.resultsDir, `campaign_${campaignId}_results_${Date.now()}.csv`);

    await CSVHandler.exportResults(outputFile, history);
    console.log(chalk.green(`\n✓ Results exported to: ${outputFile}\n`));
  }

  async createTemplate() {
    const outputFile = 'contacts_template.csv';
    await CSVHandler.createTemplate(outputFile);
    console.log(chalk.green(`\n✓ Template created: ${outputFile}\n`));
  }

  async exit() {
    console.log(chalk.cyan('\nShutting down...\n'));

    if (this.scheduler) {
      await this.scheduler.destroy();
    }

    if (this.campaignManager) {
      await this.campaignManager.destroy();
    }

    console.log(chalk.green('✓ Goodbye!\n'));
    process.exit(0);
  }
}

// Start the CLI
const cli = new BulkSenderCLI();
cli.start().catch(error => {
  console.error(chalk.red('\n✗ Fatal error:', error.message));
  process.exit(1);
});
