import { vi } from 'vitest';
import { axe } from 'jest-axe';

/**
 * Setup for the window.location mock
 * @param {Object} locationParams - Location parameters to set
 * @returns {void}
 */
export function setupLocationMock(locationParams = {}) {
  const defaultParams = {
    pathname: '/',
    href: 'http://localhost:3000/',
    origin: 'http://localhost:3000',
    search: ''
  };

  Object.defineProperty(window, 'location', {
    value: { ...defaultParams, ...locationParams },
    configurable: true,
    writable: true
  });
}

/**
 * Setup for the clipboard API mock
 * @param {boolean} shouldSucceed - Whether the clipboard operation should succeed
 * @returns {Object} The mocked navigator.clipboard
 */
export function setupClipboardMock(shouldSucceed = true) {
  const clipboardMock = {
    writeText: shouldSucceed
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new Error('Clipboard error'))
  };

  Object.defineProperty(navigator, 'clipboard', {
    value: clipboardMock,
    configurable: true,
    writable: true
  });

  return clipboardMock;
}

/**
 * Run accessibility tests on a component
 * @param {HTMLElement} component - The component to test
 * @param {string} name - Name of the component for logging
 * @returns {Promise<void>}
 */
export async function testAccessibility(component, name) {
  const results = await axe(component);
  expect(results).toHaveNoViolations();
  console.log(`✓ ${name} has no accessibility violations`);
}
