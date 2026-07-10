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
    const shareUrl = `${window.location.origin}/event/${encodedEvent}?canEdit`;

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
    toggleContainers(viewEventContainer, createEventContainer, 'create');
    document.querySelector('#create-event h1').textContent = 'Edit Event';
  } catch (err) {
    console.error('Failed to decode event for editing:', err);
    eventView.showError();
  } finally {
    appState.setState({ isLoading: false });
  }
}

export function handleEventUpdated(e) {
  if (appState.getState('isLoading')) return;

  try {
    appState.setState({ isLoading: true });
    const { eventData } = e.detail;
    const encodedEvent = encodeEventData({
      ...eventData,
      start: eventData.start || eventData.datetime,
      tz: eventData.tz || Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    const shareUrl = `${window.location.origin}/event/${encodedEvent}?canEdit`;
    window.location.href = shareUrl;
  } catch (error) {
    console.error('Event update error:', error);
    eventView.showError('Failed to update event link. Please try again.');
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
    if (path.startsWith('/event/')) {
      const encodedEvent = path.split('/event/')[1].replace('/edit', '');
      if (path.endsWith('/edit')) {
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

  // Set up event listeners with proper cleanup
  const formSubmitListener = e => handleFormSubmit(e);
  const eventUpdatedListener = e => handleEventUpdated(e);

  eventForm.addEventListener('submit', formSubmitListener);
  eventView.addEventListener('event-updated', eventUpdatedListener);

  // Return a cleanup function that can be called when needed
  return () => {
    document.removeEventListener('DOMContentLoaded', handleInitialRouting);
    eventForm.removeEventListener('submit', formSubmitListener);
    eventView.removeEventListener('event-updated', eventUpdatedListener);
  };
}
