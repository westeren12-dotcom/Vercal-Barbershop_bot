// Auto-Seed: Populates database with services, barbers, and admin records
// Runs automatically on first startup if the Service table is empty
import prisma from './prisma/client';
import { config } from './config';

export async function autoSeed(): Promise<void> {
  // Check if services already exist
  const serviceCount = await prisma.service.count();
  if (serviceCount > 0) {
    console.log('📋 Database already seeded, skipping.');
    return;
  }

  console.log('🌱 Auto-seeding database...');

  // ─── Services ──────────────────────────────────────────

  const services = [
    { name: 'Soch olish', emoji: '✂️', price: BigInt(40000), duration: 20, isPriceFixed: true },
    { name: 'Soch qirish — ustara', emoji: '🪒', price: BigInt(40000), duration: 20, isPriceFixed: true },
    { name: 'Bolalar soch olishi', emoji: '👦', price: BigInt(35000), duration: 20, isPriceFixed: true },
    { name: 'Soqol olish — ustara', emoji: '🪒', price: BigInt(35000), duration: 15, isPriceFixed: true },
    { name: 'Soqol olish — shever', emoji: '🪒', price: BigInt(25000), duration: 10, isPriceFixed: true },
    { name: 'Soqol olish — mashinka', emoji: '✂️', price: BigInt(20000), duration: 5, isPriceFixed: true },
    { name: 'Soch boyash', emoji: '🎨', price: BigInt(40000), duration: 30, isPriceFixed: true },
    {
      name: 'Yuz chistkasi', emoji: '✨',
      price: BigInt(55000), priceMin: BigInt(30000), priceMax: BigInt(80000),
      duration: 30, durationMin: 15, durationMax: 50, isPriceFixed: false,
    },
    {
      name: 'Oq va qora maska', emoji: '🧖‍♂️',
      price: BigInt(50000), priceMin: BigInt(30000), priceMax: BigInt(70000),
      duration: 30, durationMin: 15, durationMax: 45, isPriceFixed: false,
    },
  ];

  for (const s of services) {
    await prisma.service.create({ data: s });
  }
  console.log(`   ✅ ${services.length} xizmatlar yaratildi`);

  // ─── Barbers ───────────────────────────────────────────

  const barbers = [
    { name: 'Barber Abbosbek' },
    { name: 'Barber Nurillo' },
    { name: 'Barber Muslimbek' },
  ];

  for (const b of barbers) {
    await prisma.barber.create({ data: b });
  }
  console.log(`   ✅ ${barbers.length} berber yaratildi`);

  // ─── Admins ────────────────────────────────────────────

  // Register admins from ADMIN_TELEGRAM_IDS and ADMIN_USERNAMES env
  const adminIds = config.ADMIN_TELEGRAM_IDS;
  const adminUsernames = config.ADMIN_USERNAMES;
  const adminData = [
    { username: 'Barber_abbosbek', firstName: 'Abbosbek' },
    { username: 'isakovvvv12', firstName: 'Isakov' },
  ];

  // Create admin records for each configured admin
  for (let i = 0; i < Math.max(adminIds.length, adminUsernames.length, adminData.length); i++) {
    const admin = adminData[i] || { username: `admin_${i}`, firstName: `Admin ${i + 1}` };
    const telegramId = adminIds[i] || 0;

    await prisma.admin.upsert({
      where: { telegramId: BigInt(telegramId) },
      create: {
        telegramId: BigInt(telegramId),
        username: admin.username,
        firstName: admin.firstName,
        isActive: true,
      },
      update: {
        username: admin.username,
        firstName: admin.firstName,
        isActive: true,
      },
    });
  }
  console.log(`   ✅ Adminlar ro'yxatga olindi`);

  console.log('🌱 Auto-seed complete!');
}
