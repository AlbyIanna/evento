export function encodeEventData(eventData) {
  try {
    const jsonString = JSON.stringify(eventData);
    const encoded = encodeURIComponent(jsonString);
    const base64 = btoa(encoded).replace(/\//g, '_').replace(/=+$/, '');
    return base64;
  } catch (_error) {
    console.error('Failed to encode event data:', _error);
    throw new Error('Failed to encode event data');
  }
}

export function decodeEventData(encodedEvent) {
  try {
    const base64 = encodedEvent.replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decodeURIComponent(decoded));
  } catch (_error) {
    console.error('Invalid event data format:', _error);
    throw new Error('Invalid event data format');
  }
}

export function validateEventData(data) {
  // Check if data is an object and not null
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  // Must have title, datetime, and location as strings
  if (
    typeof data.title !== 'string' ||
    data.title.trim().length === 0 ||
    typeof data.datetime !== 'string' ||
    typeof data.location !== 'string'
  ) {
    return false;
  }

  // Validate datetime format
  const date = new Date(data.datetime);
  if (isNaN(date.getTime())) {
    return false;
  }

  // Description is optional but must be a string if present
  if (data.description !== undefined && typeof data.description !== 'string') {
    return false;
  }

  return true;
}
