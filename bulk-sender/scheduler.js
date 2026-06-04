const cron = require('node-cron');
const DatabaseManager = require('./database');
const CampaignManager = require('./campaign-manager');
const Utils = require('./utils');
const chalk = require('chalk');

class Scheduler {
  constructor() {
    this.db = new DatabaseManager();
    this.jobs = new Map();
    this.campaignManager = null;
  }

  async initialize() {
    await this.db.initialize();
    this.campaignManager = new CampaignManager();
    await this.campaignManager.initialize();

    // Load existing scheduled jobs
    this.loadScheduledJobs();
  }

  loadScheduledJobs() {
    const jobs = this.db.getActiveScheduledJobs();

    for (const job of jobs) {
      this.scheduleJob(job.id, job.campaign_id, job.cron_expression);
    }

    console.log(chalk.green(`✓ Loaded ${jobs.length} scheduled jobs`));
  }

  scheduleJob(jobId, campaignId, cronExpression) {
    if (!Utils.isValidCron(cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    const task = cron.schedule(cronExpression, async () => {
      console.log(chalk.blue(`\n⏰ Running scheduled campaign ${campaignId}...`));

      try {
        await this.campaignManager.startCampaign(campaignId);
        console.log(chalk.green(`✓ Scheduled campaign ${campaignId} completed`));
      } catch (error) {
        console.log(chalk.red(`✗ Scheduled campaign ${campaignId} failed: ${error.message}`));
      }
    });

    this.jobs.set(jobId, task);
    console.log(chalk.green(`✓ Scheduled job ${jobId} for campaign ${campaignId}`));
  }

  createScheduledCampaign(campaignId, cronExpression) {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    // Add to database
    const jobId = this.db.addScheduledJob(campaignId, cronExpression);

    // Schedule the job
    this.scheduleJob(jobId, campaignId, cronExpression);

    return jobId;
  }

  cancelScheduledJob(jobId) {
    const job = this.jobs.get(jobId);

    if (job) {
      job.stop();
      this.jobs.delete(jobId);
      this.db.deactivateScheduledJob(jobId);
      console.log(chalk.yellow(`⏸ Cancelled scheduled job ${jobId}`));
    }
  }

  getActiveJobs() {
    return Array.from(this.jobs.keys());
  }

  async destroy() {
    // Stop all jobs
    for (const [jobId, job] of this.jobs) {
      job.stop();
    }

    this.jobs.clear();

    if (this.campaignManager) {
      await this.campaignManager.destroy();
    }

    this.db.close();
  }
}

module.exports = Scheduler;
