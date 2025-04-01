import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

/**
 * Utility for calculating letter delivery windows
 * Letters are delivered at 8am and 8:30pm LOCAL TIME each day
 */

// Define delivery hours in LOCAL TIME
const MORNING_HOUR = 8;  // 8am local time
const EVENING_HOUR = 20; // 8pm local time
const EVENING_MINUTE_TEST = 56; // TEMPORARY: For testing 8:56pm transition

/**
 * Create a date at a specific local hour with zeroed minutes/seconds
 * TEMPORARY: Added minute override for testing evening transition
 */
const createLocalTime = (date: Date, hour: number): Date => {
  const newDate = new Date(date);
  // TEMPORARY: Set minutes to EVENING_MINUTE_TEST if it's the evening hour
  const targetMinute = (hour === EVENING_HOUR) ? EVENING_MINUTE_TEST : 0;
  // Corrected order: setMinutes takes targetMinute, setSeconds takes 0
  return setHours(setMinutes(setSeconds(setMilliseconds(newDate, 0), 0), targetMinute), hour);
};

/**
 * Get the current delivery window based on LOCAL TIME
 * @returns Object containing start and end times of the current delivery window
 */
export const getCurrentDeliveryWindow = (): { start: Date, end: Date, isNewWindow: boolean } => {
  // Get current time
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes(); // TEMPORARY: Get minutes for testing

  // Variables to hold the window boundaries
  let windowStart: Date;
  let windowEnd: Date;
  let isNewWindow = false;

  // TEMPORARY: Check against 8:56 PM for testing evening transition
  const isPastEveningTestTime = currentHour > EVENING_HOUR || (currentHour === EVENING_HOUR && currentMinute >= EVENING_MINUTE_TEST);

  // Determine which window we're in based on current local hour
  if (isPastEveningTestTime) {
    // After 8:56pm local time - evening window until 8am tomorrow
    windowStart = createLocalTime(now, EVENING_HOUR); // Creates 20:56:00

    // Morning end is tomorrow
    const tomorrow = addDays(now, 1);
    windowEnd = createLocalTime(tomorrow, MORNING_HOUR);
  } 
  else if (currentHour >= MORNING_HOUR) {
    // Between 8am and 8:56pm local time - morning window
    windowStart = createLocalTime(now, MORNING_HOUR); // Creates 08:00:00
    windowEnd = createLocalTime(now, EVENING_HOUR);   // Creates 20:56:00
  } 
  else {
    // Before 8am local time - still in previous day's evening window
    // Note: The *previous* evening window also started at 8:56 PM yesterday
    const yesterday = addDays(now, -1);
    windowStart = createLocalTime(yesterday, EVENING_HOUR); // Creates yesterday 20:56:00
    windowEnd = createLocalTime(now, MORNING_HOUR); // Creates 08:00:00
  }
  
  // Check if we just entered this window (within the last 5 minutes)
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  isNewWindow = windowStart.getTime() > fiveMinutesAgo.getTime();
  
  // Log the calculated window for debugging (optional)
  // console.log(`Current Time: ${now.toLocaleString()}`);
  // console.log(`Delivery Window: ${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()}`);
  // console.log(`Is New Window: ${isNewWindow}`);

  return { start: windowStart, end: windowEnd, isNewWindow };
};

/**
 * Format a delivery window for display
 * Converts local times to string format for the user
 */
export const formatDeliveryWindow = (start: Date, end: Date): string => {
  const startHour = start.getHours();
  const endHour = end.getHours();
  
  const startPeriod = startHour >= 12 ? 'pm' : 'am';
  const endPeriod = endHour >= 12 ? 'pm' : 'am';
  
  const formattedStartHour = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
  const formattedEndHour = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
  
  const dateStr = start.toLocaleString('default', { month: 'short', day: 'numeric' });
  
  return `${formattedStartHour}${startPeriod}-${formattedEndHour}${endPeriod}, ${dateStr}`;
};

/**
 * Calculate time until the next delivery window
 */
export const getTimeUntilNextWindow = (): { hours: number, minutes: number, seconds: number } => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes(); // TEMPORARY: Get minutes

  // Determine the next window based on current local time
  let nextWindowTime: Date;
  const isPastEveningTestTime = currentHour > EVENING_HOUR || (currentHour === EVENING_HOUR && currentMinute >= EVENING_MINUTE_TEST);

  if (currentHour < MORNING_HOUR) {
    // Next window is morning today
    nextWindowTime = createLocalTime(now, MORNING_HOUR); // 08:00:00
  }
  else if (!isPastEveningTestTime) {
    // Still before 8:56 PM today, next window is evening today
    nextWindowTime = createLocalTime(now, EVENING_HOUR); // 20:56:00
  }
  else {
    // After 8:56 PM today, next window is morning tomorrow
    const tomorrow = addDays(now, 1);
    nextWindowTime = createLocalTime(tomorrow, MORNING_HOUR); // Tomorrow 08:00:00
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