# Architecture Documentation

## System Overview

Faultline.ai is a production-readiness analysis platform that analyzes engineering artifacts (OpenAPI specs, architecture diagrams, documentation) to identify potential issues before deployment. The system uses a hybrid approach combining rule-based heuristics with AI-powered synthesis to generate comprehensive analysis reports.

## High-Level Architecture

```
┌─────────────────┐
│   Next.js       │
│   Frontend      │  Port 3000
│   (React/TS)    │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│   FastAPI       │
│   Backend       │  Port 8080
│   (Python 3.12) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐  ┌──▼────┐
│ Redis │  │  AI   │
│ Cache │  │Models │
└───────┘  └───────┘
```

## Component Architecture

### 1. Frontend (Client)

**Technology Stack:**
- Next.js 16.0.10 (App Router)
- React 19.2.1
- TypeScript 5
- Tailwind CSS 4
- Zustand (state management)
- Radix UI components
- Recharts (data visualization)

**Key Directories:**
- `app/` - Next.js App Router pages and routes
- `components/` - Reusable UI components
- `lib/` - Utilities, API client, hooks, types
- `public/` - Static assets

**Deployment:**
- Dockerized with multi-stage build
- Uses Bun runtime
- Standalone output mode for optimized builds

### 2. Backend (Server)

**Technology Stack:**
- FastAPI (Python 3.12+)
- Pydantic AI for LLM integration
- Redis for job state and caching
- Loguru for structured logging
- UV package manager

**Key Directories:**
- `app/main.py` - FastAPI application entry point
- `app/routers/` - API route handlers
- `app/logic/` - Business logic (normalization, heuristics)
- `app/schemas/` - Pydantic models for validation
- `app/config.py` - Configuration management
- `app/redis_client.py` - Redis connection management

**Deployment:**
- Dockerized with Python 3.12 slim base
- Uses UV for dependency management
- Runs on port 8080

### 3. Redis

**Purpose:**
- Job state management (queued, running, completed, failed)
- Result caching (24-hour TTL)
- Job listing and retrieval

**Key Patterns:**
- `job:{job_id}` - Job state storage
- `cache:{content_hash}` - Analysis result cache
- TTL-based expiration (1 hour for jobs, 24 hours for cache)

### 4. AI System

**Providers Supported:**
- OpenAI (GPT models)
- Google (Gemini)
- Groq
- Ollama (local models)

**Integration:**
- Pydantic AI framework
- Structured output via Pydantic models
- Configurable model settings (temperature, max tokens)
- Demo mode for testing without AI

## Data Flow

### Analysis Request Flow

```
1. User uploads/pastes content → Frontend
2. Frontend sends POST /artifacts/analyze → Backend
3. Backend:
   a. Computes content hash
   b. Checks Redis cache
   c. If cache hit: return immediately
   d. If cache miss:
      - Create job in Redis (status: QUEUED)
      - Queue background task
      - Return job_id
4. Background task:
   a. Update job status: RUNNING
   b. Normalize artifact (OpenAPI/Architecture/Markdown)
   c. Run heuristics
   d. Synthesize with AI
   e. Update job status: COMPLETED
   f. Store result in Redis
   g. Cache result with content hash
5. Frontend polls GET /jobs/{job_id}
6. When COMPLETED, fetch GET /jobs/{job_id}/result
7. Display results in review page
```

### Job State Machine

```
QUEUED → RUNNING → COMPLETED
              ↓
           FAILED
```

## API Architecture

### REST Endpoints

**Analysis:**
- `POST /artifacts/analyze` - Submit artifact for analysis
- `GET /jobs/{job_id}` - Get job status
- `GET /jobs/{job_id}/result` - Get analysis result
- `GET /jobs` - List all jobs

**System:**
- `GET /health` - Health check
- `GET /` - API root

**Feedback:**
- `POST /feedback` - Submit feedback (stub)

### Request/Response Models

All models use Pydantic for validation and serialization. See `server/app/schemas/analysis.py` for complete definitions.

## Processing Pipeline

### Step 1: Normalization

