import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .db import init_db
from .routers import fantasy, players


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("Starting NFLDrafter API...")
    await init_db()
    print("Database initialized successfully")
    
    yield
    
    # Shutdown
    print("Shutting down NFLDrafter API...")


# Create FastAPI app
app = FastAPI(
    title="NFLDrafter - Fantasy Football Open Scorer",
    description="Local-first fantasy football scoring application with custom profiles and player analysis",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(fantasy.router)
app.include_router(players.router)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "nfl-drafter-api"}


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "NFLDrafter Fantasy Football API",
        "version": "0.1.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }
