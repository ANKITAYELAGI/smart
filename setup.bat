@echo off
REM Smart Parking System Setup Script for Windows
REM This script sets up the complete Smart Parking System

echo 🚗 Smart Parking System Setup
echo ==============================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed. Please install Python 3.8+
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js 16+
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed. Please install npm
    pause
    exit /b 1
)

echo [INFO] System requirements check completed

REM Setup backend
echo [INFO] Setting up backend...
cd backend

REM Create virtual environment
if not exist "venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment and install requirements
echo [INFO] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt

REM Setup environment file
if not exist ".env" (
    echo [INFO] Creating environment configuration...
    copy env.example .env
    echo [WARNING] Please edit backend\.env with your configuration
)

cd ..

REM Setup frontend
echo [INFO] Setting up frontend...
cd frontend

REM Install dependencies
echo [INFO] Installing Node.js dependencies...
npm install

REM Install Tailwind CSS dependencies
echo [INFO] Installing Tailwind CSS...
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest
npm install @tailwindcss/forms @tailwindcss/typography @tailwindcss/aspect-ratio

cd ..

REM Setup IoT simulation
echo [INFO] Setting up IoT simulation...
cd iot_simulation

REM Install requirements
echo [INFO] Installing IoT simulation dependencies...
pip install -r requirements.txt

cd ..

REM Create startup scripts
echo [INFO] Creating startup scripts...

REM Backend startup script
echo @echo off > start_backend.bat
echo echo 🚀 Starting Smart Parking Backend... >> start_backend.bat
echo cd backend >> start_backend.bat
echo call venv\Scripts\activate.bat >> start_backend.bat
echo python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 >> start_backend.bat
echo pause >> start_backend.bat

REM Frontend startup script
echo @echo off > start_frontend.bat
echo echo 🚀 Starting Smart Parking Frontend... >> start_frontend.bat
echo cd frontend >> start_frontend.bat
echo npm start >> start_frontend.bat
echo pause >> start_frontend.bat

REM IoT simulation startup script
echo @echo off > start_iot.bat
echo echo 🚀 Starting IoT Sensor Simulation... >> start_iot.bat
echo cd iot_simulation >> start_iot.bat
echo python sensor_simulator.py >> start_iot.bat
echo pause >> start_iot.bat

REM Development script
echo @echo off > dev.bat
echo echo 🚗 Starting Smart Parking System Development Environment >> dev.bat
echo echo ======================================================== >> dev.bat
echo echo. >> dev.bat
echo echo Starting backend server... >> dev.bat
echo start "Backend Server" cmd /k "cd backend && call venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" >> dev.bat
echo timeout /t 3 /nobreak ^>nul >> dev.bat
echo echo Starting frontend server... >> dev.bat
echo start "Frontend Server" cmd /k "cd frontend && npm start" >> dev.bat
echo timeout /t 5 /nobreak ^>nul >> dev.bat
echo echo Starting IoT simulation... >> dev.bat
echo start "IoT Simulation" cmd /k "cd iot_simulation && python sensor_simulator.py" >> dev.bat
echo echo. >> dev.bat
echo echo ✅ Smart Parking System is running! >> dev.bat
echo echo 📱 Frontend: http://localhost:3000 >> dev.bat
echo echo 🔧 Backend API: http://localhost:8000 >> dev.bat
echo echo 📚 API Docs: http://localhost:8000/docs >> dev.bat
echo echo 👤 Admin Panel: http://localhost:3000/admin >> dev.bat
echo echo. >> dev.bat
echo echo Demo Credentials: >> dev.bat
echo echo   Admin: admin@parking.com / admin123 >> dev.bat
echo echo   User: user@parking.com / user123 >> dev.bat
echo echo. >> dev.bat
echo echo Press any key to exit... >> dev.bat
echo pause ^>nul >> dev.bat

echo [SUCCESS] Startup scripts created

echo.
echo [SUCCESS] 🎉 Smart Parking System setup completed!
echo.
echo Next steps:
echo 1. Edit backend\.env with your configuration
echo 2. Start MongoDB (if using local instance)
echo 3. Run 'dev.bat' to start the development environment
echo.
echo Or start components individually:
echo   Backend: start_backend.bat
echo   Frontend: start_frontend.bat
echo   IoT Sim: start_iot.bat
echo.
echo Access points:
echo   Frontend: http://localhost:3000
echo   Backend: http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.

pause
