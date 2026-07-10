import { describe, it, expect, afterEach } from 'vitest';
import { t, getLanguage, getDateLocale, translateRoot, LANGUAGE_STORAGE_KEY } from './i18n.js';
import { formatDate, formatTime } from './services/date/dateService.js';

// jsdom defaults navigator.language to 'en-US'; tests override it per case.
function setNavigatorLanguage(tag) {
  Object.defineProperty(window.navigator, 'language', {
    value: tag,
    configurable: true
  });
}

describe('i18n', () => {
  afterEach(() => {
    localStorage.clear();
    setNavigatorLanguage('en-US');
  });

  describe('language selection', () => {
    it('defaults to English in the test environment (en-US navigator)', () => {
      expect(getLanguage()).toBe('en');
    });

    it.each(['it', 'it-IT', 'it-CH'])('selects Italian for navigator.language %s', tag => {
      setNavigatorLanguage(tag);
      expect(getLanguage()).toBe('it');
    });

    it('falls back to English for any non-Italian language', () => {
      setNavigatorLanguage('fr-FR');
      expect(getLanguage()).toBe('en');
      // 'ita' is not an it/it-* BCP 47 tag and must not match.
      setNavigatorLanguage('ita');
      expect(getLanguage()).toBe('en');
    });

    it('honors the localStorage override over the navigator language', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'it');
      expect(getLanguage()).toBe('it');

      setNavigatorLanguage('it-IT');
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
      expect(getLanguage()).toBe('en');
    });

    it('ignores an override for a language it does not have', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
      expect(getLanguage()).toBe('en');
    });
  });

  describe('t', () => {
    it('returns the English string by default', () => {
      expect(t('form.createButton')).toBe('Create Event Link');
    });

    it('returns the Italian string when Italian is active', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'it');
      expect(t('form.createButton')).toBe('Crea link evento');
      expect(t('view.rsvpButton')).toBe("Rispondi all'organizzatore");
    });

    it('replaces {placeholders} from params', () => {
      expect(t('view.publishPartial', { ack: 1, total: 4 })).toBe(
        "Published to 1 of 4 relays — some relays couldn't be reached."
      );
      expect(t('view.shareText', { title: 'Cena', date: '01/02/2026', time: '20:00' })).toBe(
        'Join me at Cena on 01/02/2026 at 20:00'
      );
    });

    it('returns the key itself for unknown keys', () => {
      expect(t('nope.missing')).toBe('nope.missing');
    });
  });

  describe('date localization', () => {
    it('maps the language to a date locale', () => {
      expect(getDateLocale()).toBe('en-US');
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'it');
      expect(getDateLocale()).toBe('it-IT');
    });

    it('renders Italian dates and 24h times for Italian users', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'it');
      // An Italian user must read "venerdì 13 marzo 2026 alle 21:00".
      expect(formatDate('2026-03-13T21:00', getDateLocale())).toBe('venerdì 13 marzo 2026');
      expect(formatTime('21:00', getDateLocale())).toBe('21:00');
    });
  });

  describe('translateRoot', () => {
    it('applies text, html and attribute translations to a rendered template', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'it');
      const root = document.createElement('div');
      root.innerHTML = `
        <h1 data-i18n="linkReady.heading">Your event link is ready</h1>
        <span data-i18n-html="linkReady.warningHtml">Save this link now</span>
        <button aria-label="Share event link" data-i18n-attr="aria-label:linkReady.shareAria">
          <span data-i18n="linkReady.shareButton">Share</span>
        </button>
      `;

      translateRoot(root);

      expect(root.querySelector('h1').textContent).toBe('Il link del tuo evento è pronto');
      const warning = root.querySelector('[data-i18n-html]');
      expect(warning.textContent).toContain("perso il link, perso l'evento");
      // The inline emphasis survives as real markup, not escaped text.
      expect(warning.querySelector('strong').textContent).toBe('unico');
      expect(root.querySelector('button').getAttribute('aria-label')).toBe(
        "Condividi il link dell'evento"
      );
      expect(root.querySelector('button span').textContent).toBe('Condividi');
    });

    it('leaves the English template text in place when English is active', () => {
      const root = document.createElement('div');
      root.innerHTML = '<h1 data-i18n="linkReady.heading">Your event link is ready</h1>';
      translateRoot(root);
      expect(root.querySelector('h1').textContent).toBe('Your event link is ready');
    });
  });
});
