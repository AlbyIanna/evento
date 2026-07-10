import { formatDate, formatTime } from './services/date/dateService.js';
import { encodeEventData, decodeEventData, validateEventData } from './utils/eventUtils.js';
import { setLoading, toggleContainers } from './utils/uiUtils.js';
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

// DOM elements (will be set in initApp)
let eventForm, eventView, linkReady, createEventContainer, viewEventContainer, linkReadyContainer;

// The event currently being edited — kept so a re-encode (update or cancel)
// preserves its updates pointer instead of minting a new channel
let currentEditEvent = null;

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

    if (e.detail.isEdit) {
      // Never generate a new channel on edit: old-link holders can only be
      // reached through the pointer already embedded in their payload
      if (currentEditEvent?.updates) {
        eventData.updates = currentEditEvent.updates;
      }
      // Preserve a cancellation across edits — editing must not silently
      // un-cancel an event for everyone holding the link
      if (currentEditEvent?.status === 'cancelled') {
        eventData.status = 'cancelled';
      }
    } else if (formData.get('updatable') === 'on') {
      eventData.updates = generateUpdateChannel();
    }

    // Validate event data
    if (!validateEventData(eventData)) throw new Error('Invalid event data');

    // Encode event data
    const encodedEvent = encodeEventData(eventData);

    // Publish exactly once, on the post-create/edit view (never on ordinary
    // views, which could clobber a newer relay version with an old payload).
    // Gate on ownsChannel: only a channel this browser actually minted (pk
    // AND d) may be signed for.
    if (eventData.updates && ownsChannel(eventData.updates)) {
      markPendingPublish(encodedEvent);
    }
    // Private links carry the payload in the fragment, which browsers never
    // send to any server — so no preview card, no server-side copy
    const isPrivate = formData.get('private') === 'on';

    if (e.detail.isEdit) {
      // Navigate to the event view page with edit permission
      window.location.href = isPrivate
        ? `${window.location.origin}/event?canEdit#${encodedEvent}`
        : `${window.location.origin}/event/${encodedEvent}?canEdit`;
    } else {
      // A brand-new event gets the "your link is ready" screen first: the
      // link is the only way back to the event, so it must be impossible
      // to miss before anything else happens.
      showLinkReady(eventData, encodedEvent, isPrivate);
    }
  } catch (error) {
    console.error('Form submission error:', error);
    eventForm.showError('Failed to create event link. Please try again.');
  } finally {
    appState.setState({ isLoading: false });
  }
}

function showLinkReady(eventData, encodedEvent, isPrivate) {
  const origin = window.location.origin;
  const shareUrl = isPrivate
    ? `${origin}/event#${encodedEvent}`
    : `${origin}/event/${encodedEvent}`;
  const viewUrl = isPrivate
    ? `${origin}/event?canEdit#${encodedEvent}`
    : `${origin}/event/${encodedEvent}?canEdit`;

  // Organizer capability URL: the channel secret rides in the FRAGMENT
  // (never sent to any server, same rule as private payloads), so opening
  // it on another device imports the key and that device can manage the
  // event too.
  let organizerUrl = null;
  if (eventData.updates) {
    const secret = exportChannelSecret(eventData.updates);
    if (secret) {
      organizerUrl = isPrivate
        ? `${origin}/event?canEdit#${encodedEvent}&org=${secret}`
        : `${origin}/event/${encodedEvent}?canEdit#org=${secret}`;
    }
  }

  linkReady.setLinks({ title: eventData.title, shareUrl, viewUrl, organizerUrl });
  toggleContainers(createEventContainer, linkReadyContainer, 'link-ready');

  // Keep the address bar holding the event while this screen is up: an
  // accidental refresh must not destroy the only copy of the link before
  // the user saved it. replaceState navigates nothing, so the screen stays.
  try {
    window.history.replaceState(null, '', viewUrl);
  } catch {
    // history unavailable: the on-screen link is still there to copy
  }
}

/**
 * Fragment grammar. The fragment can carry two '&'-separated things: the
 * event payload (private links) and the organizer key ('org=<64-hex>').
 * Payloads use base64url plus the legacy '+' — never '&' or '=' — so the
 * two segment kinds cannot be confused.
 */
