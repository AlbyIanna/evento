import { withErrorHandler } from './utils/errorHandler.js';
import { validateEventParam } from './utils/validation.js';

// In-memory store for shortened URLs (would use KV store in production)
const urlStore = new Map();

const eventHandler = async event => {
  const path = event.path;
  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  // Handle shortened URLs
  if (segments[0] === 's') {
    const longUrl = urlStore.get(lastSegment);
    if (!longUrl) {
      return {
        statusCode: 301,
        headers: {
          Location: '/'
        }
      };
    }
    return {
      statusCode: 301,
      headers: {
        Location: longUrl
      }
    };
  }

  // Handle URL shortening requests
  if (event.httpMethod === 'POST') {
    const { encodedData } = JSON.parse(event.body);

    // Validate the encoded data
    validateEventParam(encodedData);

    // Generate short ID (use proper generation in production)
    const shortId = Math.random().toString(36).substring(2, 8);
    const longUrl = `/event/${encodedData}`;

    // Store the mapping
    urlStore.set(shortId, longUrl);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shortUrl: `/s/${shortId}`
      })
    };
  }

  // For direct event URLs, just validate and return success
  validateEventParam(lastSegment);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valid: true
    })
  };
};

// Export the handler with error handling wrapper
export const handler = withErrorHandler(eventHandler);
