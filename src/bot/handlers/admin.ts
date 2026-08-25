// Admin Bot Handlers — all admin commands
import { Context, Markup } from 'telegraf';
import prisma from '../../lib/prisma/client';
import { formatPrice, formatDate, getToday, formatNumber } from '../utils/format';
import { config } from '../../lib/config';
import dayjs from 'dayjs';

// ─── /BugungiFoyda — Today's Revenue (MOST IMPORTANT) ─────

export async function handleBugungiFoyda(ctx: Context) {
  const today = getToday();
  const todayStr = dayjs(today).format('YYYY-MM-DD');

  // Get all completed revenue records for today
  const revenues = await prisma.revenue.findMany({
    where: {
      date: {
        gte: today,
        lt: dayjs(today).add(1, 'day').toDate(),
      },
    },
    include: { service: true, barber: true },
    orderBy: { createdAt: 'asc' },
  });

  if (revenues.length === 0) {
    await ctx.reply(
      `💰 *BUGUNGI DAROMAD*\n\n📅 ${formatDate(today)}\n\nHozircha tugallangan xizmatlar yo'q.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Group by service
  const grouped = new Map<number, { name: string; emoji: string; count: number; unitPrice: bigint; total: bigint }>();
  let grandTotal = BigInt(0);

  for (const r of revenues) {
    const key = r.serviceId;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += r.amount;
    } else {
      grouped.set(key, {
        name: r.service.name,
        emoji: r.service.emoji,
        count: 1,
        unitPrice: r.amount,
        total: r.amount,
      });
    }
    grandTotal += r.amount;
  }

  let msg = `💰 *BUGUNGI DAROMAD*\n\n📅 ${formatDate(today)}\n\n`;

  for (const [, g] of grouped) {
    msg += `${g.emoji} *${g.name}*:\n`;
    msg += `   ${g.count} × ${formatPrice(g.unitPrice)} = ${formatPrice(g.total)}\n\n`;
  }

  msg += `━━━━━━━━━━━━━━\n\n`;
  msg += `👥 Tugallangan xizmatlar: ${revenues.length}\n`;
  msg += `💵 *JAMI: ${formatPrice(grandTotal)}*`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

// ─── /BugungiMijozlar — Today's Customers ─────

export async function handleBugungiMijozlar(ctx: Context) {
  const today = getToday();

  const appointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: today,
        lt: dayjs(today).add(1, 'day').toDate(),
      },
    },
    include: { customer: true, service: true, barber: true },
    orderBy: { createdAt: 'asc' },
  });

  if (appointments.length === 0) {
    await ctx.reply(
      `📅 *BUGUNGI MIJOZLAR*\n\n📅 ${formatDate(today)}\n\nBugun hali mijozlar yo'q.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let msg = `📅 *BUGUNGI MIJOZLAR*\n\n`;

  const statusEmoji: Record<string, string> = {
    PENDING: '⏳',
    CONFIRMED: '✅',
    CUSTOMER_FINISHED: '🔄',
    COMPLETED: '💰',
    REJECTED: '❌',
    CANCELLED: '🚫',
  };

  appointments.forEach((apt, i) => {
    const status = statusEmoji[apt.status] || '📋';
    msg += `${i + 1}. ${apt.customer.firstName || 'Noma\'lum'} — ${apt.service.emoji} ${apt.service.name} — ${status} ${apt.status}\n`;
  });

  const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
  const pending = appointments.filter((a) => ['PENDING', 'CONFIRMED', 'CUSTOMER_FINISHED'].includes(a.status)).length;

  msg += `\n👥 Jami: ${appointments.length}\n`;
  msg += `✅ Tugallangan: ${completed}\n`;
  msg += `⏳ Kutilayotgan: ${pending}`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

// ─── /Xizmatlar — Service Management ─────

export async function handleXizmatlar(ctx: Context) {
  const services = await prisma.service.findMany({ orderBy: { price: 'asc' } });

  let msg = '💈 *XIZMATLAR BOSHQARUVI*\n\n';

  for (const s of services) {
    const status = s.isActive ? '🟢' : '🔴';
    const priceStr = s.isPriceFixed
      ? formatPrice(s.price)
      : `${formatPrice(s.priceMin || s.price)} – ${formatPrice(s.priceMax || s.price)}`;
    msg += `${status} ${s.emoji} *${s.name}*\n   💰 ${priceStr}\n   ⏱ ${s.duration} daqiqa\n`;
  }

  msg += '\nBoshqarish uchun:';

  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ Xizmat qo\'shish', 'admin_add_service'),
        Markup.button.callback('✏️ Xizmat tahrirlash', 'admin_edit_service'),
      ],
      [
        Markup.button.callback('💰 Narx o\'zgartirish', 'admin_change_price'),
        Markup.button.callback('⏸ Yoqish/O\'chirish', 'admin_toggle_service'),
      ],
    ]),
  });
}

