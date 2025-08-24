@echo off
REM NFLDrafter Development Startup Script for Windows
REM This script starts both the frontend and backend development servers

echo 🚀 Starting NFLDrafter Development Environment...
echo ================================================

REM Check if we're in the right directory
if not exist "pyproject.toml" (
    echo ❌ Error: Please run this script from the NFLDrafter root directory
    echo    Current directory: %CD%
    echo    Expected files: pyproject.toml, frontend\package.json
    pause
    exit /b 1
)

REM Check if frontend directory exists
if not exist "frontend" (
    echo ❌ Error: Frontend directory not found
    pause
    exit /b 1
)

REM Check if backend directory exists
if not exist "api" (
    echo ❌ Error: API directory not found
    pause
    exit /b 1
)

echo 📁 Project structure verified
echo.

REM Check Python dependencies
echo 🐍 Checking Python environment...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: pip is not installed or not in PATH
    pause
    exit /b 1
)

echo ✅ Python environment ready

REM Check Node.js dependencies
echo 📦 Checking Node.js environment...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo ✅ Node.js environment ready

REM Check if virtual environment exists, create if not
echo 🔧 Setting up Python virtual environment...
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
    echo ✅ Virtual environment created
) else (
    echo ✅ Virtual environment exists
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat

REM Install Python dependencies if needed
if not exist "api\requirements.txt" (
    echo ⚠️  Warning: requirements.txt not found, installing from pyproject.toml
    pip install -e .
) else (
    echo Installing Python dependencies...
    pip install -r api\requirements.txt
)

REM Install greenlet for SQLAlchemy async support
echo Installing greenlet for SQLAlchemy async support...
pip install greenlet

REM Install additional required dependencies
echo Installing additional dependencies...
pip install pandas nfl-data-py

REM Install frontend dependencies if needed
echo 📦 Installing frontend dependencies...
cd frontend
if not exist "node_modules" (
    echo Installing npm packages...
    npm install
) else (
    echo ✅ Node modules exist
)
cd ..

REM Check if database exists, initialize if not
echo 🗄️  Checking database...
if not exist "fantasy.db" (
    echo Initializing database...
    cd api
    python cli.py init
    cd ..
    echo ✅ Database initialized
) else (
    echo ✅ Database exists
)

echo.
echo 🚀 Starting development servers...
echo ==================================
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop all servers
echo.

REM Start both servers concurrently using start command
echo Starting frontend server...
start "NFLDrafter Frontend" cmd /k "cd frontend && npm run dev"

echo Starting backend server...
start "NFLDrafter Backend" cmd /k "cd api && python -m uvicorn app.main:app --reload --port 8000"

echo.
echo ✅ Both servers started successfully!
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo.
echo Each server is running in its own window.
echo Close the windows or press Ctrl+C in each to stop them.
echo.
pause
