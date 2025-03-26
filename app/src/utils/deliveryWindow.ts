import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

/**
 * Utility for calculating letter delivery windows
 * Letters are delivered at 8am and 8pm UTC each day
 */

// Define delivery hours in UTC
const MORNING_HOUR_UTC = 8;  // 8am UTC
const EVENING_HOUR_UTC = 20; // 8pm UTC

// Define the timezone (only used for display purposes)
const TIMEZONE = 'America/Los_Angeles';

/**
 * Create a UTC date at a specific hour with zeroed minutes/seconds
 */
const createUtcTime = (date: Date, hour: number): Date => {
  const newDate = new Date(date);
  newDate.setUTCHours(hour, 0, 0, 0);
  return newDate;
};

/**
 * Get the current delivery window
 * @returns Object containing start and end times of the current delivery window in UTC
 */
export const getCurrentDeliveryWindow = (): { start: Date, end: Date, isNewWindow: boolean } => {
  // Get current time in UTC
  const now = new Date();
  const currentHourUtc = now.getUTCHours();
  
  // Variables to hold the window boundaries
  let windowStart: Date;
  let windowEnd: Date;
  let isNewWindow = false;
  
  // Determine which window we're in based on current UTC hour
  if (currentHourUtc >= EVENING_HOUR_UTC) {
    // After 8pm UTC - evening window until 8am tomorrow
    windowStart = createUtcTime(now, EVENING_HOUR_UTC);
    
    // Morning end is tomorrow
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    windowEnd = createUtcTime(tomorrow, MORNING_HOUR_UTC);
  } 
  else if (currentHourUtc >= MORNING_HOUR_UTC) {
    // Between 8am and 8pm UTC - morning window
    windowStart = createUtcTime(now, MORNING_HOUR_UTC);
    windowEnd = createUtcTime(now, EVENING_HOUR_UTC);
  } 
  else {
    // Before 8am UTC - still in previous day's evening window
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    windowStart = createUtcTime(yesterday, EVENING_HOUR_UTC);
    windowEnd = createUtcTime(now, MORNING_HOUR_UTC);
  }
  
  // Check if we just entered this window (within the last 5 minutes)
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  isNewWindow = windowStart.getTime() > fiveMinutesAgo.getTime();
  
  // Log the calculated window for debugging
  console.log('Delivery Window Calculated:', {
    nowUTC: now.toISOString(),
    windowStartUTC: windowStart.toISOString(),
    windowEndUTC: windowEnd.toISOString(),
    isNewWindow
  });
  
  return { 
    start: windowStart, 
    end: windowEnd, 
    isNewWindow 
  };
};

/**
 * Format a delivery window for display
 * Converts UTC times to local display format for the user
 */
export const formatDeliveryWindow = (start: Date, end: Date): string => {
  // Convert UTC dates to PST/PDT for display
  const pstStart = toZonedTime(start, TIMEZONE);
  const pstEnd = toZonedTime(end, TIMEZONE);
  
  const startHour = pstStart.getHours();
  const endHour = pstEnd.getHours();
  
  const startPeriod = startHour >= 12 ? 'pm' : 'am';
  const endPeriod = endHour >= 12 ? 'pm' : 'am';
  
  const formattedStartHour = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
  const formattedEndHour = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
  
  const dateStr = formatTz(pstStart, 'MMM d', { timeZone: TIMEZONE });
  
  return `${formattedStartHour}${startPeriod}-${formattedEndHour}${endPeriod}, ${dateStr}`;
};

/**
 * Convert a UTC date to PST/PDT
 */
export const convertToPST = (date: Date): Date => {
  return toZonedTime(date, TIMEZONE);
};

/**
 * Calculate time until the next delivery window
 */
export const getTimeUntilNextWindow = (): { hours: number, minutes: number, seconds: number } => {
  const now = new Date();
  const currentHourUtc = now.getUTCHours();
  const currentMinuteUtc = now.getUTCMinutes();
  
  // Determine the next window based on current UTC time
  let nextWindowTime: Date;
  
  if (currentHourUtc < MORNING_HOUR_UTC) {
    // Next window is morning today
    nextWindowTime = createUtcTime(now, MORNING_HOUR_UTC);
  } 
  else if (currentHourUtc < EVENING_HOUR_UTC) {
    // Next window is evening today
    nextWindowTime = createUtcTime(now, EVENING_HOUR_UTC);
  } 
  else {
    // Next window is morning tomorrow
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    nextWindowTime = createUtcTime(tomorrow, MORNING_HOUR_UTC);
  }
  
  // Calculate time difference
  const timeDiff = nextWindowTime.getTime() - now.getTime();
  const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutesDiff = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const secondsDiff = Math.floor((timeDiff % (1000 * 60)) / 1000);
  
  return {
    hours: hoursDiff,
    minutes: minutesDiff,
    seconds: secondsDiff
  };
}; 