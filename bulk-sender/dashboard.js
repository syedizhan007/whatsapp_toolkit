const cliProgress = require('cli-progress');
const chalk = require('chalk');
const Utils = require('./utils');

class Dashboard {
  constructor() {
    this.progressBar = null;
    this.stats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      currentBatch: 0,
      startTime: null
    };
  }

  init(total) {
    this.stats.total = total;
    this.stats.pending = total;
    this.stats.startTime = Date.now();

    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║     WhatsApp Bulk Sender - Campaign Dashboard     ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════╝\n'));

    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | Sent: {sent} | Failed: {failed} | ETA: {eta}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    });

    this.progressBar.start(total, 0, {
      sent: 0,
      failed: 0,
      eta: 'Calculating...'
    });
  }

  updateSuccess() {
    this.stats.sent++;
    this.stats.pending--;
    const processed = this.stats.sent + this.stats.failed;
    const eta = Utils.calculateETA(processed, this.stats.total, this.stats.startTime);

    this.progressBar.update(processed, {
      sent: this.stats.sent,
      failed: this.stats.failed,
      eta: eta
    });
  }

  updateFailed() {
    this.stats.failed++;
    this.stats.pending--;
    const processed = this.stats.sent + this.stats.failed;
    const eta = Utils.calculateETA(processed, this.stats.total, this.stats.startTime);

    this.progressBar.update(processed, {
      sent: this.stats.sent,
      failed: this.stats.failed,
      eta: eta
    });
  }

  showBatchBreak(breakDuration) {
    this.progressBar.stop();
    console.log(chalk.yellow(`\n⏸  Batch break: Waiting ${Utils.formatDuration(breakDuration)}...\n`));
  }

  resumeAfterBreak() {
    const processed = this.stats.sent + this.stats.failed;
    const eta = Utils.calculateETA(processed, this.stats.total, this.stats.startTime);

    this.progressBar.start(this.stats.total, processed, {
      sent: this.stats.sent,
      failed: this.stats.failed,
      eta: eta
    });
  }

  complete() {
    this.progressBar.stop();

    const duration = Utils.formatDuration(Date.now() - this.stats.startTime);

    console.log(chalk.green.bold('\n\n✓ Campaign Complete!\n'));
    console.log(chalk.white('═══════════════════════════════════════════════════\n'));
    console.log(chalk.yellow('Summary:'));
    console.log(chalk.white(`  Total Messages:       ${this.stats.total}`));
    console.log(chalk.green(`  Successfully Sent:    ${this.stats.sent}`));
    console.log(chalk.red(`  Failed:               ${this.stats.failed}`));
    console.log(chalk.cyan(`  Duration:             ${duration}`));
    console.log(chalk.white('\n═══════════════════════════════════════════════════\n'));
  }

  error(message) {
    if (this.progressBar) {
      this.progressBar.stop();
    }
    console.log(chalk.red.bold(`\n✗ Error: ${message}\n`));
  }

  info(message) {
    console.log(chalk.blue(`ℹ ${message}`));
  }

  success(message) {
    console.log(chalk.green(`✓ ${message}`));
  }

  warning(message) {
    console.log(chalk.yellow(`⚠ ${message}`));
  }
}

module.exports = Dashboard;
