/**
 * Common test utilities and setup functions
 */
import { expect } from 'vitest';
import { validateEventData } from '../utils/eventUtils';

/**
 * Creates a mock form event with specified data
 * @param {Object} data - Key-value pairs of form data
 * @returns {Object} Mock form event
 */
export function createMockFormEvent(data) {
  return {
    detail: {
      formData: new Map(Object.entries(data))
    }
  };
}

/**
 * Custom matcher for event data validation
 * @param {Object} received - The received event data
 * @returns {Object} Matcher result
 */
export function toBeValidEventData(received) {
  const isValid = validateEventData(received);

  return {
    pass: isValid,
    message: () =>
      isValid
        ? 'Expected event data to be invalid'
        : 'Expected event data to be valid with required fields: title (string), datetime (valid date string), location (string), description (string)'
  };
}

/**
 * Simulates a delay for async operations
 * @param {number} ms - Milliseconds to wait
 */
export function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock state manager for testing
 * @returns {Object} Mock state manager
 */
export function createMockStateManager() {
  const state = new Map();
  const subscribers = new Map();

  return {
    getState: key => state.get(key),
    setState: updates => {
      Object.entries(updates).forEach(([key, value]) => {
        state.set(key, value);
        if (subscribers.has(key)) {
          subscribers.get(key).forEach(callback => callback(value));
        }
      });
    },
    subscribe: (key, callback) => {
      if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
      }
      subscribers.get(key).add(callback);
      return () => subscribers.get(key).delete(callback);
    }
  };
}
