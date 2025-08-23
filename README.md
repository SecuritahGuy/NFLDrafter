# NFLDrafter - Fantasy Football Open Scorer

A local-first fantasy football scoring application with custom scoring profiles, player analysis, and news integration. Built with FastAPI, React, and SQLite, designed for easy migration to Postgres later.

## Features

- **Custom Scoring Profiles**: Create and test custom fantasy football scoring rules
- **Player Explorer**: Browse players, view stats, and compare scoring systems
- **Flexible Scoring Engine**: Support for multipliers, bonuses, thresholds, and caps
- **Local-First Design**: SQLite database with WAL mode for performance
- **Modern UI**: React frontend with Tailwind CSS and responsive design
- **API-First Architecture**: FastAPI backend with automatic documentation

## Tech Stack

### Backend
- **FastAPI** + Pydantic v2 for API development
- **SQLAlchemy 2.x** with async support and aiosqlite
- **SQLite** with WAL mode and FTS5 for full-text search
- **nfl_data_py** for NFL player data and statistics
- **Typer CLI** for ETL operations and administration

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TanStack Query** for server state management
- **Tailwind CSS** for styling
- **Recharts** for data visualization

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Clone and navigate to the project**
   ```bash
   cd NFLDrafter
   ```

2. **Create virtual environment and install dependencies**
   ```bash
   # Using uv (recommended)
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv pip install -e .
   
   # Or using pip
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -e .
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database**
   ```bash
   cd api
   python cli.py init
   ```

5. **Seed with sample data (optional)**
   ```bash
   # Install nfl_data_py first
   pip install nfl-data-py
   
   # Seed players and stats
   python cli.py seed_players
   python cli.py load_stats 2023
   ```

6. **Start the API server**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173`

## Usage

### Scoring Profile Builder

1. Navigate to the Scoring Builder page
2. Create custom scoring rules with:
   - **Multipliers**: Points per unit (e.g., 0.1 points per yard)
   - **Bonuses**: Extra points for reaching thresholds
   - **Caps**: Maximum points per category
3. Test your profile with sample data
4. Save profiles for later use

### Player Explorer

1. Navigate to the Player Explorer page
2. Select season, week, and scoring profile
3. Browse players and view fantasy points
4. Compare different scoring systems
5. Search and filter players

### API Endpoints

- **GET** `/fantasy/points` - Calculate fantasy points
- **GET** `/fantasy/players/{id}/stats` - Get player statistics
- **GET** `/fantasy/profiles` - List scoring profiles
- **GET** `/health` - Health check

API documentation available at `http://localhost:8000/docs`

## CLI Commands

```bash
# Initialize database and seed default profiles
python cli.py init

# Seed players from nfl_data_py
python cli.py seed_players

# Load weekly stats for specific seasons
python cli.py load_stats 2022,2023,2024

# View all available commands
python cli.py --help
```

## Project Structure

```
NFLDrafter/
├── api/                          # FastAPI backend
│   ├── app/
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── scoring.py           # Scoring engine
│   │   ├── db.py                # Database configuration
│   │   ├── main.py              # FastAPI application
│   │   ├── routers/             # API route handlers
│   │   └── services/            # Business logic
│   └── cli.py                   # CLI commands
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom React hooks
│   │   └── api.ts               # API client
│   └── package.json
├── .cursorrules                  # Development guidelines
├── pyproject.toml               # Python project config
└── README.md
```

## Development

### Code Quality

- **Python**: Use `ruff` for linting, `black` for formatting
- **TypeScript**: ESLint and Prettier for code quality
- **Database**: Follow SQLAlchemy best practices

### Testing

```bash
# Run backend tests
cd api
pytest

# Run frontend tests
cd frontend
npm test
```

### Database Migrations

The project uses SQLAlchemy with automatic table creation. For production deployments, consider using Alembic for migrations.

## Configuration

### Environment Variables

- `DATABASE_URL`: Database connection string
- `YAHOO_CLIENT_ID`: Yahoo OAuth client ID
- `YAHOO_CLIENT_SECRET`: Yahoo OAuth client secret
- `NEWS_FEEDS`: Comma-separated RSS feed URLs
- `DEBUG`: Enable debug mode
- `ALLOWED_ORIGINS`: CORS allowed origins

### Database Configuration

- **SQLite**: Default with WAL mode for performance
- **Postgres**: Change `DATABASE_URL` to postgresql://...
- **FTS5**: Full-text search for news content

## Performance

- Scoring calculations: <50ms per profile
- Database queries: Optimized with proper indexing
- Frontend: Virtualized tables for large datasets
- News search: FTS5 for fast text queries

## Future Enhancements

- [ ] Yahoo OAuth integration
- [ ] News ingestion and player association
- [ ] Advanced analytics and projections
- [ ] Export/import scoring profiles
- [ ] Multi-user support
- [ ] Real-time game data integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding standards in `.cursorrules`
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions and support:
- Create an issue on GitHub
- Check the API documentation at `/docs`
- Review the `.cursorrules` file for development guidelines
