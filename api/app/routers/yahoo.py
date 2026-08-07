from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import os
from urllib.parse import urlencode
from datetime import datetime, timedelta
import jwt
from app.deps import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.yahoo_xml import (
    parse_leagues,
    parse_rosters,
    parse_settings,
    parse_stat_categories,
    parse_teams,
    parse_user,
)
from app.services.player_matching import map_yahoo_rosters
from app.services.yahoo_scoring import (
    persist_yahoo_scoring_profile,
    translate_yahoo_settings,
)

router = APIRouter(prefix="/yahoo", tags=["yahoo"])
callback_router = APIRouter(tags=["yahoo"])
security = HTTPBearer()

# OAuth configuration
YAHOO_CLIENT_ID = os.getenv("YAHOO_CLIENT_ID")
YAHOO_CLIENT_SECRET = os.getenv("YAHOO_CLIENT_SECRET")
YAHOO_REDIRECT_URI = os.getenv("YAHOO_REDIRECT_URI", "http://localhost:5173/auth/callback")
YAHOO_FRONTEND_CALLBACK_URI = os.getenv(
    "YAHOO_FRONTEND_CALLBACK_URI", "http://localhost:5173/auth/callback"
)

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


@callback_router.get("/auth/yahoo/callback")
async def yahoo_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    """Relay Yahoo's registered server callback to the browser application."""
    params = {
        key: value
        for key, value in {
            "code": code,
            "state": state,
            "error": error,
            "error_description": error_description,
        }.items()
        if value is not None
    }
    separator = "&" if "?" in YAHOO_FRONTEND_CALLBACK_URI else "?"
    return RedirectResponse(
        f"{YAHOO_FRONTEND_CALLBACK_URI}{separator}{urlencode(params)}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/authorize-url")
async def get_authorize_url(
    state: str = Query(min_length=32, max_length=128),
):
    """Build the Yahoo authorization URL from the server's OAuth configuration."""
    if not YAHOO_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Yahoo OAuth not configured",
        )

    query = urlencode({
        "client_id": YAHOO_CLIENT_ID,
        "redirect_uri": YAHOO_REDIRECT_URI,
        "response_type": "code",
        "state": state,
    })
    return {
        "authorize_url": f"https://api.login.yahoo.com/oauth2/request_auth?{query}",
        "redirect_uri": YAHOO_REDIRECT_URI,
    }

async def get_yahoo_client():
    """Get HTTP client for Yahoo API calls"""
    return httpx.AsyncClient(
        base_url="https://fantasysports.yahooapis.com/fantasy/v2",
        timeout=30.0
    )


def _game_key(league_id: str) -> str:
    return league_id.split(".", 1)[0]

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
            
            return parse_user(user_response.text)
            
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
            
            return {"leagues": parse_leagues(leagues_response.text)}
            
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
            
            return {"teams": parse_teams(teams_response.text)}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch teams: {str(e)}"
        )

@router.get("/leagues/{league_id}/settings")
async def get_league_settings(
    league_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Get scoring and roster settings for a Yahoo league."""
    del db
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_id}/settings",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
        )
        categories_response = await client.get(
            f"https://fantasysports.yahooapis.com/fantasy/v2/game/{_game_key(league_id)}/stat_categories",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch league settings")
    settings = parse_settings(response.text)
    categories = (
        parse_stat_categories(categories_response.text)
        if categories_response.status_code == 200
        else []
    )
    return {**settings, "translation": translate_yahoo_settings(settings, categories)}

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
            
            return {"rosters": parse_rosters(rosters_response.text)}
            
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
        
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            settings_response = await client.get(
                f"https://fantasysports.yahooapis.com/fantasy/v2/league/{request.league_id}/settings",
                headers=headers,
            )
            teams_response = await client.get(
                f"https://fantasysports.yahooapis.com/fantasy/v2/league/{request.league_id}/teams",
                headers=headers,
            )
            categories_response = await client.get(
                f"https://fantasysports.yahooapis.com/fantasy/v2/game/{_game_key(request.league_id)}/stat_categories",
                headers=headers,
            )
            rosters_response = None
            if request.include_rosters:
                rosters_response = await client.get(
                    f"https://fantasysports.yahooapis.com/fantasy/v2/league/{request.league_id}/teams/roster",
                    headers=headers,
                )
        if settings_response.status_code != 200 or teams_response.status_code != 200 or (
            rosters_response is not None and rosters_response.status_code != 200
        ):
            raise HTTPException(status_code=502, detail="Yahoo returned an error while importing league data")

        settings = parse_settings(settings_response.text)
        teams = parse_teams(teams_response.text)
        rosters = parse_rosters(rosters_response.text) if rosters_response is not None else []
        categories = (
            parse_stat_categories(categories_response.text)
            if categories_response.status_code == 200
            else []
        )
        translation = translate_yahoo_settings(settings, categories)
        scoring_profile = await persist_yahoo_scoring_profile(db, settings, translation)
        player_mapping = await map_yahoo_rosters(
            db, rosters, settings.get("season") or datetime.utcnow().year
        )
        await db.commit()
        import_result = {
            "league_id": request.league_id,
            "imported_at": datetime.utcnow().isoformat(),
            "teams_imported": len(teams),
            "players_imported": sum(len(roster["players"]) for roster in rosters),
            "rosters_imported": len(rosters),
            "settings": settings,
            "prepared_league": translation,
            "scoring_profile": scoring_profile,
            "player_mapping": player_mapping,
            "stat_categories_imported": len(categories),
            "teams": teams,
            "rosters": rosters,
            "status": "success",
        }
        
        return import_result
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import league: {str(e)}"
        )
