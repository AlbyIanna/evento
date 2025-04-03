/**
 * Shadow DOM testing utilities
 * Inspired by shadow-dom-testing-library without the dependency
 */

/**
 * Recursively queries shadow DOMs for elements matching the selector
 * @param {string} selector - CSS selector to match
 * @param {Element|Document} root - Root element to start search from
 * @param {Object} options - Query options
 * @param {boolean} options.shallow - Only search one level deep
 * @returns {Element[]} - Array of matching elements
 */
export function deepQuerySelectorAll(selector, root = document, options = {}) {
  const { shallow = false } = options;

  // Query the light DOM first
  const lightResults = Array.from(root.querySelectorAll(selector));

  // If shallow, stop here
  if (shallow) return lightResults;

  // Find all elements with shadow roots
  const elementsWithShadowRoots = Array.from(root.querySelectorAll('*'))
    .filter(el => el.shadowRoot)
    .map(el => el.shadowRoot);

  // Recursively query each shadow root
  const shadowResults = elementsWithShadowRoots.flatMap(shadowRoot =>
    deepQuerySelectorAll(selector, shadowRoot, options)
  );

  // Combine results
  return [...lightResults, ...shadowResults];
}

/**
 * Gets the first matching element from shadow DOM or light DOM
 * @param {string} selector - CSS selector to match
 * @param {Element|Document} root - Root element to start search from
 * @param {Object} options - Query options
 * @returns {Element|null} - First matching element or null
 */
export function deepQuerySelector(selector, root = document, options = {}) {
  const results = deepQuerySelectorAll(selector, root, options);
  return results.length > 0 ? results[0] : null;
}

/**
 * Finds elements by role in both light and shadow DOM
 * @param {string} role - ARIA role to search for
 * @param {Element|Document} root - Root element to start search from
 * @param {Object} options - Additional options
 * @returns {Element[]} - Elements with matching role
 */
export function queryShadowRole(role, root = document, options = {}) {
  // Search for role attribute
  const directRoleSelector = `[role="${role}"]`;
  const directResults = deepQuerySelectorAll(directRoleSelector, root, options);

  // Also search for elements with implicit roles
  const implicitRoleSelectors = getImplicitRoleSelectors(role);
  const implicitResults = implicitRoleSelectors.flatMap(selector =>
    deepQuerySelectorAll(selector, root, options)
  );

  return [...directResults, ...implicitResults];
}

/**
 * Gets the active element path through shadow DOM
 * @returns {Element[]} - Path of active elements from document to deepest shadow
 */
export function getActiveElementPath() {
  const path = [];
  let activeElement = document.activeElement;

  while (activeElement) {
    path.push(activeElement);
    if (activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
      activeElement = activeElement.shadowRoot.activeElement;
    } else {
      break;
    }
  }

  return path;
}

/**
 * Gets the deepest active element in the shadow DOM
 * @returns {Element} - The deepest active element
 */
export function getDeepActiveElement() {
  const path = getActiveElementPath();
  return path[path.length - 1];
}

/**
 * Helper function to get selectors for elements with implicit roles
 * This is a simplified version - shadow-dom-testing-library has more comprehensive mappings
 */
function getImplicitRoleSelectors(role) {
  const roleMap = {
    button: ['button', 'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]'],
    textbox: ['input[type="text"]', 'input:not([type])', 'textarea'],
    link: ['a[href]'],
    heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    checkbox: ['input[type="checkbox"]'],
    radio: ['input[type="radio"]'],
    img: ['img'],
    navigation: ['nav']
    // Add more as needed
  };

  return roleMap[role] || [];
}

/**
 * Simulates pressing Tab key to navigate focus, working with shadow DOM
 * @param {Object} options - Options for tabbing
 * @param {boolean} options.shift - Whether to simulate Shift+Tab
 */
export async function shadowTab(options = {}) {
  const { shift = false } = options;

  // Get the current active element
  const activeElement = getDeepActiveElement();

  // Dispatch a Tab keydown event
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    code: 'Tab',
    shiftKey: shift,
    bubbles: true,
    cancelable: true
  });

  activeElement.dispatchEvent(event);

  // Wait a tick for the focus to update
  await new Promise(resolve => setTimeout(resolve, 0));
}

// Export a screen object with all shadow DOM query functions
export const shadowScreen = {
  queryShadowRole,
  getDeepActiveElement,
  getActiveElementPath,
  shadowTab,
  deepQuerySelector,
  deepQuerySelectorAll
};
