/**
 * Event service
 * Provides functions for working with event data
 */

/**
 * Encode event data for URL sharing
 * @param {Object} data - The event data to encode
 * @returns {string} - The encoded event data
 */
export function encodeEventData(data) {
  try {
    return btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    throw new Error('Failed to encode event data', {
      cause: error
    });
  }
}

/**
 * Decode event data from URL
 * @param {string} encoded - The encoded event data
 * @returns {Object} - The decoded event data
 */
export function decodeEventData(encoded) {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (error) {
    throw new Error('Invalid event data format', {
      cause: error
    });
  }
}

/**
 * Validate event data structure
 * @param {Object} data - The event data to validate
 * @returns {boolean} - Whether the event data is valid
 */
export function validateEventData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Must have title, datetime, and location as strings
  if (
    typeof data.title !== 'string' ||
    typeof data.location !== 'string' ||
    typeof data.datetime !== 'string'
  ) {
    return false;
  }

  // Description is optional but must be a string if present
  if (data.description !== undefined && typeof data.description !== 'string') {
    return false;
  }

  return true;
}

/**
 * Format event data for display
 * @param {Object} eventData - The raw event data
 * @param {Function} formatDate - Function to format date
 * @param {Function} formatTime - Function to format time
 * @returns {Object} - The formatted event data
 */
export function formatEventData(eventData, formatDate, formatTime) {
  let formattedEventData = { ...eventData };

  if (eventData.datetime) {
    const datetime = new Date(eventData.datetime);
    formattedEventData.date = formatDate(datetime.toISOString());
    formattedEventData.time = formatTime(datetime.toTimeString().split(' ')[0]);
  }

  return formattedEventData;
}

/**
 * Create share data for the Web Share API
 * @param {Object} eventData - The event data
 * @param {string} url - The URL to share
 * @returns {Object} - The share data
 */
export function createShareData(eventData, url) {
  return {
    title: eventData.title,
    text: `Join me at ${eventData.title} on ${eventData.date} at ${eventData.time}`,
    url: url
  };
}
