import { BaseComponent } from '../../utils/baseComponent.js';

/**
 * Post-creation screen: shows the freshly minted event link with Share/Copy
 * actions and the no-recovery warning, plus — for updatable events — the
 * organizer capability link (secret in the fragment) in its own section.
 */
export class LinkReady extends BaseComponent {
  // { title, shareUrl, viewUrl, organizerUrl } — organizerUrl may be null
  #links = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    await this.render();
  }

  async render() {
    await this.loadTemplate('/components/link-ready/template.html');
    this.#setupButtons();

    // Apply links that arrived before the template did (the common case:
    // setLinks runs synchronously on form submit, the template fetch not).
    if (this.#links) {
      this.#updateDom();
    }
  }

  setLinks(links) {
    this.#links = links;
    if (this.shadowRoot.innerHTML) {
      this.#updateDom();
    }
  }

  #updateDom() {
    const { shareUrl, viewUrl, organizerUrl } = this.#links;

    const shareLink = this.$('#share-link');
    if (shareLink) shareLink.textContent = shareUrl;

    const viewButton = this.$('#view-event-button');
    if (viewButton) viewButton.setAttribute('href', viewUrl);

    const organizerSection = this.$('#organizer-section');
    const organizerLink = this.$('#organizer-link');
    if (organizerSection && organizerLink) {
      organizerLink.textContent = organizerUrl || '';
      organizerSection.classList.toggle('hidden', !organizerUrl);
    }
  }

  #setupButtons() {
    const shareButton = this.$('#share-button');
    if (shareButton) {
      this.listen(shareButton, 'click', () => this.#handleShare());
    }

    const copyButton = this.$('#copy-button');
    if (copyButton) {
      this.listen(copyButton, 'click', () => this.#copyShareLink());
    }

    const copyOrganizerButton = this.$('#copy-organizer-button');
    if (copyOrganizerButton) {
      this.listen(copyOrganizerButton, 'click', () =>
        this.#copy(this.#links?.organizerUrl, '#copy-organizer-default', '#copy-organizer-success')
      );
    }

    const viewButton = this.$('#view-event-button');
    if (viewButton) {
      this.listen(viewButton, 'click', event => this.#handleViewEvent(event));
    }
  }

  // The app puts viewUrl in the address bar while this screen is up (so a
  // refresh cannot destroy the link). A plain anchor click to the URL the
  // page is already at is a no-op when only the fragment matches (private
  // links), so force a real load in that case.
  #handleViewEvent(event) {
    const viewUrl = this.#links?.viewUrl;
    if (!viewUrl) return;
    event.preventDefault();
    if (window.location.href !== viewUrl) {
      window.location.href = viewUrl;
      // A same-document (fragment-only) navigation completes synchronously;
      // a cross-document one leaves href unchanged here and loads on its own.
      if (window.location.href !== viewUrl) return;
    }
    window.location.reload?.();
  }

  #copyShareLink() {
    this.#copy(this.#links?.shareUrl, '#copy-default', '#copy-success');
  }

  #handleShare() {
    if (!this.#links) return;
    if (navigator.share) {
      navigator
        .share({
          title: this.#links.title || 'Event Details',
          url: this.#links.shareUrl
        })
        .catch(error => {
          console.error('Error sharing:', error);
          this.#copyShareLink();
        });
    } else {
      // Fallback for browsers without Web Share API
      this.#copyShareLink();
    }
  }

  #copy(text, defaultSelector, successSelector) {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const copyDefault = this.$(defaultSelector);
        const copySuccess = this.$(successSelector);
        if (!copyDefault || !copySuccess) return;

        copyDefault.classList.add('hidden');
        copySuccess.classList.remove('hidden');

        setTimeout(() => {
          copyDefault.classList.remove('hidden');
          copySuccess.classList.add('hidden');
        }, 2000);
      })
      .catch(err => {
        // The link is on screen: the user can still select and copy it.
        console.error('Failed to copy link:', err);
      });
  }
}

customElements.define('link-ready', LinkReady);
