import { describe, it, expect } from 'vitest';
import { encodeEventData, decodeEventData, validateEventData } from './eventUtils';

describe('Event Utilities', () => {
  describe('validateEventData', () => {
    it('should validate correct event data', () => {
      const validEvent = {
        title: 'Test Event',
        datetime: '2024-04-05T15:00',
        location: 'Test Location',
        description: 'Test Description'
      };
      expect(validateEventData(validEvent)).toBe(true);
      expect(() => validateEventData(validEvent)).not.toThrow();
    });

    it('should reject invalid event data', () => {
      const invalidEvents = [
        {
          // Missing title
          datetime: '2024-04-05T15:00',
          location: 'Test Location',
          description: 'Test Description'
        },
        {
          // Invalid date
          title: 'Test Event',
          datetime: 'invalid-date',
          location: 'Test Location',
          description: 'Test Description'
        },
        {
          // Empty title
          title: '',
          datetime: '2024-04-05T15:00',
          location: 'Test Location',
          description: 'Test Description'
        },
        null,
        undefined,
        'not-an-object'
      ];

      invalidEvents.forEach(event => {
        expect(validateEventData(event)).toBe(false);
        expect(() => validateEventData(event)).not.toThrow();
      });
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        {
          // Minimum valid data
          title: 'a',
          datetime: new Date().toISOString(),
          location: '',
          description: ''
        },
        {
          // Extra properties
          title: 'Test Event',
          datetime: '2024-04-05T15:00',
          location: 'Test Location',
          description: 'Test Description',
          extraProp: 'should be ignored'
        }
      ];

      edgeCases.forEach(event => {
        expect(validateEventData(event)).toBe(true);
        expect(() => validateEventData(event)).not.toThrow();
      });
    });
  });

  describe('encodeEventData and decodeEventData', () => {
    it('should correctly encode and decode event data', () => {
      const originalEvent = {
        title: 'Test Event',
        datetime: '2024-04-05T15:00',
        location: 'Test Location',
        description: 'Test Description'
      };

      const encoded = encodeEventData(originalEvent);
      expect(typeof encoded).toBe('string');
      expect(encoded).not.toContain('{');
      expect(encoded).not.toContain('}');

      const decoded = decodeEventData(encoded);
      expect(decoded).toEqual(originalEvent);
    });

    it('should handle special characters', () => {
      const eventWithSpecialChars = {
        title: 'Test & Event + More!',
        datetime: '2024-04-05T15:00',
        location: 'Location / Place & Time',
        description: 'Description with ©®™ symbols'
      };

      const encoded = encodeEventData(eventWithSpecialChars);
      const decoded = decodeEventData(encoded);
      expect(decoded).toEqual(eventWithSpecialChars);
    });

    it('should throw error for invalid encoded data', () => {
      expect(() => decodeEventData('invalid-data')).toThrow();
      expect(() => decodeEventData('')).toThrow();
      expect(() => decodeEventData(null)).toThrow();
      expect(() => decodeEventData(undefined)).toThrow();
    });

    it('should maintain data integrity for large texts', () => {
      const largeEvent = {
        title: 'A'.repeat(100),
        datetime: '2024-04-05T15:00',
        location: 'B'.repeat(500),
        description: 'C'.repeat(1000)
      };

      const encoded = encodeEventData(largeEvent);
      const decoded = decodeEventData(encoded);
      expect(decoded).toEqual(largeEvent);
    });
  });
});
