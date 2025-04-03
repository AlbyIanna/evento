/**
 * UI service
 * Provides functions for UI manipulation and state management
 */

import { appState } from '../../utils/stateManager.js';

/**
 * Set loading state for buttons and optionally update app state
 * @param {boolean} loading - Whether the app is in a loading state
 * @param {boolean} [updateState=false] - Whether to update the app state
 */
export function setLoading(loading, updateState = false) {
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.disabled = loading;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = 'Loading...';
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
    }
  });

  // Update app state if requested
  if (updateState) {
    appState.setState({ isLoading: loading });
  }
}

/**
 * Show error state in a container
 * @param {HTMLElement} container - Container to show error in
 * @param {string} [title='Invalid Event'] - Error title
 * @param {string} [message='This event link appears to be invalid or has expired.'] - Error message
 */
export function showErrorState(
  container,
  title = 'Invalid Event',
  message = 'This event link appears to be invalid or has expired.'
) {
  container.innerHTML = `
        <h1>${title}</h1>
        <p>${message}</p>
        <button onclick="window.location.href='/'">Create New Event</button>
    `;
  container.classList.remove('hidden');
}

/**
 * Toggle visibility between two containers
 * @param {HTMLElement} hide - Container to hide
 * @param {HTMLElement} show - Container to show
 * @param {string} [viewState] - Optional view state to update in app state
 */
export function toggleContainers(hide, show, viewState) {
  hide.classList.add('hidden');
  show.classList.remove('hidden');

  // Update app state if view state is provided
  if (viewState) {
    appState.setState({ currentView: viewState });
  }
}

/**
 * Toggle element visibility
 * @param {HTMLElement} element - Element to toggle
 * @param {boolean} show - Whether to show or hide the element
 */
export function toggleVisibility(element, show) {
  if (show) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

/**
 * Show a notification that automatically hides after a delay
 * @param {HTMLElement} element - Notification element to show
 * @param {number} [delay=2000] - Delay in milliseconds before hiding
 * @returns {Function} - Function to cancel the auto-hide
 */
export function showNotification(element, delay = 2000) {
  element.classList.remove('hidden');

  const timeoutId = setTimeout(() => {
    element.classList.add('hidden');
  }, delay);

  // Return a function to cancel the timeout if needed
  return () => clearTimeout(timeoutId);
}
