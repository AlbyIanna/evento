import { describe, it, expect } from 'vitest';
import {
  FORMAT_VERSION,
  LIMITS,
  encodeEventData,
  decodeEventData,
  validateEventData,
  normalizeEventData,
  isValidTimeZone,
  isValidEncodedParam
} from './eventFormat.js';

// The exact algorithm used by the historical client (src/client/utils/eventUtils.js
// before consolidation): btoa over percent-encoded JSON, '/' replaced, '=' stripped.
function legacyEncode(data) {
  const jsonString = JSON.stringify(data);
  const encoded = encodeURIComponent(jsonString);
  return btoa(encoded).replace(/\//g, '_').replace(/=+$/, '');
}

const validV2 = {
  title: 'Cena da Marco',
  start: '2026-09-18T20:30',
  tz: 'Europe/Rome',
  location: 'Via Roma 1, Milano',
  description: 'Porta qualcosa da bere'
};

describe('event format v2', () => {
  describe('encode/decode round-trip', () => {
    it('round-trips a v2 event to its normalized form', () => {
      const decoded = decodeEventData(encodeEventData(validV2));
      expect(decoded).toEqual({
        v: FORMAT_VERSION,
        title: validV2.title,
        start: validV2.start,
        end: null,
        tz: 'Europe/Rome',
        location: validV2.location,
        description: validV2.description,
        status: 'confirmed',
        updates: null
      });
    });

    it('round-trips optional fields (end, status, updates)', () => {
      const event = {
        ...validV2,
        end: '2026-09-18T23:00',
        status: 'cancelled',
        updates: { pk: 'a'.repeat(64), d: 'cena-marco' }
      };
      const decoded = decodeEventData(encodeEventData(event));
      expect(decoded.end).toBe('2026-09-18T23:00');
      expect(decoded.status).toBe('cancelled');
      expect(decoded.updates).toEqual({ pk: 'a'.repeat(64), d: 'cena-marco' });
    });

    it('round-trips non-ASCII text (UTF-8)', () => {
      const event = {
        ...validV2,
        title: 'Città Ⓔ vento — festa 🎉',
        description: 'Papà porta il ©, io i džem'
      };
      const decoded = decodeEventData(encodeEventData(event));
      expect(decoded.title).toBe(event.title);
      expect(decoded.description).toBe(event.description);
    });

    it('produces URL-safe output (base64url, no padding)', () => {
      const encoded = encodeEventData({ ...validV2, description: '?'.repeat(300) });
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('omits defaults from the payload to keep URLs short', () => {
      const encoded = encodeEventData({ ...validV2, description: '', status: 'confirmed' });
      const json = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
        )
      );
      expect(json).not.toHaveProperty('description');
      expect(json).not.toHaveProperty('status');
      expect(json).not.toHaveProperty('end');
      expect(json).not.toHaveProperty('updates');
    });
  });

  describe('legacy v1 compatibility', () => {
    const legacyEvent = {
      title: 'Cena da Marco & Anna',
      datetime: '2025-12-31T20:30',
      location: 'Via Roma 1, Milano',
      description: 'Porta il © e i džem!'
    };

    it('decodes a hardcoded URL produced by the historical client', () => {
      // legacyEncode(legacyEvent), frozen so the wire format can never drift
      const frozen =
        'JTdCJTIydGl0bGUlMjIlM0ElMjJDZW5hJTIwZGElMjBNYXJjbyUyMCUyNiUyMEFubmElMjIlMkMlMjJkYXRldGltZSUyMiUzQSUyMjIwMjUtMTItMzFUMjAlM0EzMCUyMiUyQyUyMmxvY2F0aW9uJTIyJTNBJTIyVmlhJTIwUm9tYSUyMDElMkMlMjBNaWxhbm8lMjIlMkMlMjJkZXNjcmlwdGlvbiUyMiUzQSUyMlBvcnRhJTIwaWwlMjAlQzIlQTklMjBlJTIwaSUyMGQlQzUlQkVlbSElMjIlN0Q';
      expect(legacyEncode(legacyEvent)).toBe(frozen);
      const decoded = decodeEventData(frozen);
      expect(decoded).toEqual({
        v: 1,
        title: legacyEvent.title,
        start: legacyEvent.datetime,
        end: null,
        tz: null,
        location: legacyEvent.location,
        description: legacyEvent.description,
        status: 'confirmed',
        updates: null
      });
    });

    it('decodes any legacy-encoded payload to normalized v1', () => {
      const decoded = decodeEventData(legacyEncode(legacyEvent));
      expect(decoded.v).toBe(1);
      expect(decoded.start).toBe(legacyEvent.datetime);
      expect(decoded.tz).toBeNull();
    });
  });

  describe('validateEventData', () => {
    it('accepts a valid v1 (legacy) event', () => {
      expect(
        validateEventData({
          title: 'Test Event',
          datetime: '2024-04-05T15:00',
          location: 'Test Location',
          description: 'Test Description'
        })
      ).toBe(true);
    });

    it('accepts v1 edge cases (empty location, extra properties)', () => {
      expect(
        validateEventData({
          title: 'a',
          datetime: new Date().toISOString(),
          location: '',
          description: ''
        })
      ).toBe(true);
      expect(
        validateEventData({
          title: 'Test Event',
          datetime: '2024-04-05T15:00',
          location: 'Test Location',
          extraProp: 'ignored'
        })
      ).toBe(true);
    });

    it('accepts a valid v2 event, with and without the version stamp', () => {
      expect(validateEventData(validV2)).toBe(true);
      expect(validateEventData({ ...validV2, v: 2 })).toBe(true);
    });

    it('rejects malformed input without throwing', () => {
      const invalid = [
        null,
        undefined,
        'not-an-object',
        [],
        {},
        { datetime: '2024-04-05T15:00', location: 'x' }, // missing title
        { title: '', datetime: '2024-04-05T15:00', location: 'x' }, // empty title
        { title: 'x', datetime: 'invalid-date', location: 'x' }, // bad v1 date
        { ...validV2, start: '2026-09-18' }, // date without time
        { ...validV2, start: 'invalid' },
        { ...validV2, tz: undefined },
        { ...validV2, tz: 'Not/AZone' },
        { ...validV2, end: '2026-09-18T20:30' }, // end == start
        { ...validV2, end: '2026-09-18T19:00' }, // end before start
        { ...validV2, status: 'maybe' },
        { ...validV2, updates: { pk: 'short', d: 'x' } },
        { ...validV2, updates: { pk: 'A'.repeat(64), d: 'x' } }, // uppercase hex
        { ...validV2, updates: { pk: 'a'.repeat(64), d: '' } },
        { ...validV2, v: 3 } // unknown version
      ];
      invalid.forEach(event => {
        expect(validateEventData(event)).toBe(false);
        expect(() => validateEventData(event)).not.toThrow();
      });
    });
  });

  describe('encodeEventData errors', () => {
    it('throws on invalid events', () => {
      expect(() => encodeEventData(null)).toThrow();
      expect(() => encodeEventData({})).toThrow();
      expect(() => encodeEventData({ ...validV2, tz: 'Not/AZone' })).toThrow();
    });

    it('enforces creation-side field limits', () => {
      expect(() => encodeEventData({ ...validV2, title: 'x'.repeat(LIMITS.title + 1) })).toThrow();
      expect(() =>
        encodeEventData({ ...validV2, description: 'x'.repeat(LIMITS.description + 1) })
      ).toThrow();
    });
  });

  describe('decodeEventData errors', () => {
    it('throws on malformed input', () => {
      ['invalid-data', '', null, undefined, 'con spazi', '!!!'].forEach(bad => {
        expect(() => decodeEventData(bad)).toThrow();
      });
    });

    it('throws on well-formed base64 that is not a valid event', () => {
      const notAnEvent = btoa(JSON.stringify({ hello: 'world' })).replace(/=+$/, '');
      expect(() => decodeEventData(notAnEvent)).toThrow();
    });
  });

  describe('helpers', () => {
    it('validates IANA timezones', () => {
      expect(isValidTimeZone('Europe/Rome')).toBe(true);
      expect(isValidTimeZone('UTC')).toBe(true);
      expect(isValidTimeZone('Not/AZone')).toBe(false);
      expect(isValidTimeZone('')).toBe(false);
      expect(isValidTimeZone(42)).toBe(false);
    });

    it('validates encoded parameter shape', () => {
      expect(isValidEncodedParam(encodeEventData(validV2))).toBe(true);
      expect(isValidEncodedParam('abc-DEF_123+xyz')).toBe(true); // legacy alphabet
      expect(isValidEncodedParam('has spaces')).toBe(false);
      expect(isValidEncodedParam('')).toBe(false);
      expect(isValidEncodedParam('x'.repeat(5000))).toBe(false);
      expect(isValidEncodedParam(null)).toBe(false);
    });

    it('normalizes v1 events to the canonical shape', () => {
      const normalized = normalizeEventData({
        title: 'T',
        datetime: '2024-04-05T15:00',
        location: 'L'
      });
      expect(normalized).toEqual({
        v: 1,
        title: 'T',
        start: '2024-04-05T15:00',
        end: null,
        tz: null,
        location: 'L',
        description: '',
        status: 'confirmed',
        updates: null
      });
    });
  });
});
