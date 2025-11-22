@echo off
echo Starting Risk Radar Application...
echo.
echo Building and starting all services...
docker-compose up --build
echo.
echo If the services started successfully, you can access the frontend at:
echo http://localhost:3000
echo.
echo To stop the services, press Ctrl+C, then run: docker-compose down