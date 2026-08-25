// Environment configuration
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  ADMIN_TELEGRAM_IDS: (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  ADMIN_USERNAMES: (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((s) => s.trim().replace('@', '').toLowerCase())
    .filter(Boolean),
  CLINIC_NAME: process.env.CLINIC_NAME || 'Vercal Barbershop',
  CLINIC_PHONE: process.env.CLINIC_PHONE || '',
  CLINIC_ADDRESS: process.env.CLINIC_ADDRESS || '',
  GOOGLE_MAPS_URL: process.env.GOOGLE_MAPS_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'change-this',
  DASHBOARD_PORT: Number(process.env.DASHBOARD_PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
};
