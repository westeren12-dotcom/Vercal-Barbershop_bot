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

  // Register admins from ADMIN_TELEGRAM_IDS env
  const adminIds = config.ADMIN_TELEGRAM_IDS;
  const adminNames = ['Abbosbek', 'Isakov'];

  for (let i = 0; i < adminIds.length; i++) {
    await prisma.admin.upsert({
      where: { telegramId: BigInt(adminIds[i]) },
      create: {
        telegramId: BigInt(adminIds[i]),
        firstName: adminNames[i] || `Admin ${i + 1}`,
        isActive: true,
      },
      update: { isActive: true },
    });
  }
  console.log(`   ✅ ${adminIds.length} adminlar ro'yxatga olindi`);

  console.log('🌱 Auto-seed complete!');
}