Converts raw content into structured `NormalizedArtifact`:

- **OpenAPI**: Extracts endpoints, methods, security, pagination, versioning
- **Architecture**: Extracts services, components (databases, queues, caches)
- **Markdown**: Extracts sections by heading hierarchy

### Step 2: Heuristics

Rule-based analysis that generates `HeuristicFinding` objects:

- **OpenAPI Heuristics:**
  - Unsecured write endpoints
  - Missing pagination on list endpoints
  - Missing API versioning

- **Architecture Heuristics:**
  - Missing security architecture
  - Single points of failure

- **Markdown Heuristics:**
  - Missing documentation sections (security, scaling, deployment, monitoring)

### Step 3: AI Synthesis

Pydantic AI agent processes:
- Normalized artifact
- Heuristic findings
- Metadata (repo, team, risk tolerance, depth)

Outputs:
- Production readiness score (0-100)
- Executive summary
- Enhanced findings list
- Charts (severity distribution, category breakdown, trends)
- Suggested next steps
- Markdown report

## Configuration

### Environment Variables

**Backend:**
- `REDIS_URL` - Redis connection string
- `DEMO_MODE` - Enable demo mode (bypasses AI)
- `AI_PROVIDER` - openai|google|groq|ollama
- `AI_MODEL` - Model identifier
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google API key
- `GROQ_API_KEY` - Groq API key
- `OLLAMA_BASE_URL` - Ollama server URL
- `MAX_CONTENT_SIZE` - Max artifact size (default: 500KB)
- `MAX_AI_TOKENS` - Max tokens for AI (default: 4096)
- `AI_TEMPERATURE` - AI temperature (default: 0.2)
- `LOG_LEVEL` - Logging level

**Frontend:**
- `BACKEND_API_URL` - Backend API URL
- `NODE_ENV` - Environment (development|production)

### Constraints

- Max content size: 500KB
- Max endpoints: 100
- Max components: 50
- Max sections: 50
- Job expiration: 1 hour
- Cache expiration: 24 hours

## Deployment

### Docker Compose

Three services:
1. **server** - FastAPI backend
2. **client** - Next.js frontend
3. **redis** - Redis cache

### Build Process

**Backend:**
```dockerfile
1. Python 3.12 slim base
2. Install UV package manager
3. Copy application code
4. Run `uv sync --locked`
5. Execute FastAPI with `fastapi run`
```

**Frontend:**
```dockerfile
1. Bun slim base
2. Install dependencies
3. Build Next.js app
4. Copy standalone output
5. Run with Bun
```

## Security Considerations

- CORS configured (currently permissive, TODO: restrict in production)
- Content size limits prevent DoS
- Redis TTL prevents unbounded growth
- Input validation via Pydantic schemas
- No authentication/authorization (TODO for production)

## Scalability

### Current Limitations

- Single-threaded Python (FastAPI async but single process)
- In-memory job queue (no distributed queue)
- Single Redis instance
- No load balancing

### Future Improvements

- Horizontal scaling with multiple FastAPI instances
- Distributed job queue (Celery, RQ, or similar)
- Redis cluster for high availability
- CDN for frontend static assets
- Database for persistent job history

## Monitoring & Observability

- Structured logging via Loguru
- Health check endpoint
- Job status tracking
- Error handling with proper HTTP status codes

## Development Workflow

1. Local development: `docker-compose up`
2. Backend changes: Rebuild server container
3. Frontend changes: Rebuild client container
4. Environment: Configure via `.env` files or docker-compose environment variables

## Technology Decisions

**Why FastAPI?**
- Async/await support
- Automatic OpenAPI docs
- Type safety with Pydantic
- High performance

**Why Next.js App Router?**
- Server components for better performance
- Built-in routing
- API routes capability
- React Server Components

**Why Redis?**
- Fast in-memory storage
- TTL support for automatic cleanup
- Simple key-value model fits job state
- No need for complex queries

**Why Pydantic AI?**
- Structured output guarantees
- Type-safe AI integration
- Multiple provider support
- Built-in retry logic

