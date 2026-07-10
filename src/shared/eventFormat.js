/**
 * Evento event format — single source of truth for encoding, decoding and
 * validating event payloads. Shared by the client (src/client) and the
 * Netlify functions (netlify/functions).
 *
 * Public specification: docs/event-format.md
 *
 * Runtime requirements: btoa/atob and TextEncoder/TextDecoder globals
 * (available in all modern browsers and Node.js >= 18).
 */

export const FORMAT_VERSION = 2;

// Creation-side limits (enforced on encode, not on decode, so that older
// or foreign URLs remain readable).
export const LIMITS = {
  title: 200,
  location: 200,
  description: 2000,
  encoded: 4096
};

export const MAX_ENCODED_LENGTH = LIMITS.encoded;

// Union of the canonical base64url alphabet (A-Z a-z 0-9 - _) and the
// legacy v1 alphabet, which never replaced '+' (A-Z a-z 0-9 + _).
const ENCODED_PARAM_PATTERN = /^[A-Za-z0-9+_-]+$/;

// Wall-clock timestamps use the HTML datetime-local shape, minute precision.
const LOCAL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const STATUSES = ['confirmed', 'cancelled'];

// Reserved pointer to the event's update channel (Nostr replaceable event):
// pk = 64-char lowercase hex public key, d = addressable identifier.
const NOSTR_PUBKEY_PATTERN = /^[0-9a-f]{64}$/;

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || tz.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks the shape of an encoded URL parameter without decoding it.
 * Used by serverless functions to reject junk cheaply.
 */
export function isValidEncodedParam(param) {
  return (
    typeof param === 'string' &&
    param.length > 0 &&
    param.length <= MAX_ENCODED_LENGTH &&
    ENCODED_PARAM_PATTERN.test(param)
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalString(value) {
  return value === undefined || typeof value === 'string';
}

function validateV1(data) {
  // Legacy shape: { title, datetime, location, description? }.
  // Normalized v1 objects carry `start` instead of `datetime`.
  const datetime = data.datetime !== undefined ? data.datetime : data.start;
  if (typeof datetime !== 'string' || isNaN(new Date(datetime).getTime())) {
    return false;
  }
  return typeof data.location === 'string' && isOptionalString(data.description);
}

function validateV2(data) {
  if (typeof data.start !== 'string' || !LOCAL_DATETIME_PATTERN.test(data.start)) {
    return false;
  }
  if (isNaN(new Date(data.start).getTime())) {
    return false;
  }
  if (data.end !== undefined && data.end !== null) {
    if (typeof data.end !== 'string' || !LOCAL_DATETIME_PATTERN.test(data.end)) {
      return false;
    }
    if (data.end <= data.start) {
      return false;
    }
  }
  if (!isValidTimeZone(data.tz)) {
    return false;
  }
  if (typeof data.location !== 'string' || !isOptionalString(data.description)) {
    return false;
  }
  if (data.status !== undefined && !STATUSES.includes(data.status)) {
    return false;
  }
  if (data.updates !== undefined && data.updates !== null) {
    if (
      !isPlainObject(data.updates) ||
      typeof data.updates.pk !== 'string' ||
      !NOSTR_PUBKEY_PATTERN.test(data.updates.pk) ||
      typeof data.updates.d !== 'string' ||
      data.updates.d.length === 0 ||
      data.updates.d.length > 64
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Validates an event object (v1 legacy shape, v2 shape, or a v2 shape
 * without the `v` stamp, as produced by the creation form).
 * Never throws; returns a boolean.
 */
export function validateEventData(data) {
  if (!isPlainObject(data)) {
    return false;
  }
  if (typeof data.title !== 'string' || data.title.trim().length === 0) {
    return false;
  }
  if (data.v === 1 || (data.v === undefined && typeof data.datetime === 'string')) {
    return validateV1(data);
  }
  if (data.v === FORMAT_VERSION || data.v === undefined) {
    return validateV2(data);
  }
  return false;
}

/**
 * Returns the canonical in-memory shape, whatever version was decoded:
 * { v, title, start, end, tz, location, description, status, updates }.
 * v1 events get tz = null ("floating" wall-clock time, the historical
 * semantics) and status = 'confirmed'.
 */
export function normalizeEventData(data) {
  if (data.v === 1 || (data.v === undefined && typeof data.datetime === 'string')) {
    return {
      v: 1,
      title: data.title,
      start: data.datetime !== undefined ? data.datetime : data.start,
      end: null,
      tz: null,
      location: data.location,
      description: typeof data.description === 'string' ? data.description : '',
      status: 'confirmed',
      updates: null
    };
  }
  return {
    v: FORMAT_VERSION,
    title: data.title,
    start: data.start,
    end: data.end || null,
    tz: data.tz,
    location: data.location,
    description: typeof data.description === 'string' ? data.description : '',
    status: data.status || 'confirmed',
    updates: data.updates || null
  };
}

function utf8ToBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBinaryString(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function binaryStringToUtf8(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Encodes an event as a canonical v2 payload (base64url of UTF-8 JSON,
 * no padding). Accepts a v2-shaped object with or without the `v` stamp;
 * throws on anything invalid or over the creation-side limits.
 */
export function encodeEventData(data) {
  try {
    if (!isPlainObject(data)) {
      throw new Error('event data must be an object');
    }
    const payload = {
      v: FORMAT_VERSION,
      title: data.title,
      start: data.start,
      ...(data.end ? { end: data.end } : {}),
      tz: data.tz,
      location: data.location,
      ...(typeof data.description === 'string' && data.description.length > 0
        ? { description: data.description }
        : {}),
      ...(data.status && data.status !== 'confirmed' ? { status: data.status } : {}),
      ...(data.updates ? { updates: data.updates } : {})
    };
    if (!validateEventData(payload)) {
      throw new Error('event data failed validation');
    }
    if (
      payload.title.length > LIMITS.title ||
      payload.location.length > LIMITS.location ||
      (payload.description !== undefined && payload.description.length > LIMITS.description)
    ) {
      throw new Error('event data exceeds field limits');
    }
    const encoded = utf8ToBase64Url(JSON.stringify(payload));
    if (encoded.length > MAX_ENCODED_LENGTH) {
      throw new Error('encoded event exceeds maximum length');
    }
    return encoded;
  } catch (error) {
    throw new Error('Failed to encode event data', { cause: error });
  }
}

/**
 * Decodes an encoded payload (canonical v2 or legacy v1) and returns the
 * normalized event object. Throws on malformed input or invalid events.
 *
 * Legacy v1 payloads were produced as btoa(encodeURIComponent(JSON)) with
 * only '/' replaced by '_': the base64-decoded text is percent-encoded
 * ASCII starting with '%', which cleanly disambiguates it from canonical
 * payloads, whose decoded text is JSON starting with '{'.
 */
export function decodeEventData(encoded) {
  try {
    if (!isValidEncodedParam(encoded)) {
      throw new Error('malformed encoded parameter');
    }
    const binary = base64ToBinaryString(encoded);
    let parsed;
    if (binary.startsWith('%')) {
      parsed = JSON.parse(decodeURIComponent(binary));
    } else {
      parsed = JSON.parse(binaryStringToUtf8(binary));
    }
    if (!validateEventData(parsed)) {
      throw new Error('decoded event failed validation');
    }
    return normalizeEventData(parsed);
  } catch (error) {
    throw new Error('Invalid event data format', { cause: error });
  }
}
