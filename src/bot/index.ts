// Bot Entry Point — Telegraf setup, middleware, routing
import { Telegraf, Context } from 'telegraf';
import { config } from '../lib/config';
import { isAdmin, refreshAdminCache } from './middleware/auth';

// Customer handlers
import {
  handleStart,
  handleServices,
  handlePrices,
  handleLocation,
  handleContact,
  handleMyAppointments,
  handleFinished,
  handleFinishConfirm,
  handleFinishCancel,
} from './handlers/customer';

// Booking handlers
import {
  handleBooking,
  handleBookingDate,
  handleBookingBarber,
  handleBookingService,
  handleBookingConfirm,
  handleBookingCancel,
} from './handlers/booking';

// Admin handlers
import {
  handleBugungiFoyda,
  handleBugungiMijozlar,
  handleXizmatlar,
  handleNarxlar,
  handleBarberlar,
  handleBookinglar,
  handleMijozlar,
  handleStatistika,
  handleHisobot,
  handleBroadcast,
  isBroadcastMode,
  handleBroadcastMessage,
  handleBroadcastSend,
  handleBroadcastCancel,
} from './handlers/admin';

// Completion handlers
import {
  notifyAdminsOfCompletion,
  handleAdminApprove,
  handleAdminReject,
} from './handlers/completion';

let bot: Telegraf;

