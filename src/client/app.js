import { formatDate, formatTime } from './utils/dateUtils.js';
import { encodeEventData, decodeEventData, validateEventData } from './utils/eventUtils.js';
import { setLoading, toggleContainers } from './utils/uiUtils.js';
import { appState } from './utils/stateManager.js';

// DOM elements (will be set in initApp)
let eventForm, eventView, createEventContainer, viewEventContainer;

export function handleFormSubmit(e) {
  if (appState.getState('isLoading')) return;

  try {
    appState.setState({ isLoading: true });
    const { formData } = e.detail;
    const eventData = {
      title: formData.get('title').trim(),
      start: formData.get('datetime'),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: formData.get('location').trim(),
      description: formData.get('description').trim()
    };

    // Validate event data
    if (!validateEventData(eventData)) throw new Error('Invalid event data');

    // Encode event data
    const encodedEvent = encodeEventData(eventData);
    // Private links carry the payload in the fragment, which browsers never
    // send to any server — so no preview card, no server-side copy
    const isPrivate = formData.get('private') === 'on';
    const shareUrl = isPrivate
      ? `${window.location.origin}/event?canEdit#${encodedEvent}`
      : `${window.location.origin}/event/${encodedEvent}?canEdit`;

    // Navigate to the event view page with edit permission
    window.location.href = shareUrl;
  } catch (error) {
    console.error('Form submission error:', error);
    eventForm.showError('Failed to create event link. Please try again.');
  } finally {
    appState.setState({ isLoading: false });
  }
}

export function displayEvent(encodedEvent) {
  if (appState.getState('isLoading')) return;

  try {
    appState.setState({ isLoading: true });
    const eventData = decodeEventData(encodedEvent);

    // Validate event data
    if (!validateEventData(eventData)) {
      throw new Error('Invalid event data');
    }

    // Format date if needed
    let formattedEventData = { ...eventData };
    const start = eventData.start || eventData.datetime;
    if (start) {
      if (eventData.tz && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(start)) {
        // v2 events: start is the wall-clock time in the event's own
        // timezone — display it as-is, without viewer-local conversion.
        formattedEventData.date = formatDate(start);
        formattedEventData.time = formatTime(start.slice(11, 16));
      } else {
        // Legacy v1 events keep their historical "floating time" rendering.
        const datetime = new Date(start);
        formattedEventData.date = formatDate(datetime.toISOString());
        formattedEventData.time = formatTime(datetime.toTimeString().split(' ')[0]);
      }
    }

    // Update event view
    eventView.setEventData(formattedEventData);
    toggleContainers(createEventContainer, viewEventContainer, 'view');
  } catch (err) {
    console.error('Failed to decode event:', err);
    eventView.showError();
  } finally {
    appState.setState({ isLoading: false });
  }
}

export function editEvent(encodedEvent) {
  if (appState.getState('isLoading')) return;

  try {
    appState.setState({ isLoading: true });
    const eventData = decodeEventData(encodedEvent);

    // Validate event data
    if (!validateEventData(eventData)) {
      throw new Error('Invalid event data');
    }

    // Configure the form for edit mode
    eventForm.setEditMode(true);
    eventForm.setEventData(eventData);
    // Private iff the payload is carried in the fragment (no path payload):
    // a stray '#x' on a public /event/<payload> URL must not flip privacy
    eventForm.setPrivateLink?.(window.location.pathname === '/event/edit');
    toggleContainers(viewEventContainer, createEventContainer, 'create');
    document.querySelector('#create-event h1').textContent = 'Edit Event';
  } catch (err) {
    console.error('Failed to decode event for editing:', err);
    eventView.showError();
  } finally {
    appState.setState({ isLoading: false });
  }
}

// Subscribe to state changes
function setupStateSubscriptions() {
  // Subscribe to loading state changes
  appState.subscribe('isLoading', isLoading => {
    setLoading(isLoading);
  });

  // Add other subscriptions as needed
}

export function initApp() {
  // Query DOM elements
  createEventContainer = document.getElementById('create-event');
  viewEventContainer = document.getElementById('view-event');
  eventForm = document.querySelector('event-form');
  eventView = document.querySelector('event-view');

  // Set up state subscriptions
  setupStateSubscriptions();

  // Handle initial routing
  const handleInitialRouting = () => {
    const path = window.location.pathname;
    const hash = (window.location.hash || '').slice(1);
    if (path === '/event' || path.startsWith('/event/')) {
      const isEdit = path.endsWith('/edit');
      let encodedEvent = path.startsWith('/event/') ? path.slice('/event/'.length) : '';
      if (encodedEvent === 'edit') {
        // '/event/edit' has no path payload — the event is in the fragment
        encodedEvent = '';
      } else if (encodedEvent.endsWith('/edit')) {
        encodedEvent = encodedEvent.slice(0, -'/edit'.length);
      }
      if (!encodedEvent && hash) {
        encodedEvent = hash;
      }
      if (isEdit) {
        editEvent(encodedEvent);
      } else {
        displayEvent(encodedEvent);
      }
    }
  };

  // If DOM is already loaded, handle routing immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleInitialRouting);
  } else {
    handleInitialRouting();
  }

  // Private links differ only by fragment, so following one from an open
  // event is a same-document navigation: re-route on hash changes
  window.addEventListener('hashchange', handleInitialRouting);

  // Set up event listeners with proper cleanup
  const formSubmitListener = e => handleFormSubmit(e);

  eventForm.addEventListener('submit', formSubmitListener);

  // Return a cleanup function that can be called when needed
  return () => {
    document.removeEventListener('DOMContentLoaded', handleInitialRouting);
    window.removeEventListener('hashchange', handleInitialRouting);
    eventForm.removeEventListener('submit', formSubmitListener);
  };
}