export function parseFragment(hash) {
  let payload = '';
  let orgKey = null;
  for (const part of hash.split('&')) {
    if (part.startsWith('org=')) {
      orgKey = part.slice('org='.length);
    } else if (part && !payload) {
      payload = part;
    }
  }
  return { payload, orgKey };
}

// Removes the organizer secret from the address bar, keeping the payload
// when it is fragment-carried. replaceState never fires hashchange, so no
// re-routing happens.
function stripOrganizerKeyFromUrl(fragmentPayload) {
  const cleanUrl =
    window.location.pathname +
    window.location.search +
    (fragmentPayload ? `#${fragmentPayload}` : '');
  try {
    window.history.replaceState(null, '', cleanUrl);
  } catch {
    // history unavailable: the fragment still never reaches any server
  }
}

function formatForDisplay(eventData) {
  const formattedEventData = { ...eventData };
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
  return formattedEventData;
}

// Fire-and-forget: on the post-create/edit view publish the pending version
// (this browser just authored it), otherwise check relays for a newer signed
// version. Never throws into the render path — with relays unreachable the
// original payload stands.
function checkForUpdates(eventData, encodedEvent) {
  void (async () => {
    try {
      if (peekPendingPublish(encodedEvent) && ownsChannel(eventData.updates)) {
        // We just authored this version; publish it and don't fetch (a
        // lagging relay could otherwise echo an older version back onto us).
        const published = await publishCurrentVersion(eventData, encodedEvent);
        if (published.ok) {
          clearPendingPublish();
          if (published.ackCount < published.relayCount) {
            // Honest report: the change landed, but only on part of the
            // relay set — don't claim a full publish.
            eventView.showPublishPartial?.(published.ackCount, published.relayCount);
          }
        } else {
          // Leave the gate armed so reopening the link retries, and tell the
          // organizer the change hasn't propagated yet.
          eventView.showPublishWarning?.();
        }
        return;
      }
      const latest = await fetchLatestUpdate(eventData.updates);
      if (latest && latest.encoded !== encodedEvent) {
        eventView.applyUpdate?.(formatForDisplay(latest.event), latest.encoded);
      }
    } catch (err) {
      console.error('Update check failed:', err);
    }
  })();
}

export function displayEvent(encodedEvent, orgKey = null) {
  if (appState.getState('isLoading')) return;

  try {
    appState.setState({ isLoading: true });
    const eventData = decodeEventData(encodedEvent);

    // Validate event data
    if (!validateEventData(eventData)) {
      throw new Error('Invalid event data');
    }

    // Update event view
    eventView.setEventData(formatForDisplay(eventData));
    toggleContainers(createEventContainer, viewEventContainer, 'view');

    if (eventData.updates) {
      if (orgKey !== null && importChannelSecret(orgKey, eventData.updates)) {
        // Organizer capability URL: the key matches this event's channel
        // and is now in this browser's localStorage.
        eventView.showOrganizerImported?.();
      } else if (!ownsChannel(eventData.updates)) {
        // We cannot know whether this viewer is the organizer, so the
        // honest move is a discreet pointer to the organizer link.
        eventView.showOrganizerHint?.();
      }
      checkForUpdates(eventData, encodedEvent);
    }
  } catch (err) {
    console.error('Failed to decode event:', err);
    eventView.showError();
  } finally {
    appState.setState({ isLoading: false });
  }
}

