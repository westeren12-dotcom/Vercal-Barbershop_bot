// Vercal Barbershop — Main Entry Point
import dotenv from 'dotenv';
dotenv.config();

import { createBot } from './bot';
import { refreshAdminCache } from './bot/middleware/auth';
import { startDashboard } from './dashboard/server';

async function main() {
  console.log('💈 Vercal Barbershop Bot starting...');

  // Validate env
  if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is not set. Please configure .env');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Please configure .env');
    process.exit(1);
  }

  // Create and start bot
  const bot = await createBot();

  // Refresh admin cache periodically (every 5 minutes)
  setInterval(async () => {
    try {
      await refreshAdminCache();
    } catch (err) {
      console.error('Failed to refresh admin cache:', err);
    }
  }, 5 * 60 * 1000);

  // Launch bot
  await bot.launch();
  console.log('✅ Bot is running!');

  // Launch web dashboard
  startDashboard();

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