export async function createBot(): Promise<Telegraf> {
  bot = new Telegraf(config.BOT_TOKEN);

  // Refresh admin cache on startup
  await refreshAdminCache();

  // ═══════════════════════════════════════════════════════
  // ADMIN COMMANDS (checked server-side)
  // ═══════════════════════════════════════════════════════

  bot.command('BugungiFoyda', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleBugungiFoyda(ctx);
  });

  bot.command('BugungiMijozlar', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleBugungiMijozlar(ctx);
  });

  bot.command('Xizmatlar', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleXizmatlar(ctx);
  });

  bot.command('Narxlar', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleNarxlar(ctx);
  });

  bot.command('Barberlar', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleBarberlar(ctx);
  });

  bot.command('Bookinglar', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleBookinglar(ctx);
  });

  bot.command('Mijozlar', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleMijozlar(ctx);
  });

  bot.command('Statistika', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleStatistika(ctx);
  });

  bot.command('Hisobot', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleHisobot(ctx);
  });

  bot.command('Broadcast', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
    }
    await handleBroadcast(ctx);
  });

  // ═══════════════════════════════════════════════════════
  // CUSTOMER COMMANDS
  // ═══════════════════════════════════════════════════════

  bot.start((ctx) => handleStart(ctx));
  bot.command('services', (ctx) => handleServices(ctx));
  bot.command('prices', (ctx) => handlePrices(ctx));
  bot.command('location', (ctx) => handleLocation(ctx));
  bot.command('contact', (ctx) => handleContact(ctx));
  bot.command('myappointments', (ctx) => handleMyAppointments(ctx));
  bot.command('finished', (ctx) => handleFinished(ctx));
  bot.command('booking', (ctx) => handleBooking(ctx));

  // ═══════════════════════════════════════════════════════
  // CALLBACK QUERIES (inline button handlers)
  // ═══════════════════════════════════════════════════════

  // --- Booking flow ---
  bot.action(/^book_date_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dateMs = Number(ctx.match[1]);
    await handleBookingDate(ctx, dateMs);
  });

  bot.action(/^book_barber_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const barberId = Number(ctx.match[1]);
    await handleBookingBarber(ctx, barberId);
  });

  bot.action(/^book_service_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const serviceId = Number(ctx.match[1]);
    await handleBookingService(ctx, serviceId);
  });

  bot.action('book_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    await handleBookingConfirm(ctx);
  });

  bot.action('book_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await handleBookingCancel(ctx);
  });

  // --- Finish confirmation flow ---
  bot.action(/^finish_confirm_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const appointmentId = Number(ctx.match[1]);
    await handleFinishConfirm(ctx, appointmentId);
    // Notify admins
    await notifyAdminsOfCompletion(ctx, appointmentId);
  });

  bot.action(/^finish_cancel_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const appointmentId = Number(ctx.match[1]);
    await handleFinishCancel(ctx, appointmentId);
  });

  // --- Admin approval/rejection flow ---
  bot.action(/^admin_approve_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const appointmentId = Number(ctx.match[1]);
    await handleAdminApprove(ctx, appointmentId);
  });

  bot.action(/^admin_reject_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const appointmentId = Number(ctx.match[1]);
    await handleAdminReject(ctx, appointmentId);
  });

  // --- Admin service management ---
  bot.action('admin_add_service', async (ctx) => {
    await ctx.answerCbQuery('Bu funksiya hozircha tayyorlanmoqda.');
  });

  bot.action('admin_edit_service', async (ctx) => {
    await ctx.answerCbQuery('Bu funksiya hozircha tayyorlanmoqda.');
  });

  bot.action('admin_change_price', async (ctx) => {
    await ctx.answerCbQuery('Bu funksiya hozircha tayyorlanmoqda.');
  });

  bot.action('admin_toggle_service', async (ctx) => {
    await ctx.answerCbQuery('Bu funksiya hozircha tayyorlanmoqda.');
  });

  // --- Admin barber management ---
  bot.action('admin_add_barber', async (ctx) => {
    await ctx.answerCbQuery('Bu funksiya hozircha tayyorlanmoqda.');
  });

  bot.action('admin_edit_barber', async (ctx) => {
    await ctx.answerCbQuery('Bu funksiya hozircha tayyorlanmoqda.');
  });

  bot.action('admin_toggle_barber', async (ctx) => {
    await ctx.answerCbQuery('Bu funksiya hozircha tayyorlanmoqda.');
  });

  // --- Broadcast ---
  bot.action('broadcast_send', async (ctx) => {
    await ctx.answerCbQuery();
    await handleBroadcastSend(ctx);
  });

  bot.action('broadcast_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await handleBroadcastCancel(ctx);
  });

  // ═══════════════════════════════════════════════════════
  // TEXT MESSAGE HANDLER (for broadcast and other flows)
  // ═══════════════════════════════════════════════════════

  bot.on('text', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    if (!text) return;

    // Check if admin is in broadcast mode
    if (await isAdmin(ctx)) {
      if (isBroadcastMode(telegramId)) {
        await handleBroadcastMessage(ctx);
        return;
      }
    }

    // ─── Keyboard Button Text Handlers ──────────────────
    // Reply keyboard buttons send plain text, not commands
    // We must match the exact text from Markup.keyboard()

    // Customer keyboard buttons
    if (text.includes('Online Booking') || text === '📅 Online Booking') {
      return handleBooking(ctx);
    }
    if (text.includes('Xizmatlar') && !text.includes('Mening') && !text.includes('Bugungi') && !text.includes('Admin')) {
      // Could be customer '💈 Xizmatlar' or admin '/Xizmatlar'
      // For keyboard buttons, route to customer services
      return handleServices(ctx);
    }
    if (text.includes('Narxlar') || text === '💰 Narxlar') {
      return handlePrices(ctx);
    }
    if (text.includes('buyurtmalarim') || text === '📋 Mening buyurtmalarim') {
      return handleMyAppointments(ctx);
    }
    if (text.includes('Xizmatim tugadi') || text === '✅ Xizmatim tugadi') {
      return handleFinished(ctx);
    }
    if (text.includes('Manzil') || text === '📍 Manzil') {
      return handleLocation(ctx);
    }
    if (text.includes('Aloqa') || text === '📞 Aloqa') {
      return handleContact(ctx);
    }
  });

  // ═══════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════

  bot.catch((err, ctx) => {
    console.error(`Error handling update ${ctx.update.update_id}:`, err);
  });

  return bot;
}

export function getBot(): Telegraf {
  return bot;
}
