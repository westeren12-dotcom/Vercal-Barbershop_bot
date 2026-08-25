// Seed Script — Creates barbers, services, admin records, and test data
import { PrismaClient, AppointmentStatus } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  const reset = process.argv.includes('--reset');

  if (reset) {
    console.log('🗑️  Resetting database...');
    await prisma.notification.deleteMany();
    await prisma.serviceCompletionRequest.deleteMany();
    await prisma.revenue.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.barber.deleteMany();
    await prisma.service.deleteMany();
    await prisma.admin.deleteMany();
    console.log('✅ Database reset complete.');
  }

  // ─── Admins ────────────────────────────────────────────

  console.log('👑 Creating admins...');
  const admins = [
    {
      telegramId: BigInt(0), // Will be set via env
      username: 'Barber_abbosbek',
      firstName: 'Abbosbek',
      isActive: true,
    },
    {
      telegramId: BigInt(0),
      username: 'isakovvvv12',
      firstName: 'Isakov',
      isActive: true,
    },
  ];

  // Try to resolve admin IDs from env
  const envAdminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = 0; i < admins.length; i++) {
    const a = admins[i];
    if (envAdminIds[i]) {
      a.telegramId = BigInt(envAdminIds[i]);
    }
    await prisma.admin.upsert({
      where: { telegramId: a.telegramId },
      create: a,
      update: { username: a.username, firstName: a.firstName, isActive: true },
    });
  }
  console.log('✅ Admins created.');

  // ─── Barbers ───────────────────────────────────────────

  console.log('👨‍💈 Creating barbers...');
  const barberData = [
    { name: 'Barber Abbosbek' },
    { name: 'Barber Nurillo' },
    { name: 'Barber Muslimbek' },
  ];

  const barbers = [];
  for (const b of barberData) {
    const barber = await prisma.barber.upsert({
      where: { id: barberData.indexOf(b) + 1 },
      create: b,
      update: { name: b.name, isActive: true },
    });
    barbers.push(barber);
  }
  console.log(`✅ ${barbers.length} barbers created.`);

  // ─── Services ──────────────────────────────────────────

  console.log('💈 Creating services...');
  const serviceData = [
    {
      name: 'Soch olish',
      emoji: '✂️',
      price: BigInt(40000),
      duration: 20,
      isPriceFixed: true,
    },
    {
      name: 'Soch qirish — ustara',
      emoji: '🪒',
      price: BigInt(40000),
      duration: 20,
      isPriceFixed: true,
    },
    {
      name: 'Bolalar soch olishi',
      emoji: '👦',
      price: BigInt(35000),
      duration: 20,
      isPriceFixed: true,
    },
    {
      name: 'Soqol olish — ustara',
      emoji: '🪒',
      price: BigInt(35000),
      duration: 15,
      isPriceFixed: true,
    },
    {
      name: 'Soqol olish — shever',
      emoji: '🪒',
      price: BigInt(25000),
      duration: 10,
      isPriceFixed: true,
    },
    {
      name: 'Soqol olish — mashinka',
      emoji: '✂️',
      price: BigInt(20000),
      duration: 5,
      isPriceFixed: true,
    },
    {
      name: 'Soch boyash',
      emoji: '🎨',
      price: BigInt(40000),
      duration: 30,
      isPriceFixed: true,
    },
    {
      name: 'Yuz chistkasi',
      emoji: '✨',
      price: BigInt(55000),
      priceMin: BigInt(30000),
      priceMax: BigInt(80000),
      duration: 30,
      durationMin: 15,
      durationMax: 50,
      isPriceFixed: false,
    },
    {
      name: 'Oq va qora maska',
      emoji: '🧖‍♂️',
      price: BigInt(50000),
      priceMin: BigInt(30000),
      priceMax: BigInt(70000),
      duration: 30,
      durationMin: 15,
      durationMax: 45,
      isPriceFixed: false,
    },
  ];

  const services = [];
  for (const s of serviceData) {
    const service = await prisma.service.create({ data: s });
    services.push(service);
  }
  console.log(`✅ ${services.length} services created.`);

  // ─── Test Customers ────────────────────────────────────

  console.log('👥 Creating test customers...');
  const customersData = [
    { telegramId: BigInt(100001), firstName: 'Ali', username: 'ali_test' },
    { telegramId: BigInt(100002), firstName: 'Vali', username: 'vali_test' },
    { telegramId: BigInt(100003), firstName: 'Aziz', username: 'aziz_test' },
    { telegramId: BigInt(100004), firstName: 'Hasan', username: 'hasan_test' },
    { telegramId: BigInt(100005), firstName: 'Jamshid', username: 'jamshid_test' },
  ];

  const customers = [];
  for (const c of customersData) {
    const customer = await prisma.customer.upsert({
      where: { telegramId: c.telegramId },
      create: c,
      update: c,
    });
    customers.push(customer);
  }
  console.log(`✅ ${customers.length} test customers created.`);

  // ─── Test Appointments (sample completed ones for /BugungiFoyda testing) ──

  console.log('📅 Creating test appointments for today...');
  const today = dayjs().startOf('day').toDate();

  // Predefined test appointments: customer, barber, service, status
  const testAppointments = [
    { cIdx: 0, bIdx: 0, sIdx: 0, status: 'COMPLETED' as AppointmentStatus }, // Ali — Soch olish — Abbosbek
    { cIdx: 0, bIdx: 0, sIdx: 0, status: 'COMPLETED' as AppointmentStatus }, // Ali — Soch olish — Abbosbek (2nd)
    { cIdx: 1, bIdx: 1, sIdx: 0, status: 'COMPLETED' as AppointmentStatus }, // Vali — Soch olish — Nurillo
    { cIdx: 1, bIdx: 1, sIdx: 0, status: 'COMPLETED' as AppointmentStatus }, // Vali — Soch olish — Nurillo (2nd)
    { cIdx: 2, bIdx: 0, sIdx: 1, status: 'COMPLETED' as AppointmentStatus }, // Aziz — Soch qirish — Abbosbek
    { cIdx: 3, bIdx: 2, sIdx: 4, status: 'COMPLETED' as AppointmentStatus }, // Hasan — Soqol shever — Muslimbek
    { cIdx: 4, bIdx: 1, sIdx: 7, status: 'COMPLETED' as AppointmentStatus }, // Jamshid — Yuz chistkasi — Nurillo
    { cIdx: 0, bIdx: 2, sIdx: 0, status: 'CONFIRMED' as AppointmentStatus }, // Ali — Soch olish — Muslimbek (pending)
    { cIdx: 3, bIdx: 0, sIdx: 2, status: 'PENDING' as AppointmentStatus },   // Hasan — Bolalar — Abbosbek
  ];

  let createdAppointments = 0;
  for (const t of testAppointments) {
    // Use a unique approach: since the unique constraint is on (customer, barber, service, date),
    // we add a random note to differentiate duplicates
    const service = services[t.sIdx];
    const price = service.isPriceFixed ? service.price : (service.priceMin || service.price);

    try {
      const appointment = await prisma.appointment.create({
        data: {
          customerId: customers[t.cIdx].id,
          barberId: barbers[t.bIdx].id,
          serviceId: services[t.sIdx].id,
          date: today,
          price,
          status: t.status,
          notes: `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        },
      });

      // If completed, create revenue record (same as admin approval flow)
      if (t.status === 'COMPLETED') {
        await prisma.serviceCompletionRequest.create({
          data: {
            appointmentId: appointment.id,
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedById: BigInt(0),
          },
        });

        await prisma.revenue.create({
          data: {
            appointmentId: appointment.id,
            serviceId: services[t.sIdx].id,
            barberId: barbers[t.bIdx].id,
            amount: price,
            date: today,
          },
        });

        // Update customer stats
        await prisma.customer.update({
          where: { id: customers[t.cIdx].id },
          data: {
            totalSpent: { increment: price },
            completedCount: { increment: 1 },
            lastVisit: new Date(),
          },
        });
      }

      createdAppointments++;
    } catch (err: any) {
      // Skip duplicate unique constraint errors
      if (err?.code === 'P2002') {
        console.log(`   ⚠️ Skipping duplicate appointment`);
      } else {
        console.error(`   ❌ Error creating appointment:`, err.message);
      }
    }
  }
  console.log(`✅ ${createdAppointments} test appointments created.`);

  // ─── Summary ───────────────────────────────────────────

  console.log('\n📊 Seed Summary:');
  console.log(`   👑 Admins: 2`);
  console.log(`   👨‍💈 Barbers: ${barbers.length}`);
  console.log(`   ✂️  Services: ${services.length}`);
  console.log(`   👥 Customers: ${customers.length}`);
  console.log(`   📅 Appointments: ${createdAppointments}`);
  console.log('\n✅ Seed complete! Bot is ready to test.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
