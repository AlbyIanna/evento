/**
 * Date service
 * Provides functions for formatting and manipulating dates
 */

/**
 * Format a date string to a human-readable format
 * @param {string} dateString - The date string to format
 * @returns {string} - The formatted date
 */
export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format a time string to a human-readable format
 * @param {string} timeString - The time string to format
 * @returns {string} - The formatted time
 */
export function formatTime(timeString) {
  return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get the next 9 PM date/time in ISO format for datetime-local input
 * @returns {string} - The next 9 PM date/time in ISO format
 */
export function getNext9PM() {
  const now = new Date();
  const target = new Date(now);

  // Set time to 9:00 PM (21:00) in local time
  target.setHours(21, 0, 0, 0);

  // Check if current time is after 8:45 PM
  const cutoffTime = new Date(now);
  cutoffTime.setHours(20, 45, 0, 0);

  // If current time is after 8:45 PM, move to tomorrow
  if (now >= cutoffTime && now.getHours() < 24) {
    target.setDate(target.getDate() + 1);
  }

  // Format for datetime-local input: YYYY-MM-DDThh:mm
  // We need to use local date formatting to handle timezone correctly
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  const hours = String(target.getHours()).padStart(2, '0');
  const minutes = String(target.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert separate date and time strings to a datetime format
 * @param {string} dateStr - The date string
 * @param {string} timeStr - The time string
 * @returns {string} - The combined datetime in ISO format
 */
export function combineDateAndTime(dateStr, timeStr) {
  try {
    const dateObj = new Date(`${dateStr} ${timeStr}`);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    console.error('Error formatting date/time:', e);
    return getNext9PM();
  }
}
