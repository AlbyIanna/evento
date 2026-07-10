import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import { encodeEventData } from '../../../shared/eventFormat.js';
import { buildUpdateTemplate } from '../../../shared/updates.js';
import {
  DEFAULT_RELAYS,
  getRelays,
  generateUpdateChannel,
  hasSecretKey,
  ownsChannel,
  markPendingPublish,
  consumePendingPublish,
  peekPendingPublish,
  clearPendingPublish,
  publishCurrentVersion,
  fetchLatestUpdate
} from './updatesService.js';

// Scriptable stand-in for the browser WebSocket: captures frames sent by
// the service and lets tests push relay frames back in. No real network.
class FakeWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 0;
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    if (this.readyState === 3) {
      return;
    }
    this.readyState = 3;
    if (this.onclose) {
      this.onclose({});
    }
  }

  // --- test drivers ---
  open() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen({});
    }
  }

  message(frame) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(frame) });
    }
  }

  fail() {
    if (this.onerror) {
      this.onerror({});
    }
    this.close();
  }
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function flipHexChar(hex) {
  return (hex[0] === '0' ? '1' : '0') + hex.slice(1);
}

function makeChannel() {
  const sk = generateSecretKey();
  return { sk, pk: getPublicKey(sk), d: 'a1b2c3d4e5f6' };
}

function makeEvent(channel, overrides = {}) {
  return {
    v: 2,
    title: 'Aperitivo in piazza',
    start: '2026-09-18T19:30',
    end: null,
    tz: 'Europe/Rome',
    location: 'Piazza Grande',
    description: '',
    status: 'confirmed',
    updates: { pk: channel.pk, d: channel.d },
    ...overrides
  };
}

// Produces the encoded payload and a properly signed Nostr event for one
// version of an event, exactly as the publish path would.
function signVersion(channel, event, createdAt) {
  const encoded = encodeEventData(event);
  const signed = finalizeEvent(buildUpdateTemplate(event, encoded, createdAt), channel.sk);
  return { encoded, signed };
}

