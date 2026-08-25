// Online Booking Flow
// Customer selects: Date → Barber → Service → Confirm
import { Context, Markup } from 'telegraf';
import prisma from '../../lib/prisma/client';
import { formatPrice, formatDate, getToday, getTomorrow, getDateOffset } from '../utils/format';

// In-memory booking session state (per user)
interface BookingSession {
  step: 'date' | 'barber' | 'service' | 'confirm';
  date?: Date;
  barberId?: number;
  serviceId?: number;
}

const sessions = new Map<number, BookingSession>();

/**
 * /booking — Start booking flow
 */
export async function handleBooking(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Step 1: Date selection
  const today = getToday();
  const tomorrow = getTomorrow();
  const d27 = getDateOffset(2);
  const d28 = getDateOffset(3);
  const d29 = getDateOffset(4);
  const d30 = getDateOffset(5);
  const d31 = getDateOffset(6);

  sessions.set(telegramId, { step: 'date' });

  await ctx.reply(
    '📅 *Sana tanlang:*\n\nQaysi kuni kelmoqchisiz?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('Bugun', `book_date_${today.getTime()}`),
          Markup.button.callback('Ertaga', `book_date_${tomorrow.getTime()}`),
        ],
        [
          Markup.button.callback(formatDate(d27), `book_date_${d27.getTime()}`),
          Markup.button.callback(formatDate(d28), `book_date_${d28.getTime()}`),
        ],
        [
          Markup.button.callback(formatDate(d29), `book_date_${d29.getTime()}`),
          Markup.button.callback(formatDate(d30), `book_date_${d30.getTime()}`),
        ],
        [Markup.button.callback(formatDate(d31), `book_date_${d31.getTime()}`)],
      ]),
    }
  );
}

/**
 * Handle date selection in booking flow
 */
export async function handleBookingDate(ctx: Context, dateMs: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const date = new Date(dateMs);
  const session = sessions.get(telegramId) || { step: 'barber' };
  session.date = date;
  session.step = 'barber';
  sessions.set(telegramId, session);

  // Show barbers
  const barbers = await prisma.barber.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (barbers.length === 0) {
    await ctx.reply('Hozircha berberlar mavjud emas.');
    sessions.delete(telegramId);
    return;
  }

  const buttons = barbers.map((b) => [Markup.button.callback(`👨‍💈 ${b.name}`, `book_barber_${b.id}`)]);

  await ctx.reply(
    `📅 Sana: *${formatDate(date)}*\n\n👨‍💈 *Berber tanlang:*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    }
  );
}

/**
 * Handle barber selection in booking flow
 */
export async function handleBookingBarber(ctx: Context, barberId: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = sessions.get(telegramId);
  if (!session) {
    await ctx.reply('Sessiya muddati tugadi. Qaytadan boshlang: /booking');
    return;
  }

  session.barberId = barberId;
  session.step = 'service';
  sessions.set(telegramId, session);

  // Show services
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  if (services.length === 0) {
    await ctx.reply('Hozircha xizmatlar mavjud emas.');
    sessions.delete(telegramId);
    return;
  }

  const buttons = services.map((s) => [
    Markup.button.callback(`${s.emoji} ${s.name} — ${formatPrice(s.price)}`, `book_service_${s.id}`),
  ]);

  await ctx.reply('💈 *Xizmat tanlang:*', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

/**
 * Handle service selection in booking flow — show summary & confirm
 */
export async function handleBookingService(ctx: Context, serviceId: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = sessions.get(telegramId);
  if (!session || !session.date || !session.barberId) {
    await ctx.reply('Sessiya muddati tugadi. Qaytadan boshlang: /booking');
    sessions.delete(telegramId);
    return;
  }

  session.serviceId = serviceId;
  sessions.set(telegramId, session);

  // Fetch barber & service for summary
  const barber = await prisma.barber.findUnique({ where: { id: session.barberId } });
  const service = await prisma.service.findUnique({ where: { id: serviceId } });

  if (!barber || !service) {
    await ctx.reply('Xatolik yuz berdi. Qaytadan boshlang: /booking');
    sessions.delete(telegramId);
    return;
  }

  // Get customer name
  const customer = await prisma.customer.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
  const customerName = customer?.firstName || ctx.from?.first_name || 'Noma\'lum';

  const priceStr = service.isPriceFixed
    ? formatPrice(service.price)
    : `${formatPrice(service.priceMin || service.price)} – ${formatPrice(service.priceMax || service.price)}`;

  await ctx.reply(
    `📋 *Buyurtma xulosasi:*\n\n` +
    `👤 Mijoz: ${customerName}\n` +
    `👨‍💈 Berber: ${barber.name}\n` +
    `${service.emoji} Xizmat: ${service.name}\n` +
    `📅 Sana: ${formatDate(session.date)}\n` +
    `💰 Narx: ${priceStr}\n\n` +
    `Tasdiqlaysizmi?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Tasdiqlash', 'book_confirm'),
          Markup.button.callback('❌ Bekor qilish', 'book_cancel'),
        ],
      ]),
    }
  );
}

/**
 * Handle booking confirmation
 */
export async function handleBookingConfirm(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = sessions.get(telegramId);
  if (!session || !session.date || !session.barberId || !session.serviceId) {
    await ctx.reply('Sessiya muddati tugadi. Qaytadan boshlang: /booking');
    sessions.delete(telegramId);
    return;
  }

  // Get customer
  const customer = await prisma.customer.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!customer) {
    await ctx.reply('Mijoz topilmadi. /start buyrug\'ini bosing.');
    sessions.delete(telegramId);
    return;
  }

  // Get service for price
  const service = await prisma.service.findUnique({
    where: { id: session.serviceId },
  });

  if (!service) {
    await ctx.reply('Xizmat topilmadi.');
    sessions.delete(telegramId);
    return;
  }

  // Check for duplicate booking
  const existing = await prisma.appointment.findFirst({
    where: {
      customerId: customer.id,
      barberId: session.barberId,
      serviceId: session.serviceId,
      date: session.date,
      status: { notIn: ['CANCELLED'] },
    },
  });

  if (existing) {
    await ctx.reply('⚠️ Siz allaqachon shu sana, berber va xizmat bilan buyurtma yaratgansiz.');
    sessions.delete(telegramId);
    return;
  }

  // Determine price (use fixed price)
  const price = service.isPriceFixed ? service.price : service.price;

  // Create appointment
  await prisma.appointment.create({
    data: {
      customerId: customer.id,
      barberId: session.barberId,
      serviceId: session.serviceId,
      date: session.date,
      price,
      status: 'CONFIRMED',
    },
  });

  sessions.delete(telegramId);

  await ctx.reply(
    '✅ *Buyurtma tasdiqlandi!*\n\n' +
    'Sizning buyurtmangiz qabul qilindi. Kelganingizda bizni xabardor qiling.\n\n' +
    'Xizmat tugagach, /finished buyrug\'ini bosing.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle booking cancellation
 */
export async function handleBookingCancel(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (telegramId) sessions.delete(telegramId);
  await ctx.reply('❌ Buyurtma bekor qilindi.');
}