export async function editEvent(encodedEvent) {
  if (appState.getState('isLoading')) return;

  try {
    appState.setState({ isLoading: true });
    const urlEvent = decodeEventData(encodedEvent);

    // Validate event data
    if (!validateEventData(urlEvent)) {
      throw new Error('Invalid event data');
    }

    // Edit from the freshest verified version when we own the channel, so an
    // edit (or cancel) launched from an old link can't clobber a newer
    // published version. Falls back to the URL payload if relays are silent.
    let baseEvent = urlEvent;
    if (urlEvent.updates && ownsChannel(urlEvent.updates)) {
      const latest = await fetchLatestUpdate(urlEvent.updates);
      if (latest) {
        baseEvent = latest.event;
      }
    }

    currentEditEvent = baseEvent;

    // Configure the form for edit mode
    eventForm.setEditMode(true);
    eventForm.setEventData(baseEvent);
    // Private iff the payload is carried in the fragment (no path payload):
    // a stray '#x' on a public /event/<payload> URL must not flip privacy
    eventForm.setPrivateLink?.(window.location.pathname === '/event/edit');
    eventForm.setUpdatableLink?.(Boolean(baseEvent.updates));
    // Cancelling requires the channel's signing key, which never leaves the
    // creator's browser — so the option only appears on that device
    eventForm.setCanCancel?.(Boolean(baseEvent.updates && ownsChannel(baseEvent.updates)));
    eventForm.setCancelledNotice?.(baseEvent.status === 'cancelled');
    toggleContainers(viewEventContainer, createEventContainer, 'create');
    document.querySelector('#create-event h1').textContent = 'Edit Event';
  } catch (err) {
    console.error('Failed to decode event for editing:', err);
    eventView.showError();
  } finally {
    appState.setState({ isLoading: false });
  }
}

export function handleCancelEvent() {
  if (!currentEditEvent) return;

  try {
    const cancelledEvent = { ...currentEditEvent, status: 'cancelled' };
    const encodedEvent = encodeEventData(cancelledEvent);
    markPendingPublish(encodedEvent);

    // Keep the carrier currently in use: '/event/edit' means the payload
    // travels in the fragment (private link), otherwise in the path
    const isPrivate = window.location.pathname === '/event/edit';
    const shareUrl = isPrivate
      ? `${window.location.origin}/event?canEdit#${encodedEvent}`
      : `${window.location.origin}/event/${encodedEvent}?canEdit`;

    window.location.href = shareUrl;
  } catch (error) {
    console.error('Cancel event error:', error);
    eventForm.showError?.('Failed to cancel the event. Please try again.');
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
  linkReadyContainer = document.getElementById('link-ready');
  eventForm = document.querySelector('event-form');
  eventView = document.querySelector('event-view');
  linkReady = document.querySelector('link-ready');

  // Set up state subscriptions
  setupStateSubscriptions();

  // Handle initial routing
  const handleInitialRouting = () => {
    const path = window.location.pathname;
    const hash = (window.location.hash || '').slice(1);
    if (path === '/event' || path.startsWith('/event/')) {
      const { payload: fragmentPayload, orgKey } = parseFragment(hash);
      const isEdit = path.endsWith('/edit');
      let encodedEvent = path.startsWith('/event/') ? path.slice('/event/'.length) : '';
      if (encodedEvent === 'edit') {
        // '/event/edit' has no path payload — the event is in the fragment
        encodedEvent = '';
      } else if (encodedEvent.endsWith('/edit')) {
        encodedEvent = encodedEvent.slice(0, -'/edit'.length);
      }
      let payloadInFragment = false;
      if (!encodedEvent && fragmentPayload) {
        encodedEvent = fragmentPayload;
        payloadInFragment = true;
      }
      if (orgKey !== null) {
        // The secret must not linger in the address bar (or leak into
        // copy/share/edit URLs built from it): strip it before rendering.
        stripOrganizerKeyFromUrl(payloadInFragment ? encodedEvent : '');
      }
      if (isEdit) {
        editEvent(encodedEvent);
      } else {
        displayEvent(encodedEvent, orgKey);
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
  const cancelEventListener = () => handleCancelEvent();

  eventForm.addEventListener('submit', formSubmitListener);
  eventForm.addEventListener('cancel-event', cancelEventListener);

  // Return a cleanup function that can be called when needed
  return () => {
    document.removeEventListener('DOMContentLoaded', handleInitialRouting);
    window.removeEventListener('hashchange', handleInitialRouting);
    eventForm.removeEventListener('submit', formSubmitListener);
    eventForm.removeEventListener('cancel-event', cancelEventListener);
  };
}
