# Evento - Event Sharing Application

A modern event-sharing application built with Fastify and Vite, designed to make event management and sharing simple and efficient.

## Features

- **Simple Event Creation**: Create and customize events with an intuitive form interface
- **Modern UI**: Clean, responsive interface built with Web Components
- **No Login, No Data**: The application is designed to be private and secure, with no login required - all event data is encoded in the URL

## Documentation

- [Architecture Overview](docs/architecture.md) - Detailed system design and components
- [Getting Started](#getting-started) - Quick start guide
- [Development](#development) - Development workflow
- [Contributing](#contributing) - How to contribute

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
- **Testing**: Vitest
- **Build Tools**: Vite, Terser, PostCSS
- **Code Quality**: ESLint, Prettier
- **Version Control**: Git with Husky pre-commit hooks

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [Architecture Documentation](docs/architecture.md) before contributing.

## License

ISC

## Security

For security concerns, please email [albyianna@gmail.com].
