import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock URL constructor
global.URL = class URL {
  constructor(path, base) {
    this.path = path;
    this.base = base;
    this.toString = () => `${base}${path}`;
  }
};

// Mock fetch for template loading
global.fetch = vi.fn(url => {
  return Promise.resolve({
    ok: true,
    bodyUsed: false,
    text: () => {
      if (url.includes('error-template.html')) {
        return Promise.resolve('<div class="error">Invalid or expired event link</div>');
      }
      return Promise.resolve(`
                <style>@import './styles.css';</style>
                <h1 id="event-title"></h1>
                <div class="event-details">
                    <p><strong>Date:</strong> <span id="event-date"></span></p>
                    <p><strong>Time:</strong> <span id="event-time"></span></p>
                    <p><strong>Location:</strong> <span id="event-location"></span></p>
                    <p id="event-description-container" class="hidden">
                        <strong>Description:</strong>
                        <span id="event-description"></span>
                    </p>
                </div>
            `);
    }
  });
});

// Mock templateUtils
vi.mock('../utils/templateUtils.js', () => ({
  loadTemplate: vi.fn().mockImplementation(async path => {
    if (path.includes('error-template.html')) {
      return '<div class="error">Invalid or expired event link</div>';
    }
    return `
            <style>@import './styles.css';</style>
            <h1 id="event-title"></h1>
            <div class="event-details">
                <p><strong>Date:</strong> <span id="event-date"></span></p>
                <p><strong>Time:</strong> <span id="event-time"></span></p>
                <p><strong>Location:</strong> <span id="event-location"></span></p>
                <p id="event-description-container" class="hidden">
                    <strong>Description:</strong>
                    <span id="event-description"></span>
                </p>
            </div>
        `;
  })
}));
