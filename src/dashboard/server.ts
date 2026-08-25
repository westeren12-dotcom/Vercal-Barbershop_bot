// Vercal Barbershop — Web Admin Dashboard
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dayjs from 'dayjs';
import prisma from '../lib/prisma/client';
import { formatPrice, formatDate } from '../bot/utils/format';
import { config } from '../lib/config';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ═══════════════════════════════════════════════════════
// DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════

// ─── Dashboard Home ────────────────────────────────────

app.get('/', async (_req, res) => {
  try {
    const today = dayjs().startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();
    const monthEnd = dayjs().endOf('month').toDate();

    // Today's revenue
    const todayRevenue = await prisma.revenue.aggregate({
      where: {
        date: { gte: today, lt: dayjs(today).add(1, 'day').toDate() },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Today's customers
    const todayAppointments = await prisma.appointment.findMany({
      where: {
        date: { gte: today, lt: dayjs(today).add(1, 'day').toDate() },
      },
    });

    // Pending confirmations
    const pendingConfirmations = await prisma.appointment.count({
      where: { status: 'CUSTOMER_FINISHED' },
    });

    // Completed services today
    const completedToday = todayAppointments.filter(
      (a) => a.status === 'COMPLETED'
    ).length;

    // Monthly revenue
    const monthRevenue = await prisma.revenue.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });

    // Total customers
    const totalCustomers = await prisma.customer.count();

    // Cancelled this month
    const cancelledMonth = await prisma.appointment.count({
      where: {
        status: 'CANCELLED',
        date: { gte: monthStart, lte: monthEnd },
      },
    });

    // Recent revenue for chart
    const last7Days = Array.from({ length: 7 }, (_, i) =>
      dayjs().subtract(6 - i, 'day').startOf('day').toDate()
    );

    const dailyRevenue: { date: string; amount: number }[] = [];
    for (const d of last7Days) {
      const rev = await prisma.revenue.aggregate({
        where: {
          date: { gte: d, lt: dayjs(d).add(1, 'day').toDate() },
        },
        _sum: { amount: true },
      });
      dailyRevenue.push({
        date: dayjs(d).format('DD MMM'),
        amount: Number(rev._sum.amount || 0),
      });
    }

    res.render('dashboard', {
      clinicName: config.CLINIC_NAME,
      todayRevenue: Number(todayRevenue._sum.amount || 0),
      todayCustomers: todayAppointments.length,
      completedToday,
      pendingConfirmations,
      monthRevenue: Number(monthRevenue._sum.amount || 0),
      cancelledMonth,
      totalCustomers,
      dailyRevenue,
      formatPrice,
      formatDate,
      currentPage: 'dashboard',
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Dashboard yuklanishda xatolik',
      currentPage: 'dashboard',
    });
  }
});

// ─── Appointments ──────────────────────────────────────

app.get('/appointments', async (_req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { customer: true, barber: true, service: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    res.render('appointments', {
      clinicName: config.CLINIC_NAME,
      appointments,
      formatPrice,
      formatDate,
      currentPage: 'appointments',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Xatolik',
      currentPage: 'appointments',
    });
  }
});

// ─── Customers ─────────────────────────────────────────

app.get('/customers', async (_req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { totalSpent: 'desc' },
    });

    res.render('customers', {
      clinicName: config.CLINIC_NAME,
      customers,
      formatPrice,
      formatDate,
      currentPage: 'customers',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Xatolik',
      currentPage: 'customers',
    });
  }
});

// ─── Barbers ───────────────────────────────────────────