function eoseAll(sockets, except = []) {
  for (const socket of sockets) {
    if (except.includes(socket)) {
      continue;
    }
    socket.open();
    socket.message(['EOSE', socket.sent[0][1]]);
  }
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('getRelays', () => {
  it('returns the default relays when no override is stored', () => {
    expect(getRelays()).toEqual(DEFAULT_RELAYS);
  });

  it('returns the localStorage override when it is a valid JSON array', () => {
    localStorage.setItem('evento.relays', JSON.stringify(['wss://relay.example']));
    expect(getRelays()).toEqual(['wss://relay.example']);
  });

  it.each([
    ['invalid JSON', 'not-json'],
    ['a non-array', '{"a":1}'],
    ['an empty array', '[]'],
    ['an array with non-strings', '["wss://ok",42]']
  ])('falls back to the defaults on %s', (_label, stored) => {
    localStorage.setItem('evento.relays', stored);
    expect(getRelays()).toEqual(DEFAULT_RELAYS);
  });
});

describe('generateUpdateChannel / hasSecretKey / ownsChannel', () => {
  it('creates a keypair, a 12-hex d and stores the secret bound to the channel', () => {
    const { pk, d } = generateUpdateChannel();
    expect(pk).toMatch(/^[0-9a-f]{64}$/);
    expect(d).toMatch(/^[0-9a-f]{12}$/);
    const record = JSON.parse(localStorage.getItem('evento.sk.' + pk));
    expect(record.sk).toMatch(/^[0-9a-f]{64}$/);
    expect(record.d).toBe(d);
    expect(getPublicKey(hexToBytes(record.sk))).toBe(pk);
    expect(hasSecretKey(pk)).toBe(true);
    expect(ownsChannel({ pk, d })).toBe(true);
  });

  it('reports false for unknown or malformed secrets', () => {
    expect(hasSecretKey('f'.repeat(64))).toBe(false);
    localStorage.setItem('evento.sk.' + 'a'.repeat(64), 'not-a-secret');
    expect(hasSecretKey('a'.repeat(64))).toBe(false);
  });

  it('only authorizes a channel whose exact pk AND d this browser minted', () => {
    const { pk, d } = generateUpdateChannel();
    // Right pk, wrong d: a crafted payload reusing the pubkey with a
    // different addressable id must NOT be signable.
    expect(ownsChannel({ pk, d: 'ffffffffffff' })).toBe(false);
    // Unknown pk.
    expect(ownsChannel({ pk: 'a'.repeat(64), d })).toBe(false);
    expect(ownsChannel(null)).toBe(false);
    expect(ownsChannel({ pk, d })).toBe(true);
  });
});

describe('publish gate peek/clear', () => {
  it('peeks without disarming and clears only on demand', () => {
    expect(peekPendingPublish('abc')).toBe(false);
    markPendingPublish('abc');
    expect(peekPendingPublish('other')).toBe(false);
    expect(peekPendingPublish('abc')).toBe(true);
    // Peeking again still reports true — a failed publish stays armed
    expect(peekPendingPublish('abc')).toBe(true);
    clearPendingPublish();
    expect(peekPendingPublish('abc')).toBe(false);
  });
});

describe('pendingPublish handshake', () => {
  it('consumes exactly once and only for the strictly equal payload', () => {
    expect(consumePendingPublish('abc')).toBe(false);
    markPendingPublish('abc');
    expect(consumePendingPublish('other')).toBe(false);
    expect(consumePendingPublish('abc')).toBe(true);
    expect(consumePendingPublish('abc')).toBe(false);
  });
});

describe('publishCurrentVersion', () => {
  it('is a no-op without an updates pointer', async () => {
    const channel = makeChannel();
    const event = makeEvent(channel, { updates: null });
    await expect(publishCurrentVersion(event, 'whatever')).resolves.toBe(false);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('is a no-op without the channel secret in localStorage', async () => {
    const channel = makeChannel();
    const event = makeEvent(channel);
    await expect(publishCurrentVersion(event, encodeEventData(event))).resolves.toBe(false);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('signs, publishes to every relay in parallel and resolves true on the first OK', async () => {
    const { pk, d } = generateUpdateChannel();
    const event = makeEvent({ pk, d });
    const encoded = encodeEventData(event);
    const promise = publishCurrentVersion(event, encoded);

    const sockets = FakeWebSocket.instances;
    expect(sockets.map(socket => socket.url)).toEqual(DEFAULT_RELAYS);

    sockets[0].open();
    const [type, signed] = sockets[0].sent[0];
    expect(type).toBe('EVENT');
    expect(signed.kind).toBe(31923);
    expect(signed.pubkey).toBe(pk);
    expect(signed.tags).toContainEqual(['d', d]);
    expect(signed.tags).toContainEqual(['evento', encoded]);
    expect(signed.tags).toContainEqual(['start_tzid', 'Europe/Rome']);
    expect(verifyEvent(signed)).toBe(true);

    sockets[0].message(['OK', signed.id, true, '']);
    await expect(promise).resolves.toBe(true);
    expect(sockets.every(socket => socket.readyState === 3)).toBe(true);
  });

  it('uses the relay override from localStorage', async () => {
    const { pk, d } = generateUpdateChannel();
    localStorage.setItem('evento.relays', JSON.stringify(['wss://self.hosted']));
    const event = makeEvent({ pk, d });
    const promise = publishCurrentVersion(event, encodeEventData(event));
    expect(FakeWebSocket.instances.map(socket => socket.url)).toEqual(['wss://self.hosted']);
    FakeWebSocket.instances[0].fail();
    await expect(promise).resolves.toBe(false);
  });

  it('ignores OK for other ids and OK=false, resolving true only on a real ack', async () => {
    const { pk, d } = generateUpdateChannel();
    const event = makeEvent({ pk, d });
    const promise = publishCurrentVersion(event, encodeEventData(event));
    const sockets = FakeWebSocket.instances;
    sockets[0].open();
    sockets[1].open();
    const id = sockets[0].sent[0][1].id;
    sockets[0].message(['OK', 'f'.repeat(64), true, '']);
    sockets[0].message(['OK', id, false, 'blocked: nope']);
    sockets[1].message(['OK', id, true, '']);
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false when relays stay silent past the timeout', async () => {
    vi.useFakeTimers();
    const { pk, d } = generateUpdateChannel();
    const event = makeEvent({ pk, d });
    const promise = publishCurrentVersion(event, encodeEventData(event));
    FakeWebSocket.instances.forEach(socket => socket.open());
    vi.advanceTimersByTime(5000);
    await expect(promise).resolves.toBe(false);
  });

  it('resolves false when every socket fails, without waiting for the timeout', async () => {
    const { pk, d } = generateUpdateChannel();
    const event = makeEvent({ pk, d });
    const promise = publishCurrentVersion(event, encodeEventData(event));
    FakeWebSocket.instances.forEach(socket => socket.fail());
    await expect(promise).resolves.toBe(false);
  });
});

describe('fetchLatestUpdate', () => {
  it('returns null for a malformed updates pointer without opening sockets', async () => {
    await expect(fetchLatestUpdate(null)).resolves.toBeNull();
    await expect(fetchLatestUpdate({ pk: 'x' })).resolves.toBeNull();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('sends the addressable filter and returns the newest verified version', async () => {
    const channel = makeChannel();
    const v1 = signVersion(channel, makeEvent(channel), 1000);
    const v2 = signVersion(
      channel,
      makeEvent(channel, { title: 'Aperitivo (spostato!)', start: '2026-09-19T21:00' }),
      2000
    );

    const promise = fetchLatestUpdate({ pk: channel.pk, d: channel.d });
    const sockets = FakeWebSocket.instances;
    expect(sockets).toHaveLength(DEFAULT_RELAYS.length);

    sockets[0].open();
    const [reqType, subId, filter] = sockets[0].sent[0];
    expect(reqType).toBe('REQ');
    expect(filter).toEqual({
      kinds: [31923],
      authors: [channel.pk],
      '#d': [channel.d],
      limit: 1
    });

    // A slow relay still holds v1; a fresh one already has v2.
    sockets[0].message(['EVENT', subId, v1.signed]);
    sockets[0].message(['EOSE', subId]);
    sockets[1].open();
    sockets[1].message(['EVENT', sockets[1].sent[0][1], v2.signed]);
    eoseAll(sockets, [sockets[0], sockets[1]]);
    sockets[1].message(['EOSE', sockets[1].sent[0][1]]);

    const result = await promise;
    expect(result).not.toBeNull();
    expect(result.createdAt).toBe(2000);
    expect(result.encoded).toBe(v2.encoded);
    expect(result.event.title).toBe('Aperitivo (spostato!)');
    expect(result.event.start).toBe('2026-09-19T21:00');
    expect(sockets.every(socket => socket.readyState === 3)).toBe(true);
  });

  it('ignores forged, off-channel and re-pointed candidates however new they claim to be', async () => {
    const channel = makeChannel();
    const valid = signVersion(channel, makeEvent(channel), 1000);

    const forged = signVersion(channel, makeEvent(channel, { title: 'Forged' }), 5000);
    forged.signed = { ...forged.signed, sig: flipHexChar(forged.signed.sig) };

    // Correctly signed but addressed to another d: must not leak across channels.
    const otherD = signVersion(
      { ...channel, d: 'ffffffffffff' },
      makeEvent({ pk: channel.pk, d: 'ffffffffffff' }, { title: 'Other channel' }),
      6000
    );

    // Correctly signed on our channel (author and d tag match), but the
    // payload re-points `updates` to a different key: a takeover attempt.
    const strangerPk = getPublicKey(generateSecretKey());
    const repointed = signVersion(
      channel,
      makeEvent({ pk: strangerPk, d: channel.d }, { title: 'Repointed' }),
      7000
    );

    const promise = fetchLatestUpdate({ pk: channel.pk, d: channel.d });
    const sockets = FakeWebSocket.instances;
    sockets[0].open();
    const subId = sockets[0].sent[0][1];
    for (const candidate of [forged.signed, otherD.signed, repointed.signed, valid.signed]) {
      sockets[0].message(['EVENT', subId, candidate]);
    }
    sockets[0].message(['EOSE', subId]);
    eoseAll(sockets, [sockets[0]]);

    const result = await promise;
    expect(result).not.toBeNull();
    expect(result.createdAt).toBe(1000);
    expect(result.encoded).toBe(valid.encoded);
    expect(result.event.title).toBe('Aperitivo in piazza');
  });

  it('returns null when every relay answers EOSE with no events', async () => {
    const channel = makeChannel();
    const promise = fetchLatestUpdate({ pk: channel.pk, d: channel.d });
    eoseAll(FakeWebSocket.instances);
    await expect(promise).resolves.toBeNull();
  });

  it('returns null on relay silence after the timeout, never rejecting', async () => {
    vi.useFakeTimers();
    const channel = makeChannel();
    const promise = fetchLatestUpdate({ pk: channel.pk, d: channel.d });
    FakeWebSocket.instances.forEach(socket => socket.open());
    vi.advanceTimersByTime(4000);
    await expect(promise).resolves.toBeNull();
    expect(FakeWebSocket.instances.every(socket => socket.readyState === 3)).toBe(true);
  });

  it('returns null when relays are unreachable', async () => {
    const channel = makeChannel();
    const promise = fetchLatestUpdate({ pk: channel.pk, d: channel.d });
    FakeWebSocket.instances.forEach(socket => socket.fail());
    await expect(promise).resolves.toBeNull();
  });
});
