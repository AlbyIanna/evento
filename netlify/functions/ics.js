import { withErrorHandler, ErrorTypes } from './utils/errorHandler.js';
import { decodeEventData } from '../../src/shared/eventFormat.js';
import { buildIcs } from '../../src/shared/ics.js';
import { isDeniedPayload } from '../../src/shared/denylist.js';

const icsHandler = async event => {
  const segments = event.path.split('/').filter(Boolean);
  const encoded = segments[segments.length - 1];

  if (isDeniedPayload(encoded)) {
    throw ErrorTypes.NOT_FOUND();
  }

  let decoded;
  try {
    decoded = decodeEventData(encoded);
  } catch {
    throw ErrorTypes.VALIDATION_ERROR('Invalid event payload');
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="evento.ics"',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    },
    body: buildIcs(decoded)
  };
};

export const handler = withErrorHandler(icsHandler);
