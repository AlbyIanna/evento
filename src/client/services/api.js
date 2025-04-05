/**
 * API error class for client-side error handling
 */
export class APIError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Base API configuration
 */
const API_CONFIG = {
  baseURL:
    process.env.NODE_ENV === 'production'
      ? '/.netlify/functions'
      : 'http://localhost:8888/.netlify/functions',
  headers: {
    'Content-Type': 'application/json'
  }
};

/**
 * Generic API request handler
 */
async function request(endpoint, options = {}) {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...API_CONFIG.headers,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new APIError(
      data.error?.message || 'An error occurred',
      response.status,
      data.error?.code
    );
  }

  return data;
}

/**
 * Event-related API calls
 */
export const eventAPI = {
  /**
   * Get event details
   * @param {string} eventId - The event identifier
   */
  getEvent: eventId => request(`/event/${eventId}`),

  /**
   * Get a shortened URL for an event
   * @param {string} encodedData - The encoded event data
   * @returns {Promise<{shortUrl: string}>}
   */
  getShortenedUrl: async encodedData => {
    // Only shorten URLs that are too long
    if (encodedData.length > 1000) {
      const response = await request('/event', {
        method: 'POST',
        body: JSON.stringify({ encodedData })
      });
      return response.shortUrl;
    }
    return `/event/${encodedData}`;
  },

  /**
   * List events with optional filters
   * @param {Object} params - Query parameters
   */
  listEvents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/event${query ? `?${query}` : ''}`);
  }
};

/**
 * Health check API call
 */
export const healthAPI = {
  check: () => request('/health')
};
