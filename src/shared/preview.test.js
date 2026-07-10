import { describe, it, expect } from 'vitest';
import { isPreviewBot, buildPreviewHtml } from './preview.js';

const baseEvent = {
  title: 'Cena da Marco',
  start: '2026-09-18T20:30',
  tz: 'Europe/Rome',
  location: 'Via Roma 1, Milano',
  description: 'Porta qualcosa da bere'
};

const url = 'https://evento.example/#/event?data=abc123';

describe('isPreviewBot', () => {
  it('detects common link-preview crawlers', () => {
    expect(isPreviewBot('WhatsApp/2.23.20.0')).toBe(true);
    expect(isPreviewBot('facebookexternalhit/1.1')).toBe(true);
    expect(isPreviewBot('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isPreviewBot('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe(
      true
    );
    expect(isPreviewBot('curl/8.4.0')).toBe(true);
  });

  it('does not match real browsers or missing user agents', () => {
    expect(
      isPreviewBot(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
    expect(
      isPreviewBot(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
      )
    ).toBe(false);
    expect(
      isPreviewBot('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')
    ).toBe(false);
    expect(isPreviewBot('')).toBe(false);
    expect(isPreviewBot(undefined)).toBe(false);
  });
});

describe('buildPreviewHtml', () => {
  it('renders a complete document with the expected meta tags', () => {
    const html = buildPreviewHtml(baseEvent, url);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Cena da Marco</title>');
    expect(html).toContain('<meta property="og:title" content="Cena da Marco">');
    expect(html).toContain('<meta property="og:site_name" content="Evento">');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
    expect(html).toContain(
      '<meta property="og:url" content="https://evento.example/#/event?data=abc123">'
    );
  });

  it('builds a deterministic when string from the wall-clock start', () => {
    const html = buildPreviewHtml(baseEvent, url);
    expect(html).toContain(
      '<meta property="og:description" content="📅 18 Sept 2026, 20:30 (Europe/Rome) · 📍 Via Roma 1, Milano">'
    );
    expect(html).toContain('<p>📅 18 Sept 2026, 20:30 (Europe/Rome)</p>');
    expect(html).toContain('<p>📍 Via Roma 1, Milano</p>');
  });

  it('omits the timezone suffix and location marker when absent', () => {
    const html = buildPreviewHtml(
      { v: 1, title: 'Old event', datetime: '2026-01-05T09:00', location: '' },
      url
    );
    expect(html).toContain('content="📅 5 Jan 2026, 09:00"');
    expect(html).not.toContain('·');
    expect(html).not.toContain('📍');
  });

  it('escapes every interpolated value', () => {
    const html = buildPreviewHtml(
      {
        ...baseEvent,
        title: '<script>alert(1)</script>',
        location: `"Bar & Grill" 'centro'`
      },
      'https://evento.example/?a=1&b="2"'
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('"Bar & Grill"');
    expect(html).toContain('&quot;Bar &amp; Grill&quot; &#39;centro&#39;');
    expect(html).toContain('https://evento.example/?a=1&amp;b=&quot;2&quot;');
  });

  it('never leaks the event description', () => {
    const html = buildPreviewHtml({ ...baseEvent, description: 'SECRET-PRIVATE-DETAILS' }, url);
    expect(html).not.toContain('SECRET-PRIVATE-DETAILS');
  });

  it('prefixes the title with CANCELLED everywhere when cancelled', () => {
    const html = buildPreviewHtml({ ...baseEvent, status: 'cancelled' }, url);
    expect(html).toContain('<title>CANCELLED: Cena da Marco</title>');
    expect(html).toContain('<meta property="og:title" content="CANCELLED: Cena da Marco">');
    expect(html).toContain('<h1>CANCELLED: Cena da Marco</h1>');
  });

  it('labels the page as user-provided content', () => {
    const html = buildPreviewHtml(baseEvent, url);
    expect(html).toContain('User-provided content shared via Evento');
  });
});
