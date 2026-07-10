import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import fs from 'fs';
import path from 'path';
import { setupLocationMock, setupClipboardMock, testAccessibility } from '../../test/test-utils.js';

// Read the actual template file so the test exercises the real markup
const templateContent = fs.readFileSync(path.resolve(__dirname, './template.html'), 'utf8');

// Mock the templateService module
vi.mock('../../services/template/templateService.js', () => ({
  loadTemplate: vi.fn(async () => templateContent),
  clearTemplateCache: vi.fn(),
  preloadTemplates: vi.fn()
}));

// Import the component after mocks are set up
import { LinkReady } from './index.js';

expect.extend(toHaveNoViolations);

const LINKS = {
  title: 'Aperitivo in piazza',
  shareUrl: 'http://localhost:3000/event/encodedPayload',
  viewUrl: 'http://localhost:3000/event/encodedPayload?canEdit',
  organizerUrl: `http://localhost:3000/event/encodedPayload?canEdit#org=${'f'.repeat(64)}`
};

describe('LinkReady Component', () => {
  let linkReady;
  let clipboardMock;
  let navigatorShareMock;
  let originalNavigator;

  beforeAll(() => {
    originalNavigator = { ...navigator };
  });

  beforeEach(async () => {
    navigatorShareMock = vi.fn().mockImplementation(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', {
      value: navigatorShareMock,
      configurable: true,
      writable: true
    });
    clipboardMock = setupClipboardMock(true);

    linkReady = new LinkReady();
    document.body.appendChild(linkReady);
    await linkReady.connectedCallback();
  });

  afterEach(() => {
    if (document.body.contains(linkReady)) {
      document.body.removeChild(linkReady);
    }
    vi.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(navigator, 'share', {
      value: originalNavigator.share,
      configurable: true,
      writable: true
    });
  });

  it('should render the component with proper structure', () => {
    expect(linkReady.$('.link-ready-container')).toBeTruthy();
    expect(linkReady.$('#share-link')).toBeTruthy();
    expect(linkReady.$('.link-warning')).toBeTruthy();
    expect(linkReady.$('#share-button')).toBeTruthy();
    expect(linkReady.$('#copy-button')).toBeTruthy();
    expect(linkReady.$('#organizer-section')).toBeTruthy();
    expect(linkReady.$('#view-event-button')).toBeTruthy();
  });

  it('should warn that the link is the only way in, with no recovery', () => {
    const warning = linkReady.$('.link-warning');
    expect(warning.textContent).toContain('only');
    expect(warning.textContent).toContain('no recovery');
    expect(warning.getAttribute('role')).toBe('note');
  });

  it('should display the share link and wire the view-event action', () => {
    linkReady.setLinks(LINKS);

    expect(linkReady.$('#share-link').textContent).toBe(LINKS.shareUrl);
    expect(linkReady.$('#view-event-button').getAttribute('href')).toBe(LINKS.viewUrl);
  });

  it('should apply links even if set before connectedCallback', async () => {
    document.body.removeChild(linkReady);
    linkReady = new LinkReady();

    // The submit handler sets links synchronously; the template loads later.
    linkReady.setLinks(LINKS);
    document.body.appendChild(linkReady);
    await linkReady.connectedCallback();

    expect(linkReady.$('#share-link').textContent).toBe(LINKS.shareUrl);
    expect(linkReady.$('#organizer-section').classList.contains('hidden')).toBe(false);
  });

  it('should hide the organizer section when there is no organizer link', () => {
    linkReady.setLinks({ ...LINKS, organizerUrl: null });

    expect(linkReady.$('#organizer-section').classList.contains('hidden')).toBe(true);
    expect(linkReady.$('#organizer-link').textContent).toBe('');
  });

  it('should show the organizer link in its own section with the secrecy warning', () => {
    linkReady.setLinks(LINKS);

    const section = linkReady.$('#organizer-section');
    expect(section.classList.contains('hidden')).toBe(false);
    expect(linkReady.$('#organizer-link').textContent).toBe(LINKS.organizerUrl);
    expect(section.textContent).toContain('keep it secret');
    expect(section.textContent).toContain('edit or cancel the event');
    expect(section.textContent).toContain('treat it like a password');
  });

  it('should copy the share link when the copy button is clicked', async () => {
    linkReady.setLinks(LINKS);

    linkReady.$('#copy-button').click();
    await vi.waitFor(() =>
      expect(linkReady.$('#copy-success').classList.contains('hidden')).toBe(false)
    );

    expect(clipboardMock.writeText).toHaveBeenCalledWith(LINKS.shareUrl);
    expect(linkReady.$('#copy-default').classList.contains('hidden')).toBe(true);
  });

  it('should copy the organizer link when its copy button is clicked', async () => {
    linkReady.setLinks(LINKS);

    linkReady.$('#copy-organizer-button').click();
    await vi.waitFor(() =>
      expect(linkReady.$('#copy-organizer-success').classList.contains('hidden')).toBe(false)
    );

    expect(clipboardMock.writeText).toHaveBeenCalledWith(LINKS.organizerUrl);
  });

  it('should share the SHARE link (never the organizer link) via the Web Share API', async () => {
    linkReady.setLinks(LINKS);

    linkReady.$('#share-button').click();

    expect(navigator.share).toHaveBeenCalledWith({
      title: LINKS.title,
      url: LINKS.shareUrl
    });
  });

  it('should fall back to copying when the Web Share API is not available', async () => {
    delete navigator.share;
    linkReady.setLinks(LINKS);

    linkReady.$('#share-button').click();
    await vi.waitFor(() => expect(clipboardMock.writeText).toHaveBeenCalledWith(LINKS.shareUrl));
  });

  it('should force a real load when the address bar already holds the view URL', () => {
    // The app replaceState's the address bar to viewUrl behind this screen;
    // for private links a plain anchor click would then be a no-op.
    setupLocationMock({
      pathname: '/event',
      href: LINKS.viewUrl,
      origin: 'http://localhost:3000',
      search: '?canEdit'
    });
    const reload = vi.fn();
    window.location.reload = reload;
    linkReady.setLinks(LINKS);

    const clickEvent = new MouseEvent('click', { cancelable: true });
    linkReady.$('#view-event-button').dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalled();
  });

  it('should navigate to the view URL when the address bar differs', () => {
    setupLocationMock({
      pathname: '/',
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      search: ''
    });
    linkReady.setLinks(LINKS);

    const clickEvent = new MouseEvent('click', { cancelable: true });
    linkReady.$('#view-event-button').dispatchEvent(clickEvent);

    // The mocked location accepts the assignment synchronously, which the
    // handler reads as a completed same-document navigation and reloads —
    // either way the browser ends up loading viewUrl.
    expect(window.location.href).toBe(LINKS.viewUrl);
  });

  it('should do nothing on copy/share before links are set', () => {
    linkReady.$('#copy-button').click();
    linkReady.$('#share-button').click();

    expect(clipboardMock.writeText).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it('should have decorative inline SVG icons properly marked', () => {
    const icons = linkReady.$$('svg.icon');
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach(icon => {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('focusable')).toBe('false');
    });
  });

  it('should not load any third-party resources from its template', () => {
    expect(linkReady.shadowRoot.querySelectorAll('link')).toHaveLength(0);
    expect(templateContent).not.toMatch(/https?:\/\//);
  });

  it('should have no accessibility violations with and without the organizer section', async () => {
    linkReady.setLinks(LINKS);
    await testAccessibility(linkReady, 'LinkReady (with organizer link)');

    linkReady.setLinks({ ...LINKS, organizerUrl: null });
    await testAccessibility(linkReady, 'LinkReady (share link only)');
  });
});
