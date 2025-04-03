import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseComponent } from './baseComponent.js';
import { loadTemplate } from '../services/template/templateService.js';

// Mock the templateService module
vi.mock('../services/template/templateService.js', () => ({
  loadTemplate: vi.fn().mockResolvedValue('<div id="test-template">Test Template</div>'),
  clearTemplateCache: vi.fn(),
  preloadTemplates: vi.fn()
}));

// Create a test component that extends BaseComponent
class TestComponent extends BaseComponent {
  constructor() {
    super();
    this.setupCalled = false;
  }

  async connectedCallback() {
    await this.loadTemplate('/test-template.html');
    this.setup();
  }

  setup() {
    this.setupCalled = true;
    const button = this.$('#test-button');
    if (button) {
      this.listen(button, 'click', this.handleClick);
    }
  }

  handleClick() {
    // Test method
  }
}

// Register the custom element
customElements.define('test-component', TestComponent);

describe('BaseComponent', () => {
  let component;

  beforeEach(() => {
    component = new TestComponent();
    document.body.appendChild(component);
  });

  afterEach(() => {
    if (document.body.contains(component)) {
      document.body.removeChild(component);
    }
    vi.clearAllMocks();
  });

  it('should create a shadow DOM when instantiated', () => {
    expect(component.shadowRoot).toBeTruthy();
    expect(component.shadowRoot.mode).toBe('open');
  });

  it('should load a template into the shadow DOM', async () => {
    await component.connectedCallback();

    expect(loadTemplate).toHaveBeenCalledWith('/test-template.html');
    expect(component.shadowRoot.innerHTML).toBe('<div id="test-template">Test Template</div>');
  });

  it('should provide a $ method for querying the shadow DOM', async () => {
    // Set up shadow DOM with a test element
    component.shadowRoot.innerHTML = '<div id="test-element">Test</div>';

    const element = component.$('#test-element');
    expect(element).toBeTruthy();
    expect(element.textContent).toBe('Test');
  });

  it('should provide a $$ method for querying multiple elements in the shadow DOM', async () => {
    // Set up shadow DOM with test elements
    component.shadowRoot.innerHTML = `
      <div class="test-class">Test 1</div>
      <div class="test-class">Test 2</div>
    `;

    const elements = component.$$('.test-class');
    expect(elements).toHaveLength(2);
    expect(elements[0].textContent).toBe('Test 1');
    expect(elements[1].textContent).toBe('Test 2');
  });

  it('should add event listeners with automatic cleanup', async () => {
    // Create a test element and add it to the shadow DOM
    const button = document.createElement('button');
    button.id = 'test-button';
    component.shadowRoot.appendChild(button);

    // Spy on addEventListener and removeEventListener
    const addEventListenerSpy = vi.spyOn(button, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(button, 'removeEventListener');

    // Call the listen method
    const handler = () => {};
    component.listen(button, 'click', handler);

    // Verify addEventListener was called
    expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler, undefined);

    // Simulate disconnectedCallback
    component.disconnectedCallback();

    // Verify removeEventListener was called
    expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler, undefined);
  });

  it('should clean up all registered functions when disconnected', async () => {
    // Create mock cleanup functions
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    // Register cleanup functions
    component.addCleanup(cleanup1);
    component.addCleanup(cleanup2);

    // Simulate disconnectedCallback
    component.disconnectedCallback();

    // Verify cleanup functions were called
    expect(cleanup1).toHaveBeenCalled();
    expect(cleanup2).toHaveBeenCalled();
  });

  it('should handle errors in cleanup functions', async () => {
    // Create a cleanup function that throws an error
    const errorCleanup = vi.fn().mockImplementation(() => {
      throw new Error('Cleanup error');
    });

    // Create a normal cleanup function
    const normalCleanup = vi.fn();

    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Register cleanup functions
    component.addCleanup(errorCleanup);
    component.addCleanup(normalCleanup);

    // Simulate disconnectedCallback
    component.disconnectedCallback();

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Verify both cleanup functions were attempted
    expect(errorCleanup).toHaveBeenCalled();
    expect(normalCleanup).toHaveBeenCalled();

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  it('should ignore non-function cleanup handlers', async () => {
    // Add various non-function values
    component.addCleanup('string');
    component.addCleanup(123);
    component.addCleanup(null);
    component.addCleanup(undefined);
    component.addCleanup({});

    // Add a real function
    const cleanup = vi.fn();
    component.addCleanup(cleanup);

    // Simulate disconnectedCallback
    component.disconnectedCallback();

    // Only the real function should be called
    expect(cleanup).toHaveBeenCalled();
  });

  it('should return the component instance from listen for chaining', async () => {
    // Create a test element
    const button = document.createElement('button');
    component.shadowRoot.appendChild(button);

    // Call listen and check return value
    const result = component.listen(button, 'click', () => {});
    expect(result).toBe(component);

    // Test chaining
    const button2 = document.createElement('button');
    component.shadowRoot.appendChild(button2);

    // Spy on addEventListener to verify chaining works
    const addEventListenerSpy1 = vi.spyOn(button, 'addEventListener');
    const addEventListenerSpy2 = vi.spyOn(button2, 'addEventListener');

    component.listen(button, 'click', () => {}).listen(button2, 'click', () => {});

    // Verify both event listeners were added
    expect(addEventListenerSpy1).toHaveBeenCalled();
    expect(addEventListenerSpy2).toHaveBeenCalled();
  });
});
