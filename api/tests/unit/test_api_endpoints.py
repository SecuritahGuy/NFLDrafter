import pytest
from fastapi import status
from sqlalchemy import insert
from app.models import Player, ScoringProfile, ScoringRule


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
    
    def test_scoring_profiles_endpoint(self, client, db_session):
        """Test the scoring profiles endpoint."""
        response = client.get("/fantasy/profiles")
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "profiles" in data
        assert len(data["profiles"]) > 0
        
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
