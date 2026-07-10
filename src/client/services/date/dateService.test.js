import { describe, it, expect } from 'vitest';
import { formatDate, formatTime, getNext9PM, combineDateAndTime } from './dateService.js';

describe('dateService', () => {
  describe('formatDate', () => {
    it('formats a date in en-US by default', () => {
      expect(formatDate('2024-06-01T12:00')).toBe('Saturday, June 1, 2024');
    });

    it('formats a date in the given locale', () => {
      expect(formatDate('2024-06-01T12:00', 'it-IT')).toBe('sabato 1 giugno 2024');
    });
  });

  describe('formatTime', () => {
    it('formats a time in en-US by default', () => {
      expect(formatTime('21:30')).toBe('9:30 PM');
    });

    it('formats a time in the given locale', () => {
      expect(formatTime('21:30', 'it-IT')).toBe('21:30');
    });
  });

  describe('getNext9PM', () => {
    it('returns a datetime-local string ending at 21:00', () => {
      expect(getNext9PM()).toMatch(/^\d{4}-\d{2}-\d{2}T21:00$/);
    });
  });

  describe('combineDateAndTime', () => {
    it('combines a date and a time into a datetime-local string', () => {
      expect(combineDateAndTime('2024-06-01', '18:45')).toBe('2024-06-01T18:45');
    });
  });
});
