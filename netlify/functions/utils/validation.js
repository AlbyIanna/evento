import { ErrorTypes } from './errorHandler.js';
import { isValidEncodedParam, MAX_ENCODED_LENGTH } from '../../../src/shared/eventFormat.js';

/**
 * Validates event parameters
 */
export const validateEventParam = param => {
  if (!param) {
    throw ErrorTypes.VALIDATION_ERROR('Event parameter is required');
  }

  if (typeof param !== 'string') {
    throw ErrorTypes.VALIDATION_ERROR('Event parameter must be a string');
  }

  if (param.length > MAX_ENCODED_LENGTH) {
    throw ErrorTypes.VALIDATION_ERROR(
      `Event parameter is too long (max ${MAX_ENCODED_LENGTH} characters)`
    );
  }

  if (!isValidEncodedParam(param)) {
    throw ErrorTypes.VALIDATION_ERROR('Event parameter contains invalid characters');
  }

  return param;
};

/**
 * Validates and extracts query parameters
 */
export const validateQueryParams = (event, requiredParams = []) => {
  const params = new URLSearchParams(event.queryStringParameters || {});
  const validatedParams = {};

  for (const param of requiredParams) {
    const value = params.get(param);
    if (!value) {
      throw ErrorTypes.VALIDATION_ERROR(`Missing required query parameter: ${param}`);
    }
    validatedParams[param] = value;
  }

  return validatedParams;
};
