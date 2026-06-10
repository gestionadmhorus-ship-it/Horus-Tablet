// Centralized date and time utilities for Horus Tablet Campo

/**
 * Formats a Date object into "HH:mm:ss" 24h format, zero-padded.
 * Example: "14:05:09"
 */
export function formatTime24h(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a Date object into "DD/MM/YYYY" format, zero-padded.
 * Example: "10/06/2026"
 */
export function formatDateDMY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a Date object into "DD/MM/YYYY HH:mm:ss" format.
 * Example: "10/06/2026 14:05:09"
 */
export function formatTimestamp(date: Date): string {
  return `${formatDateDMY(date)} ${formatTime24h(date)}`;
}
