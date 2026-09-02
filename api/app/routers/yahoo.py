from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import os
import hashlib
import time
from urllib.parse import urlencode
from datetime import datetime, timedelta
import jwt
from dotenv import load_dotenv
from app.deps import get_db
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import ApiResponseCache, Player, PlayerIdentifier, PlayerWeekStat
from copy import deepcopy
from app.services.player_matching import (
    normalize_name,
    normalize_position,
    normalize_team,
    yahoo_numeric_id,
)
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
from app.services.yahoo_snapshot import (
    get_yahoo_snapshot,
    sync_yahoo_draft_results,
    sync_yahoo_league_snapshot,
)

router = APIRouter(prefix="/yahoo", tags=["yahoo"])
callback_router = APIRouter(tags=["yahoo"])
security = HTTPBearer()

FANTASY_PERMISSION_DETAIL = (
    "Yahoo authorized the account, but this app cannot access Fantasy Sports. "
    "Enable Fantasy Sports Read permission in the Yahoo developer app, then disconnect and reconnect."
)

# OAuth configuration. Local .env values support the HTTPS callback used by
# Yahoo while deployed environments can continue to inject real environment variables.
load_dotenv()
YAHOO_CLIENT_ID = os.getenv("YAHOO_CLIENT_ID")
YAHOO_CLIENT_SECRET = os.getenv("YAHOO_CLIENT_SECRET")
YAHOO_REDIRECT_URI = os.getenv("YAHOO_REDIRECT_URI", "http://localhost:8000/auth/yahoo/callback")
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
    draft_position: int = 0
    is_current_user: bool = False
    rank: int
    wins: int
    losses: int
    ties: int
    points_for: float
    points_against: float

class YahooRoster(BaseModel):
    team_id: str
    players: List[Dict[str, Any]]


def _draft_context(teams: list[dict[str, Any]]) -> dict[str, Any]:
    """Return a safe draft-order payload when Yahoo has assigned positions.

    Yahoo does not expose a future order before commissioners set it.  A partial
    or malformed set of positions is therefore reported as unavailable instead
    of guessing an order from the standings.
    """
    ordered = sorted(
        (team for team in teams if int(team.get("draft_position") or 0) > 0),
        key=lambda team: int(team["draft_position"]),
    )
    positions = [int(team["draft_position"]) for team in ordered]
    complete = len(ordered) == len(teams) and positions == list(range(1, len(teams) + 1))
    my_team = next((team for team in ordered if team.get("is_current_user")), None)
    return {
        "available": complete,
        "my_draft_slot": int(my_team["draft_position"]) if complete and my_team else None,
        "my_team_id": my_team.get("id") if my_team else None,
        "order": [
            {"slot": int(team["draft_position"]), "team_id": team["id"], "name": team["name"], "owner": team.get("owner", ""), "is_current_user": bool(team.get("is_current_user"))}
            for team in ordered
        ] if complete else [],
    }


@router.get("/readiness")
async def yahoo_readiness():
    """Report whether this server can begin a Yahoo OAuth dress rehearsal."""
    client_id_configured = bool(YAHOO_CLIENT_ID)
    client_secret_configured = bool(YAHOO_CLIENT_SECRET)
    return {
        "configured": client_id_configured and client_secret_configured,
        "client_id_configured": client_id_configured,
        "client_secret_configured": client_secret_configured,
        "redirect_uri": YAHOO_REDIRECT_URI,
        "frontend_callback_uri": YAHOO_FRONTEND_CALLBACK_URI,
    }


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


