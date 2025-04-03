import { vi } from 'vitest';
import { axe } from 'jest-axe';
import fs from 'fs';
import path from 'path';

/**
 * Loads a template file from a component directory
 * @param {string} componentDir - The component directory path
 * @param {string} templateFile - The template file name (e.g., 'template.html')
 * @returns {string} The template content
 */
export function loadComponentTemplate(componentDir, templateFile) {
  return fs.readFileSync(path.resolve(componentDir, templateFile), 'utf8');
}

/**
 * Creates a mock for the templateUtils module
 * @param {Object} templates - Object mapping template names to content
 * @returns {Object} Mocked templateUtils module
 */
export function mockTemplateUtils(templates) {
  return {
    loadTemplate: vi.fn(async path => {
      if (path.includes('template.html')) {
        if (path.includes('error-template.html')) {
          return templates.errorTemplate || '<div>Error template</div>';
        } else {
          return templates.mainTemplate || '<div>Main template</div>';
        }
      }
      return '<div>Fallback content</div>';
    })
  };
}

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
