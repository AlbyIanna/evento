/**
 * Minimal i18n: one flat dictionary per language, no framework.
 *
 * Language selection order:
 *   1. localStorage override ('evento.lang': 'it' | 'en'), for manual testing
 *   2. navigator.language (any 'it' / 'it-*' tag → Italian)
 *   3. English
 *
 * Templates opt in per element (see translateRoot); JS-built strings go
 * through t(). English is the reference language: every key exists in 'en',
 * and missing translations fall back to it.
 */

const en = {
  'app.pageTitle': 'Event Share',
  'app.createTitle': 'Create Event',
  'app.editTitle': 'Edit Event',
  'app.loading': 'Loading...',

  'form.titleLabel': 'Event Title*',
  'form.titlePlaceholder': "e.g. Alberto's Birthday Party",
  'form.dateLabel': 'Date*',
  'form.locationLabel': 'Location*',
  'form.descriptionLabel': 'Description',
  'form.contactLabel': 'How can people reply to you? (optional)',
  'form.contactPlaceholder': 'Email or phone number',
  'form.contactHint':
    'Shown to everyone: this contact becomes part of the event link, visible to anyone who receives it.',
  'form.privateLabel': 'Private link (no preview card)',
  'form.privateHint':
    'The event lives only in the link itself — it never reaches our server, so chats will not show a preview card. Opening it in an external calendar shares it with that provider.',
  'form.updatableLabel': 'Updatable link',
  'form.updatableHint':
    'Your browser keeps a signing key so you can push time changes or a cancellation to everyone who already has the link. Updates travel through public Nostr relays, where the event data is publicly readable.',
  'form.combinedWarning':
    'Even with a private link, updates put the event details on public Nostr relays where anyone can read them.',
  'form.cancelledNotice':
    'This event is cancelled. Saving will keep it cancelled for everyone who has the link.',
  'form.createButton': 'Create Event Link',
  'form.updateButton': 'Generate New Link',
  'form.cancelEventButton': 'Cancel this event',
  'form.cancelButton': 'Cancel',
  'form.validationHeading': 'Please fix the following errors:',
  'form.cancelConfirm': 'Cancel this event for everyone who has the link?',
  'form.submitError': 'Failed to create event link. Please try again.',
  'form.cancelError': 'Failed to cancel the event. Please try again.',
  'form.errorRequired': 'This field is required',
  'form.errorPastDate': 'Please select a future date and time',
  'form.errorContact': 'Enter a plausible email address or phone number',

  'view.regionLabel': 'Event Details',
  'view.editButton': 'Edit',
  'view.editAria': 'Edit event details',
  'view.dateLabel': 'Date:',
  'view.timeLabel': 'Time:',
  'view.locationLabel': 'Location:',
  'view.descriptionLabel': 'Description:',
  'view.shareButton': 'Share Event',
  'view.shareAria': 'Share event with others',
  'view.copyButton': 'Copy URL',
  'view.copyAria': 'Copy event URL to clipboard',
  'view.copied': 'Copied!',
  'view.urlCopied': 'URL copied!',
  'view.addToCalendar': 'Add to Calendar',
  'view.calendarAria': 'Download calendar file',
  'view.googleCalendar': 'Google Calendar',
  'view.gcalAria': 'Open in Google Calendar',
  'view.rsvpButton': 'Reply to organizer',
  'view.rsvpMessage': 'Hi! About "{title}"...',
  'view.organizerNotice': 'Organizer key imported — this device can now edit or cancel this event.',
  'view.organizerHint':
    'Organizing this event from another device? Open your organizer link here to edit or cancel it.',
  'view.publishWarning':
    "Couldn't reach the relays — your change isn't published yet. Reopen this link to retry.",
  'view.publishPartial': "Published to {ack} of {total} relays — some relays couldn't be reached.",
  'view.bannerUpdated': 'This event was updated by the organizer — showing the latest version.',
  'view.bannerCancelled': 'This event was cancelled by the organizer.',
  'view.shareText': 'Join me at {title} on {date} at {time}',
  'view.shareTitleFallback': 'Event Details',
  'view.copyFailed': 'Failed to copy event link. Please copy the URL manually.',

  'error.title': 'Invalid or expired event link',
  'error.message': 'This event link is invalid or has expired. Please check the URL and try again.',
  'error.createNew': 'Create a new event',

  'linkReady.regionLabel': 'Event link ready',
  'linkReady.heading': 'Your event link is ready',
  'linkReady.warningHtml':
    'Save this link now — it is the <strong>only</strong> way to open this event. There is no account and no recovery: lose the link and the event is gone.',
  'linkReady.shareButton': 'Share',
  'linkReady.shareAria': 'Share event link',
  'linkReady.copyButton': 'Copy link',
  'linkReady.copyAria': 'Copy event link to clipboard',
  'linkReady.copied': 'Copied!',
  'linkReady.organizerHeading': 'Organizer link — keep it secret',
  'linkReady.organizerAria': 'Organizer link',
  'linkReady.organizerCopy':
    "This link contains your event's signing key. It is what lets you edit or cancel the event from another device — treat it like a password and share it with no one.",
  'linkReady.copyOrganizerButton': 'Copy organizer link',
  'linkReady.copyOrganizerAria': 'Copy organizer link to clipboard',
  'linkReady.viewEvent': 'View event'
};