def _merge_team_details(teams: list[dict], standings: list[dict]) -> list[dict]:
    """Overlay standings fields without losing team names and managers."""
    standings_by_id = {team["id"]: team for team in standings}
    return [
        {
            **team,
            **{
                key: value
                for key, value in standings_by_id.get(team["id"], {}).items()
                if (key not in {"name", "owner", "draft_position", "is_current_user"} or value)
            },
        }
        for team in teams
    ]

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
    db: AsyncSession = Depends(get_db),
    force_refresh: bool = Query(False),
):
    """Get user's fantasy football leagues"""
    access_token = credentials.credentials
    cache_key = hashlib.sha256(b"yahoo|league-list").hexdigest()
    cached = await db.get(ApiResponseCache, cache_key)
    if cached and not force_refresh:
        cached.last_accessed_at = int(time.time())
        await db.commit()
        return cached.response
    
    try:
        async with httpx.AsyncClient() as client:
            # Get user's leagues
            leagues_response = await client.get(
                "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if leagues_response.status_code != 200:
                raise HTTPException(
                    status_code=(
                        status.HTTP_403_FORBIDDEN
                        if leagues_response.status_code in {401, 403}
                        else status.HTTP_502_BAD_GATEWAY
                    ),
                    detail=(
                        FANTASY_PERMISSION_DETAIL
                        if leagues_response.status_code in {401, 403}
                        else "Yahoo returned an error while fetching leagues"
                    ),
                )
            
            payload = {"leagues": parse_leagues(leagues_response.text), "cached_at": int(time.time())}
            values = {
                "provider": "yahoo", "endpoint": "/leagues", "query": {},
                "response": payload, "fetched_at": int(time.time()),
                "expires_at": 2_147_483_647, "last_accessed_at": int(time.time()),
                "status_code": 200, "response_headers": {},
            }
            if cached:
                for field, value in values.items():
                    setattr(cached, field, value)
            else:
                db.add(ApiResponseCache(cache_key=cache_key, **values))
            await db.commit()
            return payload
            
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
            headers = {"Authorization": f"Bearer {access_token}"}
            teams_response = await client.get(
                f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_id}/teams",
                headers=headers,
            )
            standings_response = await client.get(
                f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_id}/standings",
                headers=headers,
            )
            
            if teams_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch teams"
                )
            
            teams = parse_teams(teams_response.text)
            standings = parse_teams(standings_response.text) if standings_response.status_code == 200 else []
            return {"teams": _merge_team_details(teams, standings), "standings_available": bool(standings)}
            
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


@router.get("/leagues/{league_id}/snapshot")
async def yahoo_league_snapshot(
    league_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the last persisted read-only Yahoo snapshot without contacting Yahoo."""
    snapshot = await get_yahoo_snapshot(db, league_id)
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Yahoo snapshot is cached. Run Refresh all sources.",
        )
    return snapshot


@router.get("/leagues/{league_id}/weekly-prep")
async def yahoo_weekly_prep_snapshot(
    league_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the cached Yahoo snapshot with verified canonical roster IDs.

    This is deliberately database-only.  The mappings come from the
    season-aware Yahoo import and allow the weekly UI to join roster players
    to locally cached projection, injury, and ranking sources without making
    name-based guesses in the browser.
    """
    snapshot = await get_yahoo_snapshot(db, league_id)
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Yahoo snapshot is cached. Run Refresh all sources.",
        )

    season = int((snapshot.get("metadata") or {}).get("season") or 0)
    enriched = deepcopy(snapshot)
    if not season:
        return enriched

    rows = (
        await db.execute(
            select(PlayerIdentifier.external_id, PlayerIdentifier.canonical_player_id).where(
                PlayerIdentifier.platform == "yahoo",
                PlayerIdentifier.season == season,
            )
        )
    ).all()
    canonical_ids = {external_id: canonical_id for external_id, canonical_id in rows}
    players = list((await db.execute(select(Player))).scalars().all())
    by_yahoo_id = {
        yahoo_numeric_id(player.yahoo_id): player.player_id
        for player in players if player.yahoo_id
    }
    by_name_position_team: dict[tuple[str, str, str], list[str]] = {}
    by_name_position: dict[tuple[str, str], list[str]] = {}
    for player in players:
        name = normalize_name(player.full_name)
        position = normalize_position(player.position)
        team = normalize_team(player.team)
        by_name_position_team.setdefault((name, position, team), []).append(player.player_id)
        by_name_position.setdefault((name, position), []).append(player.player_id)

    def canonical_id_for(player: dict) -> tuple[str | None, str | None]:
        external_id = str(player.get("id") or "")
        if canonical := canonical_ids.get(external_id):
            return canonical, "season_identifier"
        if canonical := by_yahoo_id.get(yahoo_numeric_id(external_id)):
            return canonical, "yahoo_id"
        name = normalize_name(player.get("name"))
        position = normalize_position(player.get("position"))
        team = normalize_team(player.get("team"))
        exact = by_name_position_team.get((name, position, team), [])
        if len(exact) == 1:
            return exact[0], "name_position_team"
        by_position = by_name_position.get((name, position), [])
        if len(by_position) == 1:
            return by_position[0], "name_position"
        return None, None

    mapped = 0
    for roster in enriched.get("rosters") or []:
        for player in roster.get("players") or []:
            canonical_id, method = canonical_id_for(player)
            if canonical_id:
                player["canonical_player_id"] = canonical_id
                player["mapping_method"] = method
                mapped += 1
    mapped_available = 0
    for player in enriched.get("players") or []:
        canonical_id, method = canonical_id_for(player)
        if canonical_id:
            player["canonical_player_id"] = canonical_id
            player["mapping_method"] = method
            mapped_available += 1
    enriched["mapping_coverage"] = {
        "season": season,
        "mapped_roster_players": mapped,
        "rostered_players": sum(
            len(roster.get("players") or []) for roster in enriched.get("rosters") or []
        ),
        "mapped_available_players": mapped_available,
        "available_players": len(enriched.get("players") or []),
    }
    return enriched


