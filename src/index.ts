/**
 * Gmail Order Tracker
 * Automatically tracks e-commerce orders from Gmail to Google Sheets
 */
import { OrderTracker } from './orderTracker';
import { config } from './config';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Gmail Order Tracker                             ');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const tracker = new OrderTracker();
    await tracker.initialize();

    // Check command line arguments
    const args = process.argv.slice(2);
    const monitorMode = args.includes('--monitor') || args.includes('-m');

    if (monitorMode) {
      // Continuous monitoring mode
      const intervalArg = args.find(arg => arg.startsWith('--interval='));
      const interval = intervalArg ? parseInt(intervalArg.split('=')[1]) : 15;
      await tracker.monitor(interval);
    } else {
      // One-time processing
      await tracker.processEmails();
      console.log('\n✓ Done! Check your Google Sheet for results.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});

main();
