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

export class EventForm extends BaseComponent {
  #isEditMode = false;
  #eventData = null;

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
    const buttonContainer = this.$('.button-container');

    if (this.#isEditMode) {
      // Set edit mode UI
      createButton.classList.add('hidden');
      updateButton.classList.remove('hidden');
      cancelButton.classList.remove('hidden');
      buttonContainer.classList.add('edit-buttons');
    } else {
      // Set create mode UI
      createButton.classList.remove('hidden');
      updateButton.classList.add('hidden');
      cancelButton.classList.add('hidden');
      buttonContainer.classList.remove('edit-buttons');
    }
  }

  setupForm() {
    const form = this.$('#event-form');
    const cancelButton = this.$('#cancel-button');

    // Set up input validation
    const inputs = this.$$('input, textarea');
    inputs.forEach(input => {
      this.listen(input, 'input', () => {
        this.validateInput(input);
        this.updateValidationSummary();
      });

      this.listen(input, 'blur', () => {
        this.validateInput(input);
        this.updateValidationSummary();
      });

      if (input.id === 'datetime') {
        // Get the next 9pm date/time
        input.value = getNext9PM();
      }
    });

    // Setup cancel link to go back to event view
    if (cancelButton) {
      const path = window.location.pathname;
      if (path.includes('/edit')) {
        // If we're editing, set the href to go back to the event view
        const eventUrl = path.replace('/edit', '');
        cancelButton.setAttribute('href', eventUrl);
      }
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

  validateInput(input) {
    // Get the error element
    const errorId = input.getAttribute('aria-describedby');
    const errorElement = this.$(`#${errorId}`);

    return validateInput(input, errorElement);
  }

  validateForm() {
    const form = this.$('#event-form');
    const validationSummary = this.$('#validation-summary');
    const validationErrors = this.$('#validation-errors');

    // Create a function to get the error element for an input
    const getErrorElement = input => {
      const errorId = input.getAttribute('aria-describedby');
      return this.$(`#${errorId}`);
    };

    return validateForm(form, getErrorElement, validationSummary, validationErrors);
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
    if (datetimeInput) {
      if (data.datetime) {
        // Direct assignment if datetime is already in correct format
        datetimeInput.value = data.datetime;
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
