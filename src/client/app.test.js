import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupLocationMock } from './test/test-utils';
import { initApp } from './app.js';
import userEvent from '@testing-library/user-event';
import { encodeEventData } from './utils/eventUtils.js';
import { appState } from './utils/stateManager.js';

// --- Mocks for utility modules ---
vi.mock('./utils/dateUtils.js', () => ({
  formatDate: vi.fn(date => '01/01/2024'),
  formatTime: vi.fn(time => '12:00 PM')
}));

vi.mock('./utils/eventUtils.js', () => ({
  encodeEventData: vi.fn(data => 'encoded-event-data'),
  decodeEventData: vi.fn(encoded => ({
    title: 'Decoded Event',
    datetime: '2024-01-01T12:00',
    location: 'Test Location',
    description: 'Test Description'
  })),
  validateEventData: vi.fn(data => true)
}));

vi.mock('./utils/formUtils.js', () => ({
  clearErrors: vi.fn()
}));

vi.mock('./utils/uiUtils.js', () => ({
  setLoading: vi.fn(),
  toggleContainers: vi.fn((hide, show, viewState) => {
    hide.style.display = 'none';
    show.style.display = 'block';
  })
}));

// Mock the stateManager
vi.mock('./utils/stateManager.js', () => {
  const subscribeMock = vi.fn().mockReturnValue(() => {});
  const setStateMock = vi.fn().mockReturnValue({ subscribe: subscribeMock });
  const getStateMock = vi.fn().mockImplementation(key => {
    if (key === 'isLoading') return false;
    if (key === 'currentView') return 'create';
    return undefined;
  });

  return {
    appState: {
      subscribe: subscribeMock,
      setState: setStateMock,
      getState: getStateMock
    }
  };
});

// --- Helper to setup the DOM environment for tests ---
function setupDOM() {
  document.body.innerHTML = `
        <div id="create-event" class="container">
            <h1>Create Event</h1>
            <event-form></event-form>
        </div>
        <div id="view-event" class="container hidden">
            <event-view></event-view>
        </div>
    `;
  // Patch custom elements with expected methods before initApp runs
  const eventForm = document.querySelector('event-form');
  eventForm.setEditMode = vi.fn();
  eventForm.setEventData = vi.fn();
  const eventView = document.querySelector('event-view');
  eventView.setEventData = vi.fn();
  eventView.showError = vi.fn();
}

describe('App.js', () => {
  let toggleContainersMock;

  let cleanupFn;

  beforeEach(async () => {
    // Setup DOM with patched custom elements
    setupDOM();

    // Retrieve toggleContainers from the mocked uiUtils
    const uiUtils = await import('./utils/uiUtils.js');
    toggleContainersMock = uiUtils.toggleContainers;

    // Clear any previous mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Call cleanup function if it exists
    if (cleanupFn && typeof cleanupFn === 'function') {
      cleanupFn();
      cleanupFn = null;
    }
    vi.clearAllMocks();
  });

  it('should load event data when URL path is /event/:id', async () => {
    // Setup URL for this test
    setupLocationMock({
      pathname: '/event/test-event',
      href: 'http://localhost/event/test-event',
      origin: 'http://localhost',
      search: '?canEdit'
    });

    // Call initApp() AFTER location is set up
    cleanupFn = initApp();

    // Manually trigger DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Get the event-view element (which was patched in setupDOM)
    const eventView = document.querySelector('event-view');

    // Now, displayEvent should have been called and eventView.setEventData should be invoked
    expect(eventView.setEventData).toHaveBeenCalledWith({
      title: 'Decoded Event',
      datetime: '2024-01-01T12:00',
      location: 'Test Location',
      description: 'Test Description',
      // Date and time formatting come from mocked dateUtils
      date: '01/01/2024',
      time: '12:00 PM'
    });

    // Verify that toggleContainers was called to hide create and show view containers
    expect(toggleContainersMock).toHaveBeenCalledWith(
      document.getElementById('create-event'),
      document.getElementById('view-event'),
      'view'
    );

    // Verify that appState was updated for loading state
    expect(appState.setState).toHaveBeenCalledWith({ isLoading: true });
    expect(appState.setState).toHaveBeenCalledWith({ isLoading: false });
  });

  it('should enter edit mode when URL path is /event/:id/edit', async () => {
    // Setup URL for this test
    setupLocationMock({
      pathname: '/event/test-event/edit',
      href: 'http://localhost/event/test-event/edit',
      origin: 'http://localhost',
      search: '?canEdit'
    });

    // Call initApp() AFTER location is set up
    cleanupFn = initApp();

    // Manually trigger DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Get the event-form element (which was patched in setupDOM)
    const eventForm = document.querySelector('event-form');
    // Also get the page title element
    const title = document.querySelector('#create-event h1');

    // Verify that edit mode was enabled
    expect(eventForm.setEditMode).toHaveBeenCalledWith(true);

    // Verify that event data was set on the form
    expect(eventForm.setEventData).toHaveBeenCalledWith({
      title: 'Decoded Event',
      datetime: '2024-01-01T12:00',
      location: 'Test Location',
      description: 'Test Description'
    });

    // Verify that toggleContainers was called to show the form container
    expect(toggleContainersMock).toHaveBeenCalledTimes(1);
    expect(toggleContainersMock).toHaveBeenCalledWith(
      document.getElementById('view-event'),
      document.getElementById('create-event'),
      'create'
    );

    // Verify that appState was updated for loading state
    expect(appState.setState).toHaveBeenCalledWith({ isLoading: true });
    expect(appState.setState).toHaveBeenCalledWith({ isLoading: false });

    // Verify that the page title was updated for editing
    expect(title.textContent).toBe('Edit Event');
  });

  it('should handle form submission correctly', async () => {
    // Setup URL for this test
    setupLocationMock({
      pathname: '/',
      href: 'http://localhost/',
      origin: 'http://localhost',
      search: ''
    });

    // Call initApp() AFTER location is set up
    cleanupFn = initApp();

    // Create a FormData-like object using a Map
    const formData = new Map();
    formData.set('title', 'Test Event');
    formData.set('datetime', '2024-01-01T12:00');
    formData.set('location', 'Test Location');
    formData.set('description', 'Test Description');

    // Create a custom submit event
    const submitEvent = new CustomEvent('submit', {
      detail: {
        formData,
        isEdit: false
      },
      bubbles: true,
      cancelable: true
    });

    // Get the event-form element (with listener attached)
    const eventForm = document.querySelector('event-form');

    // Dispatch the submit event to trigger the form submission handler
    eventForm.dispatchEvent(submitEvent);

    // Verify that appState.getState is called to check loading state
    expect(appState.getState).toHaveBeenCalledWith('isLoading');

    // Verify that appState was updated for loading state
    expect(appState.setState).toHaveBeenCalledWith({ isLoading: true });

    // Check that the encodeEventData function was called with the correct data
    expect(encodeEventData).toHaveBeenCalledWith({
      title: 'Test Event',
      datetime: '2024-01-01T12:00',
      location: 'Test Location',
      description: 'Test Description'
    });

    // Check that window.location.href was updated correctly
    expect(window.location.href).toBe('http://localhost/event/encoded-event-data?canEdit');
  });
});
