/**
 * ICS (RFC 5545) export and Google Calendar links for Evento events.
 * Shared by the client (src/client) and the Netlify functions.
 *
 * Timezone handling: v2 events carry wall-clock times plus an IANA zone,
 * which are converted to UTC instants here. Legacy v1 events have no zone
 * and export as floating local times (the historical semantics).
 */

import { normalizeEventData } from './eventFormat.js';

const WALL_CLOCK_PREFIX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

// A trailing 'Z' or numeric offset means the string names an absolute
// instant, not a wall-clock time.
const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/;

const DEFAULT_DURATION_MINUTES = 60;

function parseWallClock(wall) {
  const match = WALL_CLOCK_PREFIX.exec(wall);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match.map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}

// Wall-clock millis for any zone-less string: ISO-shaped strings are read
// digit-by-digit; other Date-parseable shapes (e.g. 'September 18, 2026
// 20:30') go through Date, whose local components equal the written wall
// clock on every machine, keeping the floating output machine-independent.
function wallClockMillis(text) {
  const iso = parseWallClock(text);
  if (iso !== null) {
    return iso;
  }
  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return Date.UTC(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    parsed.getHours(),
    parsed.getMinutes(),
    parsed.getSeconds()
  );
}

// Difference (ms) between the wall clock shown in `tz` at `utcMillis`
// and UTC itself, i.e. the zone's UTC offset at that instant.
function timeZoneOffset(tz, utcMillis) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(utcMillis));
  const value = {};
  for (const part of parts) {
    value[part.type] = part.value;
  }
  // Some engines render midnight as hour '24' when hour12 is false.
  const hour = value.hour === '24' ? 0 : Number(value.hour);
  const rendered = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    hour,
    Number(value.minute),
    Number(value.second)
  );
  return rendered - utcMillis;
}

/**
 * Converts a wall-clock time ('YYYY-MM-DDTHH:mm') in an IANA zone to the
 * UTC instant it names. Two passes handle DST: the first guess assumes the
 * offset at the naive UTC reading, the second re-measures at the candidate
 * instant so times near a transition resolve to the offset actually in
 * force.
 */
export function wallClockToUtc(wall, tz) {
  const naive = parseWallClock(wall);
  if (naive === null) {
    throw new Error(`invalid wall-clock time: ${wall}`);
  }
  const offset1 = timeZoneOffset(tz, naive);
  const offset2 = timeZoneOffset(tz, naive - offset1);
  return new Date(naive - offset2);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatUtcStamp(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function formatFloating(wallMillis) {
  const date = new Date(wallMillis);
  return formatUtcStamp(date).slice(0, -1);
}

// Returns DTSTART/DTEND values: UTC '...Z' stamps when the event has a
// zone, floating 'YYYYMMDDTHHMMSS' stamps for legacy zone-less events.
function computeDtRange(event) {
  if (typeof event.start !== 'string' || event.start.length === 0) {
    throw new Error('event has no usable start');
  }
  if (event.tz) {
    const start = wallClockToUtc(event.start, event.tz);
    const end = event.end
      ? wallClockToUtc(event.end, event.tz)
      : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);
    return { start: formatUtcStamp(start), end: formatUtcStamp(end) };
  }
  // Zone-less strings keep the historical floating semantics; strings with
  // an explicit offset name an absolute instant and export as UTC.
  if (!OFFSET_SUFFIX.test(event.start)) {
    const startWall = wallClockMillis(event.start);
    if (startWall !== null) {
      const endWall =
        typeof event.end === 'string' &&
        !OFFSET_SUFFIX.test(event.end) &&
        wallClockMillis(event.end) !== null
          ? wallClockMillis(event.end)
          : startWall + DEFAULT_DURATION_MINUTES * 60000;
      return { start: formatFloating(startWall), end: formatFloating(endWall) };
    }
  }
  const start = new Date(event.start);
  if (isNaN(start.getTime())) {
    throw new Error('event has no usable start');
  }
  const end =
    event.end && !isNaN(new Date(event.end).getTime())
      ? new Date(event.end)
      : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);
  return { start: formatUtcStamp(start), end: formatUtcStamp(end) };
}

function escapeText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function djb2Hex(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

// RFC 5545 line folding at 75 octets. Iterates code points so a multibyte
// UTF-8 sequence (e.g. an emoji) is never split across physical lines.
function foldLine(line) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) {
    return line;
  }
  const physical = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > 75) {
      physical.push(current);
      current = ' ';
      currentBytes = 1;
    }
    current += char;
    currentBytes += charBytes;
  }
  physical.push(current);
  return physical.join('\r\n');
}

/**
 * Builds an RFC 5545 VCALENDAR (single VEVENT) for an event in any
 * supported shape (legacy v1, v2, or already normalized). Events with an
 * `updates` pointer get a UID derived from that stable identity, so an
 * edited-and-reshared event replaces the old calendar entry on re-import;
 * events without one can only hash the payload itself (every edit is a new
 * event as far as calendars can tell).
 */
export function buildIcs(eventLike, now = new Date()) {
  const event = normalizeEventData(eventLike);
  const { start, end } = computeDtRange(event);
  const identity = event.updates ? `${event.updates.pk}/${event.updates.d}` : JSON.stringify(event);
  const uid = `evento-${djb2Hex(identity)}@evento`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Evento//event-format v2//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcStamp(now)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(event.title || '')}`
  ];
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  lines.push(
    `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR'
  );
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Builds a Google Calendar "add event" URL using the same UTC-or-floating
 * time rule as buildIcs.
 */
export function buildGoogleCalendarUrl(eventLike) {
  const event = normalizeEventData(eventLike);
  const { start, end } = computeDtRange(event);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${event.status === 'cancelled' ? 'CANCELLED: ' : ''}${event.title || ''}`,
    dates: `${start}/${end}`
  });
  if (event.description) {
    params.set('details', event.description);
  }
  if (event.location) {
    params.set('location', event.location);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
