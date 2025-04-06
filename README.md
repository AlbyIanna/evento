# Evento - Event Sharing Application

A modern event-sharing application built with Fastify and Vite, designed to make event management and sharing simple and efficient.

## Features

- **Simple Event Creation**: Create and customize events with an intuitive form interface
- **Modern UI**: Clean, responsive interface built with Web Components
- **No Login, No Data**: The application is designed to be private and secure, with no login required - all event data is encoded in the URL
- **Accessibility-first design**

## Documentation

- [Architecture Overview](docs/architecture.md) - Detailed system design and components
- [Getting Started](#getting-started) - Quick start guide
- [Development](#development) - Development workflow
- [Contributing](#contributing) - How to contribute
- [Changelog](CHANGELOG.md) - Detailed version history and changes

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/AlbyIanna/evento.git
cd evento
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
evento/
├── docs/           # Documentation
├── src/            # Source code
│   ├── client/     # Frontend application
│   └── server.js   # Backend server
├── dist/           # Production build
└── viteCustomPlugins/ # Build customizations
```

### Technology Stack

- **Frontend**: Vite + Vanilla JavaScript (Web Components)
- **Backend**: Fastify
- **Testing**: Vitest + Testing Library + jest-axe
- **Build Tools**: Vite, Terser, PostCSS
- **Code Quality**: ESLint, Prettier, Husky
- **Version Control**: Git with conventional commits
- **CI/CD**: GitHub Actions + Netlify
- **Security**: CSP, CORS, Security Headers

## Testing

The project uses Vitest for testing and includes several types of tests:

### Running Tests

- Run all tests: `npm test`
- Watch mode: `npm run test:watch`
- UI test runner: `npm run test:ui`
- Coverage report: `npm run test:coverage`

### Test Structure

```
src/client/
├── test/
│   ├── setup.js         # Global test setup
│   └── utils.js         # Test utilities
├── components/
│   ├── event-form/
│   │   └── index.test.js
│   └── event-view/
│       └── index.test.js
└── utils/
    └── eventUtils.test.js
```

### Writing Tests

Follow these guidelines when writing tests:

1. **Test Organization**

   - Use descriptive test names
   - Group related tests using `describe` blocks
   - Follow the Arrange-Act-Assert pattern

2. **Test Coverage**
   - Aim for 80%+ coverage
   - Test edge cases and error conditions
   - Include accessibility tests

Example:

```javascript
describe('Component', () => {
  it('should handle the happy path', () => {
    // Arrange
    const input = setupTest();

    // Act
    const result = performAction(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

## Code Quality

### Linting and Formatting

- Run linter: `npm run lint`
- Fix linting issues: `npm run lint:fix`
- Format code: `npm run format`
- Check formatting: `npm run format:check`

### Best Practices

1. **Clean Code**

   - Use meaningful variable and function names
   - Keep functions small and focused
   - Follow the Single Responsibility Principle

2. **Error Handling**

   - Validate inputs early
   - Provide meaningful error messages
   - Use try-catch blocks appropriately

3. **Performance**
   - Minimize DOM operations
   - Use efficient data structures
   - Implement proper caching

## Deployment

The application is deployed using Netlify's native Git integration:

### First-time Setup

1. Install Netlify CLI globally:

```bash
npm install -g netlify-cli
```

2. Login to Netlify:

```bash
netlify login
```

3. Initialize Netlify in your project:

```bash
netlify init
```

This will:

- Link your repository
- Configure build settings
- Set up continuous deployment
- Create preview deployments for PRs

### Development Workflow

1. Local development with Netlify:

```bash
npm run netlify:dev
```

2. Test production build:

```bash
npm run netlify:build
```

3. Manual deployment (if needed):

```bash
netlify deploy --prod
```

4. View deployment status:

```bash
netlify status
```

### Deployment Features

- Automatic deployments on push
- Deploy previews for pull requests
- Instant rollbacks
- Branch deploys
- Build caching
- SSL/HTTPS
- CDN distribution

### Environment Variables

Environment variables are managed directly in Netlify's dashboard:

1. Go to Site settings > Build & deploy > Environment
2. Add variables needed for your deployment
3. Trigger a new deploy to apply changes

## Contributing

### CI/CD Pipeline

The project uses a combination of GitHub Actions and Netlify for a robust CI/CD pipeline:

#### GitHub Actions Checks

- Automated formatting verification
- ESLint checks
- Test suite execution
- Build verification

#### Netlify Integration

- Automatic preview deployments for pull requests
- Production deployments from main branch
- Instant rollbacks and branch deploys
- Build caching and CDN distribution

#### Branch Protection

The `main` branch is protected and requires:

- All CI checks to pass
- Branch to be up to date
- Pull request review
- No direct pushes

## License

ISC

## Security

For security concerns, please email [albyianna@gmail.com].
