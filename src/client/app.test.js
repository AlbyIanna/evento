import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupLocationMock } from './test/test-utils';
import { initApp, parseFragment } from './app.js';
import userEvent from '@testing-library/user-event';
import { encodeEventData, decodeEventData } from './utils/eventUtils.js';
import { appState } from './utils/stateManager.js';
import {
  generateUpdateChannel,
  ownsChannel,
  exportChannelSecret,
  importChannelSecret,
  markPendingPublish,
  peekPendingPublish,
  clearPendingPublish,
  publishCurrentVersion,
  fetchLatestUpdate
} from './services/updates/updatesService.js';

// --- Mocks for utility modules ---
vi.mock('./services/date/dateService.js', () => ({
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

vi.mock('./services/updates/updatesService.js', () => ({
  generateUpdateChannel: vi.fn(() => ({ pk: 'a'.repeat(64), d: 'channel-d' })),
  ownsChannel: vi.fn(() => true),
  exportChannelSecret: vi.fn(() => 'f'.repeat(64)),
  importChannelSecret: vi.fn(() => true),
  markPendingPublish: vi.fn(),
  peekPendingPublish: vi.fn(() => false),
  clearPendingPublish: vi.fn(),
  publishCurrentVersion: vi.fn(() => Promise.resolve({ ok: true, ackCount: 4, relayCount: 4 })),
  fetchLatestUpdate: vi.fn(() => Promise.resolve(null))
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
        <div id="link-ready" class="container hidden">
            <link-ready></link-ready>
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
  const linkReady = document.querySelector('link-ready');
  linkReady.setLinks = vi.fn();
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
      // Date and time formatting come from the mocked dateService
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
      start: '2024-01-01T12:00',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: 'Test Location',
      description: 'Test Description'
    });

    // A new event does NOT navigate away: it lands on the "your link is
    // ready" screen, which holds the only way back to the event.
    expect(window.location.href).toBe('http://localhost/');
    expect(document.querySelector('link-ready').setLinks).toHaveBeenCalledWith({
      title: 'Test Event',
      shareUrl: 'http://localhost/event/encoded-event-data',
      viewUrl: 'http://localhost/event/encoded-event-data?canEdit',
      organizerUrl: null
    });
    expect(toggleContainersMock).toHaveBeenCalledWith(
      document.getElementById('create-event'),
      document.getElementById('link-ready'),
      'link-ready'
    );
  });

  it('should put the payload in the fragment when the private option is checked', async () => {
    setupLocationMock({
      pathname: '/',
      href: 'http://localhost/',
      origin: 'http://localhost',
      search: ''
    });

    cleanupFn = initApp();

    const formData = new Map();
    formData.set('title', 'Test Event');
    formData.set('datetime', '2024-01-01T12:00');
    formData.set('location', 'Test Location');
    formData.set('description', 'Test Description');
    formData.set('private', 'on');

    const submitEvent = new CustomEvent('submit', {
      detail: { formData, isEdit: false },
      bubbles: true,
      cancelable: true
    });

    document.querySelector('event-form').dispatchEvent(submitEvent);

    expect(document.querySelector('link-ready').setLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        shareUrl: 'http://localhost/event#encoded-event-data',
        viewUrl: 'http://localhost/event?canEdit#encoded-event-data'
      })
    );
  });

  it('should hide the post-creation screen when a fragment navigation opens an event', async () => {
    setupLocationMock({
      pathname: '/',
      href: 'http://localhost/',
      origin: 'http://localhost',
      search: ''
    });
    cleanupFn = initApp();

    const formData = new Map();
    formData.set('title', 'Test Event');
    formData.set('datetime', '2024-01-01T12:00');
    formData.set('location', 'Test Location');
    formData.set('description', 'Test Description');
    document.querySelector('event-form').dispatchEvent(
      new CustomEvent('submit', {
        detail: { formData, isEdit: false },
        bubbles: true,
        cancelable: true
      })
    );

    // The real (here mocked) toggleContainers would have revealed the screen.
    const linkReadyContainer = document.getElementById('link-ready');
    linkReadyContainer.classList.remove('hidden');

    // Same-document navigation to a private event link: displayEvent must
    // hide the post-creation screen, or both screens would stack.
    setupLocationMock({
      pathname: '/event',
      href: 'http://localhost/event#fragment-event',
      origin: 'http://localhost',
      search: '',
      hash: '#fragment-event'
    });
    window.dispatchEvent(new Event('hashchange'));

    expect(document.querySelector('event-view').setEventData).toHaveBeenCalled();
    expect(linkReadyContainer.classList.contains('hidden')).toBe(true);
  });

  it('should load event data from the fragment when URL is /event#payload', async () => {
    setupLocationMock({
      pathname: '/event',
      href: 'http://localhost/event#fragment-event',
      origin: 'http://localhost',
      search: '',
      hash: '#fragment-event'
    });

    cleanupFn = initApp();
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const eventView = document.querySelector('event-view');
    expect(eventView.setEventData).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Decoded Event' })
    );
  });

  it('should enter edit mode from the fragment when URL is /event/edit#payload', async () => {
    setupLocationMock({
      pathname: '/event/edit',
      href: 'http://localhost/event/edit#fragment-event',
      origin: 'http://localhost',
      search: '?canEdit',
      hash: '#fragment-event'
    });

    cleanupFn = initApp();
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const eventForm = document.querySelector('event-form');
    expect(eventForm.setEditMode).toHaveBeenCalledWith(true);
    expect(eventForm.setEventData).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Decoded Event' })
    );
  });

  describe('update channel', () => {
    const updates = { pk: 'a'.repeat(64), d: 'channel-d' };

    const decodedWithUpdates = {
      title: 'Decoded Event',
      start: '2024-01-01T12:00',
      tz: 'Europe/Rome',
      location: 'Test Location',
      description: 'Test Description',
      status: 'confirmed',
      updates
    };

    function submitForm(fields, isEdit = false) {
      const formData = new Map(Object.entries(fields));
      const submitEvent = new CustomEvent('submit', {
        detail: { formData, isEdit },
        bubbles: true,
        cancelable: true
      });
      document.querySelector('event-form').dispatchEvent(submitEvent);
    }

    async function enterEditMode(pathname, hash) {
      setupLocationMock({
        pathname,
        href: `http://localhost${pathname}${hash || ''}`,
        origin: 'http://localhost',
        search: '?canEdit',
        hash: hash || ''
      });
      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));
      // editEvent is async (it awaits fetchLatestUpdate when the channel is
      // owned), so wait for the form to actually enter edit mode.
      await vi.waitFor(() =>
        expect(document.querySelector('event-form').setEditMode).toHaveBeenCalled()
      );
    }

    it('should generate an update channel when the updatable option is checked', async () => {
      setupLocationMock({
        pathname: '/',
        href: 'http://localhost/',
        origin: 'http://localhost',
        search: ''
      });
      cleanupFn = initApp();

      submitForm({
        title: 'Test Event',
        datetime: '2024-01-01T12:00',
        location: 'Test Location',
        description: 'Test Description',
        updatable: 'on'
      });

      expect(generateUpdateChannel).toHaveBeenCalledTimes(1);
      expect(encodeEventData).toHaveBeenCalledWith(expect.objectContaining({ updates }));
      expect(markPendingPublish).toHaveBeenCalledWith('encoded-event-data');
      // The post-creation screen carries the organizer capability URL with
      // the channel secret in the fragment (never sent to any server).
      expect(exportChannelSecret).toHaveBeenCalledWith(updates);
      expect(document.querySelector('link-ready').setLinks).toHaveBeenCalledWith(
        expect.objectContaining({
          shareUrl: 'http://localhost/event/encoded-event-data',
          organizerUrl: `http://localhost/event/encoded-event-data?canEdit#org=${'f'.repeat(64)}`
        })
      );
    });

    it('should keep the organizer key in the fragment for private updatable events', async () => {
      setupLocationMock({
        pathname: '/',
        href: 'http://localhost/',
        origin: 'http://localhost',
        search: ''
      });
      cleanupFn = initApp();

      submitForm({
        title: 'Test Event',
        datetime: '2024-01-01T12:00',
        location: 'Test Location',
        description: 'Test Description',
        private: 'on',
        updatable: 'on'
      });

      expect(document.querySelector('link-ready').setLinks).toHaveBeenCalledWith(
        expect.objectContaining({
          shareUrl: 'http://localhost/event#encoded-event-data',
          organizerUrl: `http://localhost/event?canEdit#encoded-event-data&org=${'f'.repeat(64)}`
        })
      );
    });

    it('should keep the event link in the address bar behind the post-creation screen', async () => {
      const replaceState = vi.fn();
      Object.defineProperty(window, 'history', {
        value: { replaceState },
        configurable: true,
        writable: true
      });
      setupLocationMock({
        pathname: '/',
        href: 'http://localhost/',
        origin: 'http://localhost',
        search: ''
      });
      cleanupFn = initApp();

      submitForm({
        title: 'Test Event',
        datetime: '2024-01-01T12:00',
        location: 'Test Location',
        description: 'Test Description',
        updatable: 'on'
      });

      // An accidental refresh on the "link ready" screen must not destroy
      // the only copy of the link: the address bar already holds the event.
      expect(replaceState).toHaveBeenCalledWith(
        null,
        '',
        'http://localhost/event/encoded-event-data?canEdit'
      );
    });

    it('should not build an organizer link when the channel secret is unavailable', async () => {
      exportChannelSecret.mockReturnValueOnce(null);
      setupLocationMock({
        pathname: '/',
        href: 'http://localhost/',
        origin: 'http://localhost',
        search: ''
      });
      cleanupFn = initApp();

      submitForm({
        title: 'Test Event',
        datetime: '2024-01-01T12:00',
        location: 'Test Location',
        description: 'Test Description',
        updatable: 'on'
      });

      expect(document.querySelector('link-ready').setLinks).toHaveBeenCalledWith(
        expect.objectContaining({ organizerUrl: null })
      );
    });

    it('should preserve the original updates pointer on edit without minting a new channel', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      await enterEditMode('/event/test-event/edit');

      submitForm(
        {
          title: 'Moved Event',
          datetime: '2024-01-02T18:00',
          location: 'New Location',
          description: 'Test Description'
        },
        true
      );

      expect(generateUpdateChannel).not.toHaveBeenCalled();
      expect(encodeEventData).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Moved Event', updates })
      );
      expect(markPendingPublish).toHaveBeenCalledWith('encoded-event-data');
    });

    it('should publish the pending version on the post-create view and not fetch', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      peekPendingPublish.mockReturnValueOnce(true);

      setupLocationMock({
        pathname: '/event/test-event',
        href: 'http://localhost/event/test-event',
        origin: 'http://localhost',
        search: ''
      });
      const eventView = document.querySelector('event-view');
      eventView.applyUpdate = vi.fn();
      eventView.showPublishPartial = vi.fn();

      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await vi.waitFor(() =>
        expect(publishCurrentVersion).toHaveBeenCalledWith(decodedWithUpdates, 'test-event')
      );
      await Promise.resolve();
      // We just authored this version: clear the gate, and never fetch (a
      // lagging relay could otherwise echo an older version back onto us).
      expect(clearPendingPublish).toHaveBeenCalled();
      expect(fetchLatestUpdate).not.toHaveBeenCalled();
      expect(eventView.applyUpdate).not.toHaveBeenCalled();
      // Full coverage: no partial-publish note.
      expect(eventView.showPublishPartial).not.toHaveBeenCalled();
    });

    it('should warn but keep the gate armed when publishing fails', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      peekPendingPublish.mockReturnValueOnce(true);
      publishCurrentVersion.mockResolvedValueOnce({ ok: false, ackCount: 0, relayCount: 4 });

      setupLocationMock({
        pathname: '/event/test-event',
        href: 'http://localhost/event/test-event',
        origin: 'http://localhost',
        search: ''
      });
      const eventView = document.querySelector('event-view');
      eventView.showPublishWarning = vi.fn();

      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await vi.waitFor(() => expect(eventView.showPublishWarning).toHaveBeenCalled());
      expect(clearPendingPublish).not.toHaveBeenCalled();
    });

    it('should report N of M coverage when the publish lands on only some relays', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      peekPendingPublish.mockReturnValueOnce(true);
      publishCurrentVersion.mockResolvedValueOnce({ ok: true, ackCount: 1, relayCount: 4 });

      setupLocationMock({
        pathname: '/event/test-event',
        href: 'http://localhost/event/test-event',
        origin: 'http://localhost',
        search: ''
      });
      const eventView = document.querySelector('event-view');
      eventView.showPublishPartial = vi.fn();
      eventView.showPublishWarning = vi.fn();

      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // The change IS published (gate cleared), but the organizer must not
      // hear an unqualified "published" when 3 of 4 relays missed it.
      await vi.waitFor(() => expect(eventView.showPublishPartial).toHaveBeenCalledWith(1, 4));
      expect(clearPendingPublish).toHaveBeenCalled();
      expect(eventView.showPublishWarning).not.toHaveBeenCalled();
    });

    it('should apply a newer relay version on an ordinary view', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      fetchLatestUpdate.mockResolvedValueOnce({
        event: { ...decodedWithUpdates, start: '2024-03-03T20:00' },
        createdAt: 1700000000,
        encoded: 'newer-encoded-data'
      });

      setupLocationMock({
        pathname: '/event/test-event',
        href: 'http://localhost/event/test-event',
        origin: 'http://localhost',
        search: ''
      });
      const eventView = document.querySelector('event-view');
      eventView.applyUpdate = vi.fn();

      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await vi.waitFor(() => {
        expect(eventView.applyUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            start: '2024-03-03T20:00',
            status: 'confirmed',
            date: '01/01/2024',
            time: '12:00 PM'
          }),
          'newer-encoded-data'
        );
      });
      expect(publishCurrentVersion).not.toHaveBeenCalled();
      expect(fetchLatestUpdate).toHaveBeenCalledWith(updates);
    });

    it('should render the original payload untouched when no newer version is found', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      // Default mocks: nothing pending, fetchLatestUpdate resolves null
      // (exactly what happens when relays are unreachable)

      setupLocationMock({
        pathname: '/event/test-event',
        href: 'http://localhost/event/test-event',
        origin: 'http://localhost',
        search: ''
      });
      const eventView = document.querySelector('event-view');
      eventView.applyUpdate = vi.fn();

      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      expect(eventView.setEventData).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Decoded Event' })
      );
      await vi.waitFor(() => expect(fetchLatestUpdate).toHaveBeenCalled());
      await Promise.resolve();
      expect(publishCurrentVersion).not.toHaveBeenCalled();
      expect(eventView.applyUpdate).not.toHaveBeenCalled();
    });

    it('should ignore a relay version identical to the current payload', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      fetchLatestUpdate.mockResolvedValueOnce({
        event: decodedWithUpdates,
        createdAt: 1700000000,
        encoded: 'test-event'
      });

      setupLocationMock({
        pathname: '/event/test-event',
        href: 'http://localhost/event/test-event',
        origin: 'http://localhost',
        search: ''
      });
      const eventView = document.querySelector('event-view');
      eventView.applyUpdate = vi.fn();

      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await vi.waitFor(() => expect(fetchLatestUpdate).toHaveBeenCalled());
      await Promise.resolve();
      expect(eventView.applyUpdate).not.toHaveBeenCalled();
    });

    it('should encode a cancelled payload and navigate on cancel-event', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      await enterEditMode('/event/test-event/edit');

      document.querySelector('event-form').dispatchEvent(new CustomEvent('cancel-event'));

      expect(encodeEventData).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Decoded Event', status: 'cancelled', updates })
      );
      expect(markPendingPublish).toHaveBeenCalledWith('encoded-event-data');
      expect(window.location.href).toBe('http://localhost/event/encoded-event-data?canEdit');
    });

    it('should keep the fragment carrier when cancelling a private-link event', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      await enterEditMode('/event/edit', '#fragment-event');

      document.querySelector('event-form').dispatchEvent(new CustomEvent('cancel-event'));

      expect(window.location.href).toBe('http://localhost/event?canEdit#encoded-event-data');
    });

    it('should tell the form about the update channel when entering edit mode', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      const eventForm = document.querySelector('event-form');
      eventForm.setUpdatableLink = vi.fn();
      eventForm.setCanCancel = vi.fn();

      await enterEditMode('/event/test-event/edit');

      expect(eventForm.setUpdatableLink).toHaveBeenCalledWith(true);
      expect(eventForm.setCanCancel).toHaveBeenCalledWith(true);
    });
  });

  describe('organizer capability URL', () => {
    const updates = { pk: 'a'.repeat(64), d: 'channel-d' };
    const secret = 'b'.repeat(64);

    const decodedWithUpdates = {
      title: 'Decoded Event',
      start: '2024-01-01T12:00',
      tz: 'Europe/Rome',
      location: 'Test Location',
      description: 'Test Description',
      status: 'confirmed',
      updates
    };

    let replaceState;

    beforeEach(() => {
      replaceState = vi.fn();
      Object.defineProperty(window, 'history', {
        value: { replaceState },
        configurable: true,
        writable: true
      });
    });

    function openView(pathname, hash) {
      setupLocationMock({
        pathname,
        href: `http://localhost${pathname}${hash || ''}`,
        origin: 'http://localhost',
        search: '',
        hash: hash || ''
      });
      cleanupFn = initApp();
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    it('imports the key, strips the secret from the URL and confirms', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      const eventView = document.querySelector('event-view');
      eventView.showOrganizerImported = vi.fn();

      openView('/event/test-event', `#org=${secret}`);

      expect(decodeEventData).toHaveBeenCalledWith('test-event');
      expect(importChannelSecret).toHaveBeenCalledWith(secret, updates);
      // The secret never lingers in the address bar.
      expect(replaceState).toHaveBeenCalledWith(null, '', '/event/test-event');
      expect(eventView.showOrganizerImported).toHaveBeenCalled();
    });

    it('keeps the fragment payload while stripping the key on a private organizer link', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      const eventView = document.querySelector('event-view');
      eventView.showOrganizerImported = vi.fn();

      openView('/event', `#fragment-event&org=${secret}`);

      expect(decodeEventData).toHaveBeenCalledWith('fragment-event');
      expect(importChannelSecret).toHaveBeenCalledWith(secret, updates);
      expect(replaceState).toHaveBeenCalledWith(null, '', '/event#fragment-event');
      expect(eventView.showOrganizerImported).toHaveBeenCalled();
    });

    it('does not confirm an import when the key does not match the channel', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      importChannelSecret.mockReturnValueOnce(false);
      ownsChannel.mockReturnValueOnce(false);
      const eventView = document.querySelector('event-view');
      eventView.showOrganizerImported = vi.fn();
      eventView.showOrganizerHint = vi.fn();

      openView('/event/test-event', `#org=${secret}`);

      expect(eventView.showOrganizerImported).not.toHaveBeenCalled();
      // The wrong secret is stripped from the URL all the same.
      expect(replaceState).toHaveBeenCalledWith(null, '', '/event/test-event');
      // Without the key, the device gets the discreet organizer hint.
      expect(eventView.showOrganizerHint).toHaveBeenCalled();
    });

    it('shows the discreet organizer hint when the device lacks the key', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      ownsChannel.mockReturnValueOnce(false);
      const eventView = document.querySelector('event-view');
      eventView.showOrganizerHint = vi.fn();

      openView('/event/test-event');

      expect(eventView.showOrganizerHint).toHaveBeenCalled();
      expect(replaceState).not.toHaveBeenCalled();
    });

    it('shows no hint when the device owns the channel', async () => {
      decodeEventData.mockReturnValueOnce(decodedWithUpdates);
      const eventView = document.querySelector('event-view');
      eventView.showOrganizerHint = vi.fn();

      openView('/event/test-event');

      expect(eventView.showOrganizerHint).not.toHaveBeenCalled();
    });
  });

  describe('parseFragment', () => {
    it('reads a plain payload fragment (private link)', () => {
      expect(parseFragment('someBase64_-Payload')).toEqual({
        payload: 'someBase64_-Payload',
        orgKey: null
      });
    });

    it('reads a lone organizer key (public organizer link)', () => {
      expect(parseFragment(`org=${'c'.repeat(64)}`)).toEqual({
        payload: '',
        orgKey: 'c'.repeat(64)
      });
    });

    it('reads payload and organizer key together (private organizer link)', () => {
      expect(parseFragment(`payload123&org=${'c'.repeat(64)}`)).toEqual({
        payload: 'payload123',
        orgKey: 'c'.repeat(64)
      });
    });

    it('returns empty results for an empty fragment', () => {
      expect(parseFragment('')).toEqual({ payload: '', orgKey: null });
    });
  });
});
