/**
 * Thin re-export of the shared event format module, kept so existing
 * client imports (and their test mocks) keep working. The single source
 * of truth is src/shared/eventFormat.js — see docs/event-format.md.
 */
export {
  FORMAT_VERSION,
  LIMITS,
  MAX_ENCODED_LENGTH,
  encodeEventData,
  decodeEventData,
  validateEventData,
  normalizeEventData,
  isValidTimeZone,
  isValidEncodedParam
} from '../../shared/eventFormat.js';
