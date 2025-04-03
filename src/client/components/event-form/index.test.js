import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import fs from 'fs';
import path from 'path';
import {
  loadComponentTemplate,
  mockTemplateUtils,
  setupLocationMock,
  testAccessibility
} from '../../test/test-utils.js';

// Read the actual template file
const templateContent = fs.readFileSync(path.resolve(__dirname, './template.html'), 'utf8');

// Mock the templateService module
vi.mock('../../services/template/templateService.js', () => ({
  loadTemplate: vi.fn(async path => {
    if (path.includes('template.html')) {
      return templateContent;
    }
    return '<div>Fallback content</div>';
  }),
  clearTemplateCache: vi.fn(),
  preloadTemplates: vi.fn()
}));

// Mock the stateManager
vi.mock('../../utils/stateManager.js', () => {
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

// Import the component after mocks are set up
import { EventForm } from './index.js';
import userEvent from '@testing-library/user-event';
import { appState } from '../../utils/stateManager.js';

expect.extend(toHaveNoViolations);

describe('EventForm Component', () => {
  let eventForm;
  let user;

  beforeEach(async () => {
    // Setup window.location mock with default values
    setupLocationMock();

    user = userEvent.setup();
    eventForm = new EventForm();
    document.body.appendChild(eventForm);
    // Wait for initial render to complete
    await eventForm.connectedCallback();
  });

  afterEach(() => {
    if (document.body.contains(eventForm)) {
      document.body.removeChild(eventForm);
    }
    vi.clearAllMocks();
  });

  it('should render the form with create button in create mode', async () => {
    const createButton = eventForm.$('#create-button');
    const updateButton = eventForm.$('#update-button');
    const cancelButton = eventForm.$('#cancel-button');

    expect(createButton.classList.contains('hidden')).toBe(false);
    expect(updateButton.classList.contains('hidden')).toBe(true);
    expect(cancelButton.classList.contains('hidden')).toBe(true);
  });

  it('should render the form with update and cancel buttons in edit mode', async () => {
    // Set edit mode
    eventForm.setEditMode(true);

    const createButton = eventForm.$('#create-button');
    const updateButton = eventForm.$('#update-button');
    const cancelButton = eventForm.$('#cancel-button');

    expect(createButton.classList.contains('hidden')).toBe(true);
    expect(updateButton.classList.contains('hidden')).toBe(false);
    expect(cancelButton.classList.contains('hidden')).toBe(false);
  });

  it('should set cancel button href correctly in edit mode when at /event/xyz/edit', async () => {
    // Set up a mock edit URL
    setupLocationMock({
      pathname: '/event/abc123/edit',
      href: 'http://localhost:3000/event/abc123/edit'
    });

    // Create a new form and set edit mode
    document.body.removeChild(eventForm);
    eventForm = new EventForm();
    eventForm.setEditMode(true);
    document.body.appendChild(eventForm);
    await eventForm.connectedCallback();

    const cancelButton = eventForm.$('#cancel-button');
    expect(cancelButton.getAttribute('href')).toBe('/event/abc123');
  });

  it('should fill the form with event data in edit mode', async () => {
    const eventData = {
      title: 'Test Event',
      datetime: '2024-06-15T14:00',
      location: 'Test Location',
      description: 'Test Description'
    };

    // Set edit mode and event data
    eventForm.setEditMode(true);
    eventForm.setEventData(eventData);

    // Check form fields
    const titleInput = eventForm.$('#title');
    const datetimeInput = eventForm.$('#datetime');
    const locationInput = eventForm.$('#location');
    const descriptionInput = eventForm.$('#description');

    expect(titleInput.value).toBe('Test Event');
    expect(datetimeInput.value).toBe('2024-06-15T14:00');
    expect(locationInput.value).toBe('Test Location');
    expect(descriptionInput.value).toBe('Test Description');
  });

  it('should convert date and time to datetime format when filling the form', async () => {
    const eventData = {
      title: 'Test Event',
      date: 'June 15, 2024',
      time: '14:00',
      location: 'Test Location',
      description: 'Test Description'
    };

    // Mock Date constructor for consistent results
    const mockDate = new Date('2024-06-15T14:00:00');
    const originalDateConstructor = global.Date;
    global.Date = vi.fn(() => mockDate);
    global.Date.prototype = originalDateConstructor.prototype;

    // Set edit mode and event data
    eventForm.setEditMode(true);
    eventForm.setEventData(eventData);

    // Restore original Date constructor
    global.Date = originalDateConstructor;

    // Check datetime input
    const datetimeInput = eventForm.$('#datetime');
    expect(datetimeInput.value).toMatch(/2024-06-15T14:00/);
  });

  it('should include isEdit flag in submit event when in edit mode', async () => {
    // Create a mock for the custom event dispatch
    const dispatchEventSpy = vi.spyOn(eventForm, 'dispatchEvent');

    // Set edit mode
    eventForm.setEditMode(true);

    // Fill out the form
    const form = eventForm.$('#event-form');
    const titleInput = eventForm.$('#title');
    const datetimeInput = eventForm.$('#datetime');
    const locationInput = eventForm.$('#location');

    titleInput.value = 'Test Event';
    datetimeInput.value = '2099-06-15T14:00';
    locationInput.value = 'Test Location';

    // Submit the form
    form.dispatchEvent(new Event('submit'));

    // Check that the custom event was dispatched with isEdit flag
    expect(dispatchEventSpy).toHaveBeenCalled();
    const customEvent = dispatchEventSpy.mock.calls[0][0];
    expect(customEvent.type).toBe('submit');
    expect(customEvent.detail.isEdit).toBe(true);
  });

  // Combined accessibility tests
  it('should have no accessibility violations in both modes', async () => {
    // Test in create mode
    await testAccessibility(eventForm, 'EventForm (create mode)');

    // Test in edit mode
    eventForm.setEditMode(true);
    await testAccessibility(eventForm, 'EventForm (edit mode)');
  });
});