const it = {
  'app.pageTitle': 'Evento',
  'app.createTitle': 'Crea evento',
  'app.editTitle': 'Modifica evento',
  'app.loading': 'Caricamento...',

  'form.titleLabel': "Titolo dell'evento*",
  'form.titlePlaceholder': 'es. Festa di compleanno di Alberto',
  'form.dateLabel': 'Data*',
  'form.locationLabel': 'Luogo*',
  'form.descriptionLabel': 'Descrizione',
  'form.contactLabel': 'Come possono risponderti? (facoltativo)',
  'form.contactPlaceholder': 'Email o numero di telefono',
  'form.contactHint':
    "Visibile a tutti: il contatto diventa parte del link dell'evento, leggibile da chiunque lo riceva.",
  'form.privateLabel': 'Link privato (senza anteprima)',
  'form.privateHint':
    "L'evento vive solo nel link stesso — non raggiunge mai il nostro server, quindi le chat non mostreranno una scheda di anteprima. Aprirlo in un calendario esterno lo condivide con quel fornitore.",
  'form.updatableLabel': 'Link aggiornabile',
  'form.updatableHint':
    "Il tuo browser conserva una chiave di firma con cui puoi comunicare cambi di orario o un annullamento a chi ha già il link. Gli aggiornamenti passano da relay Nostr pubblici, dove i dati dell'evento sono leggibili da chiunque.",
  'form.combinedWarning':
    "Anche con un link privato, gli aggiornamenti pubblicano i dettagli dell'evento su relay Nostr pubblici, dove chiunque può leggerli.",
  'form.cancelledNotice':
    'Questo evento è annullato. Salvando resterà annullato per chiunque abbia il link.',
  'form.createButton': 'Crea link evento',
  'form.updateButton': 'Genera nuovo link',
  'form.cancelEventButton': 'Annulla questo evento',
  'form.cancelButton': 'Indietro',
  'form.validationHeading': 'Correggi questi errori:',
  'form.cancelConfirm': 'Annullare questo evento per tutti quelli che hanno il link?',
  'form.submitError': "Impossibile creare il link dell'evento. Riprova.",
  'form.cancelError': "Impossibile annullare l'evento. Riprova.",
  'form.errorRequired': 'Questo campo è obbligatorio',
  'form.errorPastDate': "Scegli una data e un'ora future",
  'form.errorContact': 'Inserisci un indirizzo email o un numero di telefono valido',

  'view.regionLabel': 'Dettagli evento',
  'view.editButton': 'Modifica',
  'view.editAria': "Modifica i dettagli dell'evento",
  'view.dateLabel': 'Data:',
  'view.timeLabel': 'Ora:',
  'view.locationLabel': 'Luogo:',
  'view.descriptionLabel': 'Descrizione:',
  'view.shareButton': 'Condividi evento',
  'view.shareAria': "Condividi l'evento con altri",
  'view.copyButton': 'Copia URL',
  'view.copyAria': "Copia l'URL dell'evento negli appunti",
  'view.copied': 'Copiato!',
  'view.urlCopied': 'URL copiato!',
  'view.addToCalendar': 'Aggiungi al calendario',
  'view.calendarAria': 'Scarica il file calendario',
  'view.googleCalendar': 'Google Calendar',
  'view.gcalAria': 'Apri in Google Calendar',
  'view.rsvpButton': "Rispondi all'organizzatore",
  'view.rsvpMessage': 'Ciao! Riguardo a "{title}"...',
  'view.organizerNotice':
    "Chiave organizzatore importata — questo dispositivo ora può modificare o annullare l'evento.",
  'view.organizerHint':
    'Organizzi questo evento da un altro dispositivo? Apri qui il tuo link organizzatore per modificarlo o annullarlo.',
  'view.publishWarning':
    'Impossibile raggiungere i relay — la modifica non è ancora pubblicata. Riapri questo link per riprovare.',
  'view.publishPartial':
    'Pubblicato su {ack} relay su {total} — alcuni relay non erano raggiungibili.',
  'view.bannerUpdated':
    "Questo evento è stato aggiornato dall'organizzatore — questa è la versione più recente.",
  'view.bannerCancelled': "Questo evento è stato annullato dall'organizzatore.",
  'view.shareText': 'Vieni a {title} il {date} alle {time}',
  'view.shareTitleFallback': 'Dettagli evento',
  'view.copyFailed': "Impossibile copiare il link dell'evento. Copia l'URL manualmente.",

  'error.title': 'Link evento non valido o scaduto',
  'error.message': "Questo link evento non è valido o è scaduto. Controlla l'URL e riprova.",
  'error.createNew': 'Crea un nuovo evento',

  'linkReady.regionLabel': 'Link evento pronto',
  'linkReady.heading': 'Il link del tuo evento è pronto',
  'linkReady.warningHtml':
    "Salva questo link adesso — è l'<strong>unico</strong> modo per aprire questo evento. Non c'è account né recupero: perso il link, perso l'evento.",
  'linkReady.shareButton': 'Condividi',
  'linkReady.shareAria': "Condividi il link dell'evento",
  'linkReady.copyButton': 'Copia link',
  'linkReady.copyAria': "Copia il link dell'evento negli appunti",
  'linkReady.copied': 'Copiato!',
  'linkReady.organizerHeading': 'Link organizzatore — tienilo segreto',
  'linkReady.organizerAria': 'Link organizzatore',
  'linkReady.organizerCopy':
    'Questo link contiene la chiave di firma del tuo evento. È ciò che ti permette di modificarlo o annullarlo da un altro dispositivo — trattalo come una password e non condividerlo con nessuno.',
  'linkReady.copyOrganizerButton': 'Copia link organizzatore',
  'linkReady.copyOrganizerAria': 'Copia il link organizzatore negli appunti',
  'linkReady.viewEvent': 'Vedi evento'
};

