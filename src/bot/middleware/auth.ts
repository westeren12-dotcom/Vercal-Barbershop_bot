// Admin Authorization Middleware
import { Context } from 'telegraf';
import prisma from '../../lib/prisma/client';
import { config } from '../../lib/config';

// Cache admin Telegram IDs and usernames for fast lookup
const adminIdCache = new Set<number>(config.ADMIN_TELEGRAM_IDS);
const adminUsernameCache = new Set<string>(config.ADMIN_USERNAMES);

/**
 * Check if a Telegram user is an admin
 * Checks: 1) Telegram ID in env/DB, 2) Username in env/DB
 */
export async function isAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username?.toLowerCase();

  // Fast path: check env config first
  if (userId && adminIdCache.has(userId)) return true;
  if (username && adminUsernameCache.has(username)) return true;

  // Slow path: check DB by Telegram ID
  if (userId) {
    const admin = await prisma.admin.findUnique({
      where: { telegramId: BigInt(userId) },
    });
    if (admin?.isActive) return true;
  }

  // Slow path: check DB by username
  if (username) {
    const admin = await prisma.admin.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        isActive: true,
      },
    });
    if (admin) return true;
  }

  return false;
}

/**
 * Refresh admin cache from DB
 */
export async function refreshAdminCache(): Promise<void> {
  const admins = await prisma.admin.findMany({
    where: { isActive: true },
    select: { telegramId: true, username: true },
  });
  adminIdCache.clear();
  adminUsernameCache.clear();
  config.ADMIN_TELEGRAM_IDS.forEach((id) => adminIdCache.add(id));
  config.ADMIN_USERNAMES.forEach((u) => adminUsernameCache.add(u));
  admins.forEach((a) => {
    adminIdCache.add(Number(a.telegramId));
    if (a.username) adminUsernameCache.add(a.username.toLowerCase());
  });
}

/**
 * Middleware that requires admin access.
 * Responds with error if not admin.
 */
export function requireAdmin() {
  return async (ctx: Context, next: () => Promise<void>) => {
    const admin = await isAdmin(ctx);
    if (!admin) {
      await ctx.reply('❌ Sizda bu buyruqni ishlatish huquqi yo\'q.');
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
