# 🚀 NFLDrafter Development Startup Scripts

This document explains how to use the various startup scripts to quickly get your NFLDrafter development environment running.

## 🎯 Quick Start

### Option 1: Cross-Platform NPM Script (Recommended)
```bash
npm run dev
```

This will start both frontend and backend servers concurrently using the `concurrently` package.

### Option 2: Unix/Mac Shell Script
```bash
./start-dev.sh
```

### Option 3: Windows Batch Script
```cmd
start-dev.bat
```

## 📋 What These Scripts Do

All startup scripts perform the following setup steps:

1. **✅ Environment Verification**
   - Check if you're in the correct directory
   - Verify project structure (frontend/, api/, pyproject.toml)
   - Validate Python and Node.js installations

2. **🐍 Python Setup**
   - Create/activate virtual environment (.venv)
   - Install Python dependencies
   - Initialize database if needed

3. **📦 Frontend Setup**
   - Install npm dependencies
   - Verify node_modules exist

4. **🗄️ Database Setup**
   - Check if fantasy.db exists
   - Run `python cli.py init` if database is missing

5. **🚀 Server Startup**
   - Start frontend dev server (http://localhost:5173)
   - Start backend API server (http://localhost:8000)
   - Display URLs and instructions

## 🔧 Prerequisites

Before running the startup scripts, ensure you have:

- **Python 3.9+** with pip
- **Node.js 18+** with npm
- **Git** (for cloning the repository)

## 📁 Project Structure

```
NFLDrafter/
├── start-dev.sh          # Unix/Mac startup script
├── start-dev.bat         # Windows startup script
├── package.json          # Root package.json with npm scripts
├── frontend/             # React frontend application
├── api/                  # FastAPI backend application
├── pyproject.toml        # Python project configuration
└── fantasy.db            # SQLite database (created on first run)
```

## 🎮 Available NPM Scripts

### Development
```bash
npm run dev              # Start both servers concurrently
npm run dev:frontend     # Start only frontend server
npm run dev:backend      # Start only backend server
```

### Setup & Installation
```bash
npm run dev:setup        # Setup both frontend and backend
npm run setup:backend    # Initialize database and install Python deps
npm run setup:frontend   # Install frontend dependencies
npm run install:all      # Install all dependencies
```

### Testing
```bash
npm run test             # Run all tests (frontend + backend)
npm run test:frontend    # Run frontend tests only
npm run test:backend     # Run backend tests only
npm run test:coverage    # Run tests with coverage reports
```

### Build & Cleanup
```bash
npm run build            # Build both frontend and backend
npm run clean            # Clean build artifacts and dependencies
```

## 🌐 Server URLs

Once started, you can access:

- **Frontend Application**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Alternative API Docs**: http://localhost:8000/redoc

## 🛑 Stopping the Servers

### NPM Script
Press `Ctrl+C` in the terminal where you ran `npm run dev`

### Shell Scripts
Press `Ctrl+C` in the terminal where you ran the script

### Windows Batch
Close the individual command windows that were opened

## 🔍 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the ports
   lsof -i :5173  # Frontend port
   lsof -i :8000  # Backend port
   
   # Kill processes if needed
   kill -9 <PID>
   ```

2. **Database Locked**
   ```bash
   # Remove the database file and reinitialize
   rm fantasy.db
   cd api && python cli.py init
   ```

3. **Virtual Environment Issues**
   ```bash
   # Remove and recreate virtual environment
   rm -rf .venv
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e .
   ```

4. **Node Modules Issues**
   ```bash
   # Clean and reinstall
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

### Environment Variables

Create a `.env` file in the root directory if you need to customize:

```bash
# Backend settings
DATABASE_URL=sqlite:///./fantasy.db
LOG_LEVEL=info

# Frontend settings
VITE_API_BASE_URL=http://localhost:8000
```

## 🚀 Production Deployment

For production deployment, use the build scripts:

```bash
npm run build:frontend   # Build optimized frontend
npm run build:backend    # Build production backend
```

## 📚 Additional Resources

- [Frontend Development Guide](frontend/README.md)
- [Backend API Documentation](api/README.md)
- [Testing Guide](TESTING.md)
- [Deployment Guide](DEPLOYMENT.md)

## 🤝 Contributing

When adding new startup scripts or modifying existing ones:

1. Update this README
2. Test on both Unix/Mac and Windows
3. Ensure all npm scripts are documented
4. Add appropriate error handling and user feedback

---

**Happy Coding! 🏈⚡**