app.get('/barbers', async (_req, res) => {
  try {
    const barbers = await prisma.barber.findMany({
      include: {
        _count: { select: { appointments: true, revenues: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Get revenue per barber
    const barbersWithRevenue = await Promise.all(
      barbers.map(async (b) => {
        const rev = await prisma.revenue.aggregate({
          where: { barberId: b.id },
          _sum: { amount: true },
          _count: true,
        });
        return {
          ...b,
          totalRevenue: Number(rev._sum.amount || 0),
          completedServices: rev._count,
        };
      })
    );

    res.render('barbers', {
      clinicName: config.CLINIC_NAME,
      barbers: barbersWithRevenue,
      formatPrice,
      currentPage: 'barbers',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Xatolik',
      currentPage: 'barbers',
    });
  }
});

// ─── Services ──────────────────────────────────────────

app.get('/services', async (_req, res) => {
  try {
    const services = await prisma.service.findMany({
      include: {
        _count: { select: { appointments: true, revenues: true } },
      },
      orderBy: { price: 'asc' },
    });

    const servicesWithRevenue = await Promise.all(
      services.map(async (s) => {
        const rev = await prisma.revenue.aggregate({
          where: { serviceId: s.id },
          _sum: { amount: true },
          _count: true,
        });
        return {
          ...s,
          totalRevenue: Number(rev._sum.amount || 0),
          revenueCount: rev._count,
        };
      })
    );

    res.render('services', {
      clinicName: config.CLINIC_NAME,
      services: servicesWithRevenue,
      formatPrice,
      currentPage: 'services',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Xatolik',
      currentPage: 'services',
    });
  }
});

// ─── Revenue ───────────────────────────────────────────

app.get('/revenue', async (_req, res) => {
  try {
    const revenue = await prisma.revenue.findMany({
      include: { service: true, barber: true, appointment: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Monthly totals for last 6 months
    const months: { month: string; total: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const mStart = dayjs().subtract(i, 'month').startOf('month').toDate();
      const mEnd = dayjs().subtract(i, 'month').endOf('month').toDate();
      const rev = await prisma.revenue.aggregate({
        where: { date: { gte: mStart, lte: mEnd } },
        _sum: { amount: true },
      });
      months.unshift({
        month: dayjs(mStart).format('MMMM YYYY'),
        total: Number(rev._sum.amount || 0),
      });
    }

    res.render('revenue', {
      clinicName: config.CLINIC_NAME,
      revenue,
      months,
      formatPrice,
      formatDate,
      currentPage: 'revenue',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Xatolik',
      currentPage: 'revenue',
    });
  }
});

// ─── Statistics ────────────────────────────────────────

app.get('/statistics', async (_req, res) => {
  try {
    const today = dayjs().startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();
    const monthEnd = dayjs().endOf('month').toDate();

    // Revenue stats
    const totalRevenue = await prisma.revenue.aggregate({ _sum: { amount: true } });
    const monthRevenue = await prisma.revenue.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });

    // Service stats
    const totalCompleted = await prisma.appointment.count({ where: { status: 'COMPLETED' } });
    const totalCancelled = await prisma.appointment.count({ where: { status: 'CANCELLED' } });
    const totalRejected = await prisma.appointment.count({ where: { status: 'REJECTED' } });

    // Top services
    const topServices = await prisma.revenue.groupBy({
      by: ['serviceId'],
      _count: true,
      _sum: { amount: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    });

    const topServicesResolved = await Promise.all(
      topServices.map(async (ts) => {
        const svc = await prisma.service.findUnique({ where: { id: ts.serviceId } });
        return {
          name: svc?.name || 'Unknown',
          emoji: svc?.emoji || '❓',
          count: ts._count,
          revenue: Number(ts._sum.amount || 0),
        };
      })
    );

    // Top barbers
    const topBarbers = await prisma.revenue.groupBy({
      by: ['barberId'],
      _count: true,
      _sum: { amount: true },
      orderBy: { _count: { barberId: 'desc' } },
      take: 5,
    });

    const topBarbersResolved = await Promise.all(
      topBarbers.map(async (tb) => {
        const barber = await prisma.barber.findUnique({ where: { id: tb.barberId } });
        return {
          name: barber?.name || 'Unknown',
          count: tb._count,
          revenue: Number(tb._sum.amount || 0),
        };
      })
    );

    // Total customers
    const totalCustomers = await prisma.customer.count();

    res.render('statistics', {
      clinicName: config.CLINIC_NAME,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      monthRevenue: Number(monthRevenue._sum.amount || 0),
      totalCompleted,
      totalCancelled,
      totalRejected,
      topServices: topServicesResolved,
      topBarbers: topBarbersResolved,
      totalCustomers,
      formatPrice,
      currentPage: 'statistics',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Xatolik',
      currentPage: 'statistics',
    });
  }
});

// ─── Settings ──────────────────────────────────────────

app.get('/settings', async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'asc' } });
    const barbers = await prisma.barber.findMany({ orderBy: { name: 'asc' } });
    const services = await prisma.service.findMany({ orderBy: { price: 'asc' } });

    res.render('settings', {
      clinicName: config.CLINIC_NAME,
      admins,
      barbers,
      services,
      formatPrice,
      currentPage: 'settings',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      clinicName: config.CLINIC_NAME,
      message: 'Xatolik',
      currentPage: 'settings',
    });
  }
});

// ─── API endpoints for dashboard ──────────────────────

app.get('/api/stats', async (_req, res) => {
  try {
    const today = dayjs().startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();
    const monthEnd = dayjs().endOf('month').toDate();

    const [todayRevenue, monthRevenue, totalCustomers, pendingConfirmations, completedToday] =
      await Promise.all([
        prisma.revenue.aggregate({
          where: { date: { gte: today, lt: dayjs(today).add(1, 'day').toDate() } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.revenue.aggregate({
          where: { date: { gte: monthStart, lte: monthEnd } },
          _sum: { amount: true },
        }),
        prisma.customer.count(),
        prisma.appointment.count({ where: { status: 'CUSTOMER_FINISHED' } }),
        prisma.appointment.count({
          where: {
            status: 'COMPLETED',
            date: { gte: today, lt: dayjs(today).add(1, 'day').toDate() },
          },
        }),
      ]);

    res.json({
      todayRevenue: Number(todayRevenue._sum.amount || 0),
      todayServices: todayRevenue._count,
      monthRevenue: Number(monthRevenue._sum.amount || 0),
      totalCustomers,
      pendingConfirmations,
      completedToday,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Error page ────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).render('error', {
    clinicName: config.CLINIC_NAME,
    message: 'Sahifa topilmadi',
    currentPage: '',
  });
});

// ─── Start server ──────────────────────────────────────

export function startDashboard() {
  const port = config.DASHBOARD_PORT;
  app.listen(port, () => {
    console.log(`🌐 Dashboard running at http://localhost:${port}`);
  });
  return app;
}

export default app;
