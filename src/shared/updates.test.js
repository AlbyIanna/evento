import { describe, it, expect } from 'vitest';
import {
  UPDATE_KIND,
  PAYLOAD_TAG,
  buildUpdateTemplate,
  extractEncodedPayload,
  pickLatest
} from './updates.js';
import { encodeEventData } from './eventFormat.js';

const updates = {
  pk: 'a'.repeat(64),
  d: 'evento-test'
};

const fullEvent = {
  v: 2,
  title: 'Cena da Marco',
  start: '2026-09-18T20:30',
  end: '2026-09-18T23:00',
  tz: 'Europe/Rome',
  location: 'Via Roma 1, Milano',
  description: 'Porta qualcosa da bere',
  status: 'cancelled',
  updates
};

const minimalEvent = {
  v: 2,
  title: 'Standup',
  start: '2026-09-18T20:30',
  end: null,
  tz: null,
  location: '',
  description: '',
  status: 'confirmed',
  updates
};

const createdAt = 1780000000;

describe('buildUpdateTemplate', () => {
  it('lays out all tags in order for a full event', () => {
    const encoded = encodeEventData(fullEvent);
    const template = buildUpdateTemplate(fullEvent, encoded, createdAt);
    expect(template.kind).toBe(UPDATE_KIND);
    expect(template.created_at).toBe(createdAt);
    // Cancelled: title and content carry the cancellation too, so foreign
    // NIP-52 clients that ignore the status tag still show it.
    expect(template.content).toBe('[CANCELLED]\nPorta qualcosa da bere');
    expect(template.tags).toEqual([
      ['d', 'evento-test'],
      [PAYLOAD_TAG, encoded],
      ['title', 'CANCELLED: Cena da Marco'],
      // 20:30 Rome summer time = 18:30Z
      ['start', String(Date.UTC(2026, 8, 18, 18, 30) / 1000)],
      // 23:00 Rome = 21:00Z
      ['end', String(Date.UTC(2026, 8, 18, 21, 0) / 1000)],
      ['start_tzid', 'Europe/Rome'],
      ['location', 'Via Roma 1, Milano'],
      ['status', 'cancelled']
    ]);
  });

  it('leaves title and content untouched for a non-cancelled event', () => {
    const template = buildUpdateTemplate({ ...fullEvent, status: 'confirmed' }, 'abc', createdAt);
    expect(template.content).toBe('Porta qualcosa da bere');
    expect(template.tags).toContainEqual(['title', 'Cena da Marco']);
    expect(template.tags.find(t => t[0] === 'status')).toBeUndefined();
  });

  it('omits optional tags for a minimal event', () => {
    const template = buildUpdateTemplate(minimalEvent, 'abc123', createdAt);
    expect(template.content).toBe('');
    expect(template.tags).toEqual([
      ['d', 'evento-test'],
      [PAYLOAD_TAG, 'abc123'],
      ['title', 'Standup'],
      // No zone: wall clock read as UTC.
      ['start', String(Date.UTC(2026, 8, 18, 20, 30) / 1000)]
    ]);
  });

  it('converts start through the zone when tz is set', () => {
    const winter = { ...fullEvent, start: '2026-12-31T20:30', end: null };
    const template = buildUpdateTemplate(winter, 'abc123', createdAt);
    // Rome winter time is UTC+1.
    expect(template.tags[3]).toEqual(['start', String(Date.UTC(2026, 11, 31, 19, 30) / 1000)]);
  });

  it('throws when the event has no updates pointer', () => {
    expect(() =>
      buildUpdateTemplate({ ...minimalEvent, updates: null }, 'abc', createdAt)
    ).toThrow();
  });
});

describe('extractEncodedPayload', () => {
  const encoded = encodeEventData(fullEvent);

  function makeNostrEvent(overrides = {}, tags) {
    return {
      kind: UPDATE_KIND,
      pubkey: updates.pk,
      created_at: createdAt,
      id: 'f'.repeat(64),
      content: '',
      tags: tags || [
        ['d', updates.d],
        [PAYLOAD_TAG, encoded]
      ],
      ...overrides
    };
  }

  it('returns the payload of a matching event', () => {
    expect(extractEncodedPayload(makeNostrEvent(), updates)).toBe(encoded);
  });

  it('rejects a wrong kind', () => {
    expect(extractEncodedPayload(makeNostrEvent({ kind: 1 }), updates)).toBeNull();
  });

  it('rejects a wrong pubkey', () => {
    expect(extractEncodedPayload(makeNostrEvent({ pubkey: 'b'.repeat(64) }), updates)).toBeNull();
  });

  it('rejects a wrong d tag', () => {
    const event = makeNostrEvent({}, [
      ['d', 'someone-else'],
      [PAYLOAD_TAG, encoded]
    ]);
    expect(extractEncodedPayload(event, updates)).toBeNull();
  });

  it('rejects a missing payload tag', () => {
    const event = makeNostrEvent({}, [['d', updates.d]]);
    expect(extractEncodedPayload(event, updates)).toBeNull();
  });

  it('rejects a payload with characters outside the encoded alphabet', () => {
    const event = makeNostrEvent({}, [
      ['d', updates.d],
      [PAYLOAD_TAG, 'not base64url!!']
    ]);
    expect(extractEncodedPayload(event, updates)).toBeNull();
  });

  it('never throws on junk input', () => {
    expect(extractEncodedPayload(null, updates)).toBeNull();
    expect(extractEncodedPayload({ kind: UPDATE_KIND, pubkey: updates.pk }, updates)).toBeNull();
    expect(extractEncodedPayload(makeNostrEvent({ tags: 'junk' }), updates)).toBeNull();
  });
});

describe('pickLatest', () => {
  it('returns null for empty input', () => {
    expect(pickLatest([])).toBeNull();
  });

  it('picks the highest created_at', () => {
    const a = { id: 'aaa', created_at: 100 };
    const b = { id: 'bbb', created_at: 300 };
    const c = { id: 'ccc', created_at: 200 };
    expect(pickLatest([a, b, c])).toBe(b);
  });

  it('breaks created_at ties with the lexicographically smallest id', () => {
    const a = { id: 'bbb', created_at: 300 };
    const b = { id: 'aaa', created_at: 300 };
    const c = { id: 'ccc', created_at: 300 };
    expect(pickLatest([a, b, c])).toBe(b);
    expect(pickLatest([c, a, b])).toBe(b);
  });
});
