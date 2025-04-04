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
│   ├── event/          # Event-related services
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
├── server.js           # Fastify server setup
└── test/              # Server-side tests
    ├── setup.js       # Test environment setup
    └── shadow-dom-utils.js # Shadow DOM testing utilities
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

3. **CORS Configuration**
   - Production-specific origins
   - Development flexibility
   - Method restrictions

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
