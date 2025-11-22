# Running the Risk Radar Application

This guide provides instructions on how to run the Risk Radar application, including the newly added frontend service.

## Prerequisites

- Docker and Docker Compose installed on your system
- Git (to clone the repository if you haven't already)

## Steps to Run the Application

### 1. Clone the Repository (if you haven't already)

```bash
git clone <repository-url>
cd risk-radar
```

### 2. Build and Start the Services

From the root directory of the project, run:

```bash
docker-compose build
docker-compose up
```

Alternatively, you can build and start in a single command:

```bash
docker-compose up --build
```

To run in detached mode (in the background):

```bash
docker-compose up -d
```

### 3. Access the Frontend Service

Once the services are running, you can access the frontend service in your web browser at:

```
http://localhost:3000
```

### 4. Access Other Services

Other services are available at their respective ports:

- User Service: http://localhost:8080
- Authorization Service: http://localhost:8081
- Audit Log Service: http://localhost:8082
- AI Categorization Service: http://localhost:8083
- Media Service: http://localhost:8084
- Report Service: http://localhost:8085
- Map Service: http://localhost:8086
- Documentation Service: http://localhost:8000

## Stopping the Services

To stop the running services:

```bash
docker-compose down
```

To stop the services and remove volumes (this will delete all data):

```bash
docker-compose down -v
```

## Troubleshooting

If you encounter any issues:

1. Check that all required ports are available and not in use by other applications
2. Ensure Docker is running properly on your system
3. Check the logs for any specific service:
   ```bash
   docker-compose logs <service-name>
   ```
   For example: `docker-compose logs frontend-service`

## Development

For development purposes, you can run just the frontend service locally:

1. Navigate to the frontend service directory:
   ```bash
   cd services/frontend-service
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

This will start the frontend application in development mode with hot reloading at http://localhost:3000.