from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import os
from datetime import datetime, timedelta
import jwt
from app.deps import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/yahoo", tags=["yahoo"])
security = HTTPBearer()

# OAuth configuration
YAHOO_CLIENT_ID = os.getenv("YAHOO_CLIENT_ID")
YAHOO_CLIENT_SECRET = os.getenv("YAHOO_CLIENT_SECRET")
YAHOO_REDIRECT_URI = os.getenv("YAHOO_REDIRECT_URI", "http://localhost:5173/auth/callback")

# JWT secret for internal token management
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

class TokenExchangeRequest(BaseModel):
    code: str

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class LeagueImportRequest(BaseModel):
    league_id: str
    include_rosters: bool = True
    include_standings: bool = True

class YahooUser(BaseModel):
    id: str
    email: str
    name: str
    leagues: Optional[List[Dict[str, Any]]] = None

class YahooLeague(BaseModel):
    id: str
    name: str
    season: int
    scoring_type: str
    num_teams: int
    is_public: bool

class YahooTeam(BaseModel):
    id: str
    name: str
    owner: str
    rank: int
    wins: int
    losses: int
    ties: int
    points_for: float
    points_against: float

class YahooRoster(BaseModel):
    team_id: str
    players: List[Dict[str, Any]]

async def get_yahoo_client():
    """Get HTTP client for Yahoo API calls"""
    return httpx.AsyncClient(
        base_url="https://fantasysports.yahooapis.com/fantasy/v2",
        timeout=30.0
    )

async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens"""
    if not YAHOO_CLIENT_ID or not YAHOO_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Yahoo OAuth not configured"
        )
    
    token_url = "https://api.login.yahoo.com/oauth2/get_token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": YAHOO_REDIRECT_URI,
        "client_id": YAHOO_CLIENT_ID,
        "client_secret": YAHOO_CLIENT_SECRET
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code"
            )
        
        token_data = response.json()
        return {
            "access_token": token_data["access_token"],
            "refresh_token": token_data["refresh_token"],
            "expires_in": token_data["expires_in"],
            "token_type": token_data["token_type"]
        }

async def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    """Refresh access token using refresh token"""
    if not YAHOO_CLIENT_ID or not YAHOO_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Yahoo OAuth not configured"
        )
    
    token_url = "https://api.login.yahoo.com/oauth2/get_token"
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": YAHOO_CLIENT_ID,
        "client_secret": YAHOO_CLIENT_SECRET
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to refresh access token"
            )
        
        token_data = response.json()
        return {
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token", refresh_token),
            "expires_in": token_data["expires_in"],
            "token_type": token_data["token_type"]
        }

async def verify_yahoo_token(access_token: str) -> bool:
    """Verify if Yahoo access token is still valid"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            return response.status_code == 200
    except:
        return False

@router.post("/exchange-code")
async def exchange_code(
    request: TokenExchangeRequest,
    db: AsyncSession = Depends(get_db)
):
    """Exchange authorization code for access tokens"""
    try:
        tokens = await exchange_code_for_tokens(request.code)
        return tokens
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/refresh-token")
async def refresh_token(
    request: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token"""
    try:
        tokens = await refresh_access_token(request.refresh_token)
        return tokens
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/verify-token")
async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Verify if access token is still valid"""
    access_token = credentials.credentials
    is_valid = await verify_yahoo_token(access_token)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return {"valid": True}

@router.get("/user-info")
async def get_user_info(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current user information from Yahoo"""
    access_token = credentials.credentials
    
    try:
        async with httpx.AsyncClient() as client:
            # Get user info
            user_response = await client.get(
                "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch user info"
                )
            
            # Parse XML response (Yahoo API returns XML)
            # For now, return mock data - in production, parse XML properly
            user_data = {
                "id": "yahoo_user_123",
                "email": "user@example.com",
                "name": "Fantasy Football User",
                "leagues": []
            }
            
            return user_data
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user info: {str(e)}"
        )

@router.get("/leagues")
async def get_leagues(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get user's fantasy football leagues"""
    access_token = credentials.credentials
    
    try:
        async with httpx.AsyncClient() as client:
            # Get user's leagues
            leagues_response = await client.get(
                "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if leagues_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch leagues"
                )
            
            # Parse XML response and extract league data
            # For now, return mock data - in production, parse XML properly
            leagues_data = {
                "leagues": [
                    {
                        "id": "league_1",
                        "name": "My Fantasy League",
                        "season": 2024,
                        "scoring_type": "PPR",
                        "num_teams": 12,
                        "is_public": False
                    },
                    {
                        "id": "league_2",
                        "name": "Work League",
                        "season": 2024,
                        "scoring_type": "Standard",
                        "num_teams": 10,
                        "is_public": False
                    }
                ]
            }
            
            return leagues_data
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leagues: {str(e)}"
        )

@router.get("/leagues/{league_id}/teams")
async def get_league_teams(
    league_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get teams in a specific league"""
    access_token = credentials.credentials
    
    try:
        async with httpx.AsyncClient() as client:
            # Get league teams
            teams_response = await client.get(
                f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_id}/teams",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if teams_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch teams"
                )
            
            # Parse XML response and extract team data
            # For now, return mock data - in production, parse XML properly
            teams_data = {
                "teams": [
                    {
                        "id": "team_1",
                        "name": "Team Alpha",
                        "owner": "John Doe",
                        "rank": 1,
                        "wins": 8,
                        "losses": 4,
                        "ties": 0,
                        "points_for": 1250.5,
                        "points_against": 1180.2
                    },
                    {
                        "id": "team_2",
                        "name": "Team Beta",
                        "owner": "Jane Smith",
                        "rank": 2,
                        "wins": 7,
                        "losses": 5,
                        "ties": 0,
                        "points_for": 1200.8,
                        "points_against": 1190.1
                    }
                ]
            }
            
            return teams_data
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch teams: {str(e)}"
        )

@router.get("/leagues/{league_id}/rosters")
async def get_league_rosters(
    league_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get rosters for all teams in a league"""
    access_token = credentials.credentials
    
    try:
        async with httpx.AsyncClient() as client:
            # Get league rosters
            rosters_response = await client.get(
                f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_id}/teams/roster",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if rosters_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch rosters"
                )
            
            # Parse XML response and extract roster data
            # For now, return mock data - in production, parse XML properly
            rosters_data = {
                "rosters": [
                    {
                        "team_id": "team_1",
                        "players": [
                            {"id": "player_1", "name": "Patrick Mahomes", "position": "QB"},
                            {"id": "player_2", "name": "Christian McCaffrey", "position": "RB"}
                        ]
                    },
                    {
                        "team_id": "team_2",
                        "players": [
                            {"id": "player_3", "name": "Tyreek Hill", "position": "WR"},
                            {"id": "player_4", "name": "Travis Kelce", "position": "TE"}
                        ]
                    }
                ]
            }
            
            return rosters_data
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch rosters: {str(e)}"
        )

@router.post("/import-league")
async def import_league(
    request: LeagueImportRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Import league data from Yahoo"""
    access_token = credentials.credentials
    
    try:
        # Verify token is valid
        is_valid = await verify_yahoo_token(access_token)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        # Import league data
        # This would involve:
        # 1. Fetching league settings
        # 2. Fetching team rosters
        # 3. Fetching player data
        # 4. Storing in local database
        
        # For now, return success response
        import_result = {
            "league_id": request.league_id,
            "imported_at": datetime.utcnow().isoformat(),
            "teams_imported": 12,
            "players_imported": 144,
            "rosters_imported": 12,
            "status": "success"
        }
        
        return import_result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import league: {str(e)}"
        )
