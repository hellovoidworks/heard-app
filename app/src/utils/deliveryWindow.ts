import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

/**
 * Utility for calculating letter delivery windows
 * Letters are delivered at 1am and 8pm LOCAL TIME each day
 */

// Define delivery hours in LOCAL TIME
export const MORNING_HOUR = 3;  // 3am local time for testing
export const MORNING_MINUTE_TEST = 5; // For testing 3:05am transition
export const EVENING_HOUR = 20; // 8pm local time

/**
 * Create a date at a specific local hour with zeroed minutes/seconds
 * Set minutes to MORNING_MINUTE_TEST if it's the morning hour test
 */
const createLocalTime = (date: Date, hour: number): Date => {
  const newDate = new Date(date);
  const targetMinute = (hour === MORNING_HOUR) ? MORNING_MINUTE_TEST : 0;
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
  const currentMinute = now.getMinutes();

  // Variables to hold the window boundaries
  let windowStart: Date;
  let windowEnd: Date;
  let isNewWindow = false;



  // Check against 1:57 AM for testing morning transition
  const isPastMorningTestTime = currentHour > MORNING_HOUR || (currentHour === MORNING_HOUR && currentMinute >= MORNING_MINUTE_TEST);

  // Determine which window we're in based on current local hour
  if (currentHour >= EVENING_HOUR) {
    // After 8pm local time - Evening window until 8am tomorrow
    windowStart = createLocalTime(now, EVENING_HOUR); // Creates 20:00:00 today

    // Morning end is tomorrow
    const tomorrow = addDays(now, 1);
    windowEnd = createLocalTime(tomorrow, MORNING_HOUR); // Creates 08:00:00 tomorrow
  }
  else if (isPastMorningTestTime) {
    // Between 2:02am and 8pm local time - Morning window
    windowStart = createLocalTime(now, MORNING_HOUR); // Creates 02:02:00 today
    windowEnd = createLocalTime(now, EVENING_HOUR);   // Creates 20:00:00 today
  }
  else {
    // Before 2:02am local time - still in previous day's evening window
    // Note: The *previous* evening window started at 8 PM yesterday
    const yesterday = addDays(now, -1);
    windowStart = createLocalTime(yesterday, EVENING_HOUR); // Creates yesterday 20:00:00
    windowEnd = createLocalTime(now, MORNING_HOUR); // Creates 08:00:00 today
  }
  
  // For morning test window, check if we're within 30 seconds of the test minute
  if (currentHour === MORNING_HOUR) {
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    const thirtySecondsAhead = new Date(now.getTime() + 30 * 1000);
    
    // Create a date for the exact test time
    const exactTestTime = new Date(now);
    exactTestTime.setHours(MORNING_HOUR, MORNING_MINUTE_TEST, 0, 0);
    
    // Check if we're within 30 seconds of the exact test time
    isNewWindow = exactTestTime >= thirtySecondsAgo && exactTestTime <= thirtySecondsAhead;
    
    console.log(`WINDOW DEBUG: Exact test time: ${exactTestTime.toLocaleString()} (${exactTestTime.toISOString()})`);
    console.log(`WINDOW DEBUG: 30s window: ${thirtySecondsAgo.toLocaleString()} to ${thirtySecondsAhead.toLocaleString()}`);
  } else {
    // For regular windows, check if we just entered this window (within the last 5 minutes)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    isNewWindow = windowStart.getTime() > fiveMinutesAgo.getTime();
  }
  
  // Log the calculated window for debugging
  console.log(`WINDOW DEBUG: Current Time: ${now.toLocaleString()} (${now.toISOString()})`);
  console.log(`WINDOW DEBUG: Current Hour: ${currentHour}, Current Minute: ${currentMinute}`);
  console.log(`WINDOW DEBUG: Morning Hour: ${MORNING_HOUR}, Morning Minute: ${MORNING_MINUTE_TEST}, Evening Hour: ${EVENING_HOUR}`);
  console.log(`WINDOW DEBUG: isPastMorningTestTime: ${isPastMorningTestTime}`);
  console.log(`WINDOW DEBUG: Delivery Window: ${windowStart.toLocaleString()} (${windowStart.toISOString()}) - ${windowEnd.toLocaleString()} (${windowEnd.toISOString()})`);
  console.log(`WINDOW DEBUG: Is New Window: ${isNewWindow}`);

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
  const currentMinute = now.getMinutes();
  // Determine the next window based on current local time
  let nextWindowTime: Date;
  const isPastMorningTestTime = currentHour > MORNING_HOUR || (currentHour === MORNING_HOUR && currentMinute >= MORNING_MINUTE_TEST);

  if (currentHour >= EVENING_HOUR) {
    // After 8 PM today, next window is morning tomorrow
    const tomorrow = addDays(now, 1);
    nextWindowTime = createLocalTime(tomorrow, MORNING_HOUR); // Tomorrow 08:00:00
  }
  else if (isPastMorningTestTime) {
    // Between 2:02 AM and 8 PM today, next window is evening today
    nextWindowTime = createLocalTime(now, EVENING_HOUR); // Today 20:00:00
  }
  else {
    // Before 8 AM today, next window is morning today
    nextWindowTime = createLocalTime(now, MORNING_HOUR); // Today 08:00:00
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