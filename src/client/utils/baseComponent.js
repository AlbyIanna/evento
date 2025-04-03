/**
 * Base component class that provides common functionality for web components
 * Includes utilities for DOM manipulation, event handling, and lifecycle management
 */
import { loadTemplate } from '../services/template/templateService.js';

export class BaseComponent extends HTMLElement {
  // Store cleanup functions
  #cleanupFunctions = [];

  /**
   * Create a new BaseComponent instance
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Add a cleanup function to be called on disconnection
   * @param {Function} cleanupFn - Function to call during cleanup
   */
  addCleanup(cleanupFn) {
    if (typeof cleanupFn === 'function') {
      this.#cleanupFunctions.push(cleanupFn);
    }
  }

  /**
   * Query selector shorthand for shadow DOM
   * @param {string} selector - CSS selector
   * @returns {Element|null} The first matching element or null
   */
  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  /**
   * Query selector all shorthand for shadow DOM
   * @param {string} selector - CSS selector
   * @returns {NodeList} List of matching elements
   */
  $$(selector) {
    return this.shadowRoot.querySelectorAll(selector);
  }

  /**
   * Add event listener with automatic cleanup
   * @param {Element} element - Element to attach listener to
   * @param {string} eventType - Event type (e.g., 'click')
   * @param {Function} handler - Event handler function
   * @param {Object} [options] - Event listener options
   * @returns {BaseComponent} This instance for chaining
   */
  listen(element, eventType, handler, options) {
    element.addEventListener(eventType, handler, options);
    this.addCleanup(() => element.removeEventListener(eventType, handler, options));
    return this;
  }

  /**
   * Load a template into the shadow DOM
   * @param {string} path - Path to the template file
   * @returns {Promise<boolean>} Success status
   */
  async loadTemplate(path) {
    try {
      const template = await loadTemplate(path);
      this.shadowRoot.innerHTML = template;
      return true;
    } catch (error) {
      console.error(`Failed to load template: ${path}`, error);
      return false;
    }
  }

  /**
   * Clean up all registered functions when component is removed
   * This is automatically called by the browser when the element is removed from the DOM
   */
  disconnectedCallback() {
    this.#cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });
    this.#cleanupFunctions = [];
  }
}
