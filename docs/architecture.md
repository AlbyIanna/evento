# Evento - Architecture Documentation

## Overview

Evento is a modern event-sharing application built with a focus on simplicity, performance, and security. The application allows users to create, share, and view events through a clean, intuitive interface.

## System Architecture

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Client (Vite)  │◄───►│  Server (Fastify)│◄───►│  Static Assets  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Technology Stack

- **Frontend**: Vite + Vanilla JavaScript
- **Backend**: Fastify
- **Build Tools**: Vite, Terser, PostCSS
- **Testing**: Vitest
- **Code Quality**: ESLint, Prettier
- **Version Control**: Git with Husky pre-commit hooks

## Component Architecture

### Frontend Architecture

```
src/client/
├── components/           # Web Components
│   ├── event-form/      # Event creation/editing form
│   └── event-view/      # Event display component
├── services/            # Service layer
│   ├── date/           # Date helpers for the form
│   ├── template/       # Template management
│   ├── validation/     # Form validation
│   └── ui/             # UI utilities
├── utils/              # Utility functions
│   ├── baseComponent.js # Base Web Component class
│   ├── dateUtils.js    # Date formatting utilities
│   ├── eventUtils.js   # Event data utilities
│   ├── formUtils.js    # Form handling utilities
│   ├── stateManager.js # Application state management
│   ├── templateUtils.js # Template rendering utilities
│   └── uiUtils.js      # UI helper functions
└── styles.css          # Global styles
```

### Backend Architecture

```
src/
├── server.js           # Self-hostable Fastify instance
├── server.test.js      # Wiring tests (fastify.inject)
└── test/              # Test environment setup
    ├── setup.js
    └── shadow-dom-utils.js # Shadow DOM testing utilities
```

`src/server.js` is a complete self-hostable instance (`npm run build && npm start`): it serves the built SPA from `dist/` and replicates the stateless projections of the Netlify deployment — `/ics/<payload>` calendar downloads and envelope-only Open Graph cards for link-preview bots — reusing the same `src/shared` modules. In line with the zero-data principle, per-request logging is disabled and error logs never include URLs, since path-carried event payloads travel in them. There is no CORS layer (the service exposes no cross-origin API) and the CSP mirrors the one the build stamps into `index.html`.

### Shared Format & Serverless Projections

```
src/shared/             # Wire-format modules shared by client and functions
├── eventFormat.js      # Encode/decode/validate (spec: docs/event-format.md)
├── ics.js              # RFC 5545 export + Google Calendar links
├── preview.js          # Open Graph preview card (envelope only)
└── denylist.js         # Deployable abuse denylist

netlify/
├── functions/          # ics.js (GET /ics/<payload> → text/calendar), health.js
└── edge-functions/     # preview.js (OG cards served to link-preview bots)
```

## Key Components

### 1. Web Components

#### Event Form Component

- Handles event creation and editing
- Implements form validation
- Manages event data state
- Provides real-time feedback

#### Event View Component

- Displays event details
- Handles event sharing
- Manages edit permissions
- Implements error handling

### 2. Service Layer

#### Event Service

- Manages event data encoding/decoding
- Handles URL parameter processing
- Implements data validation
- Manages share functionality

#### Template Service

- Handles template loading and caching
- Manages template rendering
- Implements error handling for templates

#### Validation Service

- Implements form validation rules
- Provides validation feedback
- Manages error messages

#### UI Service

- Handles UI state management
- Manages loading states
- Implements error display
- Controls component visibility

### 3. Utility Layer

#### Base Component

- Provides foundation for Web Components
- Implements shadow DOM management
- Handles template rendering
- Manages event delegation

#### State Manager

- Implements application state management
- Provides state subscription
- Handles state updates
- Manages state persistence

## Data Flow

1. **Event Creation**

   ```
   User Input → Form Validation → Event Encoding → URL Generation → Sharing
   ```

2. **Event Viewing**

   ```
   URL Parameters → Event Decoding → Data Validation → Template Rendering → Display
   ```

3. **Event Editing**

   ```
   URL Parameters → Permission Check → Data Loading → Form Population → Update
   ```

4. **Stateless Projections** (path-carried events only)
   ```
   /event/<payload> + bot user-agent → Edge Function → Open Graph card
   /ics/<payload> → Netlify Function → text/calendar (RFC 5545)
   ```
   Private events carry the payload in the URL fragment (`/event#<payload>`),
   which never reaches any server: no logs, no card, no projections.
   Self-hosted instances serve the same projections from `src/server.js`.

## Security Features

1. **Content Security Policy (CSP)**

   - Implements strict CSP rules
   - Manages resource loading
   - Controls script execution

2. **Input Validation**

   - Client-side validation
   - Server-side validation
   - XSS prevention
   - Data sanitization

3. **Same-Origin by Default**
   - No CORS layer: the service exposes no cross-origin API
   - The browser's same-origin policy is the intended default

## Performance Optimizations

1. **Build Optimizations**

   - Code splitting
   - Asset optimization
   - CSS minification
   - Tree shaking

2. **Runtime Optimizations**

   - Template caching
   - Lazy loading
   - State management
   - Event delegation

3. **Asset Handling**
   - Static asset caching
   - Compression
   - Proper MIME types
   - Cache control headers

## Testing Strategy

1. **Unit Testing**

   - Component testing
   - Service testing
   - Utility testing
   - State management testing

2. **Integration Testing**

   - Component interaction
   - Service integration
   - Data flow testing

3. **End-to-End Testing**
   - User flow testing
   - Cross-browser testing
   - Performance testing

## Development Workflow

1. **Code Quality**

   - ESLint for code quality
   - Prettier for formatting
   - Pre-commit hooks
   - Automated testing

2. **Build Process**

   - Development server
   - Production build
   - Asset optimization
   - Source maps

3. **Deployment**
   - Static file serving
   - Compression
   - Cache control
   - Error handling

## Future Considerations

1. **Scalability**

   - Component modularity
   - Service extensibility
   - State management
   - Performance monitoring

2. **Maintainability**

   - Code organization
   - Documentation
   - Testing coverage
   - Error handling

3. **Feature Expansion**

   - Additional event types
   - User authentication
   - Event persistence
   - Real-time updates

4. **Decentralized Sharing & Federation**
   - Reference architecture in [architecture-decentralized.md](architecture-decentralized.md) (research background in [fediverse-research.md](fediverse-research.md))
