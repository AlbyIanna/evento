import { BaseComponent } from '../../utils/baseComponent.js';
import { appState } from '../../utils/stateManager.js';
import { getNext9PM, combineDateAndTime } from '../../services/date/dateService.js';
import {
  validateInput,
  validateForm,
  updateValidationSummary,
  clearValidation,
  showValidationError
} from '../../services/validation/formValidation.js';
import { t } from '../../i18n.js';

export class EventForm extends BaseComponent {
  #isEditMode = false;
  #eventData = null;
  #privateLink = false;
  #updatableLink = false;
  #canCancel = false;

  constructor() {
    super();
  }

  async connectedCallback() {
    await this.render();
    this.setupForm();

    // Subscribe to relevant state changes
    this.addCleanup(
      appState.subscribe('currentView', view => {
        if (view === 'create') {
          this.updateFormMode();
          if (this.#isEditMode && this.#eventData) {
            this.fillForm(this.#eventData);
          }
        }
      })
    );
  }

  async render() {
    await this.loadTemplate('/components/event-form/template.html');

    // Update UI based on mode (create or edit)
    this.updateFormMode();

    // Fill form with data if in edit mode
    if (this.#isEditMode && this.#eventData) {
      this.fillForm(this.#eventData);
    }
  }

  updateFormMode() {
    const createButton = this.$('#create-button');
    const updateButton = this.$('#update-button');
    const cancelButton = this.$('#cancel-button');
    const cancelEventButton = this.$('#cancel-event-button');
    const updatableCheckbox = this.$('#updatable');
    const buttonContainer = this.$('.button-container');

    if (this.#isEditMode) {
      // Set edit mode UI
      createButton.classList.add('hidden');
      updateButton.classList.remove('hidden');
      cancelButton.classList.remove('hidden');
      buttonContainer.classList.add('edit-buttons');
      // The update channel cannot be granted retroactively to old-link
      // holders nor revoked from payloads people already have
      if (updatableCheckbox) updatableCheckbox.disabled = true;
      if (cancelEventButton) cancelEventButton.classList.toggle('hidden', !this.#canCancel);
    } else {
      // Set create mode UI
      createButton.classList.remove('hidden');
      updateButton.classList.add('hidden');
      cancelButton.classList.add('hidden');
      buttonContainer.classList.remove('edit-buttons');
      if (updatableCheckbox) updatableCheckbox.disabled = false;
      if (cancelEventButton) cancelEventButton.classList.add('hidden');
    }
  }

  setupForm() {
    const form = this.$('#event-form');
    const cancelButton = this.$('#cancel-button');

    // Set up input validation
    const inputs = this.$$('input, textarea');
    inputs.forEach(input => {
      // The private-link checkbox has no error element (its describedby is a
      // hint), so keep it out of the validation wiring
      if (input.type === 'checkbox') return;

      this.listen(input, 'input', () => {
        this.validateInput(input);
        this.updateValidationSummary();
      });

      this.listen(input, 'blur', () => {
        this.validateInput(input);
        this.updateValidationSummary();
      });

      if (input.id === 'datetime' && !input.value) {
        // Default to the next 9pm, but never clobber a value already
        // filled in (e.g. by edit mode, whose fillForm can run first
        // because the template loads asynchronously)
        input.value = getNext9PM();
      }
    });

    // Setup cancel link to go back to event view
    if (cancelButton) {
      const path = window.location.pathname;
      if (path.includes('/edit')) {
        // If we're editing, set the href to go back to the event view;
        // keep query (canEdit) and fragment (the whole event, for private links)
        const eventUrl =
          path.replace('/edit', '') + window.location.search + (window.location.hash || '');
        cancelButton.setAttribute('href', eventUrl);
      }
    }

    const cancelEventButton = this.$('#cancel-event-button');
    if (cancelEventButton) {
      this.listen(cancelEventButton, 'click', () => {
        if (window.confirm(t('form.cancelConfirm'))) {
          this.dispatchEvent(new CustomEvent('cancel-event', { bubbles: true, composed: true }));
        }
      });
    }

    // A private + updatable event still publishes its details to public
    // relays — surface that combination explicitly, since it cuts against
    // the private-link promise.
    const privateCheckbox = this.$('#private');
    const updatableCheckbox = this.$('#updatable');
    if (privateCheckbox && updatableCheckbox) {
      const syncCombinedWarning = () => this.#updateCombinedWarning();
      this.listen(privateCheckbox, 'change', syncCombinedWarning);
      this.listen(updatableCheckbox, 'change', syncCombinedWarning);
    }

    this.listen(form, 'submit', e => {
      e.preventDefault();

      // Validate form before submitting
      if (this.validateForm()) {
        const formData = new FormData(form);
        this.dispatchEvent(
          new CustomEvent('submit', {
            detail: {
              formData,
              isEdit: this.#isEditMode
            },
            bubbles: true,
            composed: true
          })
        );
      }
    });
  }

  // aria-describedby can reference several elements (hint + error); the
  // error element is the one whose id ends in '-error'.
  #errorElementFor(input) {
    const errorId = (input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .find(id => id.endsWith('-error'));
    return errorId ? this.$(`#${errorId}`) : null;
  }

  validateInput(input) {
    return validateInput(input, this.#errorElementFor(input));
  }

  validateForm() {
    const form = this.$('#event-form');
    const validationSummary = this.$('#validation-summary');
    const validationErrors = this.$('#validation-errors');

    return validateForm(
      form,
      input => this.#errorElementFor(input),
      validationSummary,
      validationErrors
    );
  }

  updateValidationSummary() {
    const validationSummary = this.$('#validation-summary');
    const validationErrors = this.$('#validation-errors');

    updateValidationSummary(this.shadowRoot, validationSummary, validationErrors);
  }

  fillForm(data) {
    const titleInput = this.$('#title');
    const datetimeInput = this.$('#datetime');
    const locationInput = this.$('#location');
    const descriptionInput = this.$('#description');

    if (titleInput) titleInput.value = data.title || '';

    // Handle date formatting for datetime-local input
    const startValue = data.start || data.datetime;
    if (datetimeInput) {
      if (startValue && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startValue)) {
        // datetime-local inputs accept minute precision only
        datetimeInput.value = startValue.slice(0, 16);
      } else if (data.date && data.time) {
        // Reconstruct datetime from separate date and time
        try {
          datetimeInput.value = combineDateAndTime(data.date, data.time);
        } catch (e) {
          console.error('Error formatting date/time:', e);
          datetimeInput.value = getNext9PM();
        }
      } else {
        // Default to next 9PM if no date provided
        datetimeInput.value = getNext9PM();
      }
    }

    if (locationInput) locationInput.value = data.location || '';
    if (descriptionInput) descriptionInput.value = data.description || '';

    const contactInput = this.$('#contact');
    if (contactInput) contactInput.value = data.contact || '';

    const privateCheckbox = this.$('#private');
    if (privateCheckbox) privateCheckbox.checked = this.#privateLink;

    const updatableCheckbox = this.$('#updatable');
    if (updatableCheckbox) updatableCheckbox.checked = this.#updatableLink;
  }

  clearValidation() {
    clearValidation(this.shadowRoot);
  }

  reset() {
    const form = this.$('#event-form');
    form.reset();
    this.clearValidation();
    this.#eventData = null;

    // Reset datetime to next 9pm
    const datetimeInput = this.$('#datetime');
    if (datetimeInput) {
      datetimeInput.value = getNext9PM();
    }
  }

  setEditMode(isEdit) {
    this.#isEditMode = isEdit;
    if (this.shadowRoot.innerHTML) {
      this.updateFormMode();
    }
  }

  setPrivateLink(value) {
    this.#privateLink = Boolean(value);
    if (this.shadowRoot.innerHTML) {
      const privateCheckbox = this.$('#private');
      if (privateCheckbox) privateCheckbox.checked = this.#privateLink;
    }
  }

  setUpdatableLink(value) {
    this.#updatableLink = Boolean(value);
    if (this.shadowRoot.innerHTML) {
      const updatableCheckbox = this.$('#updatable');
      if (updatableCheckbox) updatableCheckbox.checked = this.#updatableLink;
    }
  }

  setCanCancel(value) {
    this.#canCancel = Boolean(value);
    if (this.shadowRoot.innerHTML) {
      this.updateFormMode();
    }
  }

  setCancelledNotice(value) {
    const notice = this.$('#cancelled-notice');
    if (notice) notice.classList.toggle('hidden', !value);
  }

  #updateCombinedWarning() {
    const warning = this.$('#combined-warning');
    const privateChecked = this.$('#private')?.checked;
    const updatableChecked = this.$('#updatable')?.checked;
    if (warning) warning.classList.toggle('hidden', !(privateChecked && updatableChecked));
  }

  setEventData(data) {
    this.#eventData = data;
    if (this.shadowRoot.innerHTML && data) {
      this.fillForm(data);
    }
  }

  // Add a method to show error messages
  showError(message) {
    const validationSummary = this.$('#validation-summary');
    const validationErrors = this.$('#validation-errors');
    const form = this.$('#event-form');

    showValidationError(message, validationSummary, validationErrors, form);
  }
}

customElements.define('event-form', EventForm);
