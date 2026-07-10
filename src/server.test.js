import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildServer } from './server.js';
import { encodeEventData } from './shared/eventFormat.js';

const SPA_MARKER = '<!doctype html><title>Evento SPA</title>';
const BOT_UA = 'WhatsApp/2.23.20.0';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';

const payload = encodeEventData({
  title: 'Cena da Marco',
  start: '2026-09-18T20:30',
  tz: 'Europe/Rome',
  location: 'Via Roma 1, Milano',
  description: 'Porta qualcosa da bere'
});

let root;
let app;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'evento-dist-'));
  writeFileSync(join(root, 'index.html'), SPA_MARKER);
  app = buildServer({ root });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(root, { recursive: true, force: true });
});

describe('server wiring', () => {
  it('never logs per-request data (zero-data policy)', () => {
    expect(app.initialConfig.disableRequestLogging).toBe(true);
    expect(app.log.level).toBe('warn');
  });

  it('serves /ics/<payload> as a calendar file', async () => {
    const res = await app.inject({ url: `/ics/${payload}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="evento.ics"');
    expect(res.body).toContain('BEGIN:VCALENDAR');
    expect(res.body).toContain('SUMMARY:Cena da Marco');
  });

  it('rejects undecodable /ics payloads with 400, like the Netlify function', async () => {
    const res = await app.inject({ url: '/ics/not-a-real-payload' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts payloads up to the format limit and rejects longer ones', async () => {
    const atLimit = await app.inject({ url: `/ics/${'A'.repeat(4096)}` });
    expect(atLimit.statusCode).toBe(400);
    const overLimit = await app.inject({ url: `/ics/${'A'.repeat(4097)}` });
    expect(overLimit.statusCode).toBe(404);
  });

  it('serves the OG preview card to link-preview bots', async () => {
    const res = await app.inject({
      url: `/event/${payload}`,
      headers: { 'user-agent': BOT_UA, host: 'evento.example' }
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.headers.vary).toContain('User-Agent');
    expect(res.body).toContain('<meta name="robots" content="noindex">');
    expect(res.body).toContain('<meta property="og:title" content="Cena da Marco">');
    expect(res.body).toContain(`content="http://evento.example/event/${payload}"`);
  });

  it('serves the SPA to human user agents on event URLs', async () => {
    const res = await app.inject({
      url: `/event/${payload}`,
      headers: { 'user-agent': BROWSER_UA }
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(SPA_MARKER);
  });

  it('falls back to the SPA when a bot requests an undecodable payload', async () => {
    const res = await app.inject({
      url: '/event/not-a-real-payload',
      headers: { 'user-agent': BOT_UA }
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(SPA_MARKER);
  });

  it('serves the SPA at /event for fragment-carried events', async () => {
    const res = await app.inject({ url: '/event', headers: { 'user-agent': BROWSER_UA } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(SPA_MARKER);
  });

  it('answers /health', async () => {
    const res = await app.inject({ url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('sends a same-origin CSP without unsafe-inline scripts', async () => {
    const res = await app.inject({ url: '/health' });
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
