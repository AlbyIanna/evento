/**
 * Simple state management utility for the Evento application
 * Provides a centralized store for application state with subscription capabilities
 */
export class StateManager {
  #state = {};
  #listeners = new Map();

  /**
   * Create a new StateManager instance
   * @param {Object} initialState - Initial state values
   */
  constructor(initialState = {}) {
    this.#state = { ...initialState };
  }

  /**
   * Get current state value(s)
   * @param {string} [key] - Specific state key to retrieve (returns all state if omitted)
   * @returns {*} The requested state value or entire state object
   */
  getState(key) {
    return key ? this.#state[key] : { ...this.#state };
  }

  /**
   * Update state values and notify subscribers
   * @param {Object} updates - Object containing state updates
   * @returns {StateManager} This instance for chaining
   */
  setState(updates) {
    const changedKeys = [];

    // Update state and track which keys changed
    Object.entries(updates).forEach(([key, value]) => {
      if (this.#state[key] !== value) {
        this.#state[key] = value;
        changedKeys.push(key);
      }
    });

    // Notify listeners of changes
    changedKeys.forEach(key => {
      if (this.#listeners.has(key)) {
        this.#listeners.get(key).forEach(callback => callback(this.#state[key]));
      }
    });

    return this;
  }

  /**
   * Subscribe to state changes for a specific key
   * @param {string} key - State key to subscribe to
   * @param {Function} callback - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.#listeners.has(key)) {
      this.#listeners.set(key, new Set());
    }
    this.#listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.#listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.#listeners.delete(key);
        }
      }
    };
  }
}

// Create and export a singleton instance
export const appState = new StateManager({
  isLoading: false,
  currentView: 'create' // 'create' or 'view'
  // Add other initial state as needed
});
