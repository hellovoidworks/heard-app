/**
 * Utility for calculating letter delivery windows
 * Letters are delivered at 8am and 8pm PST each day
 */

// Define delivery hours in PST
const MORNING_HOUR = 8; // 8am PST
const EVENING_HOUR = 20; // 8pm PST

// Time zone offset for PST (-8 hours from UTC, or -7 during daylight savings)
// Note: A proper implementation would use a library like date-fns-tz or moment-timezone
// This is a simplified version that doesn't account for daylight savings changes
const PST_OFFSET = -8; // hours from UTC

/**
 * Convert a date to PST
 * @param date Date to convert
 * @returns Date object adjusted to PST
 */
export const convertToPST = (date: Date): Date => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * PST_OFFSET));
};

/**
 * Get the current delivery window start time
 * @returns Date object representing the start of the current delivery window
 */
export const getCurrentDeliveryWindow = (): { start: Date, end: Date, isNewWindow: boolean } => {
  const now = new Date();
  const pstNow = convertToPST(now);
  
  const pstHour = pstNow.getHours();
  const pstDate = pstNow.getDate();
  const pstMonth = pstNow.getMonth();
  const pstYear = pstNow.getFullYear();
  
  // Create date objects for today's delivery windows in PST
  const morningWindow = new Date(Date.UTC(pstYear, pstMonth, pstDate, MORNING_HOUR - PST_OFFSET, 0, 0));
  const eveningWindow = new Date(Date.UTC(pstYear, pstMonth, pstDate, EVENING_HOUR - PST_OFFSET, 0, 0));
  
  // Calculate the previous day's evening window for edge cases
  const yesterdayEveningWindow = new Date(Date.UTC(pstYear, pstMonth, pstDate - 1, EVENING_HOUR - PST_OFFSET, 0, 0));
  
  // Determine which window we're in
  let windowStart: Date;
  let windowEnd: Date;
  let isNewWindow = false;
  
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  if (pstHour >= EVENING_HOUR) {
    // After 8pm - evening window
    windowStart = eveningWindow;
    // Window ends at 8am tomorrow
    windowEnd = new Date(Date.UTC(pstYear, pstMonth, pstDate + 1, MORNING_HOUR - PST_OFFSET, 0, 0));
    // Check if we just entered this window (within the last 5 minutes)
    isNewWindow = fiveMinutesAgo < eveningWindow;
  } else if (pstHour >= MORNING_HOUR) {
    // Between 8am and 8pm - morning window
    windowStart = morningWindow;
    windowEnd = eveningWindow;
    // Check if we just entered this window (within the last 5 minutes)
    isNewWindow = fiveMinutesAgo < morningWindow;
  } else {
    // Before 8am - still in previous day's evening window
    windowStart = yesterdayEveningWindow;
    windowEnd = morningWindow;
    // It's unlikely but possible we just entered this window if app opens right after midnight
    isNewWindow = false;
  }
  
  return { start: windowStart, end: windowEnd, isNewWindow };
};

/**
 * Format a delivery window for display
 * @param start Start of the window
 * @param end End of the window
 * @returns Formatted string, e.g. "8am-8pm, May 15"
 */
export const formatDeliveryWindow = (start: Date, end: Date): string => {
  const startHour = convertToPST(start).getHours();
  const endHour = convertToPST(end).getHours();
  
  const startPeriod = startHour >= 12 ? 'pm' : 'am';
  const endPeriod = endHour >= 12 ? 'pm' : 'am';
  
  const formattedStartHour = startHour > 12 ? startHour - 12 : startHour;
  const formattedEndHour = endHour > 12 ? endHour - 12 : endHour;
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const dateStr = convertToPST(start).toLocaleDateString('en-US', options);
  
  return `${formattedStartHour}${startPeriod}-${formattedEndHour}${endPeriod}, ${dateStr}`;
};

/**
 * Calculate time until the next delivery window
 * @returns Object with hours and minutes until next window
 */
export const getTimeUntilNextWindow = (): { hours: number, minutes: number } => {
  const now = new Date();
  const pstNow = convertToPST(now);
  const pstHour = pstNow.getHours();
  
  let nextWindowHour: number;
  if (pstHour < MORNING_HOUR) {
    nextWindowHour = MORNING_HOUR;
  } else if (pstHour < EVENING_HOUR) {
    nextWindowHour = EVENING_HOUR;
  } else {
    // Next window is 8am tomorrow
    nextWindowHour = MORNING_HOUR + 24;
  }
  
  // Calculate time difference
  const pstDate = pstNow.getDate();
  const pstMonth = pstNow.getMonth();
  const pstYear = pstNow.getFullYear();
  
  let nextWindowDate = new Date(Date.UTC(pstYear, pstMonth, pstDate, nextWindowHour - PST_OFFSET, 0, 0));
  
  // If next window is tomorrow's morning window
  if (nextWindowHour >= 24) {
    nextWindowDate = new Date(Date.UTC(pstYear, pstMonth, pstDate + 1, MORNING_HOUR - PST_OFFSET, 0, 0));
  }
  
  const timeDiff = nextWindowDate.getTime() - now.getTime();
  const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutesDiff = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours: hoursDiff, minutes: minutesDiff };
}; 