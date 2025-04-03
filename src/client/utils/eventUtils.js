export function encodeEventData(eventData) {
  try {
    const jsonString = JSON.stringify(eventData);
    const base64 = btoa(jsonString).replace(/\//g, '_').replace(/=+$/, '');
    return base64;
  } catch (_error) {
    console.error('Failed to encode event data:', _error);
    throw new Error('Failed to encode event data');
  }
}

export function decodeEventData(encodedEvent) {
  try {
    const base64 = encodedEvent.replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (_error) {
    console.error('Invalid event data format:', _error);
    throw new Error('Invalid event data format');
  }
}

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
