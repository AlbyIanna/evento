import { BaseComponent } from '../../utils/baseComponent.js';
import { appState } from '../../utils/stateManager.js';

export class EventView extends BaseComponent {
  #eventData = null;
  #encodedEvent = null;
  #hasEditPermission = false;
  #currentUrl = '';

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

    // Update the display if we have event data
    if (this.#eventData) {
      this.#updateDom(this.#eventData);
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

      // Create the edit URL by adding /edit to the current path
      const editUrl = `${window.location.pathname}/edit`;
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
          url: this.#currentUrl.split('?')[0] // Remove any query parameters
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
    // Create a clean URL without the edit parameter
    const cleanUrl = window.location.origin + window.location.pathname;

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
    }
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
  }

  async showError() {
    await this.loadTemplate('/components/event-view/error-template.html');
    // Clear any stored event data
    this.#eventData = null;
  }
}

customElements.define('event-view', EventView);
