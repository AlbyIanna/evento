/**
 * Link-preview support for messenger crawlers: bot detection and an
 * envelope-only OG card. Imported by a Netlify Edge Function, so it must
 * run on Deno — no Node builtins, only Intl and standard JS.
 *
 * Anti-abuse (docs/architecture-decentralized.md, D8): the preview renders
 * the envelope only (title, date/time, location), never the description.
 */

import { normalizeEventData } from './eventFormat.js';

// Over-matching is acceptable by design: the bot page shows the same info
// as the SPA, while under-matching loses previews.
const BOT_PATTERN = new RegExp(
  [
    'bot',
    'facebookexternalhit',
    'whatsapp',
    'telegrambot',
    'twitterbot',
    'slackbot(-linkexpanding)?',
    'discordbot',
    'linkedinbot',
    'skypeuripreview',
    'pinterest',
    'redditbot',
    'viber',
    'snapchat',
    'mastodon',
    'pleroma',
    'misskey',
    'matrix',
    'signal',
    'preview',
    'crawler',
    'spider',
    'curl',
    'wget'
  ].join('|'),
  'i'
);

export function isPreviewBot(userAgent) {
  return typeof userAgent === 'string' && BOT_PATTERN.test(userAgent);
}

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// Formats the wall-clock digits of event.start via a fixed UTC formatter,
// so the output is identical whatever timezone the server runs in.
function formatWhen(event) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(event.start);
  if (!match) {
    return event.start;
  }
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(date);
  return event.tz ? `${formatted} (${event.tz})` : formatted;
}

/**
 * Renders the complete HTML document served to link-preview crawlers.
 * `url` is the canonical event URL the card should point back to.
 */
export function buildPreviewHtml(eventLike, url) {
  const event = normalizeEventData(eventLike);
  const title = (event.status === 'cancelled' ? 'CANCELLED: ' : '') + event.title;
  const when = formatWhen(event);
  const ogDescription = `📅 ${when}` + (event.location ? ` · 📍 ${event.location}` : '');

  const safeTitle = escapeHtml(title);
  const safeWhen = escapeHtml(when);
  const safeLocation = escapeHtml(event.location);
  const safeDescription = escapeHtml(ogDescription);
  const safeUrl = escapeHtml(url);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeUrl}">
<meta property="og:site_name" content="Evento">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
</head>
<body>
<h1>${safeTitle}</h1>
<p>📅 ${safeWhen}</p>
${event.location ? `<p>📍 ${safeLocation}</p>\n` : ''}<p><a href="${safeUrl}">Open this event in Evento</a></p>
<footer><p>User-provided content shared via Evento</p></footer>
</body>
</html>`;
}
