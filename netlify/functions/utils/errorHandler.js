/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Standard error responses
 */
export const ErrorTypes = {
  VALIDATION_ERROR: (message = 'Invalid input') => new APIError(message, 400, 'VALIDATION_ERROR'),
  NOT_FOUND: (message = 'Resource not found') => new APIError(message, 404, 'NOT_FOUND'),
  INTERNAL_ERROR: (message = 'Internal server error') =>
    new APIError(message, 500, 'INTERNAL_SERVER_ERROR')
};

/**
 * Wraps a function handler with error handling
 */
export const withErrorHandler = handler => async (event, context) => {
  try {
    return await handler(event, context);
  } catch (error) {
    console.error('Error:', error);

    // Handle known errors
    if (error instanceof APIError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: {
            message: error.message,
            code: error.code
          }
        })
      };
    }

    // Handle unknown errors
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: {
          message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
          code: 'INTERNAL_SERVER_ERROR'
        }
      })
    };
  }
};
