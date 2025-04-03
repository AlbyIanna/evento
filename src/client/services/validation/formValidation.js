/**
 * Form validation service
 * Provides functions for validating form inputs and managing validation state
 */

/**
 * Validate a single input field
 * @param {HTMLInputElement|HTMLTextAreaElement} input - The input element to validate
 * @param {HTMLElement} errorElement - The element to display error messages in
 * @returns {boolean} - Whether the input is valid
 */
export function validateInput(input, errorElement) {
  // Reset validation state
  input.classList.remove('invalid');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
  }

  // Skip validation if input is not required and empty
  if (!input.required && !input.value.trim()) {
    return true;
  }

  // Check standard validity first
  if (!input.checkValidity()) {
    input.classList.add('invalid');
    if (errorElement) {
      errorElement.textContent = input.validationMessage || 'This field is required';
      errorElement.classList.remove('hidden');
    }
    return false;
  }

  // Special validation for datetime
  if (input.id === 'datetime' && input.value) {
    const dateTimeValue = new Date(input.value);
    const now = new Date();

    // Check if the selected date is in the past
    if (dateTimeValue < now) {
      input.classList.add('invalid');
      if (errorElement) {
        errorElement.textContent = 'Please select a future date and time';
        errorElement.classList.remove('hidden');
      }
      return false;
    }
  }

  return true;
}

/**
 * Validate an entire form
 * @param {HTMLFormElement} form - The form to validate
 * @param {Function} getErrorElement - Function to get the error element for an input
 * @param {HTMLElement} validationSummary - The validation summary element
 * @param {HTMLElement} validationErrors - The validation errors list element
 * @returns {boolean} - Whether the form is valid
 */
export function validateForm(form, getErrorElement, validationSummary, validationErrors) {
  const inputs = form.querySelectorAll('input[required], textarea[required]');
  let isValid = true;

  // Validate all required inputs
  inputs.forEach(input => {
    const errorElement = getErrorElement(input);
    if (!validateInput(input, errorElement)) {
      isValid = false;
    }
  });

  // Update the validation summary
  updateValidationSummary(form, validationSummary, validationErrors);

  // If invalid, focus the first invalid field
  if (!isValid) {
    const firstInvalid = form.querySelector('.invalid');
    if (firstInvalid) {
      firstInvalid.focus();
    }

    // Ensure validation summary is visible but don't scroll to it
    if (validationSummary) {
      validationSummary.classList.remove('hidden');
    }
  }

  return isValid;
}

/**
 * Update the validation summary with current errors
 * @param {HTMLElement} container - The container element (form or component)
 * @param {HTMLElement} validationSummary - The validation summary element
 * @param {HTMLElement} validationErrors - The validation errors list element
 */
export function updateValidationSummary(container, validationSummary, validationErrors) {
  if (!validationSummary || !validationErrors) return;

  // Clear previous errors
  validationErrors.innerHTML = '';

  // Get all invalid inputs
  const invalidInputs = container.querySelectorAll('.invalid');

  // Hide summary if no errors
  if (invalidInputs.length === 0) {
    validationSummary.classList.add('hidden');
    return;
  }

  // Add each error to the summary
  invalidInputs.forEach(input => {
    const label = container.querySelector(`label[for="${input.id}"]`);
    const errorId = input.getAttribute('aria-describedby');
    const errorElement = container.querySelector(`#${errorId}`);

    if (label && errorElement) {
      const listItem = document.createElement('li');
      listItem.textContent = `${label.textContent}: ${errorElement.textContent}`;
      validationErrors.appendChild(listItem);
    }
  });

  // Show the summary
  validationSummary.classList.remove('hidden');
}

/**
 * Clear all validation errors
 * @param {HTMLElement} container - The container element (form or component)
 * @param {HTMLElement} validationSummary - The validation summary element
 */
export function clearValidation(container, validationSummary) {
  // Hide validation summary
  if (validationSummary) {
    validationSummary.classList.add('hidden');
  }

  // Clear all field errors
  const errorElements = container.querySelectorAll('.field-error');
  errorElements.forEach(element => {
    element.textContent = '';
    element.classList.add('hidden');
  });

  // Remove invalid class from inputs
  const invalidInputs = container.querySelectorAll('.invalid');
  invalidInputs.forEach(input => {
    input.classList.remove('invalid');
  });
}

/**
 * Show an error message in the validation summary
 * @param {string} message - The error message to show
 * @param {HTMLElement} validationSummary - The validation summary element
 * @param {HTMLElement} validationErrors - The validation errors list element
 * @param {HTMLElement} [container] - Optional container to scroll into view
 */
export function showValidationError(message, validationSummary, validationErrors, container) {
  if (validationSummary && validationErrors) {
    // Clear previous errors
    validationErrors.innerHTML = '';

    // Add error message
    const errorItem = document.createElement('li');
    errorItem.textContent = message;
    validationErrors.appendChild(errorItem);

    // Show summary
    validationSummary.classList.remove('hidden');

    // Scroll to top if needed
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