// ─── /Narxlar — Show Prices ─────

export async function handleNarxlar(ctx: Context) {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  let msg = '💰 *NARXLAR*\n\n';

  for (const s of services) {
    const priceStr = s.isPriceFixed
      ? formatPrice(s.price)
      : `${formatPrice(s.priceMin || s.price)} – ${formatPrice(s.priceMax || s.price)}`;
    msg += `${s.emoji} *${s.name}*: ${priceStr}\n`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

// ─── /Barberlar — Barber Management ─────

export async function handleBarberlar(ctx: Context) {
  const barbers = await prisma.barber.findMany({ orderBy: { name: 'asc' } });

  let msg = '👨‍💈 *BERBERLAR*\n\n';

  for (const b of barbers) {
    const status = b.isActive ? '🟢' : '🔴';
    msg += `${status} ${b.name}`;
    if (b.username) msg += ` (@${b.username})`;
    msg += '\n';
  }

  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ Berber qo\'shish', 'admin_add_barber'),
        Markup.button.callback('✏️ Berber tahrirlash', 'admin_edit_barber'),
      ],
      [Markup.button.callback('⏸ Yoqish/O\'chirish', 'admin_toggle_barber')],
    ]),
  });
}

// ─── /Bookinglar — Show Bookings ─────

export async function handleBookinglar(ctx: Context) {
  const today = getToday();

  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: dayjs(today).subtract(1, 'day').toDate() },
      status: { notIn: ['CANCELLED'] },
    },
    include: { customer: true, service: true, barber: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 30,
  });

  if (appointments.length === 0) {
    await ctx.reply('📋 Hozircha buyurtmalar yo\'q.');
    return;
  }

  let msg = '📋 *BUYURTMALAR*\n\n';

  const statusEmoji: Record<string, string> = {
    PENDING: '⏳',
    CONFIRMED: '✅',
    CUSTOMER_FINISHED: '🔄',
    COMPLETED: '💰',
    REJECTED: '❌',
    CANCELLED: '🚫',
  };

  for (const apt of appointments) {
    const s = statusEmoji[apt.status] || '📋';
    msg += `${s} *${apt.customer.firstName || 'Noma\'lum'}* — ${apt.service.emoji} ${apt.service.name}\n`;
    msg += `   👨‍💈 ${apt.barber.name} | 📅 ${formatDate(apt.date)} | 💰 ${formatPrice(apt.price)}\n`;
    msg += `   📌 ${apt.status}\n\n`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

// ─── /Mijozlar — Customer Database ─────

export async function handleMijozlar(ctx: Context) {
  const customers = await prisma.customer.findMany({
    orderBy: { lastVisit: 'desc' },
    take: 30,
  });

  if (customers.length === 0) {
    await ctx.reply('👥 Hozircha mijozlar yo\'q.');
    return;
  }

  let msg = '👥 *MIJOZLAR bazasi*\n\n';

  customers.forEach((c, i) => {
    const name = c.firstName || 'Noma\'lum';
    const username = c.username ? ` (@${c.username})` : '';
    msg += `${i + 1}. ${name}${username}`;
    if (c.completedCount > 0) msg += ` — ✅ ${c.completedCount} xizmat`;
    if (c.totalSpent > BigInt(0)) msg += ` | 💰 ${formatPrice(c.totalSpent)}`;
    if (c.lastVisit) msg += ` | 📅 ${formatDate(c.lastVisit)}`;
    msg += '\n';
  });

  const totalCustomers = await prisma.customer.count();
  msg += `\n👥 Jami: ${totalCustomers}`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

// ─── /Statistika — Statistics ─────

export async function handleStatistika(ctx: Context) {
  const today = getToday();
  const weekAgo = dayjs(today).subtract(7, 'day').toDate();
  const monthStart = dayjs().startOf('month').toDate();
  const monthEnd = dayjs().endOf('month').toDate();

  // Today's revenue
  const todayRevenue = await prisma.revenue.aggregate({
    where: { date: { gte: today, lt: dayjs(today).add(1, 'day').toDate() } },
    _sum: { amount: true },
    _count: true,
  });

  // Weekly revenue
  const weekRevenue = await prisma.revenue.aggregate({
    where: { date: { gte: weekAgo } },
    _sum: { amount: true },
    _count: true,
  });

  // Monthly revenue
  const monthRevenue = await prisma.revenue.aggregate({
    where: { date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
    _count: true,
  });

  // Total customers
  const totalCustomers = await prisma.customer.count();

  // New customers this month
  const newCustomers = await prisma.customer.count({
    where: { createdAt: { gte: monthStart } },
  });

  // Completed services
  const completedServices = await prisma.appointment.count({
    where: { status: 'COMPLETED' },
  });

  // Cancelled
  const cancelled = await prisma.appointment.count({
    where: { status: 'CANCELLED' },
  });

  // Rejected
  const rejected = await prisma.appointment.count({
    where: { status: 'REJECTED' },
  });

  // Most popular service
  const popularService = await prisma.revenue.groupBy({
    by: ['serviceId'],
    _count: true,
    orderBy: { _count: { serviceId: 'desc' } },
    take: 1,
  });
  let popularServiceName = 'N/A';
  if (popularService.length > 0) {
    const svc = await prisma.service.findUnique({ where: { id: popularService[0].serviceId } });
    popularServiceName = svc ? `${svc.emoji} ${svc.name}` : 'N/A';
  }

  // Most active barber
  const activeBarber = await prisma.revenue.groupBy({
    by: ['barberId'],
    _count: true,
    orderBy: { _count: { barberId: 'desc' } },
    take: 1,
  });
  let activeBarberName = 'N/A';
  if (activeBarber.length > 0) {
    const barber = await prisma.barber.findUnique({ where: { id: activeBarber[0].barberId } });
    activeBarberName = barber ? barber.name : 'N/A';
  }

  let msg = '📊 *STATISTIKA*\n\n';

  msg += `💰 *Bugun:* ${todayRevenue._sum.amount ? formatPrice(todayRevenue._sum.amount) : '0 UZS'} (${todayRevenue._count} xizmat)\n`;
  msg += `📅 *7 kun:* ${weekRevenue._sum.amount ? formatPrice(weekRevenue._sum.amount) : '0 UZS'} (${weekRevenue._count} xizmat)\n`;
  msg += `📆 *Oy:* ${monthRevenue._sum.amount ? formatPrice(monthRevenue._sum.amount) : '0 UZS'} (${monthRevenue._count} xizmat)\n\n`;

  msg += `👥 *Jami mijozlar:* ${totalCustomers}\n`;
  msg += `🆕 *Yangi mijozlar:* ${newCustomers}\n`;
  msg += `✅ *Tugallangan:* ${completedServices}\n`;
  msg += `🚫 *Bekor qilingan:* ${cancelled}\n`;
  msg += `❌ *Rad etilgan:* ${rejected}\n\n`;

  msg += `⭐ *Eng mashhur xizmat:* ${popularServiceName}\n`;
  msg += `👨‍💈 *Eng faol berber:* ${activeBarberName}`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

// ─── /Hisobot — Monthly Report ─────

export async function handleHisobot(ctx: Context) {
  const monthStart = dayjs().startOf('month').toDate();
  const monthEnd = dayjs().endOf('month').toDate();

  const totalRevenue = await prisma.revenue.aggregate({
    where: { date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
    _count: true,
  });

  const completedCount = await prisma.appointment.count({
    where: { status: 'COMPLETED', date: { gte: monthStart, lte: monthEnd } },
  });

  const cancelledCount = await prisma.appointment.count({
    where: { status: 'CANCELLED', date: { gte: monthStart, lte: monthEnd } },
  });

  // Top service
  const topService = await prisma.revenue.groupBy({
    by: ['serviceId'],
    _count: true,
    where: { date: { gte: monthStart, lte: monthEnd } },
    orderBy: { _count: { serviceId: 'desc' } },
    take: 1,
  });

  let topServiceName = 'N/A';
  let topServiceCount = 0;
  if (topService.length > 0) {
    const svc = await prisma.service.findUnique({ where: { id: topService[0].serviceId } });
    topServiceName = svc ? `${svc.emoji} ${svc.name}` : 'N/A';
    topServiceCount = topService[0]._count;
  }

  // Top barber
  const topBarber = await prisma.revenue.groupBy({
    by: ['barberId'],
    _count: true,
    where: { date: { gte: monthStart, lte: monthEnd } },
    orderBy: { _count: { barberId: 'desc' } },
    take: 1,
  });

  let topBarberName = 'N/A';
  let topBarberCount = 0;
  if (topBarber.length > 0) {
    const barber = await prisma.barber.findUnique({ where: { id: topBarber[0].barberId } });
    topBarberName = barber ? barber.name : 'N/A';
    topBarberCount = topBarber[0]._count;
  }

  const totalCustomers = await prisma.customer.count({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
  });

  const monthName = dayjs().format('MMMM YYYY');

  let msg = `📊 *OYLIK HISOBOT*\n\n`;
  msg += `📆 Oy: ${monthName}\n\n`;
  msg += `👥 Jami mijozlar: ${totalCustomers}\n`;
  msg += `✅ Tugallangan xizmatlar: ${completedCount}\n`;
  msg += `🚫 Bekor qilingan: ${cancelledCount}\n`;
  msg += `💰 Jami daromad: ${totalRevenue._sum.amount ? formatPrice(totalRevenue._sum.amount) : '0 UZS'}\n\n`;
  msg += `⭐ *Eng mashhur xizmat:*\n`;
  msg += `   ${topServiceName} — ${topServiceCount} ta buyurtma\n\n`;
  msg += `👨‍💈 *Eng faol berber:*\n`;
  msg += `   ${topBarberName} — ${topBarberCount} ta tugallangan`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

// ─── /Broadcast — Send message to all customers ─────

const broadcastSessions = new Map<number, { text: string; step: 'message' | 'confirm' }>();

export async function handleBroadcast(ctx: Context) {
  await ctx.reply(
    '📢 *BROADCAST*\n\nMijozlarga xabar yozing. Xabaringizni kiriting:',
    { parse_mode: 'Markdown' }
  );

  const telegramId = ctx.from?.id;
  if (telegramId) {
    broadcastSessions.set(telegramId, { text: '', step: 'message' });
  }
}

export function isBroadcastMode(telegramId: number): boolean {
  return broadcastSessions.has(telegramId) && broadcastSessions.get(telegramId)!.step === 'message';
}

export async function handleBroadcastMessage(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = broadcastSessions.get(telegramId);
  if (!session || session.step !== 'message') return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  if (!text) return;

  session.text = text;
  session.step = 'confirm';

  const customerCount = await prisma.customer.count();

  await ctx.reply(
    `⚠️ Siz ${customerCount} ta mijozga xabar yubormoqchisiz.\n\n` +
    `Xabar:\n${text}\n\n` +
    `Yuborasizmi?`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(`✅ YUBORISH (${customerCount})`, 'broadcast_send'),
          Markup.button.callback('❌ Bekor qilish', 'broadcast_cancel'),
        ],
      ]),
    }
  );
}

export async function handleBroadcastSend(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = broadcastSessions.get(telegramId);
  if (!session || session.step !== 'confirm') {
    await ctx.reply('Sessiya tugadi.');
    return;
  }

  const customers = await prisma.customer.findMany({
    where: { isBlocked: false },
    select: { telegramId: true },
  });

  let sent = 0;
  let failed = 0;

  const bot = ctx.telegram;

  for (const c of customers) {
    try {
      await bot.sendMessage(Number(c.telegramId), session.text);
      sent++;
    } catch {
      failed++;
    }
  }

  broadcastSessions.delete(telegramId);

  await ctx.reply(
    `📢 *Broadcast yakunlandi*\n\n` +
    `✅ Yuborildi: ${sent}\n` +
    `❌ Xatolik: ${failed}`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleBroadcastCancel(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (telegramId) broadcastSessions.delete(telegramId);
  await ctx.reply('❌ Broadcast bekor qilindi.');
}
