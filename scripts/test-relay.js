/* eslint-disable no-console */
// Minimal NIP-01 relay for e2e tests. No signature verification (clients verify).
// Usage: node scripts/test-relay.js [port]
import { WebSocketServer } from 'ws';

const port = Number(process.argv[2]) || 8899;

// Stored events. Addressable kinds (30000-39999) are keyed by kind:pubkey:d and replaced.
const events = new Map(); // key -> event (addressable: composite key; others: event id)

function addressableKey(ev) {
  const d = (ev.tags.find(t => t[0] === 'd') || [])[1] || '';
  return `${ev.kind}:${ev.pubkey}:${d}`;
}

function isValidShape(ev) {
  return (
    ev &&
    typeof ev.id === 'string' &&
    typeof ev.pubkey === 'string' &&
    typeof ev.sig === 'string' &&
    typeof ev.content === 'string' &&
    Number.isInteger(ev.kind) &&
    Number.isInteger(ev.created_at) &&
    Array.isArray(ev.tags)
  );
}

function matchesFilter(ev, f) {
  if (f.kinds && !f.kinds.includes(ev.kind)) return false;
  if (f.authors && !f.authors.includes(ev.pubkey)) return false;
  if (f['#d']) {
    const d = (ev.tags.find(t => t[0] === 'd') || [])[1];
    if (!f['#d'].includes(d)) return false;
  }
  if (f.since && ev.created_at < f.since) return false;
  if (f.until && ev.created_at > f.until) return false;
  return true;
}

function matchesAny(ev, filters) {
  return filters.length === 0 || filters.some(f => matchesFilter(ev, f));
}

function storeEvent(ev) {
  if (ev.kind >= 30000 && ev.kind < 40000) {
    const key = addressableKey(ev);
    const prev = events.get(key);
    if (
      prev &&
      (prev.created_at > ev.created_at || (prev.created_at === ev.created_at && prev.id <= ev.id))
    ) {
      return false; // older (or tie lost by higher id): keep existing
    }
    events.set(key, ev);
  } else {
    events.set(ev.id, ev);
  }
  return true;
}

const wss = new WebSocketServer({ port }, () => {
  console.log(`test-relay listening on ws://127.0.0.1:${port}`);
});

wss.on('connection', ws => {
  const subs = new Map(); // subId -> filters

  ws.on('message', raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(msg)) return;
    const [type] = msg;

    if (type === 'EVENT') {
      const ev = msg[1];
      if (!isValidShape(ev)) {
        ws.send(JSON.stringify(['OK', ev && ev.id ? ev.id : '', false, 'invalid: bad shape']));
        return;
      }
      const stored = storeEvent(ev);
      ws.send(JSON.stringify(['OK', ev.id, true, '']));
      if (stored) {
        console.log(
          `stored kind=${ev.kind} pubkey=${ev.pubkey.slice(0, 8)} id=${ev.id.slice(0, 8)} created_at=${ev.created_at}`
        );
        for (const client of wss.clients) {
          if (client.readyState !== 1 || !client.evtSubs) continue;
          for (const [subId, filters] of client.evtSubs) {
            if (matchesAny(ev, filters)) client.send(JSON.stringify(['EVENT', subId, ev]));
          }
        }
      }
    } else if (type === 'REQ') {
      const [, subId, ...filters] = msg;
      if (typeof subId !== 'string') return;
      subs.set(subId, filters);
      let sent = 0;
      const limit = Math.min(...filters.map(f => f.limit ?? Infinity));
      for (const ev of [...events.values()].sort((a, b) => b.created_at - a.created_at)) {
        if (sent >= limit) break;
        if (matchesAny(ev, filters)) {
          ws.send(JSON.stringify(['EVENT', subId, ev]));
          sent++;
        }
      }
      ws.send(JSON.stringify(['EOSE', subId]));
    } else if (type === 'CLOSE') {
      subs.delete(msg[1]);
    }
  });

  ws.evtSubs = subs;
  ws.on('close', () => subs.clear());
});
