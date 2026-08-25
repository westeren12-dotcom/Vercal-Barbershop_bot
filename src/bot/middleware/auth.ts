// Admin Authorization Middleware
import { Context } from 'telegraf';
import prisma from '../../lib/prisma/client';
import { config } from '../../lib/config';

// Cache admin Telegram IDs from DB for fast lookup
const adminCache = new Set<number>(config.ADMIN_TELEGRAM_IDS);

/**
 * Check if a Telegram user is an admin
 */
export async function isAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  // Fast path: check env config first
  if (adminCache.has(userId)) return true;

  // Slow path: check DB
  const admin = await prisma.admin.findUnique({
    where: { telegramId: BigInt(userId) },
  });
  return admin?.isActive === true;
}

/**
 * Refresh admin cache from DB
 */
export async function refreshAdminCache(): Promise<void> {
  const admins = await prisma.admin.findMany({
    where: { isActive: true },
    select: { telegramId: true },
  });
  adminCache.clear();
  config.ADMIN_TELEGRAM_IDS.forEach((id) => adminCache.add(id));
  admins.forEach((a) => adminCache.add(Number(a.telegramId)));
}

/**
 * Middleware that requires admin access.
 * Responds with error if not admin.
 */
export function requireAdmin() {
  return async (ctx: Context, next: () => Promise<void>) => {
    const admin = await isAdmin(ctx);
    if (!admin) {
      await ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.\n\nYou don\'t have permission to use this command.');
      return;
    }
    await next();
  };
}

/**
 * Register a new admin
 */
export async function registerAdmin(telegramId: number, username?: string, firstName?: string, lastName?: string) {
  return prisma.admin.upsert({
    where: { telegramId: BigInt(telegramId) },
    create: {
      telegramId: BigInt(telegramId),
      username,
      firstName,
      lastName,
    },
    update: {
      username,
      firstName,
      lastName,
      isActive: true,
    },
  });
}
