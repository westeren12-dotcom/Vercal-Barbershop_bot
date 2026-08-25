// Formatting utilities for Telegram messages
import dayjs from 'dayjs';

/**
 * Format price in UZS (Uzbekistan Som)
 */
export function formatPrice(amount: bigint | number): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  return num.toLocaleString('uz-UZ') + ' UZS';
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = dayjs(date);
  return d.format('D MMMM YYYY');
}

/**
 * Format date short
 */
export function formatDateShort(date: Date | string): string {
  const d = dayjs(date);
  return d.format('DD.MM.YYYY');
}

/**
 * Get today as a date-only object (no time)
 */
export function getToday(): Date {
  return dayjs().startOf('day').toDate();
}

/**
 * Get tomorrow as a date-only object
 */
export function getTomorrow(): Date {
  return dayjs().add(1, 'day').startOf('day').toDate();
}

/**
 * Get date N days from now
 */
export function getDateOffset(days: number): Date {
  return dayjs().add(days, 'day').startOf('day').toDate();
}

/**
 * Format a number with spaces (Uzbek style)
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('uz-UZ');
}

/**
 * Escape Markdown special characters for Telegram
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}
