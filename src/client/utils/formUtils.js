export function validateInput(input) {
  const value = input.value.trim();
  const errorElement = input.nextElementSibling?.classList.contains('error')
    ? input.nextElementSibling
    : createErrorElement(input);

  if (input.required && !value) {
    showInputError(input, errorElement, 'This field is required');
    return false;
  }

  if (input.type === 'text' && value.length > 100) {
    showInputError(input, errorElement, 'Maximum length is 100 characters');
    return false;
  }

  if (input.type === 'textarea' && value.length > 500) {
    showInputError(input, errorElement, 'Maximum length is 500 characters');
    return false;
  }

  clearInputError(input, errorElement);
  return true;
}

export function createErrorElement(input) {
  const error = document.createElement('div');
  error.className = 'error';
  input.parentNode.insertBefore(error, input.nextSibling);
  return error;
}

export function showInputError(input, errorElement, message) {
  input.classList.add('error');
  errorElement.textContent = message;
}

export function clearInputError(input, errorElement) {
  input.classList.remove('error');
  errorElement.textContent = '';
}

export function showError(message, form) {
  const errorContainer = document.createElement('div');
  errorContainer.className = 'error-container';
  errorContainer.textContent = message;
  form.insertBefore(errorContainer, form.firstChild);
  setTimeout(() => errorContainer.remove(), 5000);
}

export function clearErrors() {
  document.querySelectorAll('.error-container').forEach(el => el.remove());
  document.querySelectorAll('.error').forEach(el => (el.textContent = ''));
  document
    .querySelectorAll('input.error, textarea.error')
    .forEach(el => el.classList.remove('error'));
}
