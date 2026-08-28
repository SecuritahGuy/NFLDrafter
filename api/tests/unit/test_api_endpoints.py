import pytest
from fastapi import status
from sqlalchemy import insert
from urllib.parse import parse_qs, urlparse
from app.models import Player, PlayerInjury, ScoringProfile, ScoringRule
from app.routers import yahoo


class TestFantasyEndpoints:
    """Test fantasy football scoring endpoints."""
    
    def test_health_endpoint(self, client):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "nfl-drafter-api"
    
    def test_root_endpoint(self, client):
        """Test the root endpoint."""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "message" in data
        assert "version" in data

    def test_yahoo_authorize_url_uses_server_configuration(self, client, monkeypatch):
        monkeypatch.setattr(yahoo, "YAHOO_CLIENT_ID", "test-client-id")
        monkeypatch.setattr(
            yahoo, "YAHOO_REDIRECT_URI", "http://localhost:8000/auth/yahoo/callback"
        )
        state_value = "0123456789abcdef0123456789abcdef"

        response = client.get("/yahoo/authorize-url", params={"state": state_value})

        assert response.status_code == status.HTTP_200_OK
        authorize_url = urlparse(response.json()["authorize_url"])
        query = parse_qs(authorize_url.query)
        assert authorize_url.netloc == "api.login.yahoo.com"
        assert query["client_id"] == ["test-client-id"]
        assert query["redirect_uri"] == ["http://localhost:8000/auth/yahoo/callback"]
        assert query["response_type"] == ["code"]
        assert query["state"] == [state_value]
        assert "scope" not in query

    def test_yahoo_readiness_does_not_expose_credentials(self, client, monkeypatch):
        monkeypatch.setattr(yahoo, "YAHOO_CLIENT_ID", "test-client-id")
        monkeypatch.setattr(yahoo, "YAHOO_CLIENT_SECRET", "test-client-secret")

        response = client.get("/yahoo/readiness")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["configured"] is True
        assert response.json()["client_id_configured"] is True
        assert response.json()["client_secret_configured"] is True
        assert "test-client-id" not in response.text
        assert "test-client-secret" not in response.text

    def test_yahoo_callback_relays_to_frontend(self, client, monkeypatch):
        monkeypatch.setattr(
            yahoo, "YAHOO_FRONTEND_CALLBACK_URI", "http://localhost:5173/auth/callback"
        )

        response = client.get(
            "/auth/yahoo/callback",
            params={"code": "test-code", "state": "test-state"},
            follow_redirects=False,
        )

        assert response.status_code == status.HTTP_302_FOUND
        assert response.headers["location"] == (
            "http://localhost:5173/auth/callback?code=test-code&state=test-state"
        )
    
    def test_scoring_profiles_endpoint(self, client, db_session):
        """Test the scoring profiles endpoint."""
        response = client.get("/fantasy/profiles")
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "profiles" in data
        assert len(data["profiles"]) > 0
        assert data["profiles"][0]["rules"][0]["stat_key"] == "receptions"
        
        # Check profile structure
        profile = data["profiles"][0]
        assert "profile_id" in profile
        assert "name" in profile
        assert "description" in profile
        assert "created_at" in profile
    
    def test_calculate_points_endpoint(self, client, db_session, sample_scoring_rules):
        """Test the points calculation endpoint."""
        # This test requires a more complex setup that we'll implement later
        # For now, just test that the endpoint exists and returns proper error for missing data
        response = client.get("/fantasy/points", params={
            "player_id": "test-player",
            "season": 2023,
            "week": 1,
            "profile_id": "test-profile"
        })
        
        # Should return 404 since player doesn't exist
        assert response.status_code == 404
    
    def test_calculate_points_invalid_params(self, client):
        """Test points calculation with invalid parameters."""
        # Test with invalid season
        response = client.get("/fantasy/points", params={
            "player_id": "test-player",
            "season": 1999,  # Invalid season
            "week": 1,
            "profile_id": "test-profile"
        })
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with invalid week
        response = client.get("/fantasy/points", params={
            "player_id": "test-player",
            "season": 2023,
            "week": 20,  # Invalid week
            "profile_id": "test-profile"
        })
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestPlayerEndpoints:
    """Test player-related endpoints."""
    
    def test_player_positions_endpoint(self, client):
        """Test the player positions endpoint."""
        response = client.get("/players/positions")
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "positions" in data
        assert len(data["positions"]) > 0
        
        # Check for expected positions
        positions = data["positions"]
        assert "QB" in positions
        assert "RB" in positions
        assert "WR" in positions
        assert "TE" in positions
        assert "K" in positions
        assert "DEF" in positions
    
    def test_player_teams_endpoint(self, client):
        """Test the player teams endpoint."""
        response = client.get("/players/teams")
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "teams" in data
        assert len(data["teams"]) > 0
        
        # Check for expected teams
        teams = data["teams"]
        assert "KC" in teams  # Kansas City Chiefs
        assert "SF" in teams  # San Francisco 49ers
        assert "BUF" in teams  # Buffalo Bills
    
    def test_player_search_endpoint(self, client, db_session, sample_player):
        """Test the player search endpoint."""
        # Test search with no players in database (should return empty)
        response = client.get("/players/", params={"q": "Test Quarterback"})
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data) == 0  # No players in test database
    
    def test_player_search_by_position(self, client, db_session, sample_player):
        """Test player search filtered by position."""
        # Test search by position
        response = client.get("/players/", params={"position": "QB"})
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        # There are players in the database, so we should get results
        assert len(data) > 0
        
        # All returned players should be QBs
        for player in data:
            assert player["position"] == "QB"
    
    def test_player_search_by_team(self, client, db_session, sample_player):
        """Test player search filtered by team."""
        # Test search by team with no players in database
        response = client.get("/players/", params={"team": "TEST"})
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data) == 0  # No players in test database
    
    def test_player_search_limit(self, client, db_session):
        """Test player search with limit parameter."""
        # Test with limit
        response = client.get("/players/", params={"limit": 5})
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        # There are players in the database, so we should get results
        assert len(data) > 0
        assert len(data) <= 5  # Should respect the limit
    
    def test_player_search_no_results(self, client):
        """Test player search with no matching results."""
        response = client.get("/players/", params={"q": "NonexistentPlayer"})
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data) == 0  # Should return empty array
    
    def test_get_player_by_id(self, client, db_session, sample_player):
        """Test getting a specific player by ID."""
        # Test get player by ID with no players in database
        response = client.get(f"/players/{sample_player['player_id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    def test_get_player_by_id_not_found(self, client):
        """Test getting a player that doesn't exist."""
        response = client.get("/players/nonexistent-id")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()

    def test_projection_analytics_uses_profile_and_league_baseline(self, client):
        response = client.get(
            "/rankings/projection-analytics",
            params={"profile_id": "fixture-ppr", "season": 2026, "league_size": 2},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["profile"]["name"] == "Fixture PPR"
        assert data["methodology"]["replacement_ranks"]["WR"] == 5
        assert data["players"][0]["profile_points"] == 100
        assert data["players"][0]["scoring_basis"] == "profile"

    def test_player_context_labels_espn_injury_reports(self, client, db_session):
        # The fixture database transaction can see this pending row when the
        # request uses the same connection override.
        db_session.add(
            PlayerInjury(
                injury_id="fixture-espn-injury", player_id="fixture-wr-1",
                full_name="Fixture Receiver One", position="WR", team="KC",
                season=2026, season_type="ESPN", week=0,
                report_primary_injury="Right Ankle Sprain", report_status="Questionable",
                snapshot_ts=1,
            )
        )
        response = client.get("/players/fixture-wr-1/context", params={"season": 2026})

        assert response.status_code == status.HTTP_200_OK
        injury = response.json()["injuries"][0]
        assert injury == {
            "season": 2026,
            "week": 0,
            "report_status": "Questionable",
            "primary_injury": "Right Ankle Sprain",
            "practice_status": None,
            "source": "ESPN",
            "is_current": True,
        }


class TestErrorHandling:
    """Test error handling in API endpoints."""
    
    def test_invalid_player_id_format(self, client):
        """Test handling of invalid player ID formats."""
        # Test with very long ID
        long_id = "a" * 1000
        response = client.get(f"/players/{long_id}")
        # Should either return 404 or handle gracefully
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_422_UNPROCESSABLE_ENTITY]
    
    def test_search_with_invalid_position(self, client):
        """Test search with invalid position parameter."""
        response = client.get("/players/", params={"position": "INVALID"})
        # Should return empty results rather than error
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data) == 0
    
    def test_search_with_invalid_team(self, client):
        """Test search with invalid team parameter."""
        response = client.get("/players/", params={"team": "INVALID"})
        # Should return empty results rather than error
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data) == 0
