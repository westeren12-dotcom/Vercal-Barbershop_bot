// Customer Bot Handlers — /start, menu, services, prices, booking, finished, myappointments, location, contact
import { Context, Markup } from 'telegraf';
import prisma from '../../lib/prisma/client';
import { formatPrice, formatDate, getToday, getTomorrow, getDateOffset } from '../utils/format';
import { config } from '../../lib/config';

/**
 * /start — Welcome & customer menu
 * Also auto-registers admins by username so they receive notifications
 */
export async function handleStart(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const username = ctx.from?.username?.toLowerCase();
  const adminUsernames = config.ADMIN_USERNAMES;
  const isUserAdmin = username ? adminUsernames.includes(username) : false;

  // If admin by username, save/update their Telegram ID in Admin table
  if (isUserAdmin) {
    await prisma.admin.upsert({
      where: { telegramId: BigInt(telegramId) },
      create: {
        telegramId: BigInt(telegramId),
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        isActive: true,
      },
      update: {
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        isActive: true,
      },
    });
    console.log(`👑 Admin registered: @${ctx.from?.username} (ID: ${telegramId})`);
  }

  // Upsert customer in DB
  await prisma.customer.upsert({
    where: { telegramId: BigInt(telegramId) },
    create: {
      telegramId: BigInt(telegramId),
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
    },
    update: {
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
    },
  });

  const name = ctx.from?.first_name || 'Do\'st';

  // Admins get admin menu, customers get customer menu
  if (isUserAdmin) {
    await ctx.reply(
      `💈 *Vercal Barbershop* — Admin Panel\n\n` +
      `Assalomu alaykum, ${name}! 👋\n` +
      `Siz admin sifatida kiradingiz.\n\n` +
      `Buyruqlar:\n` +
      `/BugungiFoyda — Bugungi daromad\n` +
      `/BugungiMijozlar — Bugungi mijozlar\n` +
      `/Statistika — Umumiy statistika\n` +
      `/Hisobot — Oylik hisobot\n` +
      `/Xizmatlar — Xizmatlar boshqaruvi\n` +
      `/Narxlar — Narxlar\n` +
      `/Barberlar — Berberlar\n` +
      `/Bookinglar — Buyurtmalar\n` +
      `/Mijozlar — Mijozlar bazasi\n` +
      `/Broadcast — Xabar yuborish`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          ['📅 Online Booking', '💈 Xizmatlar'],
          ['💰 Narxlar', '📋 Mening buyurtmalarim'],
          ['✅ Xizmatim tugadi', '📍 Manzil'],
          ['📞 Aloqa'],
        ]).resize(),
      }
    );
  } else {
    await ctx.reply(
      `💈 *Vercal Barbershop* ga xush kelibsiz!\n\nAssalomu alaykum, ${name}! 👋\nBizning xizmatlarimiz bilan tanishing:`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          ['📅 Online Booking', '💈 Xizmatlar'],
          ['💰 Narxlar', '📋 Mening buyurtmalarim'],
          ['✅ Xizmatim tugadi', '📍 Manzil'],
          ['📞 Aloqa'],
        ]).resize(),
      }
    );
  }
}

/**
 * /services — Show all active services
 */
