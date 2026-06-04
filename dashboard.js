const cliProgress = require('cli-progress');
const chalk = require('chalk');

class Dashboard {
  constructor() {
    this.progressBar = null;
    this.stats = {
      total: 0,
      processed: 0,
      valid: 0,
      invalid: 0,
      formatInvalid: 0,
      whatsappInvalid: 0,
      startTime: null
    };
  }

  init(total) {
    this.stats.total = total;
    this.stats.startTime = Date.now();

    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║   WhatsApp Number Validator Dashboard     ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));

    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} Numbers | ETA: {eta}s',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    });

    this.progressBar.start(total, 0);
  }

  updateFormatInvalid() {
    this.stats.formatInvalid++;
    this.stats.invalid++;
    this.stats.processed++;
    this.progressBar.update(this.stats.processed);
  }

  updateWhatsAppValid() {
    this.stats.valid++;
    this.stats.processed++;
    this.progressBar.update(this.stats.processed);
  }

  updateWhatsAppInvalid() {
    this.stats.whatsappInvalid++;
    this.stats.invalid++;
    this.stats.processed++;
    this.progressBar.update(this.stats.processed);
  }

  complete() {
    this.progressBar.stop();

    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);

    console.log(chalk.green.bold('\n\n✓ Validation Complete!\n'));
    console.log(chalk.white('═══════════════════════════════════════════\n'));
    console.log(chalk.yellow('Summary:'));
    console.log(chalk.white(`  Total Numbers:        ${this.stats.total}`));
    console.log(chalk.green(`  Valid (WhatsApp):     ${this.stats.valid}`));
    console.log(chalk.red(`  Invalid (Format):     ${this.stats.formatInvalid}`));
    console.log(chalk.red(`  Invalid (WhatsApp):   ${this.stats.whatsappInvalid}`));
    console.log(chalk.red(`  Total Invalid:        ${this.stats.invalid}`));
    console.log(chalk.cyan(`  Duration:             ${duration}s`));
    console.log(chalk.white('\n═══════════════════════════════════════════\n'));
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
}

module.exports = Dashboard;
