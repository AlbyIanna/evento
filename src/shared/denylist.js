/**
 * Deployable denylist for abusive payloads (architecture decision D8).
 *
 * Takedown flow: compute payloadHash(<encoded payload from the reported
 * URL>), add the hash to DENIED_PAYLOAD_HASHES, redeploy. Server-side
 * projections (preview card, /ics) stop serving it; client-side rendering
 * is deliberately unaffected — this is configuration state, not user data.
 */

const DENIED_PAYLOAD_HASHES = new Set([
  // 'example0' — payloadHash of a reported encoded payload
]);

export function payloadHash(encoded) {
  let hash = 5381;
  for (let i = 0; i < encoded.length; i++) {
    hash = ((hash * 33) ^ encoded.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function isDeniedPayload(encoded) {
  return typeof encoded === 'string' && DENIED_PAYLOAD_HASHES.has(payloadHash(encoded));
}
