import { decodeEventData } from '../../src/shared/eventFormat.js';
import { isPreviewBot, buildPreviewHtml } from '../../src/shared/preview.js';
import { isDeniedPayload } from '../../src/shared/denylist.js';

// Serve OG preview HTML to messenger/link-preview bots only. Humans fall
// through to the SPA. Not cloaking: the bot page shows the same visible info.
export default async (request, context) => {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/event\/([A-Za-z0-9+_-]+)$/);
  if (!match || !isPreviewBot(request.headers.get('user-agent'))) {
    return context.next();
  }

  const payload = match[1];
  if (isDeniedPayload(payload)) {
    return context.next();
  }
  let event;
  try {
    event = decodeEventData(payload);
  } catch {
    return context.next();
  }

  return new Response(buildPreviewHtml(event, url.origin + '/event/' + payload), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Response varies by UA (bots vs humans) — shared caches must not mix them
      'cache-control': 'public, max-age=3600',
      vary: 'User-Agent',
      'x-content-type-options': 'nosniff'
    }
  });
};

export const config = { path: '/event/*' };