@router.get("/leagues/{league_id}/weekly-prep/teams/{team_id}")
async def yahoo_weekly_prep_team(
    league_id: str,
    team_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return one cached roster with recent locally stored weekly statistics."""
    snapshot = await yahoo_weekly_prep_snapshot(league_id, db)
    team = next((item for item in snapshot.get("teams") or [] if item.get("id") == team_id), None)
    roster = next((item for item in snapshot.get("rosters") or [] if item.get("team_id") == team_id), None)
    if team is None or roster is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team roster not found")

    season = int((snapshot.get("metadata") or {}).get("season") or 0)
    canonical_ids = [
        player["canonical_player_id"]
        for player in roster.get("players") or []
        if player.get("canonical_player_id")
    ]
    recent_by_player: dict[str, dict[tuple[int, int], dict[str, float]]] = {}
    if canonical_ids and season:
        rows = (
            await db.execute(
                select(PlayerWeekStat).where(
                    PlayerWeekStat.player_id.in_(canonical_ids),
                    PlayerWeekStat.season.in_((season, season - 1)),
                )
            )
        ).scalars().all()
        for row in rows:
            recent_by_player.setdefault(row.player_id, {}).setdefault(
                (row.season, row.week), {}
            )[row.stat_key] = row.stat_value

    players = []
    for player in roster.get("players") or []:
        weeks = recent_by_player.get(player.get("canonical_player_id") or "", {})
        latest = sorted(weeks.items(), key=lambda item: item[0], reverse=True)[:3]
        players.append({
            **player,
            "recent_weeks": [
                {"season": key[0], "week": key[1], "stats": stats}
                for key, stats in latest
            ],
        })
    return {
        "league_id": league_id,
        "team": team,
        "players": players,
        "stats_source": "nflverse",
        "stats_seasons": [season, season - 1] if season else [],
        "read_only": True,
    }


@router.post("/leagues/{league_id}/sync")
async def sync_yahoo_league(
    league_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Refresh all useful read-only Yahoo resources and persist the result."""
    if not await verify_yahoo_token(credentials.credentials):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return await sync_yahoo_league_snapshot(db, league_id, credentials.credentials)


@router.post("/leagues/{league_id}/draft-results")
async def sync_yahoo_live_draft_results(
    league_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Refresh current Yahoo draft results for the live draft board poll."""
    if not await verify_yahoo_token(credentials.credentials):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        return await sync_yahoo_draft_results(db, league_id, credentials.credentials)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

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
            standings_response = None
            if request.include_standings:
                standings_response = await client.get(
                    f"https://fantasysports.yahooapis.com/fantasy/v2/league/{request.league_id}/standings",
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
        standings = (
            parse_teams(standings_response.text)
            if standings_response is not None and standings_response.status_code == 200
            else []
        )
        teams = _merge_team_details(teams, standings)
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
            "draft": _draft_context(teams),
            "standings_imported": bool(standings),
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
