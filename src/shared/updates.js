/**
 * Mapping between Evento events and Nostr update-channel events (NIP-52
 * kind 31923, addressable: relays keep only the newest per
 * kind+pubkey+d). Pure data transformation — no crypto, no network — so
 * it runs anywhere (browser, Node, Deno edge functions).
 *
 * The canonical encoded payload travels in a ['evento', <encoded>] tag and
 * is the single source of truth for viewers; the standard NIP-52 tags are
 * emitted alongside it for interop with other Nostr calendar clients.
 */

import { isValidEncodedParam } from './eventFormat.js';
import { wallClockToUtc } from './ics.js';

export const UPDATE_KIND = 31923;
export const PAYLOAD_TAG = 'evento';

const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

// Unix seconds of a wall-clock time. With a zone, the real instant; without
// one (legacy v1) the digits are read as UTC — an approximation, but legacy
// events have no zone to do better with.
function toUnixSeconds(wall, tz) {
  if (tz) {
    return Math.floor(wallClockToUtc(wall, tz).getTime() / 1000);
  }
  const match = WALL_CLOCK_PATTERN.exec(wall);
  if (match) {
    const [, year, month, day, hour, minute] = match.map(Number);
    return Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 1000);
  }
  const parsed = new Date(wall);
  if (isNaN(parsed.getTime())) {
    throw new Error(`invalid wall-clock time: ${wall}`);
  }
  // Non-ISO legacy strings: read the local components as UTC, keeping the
  // result machine-independent (same rule as the ICS floating export).
  return Math.floor(
    Date.UTC(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      parsed.getHours(),
      parsed.getMinutes(),
      parsed.getSeconds()
    ) / 1000
  );
}

/**
 * Builds an unsigned Nostr event template for a normalized Evento event
 * that carries an `updates` pointer. The caller signs it (finalizeEvent)
 * and publishes; this module never touches keys.
 */
export function buildUpdateTemplate(normalizedEvent, encoded, createdAtSeconds) {
  if (!normalizedEvent.updates) {
    throw new Error('event has no updates pointer');
  }
  const cancelled = normalizedEvent.status === 'cancelled';
  const tags = [
    ['d', normalizedEvent.updates.d],
    [PAYLOAD_TAG, encoded],
    // Prefix the interop title so foreign NIP-52 clients (which ignore our
    // status tag) still show the cancellation; Evento viewers read the
    // encoded payload, not this tag.
    ['title', cancelled ? `CANCELLED: ${normalizedEvent.title}` : normalizedEvent.title],
    ['start', String(toUnixSeconds(normalizedEvent.start, normalizedEvent.tz))]
  ];
  if (normalizedEvent.end) {
    tags.push(['end', String(toUnixSeconds(normalizedEvent.end, normalizedEvent.tz))]);
  }
  if (normalizedEvent.tz) {
    tags.push(['start_tzid', normalizedEvent.tz]);
  }
  if (normalizedEvent.location) {
    tags.push(['location', normalizedEvent.location]);
  }
  if (cancelled) {
    tags.push(['status', 'cancelled']);
  }
  const description = normalizedEvent.description || '';
  return {
    kind: UPDATE_KIND,
    created_at: createdAtSeconds,
    tags,
    content: cancelled ? `[CANCELLED]${description ? '\n' + description : ''}` : description
  };
}

function firstTagValue(tags, name) {
  if (!Array.isArray(tags)) {
    return undefined;
  }
  const tag = tags.find(t => Array.isArray(t) && t[0] === name);
  return tag ? tag[1] : undefined;
}

/**
 * Returns the encoded Evento payload carried by a Nostr event, but only
 * when the event actually addresses the channel described by `updates`
 * (right kind, right author, right `d`) and the payload has a plausible
 * shape. Signature verification is the caller's job; this filter never
 * throws, whatever a relay sends.
 */
export function extractEncodedPayload(nostrEvent, updates) {
  try {
    if (
      !nostrEvent ||
      typeof nostrEvent !== 'object' ||
      nostrEvent.kind !== UPDATE_KIND ||
      !updates ||
      nostrEvent.pubkey !== updates.pk ||
      firstTagValue(nostrEvent.tags, 'd') !== updates.d
    ) {
      return null;
    }
    const encoded = firstTagValue(nostrEvent.tags, PAYLOAD_TAG);
    return isValidEncodedParam(encoded) ? encoded : null;
  } catch {
    return null;
  }
}

/**
 * Picks the winning version among Nostr events: highest created_at,
 * ties broken by lexicographically smallest id (relay convention for
 * replaceable events). Returns null for empty input.
 */
export function pickLatest(nostrEvents) {
  if (!Array.isArray(nostrEvents) || nostrEvents.length === 0) {
    return null;
  }
  return nostrEvents.reduce((best, event) =>
    event.created_at > best.created_at ||
    (event.created_at === best.created_at && event.id < best.id)
      ? event
      : best
  );
}
