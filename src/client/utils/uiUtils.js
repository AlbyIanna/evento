import { appState } from './stateManager.js';

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
 */
export function showErrorState(container) {
  container.innerHTML = `
        <h1>Invalid Event</h1>
        <p>This event link appears to be invalid or has expired.</p>
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
