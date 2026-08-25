// Service Completion + Admin Verification System
// This is the CORE feature — tracks revenue after admin confirmation
import { Context, Markup } from 'telegraf';
import prisma from '../../lib/prisma/client';
import { formatPrice, formatDate, getToday } from '../utils/format';
import { isAdmin } from '../middleware/auth';
import dayjs from 'dayjs';

/**
 * Admin receives notification when customer marks service as finished.
 * Admin confirms: YES → revenue recorded, NO → rejected
 */

/**
 * Send verification request to all admins
 */
export async function notifyAdminsOfCompletion(ctx: Context, appointmentId: number) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { customer: true, service: true, barber: true },
  });

  if (!appointment) return;

  const adminIds = (await import('../../lib/config')).config.ADMIN_TELEGRAM_IDS;

  const message =
    `🔔 *XIZMAT TUGALLANISH SO'ROVI*\n\n` +
    `👤 Mijoz: ${appointment.customer.firstName || 'Noma\'lum'}\n` +
    `👨‍💈 Berber: ${appointment.barber.name}\n` +
    `${appointment.service.emoji} Xizmat: ${appointment.service.name}\n` +
    `💰 Narx: ${formatPrice(appointment.price)}\n` +
    `📅 Sana: ${formatDate(appointment.date)}\n\n` +
    `Mijoz xizmat tugallanganini aytdi.\n\n` +
    `Xizmat haqiqatan tugallanganmi?`;

  for (const adminId of adminIds) {
    try {
      await ctx.telegram.sendMessage(adminId, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ HA', `admin_approve_${appointmentId}`),
            Markup.button.callback('❌ YO\'Q', `admin_reject_${appointmentId}`),
          ],
        ]),
      });
    } catch (err) {
      console.error(`Failed to notify admin ${adminId}:`, err);
    }
  }
}

/**
 * Admin approves completion → Revenue is recorded
 */
export async function handleAdminApprove(ctx: Context, appointmentId: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Verify admin
  const admin = await isAdmin(ctx);
  if (!admin) {
    await ctx.reply('❌ Sizda bu huquq yo\'q.');
    return;
  }

  // Find appointment
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { service: true, barber: true, completionRequest: true, customer: true },
  });

  if (!appointment) {
    await ctx.reply('Buyurtma topilmadi.');
    return;
  }

  if (appointment.status === 'COMPLETED') {
    await ctx.reply('⚠️ Bu xizmat allaqachon tasdiqlangan.');
    return;
  }

  if (appointment.status !== 'CUSTOMER_FINISHED') {
    await ctx.reply('⚠️ Bu buyurtma hali "tugallandi" holatida emas.');
    return;
  }

  // DUPLICATE PROTECTION: Check if revenue already exists
  const existingRevenue = await prisma.revenue.findUnique({
    where: { appointmentId: appointmentId },
  });

  if (existingRevenue) {
    await ctx.reply('⚠️ Bu xizmat uchun daromad allaqachon qo\'shilgan. Takroriy hisoblanish oldini olindi.');
    return;
  }

  const today = getToday();

  // Transaction: update appointment, create revenue, update customer
  await prisma.$transaction(async (tx) => {
    // 1. Update appointment status to COMPLETED
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    });

    // 2. Update completion request
    if (appointment.completionRequest) {
      await tx.serviceCompletionRequest.update({
        where: { id: appointment.completionRequest.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: BigInt(telegramId),
        },
      });
    }

    // 3. Create revenue record
    await tx.revenue.create({
      data: {
        appointmentId: appointmentId,
        serviceId: appointment.serviceId,
        barberId: appointment.barberId,
        amount: appointment.price,
        date: today,
      },
    });

    // 4. Update customer stats
    await tx.customer.update({
      where: { id: appointment.customerId },
      data: {
        totalSpent: { increment: appointment.price },
        completedCount: { increment: 1 },
        lastVisit: new Date(),
      },
    });
  });

  await ctx.reply(
    `✅ *XIZMAT TASDIQLANDI*\n\n` +
    `👤 Mijoz: ${appointment.customer.firstName || 'Noma\'lum'}\n` +
    `${appointment.service.emoji} Xizmat: ${appointment.service.name}\n` +
    `👨‍💈 Berber: ${appointment.barber.name}\n` +
    `💰 Daromad: ${formatPrice(appointment.price)}\n\n` +
    `Daromad hisobga olindi.`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Admin rejects completion → No revenue
 */
export async function handleAdminReject(ctx: Context, appointmentId: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Verify admin
  const admin = await isAdmin(ctx);
  if (!admin) {
    await ctx.reply('❌ Sizda bu huquq yo\'q.');
    return;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { service: true, barber: true, completionRequest: true, customer: true },
  });

  if (!appointment) {
    await ctx.reply('Buyurtma topilmadi.');
    return;
  }

  if (appointment.status === 'COMPLETED' || appointment.status === 'REJECTED') {
    await ctx.reply('⚠️ Bu buyurtma allaqachon ko\'rib chiqilgan.');
    return;
  }

  // Update appointment status to REJECTED
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'REJECTED' },
  });

  // Update completion request
  if (appointment.completionRequest) {
    await prisma.serviceCompletionRequest.update({
      where: { id: appointment.completionRequest.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: BigInt(telegramId),
      },
    });
  }

  await ctx.reply(
    `❌ *XIZMAT RAD ETILDI*\n\n` +
    `👤 Mijoz: ${appointment.customer.firstName || 'Noma\'lum'}\n` +
    `${appointment.service.emoji} Xizmat: ${appointment.service.name}\n\n` +
    `Daromadga qo'shilmadi.`,
    { parse_mode: 'Markdown' }
  );
}
