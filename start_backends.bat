@echo off
echo Starting SuperDensee Backend Servers...
echo.

echo Starting Testing Phase Backend (app.py) on port 5000...
start "Testing Phase Backend" cmd /k "cd superdense-backend && python app.py"

echo Starting Application Phase Backend (application.py) on port 5001...
start "Application Phase Backend" cmd /k "cd superdense-backend && python application.py"

echo.
echo Both backend servers are starting...
echo - Testing Phase: http://localhost:5000
echo - Application Phase: http://localhost:5001
echo.
echo Press any key to exit this script (servers will continue running)
pause > nul
