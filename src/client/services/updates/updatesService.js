/**
 * Opt-in update channel over Nostr (docs/architecture-decentralized.md,
 * piano 3). The ONLY module that touches nostr-tools and WebSocket; all
 * relay I/O is best-effort and never rejects, so a link with unreachable
 * relays renders its original payload untouched.
 *
 * The channel secret lives only in this browser's localStorage
 * ('evento.sk.<pk>') — a device-bound capability. Publication is gated
 * by a one-shot sessionStorage handshake (mark on create/edit, consume
 * on the next view), never triggered by ordinary views, so an owner
 * reopening an old link cannot clobber a newer relay version.
 */

import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import {
  UPDATE_KIND,
  buildUpdateTemplate,
  extractEncodedPayload,
  pickLatest
} from '../../../shared/updates.js';
import { decodeEventData } from '../../utils/eventUtils.js';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net'
];

const RELAYS_KEY = 'evento.relays';
const SECRET_KEY_PREFIX = 'evento.sk.';
const PENDING_PUBLISH_KEY = 'evento.pendingPublish';
const PUBLISH_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 4000;
const SECRET_HEX_PATTERN = /^[0-9a-f]{64}$/;

function bytesToHex(bytes) {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Relay list: localStorage['evento.relays'] (JSON array of URLs) when
 * present and valid — the self-hoster override and the e2e test hook —
 * else the public defaults.
 */
export function getRelays() {
  try {
    const raw = localStorage.getItem(RELAYS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(url => typeof url === 'string' && url.length > 0)
      ) {
        return parsed;
      }
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_RELAYS;
}

/**
 * Creates a fresh update channel: keypair plus addressable identifier.
 * The secret is stored under 'evento.sk.<pk>' bound to the exact channel
 * id (d) it was minted for, and never leaves this browser. Returns
 * { pk, d } to embed in the event payload.
 */
export function generateUpdateChannel() {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const dBytes = new Uint8Array(6);
  crypto.getRandomValues(dBytes);
  const d = bytesToHex(dBytes);
  localStorage.setItem(SECRET_KEY_PREFIX + pk, JSON.stringify({ sk: bytesToHex(sk), d }));
  return { pk, d };
}

// Reads the stored secret record for a pubkey, or null. Tolerates a bare
// hex string (older within-session format) by treating its channel id as
// unknown, so it never authorizes a mismatched-d publish.
function readSecretRecord(pk) {
  try {
    const raw = localStorage.getItem(SECRET_KEY_PREFIX + pk);
    if (!raw) {
      return null;
    }
    const record = JSON.parse(raw);
    if (
      record &&
      typeof record.sk === 'string' &&
      SECRET_HEX_PATTERN.test(record.sk) &&
      typeof record.d === 'string' &&
      record.d.length > 0
    ) {
      return record;
    }
  } catch {
    // not JSON or malformed
  }
  return null;
}

export function hasSecretKey(pk) {
  return readSecretRecord(pk) !== null;
}

/**
 * Authorizes signing for a channel. True ONLY when this browser minted the
 * exact channel — both the pubkey AND the addressable id `d` must match the
 * stored record. Possession of a secret for the pubkey is not enough: this
 * blocks a crafted payload that reuses someone's pk with a different d from
 * tricking the browser into signing under that key. (See docs/event-format.md
 * key-custody note.)
 */
export function ownsChannel(updates) {
  if (!updates || typeof updates.pk !== 'string' || typeof updates.d !== 'string') {
    return false;
  }
  const record = readSecretRecord(updates.pk);
  return record !== null && record.d === updates.d;
}

/** Arms the one-shot publish gate right before navigating to the link. */
export function markPendingPublish(encoded) {
  try {
    sessionStorage.setItem(PENDING_PUBLISH_KEY, encoded);
  } catch {
    // storage unavailable: publishing is simply skipped
  }
}

/**
 * Reports the publish gate WITHOUT clearing it: true when the pending value
 * strictly equals the payload now being viewed. The gate is cleared only
 * after a successful publish (clearPendingPublish), so a transient relay
 * failure leaves it armed and reopening the link retries.
 */
export function peekPendingPublish(encoded) {
  try {
    return sessionStorage.getItem(PENDING_PUBLISH_KEY) === encoded;
  } catch {
    return false;
  }
}

/** Disarms the publish gate (call after a confirmed successful publish). */
export function clearPendingPublish() {
  try {
    sessionStorage.removeItem(PENDING_PUBLISH_KEY);
  } catch {
    // storage unavailable
  }
}

/**
 * Disarms and reports the publish gate in one step: true (exactly once)
 * when the pending value strictly equals the payload now being viewed.
 * Retained for callers that do not need retry-on-failure semantics.
 */
export function consumePendingPublish(encoded) {
  if (!peekPendingPublish(encoded)) {
    return false;
  }
  clearPendingPublish();
  return true;
}

function closeQuietly(socket) {
  try {
    socket.close();
  } catch {
    // already closed or never opened
  }
}

// Opens a socket per relay and lets `handle(socket, done)` drive the
// protocol; resolves via `finish` on overall timeout or when every relay
// is done. Every socket error is swallowed; all sockets end up closed.
function withRelays(relays, timeoutMs, handle, onFinish) {
  return new Promise(resolve => {
    const sockets = [];
    let pending = relays.length;
    let settled = false;
    const finish = value => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      sockets.forEach(closeQuietly);
      resolve(value);
    };
    const timer = setTimeout(() => finish(onFinish()), timeoutMs);
    if (pending === 0) {
      finish(onFinish());
      return;
    }
    for (const url of relays) {
      let done = false;
      const markDone = () => {
        if (done) {
          return;
        }
        done = true;
        pending -= 1;
        if (pending <= 0) {
          finish(onFinish());
        }
      };
      let socket;
      try {
        socket = new WebSocket(url);
      } catch {
        markDone();
        continue;
      }
      sockets.push(socket);
      socket.onerror = () => {};
      socket.onclose = markDone;
      handle(socket, markDone, finish);
    }
  });
}

/**
 * Publishes the current (signed) version to every configured relay.
 * Resolves true as soon as one relay acknowledges with OK, false after
 * the overall timeout or when every relay failed. Never rejects. No-op
 * (false) without an updates pointer or without the channel's secret.
 */
export async function publishCurrentVersion(normalizedEvent, encoded) {
  try {
    const updates = normalizedEvent && normalizedEvent.updates;
    if (!updates || !ownsChannel(updates)) {
      return false;
    }
    const secret = hexToBytes(readSecretRecord(updates.pk).sk);
    const template = buildUpdateTemplate(normalizedEvent, encoded, Math.floor(Date.now() / 1000));
    const signed = finalizeEvent(template, secret);
    const frame = JSON.stringify(['EVENT', signed]);
    return await withRelays(
      getRelays(),
      PUBLISH_TIMEOUT_MS,
      (socket, markDone, finish) => {
        socket.onopen = () => {
          try {
            socket.send(frame);
          } catch {
            markDone();
          }
        };
        socket.onmessage = message => {
          try {
            const reply = JSON.parse(message.data);
            if (reply[0] === 'OK' && reply[1] === signed.id) {
              if (reply[2] === true) {
                finish(true);
              } else {
                markDone();
              }
            }
          } catch {
            // ignore malformed relay frames
          }
        };
      },
      () => false
    );
  } catch {
    return false;
  }
}

/**
 * Queries every relay for the newest version on the channel and verifies
 * each candidate client-side (relays are untrusted): valid signature,
 * payload addressed to this exact channel, payload decodable, and the
 * decoded event's own updates pointer equal to {pk, d} — an update may
 * not silently re-point the channel. Returns
 * { event: <normalized>, createdAt, encoded } or null. Never rejects.
 */
export async function fetchLatestUpdate(updates) {
  try {
    if (!updates || typeof updates.pk !== 'string' || typeof updates.d !== 'string') {
      return null;
    }
    const filter = { kinds: [UPDATE_KIND], authors: [updates.pk], '#d': [updates.d], limit: 1 };
    // Bound work against a hostile relay that floods events before EOSE.
    const MAX_CANDIDATES_PER_RELAY = 8;
    const MAX_FRAME_BYTES = 128 * 1024;
    const candidates = [];
    await withRelays(
      getRelays(),
      FETCH_TIMEOUT_MS,
      (socket, markDone) => {
        const subId = 'evento-' + Math.random().toString(36).slice(2, 10);
        let kept = 0;
        socket.onopen = () => {
          try {
            socket.send(JSON.stringify(['REQ', subId, filter]));
          } catch {
            markDone();
          }
        };
        socket.onmessage = message => {
          try {
            if (typeof message.data === 'string' && message.data.length > MAX_FRAME_BYTES) {
              return;
            }
            const frame = JSON.parse(message.data);
            if (frame[0] === 'EVENT' && frame[1] === subId && frame[2]) {
              if (kept >= MAX_CANDIDATES_PER_RELAY) {
                markDone();
                return;
              }
              // Verify BEFORE keeping, so a relay cannot shadow a genuine
              // event by replaying its public id with junk contents, and so
              // only channel-addressed, decodable, non-repointing versions
              // ever compete.
              const signed = frame[2];
              if (!verifyEvent(signed)) {
                return;
              }
              const encoded = extractEncodedPayload(signed, updates);
              if (!encoded) {
                return;
              }
              const decoded = decodeEventData(encoded);
              if (
                !decoded.updates ||
                decoded.updates.pk !== updates.pk ||
                decoded.updates.d !== updates.d
              ) {
                return;
              }
              kept += 1;
              candidates.push({ signed, decoded, encoded });
            } else if (frame[0] === 'EOSE' && frame[1] === subId) {
              try {
                socket.send(JSON.stringify(['CLOSE', subId]));
              } catch {
                // socket is going away regardless
              }
              markDone();
            }
          } catch {
            // ignore malformed relay frames / undecodable candidates
          }
        };
      },
      () => null
    );
    const winner = pickLatest(candidates.map(candidate => candidate.signed));
    if (!winner) {
      return null;
    }
    const match = candidates.find(candidate => candidate.signed === winner);
    return { event: match.decoded, createdAt: winner.created_at, encoded: match.encoded };
  } catch {
    return null;
  }
}