const dictionaries = { en, it };

export const LANGUAGE_STORAGE_KEY = 'evento.lang';

export function getLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && dictionaries[stored]) {
      return stored;
    }
  } catch {
    // Storage unavailable: fall through to the navigator language.
  }
  const tag = (typeof navigator !== 'undefined' && navigator.language) || '';
  return /^it(-|$)/i.test(tag) ? 'it' : 'en';
}

/** BCP 47 locale for date/time formatting, matched to the UI language. */
export function getDateLocale() {
  return getLanguage() === 'it' ? 'it-IT' : 'en-US';
}

/**
 * Returns the UI string for a key in the active language, falling back to
 * English and finally to the key itself. `{name}` placeholders are replaced
 * from `params`.
 */
export function t(key, params) {
  const language = getLanguage();
  let text = dictionaries[language][key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/**
 * Applies dictionary strings to a rendered template. Elements opt in via:
 *   data-i18n="key"                       → textContent
 *   data-i18n-html="key"                  → innerHTML
 *   data-i18n-attr="attr:key[,attr:key]"  → attributes (aria-label, placeholder)
 * The English text in the template stays as authoring-time fallback.
 */
export function translateRoot(root) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    // Dictionary values ship with the code and never contain user input,
    // so assigning them as HTML cannot inject anything foreign.
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.getAttribute('data-i18n-attr').split(',')) {
      const [attr, key] = pair.split(':').map(part => part.trim());
      if (attr && key) {
        el.setAttribute(attr, t(key));
      }
    }
  }
}
