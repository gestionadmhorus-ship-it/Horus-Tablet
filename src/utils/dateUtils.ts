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

/**
 * Parses a locale timestamp (12h or 24h format, e.g., "9/6/2026 3:42:49 p.m." or "11/06/2026 08:59:41")
 * or an ISO timestamp, and returns a valid Date object.
 */
export function parseLocalTimestampToDate(timestamp: string): Date | null {
  if (!timestamp) return null;
  
  // Handle ISO format if present
  if (timestamp.includes('T')) {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const parts = timestamp.trim().split(/\s+/);
  const datePart = parts[0];
  if (!datePart) return null;
  
  const dateSplit = datePart.split(/[-/]/);
  if (dateSplit.length !== 3) return null;
  
  let d = parseInt(dateSplit[0], 10);
  let m = parseInt(dateSplit[1], 10);
  let y = parseInt(dateSplit[2], 10);

  // Handle YYYY-MM-DD
  if (dateSplit[0].length === 4) {
    y = parseInt(dateSplit[0], 10);
    m = parseInt(dateSplit[1], 10);
    d = parseInt(dateSplit[2], 10);
  } else {
    if (y < 100) y += 2000;
    // American MM/DD/YYYY heuristic where month > 12 is impossible
    if (d <= 12 && m > 12) {
      const temp = d; d = m; m = temp;
    }
  }

  const timePart = parts[1] || '00:00:00';
  const timeParts = timePart.split(':');
  let hours = parseInt(timeParts[0] || '0', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  const seconds = parseInt(timeParts[2] || '0', 10);
  
  const ampm = ((parts[2] || '') + (timePart || '')).toLowerCase();
  if (ampm.includes('p') && hours < 12) {
    hours += 12;
  } else if (ampm.includes('a') && hours === 12) {
    hours = 0;
  }
  
  const dateObj = new Date(y, m - 1, d, hours, minutes, seconds);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

/**
 * Parses a local timestamp string and returns its epoch time in milliseconds.
 * Returns 0 if invalid.
 */
export function getChronologicalTime(timestamp: string): number {
  const d = parseLocalTimestampToDate(timestamp);
  return d ? d.getTime() : 0;
}