export async function handleServices(ctx: Context) {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  if (services.length === 0) {
    await ctx.reply('Hozircha xizmatlar mavjud emas.');
    return;
  }

  let msg = '💈 *Vercal Barbershop — Xizmatlar*\n\n';

  for (const s of services) {
    const priceStr = s.isPriceFixed
      ? formatPrice(s.price)
      : `${formatPrice(s.priceMin || s.price)} – ${formatPrice(s.priceMax || s.price)}`;
    const durStr = s.durationMax
      ? `${s.durationMin || s.duration}–${s.durationMax} daqiqa`
      : `${s.duration} daqiqa`;
    msg += `${s.emoji} *${s.name}*\n   💰 ${priceStr}\n   ⏱ ${durStr}\n\n`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

/**
 * /prices — Show all prices
 */
export async function handlePrices(ctx: Context) {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  if (services.length === 0) {
    await ctx.reply('Hozircha narxlar mavjud emas.');
    return;
  }

  let msg = '💰 *Vercal Barbershop — Narxlar*\n\n';

  for (const s of services) {
    const priceStr = s.isPriceFixed
      ? formatPrice(s.price)
      : `${formatPrice(s.priceMin || s.price)} – ${formatPrice(s.priceMax || s.price)}`;
    msg += `${s.emoji} ${s.name}: *${priceStr}*\n`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

/**
 * /location — Show location
 */
export async function handleLocation(ctx: Context) {
  const { CLINIC_NAME, CLINIC_ADDRESS, GOOGLE_MAPS_URL } = config;

  let msg = `📍 *${CLINIC_NAME}*\n\n`;
  if (CLINIC_ADDRESS) {
    msg += `🏠 Manzil: ${CLINIC_ADDRESS}\n\n`;
  }
  if (GOOGLE_MAPS_URL) {
    msg += `🗺 [Google Maps da ko'rish](${GOOGLE_MAPS_URL})`;
  } else {
    msg += 'Manzil hozircha kiritilmagan.';
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

/**
 * /contact — Show contact info
 */
export async function handleContact(ctx: Context) {
  const { CLINIC_NAME, CLINIC_PHONE, CLINIC_ADDRESS } = config;

  let msg = `📞 *${CLINIC_NAME} — Aloqa*\n\n`;
  if (CLINIC_PHONE) {
    msg += `📱 Tel: ${CLINIC_PHONE}\n`;
  }
  if (CLINIC_ADDRESS) {
    msg += `🏠 Manzil: ${CLINIC_ADDRESS}\n`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

/**
 * /myappointments — Show customer's active appointments
 */
export async function handleMyAppointments(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const customer = await prisma.customer.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!customer) {
    await ctx.reply('Siz hali ro\'yxatdan o\'tmagansiz. /start buyrug\'ini bosing.');
    return;
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      customerId: customer.id,
      status: { in: ['PENDING', 'CONFIRMED', 'CUSTOMER_FINISHED'] },
    },
    include: { barber: true, service: true },
    orderBy: { date: 'asc' },
  });

  if (appointments.length === 0) {
    await ctx.reply('📋 Sizda faol buyurtmalar yo\'q.\n\n📅 Online Booking orqali yangi buyurtma yarating!');
    return;
  }

  let msg = '📋 *Mening buyurtmalarim*\n\n';

  for (const apt of appointments) {
    const statusEmoji: Record<string, string> = {
      PENDING: '⏳',
      CONFIRMED: '✅',
      CUSTOMER_FINISHED: '🔄',
    };
    msg += `${statusEmoji[apt.status] || '📋'} *${apt.service.emoji} ${apt.service.name}*\n`;
    msg += `   👨‍💈 ${apt.barber.name}\n`;
    msg += `   📅 ${formatDate(apt.date)}\n`;
    msg += `   💰 ${formatPrice(apt.price)}\n`;
    msg += `   📌 ${apt.status}\n\n`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

/**
 * /finished — Customer confirms service is finished
 */
export async function handleFinished(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const customer = await prisma.customer.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!customer) {
    await ctx.reply('Siz hali ro\'yxatdan o\'tmagansiz. /start buyrug\'ini bosing.');
    return;
  }

  // Find active appointments that haven't been confirmed by customer yet
  const appointments = await prisma.appointment.findMany({
    where: {
      customerId: customer.id,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    include: { barber: true, service: true },
    orderBy: { date: 'desc' },
  });

  if (appointments.length === 0) {
    await ctx.reply('✅ Sizda tugallanmagan xizmatlar yo\'q.');
    return;
  }

  const apt = appointments[0]; // Most recent

  await ctx.reply(
    `Sizning xizmatingiz:\n\n` +
    `👤 Mijoz: ${customer.firstName || 'Noma\'lum'}\n` +
    `👨‍💈 Berber: ${apt.barber.name}\n` +
    `${apt.service.emoji} Xizmat: ${apt.service.name}\n` +
    `💰 Narx: ${formatPrice(apt.price)}\n` +
    `📅 Sana: ${formatDate(apt.date)}\n\n` +
    `Xizmat tugallandimi?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Ha, tugallandim', `finish_confirm_${apt.id}`),
          Markup.button.callback('❌ Bekor qilish', `finish_cancel_${apt.id}`),
        ],
      ]),
    }
  );
}

/**
 * Handle finish confirmation callback
 */
export async function handleFinishConfirm(ctx: Context, appointmentId: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const customer = await prisma.customer.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!customer) {
    await ctx.reply('Xatolik yuz berdi.');
    return;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { barber: true, service: true, completionRequest: true },
  });

  if (!appointment) {
    await ctx.reply('Buyurtma topilmadi.');
    return;
  }

  if (appointment.customerId !== customer.id) {
    await ctx.reply('Bu sizning buyurtmangiz emas.');
    return;
  }

  if (appointment.status === 'CUSTOMER_FINISHED' || appointment.status === 'COMPLETED') {
    await ctx.reply('Bu xizmat allaqachon tugallangan yoki tasdiqlangan.');
    return;
  }

  if (appointment.completionRequest && appointment.completionRequest.status === 'PENDING') {
    await ctx.reply('Tasdiqlash so\'rovi allaqachon yuborilgan. Admin javobini kuting.');
    return;
  }

  // Update appointment status
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CUSTOMER_FINISHED' },
  });

  // Create completion request
  await prisma.serviceCompletionRequest.create({
    data: {
      appointmentId: appointmentId,
      status: 'PENDING',
    },
  });

  await ctx.reply(
    '✅ Xizmat tugallandi deb belgilandi!\n\n' +
    'Admin tasdiqlashini kuting. Admin tasdiqlaganidan so\'ng, xizmat rasman hisobga olinadi.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle finish cancel callback
 */
export async function handleFinishCancel(ctx: Context, appointmentId: number) {
  await ctx.reply('Bekor qilindi. Xizmat hali tugallanmagan deb qoldirildi.');
}
