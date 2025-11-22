# Frontend Service

This is the frontend application for the Risk Radar platform. It provides the user interface for interacting with the risk management services.

## Technology Stack

- React 18
- TypeScript
- Vite
- React Router
- Axios for API calls
- Docker for containerization

## Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

1. Clone the repository
2. Navigate to the frontend-service directory
3. Install dependencies:

```bash
npm install
```

### Running Locally

To start the development server:

```bash
npm run dev
```

This will start the application on http://localhost:3000.

### Building

To build the application for production:

```bash
npm run build
```

This will create a `dist` directory with the compiled assets.

## Docker

The application can be built and run using Docker:

```bash
# Build the Docker image
docker build -t frontend-service .

# Run the container
docker run -p 3000:80 frontend-service
```

## Docker Compose

The frontend service is integrated into the main docker-compose.yml file and can be started along with other services:

```bash
# From the root directory
docker-compose up frontend-service
```

Or to start all services:

```bash
docker-compose up
```

## Structure

- `src/` - Source code
  - `components/` - Reusable UI components
  - `pages/` - Page components
  - `services/` - API services
  - `utils/` - Utility functions
  - `App.tsx` - Main application component
  - `main.tsx` - Application entry point

## Contributing

Please follow the project's coding standards and submit pull requests for any changes.