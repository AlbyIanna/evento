import { describe, it, expect } from 'vitest';
import { wallClockToUtc, buildIcs, buildGoogleCalendarUrl } from './ics.js';

const fixedNow = new Date('2026-07-10T12:00:00Z');

const romeEvent = {
  title: 'Cena da Marco',
  start: '2026-09-18T20:30',
  tz: 'Europe/Rome',
  location: 'Via Roma 1, Milano',
  description: 'Porta qualcosa da bere'
};

function getLine(ics, name) {
  const unfolded = ics.replace(/\r\n /g, '');
  const line = unfolded.split('\r\n').find(l => l.startsWith(`${name}:`));
  return line ? line.slice(name.length + 1) : undefined;
}

describe('wallClockToUtc', () => {
  it('converts Rome summer time (CEST, UTC+2)', () => {
    expect(wallClockToUtc('2026-09-18T20:30', 'Europe/Rome').toISOString()).toBe(
      '2026-09-18T18:30:00.000Z'
    );
  });

  it('converts Rome winter time (CET, UTC+1)', () => {
    expect(wallClockToUtc('2026-12-31T20:30', 'Europe/Rome').toISOString()).toBe(
      '2026-12-31T19:30:00.000Z'
    );
  });

  it('converts a zone west of UTC', () => {
    expect(wallClockToUtc('2026-12-31T20:30', 'America/New_York').toISOString()).toBe(
      '2027-01-01T01:30:00.000Z'
    );
  });

  it('handles midnight (guards against Intl hour 24)', () => {
    expect(wallClockToUtc('2026-09-18T00:00', 'Europe/Rome').toISOString()).toBe(
      '2026-09-17T22:00:00.000Z'
    );
  });
});

describe('buildIcs', () => {
  it('emits DTSTART in UTC for a Rome summer event', () => {
    const ics = buildIcs(romeEvent, fixedNow);
    expect(getLine(ics, 'DTSTART')).toBe('20260918T183000Z');
  });

  it('emits the right instant for a Rome winter event (New York acceptance)', () => {
    const ics = buildIcs({ ...romeEvent, start: '2026-12-31T20:30' }, fixedNow);
    // 20:30 in Rome on Dec 31 is 19:30Z, i.e. 14:30 in New York.
    expect(getLine(ics, 'DTSTART')).toBe('20261231T193000Z');
  });

  it('defaults DTEND to 60 minutes after DTSTART', () => {
    const ics = buildIcs(romeEvent, fixedNow);
    expect(getLine(ics, 'DTEND')).toBe('20260918T193000Z');
  });

  it('respects an explicit end', () => {
    const ics = buildIcs({ ...romeEvent, end: '2026-09-18T23:00' }, fixedNow);
    expect(getLine(ics, 'DTEND')).toBe('20260918T210000Z');
  });

  it('uses the fixed now for DTSTAMP', () => {
    const ics = buildIcs(romeEvent, fixedNow);
    expect(getLine(ics, 'DTSTAMP')).toBe('20260710T120000Z');
  });

  it('emits floating times for legacy v1 events (no Z, no TZID)', () => {
    const ics = buildIcs(
      { title: 'Old event', datetime: '2026-09-18T20:30', location: '' },
      fixedNow
    );
    expect(getLine(ics, 'DTSTART')).toBe('20260918T203000');
    expect(getLine(ics, 'DTEND')).toBe('20260918T213000');
    expect(ics).not.toContain('TZID');
  });

  it('rolls a floating default end over midnight', () => {
    const ics = buildIcs(
      { title: 'Late event', datetime: '2026-09-18T23:45', location: '' },
      fixedNow
    );
    expect(getLine(ics, 'DTEND')).toBe('20260919T004500');
  });

  it('throws when there is no usable start', () => {
    expect(() => buildIcs({ title: 'Broken', location: '', tz: 'Europe/Rome' })).toThrow();
  });

  it('escapes special characters in SUMMARY and DESCRIPTION', () => {
    const ics = buildIcs(
      {
        ...romeEvent,
        title: 'Pizza; pasta, e\\vino',
        description: 'Line one\nLine two\r\nLine three'
      },
      fixedNow
    );
    expect(getLine(ics, 'SUMMARY')).toBe('Pizza\\; pasta\\, e\\\\vino');
    expect(getLine(ics, 'DESCRIPTION')).toBe('Line one\\nLine two\\nLine three');
  });

  it('folds long lines at 75 octets without splitting emoji, losslessly', () => {
    const description = 'Festa 🎉🥳 con più cibo è musica 🎶 '.repeat(10).trim();
    const ics = buildIcs({ ...romeEvent, description }, fixedNow);
    const encoder = new TextEncoder();
    for (const physical of ics.split('\r\n')) {
      expect(encoder.encode(physical).length).toBeLessThanOrEqual(75);
    }
    expect(getLine(ics, 'DESCRIPTION')).toBe(description);
  });

  it('marks cancelled events with STATUS:CANCELLED', () => {
    const ics = buildIcs({ ...romeEvent, status: 'cancelled' }, fixedNow);
    expect(getLine(ics, 'STATUS')).toBe('CANCELLED');
  });

  it('marks confirmed events with STATUS:CONFIRMED', () => {
    const ics = buildIcs(romeEvent, fixedNow);
    expect(getLine(ics, 'STATUS')).toBe('CONFIRMED');
  });

  it('emits the same UID for the same payload, distinct for different ones', () => {
    const first = getLine(buildIcs(romeEvent, fixedNow), 'UID');
    const second = getLine(buildIcs({ ...romeEvent }, new Date('2027-01-01T00:00:00Z')), 'UID');
    const other = getLine(buildIcs({ ...romeEvent, title: 'Altra cena' }, fixedNow), 'UID');
    expect(first).toMatch(/^evento-[0-9a-f]+@evento$/);
    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });

  it('omits LOCATION and DESCRIPTION when empty, ends with CRLF', () => {
    const ics = buildIcs({ ...romeEvent, location: '', description: '' }, fixedNow);
    expect(ics).not.toContain('LOCATION');
    expect(ics).not.toContain('DESCRIPTION');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('uses UTC Z dates for zoned events', () => {
    const url = new URL(buildGoogleCalendarUrl(romeEvent));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Cena da Marco');
    expect(url.searchParams.get('dates')).toBe('20260918T183000Z/20260918T193000Z');
    expect(url.searchParams.get('details')).toBe('Porta qualcosa da bere');
    expect(url.searchParams.get('location')).toBe('Via Roma 1, Milano');
  });

  it('uses floating dates for legacy v1 events', () => {
    const url = new URL(
      buildGoogleCalendarUrl({ title: 'Old event', datetime: '2026-09-18T20:30', location: '' })
    );
    expect(url.searchParams.get('dates')).toBe('20260918T203000/20260918T213000');
    expect(url.searchParams.has('details')).toBe(false);
    expect(url.searchParams.has('location')).toBe(false);
  });

  it('prefixes the title when the event is cancelled', () => {
    const url = new URL(buildGoogleCalendarUrl({ ...romeEvent, status: 'cancelled' }));
    expect(url.searchParams.get('text')).toBe('CANCELLED: Cena da Marco');
  });
});
