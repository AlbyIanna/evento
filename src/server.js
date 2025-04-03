import Fastify from 'fastify';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true,
  trustProxy: true // Trust the proxy when running behind a reverse proxy
});

// Enable compression for all responses
fastify.register(fastifyCompress, {
  encodings: ['gzip', 'deflate', 'br'],
  global: true // Apply to all routes
});

// Security middleware
fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrcAttr: ["'unsafe-inline'"] // Allow inline event handlers
    }
  }
});

// CORS configuration
fastify.register(fastifyCors, {
  origin:
    process.env.NODE_ENV === 'production'
      ? ['https://your-domain.com'] // Replace with your domain
      : true,
  methods: ['GET', 'POST']
});

// Custom MIME types
const mimeTypes = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Register static file serving with caching
fastify.register(fastifyStatic, {
  root: join(__dirname, '../dist'),
  prefix: '/',
  decorateReply: false,
  serve: true,
  cacheControl: true,
  maxAge: '7d', // Cache static assets for 7 days
  immutable: true,
  etag: true,
  extensions: ['html', 'css', 'js'], // Try these extensions when none is provided
  setHeaders: (res, path) => {
    // Set correct content type based on file extension
    const ext = path.substring(path.lastIndexOf('.'));
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
});

// Catch-all route to serve index.html for client-side routing
fastify.get('/event/*', async (request, reply) => {
  // Validate the event parameter
  const eventParam = request.params['*'];
  if (!eventParam || eventParam.length > 1000) {
    return reply.code(400).send({ error: 'Invalid event parameter' });
  }

  try {
    // Import fs dynamically
    const fs = await import('fs/promises');
    const path = await import('path');

    // Read the index.html file
    const filePath = path.join(__dirname, '../dist/index.html');
    const content = await fs.readFile(filePath, 'utf8');

    // Send the file with the correct content type
    reply.type('text/html').send(content);
  } catch (err) {
    fastify.log.error('Error serving index.html:', err);
    reply.code(500).send({ error: 'Failed to serve the page' });
  }
});

// Health check route
fastify.get('/health', async (_request, _reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
});

// Error handler
fastify.setErrorHandler(function (error, request, reply) {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message
  });
});

// Run the server
const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
