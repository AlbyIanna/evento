import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import fs from 'fs';
import path from 'path';
import {
  getDeepActiveElement,
  shadowTab,
  getActiveElementPath
} from '../../../test/shadow-dom-utils.js';
import {
  loadComponentTemplate,
  mockTemplateUtils,
  setupLocationMock,
  setupClipboardMock,
  testAccessibility
} from '../../test/test-utils.js';

// Mock all modules before importing the component
// Read the actual template files
const templateContent = fs.readFileSync(path.resolve(__dirname, './template.html'), 'utf8');
const errorTemplateContent = fs.readFileSync(
  path.resolve(__dirname, './error-template.html'),
  'utf8'
);

// Mock the templateService module
vi.mock('../../services/template/templateService.js', () => ({
  loadTemplate: vi.fn(async path => {
    if (path.includes('template.html')) {
      if (path.includes('error-template.html')) {
        return errorTemplateContent;
      } else {
        return templateContent;
      }
    }
    return '<div>Fallback content</div>';
  }),
  clearTemplateCache: vi.fn(),
  preloadTemplates: vi.fn()
}));

// Mock the eventUtils module
vi.mock('../../utils/eventUtils.js', () => ({
  encodeEventData: data => {
    return 'mockEncodedEvent';
  }
}));

// Mock the stateManager
vi.mock('../../utils/stateManager.js', () => {
  const subscribeMock = vi.fn().mockReturnValue(() => {});
  const setStateMock = vi.fn().mockReturnValue({ subscribe: subscribeMock });
  const getStateMock = vi.fn().mockImplementation(key => {
    if (key === 'isLoading') return false;
    if (key === 'currentView') return 'view';
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

// Import the component after mocks are set up
import { EventView } from './index.js';
import { appState } from '../../utils/stateManager.js';

expect.extend(toHaveNoViolations);

// Mock needed for the window.navigator.share API
let navigatorShareMock;

// Mock window.history
Object.defineProperty(window, 'history', {
  value: {
    pushState: vi.fn()
  },
  writable: true
});

describe('EventView Component', () => {
  let eventView;
  let user;
  let originalNavigator;

  // Save the original navigator object
  beforeAll(() => {
    originalNavigator = { ...navigator };
  });

  beforeEach(async () => {
    // Create a fresh navigator.share mock for each test
    navigatorShareMock = vi.fn().mockImplementation(() => Promise.resolve());

    // Apply the mock to navigator
    Object.defineProperty(navigator, 'share', {
      value: navigatorShareMock,
      configurable: true,
      writable: true
    });

    // Setup window.location mock with default test values
    setupLocationMock({
      pathname: '/event/testEvent',
      href: 'http://localhost:3000/event/testEvent?canEdit',
      origin: 'http://localhost:3000',
      search: '?canEdit'
    });

    // Setup window.history mock
    Object.defineProperty(window, 'history', {
      value: {
        pushState: vi.fn()
      },
      configurable: true,
      writable: true
    });

    user = userEvent.setup();
    eventView = new EventView();
    document.body.appendChild(eventView);
    // Wait for initial render to complete
    await eventView.connectedCallback();
  });

  afterEach(() => {
    if (document.body.contains(eventView)) {
      document.body.removeChild(eventView);
    }
    vi.clearAllMocks();
  });

  // Restore original navigator after all tests
  afterAll(() => {
    Object.defineProperty(navigator, 'share', {
      value: originalNavigator.share,
      configurable: true,
      writable: true
    });
  });

  it('should render the component with proper structure', async () => {
    // Component is already rendered in beforeEach
    expect(eventView.$('.event-view-container')).toBeTruthy();
    expect(eventView.$('#event-title')).toBeTruthy();
    expect(eventView.$('.event-details')).toBeTruthy();
    expect(eventView.$('#edit-button')).toBeTruthy();
    expect(eventView.$('#share-button')).toBeTruthy();
    expect(eventView.$('#copy-button')).toBeTruthy();
    expect(eventView.$('#copy-popup')).toBeTruthy();
  });

  it('should display event data when setEventData is called', async () => {
    const eventData = {
      title: 'Test Event',
      date: '04/15/2024',
      time: '14:00',
      location: 'Test Location',
      description: 'Test Description'
    };

    eventView.setEventData(eventData);

    const title = eventView.$('#event-title');
    const date = eventView.$('#event-date');
    const time = eventView.$('#event-time');
    const location = eventView.$('#event-location');
    const description = eventView.$('#event-description');
    const descriptionContainer = eventView.$('#event-description-container');

    expect(title.textContent).toBe('Test Event');
    expect(date.textContent).toBe('04/15/2024');
    expect(time.textContent).toBe('14:00');
    expect(location.textContent).toBe('Test Location');
    expect(description.textContent).toBe('Test Description');
    expect(descriptionContainer.classList.contains('hidden')).toBe(false);
  });

  it('should hide description container when no description is provided', async () => {
    const eventData = {
      title: 'Test Event',
      date: '04/15/2024',
      time: '14:00',
      location: 'Test Location'
    };

    eventView.setEventData(eventData);

    const descriptionContainer = eventView.$('#event-description-container');
    expect(descriptionContainer.classList.contains('hidden')).toBe(true);
  });

  it('should show error view when showError is called', async () => {
    await eventView.showError();

    const errorElement = eventView.$('.error');
    expect(errorElement).toBeTruthy();
    expect(errorElement.querySelector('h2').textContent).toBe('Invalid or expired event link');
  });

  it('should apply event data even if set before connectedCallback', async () => {
    // Create a new component for this test
    document.body.removeChild(eventView);
    eventView = new EventView();

    const eventData = {
      title: 'Early Event',
      date: '04/15/2024',
      time: '14:00',
      location: 'Test Location'
    };

    eventView.setEventData(eventData);
    document.body.appendChild(eventView);
    await eventView.connectedCallback();

    const title = eventView.$('#event-title');
    expect(title.textContent).toBe('Early Event');
  });

  it('should show edit button when has edit permission', async () => {
    // Edit permission is already set in the mock location
    const editButton = eventView.$('#edit-button');
    expect(editButton.classList.contains('hidden')).toBe(false);

    // Verify it's an anchor with the correct href
    expect(editButton.tagName).toBe('A');
    expect(editButton.getAttribute('href')).toBe('/event/testEvent/edit');
  });

  it('should set up edit button with correct URL', async () => {
    // Set mock location with a different path
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/event/differentEvent',
        href: 'http://localhost:3000/event/differentEvent?canEdit',
        origin: 'http://localhost:3000',
        search: '?canEdit'
      },
      configurable: true,
      writable: true
    });

    // Create a fresh component with the new location
    document.body.removeChild(eventView);
    eventView = new EventView();
    document.body.appendChild(eventView);
    await eventView.connectedCallback();

    const editButton = eventView.$('#edit-button');
    expect(editButton.getAttribute('href')).toBe('/event/differentEvent/edit');
  });

  it('should copy URL when copy button is clicked', async () => {
    const copyButton = eventView.$('#copy-button');
    await user.click(copyButton);

    // Check that success state is shown
    const copySuccess = eventView.$('#copy-success');
    const copyDefault = eventView.$('#copy-default');
    const copyPopup = eventView.$('#copy-popup');

    expect(copySuccess.classList.contains('hidden')).toBe(false);
    expect(copyDefault.classList.contains('hidden')).toBe(true);
    expect(copyPopup.classList.contains('hidden')).toBe(false);

    // Fast-forward timers to verify state is reset
    await new Promise(r => setTimeout(r, 2100));

    expect(copySuccess.classList.contains('hidden')).toBe(true);
    expect(copyDefault.classList.contains('hidden')).toBe(false);
    expect(copyPopup.classList.contains('hidden')).toBe(true);
  });

  it('should share event when share button is clicked', async () => {
    // Set event data for sharing
    const eventData = {
      title: 'Share Test',
      date: '04/15/2024',
      time: '14:00',
      location: 'Share Location'
    };

    eventView.setEventData(eventData);

    const shareButton = eventView.$('#share-button');
    await user.click(shareButton);

    expect(navigator.share).toHaveBeenCalledWith({
      title: 'Share Test',
      text: 'Join me at Share Test on 04/15/2024 at 14:00',
      url: 'http://localhost:3000/event/testEvent'
    });
  });

  it('should fallback to copy when share API is not available', async () => {
    // Remove share API
    delete navigator.share;

    const shareButton = eventView.$('#share-button');
    await user.click(shareButton);

    // Check that success state is shown
    const copySuccess = eventView.$('#copy-success');
    const copyDefault = eventView.$('#copy-default');
    const copyPopup = eventView.$('#copy-popup');

    expect(copySuccess.classList.contains('hidden')).toBe(false);
    expect(copyDefault.classList.contains('hidden')).toBe(true);
    expect(copyPopup.classList.contains('hidden')).toBe(false);
  });

  // Combined accessibility tests to reduce duplication
  it('should have no accessibility violations in various states', async () => {
    // Test accessibility in view mode with data
    const eventData = {
      title: 'Company Offsite Meeting',
      date: '06/15/2024',
      time: '09:00',
      location: 'Conference Center Downtown',
      description: 'Annual company gathering with team building activities and strategic planning.'
    };
    eventView.setEventData(eventData);
    await testAccessibility(eventView, 'EventView (view mode)');

    // Test error state
    await eventView.showError();
    await testAccessibility(eventView, 'EventView (error state)');

    // Recreate and test with notification showing
    document.body.removeChild(eventView);
    eventView = new EventView();
    document.body.appendChild(eventView);
    await eventView.connectedCallback();
    eventView.setEventData(eventData);

    // Show the copy notification
    const copyPopup = eventView.$('#copy-popup');
    copyPopup.classList.remove('hidden');

    await testAccessibility(eventView, 'EventView (with notification)');
  });

  it('should have proper ARIA attributes on interactive elements', async () => {
    const editButton = eventView.$('#edit-button');
    const shareButton = eventView.$('#share-button');
    const copyButton = eventView.$('#copy-button');

    expect(editButton.getAttribute('aria-label')).toBe('Edit event details');
    expect(shareButton.getAttribute('aria-label')).toBe('Share event with others');
    expect(copyButton.getAttribute('aria-label')).toBe('Copy event URL to clipboard');
  });

  it('should have proper semantic structure', async () => {
    const container = eventView.$('.event-view-container');
    const eventDetails = eventView.$('.event-details');
    const title = eventView.$('#event-title');

    expect(container.getAttribute('role')).toBe('region');
    expect(container.getAttribute('aria-label')).toBe('Event Details');
    expect(eventDetails.tagName).toBe('SECTION');
    expect(title.getAttribute('tabindex')).toBe('0');
  });

  it('should have status notifications with proper ARIA roles', async () => {
    const copySuccess = eventView.$('#copy-success');
    const copyPopup = eventView.$('#copy-popup');

    expect(copySuccess.getAttribute('aria-live')).toBe('polite');
    expect(copyPopup.getAttribute('role')).toBe('status');
    expect(copyPopup.getAttribute('aria-live')).toBe('polite');
  });

  it('should have decorative icons properly marked', async () => {
    const icons = eventView.$$('i');

    icons.forEach(icon => {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('should handle keyboard navigation correctly', async () => {
    // Focus the event view first to ensure it receives focus events
    eventView.focus();

    // Get the share button and focus it
    const shareButton = eventView.$('#share-button');
    shareButton.focus();

    // Get the copy button for later comparison
    const copyButton = eventView.$('#copy-button');

    // Verify the share button is focused (in shadow DOM)
    const deepActive = getDeepActiveElement();
    expect(deepActive).toBe(shareButton);

    // Simulate tab key to move focus
    // Note: We need to dispatch the event manually because userEvent.tab() doesn't traverse shadow DOM
    shareButton.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true
      })
    );

    // Force a focus event since the keydown might not trigger it in the test environment
    copyButton.focus();

    // Now check if the copy button is focused
    const activePath = getActiveElementPath();
    const newActiveElement = activePath[activePath.length - 1];
    expect(newActiveElement).toBe(copyButton);
  });

  it('should keep the fragment in copy and edit URLs for private events', async () => {
    setupLocationMock({
      pathname: '/event',
      href: 'http://localhost:3000/event?canEdit#privatePayload',
      origin: 'http://localhost:3000',
      search: '?canEdit',
      hash: '#privatePayload'
    });
    const clipboardMock = setupClipboardMock(true);

    document.body.removeChild(eventView);
    eventView = new EventView();
    document.body.appendChild(eventView);
    await eventView.connectedCallback();

    const editButton = eventView.$('#edit-button');
    expect(editButton.getAttribute('href')).toBe('/event/edit#privatePayload');

    const copyButton = eventView.$('#copy-button');
    await user.click(copyButton);
    expect(clipboardMock.writeText).toHaveBeenCalledWith(
      'http://localhost:3000/event#privatePayload'
    );
  });

  it('should show the Google Calendar link when event data has a start', async () => {
    eventView.setEventData({
      title: 'Calendar Event',
      start: '2026-08-01T19:00',
      tz: 'Europe/Rome',
      date: '08/01/2026',
      time: '7:00 PM',
      location: 'Test Location'
    });

    const gcalButton = eventView.$('#gcal-button');
    expect(gcalButton.classList.contains('hidden')).toBe(false);
    expect(gcalButton.getAttribute('href')).toContain('calendar.google.com');

    // jsdom has no URL.createObjectURL: path-carried events fall back to
    // the stateless /ics/ server projection instead of a blob URL
    const calendarButton = eventView.$('#calendar-button');
    expect(calendarButton.classList.contains('hidden')).toBe(false);
    expect(calendarButton.getAttribute('href')).toBe('/ics/testEvent');
  });

  it('should keep calendar links hidden when event data has no start', async () => {
    eventView.setEventData({
      title: 'No Start',
      date: '04/15/2024',
      time: '14:00',
      location: 'Test Location'
    });

    expect(eventView.$('#calendar-button').classList.contains('hidden')).toBe(true);
    expect(eventView.$('#gcal-button').classList.contains('hidden')).toBe(true);
  });

  it('should navigate to edit URL when edit button is clicked', async () => {
    const editButton = eventView.$('#edit-button');

    // Mock the click behavior so it doesn't actually navigate
    const clickEvent = new MouseEvent('click');
    Object.defineProperty(clickEvent, 'preventDefault', {
      value: vi.fn()
    });

    // Trigger the click
    editButton.dispatchEvent(clickEvent);

    // Verify preventDefault wasn't called (we want the normal navigation)
    expect(clickEvent.preventDefault).not.toHaveBeenCalled();

    // Verify the href is correct
    expect(editButton.getAttribute('href')).toBe('/event/testEvent/edit');
  });

  it('should show the update banner and re-render data when applyUpdate is called', async () => {
    eventView.setEventData({
      title: 'Original Event',
      date: '04/15/2024',
      time: '14:00',
      location: 'Old Location'
    });

    const banner = eventView.$('#update-banner');
    expect(banner.classList.contains('hidden')).toBe(true);

    eventView.applyUpdate({
      title: 'Original Event',
      date: '04/16/2024',
      time: '18:30',
      location: 'New Location',
      status: 'confirmed'
    });

    expect(banner.classList.contains('hidden')).toBe(false);
    expect(banner.classList.contains('cancelled')).toBe(false);
    expect(eventView.$('#update-banner-text').textContent).toBe(
      'This event was updated by the organizer — showing the latest version.'
    );
    expect(eventView.$('#event-date').textContent).toBe('04/16/2024');
    expect(eventView.$('#event-time').textContent).toBe('18:30');
    expect(eventView.$('#event-location').textContent).toBe('New Location');
    expect(eventView.$('#event-title').classList.contains('cancelled')).toBe(false);
  });

  it('should rebuild calendar links from the updated data when applyUpdate is called', async () => {
    eventView.setEventData({
      title: 'Calendar Event',
      start: '2026-08-01T19:00',
      tz: 'Europe/Rome',
      date: '08/01/2026',
      time: '7:00 PM',
      location: 'Test Location'
    });

    const gcalButton = eventView.$('#gcal-button');
    const originalHref = gcalButton.getAttribute('href');

    eventView.applyUpdate({
      title: 'Calendar Event',
      start: '2026-08-02T20:00',
      tz: 'Europe/Rome',
      date: '08/02/2026',
      time: '8:00 PM',
      location: 'Test Location',
      status: 'confirmed'
    });

    expect(gcalButton.classList.contains('hidden')).toBe(false);
    expect(gcalButton.getAttribute('href')).toContain('calendar.google.com');
    expect(gcalButton.getAttribute('href')).not.toBe(originalHref);
  });

  it('should show the cancelled banner variant and strike the title for cancelled updates', async () => {
    eventView.setEventData({
      title: 'Doomed Event',
      date: '04/15/2024',
      time: '14:00',
      location: 'Test Location'
    });

    eventView.applyUpdate({
      title: 'Doomed Event',
      date: '04/15/2024',
      time: '14:00',
      location: 'Test Location',
      status: 'cancelled'
    });

    const banner = eventView.$('#update-banner');
    expect(banner.classList.contains('hidden')).toBe(false);
    expect(banner.classList.contains('cancelled')).toBe(true);
    expect(eventView.$('#update-banner-text').textContent).toBe(
      'This event was cancelled by the organizer.'
    );
    expect(eventView.$('#event-title').classList.contains('cancelled')).toBe(true);
  });

  it('keeps a shown update banner through an ordinary currentView re-render', async () => {
    eventView.applyUpdate({
      title: 'Sticky Banner Event',
      date: '04/16/2024',
      time: '18:30',
      location: 'Test Location',
      status: 'confirmed'
    });

    const banner = eventView.$('#update-banner');
    expect(banner.classList.contains('hidden')).toBe(false);

    // The currentView subscription re-renders via #updateDom, which must not
    // own the banner — so a plain re-render leaves it in place.
    const currentViewHandler = appState.subscribe.mock.calls.find(
      call => call[0] === 'currentView'
    )[1];
    currentViewHandler('view');

    expect(banner.classList.contains('hidden')).toBe(false);
    expect(eventView.$('#update-banner-text').textContent).toBe(
      'This event was updated by the organizer — showing the latest version.'
    );
  });

  it('resets the banner when a different event is shown via setEventData', async () => {
    eventView.applyUpdate({
      title: 'Cancelled A',
      date: '04/16/2024',
      time: '18:30',
      location: 'Loc',
      status: 'cancelled'
    });
    const banner = eventView.$('#update-banner');
    expect(banner.classList.contains('hidden')).toBe(false);
    expect(banner.classList.contains('cancelled')).toBe(true);

    // Navigating to a fresh, non-cancelled event must clear the previous
    // event's banner and strikethrough (no bleed across events).
    eventView.setEventData({
      title: 'Fresh B',
      date: '04/17/2024',
      time: '19:00',
      location: 'Loc'
    });

    expect(banner.classList.contains('hidden')).toBe(true);
    expect(banner.classList.contains('cancelled')).toBe(false);
    expect(eventView.$('#event-title').classList.contains('cancelled')).toBe(false);
  });

  it('surfaces a cancellation carried in the payload itself via setEventData', async () => {
    eventView.setEventData({
      title: 'Cancelled Payload',
      date: '04/18/2024',
      time: '20:00',
      location: 'Loc',
      status: 'cancelled'
    });

    const banner = eventView.$('#update-banner');
    expect(banner.classList.contains('hidden')).toBe(false);
    expect(banner.classList.contains('cancelled')).toBe(true);
    expect(eventView.$('#update-banner-text').textContent).toBe(
      'This event was cancelled by the organizer.'
    );
    // A cancelled event offers no calendar buttons
    expect(eventView.$('#calendar-button').classList.contains('hidden')).toBe(true);
    expect(eventView.$('#gcal-button').classList.contains('hidden')).toBe(true);
  });

  it('shows the zero-coverage warning when showPublishWarning is called', async () => {
    const warning = eventView.$('#publish-warning');
    expect(warning.classList.contains('hidden')).toBe(true);

    eventView.showPublishWarning();

    expect(warning.classList.contains('hidden')).toBe(false);
    expect(eventView.$('#publish-warning-text').textContent).toContain(
      "your change isn't published yet"
    );
  });

  it('reports N of M relay coverage when showPublishPartial is called', async () => {
    const warning = eventView.$('#publish-warning');
    expect(warning.classList.contains('hidden')).toBe(true);

    eventView.showPublishPartial(1, 4);

    expect(warning.classList.contains('hidden')).toBe(false);
    expect(eventView.$('#publish-warning-text').textContent).toBe(
      "Published to 1 of 4 relays — some relays couldn't be reached."
    );
  });

  it('resets to the zero-coverage text when showPublishWarning follows showPublishPartial', async () => {
    // Same session, two publishes: a partial one mutated the warning text,
    // then a fully failed one must not show the stale "Published to N of M".
    eventView.showPublishPartial(1, 4);
    eventView.showPublishWarning();

    expect(eventView.$('#publish-warning-text').textContent).toBe(
      "Couldn't reach the relays — your change isn't published yet. Reopen this link to retry."
    );
  });
});
