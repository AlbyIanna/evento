import { BaseComponent } from '../../utils/baseComponent.js';
import { appState } from '../../utils/stateManager.js';
import { buildIcs, buildGoogleCalendarUrl } from '../../../shared/ics.js';

export class EventView extends BaseComponent {
  #eventData = null;
  #encodedEvent = null;
  #hasEditPermission = false;
  #currentUrl = '';
  #icsBlobUrl = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    // Check if user has edit permission
    const urlParams = new URLSearchParams(window.location.search);
    this.#hasEditPermission = urlParams.has('canEdit');

    await this.render();

    // Subscribe to relevant state changes
    this.addCleanup(
      appState.subscribe('currentView', view => {
        if (view === 'view') {
          this.#updateDom(this.#eventData);
        }
      })
    );
  }

  async render() {
    await this.loadTemplate('/components/event-view/template.html');
    this.#setupButtons();

    // Update the display if data arrived before the template did (the common
    // case on first load). Surface the banner too, so a cancellation carried
    // in the payload isn't missed when setEventData raced ahead of render.
    if (this.#eventData) {
      this.#updateDom(this.#eventData);
      this.#showBanner(this.#eventData.status === 'cancelled' ? 'cancelled' : 'none');
    }
  }

  #setupButtons() {
    // Get the current URL
    this.#currentUrl = window.location.href;

    // Edit button - only show if user has edit permission
    const editButton = this.$('#edit-button');
    if (editButton && this.#hasEditPermission) {
      // Show the edit button
      editButton.classList.remove('hidden');

      // Create the edit URL by adding /edit to the current path; keep the
      // fragment, which carries the whole event for private links
      const editUrl = `${window.location.pathname}/edit${window.location.hash || ''}`;
      editButton.setAttribute('href', editUrl);
    }

    // Share button
    const shareButton = this.$('#share-button');
    if (shareButton) {
      this.listen(shareButton, 'click', () => this.#handleShare());
    }

    // Copy button
    const copyButton = this.$('#copy-button');
    if (copyButton) {
      this.listen(copyButton, 'click', () => this.#handleCopy());
    }
  }

  #handleShare() {
    // Check if Web Share API is available
    if (navigator.share) {
      navigator
        .share({
          title: this.#eventData?.title || 'Event Details',
          text: `Join me at ${this.#eventData?.title} on ${this.#eventData?.date} at ${this.#eventData?.time}`,
          // Drop the query string (canEdit) but keep the fragment, which
          // carries the whole event for private links
          url: window.location.origin + window.location.pathname + (window.location.hash || '')
        })
        .catch(error => {
          console.error('Error sharing:', error);
          this.#handleCopy();
        });
    } else {
      // Fallback for browsers without Web Share API
      this.#handleCopy();
    }
  }

  #handleCopy() {
    // Create a clean URL without the edit parameter, keeping the fragment
    // (it carries the whole event for private links)
    const cleanUrl =
      window.location.origin + window.location.pathname + (window.location.hash || '');

    // Copy to clipboard
    navigator.clipboard
      .writeText(cleanUrl)
      .then(() => {
        const copyDefault = this.$('#copy-default');
        const copySuccess = this.$('#copy-success');
        const copyPopup = this.$('#copy-popup');

        // Show success state on button
        copyDefault.classList.add('hidden');
        copySuccess.classList.remove('hidden');

        // Show popup notification
        copyPopup.classList.remove('hidden');

        // Reset after 2 seconds
        setTimeout(() => {
          copyDefault.classList.remove('hidden');
          copySuccess.classList.add('hidden');
          copyPopup.classList.add('hidden');
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
        alert('Failed to copy event link. Please copy the URL manually.');
      });
  }

  setEventData(eventData) {
    this.#eventData = eventData;

    // Store the encoded event from the URL
    const path = window.location.pathname;
    if (path.startsWith('/event/')) {
      this.#encodedEvent = path.split('/event/')[1];
    }

    // If shadowRoot is ready, update the DOM
    if (this.shadowRoot.innerHTML) {
      this.#updateDom(eventData);
      // A fresh event owns the banner: reset it, but surface a cancellation
      // that is already in the payload itself (not only relay-delivered ones).
      this.#showBanner(eventData.status === 'cancelled' ? 'cancelled' : 'none');
    }
  }

  // Applies a newer signed version fetched from relays. `encoded` is the new
  // payload, so the /ics fallback and re-shares reflect the updated event.
  applyUpdate(formattedEventData, encoded) {
    this.#eventData = formattedEventData;
    // Only path-carried (public) events have a server payload to point at;
    // private events keep #encodedEvent null so nothing hits the server.
    if (encoded && this.#encodedEvent) {
      this.#encodedEvent = encoded;
    }
    this.#updateDom(formattedEventData);
    this.#showBanner(formattedEventData.status === 'cancelled' ? 'cancelled' : 'updated');
  }

  // Banner is owned here, never by #updateDom, so ordinary re-renders (e.g.
  // the currentView subscription) can't wipe or resurrect it.
  #showBanner(kind) {
    const banner = this.$('#update-banner');
    const bannerText = this.$('#update-banner-text');
    const title = this.$('#event-title');
    if (!banner || !bannerText) return;

    const cancelled = kind === 'cancelled';
    banner.classList.toggle('cancelled', cancelled);
    if (title) title.classList.toggle('cancelled', cancelled);

    if (kind === 'none') {
      banner.classList.add('hidden');
      bannerText.textContent = '';
      return;
    }
    // Unhide before writing the text so the aria-live region announces it.
    banner.classList.remove('hidden');
    bannerText.textContent = cancelled
      ? 'This event was cancelled by the organizer.'
      : 'This event was updated by the organizer — showing the latest version.';
  }

  // Tells the organizer their just-made change didn't reach any relay yet.
  showPublishWarning() {
    const warning = this.$('#publish-warning');
    const text = this.$('#publish-warning-text');
    if (!warning) return;
    if (text) {
      // Reset explicitly: a showPublishPartial from an earlier view in the
      // same session may have overwritten the default template text.
      text.textContent =
        "Couldn't reach the relays — your change isn't published yet. Reopen this link to retry.";
    }
    warning.classList.remove('hidden');
  }

  // Honest publish report when the change landed on only part of the relay
  // set: it IS published, but with reduced redundancy.
  showPublishPartial(ackCount, relayCount) {
    const warning = this.$('#publish-warning');
    const text = this.$('#publish-warning-text');
    if (!warning || !text) return;
    text.textContent = `Published to ${ackCount} of ${relayCount} relays — some relays couldn't be reached.`;
    warning.classList.remove('hidden');
  }

  #updateDom(eventData) {
    const title = this.$('#event-title');
    const date = this.$('#event-date');
    const time = this.$('#event-time');
    const location = this.$('#event-location');
    const description = this.$('#event-description');
    const descriptionContainer = this.$('#event-description-container');

    // Check if elements exist before setting properties
    if (!title || !date || !time || !location) {
      console.error('Required elements not found in event view template');
      return;
    }

    title.textContent = eventData.title;
    date.textContent = eventData.date;
    time.textContent = eventData.time;
    location.textContent = eventData.location;

    if (description && descriptionContainer) {
      if (eventData.description) {
        description.textContent = eventData.description;
        descriptionContainer.classList.remove('hidden');
      } else {
        descriptionContainer.classList.add('hidden');
      }
    }

    this.#updateCalendarLinks(eventData);
  }

  #updateCalendarLinks(eventData) {
    const calendarButton = this.$('#calendar-button');
    const gcalButton = this.$('#gcal-button');
    if (!calendarButton || !gcalButton) return;

    calendarButton.classList.add('hidden');
    gcalButton.classList.add('hidden');

    // A cancelled event has nothing to add to a calendar.
    if (eventData && eventData.status === 'cancelled') return;

    const start = eventData && (eventData.start || eventData.datetime);
    if (!start) return;

    // Fragment-carried (private) events must never send the payload to any
    // server: no /ics fallback, and no description in third-party URLs
    const isPrivate = !this.#encodedEvent;

    try {
      if (typeof URL.createObjectURL === 'function') {
        const ics = buildIcs(eventData);
        if (this.#icsBlobUrl && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(this.#icsBlobUrl);
        }
        this.#icsBlobUrl = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
        calendarButton.setAttribute('href', this.#icsBlobUrl);
        calendarButton.classList.remove('hidden');
      } else if (!isPrivate) {
        // No Blob URLs (e.g. limited webviews): fall back to the stateless
        // server projection for path-carried events
        calendarButton.setAttribute('href', `/ics/${this.#encodedEvent}`);
        calendarButton.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Failed to build ICS link:', err);
    }

    try {
      const gcalData = isPrivate ? { ...eventData, description: '' } : eventData;
      gcalButton.setAttribute('href', buildGoogleCalendarUrl(gcalData));
      gcalButton.classList.remove('hidden');
    } catch (err) {
      console.error('Failed to build Google Calendar link:', err);
    }
  }

  async showError() {
    await this.loadTemplate('/components/event-view/error-template.html');
    // Clear any stored event data
    this.#eventData = null;
  }
}

customElements.define('event-view', EventView);
