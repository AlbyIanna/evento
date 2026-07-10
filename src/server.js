/**
 * Self-hostable Evento instance. Serves the built SPA from dist/ plus the
 * same stateless projections as the Netlify deployment: /ics/<payload>
 * (netlify/functions/ics.js) and envelope-only Open Graph cards for
 * link-preview bots (netlify/edge-functions/preview.js).
 *
 * Zero-data policy: per-request logging is disabled and the remaining
 * error logs never include the URL — path-carried event payloads must not
 * end up in logs.
 */

import Fastify from 'fastify';
import { readFile } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import fastifyCompress from '@fastify/compress';
import { decodeEventData, MAX_ENCODED_LENGTH } from './shared/eventFormat.js';
import { buildIcs } from './shared/ics.js';
import { isPreviewBot, buildPreviewHtml } from './shared/preview.js';
import { isDeniedPayload } from './shared/denylist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function buildServer({ root = join(__dirname, '../dist') } = {}) {
  const fastify = Fastify({
    disableRequestLogging: true,
    logger: {
      level: 'warn',
      // Belt and braces: if a request object ever reaches the logger,
      // reduce it to its method so the URL cannot leak.
      serializers: { req: request => ({ method: request.method }) }
    },
    // Route params carry event payloads; the router must accept anything
    // the format allows (the default cap is 100 characters).
    maxParamLength: MAX_ENCODED_LENGTH,
    trustProxy: true
  });

  fastify.register(fastifyCompress, { encodings: ['gzip', 'deflate', 'br'] });

  // Mirrors the CSP the build stamps into index.html (viteCustomPlugins).
  // No CORS layer: the service exposes no cross-origin API, so the browser
  // default (same-origin) is exactly the policy we want.
  fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        connectSrc: ["'self'", 'wss:'],
        // Helmet's default would upgrade same-origin asset requests to
        // https: even on http-served pages, breaking plain-HTTP
        // self-hosting (npm start with no TLS in front).
        upgradeInsecureRequests: null
      }
    }
  });

  fastify.register(fastifyStatic, {
    root,
    setHeaders(res, filePath) {
      // Build assets carry a content hash in their name; everything else
      // (index.html above all) must revalidate.
      if (/[\\/]assets[\\/]/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  });

  let indexHtml;
  const serveApp = async reply => {
    indexHtml ??= await readFile(join(root, 'index.html'), 'utf8');
    return reply.type('text/html; charset=utf-8').send(indexHtml);
  };

  // Path-carried events: link-preview bots get the envelope-only OG card,
  // exactly like the Netlify edge function; humans (and undecodable or
  // denylisted payloads) fall through to the SPA.
  fastify.get('/event/:payload?', async (request, reply) => {
    const { payload } = request.params;
    if (payload && isPreviewBot(request.headers['user-agent']) && !isDeniedPayload(payload)) {
      try {
        const event = decodeEventData(payload);
        const url = `${request.protocol}://${request.host}/event/${payload}`;
        return reply
          .headers({
            'content-type': 'text/html; charset=utf-8',
            // Response varies by UA (bots vs humans) — shared caches must
            // not mix them
            'cache-control': 'public, max-age=3600',
            vary: 'User-Agent',
            'x-content-type-options': 'nosniff'
          })
          .send(buildPreviewHtml(event, url));
      } catch {
        // fall through to the SPA
      }
    }
    return serveApp(reply);
  });

  // Same contract as netlify/functions/ics.js: 404 for denylisted
  // payloads, 400 for undecodable ones, text/calendar otherwise.
  fastify.get('/ics/:payload', async (request, reply) => {
    const { payload } = request.params;
    if (isDeniedPayload(payload)) {
      return reply.code(404).send({ error: { message: 'Resource not found', code: 'NOT_FOUND' } });
    }
    let event;
    try {
      event = decodeEventData(payload);
    } catch {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid event payload', code: 'VALIDATION_ERROR' } });
    }
    return reply
      .headers({
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'attachment; filename="evento.ics"',
        'cache-control': 'public, max-age=86400',
        'x-content-type-options': 'nosniff'
      })
      .send(buildIcs(event));
  });

  fastify.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  return fastify;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fastify = buildServer();
  fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' }).catch(err => {
    fastify.log.error(err);
    process.exit(1);
  });
}
