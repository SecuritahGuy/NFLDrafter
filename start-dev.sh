#!/bin/bash

# NFLDrafter Development Startup Script
# This script starts both the frontend and backend development servers

echo "🚀 Starting NFLDrafter Development Environment..."
echo "================================================"

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: Please run this script from the NFLDrafter root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected files: pyproject.toml, frontend/package.json"
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Error: Frontend directory not found"
    exit 1
fi

# Check if backend directory exists
if [ ! -d "api" ]; then
    echo "❌ Error: API directory not found"
    exit 1
fi

echo "📁 Project structure verified"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Python dependencies
echo "🐍 Checking Python environment..."
if ! command_exists python3; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

if ! command_exists pip; then
    echo "❌ Error: pip is not installed"
    exit 1
fi

echo "✅ Python environment ready"

# Check Node.js dependencies
echo "📦 Checking Node.js environment..."
if ! command_exists node; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

echo "✅ Node.js environment ready"

# Check if virtual environment exists, create if not
echo "🔧 Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Install Python dependencies if needed
if [ ! -f "api/requirements.txt" ]; then
    echo "⚠️  Warning: requirements.txt not found, installing from pyproject.toml"
    pip install -e .
else
    echo "Installing Python dependencies..."
    pip install -r api/requirements.txt
fi

# Install greenlet for SQLAlchemy async support
echo "Installing greenlet for SQLAlchemy async support..."
pip install greenlet

# Install additional required dependencies
echo "Installing additional dependencies..."
pip install pandas nfl-data-py

# Install frontend dependencies if needed
echo "📦 Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "✅ Node modules exist"
fi
cd ..

# Check if database exists, initialize if not
echo "🗄️  Checking database..."
if [ ! -f "fantasy.db" ]; then
    echo "Initializing database..."
    cd api
    python cli.py init
    cd ..
    echo "✅ Database initialized"
else
    echo "✅ Database exists"
fi

echo ""
echo "🚀 Starting development servers..."
echo "=================================="
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start both servers concurrently
(cd frontend && npm run dev) &
FRONTEND_PID=$!

(cd api && python -m uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping development servers..."
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    echo "✅ All servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
